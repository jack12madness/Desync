import asyncio
import os
import base64
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage

PROMPT = (
    "Minimal flat vector esports logo icon for a gaming brand: the letter D formed by two "
    "horizontally offset, sliced halves that look slightly glitched and desynchronized, the top "
    "half shifted a few pixels right of the bottom half. Electric royal blue gradient (#2E6BFF to "
    "#7FA8E8) on a solid very dark midnight navy background (#050B18). Crisp clean edges, centered "
    "square composition, generous padding around the mark, no text, no letters besides the D mark, "
    "no shadows, no photo elements."
)


async def main():
    chat = LlmChat(
        api_key=os.getenv("EMERGENT_LLM_KEY"),
        session_id="logo-gen-1",
        system_message="You are an AI image generation assistant.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    text, images = await chat.send_message_multimodal_response(UserMessage(text=PROMPT))
    os.makedirs("/app/frontend/public/images", exist_ok=True)
    if images:
        data = base64.b64decode(images[0]["data"])
        with open("/app/frontend/public/images/logo.png", "wb") as f:
            f.write(data)
        print("SAVED bytes:", len(data))
    else:
        print("NO_IMAGES text:", (text or "")[:120])


asyncio.run(main())
