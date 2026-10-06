"""JSON source of truth, revision/history metadata, and explicit Git sync."""
from __future__ import annotations

import copy
import json
import math
import os
import re
import sqlite3
import subprocess
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path

SOURCE_TYPES = {"BASELINE", "INHA", "KAU", "ERAU", "REQ", "STRUCT", "ASSUMED", "TBD", "CALC"}
ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{1,63}$")
DATA_GROUPS = ("aircraft", "wing", "fuselage", "flight", "propulsion", "battery", "weight_budget")
STRUCTURAL_GROUPS = ("landing", "material", "sparDesign", "feasibility", "design")


class BaselineError(Exception):
    pass


class RevisionConflict(BaselineError):
    def __init__(self, latest, submitted):
        self.latest = latest
        self.submitted = submitted
        super().__init__("Baseline has been modified by another user.")


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def value(data, path):
    node = data
    for part in path.split("."):
        node = node.get(part, {}) if isinstance(node, dict) else {}
    return node.get("value") if isinstance(node, dict) else None


def flatten(data, prefix=""):
    result = {}
    for key, item in data.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(item, dict):
            result.update(flatten(item, path))
        elif key not in {"updated_at", "created_at", "updated_by", "created_by", "revision"}:
            result[path] = item
    return result


def validate_baseline(data):
    errors, warnings = [], []
    if not isinstance(data, dict):
        return ["Baseline must be a JSON object."], warnings
    baseline_id = data.get("id")
    if not isinstance(baseline_id, str) or not ID_PATTERN.fullmatch(baseline_id):
        errors.append("id: use 2–64 lowercase letters, digits, underscore or hyphen.")
    elif baseline_id == "manifest":
        errors.append("id: manifest is reserved for the public baseline list.")
    for key in ("school", "concept_name", "configuration"):
        if not isinstance(data.get(key), str) or not data[key].strip():
            errors.append(f"{key}: required text.")
    revision = data.get("revision", 0)
    if isinstance(revision, bool) or not isinstance(revision, int) or revision < 0:
        errors.append("revision: nonnegative integer required.")
    if "active" in data and not isinstance(data["active"], bool):
        errors.append("active: boolean required.")
    for key in ("source", "notes", "inherited_from"):
        if key in data and not isinstance(data[key], str):
            errors.append(f"{key}: text required.")
    for group in DATA_GROUPS:
        if not isinstance(data.get(group), dict):
            errors.append(f"{group}: object required.")
    structural = data.get("structural_inputs")
    if not isinstance(structural, dict):
        errors.append("structural_inputs: object required.")
    else:
        for group in STRUCTURAL_GROUPS:
            if not isinstance(structural.get(group), dict):
                errors.append(f"structural_inputs.{group}: object required.")
    if errors:
        return errors, warnings
    for group in DATA_GROUPS:
        for key, field in data[group].items():
            if not isinstance(field, dict) or "value" not in field or "unit" not in field or "source_type" not in field or "source_note" not in field:
                errors.append(f"{group}.{key}: value, unit, source_type and source_note required.")
            elif not isinstance(field["source_type"], str) or field["source_type"] not in SOURCE_TYPES:
                errors.append(f"{group}.{key}: invalid source_type.")
            elif not isinstance(field["unit"], str) or not isinstance(field["source_note"], str):
                errors.append(f"{group}.{key}: unit and source_note must be text.")
            elif field["value"] is not None and (isinstance(field["value"], bool) or
                    not isinstance(field["value"], (int, float)) or not math.isfinite(field["value"])):
                errors.append(f"{group}.{key}: finite numeric value required.")
    for group in STRUCTURAL_GROUPS:
        for key, field in structural[group].items():
            if not isinstance(field, dict) or not {"value", "unit", "source_type", "source_note"} <= field.keys():
                errors.append(f"structural_inputs.{group}.{key}: field descriptor required.")
            elif not isinstance(field["source_type"], str) or field["source_type"] not in SOURCE_TYPES:
                errors.append(f"structural_inputs.{group}.{key}: invalid source_type.")
            elif not isinstance(field["unit"], str) or not isinstance(field["source_note"], str):
                errors.append(f"structural_inputs.{group}.{key}: unit and source_note must be text.")
            elif group == "design" and key == "source":
                if field["value"] not in ("ultimate", "gust", "landing", "custom"):
                    errors.append("structural_inputs.design.source: invalid load selection.")
            elif field["value"] is not None and (isinstance(field["value"], bool) or
                    not isinstance(field["value"], (int, float)) or not math.isfinite(field["value"])):
                errors.append(f"structural_inputs.{group}.{key}: finite numeric value required.")
    if errors:
        return errors, warnings
    for path in ("propulsion.prop_count", "battery.series_count", "battery.capacity_Ah", "battery.battery_mass_kg"):
        if path.split(".")[1] not in data[path.split(".")[0]]:
            errors.append(f"{path}: descriptor required.")
    numeric_rules = {
        "aircraft.mass": (0, False), "wing.area": (0, True), "wing.span": (0, True),
        "wing.ar": (0, True), "wing.rootChord": (0, True), "wing.tipChord": (0, True),
        "propulsion.prop_count": (1, False), "battery.series_count": (0, True),
        "battery.capacity_Ah": (0, True), "battery.battery_mass_kg": (0, False),
    }
    for path, (lower, strict) in numeric_rules.items():
        number = value(data, path)
        if number is None:
            if path not in {"wing.span", "wing.ar", "wing.rootChord", "wing.tipChord", "battery.battery_mass_kg"}:
                errors.append(f"{path}: required value.")
            continue
        if (isinstance(number, bool) or not isinstance(number, (int, float)) or
                (number <= lower if strict else number < lower)):
            errors.append(f"{path}: invalid numeric value.")
    # Optional inputs use calculator defaults when absent, but an explicitly
    # supplied invalid assumption must not be persisted as a usable baseline.
    for path in ("aircraft.nLimit", "aircraft.fs", "aircraft.g", "wing.taper",
                 "flight.speed", "flight.rho", "flight.liftSlope", "flight.muG",
                 "fuselage.length", "fuselage.width", "fuselage.height", "fuselage.wettedArea", "fuselage.lt",
                 "structural_inputs.material.density", "structural_inputs.material.capStress",
                 "structural_inputs.material.webStress", "structural_inputs.material.elasticModulusGPa",
                 "structural_inputs.landing.stop", "structural_inputs.sparDesign.capWidthMm",
                 "structural_inputs.sparDesign.capWidthRatio", "structural_inputs.sparDesign.localThicknessMm",
                 "structural_inputs.sparDesign.manufacturingMinCapMm", "structural_inputs.sparDesign.manufacturingMinWebMm",
                 "structural_inputs.feasibility.tipDeflectionLimitMm", "structural_inputs.feasibility.mtowLimit",
                 "structural_inputs.feasibility.designTarget"):
        number = value(data, path)
        if number is not None and number <= 0:
            errors.append(f"{path}: positive value required.")
    for path in ("flight.gustSpeed", "structural_inputs.landing.drop"):
        number = value(data, path)
        if number is not None and number < 0:
            errors.append(f"{path}: nonnegative value required.")
    props = value(data, "propulsion.prop_count")
    if props is not None and (not isinstance(props, int) or isinstance(props, bool)):
        errors.append("propulsion.prop_count: integer required.")
    series = value(data, "battery.series_count")
    if series is not None and (not isinstance(series, int) or isinstance(series, bool)):
        errors.append("battery.series_count: integer required.")
    battery_mass = data["battery"].get("battery_mass_kg")
    if isinstance(battery_mass, dict) and battery_mass.get("value") is None and battery_mass.get("source_type") != "TBD":
        errors.append("battery.battery_mass_kg: unknown mass must have source_type TBD.")
    for key, field in data["weight_budget"].items():
        if isinstance(field, dict) and isinstance(field.get("value"), (int, float)) and field["value"] < 0:
            errors.append(f"weight_budget.{key}: mass must be nonnegative.")
    for path in ("wing.tc", "structural_inputs.sparDesign.sparXc"):
        measure = value(data, path)
        if measure is not None and (not isinstance(measure, (int, float)) or not 0 < measure < 1):
            errors.append(f"{path}: value must be between 0 and 1.")
    for path in ("structural_inputs.sparDesign.depthFactor", "structural_inputs.sparDesign.capWidthRatio"):
        measure = value(data, path)
        if measure is not None and not 0 < measure <= 1:
            errors.append(f"{path}: value must be positive and no greater than 1.")
    area, span, ar = (value(data, p) for p in ("wing.area", "wing.span", "wing.ar"))
    if span is None and ar is None:
        errors.append("wing: span or AR required.")
    if all(isinstance(v, (int, float)) and v > 0 for v in (area, span, ar)):
        calc = span * span / area
        if abs(calc-ar)/ar > 0.02:
            warnings.append(f"Geometry consistency: reported AR {ar:g}, calculated AR {calc:.3f}.")
    root, tip = value(data, "wing.rootChord"), value(data, "wing.tipChord")
    taper = value(data, "wing.taper")
    if all(isinstance(v, (int, float)) and v > 0 for v in (root, tip, taper)) and abs(tip/root-taper) > .02:
        warnings.append(f"Geometry consistency: reported taper {taper:g}, calculated {tip/root:.3f}.")
    if all(isinstance(v, (int, float)) and v > 0 for v in (area, span, root, tip)):
        computed = span*(root+tip)/2
        if abs(computed-area)/area > .02:
            warnings.append(f"Geometry consistency: reported area {area:g} m², trapezoid {computed:.3f} m².")
    if any(k in data["weight_budget"] for k in ("battery",)):
        errors.append("weight_budget.battery: store battery mass only in battery.battery_mass_kg.")
    if value(data, "structural_inputs.design.source") == "custom":
        custom_load = value(data, "structural_inputs.design.customLoad")
        if custom_load is None or custom_load <= 0:
            errors.append("structural_inputs.design.customLoad: positive custom load required.")
    return errors, warnings


