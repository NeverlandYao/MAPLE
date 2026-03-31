import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv("backend/.env")

client = OpenAI(
    api_key=os.getenv("MS_API_KEY"),
    base_url=os.getenv("MS_BASE_URL"),
)

try:
    print(f"Testing Model: {os.getenv('MS_MODEL')}")
    completion = client.chat.completions.create(
        model=os.getenv("MS_MODEL"),
        messages=[{"role": "user", "content": "Hello"}],
    )
    print("Success:", completion.choices[0].message.content)
except Exception as exc:
    print("Error:", exc)
