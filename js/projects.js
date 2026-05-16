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
            content.innerHTML = head + `<div class="pj-rich-list">${rows.map((p) => `
                <div class="pj-rich-host" data-project-host="${escapeHtml(p.id)}">
                    <div class="pj-empty">Loading ${escapeHtml(p.title)}…</div>
                </div>
            `).join('')}</div>`;

            // Render each project as a fully wired rich card into its own host
            rows.forEach((p) => {
                const host = content.querySelector(`[data-project-host="${CSS.escape(p.id)}"]`);
                if (host) renderDetail(p.id, host);
            });
        }

        const newBtn = document.getElementById('newProjectBtn');
        if (newBtn) newBtn.addEventListener('click', openModal);
    }

    async function renderDetail(id, host) {
        if (!host) host = content;
        const cardPrefix = 'pj-' + String(id).replace(/-/g, '').slice(0, 12);
        const pid = (name) => `${cardPrefix}-${name}`;
        host.innerHTML = `<div class="pj-empty">Loading project…</div>`;

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
            host.innerHTML = `<div class="pj-empty">
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

        // Only set the page title when this card owns the whole page
        if (host === content) {
            if (window.STAGECORD_AppShell) window.STAGECORD_AppShell.setTitle(p.title);
            document.title = `${p.title} · STAGECORD`;
        }

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
            <button type="button" class="collaborator-card add-person" id="${pid('pjAddPersonBtn')}" aria-label="Add person">
                <span class="collaborator-role">Select function</span>
                <div class="collaborator-image">+</div>
                <span class="collaborator-name">
                    <span class="collaborator-name__first">Add</span>
                    <span class="collaborator-name__rest">person</span>
                </span>
            </button>
        ` : '';

        // Invite-by-username row is gone — members are added through the
        // search modal that opens when the + Add person card is clicked.
        const inviteBlock = '';

        const approvalRows = (members || []).map((m) => {
            const { first, rest } = splitName(m.forename, m.surname, m.username);
            const isApproved = approvalSet.has(m.user_id);
            const isSelf = m.user_id === user.id;
            const cls = `approval-row${isApproved ? ' is-approved' : ''}${isSelf ? ' is-self' : ''}`;
            const titleAttr = isSelf
                ? (isApproved ? 'Your approval — click to manage' : 'Click to approve release')
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
                <button type="button" class="project-release__btn" id="${pid('releaseProjectBtn')}"${(allApproved && isOwner && !isAlreadyReleased) ? '' : ' disabled'}>
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

        const isListMode = host !== content;
        const backLink = isListMode ? '' : '<a class="pj-btn pj-btn--ghost" href="/projects/">← Back</a>';
        // In list mode (matches prototype), hide the heavy owner-action row.
        // Edit / Delete / Leave are reached via the small kebab menu inside
        // each card header. On the deep-link view (?id=X) keep the toolbar.
        const ownerActions = isListMode ? '' : (isOwner ? `
            <div class="pj-detail__actions">
                ${backLink}
                <button class="pj-btn" id="${pid('editProjectBtn')}">Edit</button>
                <button class="pj-btn pj-btn--ghost pj-btn--danger" id="${pid('deleteProjectBtn')}">Delete project</button>
            </div>
        ` : isMember ? `
            <div class="pj-detail__actions">
                ${backLink}
                <button class="pj-btn" id="${pid('editProjectBtn')}">Edit</button>
                <button class="pj-btn pj-btn--ghost pj-btn--danger" id="${pid('leaveProjectBtn')}">Leave project</button>
            </div>
        ` : `
            <div class="pj-detail__actions">
                <a class="pj-btn pj-btn--ghost" href="/projects/">← Projects</a>
            </div>
        `);

        // Small in-card kebab menu (top-right) — gives quick Edit / Delete /
        // Leave access on the list view without recreating the loud toolbar.
        // In deep-link mode the toolbar above already exposes these actions,
        // so we skip the kebab to avoid duplicate IDs.
        const cardMenu = (isListMode && isMember) ? `
            <div class="pc-menu" data-pj-menu>
                <button type="button" class="pc-menu__trigger" aria-haspopup="true" aria-expanded="false" title="Project actions">⋯</button>
                <div class="pc-menu__dropdown" hidden>
                    <button type="button" class="pc-menu__item" id="${pid('editProjectBtn')}">Edit project</button>
                    ${isOwner
                        ? `<button type="button" class="pc-menu__item pc-menu__item--danger" id="${pid('deleteProjectBtn')}">Delete project</button>`
                        : `<button type="button" class="pc-menu__item pc-menu__item--danger" id="${pid('leaveProjectBtn')}">Leave project</button>`}
                </div>
            </div>
        ` : '';

        // Cover area only renders on the single-project deep-link view;
        // the list view matches the prototype which has no per-card cover.
        const coverArea = isListMode ? '' : (isMember ? `
            <div class="pj-cover-area" id="${pid('pjCoverArea')}"${p.cover_url ? ` style="background-image:url('${escapeHtml(p.cover_url)}');"` : ''}>
                <span class="pj-cover-area__placeholder" id="${pid('pjCoverPlaceholder')}"${p.cover_url ? ' style="display:none;"' : ''}>Click to add a cover</span>
                <span class="pj-cover-area__overlay">${p.cover_url ? 'Change cover' : 'Add cover'}</span>
                <input type="file" id="${pid('pjCoverInput')}" accept="image/jpeg,image/png,image/webp">
            </div>
        ` : (p.cover_url ? `<div class="pj-cover-area pj-cover-area--readonly" style="background-image:url('${escapeHtml(p.cover_url)}');"></div>` : ''));

        host.innerHTML = `
            ${coverArea}
            ${ownerActions}

            <div class="project-card-rich">
                ${cardMenu}

                <div class="pc-body">
                    <div class="pc-left">
                        <div class="pc-header">
                            <h3 class="pc-name">
                                <span class="pc-name__label">Project name:</span>
                                <span class="pc-name__value">${escapeHtml(p.title)}</span>
                            </h3>
                            ${status}
                        </div>
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

                <div class="pc-expand" data-pj-expand hidden></div>

                ${p.description ? `<p class="pc-desc">${escapeHtml(p.description)}</p>` : ''}
            </div>
        `;

        // Wire actions
        const editBtn = document.getElementById(pid('editProjectBtn'));
        if (editBtn && isMember) {
            editBtn.addEventListener('click', () => openEditModal(p));
        }

        if (isOwner) {
            const delBtn = document.getElementById(pid('deleteProjectBtn'));
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
        const coverInput = document.getElementById(pid('pjCoverInput'));
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
                renderDetail(id, host);
            });
        }

        const leaveBtn = document.getElementById(pid('leaveProjectBtn'));
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
            host.querySelectorAll('[data-remove-member]').forEach((btn) => {
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
                    renderDetail(id, host);
                });
            });

            host.querySelectorAll('[data-remove-track]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Remove this track from the project?')) return;
                    const trackId = btn.getAttribute('data-remove-track');
                    const { error } = await sb.rpc('remove_track_from_project', { p_project_id: id, p_track_id: trackId });
                    if (error) {
                        alert('Could not remove: ' + (error.message || 'try again'));
                        return;
                    }
                    renderDetail(id, host);
                });
            });

            const addPersonBtn = document.getElementById(pid('pjAddPersonBtn'));
            if (addPersonBtn) {
                addPersonBtn.addEventListener('click', () => {
                    openAddMemberModal({
                        projectId: id,
                        projectTitle: p.title,
                        existingMemberIds: new Set((members || []).map((m) => m.user_id)),
                        onClose: () => renderDetail(id, host)
                    });
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

        // Inline expansion panel — replaces popup modals. Clicking the same
        // pill twice closes it; clicking a different pill swaps the content.
        const expandEl = host.querySelector('[data-pj-expand]');
        let activeKey = null;

        function closeExpand() {
            activeKey = null;
            expandEl.hidden = true;
            expandEl.innerHTML = '';
            host.querySelectorAll('.pill-btn--open').forEach((b) => b.classList.remove('pill-btn--open'));
        }

        function markActiveBtn(btn) {
            host.querySelectorAll('.pill-btn--open').forEach((b) => b.classList.remove('pill-btn--open'));
            if (btn) btn.classList.add('pill-btn--open');
        }

        async function expandFiles(category, fileType, label, triggerBtn) {
            const key = `${category}:${fileType}`;
            if (activeKey === key) { closeExpand(); return; }
            activeKey = key;
            markActiveBtn(triggerBtn);
            expandEl.hidden = false;
            expandEl.innerHTML = `
                <div class="pc-expand__head">
                    <h4 class="pc-expand__title">${escapeHtml(label)}</h4>
                    <button type="button" class="pc-expand__close" data-expand-close>Close</button>
                </div>
                <p class="pc-expand__hint">${isMember ? 'Upload working files and share them with the rest of the team. Click a file to open, or remove it with the × button.' : 'Sign in as a project member to upload or remove files.'}</p>
                <div class="pj-files-list" data-expand-files><div style="color:#BFD7FF;font-size:13px;text-align:center;padding:18px;">Loading files…</div></div>
                ${isMember ? `
                    <div class="pc-expand__actions">
                        <input type="file" hidden data-expand-file-input>
                        <button type="button" class="pj-btn" data-expand-upload>Upload new file</button>
                        <span class="pc-expand__status" data-expand-file-status></span>
                    </div>
                ` : ''}
            `;

            expandEl.querySelector('[data-expand-close]').addEventListener('click', closeExpand);

            async function refreshFiles() {
                const { data, error } = await sb.rpc('get_project_files', { p_project_id: id });
                const list = expandEl.querySelector('[data-expand-files]');
                if (!list) return;
                if (error) {
                    list.innerHTML = `<div class="pj-am-empty">${escapeHtml(error.message || 'Failed to load')}</div>`;
                    return;
                }
                const my = (data || []).filter((f) => f.category === category && f.file_type === fileType);
                if (my.length === 0) { list.innerHTML = `<div style="color:#BFD7FF;font-size:13px;padding:14px 4px;opacity:0.85;">No files in this category yet.</div>`; return; }
                list.innerHTML = my.map((f) => {
                    const styled = F.formatName(f.uploader_forename, f.uploader_surname, f.uploader_username || 'Someone');
                    const date = new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const sz = f.file_size ? (f.file_size > 1024 * 1024 ? `${(f.file_size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(f.file_size / 1024)} KB`) : '';
                    return `<div class="pj-file-row">
                        <div class="pj-file-row__info">
                            <div class="pj-file-row__name">${escapeHtml(f.file_name)}</div>
                            <div class="pj-file-row__meta">By ${styled} · ${escapeHtml(date)}${sz ? ' · ' + escapeHtml(sz) : ''}</div>
                        </div>
                        <a class="pj-file-row__open" href="${escapeHtml(f.file_url)}" target="_blank" rel="noopener">Open</a>
                        ${isMember ? `<button type="button" class="pj-file-row__del" data-file-del="${escapeHtml(f.id)}" data-file-path="${escapeHtml(f.file_path)}">Delete</button>` : ''}
                    </div>`;
                }).join('');
                list.querySelectorAll('[data-file-del]').forEach((b) => {
                    b.addEventListener('click', async () => {
                        if (!confirm('Delete this file?')) return;
                        const fileId = b.getAttribute('data-file-del');
                        const filePath = b.getAttribute('data-file-path');
                        b.disabled = true;
                        const { data: returnedPath, error: dErr } = await sb.rpc('remove_project_file', { p_file_id: fileId });
                        if (dErr) { alert('Could not delete: ' + (dErr.message || '')); b.disabled = false; return; }
                        await sb.storage.from('project-files').remove([returnedPath || filePath]).catch(() => {});
                        refreshFiles();
                    });
                });
            }
            refreshFiles();

            if (isMember) {
                const uploadBtn = expandEl.querySelector('[data-expand-upload]');
                const fileInput = expandEl.querySelector('[data-expand-file-input]');
                const statusEl = expandEl.querySelector('[data-expand-file-status]');
                function setStatus(text, kind) {
                    statusEl.className = 'pc-expand__status';
                    if (kind) statusEl.classList.add('is-' + kind);
                    statusEl.textContent = text || '';
                }
                uploadBtn.addEventListener('click', () => { fileInput.value = ''; fileInput.click(); });
                fileInput.addEventListener('change', async () => {
                    const file = fileInput.files?.[0];
                    if (!file) return;
                    if (file.size > 200 * 1024 * 1024) { setStatus('File too large (max 200 MB)', 'error'); return; }
                    setStatus(`Uploading ${file.name}…`, null);
                    uploadBtn.disabled = true;
                    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const path = `${id}/${category}-${fileType}-${Date.now()}-${safeName}`;
                    const { error: upErr } = await sb.storage.from('project-files').upload(path, file, { upsert: false });
                    if (upErr) { setStatus('Upload failed: ' + (upErr.message || ''), 'error'); uploadBtn.disabled = false; return; }
                    const { data: pub } = sb.storage.from('project-files').getPublicUrl(path);
                    const { error: insErr } = await sb.rpc('add_project_file', {
                        p_project_id: id, p_category: category, p_file_type: fileType,
                        p_file_name: file.name, p_file_path: path, p_file_url: pub.publicUrl, p_file_size: file.size
                    });
                    uploadBtn.disabled = false;
                    if (insErr) {
                        sb.storage.from('project-files').remove([path]).catch(() => {});
                        setStatus('Save failed: ' + (insErr.message || ''), 'error');
                        return;
                    }
                    setStatus('Uploaded ✓', 'success');
                    setTimeout(() => setStatus('', null), 2200);
                    refreshFiles();
                });
            }
        }

        async function expandRoyalty(royaltyType, label, triggerBtn) {
            const key = `royalty:${royaltyType}`;
            if (activeKey === key) { closeExpand(); return; }
            activeKey = key;
            markActiveBtn(triggerBtn);
            expandEl.hidden = false;
            expandEl.innerHTML = `
                <div class="pc-expand__head">
                    <h4 class="pc-expand__title">${escapeHtml(label)} royalties</h4>
                    <button type="button" class="pc-expand__close" data-expand-close>Close</button>
                </div>
                <p class="pc-expand__hint">${isOwner ? 'Set how this royalty is split between the project members. The total must sum to 100%.' : 'Only the project owner can change royalty splits. You can see the current split below.'}</p>
                <div class="pj-royalty-rows" data-expand-roy-rows></div>
                <div class="pj-royalty-total">
                    <span>Total</span>
                    <span><span class="pj-royalty-total__val" data-expand-roy-total>0.00</span> / 100.00 %</span>
                </div>
                <div class="pc-expand__status" data-expand-roy-status></div>
                ${isOwner ? `
                    <div class="pc-expand__actions">
                        <button type="button" class="pj-btn pj-btn--ghost" data-expand-roy-equal>Split evenly</button>
                        <button type="button" class="pj-btn" data-expand-roy-save>Save</button>
                    </div>
                ` : ''}
            `;
            expandEl.querySelector('[data-expand-close]').addEventListener('click', closeExpand);

            const rowsEl = expandEl.querySelector('[data-expand-roy-rows]');
            const totalEl = expandEl.querySelector('[data-expand-roy-total]');
            const totalRow = totalEl.closest('.pj-royalty-total');
            const statusEl = expandEl.querySelector('[data-expand-roy-status]');
            function setStatus(text, kind) {
                statusEl.className = 'pc-expand__status';
                if (kind) statusEl.classList.add('is-' + kind);
                statusEl.textContent = text || '';
            }

            const { data: existing } = await sb.rpc('get_project_royalties', { p_project_id: id });
            const existingMap = {};
            (existing || []).filter((r) => r.royalty_type === royaltyType).forEach((r) => {
                existingMap[r.user_id] = Number(r.percentage);
            });

            rowsEl.innerHTML = (members || []).map((m) => {
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

            function recompute() {
                const inputs = rowsEl.querySelectorAll('.pj-royalty-row__input');
                let total = 0;
                inputs.forEach((inp) => { const v = parseFloat(inp.value); if (!isNaN(v)) total += v; });
                totalEl.textContent = total.toFixed(2);
                totalRow.classList.remove('is-valid', 'is-invalid');
                totalRow.classList.add(Math.abs(total - 100) < 0.01 ? 'is-valid' : 'is-invalid');
            }
            rowsEl.querySelectorAll('.pj-royalty-row__input').forEach((inp) => inp.addEventListener('input', recompute));
            recompute();

            if (isOwner) {
                expandEl.querySelector('[data-expand-roy-equal]').addEventListener('click', () => {
                    const inputs = rowsEl.querySelectorAll('.pj-royalty-row__input');
                    const n = inputs.length; if (n === 0) return;
                    const each = Math.floor((100 / n) * 100) / 100;
                    let used = 0;
                    inputs.forEach((inp, i) => {
                        if (i === n - 1) inp.value = (100 - used).toFixed(2);
                        else { inp.value = each.toFixed(2); used += each; }
                    });
                    recompute();
                });
                expandEl.querySelector('[data-expand-roy-save]').addEventListener('click', async (e) => {
                    const btn = e.currentTarget;
                    const inputs = rowsEl.querySelectorAll('.pj-royalty-row__input');
                    const userIds = [], pcts = [];
                    inputs.forEach((inp) => {
                        userIds.push(inp.getAttribute('data-user-id'));
                        const v = parseFloat(inp.value); pcts.push(isNaN(v) ? 0 : v);
                    });
                    const total = pcts.reduce((s, n) => s + n, 0);
                    if (Math.abs(total - 100) > 0.01) {
                        setStatus(`Percentages must sum to 100 (currently ${total.toFixed(2)}).`, 'error');
                        return;
                    }
                    setStatus('Saving…', null);
                    btn.disabled = true;
                    const { error } = await sb.rpc('set_project_royalties', {
                        p_project_id: id, p_royalty_type: royaltyType,
                        p_user_ids: userIds, p_percentages: pcts
                    });
                    btn.disabled = false;
                    if (error) { setStatus(error.message || 'Could not save.', 'error'); return; }
                    setStatus('Saved ✓', 'success');
                    // Refresh the host so the button gets the has-data highlight
                    setTimeout(() => renderDetail(id, host), 600);
                });
            }
        }

        async function expandApproval(triggerRow) {
            const key = 'approval:self';
            if (activeKey === key) { closeExpand(); return; }
            activeKey = key;
            markActiveBtn(triggerRow);
            expandEl.hidden = false;

            const isApproved = approvalSet.has(user.id);
            const approvedNow = approvalSet.size;
            const totalNow = (members || []).length;

            expandEl.innerHTML = `
                <div class="pc-expand__head">
                    <h4 class="pc-expand__title">Your approval for release</h4>
                    <button type="button" class="pc-expand__close" data-expand-close>Close</button>
                </div>
                <p class="pc-expand__hint">${isApproved
                    ? 'You have approved this project for release. You can undo your approval at any time before everyone has signed off.'
                    : 'Approving means you accept the project is ready to release. Once every member has approved, the project owner can hit Release project to mark it released.'}</p>
                <p class="pc-expand__hint" style="margin-top:-6px;">
                    <strong style="color:#FFFFFF;">${approvedNow} of ${totalNow}</strong>
                    ${totalNow === 1 ? 'member has' : 'members have'} approved so far.
                </p>
                <div class="pc-expand__actions">
                    <button type="button" class="pj-btn" data-expand-approve>
                        ${isApproved ? 'Undo my approval' : 'Approve release'}
                    </button>
                </div>
                <div class="pc-expand__status" data-expand-app-status></div>
            `;

            expandEl.querySelector('[data-expand-close]').addEventListener('click', closeExpand);

            const statusEl = expandEl.querySelector('[data-expand-app-status]');
            function setStatus(text, kind) {
                statusEl.className = 'pc-expand__status';
                if (kind) statusEl.classList.add('is-' + kind);
                statusEl.textContent = text || '';
            }

            expandEl.querySelector('[data-expand-approve]').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                setStatus('Saving…', null);
                const { error } = await sb.rpc('toggle_project_approval', { p_project_id: id });
                if (error) {
                    setStatus('Could not save: ' + (error.message || ''), 'error');
                    btn.disabled = false;
                    return;
                }
                setStatus('Saved ✓', 'success');
                setTimeout(() => renderDetail(id, host), 600);
            });
        }

        host.querySelectorAll('[data-upload]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const t = btn.getAttribute('data-upload');
                expandFiles('uploads', t, 'Uploads · ' + (FILE_TYPE_LABELS[t] || t), btn);
            });
        });
        host.querySelectorAll('[data-final]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const t = btn.getAttribute('data-final');
                expandFiles('finals', t, 'Finals · ' + (FILE_TYPE_LABELS[t] || t), btn);
            });
        });
        host.querySelectorAll('[data-royalty]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const t = btn.getAttribute('data-royalty');
                expandRoyalty(t, ROYALTY_LABELS[t] || t, btn);
            });
        });
        host.querySelectorAll('[data-approval-toggle]').forEach((row) => {
            row.addEventListener('click', () => { expandApproval(row); });
        });

        host.querySelectorAll('[data-action="log"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                alert('Project activity log — coming in the next milestone.');
            });
        });

        // Kebab menu toggle (list view only)
        const menuEl = host.querySelector('[data-pj-menu]');
        if (menuEl) {
            const trigger = menuEl.querySelector('.pc-menu__trigger');
            const dropdown = menuEl.querySelector('.pc-menu__dropdown');
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = !dropdown.hidden;
                // Close any other open menus first
                document.querySelectorAll('.pc-menu__dropdown').forEach((d) => { d.hidden = true; });
                document.querySelectorAll('.pc-menu__trigger').forEach((t) => t.setAttribute('aria-expanded', 'false'));
                if (!open) {
                    dropdown.hidden = false;
                    trigger.setAttribute('aria-expanded', 'true');
                }
            });
            document.addEventListener('click', (e) => {
                if (!menuEl.contains(e.target)) {
                    dropdown.hidden = true;
                    trigger.setAttribute('aria-expanded', 'false');
                }
            });
        }

        const releaseBtnEl = document.getElementById(pid('releaseProjectBtn'));
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
                renderDetail(id, host);
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

    // ===========================================================
    // Add member modal — search artists and add to project
    // ===========================================================
    const addMemberModal = document.getElementById('pjAddMemberModal');
    const addMemberTitle = document.getElementById('pjAddMemberTitle');
    const addMemberSearch = document.getElementById('pjAddMemberSearch');
    const addMemberStatus = document.getElementById('pjAddMemberStatus');
    const addMemberList = document.getElementById('pjAddMemberList');
    const addMemberClose = document.getElementById('pjAddMemberClose');

    let addMemberState = null;
    let addMemberCache = null; // cached profile list across opens
    let addMemberSearchDebounce = null;

    function closeAddMemberModal() {
        addMemberModal.classList.remove('is-open');
        const cb = addMemberState?.onClose;
        addMemberState = null;
        if (cb) cb();
    }
    addMemberClose.addEventListener('click', closeAddMemberModal);
    addMemberModal.addEventListener('click', (e) => { if (e.target === addMemberModal) closeAddMemberModal(); });

    function setAddMemberStatus(text, kind) {
        addMemberStatus.className = 'pj-am-status';
        if (kind) addMemberStatus.classList.add('is-' + kind);
        addMemberStatus.textContent = text || '';
    }

    function renderAddMemberList(query) {
        if (!addMemberState || !addMemberCache) return;
        const q = (query || '').trim().toLowerCase();
        const filtered = (addMemberCache || []).filter((m) => {
            if (!m || !m.username) return false;
            if (m.role !== 'artist') return false;          // project members must be artists
            if (m.id === user.id) return false;             // never list self
            if (!q) return true;
            const haystack = [m.forename, m.surname, m.username]
                .filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(q);
        });

        if (filtered.length === 0) {
            addMemberList.innerHTML = `<div class="pj-am-empty">${q ? 'No matching artists.' : 'No other artists on the platform yet.'}</div>`;
            return;
        }

        addMemberList.innerHTML = filtered.slice(0, 50).map((m) => {
            const styled = F.formatName(m.forename, m.surname, m.username);
            const initial = ((F.plainName(m.forename, m.surname, m.username) || '?')[0] || '?').toUpperCase();
            const avatar = m.avatar_url
                ? `<div class="pj-am-row__avatar" style="background-image:url('${escapeHtml(m.avatar_url)}');"></div>`
                : `<div class="pj-am-row__avatar">${escapeHtml(initial)}</div>`;
            const already = addMemberState.existingMemberIds?.has(m.id);
            return `<div class="pj-am-row${already ? ' pj-am-row--already' : ''}">
                ${avatar}
                <div class="pj-am-row__info">
                    <div class="pj-am-row__name">${styled}</div>
                    <div class="pj-am-row__handle">@${escapeHtml(m.username)}</div>
                </div>
                <button type="button" class="pj-am-row__add"
                    data-add-username="${escapeHtml(m.username)}"
                    data-user-id="${escapeHtml(m.id)}"
                    ${already ? 'disabled title="Already on the project"' : ''}>
                    ${already ? 'Added' : 'Add'}
                </button>
            </div>`;
        }).join('');

        addMemberList.querySelectorAll('[data-add-username]').forEach((btn) => {
            if (btn.disabled) return;
            btn.addEventListener('click', async () => {
                if (!addMemberState) return;
                const username = btn.getAttribute('data-add-username');
                const userIdToAdd = btn.getAttribute('data-user-id');
                btn.disabled = true;
                btn.textContent = 'Adding…';
                setAddMemberStatus('');
                const { error } = await sb.rpc('add_project_member', {
                    p_project_id: addMemberState.projectId,
                    p_username: username
                });
                if (error) {
                    btn.disabled = false;
                    btn.textContent = 'Add';
                    setAddMemberStatus(error.message || 'Could not add this member.', 'error');
                    return;
                }
                btn.textContent = 'Added';
                btn.closest('.pj-am-row').classList.add('pj-am-row--already');
                addMemberState.existingMemberIds.add(userIdToAdd);
                setAddMemberStatus(`Added @${username} ✓`, 'success');
            });
        });
    }

    async function openAddMemberModal({ projectId, projectTitle, existingMemberIds, onClose }) {
        addMemberState = { projectId, projectTitle, existingMemberIds, onClose };
        addMemberTitle.textContent = `Add member to ${projectTitle || 'project'}`;
        addMemberSearch.value = '';
        setAddMemberStatus('', null);
        addMemberList.innerHTML = `<div class="pj-am-empty">Loading artists…</div>`;
        addMemberModal.classList.add('is-open');
        setTimeout(() => addMemberSearch.focus(), 60);

        if (!addMemberCache) {
            const { data, error } = await sb.rpc('list_public_profiles');
            if (error) {
                addMemberList.innerHTML = `<div class="pj-am-empty">Couldn't load profiles: ${escapeHtml(error.message || '')}</div>`;
                return;
            }
            addMemberCache = data || [];
        }
        renderAddMemberList('');
    }

    addMemberSearch.addEventListener('input', () => {
        clearTimeout(addMemberSearchDebounce);
        addMemberSearchDebounce = setTimeout(() => renderAddMemberList(addMemberSearch.value), 120);
    });
    addMemberSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); closeAddMemberModal(); }
    });
})();
