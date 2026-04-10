(function () {
  var SCRIPT = document.currentScript;
  var SERVER = SCRIPT.src.replace(/\/widget\.js.*$/, "");

  fetch(SERVER + "/config")
    .then(function (r) { return r.json(); })
    .then(boot)
    .catch(function () { boot({}); });

  function boot(cfg) {
    var color = cfg.color || "#4F46E5";
    var title = cfg.title || "Support";
    var welcome = cfg.welcome || "Hi! How can I help?";
    var placeholder = cfg.placeholder || "Type a message...";
    var pos = (cfg.position || "bottom-right").includes("left") ? "left" : "right";

    // session
    var sid = sessionStorage.getItem("_sc_sid");
    if (!sid) {
      sid = "sc_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("_sc_sid", sid);
    }

    // host + shadow DOM (CSS isolation)
    var host = document.createElement("div");
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: "closed" });

    shadow.innerHTML = '<div class="sc-root">' +
      '<div class="sc-bubble" id="sc-bubble">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
        '</svg>' +
      '</div>' +
      '<div class="sc-panel" id="sc-panel">' +
        '<div class="sc-header">' +
          '<span class="sc-title">' + esc(title) + '</span>' +
          '<button class="sc-close" id="sc-close" aria-label="Close">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="sc-messages" id="sc-messages">' +
          '<div class="sc-msg sc-bot">' + esc(welcome) + '</div>' +
        '</div>' +
        '<div class="sc-footer">' +
          '<input class="sc-input" id="sc-input" placeholder="' + esc(placeholder) + '" autocomplete="off" />' +
          '<button class="sc-send" id="sc-send" aria-label="Send">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    // inject styles
    var style = document.createElement("style");
    style.textContent = buildCSS(color, pos);
    shadow.insertBefore(style, shadow.firstChild);

    // refs
    var bubble = shadow.getElementById("sc-bubble");
    var panel = shadow.getElementById("sc-panel");
    var input = shadow.getElementById("sc-input");
    var sendBtn = shadow.getElementById("sc-send");
    var closeBtn = shadow.getElementById("sc-close");
    var msgList = shadow.getElementById("sc-messages");
    var open = false;
    var busy = false;

    function toggle() {
      open = !open;
      panel.classList.toggle("sc-show", open);
      bubble.classList.toggle("sc-hide", open);
      if (open) input.focus();
    }

    bubble.onclick = toggle;
    closeBtn.onclick = toggle;

    sendBtn.onclick = send;
    input.onkeydown = function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    };

    function send() {
      var text = input.value.trim();
      if (!text || busy) return;
      input.value = "";
      addMsg(text, "user");

      var botEl = addMsg("", "bot");
      botEl.innerHTML = '<span class="sc-dots"><span>.</span><span>.</span><span>.</span></span>';
      busy = true;
      sendBtn.disabled = true;

      streamChat(text, botEl, function () {
        busy = false;
        sendBtn.disabled = false;
      });
    }

    function addMsg(text, type) {
      var div = document.createElement("div");
      div.className = "sc-msg sc-" + type;
      if (text) div.textContent = text;
      msgList.appendChild(div);
      msgList.scrollTop = msgList.scrollHeight;
      return div;
    }

    function streamChat(text, el, done) {
      fetch(SERVER + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sid }),
      })
        .then(function (resp) {
          if (!resp.ok) throw new Error("HTTP " + resp.status);
          var reader = resp.body.getReader();
          var decoder = new TextDecoder();
          var buf = "";
          var started = false;

          function read() {
            reader.read().then(function (result) {
              if (result.done) { done(); return; }
              buf += decoder.decode(result.value, { stream: true });

              var lines = buf.split("\n");
              buf = lines.pop();

              for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (line.indexOf("data: ") !== 0) continue;
                try {
                  var d = JSON.parse(line.slice(6));
                } catch (e) { continue; }

                if (d.t) {
                  if (!started) { el.textContent = ""; started = true; }
                  el.textContent += d.t;
                  msgList.scrollTop = msgList.scrollHeight;
                }
                if (d.error) {
                  el.textContent = d.error;
                  el.classList.add("sc-error");
                }
                if (d.done) { done(); return; }
              }
              read();
            }).catch(function () {
              el.textContent = "Connection lost. Please try again.";
              el.classList.add("sc-error");
              done();
            });
          }
          read();
        })
        .catch(function () {
          el.textContent = "Couldn't connect to support. Please try again.";
          el.classList.add("sc-error");
          done();
        });
    }

    function esc(s) {
      var d = document.createElement("div");
      d.textContent = s;
      return d.innerHTML;
    }
  }

  function buildCSS(color, pos) {
    var side = pos === "left" ? "left: 20px;" : "right: 20px;";
    return [
      "*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }",
      ".sc-root { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:14px; line-height:1.5; }",

      // bubble
      ".sc-bubble {",
      "  position:fixed; bottom:20px; " + side,
      "  width:56px; height:56px; border-radius:50%;",
      "  background:" + color + "; color:#fff;",
      "  display:flex; align-items:center; justify-content:center;",
      "  cursor:pointer; z-index:99999;",
      "  box-shadow:0 4px 14px rgba(0,0,0,0.16);",
      "  transition:transform .2s, opacity .2s;",
      "}",
      ".sc-bubble:hover { transform:scale(1.08); }",
      ".sc-bubble.sc-hide { transform:scale(0); opacity:0; pointer-events:none; }",

      // panel
      ".sc-panel {",
      "  position:fixed; bottom:88px; " + side,
      "  width:370px; max-height:560px; height:calc(100vh - 120px);",
      "  border-radius:14px; background:#fff;",
      "  box-shadow:0 10px 40px rgba(0,0,0,0.12);",
      "  display:flex; flex-direction:column;",
      "  z-index:99999; overflow:hidden;",
      "  transform:translateY(16px); opacity:0; pointer-events:none;",
      "  transition:transform .25s ease, opacity .25s ease;",
      "}",
      ".sc-panel.sc-show { transform:translateY(0); opacity:1; pointer-events:auto; }",

      // header
      ".sc-header {",
      "  background:" + color + "; color:#fff;",
      "  padding:14px 16px; display:flex;",
      "  justify-content:space-between; align-items:center;",
      "  flex-shrink:0;",
      "}",
      ".sc-title { font-weight:600; font-size:15px; }",
      ".sc-close { background:none; border:none; color:#fff; cursor:pointer; opacity:.8; padding:2px; display:flex; }",
      ".sc-close:hover { opacity:1; }",

      // messages
      ".sc-messages {",
      "  flex:1; overflow-y:auto; padding:16px;",
      "  display:flex; flex-direction:column; gap:10px;",
      "}",
      ".sc-msg {",
      "  max-width:82%; padding:10px 14px;",
      "  border-radius:14px; word-wrap:break-word;",
      "  white-space:pre-wrap;",
      "}",
      ".sc-user {",
      "  align-self:flex-end;",
      "  background:" + color + "; color:#fff;",
      "  border-bottom-right-radius:4px;",
      "}",
      ".sc-bot {",
      "  align-self:flex-start;",
      "  background:#f1f3f5; color:#1a1a1a;",
      "  border-bottom-left-radius:4px;",
      "}",
      ".sc-error { color:#c0392b; background:#fdf0ef; }",

      // typing dots
      ".sc-dots span {",
      "  animation:sc-blink 1.4s infinite both;",
      "  font-size:20px; line-height:1; letter-spacing:2px;",
      "}",
      ".sc-dots span:nth-child(2) { animation-delay:.2s; }",
      ".sc-dots span:nth-child(3) { animation-delay:.4s; }",
      "@keyframes sc-blink { 0%,80%,100%{opacity:.3} 40%{opacity:1} }",

      // footer
      ".sc-footer {",
      "  padding:12px; border-top:1px solid #eee;",
      "  display:flex; gap:8px; flex-shrink:0;",
      "}",
      ".sc-input {",
      "  flex:1; border:1px solid #ddd; border-radius:10px;",
      "  padding:10px 14px; font-size:14px; outline:none;",
      "  font-family:inherit; background:#fafafa;",
      "  transition:border-color .2s;",
      "}",
      ".sc-input:focus { border-color:" + color + "; background:#fff; }",
      ".sc-send {",
      "  background:" + color + "; color:#fff; border:none;",
      "  border-radius:10px; width:42px; cursor:pointer;",
      "  display:flex; align-items:center; justify-content:center;",
      "  transition:opacity .2s;",
      "}",
      ".sc-send:hover { opacity:.85; }",
      ".sc-send:disabled { opacity:.5; cursor:default; }",

      // mobile
      "@media(max-width:480px) {",
      "  .sc-panel { width:calc(100vw - 16px); " + (pos === "left" ? "left:8px;" : "right:8px;") + " bottom:80px; max-height:calc(100vh - 100px); border-radius:12px; }",
      "}",
    ].join("\n");
  }
})();
