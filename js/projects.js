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
    const modalHeading = document.getElementById('pjModalTitle');
    const modalTitle = document.getElementById('pj-title');
    const modalDesc = document.getElementById('pj-desc');
    const modalStatusField = document.getElementById('pjStatusField');
    const modalStatusInput = document.getElementById('pj-status-input');
    const modalError = document.getElementById('pjModalError');
    const modalSubmit = document.getElementById('pjModalSubmit');
    const modalCancel = document.getElementById('pjModalCancel');

    // mode: 'create' (default) or 'edit' (with existing project bound)
    let modalMode = 'create';
    let editingProject = null;

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
        modalMode = 'create';
        editingProject = null;
        modalHeading.textContent = 'New project';
        modalError.textContent = '';
        modalTitle.value = '';
        modalDesc.value = '';
        modalStatusField.style.display = 'none';
        modalSubmit.textContent = 'Create';
        modal.classList.add('is-open');
        modalTitle.focus();
    }
    function openEditModal(p) {
        modalMode = 'edit';
        editingProject = p;
        modalHeading.textContent = 'Edit project';
        modalError.textContent = '';
        modalTitle.value = p.title || '';
        modalDesc.value = p.description || '';
        modalStatusInput.value = p.status || 'in_progress';
        modalStatusField.style.display = '';
        modalSubmit.textContent = 'Save changes';
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

        if (modalMode === 'edit' && editingProject) {
            modalSubmit.disabled = true;
            modalSubmit.textContent = 'Saving…';
            const { error } = await sb.rpc('update_project', {
                p_project_id: editingProject.id,
                p_title: title,
                p_description: desc || null,
                p_status: modalStatusInput.value,
                p_cover_url: editingProject.cover_url || null
            });
            modalSubmit.disabled = false;
            modalSubmit.textContent = 'Save changes';
            if (error) {
                modalError.textContent = error.message || 'Could not save changes.';
                return;
            }
            closeModal();
            renderDetail(editingProject.id);
            return;
        }

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

        function splitName(forename, surname, username) {
            const plain = F.plainName(forename, surname, username);
            const parts = plain.split(/\s+/).filter(Boolean);
            const first = parts.shift() || plain;
            const rest = parts.join(' ');
            return { first, rest };
        }

        const collabCards = (members || []).map((m) => {
            const { first, rest } = splitName(m.forename, m.surname, m.username);
            const initial = (first[0] || '?').toUpperCase();
            const avatar = m.avatar_url
                ? `<div class="collab-card__avatar" style="background-image:url('${escapeHtml(m.avatar_url)}');"></div>`
                : `<div class="collab-card__avatar">${escapeHtml(initial)}</div>`;
            const link = m.username ? `/u/${encodeURIComponent(m.username)}` : '#';
            const role = m.is_owner ? 'OWNER' : 'ARTIST';
            const crown = m.is_owner ? '<span class="collab-card__crown" title="Owner">★</span>' : '';
            const removeBtn = isMember && !m.is_owner && (isOwner || m.user_id === user.id)
                ? `<button class="collab-card__remove" data-remove-member="${escapeHtml(m.user_id)}" aria-label="Remove from project" title="Remove">×</button>`
                : '';
            return `<a class="collab-card" href="${link}">
                <span class="collab-card__role">${escapeHtml(role)}</span>
                ${avatar}
                <span class="collab-card__name">
                    <strong>${escapeHtml(first)}</strong>
                    ${rest ? `<span class="collab-card__name-rest">${escapeHtml(rest)}</span>` : ''}
                </span>
                ${crown}
                ${removeBtn}
            </a>`;
        }).join('');

        const addPersonCard = isMember ? `
            <button type="button" class="collab-card collab-card--add" id="pjAddPersonBtn" aria-label="Add person">
                <span class="collab-card__role">Select function</span>
                <span class="collab-card__avatar">+</span>
                <span class="collab-card__name"><strong>Add</strong><span class="collab-card__name-rest">person</span></span>
            </button>
        ` : '';

        const inviteBlock = isMember ? `
            <div class="pc-invite-row" id="pjInviteRow">
                <input type="text" id="pjInviteInput" placeholder="Invite by username (artists only)…" autocomplete="off">
                <button class="pj-btn" id="pjInviteBtn">Add</button>
            </div>
            <div class="pc-invite-feedback" id="pjInviteFeedback"></div>
        ` : '';

        const approvalRows = (members || []).map((m) => {
            const { first, rest } = splitName(m.forename, m.surname, m.username);
            return `<div class="approval-row">
                <span class="approval-status"></span>
                <span class="approval-row__name"><strong>${escapeHtml(first)}</strong>${rest ? ' ' + escapeHtml(rest) : ''}</span>
            </div>`;
        }).join('');

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
                <button class="pj-btn" id="editProjectBtn">Edit</button>
                <button class="pj-btn pj-btn--ghost pj-btn--danger" id="deleteProjectBtn">Delete project</button>
            </div>
        ` : isMember ? `
            <div class="pj-detail__actions">
                <a class="pj-btn pj-btn--ghost" href="/projects/">← Back</a>
                <button class="pj-btn" id="editProjectBtn">Edit</button>
                <button class="pj-btn pj-btn--ghost pj-btn--danger" id="leaveProjectBtn">Leave project</button>
            </div>
        ` : `
            <div class="pj-detail__actions">
                <a class="pj-btn pj-btn--ghost" href="/projects/">← Projects</a>
            </div>
        `;

        const coverArea = isMember ? `
            <div class="pj-cover-area" id="pjCoverArea"${p.cover_url ? ` style="background-image:url('${escapeHtml(p.cover_url)}');"` : ''}>
                <span class="pj-cover-area__placeholder" id="pjCoverPlaceholder"${p.cover_url ? ' style="display:none;"' : ''}>Click to add a cover</span>
                <span class="pj-cover-area__overlay">${p.cover_url ? 'Change cover' : 'Add cover'}</span>
                <input type="file" id="pjCoverInput" accept="image/jpeg,image/png,image/webp">
            </div>
        ` : (p.cover_url ? `<div class="pj-cover-area pj-cover-area--readonly" style="background-image:url('${escapeHtml(p.cover_url)}');"></div>` : '');

        content.innerHTML = `
            ${coverArea}
            ${ownerActions}

            <div class="project-card-rich">
                <div class="pc-header">
                    <h1 class="pc-name">${escapeHtml(p.title)}</h1>
                    ${status}
                </div>
                <div class="pc-meta">Owned by ${ownerLink} · ${p.member_count} ${p.member_count === 1 ? 'member' : 'members'} · ${p.track_count} ${p.track_count === 1 ? 'track' : 'tracks'}</div>
                ${p.description ? `<p class="pc-desc">${escapeHtml(p.description)}</p>` : ''}

                <div class="collab-row">
                    ${collabCards}
                    ${addPersonCard}
                </div>

                ${inviteBlock}

                <div class="action-sections">
                    <div class="action-section">
                        <h4>Uploads</h4>
                        <div class="action-buttons">
                            <button type="button" class="action-btn" data-upload="wave">WAVE</button>
                            <button type="button" class="action-btn" data-upload="sheet">Sheet Music</button>
                            <button type="button" class="action-btn" data-upload="notes">Notes</button>
                            <button type="button" class="action-btn" data-upload="lyrics">Lyrics</button>
                        </div>
                    </div>

                    <div class="action-section">
                        <h4>Finals</h4>
                        <div class="action-buttons">
                            <button type="button" class="action-btn" data-final="wave">WAVE</button>
                            <button type="button" class="action-btn" data-final="sheet">Sheet Music</button>
                            <button type="button" class="action-btn" data-final="mp3">MP3</button>
                            <button type="button" class="action-btn" data-final="lyrics">Lyrics</button>
                        </div>
                    </div>

                    <div class="action-section">
                        <h4>Royalties</h4>
                        <div class="royalties-buttons">
                            <div class="royalty-column">
                                <button type="button" class="action-btn" data-royalty="mechanical">Mechanical</button>
                                <button type="button" class="action-btn" data-royalty="performance">Performance</button>
                                <button type="button" class="action-btn" data-royalty="covers">Covers</button>
                                <button type="button" class="action-btn" data-royalty="sample">Sample</button>
                            </div>
                            <div class="royalty-column">
                                <button type="button" class="action-btn" data-royalty="synch">Synch</button>
                                <button type="button" class="action-btn" data-royalty="print">Print Music</button>
                                <button type="button" class="action-btn" data-royalty="tutorials">Tutorials</button>
                                <button type="button" class="action-btn" data-royalty="commercial">Commercial</button>
                            </div>
                        </div>
                    </div>

                    <div class="action-section">
                        <h4>Approvals for release</h4>
                        <div class="approval-list">
                            ${approvalRows || '<div style="color:#7E89A6;font-size:12px;">No members yet.</div>'}
                        </div>
                    </div>
                </div>

                <div class="pc-tracks">
                    <h4>Tracks <span style="color:#B1B1B1;font-weight:400;">(${(tracks || []).length})</span></h4>
                    ${trackList}
                </div>
            </div>
        `;

        // Wire actions
        const editBtn = document.getElementById('editProjectBtn');
        if (editBtn && isMember) {
            editBtn.addEventListener('click', () => openEditModal(p));
        }

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

        // Cover upload — any member can change it
        const coverInput = document.getElementById('pjCoverInput');
        if (coverInput && isMember) {
            coverInput.addEventListener('change', async () => {
                const file = coverInput.files?.[0];
                if (!file) return;
                if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
                    alert('Pick a JPG, PNG or WebP image.');
                    coverInput.value = '';
                    return;
                }
                if (file.size > 5 * 1024 * 1024) {
                    alert('Cover image is over 5 MB — pick a smaller one.');
                    coverInput.value = '';
                    return;
                }
                const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
                const path = `${user.id}/project-${id}-${Date.now()}.${ext}`;
                const { error: upErr } = await sb.storage
                    .from('avatars')
                    .upload(path, file, { cacheControl: '3600', upsert: false });
                if (upErr) {
                    alert('Upload failed: ' + (upErr.message || 'try again'));
                    return;
                }
                const { data: pub } = sb.storage.from('avatars').getPublicUrl(path);
                const newUrl = pub.publicUrl;
                const { error: saveErr } = await sb.rpc('update_project', {
                    p_project_id: id,
                    p_title: p.title,
                    p_description: p.description,
                    p_status: p.status,
                    p_cover_url: newUrl
                });
                if (saveErr) {
                    alert('Cover saved to storage but project update failed: ' + (saveErr.message || ''));
                    return;
                }
                renderDetail(id);
            });
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

            const addPersonBtn = document.getElementById('pjAddPersonBtn');
            if (addPersonBtn && inviteInput) {
                addPersonBtn.addEventListener('click', () => {
                    inviteInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => inviteInput.focus(), 200);
                });
            }
        }
    }
})();
