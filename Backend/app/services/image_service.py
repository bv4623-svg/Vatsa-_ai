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
from __future__ import annotations

import os
import io
import uuid
import logging
import urllib.parse
from typing import Dict, Any, Optional
import aiohttp
from sqlalchemy.orm import Session

from app.models.generated_image import GeneratedImage
from app.services.library import register_item
from app.services.storage import get_storage_backend

logger = logging.getLogger("ImageService")

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STORAGE_ROOT = os.path.join(os.getenv("DATA_DIR") or BACKEND_DIR, "generated_images")
_storage = get_storage_backend(STORAGE_ROOT)

# Empirically, the watermark sits within the outer ~12% border of the
# image regardless of exact placement (corner varies). Trimming that
# border on all four sides and upscaling back to the original size
# removes it while keeping the image square and the subject centered.
WATERMARK_TRIM_FRACTION = 0.12

BRAND_TEXT = "Vatsa AI"
BRAND_FONT_CANDIDATES = [
    # Windows
    r"C:\Windows\Fonts\arialbd.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
    # Linux (common distro paths)
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    # macOS
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
]


async def _fetch_raw_image(prompt: str) -> bytes:
    encoded = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024&model=flux&nologo=true"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=60)) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Image provider returned status {resp.status}")
            return await resp.read()


def _load_brand_font(size: int) -> ImageFont.FreeTypeFont:
    from PIL import ImageFont
    for path in BRAND_FONT_CANDIDATES:
        if os.path.isfile(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _add_branding(img: Image.Image) -> Image.Image:
    """
    Small semi-transparent "Vatsa AI" mark, bottom-right corner, sized
    relative to the image so it looks right at any resolution. White
    fill + black stroke so it stays legible over any background.
    """
    from PIL import Image, ImageDraw

    w, h = img.size
    font_size = max(14, int(h * 0.035))
    font = _load_brand_font(font_size)
    margin = int(min(w, h) * 0.02)

    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    bbox = draw.textbbox((0, 0), BRAND_TEXT, font=font, stroke_width=max(1, font_size // 12))
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = w - margin - text_w
    y = h - margin - text_h

    draw.text(
        (x, y), BRAND_TEXT, font=font,
        fill=(255, 255, 255, 170),
        stroke_width=max(1, font_size // 12),
        stroke_fill=(0, 0, 0, 140),
    )
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def _process_image(raw: bytes) -> bytes:
    from PIL import Image
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = img.size
    trim_x = int(w * WATERMARK_TRIM_FRACTION)
    trim_y = int(h * WATERMARK_TRIM_FRACTION)
    cropped = img.crop((trim_x, trim_y, w - trim_x, h - trim_y))
    resized = cropped.resize((w, h), Image.LANCZOS)
    branded = _add_branding(resized)
    out = io.BytesIO()
    branded.save(out, format="PNG")
    return out.getvalue()


async def generate_and_store_image(db: Session, user_id: int, prompt: str) -> Dict[str, Any]:
    """
    Generates an image, strips any provider watermark, saves it under
    this user's local storage directory, and records it in the DB.
    Returns {"image_id": ...} -- callers build the served URL from this,
    never from a provider URL.
    """
    raw = await _fetch_raw_image(prompt)
    processed = _process_image(raw)

    image_id = uuid.uuid4().hex
    relative_path = os.path.join(str(user_id), f"{image_id}.png")
    _storage.put(relative_path, processed)
    record = GeneratedImage(id=image_id, user_id=user_id, file_path=relative_path, prompt=prompt)
    db.add(record)
    db.commit()

    register_item(
        db, user_id, "generated",
        name=(prompt or "Generated image")[:120],
        size_bytes=len(processed),
        mime="image/png",
        source_table="generated_images",
        source_id=image_id,
        storage_path=relative_path,
    )

    return {"image_id": image_id}


def resolve_image_path(file_path: str) -> str:
    # Identical to the pre-abstraction `os.path.join(STORAGE_ROOT, file_path)`
    # when STORAGE_BACKEND=local (the default). With STORAGE_BACKEND=s3 this
    # returns an object URL instead of a local path -- app/routers/files.py's
    # FileResponse(...) still expects a local path either way, so S3-mode
    # read-serving through that route is not wired up yet; only the write
    # side (generate_and_store_image below) is migrated to the abstraction.
    return _storage.url(file_path)
