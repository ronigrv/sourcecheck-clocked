import io
import json
import unittest
from urllib.error import HTTPError
from unittest.mock import patch
import server

SAMPLE = {"question": "When does the program close?", "answer": "The program closes Friday.",
          "documents": [{"id": "a", "title": "Notice", "text": "Applications close Friday."},
                        {"id": "b", "title": "Update", "text": "The deadline was extended to Monday."}]}

class FakeResponse:
    def __init__(self, data): self.data = json.dumps(data).encode()
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, size): return self.data

class Tests(unittest.TestCase):
    def test_redirects_are_not_followed_with_bearer_credentials(self):
        request = server.urllib.request.Request(
            server.BASE_URL + "rerank", headers={"Authorization": "Bearer placeholder"})
        self.assertIsNone(server.NoRedirect().redirect_request(
            request, None, 302, "Found", {}, "https://other.example/"))

    def test_review_keeps_all_sources_and_surfaces_partial_error(self):
        calls = []
        def caller(endpoint, payload, key):
            calls.append((endpoint, payload))
            if endpoint == "compare": return None, "unavailable"
            return {"ok": True}, None
        result = server.review(SAMPLE, "unused", caller)
        self.assertEqual([c[0] for c in calls], ["rerank", "compare", "grounding"])
        self.assertEqual([d["id"] for d in calls[2][1]["documents"]], ["a", "b"])
        self.assertIsNone(result["compare"])
        self.assertEqual(result["errors"], {"compare": "unavailable"})

    def test_validates_unique_ids_and_source_minimum(self):
        for docs in [SAMPLE["documents"][:1], [SAMPLE["documents"][0]] * 2]:
            with self.assertRaises(server.InputError):
                server.validate({**SAMPLE, "documents": docs})

    def test_headers_and_response(self):
        def fake_open(req, timeout):
            self.assertEqual(req.full_url, server.BASE_URL + "rerank")
            self.assertEqual(req.get_header("Authorization"), "Bearer placeholder")
            self.assertTrue(req.get_header("Idempotency-key"))
            return FakeResponse({"results": [{"id": "a", "action": "use"}]})
        result, err = server.request_clocked("rerank", {"query": "q"}, "placeholder", fake_open)
        self.assertIsNone(err)
        self.assertEqual(result["results"][0]["id"], "a")

    def test_http_error_does_not_echo_server_body_or_key(self):
        def fake_open(req, timeout):
            raise HTTPError(req.full_url, 401, "not authorized", {}, io.BytesIO(b"secret"))
        result, err = server.request_clocked("grounding", {}, "placeholder", fake_open)
        self.assertIsNone(result)
        self.assertNotIn("secret", err)
        self.assertNotIn("placeholder", err)

    def test_missing_required_response_is_not_fabricated(self):
        result, err = server.request_clocked("compare", {}, "placeholder", lambda *a, **k: FakeResponse({}))
        self.assertIsNone(result)
        self.assertIsNotNone(err)

if __name__ == "__main__": unittest.main()
