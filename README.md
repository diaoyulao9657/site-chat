# site-chat

Add an AI support chat to any website. One script tag.

```html
<script src="https://your-server.com/widget.js"></script>
```

A chat bubble appears in the corner. Visitors click it, ask questions, and
the AI answers based on your docs. Responses stream in real time.

Self-hosted. Works with any OpenAI-compatible API. No vendor lock-in.

## Quick start

```sh
git clone https://github.com/diaoyulao9657/site-chat
cd site-chat
cp .env.example .env
# edit .env — set your API_KEY
```

Add your FAQ or product docs to the `data/` folder:

```sh
echo "Your FAQ here..." > data/faq.txt
```

Start:

```sh
# with Docker (recommended)
docker compose up -d

# or directly
pip install -r requirements.txt
python server.py
```

Embed on your website:

```html
<script src="http://localhost:8080/widget.js"></script>
```

Visit `http://localhost:8080/demo` to see it in action.

## Features

- **One-line embed** — single `<script>` tag, no npm, no build step, no dependencies
- **Streaming** — responses appear word by word
- **Knowledge base** — drop `.txt` / `.md` files in `data/`, the AI uses them to answer
- **Quick replies** — configurable suggestion buttons to guide first-time visitors
- **Markdown** — code blocks (with copy button), bold, lists, links render properly
- **Chat history** — persists across page refreshes (localStorage)
- **Typing indicator** — header shows "Typing..." while the AI responds
- **Online status** — green/red dot shows whether the server is reachable
- **New conversation** — one-click reset without page reload
- **Notification dot** — red badge on the bubble when there's an unread response
- **Rate limiting** — per-IP throttle to prevent abuse
- **Shadow DOM** — widget CSS won't conflict with your site
- **Mobile friendly** — responsive layout on small screens
- **Hot reload** — update knowledge base files without restarting (`POST /reload`)

## Knowledge base

Put `.txt` or `.md` files in `data/`. The AI reads everything in there and
uses it to answer questions. No vector database, no embeddings — it all fits
in the model's context window (128k+ tokens on modern models).

```
data/
├── faq.txt
├── pricing.md
└── product-info.txt
```

Update the files anytime and hit `POST /reload` to refresh without restart.

## Configuration

Everything in `.env`:

| Variable | Default | What it does |
|----------|---------|-------------|
| `API_KEY` | *(required)* | LLM API key |
| `BASE_URL` | `https://api.tokenmix.ai/v1` | API endpoint |
| `MODEL` | `gpt-4o-mini` | Which model to use |
| `SYSTEM_PROMPT` | *(friendly support agent)* | AI behavior instructions |
| `WIDGET_COLOR` | `#4F46E5` | Brand color |
| `WIDGET_TITLE` | `Support` | Header title |
| `WIDGET_WELCOME` | `Hi! How can I help?` | First message |
| `WIDGET_PLACEHOLDER` | `Type a message...` | Input placeholder |
| `WIDGET_POSITION` | `bottom-right` | `bottom-right` or `bottom-left` |
| `WIDGET_SUGGESTIONS` | *(none)* | Quick reply buttons, comma-separated |
| `PORT` | `8080` | Server port |
| `ALLOWED_ORIGINS` | `*` | Which domains can embed |
| `RATE_LIMIT` | `20` | Max requests per minute per IP |

Uses [TokenMix.ai](https://tokenmix.ai) by default — 155+ models with one API key,
$1 free credit. Works with any OpenAI-compatible provider.

### Override via script tag

You can override settings directly in the HTML without changing the server:

```html
<script src="https://chat.yoursite.com/widget.js"
  data-color="#E74C3C"
  data-title="Help"
  data-suggestions="Pricing,Getting started,Contact us">
</script>
```

## Customization examples

**E-commerce store:**
```env
WIDGET_COLOR=#E74C3C
WIDGET_TITLE=Help
WIDGET_WELCOME=Hey! Need help finding something?
WIDGET_SUGGESTIONS=Shipping,Returns,Track order
SYSTEM_PROMPT=You are a friendly shopping assistant. Be concise.
```

**SaaS docs:**
```env
WIDGET_COLOR=#2ECC71
WIDGET_TITLE=Docs
WIDGET_WELCOME=Ask me anything about the API.
WIDGET_SUGGESTIONS=Quick start,Authentication,Pricing
SYSTEM_PROMPT=You are a technical support agent. Include code examples when relevant.
```

## API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/widget.js` | GET | The embeddable chat widget |
| `/config` | GET | Widget configuration |
| `/chat` | POST | Send a message, get streaming SSE response |
| `/reload` | POST | Reload knowledge base from `data/` |
| `/demo` | GET | Demo page |
| `/health` | GET | Server health check |

## Deploying to production

Put the server behind nginx or Caddy with HTTPS. An example nginx config
is included (`nginx.example.conf`).

```env
ALLOWED_ORIGINS=https://yoursite.com,https://www.yoursite.com
```

```html
<script src="https://chat.yoursite.com/widget.js"></script>
```

## License

MIT
