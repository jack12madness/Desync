import asyncio
import os
import base64
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage

PROMPT = (
    "Cinematic GTA V loading-screen style key art, single character portrait: a young man in his "
    "mid-twenties with a short fade haircut and light beard, wearing a green-and-black bomber jacket "
    "over a white tee with a thin gold chain, confident easy grin, one hand in his pocket. Standing "
    "on a night rooftop with a neon city skyline bokeh behind him, slightly right of center. Deep "
    "midnight navy blue cinematic color grade, strong blue rim lighting, ultra-detailed 3D game "
    "render, fan-art style, full upper body visible, dark navy haze on the left side of frame, "
    "no text, no logos."
)


async def main():
    chat = LlmChat(
        api_key=os.getenv("EMERGENT_LLM_KEY"),
        session_id="franklin-gen-1",
        system_message="You are an AI image generation assistant.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    text, images = await chat.send_message_multimodal_response(UserMessage(text=PROMPT))
    if images:
        data = base64.b64decode(images[0]["data"])
        with open("/app/frontend/public/images/character-franklin.png", "wb") as f:
            f.write(data)
        print("SAVED bytes:", len(data))
    else:
        print("NO_IMAGES text:", (text or "")[:200])


asyncio.run(main())
