import asyncio
import os
import base64
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage

PROMPT = (
    "Cinematic GTA V loading-screen style key art, wide 16:9 composition: two men standing back to "
    "back on a rooftop at night, positioned on the RIGHT side of the frame. Man on the left of the "
    "pair: middle-aged, slicked-back hair with grey flecks, open-collar white shirt under a dark "
    "blazer, gold watch, arms crossed, calm confident smirk. Man on the right of the pair: bald, "
    "intense wild eyes, short scruffy beard, stained white t-shirt, holding a wooden baseball bat "
    "loosely at his side, unhinged grin. Neon city skyline bokeh far behind them. Deep midnight navy "
    "blue cinematic color grade, strong blue rim lighting on both men. The LEFT half of the frame is "
    "mostly empty dark navy haze (negative space for text). Ultra-detailed 3D game render, fan-art "
    "style, no text, no logos."
)


async def main():
    chat = LlmChat(
        api_key=os.getenv("EMERGENT_LLM_KEY"),
        session_id="hero-gen-2",
        system_message="You are an AI image generation assistant.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    text, images = await chat.send_message_multimodal_response(UserMessage(text=PROMPT))
    if images:
        data = base64.b64decode(images[0]["data"])
        with open("/app/frontend/public/images/hero-gta.png", "wb") as f:
            f.write(data)
        print("SAVED bytes:", len(data))
    else:
        print("NO_IMAGES text:", (text or "")[:200])


asyncio.run(main())
