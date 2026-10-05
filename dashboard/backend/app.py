"""FastAPI editor. GitHub Pages serves the same frontend without this API."""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .ai_service import DisabledAI
from .service import BaselineError, BaselineStore, RevisionConflict, validate_baseline

ROOT = Path(__file__).resolve().parents[1]


def create_app(mode=None, store=None):
    mode = mode or os.environ.get("AST_MODE", "PUBLIC_MODE")
    if mode not in {"PUBLIC_MODE", "EDITOR_MODE"}:
        raise ValueError("AST_MODE must be PUBLIC_MODE or EDITOR_MODE")
    store = store or BaselineStore(ROOT, Path(os.environ.get("AST_RUNTIME_DIR", ROOT / ".runtime")))
    ai_service = DisabledAI()
    app = FastAPI(title="Aircraft baseline service", docs_url=None, redoc_url=None,
                  openapi_url=None)

    @app.get("/api/config")
    async def config():
        return {"mode": mode}

    @app.get("/api/baselines")
    async def list_baselines():
        return store.list(active_only=mode == "PUBLIC_MODE")

    @app.get("/api/baselines/{baseline_id}")
    async def get_baseline(baseline_id: str):
        try:
            item = store.get(baseline_id)
        except (FileNotFoundError, BaselineError):
            raise HTTPException(404, "Baseline not found")
        if mode == "PUBLIC_MODE" and not item.get("active", True):
            raise HTTPException(404, "Baseline not found")
        return item

    if mode == "EDITOR_MODE":
        def same_origin(request: Request):
            origin = request.headers.get("origin")
            if origin and urlparse(origin).netloc != request.headers.get("host"):
                raise HTTPException(403, "Cross-origin writes are not allowed")

        @app.post("/api/baselines/validate")
        async def validate(request: Request):
            same_origin(request)
            errors, warnings = validate_baseline(await request.json())
            return {"errors": errors, "warnings": warnings}

        async def write_baseline(request: Request, baseline_id=None):
            same_origin(request)
            body = await request.json()
            data = body.get("baseline")
            editor = body.get("editor")
            if not isinstance(data, dict) or baseline_id and data.get("id") != baseline_id:
                raise HTTPException(400, "Baseline id mismatch")
            try:
                return store.save(data, editor, body.get("note", ""))
            except RevisionConflict as error:
                raise HTTPException(409, {"message": str(error), "latest": error.latest,
                                          "submitted": error.submitted})
            except BaselineError as error:
                raise HTTPException(422, str(error))

        @app.post("/api/baselines")
        async def create(request: Request):
            return await write_baseline(request)

        @app.put("/api/baselines/{baseline_id}")
        async def update(baseline_id: str, request: Request):
            return await write_baseline(request, baseline_id)

        @app.get("/api/baselines/{baseline_id}/history")
        async def history(baseline_id: str):
            try:
                store.get(baseline_id)
                return store.history(baseline_id)
            except (FileNotFoundError, BaselineError):
                raise HTTPException(404, "Baseline not found")

        @app.post("/api/sync")
        async def sync(request: Request):
            same_origin(request)
            try:
                return store.sync()
            except (BaselineError, RuntimeError) as error:
                raise HTTPException(409, str(error))

        @app.get("/api/ai/status")
        async def ai_status():
            return {"enabled": ai_service.enabled, "human_confirmation_required": True}

        @app.post("/api/ai/{operation}")
        async def ai_operation(operation: str, request: Request):
            same_origin(request)
            if operation not in {"parse-baseline", "review-baseline", "compare-baselines"}:
                raise HTTPException(404, "Unknown AI operation")
            raise HTTPException(503, "Local LLM is not configured; baseline editor remains available")

    @app.get("/")
    async def index():
        return FileResponse(ROOT / "index.html")

    for folder in ("css", "js", "assets", "data"):
        path = ROOT / folder
        if path.exists():
            app.mount(f"/{folder}", StaticFiles(directory=path), name=folder)
    return app


app = create_app()
