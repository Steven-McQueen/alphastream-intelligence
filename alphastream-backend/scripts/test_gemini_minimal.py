"""
Minimal Gemini test — matches Google's quickstart.
Run from alphastream-backend: python scripts/test_gemini_minimal.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import GEMINI_API_KEY, GEMINI_MODEL


def main() -> int:
    if not GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY missing from .env")
        return 1

    from google import genai

    client = genai.Client(api_key=GEMINI_API_KEY)
    print(f"Testing model: {GEMINI_MODEL}")
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents="Explain how AI works in a few words",
    )
    print("Response:", response.text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
