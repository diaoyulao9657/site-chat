# site-chat

Add an AI support chat to any website. One script tag.

```html
<script src="https://your-server.com/widget.js"></script>
```

That's it. A chat bubble appears. Visitors ask questions, the AI answers
based on your FAQ and docs. Responses stream in real time.

Self-hosted, works with any OpenAI-compatible API, no vendor lock-in.

## Quick start

```sh
git clone https://github.com/diaoyulao9657/site-chat
cd site-chat
cp .env.example .env
# edit .env — set API_KEY (get one free at https://tokenmix.ai)
```

Drop your FAQ or product docs into the `data/` folder:

```sh
# replace the example with your own content
echo "Your FAQ content here..." > data/faq.txt
```

Start the server:

```sh
# with Docker
docker compose up -d

# or without Docker
pip install -r requirements.txt
python server.py
```

Then add this to your website:

```html
<script src="http://localhost:8080/widget.js"></script>
```

## How the knowledge base works

Put `.txt` or `.md` files in the `data/` folder. The AI reads them and
uses them to answer questions. No vector database, no embeddings, no
complex setup — it just works.

```
data/
├── faq.txt
├── pricing.md
├── shipping-policy.txt
└── product-info.md
```

Modern models have 128k+ token context windows. Your average FAQ and docs
(even 30+ pages) fit easily. If you outgrow this, adding RAG is a
natural next step — but most sites won't need it.

## Configuration

Everything is in `.env`:

| Variable | Default | What it does |
|----------|---------|-------------|
| `API_KEY` | *(required)* | LLM API key |
| `BASE_URL` | `https://api.tokenmix.ai/v1` | API endpoint |
| `MODEL` | `gpt-4o-mini` | Which model to use |
| `SYSTEM_PROMPT` | *(friendly support agent)* | How the AI should behave |
| `WIDGET_COLOR` | `#4F46E5` | Brand color (header, buttons, user messages) |
| `WIDGET_TITLE` | `Support` | Chat panel header |
| `WIDGET_WELCOME` | `Hi! How can I help?` | First message visitors see |
| `WIDGET_PLACEHOLDER` | `Type a message...` | Input field placeholder |
| `WIDGET_POSITION` | `bottom-right` | `bottom-right` or `bottom-left` |
| `PORT` | `8080` | Server port |
| `ALLOWED_ORIGINS` | `*` | Restrict which domains can embed (comma-separated) |

Uses [TokenMix.ai](https://tokenmix.ai) by default — 155+ models with one API key,
$1 free credit. Works with any OpenAI-compatible provider.

## Customization examples

**E-commerce store:**
```env
WIDGET_COLOR=#E74C3C
WIDGET_TITLE=Help
WIDGET_WELCOME=Hey! Need help finding something?
SYSTEM_PROMPT=You are a friendly shopping assistant for our online store. Help customers find products, answer questions about shipping and returns. Be concise.
```

**SaaS product:**
```env
WIDGET_COLOR=#2ECC71
WIDGET_TITLE=Docs assistant
WIDGET_WELCOME=Ask me anything about our API.
SYSTEM_PROMPT=You are a technical support agent. Answer questions about our product using the knowledge base. Include code examples when relevant.
```

## Architecture

```
Visitor's browser                    Your server
┌───────────────┐                   ┌──────────────┐
│               │  loads widget.js  │              │
│  Your website │ ←───────────────→ │  FastAPI      │
│               │  sends messages   │  + OpenAI SDK │
│  ┌──────────┐ │  via SSE stream   │              │
│  │ Chat     │ │ ←───────────────→ │  data/*.txt  │
│  │ Widget   │ │                   │  (knowledge) │
│  └──────────┘ │                   └──────┬───────┘
└───────────────┘                          │
                                           ▼
                                   OpenAI-compatible API
```

The widget is pure vanilla JavaScript (~5KB), uses Shadow DOM so it
won't conflict with your site's CSS. No dependencies, no build step.

The backend is one Python file. Conversations are stored in memory
(reset on server restart). For most support use cases this is fine.

## Deploying to production

For a real deployment, put the server behind a reverse proxy (nginx/Caddy)
with HTTPS. Set `ALLOWED_ORIGINS` to your domain:

```env
ALLOWED_ORIGINS=https://yoursite.com,https://www.yoursite.com
```

Then update the script tag:

```html
<script src="https://chat.yoursite.com/widget.js"></script>
```

## License

MIT
