// Renders the shared sidebar + topbar shell on every authenticated page.
// Pages opt in by adding <body class="app-body"> and a single empty
// <div data-app-shell></div> placeholder right after <body>.
(async function () {
    const sb = window.supabaseClient;
    if (!sb) return;

    const slot = document.querySelector('[data-app-shell]');
    if (!slot) return;

    const publicAllowed = slot.hasAttribute('data-public-allowed');

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        if (publicAllowed) return; // page handles its own logged-out layout
        window.location.href = '/login/';
        return;
    }
    const user = session.user;

    // Switch body styling to app-body so layout offsets kick in.
    if (!document.body.classList.contains('app-body')) {
        document.body.classList.add('app-body');
    }
    document.body.classList.remove('start-body');
    // Hide marketing fallback bits when shell takes over.
    document.querySelectorAll('[data-public-only]').forEach((el) => { el.style.display = 'none'; });

    function escapeHtml(s) {
        return String(s).replace(/[<>&"']/g, (c) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    const NAV = [
        { label: 'Home', href: '/welcome/', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg>` },
        { label: 'Inbox', href: '/inbox/', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-7z"/></svg>` },
        { label: 'Notifications', href: '/notifications/', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>` },
        { label: 'Members', href: '/members/', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>` },
        { label: 'Tracks', href: '/tracks/', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`, artistOnly: true },
        { label: 'Playlists', href: '/playlists/', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.5"/><circle cx="3.5" cy="12" r="1.5"/><circle cx="3.5" cy="18" r="1.5"/></svg>` },
        { label: 'Projects', href: '/projects/', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7h6l2 3h12v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z"/><path d="M2 7V5a2 2 0 0 1 2-2h4l2 3"/></svg>`, artistOnly: true },
        { label: 'Events', href: '/events/', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`, artistOnly: true },
        { label: 'Profile', href: '/profile/', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>` }
    ];

    const path = window.location.pathname.replace(/\/+$/, '/') || '/';
    function isActive(href) {
        const h = href.replace(/\/+$/, '/');
        if (h === '/welcome/') return path === '/welcome/' || path === '/welcome';
        return path.startsWith(h);
    }

    // Attempt to load profile for sidebar identity card
    let profile = null;
    try {
        const { data } = await sb
            .from('profiles')
            .select('forename, surname, username, avatar_url')
            .eq('id', user.id)
            .single();
        profile = data;
    } catch (_) { /* fine without */ }

    const userRole = profile?.role || 'fan';
    const isArtist = userRole === 'artist';
    const fore = profile?.forename || '';
    const sur = profile?.surname || '';
    const fullNameFallback = [fore, sur].filter(Boolean).join(' ')
        || profile?.username
        || user.email
        || 'You';
    // First name on its own line in bold, surname on the next line in light.
    const meNameHtml = fore
        ? `<strong>${escapeHtml(fore)}</strong>${sur ? `<br><span class="app-sidebar__me-surname">${escapeHtml(sur)}</span>` : ''}`
        : escapeHtml(fullNameFallback);
    const initial = (fore[0] || fullNameFallback[0] || '?').toUpperCase();
    const meAvatarHtml = profile?.avatar_url
        ? `<div class="app-sidebar__me-avatar" style="background-image:url('${escapeHtml(profile.avatar_url)}');"></div>`
        : `<div class="app-sidebar__me-avatar">${escapeHtml(initial)}</div>`;
    const meHref = profile?.username ? `/u/${encodeURIComponent(profile.username)}` : '/profile/';

    const topbarTitle = slot.getAttribute('data-page-title') || '';

    slot.innerHTML = `
        <aside class="app-sidebar" data-app-sidebar>
            <a class="app-sidebar__me" href="${escapeHtml(meHref)}">
                ${meAvatarHtml}
                <div class="app-sidebar__me-text">
                    <div class="app-sidebar__me-name">${meNameHtml}</div>
                </div>
            </a>

            <nav class="app-sidebar__nav">
                ${NAV.filter((n) => !n.artistOnly || isArtist).map((n) => `
                    <a class="app-sidebar__nav-item${isActive(n.href) ? ' is-active' : ''}" href="${n.href}" data-nav-slug="${escapeHtml(n.label.toLowerCase())}">
                        ${n.icon}
                        <span>${escapeHtml(n.label)}</span>
                        ${n.label === 'Notifications' ? '<span class="nav-badge" data-app-bell hidden></span>' : ''}
                        ${n.label === 'Inbox' ? '<span class="nav-badge" data-app-inbox hidden></span>' : ''}
                    </a>
                `).join('')}
            </nav>

            <div class="app-sidebar__spacer"></div>

            <button class="app-sidebar__signout" id="appSignOut">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Sign out</span>
            </button>
        </aside>

        <header class="app-topbar">
            <a class="app-topbar__logo" href="/welcome/">
                <span><span class="logo-stage">STAGE</span><span class="logo-cord">CORD</span></span>
                <span class="app-topbar__beta">Beta</span>
            </a>
            <div class="app-topbar__title">${escapeHtml(topbarTitle)}</div>
            <div class="app-topbar__actions"></div>
        </header>
    `;

    document.getElementById('appSignOut').addEventListener('click', async () => {
        await sb.auth.signOut();
        window.location.href = '/';
    });

    // Notification + inbox badges — poll periodically
    const bellBadge = slot.querySelector('[data-app-bell]');
    const inboxBadge = slot.querySelector('[data-app-inbox]');

    async function refreshBadges() {
        try {
            const { count: notifCount } = await sb
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .is('read_at', null);
            if (bellBadge) {
                if ((notifCount || 0) > 0) {
                    bellBadge.textContent = notifCount > 99 ? '99+' : String(notifCount);
                    bellBadge.hidden = false;
                } else {
                    bellBadge.hidden = true;
                }
            }
        } catch (_) { /* ignore */ }

        try {
            const { data: convos } = await sb.rpc('get_my_conversations');
            const totalUnread = (convos || []).reduce((sum, c) => sum + (Number(c.unread_count) || 0), 0);
            if (inboxBadge) {
                if (totalUnread > 0) {
                    inboxBadge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
                    inboxBadge.hidden = false;
                } else {
                    inboxBadge.hidden = true;
                }
            }
        } catch (_) { /* ignore */ }
    }

    refreshBadges();
    setInterval(() => { if (!document.hidden) refreshBadges(); }, 30000);

    // Expose for pages that want to update the topbar title later
    window.STAGECORD_AppShell = {
        setTitle(title) {
            const el = document.querySelector('.app-topbar__title');
            if (el) el.textContent = title;
        },
        refreshBadges
    };
})();
