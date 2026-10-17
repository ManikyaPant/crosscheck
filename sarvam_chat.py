import os
from pathlib import Path

from sarvamai import SarvamAI


env_file = Path(__file__).with_name(".env")
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        name, separator, value = line.partition("=")
        if separator and name.strip() == "SARVAM_API_KEY":
            os.environ.setdefault(name.strip(), value.strip().strip("\"'"))

api_key = os.environ.get("SARVAM_API_KEY", "").strip()
if not api_key:
    raise SystemExit("Paste your Sarvam API key into .env before running this script.")

client = SarvamAI(api_subscription_key=api_key)
try:
    response = client.chat.completions(
        model="sarvam-105b-conversations",
        messages=[{"role": "user", "content": "Say hello in one short sentence."}],
    )
except Exception:
    raise SystemExit("Sarvam request failed. Check your API key, account access, and connection.") from None

print(response.choices[0].message.content)
