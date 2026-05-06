(async function () {
    const sb = window.supabaseClient;

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = '/login/';
        return;
    }
    const user = session.user;

    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = user.email || '';

    function escapeHtml(s) {
        return String(s).replace(/[<>&"']/g, (c) => ({
            '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    function timeAgo(iso) {
        const t = new Date(iso).getTime();
        const diff = (Date.now() - t) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    document.getElementById('signOutBtn').addEventListener('click', async () => {
        await sb.auth.signOut();
        window.location.href = '/';
    });

    const { data: profile } = await sb
        .from('profiles')
        .select('forename, surname, username, avatar_url')
        .eq('id', user.id)
        .single();

    if (profile?.username) {
        const pillar = document.getElementById('publicProfilePillar');
        const link = document.getElementById('publicProfileLink');
        if (pillar && link) {
            link.href = `/u/${encodeURIComponent(profile.username)}`;
            pillar.style.display = '';
        }
    }

    const fallbackForename = (user.user_metadata || {}).forename || '';
    const forename = profile?.forename || fallbackForename;
    const surname = profile?.surname || (user.user_metadata || {}).surname || '';

    const titleEl = document.getElementById('welcomeTitle');
    if (forename && titleEl) {
        titleEl.innerHTML = `Welcome, <span class="welcome-title-accent">${escapeHtml(forename)}</span>.`;
    }

    const avatarEl = document.getElementById('welcomeAvatar');
    const initialEl = document.getElementById('welcomeAvatarInitial');
    if (profile?.avatar_url) {
        avatarEl.style.backgroundImage = `url("${profile.avatar_url}")`;
        initialEl.style.display = 'none';
    } else {
        const initial = (forename[0] || surname[0] || user.email[0] || '?').toUpperCase();
        initialEl.textContent = initial;
    }

    const composerInput = document.getElementById('composerInput');
    const composerSubmit = document.getElementById('composerSubmit');
    const composerCounter = document.getElementById('composerCounter');
    const composerFeedback = document.getElementById('composerFeedback');
    const feedContainer = document.getElementById('feedContainer');

    function setComposerFeedback(message, kind) {
        composerFeedback.textContent = message || '';
        composerFeedback.classList.remove('is-success', 'is-error');
        if (kind) composerFeedback.classList.add('is-' + kind);
    }

    function updateComposerState() {
        const v = composerInput.value;
        const len = v.length;
        composerCounter.textContent = `${len} / 1000`;
        composerCounter.classList.toggle('is-warning', len > 800 && len <= 1000);
        composerCounter.classList.toggle('is-error', len > 1000);
        const trimmed = v.trim();
        composerSubmit.disabled = trimmed.length === 0 || trimmed.length > 1000;
    }

    composerInput.addEventListener('input', () => {
        updateComposerState();
        if (composerFeedback.textContent) setComposerFeedback('', null);
    });
    updateComposerState();

    composerSubmit.addEventListener('click', async () => {
        const content = composerInput.value.trim();
        if (!content) return;

        composerSubmit.disabled = true;
        composerSubmit.textContent = 'Posting…';
        setComposerFeedback('', null);

        const { error } = await sb.from('posts').insert({
            user_id: user.id,
            content
        });

        composerSubmit.textContent = 'Post';

        if (error) {
            console.error('Post insert failed:', error);
            setComposerFeedback(error.message || 'Could not post — try again.', 'error');
            updateComposerState();
            return;
        }

        composerInput.value = '';
        updateComposerState();
        setComposerFeedback('Posted ✓', 'success');
        setTimeout(() => setComposerFeedback('', null), 2200);
        loadFeed();
    });

    async function loadFeed() {
        feedContainer.innerHTML = `<div class="feed-empty">Loading…</div>`;
        const { data: rows, error } = await sb.rpc('get_feed', { p_limit: 30 });

        if (error) {
            console.error('get_feed failed:', error);
            feedContainer.innerHTML = `<div class="feed-empty">Couldn't load feed: ${escapeHtml(error.message || 'unknown error')}</div>`;
            return;
        }

        if (!rows || rows.length === 0) {
            feedContainer.innerHTML = `<div class="feed-empty">No posts yet — be the first.</div>`;
            return;
        }

        feedContainer.innerHTML = `<div class="feed-list">${rows.map(renderPost).join('')}</div>`;

        feedContainer.querySelectorAll('[data-delete-post]').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (!confirm('Delete this post?')) return;
                const id = btn.getAttribute('data-delete-post');
                const { error } = await sb.from('posts').delete().eq('id', id);
                if (error) {
                    alert('Could not delete: ' + (error.message || 'try again'));
                    return;
                }
                loadFeed();
            });
        });
    }

    function renderPost(p) {
        const name = [p.forename, p.surname].filter(Boolean).join(' ') || p.username || 'STAGECORD member';
        const initial = (name[0] || '?').toUpperCase();
        const avatarHtml = p.avatar_url
            ? `<div class="post__avatar" style="background-image:url('${escapeHtml(p.avatar_url)}');"></div>`
            : `<div class="post__avatar">${escapeHtml(initial)}</div>`;
        const handleHtml = p.username
            ? `<a class="post__handle" href="/u/${encodeURIComponent(p.username)}" style="text-decoration:none;">@${escapeHtml(p.username)}</a>`
            : `<span class="post__handle">no handle yet</span>`;
        const authorLink = p.username
            ? `<a href="/u/${encodeURIComponent(p.username)}" class="post__author">${escapeHtml(name)}</a>`
            : `<span class="post__author">${escapeHtml(name)}</span>`;
        const isOwn = p.user_id === user.id;
        const deleteBtn = isOwn
            ? `<button class="post__delete" data-delete-post="${escapeHtml(p.id)}" aria-label="Delete">×</button>`
            : '';

        return `<article class="post">
            <header class="post__head">
                ${avatarHtml}
                <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
                    ${authorLink}
                    ${handleHtml}
                </div>
                <span class="post__time">${escapeHtml(timeAgo(p.created_at))}</span>
                ${deleteBtn}
            </header>
            <p class="post__content">${escapeHtml(p.content)}</p>
        </article>`;
    }

    loadFeed();
})();
