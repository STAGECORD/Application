// STAGECORD PRO — topbar widgets
// Bell (notifications), Inbox dropdown, QR-befriend button, and Stage badge
// are all injected into the topbar on every page that has a help-button.

// ============================================================
// Notifications — bell button + dropdown injected into every topbar
// ============================================================
(function() {
    // Prototype notifications. In production these would come from a feed.
    const NOTIFICATIONS = [
        { id: 'n1',  unread: true,  icon: '🎟', text: 'Your <strong>Late Cellar Set</strong> Online Concert Pass is live now — start watching.',                            time: '2 min ago',  href: 'streaming/song/index.html' },
        { id: 'n2',  unread: true,  icon: '✓',  text: '<strong>RUST</strong> accepted your pitch for <strong>30 November</strong> — confirmation sent.',                  time: '38 min ago', href: 'pitch/index.html' },
        { id: 'n3',  unread: true,  icon: '👥', text: '<strong class="auto-name">Tara Park</strong> invited you to <strong>Synthwave Crew</strong> entourage.',          time: '2 hours ago', href: 'entourage/index.html' },
        { id: 'n4',  unread: false, icon: '★',  text: '<strong class="auto-name">Jokesmith Johnson</strong> just dropped a new bit — <em>"Late Cellar Set"</em>.',         time: '5 hours ago', href: 'streaming/song/index.html' },
        { id: 'n5',  unread: false, icon: '↗',  text: '<strong class="auto-name">Line Rasmussen</strong> reposted your <em>VEGA</em> photo to her followers.',           time: 'Yesterday',  href: 'fan/index.html' },
        { id: 'n6',  unread: false, icon: '🎵', text: '<strong class="auto-name">Anchi Humifuku</strong> released the remix of <em>Manhattan Rain</em>.',                  time: '2 days ago', href: 'streaming/index.html' },
        { id: 'n7',  unread: false, icon: '💸', text: 'Royalty payout sent — <strong>2,148 DKK</strong> for last month’s streams.',                                  time: '3 days ago', href: 'sales/index.html' },
        { id: 'n8',  unread: false, icon: '🎤', text: '<strong class="auto-name">Maya Thompson</strong> tagged you in a co-write session.',                              time: '4 days ago', href: 'inbox/index.html' }
    ];

    function unreadCount() {
        return NOTIFICATIONS.filter(function(n) { return n.unread; }).length;
    }

    function injectStyles() {
        if (document.querySelector('link[href*="notifications.css"]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = localAsset('css/notifications.css');
        document.head.appendChild(link);
    }

    function buildBell() {
        const bell = document.createElement('button');
        bell.type = 'button';
        bell.className = 'topbar-notify';
        bell.setAttribute('aria-label', 'Notifications');
        bell.setAttribute('data-help', 'Notifikations-bjælde: Opslag fra venner, billet-køb, pitch-svar og platform-aktivitet samles her. Klik for at åbne listen.');
        bell.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 21a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

        const c = unreadCount();
        if (c > 0) {
            const badge = document.createElement('span');
            badge.className = 'topbar-notify__count';
            badge.textContent = c > 9 ? '9+' : String(c);
            bell.appendChild(badge);
        }
        return bell;
    }

    function buildPanel() {
        const panel = document.createElement('div');
        panel.className = 'topbar-notify-panel';
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Notifications');

        const items = NOTIFICATIONS.slice(0, 6).map(function(n) {
            return '<a class="topbar-notify-item' + (n.unread ? ' topbar-notify-item--unread' : '') +
                   '" href="' + localAsset(n.href) + '">' +
                       '<span class="topbar-notify-item__icon">' + n.icon + '</span>' +
                       '<div class="topbar-notify-item__main">' +
                           n.text +
                           '<span class="topbar-notify-item__time">' + n.time + '</span>' +
                       '</div>' +
                   '</a>';
        }).join('');

        panel.innerHTML =
            '<header class="topbar-notify-panel__head">' +
                '<h3 class="topbar-notify-panel__title">Notifications</h3>' +
                '<button type="button" class="topbar-notify-panel__mark-read">Mark all read</button>' +
            '</header>' +
            '<div class="topbar-notify-panel__list">' + items + '</div>' +
            '<footer class="topbar-notify-panel__footer">' +
                '<a href="' + localAsset('notifications/index.html') + '">View all notifications →</a>' +
            '</footer>';
        return panel;
    }

    document.addEventListener('DOMContentLoaded', function() {
        const helpBtn = document.querySelector('.topbar .help-button');
        if (!helpBtn) return;            // some pages don't have the topbar (e.g. start)
        if (document.querySelector('.topbar-notify')) return; // already injected

        injectStyles();
        const bell = buildBell();
        helpBtn.parentNode.insertBefore(bell, helpBtn);

        const panel = buildPanel();
        document.body.appendChild(panel);
        formatAllNames(panel);

        bell.addEventListener('click', function(e) {
            e.stopPropagation();
            // Close the inbox panel if it happens to be open so only one
            // dropdown is ever visible at a time.
            const inboxPanel = document.querySelector('.topbar-inbox-panel');
            if (inboxPanel && !inboxPanel.hidden) inboxPanel.hidden = true;
            panel.hidden = !panel.hidden;
        });
        document.addEventListener('click', function(e) {
            if (!panel.hidden && !panel.contains(e.target) && e.target !== bell) {
                panel.hidden = true;
            }
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !panel.hidden) panel.hidden = true;
        });

        const markBtn = panel.querySelector('.topbar-notify-panel__mark-read');
        if (markBtn) {
            markBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                panel.querySelectorAll('.topbar-notify-item--unread').forEach(function(el) {
                    el.classList.remove('topbar-notify-item--unread');
                });
                const badge = bell.querySelector('.topbar-notify__count');
                if (badge) badge.remove();
            });
        }
    });
})();

