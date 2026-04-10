#!/usr/bin/env python3
import os
import json
import uuid
import time
import logging
from pathlib import Path
from collections import defaultdict

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI

load_dotenv()

API_KEY = os.getenv("API_KEY", "")
BASE_URL = os.getenv("BASE_URL", "https://api.tokenmix.ai/v1")
MODEL = os.getenv("MODEL", "gpt-4o-mini")
SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", "You are a friendly support agent. Answer questions based on the knowledge base provided. If you don't know, say so honestly.")
MAX_HISTORY = int(os.getenv("MAX_HISTORY", "10"))
MAX_MSG_LEN = int(os.getenv("MAX_MSG_LEN", "2000"))
RATE_LIMIT = int(os.getenv("RATE_LIMIT", "20"))  # requests per minute per IP

WIDGET_COLOR = os.getenv("WIDGET_COLOR", "#4F46E5")
WIDGET_TITLE = os.getenv("WIDGET_TITLE", "Support")
WIDGET_WELCOME = os.getenv("WIDGET_WELCOME", "Hi! How can I help?")
WIDGET_PLACEHOLDER = os.getenv("WIDGET_PLACEHOLDER", "Type a message...")
WIDGET_POSITION = os.getenv("WIDGET_POSITION", "bottom-right")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")

log = logging.getLogger(__name__)

# --- knowledge base ---

def load_knowledge():
    kb = ""
    data_dir = Path("data")
    if not data_dir.exists():
        return kb
    for f in sorted(data_dir.iterdir()):
        if f.suffix in (".txt", ".md") and f.is_file():
            content = f.read_text(encoding="utf-8").strip()
            if content:
                kb += f"\n\n--- {f.stem} ---\n{content}"
    return kb.strip()

knowledge = load_knowledge()

def build_system_prompt():
    prompt = SYSTEM_PROMPT
    if knowledge:
        prompt += "\n\nKnowledge base:\n" + knowledge
    return prompt

system_prompt = build_system_prompt()

# --- app ---

app = FastAPI(docs_url=None, redoc_url=None)

origins = [o.strip() for o in ALLOWED_ORIGINS.split(",")] if ALLOWED_ORIGINS != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

client = AsyncOpenAI(api_key=API_KEY, base_url=BASE_URL)

# per-session conversation history
sessions = {}
session_ts = {}
SESSION_TTL = 3600

# rate limiter: ip -> list of timestamps
_hits = defaultdict(list)


def check_rate(ip):
    now = time.time()
    window = _hits[ip]
    # drop entries older than 60s
    _hits[ip] = [t for t in window if now - t < 60]
    if len(_hits[ip]) >= RATE_LIMIT:
        return False
    _hits[ip].append(now)
    return True


def cleanup_sessions():
    now = time.time()
    stale = [sid for sid, ts in session_ts.items() if now - ts > SESSION_TTL]
    for sid in stale:
        sessions.pop(sid, None)
        session_ts.pop(sid, None)
    # also clean rate limiter
    dead = [ip for ip, hits in _hits.items() if not hits or now - hits[-1] > 120]
    for ip in dead:
        del _hits[ip]


@app.get("/widget.js")
async def serve_widget():
    path = Path(__file__).parent / "static" / "widget.js"
    if not path.exists():
        return Response("// widget.js not found", status_code=404)
    return Response(
        content=path.read_text(encoding="utf-8"),
        media_type="application/javascript",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/config")
async def get_config():
    return {
        "color": WIDGET_COLOR,
        "title": WIDGET_TITLE,
        "welcome": WIDGET_WELCOME,
        "placeholder": WIDGET_PLACEHOLDER,
        "position": WIDGET_POSITION,
    }


@app.post("/chat")
async def chat(request: Request):
    ip = request.client.host if request.client else "unknown"
    if not check_rate(ip):
        return JSONResponse({"error": "Too many requests. Please slow down."}, status_code=429)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "invalid json"}, status_code=400)

    msg = (body.get("message") or "").strip()
    session_id = body.get("session_id") or str(uuid.uuid4())

    if not msg:
        return JSONResponse({"error": "empty message"}, status_code=400)

    if len(msg) > MAX_MSG_LEN:
        msg = msg[:MAX_MSG_LEN]

    # session management
    cleanup_sessions()
    if session_id not in sessions:
        sessions[session_id] = []
    hist = sessions[session_id]
    session_ts[session_id] = time.time()

    hist.append({"role": "user", "content": msg})
    while len(hist) > MAX_HISTORY * 2:
        hist.pop(0)

    messages = [{"role": "system", "content": system_prompt}] + hist

    async def stream():
        full = ""
        try:
            resp = await client.chat.completions.create(
                model=MODEL, messages=messages, stream=True,
            )
            async for chunk in resp:
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    full += token
                    yield f"data: {json.dumps({'t': token})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            err = str(e)
            if "401" in err or "403" in err:
                yield f"data: {json.dumps({'error': 'API authentication failed. Check server configuration.'})}\n\n"
            elif "429" in err:
                yield f"data: {json.dumps({'error': 'Rate limited. Please try again in a moment.'})}\n\n"
            else:
                log.error("chat error: %s", err[:200])
                yield f"data: {json.dumps({'error': 'Something went wrong. Please try again.'})}\n\n"

        if full:
            hist.append({"role": "assistant", "content": full})

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.get("/demo")
async def demo():
    path = Path(__file__).parent / "demo.html"
    if not path.exists():
        return Response("demo.html not found", status_code=404)
    return Response(content=path.read_text(encoding="utf-8"), media_type="text/html")


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL, "knowledge_loaded": bool(knowledge)}


if __name__ == "__main__":
    if not API_KEY:
        print("Error: API key not configured.")
        print("")
        print("To get started:")
        print("  1. Get a free API key at https://tokenmix.ai ($1 free credit)")
        print("     Or use any OpenAI-compatible API provider")
        print("  2. Set API_KEY in .env")
        exit(1)

    logging.basicConfig(format="%(asctime)s [%(name)s] %(message)s", level=logging.INFO)

    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    if len(knowledge) > 100000:
        log.warning("knowledge base is %d chars — consider trimming for faster/cheaper responses", len(knowledge))
    log.info("starting on port %d — model=%s, knowledge=%d chars", port, MODEL, len(knowledge))
    uvicorn.run(app, host="0.0.0.0", port=port)
