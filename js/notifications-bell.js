// Drops a bell icon into any .start-topbar__links nav and keeps an unread
// badge in sync. Loaded on every authenticated page.
(async function () {
    const sb = window.supabaseClient;
    if (!sb) return;

    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    const nav = document.querySelector('.start-topbar__links');
    if (!nav) return;

    if (nav.querySelector('.bell-link')) return;

    const bell = document.createElement('a');
    bell.href = '/notifications/';
    bell.className = 'start-topbar__link bell-link';
    bell.setAttribute('aria-label', 'Notifications');
    bell.style.position = 'relative';
    bell.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span class="bell-badge" hidden></span>
    `;

    if (!document.getElementById('bell-link-styles')) {
        const style = document.createElement('style');
        style.id = 'bell-link-styles';
        style.textContent = `
            .bell-link { display: inline-flex; align-items: center; gap: 6px; }
            .bell-badge {
                background: #FF6B6B; color: #FFFFFF;
                font-size: 10px; font-weight: 700;
                min-width: 16px; height: 16px; padding: 0 4px;
                border-radius: 999px;
                display: inline-flex; align-items: center; justify-content: center;
                line-height: 1;
            }
        `;
        document.head.appendChild(style);
    }

    nav.insertBefore(bell, nav.firstChild);

    const badge = bell.querySelector('.bell-badge');

    async function refresh() {
        const { count, error } = await sb
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id)
            .is('read_at', null);

        if (error) {
            console.warn('notifications-bell:', error.message);
            return;
        }

        if ((count || 0) > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.hidden = false;
        } else {
            badge.hidden = true;
        }
    }

    await refresh();
    setInterval(() => {
        if (!document.hidden) refresh();
    }, 30000);
})();
