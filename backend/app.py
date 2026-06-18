import os
import json
import uuid
import base64
from pathlib import Path
from datetime import datetime
from typing import List, Optional

import httpx
from fastapi import FastAPI, File, UploadFile, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, Text,
    ForeignKey, Table,
)
from sqlalchemy.orm import declarative_base, Session, relationship
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL")
if not OLLAMA_URL:
    raise ValueError("OLLAMA_URL environment variable must be set (e.g. https://<POD_ID>-8888.proxy.runpod.net)")

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:26b")
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

DATABASE_URL = "sqlite:///./photos.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
Base = declarative_base()

photo_tags = Table(
    "photo_tags",
    Base.metadata,
    Column("photo_id", Integer, ForeignKey("photos.id"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)


class Photo(Base):
    __tablename__ = "photos"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, nullable=False)       # stored name on disk
    original_filename = Column(String, nullable=False)           # what the user uploaded
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")                   # pending | processing | done | error
    error_message = Column(Text, nullable=True)

    critique = relationship("Critique", back_populates="photo", uselist=False)
    tags = relationship("Tag", secondary=photo_tags, back_populates="photos")


class Critique(Base):
    __tablename__ = "critiques"
    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("photos.id"), nullable=False)
    composition = Column(Text, nullable=False)
    exposure = Column(Text, nullable=False)

    photo = relationship("Photo", back_populates="critique")


class Tag(Base):
    __tablename__ = "tags"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    photos = relationship("Photo", secondary=photo_tags, back_populates="tags")


Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------------------------
# Ollama vision call
# ---------------------------------------------------------------------------

CRITIQUE_PROMPT = """\
Analyze this photograph and respond with ONLY a valid JSON object — no markdown fences, \
no extra text before or after. Use exactly these keys:

{
  "composition": "<1-2 sentences on composition: rule of thirds, framing, leading lines, balance, etc.>",
  "exposure": "<1-2 sentences on exposure and lighting quality>",
  "tags": ["<tag1>", "<tag2>", "<tag3>"]
}

Tags must be 2–4 short lowercase words or hyphenated phrases describing the mood and/or subject, \
e.g. "portrait", "moody", "golden-hour", "street", "landscape", "high-key", "silhouette", "minimalist".\
"""


def analyze_photo(photo_id: int) -> None:
    """Background task: call Ollama, parse the response, persist critique + tags."""
    with Session(engine) as db:
        photo = db.get(Photo, photo_id)
        if not photo:
            return

        photo.status = "processing"
        db.commit()

        try:
            image_data = base64.b64encode(
                (UPLOAD_DIR / photo.filename).read_bytes()
            ).decode()

            with httpx.Client(timeout=180.0) as client:
                resp = client.post(
                    f"{OLLAMA_URL.rstrip('/')}/api/chat",
                    json={
                        "model": OLLAMA_MODEL,
                        "messages": [{
                            "role": "user",
                            "content": CRITIQUE_PROMPT,
                            "images": [image_data],
                        }],
                        "stream": False,
                        "think": False,
                    },
                )
                resp.raise_for_status()

            raw = resp.json()["message"]["content"].strip()

            # Strip markdown code fences the model sometimes adds
            if raw.startswith("```"):
                parts = raw.split("```")
                raw = parts[1] if len(parts) >= 2 else raw
                if raw.lower().startswith("json"):
                    raw = raw[4:].strip()

            data = json.loads(raw)

            composition = str(data.get("composition", "")).strip() or "No composition critique provided."
            exposure = str(data.get("exposure", "")).strip() or "No exposure assessment provided."
            raw_tags = data.get("tags", [])

            # Normalise tags — model occasionally returns a comma-separated string
            if isinstance(raw_tags, str):
                raw_tags = [t.strip() for t in raw_tags.split(",")]
            tag_names = [str(t).lower().strip() for t in raw_tags if str(t).strip()][:4]

            # Create-or-get tags
            tags = []
            for name in tag_names:
                tag = db.query(Tag).filter(Tag.name == name).first()
                if not tag:
                    tag = Tag(name=name)
                    db.add(tag)
                    db.flush()
                tags.append(tag)

            db.add(Critique(photo_id=photo.id, composition=composition, exposure=exposure))
            photo.tags = tags
            photo.status = "done"
            db.commit()

        except Exception as exc:
            db.rollback()
            photo.status = "error"
            photo.error_message = str(exc)
            db.commit()


# ---------------------------------------------------------------------------
# Serialisation helper
# ---------------------------------------------------------------------------

def photo_to_dict(photo: Photo) -> dict:
    return {
        "id": photo.id,
        "filename": photo.filename,
        "original_filename": photo.original_filename,
        "created_at": photo.created_at.isoformat(),
        "status": photo.status,
        "error_message": photo.error_message,
        "critique": {
            "composition": photo.critique.composition,
            "exposure": photo.critique.exposure,
        } if photo.critique else None,
        "tags": [tag.name for tag in photo.tags],
    }


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Photo Critique API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.post("/upload")
async def upload_photos(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
):
    """Save uploaded images, create DB records, kick off background analysis."""
    photo_ids: List[int] = []

    with Session(engine) as db:
        for file in files:
            ext = Path(file.filename or "image").suffix.lower() or ".jpg"
            unique_name = f"{uuid.uuid4()}{ext}"
            (UPLOAD_DIR / unique_name).write_bytes(await file.read())

            photo = Photo(filename=unique_name, original_filename=file.filename or unique_name)
            db.add(photo)
            db.flush()
            photo_ids.append(photo.id)

        db.commit()

    # Add tasks after commit so the photo rows are visible to the background thread
    for pid in photo_ids:
        background_tasks.add_task(analyze_photo, pid)

    return {"photo_ids": photo_ids}


@app.get("/photos")
def list_photos(tag: Optional[str] = None):
    """Return all photos, optionally filtered by a tag name."""
    with Session(engine) as db:
        query = db.query(Photo)
        if tag:
            query = query.join(Photo.tags).filter(Tag.name == tag)
        photos = query.order_by(Photo.created_at.desc()).all()
        return [photo_to_dict(p) for p in photos]


@app.get("/photos/{photo_id}")
def get_photo(photo_id: int):
    with Session(engine) as db:
        photo = db.get(Photo, photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        return photo_to_dict(photo)


@app.get("/tags")
def list_tags():
    """All tags with counts, ordered alphabetically."""
    with Session(engine) as db:
        tags = db.query(Tag).order_by(Tag.name).all()
        return [{"name": t.name, "count": len(t.photos)} for t in tags]
