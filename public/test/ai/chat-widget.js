/* chat-widget.js — 事務作業まるなげLP 埋め込みチャット */
(function () {
  'use strict';

  var MOUNT_SELECTOR = '[data-mn-chat]';
  var DEFAULT_ENDPOINT = '/test/ai/api/chat/stream';
  var MAX_LEN = 1000;
  var STYLE_ID = 'mn-chat-style';
  var CSS = [
    '[data-mn-chat-input]:focus{outline:none;border-color:#e8622c;box-shadow:0 0 0 3px rgba(232,98,44,.15)}',
    '[data-mn-chat-send]:hover{background:#ff7a3d}',
    '[data-mn-chat-send]:disabled{opacity:.45;cursor:default}',
    '[data-mn-chat-input]:disabled{background:#f4f6fa}',
    '.mn-dots span{display:inline-block;width:5px;height:5px;margin-right:3px;border-radius:50%;background:#8b96ad;animation:mn-blink 1.2s infinite}',
    '.mn-dots span:nth-child(2){animation-delay:.2s}.mn-dots span:nth-child(3){animation-delay:.4s}',
    '@keyframes mn-blink{0%,60%,100%{opacity:.25}30%{opacity:1}}'
  ].join('');

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function bubble(role) {
    var el = document.createElement('div');
    var base = 'max-width:88%;border-radius:12px;padding:10px 13px;font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word;';
    if (role === 'user') {
      el.style.cssText = 'align-self:flex-end;background:#0e1c33;color:#fff;' + base;
    } else if (role === 'error') {
      el.style.cssText = 'align-self:flex-start;background:#fff1ec;color:#b42318;border:1px solid #ffd6c8;' + base;
    } else {
      el.style.cssText = 'align-self:flex-start;background:#f0f3f8;color:#12233f;' + base;
    }
    return el;
  }

  function typingBubble() {
    var el = bubble('assistant');
    var dots = document.createElement('span');
    dots.className = 'mn-dots';
    for (var i = 0; i < 3; i++) dots.appendChild(document.createElement('span'));
    el.appendChild(dots);
    return el;
  }

  function init(root) {
    if (!root || root.dataset.mnBound === '1') return false;
    var log = root.querySelector('[data-mn-chat-log]');
    var input = root.querySelector('[data-mn-chat-input]');
    var send = root.querySelector('[data-mn-chat-send]');
    if (!log || !input || !send) return false;

    root.dataset.mnBound = '1';
    injectStyle();

    var endpoint = root.dataset.endpoint || DEFAULT_ENDPOINT;
    var busy = false;

    function scrollLog() { log.scrollTop = log.scrollHeight; }

    function autosize() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    }

    async function submit() {
      var text = input.value.trim();
      if (!text || busy) return;
      if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);

      input.value = '';
      autosize();
      busy = true;
      input.disabled = true;
      send.disabled = true;

      var userBubble = bubble('user');
      userBubble.textContent = text;
      log.appendChild(userBubble);
      var assistantBubble = typingBubble();
      log.appendChild(assistantBubble);
      scrollLog();

      var started = false;
      try {
        var res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ message: text })
        });
        if (!res.ok || !res.body) {
          var err = await res.json().catch(function () { return {}; });
          throw new Error(err.message || 'うまく送信できませんでした。少し時間を置いてもう一度お試しください。');
        }

        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';
        while (true) {
          var chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          var events = buffer.split('\n\n');
          buffer = events.pop() || '';
          for (var i = 0; i < events.length; i++) {
            var name = '';
            var data = '';
            var lines = events[i].split('\n');
            for (var j = 0; j < lines.length; j++) {
              if (lines[j].indexOf('event:') === 0) name = lines[j].slice(6).trim();
              if (lines[j].indexOf('data:') === 0) data += lines[j].slice(5).trim();
            }
            if (!data) continue;
            var obj;
            try { obj = JSON.parse(data); } catch (e) { continue; }
            if (name === 'delta' && obj.delta) {
              if (!started) {
                assistantBubble.textContent = '';
                started = true;
              }
              assistantBubble.textContent += obj.delta;
              scrollLog();
            }
            if (name === 'error') throw new Error(obj.message || 'うまく送信できませんでした。');
          }
        }
        if (!started) throw new Error('回答が届きませんでした。もう一度お試しください。');
      } catch (e) {
        var message = (e && e.message) || 'うまく送信できませんでした。';
        if (started) {
          var note = bubble('error');
          note.textContent = message;
          log.appendChild(note);
        } else {
          var errorBubble = bubble('error');
          errorBubble.textContent = message;
          assistantBubble.replaceWith(errorBubble);
        }
        scrollLog();
      } finally {
        busy = false;
        input.disabled = false;
        send.disabled = false;
        input.focus();
      }
    }

    send.addEventListener('click', submit);
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && event.metaKey) {
        event.preventDefault();
        submit();
      }
    });
    return true;
  }

  function initAll() {
    var roots = document.querySelectorAll(MOUNT_SELECTOR);
    for (var i = 0; i < roots.length; i++) init(roots[i]);
    return roots.length;
  }

  function boot() {
    initAll();
    var tries = 0;
    var timer = window.setInterval(function () {
      initAll();
      if (++tries >= 40) window.clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
