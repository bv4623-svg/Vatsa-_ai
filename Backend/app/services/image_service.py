"""
Image generation. Uses Pollinations.ai as the underlying provider, but
the raw provider URL is never returned to a client and the provider
name is never exposed -- same policy as the model-identity seal in
ai_service.py, applied to images.

Pollinations' `nologo=true` query param does NOT reliably suppress its
watermark for the flux model (verified empirically: some generations
carry a visible "pollinations.ai" mark in the bottom-right corner,
some don't, even with nologo set). Rather than trust an unreliable
upstream flag, every image is downloaded server-side, has its outer
border trimmed and upscaled back to remove any edge watermark, and is
re-hosted from our own storage.
"""
import os
import io
import uuid
import logging
import urllib.parse
from typing import Dict, Any
import aiohttp
from PIL import Image
from sqlalchemy.orm import Session

from app.models.generated_image import GeneratedImage

logger = logging.getLogger("ImageService")

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STORAGE_ROOT = os.path.join(BACKEND_DIR, "generated_images")

# Empirically, the watermark sits within the outer ~12% border of the
# image regardless of exact placement (corner varies). Trimming that
# border on all four sides and upscaling back to the original size
# removes it while keeping the image square and the subject centered.
WATERMARK_TRIM_FRACTION = 0.12


async def _fetch_raw_image(prompt: str) -> bytes:
    encoded = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024&model=flux&nologo=true"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=60)) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Image provider returned status {resp.status}")
            return await resp.read()


def _strip_watermark(raw: bytes) -> bytes:
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = img.size
    trim_x = int(w * WATERMARK_TRIM_FRACTION)
    trim_y = int(h * WATERMARK_TRIM_FRACTION)
    cropped = img.crop((trim_x, trim_y, w - trim_x, h - trim_y))
    resized = cropped.resize((w, h), Image.LANCZOS)
    out = io.BytesIO()
    resized.save(out, format="PNG")
    return out.getvalue()


async def generate_and_store_image(db: Session, user_id: int, prompt: str) -> Dict[str, Any]:
    """
    Generates an image, strips any provider watermark, saves it under
    this user's local storage directory, and records it in the DB.
    Returns {"image_id": ...} -- callers build the served URL from this,
    never from a provider URL.
    """
    raw = await _fetch_raw_image(prompt)
    processed = _strip_watermark(raw)

    image_id = uuid.uuid4().hex
    user_dir = os.path.join(STORAGE_ROOT, str(user_id))
    os.makedirs(user_dir, exist_ok=True)
    abs_path = os.path.join(user_dir, f"{image_id}.png")
    with open(abs_path, "wb") as f:
        f.write(processed)

    relative_path = os.path.join(str(user_id), f"{image_id}.png")
    record = GeneratedImage(id=image_id, user_id=user_id, file_path=relative_path, prompt=prompt)
    db.add(record)
    db.commit()

    return {"image_id": image_id}


def resolve_image_path(file_path: str) -> str:
    return os.path.join(STORAGE_ROOT, file_path)
