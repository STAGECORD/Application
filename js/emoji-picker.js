(function () {
    const EMOJIS = [
        // Smileys
        '😀','😃','😄','😁','😂','🤣','😊','😍','🥰','😘','😉','😎','🤔','😏','🥳','😭',
        // Hands & approval
        '👍','👎','👏','🙌','🙏','💪','✌️','🤘','🤞','👋','👌','🔥','❤️','💯','💜','💖',
        // Music & performance
        '🎵','🎶','🎸','🎤','🎧','🥁','🎹','🎷','🎺','🎻','🎼','🎙️','🎭','🎬','💃','🕺',
        // Misc / vibe
        '⭐','✨','🎉','🎊','🚀','💎','⚡','👀','🤝','🤩','😬','🙃'
    ];

    let popover = null;
    let activeTarget = null;
    let activeTrigger = null;

    function ensurePopover() {
        if (popover) return popover;
        popover = document.createElement('div');
        popover.className = 'emoji-popover';
        popover.setAttribute('role', 'dialog');
        popover.setAttribute('aria-label', 'Pick an emoji');
        popover.style.display = 'none';
        popover.innerHTML = EMOJIS.map((e) => `<button type="button" class="emoji-popover__btn" data-emoji="${e}" tabindex="-1">${e}</button>`).join('');
        document.body.appendChild(popover);

        popover.addEventListener('mousedown', (e) => {
            // Prevent the input from losing focus when clicking inside the popover
            e.preventDefault();
        });

        popover.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-emoji]');
            if (!btn) return;
            const emoji = btn.getAttribute('data-emoji');
            insertAtCursor(activeTarget, emoji);
        });

        document.addEventListener('click', (e) => {
            if (popover.style.display === 'none') return;
            if (popover.contains(e.target)) return;
            if (activeTrigger && activeTrigger.contains(e.target)) return;
            close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && popover.style.display !== 'none') close();
        });

        window.addEventListener('resize', () => {
            if (activeTrigger) positionPopover(activeTrigger);
        });

        return popover;
    }

    function positionPopover(trigger) {
        const rect = trigger.getBoundingClientRect();
        const POP_W = 260;
        const POP_H = 220;
        // Default: above the trigger, right-aligned to it
        let top = rect.top + window.scrollY - POP_H - 8;
        let left = rect.right + window.scrollX - POP_W;
        // If it would clip the top of the viewport, flip below
        if (top < window.scrollY + 8) {
            top = rect.bottom + window.scrollY + 8;
        }
        // Keep within left edge of viewport
        if (left < window.scrollX + 8) left = window.scrollX + 8;
        // Keep within right edge of viewport
        const maxLeft = window.scrollX + document.documentElement.clientWidth - POP_W - 8;
        if (left > maxLeft) left = maxLeft;

        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
    }

    function open(trigger, target) {
        ensurePopover();
        activeTrigger = trigger;
        activeTarget = target;
        popover.style.display = 'grid';
        positionPopover(trigger);
        trigger.setAttribute('aria-expanded', 'true');
    }

    function close() {
        if (!popover) return;
        popover.style.display = 'none';
        if (activeTrigger) activeTrigger.setAttribute('aria-expanded', 'false');
        activeTrigger = null;
        activeTarget = null;
    }

    function insertAtCursor(input, emoji) {
        if (!input) return;
        const isField = input.tagName === 'INPUT' || input.tagName === 'TEXTAREA';
        if (!isField) return;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const before = input.value.slice(0, start);
        const after = input.value.slice(end);
        input.value = before + emoji + after;
        const caret = start + emoji.length;
        try { input.setSelectionRange(caret, caret); } catch {}
        input.focus();
        // Notify any listeners (e.g. send button enable-on-input)
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function makeTriggerButton(opts) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-trigger' + (opts?.className ? ' ' + opts.className : '');
        btn.setAttribute('aria-label', 'Insert emoji');
        btn.setAttribute('aria-haspopup', 'dialog');
        btn.setAttribute('aria-expanded', 'false');
        btn.title = 'Insert emoji';
        btn.innerHTML = '<span aria-hidden="true">😊</span>';
        return btn;
    }

    function attach(trigger, target) {
        if (!trigger || !target) return;
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (activeTrigger === trigger && popover && popover.style.display !== 'none') {
                close();
            } else {
                open(trigger, target);
            }
        });
    }

    /* ---------- Auto-attach: wrap any [data-emoji-picker] or <textarea> with a floating 😊 button ---------- */

    const AUTO_SKIP_TYPES = new Set(['password', 'email', 'tel', 'url', 'search', 'number', 'date', 'time', 'datetime-local', 'month', 'week', 'color', 'hidden', 'file']);

    function shouldAutoAttach(el) {
        if (!el || el.dataset.emojiAttached === '1') return false;
        if (el.disabled || el.readOnly) return false;
        if (el.hasAttribute('data-no-emoji')) return false;
        const tag = el.tagName;
        if (tag === 'TEXTAREA') return true;
        if (tag === 'INPUT') {
            if (el.hasAttribute('data-emoji-picker')) {
                const type = (el.getAttribute('type') || 'text').toLowerCase();
                return !AUTO_SKIP_TYPES.has(type);
            }
            return false;
        }
        return false;
    }

    function attachFloating(field) {
        if (!shouldAutoAttach(field)) return;
        field.dataset.emojiAttached = '1';

        // Wrap the field in a relatively-positioned span/div so the button can be
        // absolutely positioned over its bottom-right corner. Block for textareas,
        // inline-block for inputs so existing flex layouts aren't disturbed too much.
        const isTextarea = field.tagName === 'TEXTAREA';
        const wrap = document.createElement('span');
        wrap.className = 'emoji-field-wrap' + (isTextarea ? ' emoji-field-wrap--block' : '');
        field.parentNode.insertBefore(wrap, field);
        wrap.appendChild(field);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-trigger emoji-trigger--floating';
        btn.setAttribute('aria-label', 'Insert emoji');
        btn.setAttribute('aria-haspopup', 'dialog');
        btn.setAttribute('aria-expanded', 'false');
        btn.title = 'Insert emoji';
        btn.innerHTML = '<span aria-hidden="true">😊</span>';
        wrap.appendChild(btn);

        attach(btn, field);
    }

    function scan(root) {
        const node = root || document;
        // Textareas (auto-included unless opted out)
        node.querySelectorAll('textarea').forEach(attachFloating);
        // Inputs that explicitly opt in
        node.querySelectorAll('input[data-emoji-picker]').forEach(attachFloating);
    }

    function startAutoAttach() {
        scan(document);
        const obs = new MutationObserver((muts) => {
            for (const m of muts) {
                m.addedNodes.forEach((n) => {
                    if (!(n instanceof Element)) return;
                    if (n.matches?.('textarea') || (n.matches?.('input') && n.hasAttribute('data-emoji-picker'))) {
                        attachFloating(n);
                    } else {
                        scan(n);
                    }
                });
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startAutoAttach);
    } else {
        startAutoAttach();
    }

    window.STAGECORD = window.STAGECORD || {};
    window.STAGECORD.EmojiPicker = {
        attach,
        makeTriggerButton,
        close,
        scan,
        attachFloating
    };
})();
