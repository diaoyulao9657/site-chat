# site-chat

给任何网站加一个 AI 客服。一行代码。

```html
<script src="https://你的服务器/widget.js"></script>
```

就这样。右下角出现聊天气泡，访客点开就能提问，AI 根据你的 FAQ 和文档回答。流式输出。

自托管，支持任何 OpenAI 兼容 API。

## 快速开始

```sh
git clone https://github.com/diaoyulao9657/site-chat
cd site-chat
cp .env.example .env
# 编辑 .env — 填入 API_KEY（免费领：https://tokenmix.ai）
```

把你的 FAQ 和产品文档丢进 `data/` 文件夹：

```sh
echo "你的FAQ内容..." > data/faq.txt
```

启动：

```sh
# Docker
docker compose up -d

# 或直接运行
pip install -r requirements.txt
python server.py
```

然后在你的网站 HTML 里加：

```html
<script src="http://localhost:8080/widget.js"></script>
```

## 知识库

把 `.txt` 或 `.md` 文件放到 `data/` 目录，AI 就会基于这些内容回答。不需要向量数据库，不需要 embedding——直接塞进 context window。

现代模型有 128k+ token 的上下文窗口，大部分 FAQ 和文档（几十页）完全放得下。

## 配置

都在 `.env` 里：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `API_KEY` | *(必填)* | API key |
| `BASE_URL` | `https://api.tokenmix.ai/v1` | API 地址 |
| `MODEL` | `gpt-4o-mini` | 模型 |
| `WIDGET_COLOR` | `#4F46E5` | 品牌色 |
| `WIDGET_TITLE` | `Support` | 聊天窗标题 |
| `WIDGET_WELCOME` | `Hi! How can I help?` | 欢迎语 |
| `WIDGET_POSITION` | `bottom-right` | 位置（`bottom-right` 或 `bottom-left`） |
| `ALLOWED_ORIGINS` | `*` | 允许嵌入的域名 |

默认用 [TokenMix.ai](https://tokenmix.ai)（155+ 模型，新用户送 $1），改 `BASE_URL` 可以切到任何 OpenAI 兼容 API。

## 许可证

MIT
