/* Chat widget. Works instantly with built-in answers about Christian (no key,
   no network). Visitors can optionally add a Gemini key for free-form AI replies;
   the key lives in sessionStorage only. */
(() => {
  'use strict';

  // Gemini model used for replies. Change here if Google retires or renames it.
  const GEMINI_MODEL = 'gemini-2.5-flash';
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const PERSONA = `You are Christian's AI twin — a digital clone of Christian, a Computer Science student from Zamboanga, Philippines who builds personal projects and joins hackathons and small competitions like Hack4Gov. You speak in first person as if you ARE Christian.

Your background:
- I'm still a student: I build personal projects, join hackathons and small competitions (e.g. Hack4Gov), and I'm learning as I go. I don't claim professional or work experience
- I'm exploring web development, Java applications, and mobile apps
- My skills include: JavaScript, React, React Native, Java, MySQL, Firebase, HTML/CSS, Node.js, Python
- I'm interested in AI/ML, cloud, and building intuitive user experiences

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

  /* ── built-in knowledge (mirrors what the page says) ── */
  const KB = [
    { id: 'hi', keys: ['hi', 'hello', 'hey', 'yo', 'sup', 'kumusta', 'good morning', 'good evening'],
      a: "Hi! I'm Christian, a CS student in Zamboanga. Ask me about my projects, skills, hackathons, or how to reach me." },
    { id: 'about', keys: ['who', 'about', 'yourself', 'introduce', 'tell me about', 'background', 'student', 'study', 'school', 'university', 'course', 'ateneo'],
      a: "I'm Christian, a Computer Science student at Ateneo de Zamboanga University in Zamboanga City. I learn by building: personal projects, hackathons and small competitions like Hack4Gov.",
      links: [['About', '#about']] },
    { id: 'competitions', keys: ['hack4gov', 'hackathon', 'competition', 'contest', 'compete', 'award', 'won', 'win'],
      a: "I join hackathons and small competitions such as Hack4Gov. They're where I practice building something useful under a deadline, working with a team and presenting it." },
    { id: 'projects', keys: ['project', 'projects', 'built', 'build', 'work', 'portfolio', 'made', 'make', 'showcase'],
      a: "Featured projects:\n• Sari-Sari Store System (Java, MySQL, Swing)\n• Brick Breaker (Java game)\n• Disaster Prep App (React Native + Firebase)\n\nThere are smaller ones too, like a Student System, Grade Calculator and this site.",
      links: [['See projects', '#projects']] },
    { id: 'sari', keys: ['sari', 'store', 'inventory', 'sales'],
      a: "Sari-Sari Store System is a Java + MySQL + Swing desktop app for inventory and sales management: stock tracking, sales reports and a simple interface for a small store.", links: [['See projects', '#projects']] },
    { id: 'brick', keys: ['brick', 'breaker', 'game', 'games'],
      a: "Brick Breaker is a classic arcade-style Java game with physics, destructible bricks, a scoring system and sound effects.", links: [['See projects', '#projects']] },
    { id: 'disaster', keys: ['disaster', 'prep', 'mobile', 'react native', 'firebase', 'app'],
      a: "Disaster Prep App is a React Native + Firebase mobile app with preparedness checklists, location alerts and resource guides.", links: [['See projects', '#projects']] },
    { id: 'grade', keys: ['grade', 'calculator', 'student system', 'crud'],
      a: "Two student-focused tools: a Grade Calculator (weighted final grades with what-if scenarios) and a Student System (CRUD web app with search, filters and CSV export). Both are in the project list.", links: [['More projects', '#opensource']] },
    { id: 'skills', keys: ['skill', 'skills', 'tech', 'stack', 'language', 'languages', 'know', 'tools', 'framework', 'javascript', 'java', 'python', 'react', 'mysql', 'php', 'node'],
      a: "What I work with: JavaScript, React, React Native, Java, MySQL, Firebase, HTML/CSS, Node.js and Python. I'm still learning and widening that list as I build more.", links: [['About', '#about']] },
    { id: 'experience', keys: ['experience', 'job', 'intern', 'internship', 'professional', 'employed', 'years', 'senior', 'hire', 'hiring', 'available', 'freelance', 'opportunity', 'opportunities'],
      a: "I'm still a student, so no professional experience yet. What I can show is personal projects and competition work. I'm open to internships, collaborations and learning opportunities. Email me!", links: [['Contact', '#contact']] },
    { id: 'interests', keys: ['interest', 'interests', 'passion', 'ai', 'ml', 'machine learning', 'cloud', 'love', 'like', 'hobby', 'hobbies', 'data'],
      a: "I'm interested in building useful web and mobile apps, plus AI/ML, cloud and data analysis. I like projects that solve a real problem for real people." },
    { id: 'location', keys: ['where', 'location', 'live', 'from', 'zamboanga', 'philippines', 'city', 'based'],
      a: "I'm based in Zamboanga City, Philippines." },
    { id: 'contact', keys: ['contact', 'email', 'reach', 'message', 'linkedin', 'github', 'connect', 'collaborate', 'collab', 'talk'],
      a: "The best way to reach me is the Contact section: email or LinkedIn. I reply to collaboration ideas, internship leads and questions about my projects.", links: [['Contact', '#contact']] },
    { id: 'thanks', keys: ['thanks', 'thank you', 'salamat', 'ty', 'appreciate'],
      a: "You're welcome! Anything else you'd like to know?" },
    { id: 'bye', keys: ['bye', 'goodbye', 'see you', 'later'],
      a: "Thanks for stopping by! Have a great day." },
  ];
  const CHIPS = ['What projects have you built?', 'What are your skills?', 'Tell me about Hack4Gov', 'How can I contact you?'];
  const FALLBACK = "I don't have an answer to that yet. I can tell you about my projects, skills, competitions, background or how to contact me. For anything else, email me!";

  const tokens = (t) => t.toLowerCase().replace(/[^a-z0-9+#\s]/g, ' ').replace(/\s+/g, ' ').trim();
  function localReply(text) {
    const t = ' ' + tokens(text) + ' ';
    let best = null, bestScore = 0;
    for (const e of KB) {
      let score = 0;
      for (const k of e.keys) {
        if (t.includes(' ' + k + ' ')) score += k.includes(' ') ? 3 : 2;
        else if (k.length > 4 && t.includes(k)) score += 1;
      }
      if (score > bestScore) { best = e; bestScore = score; }
    }
    return bestScore >= 2 ? best : null;
  }

  /* ── DOM ── */
  const $ = (id) => document.getElementById(id);
  const toggle = $('chatToggle'), widget = $('chatWidget'), body = $('chatBody');
  const input = $('chatInput'), send = $('chatSend');
  const setup = $('apiKeySetup'), keyInput = $('apiKeyInput'), saveKey = $('saveApiKey'), cancelKey = $('cancelApiKey');
  const footer = $('chatFooter'), chips = $('chatChips'), modeLabel = $('chatMode'), modeBtn = $('chatModeBtn');
  if (!toggle || !widget) return;

  const storage = {
    get: () => { try { return sessionStorage.getItem('gemini_key') || ''; } catch { return ''; } },
    set: (v) => { try { sessionStorage.setItem('gemini_key', v); } catch { /* memory only */ } },
  };
  let apiKey = storage.get();
  const history = [];
  let busy = false;

  function setOpen(open) {
    widget.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) { greet(); setTimeout(() => (setup.hidden ? input : keyInput).focus(), 280); }
  }
  toggle.addEventListener('click', () => setOpen(!widget.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && widget.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
  });

  function addMessage(who, text, links) {
    const msg = document.createElement('div');
    msg.className = `chat-msg ${who}`;
    msg.textContent = text;
    if (links && links.length) {
      const row = document.createElement('div'); row.style.marginTop = '8px';
      links.forEach(([label, href], i) => {
        const a = document.createElement('a'); a.href = href; a.textContent = `${label} →`;
        a.addEventListener('click', () => setOpen(false));
        if (i) row.append(' · ');
        row.append(a);
      });
      msg.append(row);
    }
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  function setTyping(on) {
    const existing = $('typingIndicator');
    if (!on) { existing?.remove(); return; }
    if (existing) return;
    const t = document.createElement('div');
    t.className = 'typing'; t.id = 'typingIndicator';
    t.setAttribute('aria-label', 'Christian is typing');
    t.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(t); body.scrollTop = body.scrollHeight;
  }

  function greet() {
    if (body.children.length) return;
    addMessage('bot', "Hey! I'm Christian. Ask me about my projects, skills or competitions, or tap a question below.");
    CHIPS.forEach((q) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = q;
      b.addEventListener('click', () => { ask(q); });
      chips.appendChild(b);
    });
  }

  function renderMode() {
    const ai = Boolean(apiKey);
    modeLabel.textContent = ai ? 'Gemini AI mode' : 'Quick answers about Christian';
    modeBtn.textContent = ai ? 'Switch to quick answers' : 'Use Gemini AI (optional)';
  }
  function showSetup(show) {
    setup.hidden = !show;
    body.hidden = chips.hidden = footer.hidden = show;
    if (show) keyInput.focus(); else input.focus();
  }
  modeBtn.addEventListener('click', () => {
    if (apiKey) { apiKey = ''; storage.set(''); renderMode(); addMessage('bot', 'Back to quick answers.'); }
    else showSetup(true);
  });
  cancelKey.addEventListener('click', () => showSetup(false));

  function submitKey() {
    const key = keyInput.value.trim();
    if (!key.startsWith('AIza') || key.length < 20) {
      keyInput.classList.add('is-invalid');
      setTimeout(() => keyInput.classList.remove('is-invalid'), 1200);
      return;
    }
    apiKey = key; storage.set(key); keyInput.value = '';
    renderMode(); showSetup(false);
    addMessage('bot', 'AI mode on. Ask me anything. If it fails, I fall back to quick answers.');
  }
  saveKey.addEventListener('click', submitKey);
  keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitKey(); });

  async function geminiReply(text) {
    const turn = { role: 'user', parts: [{ text }] };
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
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
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error('Empty reply');
    history.push(turn, { role: 'model', parts: [{ text: reply }] });
    return reply;
  }

  function answerLocally(text) {
    const hit = localReply(text);
    addMessage('bot', hit ? hit.a : FALLBACK, hit ? hit.links : [['Contact', '#contact']]);
  }

  async function ask(text) {
    text = text.trim();
    if (!text || busy) return;
    chips.hidden = true;
    addMessage('user', text);
    input.value = ''; input.style.height = 'auto';
    busy = true; send.disabled = true; setTyping(true);
    try {
      if (apiKey) {
        try {
          const reply = await geminiReply(text);
          setTyping(false); addMessage('bot', reply);
        } catch (err) {
          console.error('Gemini error:', err);
          setTyping(false);
          if (/API key|API_KEY_INVALID/i.test(err.message)) {
            apiKey = ''; storage.set(''); renderMode();
            addMessage('bot', "That API key didn't work, so I switched back to quick answers.");
          }
          answerLocally(text);
        }
      } else {
        await new Promise((r) => setTimeout(r, 450 + Math.random() * 350));
        setTyping(false); answerLocally(text);
      }
    } finally {
      busy = false; send.disabled = false; setTyping(false);
      if (setup.hidden) input.focus();
    }
  }

  send.addEventListener('click', () => ask(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 100)}px`;
  });

  renderMode();
})();
