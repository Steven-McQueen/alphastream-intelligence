"""
NewsAPI.org client for market/newsroom content.
"""

from typing import Dict, List, Optional

import requests

from config import NEWS_API_KEY


class NewsAPIClient:
    """NewsAPI.org client (backend-only)."""

    BASE_URL = "https://newsapi.org/v2"

    def __init__(self) -> None:
        self.api_key = NEWS_API_KEY
        if self.api_key:
            print(f"[NEWSAPI] API Key loaded: Yes ({self.api_key[:8]}...)")
        else:
            print("[NEWSAPI] API Key loaded: NO - MISSING!")

    def _make_request(self, endpoint: str, params: Optional[dict] = None) -> dict:
        """Make API request to NewsAPI. Returns empty payload on failure."""
        if not self.api_key:
            return {"articles": []}

        url = f"{self.BASE_URL}{endpoint}"
        headers = {"X-Api-Key": self.api_key}

        try:
            response = requests.get(url, params=params or {}, headers=headers, timeout=12)
            response.raise_for_status()
            data = response.json()
            if data.get("status") != "ok":
                print(f"[NEWSAPI] Non-ok response for {endpoint}: {data.get('message', 'unknown')}")
                return {"articles": []}
            return data
        except requests.exceptions.RequestException as exc:
            print(f"[NEWSAPI] Error calling {endpoint}: {exc}")
            return {"articles": []}

    def get_top_headlines(
        self,
        category: str = "business",
        country: str = "us",
        page_size: int = 20,
    ) -> List[Dict]:
        data = self._make_request(
            "/top-headlines",
            params={
                "category": category,
                "country": country,
                "pageSize": min(max(page_size, 1), 100),
            },
        )
        return data.get("articles", [])

    def get_everything(
        self,
        q: str,
        domains: Optional[str] = None,
        page_size: int = 20,
        sort_by: str = "publishedAt",
        language: str = "en",
    ) -> List[Dict]:
        params = {
            "q": q,
            "language": language,
            "sortBy": sort_by,
            "pageSize": min(max(page_size, 1), 100),
        }
        if domains:
            params["domains"] = domains

        data = self._make_request("/everything", params=params)
        return data.get("articles", [])


newsapi_client = NewsAPIClient()

