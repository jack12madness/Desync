import asyncio
import os
import base64
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from emergentintegrations.llm.chat import LlmChat, UserMessage

STYLE = (
    "Cinematic AAA video game key art, dark midnight navy blue color grade, deep blue rim lighting, "
    "moody atmosphere, ultra-detailed 3D game render, human character, portrait composition. "
    "No robots, no sci-fi armor, no text, no logos."
)

PRODUCTS = {
    "product-fivem-executor": (
        "A stylish confident man in a black bomber jacket and gold chain leaning on a neon-lit "
        "supercar at night, Los Santos-inspired city lights bokeh behind him, holding car keys."
    ),
    "product-fivem-menu": (
        "A cool young man in designer streetwear standing in front of a glowing nightclub entrance "
        "at night, city street wet with reflections, arms crossed, slight grin."
    ),
    "product-rust": (
        "A rugged human survivor in handmade road-sign armor and beanie holding an assault rifle, "
        "standing in a foggy desert outpost at dusk, warm firelight behind."
    ),
    "product-warzone": (
        "A human special forces soldier in modern tactical gear and helmet with goggles up, "
        "holding a rifle low-ready, standing in a smoky urban street at night, blue moonlight."
    ),
    "product-valorant": (
        "A sharp confident woman agent in a sleek dark tactical suit holding a pistol lowered, "
        "standing in a neon-lit city alley at night, cinematic fog."
    ),
    "product-apex": (
        "An athletic human competitor in futuristic sportswear with a energy rifle slung on the "
        "back, standing in a massive arena under floodlights at night, confetti in the air."
    ),
    "product-spoofer": (
        "A mysterious human figure in a dark hoodie sitting at a gaming setup with three glowing "
        "monitors in a dark room, face half lit by screen glow, blue ambient light."
    ),
}


async def gen(name, prompt):
    chat = LlmChat(
        api_key=os.getenv("EMERGENT_LLM_KEY"),
        session_id=f"prod-{name}",
        system_message="You are an AI image generation assistant.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt + " " + STYLE))
    if images:
        data = base64.b64decode(images[0]["data"])
        with open(f"/app/frontend/public/images/{name}.png", "wb") as f:
            f.write(data)
        print("SAVED", name, len(data), flush=True)
    else:
        print("FAIL", name, (text or "")[:80], flush=True)


async def main():
    os.makedirs("/app/frontend/public/images", exist_ok=True)
    for name, prompt in PRODUCTS.items():
        try:
            await gen(name, prompt)
        except Exception as e:
            print("ERR", name, str(e)[:120], flush=True)


asyncio.run(main())
