import asyncio
import os
import base64
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage

PROMPT = (
    "Cinematic GTA V loading-screen style key art, wide 16:9 composition: a three-man heist crew "
    "standing together on the RIGHT side of the frame, all wearing matching dark heist suits with "
    "white shirts and carrying black duffel bags and rifles slung over shoulders. Man on the left: "
    "stocky middle-aged, slicked dark hair, loosened striped tie, holding a pistol down at his side. "
    "Man in the center: tall, bald, intense staring eyes, short dark beard, white shirt under dark "
    "suit, duffel bag in one fist. Man on the right: young, short fade haircut, dark suit and white "
    "shirt, holding a rifle across his chest. All three facing forward like a lineup before a job. "
    "Deep midnight navy blue cinematic color grade, strong blue rim lighting, the LEFT half of the "
    "frame is dark empty navy haze for text, faint neon city bokeh far behind them at night. "
    "Ultra-detailed 3D game render, fan-art style, no text, no logos."
)


async def main():
    chat = LlmChat(
        api_key=os.getenv("EMERGENT_LLM_KEY"),
        session_id="hero-gen-3",
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
