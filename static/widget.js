(function () {
  var SCRIPT = document.currentScript;
  var SERVER = SCRIPT.src.replace(/\/widget\.js.*$/, "");

  var overrides = {};
  if (SCRIPT.dataset) {
    ["color","title","welcome","position","placeholder","theme"].forEach(function(k) {
      if (SCRIPT.dataset[k]) overrides[k] = SCRIPT.dataset[k];
    });
    if (SCRIPT.dataset.suggestions) overrides.suggestions = SCRIPT.dataset.suggestions.split(",").map(function(s){return s.trim();});
  }

  fetch(SERVER + "/config")
    .then(function (r) { return r.json(); })
    .then(function (cfg) { for (var k in overrides) cfg[k] = overrides[k]; boot(cfg); })
    .catch(function () { boot(overrides); });

  function boot(cfg) {
    var color = cfg.color || "#4F46E5";
    var title = cfg.title || "Support";
    var welcome = cfg.welcome || "Hi! How can I help?";
    var placeholder = cfg.placeholder || "Type a message...";
    var pos = (cfg.position || "bottom-right").includes("left") ? "left" : "right";
    var suggestions = cfg.suggestions || [];
    var themeMode = cfg.theme || "auto";
    var poweredBy = cfg.poweredBy || {};

    var dark = themeMode === "dark" || (themeMode === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme:dark)").matches);

    var sid = localStorage.getItem("_sc_sid");
    if (!sid) { sid = "sc_" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("_sc_sid", sid); }

    var host = document.createElement("div");
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: "closed" });

    var sugHTML = "";
    if (suggestions.length) {
      sugHTML = '<div class="sc-suggestions" id="sc-suggestions">';
      for (var i = 0; i < suggestions.length; i++) sugHTML += '<button class="sc-sug">' + esc(suggestions[i]) + '</button>';
      sugHTML += '</div>';
    }

    var poweredHTML = "";
    if (poweredBy.text) {
      poweredHTML = '<div class="sc-powered">Powered by <a href="' + esc(poweredBy.url || "#") + '" target="_blank" rel="noopener">' + esc(poweredBy.text) + '</a></div>';
    }

    var avatarSVG = '<svg class="sc-avatar" width="28" height="28" viewBox="0 0 24 24" fill="' + color + '"><circle cx="12" cy="12" r="11" fill="' + color + '" opacity=".12"/><circle cx="9" cy="10" r="1.5" fill="' + color + '"/><circle cx="15" cy="10" r="1.5" fill="' + color + '"/><path d="M8.5 14.5c0 0 1.5 2 3.5 2s3.5-2 3.5-2" fill="none" stroke="' + color + '" stroke-width="1.2" stroke-linecap="round"/></svg>';

    shadow.innerHTML = '<div class="sc-root' + (dark ? " sc-dark" : "") + '">' +
      '<div class="sc-bubble" id="sc-bubble"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="sc-dot" id="sc-dot"></span></div>' +
      '<div class="sc-panel" id="sc-panel">' +
        '<div class="sc-header"><div class="sc-header-left"><span class="sc-status" id="sc-status"></span><span class="sc-title" id="sc-title-el">' + esc(title) + '</span></div><div class="sc-header-btns"><button class="sc-hbtn" id="sc-new" title="New conversation"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button><button class="sc-hbtn" id="sc-close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div></div>' +
        '<div class="sc-messages" id="sc-messages"></div>' +
        sugHTML +
        '<div class="sc-footer">' +
          '<textarea class="sc-input" id="sc-input" placeholder="' + esc(placeholder) + '" rows="1" autocomplete="off"></textarea>' +
          '<button class="sc-send" id="sc-send"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>' +
        '</div>' +
        poweredHTML +
      '</div>' +
    '</div>';

    var style = document.createElement("style");
    style.textContent = buildCSS(color, pos);
    shadow.insertBefore(style, shadow.firstChild);

    var bubble = shadow.getElementById("sc-bubble"), dot = shadow.getElementById("sc-dot");
    var panel = shadow.getElementById("sc-panel"), input = shadow.getElementById("sc-input");
    var sendBtn = shadow.getElementById("sc-send"), closeBtn = shadow.getElementById("sc-close");
    var newBtn = shadow.getElementById("sc-new"), msgList = shadow.getElementById("sc-messages");
    var sugBox = shadow.getElementById("sc-suggestions");
    var titleEl = shadow.getElementById("sc-title-el"), statusEl = shadow.getElementById("sc-status");
    var isOpen = false, busy = false;

    input.addEventListener("input", function () { this.style.height = "auto"; this.style.height = Math.min(this.scrollHeight, 100) + "px"; });

    // listen for system dark mode changes
    if (themeMode === "auto" && window.matchMedia) {
      window.matchMedia("(prefers-color-scheme:dark)").addEventListener("change", function (e) {
        shadow.querySelector(".sc-root").classList.toggle("sc-dark", e.matches);
      });
    }

    var saved = loadHistory();
    if (saved.length) {
      saved.forEach(function(m) { appendMsgEl(m.text, m.type, m.html, m.time, m.voted); });
      if (sugBox && saved.some(function(m) { return m.type === "user"; })) sugBox.style.display = "none";
    } else {
      appendMsgEl(welcome, "bot", false, null, false);
    }

    setOnline(true);
    setInterval(function () { fetch(SERVER + "/health").then(function(){setOnline(true)}).catch(function(){setOnline(false)}); }, 30000);

    function setOnline(on) { statusEl.className = "sc-status " + (on ? "sc-online" : "sc-offline"); }
    function setTyping(on) { titleEl.textContent = on ? "Typing..." : title; titleEl.classList.toggle("sc-typing", on); }
    function openPanel() { isOpen = true; dot.classList.remove("sc-show"); panel.classList.add("sc-show"); bubble.classList.add("sc-hide"); input.focus(); scrollDown(); }
    function closePanel() { isOpen = false; panel.classList.remove("sc-show"); bubble.classList.remove("sc-hide"); }
    function markUnread() { if (!isOpen) dot.classList.add("sc-show"); }
    function nearBottom() { return msgList.scrollHeight - msgList.scrollTop - msgList.clientHeight < 60; }
    function scrollDown() { msgList.scrollTop = msgList.scrollHeight; }
    function timeStr() { var d = new Date(); return d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2); }

    bubble.onclick = openPanel; closeBtn.onclick = closePanel;
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen) closePanel(); });

    newBtn.onclick = function () {
      sid = "sc_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("_sc_sid", sid); localStorage.removeItem("_sc_hist");
      msgList.innerHTML = ""; appendMsgEl(welcome, "bot", false, null, false);
      if (sugBox) sugBox.style.display = "";
    };

    if (sugBox) sugBox.onclick = function (e) {
      var btn = e.target; while (btn && !btn.classList.contains("sc-sug")) btn = btn.parentElement;
      if (!btn || busy) return; input.value = btn.textContent; send();
    };

    sendBtn.onclick = send;
    input.onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

    // delegated clicks: copy + feedback
    shadow.addEventListener("click", function (e) {
      var copy = e.target.closest ? e.target.closest(".sc-copy") : null;
      if (copy) {
        var code = copy.parentElement.querySelector("code");
        if (code) navigator.clipboard.writeText(code.textContent).then(function () { copy.textContent = "Copied!"; setTimeout(function () { copy.textContent = "Copy"; }, 1500); });
        return;
      }
      var fb = e.target.closest ? e.target.closest(".sc-fb") : null;
      if (fb) {
        var vote = fb.dataset.vote;
        var row = fb.closest(".sc-row");
        var msgText = row ? row.querySelector(".sc-content").textContent : "";
        // mark voted
        var btns = fb.parentElement.querySelectorAll(".sc-fb");
        btns.forEach(function(b) { b.classList.remove("sc-fb-active"); b.disabled = true; });
        fb.classList.add("sc-fb-active");
        // update history
        updateVote(msgText, vote);
        // send to server
        fetch(SERVER + "/feedback", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({vote: vote, message: msgText.slice(0, 500), session_id: sid}) }).catch(function(){});
      }
    });

    function send() {
      var text = input.value.trim();
      if (!text || busy) return;
      input.value = ""; input.style.height = "auto";
      var ts = timeStr();
      appendMsgEl(text, "user", false, ts, false); saveMsg(text, "user", false, ts, false);
      if (sugBox) sugBox.style.display = "none";

      var botWrap = appendMsgEl("", "bot", false, null, false);
      botWrap.querySelector(".sc-content").innerHTML = '<span class="sc-dots"><span>.</span><span>.</span><span>.</span></span>';
      busy = true; sendBtn.disabled = true; input.disabled = true; setTyping(true);

      streamChat(text, botWrap, function (reply) {
        busy = false; sendBtn.disabled = false; input.disabled = false; setTyping(false); input.focus();
        if (reply) {
          var t = timeStr();
          botWrap.querySelector(".sc-time").textContent = t;
          // show feedback buttons
          var fbEl = botWrap.querySelector(".sc-feedback");
          if (fbEl) fbEl.style.display = "";
          saveMsg(reply, "bot", true, t, false);
        }
      });
    }

    function appendMsgEl(text, type, isHtml, ts, voted) {
      var wrap = document.createElement("div");
      wrap.className = "sc-row sc-row-" + type + " sc-fadein";
      var timeHTML = ts ? '<span class="sc-time">' + esc(ts) + '</span>' : '<span class="sc-time"></span>';
      var feedbackHTML = type === "bot" ? '<div class="sc-feedback" style="display:none"><button class="sc-fb" data-vote="up" title="Helpful">&#128077;</button><button class="sc-fb" data-vote="down" title="Not helpful">&#128078;</button></div>' : '';

      wrap.innerHTML = (type === "bot" ? avatarSVG : "") +
        '<div class="sc-msg sc-' + type + '"><div class="sc-content"></div>' + timeHTML + feedbackHTML + '</div>';

      var content = wrap.querySelector(".sc-content");
      if (text) { if (isHtml) content.innerHTML = renderMd(text); else content.textContent = text; }

      // show feedback if it's a restored message with content
      if (type === "bot" && text && isHtml) {
        var fb = wrap.querySelector(".sc-feedback");
        if (fb) { fb.style.display = ""; if (voted) { fb.querySelectorAll(".sc-fb").forEach(function(b){b.disabled=true;}); } }
      }

      msgList.appendChild(wrap);
      scrollDown();
      return wrap;
    }

    function saveMsg(text, type, isHtml, ts, voted) {
      var hist = loadHistory();
      hist.push({ text: text, type: type, html: isHtml, time: ts || "", voted: !!voted });
      if (hist.length > 50) hist = hist.slice(-50);
      try { localStorage.setItem("_sc_hist", JSON.stringify(hist)); } catch (e) {}
    }
    function updateVote(msgText, vote) {
      var hist = loadHistory();
      for (var i = hist.length - 1; i >= 0; i--) {
        if (hist[i].type === "bot" && hist[i].text && hist[i].text.slice(0, 50) === msgText.slice(0, 50)) {
          hist[i].voted = true; break;
        }
      }
      try { localStorage.setItem("_sc_hist", JSON.stringify(hist)); } catch (e) {}
    }
    function loadHistory() {
      try { var r = localStorage.getItem("_sc_hist"); return r ? JSON.parse(r) : []; } catch (e) { return []; }
    }

    function streamChat(text, wrap, done) {
      var el = wrap.querySelector(".sc-content");
      fetch(SERVER + "/chat", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({message: text, session_id: sid}) })
      .then(function (resp) {
        if (resp.status === 429) { el.textContent = "Too many messages. Please wait."; el.closest(".sc-msg").classList.add("sc-error"); done(null); return; }
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        var reader = resp.body.getReader(), decoder = new TextDecoder();
        var buf = "", full = "", started = false, shouldScroll = true, rt = null;
        function render() { el.innerHTML = renderMd(full); if (shouldScroll) scrollDown(); markUnread(); }
        function sched() { if (!rt) rt = setTimeout(function(){rt=null;render();}, 80); }
        (function read() {
          reader.read().then(function (res) {
            if (res.done) { if (rt){clearTimeout(rt);rt=null;} if (full) render(); done(full); return; }
            buf += decoder.decode(res.value, {stream:true});
            var lines = buf.split("\n"); buf = lines.pop();
            for (var i = 0; i < lines.length; i++) {
              if (lines[i].indexOf("data: ")!==0) continue;
              try { var d = JSON.parse(lines[i].slice(6)); } catch(e){continue;}
              if (d.t){if(!started){el.textContent="";started=true;} full+=d.t; shouldScroll=nearBottom(); sched();}
              if (d.error){if(rt)clearTimeout(rt); el.textContent=d.error; el.closest(".sc-msg").classList.add("sc-error"); done(null); return;}
              if (d.done){if(rt)clearTimeout(rt); if(full)render(); done(full); return;}
            }
            read();
          }).catch(function(){if(rt)clearTimeout(rt); el.textContent="Connection lost."; el.closest(".sc-msg").classList.add("sc-error"); setOnline(false); done(null);});
        })();
      }).catch(function(){el.textContent="Couldn't connect."; el.closest(".sc-msg").classList.add("sc-error"); setOnline(false); done(null);});
    }

    function renderMd(text) {
      var s = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_,l,c){ return '<pre class="sc-pre"><button class="sc-copy">Copy</button><code>'+c.replace(/\n$/,'')+'</code></pre>'; });
      s = s.replace(/`([^`\n]+)`/g, '<code class="sc-ic">$1</code>');
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(?:^|\n)([*\-] .+(?:\n[*\-] .+)*)/g, function(_,b){ return "<ul>"+b.split("\n").map(function(l){return "<li>"+l.replace(/^[*\-] /,"")+"</li>";}).join("")+"</ul>"; });
      s = s.replace(/(?:^|\n)(\d+\. .+(?:\n\d+\. .+)*)/g, function(_,b){ return "<ol>"+b.split("\n").map(function(l){return "<li>"+l.replace(/^\d+\. /,"")+"</li>";}).join("")+"</ol>"; });
      s = s.replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      var p = s.split(/(<pre[\s\S]*?<\/pre>|<ul>[\s\S]*?<\/ul>|<ol>[\s\S]*?<\/ol>)/);
      for (var i=0;i<p.length;i++){if(!/^<(pre|ul|ol)/.test(p[i]))p[i]=p[i].replace(/\n/g,'<br>');}
      return p.join('');
    }
  }

  function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}

  function buildCSS(c, pos) {
    var s = pos==="left"?"left:20px;":"right:20px;";
    // light & dark theme variables
    var light = "--sc-bg:#fff;--sc-bg2:#f1f3f5;--sc-fg:#1a1a1a;--sc-border:#eee;--sc-input-bg:#fafafa;--sc-input-border:#ddd;--sc-ic-bg:rgba(0,0,0,.06);--sc-sug-bg:#fff;--sc-sug-fg:#555;--sc-sug-border:#ddd;";
    var dark = "--sc-bg:#1a1a2e;--sc-bg2:#2a2a3e;--sc-fg:#e0e0e0;--sc-border:#333;--sc-input-bg:#2a2a3e;--sc-input-border:#444;--sc-ic-bg:rgba(255,255,255,.1);--sc-sug-bg:#2a2a3e;--sc-sug-fg:#aaa;--sc-sug-border:#444;";

    return "*, *::before, *::after{margin:0;padding:0;box-sizing:border-box;}" +
    ".sc-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.5;" + light + "}" +
    ".sc-dark{" + dark + "}" +

    ".sc-bubble{position:fixed;bottom:20px;" + s + "width:56px;height:56px;border-radius:50%;background:" + c + ";color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,.16);transition:transform .2s,opacity .2s;}" +
    ".sc-bubble:hover{transform:scale(1.08);}" +
    ".sc-bubble.sc-hide{transform:scale(0);opacity:0;pointer-events:none;}" +
    ".sc-dot{position:absolute;top:0;right:0;width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;display:none;}" +
    ".sc-dot.sc-show{display:block;animation:sc-pop .3s ease;}" +
    "@keyframes sc-pop{0%{transform:scale(0)}60%{transform:scale(1.2)}100%{transform:scale(1)}}" +

    ".sc-panel{position:fixed;bottom:88px;" + s + "width:380px;max-height:580px;height:calc(100vh - 120px);border-radius:14px;background:var(--sc-bg);box-shadow:0 10px 40px rgba(0,0,0,.15);display:flex;flex-direction:column;z-index:99999;overflow:hidden;transform:translateY(16px) scale(.95);opacity:0;pointer-events:none;transition:transform .25s ease,opacity .2s ease;}" +
    ".sc-panel.sc-show{transform:translateY(0) scale(1);opacity:1;pointer-events:auto;}" +

    ".sc-header{background:" + c + ";color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}" +
    ".sc-header-left{display:flex;align-items:center;gap:8px;}" +
    ".sc-status{width:8px;height:8px;border-radius:50%;flex-shrink:0;}" +
    ".sc-online{background:#4ade80;box-shadow:0 0 0 2px rgba(74,222,128,.3);}" +
    ".sc-offline{background:#f87171;}" +
    ".sc-title{font-weight:600;font-size:15px;}" +
    ".sc-typing{animation:sc-pulse 1.2s ease infinite;}" +
    "@keyframes sc-pulse{0%,100%{opacity:1}50%{opacity:.5}}" +
    ".sc-header-btns{display:flex;gap:4px;align-items:center;}" +
    ".sc-hbtn{background:none;border:none;color:#fff;cursor:pointer;opacity:.7;padding:4px;display:flex;border-radius:4px;}" +
    ".sc-hbtn:hover{opacity:1;background:rgba(255,255,255,.15);}" +

    ".sc-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;}" +
    ".sc-row{display:flex;gap:8px;max-width:90%;}" +
    ".sc-row-user{align-self:flex-end;flex-direction:row-reverse;}" +
    ".sc-row-bot{align-self:flex-start;align-items:flex-start;}" +
    ".sc-avatar{flex-shrink:0;margin-top:2px;}" +
    ".sc-fadein{animation:sc-slidein .25s ease;}" +
    "@keyframes sc-slidein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}" +

    ".sc-msg{padding:10px 14px;border-radius:14px;word-wrap:break-word;min-width:0;}" +
    ".sc-user{background:" + c + ";color:#fff;border-bottom-right-radius:4px;white-space:pre-wrap;}" +
    ".sc-bot{background:var(--sc-bg2);color:var(--sc-fg);border-bottom-left-radius:4px;}" +
    ".sc-time{display:block;font-size:11px;opacity:.4;margin-top:4px;}" +
    ".sc-row-user .sc-time{text-align:right;}" +

    // feedback
    ".sc-feedback{display:flex;gap:4px;margin-top:4px;}" +
    ".sc-fb{background:none;border:1px solid var(--sc-input-border);border-radius:12px;padding:2px 8px;font-size:12px;cursor:pointer;opacity:.5;transition:opacity .15s;}" +
    ".sc-fb:hover{opacity:1;}" +
    ".sc-fb:disabled{cursor:default;}" +
    ".sc-fb-active{opacity:1;border-color:" + c + ";}" +

    ".sc-bot strong{font-weight:600;}" +
    ".sc-bot em{font-style:italic;}" +
    ".sc-bot a{color:" + c + ";text-decoration:underline;}" +
    ".sc-bot ul,.sc-bot ol{margin:4px 0 4px 18px;}" +
    ".sc-bot li{margin:2px 0;}" +
    ".sc-pre{position:relative;background:#1e1e2e;color:#cdd6f4;padding:10px 12px;border-radius:8px;overflow-x:auto;margin:6px 0;font-size:13px;line-height:1.45;}" +
    ".sc-copy{position:absolute;top:6px;right:6px;background:rgba(255,255,255,.12);border:none;color:#aaa;padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;font-family:inherit;}" +
    ".sc-copy:hover{background:rgba(255,255,255,.2);color:#fff;}" +
    ".sc-bot code{font-family:'SF Mono',Menlo,Consolas,monospace;font-size:13px;}" +
    ".sc-bot .sc-ic{background:var(--sc-ic-bg);padding:2px 5px;border-radius:4px;font-size:13px;}" +
    ".sc-error{color:#c0392b !important;background:#fdf0ef !important;}" +

    ".sc-suggestions{padding:0 16px 8px;display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0;}" +
    ".sc-sug{background:var(--sc-sug-bg);border:1px solid var(--sc-sug-border);border-radius:16px;padding:6px 14px;font-size:13px;cursor:pointer;font-family:inherit;color:var(--sc-sug-fg);transition:border-color .15s,color .15s;}" +
    ".sc-sug:hover{border-color:" + c + ";color:" + c + ";}" +

    ".sc-dots span{animation:sc-blink 1.4s infinite both;font-size:20px;line-height:1;letter-spacing:2px;}" +
    ".sc-dots span:nth-child(2){animation-delay:.2s}.sc-dots span:nth-child(3){animation-delay:.4s}" +
    "@keyframes sc-blink{0%,80%,100%{opacity:.25}40%{opacity:1}}" +

    ".sc-footer{padding:10px 12px;border-top:1px solid var(--sc-border);display:flex;gap:8px;flex-shrink:0;align-items:flex-end;}" +
    ".sc-input{flex:1;border:1px solid var(--sc-input-border);border-radius:10px;padding:10px 14px;font-size:14px;outline:none;font-family:inherit;background:var(--sc-input-bg);color:var(--sc-fg);resize:none;overflow-y:auto;max-height:100px;line-height:1.4;transition:border-color .2s,background .2s;}" +
    ".sc-input:focus{border-color:" + c + ";}" +
    ".sc-input:disabled{opacity:.6;}" +
    ".sc-send{background:" + c + ";color:#fff;border:none;border-radius:10px;width:42px;height:42px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .2s;flex-shrink:0;}" +
    ".sc-send:hover{opacity:.85;}" +
    ".sc-send:disabled{opacity:.4;cursor:default;}" +

    ".sc-powered{text-align:center;padding:6px;font-size:11px;color:var(--sc-fg);opacity:.35;border-top:1px solid var(--sc-border);}" +
    ".sc-powered a{color:var(--sc-fg);text-decoration:underline;}" +

    ".sc-messages::-webkit-scrollbar{width:5px}" +
    ".sc-messages::-webkit-scrollbar-thumb{background:#888;border-radius:3px}" +

    "@media(max-width:480px){.sc-panel{width:calc(100vw - 16px);" + (pos==="left"?"left:8px;":"right:8px;") + "bottom:80px;max-height:calc(100vh - 100px);border-radius:12px;}}";
  }
})();
