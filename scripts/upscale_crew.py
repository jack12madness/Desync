import asyncio
import os
import base64
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

PROMPT = (
    "Upscale and enhance this image to 4x resolution with maximum sharpness and clean detail. "
    "CRITICAL: the three characters must remain 100% identical — same faces, same suits, same "
    "weapons, same duffel bags, same poses, same colors. Do not redraw, restyle, or alter anything "
    "about their appearance. Keep the background fully transparent."
)


async def main():
    img64 = base64.b64encode(open("/app/frontend/public/images/hero-crew.png", "rb").read()).decode()
    chat = LlmChat(
        api_key=os.getenv("EMERGENT_LLM_KEY"),
        session_id="upscale-1",
        system_message="You are an AI image enhancement assistant.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    msg = UserMessage(text=PROMPT, file_contents=[ImageContent(image_base64=img64)])
    text, images = await chat.send_message_multimodal_response(msg)
    if images:
        data = base64.b64decode(images[0]["data"])
        with open("/app/assets/hero-crew-upscaled.png", "wb") as f:
            f.write(data)
        print("SAVED bytes:", len(data))
    else:
        print("NO_IMAGES text:", (text or "")[:200])


asyncio.run(main())