// ============================================================
// Inbox — chat icon + dropdown injected into every topbar (right of bell)
// ============================================================
// Replaces the previous left-sidebar Inbox entry. Shows recent
// conversations in a quick dropdown; "View all messages →" links to
// the full inbox page.
(function() {
    const CONVERSATIONS = [
        { id: 'c1', unread: true,  initials: 'JF', color: '#FF6A55', name: 'Jeremy Freedom',   preview: 'Got the new master mix back from Winston — sounds huge.', time: '12 min ago', href: 'inbox/index.html' },
        { id: 'c2', unread: true,  initials: 'MT', color: '#FF8AC8', name: 'Maya Thompson',    preview: 'Let me know if the topline I sent works for the bridge.',   time: '1 hr ago',   href: 'inbox/index.html' },
        { id: 'c3', unread: true,  initials: 'WS', color: '#7DD3C0', name: 'Winston Sinclair', preview: 'Stem v3 uploaded — louder vox, tighter low end.',           time: '3 hrs ago',  href: 'inbox/index.html' },
        { id: 'c4', unread: false, initials: 'RT', color: '#A370F0', name: 'RUST (venue)',     preview: 'Confirmed for 30 Nov. PDF sent over.',                       time: 'Yesterday',  href: 'inbox/index.html' },
        { id: 'c5', unread: false, initials: 'TP', color: '#FFB547', name: 'Tara Park',        preview: 'Are you down to add backing vox on the Eternaty hook?',     time: '2 days ago', href: 'inbox/index.html' },
        { id: 'c6', unread: false, initials: 'AH', color: '#4A90E2', name: 'Anchi Humifuku',   preview: 'Mate, that drum loop is unreal — we should collab.',       time: '4 days ago', href: 'inbox/index.html' }
    ];

    function unreadCount() {
        return CONVERSATIONS.filter(function(c) { return c.unread; }).length;
    }

    function buildButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'topbar-notify topbar-inbox';
        btn.setAttribute('aria-label', 'Inbox');
        btn.setAttribute('data-help', 'Inbox: Beskeder fra samarbejdspartnere, venues og fans. Klik for at se de seneste samtaler — eller åbn fuld inbox via linket nederst i panelet.');
        // Chat-bubble icon, sized to match the bell visually.
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none">' +
                '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8A2.5 2.5 0 0 1 17.5 17H10l-4 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5v-8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
                '<path d="M8 9.5h8M8 12.5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
            '</svg>';

        const c = unreadCount();
        if (c > 0) {
            const badge = document.createElement('span');
            badge.className = 'topbar-notify__count';
            badge.textContent = c > 9 ? '9+' : String(c);
            btn.appendChild(badge);
        }
        return btn;
    }

    function buildPanel() {
        const panel = document.createElement('div');
        panel.className = 'topbar-notify-panel topbar-inbox-panel';
        panel.hidden = true;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Inbox');

        const items = CONVERSATIONS.slice(0, 6).map(function(c) {
            return '<a class="topbar-notify-item topbar-inbox-item' + (c.unread ? ' topbar-notify-item--unread' : '') +
                   '" href="' + localAsset(c.href) + '">' +
                       '<span class="topbar-inbox-item__avatar" style="background:' + c.color + ';">' + c.initials + '</span>' +
                       '<div class="topbar-notify-item__main">' +
                           '<div class="topbar-inbox-item__name">' + c.name + '</div>' +
                           '<div class="topbar-inbox-item__preview">' + c.preview + '</div>' +
                           '<span class="topbar-notify-item__time">' + c.time + '</span>' +
                       '</div>' +
                   '</a>';
        }).join('');

        panel.innerHTML =
            '<header class="topbar-notify-panel__head">' +
                '<h3 class="topbar-notify-panel__title">Inbox</h3>' +
                '<button type="button" class="topbar-notify-panel__mark-read">Mark all read</button>' +
            '</header>' +
            '<div class="topbar-notify-panel__list">' + items + '</div>' +
            '<footer class="topbar-notify-panel__footer">' +
                '<a href="' + localAsset('inbox/index.html') + '">View all messages →</a>' +
            '</footer>';
        return panel;
    }

    document.addEventListener('DOMContentLoaded', function() {
        const helpBtn = document.querySelector('.topbar .help-button');
        if (!helpBtn) return;
        if (document.querySelector('.topbar-inbox')) return;

        const button = buildButton();
        // Place the inbox icon to the right of the bell, before the help (?)
        // button. The bell module also inserts before help, so by the time
        // we run, the bell is already there — we just insert before help
        // again, which puts the inbox to the right of the bell.
        helpBtn.parentNode.insertBefore(button, helpBtn);

        const panel = buildPanel();
        document.body.appendChild(panel);
        if (typeof formatAllNames === 'function') formatAllNames(panel);

        button.addEventListener('click', function(e) {
            e.stopPropagation();
            // Close the notifications panel if it's open.
            const notifyPanel = document.querySelector('.topbar-notify-panel:not(.topbar-inbox-panel)');
            if (notifyPanel && !notifyPanel.hidden) notifyPanel.hidden = true;
            panel.hidden = !panel.hidden;
        });
        document.addEventListener('click', function(e) {
            if (!panel.hidden && !panel.contains(e.target) && e.target !== button && !button.contains(e.target)) {
                panel.hidden = true;
            }
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !panel.hidden) panel.hidden = true;
        });

        const markBtn = panel.querySelector('.topbar-notify-panel__mark-read');
        if (markBtn) {
            markBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                panel.querySelectorAll('.topbar-notify-item--unread').forEach(function(el) {
                    el.classList.remove('topbar-notify-item--unread');
                });
                const badge = button.querySelector('.topbar-notify__count');
                if (badge) badge.remove();
            });
        }
    });
})();

