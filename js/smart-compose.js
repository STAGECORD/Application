(function () {
    /* ---------- Seed phrase library (Danish + English social/messaging phrases) ---------- */
    const SEED_PHRASES = [
        // Danish — greetings & questions
        "hvordan har du haft det i dag?",
        "hvordan har du haft det siden sidst?",
        "hvordan har du det?",
        "hvad sker der hos dig?",
        "hvad laver du?",
        "har du tid til en hurtig snak?",
        "kan vi snakke sammen?",
        "kan du sende mig",
        "hvornår passer det dig?",
        // Danish — replies / appreciation
        "tak for sidst",
        "tak for det!",
        "tak for invitationen",
        "tak fordi du delte",
        "det lyder rigtig godt",
        "det lyder spændende",
        "lad os tale sammen",
        "lad os finde en dag",
        "jeg er klar",
        "jeg er på!",
        "vi ses snart",
        "vi ses i morgen",
        "vi tales ved",
        "skriv endelig",
        "skriv hvis du har lyst",
        "skriv når du er klar",
        // Danish — work/creative
        "jeg arbejder lige nu på",
        "jeg er ved at lægge sidste hånd på",
        "har du lyst til at samarbejde?",
        "vil du være med på",
        "hvad synes du om",
        "hører gerne din mening",
        "siger du til når",
        "send det gerne over",
        "kan du sende det til mig?",

        // English — greetings & questions
        "how are you doing?",
        "how have you been?",
        "what's up?",
        "what have you been up to?",
        "do you have a minute?",
        "got a sec?",
        "can we hop on a quick call?",
        "when are you free?",
        "when works for you?",
        // English — replies / appreciation
        "thanks so much",
        "thanks for sharing",
        "thanks for the invite",
        "thanks for the heads up",
        "appreciate it!",
        "sounds great!",
        "sounds good to me",
        "looking forward to it",
        "let me know what you think",
        "let me know when you're ready",
        "let's catch up soon",
        "let's collab",
        "let's make it happen",
        "talk soon",
        "see you soon",
        "see you tomorrow",
        // English — work/creative
        "i'm working on",
        "i'm putting the finishing touches on",
        "want to collab on this?",
        "are you down for",
        "what do you think about",
        "would love your take on",
        "send it over whenever",
        "can you send me",
        "happy to help"
    ];

    /* ---------- Per-user history ---------- */
    const HISTORY_KEY = 'stagecord_sc_history';
    const HISTORY_MAX = 500;

    function getHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function saveHistory(list) {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
        } catch {}
    }

    function rememberPhrase(phrase) {
        if (!phrase) return;
        const clean = phrase.trim();
        if (clean.length < 6 || clean.length > 240) return;
        let history = getHistory();
        const lower = clean.toLowerCase();
        history = history.filter((p) => p.toLowerCase() !== lower);
        history.unshift(clean);
        if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
        saveHistory(history);
    }

    /* ---------- Suggestion matching ---------- */
    function findSuggestion(value) {
        if (!value) return '';
        // Locate the current "sentence" — text after the last sentence terminator or newline.
        const breakers = ['. ', '! ', '? ', '\n'];
        let sentenceStart = 0;
        for (const b of breakers) {
            const idx = value.lastIndexOf(b);
            if (idx > -1 && idx + b.length > sentenceStart) {
                sentenceStart = idx + b.length;
            }
        }
        const prefix = value.slice(sentenceStart);
        const trimmedPrefix = prefix.trimStart();
        if (trimmedPrefix.length < 3) return '';
        const lowerPrefix = trimmedPrefix.toLowerCase();

        // Personal history first (best context for this user), then the seed library.
        const haystack = [...getHistory(), ...SEED_PHRASES];
        for (const phrase of haystack) {
            const lowerPhrase = phrase.toLowerCase();
            if (lowerPhrase.startsWith(lowerPrefix) && phrase.length > trimmedPrefix.length) {
                return phrase.slice(trimmedPrefix.length);
            }
        }
        return '';
    }

    /* ---------- Inline ghost text via mirror overlay ---------- */
    const MIRROR_STYLES_TO_COPY = [
        'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
        'lineHeight', 'letterSpacing', 'wordSpacing',
        'whiteSpace', 'wordWrap', 'wordBreak',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
        'boxSizing',
        'textTransform', 'textIndent', 'textAlign',
        'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'
    ];

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function syncMirrorStyles(textarea, mirror) {
        const cs = window.getComputedStyle(textarea);
        for (const prop of MIRROR_STYLES_TO_COPY) {
            mirror.style[prop] = cs[prop];
        }
        // Match the textarea's actual rendered box
        mirror.style.borderColor = 'transparent';
        mirror.style.width = textarea.clientWidth + 'px';
        mirror.style.height = textarea.clientHeight + 'px';
    }

    function attachSmartCompose(textarea) {
        if (!textarea) return;
        if (textarea.dataset.scAttached === '1') return;
        if (textarea.hasAttribute('data-no-smart-compose')) return;
        if (textarea.disabled || textarea.readOnly) return;
        textarea.dataset.scAttached = '1';

        // The textarea may already be inside emoji-field-wrap (from emoji-picker.js).
        // We wrap a separate sc-wrap around it either way — the two wrappers nest fine.
        const wrap = document.createElement('span');
        wrap.className = 'sc-wrap';
        textarea.parentNode.insertBefore(wrap, textarea);
        wrap.appendChild(textarea);

        const mirror = document.createElement('div');
        mirror.className = 'sc-mirror';
        mirror.setAttribute('aria-hidden', 'true');
        wrap.insertBefore(mirror, textarea);

        const hint = document.createElement('div');
        hint.className = 'sc-hint';
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = 'Tab to complete';
        hint.style.display = 'none';
        wrap.appendChild(hint);

        let currentSuggestion = '';
        let suspended = false;

        function clearGhost() {
            currentSuggestion = '';
            mirror.innerHTML = '';
            hint.style.display = 'none';
        }

        function render() {
            if (suspended) return;
            syncMirrorStyles(textarea, mirror);
            mirror.scrollTop = textarea.scrollTop;
            const value = textarea.value;
            // Only suggest when cursor is at the end of the text
            const atEnd = textarea.selectionStart === value.length && textarea.selectionEnd === value.length;
            if (!atEnd) {
                clearGhost();
                return;
            }
            const suggestion = findSuggestion(value);
            if (!suggestion) {
                clearGhost();
                return;
            }
            currentSuggestion = suggestion;
            // Render the user's text invisibly so the ghost is positioned exactly where the
            // textarea's caret sits, then append the ghost in soft gray.
            mirror.innerHTML =
                '<span class="sc-mirror__text">' + escapeHtml(value) + '</span>' +
                '<span class="sc-ghost">' + escapeHtml(suggestion) + '</span>';
            hint.style.display = 'block';
        }

        textarea.addEventListener('input', render);
        textarea.addEventListener('click', render);
        textarea.addEventListener('keyup', (e) => {
            // Arrow keys / Home / End move the caret; re-evaluate
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {
                render();
            }
        });
        textarea.addEventListener('focus', render);
        textarea.addEventListener('blur', () => { clearGhost(); });
        textarea.addEventListener('scroll', () => { mirror.scrollTop = textarea.scrollTop; });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && currentSuggestion && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                const accepted = currentSuggestion;
                textarea.value = textarea.value + accepted;
                clearGhost();
                // Place caret at end
                const end = textarea.value.length;
                try { textarea.setSelectionRange(end, end); } catch {}
                // Notify any listeners (composer enable-on-input, etc.)
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (e.key === 'Escape' && currentSuggestion) {
                e.stopPropagation();
                clearGhost();
            }
        });

        // Remember sent messages so the personal history grows over time.
        // We listen on the enclosing form's submit, AND on click of any obvious "send/post/reply" button
        // sibling, since not every composer is a real <form>.
        function commitToHistory() {
            const v = textarea.value.trim();
            if (v) rememberPhrase(v);
        }
        const enclosingForm = textarea.closest('form');
        if (enclosingForm) {
            enclosingForm.addEventListener('submit', commitToHistory, { capture: true });
        }
        // Catch composers where the "send" is a button rather than form submit.
        const container = textarea.closest('.cm-composer, .inbox-thread__composer, .post-composer, .composer');
        if (container) {
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                if (btn.classList.contains('emoji-trigger')) return;
                if (btn.type === 'button' || btn.type === 'submit') commitToHistory();
            }, { capture: true });
        }

        // ResizeObserver keeps the mirror box in sync if the textarea changes size
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => { if (!suspended) syncMirrorStyles(textarea, mirror); });
            ro.observe(textarea);
        }

        // Initial paint
        render();
    }

    function scan(root) {
        const node = root || document;
        node.querySelectorAll('textarea').forEach(attachSmartCompose);
        node.querySelectorAll('input[data-smart-compose]').forEach((el) => {
            // Inputs opt-in. We don't wrap them with a mirror (single-line); we just
            // expose them to Tab-completion via a simpler ghost approach.
            attachSmartCompose(el);
        });
    }

    function startAuto() {
        scan(document);
        const obs = new MutationObserver((muts) => {
            for (const m of muts) {
                m.addedNodes.forEach((n) => {
                    if (!(n instanceof Element)) return;
                    if (n.matches?.('textarea') || n.matches?.('input[data-smart-compose]')) {
                        attachSmartCompose(n);
                    } else {
                        scan(n);
                    }
                });
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startAuto);
    } else {
        startAuto();
    }

    window.STAGECORD = window.STAGECORD || {};
    window.STAGECORD.SmartCompose = {
        attach: attachSmartCompose,
        scan,
        rememberPhrase,
        getHistory,
        // Internal helper exposed for debugging
        _findSuggestion: findSuggestion
    };
})();
