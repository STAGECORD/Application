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
    const escapeAttr = escapeHtml; // window.STAGECORD only exposes escapeHtml; it already escapes quotes so it's attribute-safe too

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
                                <button type="button" class="pill-btn" data-action="lyrics" data-help="Lyrics Studio: write lyrics together, section by section, with everyone's own notebook plus a shared Main Lyrics. Click a word and pick a color to mark rhyme groups — then toggle Sheet Music to add a grand staff (treble &amp; bass clef) underneath.">Lyrics Studio</button>
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
            if (activeKey === 'action:lyrics' && typeof stopSheetRealtime === 'function') { stopSheetRealtime(); hideSheetPicker(); }
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

        // ---------- Rhyme suggestion dictionary (English + Danish) ----------
        const RHYME_CLUSTERS = [
            // English
            ['light','fight','right','night','sight','bright','tight','white','might','knight','slight','flight','height','delight','tonight'],
            ['day','way','say','play','stay','bay','gray','away','today','may','astray','okay','hooray','display','replay'],
            ['love','dove','above','glove','shove','of'],
            ['time','rhyme','climb','mime','dime','lime','sublime','prime','crime','sometime'],
            ['heart','start','part','smart','art','depart','apart','chart','dart','impart'],
            ['street','beat','meet','sweet','feet','defeat','repeat','treat','heat','complete','seat','greet'],
            ['smile','mile','while','pile','style','awhile','aisle','isle','file'],
            ['rain','pain','main','brain','stain','plain','again','train','vein','remain','contain','obtain','strain'],
            ['fire','desire','higher','wire','hire','admire','choir','tire','aspire','inspire'],
            ['mind','find','blind','kind','behind','wind','grind','remind','signed','aligned'],
            ['eye','sky','fly','high','cry','try','goodbye','dry','sigh','lie','tie','why','reply','rely'],
            ['sound','found','around','ground','round','bound','astound','profound','unwound'],
            ['true','blue','through','crew','flew','knew','few','grew','do','you','to','view','renew'],
            ['gold','cold','hold','told','bold','old','behold','sold','controlled'],
            ['feel','real','heal','steal','wheel','reveal','deal','seal','reel','peel'],
            ['know','glow','show','flow','slow','grow','below','tomorrow','window','rainbow','hello'],
            ['hand','land','stand','grand','band','demand','understand','command','expand','plan'],
            ['girl','world','curl','swirl','pearl','twirl','whirl','unfurl'],
            ['gone','dawn','on','upon','beyond','con'],
            ['alone','phone','stone','bone','known','tone','grown','blown','shown','zone'],
            ['name','game','flame','same','blame','frame','came','fame','shame','tame'],
            ['soul','whole','goal','role','control','console','toll','stroll','patrol'],
            ['wake','make','take','break','shake','fake','sake','stake','snake','cake','mistake'],
            ['hold','told','bold','old','cold','gold','sold','behold','controlled','folded'],
            ['stay','away','say','today','play','okay','grey','bay','spray','delay'],
            // Danish — common endings
            ['hånd','land','stand','sand','vand','brand','grand','strand','blandt'],
            ['år','hår','vår','kår','tår','går','står','små','blå','rå'],
            ['mig','dig','sig','vig','svig','tilbage'],
            ['gang','lang','slang','sang','fang','klang','trang','stang','vang','rang'],
            ['lyse','knuse','huse','bruse','pulserende','tryse'],
            ['drøm','strøm','tøm','sværm','varm','arm','barm','charme'],
            ['hjerte','smerte','mørke','styrke','række','lykke','trykke'],
            ['nat','glat','flad','stad','glad','tap','klap','snak'],
            ['liv','giv','skriv','kniv','driv','aktiv','intensiv'],
            ['tid','flid','strid','lid','vid','ridse','blid','bid'],
            ['øje','høje','føje','nøje','tøje','møde','søde','grøde'],
            ['rejse','kvæg','væk','sek','ekko','dejligt'],
            ['vej','dig','sej','tej','svæv','levn'],
            ['nu','du','ku','tro','sko','fro','sno','flo']
        ];
        const LYRICS_WORD_INDEX = {};
        RHYME_CLUSTERS.forEach((cluster, idx) => { cluster.forEach((w) => { LYRICS_WORD_INDEX[w.toLowerCase()] = idx; }); });

        // Suggest rhymes for a word. Tries direct cluster membership first,
        // then falls back to last-2/3 letter matches across the whole dict.
        function suggestRhymes(word) {
            const w = word.toLowerCase().replace(/[^a-zæøå0-9]/g, '');
            if (!w) return [];
            const direct = LYRICS_WORD_INDEX[w];
            const out = [];
            const seen = { [w]: true };
            if (typeof direct === 'number') {
                RHYME_CLUSTERS[direct].forEach((c) => { if (!seen[c]) { out.push(c); seen[c] = true; } });
            }
            const tail3 = w.slice(-3);
            const tail2 = w.slice(-2);
            const tier3 = [], tier2 = [];
            RHYME_CLUSTERS.forEach((cluster) => {
                cluster.forEach((c) => {
                    if (seen[c]) return;
                    if (tail3.length >= 3 && c.endsWith(tail3)) tier3.push(c);
                    else if (c.endsWith(tail2)) tier2.push(c);
                });
            });
            tier3.forEach((c) => { if (!seen[c]) { out.push(c); seen[c] = true; } });
            tier2.forEach((c) => { if (!seen[c]) { out.push(c); seen[c] = true; } });
            return out.slice(0, 18);
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
            // Every write we make echoes back to us too, not just to
            // teammates. We already applied our own writes optimistically,
            // so refetching on our own echo is both unnecessary and
            // disruptive (it was cutting off "click word 1, then word 2"
            // mid-sequence). Only actually reload for a change that isn't
            // ours — payload.new covers INSERT/UPDATE; payload.old covers
            // DELETE (needs REPLICA IDENTITY FULL to carry user_id).
            const handleRowChange = (payload) => {
                const row = (payload.new && Object.keys(payload.new).length) ? payload.new : payload.old;
                if (row && row.user_id && row.user_id === user.id) return;
                reloadLyrics(projectId);
            };
            lyricsChannel = sb.channel('pj-lyrics-' + projectId)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'lyrics_sections', filter: 'project_id=eq.' + projectId }, handleRowChange)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'lyrics_rhyme_tags', filter: 'project_id=eq.' + projectId }, handleRowChange)
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
            // Keyed by exact occurrence (section + line + word position),
            // not by word text — the same word appearing elsewhere in the
            // notebook shouldn't get auto-colored just because it matches.
            lyricsState.rhymes = {};
            (raw.rhymes || []).forEach((r) => {
                if (r.user_id === user.id && r.section_id != null && r.line_index != null && r.word_index != null) {
                    const key = r.section_id + '|' + r.line_index + '|' + r.word_index;
                    lyricsState.rhymes[key] = { word: r.word, color: r.color, isSlant: !!r.is_slant };
                }
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

        function tokenizeLyricsSingleLine(sectionId, lineIdx, line, rhymes) {
            if (!line.trim()) return '<p class="pj-lyrics-line">&nbsp;</p>';
            let html = '';
            let wordIdx = 0;
            const re = /([\p{L}\p{N}'-]+)|([^\p{L}\p{N}]+)/gu;
            let match;
            while ((match = re.exec(line)) !== null) {
                if (match[1]) {
                    const tok = match[1];
                    const occKey = sectionId + '|' + lineIdx + '|' + wordIdx;
                    const tag = rhymes[occKey];
                    const color = tag && tag.color;
                    const style = color ? ` style="color:${color};"` : '';
                    const cls = 'pj-lyrics-word' + (color ? ' has-rhyme' : '') + (tag && tag.isSlant ? ' is-slant' : '');
                    const title = (tag && tag.isSlant) ? ' title="Marked as a rhyme even though it\'s not a direct match — still counts when pronounced/sung."' : '';
                    html += `<span class="${cls}" data-occurrence="${escapeHtml(occKey)}" data-word="${escapeHtml(tok.toLowerCase())}"${style}${title}>${escapeHtml(tok)}</span>`;
                    wordIdx++;
                } else {
                    html += escapeHtml(match[2]);
                }
            }
            return `<p class="pj-lyrics-line">${html}</p>`;
        }

        function tokenizeLyricsLine(sectionId, text, rhymes) {
            if (!text) return '';
            return text.split('\n').map((line, lineIdx) => tokenizeLyricsSingleLine(sectionId, lineIdx, line, rhymes)).join('');
        }

        // Interleaved view: each colored lyric line immediately followed
        // by its own grand staff (when Sheet Music is toggled on), rather
        // than all lyric lines then all staves in separate blocks.
        function tokenizeLyricsLineWithSheet(sectionId, text, rhymes) {
            if (!text) return '';
            return text.split('\n').map((line, lineIdx) => {
                const lineHtml = tokenizeLyricsSingleLine(sectionId, lineIdx, line, rhymes);
                const words = line.trim().split(/\s+/).filter(Boolean);
                if (!sheetVisible || !sheetState || !words.length) return lineHtml;
                const staffHtml = `${sheetPickerInlineHtml(sectionId, lineIdx, words)}<div class="pj-sheet-staff-wrap pj-sheet-inline">
                    <div class="pj-sheet-vf-line" data-vf-section="${escapeAttr(sectionId)}" data-vf-line="${lineIdx}" data-vf-words="${escapeAttr(JSON.stringify(words))}"></div>
                    ${renderSheetWords(words, sectionId, lineIdx)}
                </div>`;
                return lineHtml + staffHtml;
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
            const sheetGroup = sheetState ? `
                <div class="pj-lyrics-toolbar__group">
                    <button type="button" class="pj-btn pj-btn--ghost" data-lyrics-toggle-sheet>${sheetVisible ? '🎼 Hide Sheet Music' : '🎼 Sheet Music'}</button>
                </div>
                ${sheetVisible ? `
                <div class="pj-lyrics-toolbar__group"><span class="pj-lyrics-hint-label">Tempo</span>
                    <input type="number" class="pj-lyrics-toolbar__custom" style="width:64px;" data-sheet-tempo value="${sheetState.tempo}" min="40" max="240"> BPM</div>
                <div class="pj-lyrics-toolbar__group"><span class="pj-lyrics-hint-label">Time</span>
                    <select class="pj-lyrics-toolbar__select" data-sheet-time>${SHEET_TIME_SIGNATURES.map((t) => `<option value="${t}"${t === sheetState.timeSignature ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
                <div class="pj-lyrics-toolbar__group"><span class="pj-lyrics-hint-label">Key</span>
                    <select class="pj-lyrics-toolbar__select" data-sheet-key>${SHEET_KEYS.map((k) => `<option value="${escapeAttr(k)}"${k === sheetState.key ? ' selected' : ''}>${escapeHtml(k)}</option>`).join('')}</select></div>` : ''}` : '';
            return `<div class="pj-lyrics-toolbar">
                ${addGroup}
                ${readOnlyNote}
                <div class="pj-lyrics-toolbar__group">
                    <span class="pj-lyrics-hint-label">Rhyme colors:</span>
                    <div class="pj-lyrics-palette">${swatches}<button type="button" class="pj-lyrics-swatch-add" data-lyrics-add-color aria-label="Add color">+</button></div>
                </div>
                ${sheetGroup}
            </div>
            <p class="pj-lyrics-hint">${lyricsState.activeColor ? `Paint mode: click a word, or drag across a phrase to select several at once, to mark it with the selected color. Click/drag the same selection again to turn it off.` : `Select a rhyme color, then click a word — or drag across a phrase — to group it as a rhyme. Either side can be any number of words.`}</p>
            ${sheetVisible ? `<p class="pj-lyrics-hint">Sheet Music: click a word below to set its pitch and duration on the treble or bass staff — a word can carry a note on both at once.</p>` : ''}`;
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
            const alreadyInMain = !onMain && lyricsMainSections().some((s) => s.source_section_id === section.id);
            const toMainBtn = alreadyInMain
                ? `<span class="pj-lyrics-section__source pj-lyrics-section__source--done">✓ In Main Lyrics</span>`
                : ((!onMain && section.content && !lyricsState.mainFinalized)
                    ? `<button type="button" class="pj-lyrics-section__action" data-lyrics-to-main="${section.id}">→ Main</button>` : '');
            const view = tokenizeLyricsLineWithSheet(section.id, section.content || '', lyricsState.rhymes);
            return `<li class="pj-lyrics-section${locked ? ' is-locked' : ''}" data-section-id="${section.id}">
                <div class="pj-lyrics-section__head">
                    ${locked ? '' : `<button type="button" class="pj-lyrics-section__drag" data-lyrics-drag="${section.id}" draggable="true" aria-label="Drag to reorder">⋮⋮</button>`}
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
                        ? `<textarea class="pj-lyrics-editor" data-lyrics-editor="${section.id}" placeholder="Write your lines here — one per line…">${escapeHtml(section.content || '')}</textarea>
                           <div class="pj-lyrics-suggest-bar" data-lyrics-suggest="${section.id}"></div>
                           ${(sheetVisible && sheetState) ? renderSheetForSection(section) : ''}`
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
            try {
                body.innerHTML = renderLyricsTabs() + renderLyricsToolbar() + renderLyricsBanner() + renderLyricsSections();
                drawAllSheetStaves();
            } catch (err) {
                console.error('renderLyrics failed:', err);
                body.innerHTML = `<p class="pj-lyrics-placeholder" style="color:#FF6A55;">Something went wrong rendering Lyrics Studio: ${escapeHtml((err && err.message) || String(err))}</p>`;
            }
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
            if (ta) { ta.focus(); lyricsUpdateSuggestBar(section.id, ta); }
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

        // ---------- Rhyme-suggestion bar — shows suggestions for the
        // previous line's last word, so the writer has something to work
        // toward for the line they're currently on. Updates live as the
        // cursor moves or the text changes.
        function lyricsCursorLineIndex(textarea) {
            const pos = textarea.selectionStart || 0;
            return textarea.value.slice(0, pos).split('\n').length - 1;
        }

        function lyricsUpdateSuggestBar(sectionId, textarea) {
            const bar = expandEl.querySelector(`[data-lyrics-suggest="${sectionId}"]`);
            if (!bar) return;
            const lines = textarea.value.split('\n');
            const curLine = lyricsCursorLineIndex(textarea);
            let prevWord = '';
            for (let i = curLine - 1; i >= 0; i--) {
                const words = (lines[i] || '').trim().split(/\s+/).filter(Boolean);
                if (words.length) { prevWord = words[words.length - 1].replace(/[^\p{L}\p{N}'-]/gu, ''); break; }
            }
            if (!prevWord) {
                bar.innerHTML = `<span class="pj-lyrics-suggest-hint">Write a line, then start the next one — rhyme suggestions for the line above will show up here.</span>`;
                return;
            }
            const suggestions = suggestRhymes(prevWord);
            if (!suggestions.length) {
                bar.innerHTML = `<span class="pj-lyrics-suggest-hint">No rhyme suggestions found for "${escapeHtml(prevWord)}".</span>`;
                return;
            }
            bar.innerHTML = `<span class="pj-lyrics-suggest-label">Rhymes with "${escapeHtml(prevWord)}":</span>` +
                suggestions.slice(0, 10).map((w) => `<button type="button" class="pj-lyrics-suggest-chip" data-lyrics-insert="${escapeHtml(w)}">${escapeHtml(w)}</button>`).join('');
        }

        // occurrenceKey = "sectionId|lineIndex|wordIndex" — a tag applies
        // to this exact word at this exact spot, not to the word text
        // wherever else it might appear in the notebook.
        //
        // items = [{ key, word }, …] — either side of a rhyme pairing can
        // be one word (a plain click) or a dragged-out phrase of any
        // length; both are handled the same way here.
        function lyricsApplyRhymeColorBatch(items, color) {
            if (!items.length) return;

            // Toggle off: the whole selection already has this exact
            // color — remove it, same gesture as a single-word toggle.
            const allSameColor = items.every((it) => lyricsState.rhymes[it.key] && lyricsState.rhymes[it.key].color === color);
            if (allSameColor) {
                items.forEach((it) => { delete lyricsState.rhymes[it.key]; });
                renderLyrics();
                const ops = items.map((it) => {
                    const [sectionId, lineIndex, wordIndex] = it.key.split('|');
                    return sb.from('lyrics_rhyme_tags').delete()
                        .eq('project_id', id).eq('user_id', user.id)
                        .eq('section_id', sectionId).eq('line_index', Number(lineIndex)).eq('word_index', Number(wordIndex));
                });
                Promise.all(ops).then(() => {});
                return;
            }

            const existingGroupWords = Object.keys(lyricsState.rhymes)
                .filter((k) => lyricsState.rhymes[k].color === color && !items.some((it) => it.key === k))
                .map((k) => lyricsState.rhymes[k].word);
            const selectionWords = items.map((it) => it.word);
            // A word counts as "obvious" if it rhymes with something
            // already in the group, or with another word in this same
            // selection (so a whole dragged phrase can validate itself).
            const isSlant = (existingGroupWords.length > 0 || selectionWords.length > 1) &&
                !items.some((it) =>
                    existingGroupWords.some((w) => lyricsWordsRhyme(it.word, w)) ||
                    selectionWords.some((w) => w !== it.word && lyricsWordsRhyme(it.word, w))
                );
            if (isSlant) {
                const label = selectionWords.join(' ');
                const list = existingGroupWords.length ? existingGroupWords.map((w) => `"${w}"`).join(', ') : 'the rest of this group';
                if (!confirm(`"${label}" doesn't obviously rhyme with ${list}.\n\nAdd it to this rhyme group anyway? It'll be marked as a non-obvious rhyme (dashed underline) so it's clear it's not a direct match.`)) return;
            }

            items.forEach((it) => { lyricsState.rhymes[it.key] = { word: it.word, color: color, isSlant: isSlant }; });
            renderLyrics();
            const rows = items.map((it) => {
                const [sectionId, lineIndex, wordIndex] = it.key.split('|');
                return {
                    project_id: id, user_id: user.id, section_id: sectionId, line_index: Number(lineIndex), word_index: Number(wordIndex),
                    word: it.word, color: color, is_slant: isSlant
                };
            });
            sb.from('lyrics_rhyme_tags').upsert(rows, { onConflict: 'project_id,user_id,section_id,line_index,word_index' }).then(({ error }) => { if (error) reloadLyrics(id); });
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

                if (e.target.closest('[data-lyrics-toggle-sheet]')) { sheetVisible = !sheetVisible; hideSheetPicker(); renderLyrics(); return; }

                // Word selection (single click or dragged phrase) is
                // handled on mousedown/mouseup below, not here.

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
                    if (ta) { ta.focus(); lyricsUpdateSuggestBar(sid, ta); }
                    return;
                }

                const toMainBtn = e.target.closest('[data-lyrics-to-main]');
                if (toMainBtn) { lyricsCopySectionToMain(toMainBtn.dataset.lyricsToMain); return; }

                if (e.target.closest('[data-lyrics-finalize]')) { lyricsFinalizeMain(); return; }
                if (e.target.closest('[data-lyrics-unfinalize]')) { lyricsUnfinalizeMain(); return; }

                const insertChip = e.target.closest('[data-lyrics-insert]');
                if (insertChip) {
                    const bar = insertChip.closest('.pj-lyrics-suggest-bar');
                    const sid = bar && bar.dataset.lyricsSuggest;
                    const ta = sid && expandEl.querySelector(`[data-lyrics-editor="${sid}"]`);
                    if (ta) {
                        const wordToInsert = insertChip.dataset.lyricsInsert;
                        const start = ta.selectionStart, end = ta.selectionEnd;
                        const before = ta.value.slice(0, start);
                        const after = ta.value.slice(end);
                        const needsSpace = before && !/\s$/.test(before);
                        const insert = (needsSpace ? ' ' : '') + wordToInsert;
                        ta.value = before + insert + after;
                        const newPos = (before + insert).length;
                        ta.focus();
                        ta.setSelectionRange(newPos, newPos);
                        lyricsSetSectionContent(sid, ta.value);
                        lyricsUpdateSuggestBar(sid, ta);
                    }
                    return;
                }
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
                if (ta) { lyricsSetSectionContent(ta.dataset.lyricsEditor, ta.value); lyricsUpdateSuggestBar(ta.dataset.lyricsEditor, ta); return; }
                const nameInp = e.target.closest('[data-lyrics-custom-name]');
                if (nameInp) { lyricsSetSectionCustomName(nameInp.dataset.lyricsCustomName, nameInp.value); return; }
            });

            // Cursor moving without the text changing (click, arrow keys)
            // should still refresh which line's rhymes are being suggested.
            expandEl.addEventListener('keyup', (e) => {
                if (activeKey !== 'action:lyrics') return;
                const ta = e.target.closest('[data-lyrics-editor]');
                if (ta) lyricsUpdateSuggestBar(ta.dataset.lyricsEditor, ta);
            });
            expandEl.addEventListener('click', (e) => {
                if (activeKey !== 'action:lyrics') return;
                const ta = e.target.closest('[data-lyrics-editor]');
                if (ta) lyricsUpdateSuggestBar(ta.dataset.lyricsEditor, ta);
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

            // Rhyme word/phrase selection: click one word, or drag from
            // the first word to the last word of a phrase to select it as
            // one unit — either side of a rhyme pairing can be any number
            // of words. Tracked via mousedown/mouseup rather than native
            // text selection or HTML5 drag (both fought with this before).
            let lyricsSelectStartKey = null;
            expandEl.addEventListener('mousedown', (e) => {
                if (activeKey !== 'action:lyrics') { lyricsSelectStartKey = null; return; }
                const w = e.target.closest('.pj-lyrics-word');
                lyricsSelectStartKey = w ? w.dataset.occurrence : null;
            });
            expandEl.addEventListener('mouseup', (e) => {
                if (activeKey !== 'action:lyrics' || !lyricsState || !lyricsState.activeColor) { lyricsSelectStartKey = null; return; }
                const endWordEl = e.target.closest('.pj-lyrics-word');
                const startKey = lyricsSelectStartKey;
                lyricsSelectStartKey = null;
                if (!endWordEl) return;
                const endKey = endWordEl.dataset.occurrence;

                if (!startKey || startKey === endKey) {
                    lyricsApplyRhymeColorBatch([{ key: endKey, word: endWordEl.dataset.word }], lyricsState.activeColor);
                    return;
                }
                const [sId, sLine, sWord] = startKey.split('|');
                const [eId, eLine, eWord] = endKey.split('|');
                if (sId !== eId || sLine !== eLine) {
                    // Dragged across lines/sections — treat as a plain
                    // click on wherever the drag ended, rather than guess.
                    lyricsApplyRhymeColorBatch([{ key: endKey, word: endWordEl.dataset.word }], lyricsState.activeColor);
                    return;
                }
                const lo = Math.min(Number(sWord), Number(eWord));
                const hi = Math.max(Number(sWord), Number(eWord));
                const items = [];
                for (let w = lo; w <= hi; w++) {
                    const k = `${sId}|${sLine}|${w}`;
                    const el = expandEl.querySelector(`.pj-lyrics-word[data-occurrence="${k}"]`);
                    if (el) items.push({ key: k, word: el.dataset.word });
                }
                lyricsApplyRhymeColorBatch(items, lyricsState.activeColor);
            });

            // Drag-to-reorder sections within the active tab's list.
            let dragId = null;
            expandEl.addEventListener('dragstart', (e) => {
                if (e.target.closest('[data-sheet-word-drag]')) return; // handled by wireSheetMusicEvents
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

            wireSheetMusicEvents();
        }

        // One-time recovery for tags created before rhyme tagging moved to
        // per-occurrence (section_id IS NULL rows): the old scheme only
        // ever recorded "this word, some color", with no position — there's
        // no way to know which occurrence was originally meant. Best
        // faithful recovery: re-apply that color to every current
        // occurrence of the word in the user's own sections, using the
        // exact same tokenizer as the display so indices can't drift,
        // then retire the old rows. Runs automatically, silently, once.
        async function lyricsBackfillLegacyTags(raw) {
            const legacy = (raw.rhymes || []).filter((r) => r.user_id === user.id && r.section_id == null);
            if (!legacy.length) return false;

            const mySections = lyricsState.sections.filter((s) => s.user_id === user.id);
            const seen = new Set();
            const inserts = [];
            legacy.forEach((tag) => {
                mySections.forEach((sec) => {
                    (sec.content || '').split('\n').forEach((line, lineIdx) => {
                        let wordIdx = 0;
                        const re = /([\p{L}\p{N}'-]+)|([^\p{L}\p{N}]+)/gu;
                        let match;
                        while ((match = re.exec(line)) !== null) {
                            if (match[1]) {
                                if (match[1].toLowerCase() === tag.word) {
                                    const occKey = sec.id + '|' + lineIdx + '|' + wordIdx;
                                    if (!seen.has(occKey)) {
                                        seen.add(occKey);
                                        inserts.push({
                                            project_id: id, user_id: user.id, section_id: sec.id,
                                            line_index: lineIdx, word_index: wordIdx,
                                            word: tag.word, color: tag.color, is_slant: tag.is_slant
                                        });
                                    }
                                }
                                wordIdx++;
                            }
                        }
                    });
                });
            });

            if (inserts.length) {
                const { error } = await sb.from('lyrics_rhyme_tags').upsert(inserts, { onConflict: 'project_id,user_id,section_id,line_index,word_index' });
                if (error) {
                    // Don't delete the legacy rows if the backfill didn't
                    // actually land — better to retry next time than to
                    // silently lose the colors for good.
                    console.warn('Lyrics rhyme-tag backfill failed, will retry on next open:', error);
                    return false;
                }
            }
            await sb.from('lyrics_rhyme_tags').delete().eq('project_id', id).eq('user_id', user.id).is('section_id', null);
            return true;
        }

        // Shared by both Lyrics Studio and Sheet Music (which needs the
        // same section/line/word data to know what it's annotating).
        // forceRefresh = true always refetches (Lyrics Studio opening
        // fresh); false reuses already-loaded state for this project if
        // present (Sheet Music switching in without Lyrics Studio open).
        async function ensureLyricsStateLoaded(projectId, forceRefresh) {
            if (!forceRefresh && lyricsState && lyricsState.__projectId === projectId) return lyricsState;
            await ensureLyricsBook(projectId);
            let raw = await fetchLyricsBook(projectId);
            const myEntry = (members || []).find((m) => m.user_id === user.id);
            lyricsState = {
                __projectId: projectId,
                palette: RHYME_PALETTE_DEFAULT.slice(), mainFinalized: false, mainFinalizedAt: null,
                sections: [], rhymes: {}, editingIds: new Set(),
                activeTab: myEntry ? user.id : LYRICS_MAIN_TAB, activeColor: null
            };
            applyLyricsRaw(raw);
            if (await lyricsBackfillLegacyTags(raw)) {
                raw = await fetchLyricsBook(projectId);
                applyLyricsRaw(raw);
            }
            return lyricsState;
        }

        async function expandLyrics(triggerBtn) {
            const key = 'action:lyrics';
            if (activeKey === key) { closeExpand(); return; }
            activeKey = key;
            markActiveBtn(triggerBtn);
            expandEl.hidden = false;
            sheetVisible = false;
            expandEl.innerHTML = `
                <div class="pc-expand__head">
                    <h4 class="pc-expand__title">Lyrics Studio</h4>
                    <button type="button" class="pc-expand__close" data-expand-close>Close</button>
                </div>
                <p class="pc-expand__hint">Write lyrics together, section by section. Click a word and pick a color to mark rhymes — any number of words can share a color, even non-obvious ones.</p>
                <div data-lyrics-body style="color:#BFD7FF;text-align:center;padding:24px;">Loading…</div>
            `;
            expandEl.querySelector('[data-expand-close]').addEventListener('click', () => { stopLyricsRealtime(); stopSheetRealtime(); hideSheetPicker(); closeExpand(); });
            wireLyricsEvents();

            await ensureLyricsStateLoaded(id, true);
            startLyricsRealtime(id);

            try {
                await ensureSheetMusicSettings(id);
                sheetState = { tempo: 120, timeSignature: '4/4', key: 'C', notes: {}, wordOrder: {} };
                applySheetRaw(await fetchSheetMusic(id));
                startSheetRealtime(id);
            } catch (err) {
                console.error('Sheet Music failed to load:', err);
                sheetState = null;
            }

            renderLyrics();
        }

        // ===================================================================
        // Sheet Music — piano score (grand staff) notation, shown inline
        // inside Lyrics Studio behind a toggle (not a separate panel).
        // Notes are shared across the whole project (like Main Lyrics),
        // not per-person — any member can place or move a note on any
        // section, in whichever tab is currently open. A word can carry a
        // treble note and/or a bass note at once, rendered as a real
        // two-staff grand staff under that line.
        // ===================================================================
        const SHEET_WHITE_LETTERS = ['C','D','E','F','G','A','B'];
        const SHEET_BLACK_LETTERS = ['C#','D#','','F#','G#','A#'];
        const SHEET_OCTAVES = [2, 3, 4, 5, 6];
        const SHEET_LETTER_STEP = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
        const SHEET_KEYS = ['C','G','D','A','E','B','F','Bb','Eb','Ab','Am','Em','Bm','F#m','Dm','Gm','Cm'];
        const SHEET_TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4'];
        const SHEET_DURATIONS = [
            { id: 'whole',        glyph: '𝅝',  label: 'Whole' },
            { id: 'half',         glyph: '𝅗𝅥', label: 'Half' },
            { id: 'quarter',      glyph: '♩',  label: 'Quarter' },
            { id: 'eighth',       glyph: '♪',  label: 'Eighth' },
            { id: 'sixteenth',    glyph: '𝅘𝅥𝅯', label: 'Sixteenth' },
            { id: 'thirtysecond', glyph: '𝅘𝅥𝅰', label: '32nd' }
        ];
        const SHEET_DURATION_INDEX = {};
        SHEET_DURATIONS.forEach((d) => { SHEET_DURATION_INDEX[d.id] = d; });
        // A tuplet must fit entirely within one measure's word-slots (a
        // measure here is exactly as many slots as the time signature's
        // numerator) -- so quintuplets/septuplets only fit in 6/8 (6
        // slots) or bigger, and septuplets don't fit any current time
        // signature at all. notes_occupied is the "in the time of N"
        // half of the ratio; VexFlow defaults it to 2 for every size,
        // which is only correct for a triplet.
        const SHEET_TUPLET_SIZES = [
            { n: 3, title: 'Triplet: 3 notes in the time of 2' },
            { n: 5, title: 'Quintuplet: 5 notes in the time of 4 — only fits in 6/8' },
            { n: 6, title: 'Sextuplet: 6 notes in the time of 4 — only fits in 6/8' },
            { n: 7, title: "Septuplet: 7 notes in the time of 4 — doesn't fit any current time signature" }
        ];
        const SHEET_TUPLET_RATIOS = { 3: 2, 5: 4, 6: 4, 7: 4 };

        // ---------- "Runs": fast notes packed under one word/beat ----------
        // A run splits ONE word's slot into evenly-timed sub-notes,
        // independent of lyric word count (unlike a Tuplet, which spans
        // several EXISTING word-slots) — you don't pick a size upfront,
        // you just click pitches and the run grows by one each time.
        //
        // notesOccupied is the nearest power of 2 at or below the run's
        // actual length: a run whose length IS a power of 2 (2, 4, 8...)
        // is ordinary binary subdivision (two eighths, four sixteenths —
        // no bracket, just normal rhythm); any other length is a genuine
        // tuplet against the beat (3 in the time of 2, 5/6/7 in the time
        // of 4, etc.) and needs the bracket, using the same
        // notes_occupied mechanism as the regular Tuplet feature.
        function sheetRunNotesOccupied(n) {
            let p = 2;
            while (p * 2 <= n) p *= 2;
            return p;
        }
        const SHEET_DURATION_ORDER = ['whole', 'half', 'quarter', 'eighth', 'sixteenth', 'thirtysecond'];
        function sheetRunSubDuration(parentDuration, runSize) {
            const idx = SHEET_DURATION_ORDER.indexOf(parentDuration);
            if (idx < 0 || runSize < 2) return null;
            const steps = Math.log2(sheetRunNotesOccupied(runSize));
            const subIdx = idx + steps;
            return subIdx < SHEET_DURATION_ORDER.length ? SHEET_DURATION_ORDER[subIdx] : null;
        }

        let sheetState = null;
        let sheetVisible = false;
        let sheetChannel = null;
        let sheetReloadTimer = null;
        let sheetPickerKey = null;    // { sectionId, lineIdx, wordIdx }
        let sheetPickerOctave = 4;
        let sheetPickerClef = 'treble';
        let sheetMoveSelection = []; // [{ addr, sectionId, lineIdx, slotIdx, wordCount }] — one or more slots picked up to move onto another
        let sheetConnectMode = null; // { type: 'tie'|'slur', sectionId, lineIdx, clef, anchorIdx } — armed by clicking Tie/Slur, extended by clicking notes on the staff

        function sheetNoteKey(sectionId, lineIdx, wordIdx, clef) {
            return `${sectionId}|${lineIdx}|${wordIdx}|${clef}`;
        }
        function getSheetNote(sectionId, lineIdx, wordIdx, clef) {
            return sheetState.notes[sheetNoteKey(sectionId, lineIdx, wordIdx, clef)] || null;
        }
        // Merges a partial change onto the current note, defaulting any
        // field neither present nor patched — keeps every mutation site
        // from having to spell out every field (tie/dots/slur/tuplet) by
        // hand each time, which is exactly how tie/dots got silently
        // dropped by other handlers before.
        function sheetNoteWith(cur, patch) {
            return Object.assign({ pitch: '', duration: 'quarter', tie: false, dots: false, slur: false, tuplet: 0, run: null }, cur || {}, patch);
        }

        function sheetLinesForSection(section) {
            return (section.content || '').split('\n').map((line) => line.trim().split(/\s+/).filter(Boolean));
        }

        // Which lyric word(s) sit in a given staff slot — a slot's note
        // (pitch/duration) is anchored to the slot itself and doesn't
        // move; moving words only changes this slot->word(s) mapping, so
        // the printed lyric text order above the staff never changes.
        // A slot can hold zero, one, or several words (e.g. a fast
        // phrase sung on one sustained note); stored per line as an
        // array of arrays. Also reads the older one-word-per-slot format
        // (a flat array of numbers) for data saved before multi-word
        // slots existed.
        function sheetWordOrderKey(sectionId, lineIdx) {
            return sectionId + '|' + lineIdx;
        }
        function sheetSlotWordIndices(sectionId, lineIdx, slotIdx, wordCount) {
            const order = sheetState.wordOrder[sheetWordOrderKey(sectionId, lineIdx)];
            if (order && order.length === wordCount) {
                const entry = order[slotIdx];
                if (Array.isArray(entry)) return entry;
                if (entry != null) return [entry]; // legacy flat-number format
            }
            return [slotIdx];
        }

        // ---------- Load / sync / realtime ----------
        async function ensureSheetMusicSettings(projectId) {
            const resp = await sb.rpc('ensure_sheet_music_settings', { p_project_id: projectId });
            if (resp.error) throw resp.error;
        }
        async function fetchSheetMusic(projectId) {
            const resp = await sb.rpc('get_sheet_music', { p_project_id: projectId });
            if (resp.error) throw resp.error;
            return resp.data || { settings: null, notes: [], word_order: [] };
        }
        function applySheetRaw(raw) {
            const s = raw.settings;
            sheetState.tempo = (s && s.tempo) || 120;
            sheetState.timeSignature = (s && s.time_signature) || '4/4';
            sheetState.key = (s && s.key) || 'C';
            sheetState.notes = {};
            (raw.notes || []).forEach((n) => {
                sheetState.notes[sheetNoteKey(n.section_id, n.line_index, n.word_index, n.clef)] = { pitch: n.pitch, duration: n.duration, tie: !!n.tie, dots: !!n.dots, slur: !!n.slur, tuplet: n.tuplet_size || 0, run: n.run ? n.run.split(',').filter(Boolean) : null };
            });
            sheetState.wordOrder = {};
            (raw.word_order || []).forEach((wo) => {
                sheetState.wordOrder[sheetWordOrderKey(wo.section_id, wo.line_index)] = wo.slot_order || [];
            });
        }
        function stopSheetRealtime() {
            if (sheetChannel) { sb.removeChannel(sheetChannel); sheetChannel = null; }
        }
        function startSheetRealtime(projectId) {
            stopSheetRealtime();
            sheetChannel = sb.channel('pj-sheet-' + projectId)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sheet_music_notes', filter: 'project_id=eq.' + projectId }, () => reloadSheetMusic(projectId))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sheet_music_settings', filter: 'project_id=eq.' + projectId }, () => reloadSheetMusic(projectId))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sheet_music_word_order', filter: 'project_id=eq.' + projectId }, () => reloadSheetMusic(projectId))
                .subscribe();
        }
        function reloadSheetMusic(projectId) {
            clearTimeout(sheetReloadTimer);
            sheetReloadTimer = setTimeout(async () => {
                if (activeKey !== 'action:lyrics' || !sheetState) return;
                // Every picker click writes to the DB asynchronously and
                // that write's own realtime echo schedules a reload —
                // so several rapid clicks (e.g. picking the same note
                // for 3 of 4 run slots) can have an EARLIER click's
                // reload land and overwrite local state AFTER a LATER
                // click already applied its own change, silently
                // rolling that one back. Skipping reloads entirely
                // while the picker is open sidesteps that: the user's
                // own edits are already reflected optimistically in
                // local state, and hideSheetPicker() triggers a
                // catch-up reload once they're done, so collaborators'
                // concurrent changes still arrive, just not mid-edit.
                if (sheetPickerKey) return;
                applySheetRaw(await fetchSheetMusic(projectId));
                if (lyricsEditorFocused()) { lyricsRenderPending = true; } else { renderLyrics(); }
            }, 400);
        }

        // ---------- Mutations ----------
        function setSheetHeader(field, value) {
            sheetState[field] = value;
            renderLyrics();
            const column = field === 'timeSignature' ? 'time_signature' : field;
            sb.from('sheet_music_settings').update({ [column]: value, updated_at: new Date().toISOString() }).eq('project_id', id).then(() => {});
        }

        function setSheetNote(sectionId, lineIdx, wordIdx, clef, note) {
            const key = sheetNoteKey(sectionId, lineIdx, wordIdx, clef);
            if (note) sheetState.notes[key] = note; else delete sheetState.notes[key];
            renderLyrics();
            if (note) {
                sb.from('sheet_music_notes').upsert({
                    project_id: id, section_id: sectionId, line_index: lineIdx, word_index: wordIdx, clef: clef,
                    pitch: note.pitch, duration: note.duration, tie: !!note.tie, dots: !!note.dots, slur: !!note.slur, tuplet_size: note.tuplet || 0, run: (note.run && note.run.length) ? note.run.join(',') : null, updated_by: user.id, updated_at: new Date().toISOString()
                }, { onConflict: 'project_id,section_id,line_index,word_index,clef' }).then(({ error }) => { if (error) reloadSheetMusic(id); });
            } else {
                sb.from('sheet_music_notes').delete()
                    .eq('project_id', id).eq('section_id', sectionId).eq('line_index', lineIdx).eq('word_index', wordIdx).eq('clef', clef)
                    .then(({ error }) => { if (error) reloadSheetMusic(id); });
            }
        }

        // Array-of-arrays form of a line's word order, upgrading the
        // older one-word-per-slot flat-number format transparently.
        function sheetNormalizedOrder(sectionId, lineIdx, wordCount) {
            const order = sheetState.wordOrder[sheetWordOrderKey(sectionId, lineIdx)];
            if (order && order.length === wordCount) {
                return order.map((entry) => Array.isArray(entry) ? entry.slice() : (entry != null ? [entry] : []));
            }
            return Array.from({ length: wordCount }, (_, i) => [i]);
        }

        // Move every word currently in sourceSlots onto targetSlot,
        // merging with whatever's already there (reading order
        // preserved) and leaving the source slots empty. Notes stay put
        // — they're keyed by slot, not by word — only which word
        // label(s) appear at each slot change.
        function sheetMoveWordsToSlot(sectionId, lineIdx, wordCount, sourceSlots, targetSlot) {
            const order = sheetNormalizedOrder(sectionId, lineIdx, wordCount);
            let moved = [];
            sourceSlots.forEach((slotIdx) => {
                if (slotIdx === targetSlot) return;
                moved = moved.concat(order[slotIdx]);
                order[slotIdx] = [];
            });
            if (!moved.length) return;
            order[targetSlot] = order[targetSlot].concat(moved).sort((a, b) => a - b);
            sheetState.wordOrder[sheetWordOrderKey(sectionId, lineIdx)] = order;
            renderLyrics();
            sb.from('sheet_music_word_order').upsert({
                project_id: id, section_id: sectionId, line_index: lineIdx, slot_order: order,
                updated_by: user.id, updated_at: new Date().toISOString()
            }, { onConflict: 'project_id,section_id,line_index' }).then(({ error }) => { if (error) reloadSheetMusic(id); });
        }

        const SHEET_DURATION_VEX = { whole: 'w', half: 'h', quarter: 'q', eighth: '8', sixteenth: '16', thirtysecond: '32' };

        function sheetPitchToVexKey(pitchStr) {
            const m = (pitchStr || '').match(/^([A-G])(#|b)?(\d)$/);
            if (!m) return 'c/4';
            return m[1].toLowerCase() + (m[2] || '') + '/' + m[3];
        }

        // Builds the VexFlow tickable(s) for a given word slot: normally
        // exactly one (a real note, a visible rest, or an invisible
        // GhostNote if nothing's placed there yet — keeps every word's
        // column width consistent whether or not it carries a note), but
        // several if the word holds a "run" (2/3/4 fast notes packed
        // into this one beat). A run of 3 genuinely is a triplet against
        // the beat, so its sub-notes get wrapped in a VF.Tuplet right
        // here (pushed into the shared tuplets accumulator) — same
        // notes_occupied:2 mechanism as the regular Tuplet feature.
        // Always returns an array so every caller treats "one note" and
        // "a run of several" the same way.
        function sheetBuildVexNotes(VF, sectionId, lineIdx, wordIdx, clef, tuplets) {
            const note = getSheetNote(sectionId, lineIdx, wordIdx, clef);
            if (!note) return [new VF.GhostNote({ duration: 'q' })];
            const dur = SHEET_DURATION_VEX[note.duration] || 'q';
            if (note.pitch === 'rest') {
                // The dot button doesn't gate on pitch !== 'rest' (a
                // dotted rest is valid notation), so this needs the same
                // dots:1 + buildAndAttach treatment as a real note below —
                // it was previously dropped here, silently losing both
                // the dot glyph and its extra duration on a rest.
                const restNote = new VF.StaveNote({ keys: [clef === 'bass' ? 'd/3' : 'b/4'], duration: dur + 'r', clef, dots: note.dots ? 1 : 0 });
                if (note.dots) VF.Dot.buildAndAttach([restNote], { all: true });
                return [restNote];
            }
            if (note.run && note.run.length >= 2 && note.run.every(Boolean)) {
                const subDur = sheetRunSubDuration(note.duration, note.run.length);
                const subVexDur = subDur && SHEET_DURATION_VEX[subDur];
                if (subVexDur) {
                    const subNotes = note.run.map((p) => new VF.StaveNote({ keys: [sheetPitchToVexKey(p)], duration: subVexDur, clef }));
                    const notesOccupied = sheetRunNotesOccupied(note.run.length);
                    if (note.run.length !== notesOccupied && tuplets) {
                        tuplets.push(new VF.Tuplet(subNotes, { notes_occupied: notesOccupied, ratioed: false }));
                    }
                    return subNotes;
                }
                // subDuration not computable (e.g. a run of 4 on an
                // already-tiny sixteenth note would need 64th notes,
                // which this app doesn't support) — fall through and
                // render the word as its plain single note instead of
                // silently dropping it.
            }
            // A word can carry a chord — pitch is a comma-joined list of
            // one or more pitches sharing the same duration.
            const keys = note.pitch.split(',').filter(Boolean).map(sheetPitchToVexKey);
            const staveNote = new VF.StaveNote({ keys: keys.length ? keys : ['c/4'], duration: dur, clef, dots: note.dots ? 1 : 0 });
            // dots:1 above only affects duration/ticks — the dot glyph
            // itself still needs to be explicitly attached to render.
            if (note.dots) VF.Dot.buildAndAttach([staveNote], { all: true });
            return [staveNote];
        }

        // VF.Beam.generateBeams(notes) returns ZERO beam groups for the
        // whole array — not just skipping the gap, silently giving up
        // entirely — whenever a beamable run doesn't start on a "clean"
        // beat boundary by its own reckoning (e.g. eighth, empty slot,
        // eighth, eighth: the trailing pair should beam but nothing
        // does). Splitting into contiguous beamable runs first and
        // calling it separately per run sidesteps that: each run always
        // starts its own reckoning at zero. Verified against VexFlow
        // directly before relying on it here.
        function sheetGenerateBeams(VF, notes) {
            const isBeamable = (n) => n instanceof VF.StaveNote && !n.isRest() && ['8', '16', '32'].includes(n.getDuration());
            let beams = [], run = [];
            notes.forEach((n) => {
                if (isBeamable(n)) { run.push(n); return; }
                if (run.length > 1) beams = beams.concat(VF.Beam.generateBeams(run));
                run = [];
            });
            if (run.length > 1) beams = beams.concat(VF.Beam.generateBeams(run));
            return beams;
        }

        // ---------- Rendering: real engraved grand staff via VexFlow ----------
        // Every line renders at this same total width regardless of word
        // count, split into measures (barred every N words, N = the time
        // signature's beat count) so all lines look uniform and match the
        // 4/4 (or whatever meter) bar divisions.
        const SHEET_LINE_WIDTH = 1100;
        const SHEET_FIRST_MEASURE_EXTRA = 100;

        function drawVexStaffLine(container, words, sectionId, lineIdx, showTempo) {
            const VF = window.Vex && window.Vex.Flow;
            if (!VF) { container.textContent = 'Notation engine failed to load.'; return; }
            container.innerHTML = '';

            const beatsPerMeasure = parseInt((sheetState.timeSignature || '4/4').split('/')[0], 10) || 4;
            const measures = [];
            for (let i = 0; i < words.length; i += beatsPerMeasure) {
                measures.push({ startIdx: i, count: Math.min(beatsPerMeasure, words.length - i) });
            }
            if (!measures.length) measures.push({ startIdx: 0, count: 0 });

            const usableWidth = SHEET_LINE_WIDTH - 20 - SHEET_FIRST_MEASURE_EXTRA;
            const baseMeasureWidth = Math.max(70, usableWidth / measures.length);

            const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
            renderer.resize(SHEET_LINE_WIDTH, 200);
            const ctx = renderer.getContext();
            ctx.setFillStyle('#BFD7FF');
            ctx.setStrokeStyle('#BFD7FF');

            const clickTargets = []; // { x, wordIdx } — shared x between clefs since voices are joined
            const allTrebleNotes = [], allBassNotes = []; // flat, indexed by slot, for cross-measure ties
            const tuplets = [];
            let x = 10;
            // The clef+key+time-signature glyphs only get drawn on the
            // first measure — clicking that region opens the time
            // signature dropdown directly from the notation instead of
            // making it discoverable only via the toolbar select above.
            let firstPreambleBounds = null;

            measures.forEach((m, mi) => {
                const isFirst = mi === 0;
                const w = baseMeasureWidth + (isFirst ? SHEET_FIRST_MEASURE_EXTRA : 0);
                const trebleStave = new VF.Stave(x, 10, w);
                const bassStave = new VF.Stave(x, 100, w);
                if (isFirst) {
                    trebleStave.addClef('treble').addKeySignature(sheetState.key).addTimeSignature(sheetState.timeSignature);
                    bassStave.addClef('bass').addKeySignature(sheetState.key).addTimeSignature(sheetState.timeSignature);
                    if (showTempo) trebleStave.setTempo({ duration: 'q', bpm: sheetState.tempo }, 0);
                }
                trebleStave.setContext(ctx).draw();
                bassStave.setContext(ctx).draw();
                if (isFirst) firstPreambleBounds = { left: x, right: trebleStave.getNoteStartX(), top: 5, bottom: 185 };

                if (isFirst) {
                    new VF.StaveConnector(trebleStave, bassStave).setType(VF.StaveConnector.type.BRACE).setContext(ctx).draw();
                    new VF.StaveConnector(trebleStave, bassStave).setType(VF.StaveConnector.type.SINGLE_LEFT).setContext(ctx).draw();
                }
                new VF.StaveConnector(trebleStave, bassStave).setType(VF.StaveConnector.type.SINGLE_RIGHT).setContext(ctx).draw();

                if (m.count > 0) {
                    // One "column" per word — normally exactly one
                    // tickable, but several if that word holds a run
                    // (see sheetBuildVexNotes). Keeping this column
                    // structure (rather than a flat 1-per-word array)
                    // lets everything below stay indexed by WORD even
                    // though the underlying tickable count per word can
                    // now vary.
                    const trebleCols = [], bassCols = [];
                    for (let k = 0; k < m.count; k++) {
                        const wordIdx = m.startIdx + k;
                        trebleCols.push({ wordIdx, tickables: sheetBuildVexNotes(VF, sectionId, lineIdx, wordIdx, 'treble', tuplets) });
                        bassCols.push({ wordIdx, tickables: sheetBuildVexNotes(VF, sectionId, lineIdx, wordIdx, 'bass', tuplets) });
                    }
                    const trebleNotes = trebleCols.flatMap((c) => c.tickables);
                    const bassNotes = bassCols.flatMap((c) => c.tickables);

                    // Tuplets: a note marked "starts an N-tuplet" groups
                    // with the next N-1 WORDS in this SAME measure (a
                    // group that doesn't fully fit before the measure
                    // ends is silently skipped, as is any group spanning
                    // a word that itself holds a run — a run already has
                    // its own timing carved out of its single word and
                    // can't also be folded into a word-level tuplet).
                    // Must happen before Formatter.format() — VF.Tuplet
                    // rescales the group's combined duration to fit
                    // notes_occupied, and the formatter needs that
                    // rescaled tick value to lay out x-positions.
                    // notes_occupied must be passed explicitly —
                    // VexFlow defaults it to 2 regardless of group size,
                    // which is only correct for a triplet.
                    function applyTuplets(cols, clef) {
                        for (let k = 0; k < cols.length; k++) {
                            const note = getSheetNote(sectionId, lineIdx, cols[k].wordIdx, clef);
                            const n = note && note.tuplet;
                            if (!n || note.pitch === 'rest') continue;
                            if (k + n > cols.length) continue;
                            const group = cols.slice(k, k + n);
                            if (group.some((c) => c.tickables.length !== 1)) continue;
                            const notesGroup = group.map((c) => c.tickables[0]);
                            if (notesGroup.every((nt) => nt instanceof VF.StaveNote)) {
                                tuplets.push(new VF.Tuplet(notesGroup, { notes_occupied: SHEET_TUPLET_RATIOS[n] || 2, ratioed: false }));
                            }
                        }
                    }
                    applyTuplets(trebleCols, 'treble');
                    applyTuplets(bassCols, 'bass');

                    const trebleVoice = new VF.Voice({ num_beats: m.count, beat_value: 4 }).setStrict(false);
                    trebleVoice.addTickables(trebleNotes);
                    const bassVoice = new VF.Voice({ num_beats: m.count, beat_value: 4 }).setStrict(false);
                    bassVoice.addTickables(bassNotes);

                    const noteAreaWidth = Math.max(40, w - (isFirst ? SHEET_FIRST_MEASURE_EXTRA + 20 : 20));
                    new VF.Formatter().joinVoices([trebleVoice]).joinVoices([bassVoice]).format([trebleVoice, bassVoice], noteAreaWidth);

                    // Force equal-width slots instead of VexFlow's natural
                    // proportional (duration-based) spacing — one note per
                    // lyric word reads better as a uniform grid here than
                    // packed tight next to short notes and stretched next
                    // to long ones. getAbsoluteX() by VexFlow's own design
                    // always EXCLUDES x_shift, and only folds in the
                    // stave's own noteStartX offset once a stave is
                    // actually attached — so attach the stave first (via
                    // setStave, same call Voice.draw() makes internally;
                    // harmless to call early), measure the true untouched
                    // baseline, then compute the shift needed to land each
                    // note in the center of its own equal slot. Verified
                    // against VexFlow's source directly — a bare
                    // getAbsoluteX() baseline read before attaching a
                    // stave silently omits ~40-50px and produces wrong
                    // shifts. A column with a run divides its OWN slot
                    // width evenly across its sub-notes, so a 4-note run
                    // fits in exactly the same horizontal space a single
                    // note would have used.
                    const measureNoteStartX = trebleStave.getNoteStartX();
                    const slotWidth = noteAreaWidth / m.count;
                    trebleNotes.forEach((n) => n.setStave(trebleStave));
                    bassNotes.forEach((n) => n.setStave(bassStave));
                    function shiftCols(cols) {
                        cols.forEach((col, k) => {
                            const subN = col.tickables.length;
                            const subWidth = slotWidth / subN;
                            col.tickables.forEach((tk, si) => {
                                const targetX = measureNoteStartX + slotWidth * k + subWidth * si + subWidth / 2;
                                tk.setXShift(targetX - tk.getAbsoluteX());
                            });
                        });
                    }
                    shiftCols(trebleCols);
                    shiftCols(bassCols);

                    // Beams must be generated before the voice is drawn —
                    // a note only skips drawing its OWN individual flag
                    // when it already has a beam attached at the moment
                    // .draw() runs (VexFlow's hasFlag() checks
                    // this.beam === undefined). Generating beams after
                    // voice.draw(), as this used to, meant every note had
                    // already drawn its own flag with its own
                    // independently-computed stem length by the time the
                    // beam existed — the beam bar then drew on top at its
                    // own (correctly recalculated, often different) stem
                    // position, leaving a stray flag plus a
                    // mismatched-looking beam. Small pitch intervals hid
                    // this (the two overlapped closely enough to look
                    // fine); a wide interval between notes exposes it
                    // clearly as two disconnected marks.
                    const trebleBeams = sheetGenerateBeams(VF, trebleNotes);
                    const bassBeams = sheetGenerateBeams(VF, bassNotes);

                    trebleVoice.draw(ctx, trebleStave);
                    bassVoice.draw(ctx, bassStave);
                    trebleBeams.forEach((b) => b.setContext(ctx).draw());
                    bassBeams.forEach((b) => b.setContext(ctx).draw());

                    // Bounds clamp the hover box to this WORD's own slot
                    // (now that slots are equal-width, that's just the
                    // slot's own boundaries) regardless of how many
                    // sub-notes it holds internally — clicking anywhere
                    // in the slot opens the picker for the whole word,
                    // runs included.
                    const measureNoteEndX = x + w - 4;
                    // Count numbers (1, 2, 3... up to the time
                    // signature's beat count, repeating every measure)
                    // printed above each slot — this is what actually
                    // answers "which word is beat 1" instead of making
                    // the user infer it from the time signature alone.
                    ctx.save();
                    ctx.setFont('Arial', 9, '');
                    trebleCols.forEach((col, k) => {
                        const cx = measureNoteStartX + slotWidth * k + slotWidth / 2;
                        ctx.fillText(String(k + 1), cx - 3, 9);
                    });
                    ctx.restore();
                    trebleCols.forEach((col, k) => {
                        const nx = measureNoteStartX + slotWidth * k + slotWidth / 2;
                        const leftBound = Math.max(measureNoteStartX, measureNoteStartX + slotWidth * k);
                        const rightBound = Math.min(measureNoteEndX, measureNoteStartX + slotWidth * (k + 1));
                        clickTargets.push({ x: nx, wordIdx: col.wordIdx, leftBound, rightBound });
                        // Ties/slurs connect single notes only — a run
                        // already spends this word's whole beat on its
                        // own sub-notes, so it can't also carry a tie or
                        // slur into/out of the neighboring word. Storing
                        // null here means drawTies/drawSlurs' existing
                        // "!a || !b" guards silently skip it, same as any
                        // other empty slot.
                        allTrebleNotes[col.wordIdx] = col.tickables.length === 1 ? col.tickables[0] : null;
                    });
                    bassCols.forEach((col) => { allBassNotes[col.wordIdx] = col.tickables.length === 1 ? col.tickables[0] : null; });
                }

                x += w;
            });

            // Ties: a note marked "tied to next" gets a curve into the
            // next slot's note, same clef, as long as both are real
            // (non-rest) pitched notes — works across measures too since
            // both notes already exist in the same rendering context.
            function drawTies(allNotes, clef) {
                for (let i = 0; i < allNotes.length - 1; i++) {
                    const note = getSheetNote(sectionId, lineIdx, i, clef);
                    const a = allNotes[i], b = allNotes[i + 1];
                    if (!note || !note.tie || note.pitch === 'rest' || !a || !b) continue;
                    if (!(a instanceof VF.StaveNote) || !(b instanceof VF.StaveNote)) continue;
                    new VF.StaveTie({ first_note: a, last_note: b }).setContext(ctx).draw();
                }
            }
            drawTies(allTrebleNotes, 'treble');
            drawTies(allBassNotes, 'bass');

            // Slurs: a curved phrasing line into the next slot's note,
            // same clef — unlike a tie, the two notes don't need to share
            // a pitch (a slur just means "play these connected/legato").
            function drawSlurs(allNotes, clef) {
                for (let i = 0; i < allNotes.length - 1; i++) {
                    const note = getSheetNote(sectionId, lineIdx, i, clef);
                    const a = allNotes[i], b = allNotes[i + 1];
                    if (!note || !note.slur || note.pitch === 'rest' || !a || !b) continue;
                    if (!(a instanceof VF.StaveNote) || !(b instanceof VF.StaveNote)) continue;
                    new VF.Curve(a, b, {}).setContext(ctx).draw();
                }
            }
            drawSlurs(allTrebleNotes, 'treble');
            drawSlurs(allBassNotes, 'bass');
            tuplets.forEach((t) => t.setContext(ctx).draw());

            // Position each lyric word directly under the note it's
            // sung on (like a real vocal/piano score), instead of an
            // evenly spaced row — the word row is a sibling of this
            // staff container, rendered by renderSheetWords.
            const wordsRow = container.parentElement && container.parentElement.querySelector('.pj-sheet-words');
            if (wordsRow) {
                const wordEls = wordsRow.querySelectorAll('[data-sheet-word]');
                const bySlot = {};
                wordEls.forEach((el) => {
                    const parts = el.dataset.sheetWord.split(':');
                    bySlot[parts[2]] = el;
                });
                clickTargets.forEach((t) => {
                    const el = bySlot[String(t.wordIdx)];
                    if (el) el.style.left = t.x + 'px';
                });
            }

            // Transparent highlight showing exactly which slot + clef a
            // click will land on, updated live as the mouse moves.
            const svgNS = 'http://www.w3.org/2000/svg';
            const hoverRect = document.createElementNS(svgNS, 'rect');
            hoverRect.setAttribute('fill', 'rgba(106,169,240,0.22)');
            hoverRect.setAttribute('stroke', 'rgba(106,169,240,0.55)');
            hoverRect.setAttribute('stroke-width', '1');
            hoverRect.setAttribute('rx', '3');
            hoverRect.setAttribute('height', '80');
            hoverRect.style.pointerEvents = 'none';
            hoverRect.style.display = 'none';
            const svgRoot = container.querySelector('svg');
            if (svgRoot) svgRoot.appendChild(hoverRect);

            // Persistent highlight on whichever note the picker is
            // currently open for — the picker itself is docked at a
            // fixed screen position now (not anchored to this element),
            // so this is what shows which note it's actually editing.
            // Unlike hoverRect, this doesn't hide on mouseleave; it only
            // changes when the selection itself changes (showSheetPicker/
            // hideSheetPicker both call renderLyrics(), which redraws it).
            if (sheetPickerKey && sheetPickerKey.sectionId === sectionId && sheetPickerKey.lineIdx === lineIdx) {
                const sel = clickTargets.find((t) => t.wordIdx === sheetPickerKey.wordIdx);
                if (sel && svgRoot) {
                    const selectedRect = document.createElementNS(svgNS, 'rect');
                    selectedRect.setAttribute('fill', 'rgba(106,169,240,0.12)');
                    selectedRect.setAttribute('stroke', '#6AA9F0');
                    selectedRect.setAttribute('stroke-width', '2');
                    selectedRect.setAttribute('rx', '3');
                    selectedRect.setAttribute('height', '80');
                    selectedRect.style.pointerEvents = 'none';
                    const idealHalf = 32;
                    const left = Math.max(sel.leftBound, sel.x - idealHalf);
                    const right = Math.min(sel.rightBound, sel.x + idealHalf);
                    selectedRect.setAttribute('x', left);
                    selectedRect.setAttribute('y', sheetPickerClef === 'treble' ? 10 : 100);
                    selectedRect.setAttribute('width', Math.max(4, right - left));
                    svgRoot.appendChild(selectedRect);
                }
            }

            function nearestSheetTarget(e) {
                if (!clickTargets.length) return null;
                const svgEl = container.querySelector('svg');
                if (!svgEl) return null;
                const rect = svgEl.getBoundingClientRect();
                const scale = rect.width / SHEET_LINE_WIDTH;
                const px = (e.clientX - rect.left) / scale;
                const py = (e.clientY - rect.top) / scale;
                const clef = py < 95 ? 'treble' : 'bass';
                let best = null, bestDist = Infinity;
                clickTargets.forEach((t) => {
                    const d = Math.abs(t.x - px);
                    if (d < bestDist) { bestDist = d; best = t; }
                });
                return best ? { wordIdx: best.wordIdx, x: best.x, leftBound: best.leftBound, rightBound: best.rightBound, clef } : null;
            }

            // Click anywhere on the staff (not just the word button row
            // below) to open the note picker for the nearest word — clef
            // is whichever staff (treble/bass) the click landed in.
            container.onclick = (e) => {
                // Clicking the clef/key/time-signature glyphs (only
                // drawn on the first measure) opens the existing time
                // signature dropdown directly, instead of that control
                // only being reachable from the toolbar above — the
                // glyph itself is the more natural place to expect it.
                if (firstPreambleBounds) {
                    const svgEl = container.querySelector('svg');
                    if (svgEl) {
                        const rect = svgEl.getBoundingClientRect();
                        const scale = rect.width / SHEET_LINE_WIDTH;
                        const px = (e.clientX - rect.left) / scale;
                        const py = (e.clientY - rect.top) / scale;
                        if (px >= firstPreambleBounds.left && px <= firstPreambleBounds.right && py >= firstPreambleBounds.top && py <= firstPreambleBounds.bottom) {
                            const sel = expandEl.querySelector('[data-sheet-time]');
                            if (sel) {
                                sel.focus();
                                if (typeof sel.showPicker === 'function') {
                                    try { sel.showPicker(); } catch (err) {}
                                }
                            }
                            return;
                        }
                    }
                }
                const target = nearestSheetTarget(e);
                if (!target) return;
                if (sheetConnectMode) {
                    if (sheetTryExtendConnect(sectionId, lineIdx, target.wordIdx, target.clef)) return;
                    sheetStopConnectMode(); // clicked a note that doesn't extend the chain — cancel and open the picker normally below
                }
                sheetPickerClef = target.clef;
                showSheetPicker(sectionId, lineIdx, target.wordIdx);
            };
            container.onmousemove = (e) => {
                const target = nearestSheetTarget(e);
                if (!target) { hoverRect.style.display = 'none'; return; }
                const idealHalf = 32;
                const left = Math.max(target.leftBound, target.x - idealHalf);
                const right = Math.min(target.rightBound, target.x + idealHalf);
                hoverRect.setAttribute('x', left);
                hoverRect.setAttribute('y', target.clef === 'treble' ? 10 : 100);
                hoverRect.setAttribute('width', Math.max(4, right - left));
                hoverRect.style.display = 'block';
            };
            container.onmouseleave = () => { hoverRect.style.display = 'none'; };
        }

        function drawAllSheetStaves() {
            if (!sheetVisible || !sheetState) return;
            let first = true;
            expandEl.querySelectorAll('[data-vf-line]').forEach((el) => {
                const sectionId = el.dataset.vfSection;
                const lineIdx = Number(el.dataset.vfLine);
                let words = [];
                try { words = JSON.parse(el.dataset.vfWords); } catch (e) {}
                if (words.length) {
                    drawVexStaffLine(el, words, sectionId, lineIdx, first);
                    first = false;
                }
            });
        }

        function sheetPitchDisplay(note) {
            if (note.pitch === 'rest') return 'rest';
            // A run's pitches live in note.run, not note.pitch (which
            // stays empty/unused once a run is active) -- show them
            // joined by a middle dot so a run badge reads visibly
            // differently from a chord's "+".
            if (note.run && note.run.length >= 2) return escapeHtml(note.run.filter(Boolean).join('·'));
            return escapeHtml(note.pitch.split(',').join('+'));
        }

        // Slots are addressed by position (notes live on the slot), but
        // the word TEXT shown in each slot comes from sheetSlotWordIndices
        // — so moving words (see wireSheetMusicEvents) only ever
        // reassigns which word(s)' label/notes-badge appears where, never
        // the printed lyric order above the staff. A slot can hold
        // several words (e.g. a quick phrase sung on one note).
        function renderSheetWords(line, sectionId, lineIdx) {
            const n = line.length;
            return '<div class="pj-sheet-words">' + Array.from({ length: n }, (_, slotIdx) => {
                const wordIdxs = sheetSlotWordIndices(sectionId, lineIdx, slotIdx, n);
                const w = wordIdxs.map((wi) => line[wi]).filter((s) => s != null).join(' ');
                const treble = getSheetNote(sectionId, lineIdx, slotIdx, 'treble');
                const bass = getSheetNote(sectionId, lineIdx, slotIdx, 'bass');
                let cls = 'pj-sheet-word';
                let labels = '';
                if (treble) {
                    cls += ' has-note';
                    labels += `<span class="pj-sheet-word__pitch pj-sheet-word__pitch--treble">${sheetPitchDisplay(treble)}</span>`;
                }
                if (bass) {
                    cls += ' has-note';
                    labels += `<span class="pj-sheet-word__pitch pj-sheet-word__pitch--bass">${sheetPitchDisplay(bass)}</span>`;
                }
                const addr = `${escapeAttr(sectionId)}:${lineIdx}:${slotIdx}`;
                return `<span class="${cls}" data-sheet-word="${addr}">
                    <span class="pj-sheet-word__drag" data-sheet-word-drag="${addr}" data-sheet-word-count="${n}" title="Click to select, then click another word (or click again to add more) — click the target note to place the selected words there">⠿</span>
                    <span class="pj-sheet-word__click" data-sheet-word-click="${addr}"><span class="pj-sheet-word__text">${escapeHtml(w) || '·'}</span>${labels}</span>
                </span>`;
            }).join('') + '</div>';
        }

        function renderSheetForSection(section) {
            const lines = sheetLinesForSection(section);
            if (!lines.some((l) => l.length)) return '';
            let body = '';
            lines.forEach((line, lineIdx) => {
                if (!line.length) return;
                body += `<div class="pj-sheet-line">
                    ${sheetPickerInlineHtml(section.id, lineIdx, line)}
                    <div class="pj-sheet-staff-wrap">
                        <div class="pj-sheet-vf-line" data-vf-section="${escapeAttr(section.id)}" data-vf-line="${lineIdx}" data-vf-words="${escapeAttr(JSON.stringify(line))}"></div>
                        ${renderSheetWords(line, section.id, lineIdx)}
                    </div>
                </div>`;
            });
            return `<div class="pj-sheet-block">${body}</div>`;
        }

        // ---------- Note picker card ----------
        // Lives inline in the page, right above whichever line's staff
        // holds the selected word — not a floating/fixed popup. It used
        // to be position:fixed, first anchored to the clicked word (kept
        // drifting since every edit rebuilds the whole lyrics body) and
        // later docked at a constant screen position (worked, but the
        // user wanted it to feel like part of the sheet music card
        // itself, not a separate overlay). Being generated as part of
        // the normal render — like everything else here — sidesteps the
        // positioning problem entirely: it's just another element in the
        // document, so it naturally sits exactly where it's written.
        function sheetPickerSkeletonHtml(wordText) {
            return `<div class="pj-sheet-picker" data-sheet-picker>
                <div class="pj-sheet-picker__head">
                    <span data-sheet-picker-word>${escapeHtml(wordText || '')}</span>
                    <button type="button" class="pj-sheet-picker__close" data-sheet-picker-close aria-label="Close">&times;</button>
                </div>
                <div class="pj-lyrics-hint-label" style="margin:0 0 4px;">Staff</div>
                <div class="pj-sheet-picker__clefs" data-sheet-clef-row></div>
                <div class="pj-lyrics-hint-label" style="margin:0 0 4px;">Octave</div>
                <div class="pj-sheet-picker__octaves" data-sheet-octave-row></div>
                <div class="pj-lyrics-hint-label" data-sheet-run-index-label style="margin:0 0 4px;display:none;">Notes in this run (click one to remove it)</div>
                <div class="pj-sheet-picker__runindex" data-sheet-run-index-row></div>
                <div class="pj-lyrics-hint-label" style="margin:0 0 4px;">Pitch</div>
                <div class="pj-sheet-picker__pitches" data-sheet-pitch-grid></div>
                <div class="pj-lyrics-hint-label" style="margin:6px 0 4px;">Duration</div>
                <div class="pj-sheet-picker__durations" data-sheet-duration-row></div>
                <div class="pj-lyrics-hint-label" style="margin:6px 0 4px;" title="Spreads one note's time across several existing words — e.g. a triplet plays 3 notes in the space 2 would normally take.">Tuplet — stretch notes across several words</div>
                <div class="pj-sheet-picker__tuplets" data-sheet-tuplet-row></div>
                <div class="pj-lyrics-hint-label" style="margin:6px 0 4px;" title="Packs several fast notes into THIS one word's beat, without needing extra words — e.g. a 4-run plays 4 notes in the time this one word would normally take.">Run — pack fast notes into this one word</div>
                <div class="pj-sheet-picker__runs" data-sheet-run-row></div>
                <div class="pj-lyrics-hint-label" style="margin:6px 0 4px;">Note shape</div>
                <div class="pj-sheet-picker__actions">
                    <button type="button" class="pj-btn pj-btn--ghost" data-sheet-dot title="Dotted note (adds half the duration again)">• Dot</button>
                    <button type="button" class="pj-btn pj-btn--ghost" data-sheet-tie title="Hold this note into the next one, same pitch">🔗 Tie</button>
                    <button type="button" class="pj-btn pj-btn--ghost" data-sheet-slur title="Curved phrasing line into the next note, any pitch">⌒ Slur</button>
                    <button type="button" class="pj-btn pj-btn--ghost" data-sheet-rest>Rest</button>
                    <button type="button" class="pj-btn pj-btn--ghost" data-sheet-clear>Clear</button>
                </div>
            </div>`;
        }
        // Only the line the current selection is actually on renders
        // the card — every other line's call returns ''.
        function sheetPickerInlineHtml(sectionId, lineIdx, words) {
            if (!sheetPickerKey || sheetPickerKey.sectionId !== sectionId || sheetPickerKey.lineIdx !== lineIdx) return '';
            const assignedWordIdxs = sheetSlotWordIndices(sectionId, lineIdx, sheetPickerKey.wordIdx, words.length);
            const wordText = assignedWordIdxs.map((wi) => words[wi]).filter(Boolean).join(' ');
            return sheetPickerSkeletonHtml(wordText);
        }
        function renderSheetPicker() {
            const note = sheetPickerKey ? getSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef) : null;
            const clefRow = expandEl.querySelector('[data-sheet-clef-row]');
            if (clefRow) {
                clefRow.innerHTML = ['treble', 'bass'].map((c) =>
                    `<button type="button" class="pj-lyrics-section__action${c === sheetPickerClef ? ' is-active' : ''}" data-sheet-clef="${c}">${c === 'bass' ? '𝄢 Bass' : '𝄞 Treble'}</button>`
                ).join('');
            }
            const octaveRow = expandEl.querySelector('[data-sheet-octave-row]');
            if (octaveRow) {
                octaveRow.innerHTML = SHEET_OCTAVES.map((o) =>
                    `<button type="button" class="pj-lyrics-section__action${o === sheetPickerOctave ? ' is-active' : ''}" data-sheet-octave="${o}">${o}</button>`
                ).join('');
            }
            // A run replaces this word's single pitch with several
            // sequential sub-notes sharing its beat. Run mode is "on"
            // whenever note.run is an array at all (even empty/length 1,
            // mid-build) -- while it's on, the shared pitch grid below
            // APPENDS a new sub-note on every click instead of toggling
            // a chord, so the run's length is just "however many
            // letters you clicked," never declared upfront.
            const runMode = !!(note && Array.isArray(note.run));
            const activeRun = runMode ? note.run : null;
            const runIndexLabel = expandEl.querySelector('[data-sheet-run-index-label]');
            if (runIndexLabel) runIndexLabel.style.display = runMode ? '' : 'none';
            const runIndexRow = expandEl.querySelector('[data-sheet-run-index-row]');
            if (runIndexRow) {
                // Each entry is click-to-remove (not click-to-select —
                // there's nothing to "select" anymore since new pitches
                // always append at the end) so a mis-click can be undone
                // without clearing the whole run and starting over.
                runIndexRow.innerHTML = runMode ? activeRun.map((p, i) =>
                    `<button type="button" class="pj-lyrics-section__action" data-sheet-run-index="${i}" title="Remove this note from the run">${i + 1} ${escapeHtml(p || '?')} ✕</button>`
                ).join('') : '';
            }
            const pitchGrid = expandEl.querySelector('[data-sheet-pitch-grid]');
            if (pitchGrid) {
                // In run mode, highlight every pitch the run already has
                // (is-active) with the most-recently-added one getting
                // an extra ring (is-current) so there's visible
                // confirmation each click registered, including repeats.
                const activePitches = runMode
                    ? activeRun.filter(Boolean)
                    : ((note && note.pitch !== 'rest') ? note.pitch.split(',').filter(Boolean) : []);
                const currentPitch = runMode && activeRun.length ? activeRun[activeRun.length - 1] : null;
                const chipClass = (p) => {
                    let cls = 'pj-lyrics-suggest-chip';
                    if (activePitches.includes(p)) cls += ' is-active';
                    if (p === currentPitch) cls += ' is-current';
                    return cls;
                };
                const whiteRow = SHEET_WHITE_LETTERS.map((L) => {
                    const p = L + sheetPickerOctave;
                    return `<button type="button" class="${chipClass(p)}" data-sheet-pitch="${p}">${L}</button>`;
                }).join('');
                const blackRow = SHEET_BLACK_LETTERS.map((L) => {
                    if (!L) return '<span style="display:inline-block;width:34px;"></span>';
                    const p = L + sheetPickerOctave;
                    return `<button type="button" class="${chipClass(p)}" data-sheet-pitch="${p}">${L}</button>`;
                }).join('');
                const hint = runMode
                    ? `Click letters to add notes to the run (${activeRun.length} so far) — the same note can be picked more than once.`
                    : 'Click more than one note to build a chord.';
                pitchGrid.innerHTML = `<div>${blackRow}</div><div>${whiteRow}</div><p class="pj-lyrics-hint" style="margin:4px 0 0;font-size:10px;">${hint}</p>`;
            }
            const durationRow = expandEl.querySelector('[data-sheet-duration-row]');
            if (durationRow) {
                const activeDur = note ? note.duration : 'quarter';
                durationRow.innerHTML = SHEET_DURATIONS.map((d) =>
                    `<button type="button" class="pj-lyrics-section__action${d.id === activeDur ? ' is-active' : ''}" data-sheet-duration="${d.id}">${d.glyph} ${d.label}</button>`
                ).join('');
            }
            const tieBtn = expandEl.querySelector('[data-sheet-tie]');
            if (tieBtn) {
                const canTie = !!(note && note.pitch !== 'rest' && !runMode);
                tieBtn.classList.toggle('is-active', canTie && !!note.tie);
                tieBtn.disabled = !canTie;
            }
            const slurBtn = expandEl.querySelector('[data-sheet-slur]');
            if (slurBtn) {
                const canSlur = !!(note && note.pitch !== 'rest' && !runMode);
                slurBtn.classList.toggle('is-active', canSlur && !!note.slur);
                slurBtn.disabled = !canSlur;
            }
            const tupletRow = expandEl.querySelector('[data-sheet-tuplet-row]');
            if (tupletRow) {
                const canTuplet = !!(note && note.pitch !== 'rest' && !runMode);
                const activeTuplet = note ? (note.tuplet || 0) : 0;
                tupletRow.innerHTML = SHEET_TUPLET_SIZES.map((t) =>
                    `<button type="button" class="pj-lyrics-section__action${t.n === activeTuplet ? ' is-active' : ''}" data-sheet-tuplet="${t.n}" title="${escapeAttr(t.title)}"${canTuplet ? '' : ' disabled'}>${t.n}-tuplet</button>`
                ).join('');
            }
            const runRow = expandEl.querySelector('[data-sheet-run-row]');
            if (runRow) {
                const canRun = !(note && (note.pitch === 'rest' || note.tuplet));
                const label = runMode ? `Run active (${activeRun.length} note${activeRun.length === 1 ? '' : 's'}) — click to clear` : 'Start a run';
                runRow.innerHTML = `<button type="button" class="pj-lyrics-section__action${runMode ? ' is-active' : ''}" data-sheet-run title="Click letters in the Pitch grid to add fast notes to this word's beat — the run's length is just however many you click, no need to decide upfront"${canRun ? '' : ' disabled'}>${label}</button>`;
            }
            const dotBtn = expandEl.querySelector('[data-sheet-dot]');
            if (dotBtn) {
                const canDot = !!(note && !runMode);
                dotBtn.classList.toggle('is-active', canDot && !!note.dots);
                dotBtn.disabled = !canDot;
            }
        }

        function showSheetPicker(sectionId, lineIdx, wordIdx) {
            sheetPickerKey = { sectionId, lineIdx, wordIdx };
            const existing = getSheetNote(sectionId, lineIdx, wordIdx, sheetPickerClef);
            if (existing && existing.pitch && existing.pitch !== 'rest') {
                const m = existing.pitch.match(/(\d)$/);
                if (m) sheetPickerOctave = parseInt(m[1], 10);
            } else {
                sheetPickerOctave = sheetPickerClef === 'bass' ? 3 : 4;
            }
            // renderLyrics() rebuilds the section HTML, which is what
            // actually inserts the picker card (sheetPickerInlineHtml)
            // right above the selected line's staff, plus the
            // persistent selection highlight — sheetPickerKey has to be
            // set before this runs. renderSheetPicker() then populates
            // the card's rows now that it exists in the DOM.
            renderLyrics();
            renderSheetPicker();
            const pop = expandEl.querySelector('[data-sheet-picker]');
            if (pop) pop.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        function hideSheetPicker() {
            sheetPickerKey = null;
            // reloadSheetMusic() skips applying data while a picker is
            // open (see its comment) — catch up on anything that came
            // in from a collaborator during that window now that it's
            // closed.
            if (sheetState) reloadSheetMusic(id);
            renderLyrics(); // removes the card (no line matches sheetPickerKey now) and clears the selection highlight
        }

        // Tie/slur "connect mode" — click Tie or Slur once to arm it
        // anchored at the currently open note, then click note after note
        // directly on the staff to chain them together (each click ties
        // the previous note into the one just clicked and moves the
        // anchor forward), instead of having to reopen the picker and
        // toggle a flag on every note in the chain one at a time.
        function sheetConnectHintEl() {
            let el = expandEl.querySelector('[data-sheet-connect-hint]');
            if (!el) {
                el = document.createElement('div');
                el.setAttribute('data-sheet-connect-hint', '');
                el.className = 'pj-sheet-connect-hint';
                el.innerHTML = '<span data-sheet-connect-hint-text></span><button type="button" data-sheet-connect-stop aria-label="Stop connecting">Done</button>';
                expandEl.appendChild(el);
            }
            return el;
        }
        function sheetShowConnectHint() {
            const el = sheetConnectHintEl();
            const label = sheetConnectMode.type === 'tie' ? '🔗 Tying' : '⌒ Slurring';
            el.querySelector('[data-sheet-connect-hint-text]').textContent = label + ' — click the next note to chain it in';
            el.hidden = false;
        }
        function sheetStopConnectMode() {
            sheetConnectMode = null;
            const el = expandEl.querySelector('[data-sheet-connect-hint]');
            if (el) el.hidden = true;
        }
        // Called from both the staff-click handler and the word-row
        // click handler — a click only extends the chain when it lands
        // on the immediate next slot (same clef as the anchor, real note,
        // not a rest); anything else (including a non-matching clef, via
        // clickedClef) falls through so the caller can cancel connect
        // mode and treat the click as a normal one.
        function sheetTryExtendConnect(sectionId, lineIdx, wordIdx, clickedClef) {
            if (!sheetConnectMode) return false;
            if (sheetConnectMode.sectionId !== sectionId || sheetConnectMode.lineIdx !== lineIdx) return false;
            if (clickedClef && clickedClef !== sheetConnectMode.clef) return false;
            if (wordIdx !== sheetConnectMode.anchorIdx + 1) return false;
            const clef = sheetConnectMode.clef;
            const anchorNote = getSheetNote(sectionId, lineIdx, sheetConnectMode.anchorIdx, clef);
            const targetNote = getSheetNote(sectionId, lineIdx, wordIdx, clef);
            if (!anchorNote || !targetNote || targetNote.pitch === 'rest') return false;
            setSheetNote(sectionId, lineIdx, sheetConnectMode.anchorIdx, clef, sheetNoteWith(anchorNote, { [sheetConnectMode.type]: true }));
            sheetConnectMode.anchorIdx = wordIdx;
            sheetShowConnectHint();
            return true;
        }

        function wireSheetMusicEvents() {
            if (expandEl.dataset.sheetWired) return;
            expandEl.dataset.sheetWired = '1';

            expandEl.addEventListener('change', (e) => {
                if (activeKey !== 'action:lyrics') return;
                if (e.target.closest('[data-sheet-time]')) { setSheetHeader('timeSignature', e.target.value); return; }
                if (e.target.closest('[data-sheet-key]')) { setSheetHeader('key', e.target.value); return; }
                const tempoInp = e.target.closest('[data-sheet-tempo]');
                if (tempoInp) {
                    const v = parseInt(tempoInp.value, 10);
                    if (!isNaN(v) && v >= 40 && v <= 240) setSheetHeader('tempo', v);
                }
            });

            expandEl.addEventListener('click', (e) => {
                if (activeKey !== 'action:lyrics') return;

                if (e.target.closest('[data-sheet-connect-stop]')) { sheetStopConnectMode(); return; }

                const wordHit = e.target.closest('[data-sheet-word-click]');
                if (wordHit) {
                    const [sectionId, lineIdx, wordIdx] = wordHit.dataset.sheetWordClick.split(':');
                    if (sheetConnectMode) {
                        if (sheetTryExtendConnect(sectionId, Number(lineIdx), Number(wordIdx))) return;
                        sheetStopConnectMode(); // clicked something that doesn't extend the chain — cancel and treat as a normal click
                    }
                    showSheetPicker(sectionId, Number(lineIdx), Number(wordIdx));
                    return;
                }
                if (e.target.closest('[data-sheet-picker-close]')) { hideSheetPicker(); return; }

                const clefBtn = e.target.closest('[data-sheet-clef]');
                if (clefBtn) { sheetPickerClef = clefBtn.dataset.sheetClef; sheetPickerOctave = sheetPickerClef === 'bass' ? 3 : 4; renderSheetPicker(); renderLyrics(); return; }

                const octBtn = e.target.closest('[data-sheet-octave]');
                if (octBtn) { sheetPickerOctave = parseInt(octBtn.dataset.sheetOctave, 10); renderSheetPicker(); return; }

                const runIdxBtn = e.target.closest('[data-sheet-run-index]');
                if (runIdxBtn && sheetPickerKey) {
                    // Every entry is a remove button — nothing to
                    // "select," since new pitches always append at the
                    // end now.
                    const cur = getSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef);
                    if (cur && Array.isArray(cur.run)) {
                        const i = parseInt(runIdxBtn.dataset.sheetRunIndex, 10);
                        const run = cur.run.slice();
                        run.splice(i, 1);
                        setSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef, sheetNoteWith(cur, { run }));
                        renderSheetPicker();
                    }
                    return;
                }
                const pitchBtn = e.target.closest('[data-sheet-pitch]');
                if (pitchBtn && sheetPickerKey) {
                    const cur = getSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef);
                    const clicked = pitchBtn.dataset.sheetPitch;
                    if (cur && Array.isArray(cur.run)) {
                        // Run mode: every click just appends another
                        // sub-note — the run's length is whatever you've
                        // clicked so far, never declared upfront. Capped
                        // by whether there's still a shorter duration
                        // left to render the next sub-note as (e.g. you
                        // can't subdivide a sixteenth note forever) —
                        // but that check only means anything once there
                        // are 2+ notes to actually subdivide with; the
                        // first note in a run has nothing to compute a
                        // ratio against yet and must always be allowed.
                        const nextLen = cur.run.length + 1;
                        if (nextLen >= 2 && !sheetRunSubDuration(cur.duration, nextLen)) return;
                        const run = cur.run.concat([clicked]);
                        setSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef, sheetNoteWith(cur, { run }));
                        renderSheetPicker();
                        return;
                    }
                    // Toggle the clicked pitch in/out of the chord — click
                    // more than one to stack notes on the same beat.
                    const pitches = (cur && cur.pitch !== 'rest') ? cur.pitch.split(',').filter(Boolean) : [];
                    const idx = pitches.indexOf(clicked);
                    if (idx >= 0) pitches.splice(idx, 1); else pitches.push(clicked);
                    setSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef,
                        pitches.length ? sheetNoteWith(cur, { pitch: pitches.join(',') }) : null);
                    renderSheetPicker();
                    return;
                }
                const durBtn = e.target.closest('[data-sheet-duration]');
                if (durBtn && sheetPickerKey) {
                    const cur = getSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef);
                    if (cur) { setSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef, sheetNoteWith(cur, { duration: durBtn.dataset.sheetDuration })); renderSheetPicker(); }
                    return;
                }
                const runBtn = e.target.closest('[data-sheet-run]');
                if (runBtn && sheetPickerKey) {
                    const cur = getSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef);
                    // No note yet is fine — Run can create one directly,
                    // same as picking a pitch does; only a rest or an
                    // active tuplet blocks it (matches canRun above).
                    if (!(cur && (cur.pitch === 'rest' || cur.tuplet))) {
                        const isActive = !!(cur && Array.isArray(cur.run));
                        let patch;
                        if (isActive) {
                            patch = { run: null };
                        } else {
                            // If pitches were already picked as a chord
                            // (the natural first instinct — click the
                            // notes you want, THEN notice Run) before
                            // Run was clicked, seed the run from those
                            // instead of discarding them and starting
                            // blank. Makes both click orders work instead
                            // of one silently leaving a chord behind.
                            const existingPitches = (cur && cur.pitch && cur.pitch !== 'rest') ? cur.pitch.split(',').filter(Boolean) : [];
                            patch = { run: existingPitches, pitch: '', tie: false, slur: false, tuplet: 0, dots: false };
                        }
                        setSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef, sheetNoteWith(cur, patch));
                        renderSheetPicker();
                    }
                    return;
                }
                const tieBtn = e.target.closest('[data-sheet-tie]');
                if (tieBtn && sheetPickerKey) {
                    const cur = getSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef);
                    if (cur && cur.pitch !== 'rest' && !(cur.run && cur.run.length >= 2)) {
                        if (cur.tie) {
                            // Already tied into the next note — one click undoes it.
                            setSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef, sheetNoteWith(cur, { tie: false }));
                            renderSheetPicker();
                        } else {
                            // Arm connect mode instead of guessing which
                            // note to tie into — the next click(s) on the
                            // staff pick the target(s), and can keep
                            // chaining through as many notes as needed.
                            sheetConnectMode = { type: 'tie', sectionId: sheetPickerKey.sectionId, lineIdx: sheetPickerKey.lineIdx, clef: sheetPickerClef, anchorIdx: sheetPickerKey.wordIdx };
                            hideSheetPicker();
                            sheetShowConnectHint();
                        }
                    }
                    return;
                }
                const slurBtn = e.target.closest('[data-sheet-slur]');
                if (slurBtn && sheetPickerKey) {
                    const cur = getSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef);
                    if (cur && cur.pitch !== 'rest' && !(cur.run && cur.run.length >= 2)) {
                        if (cur.slur) {
                            setSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef, sheetNoteWith(cur, { slur: false }));
                            renderSheetPicker();
                        } else {
                            sheetConnectMode = { type: 'slur', sectionId: sheetPickerKey.sectionId, lineIdx: sheetPickerKey.lineIdx, clef: sheetPickerClef, anchorIdx: sheetPickerKey.wordIdx };
                            hideSheetPicker();
                            sheetShowConnectHint();
                        }
                    }
                    return;
                }
                const tupletBtn = e.target.closest('[data-sheet-tuplet]');
                if (tupletBtn && sheetPickerKey) {
                    const cur = getSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef);
                    if (cur && cur.pitch !== 'rest' && !(cur.run && cur.run.length >= 2)) {
                        const n = parseInt(tupletBtn.dataset.sheetTuplet, 10);
                        const next = cur.tuplet === n ? 0 : n; // clicking the active size again turns it off
                        setSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef, sheetNoteWith(cur, { tuplet: next }));
                        renderSheetPicker();
                    }
                    return;
                }
                const dotBtn = e.target.closest('[data-sheet-dot]');
                if (dotBtn && sheetPickerKey) {
                    const cur = getSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef);
                    if (cur && !(cur.run && cur.run.length >= 2)) {
                        setSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef, sheetNoteWith(cur, { dots: !cur.dots }));
                        renderSheetPicker();
                    }
                    return;
                }
                if (e.target.closest('[data-sheet-rest]') && sheetPickerKey) {
                    // sheetNoteWith so an existing duration/dots choice
                    // survives switching to a rest — a raw literal here
                    // silently reset duration back to quarter every time,
                    // discarding whatever the user had already picked.
                    const cur = getSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef);
                    setSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef, sheetNoteWith(cur, { pitch: 'rest', tie: false, slur: false, tuplet: 0, run: null }));
                    renderSheetPicker();
                    return;
                }
                if (e.target.closest('[data-sheet-clear]') && sheetPickerKey) {
                    setSheetNote(sheetPickerKey.sectionId, sheetPickerKey.lineIdx, sheetPickerKey.wordIdx, sheetPickerClef, null);
                    renderSheetPicker();
                    return;
                }

                if (sheetPickerKey && !e.target.closest('[data-sheet-picker]') && !e.target.closest('[data-sheet-word]') && !e.target.closest('[data-vf-line]')) {
                    hideSheetPicker();
                }
            });

            // Move one or more words onto a different beat: click a
            // word's grip handle to select it (click other handles to
            // select more — e.g. a whole phrase to gather under one
            // note), then click any word's TEXT to place all selected
            // words there. Two kinds of ordinary clicks, no press-and-
            // hold gesture — replaced an earlier drag-based version that
            // repeatedly failed to register on at least one real
            // trackpad despite the handler logic verifying correct in
            // every simulated test.
            //
            // Registered with useCapture=true and stopImmediatePropagation
            // so a selecting/completing click never also falls through to
            // the picker-opening click handler above for the same word.
            function sheetClearMoveSelection() {
                expandEl.querySelectorAll('.pj-sheet-word.is-move-source, .pj-sheet-word.is-move-target').forEach((el) => {
                    el.classList.remove('is-move-source', 'is-move-target');
                });
                sheetMoveSelection = [];
            }
            // Highlights every other word in the same line as a valid
            // place to drop the current selection, so it's visible where
            // a click will actually go instead of only seeing the
            // selected word itself.
            function sheetHighlightMoveTargets() {
                expandEl.querySelectorAll('.pj-sheet-word.is-move-target').forEach((el) => el.classList.remove('is-move-target'));
                if (!sheetMoveSelection.length) return;
                const { sectionId, lineIdx } = sheetMoveSelection[0];
                const selectedAddrs = new Set(sheetMoveSelection.map((s) => s.addr));
                expandEl.querySelectorAll('[data-sheet-word]').forEach((el) => {
                    const [sId, lIdx] = el.dataset.sheetWord.split(':');
                    if (sId === sectionId && Number(lIdx) === lineIdx && !selectedAddrs.has(el.dataset.sheetWord)) {
                        el.classList.add('is-move-target');
                    }
                });
            }
            expandEl.addEventListener('click', (e) => {
                if (activeKey !== 'action:lyrics') return;

                const handle = e.target.closest('[data-sheet-word-drag]');
                if (handle) {
                    e.stopImmediatePropagation();
                    const addr = handle.dataset.sheetWordDrag;
                    const wordEl = handle.closest('[data-sheet-word]');
                    const existingIdx = sheetMoveSelection.findIndex((s) => s.addr === addr);
                    if (existingIdx >= 0) {
                        sheetMoveSelection.splice(existingIdx, 1);
                        wordEl.classList.remove('is-move-source');
                        sheetHighlightMoveTargets();
                        return;
                    }
                    const [sectionId, lineIdx, slotIdx] = addr.split(':');
                    if (sheetMoveSelection.length && (sheetMoveSelection[0].sectionId !== sectionId || sheetMoveSelection[0].lineIdx !== Number(lineIdx))) {
                        sheetClearMoveSelection(); // switching to a different line — start fresh
                    }
                    sheetMoveSelection.push({ addr, sectionId, lineIdx: Number(lineIdx), slotIdx: Number(slotIdx), wordCount: Number(handle.dataset.sheetWordCount) });
                    wordEl.classList.add('is-move-source');
                    sheetHighlightMoveTargets();
                    return;
                }

                if (sheetMoveSelection.length) {
                    const target = e.target.closest('[data-sheet-word]');
                    if (!target) return; // clicked away from any word — leave the selection as-is
                    e.stopImmediatePropagation();
                    const [sectionId, lineIdx, slotIdx] = target.dataset.sheetWord.split(':');
                    const selection = sheetMoveSelection;
                    sheetClearMoveSelection();
                    if (sectionId === selection[0].sectionId && Number(lineIdx) === selection[0].lineIdx) {
                        sheetMoveWordsToSlot(sectionId, Number(lineIdx), selection[0].wordCount, selection.map((s) => s.slotIdx), Number(slotIdx));
                    }
                }
            }, true);
            // Clicking fully outside the panel while a move is pending
            // should cancel it too, not just clicking inside on empty
            // space — expandEl's own listener only sees clicks within it.
            document.addEventListener('click', (e) => {
                if (sheetMoveSelection.length && !expandEl.contains(e.target)) sheetClearMoveSelection();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && sheetConnectMode) sheetStopConnectMode();
            });
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
