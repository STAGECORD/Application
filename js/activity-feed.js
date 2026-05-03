// STAGECORD PRO — activity feed + acting-as banner (artist page)
// Shows posts/actions on the artist profile with attribution badges for any
// action performed by an A&R/Manager on the artist's behalf. The acting-as
// banner sits below the topbar when impersonation is active.

// ============================================================
// Activity feed — A&R-attribution on artist actions
// ============================================================
// Demo of the action-attribution concept: any post or action made by
// an A&R/Manager while acting-as the artist gets a small "performed by
// X" badge that's only shown to the artist owner — public viewers
// don't see the attribution.
(function() {
    // Activity feed lives on /overview/ (personal dashboard) — moved here from
    // /artist/ since it makes more sense as a roll-up of your recent posts +
    // any actions performed by your A&R/Manager on your behalf.
    if (window.location.pathname.indexOf('/overview/') === -1) return;

    // Auto-inject stage.css for the activity-feed styles.
    if (!document.querySelector('link[href*="stage.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = localAsset('css/stage.css');
        document.head.appendChild(link);
    }

    const STORAGE_KEY = 'stagecord:artist-posts';

    // Hardcoded seed posts — mix of artist-self vs A&R-attributed to
    // demonstrate the visual difference. In a real app these come from
    // a feed endpoint scoped to the artist's profile.
    const SEED_POSTS = [
        {
            id: 'p1',
            text: 'Just wrapped late-cellar set at RUST. Crowd was electric — set list got tweaked on the fly to land the new bit. Recording will be on the channel by Tuesday.',
            author: 'Jokesmith Johnson',
            time: '2 hours ago',
            actor: null  // posted by artist directly — no attribution
        },
        {
            id: 'p2',
            text: 'Heads up: added a second Hammerstein show on 10 November after Saturday sold out in 12 minutes. Friend pre-sale opens tomorrow at 10am ET.',
            author: 'Jokesmith Johnson',
            time: '4 hours ago',
            actor: { name: 'Mason Blake', role: 'A&R' }  // posted by A&R on behalf
        },
        {
            id: 'p3',
            text: '✅ Spotify exclusive deal for Late Cellar Set audio — signed and locked.',
            author: 'Jokesmith Johnson',
            time: 'Yesterday',
            actor: { name: 'Victoria Larsen', role: 'Manager' }
        }
    ];

    function loadPosts() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return stored.concat(SEED_POSTS);
        } catch (e) { return SEED_POSTS.slice(); }
    }

    function savePost(post) {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            stored.unshift(post);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        } catch (e) { /* ignore */ }
    }

    function renderPost(p) {
        const attribution = p.actor
            ? '<div class="activity-post__attribution" data-help="Attribution: This post was performed by ' + (p.actor.role || 'staff') + ' ' + p.actor.name + ' on your behalf. Only you (the artist owner) see this marker — the public sees only the post with your name.">' +
                '<span class="activity-post__attribution-icon">⚙</span>' +
                '<span class="activity-post__attribution-text">Performed by <strong>' + (p.actor.role || 'staff') + ' ' + SC.escapeHtml(p.actor.name) + '</strong></span>' +
                '<span class="activity-post__attribution-hint">Visible only to you</span>' +
              '</div>'
            : '';
        return '<article class="activity-post">' +
            '<div class="activity-post__head">' +
                '<span class="activity-post__icon" aria-hidden="true">💬</span>' +
                '<span class="activity-post__author auto-name">' + SC.escapeHtml(p.author) + '</span>' +
                '<span class="activity-post__time">' + SC.escapeHtml(p.time) + '</span>' +
            '</div>' +
            '<p class="activity-post__body">' + SC.escapeHtml(p.text) + '</p>' +
            attribution +
        '</article>';
    }

    function renderFeed() {
        const root = document.querySelector('[data-activity-feed]');
        if (!root) return;
        const posts = loadPosts();
        const list = root.querySelector('[data-activity-list]');
        list.innerHTML = posts.map(renderPost).join('');
        const countEl = root.querySelector('[data-activity-count]');
        if (countEl) countEl.textContent = '(' + posts.length + ')';

        const acting = window.SC.actAs.get();
        const mode = (function() { try { return localStorage.getItem('stagecord:userMode') || 'artist'; } catch (e) { return 'artist'; }})();
        const postBtn = root.querySelector('[data-activity-post-btn]');
        // /overview/ is the user's own dashboard, so they can always post.
        // Label the button differently when in A&R acting-as mode so the
        // attribution context is clear.
        if (acting && acting.subjectId && mode === 'ar') {
            postBtn.hidden = false;
            postBtn.textContent = '+ Quick post as ' + (acting.actorName || 'A&R');
        } else {
            postBtn.hidden = false;
            postBtn.textContent = '+ New post';
        }

        if (typeof formatAllNames === 'function') formatAllNames(root);
    }

    function injectFeed() {
        if (document.querySelector('[data-activity-feed]')) return;
        // On /overview/ the natural slot is right after the KPI grid and
        // before "Suggested for you" — where the existing static "Recent
        // activity" list sits. We insert before that section so users see
        // their own posts (with A&R attribution) at the top.
        const wrapper = document.querySelector('.content-wrapper');
        if (!wrapper) return;
        // Pick anchor: the "Recent activity" section if present, else after
        // the KPI grid, else at the top of the wrapper.
        const sections = wrapper.querySelectorAll('.dash-section');
        let anchor = null;
        sections.forEach(function(s) {
            const t = s.querySelector('.dash-section__title');
            if (t && /recent activity/i.test(t.textContent || '')) anchor = s;
        });
        if (!anchor) anchor = wrapper.querySelector('.kpi-grid');
        const feed = document.createElement('section');
        feed.className = 'activity-feed';
        feed.setAttribute('data-activity-feed', '');
        feed.setAttribute('data-help', 'Activity: Your recent posts and actions across STAGECORD. Posts performed by your A&R/Manager on your behalf get an attribution badge only you can see — the public feed shows only your name.');
        feed.innerHTML =
            '<header class="activity-feed__head">' +
                '<h2 class="activity-feed__title">My activity <span class="activity-feed__count" data-activity-count></span></h2>' +
                '<button type="button" class="activity-feed__post-btn" data-activity-post-btn hidden></button>' +
            '</header>' +
            '<div class="activity-feed__compose is-hidden" data-activity-compose>' +
                '<textarea data-activity-text placeholder="What do you want to share?"></textarea>' +
                '<div class="activity-feed__compose-actions">' +
                    '<button type="button" class="release-modal__btn" data-activity-cancel>Cancel</button>' +
                    '<button type="button" class="release-modal__btn release-modal__btn--primary" data-activity-submit>Post</button>' +
                '</div>' +
            '</div>' +
            '<div class="activity-feed__list" data-activity-list></div>';
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(feed, anchor);
        } else {
            wrapper.appendChild(feed);
        }
        renderFeed();
    }

    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-activity-post-btn]')) {
            const compose = document.querySelector('[data-activity-compose]');
            if (compose) {
                compose.classList.remove('is-hidden');
                const ta = compose.querySelector('[data-activity-text]');
                if (ta) ta.focus();
            }
            return;
        }
        if (e.target.closest('[data-activity-cancel]')) {
            const compose = document.querySelector('[data-activity-compose]');
            if (compose) compose.classList.add('is-hidden');
            return;
        }
        if (e.target.closest('[data-activity-submit]')) {
            const ta = document.querySelector('[data-activity-text]');
            if (!ta) return;
            const text = ta.value.trim();
            if (!text) return;
            const acting = window.SC.actAs.get();
            const post = {
                id: 'p' + Date.now(),
                text: text,
                author: acting ? acting.subjectName : 'Artist',
                time: 'just now',
                actor: acting ? { name: acting.actorName, role: acting.actorRole } : null
            };
            savePost(post);
            ta.value = '';
            const compose = document.querySelector('[data-activity-compose]');
            if (compose) compose.classList.add('is-hidden');
            renderFeed();
            return;
        }
    });

    document.addEventListener('DOMContentLoaded', injectFeed);
    if (document.readyState !== 'loading') injectFeed();
})();