// ============================================================
// QR-befriend topbar button — global access to "show your QR"
// ============================================================
// QR-befriend is for the user's own profile (so others can scan and
// send a friend request). It belongs in the topbar next to the bell
// and inbox, not on the artist page. This module injects the trigger
// button on every page that has the topbar, and lazily injects the
// shared QR modal markup if the page does not already include it.
(function() {
    const SELF = { name: 'Jokesmith Johnson', handle: '@jokesmithjohnson' };

    function buildButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'topbar-notify topbar-qr';
        btn.setAttribute('aria-label', 'Show your friend-add QR code');
        btn.setAttribute('data-qr-trigger', '');
        btn.setAttribute('data-qr-name', SELF.name);
        btn.setAttribute('data-qr-handle', SELF.handle);
        btn.setAttribute('data-help', 'QR-befriend: Vis din egen QR-kode så fans og venner kan scanne den IRL og sende dig en venneanmodning uden at skulle skrive dit handle. Klik også for at scanne andres.');
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none">' +
                '<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
                '<path d="M15 15h2v2h-2zM19 15h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z" fill="currentColor"/>' +
            '</svg>';
        return btn;
    }

    function injectModalIfMissing() {
        if (document.getElementById('qrBefriendModal')) return;
        // Ensure the modal stylesheet is loaded — most pages outside artist/fan
        // don't include qr-befriend.css explicitly.
        if (!document.querySelector('link[href*="qr-befriend.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = localAsset('css/qr-befriend.css');
            document.head.appendChild(link);
        }
        if (!document.querySelector('link[href*="pitch-modals.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = localAsset('css/pitch-modals.css');
            document.head.appendChild(link);
        }
        const wrap = document.createElement('div');
        wrap.innerHTML =
            '<div class="release-modal-overlay" id="qrBefriendModal" data-qr-modal aria-hidden="true" role="dialog" aria-modal="true">' +
                '<div class="release-modal release-modal--qr">' +
                    '<header class="release-modal__header">' +
                        '<h2 class="release-modal__title">Befriend via QR</h2>' +
                        '<button type="button" class="release-modal__close" data-close-qr aria-label="Close">&times;</button>' +
                    '</header>' +
                    '<div class="release-modal__body">' +
                        '<div class="qr-modal__tabs" role="tablist">' +
                            '<button type="button" class="qr-modal__tab is-active" data-qr-tab="show" role="tab">Show mine</button>' +
                            '<button type="button" class="qr-modal__tab" data-qr-tab="scan" role="tab">Scan theirs</button>' +
                        '</div>' +
                        '<div data-qr-panel="show">' +
                            '<p class="qr-modal__intro">Vis din QR til en ven eller fan du møder IRL. Når de scanner med deres telefon-kamera, åbnes <strong data-qr-name>—</strong>\'s profil med en pre-fyldt friend-request klar.</p>' +
                            '<div class="qr-modal__code" data-qr-code></div>' +
                            '<div class="qr-modal__url" data-qr-url>—</div>' +
                            '<p class="qr-modal__hint">Tip: Vis QR\'en på din telefon på koncerter, festivaler eller meet-and-greets. Hurtigere end at skrive brugernavnet.</p>' +
                        '</div>' +
                        '<div data-qr-panel="scan" hidden>' +
                            '<p class="qr-modal__intro">Hold telefonen op foran en andens QR-kode. Vi kan også åbne kameraet direkte hvis du har givet adgang i indstillingerne.</p>' +
                            '<div class="qr-modal__scan-area">' +
                                '<strong>📷 Camera scan area</strong><br>' +
                                '<small>(Demo: brug din enheds normale kamera-app for at scanne en QR — den åbner automatisk profilen i STAGECORD-appen.)</small>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<footer class="release-modal__actions">' +
                        '<button type="button" class="release-modal__btn" data-close-qr>Close</button>' +
                    '</footer>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap.firstChild);
    }

    document.addEventListener('DOMContentLoaded', function() {
        const helpBtn = document.querySelector('.topbar .help-button');
        if (!helpBtn) return;
        if (document.querySelector('.topbar-qr')) return;

        injectModalIfMissing();

        const button = buildButton();
        // Insert before the help (?) button so QR sits to the right of the
        // bell + inbox icons (which also insertBefore help).
        helpBtn.parentNode.insertBefore(button, helpBtn);
    });
})();
