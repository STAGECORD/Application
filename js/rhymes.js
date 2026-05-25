(async function () {
    const sb = window.supabaseClient;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { window.location.href = '/login/'; return; }
    const user = session.user;

    const CATEGORIES = [
        { slug: 'verse',      label: 'Verse' },
        { slug: 'pre_chorus', label: 'Pre-chorus' },
        { slug: 'chorus',     label: 'Chorus' },
        { slug: 'middle_8',   label: 'Middle-8' },
        { slug: 'bridge',     label: 'Bridge' },
        { slug: 'hook',       label: 'Hook' },
        { slug: 'intro',      label: 'Intro' },
        { slug: 'outro',      label: 'Outro' },
        { slug: 'refrain',    label: 'Refrain' },
        { slug: 'tag',        label: 'Tag' },
        { slug: 'vamp',       label: 'Vamp' },
        { slug: 'ad_lib',     label: 'Ad-lib' },
        { slug: 'other',      label: 'Other' }
    ];
    const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.label]));

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    const listEl = document.getElementById('rhList');
    const filtersEl = document.getElementById('rhFilters');
    const newBtn = document.getElementById('newRhymeBtn');
    const modal = document.getElementById('rhModal');
    const modalTitle = document.getElementById('rhModalTitle');
    const titleInput = document.getElementById('rhTitle');
    const categorySelect = document.getElementById('rhCategory');
    const customCategoryField = document.getElementById('rhCustomCategoryField');
    const customCategoryInput = document.getElementById('rhCustomCategory');
    const contentInput = document.getElementById('rhContent');
    const projectSelect = document.getElementById('rhProject');
    const cancelBtn = document.getElementById('rhCancel');
    const saveBtn = document.getElementById('rhSave');
    const errorEl = document.getElementById('rhModalError');

    let rhymes = [];
    let projectsById = {};
    let activeFilter = null;
    let editingId = null;

    async function loadProjects() {
        const { data, error } = await sb.rpc('get_my_projects');
        if (error) { console.warn('get_my_projects failed:', error); return; }
        const opts = ['<option value="">— No project —</option>'];
        (data || []).forEach((p) => {
            projectsById[p.id] = p;
            opts.push(`<option value="${escapeHtml(p.id)}">${escapeHtml(p.title)}</option>`);
        });
        projectSelect.innerHTML = opts.join('');
    }

    async function loadRhymes() {
        const { data, error } = await sb
            .from('rhymes')
            .select('id, title, content, category, custom_category, project_id, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('load rhymes failed:', error);
            listEl.innerHTML = `<div class="rh-empty"><strong>Couldn't load your rhymes</strong>${escapeHtml(error.message || 'Try refreshing.')}</div>`;
            return;
        }
        rhymes = data || [];
        renderFilters();
        renderList();
    }

    function renderFilters() {
        const counts = {};
        rhymes.forEach((r) => { counts[r.category] = (counts[r.category] || 0) + 1; });
        const total = rhymes.length;
        const chips = [
            `<button type="button" class="rh-chip${activeFilter === null ? ' is-active' : ''}" data-filter="">All<span class="rh-chip__count">${total}</span></button>`
        ];
        CATEGORIES.forEach((c) => {
            const count = counts[c.slug] || 0;
            if (count === 0) return;
            chips.push(`<button type="button" class="rh-chip${activeFilter === c.slug ? ' is-active' : ''}" data-filter="${c.slug}">${escapeHtml(c.label)}<span class="rh-chip__count">${count}</span></button>`);
        });
        filtersEl.innerHTML = chips.join('');
        filtersEl.querySelectorAll('[data-filter]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const f = btn.getAttribute('data-filter');
                activeFilter = f === '' ? null : f;
                renderFilters();
                renderList();
            });
        });
    }

    function renderList() {
        const filtered = activeFilter
            ? rhymes.filter((r) => r.category === activeFilter)
            : rhymes;
        if (filtered.length === 0) {
            const empty = rhymes.length === 0
                ? `<div class="rh-empty"><strong>No rhymes yet</strong>Hit '+ New rhyme' to add your first verse, chorus or bridge idea.</div>`
                : `<div class="rh-empty"><strong>No rhymes in this section</strong>You haven't added any ${escapeHtml(CATEGORY_LABEL[activeFilter] || 'rhymes')} yet.</div>`;
            listEl.innerHTML = empty;
            return;
        }
        listEl.innerHTML = filtered.map((r) => {
            const catLabel = r.category === 'other' && r.custom_category
                ? escapeHtml(r.custom_category)
                : escapeHtml(CATEGORY_LABEL[r.category] || r.category);
            const project = r.project_id ? projectsById[r.project_id] : null;
            const projectChip = project
                ? `<a class="rh-card__project" href="/projects/?id=${encodeURIComponent(project.id)}" title="Open project">${escapeHtml(project.title)}</a>`
                : '';
            const title = r.title
                ? `<span class="rh-card__title" title="${escapeHtml(r.title)}">${escapeHtml(r.title)}</span>`
                : '';
            return `<article class="rh-card" data-rhyme-id="${escapeHtml(r.id)}">
                <header class="rh-card__head">
                    <span class="rh-card__cat">${catLabel}</span>
                    ${title}
                </header>
                <div class="rh-card__content">${escapeHtml(r.content)}</div>
                <div class="rh-card__foot">
                    ${projectChip}
                    <div class="rh-card__actions">
                        <button type="button" class="rh-card__action" data-edit-rhyme="${escapeHtml(r.id)}">Edit</button>
                        <button type="button" class="rh-card__action rh-card__action--danger" data-delete-rhyme="${escapeHtml(r.id)}">Delete</button>
                    </div>
                </div>
            </article>`;
        }).join('');

        listEl.querySelectorAll('[data-edit-rhyme]').forEach((btn) => {
            btn.addEventListener('click', () => openEdit(btn.getAttribute('data-edit-rhyme')));
        });
        listEl.querySelectorAll('[data-delete-rhyme]').forEach((btn) => {
            btn.addEventListener('click', () => deleteRhyme(btn.getAttribute('data-delete-rhyme')));
        });
    }

    function openNew() {
        editingId = null;
        modalTitle.textContent = 'New rhyme';
        titleInput.value = '';
        categorySelect.value = activeFilter && activeFilter !== 'other' ? activeFilter : 'verse';
        customCategoryInput.value = '';
        customCategoryField.hidden = categorySelect.value !== 'other';
        contentInput.value = '';
        projectSelect.value = '';
        errorEl.textContent = '';
        modal.classList.add('is-open');
        contentInput.focus();
    }

    function openEdit(id) {
        const r = rhymes.find((x) => x.id === id);
        if (!r) return;
        editingId = id;
        modalTitle.textContent = 'Edit rhyme';
        titleInput.value = r.title || '';
        categorySelect.value = r.category;
        customCategoryInput.value = r.custom_category || '';
        customCategoryField.hidden = r.category !== 'other';
        contentInput.value = r.content || '';
        projectSelect.value = r.project_id || '';
        errorEl.textContent = '';
        modal.classList.add('is-open');
        contentInput.focus();
    }

    async function deleteRhyme(id) {
        const r = rhymes.find((x) => x.id === id);
        if (!r) return;
        const label = r.title ? `"${r.title}"` : `this ${CATEGORY_LABEL[r.category] || 'rhyme'}`;
        if (!confirm(`Delete ${label}? This can't be undone.`)) return;
        const { error } = await sb.from('rhymes').delete().eq('id', id);
        if (error) {
            alert('Could not delete: ' + (error.message || 'try again'));
            return;
        }
        rhymes = rhymes.filter((x) => x.id !== id);
        if (activeFilter && !rhymes.some((x) => x.category === activeFilter)) {
            activeFilter = null;
        }
        renderFilters();
        renderList();
    }

    async function save() {
        const content = contentInput.value.trim();
        if (!content) {
            errorEl.textContent = 'Write something — the rhyme body cannot be empty.';
            contentInput.focus();
            return;
        }
        const category = categorySelect.value;
        const customCategory = category === 'other' ? (customCategoryInput.value.trim() || null) : null;
        if (category === 'other' && !customCategory) {
            errorEl.textContent = 'Give your custom section a name.';
            customCategoryInput.focus();
            return;
        }
        const payload = {
            user_id: user.id,
            title: titleInput.value.trim() || null,
            content,
            category,
            custom_category: customCategory,
            project_id: projectSelect.value || null
        };
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';
        errorEl.textContent = '';

        let result;
        if (editingId) {
            const updatePayload = { ...payload };
            delete updatePayload.user_id;
            result = await sb.from('rhymes').update(updatePayload).eq('id', editingId).select().single();
        } else {
            result = await sb.from('rhymes').insert(payload).select().single();
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save rhyme';

        if (result.error) {
            errorEl.textContent = 'Could not save: ' + (result.error.message || 'try again');
            return;
        }

        if (editingId) {
            const idx = rhymes.findIndex((x) => x.id === editingId);
            if (idx >= 0) rhymes[idx] = result.data;
        } else {
            rhymes.unshift(result.data);
        }
        modal.classList.remove('is-open');
        renderFilters();
        renderList();
    }

    newBtn.addEventListener('click', openNew);
    cancelBtn.addEventListener('click', () => modal.classList.remove('is-open'));
    saveBtn.addEventListener('click', save);
    categorySelect.addEventListener('change', () => {
        customCategoryField.hidden = categorySelect.value !== 'other';
        if (categorySelect.value === 'other') customCategoryInput.focus();
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('is-open');
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) {
            modal.classList.remove('is-open');
        }
    });

    await loadProjects();
    await loadRhymes();
})();
