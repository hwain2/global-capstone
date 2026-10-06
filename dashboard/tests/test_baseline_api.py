"""FastAPI integration tests with an isolated BaselineStore."""
import copy
import asyncio
import shutil
import tempfile
import unittest
import subprocess
from pathlib import Path
from unittest.mock import patch

try:
    import httpx
    from backend.app import create_app
    from backend.service import BaselineStore
except ImportError:
    httpx = None


ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(httpx, "Install backend/requirements-dev.txt for API tests")
class ApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / "tests")
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        data = root / "data/baselines"; data.mkdir(parents=True)
        for name in ("inha_2prop.json", "manifest.json"):
            shutil.copy2(ROOT / "data/baselines" / name, data / name)
        self.store = BaselineStore(root)
        self.public = create_app("PUBLIC_MODE", self.store)
        self.editor = create_app("EDITOR_MODE", self.store)

    def test_public_read_only_and_editor_write(self):
        async def run():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.public),
                                         base_url="http://testserver") as public:
                self.assertEqual((await public.get("/api/config")).json()["mode"], "PUBLIC_MODE")
                self.assertEqual(len((await public.get("/api/baselines")).json()), 1)
                self.assertEqual((await public.post("/api/baselines", json={})).status_code, 405)
                self.assertEqual((await public.post("/api/sync", json={})).status_code, 404)
                self.assertEqual((await public.post("/api/ai/parse-baseline", json={})).status_code, 404)
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.editor),
                                         base_url="http://testserver") as editor:
                draft = copy.deepcopy(self.store.get("inha_2prop"))
                draft["battery"]["capacity_Ah"]["value"] = 3.5
                self.assertEqual((await editor.post("/api/baselines/validate", json=draft)).json()["errors"], [])
                response = await editor.put("/api/baselines/inha_2prop",
                                            json={"baseline": draft, "editor": "KNU member", "note": "test"})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["baseline"]["revision"], 2)
                self.assertEqual((await editor.get("/api/baselines/inha_2prop")).json()["battery"]["capacity_Ah"]["value"], 3.5)
                self.assertEqual((await editor.put("/api/baselines/inha_2prop",
                                                    json={"baseline": draft, "editor": "stale"})).status_code, 409)
                self.assertEqual((await editor.post("/api/baselines/validate", json=draft,
                                                    headers={"Origin": "https://evil.example"})).status_code, 403)
                self.assertEqual((await editor.get("/api/ai/status")).json()["enabled"], False)
                self.assertEqual((await editor.post("/api/ai/parse-baseline", json={})).status_code, 503)
        asyncio.run(run())

    def test_two_clients_create_reload_edit_and_deactivate(self):
        async def run():
            transport = httpx.ASGITransport(app=self.editor)
            async with httpx.AsyncClient(transport=transport, base_url="http://internal") as first, \
                       httpx.AsyncClient(transport=transport, base_url="http://internal") as second:
                draft = copy.deepcopy(self.store.get("inha_2prop"))
                draft.update(id="inha_4prop", concept_name="4-Prop", revision=0, inherited_from="inha_2prop r1")
                draft["propulsion"]["prop_count"]["value"] = 4
                response = await first.post("/api/baselines", json={"baseline": draft, "editor": "First PC", "note": "new concept"})
                self.assertEqual(response.status_code, 200)
                saved = response.json()["baseline"]
                self.assertEqual((await second.get("/api/baselines/inha_4prop")).json(), saved)
                restarted = create_app("EDITOR_MODE", BaselineStore(self.store.root))
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=restarted), base_url="http://internal") as reload:
                    self.assertEqual((await reload.get("/api/baselines/inha_4prop")).json(), saved)
                stale = copy.deepcopy(saved)
                saved["battery"]["capacity_Ah"]["value"] = 4
                response = await first.put("/api/baselines/inha_4prop", json={"baseline": saved, "editor": "First PC"})
                saved = response.json()["baseline"]
                response = await second.put("/api/baselines/inha_4prop", json={"baseline": stale, "editor": "Second PC"})
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.json()["detail"]["latest"], saved)
                self.assertEqual(response.json()["detail"]["submitted"], stale)
                rows = (await second.get("/api/baselines/inha_4prop/history")).json()
                self.assertTrue(any(row["field"] == "battery.capacity_Ah.value" and row["editor"] == "First PC" for row in rows))
                saved["active"] = False
                self.assertEqual((await first.put("/api/baselines/inha_4prop", json={"baseline": saved, "editor": "First PC"})).status_code, 200)
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.public), base_url="http://public") as public:
                    self.assertEqual((await public.get("/api/baselines/inha_4prop")).status_code, 404)
                    self.assertNotIn("inha_4prop", [item["id"] for item in (await public.get("/api/baselines")).json()])
        asyncio.run(run())

    def test_public_mode_registers_no_write_routes(self):
        for route in self.public.routes:
            if hasattr(route, "methods"):
                self.assertFalse(set(route.methods) & {"POST", "PUT", "PATCH", "DELETE"})
        async def run():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.public), base_url="http://public") as client:
                for method, path in (("POST", "/api/baselines"), ("PUT", "/api/baselines/inha_2prop"),
                                     ("DELETE", "/api/baselines/inha_2prop"), ("POST", "/api/baselines/validate"),
                                     ("POST", "/api/sync"), ("POST", "/api/ai/review-baseline")):
                    self.assertIn((await client.request(method, path, json={})).status_code, (404, 405))
                for path in ("/backend/service.py", "/.runtime/history.sqlite", "/.git/config"):
                    self.assertEqual((await client.get(path)).status_code, 404)
        asyncio.run(run())

    def test_bad_payloads_and_wrong_crud_operation(self):
        async def run():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.editor), base_url="http://internal") as client:
                self.assertEqual((await client.post("/api/baselines", json=[])).status_code, 400)
                self.assertEqual((await client.post("/api/baselines", content="{broken")).status_code, 400)
                data = self.store.get("inha_2prop")
                self.assertEqual((await client.post("/api/baselines", json={"baseline": data, "editor": "KNU"})).status_code, 409)
                data.update(id="missing_baseline", revision=0)
                self.assertEqual((await client.put("/api/baselines/missing_baseline", json={"baseline": data, "editor": "KNU"})).status_code, 404)
                data["wing"]["area"]["source_type"] = []
                validation = (await client.post("/api/baselines/validate", json=data)).json()
                self.assertTrue(validation["errors"])
                self.assertEqual((await client.post("/api/baselines", json={"baseline": data, "editor": "KNU"})).status_code, 422)
        asyncio.run(run())

    def test_sync_timeout_is_reported_without_data_loss(self):
        before = self.store.get("inha_2prop")
        async def run():
            with patch.object(self.store, "sync", side_effect=subprocess.TimeoutExpired(["git", "fetch"], 45)):
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.editor), base_url="http://internal") as client:
                    self.assertEqual((await client.post("/api/sync", json={})).status_code, 409)
        asyncio.run(run())
        self.assertEqual(self.store.get("inha_2prop"), before)


if __name__ == "__main__":
    unittest.main()