class BaselineStore:
    def __init__(self, dashboard_root: Path, runtime_root: Path | None = None, git_runner=None):
        self.root = Path(dashboard_root).resolve()
        self.data_dir = self.root / "data" / "baselines"
        self.runtime = Path(runtime_root or self.root / ".runtime").resolve()
        self.runtime.mkdir(parents=True, exist_ok=True)
        self.db_path = self.runtime / "history.sqlite"
        self.lock = threading.RLock()
        self.git_runner = git_runner or self._run_git
        with self._db() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS changes (
                id INTEGER PRIMARY KEY, baseline_id TEXT NOT NULL, editor TEXT NOT NULL,
                timestamp TEXT NOT NULL, field TEXT NOT NULL, previous_value TEXT,
                new_value TEXT, note TEXT NOT NULL, revision INTEGER NOT NULL)""")
            db.execute("""CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY, baseline_id TEXT NOT NULL, editor TEXT NOT NULL,
                timestamp TEXT NOT NULL, revision INTEGER NOT NULL, note TEXT NOT NULL,
                commit_status TEXT NOT NULL)""")

    def _db(self):
        return sqlite3.connect(self.db_path)

    def _path(self, baseline_id):
        if not isinstance(baseline_id, str) or not ID_PATTERN.fullmatch(baseline_id) or baseline_id == "manifest":
            raise BaselineError("Invalid baseline id.")
        return self.data_dir / f"{baseline_id}.json"

    def get(self, baseline_id):
        path = self._path(baseline_id)
        if not path.exists():
            raise FileNotFoundError(baseline_id)
        return json.loads(path.read_text(encoding="utf-8"))

    def list(self, active_only=False):
        items = [json.loads(path.read_text(encoding="utf-8")) for path in self.data_dir.glob("*.json")
                 if path.name != "manifest.json"]
        return sorted((item for item in items if not active_only or item.get("active", True)),
                      key=lambda item: (item["school"], item["concept_name"]))

    def _atomic_json(self, path, data):
        fd, temp = tempfile.mkstemp(prefix=".baseline-", dir=self.data_dir)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(data, handle, indent=2, ensure_ascii=False)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp, path)
        finally:
            if os.path.exists(temp):
                os.unlink(temp)

    def _manifest(self):
        names = [item["id"] + ".json" for item in self.list(active_only=True)]
        self._atomic_json(self.data_dir / "manifest.json", {"schema_version": 1, "baselines": names})

    def _run_git(self, args):
        result = subprocess.run(["git", "-C", str(self.root), *args], capture_output=True,
                                text=True, timeout=45, check=False)
        if result.returncode:
            raise RuntimeError((result.stderr or result.stdout).strip() or "Git command failed")
        return result.stdout.strip()

    def _commit(self, baseline_id, message):
        files = [f"data/baselines/{baseline_id}.json", "data/baselines/manifest.json"]
        self.git_runner(["rev-parse", "--show-toplevel"])
        self.git_runner(["add", "--", *files])
        self.git_runner(["commit", "--only", "-m", message, "--", *files])

    def save(self, submitted, editor, note="", *, operation=None):
        if not isinstance(editor, str) or not editor.strip() or len(editor) > 100:
            raise BaselineError("Editor name is required (maximum 100 characters).")
        editor = editor.strip()
        if not isinstance(note, str):
            raise BaselineError("Change note must be text.")
        errors, warnings = validate_baseline(submitted)
        if errors:
            raise BaselineError("; ".join(errors))
        baseline_id = submitted["id"]
        with self.lock:
            try:
                previous = self.get(baseline_id)
            except FileNotFoundError:
                previous = None
            expected = submitted.get("revision", 0)
            if operation == "create" and previous:
                raise RevisionConflict(previous, submitted)
            if operation == "update" and not previous:
                raise FileNotFoundError(baseline_id)
            if previous and expected != previous["revision"]:
                raise RevisionConflict(previous, submitted)
            if not previous and expected not in (0, None):
                raise BaselineError("New baseline revision must be 0.")
            current = copy.deepcopy(submitted)
            now = utc_now()
            current["revision"] = (previous["revision"] if previous else 0) + 1
            current["created_at"] = previous["created_at"] if previous else now
            current["created_by"] = previous["created_by"] if previous else editor
            current["updated_at"] = now
            current["updated_by"] = editor
            current.setdefault("active", True)
            current.setdefault("source", "")
            current.setdefault("notes", "")
            self._atomic_json(self._path(baseline_id), current)
            self._manifest()
            before, after = flatten(previous or {}), flatten(current)
            changes = [(field, before.get(field), after.get(field)) for field in sorted(before.keys() | after.keys())
                       if before.get(field) != after.get(field)]
            with self._db() as db:
                for field, old, new in changes:
                    db.execute("""INSERT INTO changes(baseline_id,editor,timestamp,field,previous_value,new_value,note,revision)
                                  VALUES(?,?,?,?,?,?,?,?)""", (baseline_id, editor, now, field,
                                  json.dumps(old, ensure_ascii=False), json.dumps(new, ensure_ascii=False),
                                  note, current["revision"]))
                db.execute("""INSERT INTO events(baseline_id,editor,timestamp,revision,note,commit_status)
                              VALUES(?,?,?,?,?,?)""", (baseline_id, editor, now, current["revision"], note, "pending"))
            commit_status = "committed"
            try:
                message = f"Update {current['school']} {current['concept_name']} baseline r{current['revision']}\n\nEditor: {editor}"
                if note:
                    message += f"\nNote: {note}"
                message += "\n\n" + "\n".join(f"{field}: {json.dumps(old, ensure_ascii=False)} -> {json.dumps(new, ensure_ascii=False)}"
                                             for field, old, new in changes)
                self._commit(baseline_id, message)
            except (RuntimeError, subprocess.TimeoutExpired, ValueError, OSError) as error:
                commit_status = f"failed: {error}"
            with self._db() as db:
                db.execute("UPDATE events SET commit_status=? WHERE baseline_id=? AND revision=?",
                           (commit_status, baseline_id, current["revision"]))
            return {"baseline": current, "warnings": warnings, "commit_status": commit_status}

    def history(self, baseline_id):
        self._path(baseline_id)
        with self._db() as db:
            db.row_factory = sqlite3.Row
            rows = db.execute("SELECT * FROM changes WHERE baseline_id=? ORDER BY id DESC", (baseline_id,)).fetchall()
        return [dict(row) for row in rows]

    def sync(self):
        with self.lock:
            branch = os.environ.get("AST_GIT_BRANCH", "main")
            if not ID_PATTERN.fullmatch(branch):
                raise BaselineError("Invalid Git branch setting.")
            if self.git_runner(["status", "--porcelain", "--", "data/baselines"]):
                raise BaselineError("Baseline JSON has an uncommitted change. Restore local Git commit before sync.")
            self.git_runner(["fetch", "origin", branch])
            divergence = self.git_runner(["rev-list", "--left-right", "--count", f"HEAD...origin/{branch}"]).split()
            if len(divergence) != 2 or int(divergence[1]):
                raise BaselineError("GitHub has newer commits. Resolve the divergence before sync.")
            self.git_runner(["push", "origin", f"HEAD:{branch}"])
            return {"status": "synced", "branch": branch}
