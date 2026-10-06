#!/usr/bin/env python3
"""Build only the static calculator and active baseline JSON for GitHub Pages."""
import argparse
import json
import shutil
from pathlib import Path


def build_public(dashboard_root, output):
    root, output = Path(dashboard_root).resolve(), Path(output).resolve()
    if output == root or output in root.parents or (root in output.parents and root / ".runtime" not in output.parents):
        raise ValueError("Choose an output directory outside the source files.")
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output must be a new or empty directory.")
    data = root / "data" / "baselines"
    manifest = json.loads((data / "manifest.json").read_text(encoding="utf-8"))
    baselines = []
    for name in manifest["baselines"]:
        if not isinstance(name, str) or Path(name).name != name or not name.endswith(".json") or name == "manifest.json":
            raise ValueError("Invalid baseline filename in manifest.")
        item = json.loads((data / name).read_text(encoding="utf-8"))
        if item.get("active", True):
            baselines.append((name, item))
    target = output / "dashboard"
    target.mkdir(parents=True)
    shutil.copy2(root / "index.html", target / "index.html")
    for folder in ("css", "js", "assets"):
        if (root / folder).exists():
            shutil.copytree(root / folder, target / folder)
    public_data = target / "data" / "baselines"
    public_data.mkdir(parents=True)
    for name, item in baselines:
        (public_data / name).write_text(json.dumps(item, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (public_data / "manifest.json").write_text(json.dumps({**manifest, "baselines": [name for name, _ in baselines]}, indent=2) + "\n", encoding="utf-8")
    (output / ".nojekyll").touch()
    (output / "index.html").write_text('<!doctype html><html lang="ko"><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=dashboard/"><title>항공기 구조 설계 도구</title><a href="dashboard/">계산기 열기</a></html>\n', encoding="utf-8")
    return target


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="new or empty destination directory")
    args = parser.parse_args()
    print(build_public(Path(__file__).resolve().parents[1], args.output))
