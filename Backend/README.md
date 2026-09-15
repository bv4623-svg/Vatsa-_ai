# Vatsa AI Router — Intent Classifier Backend

Implements the **Intent Catalog v1.0** spec: a service that classifies a user
query into one or more of the 27 defined intents, with confidence scores.

Per the catalog's critical rules, this backend:
- ❌ does NOT select an AI model
- ❌ does NOT classify difficulty levels
- ❌ does NOT generate responses
- ✅ ONLY returns structured intent classification data
- ✅ supports multi-intent queries

## Files

| File | Purpose |
|---|---|
| `intents_data.py` | The 27 intents transcribed from the catalog (description, keywords, example queries, related intents, disclaimer flags). |
| `classifier.py` | `IntentClassifier` — combines keyword matching with TF-IDF/cosine similarity against each intent's example queries to produce a 0–100 confidence score per intent. |
| `app.py` | FastAPI service exposing the classifier over HTTP. |
| `requirements.txt` | Dependencies. |

## How classification works

For each of the 27 intents, two signals are combined:

1. **Keyword score** — how many of the intent's keywords appear in the query (word-boundary matched).
2. **Similarity score** — cosine similarity between the query and the intent's example queries in a shared TF-IDF space.

`combined = 0.55 * keyword_score + 0.45 * similarity_score`, clamped to 0–100.

Intents are ranked by combined score. The top one is the **primary intent**;
any others scoring ≥ 25 are returned as **secondary intents**
(`is_multi_intent = true` when there are any). Each score is bucketed per the
catalog's own bands:

- **HIGH**: 90–100
- **MEDIUM**: 60–89
- **LOW**: 0–59

`LEGAL` and `MEDICAL` intents carry a `disclaimer` string that is surfaced in
the response only when confidence is HIGH, per the catalog's "CRITICAL NOTE".

## Running locally

```bash
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## API

### `GET /health`
Basic liveness check, also reports how many intents are loaded.

### `GET /intents`
Returns the full structured catalog (description, keywords, related intents)
for all 27 intents.

### `GET /intents/{intent_name}`
Returns one intent's full definition, e.g. `/intents/PROGRAMMING`.

### `POST /classify`
```json
{
  "query": "Fix this Python TypeError and write a unit test",
  "top_k": 5
}
```

Response:
```json
{
  "query": "Fix this Python TypeError and write a unit test",
  "primary_intent": {
    "intent": "CODING_DEBUGGING",
    "confidence": 51.2,
    "band": "LOW",
    "matched_keywords": ["fix", "typeerror"]
  },
  "secondary_intents": [
    {
      "intent": "PROGRAMMING",
      "confidence": 42.9,
      "band": "LOW",
      "matched_keywords": ["python"]
    }
  ],
  "is_multi_intent": true,
  "disclaimer": null
}
```

## Extending

To add a new intent, add an entry to `INTENTS` in `intents_data.py` with
`description`, `keywords`, `examples`, and `related_intents` — the
classifier picks it up automatically, no code changes needed. This mirrors
the catalog's stated goal of scaling to hundreds of intents.
