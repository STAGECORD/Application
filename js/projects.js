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

    // Hardcoded conversion rates from DKK. Update manually as needed.
    // (Each value is "how many of this currency = 1 DKK".)
    const FX_FROM_DKK = {
        DKK: 1,
        EUR: 0.134,
        USD: 0.145,
        GBP: 0.115,
        JPY: 22.1,
        XOF: 88.0
    };
    function fmtMoneyDkk(amountDkk, displayCurrency) {
        const target = FX_FROM_DKK[displayCurrency] ? displayCurrency : 'DKK';
        const converted = Number(amountDkk) * FX_FROM_DKK[target];
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: target,
                maximumFractionDigits: target === 'JPY' || target === 'XOF' ? 0 : 2
            }).format(converted);
        } catch (_) {
            return `${converted.toFixed(2)} ${target}`;
        }
    }

    // User's display currency (loaded once)
    let userCurrency = 'DKK';
    try {
        const { data: prof } = await sb.from('profiles')
            .select('display_currency').eq('id', user.id).single();
        if (prof?.display_currency) userCurrency = prof.display_currency;
    } catch (_) { /* fine — defaults to DKK */ }

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
               { data: approvals },
               { data: unseenRows }] = await Promise.all([
            sb.rpc('get_project', { p_project_id: id }),
            sb.rpc('get_project_members', { p_project_id: id }),
            sb.rpc('get_project_tracks', { p_project_id: id }),
            sb.rpc('get_project_files', { p_project_id: id }),
            sb.rpc('get_project_royalties', { p_project_id: id }),
            sb.rpc('get_project_approvals', { p_project_id: id }),
            sb.rpc('get_project_unseen', { p_project_id: id })
        ]);

        const fileCounts = {};
        (files || []).forEach((f) => {
            if (!fileCounts[f.category]) fileCounts[f.category] = {};
            fileCounts[f.category][f.file_type] = (fileCounts[f.category][f.file_type] || 0) + 1;
        });
        const unseenCounts = {};
        (unseenRows || []).forEach((r) => {
            if (!unseenCounts[r.category]) unseenCounts[r.category] = {};
            unseenCounts[r.category][r.file_type] = r.unseen_count;
        });
        const royaltyConfigured = new Set((royalties || []).map((r) => r.royalty_type));
        const approvalSet = new Set((approvals || []).map((a) => a.user_id));

        const PILL_FILE_HINTS = {
            'uploads-wave': 'Uploads → WAVE: work-in-progress lossless audio shared with the team.',
            'uploads-sheet': 'Uploads → Sheet Music: notation drafts the team iterates on.',
            'uploads-notes': 'Uploads → Notes & Lyrics: lyric drafts, voice notes, brainstorming files.',
            'finals-mp3': 'Finals → WAVE/MP3: mastered audio ready for distribution.',
            'finals-sheet': 'Finals → Sheet Music: approved notation ready to license or sell.',
            'finals-image': 'Finals → Image: final cover artwork and promotional images for the release.',
            'finals-lyrics': 'Finals → Lyrics: approved lyrics that ship to streaming services and lyric sites.'
        };
        const PILL_ROYALTY_HINTS = {
            mechanical: 'Mechanical royalty: paid every time the song is reproduced — physical copies, downloads, publishing share of streams. Click to edit how the project members split this.',
            performance: 'Performance royalty: collected by performing-rights societies (Koda / ASCAP / BMI) when the song is performed publicly. Click to edit the split.',
            synch: 'Synchronization royalty: paid when the song is licensed into film, TV, ads, games or trailers. Click to edit the split.',
            neighbouring: 'Neighbouring rights royalty: collected when the master recording itself is played publicly — radio, TV, streaming, live venues. The parallel to Performance, but for the recording instead of the song. Distributed by Gramex (DK), SoundExchange (US), PPL (UK), etc.',
            covers: 'Covers royalty: when other artists release a cover of this song. Project members can take less than 100% — the rest goes to the cover artist.',
            sample: 'Sample royalty: when another artist samples this recording in their own track. Click to edit the split among the original team.',
            tutorials: 'Tutorials royalty: instructional content teaching the song. Members can take less than 100% — the rest goes to the tutorial creator.',
            commercial: 'Commercial royalty: endorsement licensing, merchandise, brand campaigns, B2B sponsorships. Click to edit the split.',
            remix: 'Remix royalty: when another artist releases a remix of this track. Members can take less than 100% — the rest goes to the remixer who did the new work.'
        };

        function pillFile(cat, type, label) {
            const count = fileCounts[cat]?.[type] || 0;
            const unseen = unseenCounts[cat]?.[type] || 0;
            const classes = ['pill-btn'];
            if (count > 0) classes.push('has-data');
            if (unseen > 0) classes.push('has-unseen');
            const attr = cat === 'uploads' ? `data-upload="${type}"` : `data-final="${type}"`;
            const hint = PILL_FILE_HINTS[`${cat}-${type}`] || '';
            const unseenAttr = unseen > 0 ? ` data-unseen-count="${unseen}"` : '';
            return `<button type="button" class="${classes.join(' ')}" ${attr} data-help="${escapeHtml(hint)}"${unseenAttr}>${label}</button>`;
        }
        function pillRoyalty(type, label) {
            const cls = royaltyConfigured.has(type) ? 'pill-btn has-data' : 'pill-btn';
            const hint = PILL_ROYALTY_HINTS[type] || '';
            return `<button type="button" class="${cls}" data-royalty="${type}" data-help="${escapeHtml(hint)}">${escapeHtml(label)}</button>`;
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

        const STATUS_HINT = {
            in_progress: 'Status: In progress — the team is still working on this project. Not yet visible on artist profiles as released.',
            released: 'Status: Released — every member approved and the owner shipped it. Visible as a release on artist profiles.',
            archived: 'Status: Archived — shelved by the owner. Hidden from active project lists.'
        };
        const status = `<span class="pj-status pj-status--${escapeHtml(p.status)}" data-help="${escapeHtml(STATUS_HINT[p.status] || '')}">${escapeHtml(statusLabel(p.status))}</span>`;

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
            const collabHelp = m.is_owner
                ? `Project owner. Owns the project, sets royalty splits, and is the only person who can release.`
                : `Project member. Click the avatar to open their public profile. The owner can remove members; members can leave themselves.`;
            return `<a class="collaborator-card" href="${link}" data-help="${escapeHtml(collabHelp)}">
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
            <button type="button" class="collaborator-card add-person" id="${pid('pjAddPersonBtn')}" aria-label="Add person" data-help="Add a new collaborator — opens a search modal where you can find artists by name or @-handle and add them to the project.">
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
            const helpText = isSelf
                ? 'Your approval for release. Click to open the approval panel where you can approve or undo. When everyone approves, the owner can ship the release.'
                : (isApproved
                    ? `${first} ${rest} has approved this project for release.`
                    : `${first} ${rest} has not approved yet. Every member must approve before the project can be released.`);
            return `<button type="button" class="${cls}"${isSelf ? ' data-approval-toggle="1"' : ''} title="${escapeHtml(titleAttr)}" data-help="${escapeHtml(helpText)}">
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
                <button type="button" class="project-release__btn" id="${pid('releaseProjectBtn')}"${(allApproved && isOwner && !isAlreadyReleased) ? '' : ' disabled'} data-help="Release project: marks the project as released for everyone and shows it on artist profiles. Becomes clickable once every member has approved.">
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
                <div class="wf-player" data-audio-url="${escapeHtml(t.audio_url)}"></div>
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
                <button type="button" class="pc-menu__trigger" aria-haspopup="true" aria-expanded="false" title="Project actions" data-help="Project actions menu — Edit lets you rename, change the status or update the cover; Delete / Leave removes you or the whole project.">⋯</button>
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
                                <button type="button" class="pill-btn" data-action="lyrics" data-help="Lyrics Studio: write lyrics together, section by section, with everyone's own notebook plus a shared Main Lyrics. Click a word and pick a color to mark rhyme groups.">Lyrics Studio</button>
                                <button type="button" class="pill-btn" data-action="log" data-help="Log: see a timeline of everything that's happened on the project — file uploads, royalty changes and release approvals, newest first.">Log</button>
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
                                    ${pillRoyalty('neighbouring', 'Neighbouring')}
                                    ${pillRoyalty('tutorials', 'Tutorials')}
                                    ${pillRoyalty('remix', 'Remix')}
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

        if (window.STAGECORD_Waveform) window.STAGECORD_Waveform.attachAll(host);

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
            synch: 'Synch', neighbouring: 'Neighbouring', tutorials: 'Tutorials', commercial: 'Commercial',
            remix: 'Remix'
        };

        // Inline expansion panel — replaces popup modals. Clicking the same
        // pill twice closes it; clicking a different pill swaps the content.
        const expandEl = host.querySelector('[data-pj-expand]');
        let activeKey = null;

        function closeExpand() {
            if (activeKey === 'action:lyrics' && typeof stopLyricsRealtime === 'function') stopLyricsRealtime();
            activeKey = null;
            expandEl.hidden = true;
            expandEl.innerHTML = '';
            host.querySelectorAll('.pill-btn--open').forEach((b) => b.classList.remove('pill-btn--open'));
        }

        function markActiveBtn(btn) {
            host.querySelectorAll('.pill-btn--open').forEach((b) => b.classList.remove('pill-btn--open'));
            if (btn) btn.classList.add('pill-btn--open');
        }

        function clearUnseenBadge(triggerBtn, category, fileType) {
            if (!triggerBtn || !triggerBtn.classList.contains('has-unseen')) return false;
            triggerBtn.classList.remove('has-unseen');
            triggerBtn.removeAttribute('data-unseen-count');
            sb.rpc('mark_project_seen', {
                p_project_id: id, p_category: category, p_file_type: fileType
            }).then(null, (err) => console.warn('mark_project_seen failed:', err));
            return true;
        }

        async function expandFiles(category, fileType, label, triggerBtn, forceOpen) {
            const key = `${category}:${fileType}`;
            const sameKeyVisible = activeKey === key && !expandEl.hidden;
            if (!forceOpen && sameKeyVisible) { closeExpand(); return; }
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
                    const isAudio = /\.(wav|wave|mp3|m4a|aac|ogg|oga|flac)(\?|$)/i.test(f.file_name || '') || /\.(wav|wave|mp3|m4a|aac|ogg|oga|flac)(\?|$)/i.test(f.file_url || '');
                    if (isAudio) {
                        return `<div class="pj-file-row pj-file-row--with-wave">
                            <div class="pj-file-row__top">
                                <div class="pj-file-row__info">
                                    <div class="pj-file-row__name">${escapeHtml(f.file_name)}</div>
                                    <div class="pj-file-row__meta">By ${styled} · ${escapeHtml(date)}${sz ? ' · ' + escapeHtml(sz) : ''}</div>
                                </div>
                                <a class="pj-file-row__open" href="${escapeHtml(f.file_url)}" target="_blank" rel="noopener">Open</a>
                                ${isMember ? `<button type="button" class="pj-file-row__del" data-file-del="${escapeHtml(f.id)}" data-file-path="${escapeHtml(f.file_path)}">Delete</button>` : ''}
                            </div>
                            <div class="wf-player" data-audio-url="${escapeHtml(f.file_url)}"></div>
                        </div>`;
                    }
                    return `<div class="pj-file-row">
                        <div class="pj-file-row__info">
                            <div class="pj-file-row__name">${escapeHtml(f.file_name)}</div>
                            <div class="pj-file-row__meta">By ${styled} · ${escapeHtml(date)}${sz ? ' · ' + escapeHtml(sz) : ''}</div>
                        </div>
                        <a class="pj-file-row__open" href="${escapeHtml(f.file_url)}" target="_blank" rel="noopener">Open</a>
                        ${isMember ? `<button type="button" class="pj-file-row__del" data-file-del="${escapeHtml(f.id)}" data-file-path="${escapeHtml(f.file_path)}">Delete</button>` : ''}
                    </div>`;
                }).join('');
                if (window.STAGECORD_Waveform) window.STAGECORD_Waveform.attachAll(list);
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

                    // Tick this pill into "has-data" state, and mark seen for
                    // self so own upload doesn't show as unseen next load.
                    fileCounts[category] = fileCounts[category] || {};
                    fileCounts[category][fileType] = (fileCounts[category][fileType] || 0) + 1;
                    const triggerBtn = host.querySelector(
                        category === 'uploads'
                            ? `[data-upload="${fileType}"]`
                            : `[data-final="${fileType}"]`
                    );
                    if (triggerBtn) triggerBtn.classList.add('has-data');
                    sb.rpc('mark_project_seen', {
                        p_project_id: id, p_category: category, p_file_type: fileType
                    }).then(null, (err) => console.warn('mark_project_seen failed:', err));
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

            // For 'covers', 'tutorials' and 'remix', the remainder of 100%
            // goes to the external person (cover artist / tutorial creator /
            // remixer) who did the new work. Member shares can sum to < 100.
            const allowsUnder = royaltyType === 'covers' || royaltyType === 'tutorials' || royaltyType === 'remix';
            const externalLabel = royaltyType === 'covers'
                ? 'External cover artist'
                : royaltyType === 'tutorials'
                    ? 'Tutorial creator'
                    : 'External remixer';
            const CATEGORY_HINTS = {
                mechanical: 'Paid every time the song is reproduced — physical copies, downloads, and the publishing share of streams.',
                performance: 'Collected by performing-rights societies (Koda / ASCAP / BMI) when the song is performed publicly — radio, livestream, concerts, restaurants.',
                synch: 'Synchronization fee when the song is licensed for film, TV, ads, games or trailers — usually a one-time payment plus future performance royalties.',
                neighbouring: 'Performance royalty for the recording itself — collected by neighbouring-rights societies (Gramex in DK, SoundExchange in US, PPL in the UK) when the master is played publicly on radio, TV, streaming and live venues. Separate from "Performance" above which goes to the songwriters.',
                covers: 'When other artists release a cover of this song — the cover artist keeps their share, the rest flows back to the original team.',
                sample: 'When another artist samples this recording in their own track — the original team is paid by the sampling artist.',
                tutorials: 'Income from instructional content (videos, courses, lesson packs) that teaches the song — the tutorial creator keeps their share.',
                commercial: 'Commercial / endorsement licensing — merchandise, brand campaigns, B2B sponsorships and direct ad placements.',
                remix: 'When another artist releases an official remix of this track — the remixer keeps their share of the new version, the rest flows back to the original team.'
            };
            const categoryHint = CATEGORY_HINTS[royaltyType] || '';
            const ruleHint = isOwner
                ? (allowsUnder
                    ? `Set how the project members split their portion below — anything under 100% flows to the ${externalLabel.toLowerCase()} shown beneath the totals.`
                    : `Set how this is split between the project members below. The members' total must sum to 100%.`)
                : 'Only the project owner can change royalty splits. You can see the current split below.';

            const isCommercial = royaltyType === 'commercial';

            expandEl.innerHTML = `
                <div class="pc-expand__head">
                    <h4 class="pc-expand__title">${escapeHtml(label)} royalties</h4>
                    <button type="button" class="pc-expand__close" data-expand-close>Close</button>
                </div>
                ${categoryHint ? `<p class="pc-expand__hint">${escapeHtml(categoryHint)}</p>` : ''}
                ${isCommercial ? `<div class="pc-commercial-rates" data-expand-rates></div>` : ''}
                <p class="pc-expand__hint" style="margin-top:-6px;">${escapeHtml(isCommercial ? 'Beneath the rate card, set how the earnings from any commercial licence are split between project members.' : ruleHint)}</p>
                <div class="pj-royalty-rows" data-expand-roy-rows></div>
                <div class="pj-royalty-total">
                    <span>${allowsUnder ? 'Members total' : 'Total'}</span>
                    <span><span class="pj-royalty-total__val" data-expand-roy-total>0.00</span> / 100.00 %</span>
                </div>
                ${allowsUnder ? `
                    <div class="pj-royalty-total" style="margin-top:6px;">
                        <span>${escapeHtml(externalLabel)}</span>
                        <span><span class="pj-royalty-total__val" data-expand-roy-external>100.00</span> %</span>
                    </div>
                ` : ''}
                <div class="pc-expand__status" data-expand-roy-status></div>
                ${isOwner ? `
                    <div class="pc-expand__actions">
                        <button type="button" class="pj-btn pj-btn--ghost" data-expand-roy-equal>Split evenly</button>
                        <button type="button" class="pj-btn" data-expand-roy-save>Save</button>
                    </div>
                ` : ''}
            `;
            expandEl.querySelector('[data-expand-close]').addEventListener('click', closeExpand);

            // ----- Commercial: rate-card editor / viewer -----
            if (isCommercial) {
                const COMMERCIAL_CATEGORIES = {
                    tv_national: 'TV commercial — national',
                    tv_international: 'TV commercial — international',
                    radio_ad: 'Radio commercial',
                    online_ad: 'Online ad / social media',
                    trailer: 'Trailer / promo',
                    film_theatrical: 'Film (theatrical)',
                    film_streaming: 'Film / series (streaming)',
                    documentary: 'Documentary',
                    video_game: 'Video game',
                    mobile_app: 'Mobile app / game',
                    live_event: 'Live or corporate event',
                    background_music: 'Background music (retail, restaurant)',
                    brand_campaign: 'Brand campaign',
                    educational: 'Educational / instructional'
                };
                // Sensible default scope per category. Owner can still override.
                const CATEGORY_DEFAULT_SCOPE = {
                    tv_national: 'national',
                    tv_international: 'global',
                    radio_ad: 'national',
                    online_ad: 'global',
                    trailer: 'global',
                    film_theatrical: 'global',
                    film_streaming: 'global',
                    documentary: 'international',
                    video_game: 'global',
                    mobile_app: 'global',
                    live_event: 'national',
                    background_music: 'national',
                    brand_campaign: 'national',
                    educational: 'national'
                };
                const COMMERCIAL_RESTRICTIONS = {
                    pornography: 'Pornography / adult content',
                    tobacco: 'Tobacco products',
                    alcohol: 'Alcohol',
                    gambling: 'Gambling / betting',
                    weapons: 'Weapons / firearms',
                    political: 'Political campaigns',
                    religious: 'Religious content',
                    hate_speech: 'Hate groups or hate speech',
                    childrens_content: "Children's content (under 13)"
                };
                const ratesEl = expandEl.querySelector('[data-expand-rates]');
                async function refreshRates() {
                    ratesEl.innerHTML = `<div class="pc-rates__loading">Loading rates…</div>`;
                    const [
                        { data, error },
                        { data: suggestions }
                    ] = await Promise.all([
                        sb.rpc('get_project_commercial_rates', { p_project_id: id }),
                        sb.rpc('get_rate_suggestions', { p_project_id: id })
                    ]);
                    if (error) {
                        ratesEl.innerHTML = `<div class="pc-rates__empty">${escapeHtml(error.message || 'Failed to load')}</div>`;
                        return;
                    }
                    const rates = data || [];
                    const suggestionByLabel = {};
                    (suggestions || []).forEach((s) => { suggestionByLabel[s.label] = s; });

                    // Completion stats — how many of the 14 categories are set
                    const totalCats = Object.keys(COMMERCIAL_CATEGORIES).length;
                    const setLabels = new Set(rates.map((r) => r.label));
                    const setCount = Object.values(COMMERCIAL_CATEGORIES).filter((v) => setLabels.has(v)).length;
                    const rowsHtml = rates.length === 0
                        ? `<div class="pc-rates__empty">No commercial rates set yet${isOwner ? ' — add one below.' : '.'}</div>`
                        : rates.map((r) => {
                            // Format months smartly — whole years show as "X years",
                            // otherwise as "X months".
                            function fmtPeriod(months) {
                                if (!months) return 'Limited';
                                if (months % 12 === 0 && months >= 12) {
                                    const y = months / 12;
                                    return `${y} ${y === 1 ? 'year' : 'years'}`;
                                }
                                return `${months} ${months === 1 ? 'month' : 'months'}`;
                            }
                            const periodTxt = r.period_type === 'permanent'
                                ? 'Permanent'
                                : fmtPeriod(r.period_months);
                            const scopeTxt = r.scope === 'national' ? 'National'
                                : r.scope === 'international' ? 'International' : 'Global';
                            return `<div class="pc-rate-row">
                                <div class="pc-rate-row__main">
                                    <div class="pc-rate-row__label">${escapeHtml(r.label)}</div>
                                    <div class="pc-rate-row__meta">${escapeHtml(periodTxt)} · ${escapeHtml(scopeTxt)}${r.notes ? ' · ' + escapeHtml(r.notes) : ''}</div>
                                </div>
                                <div class="pc-rate-row__price">${escapeHtml(fmtMoneyDkk(r.price_dkk, userCurrency))}</div>
                                ${isOwner
                                    ? `<button type="button" class="pc-rate-row__del" data-rate-del="${escapeHtml(r.id)}" aria-label="Remove rate">×</button>`
                                    : `<button type="button" class="pc-rate-row__request" data-rate-request="${escapeHtml(r.id)}" disabled title="License request form is coming next">Request</button>`}
                            </div>`;
                        }).join('');

                    const categoryOptions = Object.entries(COMMERCIAL_CATEGORIES)
                        .map(([k, v]) => `<option value="${escapeHtml(k)}">${escapeHtml(v)}</option>`)
                        .join('');

                    const isComplete = setCount === totalCats;
                    const completionHint = isOwner ? `
                        <div class="pc-rates__completion${isComplete ? ' is-complete' : ''}">
                            <div class="pc-rates__completion-bar">
                                <div class="pc-rates__completion-fill" style="width:${(setCount / totalCats * 100).toFixed(1)}%"></div>
                            </div>
                            <div class="pc-rates__completion-text">
                                <strong>${setCount} of ${totalCats}</strong> categories set
                                ${isComplete
                                    ? ' — your rate card is complete. Nice.'
                                    : ' — filling every category gives buyers a clearer menu and helps your song appear in more licensing searches.'}
                            </div>
                        </div>
                    ` : '';

                    ratesEl.innerHTML = `
                        <div class="pc-rates__head">
                            <h5>Rate card</h5>
                            <span class="pc-rates__sub">${rates.length} ${rates.length === 1 ? 'rate' : 'rates'} · prices shown in ${escapeHtml(userCurrency)}, stored in DKK</span>
                        </div>
                        ${completionHint}
                        <div class="pc-rates__list">${rowsHtml}</div>
                        ${isOwner ? `
                            <form class="pc-rates__form" data-rate-form>
                                <div class="pc-rates__form-row">
                                    <select name="category" required>
                                        <option value="">Pick a category…</option>
                                        ${categoryOptions}
                                    </select>
                                    <input type="number" name="price" placeholder="Price (DKK)" min="0" step="100" required>
                                </div>
                                <div class="pc-rates__suggestion" data-rate-suggestion></div>
                                <div class="pc-rates__form-row">
                                    <select name="period_type">
                                        <option value="limited">Limited period</option>
                                        <option value="permanent">Permanent</option>
                                    </select>
                                    <div class="pc-rates__form-pair" data-pair-length>
                                        <input type="number" name="period_length" placeholder="Length" min="1" value="12">
                                        <select name="period_unit">
                                            <option value="months">months</option>
                                            <option value="years">years</option>
                                        </select>
                                    </div>
                                    <select name="scope">
                                        <option value="national">National</option>
                                        <option value="international">International</option>
                                        <option value="global">Global</option>
                                    </select>
                                </div>
                                <div class="pc-rates__form-row">
                                    <input type="text" name="notes" placeholder="Notes (optional)" maxlength="200">
                                    <button type="submit" class="pj-btn">+ Add rate</button>
                                </div>
                                <div class="pc-rates__form-error" data-rate-form-error></div>
                            </form>
                        ` : ''}

                        <div class="pc-restrictions" data-expand-restrictions></div>
                    `;

                    ratesEl.querySelectorAll('[data-rate-del]').forEach((btn) => {
                        btn.addEventListener('click', async () => {
                            if (!confirm('Remove this rate?')) return;
                            btn.disabled = true;
                            const { error: dErr } = await sb.rpc('remove_project_commercial_rate', { p_rate_id: btn.getAttribute('data-rate-del') });
                            if (dErr) { alert('Could not remove: ' + (dErr.message || '')); btn.disabled = false; return; }
                            refreshRates();
                        });
                    });

                    if (isOwner) {
                        const form = ratesEl.querySelector('[data-rate-form]');
                        const errEl = ratesEl.querySelector('[data-rate-form-error]');
                        // Hide length pair when permanent
                        const periodType = form.querySelector('[name="period_type"]');
                        const lengthPair = form.querySelector('[data-pair-length]');
                        function syncMonths() {
                            lengthPair.style.display = periodType.value === 'permanent' ? 'none' : '';
                        }
                        periodType.addEventListener('change', syncMonths);
                        syncMonths();

                        // Suggested price — refreshes when category changes
                        const categorySelect = form.querySelector('[name="category"]');
                        const suggestionEl = form.querySelector('[data-rate-suggestion]');
                        function refreshSuggestion() {
                            const key = categorySelect.value;
                            if (!key) { suggestionEl.innerHTML = ''; return; }
                            const label = COMMERCIAL_CATEGORIES[key];
                            const s = suggestionByLabel[label];
                            if (!s || !s.sample_count) {
                                suggestionEl.innerHTML = `<span class="pc-rates__sugg-empty">No suggestion yet — be the first to set a rate for <strong>${escapeHtml(label)}</strong>.</span>`;
                                return;
                            }
                            const converted = fmtMoneyDkk(s.avg_dkk, userCurrency);
                            suggestionEl.innerHTML = `
                                <span class="pc-rates__sugg-text">
                                    Suggested: <strong>${escapeHtml(converted)}</strong>
                                    <span class="pc-rates__sugg-meta">· average of ${s.sample_count} ${s.sample_count === 1 ? 'rate' : 'rates'} from other artists</span>
                                </span>
                                <button type="button" class="pc-rates__sugg-use" data-use-suggested>Use this</button>
                            `;
                            suggestionEl.querySelector('[data-use-suggested]').addEventListener('click', () => {
                                form.querySelector('[name="price"]').value = Math.round(Number(s.avg_dkk));
                            });
                        }
                        // Auto-set scope based on category (owner can override after)
                        const scopeSelect = form.querySelector('[name="scope"]');
                        function autoScope() {
                            const key = categorySelect.value;
                            const def = CATEGORY_DEFAULT_SCOPE[key];
                            if (def) scopeSelect.value = def;
                        }
                        categorySelect.addEventListener('change', () => {
                            autoScope();
                            refreshSuggestion();
                        });
                        refreshSuggestion();

                        form.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            errEl.textContent = '';
                            const fd = new FormData(form);
                            const categoryKey = fd.get('category');
                            const periodTypeVal = fd.get('period_type');
                            if (!categoryKey) { errEl.textContent = 'Pick a category.'; return; }
                            const lengthRaw = parseInt(fd.get('period_length')) || 12;
                            const unit = fd.get('period_unit');
                            const monthsTotal = unit === 'years' ? lengthRaw * 12 : lengthRaw;
                            const payload = {
                                p_project_id: id,
                                p_label: COMMERCIAL_CATEGORIES[categoryKey] || categoryKey,
                                p_price_dkk: parseFloat(fd.get('price')) || 0,
                                p_period_type: periodTypeVal,
                                p_period_months: periodTypeVal === 'permanent' ? null : monthsTotal,
                                p_scope: fd.get('scope'),
                                p_notes: (fd.get('notes') || '').toString().trim() || null
                            };
                            const submitBtn = form.querySelector('button[type="submit"]');
                            submitBtn.disabled = true;
                            const { error: aErr } = await sb.rpc('add_project_commercial_rate', payload);
                            submitBtn.disabled = false;
                            if (aErr) { errEl.textContent = aErr.message || 'Could not add'; return; }
                            form.reset();
                            syncMonths();
                            refreshRates();
                        });
                    }

                    // Restrictions section
                    const restrEl = expandEl.querySelector('[data-expand-restrictions]');
                    const { data: restrData } = await sb.rpc('get_project_commercial_restrictions', { p_project_id: id });
                    const activeRestrictions = new Set((restrData || []).map((r) => r.restriction));

                    if (isOwner) {
                        const checkboxes = Object.entries(COMMERCIAL_RESTRICTIONS).map(([k, v]) => `
                            <label class="pc-restrict__item">
                                <input type="checkbox" data-restriction="${escapeHtml(k)}"${activeRestrictions.has(k) ? ' checked' : ''}>
                                <span>${escapeHtml(v)}</span>
                            </label>
                        `).join('');
                        restrEl.innerHTML = `
                            <div class="pc-restrictions__head">
                                <h5>Restrictions</h5>
                                <span class="pc-rates__sub">Tick anything this song may NOT be used for. Changes save instantly.</span>
                            </div>
                            <div class="pc-restrict__grid">${checkboxes}</div>
                            <div class="pc-restrict__status" data-restrict-status></div>
                        `;
                        const statusEl2 = restrEl.querySelector('[data-restrict-status]');
                        function setRestrStatus(text, kind) {
                            statusEl2.className = 'pc-restrict__status';
                            if (kind) statusEl2.classList.add('is-' + kind);
                            statusEl2.textContent = text || '';
                        }
                        restrEl.querySelectorAll('[data-restriction]').forEach((cb) => {
                            cb.addEventListener('change', async () => {
                                if (cb.checked) activeRestrictions.add(cb.getAttribute('data-restriction'));
                                else activeRestrictions.delete(cb.getAttribute('data-restriction'));
                                setRestrStatus('Saving…');
                                const { error: rErr } = await sb.rpc('set_project_commercial_restrictions', {
                                    p_project_id: id,
                                    p_restrictions: Array.from(activeRestrictions)
                                });
                                if (rErr) { setRestrStatus('Save failed: ' + (rErr.message || ''), 'error'); return; }
                                setRestrStatus('Saved ✓', 'success');
                                setTimeout(() => setRestrStatus('', null), 1800);
                            });
                        });
                    } else {
                        const restrictionList = Array.from(activeRestrictions);
                        if (restrictionList.length === 0) {
                            restrEl.innerHTML = `
                                <div class="pc-restrictions__head">
                                    <h5>Restrictions</h5>
                                </div>
                                <div class="pc-restrict__none">The owner has not set any commercial restrictions on this song.</div>
                            `;
                        } else {
                            const chips = restrictionList.map((r) =>
                                `<span class="pc-restrict__chip">${escapeHtml(COMMERCIAL_RESTRICTIONS[r] || r)}</span>`
                            ).join('');
                            restrEl.innerHTML = `
                                <div class="pc-restrictions__head">
                                    <h5>Restrictions</h5>
                                    <span class="pc-rates__sub">This song may NOT be licensed for the following uses:</span>
                                </div>
                                <div class="pc-restrict__chips">${chips}</div>
                            `;
                        }
                    }
                }
                refreshRates();
            }

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

            const externalEl = expandEl.querySelector('[data-expand-roy-external]');
            const externalRow = externalEl ? externalEl.closest('.pj-royalty-total') : null;

            function recompute() {
                const inputs = rowsEl.querySelectorAll('.pj-royalty-row__input');
                let total = 0;
                inputs.forEach((inp) => { const v = parseFloat(inp.value); if (!isNaN(v)) total += v; });
                totalEl.textContent = total.toFixed(2);
                totalRow.classList.remove('is-valid', 'is-invalid');
                if (allowsUnder) {
                    // Valid when 0 ≤ total ≤ 100; remainder goes to the external party
                    totalRow.classList.add(total >= -0.01 && total <= 100.01 ? 'is-valid' : 'is-invalid');
                    if (externalEl) {
                        const ext = Math.max(0, Math.min(100, 100 - total));
                        externalEl.textContent = ext.toFixed(2);
                        externalRow.classList.remove('is-valid', 'is-invalid');
                        externalRow.classList.add('is-valid');
                    }
                } else {
                    totalRow.classList.add(Math.abs(total - 100) < 0.01 ? 'is-valid' : 'is-invalid');
                }
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
                    if (allowsUnder) {
                        if (total < -0.01 || total > 100.01) {
                            setStatus(`Member shares must total between 0% and 100% (currently ${total.toFixed(2)}%).`, 'error');
                            return;
                        }
                    } else if (Math.abs(total - 100) > 0.01) {
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

        function relTime(date) {
            const diff = (Date.now() - date.getTime()) / 1000;
            if (diff < 60) return 'just now';
            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
            if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        async function expandLog(triggerBtn) {
            const key = 'action:log';
            if (activeKey === key) { closeExpand(); return; }
            activeKey = key;
            markActiveBtn(triggerBtn);
            expandEl.hidden = false;
            expandEl.innerHTML = `
                <div class="pc-expand__head">
                    <h4 class="pc-expand__title">Project activity log</h4>
                    <button type="button" class="pc-expand__close" data-expand-close>Close</button>
                </div>
                <p class="pc-expand__hint">A timeline of everything that has happened on this project — uploads, royalty splits and approvals — newest first.</p>
                <div class="pj-log-list" data-expand-log><div style="color:#BFD7FF;text-align:center;padding:24px;">Loading…</div></div>
            `;
            expandEl.querySelector('[data-expand-close]').addEventListener('click', closeExpand);

            const [
                { data: filesData },
                { data: approvalsData },
                { data: royaltiesData }
            ] = await Promise.all([
                sb.rpc('get_project_files', { p_project_id: id }),
                sb.rpc('get_project_approvals', { p_project_id: id }),
                sb.rpc('get_project_royalties', { p_project_id: id })
            ]);

            const memberById = new Map((members || []).map((m) => [m.user_id, m]));
            const ownerLite = {
                user_id: p.owner_id, username: p.owner_username,
                forename: p.owner_forename, surname: p.owner_surname
            };

            const events = [];

            (filesData || []).forEach((f) => {
                events.push({
                    ts: new Date(f.created_at),
                    actor: { forename: f.uploader_forename, surname: f.uploader_surname, username: f.uploader_username },
                    verb: 'uploaded',
                    target: `${f.file_name} <em>(${escapeHtml(FILE_TYPE_LABELS[f.file_type] || f.file_type)} · ${escapeHtml(f.category)})</em>`,
                    iconChar: '↑',
                    category: 'file'
                });
            });

            (approvalsData || []).forEach((a) => {
                const m = memberById.get(a.user_id) || {};
                events.push({
                    ts: new Date(a.approved_at),
                    actor: { forename: m.forename, surname: m.surname, username: m.username || 'Someone' },
                    verb: 'approved release',
                    target: '',
                    iconChar: '✓',
                    category: 'approval'
                });
            });

            // Royalty rows are inserted as a batch by set_project_royalties.
            // Group by (royalty_type, updated_at second) so a single save becomes one event.
            const royGroups = new Map();
            (royaltiesData || []).forEach((r) => {
                if (!r.updated_at) return;
                const k = `${r.royalty_type}:${r.updated_at.slice(0, 19)}`;
                if (!royGroups.has(k)) royGroups.set(k, { royalty_type: r.royalty_type, updated_at: r.updated_at });
            });
            royGroups.forEach((g) => {
                events.push({
                    ts: new Date(g.updated_at),
                    actor: ownerLite,
                    verb: 'updated royalty split for',
                    target: `<em>${escapeHtml(ROYALTY_LABELS[g.royalty_type] || g.royalty_type)}</em>`,
                    iconChar: '%',
                    category: 'royalty'
                });
            });

            events.sort((a, b) => b.ts - a.ts);

            const listEl = expandEl.querySelector('[data-expand-log]');
            if (events.length === 0) {
                listEl.innerHTML = `<div style="color:#BFD7FF;text-align:center;padding:24px;opacity:0.85;">No activity yet. Upload a file or approve the release to start building the log.</div>`;
                return;
            }

            listEl.innerHTML = events.slice(0, 80).map((ev) => {
                const styledName = F.formatName(ev.actor.forename, ev.actor.surname, ev.actor.username || 'Someone');
                return `<div class="pj-log-row">
                    <div class="pj-log-row__icon" data-cat="${ev.category}">${ev.iconChar}</div>
                    <div class="pj-log-row__body">
                        <div>${styledName} ${escapeHtml(ev.verb)}${ev.target ? ' ' + ev.target : ''}</div>
                        <div class="pj-log-row__time">${escapeHtml(relTime(ev.ts))}</div>
                    </div>
                </div>`;
            }).join('');
        }

        // ===================================================================
        // Lyrics Studio — collaborative lyric writing + rhyme-group tagging.
        // One notebook per team member (their own sections), plus a shared
        // Main Lyrics assembled by copying sections across. Click a word and
        // pick a color to group it with other words as a rhyme — any number
        // of words can share a color, including non-obvious/slant rhymes.
        // Backed by lyrics_books / lyrics_sections / lyrics_rhyme_tags
        // (see api/lyrics.sql), synced live to every project member.
        // ===================================================================
        const RHYME_PALETTE_DEFAULT = ['#FF6A55','#FFB547','#FFE066','#43C47A','#4A90E2','#A370F0','#FF8AC8','#7DD3C0'];
        const LYRICS_SECTION_TYPES = { intro: 'Intro', verse: 'Verse', 'pre-chorus': 'Pre-Chorus', chorus: 'Chorus', 'post-chorus': 'Post-Chorus', 'middle-8': 'Middle-8', bridge: 'Bridge', hook: 'Hook', refrain: 'Refrain', outro: 'Outro', notes: 'Notes', custom: 'Custom' };
        const LYRICS_MAIN_TAB = '__main__';

        let lyricsState = null;
        let lyricsChannel = null;
        let lyricsReloadTimer = null;
        let lyricsSyncTimers = {};

        function lyricsBuildLabel(section, sections) {
            if (section.type === 'custom') return section.custom_name || 'Custom';
            if (section.type === 'verse' || section.type === 'chorus') {
                const sameType = sections.filter((s) => s.type === section.type);
                const idx = sameType.indexOf(section) + 1;
                return LYRICS_SECTION_TYPES[section.type] + (sameType.length > 1 ? ' ' + idx : '');
            }
            return LYRICS_SECTION_TYPES[section.type] || section.type;
        }

        function lyricsWordsRhyme(a, b) {
            a = a.toLowerCase(); b = b.toLowerCase();
            if (a === b) return true;
            if (a.length >= 2 && b.length >= 2 && a.slice(-2) === b.slice(-2)) return true;
            if (a.length >= 3 && b.length >= 3 && a.slice(-3) === b.slice(-3)) return true;
            return false;
        }

        function lyricsMemberSections(memberId) {
            return lyricsState.sections.filter((s) => !s.is_main && s.user_id === memberId).sort((a, b) => a.position - b.position);
        }
        function lyricsMainSections() {
            return lyricsState.sections.filter((s) => s.is_main).sort((a, b) => a.position - b.position);
        }
        function lyricsCurrentSections() {
            return lyricsState.activeTab === LYRICS_MAIN_TAB ? lyricsMainSections() : lyricsMemberSections(lyricsState.activeTab);
        }
        function lyricsIsMainTab() { return lyricsState.activeTab === LYRICS_MAIN_TAB; }
        // Only your own notebook, or the shared Main Lyrics, accept writes —
        // a teammate's tab is read-only (matches RLS: is_main OR user_id =
        // auth.uid() on lyrics_sections).
        function lyricsCanEditCurrentTab() { return lyricsIsMainTab() || lyricsState.activeTab === user.id; }
        function lyricsTabName(memberId) {
            if (memberId === LYRICS_MAIN_TAB) return 'Main Lyrics';
            const m = (members || []).find((x) => x.user_id === memberId);
            return m ? F.plainName(m.forename, m.surname, m.username) : 'Member';
        }
        function lyricsTabAvatar(memberId) {
            const m = (members || []).find((x) => x.user_id === memberId);
            return (m && m.avatar_url) || '';
        }

        async function ensureLyricsBook(projectId) {
            try { await sb.rpc('ensure_lyrics_book', { p_project_id: projectId }); } catch (e) {}
        }

        function stopLyricsRealtime() {
            if (lyricsChannel) { sb.removeChannel(lyricsChannel); lyricsChannel = null; }
        }

        function startLyricsRealtime(projectId) {
            stopLyricsRealtime();
            lyricsChannel = sb.channel('pj-lyrics-' + projectId)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'lyrics_sections', filter: 'project_id=eq.' + projectId }, () => reloadLyrics(projectId))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'lyrics_rhyme_tags', filter: 'project_id=eq.' + projectId }, () => reloadLyrics(projectId))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'lyrics_books', filter: 'project_id=eq.' + projectId }, () => reloadLyrics(projectId))
                .subscribe();
        }

        async function fetchLyricsBook(projectId) {
            const bookResp = await sb.rpc('get_lyrics_book', { p_project_id: projectId });
            return bookResp.data || { book: null, sections: [], rhymes: [] };
        }

        function applyLyricsRaw(raw) {
            lyricsState.palette = (raw.book && raw.book.palette && raw.book.palette.length) ? raw.book.palette : RHYME_PALETTE_DEFAULT.slice();
            lyricsState.mainFinalized = !!(raw.book && raw.book.main_finalized);
            lyricsState.mainFinalizedAt = raw.book && raw.book.main_finalized_at;
            lyricsState.sections = raw.sections || [];
            lyricsState.rhymes = {};
            (raw.rhymes || []).forEach((r) => {
                if (r.user_id === user.id) lyricsState.rhymes[r.word] = { color: r.color, isSlant: !!r.is_slant };
            });
        }

        // Supabase Realtime echoes your own writes back to you, not just
        // teammates' — without this, every debounced save while typing
        // would trigger a reload+re-render that destroys and recreates the
        // textarea, kicking focus out mid-sentence. So: never re-render
        // while a lyrics text field is focused; just update the state
        // quietly and catch up once focus actually leaves the editor.
        let lyricsRenderPending = false;
        function lyricsEditorFocused() {
            const el = document.activeElement;
            return !!(el && expandEl.contains(el) && el.matches && (el.matches('[data-lyrics-editor]') || el.matches('[data-lyrics-custom-name]')));
        }

        function reloadLyrics(projectId) {
            clearTimeout(lyricsReloadTimer);
            lyricsReloadTimer = setTimeout(async () => {
                if (activeKey !== 'action:lyrics' || !lyricsState) return;
                const raw = await fetchLyricsBook(projectId);
                applyLyricsRaw(raw);
                if (lyricsEditorFocused()) {
                    lyricsRenderPending = true;
                } else {
                    renderLyrics();
                }
            }, 400);
        }

        function tokenizeLyricsLine(text, rhymes) {
            if (!text) return '';
            return text.split('\n').map((line) => {
                if (!line.trim()) return '<p class="pj-lyrics-line">&nbsp;</p>';
                let html = '';
                const re = /([\p{L}\p{N}'-]+)|([^\p{L}\p{N}]+)/gu;
                let match;
                while ((match = re.exec(line)) !== null) {
                    if (match[1]) {
                        const tok = match[1];
                        const key = tok.toLowerCase();
                        const tag = rhymes[key];
                        const color = tag && tag.color;
                        const style = color ? ` style="color:${color};"` : '';
                        const cls = 'pj-lyrics-word' + (color ? ' has-rhyme' : '') + (tag && tag.isSlant ? ' is-slant' : '');
                        const title = (tag && tag.isSlant) ? ' title="Marked as a rhyme even though it\'s not a direct match — still counts when pronounced/sung."' : '';
                        html += `<span class="${cls}" data-word="${escapeHtml(key)}"${style}${title}>${escapeHtml(tok)}</span>`;
                    } else {
                        html += escapeHtml(match[2]);
                    }
                }
                return `<p class="pj-lyrics-line">${html}</p>`;
            }).join('');
        }

        function renderLyricsTabs() {
            const mainCount = lyricsMainSections().length;
            const mainTab = `<button type="button" class="pj-lyrics-tab${lyricsIsMainTab() ? ' is-active' : ''}" data-lyrics-tab="${LYRICS_MAIN_TAB}">
                <span>Main Lyrics</span>${mainCount ? `<span class="pj-lyrics-tab__own">${mainCount}</span>` : ''}
            </button>`;
            const memberTabs = (members || []).map((m) => {
                const isOwn = m.user_id === user.id;
                const isActive = m.user_id === lyricsState.activeTab;
                const avatar = lyricsTabAvatar(m.user_id);
                return `<button type="button" class="pj-lyrics-tab${isActive ? ' is-active' : ''}" data-lyrics-tab="${m.user_id}">
                    ${avatar ? `<span class="pj-lyrics-tab__avatar" style="background-image:url('${escapeHtml(avatar)}');"></span>` : ''}
                    <span>${escapeHtml(lyricsTabName(m.user_id))}</span>${isOwn ? '<span class="pj-lyrics-tab__own">You</span>' : ''}
                </button>`;
            }).join('');
            return `<div class="pj-lyrics-tabs">${mainTab}${memberTabs}</div>`;
        }

        function renderLyricsToolbar() {
            const locked = (lyricsIsMainTab() && lyricsState.mainFinalized) || !lyricsCanEditCurrentTab();
            const options = Object.keys(LYRICS_SECTION_TYPES).map((k) => `<option value="${k}">${LYRICS_SECTION_TYPES[k]}</option>`).join('');
            const addGroup = locked ? '' : `
                <div class="pj-lyrics-toolbar__group">
                    <select class="pj-lyrics-toolbar__select" data-lyrics-add-select>${options}</select>
                    <input type="text" class="pj-lyrics-toolbar__custom" data-lyrics-add-custom placeholder="Section name" hidden>
                    <button type="button" class="pj-btn" data-lyrics-add-btn>Add</button>
                </div>`;
            const readOnlyNote = (!lyricsCanEditCurrentTab())
                ? `<span class="pj-lyrics-hint-label">Read-only — this is ${escapeHtml(lyricsTabName(lyricsState.activeTab))}'s notebook</span>` : '';
            const swatches = lyricsState.palette.map((c) => `<button type="button" class="pj-lyrics-swatch${c === lyricsState.activeColor ? ' is-active' : ''}" data-lyrics-color="${c}" style="background:${c};" aria-label="Rhyme color ${c}"></button>`).join('');
            return `<div class="pj-lyrics-toolbar">
                ${addGroup}
                ${readOnlyNote}
                <div class="pj-lyrics-toolbar__group">
                    <span class="pj-lyrics-hint-label">Rhyme colors:</span>
                    <div class="pj-lyrics-palette">${swatches}<button type="button" class="pj-lyrics-swatch-add" data-lyrics-add-color aria-label="Add color">+</button></div>
                </div>
            </div>
            <p class="pj-lyrics-hint">${lyricsState.activeColor ? `Paint mode: click a word to mark it with the selected color. Click the same color again to turn it off.` : `Select a rhyme color, then click words to group them as rhymes — any number of words can share a color.`}</p>`;
        }

        function renderLyricsBanner() {
            if (!lyricsIsMainTab()) return '';
            if (lyricsState.mainFinalized) {
                const dateStr = lyricsState.mainFinalizedAt ? new Date(lyricsState.mainFinalizedAt).toLocaleDateString() : '';
                return `<div class="pj-lyrics-banner is-finalized">
                    <span>✓ Main Lyrics finalized${dateStr ? ' · ' + escapeHtml(dateStr) : ''}</span>
                    <button type="button" class="pj-btn pj-btn--ghost" data-lyrics-unfinalize>Unlock</button>
                </div>`;
            }
            return `<div class="pj-lyrics-banner">
                <span>Main Lyrics is the shared final text — copy sections in with → Main, then finalize when the team agrees.</span>
                <button type="button" class="pj-btn" data-lyrics-finalize>Finalize lyrics</button>
            </div>`;
        }

        function renderLyricsSection(section, sections) {
            const label = lyricsBuildLabel(section, sections);
            const onMain = lyricsIsMainTab();
            // Locked = can't edit this list right now — either Main is
            // finalized, or (for a member notebook) it isn't yours.
            // Copying a teammate's section INTO Main is still allowed
            // regardless (see toMainBtn below — RLS permits any member).
            const locked = (onMain && lyricsState.mainFinalized) || !lyricsCanEditCurrentTab();
            const editing = lyricsState.editingIds.has(section.id);
            const isCustom = section.type === 'custom';
            const options = Object.keys(LYRICS_SECTION_TYPES).map((k) => `<option value="${k}"${k === section.type ? ' selected' : ''}>${LYRICS_SECTION_TYPES[k]}</option>`).join('');
            let sourceChip = '';
            if (onMain && section.source_user_id) {
                sourceChip = `<span class="pj-lyrics-section__source">from ${escapeHtml(lyricsTabName(section.source_user_id))}</span>`;
            }
            const toMainBtn = (!onMain && section.content && !lyricsState.mainFinalized)
                ? `<button type="button" class="pj-lyrics-section__action" data-lyrics-to-main="${section.id}">→ Main</button>` : '';
            const view = tokenizeLyricsLine(section.content || '', lyricsState.rhymes);
            return `<li class="pj-lyrics-section${locked ? ' is-locked' : ''}" data-section-id="${section.id}" draggable="${locked ? 'false' : 'true'}">
                <div class="pj-lyrics-section__head">
                    ${locked ? '' : `<button type="button" class="pj-lyrics-section__drag" data-lyrics-drag="${section.id}" aria-label="Drag to reorder">⋮⋮</button>`}
                    <select class="pj-lyrics-section__type" data-lyrics-type="${section.id}"${locked ? ' disabled' : ''}>${options}</select>
                    ${isCustom ? `<input type="text" class="pj-lyrics-toolbar__custom" data-lyrics-custom-name="${section.id}" value="${escapeHtml(section.custom_name || '')}" placeholder="Section name"${locked ? ' disabled' : ''}>` : `<span class="pj-lyrics-section__label">${escapeHtml(label)}</span>`}
                    ${sourceChip}
                    <span class="pj-lyrics-section__spacer"></span>
                    ${toMainBtn}
                    ${locked ? '' : `<button type="button" class="pj-lyrics-section__action" data-lyrics-edit-toggle="${section.id}">${editing ? 'Done' : 'Edit'}</button>`}
                    ${locked ? '' : `<button type="button" class="pj-lyrics-section__action pj-lyrics-section__action--delete" data-lyrics-delete="${section.id}">Delete</button>`}
                </div>
                <div class="pj-lyrics-section__body">
                    ${editing
                        ? `<textarea class="pj-lyrics-editor" data-lyrics-editor="${section.id}" placeholder="Write your lines here — one per line…">${escapeHtml(section.content || '')}</textarea>`
                        : (section.content ? `<div data-lyrics-view="${section.id}">${view}</div>` : `<p class="pj-lyrics-placeholder">No text yet — click Edit to start writing.</p>`)}
                </div>
            </li>`;
        }

        function renderLyricsSections() {
            const sections = lyricsCurrentSections();
            if (!sections.length) {
                return lyricsIsMainTab()
                    ? `<p class="pj-lyrics-placeholder">Main Lyrics is empty. Switch to a teammate's tab and click → Main on the sections you want to include.</p>`
                    : `<p class="pj-lyrics-placeholder">No sections yet — pick a type above and click Add to start writing.</p>`;
            }
            return `<ul class="pj-lyrics-sections" data-lyrics-sections>${sections.map((s) => renderLyricsSection(s, sections)).join('')}</ul>`;
        }

        function renderLyrics() {
            const body = expandEl.querySelector('[data-lyrics-body]');
            if (!body) return;
            body.innerHTML = renderLyricsTabs() + renderLyricsToolbar() + renderLyricsBanner() + renderLyricsSections();
        }

        // ---------- Mutations (optimistic local update + background sync) ----------
        function lyricsNewSectionId() {
            return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : ('sec_' + Date.now().toString(36) + Math.random().toString(36).slice(2));
        }

        function lyricsAddSection(type, customName) {
            if (!type) return;
            const onMain = lyricsIsMainTab();
            const ownerId = onMain ? user.id : lyricsState.activeTab;
            const list = lyricsCurrentSections();
            const section = {
                id: lyricsNewSectionId(), project_id: id, user_id: ownerId, is_main: onMain,
                type: type, custom_name: type === 'custom' ? (customName || 'Custom') : null,
                content: '', position: list.length,
                source_user_id: null, source_section_id: null
            };
            lyricsState.sections.push(section);
            lyricsState.editingIds.add(section.id);
            renderLyrics();
            const ta = expandEl.querySelector(`[data-lyrics-editor="${section.id}"]`);
            if (ta) ta.focus();
            sb.from('lyrics_sections').insert(section).then(({ error }) => { if (error) reloadLyrics(id); });
        }

        function lyricsDeleteSection(sectionId) {
            const idx = lyricsState.sections.findIndex((s) => s.id === sectionId);
            if (idx < 0) return;
            lyricsState.sections.splice(idx, 1);
            lyricsState.editingIds.delete(sectionId);
            renderLyrics();
            sb.from('lyrics_sections').delete().eq('id', sectionId).then(({ error }) => { if (error) reloadLyrics(id); });
        }

        function lyricsSyncPositions(list) {
            list.forEach((s, idx) => {
                s.position = idx;
                sb.from('lyrics_sections').update({ position: idx }).eq('id', s.id).then(() => {});
            });
        }

        function lyricsReorderSection(fromId, toId) {
            if (!fromId || !toId || fromId === toId) return;
            const list = lyricsCurrentSections();
            const fromIdx = list.findIndex((s) => s.id === fromId);
            const toIdx = list.findIndex((s) => s.id === toId);
            if (fromIdx < 0 || toIdx < 0) return;
            const moved = list.splice(fromIdx, 1)[0];
            list.splice(toIdx, 0, moved);
            renderLyrics();
            lyricsSyncPositions(list);
        }

        function lyricsSetSectionType(sectionId, type) {
            const s = lyricsState.sections.find((x) => x.id === sectionId);
            if (!s) return;
            s.type = type;
            if (type !== 'custom') s.custom_name = null;
            renderLyrics();
            sb.from('lyrics_sections').update({ type: type, custom_name: s.custom_name }).eq('id', sectionId).then(() => {});
        }

        function lyricsSetSectionCustomName(sectionId, name) {
            const s = lyricsState.sections.find((x) => x.id === sectionId);
            if (!s) return;
            s.custom_name = name;
            sb.from('lyrics_sections').update({ custom_name: name }).eq('id', sectionId).then(() => {});
        }

        function lyricsSetSectionContent(sectionId, content) {
            const s = lyricsState.sections.find((x) => x.id === sectionId);
            if (!s) return;
            s.content = content;
            clearTimeout(lyricsSyncTimers[sectionId]);
            lyricsSyncTimers[sectionId] = setTimeout(() => {
                sb.from('lyrics_sections').update({ content: content }).eq('id', sectionId).then(({ error }) => { if (error) reloadLyrics(id); });
            }, 500);
        }

        function lyricsApplyRhymeColor(word, color) {
            const key = word.toLowerCase();
            if (lyricsState.rhymes[key] && lyricsState.rhymes[key].color === color) {
                delete lyricsState.rhymes[key];
                renderLyrics();
                sb.from('lyrics_rhyme_tags').delete().eq('project_id', id).eq('user_id', user.id).eq('word', key).then(() => {});
                return;
            }
            const groupWords = Object.keys(lyricsState.rhymes).filter((w) => lyricsState.rhymes[w].color === color && w !== key);
            const isSlant = groupWords.length > 0 && !groupWords.some((w) => lyricsWordsRhyme(key, w));
            if (isSlant) {
                const list = groupWords.map((w) => `"${w}"`).join(', ');
                if (!confirm(`"${word}" doesn't obviously rhyme with ${list}.\n\nAdd it to this rhyme group anyway? It'll be marked as a non-obvious rhyme (dashed underline) so it's clear it's not a direct match.`)) return;
            }
            lyricsState.rhymes[key] = { color: color, isSlant: isSlant };
            renderLyrics();
            sb.from('lyrics_rhyme_tags').upsert({
                project_id: id, user_id: user.id, word: key, color: color, is_slant: isSlant
            }, { onConflict: 'project_id,user_id,word' }).then(({ error }) => { if (error) reloadLyrics(id); });
        }

        function lyricsAddPaletteColor() {
            const usedHues = lyricsState.palette.map((c) => {
                const m = String(c).replace('#', '').match(/^([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
                if (!m) return 0;
                const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
                const max = Math.max(r, g, b), min = Math.min(r, g, b);
                let h = 0;
                if (max !== min) {
                    const d = max - min;
                    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
                    else if (max === g) h = (b - r) / d + 2;
                    else h = (r - g) / d + 4;
                    h *= 60;
                }
                return h;
            });
            let bestHue = 0, bestDistance = -1;
            for (let h = 0; h < 360; h += 5) {
                let minDist = 360;
                usedHues.forEach((uh) => { const d = Math.abs(h - uh); minDist = Math.min(minDist, Math.min(d, 360 - d)); });
                if (minDist > bestDistance) { bestDistance = minDist; bestHue = h; }
            }
            const sat = 65 + Math.floor(Math.random() * 15), light = 58 + Math.floor(Math.random() * 8);
            const s2 = sat / 100, l2 = light / 100;
            const k = (n) => (n + bestHue / 30) % 12;
            const a2 = s2 * Math.min(l2, 1 - l2);
            const f = (n) => { const c = l2 - a2 * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return Math.round(c * 255).toString(16).padStart(2, '0'); };
            const newColor = '#' + f(0) + f(8) + f(4);
            lyricsState.palette.push(newColor);
            renderLyrics();
            sb.from('lyrics_books').update({ palette: lyricsState.palette }).eq('project_id', id).then(() => {});
        }

        function lyricsCopySectionToMain(sectionId) {
            if (lyricsState.mainFinalized) { alert('Main Lyrics is finalized. Unlock it first to add more sections.'); return; }
            const src = lyricsState.sections.find((s) => s.id === sectionId);
            if (!src) return;
            if (lyricsMainSections().some((s) => s.source_section_id === sectionId)) { alert('That section is already in Main Lyrics.'); return; }
            const mainList = lyricsMainSections();
            const copy = {
                id: lyricsNewSectionId(), project_id: id, user_id: user.id, is_main: true,
                type: src.type, custom_name: src.custom_name, content: src.content,
                position: mainList.length, source_user_id: src.user_id, source_section_id: src.id
            };
            lyricsState.sections.push(copy);
            lyricsState.activeTab = LYRICS_MAIN_TAB;
            renderLyrics();
            sb.from('lyrics_sections').insert(copy).then(({ error }) => { if (error) reloadLyrics(id); });
        }

        function lyricsFinalizeMain() {
            if (lyricsState.mainFinalized) return;
            if (!lyricsMainSections().length) { alert('Main Lyrics is empty — add at least one section before finalizing.'); return; }
            if (!confirm('Finalize Main Lyrics? Sections become read-only — you can always Unlock to change them again.')) return;
            lyricsState.mainFinalized = true;
            lyricsState.mainFinalizedAt = new Date().toISOString();
            renderLyrics();
            sb.from('lyrics_books').update({ main_finalized: true, main_finalized_at: lyricsState.mainFinalizedAt }).eq('project_id', id).then(() => {});
        }

        function lyricsUnfinalizeMain() {
            if (!lyricsState.mainFinalized) return;
            lyricsState.mainFinalized = false;
            lyricsState.mainFinalizedAt = null;
            renderLyrics();
            sb.from('lyrics_books').update({ main_finalized: false, main_finalized_at: null }).eq('project_id', id).then(() => {});
        }

        // ---------- Event wiring (attached once; expandEl content re-renders around it) ----------
        function wireLyricsEvents() {
            if (expandEl.dataset.lyricsWired) return;
            expandEl.dataset.lyricsWired = '1';

            expandEl.addEventListener('click', (e) => {
                if (activeKey !== 'action:lyrics') return;

                const tab = e.target.closest('[data-lyrics-tab]');
                if (tab) { lyricsState.activeTab = tab.dataset.lyricsTab; lyricsState.activeColor = null; renderLyrics(); return; }

                const swatch = e.target.closest('[data-lyrics-color]');
                if (swatch) {
                    const c = swatch.dataset.lyricsColor;
                    lyricsState.activeColor = (lyricsState.activeColor === c) ? null : c;
                    renderLyrics();
                    return;
                }
                if (e.target.closest('[data-lyrics-add-color]')) { lyricsAddPaletteColor(); return; }

                const word = e.target.closest('.pj-lyrics-word');
                if (word && lyricsState.activeColor) { lyricsApplyRhymeColor(word.dataset.word, lyricsState.activeColor); return; }

                const addBtn = e.target.closest('[data-lyrics-add-btn]');
                if (addBtn) {
                    const sel = expandEl.querySelector('[data-lyrics-add-select]');
                    const custom = expandEl.querySelector('[data-lyrics-add-custom]');
                    lyricsAddSection(sel && sel.value, custom && custom.value);
                    return;
                }

                const delBtn = e.target.closest('[data-lyrics-delete]');
                if (delBtn) { if (confirm('Delete this section?')) lyricsDeleteSection(delBtn.dataset.lyricsDelete); return; }

                const toggleBtn = e.target.closest('[data-lyrics-edit-toggle]');
                if (toggleBtn) {
                    const sid = toggleBtn.dataset.lyricsEditToggle;
                    if (lyricsState.editingIds.has(sid)) lyricsState.editingIds.delete(sid); else lyricsState.editingIds.add(sid);
                    renderLyrics();
                    const ta = expandEl.querySelector(`[data-lyrics-editor="${sid}"]`);
                    if (ta) ta.focus();
                    return;
                }

                const toMainBtn = e.target.closest('[data-lyrics-to-main]');
                if (toMainBtn) { lyricsCopySectionToMain(toMainBtn.dataset.lyricsToMain); return; }

                if (e.target.closest('[data-lyrics-finalize]')) { lyricsFinalizeMain(); return; }
                if (e.target.closest('[data-lyrics-unfinalize]')) { lyricsUnfinalizeMain(); return; }
            });

            expandEl.addEventListener('change', (e) => {
                if (activeKey !== 'action:lyrics') return;
                const sel = e.target.closest('[data-lyrics-add-select]');
                if (sel) {
                    const custom = expandEl.querySelector('[data-lyrics-add-custom]');
                    if (custom) custom.hidden = sel.value !== 'custom';
                    return;
                }
                const typeSel = e.target.closest('[data-lyrics-type]');
                if (typeSel) { lyricsSetSectionType(typeSel.dataset.lyricsType, typeSel.value); return; }
            });

            expandEl.addEventListener('input', (e) => {
                if (activeKey !== 'action:lyrics') return;
                const ta = e.target.closest('[data-lyrics-editor]');
                if (ta) { lyricsSetSectionContent(ta.dataset.lyricsEditor, ta.value); return; }
                const nameInp = e.target.closest('[data-lyrics-custom-name]');
                if (nameInp) { lyricsSetSectionCustomName(nameInp.dataset.lyricsCustomName, nameInp.value); return; }
            });

            // Catch up on any re-render a realtime update deferred while
            // typing, once focus actually leaves the editor entirely (not
            // just moving to another text field).
            expandEl.addEventListener('focusout', (e) => {
                if (activeKey !== 'action:lyrics' || !lyricsRenderPending) return;
                const leavingEditor = e.target.matches && (e.target.matches('[data-lyrics-editor]') || e.target.matches('[data-lyrics-custom-name]'));
                if (!leavingEditor) return;
                const enteringEditor = e.relatedTarget && e.relatedTarget.matches && (e.relatedTarget.matches('[data-lyrics-editor]') || e.relatedTarget.matches('[data-lyrics-custom-name]'));
                if (enteringEditor) return;
                lyricsRenderPending = false;
                renderLyrics();
            });

            // Drag-to-reorder sections within the active tab's list.
            let dragId = null;
            expandEl.addEventListener('dragstart', (e) => {
                const handle = e.target.closest('[data-lyrics-drag]');
                const li = e.target.closest('.pj-lyrics-section');
                if (!li) return;
                if (!handle && activeKey === 'action:lyrics') { e.preventDefault(); return; }
                dragId = li.dataset.sectionId;
                li.classList.add('is-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            expandEl.addEventListener('dragend', (e) => {
                const li = e.target.closest('.pj-lyrics-section');
                if (li) li.classList.remove('is-dragging');
                dragId = null;
            });
            expandEl.addEventListener('dragover', (e) => {
                if (activeKey !== 'action:lyrics' || !dragId) return;
                if (e.target.closest('.pj-lyrics-section')) e.preventDefault();
            });
            expandEl.addEventListener('drop', (e) => {
                if (activeKey !== 'action:lyrics' || !dragId) return;
                const li = e.target.closest('.pj-lyrics-section');
                if (!li) return;
                e.preventDefault();
                lyricsReorderSection(dragId, li.dataset.sectionId);
                dragId = null;
            });
        }

        async function expandLyrics(triggerBtn) {
            const key = 'action:lyrics';
            if (activeKey === key) { closeExpand(); return; }
            activeKey = key;
            markActiveBtn(triggerBtn);
            expandEl.hidden = false;
            expandEl.innerHTML = `
                <div class="pc-expand__head">
                    <h4 class="pc-expand__title">Lyrics Studio</h4>
                    <button type="button" class="pc-expand__close" data-expand-close>Close</button>
                </div>
                <p class="pc-expand__hint">Write lyrics together, section by section. Click a word and pick a color to mark rhymes — any number of words can share a color, even non-obvious ones.</p>
                <div data-lyrics-body style="color:#BFD7FF;text-align:center;padding:24px;">Loading…</div>
            `;
            expandEl.querySelector('[data-expand-close]').addEventListener('click', () => { stopLyricsRealtime(); closeExpand(); });
            wireLyricsEvents();

            await ensureLyricsBook(id);
            const raw = await fetchLyricsBook(id);
            const myEntry = (members || []).find((m) => m.user_id === user.id);
            lyricsState = {
                palette: RHYME_PALETTE_DEFAULT.slice(), mainFinalized: false, mainFinalizedAt: null,
                sections: [], rhymes: {}, editingIds: new Set(),
                activeTab: myEntry ? user.id : LYRICS_MAIN_TAB, activeColor: null
            };
            applyLyricsRaw(raw);
            startLyricsRealtime(id);
            renderLyrics();
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
                const hadBadge = clearUnseenBadge(btn, 'uploads', t);
                expandFiles('uploads', t, 'Uploads · ' + (FILE_TYPE_LABELS[t] || t), btn, hadBadge);
            });
        });
        host.querySelectorAll('[data-final]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const t = btn.getAttribute('data-final');
                const hadBadge = clearUnseenBadge(btn, 'finals', t);
                expandFiles('finals', t, 'Finals · ' + (FILE_TYPE_LABELS[t] || t), btn, hadBadge);
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
            btn.addEventListener('click', () => { expandLog(btn); });
        });

        host.querySelectorAll('[data-action="lyrics"]').forEach((btn) => {
            btn.addEventListener('click', () => { expandLyrics(btn); });
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
