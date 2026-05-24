"""Manual test for GET/POST market-summary endpoints. Run with backend on :8000."""

import json
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8000"


def req(method: str, path: str) -> tuple[int, dict]:
    r = urllib.request.Request(f"{BASE}{path}", method=method)
    try:
        with urllib.request.urlopen(r, timeout=180) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, {"detail": body}


def main() -> int:
    print("GET /api/market/market-summary")
    code, data = req("GET", "/api/market/market-summary")
    print("  status:", code)
    print("  available:", data.get("available"))
    print("  sections:", len(data.get("sections", [])))

    print("\nPOST /api/market/market-summary/refresh (may take 30–90s)")
    code, data = req("POST", "/api/market/market-summary/refresh")
    print("  status:", code)
    if code != 200:
        print("  detail:", data.get("detail", data))
        return 1
    print("  available:", data.get("available"))
    print("  openingSummary chars:", len(data.get("openingSummary") or ""))
    for s in data.get("sections", []):
        print(f"  - {s.get('title')}: {len(s.get('items', []))} items")
    return 0


if __name__ == "__main__":
    sys.exit(main())
