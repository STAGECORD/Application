// ============================================================
// localAsset — depth-aware path resolver
// ============================================================
// STAGECORD PRO - Main JavaScript

// Resolves an asset path that lives under "STAGECORD PRO/" from any page depth
// by counting how many directories below the project root the current page sits.
function localAsset(rel) {
    const segments = window.location.pathname.split('/').filter(Boolean);
    let baseIdx = -1;
    for (let i = segments.length - 1; i >= 0; i--) {
        if (decodeURIComponent(segments[i]) === 'STAGECORD PRO') { baseIdx = i; break; }
    }
    const depth = baseIdx === -1 ? Math.max(0, segments.length - 1) : segments.length - baseIdx - 2;
    return '../'.repeat(Math.max(0, depth)) + rel;
}

// ============================================================
// Universal name formatter, verified-badge, mention/hashtag linkifier,
// STAGECORD inline brand formatter — used by sidebar, topbar widgets,
// and many feature modules. Must be defined before any module that
// calls them.
// ============================================================

// ============================================================
// Universal name formatter
// ============================================================
// Every element with class "auto-name" gets its text rewritten so the
// FIRST word is bold and the remaining words are regular weight — matching
// the STAGECORD logo typography. Single-word names stay all bold.

function _scEscapeHtml(s) {
    return s.replace(/[&<>"']/g, function(ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
}

function formatNameElement(el) {
    if (!el || el.dataset.nameFormatted) return;
    const text = (el.textContent || '').trim();
    if (!text) return;
    const idx = text.indexOf(' ');
    if (idx === -1) {
        el.innerHTML = '<span class="name-bold">' + _scEscapeHtml(text) + '</span>';
    } else {
        const first = text.substring(0, idx);
        const rest = text.substring(idx);   // includes the leading space
        el.innerHTML =
            '<span class="name-bold">' + _scEscapeHtml(first) + '</span>' +
            '<span class="name-light">' + _scEscapeHtml(rest) + '</span>';
    }
    el.dataset.nameFormatted = '1';
}

function formatAllNames(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll('.auto-name').forEach(formatNameElement);
    injectVerifiedBadges(rootEl);
}

// ============================================================
// Verified artist badge
// ============================================================
// Auto-injects a small blue checkmark badge after every name that
// matches a verified artist. Hooks into formatAllNames so search
// dropdowns, dynamically-rendered comments, and notification rows
// all pick up the badge as they're rendered. Hard-coded list for
// the demo; in production this would come from the user record.
const VERIFIED_USERS = [
    'JokesmithJohnson',
    'Jokesmith Johnson',
    'Anchi Humifuku',
    'Maya Thompson',
    'DJ Frostbite',
    'Lars Vognsen',
    'Sara Holm',
    'Tobias Krogh',
    'Frederik Holm',
    'Emilie Bach'
];

const VERIFIED_LOOKUP = {};
VERIFIED_USERS.forEach(function(n) { VERIFIED_LOOKUP[n.toLowerCase()] = true; });

function isVerifiedName(name) {
    if (!name) return false;
    return VERIFIED_LOOKUP[name.trim().toLowerCase()] === true;
}

// ============================================================
// Auto-linkify @mentions and #hashtags in post + comment bodies
// ============================================================
const MENTION_HASHTAG_SELECTORS = '.artist-post__text, .artist-comment__body, .artist-post__author, .artist-bio__text';

function _linkifyTextNode(node) {
    const text = node.nodeValue;
    if (!text || (text.indexOf('@') === -1 && text.indexOf('#') === -1)) return;
    // Escape HTML special chars, then wrap matches
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const replaced = escaped
        .replace(/@([A-Za-z][A-Za-z0-9_]{1,30})/g, '<a href="#" class="mention" data-mention="$1">@$1</a>')
        .replace(/(^|\s)#([A-Za-z][A-Za-z0-9_]{1,30})/g, '$1<a href="#" class="hashtag" data-hashtag="$2">#$2</a>');
    if (replaced === escaped) return;
    const wrap = document.createElement('span');
    wrap.innerHTML = replaced;
    node.parentNode.replaceChild(wrap, node);
}

function linkifyMentionsAndTags(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll(MENTION_HASHTAG_SELECTORS).forEach(function(el) {
        if (el.dataset.linkified === '1') return;
        // Walk text nodes inside the element (skip nested anchors/spans we've already processed)
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
            acceptNode: function(node) {
                if (node.parentNode && (node.parentNode.classList.contains('mention') || node.parentNode.classList.contains('hashtag'))) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        const textNodes = [];
        let n;
        while ((n = walker.nextNode())) textNodes.push(n);
        textNodes.forEach(_linkifyTextNode);
        el.dataset.linkified = '1';
    });
}

function injectVerifiedBadges(rootEl) {
    if (!rootEl) return;
    const selectors = '.auto-name, .collaborator-name, .artist-post__author, .reward-card__name, .approval-row__name';
    rootEl.querySelectorAll(selectors).forEach(function(el) {
        // The sidebar profile-name shows the role identity; it does not need
        // a verified-badge there since the artist cover already shows one.
        if (el.closest('.sidebar-profile')) return;
        if (el.querySelector(':scope > .verified-badge')) return;
        // Pull the visible text without any badge SVG
        const text = el.textContent.replace(/[\u2713\u2714]/g, '').trim();
        if (!isVerifiedName(text)) return;
        const badge = document.createElement('span');
        badge.className = 'verified-badge';
        badge.setAttribute('aria-label', 'Verified');
        badge.setAttribute('title', 'Verified artist on STAGECORD');
        badge.setAttribute('data-help', 'Verified artist: STAGECORD har bekræftet at denne profil er den ægte vare — ingen impersonators eller fake-konti.');
        badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 12 10 17 19 7"/></svg>';
        el.appendChild(badge);
    });
}

// ============================================================
// STAGECORD inline brand formatter
// ============================================================
// Walks text nodes inside the given root element and replaces every
// occurrence of "STAGECORD" or "STAGECORDPRO" (case-insensitive) with
// styled <span>s so the brand always renders with the correct logo
// typography — even when typed by users in comments or input.
// Skips text inside the logo itself, scripts, styles, and elements
// already formatted (so we don't double-wrap on re-runs).

const SC_EXCLUDE_SELECTOR = '.logo, .signup-topbar__logo, .sc-stage, .sc-cord, .sc-pro, script, style, textarea, input';

function formatStagecord(rootEl) {
    if (!rootEl) return;
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            const p = node.parentElement;
            if (!p) return NodeFilter.FILTER_REJECT;
            if (p.closest(SC_EXCLUDE_SELECTOR)) return NodeFilter.FILTER_REJECT;
            return /STAGECORD/i.test(node.nodeValue)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_SKIP;
        }
    });
    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    // Brand consolidated on plain "STAGECORD" — no PRO suffix.
    const RE = /(STAGECORD)/gi;
    textNodes.forEach(function(textNode) {
        const text = textNode.nodeValue;
        if (!RE.test(text)) return;
        RE.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        let m;
        while ((m = RE.exec(text)) !== null) {
            if (m.index > lastIndex) {
                frag.appendChild(document.createTextNode(text.substring(lastIndex, m.index)));
            }
            const wrap = document.createElement('span');
            const stage = document.createElement('span');
            stage.className = 'sc-stage';
            stage.textContent = 'STAGE';
            const cord = document.createElement('span');
            cord.className = 'sc-cord';
            cord.textContent = 'CORD';
            wrap.appendChild(stage);
            wrap.appendChild(cord);
            if (m[0].length === 12) {           // STAGECORDPRO
                const pro = document.createElement('span');
                pro.className = 'sc-pro';
                pro.textContent = 'PRO';
                wrap.appendChild(pro);
            }
            frag.appendChild(wrap);
            lastIndex = m.index + m[0].length;
        }
        if (lastIndex < text.length) {
            frag.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        textNode.parentNode.replaceChild(frag, textNode);
    });
}

// STAGECORD PRO — core utilities (SC namespace, formatters, escapers)
// Loaded first by every page so all other modules can rely on window.SC.

// ============================================================
// SC — shared utility namespace
// ============================================================
// Single source of truth for utilities that were previously duplicated
// across 30+ IIFE modules: HTML escaping, number formatting, modal
// open/close + Esc/click-outside handling. Modules opt in via a
// one-line alias (`const escapeHtml = SC.escapeHtml;`) so existing
// internal calls keep working while the implementation lives once.
window.SC = (function() {
    const HTML_ESCAPE_MAP = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' };

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
            return HTML_ESCAPE_MAP[c];
        });
    }

    // Same logic — separate name keeps grep-ability when reading code.
    // Used in the `<tag attr="...">` context.
    function escapeAttr(s) { return escapeHtml(s); }

    function formatBytes(b) {
        if (!b) return '0 KB';
        if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
        return (b / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function fmtDuration(sec) {
        if (!sec || !isFinite(sec) || sec < 0) return '—';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec - m * 60);
        return m + ':' + (s < 10 ? '0' + s : s);
    }

    // Parse a number out of a string like "♥ 384" or "12.4K" or "2.1M".
    // Returns 0 when no number is found — never throws.
    function parseShortNumber(str) {
        if (typeof str === 'number') return str;
        const s = String(str || '').replace(/,/g, '');
        const m = s.match(/([\d.]+)\s*([KMB])?/i);
        if (!m) return 0;
        const n = parseFloat(m[1]);
        const suffix = (m[2] || '').toUpperCase();
        if (suffix === 'K') return Math.round(n * 1000);
        if (suffix === 'M') return Math.round(n * 1000000);
        if (suffix === 'B') return Math.round(n * 1000000000);
        return Math.round(n);
    }

    function formatShort(n) {
        n = Number(n) || 0;
        if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M';
        if (n >= 10000)   return (n / 1000).toFixed(0) + 'K';
        if (n >= 1000)    return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return String(n);
    }

    // ---------- Modal helper ----------
    // Wires up the open-class toggle, Esc handling, and click-outside-
    // backdrop close pattern that every modal in the app needs. Returns
    // { open, close, isOpen } so the consumer never has to repeat the
    // boilerplate.
    //
    //   const m = SC.Modal.bind(document.getElementById('myModal'), {
    //       closeSelector: '[data-close-my]',   // selector for inner close-buttons
    //       onOpen:  () => { … },                // optional
    //       onClose: () => { … }                 // optional
    //   });
    //   m.open(); m.close(); m.isOpen();
    //
    // Multiple modals share the same singleton Esc-handler, so we don't
    // attach 30 separate keydown listeners on document. The most recently
    // opened modal closes first when Esc is pressed.
    const MODAL_STACK = [];
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        // Pop the topmost open modal off the stack and close it.
        for (let i = MODAL_STACK.length - 1; i >= 0; i--) {
            const m = MODAL_STACK[i];
            if (m.el && m.el.classList.contains('open')) {
                e.stopPropagation();
                m.close();
                return;
            }
        }
    });

    function bindModal(el, opts) {
        if (!el) return { open: function() {}, close: function() {}, isOpen: function() { return false; } };
        opts = opts || {};
        const closeSel = opts.closeSelector;
        const onOpen   = opts.onOpen;
        const onClose  = opts.onClose;

        function open() {
            el.classList.add('open');
            el.setAttribute('aria-hidden', 'false');
            if (onOpen) try { onOpen(); } catch (e) {}
        }

        function close() {
            el.classList.remove('open');
            el.setAttribute('aria-hidden', 'true');
            if (onClose) try { onClose(); } catch (e) {}
        }

        function isOpen() { return el.classList.contains('open'); }

        // Wire close-buttons + click-outside on the modal element itself.
        el.addEventListener('click', function(e) {
            if (closeSel && e.target.closest(closeSel)) {
                e.preventDefault();
                close();
                return;
            }
            // Click on the overlay/backdrop (not bubbled from inside) closes.
            if (e.target === el) close();
        });

        const handle = { el: el, open: open, close: close, isOpen: isOpen };
        MODAL_STACK.push(handle);
        return handle;
    }

    return {
        escapeHtml: escapeHtml,
        escapeAttr: escapeAttr,
        formatBytes: formatBytes,
        fmtDuration: fmtDuration,
        parseShortNumber: parseShortNumber,
        formatShort: formatShort,
        Modal: { bind: bindModal }
    };
})();
