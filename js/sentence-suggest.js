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

    /* ---------- Personal history (localStorage) ---------- */
    const HISTORY_KEY = 'stagecord_phrase_history';
    const HISTORY_MAX = 500;
    const MIN_PREFIX_LEN = 3;
    const MAX_SUGGESTIONS = 4;

    function getHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function saveHistory(list) {
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch {}
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
    function findSentenceStart(value) {
        if (!value) return 0;
        const breakers = ['. ', '! ', '? ', '\n'];
        let start = 0;
        for (const b of breakers) {
            const idx = value.lastIndexOf(b);
            if (idx > -1 && idx + b.length > start) {
                start = idx + b.length;
            }
        }
        return start;
    }

    function findMatches(value, limit) {
        if (!value) return [];
        const sentenceStart = findSentenceStart(value);
        const prefixRaw = value.slice(sentenceStart);
        const prefix = prefixRaw.trimStart();
        if (prefix.length < MIN_PREFIX_LEN) return [];
        const lowerPrefix = prefix.toLowerCase();
        const seen = new Set();
        const out = [];
        // Personal history first, then seed library
        const haystack = [...getHistory(), ...SEED_PHRASES];
        for (const phrase of haystack) {
            if (out.length >= limit) break;
            const lowerPhrase = phrase.toLowerCase();
            if (lowerPhrase === lowerPrefix) continue;       // skip exact matches
            if (!lowerPhrase.startsWith(lowerPrefix)) continue;
            if (seen.has(lowerPhrase)) continue;
            seen.add(lowerPhrase);
            out.push(phrase);
        }
        return out;
    }

    /* ---------- Dropdown UI ---------- */
    let activeDropdown = null;
    let activeTextarea = null;
    let activeMatches = [];
    let activeIndex = 0;

    function ensureDropdown() {
        if (activeDropdown) return activeDropdown;
        activeDropdown = document.createElement('div');
        activeDropdown.className = 'sentence-suggest';
        activeDropdown.setAttribute('role', 'listbox');
        activeDropdown.style.display = 'none';
        document.body.appendChild(activeDropdown);
        return activeDropdown;
    }

    function positionDropdown(textarea) {
        if (!activeDropdown) return;
        const rect = textarea.getBoundingClientRect();
        activeDropdown.style.position = 'fixed';
        activeDropdown.style.top = (rect.bottom + 6) + 'px';
        activeDropdown.style.left = rect.left + 'px';
        activeDropdown.style.width = Math.max(220, rect.width) + 'px';
    }

    function hideDropdown() {
        if (activeDropdown) activeDropdown.style.display = 'none';
        activeTextarea = null;
        activeMatches = [];
        activeIndex = 0;
    }

    function renderDropdown(textarea) {
        const matches = findMatches(textarea.value, MAX_SUGGESTIONS);
        activeMatches = matches;
        if (!matches.length) {
            hideDropdown();
            return;
        }
        if (activeIndex >= matches.length) activeIndex = 0;
        const dd = ensureDropdown();
        activeTextarea = textarea;
        dd.innerHTML = matches.map((phrase, i) => {
            const cls = i === activeIndex ? ' is-active' : '';
            const hint = i === activeIndex ? '<span class="sentence-suggest__hint">Tab</span>' : '';
            return `<div class="sentence-suggest__item${cls}" role="option" data-index="${i}">
                <span class="sentence-suggest__phrase">${escapeHtml(phrase)}</span>
                ${hint}
            </div>`;
        }).join('');
        dd.style.display = 'block';
        positionDropdown(textarea);
        // Click handlers via mousedown so focus isn't lost before we read the index
        dd.querySelectorAll('[data-index]').forEach((el) => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const i = parseInt(el.getAttribute('data-index'), 10);
                acceptMatch(i);
            });
            el.addEventListener('mousemove', () => {
                const i = parseInt(el.getAttribute('data-index'), 10);
                if (i !== activeIndex) {
                    activeIndex = i;
                    updateActiveRow();
                }
            });
        });
    }

    function updateActiveRow() {
        if (!activeDropdown) return;
        activeDropdown.querySelectorAll('[data-index]').forEach((el) => {
            const i = parseInt(el.getAttribute('data-index'), 10);
            el.classList.toggle('is-active', i === activeIndex);
            const hintHTML = i === activeIndex ? '<span class="sentence-suggest__hint">Tab</span>' : '';
            const existingHint = el.querySelector('.sentence-suggest__hint');
            if (i === activeIndex && !existingHint) {
                el.insertAdjacentHTML('beforeend', hintHTML);
            } else if (i !== activeIndex && existingHint) {
                existingHint.remove();
            }
        });
    }

    function acceptMatch(index) {
        const textarea = activeTextarea;
        if (!textarea) return;
        const phrase = activeMatches[index];
        if (!phrase) return;
        const value = textarea.value;
        const sentenceStart = findSentenceStart(value);
        const before = value.slice(0, sentenceStart);
        // Preserve any leading whitespace the user typed before the sentence
        const prefixRaw = value.slice(sentenceStart);
        const leadingWhitespace = prefixRaw.match(/^\s*/)?.[0] || '';
        textarea.value = before + leadingWhitespace + phrase;
        const end = textarea.value.length;
        try { textarea.setSelectionRange(end, end); } catch {}
        textarea.focus();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        hideDropdown();
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    /* ---------- Attaching to textareas ---------- */
    function attach(textarea) {
        if (!textarea) return;
        if (textarea.dataset.ssAttached === '1') return;
        if (textarea.hasAttribute('data-no-sentence-suggest')) return;
        if (textarea.disabled || textarea.readOnly) return;
        textarea.dataset.ssAttached = '1';

        textarea.addEventListener('input', () => renderDropdown(textarea));
        textarea.addEventListener('focus', () => renderDropdown(textarea));
        textarea.addEventListener('blur', () => {
            // Delay so a mousedown on a dropdown item can register first
            setTimeout(() => {
                if (activeTextarea === textarea) hideDropdown();
            }, 150);
        });
        textarea.addEventListener('click', () => renderDropdown(textarea));
        textarea.addEventListener('scroll', () => {
            if (activeTextarea === textarea) positionDropdown(textarea);
        });

        textarea.addEventListener('keydown', (e) => {
            if (!activeDropdown || activeDropdown.style.display === 'none' || activeTextarea !== textarea) return;
            if (activeMatches.length === 0) return;
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                acceptMatch(activeIndex);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = (activeIndex + 1) % activeMatches.length;
                updateActiveRow();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = (activeIndex - 1 + activeMatches.length) % activeMatches.length;
                updateActiveRow();
            } else if (e.key === 'Escape') {
                e.stopPropagation();
                hideDropdown();
            }
            // Enter stays as normal newline in textarea — don't intercept.
        });

        // Commit sent messages to history so suggestions personalize over time.
        function commit() {
            const v = textarea.value.trim();
            if (v) rememberPhrase(v);
        }
        const enclosingForm = textarea.closest('form');
        if (enclosingForm) {
            enclosingForm.addEventListener('submit', commit, { capture: true });
        }
        const composer = textarea.closest('.cm-composer, .inbox-thread__composer, .post-composer, .composer');
        if (composer) {
            composer.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                if (btn.classList.contains('emoji-trigger')) return;
                if (btn.type === 'button' || btn.type === 'submit') commit();
            }, { capture: true });
        }
    }

    function scan(root) {
        const node = root || document;
        node.querySelectorAll('textarea').forEach(attach);
    }

    function start() {
        scan(document);
        const obs = new MutationObserver((muts) => {
            for (const m of muts) {
                m.addedNodes.forEach((n) => {
                    if (!(n instanceof Element)) return;
                    if (n.matches?.('textarea')) attach(n);
                    else scan(n);
                });
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });

        // Reposition open dropdown on page scroll / resize
        window.addEventListener('scroll', () => {
            if (activeTextarea && activeDropdown && activeDropdown.style.display !== 'none') {
                positionDropdown(activeTextarea);
            }
        }, true);
        window.addEventListener('resize', () => {
            if (activeTextarea && activeDropdown && activeDropdown.style.display !== 'none') {
                positionDropdown(activeTextarea);
            }
        });
        // Hide on click outside both the textarea and the dropdown
        document.addEventListener('mousedown', (e) => {
            if (!activeDropdown || activeDropdown.style.display === 'none') return;
            if (activeDropdown.contains(e.target)) return;
            if (activeTextarea && activeTextarea.contains(e.target)) return;
            hideDropdown();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    window.STAGECORD = window.STAGECORD || {};
    window.STAGECORD.SentenceSuggest = {
        attach,
        scan,
        rememberPhrase,
        getHistory
    };
})();
