// Shared "Add to playlist" popover. Pages call:
//   STAGECORD_AddToPlaylist.attach({ button, trackId })
// to wire a button (anywhere) to a popover that lists the user's
// playlists. Picking one inserts a playlist_tracks row.
window.STAGECORD_AddToPlaylist = (function () {
    const sb = window.supabaseClient;
    let cachedUserId = null;
    let cachedPlaylists = null;
    let popover = null;

    function ensurePopoverStyles() {
        if (document.getElementById('atp-styles')) return;
        const style = document.createElement('style');
        style.id = 'atp-styles';
        style.textContent = `
            .atp-popover {
                position: absolute; z-index: 250;
                background: #0B1A38;
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 12px;
                padding: 8px;
                box-shadow: 0 14px 40px rgba(0,0,0,0.55);
                min-width: 240px; max-width: 320px;
                max-height: 320px; overflow-y: auto;
            }
            .atp-popover__head {
                color: #7E89A6; font-size: 11px;
                text-transform: uppercase; letter-spacing: 0.06em;
                padding: 6px 10px 8px 10px;
            }
            .atp-popover button.atp-item {
                display: block; width: 100%;
                background: transparent; border: none;
                color: #FFFFFF; font-family: inherit; font-size: 14px;
                text-align: left; padding: 9px 10px;
                border-radius: 8px; cursor: pointer;
            }
            .atp-popover button.atp-item:hover { background: rgba(255,255,255,0.06); }
            .atp-popover .atp-item-meta { color: #7E89A6; font-size: 12px; margin-top: 2px; }
            .atp-popover .atp-empty { color: #7E89A6; font-size: 13px; padding: 10px; text-align: center; }
            .atp-popover .atp-create {
                margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;
            }
            .atp-trigger {
                background: transparent; border: 1px solid rgba(255,255,255,0.12);
                color: #C2CADD; cursor: pointer;
                padding: 6px 10px; border-radius: 999px;
                font-family: inherit; font-size: 12px;
                display: inline-flex; align-items: center; gap: 6px;
            }
            .atp-trigger:hover { color: #FFFFFF; border-color: rgba(255,255,255,0.24); }
        `;
        document.head.appendChild(style);
    }

    async function getSessionUserId() {
        if (cachedUserId) return cachedUserId;
        const { data: { session } } = await sb.auth.getSession();
        cachedUserId = session?.user?.id || null;
        return cachedUserId;
    }

    async function getPlaylists(force) {
        if (!force && cachedPlaylists) return cachedPlaylists;
        const uid = await getSessionUserId();
        if (!uid) return [];
        const { data, error } = await sb
            .from('playlists')
            .select('id, name, created_at')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) {
            console.error('Load playlists failed:', error);
            return [];
        }
        const ids = data.map((p) => p.id);
        const counts = {};
        if (ids.length) {
            const { data: links } = await sb
                .from('playlist_tracks')
                .select('playlist_id')
                .in('playlist_id', ids);
            (links || []).forEach((l) => { counts[l.playlist_id] = (counts[l.playlist_id] || 0) + 1; });
        }
        cachedPlaylists = data.map((p) => ({ ...p, track_count: counts[p.id] || 0 }));
        return cachedPlaylists;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function closePopover() {
        if (popover && popover.parentNode) popover.parentNode.removeChild(popover);
        popover = null;
        document.removeEventListener('click', onDocClick, true);
    }
    function onDocClick(e) {
        if (popover && !popover.contains(e.target) && !e.target.closest('[data-atp-trigger]')) {
            closePopover();
        }
    }

    async function openPopover(button, trackId) {
        ensurePopoverStyles();
        closePopover();

        popover = document.createElement('div');
        popover.className = 'atp-popover';
        popover.innerHTML = `<div class="atp-empty">Loading…</div>`;

        const rect = button.getBoundingClientRect();
        popover.style.position = 'absolute';
        document.body.appendChild(popover);

        const top = rect.bottom + window.scrollY + 6;
        const left = Math.max(8, rect.left + window.scrollX - (popover.offsetWidth - rect.width));
        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;

        setTimeout(() => document.addEventListener('click', onDocClick, true), 0);

        const playlists = await getPlaylists(true);
        if (!playlists.length) {
            popover.innerHTML = `
                <div class="atp-popover__head">No playlists yet</div>
                <div class="atp-empty"><a href="/playlists/" style="color:#FFFFFF;">Create your first playlist →</a></div>
            `;
            return;
        }

        popover.innerHTML = `
            <div class="atp-popover__head">Add to a playlist</div>
            ${playlists.map((p) => `
                <button class="atp-item" data-add-to="${escapeHtml(p.id)}">
                    <div>${escapeHtml(p.name)}</div>
                    <div class="atp-item-meta">${p.track_count} ${p.track_count === 1 ? 'track' : 'tracks'}</div>
                </button>
            `).join('')}
            <div class="atp-create">
                <a class="atp-item" href="/playlists/" style="text-decoration:none;display:block;">+ New playlist…</a>
            </div>
        `;

        popover.querySelectorAll('[data-add-to]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const playlistId = btn.getAttribute('data-add-to');
                btn.disabled = true;
                btn.querySelector('div').textContent = 'Adding…';
                const { error } = await sb.from('playlist_tracks').insert({
                    playlist_id: playlistId,
                    track_id: trackId
                });
                if (error) {
                    if (/duplicate/i.test(error.message || '') || error.code === '23505') {
                        btn.querySelector('div').textContent = 'Already in this playlist';
                    } else {
                        btn.querySelector('div').textContent = 'Could not add';
                    }
                    setTimeout(closePopover, 1200);
                    return;
                }
                cachedPlaylists = null;
                btn.querySelector('div').textContent = 'Added ✓';
                setTimeout(closePopover, 800);
            });
        });
    }

    function attach({ button, trackId }) {
        if (!button || !trackId) return;
        button.setAttribute('data-atp-trigger', '');
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openPopover(button, trackId);
        });
    }

    function makeButton(trackId) {
        ensurePopoverStyles();
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'atp-trigger';
        btn.setAttribute('data-atp-trigger', '');
        btn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add to playlist</span>
        `;
        attach({ button: btn, trackId });
        return btn;
    }

    return { attach, makeButton };
})();
