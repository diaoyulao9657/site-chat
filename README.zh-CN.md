# site-chat

给任何网站加一个 AI 客服。一行代码。

```html
<script src="https://你的服务器/widget.js"></script>
```

右下角出现聊天气泡，访客点开提问，AI 根据你的文档回答。流式输出。

自托管，支持任何 OpenAI 兼容 API。

## 快速开始

```sh
git clone https://github.com/diaoyulao9657/site-chat
cd site-chat
cp .env.example .env
# 编辑 .env — 填入 API_KEY
```

把你的 FAQ 放进 `data/` 文件夹：

```sh
echo "你的FAQ内容..." > data/faq.txt
```

启动：

```sh
# Docker（推荐）
docker compose up -d

# 或直接运行
pip install -r requirements.txt
python server.py
```

在你的网站加一行：

```html
<script src="http://localhost:8080/widget.js"></script>
```

访问 `http://localhost:8080/demo` 看演示效果。

## 功能

- **一行嵌入** — 一个 `<script>` 标签，无依赖
- **流式回复** — 逐字显示
- **知识库** — 把 `.txt` / `.md` 丢进 `data/`，AI 基于内容回答
- **快捷回复** — 可配置的建议按钮，降低首次交互门槛
- **Markdown** — 代码块（带复制按钮）、加粗、列表、链接
- **对话持久化** — 刷新页面不丢对话
- **Bot 头像** — 区分人和 AI 的消息
- **消息时间戳** — 每条消息显示发送时间
- **多行输入** — 支持粘贴长文本
- **输入中提示** — AI 回复时 header 显示 "Typing..."
- **在线状态** — 绿点/红点指示服务器连通性
- **未读通知** — 关闭面板时收到回复，气泡显示红点
- **速率限制** — 防止滥用
- **热更新** — `POST /reload` 刷新知识库，不用重启
- **Shadow DOM** — CSS 不和你的网站冲突
- **移动端适配** — 小屏幕自动全宽

## 配置

都在 `.env` 里：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `API_KEY` | *(必填)* | API key |
| `BASE_URL` | `https://api.tokenmix.ai/v1` | API 地址 |
| `MODEL` | `gpt-4o-mini` | 模型 |
| `WIDGET_COLOR` | `#4F46E5` | 品牌色 |
| `WIDGET_TITLE` | `Support` | 标题 |
| `WIDGET_WELCOME` | `Hi! How can I help?` | 欢迎语 |
| `WIDGET_SUGGESTIONS` | *(无)* | 快捷按钮，逗号分隔 |
| `WIDGET_POSITION` | `bottom-right` | 位置 |
| `ALLOWED_ORIGINS` | `*` | 允许嵌入的域名 |
| `RATE_LIMIT` | `20` | 每分钟每 IP 请求上限 |

默认用 [TokenMix.ai](https://tokenmix.ai)（155+ 模型，新用户送 $1）。改 `BASE_URL` 可以切任何 OpenAI 兼容 API。

### Script 标签覆盖配置

```html
<script src="https://chat.yoursite.com/widget.js"
  data-color="#E74C3C"
  data-title="帮助"
  data-suggestions="价格,如何开始,联系我们">
</script>
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/widget.js` | GET | 聊天组件 |
| `/config` | GET | 组件配置 |
| `/chat` | POST | 发消息，SSE 流式回复 |
| `/reload` | POST | 热更新知识库 |
| `/demo` | GET | 演示页 |
| `/health` | GET | 健康检查 |

## 许可证

MIT
