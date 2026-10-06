"""Run with: python3 -m unittest discover -s tests -p 'test_*.py'"""
import copy
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.service import BaselineError, BaselineStore, RevisionConflict, validate_baseline


ROOT = Path(__file__).resolve().parents[1]
BASELINE = json.loads((ROOT / "data/baselines/inha_2prop.json").read_text())


class BaselineServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / "tests")
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.root = self.repo / "dashboard"
        data = self.root / "data/baselines"
        data.mkdir(parents=True)
        for filename in ("inha_2prop.json", "manifest.json"):
            shutil.copy2(ROOT / "data/baselines" / filename, data / filename)
        self.env = patch.dict(os.environ, {"GIT_AUTHOR_NAME":"KNU Test", "GIT_AUTHOR_EMAIL":"test@example.invalid",
                                         "GIT_COMMITTER_NAME":"KNU Test", "GIT_COMMITTER_EMAIL":"test@example.invalid"})
        self.env.start(); self.addCleanup(self.env.stop)
        subprocess.run(["git", "init", "-q", str(self.repo)], check=True)
        subprocess.run(["git", "-C", str(self.repo), "add", "dashboard/data"], check=True)
        subprocess.run(["git", "-C", str(self.repo), "commit", "-qm", "Initial baseline"], check=True)
        self.store = BaselineStore(self.root)

    def test_schema_and_geometry_warning(self):
        errors, warnings = validate_baseline(BASELINE)
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])
        bad = copy.deepcopy(BASELINE)
        bad["wing"]["span"] = {"value": 1.5, "unit":"m", "source_type":"INHA", "source_note":""}
        self.assertEqual(validate_baseline(bad)[0], [])
        self.assertTrue(any("AR" in warning for warning in validate_baseline(bad)[1]))
        bad["battery"]["capacity_Ah"]["value"] = -1
        self.assertTrue(any("capacity_Ah" in error for error in validate_baseline(bad)[0]))

    def test_save_history_revision_and_local_commit(self):
        edited = self.store.get("inha_2prop")
        edited["battery"]["capacity_Ah"]["value"] = 3.4
        response = self.store.save(edited, "KNU member", "IPT update")
        self.assertEqual(response["baseline"]["revision"], 2)
        self.assertEqual(response["commit_status"], "committed")
        self.assertEqual(self.store.get("inha_2prop")["battery"]["capacity_Ah"]["value"], 3.4)
        second_pc = BaselineStore(self.root)
        self.assertEqual(second_pc.get("inha_2prop")["battery"]["capacity_Ah"]["value"], 3.4)
        history = self.store.history("inha_2prop")
        self.assertTrue(any(row["field"] == "battery.capacity_Ah.value" and
                            json.loads(row["previous_value"]) == 3.3 and
                            json.loads(row["new_value"]) == 3.4 and row["editor"] == "KNU member"
                            for row in history))
        message = subprocess.run(["git", "-C", str(self.repo), "log", "-1", "--pretty=%s"],
                                 check=True, capture_output=True, text=True).stdout
        self.assertIn("r2", message)
        body = subprocess.run(["git", "-C", str(self.repo), "log", "-1", "--pretty=%B"],
                              check=True, capture_output=True, text=True).stdout
        self.assertIn("Editor: KNU member", body)
        self.assertIn("battery.capacity_Ah.value: 3.3 -> 3.4", body)
        with self.assertRaises(RevisionConflict):
            self.store.save(edited, "stale member")

    def test_duplicate_and_offline_sync_preserves_data(self):
        draft = copy.deepcopy(BASELINE)
        draft.update(id="inha_4prop", concept_name="4-Prop", revision=0,
                     inherited_from="inha_2prop r1")
        draft["propulsion"]["prop_count"]["value"] = 4
        result = self.store.save(draft, "KNU member", "new concept")
        self.assertEqual(result["baseline"]["revision"], 1)
        self.assertIn("inha_4prop.json", json.loads((self.root / "data/baselines/manifest.json").read_text())["baselines"])
        with self.assertRaises(RuntimeError):
            self.store.sync()  # No remote configured; local save and commit remain.
        self.assertEqual(self.store.get("inha_4prop")["propulsion"]["prop_count"]["value"], 4)

    def test_deactivate_and_reactivate(self):
        draft = self.store.get("inha_2prop")
        draft["active"] = False
        self.store.save(draft, "KNU member")
        self.assertEqual(self.store.list(active_only=True), [])
        self.assertEqual(json.loads((self.root / "data/baselines/manifest.json").read_text())["baselines"], [])
        draft = self.store.get("inha_2prop"); draft["active"] = True
        self.store.save(draft, "KNU member")
        self.assertEqual(len(self.store.list(active_only=True)), 1)

    def test_validation_accepts_single_prop_and_rejects_invalid_schema(self):
        single = copy.deepcopy(BASELINE)
        single["propulsion"]["prop_count"]["value"] = 1
        single["aircraft"]["mass"]["value"] = 0
        self.assertEqual(validate_baseline(single)[0], [])
        for group, key, invalid in (("propulsion", "prop_count", 1.5), ("battery", "series_count", 0),
                                    ("battery", "capacity_Ah", 0), ("wing", "area", -1)):
            data = copy.deepcopy(BASELINE)
            data[group][key]["value"] = invalid
            self.assertTrue(validate_baseline(data)[0])
        for patch in ({"revision": True}, {"revision": -1}, {"active": "false"}, {"id": "manifest"}):
            data = copy.deepcopy(BASELINE); data.update(patch)
            self.assertTrue(validate_baseline(data)[0])
        for key, invalid in (("source_type", []), ("source_note", {}), ("unit", []), ("value", float("nan"))):
            data = copy.deepcopy(BASELINE); data["wing"]["area"][key] = invalid
            self.assertTrue(validate_baseline(data)[0])
        data = copy.deepcopy(BASELINE)
        data["structural_inputs"]["material"]["elasticModulusGPa"] = {
            "value": -70, "unit": "GPa", "source_type": "ASSUMED", "source_note": "invalid"}
        self.assertTrue(validate_baseline(data)[0])

    def test_geometry_warnings_allow_save(self):
        data = self.store.get("inha_2prop")
        for key, number in (("span", 1.5), ("rootChord", .8), ("tipChord", .4)):
            data["wing"][key] = {"value": number, "unit": "m", "source_type": "INHA", "source_note": "reported"}
        errors, warnings = validate_baseline(data)
        self.assertEqual(errors, [])
        self.assertEqual(len(warnings), 3)
        result = self.store.save(data, "KNU", "reported geometry")
        self.assertEqual(result["baseline"]["revision"], 2)
        self.assertEqual(result["warnings"], warnings)

    def test_create_and_update_do_not_overwrite_the_wrong_resource(self):
        data = self.store.get("inha_2prop")
        with self.assertRaises(RevisionConflict):
            self.store.save(data, "KNU", operation="create")
        data.update(id="missing_concept", revision=0)
        with self.assertRaises(FileNotFoundError):
            self.store.save(data, "KNU", operation="update")
        self.assertFalse((self.root / "data/baselines/missing_concept.json").exists())
        self.assertEqual(self.store.get("inha_2prop")["revision"], 1)

    def test_git_commit_failure_keeps_json_and_history(self):
        def unavailable(args):
            raise RuntimeError("Git identity is missing")
        store = BaselineStore(self.root, git_runner=unavailable)
        data = store.get("inha_2prop"); data["battery"]["capacity_Ah"]["value"] = 4
        result = store.save(data, "KNU", "offline")
        self.assertIn("failed:", result["commit_status"])
        self.assertEqual(store.get("inha_2prop")["battery"]["capacity_Ah"]["value"], 4)
        self.assertTrue(any(row["field"] == "battery.capacity_Ah.value" for row in store.history("inha_2prop")))

    def _local_remote(self):
        remote = self.repo / "remote.git"
        subprocess.run(["git", "init", "--bare", "-q", str(remote)], check=True)
        subprocess.run(["git", "-C", str(self.repo), "remote", "add", "origin", str(remote)], check=True)
        subprocess.run(["git", "-C", str(self.repo), "push", "-q", "origin", "HEAD:main"], check=True)
        return remote

    def test_explicit_sync_pushes_saved_baselines(self):
        remote = self._local_remote()
        data = self.store.get("inha_2prop"); data["battery"]["capacity_Ah"]["value"] = 4
        before = subprocess.run(["git", "--git-dir", str(remote), "rev-parse", "main"], capture_output=True, text=True, check=True).stdout
        self.store.save(data, "KNU")
        self.assertEqual(subprocess.run(["git", "--git-dir", str(remote), "rev-parse", "main"], capture_output=True, text=True, check=True).stdout, before,
                         "saving never automatically pushes")
        with patch.dict(os.environ, {"AST_GIT_BRANCH": "main"}):
            self.assertEqual(self.store.sync()["status"], "synced")
        pushed = subprocess.run(["git", "--git-dir", str(remote), "show", "main:dashboard/data/baselines/inha_2prop.json"], capture_output=True, text=True, check=True).stdout
        self.assertEqual(json.loads(pushed)["battery"]["capacity_Ah"]["value"], 4)

    def test_remote_ahead_preserves_saved_data(self):
        remote = self._local_remote()
        other = self.repo / "other_pc"
        subprocess.run(["git", "clone", "-q", "-b", "main", str(remote), str(other)], check=True)
        (other / "README.md").write_text("Other member update")
        subprocess.run(["git", "-C", str(other), "add", "README.md"], check=True)
        subprocess.run(["git", "-C", str(other), "commit", "-qm", "Other update"], check=True)
        subprocess.run(["git", "-C", str(other), "push", "-q", "origin", "main"], check=True)
        data = self.store.get("inha_2prop"); data["battery"]["capacity_Ah"]["value"] = 4
        self.store.save(data, "KNU")
        before = self.store.get("inha_2prop"), self.store.history("inha_2prop")
        with patch.dict(os.environ, {"AST_GIT_BRANCH": "main"}):
            with self.assertRaisesRegex(BaselineError, "newer commits"):
                self.store.sync()
        self.assertEqual((self.store.get("inha_2prop"), self.store.history("inha_2prop")), before)

    def test_push_rejection_preserves_json_history_and_commit(self):
        remote = self._local_remote()
        hook = remote / "hooks/pre-receive"
        hook.write_text("#!/bin/sh\nexit 1\n"); hook.chmod(0o755)
        data = self.store.get("inha_2prop"); data["battery"]["capacity_Ah"]["value"] = 4
        self.store.save(data, "KNU")
        before = self.store.get("inha_2prop"), self.store.history("inha_2prop")
        head = subprocess.run(["git", "-C", str(self.repo), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout
        with patch.dict(os.environ, {"AST_GIT_BRANCH": "main"}):
            with self.assertRaises(RuntimeError):
                self.store.sync()
        self.assertEqual((self.store.get("inha_2prop"), self.store.history("inha_2prop")), before)
        self.assertEqual(subprocess.run(["git", "-C", str(self.repo), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout, head)

    def test_unrelated_staged_changes_are_not_included_in_baseline_commit(self):
        unrelated = self.repo / "draft.txt"; unrelated.write_text("Unfinished work")
        subprocess.run(["git", "-C", str(self.repo), "add", "draft.txt"], check=True)
        data = self.store.get("inha_2prop"); data["battery"]["capacity_Ah"]["value"] = 4
        self.assertEqual(self.store.save(data, "KNU")["commit_status"], "committed")
        committed = subprocess.run(["git", "-C", str(self.repo), "show", "--pretty=", "--name-only", "HEAD"], capture_output=True, text=True, check=True).stdout
        self.assertNotIn("draft.txt", committed)
        staged = subprocess.run(["git", "-C", str(self.repo), "diff", "--cached", "--name-only"], capture_output=True, text=True, check=True).stdout
        self.assertIn("draft.txt", staged)


if __name__ == "__main__":
    unittest.main()
