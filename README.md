# SourceCheck

SourceCheck helps a reviewer compare a proposed claim with supplied sources. It uses Clocked to rank passages, identify relationships between sources, and assess individual claims against those sources. It reports support in the documents supplied, not objective truth. Reviewers should check the original material and any missing evidence.

[Watch the short walkthrough](demo.mp4). The walkthrough uses fictional data and screenshots captured from a real review.

## Run locally

Requirements: Python 3.9 or later and a Clocked API key. This app uses only the Python standard library. Create a free Clocked account and API key separately; the one-time free credit allowance and current terms are described on [Clocked pricing](https://clocked.rezolve.ai/pricing). Do not commit, share, or paste your key into the browser.

PowerShell:

```powershell
$env:CLOCKED_API_KEY = 'your-own-key'
python server.py
```

Open `http://127.0.0.1:8765/`. Change the local port using `SOURCECHECK_PORT` if needed. Stop the server with Ctrl+C. The server binds only to localhost. Source texts are sent to Clocked for processing; use synthetic, public, or authorized material. The server neither stores the submitted documents nor logs them.

## How it works

1. **Rerank** orders source passages for the reviewer and reports whether to use, expand, or skip them.
2. **Compare** checks relationships and possible conflicts between source pairs.
3. **Verify / grounding** assesses each claim against all supplied sources, including sources that rerank says to skip. That preserves potential contradictions.

Each endpoint's result is shown separately. A failed endpoint leaves its output unavailable; the application does not manufacture evidence. Source quotes, verdicts, and classifications can be wrong. Missing evidence does not prove a claim false. API calls consume credits according to Clocked's current billing and availability.

Endpoints: [Rerank](https://clocked.rezolve.ai/docs/rerank), [Compare](https://clocked.rezolve.ai/docs/compare), [Verify](https://clocked.rezolve.ai/docs/grounding), [Authentication](https://clocked.rezolve.ai/docs/authentication).

## Test without an API key

```powershell
python -m unittest discover -s . -p 'test_*.py'
```

These tests mock Clocked's network responses. They do not establish that a live API call succeeds or measure model accuracy. Live API validation requires your own key and credits.
