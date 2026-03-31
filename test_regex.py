import re
text = """Okay, the user said "Hello." That's a friendly greeting.
</think>

Hello! How can I assist you today?"""

if "</think>" in text:
    text = re.sub(r"^[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()
else:
    text = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"<think>[\s\S]*", "", text, flags=re.IGNORECASE).strip()

print("Result:", repr(text))
