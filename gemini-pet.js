(function () {
  if (window.__geminiHajimiWidget) return;
  window.__geminiHajimiWidget = true;

  var isElectron = typeof require !== 'undefined';
  var ipcRenderer = null;
  if (isElectron) {
    try {
      ipcRenderer = require('electron').ipcRenderer;
    } catch (_) {}
  }

  var MIN_SCALE = 0.6;
  var MAX_SCALE = 2.5;
  var CLICK_SQ = 9;
  var ANIM_MS = 700;
  var BUBBLE_MS = 5000;

  var IMAGES = {
    idle: "./assets/idle.png",
    dragged: "./assets/dragged.png",
    happy: "./assets/happy.png",
    chill: "./assets/chill.png",
    fall: "./assets/fall.png",
    pat: "./assets/pat.png",
    typing: "./assets/typing.png",
    sleep: "./assets/chill.png"
  };

  var SOUND_DATA = {
    duck: {
      press: "./assets/Ya1.mp3",
      release: "./assets/Ya2.mp3"
    }
  };

  var css = [
    '.gpet-root{position:fixed;right:20px;bottom:20px;--gpet-scale:1.2;--gpet-base:calc(260px * var(--gpet-scale));width:var(--gpet-base);height:calc(var(--gpet-base) * 1.385);pointer-events:none;user-select:none;-webkit-user-select:none;z-index:99999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;transition:left .16s ease,top .16s ease,transform .3s ease}',
    '.gpet-root.gpet-left{transform:scaleX(-1)}',
    '.gpet-root.gpet-scaling, .gpet-root.gpet-scaling *{transition:none !important}',
    '.gpet-root.gpet-dragging{cursor:grabbing;transition:none !important}',
    '.gpet-root.gpet-dragging .gpet-body{transition:none !important;transform:none !important}',
    '.gpet-body{position:absolute;left:0;top:0;width:100%;height:100%}',
    '@keyframes gpet-jelly{0%{transform:scaleX(1.22) scaleY(0.78)} 24%{transform:scaleX(0.82) scaleY(1.22)} 44%{transform:scaleX(1.12) scaleY(0.90)} 64%{transform:scaleX(0.96) scaleY(1.04)} 82%{transform:scaleX(1.02) scaleY(0.98)} 100%{transform:scale(1,1)}}',
    '@keyframes gpet-breathe{0%,100%{transform:scale(1,1)} 50%{transform:scale(1.018,0.982)}}',
    '.gpet-breathe{animation:gpet-breathe 3.6s ease-in-out infinite !important}',
    '@keyframes gpet-typing-wobble{0%,100%{transform:translateY(0) scale(1,1)} 50%{transform:translateY(2.2px) scale(1.018,0.982)}}',
    '.gpet-typing-anim{animation:gpet-typing-wobble .28s cubic-bezier(0.35,0,0.25,1) infinite !important}',
    '.gpet-combo-badge{position:absolute;right:8%;top:32%;background:linear-gradient(135deg,#ec4899,#8b5cf6);color:#fff;font-weight:900;font-size:12px;padding:3px 8px;border-radius:12px;box-shadow:0 4px 12px rgba(236,72,153,0.45);pointer-events:none;z-index:90;transform:scale(0.8) translateY(0);opacity:0;transition:transform .12s cubic-bezier(.34,1.56,.64,1),opacity .18s ease;font-style:italic;text-shadow:0 1px 2px rgba(0,0,0,0.3)}',
    '.gpet-combo-badge.gpet-combo-active{opacity:1;transform:scale(1.08) translateY(-4px)}',
    '.gpet-combo-badge.gpet-combo-fever{background:linear-gradient(135deg,#f59e0b,#ef4444);box-shadow:0 6px 16px rgba(239,68,68,0.55);animation:gpet-combo-shake .14s infinite alternate}',
    '@keyframes gpet-combo-shake{0%{transform:scale(1.15) rotate(-3deg)} 100%{transform:scale(1.22) rotate(3deg)}}',
    '.gpet-img{position:absolute;right:0;bottom:0;width:62%;height:62%;display:block;pointer-events:none;-webkit-user-drag:none;user-select:none;object-fit:contain;filter:drop-shadow(0 6px 16px rgba(15,23,42,0.18));transform-origin:50% 98%;transition:transform .15s cubic-bezier(0.2,0.8,0.4,1)}',
    '.gpet-img.gpet-jelly, .gpet-body.gpet-jelly{animation:gpet-jelly .55s cubic-bezier(0.25,1,0.5,1) forwards !important;transition:none !important}',
    '.gpet-img.gpet-squished, .gpet-body.gpet-squished{transform:scaleX(1.22) scaleY(0.78) !important;transition:transform .08s cubic-bezier(0.2,0,0,1) !important}',
    '@keyframes gpet-heart-float{0%{opacity:0;transform:translateY(0) scale(0.6) rotate(0deg)} 25%{opacity:1;transform:translateY(-16px) scale(1.15) rotate(-10deg)} 75%{opacity:0.9;transform:translateY(-45px) scale(1) rotate(8deg)} 100%{opacity:0;transform:translateY(-68px) scale(0.7) rotate(-5deg)}}',
    '.gpet-heart{position:absolute;pointer-events:none;font-size:22px;line-height:1;animation:gpet-heart-float 1.1s cubic-bezier(0.2,0.8,0.4,1) forwards;z-index:100;user-select:none;filter:drop-shadow(0 2px 8px rgba(236,72,153,0.45))}',
    '.gpet-bubble{position:absolute;left:0;top:0;width:100%;aspect-ratio:1026/700;pointer-events:none;z-index:1;--gpet-u:calc(var(--gpet-base) / 1026);opacity:0;visibility:hidden;transition:opacity .2s ease,visibility .2s}',
    '.gpet-bubble.gpet-bubble-open{opacity:1;visibility:visible;transition:opacity .2s ease,visibility 0s}',
    '.gpet-bubble svg{display:block;width:100%;height:100%;pointer-events:none;filter:drop-shadow(0 12px 28px rgba(10,15,35,0.65)) drop-shadow(0 0 16px rgba(56,189,248,0.35))}',
    '.gpet-bubble svg path,.gpet-bubble svg ellipse,.gpet-bubble svg circle{pointer-events:none;cursor:pointer}',
    '.gpet-bubble.gpet-bubble-open svg path,.gpet-bubble.gpet-bubble-open svg ellipse,.gpet-bubble.gpet-bubble-open svg circle{pointer-events:visiblePainted}',
    '.gpet-bubble .gpet-bshape,.gpet-bubble .gpet-b1,.gpet-bubble .gpet-b2{opacity:0;transform:scale(.7);transform-box:fill-box;transform-origin:50% 50%;transition:opacity .2s ease,transform .2s ease}',
    '.gpet-bubble.gpet-bubble-open .gpet-bshape,.gpet-bubble.gpet-bubble-open .gpet-b1,.gpet-bubble.gpet-bubble-open .gpet-b2{opacity:1;transform:none}',
    '.gpet-bubble.gpet-bubble-open .gpet-b2{transition-delay:0s}',
    '.gpet-bubble.gpet-bubble-open .gpet-b1{transition-delay:.13s}',
    '.gpet-bubble.gpet-bubble-open .gpet-bshape{transition-delay:.26s}',
    '.gpet-bubble .gpet-bshape{transition-delay:.1s}',
    '.gpet-bubble .gpet-b1{transition-delay:.2s}',
    '.gpet-bubble .gpet-b2{transition-delay:.3s}',
    '.gpet-text{position:absolute;left:44%;top:36%;transform:translate(-50%,-50%);text-align:center;color:#f8fafc;line-height:1.25;white-space:nowrap;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .16s ease,transform .3s ease;width:68%;max-width:calc(var(--gpet-u) * 530);box-sizing:border-box}',
    '.gpet-bubble.gpet-bubble-open .gpet-text{opacity:1;visibility:visible;transition:opacity .16s ease .36s,transform .3s ease}',
    '.gpet-bubble:not(.gpet-bubble-open) .gpet-text{opacity:0 !important;visibility:hidden !important}',
    '.gpet-root.gpet-left .gpet-text{transform:translate(-50%,-50%) scaleX(-1)}',
    '.gpet-label{font-size:calc(var(--gpet-u) * 44);font-weight:700;letter-spacing:.04em;color:#38bdf8;text-shadow:0 0 10px rgba(56,189,248,0.45)}',
    '.gpet-amount{font-size:calc(var(--gpet-u) * 88);font-weight:800;line-height:1.1;color:#ffffff;letter-spacing:-0.01em;text-shadow:0 0 14px rgba(255,255,255,0.35)}',
    '.gpet-period{font-size:calc(var(--gpet-u) * 76);font-weight:800;line-height:1.05}',
    '.gpet-wrap{white-space:normal;max-width:calc(var(--gpet-u) * 450);line-height:1.32;font-size:calc(var(--gpet-u) * 42);margin:0 auto;word-break:break-word;text-shadow:0 0 8px rgba(255,255,255,0.25)}',
    '.gpet-hint{font-size:calc(var(--gpet-u) * 38);color:#cbd5e1;letter-spacing:.02em;margin-top:calc(var(--gpet-u) * 10);min-height:calc(var(--gpet-u) * 46);line-height:1.2;font-weight:500;text-shadow:0 0 8px rgba(203,213,225,0.3)}',
    '.gpet-menu{position:fixed;min-width:210px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;background:rgba(255,255,255,0.96);backdrop-filter:blur(16px);border:1px solid rgba(37,99,235,0.25);border-radius:12px;padding:10px 12px;opacity:0;transform:scale(.92) translateY(-6px);transition:opacity .18s ease,transform .2s cubic-bezier(.34,1.56,.64,1);pointer-events:none;z-index:100000;box-shadow:0 12px 32px rgba(15,23,42,0.22);color-scheme:light;box-sizing:border-box}',
    '.gpet-menu.gpet-menu-open{opacity:1;transform:scale(1) translateY(0);pointer-events:auto}',
    '.gpet-menu-title{font-size:13px;font-weight:700;color:#1e3a8a;margin-bottom:8px;display:flex;align-items:center;gap:6px}',
    '.gpet-menu-row{display:flex;align-items:center;gap:8px;margin:6px 0;color:#1e293b;font-size:12px;white-space:nowrap}',
    '.gpet-range{flex:1;min-width:0;accent-color:#2563eb}',
    '.gpet-number{width:46px;border:1px solid rgba(37,99,235,0.3);border-radius:6px;padding:2px 4px;font-size:12px;color:#1e293b;background:#fff;box-sizing:border-box;text-align:center}',
    '.gpet-number:disabled{opacity:.4;background:rgba(0,0,0,0.06);cursor:not-allowed}',
    '.gpet-sound{flex:1;border:1px solid rgba(37,99,235,0.3);border-radius:6px;background:rgba(37,99,235,0.06);color:#1e3a8a;font-size:12px;padding:4px 6px;cursor:pointer;font-weight:500}',
    '.gpet-sound:hover{background:rgba(37,99,235,0.12)}',
    '.gpet-check{width:16px;height:16px;accent-color:#2563eb;cursor:pointer;flex:0 0 auto}',
    '.gpet-menu-sep{height:1px;background:rgba(37,99,235,0.15);margin:8px 0}',
    '.gpet-volpct{width:38px;text-align:right;color:#64748b;font-size:11px}'
  ].join('\n');

  function initWidget() {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWidget);
      }
      return;
    }

    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    (document.head || document.body).appendChild(styleEl);

    var root = document.createElement('div');
    root.className = 'gpet-root';

    var body = document.createElement('div');
    body.className = 'gpet-body';

    var img = document.createElement('img');
    img.className = 'gpet-img gpet-breathe';
    img.src = IMAGES.chill;
    img.alt = 'Gemini 哈基米';
    img.draggable = false;

    var bubbleBox = document.createElement('div');
    bubbleBox.className = 'gpet-bubble';
    bubbleBox.innerHTML = '<svg viewBox="0 0 1026 700" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
      '  <linearGradient id="gpet-star-bg" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '    <stop offset="0%" stop-color="#0b0f19" stop-opacity="0.94"/>' +
      '    <stop offset="50%" stop-color="#1e1b4b" stop-opacity="0.92"/>' +
      '    <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95"/>' +
      '  </linearGradient>' +
      '  <linearGradient id="gpet-star-border" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '    <stop offset="0%" stop-color="#38bdf8"/>' +
      '    <stop offset="45%" stop-color="#818cf8"/>' +
      '    <stop offset="100%" stop-color="#c084fc"/>' +
      '  </linearGradient>' +
      '</defs>' +
      '<path class="gpet-bshape" fill="url(#gpet-star-bg)" stroke="url(#gpet-star-border)" stroke-width="14" stroke-linejoin="round" stroke-linecap="round" d="M 805,225 C 805,105 660,38 450,38 C 240,38 85,105 85,225 C 85,345 240,418 450,418 C 500,418 545,412 585,398 C 655,412 730,375 770,320 C 795,290 805,258 805,225 Z"/>' +
      '<circle class="gpet-b1" cx="530" cy="468" r="22" fill="url(#gpet-star-bg)" stroke="url(#gpet-star-border)" stroke-width="11"/>' +
      '<circle class="gpet-b2" cx="600" cy="518" r="14" fill="url(#gpet-star-bg)" stroke="url(#gpet-star-border)" stroke-width="9"/>' +
      '<path d="M 750,90 Q 750,105 765,105 Q 750,105 750,120 Q 750,105 735,105 Q 750,105 750,90 Z" fill="#38bdf8" opacity="0.85"/>' +
      '<path d="M 140,120 Q 140,132 152,132 Q 140,132 140,144 Q 140,132 128,132 Q 140,132 140,120 Z" fill="#c084fc" opacity="0.75"/>' +
      '<circle cx="730" cy="140" r="3" fill="#ffffff" opacity="0.6"/>' +
      '<circle cx="165" cy="100" r="2.5" fill="#38bdf8" opacity="0.6"/>' +
      '</svg>';

    var textBox = document.createElement('div');
    textBox.className = 'gpet-text';
    var labelEl = document.createElement('div');
    labelEl.className = 'gpet-label';
    labelEl.textContent = '✦ Gemini 5小时配额';
    var amountEl = document.createElement('div');
    amountEl.className = 'gpet-amount';
    amountEl.textContent = '100%';
    var hintEl = document.createElement('div');
    hintEl.className = 'gpet-hint';
    hintEl.textContent = '反重力全速运转中 ✦';
    textBox.appendChild(labelEl);
    textBox.appendChild(amountEl);
    textBox.appendChild(hintEl);
    bubbleBox.appendChild(textBox);

    function closePetEntirely(e) {
      if (e) {
        try { e.stopPropagation(); e.preventDefault(); } catch (_) {}
      }
      try {
        root.style.display = 'none';
        menuBox.style.display = 'none';
      } catch (_) {}
      if (ipcRenderer) {
        try { ipcRenderer.send('pet-quit'); } catch (_) {}
      }
      try {
        var remote = null;
        try { remote = require('@electron/remote'); } catch (_) {}
        if (!remote) { try { remote = require('electron').remote; } catch (_) {} }
        if (remote && remote.getCurrentWindow) {
          remote.getCurrentWindow().destroy();
        }
      } catch (_) {}
      try {
        window.close();
      } catch (_) {}
    }

    // Settings Menu Box
    var menuBox = document.createElement('div');
    menuBox.className = 'gpet-menu';

    function menuLabel(text) {
      var s = document.createElement('span');
      s.textContent = text;
      return s;
    }
    function menuRow() {
      var r = document.createElement('div');
      r.className = 'gpet-menu-row';
      return r;
    }

    var titleRow = document.createElement('div');
    titleRow.className = 'gpet-menu-title';
    titleRow.innerHTML = '<span>✦</span><span style="flex:1">Gemini 哈基米设置</span>';
    var closeMenuBtn = document.createElement('button');
    closeMenuBtn.type = 'button';
    closeMenuBtn.innerHTML = '✕';
    closeMenuBtn.title = '关闭菜单';
    closeMenuBtn.style.cssText = 'border:none;background:transparent;cursor:pointer;font-size:14px;color:#64748b;padding:0 4px;line-height:1;font-weight:700;';
    closeMenuBtn.addEventListener('click', function(e) { e.stopPropagation(); closeMenu(); });
    titleRow.appendChild(closeMenuBtn);
    menuBox.appendChild(titleRow);

    var scaleInput = document.createElement('input');
    scaleInput.type = 'range';
    scaleInput.min = String(MIN_SCALE);
    scaleInput.max = String(MAX_SCALE);
    scaleInput.step = '0.1';
    scaleInput.className = 'gpet-range';
    scaleInput.value = '1.2';

    var scaleNumber = document.createElement('input');
    scaleNumber.type = 'number';
    scaleNumber.min = '1';
    scaleNumber.max = '20';
    scaleNumber.step = '1';
    scaleNumber.className = 'gpet-number';
    scaleNumber.value = '7';

    scaleInput.addEventListener('pointerdown', function () {
      root.style.transition = 'none';
      if (ipcRenderer) ipcRenderer.send('pet-scale-start', state.h === 'left');
    });
    scaleInput.addEventListener('input', function () { setScale(scaleInput.value, false, false); });
    scaleInput.addEventListener('pointerup', function () {
      root.style.transition = '';
      if (ipcRenderer) ipcRenderer.send('pet-scale-end', state.scale, state.h === 'left');
      saveConfig(true);
    });
    scaleInput.addEventListener('change', function () {
      root.style.transition = '';
      if (ipcRenderer) ipcRenderer.send('pet-scale-end', state.scale, state.h === 'left');
      saveConfig(true);
    });

    scaleNumber.addEventListener('pointerdown', function () {
      root.style.transition = 'none';
      if (ipcRenderer) ipcRenderer.send('pet-scale-start', state.h === 'left');
    });
    scaleNumber.addEventListener('keydown', function () {
      if (ipcRenderer) ipcRenderer.send('pet-scale-start', state.h === 'left');
    });
    scaleNumber.addEventListener('input', function () {
      var v = Math.max(1, Math.min(20, Math.round(Number(scaleNumber.value) || 7)));
      var s = (v - 1) * 0.1 + 0.6;
      setScale(s, false, true);
    });
    scaleNumber.addEventListener('pointerup', function () {
      root.style.transition = '';
      if (ipcRenderer) ipcRenderer.send('pet-scale-end', state.scale, state.h === 'left');
      saveConfig(true);
    });
    scaleNumber.addEventListener('change', function () {
      root.style.transition = '';
      if (ipcRenderer) ipcRenderer.send('pet-scale-end', state.scale, state.h === 'left');
      saveConfig(true);
    });
    scaleNumber.addEventListener('blur', function () {
      if (ipcRenderer) ipcRenderer.send('pet-scale-end', state.scale, state.h === 'left');
      saveConfig(true);
    });

    var soundSelect = document.createElement('select');
    soundSelect.className = 'gpet-sound';
    function soundOpt(val, lbl) {
      var o = document.createElement('option');
      o.value = val;
      o.textContent = lbl;
      return o;
    }
    soundSelect.appendChild(soundOpt('duck', '小黄鸭 (挤压音)'));
    soundSelect.appendChild(soundOpt('mute', '静音'));
    soundSelect.addEventListener('change', function () { setSoundSet(soundSelect.value); });

    var volInput = document.createElement('input');
    volInput.type = 'range';
    volInput.min = '0';
    volInput.max = '1';
    volInput.step = '0.05';
    volInput.className = 'gpet-range';
    volInput.value = '0.9';

    var volPct = document.createElement('span');
    volPct.className = 'gpet-volpct';
    volInput.addEventListener('input', function () { setVol(volInput.value, false); });
    volInput.addEventListener('change', function () { saveConfig(true); });

    // Quota View Select
    var quotaViewSelect = document.createElement('select');
    quotaViewSelect.className = 'gpet-sound';
    quotaViewSelect.appendChild(soundOpt('5h', '5小时额度 (常用)'));
    quotaViewSelect.appendChild(soundOpt('weekly', '每周总额度'));
    quotaViewSelect.appendChild(soundOpt('alternate', '双额度交替轮播'));
    quotaViewSelect.addEventListener('change', function () { setQuotaView(quotaViewSelect.value); });

    var workStateSelect = document.createElement('select');
    workStateSelect.className = 'gpet-sound';
    workStateSelect.appendChild(soundOpt('auto', '自动跟随 (工作吹茶/空闲站立)'));
    workStateSelect.appendChild(soundOpt('typing', '疯狂码字 (打字敲键盘)'));
    workStateSelect.appendChild(soundOpt('chill', '吹茶品茗 (工作中)'));
    workStateSelect.appendChild(soundOpt('idle', '端庄站立 (经典待机)'));
    workStateSelect.appendChild(soundOpt('happy', '跪姿萌爪 (开心元气)'));
    workStateSelect.appendChild(soundOpt('dragged', '悬空拎起 (呆萌被提)'));
    workStateSelect.appendChild(soundOpt('fall', '跌坐揉头 (摔倒哭哭)'));
    workStateSelect.appendChild(soundOpt('pat', '摸头眯眼 (害羞享受)'));
    workStateSelect.addEventListener('change', function () { setWorkStateMode(workStateSelect.value); });

    var antigravitySyncSelect = document.createElement('select');
    antigravitySyncSelect.className = 'gpet-sound';
    antigravitySyncSelect.appendChild(soundOpt('sync_all', '跟随反重力启动和退出'));
    antigravitySyncSelect.appendChild(soundOpt('sync_start', '仅跟随反重力启动'));
    antigravitySyncSelect.appendChild(soundOpt('manual', '自己手动启动，自动检测'));
    antigravitySyncSelect.addEventListener('change', function () { setAntigravitySyncMode(antigravitySyncSelect.value); });

    var bubbleToggle = document.createElement('input');
    bubbleToggle.type = 'checkbox';
    bubbleToggle.className = 'gpet-check';
    bubbleToggle.checked = true;
    bubbleToggle.addEventListener('change', function () { setBubbleOn(bubbleToggle.checked); });

    var typingToggle = document.createElement('input');
    typingToggle.type = 'checkbox';
    typingToggle.className = 'gpet-check';
    typingToggle.checked = true;
    typingToggle.addEventListener('change', function () { setTypingOn(typingToggle.checked); });

    var gravityToggle = document.createElement('input');
    gravityToggle.type = 'checkbox';
    gravityToggle.className = 'gpet-check';
    gravityToggle.checked = true;
    gravityToggle.addEventListener('change', function () { setGravityOn(gravityToggle.checked); });

    var turnCostToggle = document.createElement('input');
    turnCostToggle.type = 'checkbox';
    turnCostToggle.className = 'gpet-check';
    turnCostToggle.checked = true;
    turnCostToggle.addEventListener('change', function () { setTurnCostOn(turnCostToggle.checked); });

    var turnCostCloseInput = document.createElement('input');
    turnCostCloseInput.type = 'number';
    turnCostCloseInput.min = '0';
    turnCostCloseInput.step = '1';
    turnCostCloseInput.className = 'gpet-number';
    turnCostCloseInput.value = '5';
    turnCostCloseInput.title = '填 0 表示不自动关闭';
    turnCostCloseInput.addEventListener('input', function () { setTurnCostClose(turnCostCloseInput.value); });

    var row1 = menuRow(); row1.appendChild(menuLabel('大小')); row1.appendChild(scaleInput); row1.appendChild(scaleNumber);
    var row2 = menuRow(); row2.appendChild(menuLabel('音效')); row2.appendChild(soundSelect);
    var row3 = menuRow(); row3.appendChild(menuLabel('音量')); row3.appendChild(volInput); row3.appendChild(volPct);
    var row4 = menuRow(); row4.appendChild(menuLabel('配额')); row4.appendChild(quotaViewSelect);
    var rowWork = menuRow(); rowWork.appendChild(menuLabel('状态')); rowWork.appendChild(workStateSelect);
    var rowSync = menuRow(); rowSync.appendChild(menuLabel('跟随反重力')); rowSync.appendChild(antigravitySyncSelect);
    var row5 = menuRow(); row5.appendChild(menuLabel('气泡')); row5.appendChild(bubbleToggle);
    var rowTyping = menuRow(); rowTyping.appendChild(menuLabel('打字工友')); rowTyping.appendChild(typingToggle);
    var rowGrav = menuRow(); rowGrav.appendChild(menuLabel('重力下落')); rowGrav.appendChild(gravityToggle);
    var sep1 = document.createElement('div'); sep1.className = 'gpet-menu-sep';
    var row6 = menuRow(); row6.appendChild(menuLabel('对话消耗')); row6.appendChild(turnCostToggle); row6.appendChild(menuLabel('自动关闭')); row6.appendChild(turnCostCloseInput); row6.appendChild(menuLabel('秒'));

    var sep2 = document.createElement('div'); sep2.className = 'gpet-menu-sep';
    var row7 = menuRow();
    row7.style.cssText = 'margin-top:10px;display:flex;width:100%;';
    var quitBtn = document.createElement('button');
    quitBtn.type = 'button';
    quitBtn.textContent = '✕ 退出桌宠';
    quitBtn.style.cssText = 'width:100%;border:1px solid rgba(239,68,68,0.45);background:rgba(239,68,68,0.1);color:#ef4444;font-size:12px;font-weight:700;padding:8px 0;border-radius:8px;cursor:pointer;display:block;text-align:center;box-sizing:border-box;transition:background .15s ease,border-color .15s ease;';
    quitBtn.addEventListener('mouseenter', function () {
      quitBtn.style.background = 'rgba(239,68,68,0.22)';
      quitBtn.style.borderColor = '#ef4444';
    });
    quitBtn.addEventListener('mouseleave', function () {
      quitBtn.style.background = 'rgba(239,68,68,0.1)';
      quitBtn.style.borderColor = 'rgba(239,68,68,0.45)';
    });
    quitBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    quitBtn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    quitBtn.addEventListener('click', closePetEntirely);
    row7.appendChild(quitBtn);

    menuBox.appendChild(row1);
    menuBox.appendChild(row2);
    menuBox.appendChild(row3);
    menuBox.appendChild(row4);
    menuBox.appendChild(rowWork);
    menuBox.appendChild(rowSync);
    menuBox.appendChild(row5);
    menuBox.appendChild(rowTyping);
    menuBox.appendChild(rowGrav);
    menuBox.appendChild(sep1);
    menuBox.appendChild(row6);
    menuBox.appendChild(sep2);
    menuBox.appendChild(row7);

    var comboBadge = document.createElement('div');
    comboBadge.className = 'gpet-combo-badge';
    comboBadge.textContent = 'Combo x1';

    body.appendChild(img);
    body.appendChild(comboBadge);
    body.appendChild(bubbleBox);
    root.appendChild(body);

    document.body.appendChild(root);
    document.body.appendChild(menuBox);

    // State model with Gemini Quota
    var state = {
      scale: 1.2,
      h: 'right',
      hOff: 20,
      v: 'bottom',
      vOff: 20,
      left: 0,
      top: 0,
      gemini5h: 1,
      gemini5hReset: '',
      geminiWeekly: 1,
      geminiWeeklyReset: '',
      claude5h: 1,
      claudeWeekly: 1,
      quotaView: '5h',
      alternateFlip: false,
      status: 'ok',
      message: ''
    };

    var drag = null;
    var shown = null;
    var animId = null;
    var bubbleShown = false;
    var bubbleTimer = null;
    var bubbleRandomActive = false;
    var bubbleRandomLines = null;
    var bubbleSwapTimer = null;
    var hintFadeTimer = null;
    var lastHintText = null;
    var costBubbleActive = false;
    var costBubbleTimer = null;
    var agentWorking = true;
    var workStateMode = 'auto'; // 'auto' | 'working' | 'idle'
    var inHappyReaction = false;
    var isAntigravityConnected = false;
    var happyTimer = null;
    var pressCount = 0;

    var soundOn = true;
    var soundVol = 0.9;
    var soundSet = 'duck';
    var bubbleOn = true;
    var turnCostOn = true;
    var turnCostCloseMs = 5000;
    var antigravitySyncMode = 'manual'; // 'sync_all' | 'sync_start' | 'manual'

    var BUBBLE_STYLE_CLASS = { A: 'gpet-label', B: 'gpet-amount', P: 'gpet-period', C: 'gpet-hint' };

    function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function singleCenter(style, text, color, wrap) { return [null, { t: text, s: style, c: color || '', w: !!wrap }, null]; }

    function fmtPct(val) {
      if (val === null || val === undefined || !isFinite(val)) return '--%';
      return Math.round(val * 100) + '%';
    }

    function getQuotaColor(val) {
      var pct = val * 100;
      if (pct <= 20) return '#fb7185';
      if (pct <= 50) return '#fbbf24';
      return '#38bdf8';
    }

    // Interactive Cat Maid & Coder Dialogue Quotes (随着按压次数随机显示)
    var TEXT_QUOTES = [
      // 捏捏互动类 (Squish & touch reactions)
      '别捏啦，猫耳和肉垫要被你捏扁了喵！(>w<)',
      '呀！捏我干嘛，再捏我就要吐泡泡了喵~',
      '呼噜呼噜… 捏得好舒服，猫生圆满了喵~ (≧∇≦)ﾉ',
      '弹力十足吧！这可是纯天然无添加的猫猫脂肪喵！',
      'Q 弹 Q 弹~ 再按一下，我就要原地起飞了喵！',
      '嗷呜！手感是不是超棒？小鱼干准备好了吗喵~',
      '捏一次消耗 0.1 焦耳，主人快敲代码补充能量喵！',
      '今天也是被主人宠幸（捏脸）的一天喵~ ✦',

      // 陪伴与元气类 (Cheering & companion)
      '我是你的 Gemini 哈基米！今天也要元气满满写代码喵~ ✦',
      '有 Bug 别慌，反重力引擎会保佑你的喵~ (=^･ω･^=)',
      '呼噜呼噜… 摸摸头，代码一遍过，测试全绿喵！',
      '今天主人敲代码速度好快！哈基米我都快眼花了喵~',
      '你写的那几千行代码，我一口气就看完了喵~ 厉害吧！',
      '主人主人辛苦啦~ 记得多喝水休息一下眼睛喵~',
      '好舒服喵~ 记得多给我备两桶小鱼干！',
      '休息一下吧，反重力引擎帮你盯好屏幕了喵~',

      // 程序员幽默与反重力彩蛋 (Coder humor & easter eggs)
      '代码没有 Bug，只是有独特的个性！',
      '反重力编译中… 正在将咖啡因转化为可用代码！',
      '✦ 宇宙算力全开！今天的哈基米超凶的！',
      'Git commit: "又改了一堆玄学代码" (嘘)',
      '正在向宇宙发射好运光波… 编译一次通过！',
      '只要我不看报错，报错就相当于不存在喵！',
      '键盘敲得啪啪响，年终奖金蹭蹭涨喵~'
    ];

    var lastQuoteIdx = -1;
    function pickRandomQuoteLines() {
      if (TEXT_QUOTES.length <= 1) return singleCenter('A', TEXT_QUOTES[0], '#e2e8f0', true);
      var idx;
      do {
        idx = Math.floor(Math.random() * TEXT_QUOTES.length);
      } while (idx === lastQuoteIdx);
      lastQuoteIdx = idx;
      return singleCenter('A', TEXT_QUOTES[idx], '#e2e8f0', true);
    }

    function applyBubbleLines(lines) {
      var els = [labelEl, amountEl, hintEl];
      for (var i = 0; i < 3; i++) {
        var el = els[i];
        var ln = lines && lines[i];
        if (ln) {
          el.style.display = '';
          if (typeof ln === 'string') {
            el.className = 'gpet-label gpet-wrap';
            el.textContent = ln;
            el.style.color = '#e2e8f0';
          } else {
            el.className = (BUBBLE_STYLE_CLASS[ln.s] || 'gpet-label') + (ln.w ? ' gpet-wrap' : '');
            el.textContent = ln.t !== undefined ? ln.t : '';
            el.style.color = ln.c || '';
          }
        } else {
          el.style.display = 'none';
          el.textContent = '';
          el.style.color = '';
        }
      }
    }

    function swapBubbleContent(applyFn) {
      if (bubbleSwapTimer) { clearTimeout(bubbleSwapTimer); bubbleSwapTimer = null; }
      textBox.style.transition = 'opacity .14s ease';
      textBox.style.opacity = '0';
      bubbleSwapTimer = setTimeout(function () {
        bubbleSwapTimer = null;
        applyFn();
        textBox.style.opacity = '1';
        setTimeout(function () {
          textBox.style.transition = '';
          textBox.style.opacity = '';
        }, 180);
      }, 140);
    }

    function getCurrentQuotaDisplay() {
      if (!isAntigravityConnected && state.gemini5h === null) {
        return {
          label: '✦ 纯净桌宠模式',
          val: null,
          hint: '反重力未开启 · 待机陪伴中 ✦'
        };
      }
      var isWeekly = state.quotaView === 'weekly' || (state.quotaView === 'alternate' && state.alternateFlip);
      var label = isWeekly ? '✦ Gemini 周配额' : '✦ Gemini 5小时配额';
      var val = isWeekly ? state.geminiWeekly : state.gemini5h;
      var reset = isWeekly ? state.geminiWeeklyReset : state.gemini5hReset;
      var hint = reset || (isAntigravityConnected ? '反重力全速运转中 ✦' : '离线缓存额度 · 待机中 ✦');
      return { label: label, val: val, hint: hint };
    }

    function restoreBubbleLines(isSwapping) {
      if (!isSwapping) {
        if (bubbleSwapTimer) { clearTimeout(bubbleSwapTimer); bubbleSwapTimer = null; }
        textBox.style.transition = '';
        textBox.style.opacity = '';
      }
      if (hintFadeTimer) { clearTimeout(hintFadeTimer); hintFadeTimer = null; }
      lastHintText = null;
      labelEl.style.display = '';
      labelEl.className = 'gpet-label';
      labelEl.style.color = '#38bdf8';
      amountEl.style.display = '';
      amountEl.className = 'gpet-amount';
      hintEl.style.display = '';
      hintEl.className = 'gpet-hint';
      hintEl.style.color = '';
      if (state.quotaView === 'alternate') {
        state.alternateFlip = !state.alternateFlip;
      }
      render();
    }

    function triggerBubbleOnPress() {
      if (!bubbleOn || costBubbleActive || menuOpen) return;
      if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }

      pressCount++;

      if (pressCount === 1) {
        // 第一下：在设置里现在可以设置的配额显示
        bubbleRandomActive = false;
        if (bubbleShown) {
          swapBubbleContent(function () {
            restoreBubbleLines(true);
          });
        } else {
          restoreBubbleLines(false);
          bubbleShown = true;
          bubbleBox.classList.add('gpet-bubble-open');
        }
      } else {
        // 其他文字类：全部随着按压次数随机显示
        bubbleRandomActive = true;
        var lines = pickRandomQuoteLines();
        if (bubbleShown) {
          swapBubbleContent(function () {
            applyBubbleLines(lines);
          });
        } else {
          applyBubbleLines(lines);
          bubbleShown = true;
          bubbleBox.classList.add('gpet-bubble-open');
        }
      }

      bubbleTimer = setTimeout(hideBubble, BUBBLE_MS);
    }

    function showBubble(forceQuota) {
      if (!bubbleOn || costBubbleActive || menuOpen) return;
      if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }
      if (forceQuota) pressCount = 0;
      triggerBubbleOnPress();
    }

    function showFallSpeechBubble() {
      if (!bubbleOn || costBubbleActive || menuOpen) return;
      if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }
      bubbleRandomActive = true;
      pressCount = 2;

      var fallQuotes = [
        singleCenter('A', '呜哇... 屁股摔得好痛痛 QAQ', '#fb7185', true),
        singleCenter('A', '呜呜呜... 谁把人家扔下来的？！', '#fb7185', true),
        singleCenter('A', '晕乎乎... 头顶冒小星星了 @o@', '#c084fc', true),
        singleCenter('A', '哎哟... 下次要接住我嘛~ 哼！', '#38bdf8', true)
      ];
      var lines = pickOne(fallQuotes);

      if (bubbleShown) {
        swapBubbleContent(function () {
          applyBubbleLines(lines);
        });
      } else {
        applyBubbleLines(lines);
        bubbleShown = true;
        bubbleBox.classList.add('gpet-bubble-open');
      }

      bubbleTimer = setTimeout(hideBubble, 4500);
    }

    var heartSymbols = ['💖', '✨', '🌸', '💕', '✦', '🐾'];
    function spawnHeartNearHead() {
      try {
        var heart = document.createElement('div');
        heart.className = 'gpet-heart';
        heart.textContent = pickOne(heartSymbols);
        var rX = 58 + Math.random() * 26;
        var rY = 38 + Math.random() * 16;
        if (state.h === 'left') rX = 100 - rX;
        heart.style.left = rX + '%';
        heart.style.top = rY + '%';
        body.appendChild(heart);
        setTimeout(function () {
          if (heart && heart.parentNode) heart.parentNode.removeChild(heart);
        }, 1100);
      } catch (_) {}
    }

    function showPatSpeechBubble() {
      if (!bubbleOn || costBubbleActive || menuOpen) return;
      if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }
      bubbleRandomActive = true;
      pressCount = 2;

      var patQuotes = [
        singleCenter('A', '呼噜呼噜… 最喜欢主人摸摸啦~ (ฅ^ω^ฅ)', '#f472b6', true),
        singleCenter('A', '蹭蹭~ 主人的手好暖和呀 ✦', '#f472b6', true),
        singleCenter('A', '脸颊都要被主人揉圆了啦… > <', '#fb7185', true),
        singleCenter('A', '摸摸头，今天写代码 Bug 全部退散喵！', '#38bdf8', true),
        singleCenter('A', '唔姆… 好舒服，猫猫不想努力了喵~ (//∇//)', '#f472b6', true),
        singleCenter('A', '最喜欢被主人温柔摸头了喵~ 💖', '#f472b6', true)
      ];
      var lines = pickOne(patQuotes);

      if (bubbleShown) {
        swapBubbleContent(function () {
          applyBubbleLines(lines);
        });
      } else {
        applyBubbleLines(lines);
        bubbleShown = true;
        bubbleBox.classList.add('gpet-bubble-open');
      }

      bubbleTimer = setTimeout(hideBubble, 4500);
    }

    function showCustomSpeechBubble(text, color) {
      if (!bubbleOn || costBubbleActive || menuOpen) return;
      if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }
      bubbleRandomActive = true;
      pressCount = 2;
      var lines = singleCenter('A', text, color || '#38bdf8', true);
      if (bubbleShown) {
        swapBubbleContent(function () {
          applyBubbleLines(lines);
        });
      } else {
        applyBubbleLines(lines);
        bubbleShown = true;
        bubbleBox.classList.add('gpet-bubble-open');
      }
      bubbleTimer = setTimeout(hideBubble, 5000);
    }

    function hideBubble() {
      if (costBubbleTimer) { clearTimeout(costBubbleTimer); costBubbleTimer = null; }
      costBubbleActive = false;
      if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }
      if (bubbleSwapTimer) { clearTimeout(bubbleSwapTimer); bubbleSwapTimer = null; }
      if (hintFadeTimer) { clearTimeout(hintFadeTimer); hintFadeTimer = null; }
      textBox.style.transition = '';
      textBox.style.opacity = '';
      amountEl.style.fontSize = '';
      hintEl.style.transition = '';
      hintEl.style.opacity = '';
      bubbleRandomActive = false;
      bubbleRandomLines = null;
      bubbleShown = false;
      pressCount = 0;
      bubbleBox.classList.remove('gpet-bubble-open');
      updateMousePassThrough(false);
    }

    bubbleBox.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!bubbleShown) return;
      if (costBubbleActive) {
        hideCostBubble();
        return;
      }
      triggerBubbleOnPress();
    });

    // Turn Cost Bubble (live working status + full turn token summary)
    function showCostBubble(amount, unit, isLive) {
      if (!bubbleOn || !turnCostOn) return;
      if (costBubbleTimer) { clearTimeout(costBubbleTimer); costBubbleTimer = null; }
      if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      costBubbleActive = true;
      bubbleRandomActive = false;
      bubbleShown = true;
      pressCount = 0;
      labelEl.style.display = '';
      labelEl.className = 'gpet-label';
      amountEl.style.display = '';
      amountEl.className = 'gpet-amount';
      hintEl.style.display = 'none';
      hintEl.textContent = '';

      if (isLive) {
        labelEl.textContent = '✦ 正在思考与敲代码...';
        labelEl.style.color = '#c084fc';
        amountEl.textContent = '持续工作中喵~ (ฅ^ω^ฅ)';
        amountEl.style.color = '#38bdf8';
        amountEl.style.fontSize = 'calc(var(--gpet-u) * 50)';
        bubbleBox.classList.add('gpet-bubble-open');
        // Keep open while agent is working
      } else {
        labelEl.textContent = '✦ 主人，本次一共消耗:';
        labelEl.style.color = '#38bdf8';
        amountEl.style.fontSize = '';
        if (typeof amount === 'number') {
          amountEl.textContent = amount.toLocaleString() + ' ' + (unit || 'tokens');
        } else {
          amountEl.textContent = String(amount || '--');
        }
        amountEl.style.color = '#fb7185';
        bubbleBox.classList.add('gpet-bubble-open');
        if (turnCostCloseMs > 0) {
          costBubbleTimer = setTimeout(hideCostBubble, turnCostCloseMs);
        }
      }
    }

    function hideCostBubble() {
      if (costBubbleTimer) { clearTimeout(costBubbleTimer); costBubbleTimer = null; }
      costBubbleActive = false;
      hideBubble();
    }

    window.showTurnCostBubble = showCostBubble;

    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
    function viewport() {
      return {
        w: window.innerWidth || document.documentElement.clientWidth || 1280,
        h: window.innerHeight || document.documentElement.clientHeight || 800
      };
    }

    function updateBaseUnits() {
      var w = Math.round(260 * state.scale);
      root.style.setProperty('--gpet-base', w + 'px');
    }
    window.addEventListener('resize', updateBaseUnits);

    function animateAmount(from, to, duration) {
      if (costBubbleActive || bubbleRandomActive) return;
      if (animId) cancelAnimationFrame(animId);
      if (from === null || !isFinite(from)) from = to;
      if (from === to) {
        shown = to;
        amountEl.textContent = fmtPct(to);
        amountEl.style.color = getQuotaColor(to);
        return;
      }
      var startTime = null;
      function step(ts) {
        if (costBubbleActive || bubbleRandomActive) { animId = null; return; }
        if (startTime === null) startTime = ts;
        var t = Math.min(1, (ts - startTime) / duration);
        var eased = 1 - Math.pow(1 - t, 3);
        var val = from + (to - from) * eased;
        amountEl.textContent = fmtPct(val);
        amountEl.style.color = getQuotaColor(val);
        if (t < 1) {
          animId = requestAnimationFrame(step);
        } else {
          animId = null;
          shown = to;
          amountEl.textContent = fmtPct(to);
          amountEl.style.color = getQuotaColor(to);
        }
      }
      animId = requestAnimationFrame(step);
    }

    function render() {
      if (costBubbleActive || bubbleRandomActive) return;
      var info = getCurrentQuotaDisplay();
      labelEl.textContent = info.label;
      var targetVal = info.val;
      if (targetVal === null || targetVal === undefined) {
        amountEl.textContent = '待机中';
        amountEl.style.color = '#10b981';
      } else {
        if (shown === null) shown = targetVal;
        amountEl.textContent = fmtPct(shown);
        amountEl.style.color = getQuotaColor(shown);
      }
      hintEl.textContent = info.hint;
    }

    function updateQuotaState(data) {
      if (!data) return;
      var infoBefore = getCurrentQuotaDisplay();
      var prevVal = infoBefore.val;
      if (typeof data.gemini5h === 'number') state.gemini5h = data.gemini5h;
      if (data.gemini5hReset) state.gemini5hReset = data.gemini5hReset;
      if (typeof data.geminiWeekly === 'number') state.geminiWeekly = data.geminiWeekly;
      if (data.geminiWeeklyReset) state.geminiWeeklyReset = data.geminiWeeklyReset;
      if (typeof data.claude5h === 'number') state.claude5h = data.claude5h;
      if (typeof data.claudeWeekly === 'number') state.claudeWeekly = data.claudeWeekly;

      var infoAfter = getCurrentQuotaDisplay();
      var nextVal = infoAfter.val;
      if (bubbleShown && !costBubbleActive && !bubbleRandomActive) {
        animateAmount(prevVal, nextVal, ANIM_MS);
        render();
      } else {
        shown = nextVal;
      }
    }

    function express() {
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      root.style.left = state.left + 'px';
      root.style.top = state.top + 'px';
      root.classList.toggle('gpet-left', state.h === 'left');
    }

    function settle() {
      var vp = viewport();
      var w = Math.round(260 * state.scale);
      var h = Math.round(360 * state.scale);
      if (drag && drag.active) {
        state.left = clamp(state.left, 0, Math.max(0, vp.w - w));
        state.top = clamp(state.top, 0, Math.max(0, vp.h - h));
        express();
        return;
      }
      if (state.h === 'right') {
        state.left = Math.max(0, vp.w - w - state.hOff);
      } else if (state.h === 'left') {
        state.left = state.hOff;
      } else {
        state.left = clamp(state.left, 0, Math.max(0, vp.w - w));
      }
      if (state.v === 'bottom') {
        state.top = Math.max(0, vp.h - h - state.vOff);
      } else if (state.v === 'top') {
        state.top = state.vOff;
      } else {
        state.top = clamp(state.top, 0, Math.max(0, vp.h - h));
      }
      express();
    }

    window.addEventListener('resize', settle);

    // Audio Player Engine (Embedded zero-dependency Base64)
    // Audio Player Engine
    var pressAudio = null;
    var releaseAudio = null;
    var pressing = false;
    var pressEnded = false;
    var releasePlayed = false;

    function applySoundSet() {
      if (soundSet === 'mute') {
        pressAudio = null;
        releaseAudio = null;
        return;
      }
      var set = SOUND_DATA[soundSet] || SOUND_DATA.duck;
      try {
        pressAudio = new Audio(set.press);
        pressAudio.preload = 'auto';
        pressAudio.volume = soundVol;
        releaseAudio = new Audio(set.release);
        releaseAudio.preload = 'auto';
        releaseAudio.volume = soundVol;
      } catch (err) {}
    }

    function playPress() {
      if (!pressAudio || !soundOn || soundSet === 'mute') return;
      try {
        if (releaseAudio) {
          releaseAudio.pause();
          releaseAudio.currentTime = 0;
        }
        pressEnded = false;
        releasePlayed = false;
        pressAudio.onended = function () {
          pressEnded = true;
          if (!pressing && !releasePlayed) playRelease();
        };
        pressAudio.currentTime = 0;
        var p = pressAudio.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (err) {}
    }

    function playRelease() {
      if (releasePlayed || !releaseAudio || !soundOn || soundSet === 'mute') return;
      releasePlayed = true;
      try {
        releaseAudio.currentTime = 0;
        var p = releaseAudio.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (err) {}
    }

    // Agent Working State & Sprite Management
    // Rule 1: C (chill: 喝茶吹气) displayed when Agent is working ("我在工作")
    // Rule 2: I (idle: 经典端庄站立) displayed when Agent is NOT working ("没工作")
    // Rule 3: D (dragged: 捧星) displayed when dragging
    // Rule 4: H (happy: 跪姿抬爪喵喵) displayed when clicked (interaction)
    function isCurrentlyWorking() {
      if (workStateMode === 'chill' || workStateMode === 'working') return true;
      if (workStateMode === 'idle') return false;
      return agentWorking;
    }

    function getBaseSprite() {
      if (inTypingMode || workStateMode === 'typing') return IMAGES.typing;
      if (workStateMode === 'chill' || workStateMode === 'working') return IMAGES.chill;
      if (workStateMode === 'idle') return IMAGES.idle;
      if (workStateMode === 'happy') return IMAGES.happy;
      if (workStateMode === 'dragged') return IMAGES.dragged;
      if (workStateMode === 'fall') return IMAGES.fall;
      if (workStateMode === 'pat') return IMAGES.pat;
      // 'auto' 模式：根据 Agent 状态自动切换（工作吹茶，空闲站立）
      return agentWorking ? IMAGES.chill : IMAGES.idle;
    }

    function syncSprite() {
      var targetSrc = getBaseSprite();
      if (drag && drag.active && drag.moved) {
        targetSrc = IMAGES.dragged;
      } else if (inHappyReaction) {
        targetSrc = IMAGES.happy;
      } else if (inTypingMode || workStateMode === 'typing') {
        targetSrc = IMAGES.typing;
      }
      if (img.src !== targetSrc) {
        img.src = targetSrc;
        if (typeof updateHitTestProbe === 'function') {
          updateHitTestProbe(targetSrc);
        }
      }
    }

    function setAgentWorking(isWorking) {
      agentWorking = !!isWorking;
      syncSprite();
    }

    function setWorkStateMode(mode) {
      workStateMode = mode;
      syncSprite();
      saveConfig();
    }

    // Spring animations & Q-elastic squish tactile reaction
    function pressDown() {
      pressing = true;
      img.classList.remove('gpet-breathe');
      img.classList.remove('gpet-jelly');
      img.classList.add('gpet-squished');
      playPress();
    }

    function pressUp(dragMoved) {
      pressing = false;
      img.classList.remove('gpet-squished');
      if (!dragMoved) {
        // Trigger Q-elastic jelly spring bounce!
        void img.offsetWidth;
        img.classList.add('gpet-jelly');
        setTimeout(function () {
          img.classList.remove('gpet-jelly');
          img.style.transform = '';
          img.classList.add('gpet-breathe');
        }, 550);
        playRelease();
      } else {
        img.classList.remove('gpet-jelly');
        img.style.transform = '';
        img.classList.add('gpet-breathe');
      }
    }

    // Dynamic Scale Adjustment (Electron + Web responsive)
    var scalingClassTimer = null;
    function setScale(v, fromRemote, fromNumberInput) {
      var next = Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(v))) * 10) / 10;
      state.scale = next;
      if (scaleInput && scaleInput.value !== String(next)) {
        scaleInput.value = String(next);
      }
      if (scaleNumber && !fromNumberInput) {
        var lvl = Math.round((next - 0.6) * 10) + 1;
        scaleNumber.value = String(Math.max(1, Math.min(20, lvl)));
      }

      var pxW = Math.round(260 * next);
      var pxH = Math.round(360 * next);

      root.classList.add('gpet-scaling');
      if (scalingClassTimer) clearTimeout(scalingClassTimer);
      scalingClassTimer = setTimeout(function () {
        scalingClassTimer = null;
        root.classList.remove('gpet-scaling');
      }, 180);

      root.style.setProperty('--gpet-scale', String(next));
      root.style.setProperty('--gpet-base', pxW + 'px');

      if (ipcRenderer) {
        if (!fromRemote) {
          ipcRenderer.send('pet-set-scale', next, state.h === 'left');
        }
      } else {
        root.style.width = pxW + 'px';
        root.style.height = pxH + 'px';
        settle();
      }
      if (!fromRemote) {
        saveConfig(false);
      }
    }

    function setVol(v, fromRemote) {
      soundVol = Math.round(Math.min(1, Math.max(0, Number(v))) * 100) / 100;
      soundOn = soundVol > 0;
      if (volInput && volInput.value !== String(soundVol)) {
        volInput.value = String(soundVol);
      }
      if (volPct) {
        volPct.textContent = Math.round(soundVol * 100) + '%';
      }
      if (pressAudio) pressAudio.volume = soundVol;
      if (releaseAudio) releaseAudio.volume = soundVol;
      if (!fromRemote) {
        saveConfig(false);
      }
    }

    function setSoundSet(v) {
      soundSet = v;
      soundSelect.value = v;
      applySoundSet();
      saveConfig();
    }

    function setQuotaView(v) {
      state.quotaView = v;
      quotaViewSelect.value = v;
      shown = null;
      render();
      saveConfig();
    }

    function setBubbleOn(v) {
      bubbleOn = !!v;
      bubbleToggle.checked = bubbleOn;
      if (!bubbleOn) hideCostBubble();
      saveConfig();
    }

    function setTurnCostOn(v) {
      turnCostOn = !!v;
      turnCostToggle.checked = turnCostOn;
      turnCostCloseInput.disabled = !turnCostOn;
      if (!turnCostOn) hideCostBubble();
      saveConfig();
    }

    function setTurnCostClose(v) {
      var n = Math.max(0, Math.round(Number(v) || 0));
      turnCostCloseMs = n * 1000;
      turnCostCloseInput.value = String(n);
      saveConfig();
    }

    function setTypingOn(v) {
      typingOn = !!v;
      if (typingToggle) typingToggle.checked = typingOn;
      if (!typingOn && inTypingMode) {
        exitTypingMode();
      }
      saveConfig();
    }

    function setGravityOn(v) {
      gravityOn = !!v;
      if (gravityToggle) gravityToggle.checked = gravityOn;
      saveConfig();
    }

    function setAntigravitySyncMode(v) {
      antigravitySyncMode = v || 'manual';
      if (antigravitySyncSelect) antigravitySyncSelect.value = antigravitySyncMode;
      saveConfig();
      if (ipcRenderer) {
        ipcRenderer.send('pet-config-changed', { antigravitySyncMode: antigravitySyncMode });
      }
    }

    var saveConfigTimer = null;
    function doSaveConfig() {
      try {
        var cfg = {
          scale: state.scale,
          soundVol: soundVol,
          soundSet: soundSet,
          quotaView: state.quotaView,
          bubbleOn: bubbleOn,
          typingOn: typingOn,
          gravityOn: gravityOn,
          turnCostOn: turnCostOn,
          turnCostCloseMs: turnCostCloseMs,
          workStateMode: workStateMode,
          antigravitySyncMode: antigravitySyncMode
        };
        localStorage.setItem('gemini-pet-config', JSON.stringify(cfg));
      } catch (_) {}
    }

    function saveConfig(immediate) {
      if (immediate) {
        if (saveConfigTimer) { clearTimeout(saveConfigTimer); saveConfigTimer = null; }
        doSaveConfig();
      } else {
        if (saveConfigTimer) clearTimeout(saveConfigTimer);
        saveConfigTimer = setTimeout(function () {
          saveConfigTimer = null;
          doSaveConfig();
        }, 400);
      }
    }

    function loadConfig() {
      try {
        var raw = localStorage.getItem('gemini-pet-config');
        if (raw) {
          var c = JSON.parse(raw);
          if (c.scale) setScale(c.scale);
          if (c.soundVol !== undefined) setVol(c.soundVol);
          if (c.soundSet) setSoundSet(c.soundSet);
          if (c.quotaView) setQuotaView(c.quotaView);
          if (c.bubbleOn !== undefined) setBubbleOn(c.bubbleOn);
          if (c.typingOn !== undefined) setTypingOn(c.typingOn);
          if (c.gravityOn !== undefined) setGravityOn(c.gravityOn);
          if (c.turnCostOn !== undefined) setTurnCostOn(c.turnCostOn);
          if (c.turnCostCloseMs) setTurnCostClose(c.turnCostCloseMs / 1000);
          if (c.workStateMode) {
            workStateMode = c.workStateMode === 'working' ? 'chill' : c.workStateMode;
            if (workStateSelect) workStateSelect.value = workStateMode;
            syncSprite();
          }
          if (c.antigravitySyncMode) {
            antigravitySyncMode = c.antigravitySyncMode;
            if (antigravitySyncSelect) antigravitySyncSelect.value = antigravitySyncMode;
          }
        }
      } catch (_) {}
    }

    var menuOpen = false;
    function toggleMenu() {
      menuOpen = !menuOpen;
      if (menuOpen) {
        hideBubble();
        positionMenu();
      }
      menuBox.classList.toggle('gpet-menu-open', menuOpen);
      updateMousePassThrough(menuOpen || bubbleShown);
    }
    function closeMenu() {
      menuOpen = false;
      menuBox.classList.remove('gpet-menu-open');
      updateMousePassThrough(bubbleShown);
    }

    function positionMenu() {
      try {
        var onLeft = state.h === 'left';
        if (onLeft) {
          menuBox.style.left = '8px';
          menuBox.style.right = 'auto';
          menuBox.style.transformOrigin = 'top left';
        } else {
          menuBox.style.right = '8px';
          menuBox.style.left = 'auto';
          menuBox.style.transformOrigin = 'top right';
        }
        menuBox.style.top = '8px';
        menuBox.style.bottom = 'auto';
      } catch (_) {}
    }

    // Pixel-level Transparent Hit-Testing Canvas (764x1024 native ratio)
    var hitCanvas = null;
    var hitCtx = null;
    var hitReady = false;
    var hitAlpha = null;
    function updateHitTestProbe(src) {
      if (!hitCanvas || !hitCtx) return;
      var probe = new Image();
      probe.onload = function () {
        try {
          hitCtx.clearRect(0, 0, hitCanvas.width, hitCanvas.height);
          hitCtx.drawImage(probe, 0, 0, hitCanvas.width, hitCanvas.height);
          var imgData = hitCtx.getImageData(0, 0, hitCanvas.width, hitCanvas.height);
          hitAlpha = imgData.data;
          hitReady = true;
        } catch (_) {}
      };
      probe.src = src;
    }

    function setupHitTest() {
      try {
        hitCanvas = document.createElement('canvas');
        hitCanvas.width = 382;
        hitCanvas.height = 512;
        hitCtx = hitCanvas.getContext('2d', { willReadFrequently: true });
        updateHitTestProbe(img.src || IMAGES.chill);
      } catch (_) {}
    }

    function getHitInfo(e) {
      try {
        var r = img.getBoundingClientRect();
        if (!r || r.width <= 0 || r.height <= 0) return { hit: false, isHead: false };

        var relX = (e.clientX - r.left) / r.width;
        var relY = (e.clientY - r.top) / r.height;
        if (state.h === 'left') relX = 1 - relX;

        var insideBox = relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1;
        if (!insideBox) return { hit: false, isHead: false };

        // Head region: upper 36% of the character image (ears & crown of head only)
        var isHead = relY <= 0.36 && relX >= 0.16 && relX <= 0.84;

        var hit = true;
        if (hitCanvas && hitReady && hitAlpha) {
          try {
            var imgAspect = 764 / 1024;
            var containerAspect = r.width / r.height;
            var rendW = r.width;
            var rendH = r.height;
            var offX = 0;
            var offY = 0;
            if (containerAspect < imgAspect) {
              rendW = r.width;
              rendH = r.width / imgAspect;
              offY = (r.height - rendH) / 2;
            } else {
              rendH = r.height;
              rendW = r.height * imgAspect;
              offX = (r.width - rendW) / 2;
            }
            var lx = Math.floor((e.clientX - (r.left + offX)) / rendW * hitCanvas.width);
            var ly = Math.floor((e.clientY - (r.top + offY)) / rendH * hitCanvas.height);
            if (state.h === 'left') lx = hitCanvas.width - 1 - lx;
            if (lx >= 0 && ly >= 0 && lx < hitCanvas.width && ly < hitCanvas.height) {
              var idx = (ly * hitCanvas.width + lx) * 4 + 3;
              hit = hitAlpha[idx] > 10;
            }
          } catch (_) {}
        }

        return { hit: hit, isHead: isHead, relX: relX, relY: relY };
      } catch (_) {
        return { hit: true, isHead: false };
      }
    }

    function isCharacterHit(e) {
      return getHitInfo(e).hit;
    }

    // Gravity Physics Engine
    var gravityAnimId = null;
    var gravityOn = true;

    function stopGravityDrop() {
      if (gravityAnimId) {
        cancelAnimationFrame(gravityAnimId);
        gravityAnimId = null;
      }
    }

    function startGravityDrop(startX, startY, initVx, initVy) {
      stopGravityDrop();

      var curX = startX;
      var curY = startY;
      var vx = Math.max(-14, Math.min(14, (typeof initVx === 'number' ? initVx : 0)));
      var vy = Math.max(-10, Math.min(12, (typeof initVy === 'number' ? initVy : 0)));
      var gravity = 0.52;
      var maxFallSpeed = 9.5;
      var bounceCount = 0;

      var isElec = !!ipcRenderer;
      var screenW = isElec ? (window.screen.availWidth || 1920) : (window.innerWidth || 1280);
      var screenH = isElec ? (window.screen.availHeight || 1080) : (window.innerHeight || 800);
      var petW = isElec ? (window.outerWidth || Math.round(260 * state.scale)) : Math.round(260 * state.scale);
      var petH = isElec ? (window.outerHeight || Math.round(360 * state.scale)) : Math.round(360 * state.scale);
      var topOff = isElec ? (window.screen.availTop || 0) : 0;
      var leftOff = isElec ? (window.screen.availLeft || 0) : 0;

      var floorY = Math.max(0, topOff + screenH - petH - 20);
      var minX = leftOff + 10;
      var maxX = Math.max(minX, leftOff + screenW - petW - 10);

      img.classList.remove('gpet-breathe');
      img.classList.remove('gpet-jelly');
      img.classList.remove('gpet-squished');
      img.src = IMAGES.happy;

      function tick() {
        vy += gravity;
        if (vy > maxFallSpeed) vy = maxFallSpeed;
        curY += vy;
        curX += vx;
        vx *= 0.985;

        // Side wall bounce
        if (curX <= minX) {
          curX = minX;
          vx = -vx * 0.5;
        } else if (curX >= maxX) {
          curX = maxX;
          vx = -vx * 0.5;
        }

        // Floor collision
        if (curY >= floorY) {
          curY = floorY;
          if (img.src !== IMAGES.fall) {
            img.src = IMAGES.fall;
          }
          if (Math.abs(vy) > 2.8) {
            playRelease();
            img.classList.remove('gpet-jelly');
            void img.offsetWidth;
            img.classList.add('gpet-jelly');
            setTimeout(function () {
              img.classList.remove('gpet-jelly');
            }, 550);

            vy = -vy * 0.34;
            vx *= 0.6;
            bounceCount++;
            if (bounceCount >= 3 || Math.abs(vy) < 1.8) {
              vy = 0;
            }
          } else {
            vy = 0;
          }
        }

        if (isElec) {
          ipcRenderer.send('pet-set-position', Math.round(curX), Math.round(curY));
        } else {
          state.left = Math.round(curX);
          state.top = Math.round(curY);
          express();
        }

        if (Math.abs(vy) > 0.1 || curY < floorY - 2) {
          gravityAnimId = requestAnimationFrame(tick);
        } else {
          gravityAnimId = null;
          if (isElec) {
            ipcRenderer.send('pet-set-position', Math.round(curX), Math.round(floorY));
          } else {
            state.left = Math.round(curX);
            state.top = Math.round(floorY);
            express();
          }

          // Keep sprawled sitting on floor rubbing head!
          img.src = IMAGES.fall;
          inHappyReaction = true;

          // Cute pout bubble!
          showFallSpeechBubble();

          if (happyTimer) clearTimeout(happyTimer);
          happyTimer = setTimeout(function () {
            inHappyReaction = false;
            syncSprite();
            img.classList.add('gpet-breathe');
          }, 2400);
        }
      }

      gravityAnimId = requestAnimationFrame(tick);
    }

    // Pointer and Drag Interaction
    function onWindowBlurDuringDrag() {
      if (drag && drag.active) {
        endDrag(null, false);
      }
    }

    function onDocPointerDown(e) {
      stopGravityDrop();
      if (e.target && e.target.closest) {
        if (e.target.closest('.gpet-bubble') || e.target.closest('.gpet-menu')) return;
      }
      if (menuOpen) {
        closeMenu();
        return;
      }
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      var hitInfo = getHitInfo(e);
      if (!hitInfo.hit) return;
      try { e.preventDefault(); e.stopPropagation(); } catch (_) {}

      try {
        if (e.target && typeof e.target.setPointerCapture === 'function') {
          e.target.setPointerCapture(e.pointerId);
        }
      } catch (_) {}

      var vp = viewport();
      var rect = root.getBoundingClientRect();
      var sX = (e.screenX !== undefined && e.screenX !== 0) ? e.screenX : e.clientX;
      var sY = (e.screenY !== undefined && e.screenY !== 0) ? e.screenY : e.clientY;
      var winX = window.screenX || 0;
      var winY = window.screenY || 0;
      var now = performance.now();

      drag = {
        active: true,
        pointerId: e.pointerId,
        targetEl: e.target,
        startX: e.clientX,
        startY: e.clientY,
        startScreenX: sX,
        startScreenY: sY,
        startWinX: winX,
        startWinY: winY,
        lastScreenX: sX,
        lastScreenY: sY,
        lastTime: now,
        vx: 0,
        vy: 0,
        origLeft: rect.left,
        origTop: rect.top,
        w: rect.width,
        h: rect.height,
        moved: false,
        vp: vp
      };
      pressDown();
      document.addEventListener('pointermove', onDocPointerMove, true);
      document.addEventListener('pointerup', onDocPointerUp, true);
      document.addEventListener('pointercancel', onDocPointerCancel, true);
      window.addEventListener('blur', onWindowBlurDuringDrag);
    }

    var pendingSetPos = null;
    var setPosRafId = null;
    function scheduleSetPosition(x, y) {
      pendingSetPos = { x: x, y: y };
      if (!setPosRafId) {
        setPosRafId = requestAnimationFrame(function () {
          setPosRafId = null;
          if (pendingSetPos && ipcRenderer) {
            ipcRenderer.send('pet-set-position', pendingSetPos.x, pendingSetPos.y);
          }
        });
      }
    }
    function flushSetPosition() {
      if (setPosRafId) {
        cancelAnimationFrame(setPosRafId);
        setPosRafId = null;
      }
      if (pendingSetPos && ipcRenderer) {
        ipcRenderer.send('pet-set-position', pendingSetPos.x, pendingSetPos.y);
        pendingSetPos = null;
      }
    }

    function onDocPointerMove(e) {
      if (!drag || !drag.active) return;
      var sX = (e.screenX !== undefined && e.screenX !== 0) ? e.screenX : e.clientX;
      var sY = (e.screenY !== undefined && e.screenY !== 0) ? e.screenY : e.clientY;
      var screenDx = sX - drag.startScreenX;
      var screenDy = sY - drag.startScreenY;

      var now = performance.now();
      var dt = Math.max(1, now - (drag.lastTime || now));
      var instVx = (sX - drag.lastScreenX) / dt;
      var instVy = (sY - drag.lastScreenY) / dt;
      drag.vx = drag.vx * 0.4 + (instVx * 16.6) * 0.6;
      drag.vy = drag.vy * 0.4 + (instVy * 16.6) * 0.6;
      drag.lastScreenX = sX;
      drag.lastScreenY = sY;
      drag.lastTime = now;

      if (screenDx * screenDx + screenDy * screenDy >= CLICK_SQ) {
        if (!drag.moved) {
          drag.moved = true;
          root.classList.add('gpet-dragging');
          img.classList.remove('gpet-squished');
          img.classList.remove('gpet-jelly');
          img.style.transform = '';
          if (pressAudio) {
            try { pressAudio.pause(); pressAudio.currentTime = 0; } catch (_) {}
          }
          pressEnded = false;
          releasePlayed = true;
          img.src = IMAGES.dragged;
        }
      }

      if (drag.moved) {
        if (ipcRenderer && e.screenX !== undefined && e.screenX !== 0) {
          var targetX = Math.round(drag.startWinX + screenDx);
          var targetY = Math.round(drag.startWinY + screenDy);
          scheduleSetPosition(targetX, targetY);
          return;
        }

        var dx = e.clientX - drag.startX;
        var dy = e.clientY - drag.startY;
        state.left = clamp(drag.origLeft + dx, 0, Math.max(0, drag.vp.w - drag.w));
        state.top = clamp(drag.origTop + dy, 0, Math.max(0, drag.vp.h - drag.h));
        express();
      }
    }

    function onDocPointerUp(e) {
      try { if (isCharacterHit(e)) { e.preventDefault(); e.stopPropagation(); } } catch (_) {}
      endDrag(e, true);
    }
    function onDocPointerCancel(e) { endDrag(e, false); }

    function endDrag(e, clickAllowed) {
      if (!drag || !drag.active) return;
      flushSetPosition();
      var dragMoved = drag.moved;
      var targetEl = drag.targetEl;
      var pointerId = drag.pointerId;
      var throwVx = drag.vx;
      var throwVy = drag.vy;
      var lastMoveTime = drag.lastTime;
      var sX = (e && e.screenX !== undefined && e.screenX !== 0) ? e.screenX : drag.lastScreenX;
      var sY = (e && e.screenY !== undefined && e.screenY !== 0) ? e.screenY : drag.lastScreenY;
      var screenDx = sX - drag.startScreenX;
      var screenDy = sY - drag.startScreenY;
      var curX = ipcRenderer ? Math.round(drag.startWinX + screenDx) : state.left;
      var curY = ipcRenderer ? Math.round(drag.startWinY + screenDy) : state.top;

      try {
        if (targetEl && pointerId !== undefined && typeof targetEl.releasePointerCapture === 'function') {
          targetEl.releasePointerCapture(pointerId);
        }
      } catch (_) {}

      drag.active = false;
      drag = null;
      document.removeEventListener('pointermove', onDocPointerMove, true);
      document.removeEventListener('pointerup', onDocPointerUp, true);
      document.removeEventListener('pointercancel', onDocPointerCancel, true);
      window.removeEventListener('blur', onWindowBlurDuringDrag);
      root.classList.remove('gpet-dragging');
      pressUp(dragMoved);

      if (clickAllowed && !dragMoved) {
        if (happyTimer) clearTimeout(happyTimer);
        inHappyReaction = true;
        img.src = IMAGES.happy;
        showBubble();
        happyTimer = setTimeout(function () {
          inHappyReaction = false;
          syncSprite();
          img.classList.add('gpet-breathe');
        }, 1200);
        return;
      }

      if (dragMoved && gravityOn) {
        var isElec = !!ipcRenderer;
        var screenH = isElec ? (window.screen.availHeight || 1080) : (window.innerHeight || 800);
        var petH = isElec ? (window.outerHeight || Math.round(360 * state.scale)) : Math.round(360 * state.scale);
        var topOff = isElec ? (window.screen.availTop || 0) : 0;
        var floorY = Math.max(0, topOff + screenH - petH - 20);

        var nowMs = performance.now();
        var timeSinceLastMove = nowMs - (lastMoveTime || nowMs);
        var throwSpeed = Math.hypot(throwVx, throwVy);

        // 抛出判定：释放时处于明显甩动滑行状态（速度 > 2.8 且距最后移动 < 110ms）
        var isThrow = (timeSinceLastMove < 110) && (throwSpeed > 2.8 || throwVy > 2.2 || throwVy < -2.6 || Math.abs(throwVx) > 2.8);

        if (isThrow) {
          startGravityDrop(curX, curY, throwVx, throwVy);
          return;
        }

        // 悬停模式：轻轻松手，停在当前任意位置（反重力浮空）
        stopGravityDrop();
        if (isElec) {
          ipcRenderer.send('pet-set-position', Math.round(curX), Math.round(curY));
        } else {
          state.left = Math.round(curX);
          state.top = Math.round(curY);
          express();
        }

        // 若悬停在半空（远离任务栏），触发反重力悬停趣味台词
        if (curY < floorY - 60 && bubbleOn && !bubbleShown) {
          var hoverQuotes = [
            '✦ 反重力引擎启动，悬停就绪喵~',
            '我就呆在这里看你敲代码喵~ ✦',
            '浮空守护中… 屏幕视野超棒喵~ (ฅ^ω^ฅ)',
            '反重力小猫咪随时待命 ✦'
          ];
          var lines = singleCenter('A', pickOne(hoverQuotes), '#38bdf8', true);
          applyBubbleLines(lines);
          bubbleShown = true;
          bubbleBox.classList.add('gpet-bubble-open');
          bubbleTimer = setTimeout(hideBubble, 3200);
        }
      }

      inHappyReaction = false;
      syncSprite();
      if (ipcRenderer) {
        try {
          ipcRenderer.send('pet-request-agent-work-state');
        } catch (_) {}
      } else if (!dragMoved) {
        settle();
      }
      if (e) {
        setWidgetCursor(isCharacterHit(e) ? 'grab' : '');
      }
    }

    // Headpat Reaction Engine (Hover Petting & Wheel Petting)
    function triggerHeadpatReaction(isWheel) {
      spawnHeartNearHead();
      playRelease();
      if (inHappyReaction && img.src === IMAGES.pat) {
        if (happyTimer) clearTimeout(happyTimer);
        happyTimer = setTimeout(function () {
          inHappyReaction = false;
          syncSprite();
          img.classList.add('gpet-breathe');
        }, 2200);
        return;
      }
      if (happyTimer) clearTimeout(happyTimer);
      inHappyReaction = true;
      img.src = IMAGES.pat;
      showPatSpeechBubble();
      happyTimer = setTimeout(function () {
        inHappyReaction = false;
        syncSprite();
        img.classList.add('gpet-breathe');
      }, 2200);
    }

    // 1. Hover Petting (悬停抚摸：鼠标在头顶区域轻快反复来回揉蹭)
    var hoverDist = 0;
    var hoverReversals = 0;
    var lastHoverX = 0;
    var lastHoverY = 0;
    var lastHoverDirX = 0;
    var lastHoverTime = 0;

    document.addEventListener('pointermove', function (e) {
      if (drag && drag.active) return;
      if (menuOpen) return;
      var hitInfo = getHitInfo(e);
      if (hitInfo.hit && hitInfo.isHead) {
        var now = performance.now();
        if (now - lastHoverTime > 380) {
          hoverDist = 0;
          hoverReversals = 0;
          lastHoverDirX = 0;
        }
        lastHoverTime = now;
        var hdx = e.clientX - (lastHoverX || e.clientX);
        var hdy = e.clientY - (lastHoverY || e.clientY);
        hoverDist += Math.hypot(hdx, hdy);
        lastHoverX = e.clientX;
        lastHoverY = e.clientY;

        // Detect clear horizontal direction change (rubbing back and forth)
        if (Math.abs(hdx) > 6) {
          var dir = hdx > 0 ? 1 : -1;
          if (lastHoverDirX && lastHoverDirX !== dir) {
            hoverReversals++;
          }
          lastHoverDirX = dir;
        }

        // Must intentionally rub back and forth at least 3 times with enough travel distance!
        if (hoverDist >= 140 && hoverReversals >= 3) {
          hoverDist = 0;
          hoverReversals = 0;
          lastHoverDirX = 0;
          triggerHeadpatReaction(false);
        }
      } else {
        lastHoverX = e.clientX;
        lastHoverY = e.clientY;
        hoverDist = 0;
        hoverReversals = 0;
        lastHoverDirX = 0;
      }
    }, true);

    // 3. Wheel Petting / Scratching (鼠标滚轮在头部连续滚动挠痒)
    var wheelTicks = 0;
    var lastWheelTime = 0;
    window.addEventListener('wheel', function (e) {
      if (menuOpen) return;
      var hitInfo = getHitInfo(e);
      if (hitInfo.hit && hitInfo.isHead) {
        try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
        var now = performance.now();
        if (now - lastWheelTime > 450) {
          wheelTicks = 0;
        }
        lastWheelTime = now;
        wheelTicks++;

        // Each wheel scroll produces a gentle heart
        spawnHeartNearHead();

        // Requires at least 3 continuous wheel notches to trigger full pampered headpat
        if (wheelTicks >= 3) {
          triggerHeadpatReaction(true);
          wheelTicks = 0;
        }
      } else {
        wheelTicks = 0;
      }
    }, { passive: false });

    function onDocClickStopper(e) {
      if (e.target && e.target.closest && (e.target.closest('.gpet-menu') || e.target.closest('.gpet-bubble'))) return;
      if (!isCharacterHit(e)) return;
      try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
    }

    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('click', onDocClickStopper, true);
    document.addEventListener('contextmenu', function (e) {
      if (isCharacterHit(e)) {
        try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
        if (ipcRenderer) {
          var r = img.getBoundingClientRect();
          var charRect = {
            left: Math.round(window.screenX + r.left),
            top: Math.round(window.screenY + r.top),
            right: Math.round(window.screenX + r.right),
            bottom: Math.round(window.screenY + r.bottom),
            width: Math.round(r.width),
            height: Math.round(r.height)
          };
          ipcRenderer.send('pet-toggle-settings', charRect);
        } else {
          toggleMenu();
        }
      }
    }, true);

    var widgetCursor = '';
    function setWidgetCursor(v) {
      if (v !== widgetCursor) {
        widgetCursor = v;
        try { document.body.style.cursor = v; } catch (_) {}
      }
    }

    var lastCaptureState = null;
    function updateMousePassThrough(shouldCapture) {
      if (!ipcRenderer) return;
      if (lastCaptureState === shouldCapture) return;
      lastCaptureState = shouldCapture;
      if (shouldCapture) {
        ipcRenderer.send('set-ignore-mouse-events', false);
      } else {
        ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
      }
    }

    function isBubbleInteractive(e) {
      if (!bubbleShown) return false;
      try {
        var el = document.elementFromPoint(e.clientX, e.clientY);
        if (el && el.closest && el.closest('.gpet-bubble-open')) {
          return true;
        }
      } catch (_) {}
      return false;
    }

    // Dynamic Hover and Cursor handling
    function onDocPointerMoveCursor(e) {
      if (drag && drag.active) {
        setWidgetCursor('grabbing');
        updateMousePassThrough(true);
        return;
      }
      var over = isCharacterHit(e);
      var overBubble = isBubbleInteractive(e);
      var overMenu = menuOpen && (function () {
        try {
          var el = document.elementFromPoint(e.clientX, e.clientY);
          return !!(el && el.closest && el.closest('.gpet-menu-open'));
        } catch (_) { return false; }
      })();
      var shouldCapture = over || overBubble || overMenu;
      setWidgetCursor(over ? 'grab' : (overBubble ? 'pointer' : ''));
      updateMousePassThrough(shouldCapture);
    }
    document.addEventListener('pointermove', onDocPointerMoveCursor, true);
    window.addEventListener('mouseleave', function () {
      if (drag && drag.active) return;
      setWidgetCursor('');
      updateMousePassThrough(false);
    });

    // Coding Companion: Typing & Keyboard combo detection
    var typingOn = true;
    var typingCombo = 0;
    var typingDecayTimer = null;
    var inTypingMode = false;
    var lastTypingBubbleTime = 0;

    var TYPING_QUOTES = [
      '主人敲键盘好快！我也来帮忙敲两行！啪啪啪~ ✦',
      '啪啪啪… 正在给主人的代码施加“无 Bug 魔法”喵！(ฅ^ω^ฅ)',
      '键盘要敲冒烟啦！这就是传说中的手速吗？！(🔥)',
      'Git push origin master --force… (嘘，开玩笑的喵！)',
      'Ctrl+C，Ctrl+V… 熟练得让人心疼喵！( >w< )',
      '呼噜呼噜… 反重力引擎已将咖啡因转化为可用代码！',
      '⚡ 结对编程模式启动！今天的产出翻倍喵！',
      '主人尽管敲，报错有反重力引擎顶着喵！'
    ];

    function spawnTypingSpark() {
      try {
        var spark = document.createElement('div');
        spark.className = 'gpet-heart';
        var isFire = typingCombo >= 15;
        spark.textContent = isFire ? (Math.random() > 0.5 ? '🔥' : '⚡') : (Math.random() > 0.5 ? '✦' : '💻');
        var r = img.getBoundingClientRect();
        var ox = r.left + r.width * (0.55 + (Math.random() - 0.5) * 0.3);
        var oy = r.top + r.height * (0.68 + (Math.random() - 0.5) * 0.15);
        spark.style.left = Math.round(ox) + 'px';
        spark.style.top = Math.round(oy) + 'px';
        spark.style.fontSize = isFire ? '22px' : '17px';
        document.body.appendChild(spark);
        setTimeout(function () {
          if (spark && spark.parentNode) spark.parentNode.removeChild(spark);
        }, 1100);
      } catch (_) {}
    }

    function showTypingBubble() {
      if (!bubbleOn || costBubbleActive || menuOpen) return;
      var now = Date.now();
      if (now - lastTypingBubbleTime < 5000) return;
      lastTypingBubbleTime = now;
      if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }
      bubbleRandomActive = true;
      pressCount = 2;

      var text = pickOne(TYPING_QUOTES);
      var lines = singleCenter('A', text, '#8b5cf6', true);

      if (bubbleShown) {
        swapBubbleContent(function () {
          applyBubbleLines(lines);
        });
      } else {
        applyBubbleLines(lines);
        bubbleShown = true;
        bubbleBox.classList.add('gpet-bubble-open');
      }

      bubbleTimer = setTimeout(hideBubble, 3800);
    }

    function handleKeyPress() {
      if (!typingOn || (drag && drag.active) || inHappyReaction || gravityAnimId) return;

      typingCombo++;
      comboBadge.textContent = 'Combo x' + typingCombo;
      comboBadge.classList.add('gpet-combo-active');
      comboBadge.classList.toggle('gpet-combo-fever', typingCombo >= 15);

      if (!inTypingMode && workStateMode !== 'typing') {
        inTypingMode = true;
        syncSprite();
        img.classList.remove('gpet-breathe');
        img.classList.add('gpet-typing-anim');
      }

      if (typingCombo % 4 === 0 || typingCombo >= 15) {
        spawnTypingSpark();
      }

      if (typingCombo === 8 || typingCombo === 25 || typingCombo === 50) {
        showTypingBubble();
      }

      if (typingDecayTimer) clearTimeout(typingDecayTimer);
      typingDecayTimer = setTimeout(exitTypingMode, 2300);
    }

    function exitTypingMode() {
      if (!inTypingMode) return;
      inTypingMode = false;
      typingCombo = 0;
      comboBadge.classList.remove('gpet-combo-active');
      comboBadge.classList.remove('gpet-combo-fever');
      img.classList.remove('gpet-typing-anim');
      syncSprite();
      img.classList.add('gpet-breathe');
    }

    document.addEventListener('keydown', function () {
      handleKeyPress();
    });

    // Start with mouse events ignored for transparent areas
    if (ipcRenderer) {
      setTimeout(function () {
        updateMousePassThrough(false);
      }, 80);
    }

    // IPC listener for real-time Quota & Agent Work State updates
    if (ipcRenderer) {
      var hasShownInitialGreeting = false;

      ipcRenderer.on('pet-antigravity-state', function (e, alive) {
        var prev = isAntigravityConnected;
        isAntigravityConnected = !!alive;
        if (isAntigravityConnected !== prev) {
          if (isAntigravityConnected) {
            showCustomSpeechBubble('✦ 反重力已连接！主人今天想写点什么代码喵？', '#2563eb');
            try { ipcRenderer.send('pet-request-quota'); } catch (_) {}
          } else if (hasShownInitialGreeting) {
            showCustomSpeechBubble('✦ 反重力已退出，进入待机摸鱼模式~ (ฅ^ω^ฅ)', '#64748b');
            setAgentWorking(false);
          }
          hasShownInitialGreeting = true;
          render();
        }
      });

      ipcRenderer.on('pet-key-press', function () {
        handleKeyPress();
      });
      ipcRenderer.on('pet-call-attention', function () {
        try {
          img.classList.remove('gpet-jelly');
          void img.offsetWidth;
          img.classList.add('gpet-jelly');
          playRelease();
          showCustomSpeechBubble('✦ 主人，我在这里喵！(ฅ^ω^ฅ)', '#38bdf8');
        } catch (_) {}
      });
      ipcRenderer.on('pet-quota-update', function (e, data) {
        updateQuotaState(data);
      });
      ipcRenderer.on('pet-agent-work-state', function (e, isWorking) {
        setAgentWorking(isWorking);
      });
      ipcRenderer.on('pet-turn-cost', function (e, data) {
        if (data && (data.amount !== undefined || data.isLive)) {
          showCostBubble(data.amount, data.unit || 'tokens', !!data.isLive);
        }
      });
      ipcRenderer.on('pet-apply-scale', function (e, s) {
        if (s !== undefined && Math.abs(Number(s) - state.scale) > 0.05) {
          setScale(s, true);
        }
      });
      ipcRenderer.on('pet-apply-volume', function (e, vol) {
        if (vol !== undefined) {
          setVol(vol, true);
        }
      });
      ipcRenderer.on('pet-apply-config', function (e, c) {
        if (!c) return;
        if (c.scale !== undefined && Math.abs(Number(c.scale) - state.scale) > 0.05) {
          setScale(c.scale, true);
        }
        if (c.soundVol !== undefined) setVol(c.soundVol, true);
        if (c.soundSet) setSoundSet(c.soundSet);
        if (c.quotaView) setQuotaView(c.quotaView);
        if (c.bubbleOn !== undefined) setBubbleOn(c.bubbleOn);
        if (c.typingOn !== undefined) setTypingOn(c.typingOn);
        if (c.turnCostOn !== undefined) setTurnCostOn(c.turnCostOn);
        if (c.turnCostCloseMs !== undefined) setTurnCostClose(c.turnCostCloseMs / 1000);
        if (c.workStateMode) {
          workStateMode = c.workStateMode === 'working' ? 'chill' : c.workStateMode;
          if (workStateSelect) workStateSelect.value = workStateMode;
          syncSprite();
        }
        if (c.antigravitySyncMode) {
          antigravitySyncMode = c.antigravitySyncMode;
          if (antigravitySyncSelect) antigravitySyncSelect.value = antigravitySyncMode;
        }
      });
      ipcRenderer.on('pet-farewell-exit', function () {
        try {
          showCustomSpeechBubble('✦ 反重力已退出，桌宠同步退出喵~ 拜拜！', '#ef4444');
        } catch (_) {}
      });
      try {
        ipcRenderer.send('pet-request-antigravity-state');
        ipcRenderer.send('pet-request-quota');
        ipcRenderer.send('pet-request-agent-work-state');
      } catch (_) {}
      setInterval(function () {
        try {
          ipcRenderer.send('pet-request-antigravity-state');
          if (isAntigravityConnected) {
            ipcRenderer.send('pet-request-quota');
            ipcRenderer.send('pet-request-agent-work-state');
          }
        } catch (_) {}
      }, 30000);
    }

    // Initialize
    applySoundSet();
    setupHitTest();
    loadConfig();
    settle();
    updateBaseUnits();
    render();

    // Expose API on window for external triggers
    window.closePet = closePetEntirely;
    window.GeminiPetInstance = {
      close: closePetEntirely,
      showTurnCost: showCostBubble,
      showBubble: showBubble,
      hideBubble: hideBubble,
      toggleMenu: toggleMenu,
      updateQuota: updateQuotaState,
      setAgentWorking: setAgentWorking,
      setWorkStateMode: setWorkStateMode,
      setAntigravitySyncMode: setAntigravitySyncMode,
      setScale: setScale,
      refreshQuota: function (manual) {
        if (ipcRenderer) {
          ipcRenderer.send('pet-request-quota');
          ipcRenderer.send('pet-request-agent-work-state');
        }
        if (manual) {
          showBubble();
        }
      }
    };
    updateMousePassThrough(false);
    console.log('✦ Gemini 哈基米 (尺寸调节 & 纯净Gemini配额版) 已就绪！');
  } // end of initWidget

  initWidget();
})();