// ============================================================
// Acting-as banner — render on artist page when impersonating
// ============================================================
(function() {
    function avatarPath(filename) {
        if (!filename) return '';
        // From /artist/, walk up one to assets
        const path = window.location.pathname.indexOf('/artist/') !== -1 ? '../' : '';
        return path + 'assets/images/artists/' + filename;
    }

    function currentMode() {
        try { return localStorage.getItem('stagecord:userMode') || 'artist'; }
        catch (e) { return 'artist'; }
    }

    function render() {
        const state = window.SC.actAs.get();
        const existing = document.querySelector('.acting-as-banner');
        // Acting-as is only valid for A&R role. If state lingers from a previous
        // session but the current mode is something else (Artist, Fan, Manager,
        // etc.), clear it so banners don't appear out of context.
        if (state && currentMode() !== 'ar') {
            window.SC.actAs.clear();
            if (existing) existing.remove();
            document.body.removeAttribute('data-acting-as');
            return;
        }
        if (!state) {
            if (existing) existing.remove();
            document.body.removeAttribute('data-acting-as');
            return;
        }
        // Only render on artist-facing pages — for now just /artist/
        if (window.location.pathname.indexOf('/artist/') === -1) return;
        if (existing) return;

        const banner = document.createElement('div');
        banner.className = 'acting-as-banner';
        banner.setAttribute('data-help', 'Acting-as: You are acting on behalf of the artist with limitations. Actions you take here get a "performed by A&R/Manager" indicator visible only to the owner. Click Exit to stop.');
        banner.innerHTML =
            '<span class="acting-as-banner__icon" aria-hidden="true">👁</span>' +
            (state.actorAvatar
                ? '<span class="acting-as-banner__avatar" style="background-image: url(\'' + avatarPath(state.actorAvatar) + '\');"></span>'
                : '') +
            '<div class="acting-as-banner__main">' +
                '<div class="acting-as-banner__role">Acting as · ' + (state.actorRole || 'Staff') + '</div>' +
                '<div class="acting-as-banner__text">' +
                    '<strong>' + (state.actorName || 'Unknown') + '</strong> ' +
                    'is acting on behalf of <strong>' + (state.subjectName || 'artist') + '</strong> · ' +
                    'actions get "performed by ' + (state.actorRole || 'staff') + '" indicator (visible only to the artist owner).' +
                '</div>' +
            '</div>' +
            '<button type="button" class="acting-as-banner__exit" data-acting-exit>Exit acting-as</button>';
        document.body.insertBefore(banner, document.body.firstChild);
        document.body.setAttribute('data-acting-as', '');
    }

    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-acting-exit]')) {
            window.SC.actAs.clear();
            const banner = document.querySelector('.acting-as-banner');
            if (banner) banner.remove();
            document.body.removeAttribute('data-acting-as');
        }
    });

    document.addEventListener('DOMContentLoaded', render);
    if (document.readyState !== 'loading') render();
})();
