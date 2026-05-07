(async function () {
    const sb = window.supabaseClient;
    const F = window.STAGECORD;

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = '/login/';
        return;
    }
    const user = session.user;

    const content = document.getElementById('pjContent');
    const modal = document.getElementById('pjModal');
    const modalForm = document.getElementById('pjModalForm');
    const modalTitle = document.getElementById('pj-title');
    const modalDesc = document.getElementById('pj-desc');
    const modalError = document.getElementById('pjModalError');
    const modalSubmit = document.getElementById('pjModalSubmit');
    const modalCancel = document.getElementById('pjModalCancel');

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
    function statusLabel(s) {
        if (s === 'in_progress') return 'In progress';
        if (s === 'released') return 'Released';
        if (s === 'archived') return 'Archived';
        return s;
    }

    function openModal() {
        modalError.textContent = '';
        modalTitle.value = '';
        modalDesc.value = '';
        modal.classList.add('is-open');
        modalTitle.focus();
    }
    function closeModal() { modal.classList.remove('is-open'); }
    modalCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = modalTitle.value.trim();
        const desc = modalDesc.value.trim();
        if (!title) { modalError.textContent = 'Title is required.'; return; }
        modalSubmit.disabled = true;
        modalSubmit.textContent = 'Creating…';
        const { data, error } = await sb.rpc('create_project', { p_title: title, p_description: desc || null });
        modalSubmit.disabled = false;
        modalSubmit.textContent = 'Create';
        if (error) {
            modalError.textContent = error.message || 'Could not create project.';
            return;
        }
        closeModal();
        window.location.href = `/projects/?id=${encodeURIComponent(data)}`;
    });

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('id');

    if (projectId) {
        await renderDetail(projectId);
    } else {
        await renderList();
    }

    async function renderList() {
        content.innerHTML = `<div class="pj-empty">Loading…</div>`;
        const { data: rows, error } = await sb.rpc('get_my_projects');

        if (error) {
            content.innerHTML = `<div class="pj-empty">Couldn't load projects: ${escapeHtml(error.message || '')}</div>`;
            return;
        }

        // Check if user is artist
        let canCreate = false;
        try {
            const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single();
            canCreate = prof?.role === 'artist';
        } catch (_) {}

        const head = `
            <div class="pj-head">
                <h1>Projects</h1>
                ${canCreate ? '<button class="pj-btn" id="newProjectBtn">+ New project</button>' : ''}
            </div>
        `;

        if (!rows || rows.length === 0) {
            const note = canCreate
                ? 'No projects yet. Start one and invite collaborators.'
                : 'Projects are STAGECORD PRO collaboration spaces for artists. Switch your role to Artist on /profile/ to create or join projects.';
            content.innerHTML = head + `<div class="pj-empty">${note}</div>`;
        } else {
            content.innerHTML = head + `<div class="pj-grid">${rows.map((p) => {
                const mc = Number(p.member_count) || 0;
                const tc = Number(p.track_count) || 0;
                const status = `<span class="pj-status pj-status--${escapeHtml(p.status)}">${escapeHtml(statusLabel(p.status))}</span>`;
                return `<a class="pj-card" href="/projects/?id=${encodeURIComponent(p.id)}">
                    <div class="pj-card__head">
                        <div class="pj-card__name">${escapeHtml(p.title)}</div>
                        ${status}
                    </div>
                    <div class="pj-card__meta">${mc} ${mc === 1 ? 'member' : 'members'} · ${tc} ${tc === 1 ? 'track' : 'tracks'} · ${escapeHtml(fmtDate(p.updated_at))}</div>
                    ${p.description ? `<div class="pj-card__desc">${escapeHtml(p.description)}</div>` : ''}
                </a>`;
            }).join('')}</div>`;
        }

        const newBtn = document.getElementById('newProjectBtn');
        if (newBtn) newBtn.addEventListener('click', openModal);
    }

    async function renderDetail(id) {
        content.innerHTML = `<div class="pj-empty">Loading project…</div>`;

        const [{ data: meta, error: metaErr },
               { data: members, error: memErr },
               { data: tracks, error: trErr }] = await Promise.all([
            sb.rpc('get_project', { p_project_id: id }),
            sb.rpc('get_project_members', { p_project_id: id }),
            sb.rpc('get_project_tracks', { p_project_id: id })
        ]);

        if (metaErr || !meta || meta.length === 0) {
            content.innerHTML = `<div class="pj-empty">
                <p style="color:#FFFFFF;font-size:18px;margin-bottom:8px;">Project not found</p>
                <p style="margin-top:14px;"><a href="/projects/" style="color:#FFFFFF;">← Your projects</a></p>
            </div>`;
            return;
        }

        const p = meta[0];
        const isOwner = p.owner_id === user.id;
        const isMember = (members || []).some((m) => m.user_id === user.id);
        const ownerName = F.formatName(p.owner_forename, p.owner_surname, p.owner_username);
        const ownerLink = p.owner_username
            ? `<a href="/u/${encodeURIComponent(p.owner_username)}">${ownerName}</a>`
            : ownerName;

        if (window.STAGECORD_AppShell) window.STAGECORD_AppShell.setTitle(p.title);
        document.title = `${p.title} · STAGECORD`;

        const status = `<span class="pj-status pj-status--${escapeHtml(p.status)}">${escapeHtml(statusLabel(p.status))}</span>`;

        const memberPills = (members || []).map((m) => {
            const styled = F.formatName(m.forename, m.surname, m.username);
            const initial = (F.plainName(m.forename, m.surname, m.username)[0] || '?').toUpperCase();
            const avatar = m.avatar_url
                ? `<div class="pj-member__avatar" style="background-image:url('${escapeHtml(m.avatar_url)}');"></div>`
                : `<div class="pj-member__avatar">${escapeHtml(initial)}</div>`;
            const link = m.username ? `/u/${encodeURIComponent(m.username)}` : '#';
            const crown = m.is_owner ? '<span class="pj-member__crown" title="Owner">★</span>' : '';
            const removeBtn = isMember && !m.is_owner && (isOwner || m.user_id === user.id)
                ? `<button class="pj-member__remove" data-remove-member="${escapeHtml(m.user_id)}" aria-label="Remove">×</button>`
                : '';
            return `<a class="pj-member" href="${link}">
                ${avatar}
                <span class="pj-member__name">${styled}</span>
                ${crown}
                ${removeBtn}
            </a>`;
        }).join('');

        const inviteBlock = isMember ? `
            <div class="pj-invite-row">
                <input type="text" id="pjInviteInput" placeholder="Invite by username (artists only)…" autocomplete="off">
                <button class="pj-btn" id="pjInviteBtn">Add</button>
            </div>
            <div class="pj-invite-feedback" id="pjInviteFeedback"></div>
        ` : '';

        const trackList = (tracks || []).length > 0 ? (tracks || []).map((t) => {
            const styledArtist = F.formatName(t.artist_forename, t.artist_surname, t.artist_username);
            const artistLink = t.artist_username
                ? `<a href="/u/${encodeURIComponent(t.artist_username)}">${styledArtist}</a>`
                : styledArtist;
            const dur = t.duration_seconds ? ` · ${fmtDuration(t.duration_seconds)}` : '';
            const removeBtn = isMember
                ? `<button class="pj-track__remove" data-remove-track="${escapeHtml(t.id)}" aria-label="Remove">×</button>`
                : '';
            return `<article class="pj-track">
                <header class="pj-track__head">
                    <div class="pj-track__title">${escapeHtml(t.title)}</div>
                    <div class="pj-track__artist">${artistLink}${dur}</div>
                    ${removeBtn}
                </header>
                <audio controls preload="none" src="${escapeHtml(t.audio_url)}"></audio>
            </article>`;
        }).join('') : `<div class="pj-empty">No tracks yet.${isMember ? ' Add yours from your /tracks/ page or your public profile.' : ''}</div>`;

        const ownerActions = isOwner ? `
            <div class="pj-detail__actions">
                <a class="pj-btn pj-btn--ghost" href="/projects/">← Back</a>
                <button class="pj-btn pj-btn--ghost pj-btn--danger" id="deleteProjectBtn">Delete project</button>
            </div>
        ` : isMember ? `
            <div class="pj-detail__actions">
                <a class="pj-btn pj-btn--ghost" href="/projects/">← Back</a>
                <button class="pj-btn pj-btn--ghost pj-btn--danger" id="leaveProjectBtn">Leave project</button>
            </div>
        ` : `
            <div class="pj-detail__actions">
                <a class="pj-btn pj-btn--ghost" href="/projects/">← Projects</a>
            </div>
        `;

        content.innerHTML = `
            <div class="pj-detail__head">
                <div class="pj-detail__title-row">
                    <h1 class="pj-detail__title">${escapeHtml(p.title)}</h1>
                    ${status}
                </div>
                <div class="pj-detail__meta">Owned by ${ownerLink} · ${p.member_count} ${p.member_count === 1 ? 'member' : 'members'} · ${p.track_count} ${p.track_count === 1 ? 'track' : 'tracks'}</div>
                ${p.description ? `<p class="pj-detail__desc">${escapeHtml(p.description)}</p>` : ''}
                ${ownerActions}
            </div>

            <section class="pj-section">
                <h2>Members <span class="count">${(members || []).length}</span></h2>
                <div class="pj-members">${memberPills}</div>
                ${inviteBlock}
            </section>

            <section class="pj-section">
                <h2>Tracks <span class="count">${(tracks || []).length}</span></h2>
                ${trackList}
            </section>
        `;

        // Wire actions
        if (isOwner) {
            const delBtn = document.getElementById('deleteProjectBtn');
            if (delBtn) {
                delBtn.addEventListener('click', async () => {
                    if (!confirm(`Delete "${p.title}"? This removes the project for everyone — but their tracks themselves stay intact.`)) return;
                    delBtn.disabled = true;
                    const { error } = await sb.rpc('delete_project', { p_project_id: id });
                    if (error) {
                        alert('Could not delete: ' + (error.message || 'try again'));
                        delBtn.disabled = false;
                        return;
                    }
                    window.location.href = '/projects/';
                });
            }
        }

        const leaveBtn = document.getElementById('leaveProjectBtn');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', async () => {
                if (!confirm('Leave this project?')) return;
                leaveBtn.disabled = true;
                const { error } = await sb.rpc('remove_project_member', { p_project_id: id, p_target_user_id: user.id });
                if (error) {
                    alert('Could not leave: ' + (error.message || 'try again'));
                    leaveBtn.disabled = false;
                    return;
                }
                window.location.href = '/projects/';
            });
        }

        if (isMember) {
            content.querySelectorAll('[data-remove-member]').forEach((btn) => {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetId = btn.getAttribute('data-remove-member');
                    if (!confirm('Remove this member from the project?')) return;
                    const { error } = await sb.rpc('remove_project_member', { p_project_id: id, p_target_user_id: targetId });
                    if (error) {
                        alert('Could not remove: ' + (error.message || 'try again'));
                        return;
                    }
                    renderDetail(id);
                });
            });

            content.querySelectorAll('[data-remove-track]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Remove this track from the project?')) return;
                    const trackId = btn.getAttribute('data-remove-track');
                    const { error } = await sb.rpc('remove_track_from_project', { p_project_id: id, p_track_id: trackId });
                    if (error) {
                        alert('Could not remove: ' + (error.message || 'try again'));
                        return;
                    }
                    renderDetail(id);
                });
            });

            const inviteBtn = document.getElementById('pjInviteBtn');
            const inviteInput = document.getElementById('pjInviteInput');
            const inviteFeedback = document.getElementById('pjInviteFeedback');
            if (inviteBtn && inviteInput) {
                async function doInvite() {
                    const username = inviteInput.value.trim();
                    if (!username) return;
                    inviteFeedback.textContent = '';
                    inviteFeedback.classList.remove('is-error', 'is-success');
                    inviteBtn.disabled = true;
                    const { error } = await sb.rpc('add_project_member', { p_project_id: id, p_username: username });
                    inviteBtn.disabled = false;
                    if (error) {
                        inviteFeedback.textContent = error.message || 'Could not add.';
                        inviteFeedback.classList.add('is-error');
                        return;
                    }
                    inviteInput.value = '';
                    inviteFeedback.textContent = 'Added ✓';
                    inviteFeedback.classList.add('is-success');
                    setTimeout(() => renderDetail(id), 600);
                }
                inviteBtn.addEventListener('click', doInvite);
                inviteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doInvite(); } });
            }
        }
    }
})();
