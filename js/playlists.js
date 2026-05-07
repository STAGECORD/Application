(async function () {
    const sb = window.supabaseClient;
    const F = window.STAGECORD;

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = '/login/';
        return;
    }
    const user = session.user;

    const content = document.getElementById('plContent');
    const modal = document.getElementById('plModal');
    const modalForm = document.getElementById('plModalForm');
    const modalNameInput = document.getElementById('pl-name');
    const modalDescInput = document.getElementById('pl-desc');
    const modalError = document.getElementById('plModalError');
    const modalCancel = document.getElementById('plModalCancel');
    const modalSubmit = document.getElementById('plModalSubmit');

    const escapeHtml = F.escapeHtml;

    function fmtDate(iso) {
        return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function fmtDuration(secs) {
        if (!secs && secs !== 0) return '';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function openModal() {
        modalError.textContent = '';
        modalNameInput.value = '';
        modalDescInput.value = '';
        modal.classList.add('is-open');
        modalNameInput.focus();
    }
    function closeModal() { modal.classList.remove('is-open'); }
    modalCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = modalNameInput.value.trim();
        const desc = modalDescInput.value.trim();
        if (!name) {
            modalError.textContent = 'Name is required.';
            return;
        }
        modalSubmit.disabled = true;
        modalSubmit.textContent = 'Creating…';
        const { data, error } = await sb.from('playlists').insert({
            user_id: user.id,
            name,
            description: desc || null
        }).select().single();
        modalSubmit.disabled = false;
        modalSubmit.textContent = 'Create';
        if (error) {
            modalError.textContent = error.message || 'Could not create playlist.';
            return;
        }
        closeModal();
        window.location.href = `/playlists/?id=${encodeURIComponent(data.id)}`;
    });

    const params = new URLSearchParams(window.location.search);
    const playlistId = params.get('id');

    if (playlistId) {
        await renderDetail(playlistId);
    } else {
        await renderList();
    }

    async function renderList() {
        content.innerHTML = `<div class="pl-empty">Loading…</div>`;
        const { data: rows, error } = await sb
            .from('playlists')
            .select('id, name, description, cover_url, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            content.innerHTML = `<div class="pl-empty">Couldn't load playlists: ${escapeHtml(error.message || '')}</div>`;
            return;
        }

        // Track counts (separate query)
        const ids = (rows || []).map((r) => r.id);
        const counts = {};
        if (ids.length) {
            const { data: links } = await sb
                .from('playlist_tracks')
                .select('playlist_id')
                .in('playlist_id', ids);
            (links || []).forEach((l) => { counts[l.playlist_id] = (counts[l.playlist_id] || 0) + 1; });
        }

        const head = `
            <div class="pl-head">
                <h1>Your playlists</h1>
                <button class="pl-btn" id="newPlaylistBtn">+ New playlist</button>
            </div>
        `;

        if (!rows || rows.length === 0) {
            content.innerHTML = head + `
                <div class="pl-empty">
                    No playlists yet. Create your first one to start collecting tracks from across STAGECORD.
                </div>
            `;
        } else {
            content.innerHTML = head + `<div class="pl-grid">${rows.map((p) => {
                const tc = counts[p.id] || 0;
                return `<a class="pl-card" href="/playlists/?id=${encodeURIComponent(p.id)}">
                    <div class="pl-card__icon">
                        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                        </svg>
                    </div>
                    <div class="pl-card__name">${escapeHtml(p.name)}</div>
                    <div class="pl-card__meta">${tc} ${tc === 1 ? 'track' : 'tracks'} · ${escapeHtml(fmtDate(p.created_at))}</div>
                    ${p.description ? `<div class="pl-card__desc">${escapeHtml(p.description)}</div>` : ''}
                </a>`;
            }).join('')}</div>`;
        }

        document.getElementById('newPlaylistBtn').addEventListener('click', openModal);
    }

    async function renderDetail(id) {
        content.innerHTML = `<div class="pl-empty">Loading playlist…</div>`;

        const [{ data: meta, error: metaErr }, { data: tracks, error: trErr }] = await Promise.all([
            sb.rpc('get_playlist', { p_playlist_id: id }),
            sb.rpc('get_playlist_tracks', { p_playlist_id: id })
        ]);

        if (metaErr || !meta || meta.length === 0) {
            content.innerHTML = `<div class="pl-empty">
                <p style="color:#FFFFFF;font-size:18px;margin-bottom:8px;">Playlist not found</p>
                <p>It may have been deleted, or the link is wrong.</p>
                <p style="margin-top:14px;"><a href="/playlists/" style="color:#FFFFFF;">← Your playlists</a></p>
            </div>`;
            return;
        }

        const p = meta[0];
        const isOwner = p.user_id === user.id;
        const ownerName = F.formatName(p.owner_forename, p.owner_surname, p.owner_username);
        const ownerLink = p.owner_username
            ? `<a href="/u/${encodeURIComponent(p.owner_username)}">${ownerName}</a>`
            : ownerName;

        const trackList = !trErr && tracks && tracks.length > 0
            ? tracks.map((t) => {
                const artistName = F.formatName(t.artist_forename, t.artist_surname, t.artist_username);
                const artistLink = t.artist_username
                    ? `<a href="/u/${encodeURIComponent(t.artist_username)}">${artistName}</a>`
                    : artistName;
                const dur = t.duration_seconds ? ` · ${fmtDuration(t.duration_seconds)}` : '';
                const removeBtn = isOwner
                    ? `<button class="pl-track__remove" data-remove-track="${escapeHtml(t.id)}" aria-label="Remove">×</button>`
                    : '';
                return `<article class="pl-track">
                    <header class="pl-track__head">
                        <div class="pl-track__title">${escapeHtml(t.title)}</div>
                        <div class="pl-track__artist">${artistLink}${dur}</div>
                        ${removeBtn}
                    </header>
                    <audio controls preload="none" src="${escapeHtml(t.audio_url)}"></audio>
                </article>`;
            }).join('')
            : `<div class="pl-empty">No tracks in this playlist yet.${isOwner ? ' Add some from any artist\'s profile.' : ''}</div>`;

        const ownerActions = isOwner ? `
            <div class="pl-detail__actions">
                <a class="pl-btn pl-btn--ghost" href="/playlists/">← Back to your playlists</a>
                <button class="pl-btn pl-btn--ghost pl-btn--danger" id="deletePlaylistBtn">Delete playlist</button>
            </div>
        ` : `
            <div class="pl-detail__actions">
                <a class="pl-btn pl-btn--ghost" href="/u/${encodeURIComponent(p.owner_username || '')}">View owner's profile →</a>
            </div>
        `;

        content.innerHTML = `
            <div class="pl-detail__head">
                <h1 class="pl-detail__name">${escapeHtml(p.name)}</h1>
                <div class="pl-detail__owner">By ${ownerLink} · ${p.track_count || 0} ${(p.track_count || 0) === 1 ? 'track' : 'tracks'}</div>
                ${p.description ? `<p class="pl-detail__desc">${escapeHtml(p.description)}</p>` : ''}
                ${ownerActions}
            </div>
            <div class="pl-tracks">${trackList}</div>
        `;

        document.title = `${p.name} · STAGECORD`;

        if (window.STAGECORD_AppShell) {
            window.STAGECORD_AppShell.setTitle(p.name);
        }

        if (isOwner) {
            const delBtn = document.getElementById('deletePlaylistBtn');
            if (delBtn) {
                delBtn.addEventListener('click', async () => {
                    if (!confirm(`Delete "${p.name}"? Tracks themselves are not deleted, only this playlist.`)) return;
                    delBtn.disabled = true;
                    const { error } = await sb.from('playlists').delete().eq('id', p.id);
                    if (error) {
                        alert('Could not delete: ' + (error.message || 'try again'));
                        delBtn.disabled = false;
                        return;
                    }
                    window.location.href = '/playlists/';
                });
            }

            content.querySelectorAll('[data-remove-track]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Remove this track from the playlist?')) return;
                    const trackId = btn.getAttribute('data-remove-track');
                    const { error } = await sb.from('playlist_tracks')
                        .delete()
                        .eq('playlist_id', p.id)
                        .eq('track_id', trackId);
                    if (error) {
                        alert('Could not remove: ' + (error.message || 'try again'));
                        return;
                    }
                    renderDetail(id);
                });
            });
        }
    }
})();
