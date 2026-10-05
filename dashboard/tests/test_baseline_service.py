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


if __name__ == "__main__":
    unittest.main()
