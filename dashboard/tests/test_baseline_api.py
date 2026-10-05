"""FastAPI integration tests with an isolated BaselineStore."""
import copy
import asyncio
import shutil
import tempfile
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
