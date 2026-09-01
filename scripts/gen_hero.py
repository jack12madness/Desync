import asyncio
import os
import base64
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage

PROMPT = (
    "Cinematic AAA video game key art, wide 16:9 composition: two stylish GTA-style characters "
    "standing back to back on the RIGHT side of the frame. One wears a black bomber jacket over a "
    "white tee with a gold chain, holding a baseball bat resting on his shoulder, confident smirk. "
    "The other wears dark tactical streetwear with a bandana, arms crossed. Dramatic deep blue rim "
    "lighting, midnight navy atmosphere, faint Los Santos-inspired neon city lights bokeh far behind "
    "them. The LEFT half of the frame is mostly empty dark deep-navy haze (negative space for text). "
    "Ultra-detailed 3D game render, moody cinematic lighting, dark blue color grade."
)


async def main():
    chat = LlmChat(
        api_key=os.getenv("EMERGENT_LLM_KEY"),
        session_id="hero-gen-1",
        system_message="You are an AI image generation assistant.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    text, images = await chat.send_message_multimodal_response(UserMessage(text=PROMPT))
    os.makedirs("/app/frontend/public/images", exist_ok=True)
    if images:
        data = base64.b64decode(images[0]["data"])
        with open("/app/frontend/public/images/hero-gta.png", "wb") as f:
            f.write(data)
        print("SAVED bytes:", len(data))
    else:
        print("NO_IMAGES text:", (text or "")[:120])


asyncio.run(main())
