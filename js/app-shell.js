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
        { label: 'Home', href: '/welcome/', help: 'Home — your personal feed and the place to compose new posts. Activity from people and artists you follow lands here.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg>` },
        { label: 'Inbox', href: '/inbox/', help: 'Inbox — direct messages with other artists and members. Unread count is shown as a badge on this nav item.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-7z"/></svg>` },
        { label: 'Notifications', href: '/notifications/', help: 'Notifications — follows, likes, comments, replies and project additions, newest first. The bell badge counts unread items.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>` },
        { label: 'Members', href: '/members/', help: 'Members — discover everyone on STAGECORD. Search by name or @-handle and click a card to open the public profile.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>` },
        { label: 'Tracks', href: '/tracks/', help: 'Tracks — upload and manage your published music. Each track can be added to a project, a playlist, or your public profile.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`, artistOnly: true },
        { label: 'Playlists', href: '/playlists/', help: 'Playlists — curated lists of tracks. Build them around moods, genres or sessions and share them on your public profile.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.5"/><circle cx="3.5" cy="12" r="1.5"/><circle cx="3.5" cy="18" r="1.5"/></svg>` },
        { label: 'Projects', href: '/projects/', help: 'Projects — collaboration spaces with other artists. Manage uploads, finals, royalty splits and release approvals from one card per project.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7h6l2 3h12v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z"/><path d="M2 7V5a2 2 0 0 1 2-2h4l2 3"/></svg>`, artistOnly: true },
        { label: 'Events', href: '/events/', help: 'Events — gigs, releases and live streams you\'re planning. Each event you publish appears on your public profile.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`, artistOnly: true },
        { label: 'Profile', href: '/profile/', help: 'Profile — edit your forename, surname, @-handle, bio, role, avatar and cover image. Changes flow to your public /u/-page.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>` },
        { label: 'Settings', href: '/settings/', help: 'Settings — your display preferences (currency) and other account-wide options. Changes here are private to your account.', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>` }
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
            .select('forename, surname, username, avatar_url, role')
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
            <a class="app-sidebar__me" href="${escapeHtml(meHref)}" data-help="Your identity card — shows your avatar and name. Click to jump straight to your public profile (/u/your-handle).">
                ${meAvatarHtml}
                <div class="app-sidebar__me-text">
                    <div class="app-sidebar__me-name">${meNameHtml}</div>
                </div>
            </a>

            <nav class="app-sidebar__nav">
                ${NAV.filter((n) => !n.artistOnly || isArtist).map((n) => `
                    <a class="app-sidebar__nav-item${isActive(n.href) ? ' is-active' : ''}" href="${n.href}" data-nav-slug="${escapeHtml(n.label.toLowerCase())}" data-help="${escapeHtml(n.help || '')}">
                        ${n.icon}
                        <span>${escapeHtml(n.label)}</span>
                        ${n.label === 'Notifications' ? '<span class="nav-badge" data-app-bell hidden></span>' : ''}
                        ${n.label === 'Inbox' ? '<span class="nav-badge" data-app-inbox hidden></span>' : ''}
                    </a>
                `).join('')}
            </nav>

            <div class="app-sidebar__spacer"></div>

            <button class="app-sidebar__signout" id="appSignOut" data-help="Sign out of STAGECORD. Your session ends and you're returned to the marketing page.">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Sign out</span>
            </button>
        </aside>

        <header class="app-topbar">
            <a class="app-topbar__logo" href="/welcome/" data-help="STAGECORD logo — click to return to your home feed from anywhere on the platform.">
                <span><span class="logo-stage">STAGE</span><span class="logo-cord">CORD</span></span>
                <span class="app-topbar__beta">Beta</span>
            </a>
            <div class="app-topbar__search" data-help="Global search — find people, tracks, posts, projects and playlists in one go. Press Enter to see all results.">
                <svg class="app-topbar__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
                </svg>
                <input
                    type="text"
                    class="app-topbar__search-input"
                    placeholder="Search people, tracks, projects, playlists…"
                    aria-label="Search"
                    autocomplete="off"
                    spellcheck="false"
                    data-search-input>
                <button type="button" class="app-topbar__search-clear" aria-label="Clear search" data-search-clear hidden>&times;</button>
                <div class="app-topbar__search-dropdown" data-search-dropdown hidden></div>
            </div>
            <div class="app-topbar__actions">
                <button type="button" class="help-button" aria-label="Help mode" aria-pressed="false" data-help="Help mode: Click the ? then click any labelled element to see what it does. Click ? again or press Esc to turn help off.">
                    <span class="help-mark">?</span>
                </button>
            </div>
        </header>
    `;
    // keep page title in <title> tag even though we removed the visible label
    if (topbarTitle) {
        document.title = topbarTitle.includes('STAGECORD')
            ? topbarTitle
            : `${topbarTitle} · STAGECORD`;
    }

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

    // Expose for pages that want to update the title later
    window.STAGECORD_AppShell = {
        setTitle(title) {
            // Visible title was replaced by search bar — keep API alive by setting document.title
            if (title) document.title = `${title} · STAGECORD`;
        },
        refreshBadges
    };

    // ===========================================================
    // Global search — topbar dropdown
    // ===========================================================
    (function initSearchBar() {
        const wrap = slot.querySelector('[data-search-input]')?.closest('.app-topbar__search');
        if (!wrap) return;
        const input = wrap.querySelector('[data-search-input]');
        const clearBtn = wrap.querySelector('[data-search-clear]');
        const dropdown = wrap.querySelector('[data-search-dropdown]');

        const TYPE_LABEL = {
            person: 'People',
            track: 'Tracks',
            post: 'Posts',
            project: 'Projects',
            playlist: 'Playlists'
        };
        const TYPE_ORDER = ['person', 'track', 'project', 'playlist', 'post'];
        const TOP_PER_TYPE = 3;

        let lastQuery = '';
        let debounceTimer = null;
        let inFlight = 0;

        function escapeAttr(s) {
            return String(s || '').replace(/[<>&"']/g, (c) => ({
                '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
            }[c]));
        }

        function initialAvatar(name) {
            const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
            return `<div class="sb-result__avatar sb-result__avatar--initial">${escapeAttr(letter)}</div>`;
        }

        function avatarFor(r) {
            if (r.image_url) {
                return `<div class="sb-result__avatar" style="background-image:url('${escapeAttr(r.image_url)}');"></div>`;
            }
            return initialAvatar(r.title);
        }

        function renderDropdown(query, rows) {
            if (!query) {
                dropdown.hidden = true;
                dropdown.innerHTML = '';
                return;
            }
            const grouped = {};
            for (const r of rows || []) {
                if (!grouped[r.result_type]) grouped[r.result_type] = [];
                if (grouped[r.result_type].length < TOP_PER_TYPE) grouped[r.result_type].push(r);
            }

            const sections = TYPE_ORDER
                .filter((t) => grouped[t] && grouped[t].length)
                .map((t) => {
                    const items = grouped[t].map((r) => `
                        <a class="sb-result" href="${escapeAttr(r.href || '#')}" data-search-result>
                            ${avatarFor(r)}
                            <div class="sb-result__text">
                                <div class="sb-result__title">${escapeAttr(r.title || '')}</div>
                                <div class="sb-result__subtitle">${escapeAttr(r.subtitle || '')}</div>
                            </div>
                        </a>
                    `).join('');
                    return `
                        <div class="sb-section">
                            <div class="sb-section__label">${TYPE_LABEL[t] || t}</div>
                            ${items}
                        </div>
                    `;
                }).join('');

            const hasAny = sections.length > 0;
            const seeAllHref = `/search/?q=${encodeURIComponent(query)}`;
            dropdown.innerHTML = `
                ${hasAny ? sections : `<div class="sb-empty">No results for “${escapeAttr(query)}”.</div>`}
                <a class="sb-seeall" href="${escapeAttr(seeAllHref)}">See all results for “${escapeAttr(query)}” →</a>
            `;
            dropdown.hidden = false;
        }

        async function runSearch(q) {
            const myToken = ++inFlight;
            try {
                const { data, error } = await sb.rpc('global_search', {
                    p_query: q,
                    p_per_type_limit: TOP_PER_TYPE
                });
                if (error) {
                    console.warn('global_search failed:', error);
                    return;
                }
                if (myToken !== inFlight) return; // stale
                renderDropdown(q, data || []);
            } catch (e) {
                console.warn('search error', e);
            }
        }

        input.addEventListener('input', () => {
            const q = input.value.trim();
            clearBtn.hidden = !q;
            if (q === lastQuery) return;
            lastQuery = q;
            clearTimeout(debounceTimer);
            if (!q) {
                renderDropdown('', []);
                return;
            }
            debounceTimer = setTimeout(() => runSearch(q), 180);
        });

        input.addEventListener('focus', () => {
            if (input.value.trim() && dropdown.innerHTML) {
                dropdown.hidden = false;
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = input.value.trim();
                if (q) window.location.href = `/search/?q=${encodeURIComponent(q)}`;
            } else if (e.key === 'Escape') {
                input.value = '';
                clearBtn.hidden = true;
                renderDropdown('', []);
                input.blur();
            }
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.hidden = true;
            renderDropdown('', []);
            input.focus();
        });

        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) dropdown.hidden = true;
        });

        // Cmd/Ctrl+K to focus search
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                input.focus();
                input.select();
            }
        });
    })();

    // ===========================================================
    // Help mode — click "?" to activate, then HOVER any element
    // with [data-help] to see its explanation. The banner in the
    // top-right doubles as the live tooltip: its text updates to
    // whatever the cursor is on. No separate floating tooltip means
    // no z-index / overflow / focus races with page CSS.
    // ===========================================================
    const helpButton = document.querySelector('.help-button');
    if (helpButton && !document.querySelector('.help-banner')) {
        const defaultMsg = 'HELP MODE ON — hover anything outlined to see what it does. Esc to exit.';

        const banner = document.createElement('div');
        banner.className = 'help-banner is-default';
        banner.textContent = defaultMsg;
        document.body.appendChild(banner);

        let helpActive = false;

        function setHelpActive(on) {
            helpActive = on;
            document.body.classList.toggle('help-mode', on);
            helpButton.classList.toggle('is-active', on);
            helpButton.setAttribute('aria-pressed', on ? 'true' : 'false');
            if (!on) resetBanner();
        }
        function resetBanner() {
            banner.classList.add('is-default');
            banner.textContent = defaultMsg;
        }
        function showHelpFor(el) {
            const text = el.getAttribute('data-help');
            if (!text) return;
            banner.classList.remove('is-default');
            banner.innerHTML = `<span class="help-banner__label">What this does</span>${escapeHtml(text)}`;
        }

        helpButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setHelpActive(!helpActive);
        });

        document.addEventListener('mouseover', (e) => {
            if (!helpActive) return;
            const target = e.target.closest && e.target.closest('[data-help]');
            if (!target || target === helpButton || banner.contains(target)) return;
            showHelpFor(target);
        });
        document.addEventListener('mouseout', (e) => {
            if (!helpActive) return;
            const leaving = e.target.closest && e.target.closest('[data-help]');
            if (!leaving) return;
            const next = e.relatedTarget;
            if (next && (leaving.contains(next) || (next.closest && next.closest('[data-help]')))) return;
            resetBanner();
        });

        // Suppress clicks on the page while help mode is on so users
        // don't accidentally trigger actions (eg. expand a pill).
        document.addEventListener('click', (e) => {
            if (!helpActive) return;
            if (helpButton.contains(e.target)) return;
            if (banner.contains(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
        }, true);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && helpActive) setHelpActive(false);
        });
    }
})();
