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
               { data: tracks, error: trErr },
               { data: files },
               { data: royalties },
               { data: approvals }] = await Promise.all([
            sb.rpc('get_project', { p_project_id: id }),
            sb.rpc('get_project_members', { p_project_id: id }),
            sb.rpc('get_project_tracks', { p_project_id: id }),
            sb.rpc('get_project_files', { p_project_id: id }),
            sb.rpc('get_project_royalties', { p_project_id: id }),
            sb.rpc('get_project_approvals', { p_project_id: id })
        ]);

        const fileCounts = {};
        (files || []).forEach((f) => {
            if (!fileCounts[f.category]) fileCounts[f.category] = {};
            fileCounts[f.category][f.file_type] = (fileCounts[f.category][f.file_type] || 0) + 1;
        });
        const royaltyConfigured = new Set((royalties || []).map((r) => r.royalty_type));
        const approvalSet = new Set((approvals || []).map((a) => a.user_id));

        function pillFile(cat, type, label) {
            const count = fileCounts[cat]?.[type] || 0;
            const cls = count > 0 ? 'pill-btn has-data' : 'pill-btn';
            const attr = cat === 'uploads' ? `data-upload="${type}"` : `data-final="${type}"`;
            return `<button type="button" class="${cls}" ${attr}>${label}</button>`;
        }
        function pillRoyalty(type, label) {
            const cls = royaltyConfigured.has(type) ? 'pill-btn has-data' : 'pill-btn';
            return `<button type="button" class="${cls}" data-royalty="${type}">${escapeHtml(label)}</button>`;
        }

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
                ? `<div class="collaborator-image" style="background-image:url('${escapeHtml(m.avatar_url)}');"></div>`
                : `<div class="collaborator-image">${escapeHtml(initial)}</div>`;
            const link = m.username ? `/u/${encodeURIComponent(m.username)}` : '#';
            const role = m.is_owner ? 'OWNER' : 'ARTIST';
            const crown = m.is_owner ? '<span class="collaborator-card__crown" title="Owner">★</span>' : '';
            const removeBtn = isMember && !m.is_owner && (isOwner || m.user_id === user.id)
                ? `<button class="collaborator-card__remove" data-remove-member="${escapeHtml(m.user_id)}" aria-label="Remove from project" title="Remove">×</button>`
                : '';
            return `<a class="collaborator-card" href="${link}">
                <span class="collaborator-role">${escapeHtml(role)}</span>
                ${avatar}
                <span class="collaborator-name">
                    <span class="collaborator-name__first">${escapeHtml(first)}</span>
                    ${rest ? `<span class="collaborator-name__rest">${escapeHtml(rest)}</span>` : ''}
                </span>
                ${crown}
                ${removeBtn}
            </a>`;
        }).join('');

        const addPersonCard = isMember ? `
            <button type="button" class="collaborator-card add-person" id="pjAddPersonBtn" aria-label="Add person">
                <span class="collaborator-role">Select function</span>
                <div class="collaborator-image">+</div>
                <span class="collaborator-name">
                    <span class="collaborator-name__first">Add</span>
                    <span class="collaborator-name__rest">person</span>
                </span>
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
            const isApproved = approvalSet.has(m.user_id);
            const isSelf = m.user_id === user.id;
            const cls = `approval-row${isApproved ? ' is-approved' : ''}${isSelf ? ' is-self' : ''}`;
            const titleAttr = isSelf
                ? (isApproved ? 'Click to undo your approval' : 'Click to approve release')
                : (isApproved ? `${first} ${rest} has approved` : `${first} ${rest} has not approved yet`);
            return `<button type="button" class="${cls}"${isSelf ? ' data-approval-toggle="1"' : ''} title="${escapeHtml(titleAttr)}">
                <span class="approval-status"></span>
                <span class="approval-row__name"><strong>${escapeHtml(first)}</strong>${rest ? ' ' + escapeHtml(rest) : ''}</span>
            </button>`;
        }).join('');

        const totalMembers = (members || []).length;
        const approvedCount = approvalSet.size;
        const allApproved = totalMembers > 0 && approvedCount === totalMembers;
        const isAlreadyReleased = p.status === 'released';
        const releaseBtn = `
            <div class="project-release">
                <button type="button" class="project-release__btn" id="releaseProjectBtn"${(allApproved && isOwner && !isAlreadyReleased) ? '' : ' disabled'}>
                    <span class="project-release__progress">${approvedCount} of ${totalMembers} approved</span>
                    <span class="project-release__label">${isAlreadyReleased ? 'Released' : 'Release project'}</span>
                </button>
            </div>
        `;

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
                    <h3 class="pc-name">
                        <span class="pc-name__label">Project name:</span>
                        <span class="pc-name__value">${escapeHtml(p.title)}</span>
                    </h3>
                    ${status}
                </div>
                <div class="pc-meta">Owned by ${ownerLink} · ${p.member_count} ${p.member_count === 1 ? 'member' : 'members'} · ${p.track_count} ${p.track_count === 1 ? 'track' : 'tracks'}</div>

                <div class="pc-body">
                    <div class="pc-left">
                        <div class="project-team">
                            ${collabCards}
                            ${addPersonCard}
                        </div>
                    </div>

                    <div class="project-actions">
                        <div class="button-group">
                            <span class="button-group__label">Uploads</span>
                            <div class="action-col">
                                ${pillFile('uploads', 'wave', 'WAVE')}
                                ${pillFile('uploads', 'sheet', 'Sheet Music')}
                                ${pillFile('uploads', 'notes', 'Notes &amp; Lyrics')}
                                <button type="button" class="pill-btn" data-action="log">Log</button>
                            </div>
                        </div>

                        <div class="button-group">
                            <span class="button-group__label">Finals</span>
                            <div class="action-col">
                                ${pillFile('finals', 'mp3', 'WAVE/MP3')}
                                ${pillFile('finals', 'sheet', 'Sheet Music')}
                                ${pillFile('finals', 'image', 'Image')}
                                ${pillFile('finals', 'lyrics', 'Lyrics')}
                            </div>
                        </div>

                        <div class="button-group button-group--royalties">
                            <span class="button-group__label">Royalties</span>
                            <div class="royalties-cols">
                                <div class="action-col">
                                    ${pillRoyalty('mechanical', 'Mechanical')}
                                    ${pillRoyalty('performance', 'Performance')}
                                    ${pillRoyalty('covers', 'Covers')}
                                    ${pillRoyalty('sample', 'Sample')}
                                </div>
                                <div class="action-col">
                                    ${pillRoyalty('synch', 'Synch')}
                                    ${pillRoyalty('print', 'Print Music')}
                                    ${pillRoyalty('tutorials', 'Tutorials')}
                                    ${pillRoyalty('commercial', 'Commercial')}
                                </div>
                            </div>
                        </div>

                        <div class="button-group button-group--approvals">
                            <span class="button-group__label">Approvals for release</span>
                            <div class="project-approvals">
                                ${approvalRows || '<div style="color:#7E89A6;font-size:12px;">No members yet.</div>'}
                            </div>
                            ${releaseBtn}
                        </div>
                    </div>
                </div>

                ${p.description ? `<p class="pc-desc">${escapeHtml(p.description)}</p>` : ''}

                ${inviteBlock}

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

        const FILE_TYPE_LABELS = {
            wave: 'WAVE', sheet: 'Sheet Music', notes: 'Notes & Lyrics', lyrics: 'Lyrics',
            mp3: 'WAVE/MP3', image: 'Image'
        };
        const ROYALTY_LABELS = {
            mechanical: 'Mechanical', performance: 'Performance', covers: 'Covers', sample: 'Sample',
            synch: 'Synch', print: 'Print Music', tutorials: 'Tutorials', commercial: 'Commercial'
        };

        content.querySelectorAll('[data-upload]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const t = btn.getAttribute('data-upload');
                openFilesModal({
                    projectId: id, category: 'uploads', fileType: t, isMember,
                    label: 'Uploads · ' + (FILE_TYPE_LABELS[t] || t),
                    onClose: () => renderDetail(id)
                });
            });
        });
        content.querySelectorAll('[data-final]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const t = btn.getAttribute('data-final');
                openFilesModal({
                    projectId: id, category: 'finals', fileType: t, isMember,
                    label: 'Finals · ' + (FILE_TYPE_LABELS[t] || t),
                    onClose: () => renderDetail(id)
                });
            });
        });
        content.querySelectorAll('[data-royalty]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const t = btn.getAttribute('data-royalty');
                openRoyaltyModal({
                    projectId: id, royaltyType: t,
                    label: ROYALTY_LABELS[t] || t,
                    members: members || [], isOwner,
                    onClose: () => renderDetail(id)
                });
            });
        });
        content.querySelectorAll('[data-approval-toggle]').forEach((row) => {
            row.addEventListener('click', async () => {
                row.style.opacity = '0.6';
                row.style.pointerEvents = 'none';
                const { error } = await sb.rpc('toggle_project_approval', { p_project_id: id });
                if (error) {
                    alert('Could not toggle approval: ' + (error.message || ''));
                    row.style.opacity = '';
                    row.style.pointerEvents = '';
                    return;
                }
                renderDetail(id);
            });
        });

        content.querySelectorAll('[data-action="log"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                alert('Project activity log — coming in the next milestone.');
            });
        });

        const releaseBtnEl = document.getElementById('releaseProjectBtn');
        if (releaseBtnEl && !releaseBtnEl.disabled) {
            releaseBtnEl.addEventListener('click', async () => {
                if (!confirm(`Release "${p.title}"? This marks the project as released for everyone.`)) return;
                releaseBtnEl.disabled = true;
                const { error } = await sb.rpc('update_project', {
                    p_project_id: id,
                    p_title: p.title,
                    p_description: p.description,
                    p_status: 'released',
                    p_cover_url: p.cover_url || null
                });
                if (error) {
                    alert('Could not release: ' + (error.message || ''));
                    releaseBtnEl.disabled = false;
                    return;
                }
                renderDetail(id);
            });
        }
    }

    // ===========================================================
    // Files modal — list + upload + delete for one (category, type)
    // ===========================================================
    const filesModal = document.getElementById('pjFilesModal');
    const filesModalTitle = document.getElementById('pjFilesModalTitle');
    const filesList = document.getElementById('pjFilesList');
    const fileInput = document.getElementById('pjFileInput');
    const fileUploadBtn = document.getElementById('pjFileUploadBtn');
    const fileStatus = document.getElementById('pjFileStatus');
    const filesClose = document.getElementById('pjFilesClose');

    let filesState = null;

    function closeFilesModal() {
        filesModal.classList.remove('is-open');
        const cb = filesState?.onClose;
        filesState = null;
        if (cb) cb();
    }
    function setFileStatus(text, kind) {
        fileStatus.className = 'pj-file-status';
        if (kind) fileStatus.classList.add('is-' + kind);
        fileStatus.textContent = text || '';
    }
    filesClose.addEventListener('click', closeFilesModal);
    filesModal.addEventListener('click', (e) => { if (e.target === filesModal) closeFilesModal(); });

    async function refreshFilesList() {
        if (!filesState) return;
        filesList.innerHTML = `<div style="color:#7E89A6;font-size:13px;text-align:center;padding:24px;">Loading…</div>`;
        const { data, error } = await sb.rpc('get_project_files', { p_project_id: filesState.projectId });
        if (error) {
            filesList.innerHTML = `<div style="color:#FF6B6B;font-size:13px;text-align:center;padding:24px;">${escapeHtml(error.message || 'Failed to load files')}</div>`;
            return;
        }
        const my = (data || []).filter((f) => f.category === filesState.category && f.file_type === filesState.fileType);
        if (my.length === 0) { filesList.innerHTML = ''; return; }
        filesList.innerHTML = my.map((f) => {
            const styled = F.formatName(f.uploader_forename, f.uploader_surname, f.uploader_username || 'Someone');
            const date = new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const sz = f.file_size ? (f.file_size > 1024 * 1024 ? `${(f.file_size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(f.file_size / 1024)} KB`) : '';
            return `<div class="pj-file-row">
                <div class="pj-file-row__info">
                    <div class="pj-file-row__name">${escapeHtml(f.file_name)}</div>
                    <div class="pj-file-row__meta">By ${styled} · ${escapeHtml(date)}${sz ? ' · ' + escapeHtml(sz) : ''}</div>
                </div>
                <a class="pj-file-row__open" href="${escapeHtml(f.file_url)}" target="_blank" rel="noopener">Open</a>
                ${filesState.isMember ? `<button type="button" class="pj-file-row__del" data-file-del="${escapeHtml(f.id)}" data-file-path="${escapeHtml(f.file_path)}">Delete</button>` : ''}
            </div>`;
        }).join('');
        filesList.querySelectorAll('[data-file-del]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this file?')) return;
                const fileId = btn.getAttribute('data-file-del');
                const filePath = btn.getAttribute('data-file-path');
                btn.disabled = true;
                const { data: returnedPath, error } = await sb.rpc('remove_project_file', { p_file_id: fileId });
                if (error) {
                    alert('Could not delete: ' + (error.message || ''));
                    btn.disabled = false;
                    return;
                }
                await sb.storage.from('project-files').remove([returnedPath || filePath]).catch(() => {});
                refreshFilesList();
            });
        });
    }

    function openFilesModal({ projectId, category, fileType, isMember, label, onClose }) {
        filesState = { projectId, category, fileType, isMember, onClose };
        filesModalTitle.textContent = label;
        setFileStatus('', null);
        fileUploadBtn.style.display = isMember ? '' : 'none';
        filesModal.classList.add('is-open');
        refreshFilesList();
    }

    fileUploadBtn.addEventListener('click', () => {
        if (!filesState?.isMember) return;
        fileInput.value = '';
        fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file || !filesState) return;
        if (file.size > 200 * 1024 * 1024) {
            setFileStatus('File too large (max 200 MB)', 'error');
            return;
        }
        setFileStatus(`Uploading ${file.name}…`, null);
        fileUploadBtn.disabled = true;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${filesState.projectId}/${filesState.category}-${filesState.fileType}-${Date.now()}-${safeName}`;
        const { error: upErr } = await sb.storage.from('project-files').upload(path, file, { upsert: false });
        if (upErr) {
            setFileStatus('Upload failed: ' + (upErr.message || ''), 'error');
            fileUploadBtn.disabled = false;
            return;
        }
        const { data: pub } = sb.storage.from('project-files').getPublicUrl(path);
        const { error: insErr } = await sb.rpc('add_project_file', {
            p_project_id: filesState.projectId,
            p_category: filesState.category,
            p_file_type: filesState.fileType,
            p_file_name: file.name,
            p_file_path: path,
            p_file_url: pub.publicUrl,
            p_file_size: file.size
        });
        fileUploadBtn.disabled = false;
        if (insErr) {
            sb.storage.from('project-files').remove([path]).catch(() => {});
            setFileStatus('Save failed: ' + (insErr.message || ''), 'error');
            return;
        }
        setFileStatus('Uploaded ✓', 'success');
        setTimeout(() => setFileStatus('', null), 2000);
        refreshFilesList();
    });

    // ===========================================================
    // Royalty modal — per-member percentage split per royalty type
    // ===========================================================
    const royaltyModal = document.getElementById('pjRoyaltyModal');
    const royaltyModalTitle = document.getElementById('pjRoyaltyModalTitle');
    const royaltyRowsEl = document.getElementById('pjRoyaltyRows');
    const royaltyTotalVal = document.getElementById('pjRoyaltyTotalVal');
    const royaltyTotalRow = royaltyTotalVal.closest('.pj-royalty-total');
    const royaltyError = document.getElementById('pjRoyaltyError');
    const royaltyReadonly = document.getElementById('pjRoyaltyReadonly');
    const royaltyCancel = document.getElementById('pjRoyaltyCancel');
    const royaltyEqualize = document.getElementById('pjRoyaltyEqualize');
    const royaltySave = document.getElementById('pjRoyaltySave');

    let royaltyState = null;

    function closeRoyaltyModal() {
        royaltyModal.classList.remove('is-open');
        const cb = royaltyState?.onClose;
        royaltyState = null;
        if (cb) cb();
    }
    royaltyCancel.addEventListener('click', closeRoyaltyModal);
    royaltyModal.addEventListener('click', (e) => { if (e.target === royaltyModal) closeRoyaltyModal(); });

    function recomputeRoyaltyTotal() {
        const inputs = royaltyRowsEl.querySelectorAll('.pj-royalty-row__input');
        let total = 0;
        inputs.forEach((inp) => {
            const v = parseFloat(inp.value);
            if (!isNaN(v)) total += v;
        });
        royaltyTotalVal.textContent = total.toFixed(2);
        royaltyTotalRow.classList.remove('is-valid', 'is-invalid');
        royaltyTotalRow.classList.add(Math.abs(total - 100) < 0.01 ? 'is-valid' : 'is-invalid');
        return total;
    }

    royaltyEqualize.addEventListener('click', () => {
        if (!royaltyState || !royaltyState.isOwner) return;
        const inputs = royaltyRowsEl.querySelectorAll('.pj-royalty-row__input');
        const n = inputs.length;
        if (n === 0) return;
        const each = Math.floor((100 / n) * 100) / 100;
        let used = 0;
        inputs.forEach((inp, i) => {
            if (i === n - 1) inp.value = (100 - used).toFixed(2);
            else { inp.value = each.toFixed(2); used += each; }
        });
        recomputeRoyaltyTotal();
    });

    royaltySave.addEventListener('click', async () => {
        if (!royaltyState || !royaltyState.isOwner) return;
        const inputs = royaltyRowsEl.querySelectorAll('.pj-royalty-row__input');
        const userIds = [], percentages = [];
        inputs.forEach((inp) => {
            userIds.push(inp.getAttribute('data-user-id'));
            const v = parseFloat(inp.value);
            percentages.push(isNaN(v) ? 0 : v);
        });
        const total = percentages.reduce((s, n) => s + n, 0);
        if (Math.abs(total - 100) > 0.01) {
            royaltyError.textContent = `Percentages must sum to 100 (currently ${total.toFixed(2)}).`;
            return;
        }
        royaltyError.textContent = '';
        royaltySave.disabled = true;
        royaltySave.textContent = 'Saving…';
        const { error } = await sb.rpc('set_project_royalties', {
            p_project_id: royaltyState.projectId,
            p_royalty_type: royaltyState.royaltyType,
            p_user_ids: userIds,
            p_percentages: percentages
        });
        royaltySave.disabled = false;
        royaltySave.textContent = 'Save';
        if (error) {
            royaltyError.textContent = error.message || 'Could not save.';
            return;
        }
        closeRoyaltyModal();
    });

    async function openRoyaltyModal({ projectId, royaltyType, label, members, isOwner, onClose }) {
        royaltyState = { projectId, royaltyType, members, isOwner, onClose };
        royaltyModalTitle.textContent = label + ' royalties';
        royaltyError.textContent = '';
        royaltyReadonly.hidden = isOwner;
        royaltySave.style.display = isOwner ? '' : 'none';
        royaltyEqualize.style.display = isOwner ? '' : 'none';

        const { data: existing } = await sb.rpc('get_project_royalties', { p_project_id: projectId });
        const existingMap = {};
        (existing || []).filter((r) => r.royalty_type === royaltyType).forEach((r) => {
            existingMap[r.user_id] = Number(r.percentage);
        });

        royaltyRowsEl.innerHTML = (members || []).map((m) => {
            const plain = F.plainName(m.forename, m.surname, m.username);
            const parts = plain.split(/\s+/).filter(Boolean);
            const first = parts.shift() || plain;
            const rest = parts.join(' ');
            const initial = (first[0] || '?').toUpperCase();
            const avatar = m.avatar_url
                ? `<div class="pj-royalty-row__avatar" style="background-image:url('${escapeHtml(m.avatar_url)}');"></div>`
                : `<div class="pj-royalty-row__avatar">${escapeHtml(initial)}</div>`;
            const val = (existingMap[m.user_id] ?? 0).toFixed(2);
            return `<div class="pj-royalty-row">
                ${avatar}
                <span class="pj-royalty-row__name"><strong>${escapeHtml(first)}</strong>${rest ? ' ' + escapeHtml(rest) : ''}</span>
                <input type="number" min="0" max="100" step="0.01" class="pj-royalty-row__input" value="${val}" data-user-id="${escapeHtml(m.user_id)}"${isOwner ? '' : ' readonly'}>
                <span class="pj-royalty-row__pct">%</span>
            </div>`;
        }).join('');

        royaltyRowsEl.querySelectorAll('.pj-royalty-row__input').forEach((inp) => {
            inp.addEventListener('input', recomputeRoyaltyTotal);
        });
        recomputeRoyaltyTotal();
        royaltyModal.classList.add('is-open');
    }
})();
