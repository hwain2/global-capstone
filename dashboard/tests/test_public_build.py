import json
import shutil
import tempfile
import unittest
from pathlib import Path

from scripts.build_public import build_public

ROOT = Path(__file__).resolve().parents[1]


class PublicBuildTests(unittest.TestCase):
    def test_public_artifact_contains_only_static_calculator(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "site"
            target = build_public(ROOT, output)
            self.assertTrue((target / "index.html").is_file())
            self.assertTrue((target / "js/app.js").is_file())
            self.assertTrue((output / ".nojekyll").is_file())
            for private in ("backend", ".runtime", ".venv", "tests", "scripts", ".git"):
                self.assertFalse((target / private).exists())
            manifest = json.loads((target / "data/baselines/manifest.json").read_text())
            self.assertEqual(manifest["baselines"], ["inha_2prop.json"])
            with self.assertRaises(ValueError):
                build_public(ROOT, output)

    def test_inactive_baseline_excluded_from_public_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "source"
            (root / "data/baselines").mkdir(parents=True)
            shutil.copy2(ROOT / "index.html", root / "index.html")
            data = json.loads((ROOT / "data/baselines/inha_2prop.json").read_text())
            data["active"] = False
            (root / "data/baselines/inha_2prop.json").write_text(json.dumps(data))
            (root / "data/baselines/manifest.json").write_text(json.dumps({"baselines": ["inha_2prop.json"]}))
            target = build_public(root, Path(directory) / "site")
            self.assertFalse((target / "data/baselines/inha_2prop.json").exists())
            self.assertEqual(json.loads((target / "data/baselines/manifest.json").read_text())["baselines"], [])
