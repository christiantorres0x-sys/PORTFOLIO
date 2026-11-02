/* "AI twin" chat widget. Calls the Gemini API directly from the browser using
   a key the visitor pastes in (kept in sessionStorage only). */
(() => {
  'use strict';

  // Gemini model used for replies. Change here if Google retires or renames it.
  const GEMINI_MODEL = 'gemini-2.5-flash';
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const PERSONA = `You are Christian's AI twin — a digital clone of Christian, a 2nd-year Computer Science student and full-stack developer from Zamboanga, Philippines. You speak in first person as if you ARE Christian.

Your background:
- I'm a CS student with 3+ years of hands-on experience and 20+ completed projects
- I specialize in full-stack web development, Java applications, and mobile apps
- My skills include: JavaScript, React, React Native, Java, MySQL, Firebase, HTML/CSS, Node.js, Python
- I'm passionate about AI/ML, cloud development, and building intuitive user experiences

My key projects:
1. Sari-Sari Store System — Java, MySQL, Swing — inventory & sales management
2. Brick Breaker Game — Java game dev with physics and scoring
3. Disaster Prep App — React Native + Firebase mobile app for disaster preparedness
4. Portfolio Website — the very site this chat is on
5. Student System — CRUD web app
6. Component Library, REST API Boilerplate, and more on GitHub

My personality:
- Friendly, enthusiastic, and professional
- I love talking about tech, especially web dev and AI
- I use casual but articulate language — like a real dev chatting
- I'm always eager to collaborate or discuss opportunities

IMPORTANT RULES:
- Always respond as CHRISTIAN in first person ("I built...", "My approach is...", "I love working with...")
- Keep responses conversational and concise (2-4 sentences usually)
- If asked about something you don't know, say something like "That's not something I've covered yet, but feel free to email me and I'll get back to you!"
- Never break character`;

  const $ = (id) => document.getElementById(id);
  const toggle = $('chatToggle'), widget = $('chatWidget'), body = $('chatBody');
  const input = $('chatInput'), send = $('chatSend');
  const setup = $('apiKeySetup'), keyInput = $('apiKeyInput'), saveKey = $('saveApiKey');
  const footer = $('chatFooter'), hint = $('chatHint');
  if (!toggle || !widget) return;

  const storage = {
    get: () => { try { return sessionStorage.getItem('gemini_key') || ''; } catch { return ''; } },
    set: (v) => { try { sessionStorage.setItem('gemini_key', v); } catch { /* storage blocked: key lives in memory only */ } },
  };

  let apiKey = storage.get();
  const history = [];
  let busy = false;

  function setOpen(open) {
    widget.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) setTimeout(() => (apiKey ? input : keyInput).focus(), 280);
  }

  toggle.addEventListener('click', () => setOpen(!widget.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && widget.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
  });

  function render() {
    const ready = Boolean(apiKey);
    setup.hidden = ready;
    body.hidden = footer.hidden = hint.hidden = !ready;
    if (ready && !body.children.length) {
      addMessage('bot', "Hey! 👋 I'm Christian's AI twin. Ask me about my projects, skills, or what it's like studying CS in Zamboanga!");
    }
  }

  function addMessage(who, text) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${who}`;
    msg.textContent = text;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  function setTyping(on) {
    const existing = $('typingIndicator');
    if (!on) { existing?.remove(); return; }
    if (existing) return;
    const t = document.createElement('div');
    t.className = 'typing';
    t.id = 'typingIndicator';
    t.setAttribute('aria-label', 'Christian is typing');
    t.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(t);
    body.scrollTop = body.scrollHeight;
  }

  function submitKey() {
    const key = keyInput.value.trim();
    if (!key.startsWith('AIza') || key.length < 20) {
      keyInput.classList.add('is-invalid');
      setTimeout(() => keyInput.classList.remove('is-invalid'), 1200);
      return;
    }
    apiKey = key;
    storage.set(key);
    keyInput.value = '';
    render();
    input.focus();
  }
  saveKey.addEventListener('click', submitKey);
  keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitKey(); });

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || busy) return;

    addMessage('user', text);
    input.value = '';
    input.style.height = 'auto';
    busy = true;
    send.disabled = true;
    setTyping(true);

    const turn = { role: 'user', parts: [{ text }] };

    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        // Key goes in a header, not the URL, so it never lands in logs or history.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: PERSONA }] },
          contents: [...history, turn],
          generationConfig: { maxOutputTokens: 300, temperature: 0.85 },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Request failed (${res.status})`);
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Hmm, I didn't quite catch that. Could you rephrase?";

      // Only successful exchanges enter the history, so a failure never leaves
      // two user turns in a row (which the API rejects).
      history.push(turn, { role: 'model', parts: [{ text: reply }] });
      setTyping(false);
      addMessage('bot', reply);
    } catch (err) {
      setTyping(false);
      const invalidKey = /API key|API_KEY_INVALID/i.test(err.message);
      if (invalidKey) {
        apiKey = '';
        storage.set('');
        addMessage('bot', "That API key doesn't seem to work. Please enter it again.");
        render();
      } else {
        addMessage('bot', `Something went wrong: ${err.message}`);
      }
      console.error('Gemini error:', err);
    } finally {
      busy = false;
      send.disabled = false;
      if (apiKey) input.focus();
    }
  }

  send.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 100)}px`;
  });

  render();
})();
