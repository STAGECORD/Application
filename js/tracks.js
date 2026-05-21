(async function () {
    const sb = window.supabaseClient;

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = '/login/';
        return;
    }
    const user = session.user;

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            await sb.auth.signOut();
            window.location.href = '/';
        });
    }

    const titleInput = document.getElementById('track-title');
    const descInput = document.getElementById('track-desc');
    const fileInput = document.getElementById('track-file');
    const fileName = document.getElementById('trackFileName');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadFeedback = document.getElementById('uploadFeedback');
    const uploadProgress = document.getElementById('uploadProgress');
    const form = document.getElementById('uploadForm');
    const listEl = document.getElementById('tracksList');
    const countEl = document.getElementById('tracksCount');

    const MAX_TRACK_BYTES = 50 * 1024 * 1024;
    const ALLOWED_AUDIO = /^audio\/(mpeg|mp3|wav|wave|x-wav|mp4|m4a|x-m4a|aac|ogg|vorbis)$/i;

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
        return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function setFeedback(msg, kind) {
        uploadFeedback.textContent = msg || '';
        uploadFeedback.classList.remove('is-success', 'is-error');
        if (kind) uploadFeedback.classList.add('is-' + kind);
    }

    function updateButtonState() {
        const title = titleInput.value.trim();
        const file = fileInput.files?.[0];
        uploadBtn.disabled = !title || !file;
    }

    async function probeDuration(file) {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const audio = new Audio();
            audio.preload = 'metadata';
            const finish = (val) => {
                URL.revokeObjectURL(url);
                resolve(val);
            };
            audio.addEventListener('loadedmetadata', () => {
                const d = isFinite(audio.duration) ? Math.round(audio.duration) : null;
                finish(d);
            });
            audio.addEventListener('error', () => finish(null));
            audio.src = url;
        });
    }

    function fmtDuration(secs) {
        if (!secs && secs !== 0) return '';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    titleInput.addEventListener('input', updateButtonState);

    fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) {
            fileName.textContent = 'No file chosen';
            updateButtonState();
            return;
        }
        if (!ALLOWED_AUDIO.test(file.type) && !/\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name)) {
            setFeedback('Pick an MP3, WAV, M4A or OGG file.', 'error');
            fileInput.value = '';
            fileName.textContent = 'No file chosen';
            updateButtonState();
            return;
        }
        if (file.size > MAX_TRACK_BYTES) {
            setFeedback('File is over 50 MB — pick a smaller one.', 'error');
            fileInput.value = '';
            fileName.textContent = 'No file chosen';
            updateButtonState();
            return;
        }
        setFeedback('', null);
        fileName.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
        if (!titleInput.value.trim()) {
            titleInput.value = file.name.replace(/\.[^/.]+$/, '');
        }
        updateButtonState();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = titleInput.value.trim();
        const description = descInput.value.trim();
        const file = fileInput.files?.[0];
        if (!title || !file) return;

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading…';
        uploadProgress.textContent = '';
        setFeedback('', null);

        const duration = await probeDuration(file);

        const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
        const path = `${user.id}/track-${Date.now()}.${ext}`;
        const { error: upErr } = await sb.storage
            .from('tracks')
            .upload(path, file, { cacheControl: '3600', upsert: false });

        if (upErr) {
            console.error('Track upload failed:', upErr);
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Publish track';
            setFeedback(`Upload failed: ${upErr.message || 'try again'}`, 'error');
            return;
        }

        const { data: pub } = sb.storage.from('tracks').getPublicUrl(path);
        const audio_url = pub.publicUrl;

        const { error: insErr } = await sb.from('tracks').insert({
            user_id: user.id,
            title,
            description: description || null,
            audio_url,
            duration_seconds: duration
        });

        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Publish track';

        if (insErr) {
            console.error('Track insert failed:', insErr);
            setFeedback(`Saved file but couldn't create track: ${insErr.message || 'try again'}`, 'error');
            return;
        }

        titleInput.value = '';
        descInput.value = '';
        fileInput.value = '';
        fileName.textContent = 'No file chosen';
        updateButtonState();
        setFeedback('Track published ✓', 'success');
        setTimeout(() => setFeedback('', null), 2200);
        loadTracks();
    });

    async function loadTracks() {
        listEl.innerHTML = `<div class="tracks-empty">Loading…</div>`;
        const { data: rows, error } = await sb
            .from('tracks')
            .select('id, title, description, audio_url, duration_seconds, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error('Load tracks failed:', error);
            listEl.innerHTML = `<div class="tracks-empty">Couldn't load tracks: ${escapeHtml(error.message || '')}</div>`;
            return;
        }

        if (!rows || rows.length === 0) {
            listEl.innerHTML = `<div class="tracks-empty">No tracks yet — upload one above.</div>`;
            countEl.textContent = '';
            return;
        }

        countEl.textContent = `${rows.length} ${rows.length === 1 ? 'track' : 'tracks'}`;

        const trackIds = rows.map((r) => r.id);
        const likeCounts = {};
        const ownLikes = new Set();
        if (trackIds.length > 0) {
            const { data: allLikes } = await sb
                .from('likes')
                .select('target_id, user_id')
                .eq('target_type', 'track')
                .in('target_id', trackIds);
            (allLikes || []).forEach((l) => {
                likeCounts[l.target_id] = (likeCounts[l.target_id] || 0) + 1;
                if (l.user_id === user.id) ownLikes.add(l.target_id);
            });
        }

        listEl.innerHTML = rows.map((t) => {
            const desc = t.description
                ? `<p class="track__desc">${escapeHtml(t.description)}</p>`
                : '';
            const dur = t.duration_seconds ? ` · ${fmtDuration(t.duration_seconds)}` : '';
            return `<article class="track" data-track-id="${escapeHtml(t.id)}">
                <header class="track__head">
                    <h3 class="track__title">${escapeHtml(t.title)}</h3>
                    <span class="track__time">${escapeHtml(timeAgo(t.created_at))}${dur}</span>
                    <button class="track__delete" data-delete-track="${escapeHtml(t.id)}" aria-label="Delete">×</button>
                </header>
                ${desc}
                <div class="wf-player" data-audio-url="${escapeHtml(t.audio_url)}"></div>
                <div class="track__actions"></div>
            </article>`;
        }).join('');

        if (window.STAGECORD_Waveform) window.STAGECORD_Waveform.attachAll(listEl);

        rows.forEach((t) => {
            const trackEl = listEl.querySelector(`[data-track-id="${t.id}"]`);
            if (!trackEl) return;
            const actions = trackEl.querySelector('.track__actions');
            if (!actions) return;
            if (window.STAGECORD_Likes) {
                window.STAGECORD_Likes.render({
                    container: actions,
                    targetType: 'track',
                    targetId: t.id,
                    initialCount: likeCounts[t.id] || 0,
                    initiallyLiked: ownLikes.has(t.id),
                    currentUserId: user.id
                });
            }
            if (window.STAGECORD_AddToPlaylist) {
                actions.appendChild(window.STAGECORD_AddToPlaylist.makeButton(t.id));
            }
            if (window.STAGECORD_AddToProject) {
                actions.appendChild(window.STAGECORD_AddToProject.makeButton(t.id));
            }
        });

        listEl.querySelectorAll('[data-delete-track]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this track?')) return;
                const id = btn.getAttribute('data-delete-track');
                const row = rows.find((r) => r.id === id);

                const { error: delDb } = await sb.from('tracks').delete().eq('id', id);
                if (delDb) {
                    alert('Could not delete: ' + (delDb.message || 'try again'));
                    return;
                }

                if (row?.audio_url) {
                    const m = row.audio_url.match(/\/storage\/v1\/object\/public\/tracks\/(.+)$/);
                    if (m) {
                        sb.storage.from('tracks').remove([decodeURIComponent(m[1])]).catch(() => {});
                    }
                }

                loadTracks();
            });
        });
    }

    loadTracks();
    updateButtonState();
})();
