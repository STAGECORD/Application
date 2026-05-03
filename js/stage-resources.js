// STAGECORD PRO — Resources page (/resources/)
// Pool of email accounts the company has provisioned. Manages lifecycle:
// Available → Pending → Active → Inactive. Visible in Filming/Brand/Label
// Stage modes only.

// ============================================================
// Resources page — pool of provisioned company emails
// ============================================================
// Each company Stage (Filming/Brand/Label) has a Resources pool of
// email accounts: Common (own domain) or Non-common (freelancers).
// Each can be Available (no profile yet), Pending (profile created but
// invitee hasn't logged in), Active (onboarded), or Inactive (terminated).
// Used by the Create A&R/Manager/PR flow to pick which email backs the
// new profile. For prototype data is hardcoded; real impl would persist.
(function() {
    if (!document.querySelector('[data-resources-summary]')) return;

    // The 28 staff members in the Label Stage roster all have a corresponding
    // resource entry. Plus extras: 3 pending invitations, 2 available, 1
    // inactive — to demonstrate the full lifecycle.
    const RESOURCES = [
        // Active — mapped to existing staff (s1..s28)
        { id: 'r1',  email: 'jonas.mikkelsen@sony.com',     name: 'Jonas Mikkelsen',  avatar: 'placeholder-male-1.png',   type: 'common',     status: 'active', profileType: 'PR',      profileName: 'Jonas Mikkelsen',  profileId: 's1',  createdAt: '2024-08-15' },
        { id: 'r2',  email: 'ella.lund@sony.com',           name: 'Ella Lund',        avatar: 'placeholder-female-1.png', type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Ella Lund',        profileId: 's2',  createdAt: '2024-09-20' },
        { id: 'r3',  email: 'oskar.vestergaard@sony.com',   name: 'Oskar Vestergaard',avatar: 'placeholder-male-2.png',   type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Oskar Vestergaard',profileId: 's3',  createdAt: '2024-10-05' },
        { id: 'r4',  email: 'mille.schou@sony.com',         name: 'Mille Schou',      avatar: 'placeholder-female-2.png', type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Mille Schou',      profileId: 's4',  createdAt: '2024-11-12' },
        { id: 'r5',  email: 'asta.joergensen@sony.com',     name: 'Asta Jørgensen',   avatar: 'placeholder-female-3.png', type: 'common',     status: 'active', profileType: 'Manager', profileName: 'Asta Jørgensen',   profileId: 's5',  createdAt: '2024-05-18' },
        { id: 'r6',  email: 'marie.bjerg@sony.com',         name: 'Marie Bjerg',      avatar: 'placeholder-female-4.png', type: 'common',     status: 'active', profileType: 'Manager', profileName: 'Marie Bjerg',      profileId: 's6',  createdAt: '2024-03-22' },
        { id: 'r7',  email: 'victoria.larsen@sony.com',     name: 'Victoria Larsen',  avatar: 'placeholder-female-5.png', type: 'common',     status: 'active', profileType: 'Manager', profileName: 'Victoria Larsen',  profileId: 's7',  createdAt: '2024-02-14' },
        { id: 'r8',  email: 'mason.blake@sony.com',         name: 'Mason Blake',      avatar: 'placeholder-male-3.png',   type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Mason Blake',      profileId: 's8',  createdAt: '2024-04-08' },
        { id: 'r9',  email: 'lysandra.eryx@sony.com',       name: 'Lysandra Eryx',    avatar: 'placeholder-female-6.png', type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Lysandra Eryx',    profileId: 's9',  createdAt: '2024-12-04' },
        { id: 'r10', email: 'hudson.parker@sony.com',       name: 'Hudson Parker',    avatar: 'placeholder-male-4.png',   type: 'common',     status: 'active', profileType: 'PR',      profileName: 'Hudson Parker',    profileId: 's10', createdAt: '2023-06-01' },
        { id: 'r11', email: 'thorne.evadne@sony.com',       name: 'Thorne Evadne',    avatar: 'placeholder-female-1.png', type: 'common',     status: 'active', profileType: 'Manager', profileName: 'Thorne Evadne',    profileId: 's11', createdAt: '2025-04-22' },
        { id: 'r12', email: 'liora.jensen@sony.com',        name: 'Liora Jensen',     avatar: 'placeholder-female-2.png', type: 'common',     status: 'active', profileType: 'Manager', profileName: 'Liora Jensen',     profileId: 's12', createdAt: '2024-07-09' },
        { id: 'r13', email: 'tobias.nikolaisen@sony.com',   name: 'Tobias Nikolaisen',avatar: 'placeholder-male-5.png',   type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Tobias Nikolaisen',profileId: 's13', createdAt: '2025-02-18' },
        { id: 'r14', email: 'vibeke.clement@sony.com',      name: 'Vibeke Clement',   avatar: 'placeholder-female-3.png', type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Vibeke Clement',   profileId: 's14', createdAt: '2024-11-25' },
        { id: 'r15', email: 'sebastian.kragh@sony.com',     name: 'Sebastian Kragh',  avatar: 'placeholder-male-6.png',   type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Sebastian Kragh',  profileId: 's15', createdAt: '2024-10-08' },
        { id: 'r16', email: 'caroline.holst@sony.com',      name: 'Caroline Holst',   avatar: 'placeholder-female-4.png', type: 'common',     status: 'active', profileType: 'PR',      profileName: 'Caroline Holst',   profileId: 's16', createdAt: '2024-04-02' },
        { id: 'r17', email: 'felix.munk@sony.com',          name: 'Felix Munk',       avatar: 'placeholder-male-7.png',   type: 'common',     status: 'active', profileType: 'Manager', profileName: 'Felix Munk',       profileId: 's17', createdAt: '2023-09-15' },
        { id: 'r18', email: 'tilde.pedersen@sony.com',      name: 'Tilde Pedersen',   avatar: 'placeholder-female-5.png', type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Tilde Pedersen',   profileId: 's18', createdAt: '2024-12-20' },
        { id: 'r19', email: 'magnus.hjort@sony.com',        name: 'Magnus Hjort',     avatar: 'placeholder-male-1.png',   type: 'common',     status: 'active', profileType: 'Manager', profileName: 'Magnus Hjort',     profileId: 's19', createdAt: '2024-02-04' },
        { id: 'r20', email: 'astrid.lange@sony.com',        name: 'Astrid Lange',     avatar: 'placeholder-female-6.png', type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Astrid Lange',     profileId: 's20', createdAt: '2025-04-10' },
        { id: 'r21', email: 'emil.stroem@sony.com',         name: 'Emil Strøm',       avatar: 'placeholder-male-2.png',   type: 'common',     status: 'active', profileType: 'PR',      profileName: 'Emil Strøm',       profileId: 's21', createdAt: '2024-01-12' },
        { id: 'r22', email: 'sofie.bahn@sony.com',          name: 'Sofie Bahn',       avatar: 'placeholder-female-1.png', type: 'common',     status: 'active', profileType: 'Manager', profileName: 'Sofie Bahn',       profileId: 's22', createdAt: '2024-06-08' },
        { id: 'r23', email: 'viktor.steffensen@sony.com',   name: 'Viktor Steffensen',avatar: 'placeholder-male-3.png',   type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Viktor Steffensen',profileId: 's23', createdAt: '2025-05-30' },
        { id: 'r24', email: 'naja.holm@sony.com',           name: 'Naja Holm',        avatar: 'placeholder-female-2.png', type: 'common',     status: 'active', profileType: 'PR',      profileName: 'Naja Holm',        profileId: 's24', createdAt: '2023-10-15' },
        { id: 'r25', email: 'otto@bergfreelance.dk',        name: 'Otto Berg',        avatar: 'placeholder-male-4.png',   type: 'non-common', status: 'active', profileType: 'Manager', profileName: 'Otto Berg',        profileId: 's25', createdAt: '2024-03-25' },
        { id: 'r26', email: 'linnea.roost@sony.com',        name: 'Linnea Roost',     avatar: 'placeholder-female-3.png', type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Linnea Roost',     profileId: 's26', createdAt: '2024-11-05' },
        { id: 'r27', email: 'konrad.vinge@sony.com',        name: 'Konrad Vinge',     avatar: 'placeholder-male-5.png',   type: 'common',     status: 'active', profileType: 'Manager', profileName: 'Konrad Vinge',     profileId: 's27', createdAt: '2024-09-02' },
        { id: 'r28', email: 'filippa.sand@sony.com',        name: 'Filippa Sand',     avatar: 'placeholder-female-4.png', type: 'common',     status: 'active', profileType: 'A&R',     profileName: 'Filippa Sand',     profileId: 's28', createdAt: '2025-01-10' },

        // Pending — profiler oprettet, person har ikke logget ind endnu
        { id: 'r29', email: 'lars.holm@sony.com',           name: 'Lars Holm',        avatar: '',                          type: 'common',     status: 'pending',   profileType: 'A&R',     profileName: 'Lars Holm',        profileId: 'pending-1', createdAt: '2026-04-28' },
        { id: 'r30', email: 'mette.nordby@sony.com',        name: 'Mette Nordby',     avatar: '',                          type: 'common',     status: 'pending',   profileType: 'PR',      profileName: 'Mette Nordby',     profileId: 'pending-2', createdAt: '2026-04-30' },
        { id: 'r31', email: 'studio@helsinger.dk',          name: 'Helsinger Studio', avatar: '',                          type: 'non-common', status: 'pending',   profileType: 'Manager', profileName: 'Helsinger Studio', profileId: 'pending-3', createdAt: '2026-05-01' },

        // Available — emails provisioned but no profile created yet
        { id: 'r32', email: 'newhire1@sony.com',            name: '',                 avatar: '',                          type: 'common',     status: 'available', profileType: '',         profileName: '',                 profileId: null,        createdAt: '2026-04-29' },
        { id: 'r33', email: 'newhire2@sony.com',            name: '',                 avatar: '',                          type: 'common',     status: 'available', profileType: '',         profileName: '',                 profileId: null,        createdAt: '2026-04-29' },

        // Inactive — terminated employees
        { id: 'r34', email: 'sigurd.veje@sony.com',         name: 'Sigurd Veje',      avatar: 'placeholder-male-6.png',    type: 'common',     status: 'inactive',  profileType: 'A&R',     profileName: 'Sigurd Veje',      profileId: null,        createdAt: '2022-04-12' }
    ];

    const filters = { status: 'all', type: 'all', profile: 'all', searchEmail: '', searchName: '', sort: 'created-desc' };

    function fmtDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function avatarUrl(filename) {
        if (!filename) return '';
        return '../assets/images/artists/' + filename;
    }

    function applyFilters(list) {
        let out = list.slice();
        if (filters.status !== 'all')  out = out.filter(function(r) { return r.status === filters.status; });
        if (filters.type !== 'all')    out = out.filter(function(r) { return r.type === filters.type; });
        if (filters.profile !== 'all') {
            if (filters.profile === 'none') out = out.filter(function(r) { return !r.profileType; });
            else out = out.filter(function(r) { return r.profileType === filters.profile; });
        }
        if (filters.searchEmail) {
            const q = filters.searchEmail.toLowerCase();
            out = out.filter(function(r) { return r.email.toLowerCase().indexOf(q) !== -1; });
        }
        if (filters.searchName) {
            const q = filters.searchName.toLowerCase();
            out = out.filter(function(r) { return (r.name || '').toLowerCase().indexOf(q) !== -1; });
        }
        switch (filters.sort) {
            case 'created-asc':  out.sort(function(a, b) { return a.createdAt.localeCompare(b.createdAt); }); break;
            case 'email':        out.sort(function(a, b) { return a.email.localeCompare(b.email); }); break;
            case 'name':         out.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); }); break;
            default:             out.sort(function(a, b) { return b.createdAt.localeCompare(a.createdAt); });
        }
        return out;
    }

    function renderRow(r) {
        const typePill = r.type === 'common'
            ? '<span class="resources-pill resources-pill--common">Common</span>'
            : '<span class="resources-pill resources-pill--non-common">Freelance</span>';

        const statusPill = '<span class="resources-pill resources-pill--' + r.status + '">' + (
            r.status === 'pending' ? 'Pending invite' :
            r.status === 'available' ? 'Available' :
            r.status === 'inactive' ? 'Inactive' : 'Active'
        ) + '</span>';

        const nameCell = r.name
            ? '<span class="resources-table__avatar"' + (r.avatar ? ' style="background-image: url(\'' + avatarUrl(r.avatar) + '\');"' : '') + '></span>' +
              '<span class="resources-table__name auto-name">' + SC.escapeHtml(r.name) + '</span>'
            : '<span class="resources-table__name resources-table__name--empty">— Not assigned</span>';

        const profileCell = r.profileType
            ? '<a class="resources-table__profile" href="../manager/index.html" data-help="Klik for at se ' + SC.escapeAttr(r.profileName) + '\'s roster i Label Stage.">' +
                '<div class="resources-table__profile-meta">' +
                    '<span class="resources-table__profile-role">' + SC.escapeHtml(r.profileType) + '</span>' +
                    '<span class="resources-table__profile-name auto-name">' + SC.escapeHtml(r.profileName) + '</span>' +
                '</div>' +
              '</a>'
            : '<span class="resources-table__profile--none">No profile yet</span>';

        let action = '';
        if (r.status === 'available') {
            action = '<button type="button" class="resources-table__action" data-resources-use-id="' + SC.escapeAttr(r.id) + '" data-help="Use this email to create a new A&R/Manager/PR profile. Jumps to Label Stage with the email pre-filled.">+ Use</button>';
        } else if (r.status === 'pending') {
            action = '<button type="button" class="resources-table__action resources-table__action--warn" data-resources-resend-id="' + SC.escapeAttr(r.id) + '" data-help="Resend the invitation to this email — e.g. if the person did not receive the first one or it has expired.">↻ Resend</button>';
        } else if (r.status === 'active') {
            action = '<button type="button" class="resources-table__action resources-table__action--ghost" data-resources-manage-id="' + SC.escapeAttr(r.id) + '" data-help="Open this staff member\'s profile in the Label Stage roster.">Manage →</button>';
        } else if (r.status === 'inactive') {
            action = '<button type="button" class="resources-table__action resources-table__action--ghost" data-resources-reactivate-id="' + SC.escapeAttr(r.id) + '" data-help="Reactivate this resource — make it available again in the pool.">Reactivate</button>';
        }

        return '<div class="resources-table__row">' +
            '<div class="resources-table__td resources-table__email" title="' + SC.escapeAttr(r.email) + '">' + SC.escapeHtml(r.email) + '</div>' +
            '<div class="resources-table__td resources-table__name-cell">' + nameCell + '</div>' +
            '<div class="resources-table__td">' + typePill + '</div>' +
            '<div class="resources-table__td">' + statusPill + '</div>' +
            '<div class="resources-table__td">' + profileCell + '</div>' +
            '<div class="resources-table__td resources-table__date">' + fmtDate(r.createdAt) + '</div>' +
            '<div class="resources-table__td">' + action + '</div>' +
        '</div>';
    }

    function renderTable(rows, target) {
        if (!rows.length) {
            target.parentElement.hidden = true;
            return;
        }
        target.parentElement.hidden = false;
        target.innerHTML =
            '<div class="resources-table__head">' +
                '<div class="resources-table__th">Email</div>' +
                '<div class="resources-table__th">Name</div>' +
                '<div class="resources-table__th">Type</div>' +
                '<div class="resources-table__th">Status</div>' +
                '<div class="resources-table__th">Profile</div>' +
                '<div class="resources-table__th">Created</div>' +
                '<div class="resources-table__th"></div>' +
            '</div>' +
            rows.map(renderRow).join('');
    }

    function renderSummary() {
        const counts = {
            active:    RESOURCES.filter(function(r) { return r.status === 'active'; }).length,
            pending:   RESOURCES.filter(function(r) { return r.status === 'pending'; }).length,
            available: RESOURCES.filter(function(r) { return r.status === 'available'; }).length,
            inactive:  RESOURCES.filter(function(r) { return r.status === 'inactive'; }).length
        };
        const summaryEl = document.querySelector('[data-resources-summary]');
        summaryEl.innerHTML =
            '<span class="resources-summary__stat" data-help="Active: emails linked to a profile where the user has logged in and completed their info."><span class="resources-summary__count resources-summary__count--good">' + counts.active + '</span>active</span>' +
            '<span class="resources-summary__stat" data-help="Pending: profile created and invitation sent, but the person has not logged in yet."><span class="resources-summary__count resources-summary__count--warn">' + counts.pending + '</span>pending invitations</span>' +
            '<span class="resources-summary__stat" data-help="Available: email provisioned but not yet linked to a profile. Ready to be used for the next hire."><span class="resources-summary__count">' + counts.available + '</span>available</span>' +
            '<span class="resources-summary__stat" data-help="Inactive: former staff — can no longer log in."><span class="resources-summary__count">' + counts.inactive + '</span>inactive</span>';
    }

    function render() {
        renderSummary();
        const filtered = applyFilters(RESOURCES);
        renderTable(filtered.filter(function(r) { return r.status === 'pending'; }),   document.querySelector('[data-resources-pending-table]'));
        renderTable(filtered.filter(function(r) { return r.status === 'available'; }), document.querySelector('[data-resources-available-table]'));
        renderTable(filtered.filter(function(r) { return r.status === 'active'; }),    document.querySelector('[data-resources-active-table]'));
        renderTable(filtered.filter(function(r) { return r.status === 'inactive'; }),  document.querySelector('[data-resources-inactive-table]'));
        if (typeof formatAllNames === 'function') formatAllNames(document);
    }

    // Filter listeners
    document.addEventListener('change', function(e) {
        const el = e.target.closest('[data-resources-filter]');
        if (!el) return;
        const key = el.getAttribute('data-resources-filter');
        const map = { 'status': 'status', 'type': 'type', 'profile': 'profile', 'sort': 'sort', 'search-email': 'searchEmail', 'search-name': 'searchName' };
        if (map[key]) {
            filters[map[key]] = el.value;
            render();
        }
    });
    document.addEventListener('input', function(e) {
        const el = e.target.closest('[data-resources-filter]');
        if (!el) return;
        const key = el.getAttribute('data-resources-filter');
        if (key === 'search-email') { filters.searchEmail = el.value; render(); }
        if (key === 'search-name')  { filters.searchName  = el.value; render(); }
    });

    // ---------------------------------------------------------
    // Add resource modal — provisioner ny email i pool'en
    // ---------------------------------------------------------
    let addModal = null;
    let addModalType = 'common';
    const LABEL_DOMAIN = '@sony.com';
    const ADD_STORAGE_KEY = 'stagecord:resources-added';

    function loadAddedResources() {
        try {
            const raw = localStorage.getItem(ADD_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }
    function saveAddedResource(resource) {
        const list = loadAddedResources();
        list.push(resource);
        try { localStorage.setItem(ADD_STORAGE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
        RESOURCES.push(resource);
    }

    // Hydrate any localStorage-added resources back into RESOURCES on load
    loadAddedResources().forEach(function(r) {
        if (!RESOURCES.find(function(x) { return x.id === r.id; })) RESOURCES.push(r);
    });

    function ensureAddModal() {
        if (addModal) return addModal;
        if (!document.querySelector('link[href*="pitch-modals.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = localAsset('css/pitch-modals.css');
            document.head.appendChild(link);
        }
        const wrap = document.createElement('div');
        wrap.innerHTML =
            '<div class="release-modal-overlay" id="addResourceModal" data-add-resource-modal aria-hidden="true" role="dialog" aria-modal="true">' +
                '<div class="release-modal release-modal--qr">' +
                    '<header class="release-modal__header">' +
                        '<h2 class="release-modal__title">Add resource</h2>' +
                        '<button type="button" class="release-modal__close" data-add-close aria-label="Close">&times;</button>' +
                    '</header>' +
                    '<div class="release-modal__body">' +
                        '<p class="ar-page-intro" style="margin:0 0 14px;">Provisionér en ny email til virksomheds-pool\'en. <strong>Common</strong> bruger jeres eget domæne; <strong>Non-common</strong> er til freelancere med eksternt domæne.</p>' +
                        '<form class="resources-add-form" data-add-form>' +
                            '<div class="resources-add-form__field">' +
                                '<label class="stage-filter__label">Type</label>' +
                                '<div class="resources-add-form__type">' +
                                    '<button type="button" class="resources-add-form__type-btn is-active" data-add-type="common">' +
                                        '<span class="resources-add-form__type-btn-title">Common</span>' +
                                        '<span class="resources-add-form__type-btn-hint">Own domain · ' + LABEL_DOMAIN + '</span>' +
                                    '</button>' +
                                    '<button type="button" class="resources-add-form__type-btn" data-add-type="non-common">' +
                                        '<span class="resources-add-form__type-btn-title">Non-common</span>' +
                                        '<span class="resources-add-form__type-btn-hint">Freelancer · external domain</span>' +
                                    '</button>' +
                                '</div>' +
                            '</div>' +
                            '<div class="resources-add-form__field" data-add-common-field>' +
                                '<label class="stage-filter__label" for="addEmailLocal">Email</label>' +
                                '<div style="display:flex;align-items:stretch;border:1px solid rgba(255,255,255,0.18);border-radius:6px;overflow:hidden;background:rgba(0,0,0,0.4);">' +
                                    '<input type="text" id="addEmailLocal" class="stage-filter__control" data-add-email-local placeholder="newhire" style="border:none;border-radius:0;flex:1;background:transparent;"/>' +
                                    '<span style="display:flex;align-items:center;padding:0 14px;color:rgba(255,255,255,0.55);font-family:Outfit,sans-serif;font-size:13px;background:rgba(255,255,255,0.04);">' + LABEL_DOMAIN + '</span>' +
                                '</div>' +
                            '</div>' +
                            '<div class="resources-add-form__field" data-add-noncommon-field hidden>' +
                                '<label class="stage-filter__label" for="addEmailFull">Email (full address)</label>' +
                                '<input type="email" id="addEmailFull" class="stage-filter__control" data-add-email-full placeholder="freelancer@example.com"/>' +
                            '</div>' +
                            '<div class="resources-add-form__field">' +
                                '<label class="stage-filter__label" for="addName">Name <span style="color:rgba(255,255,255,0.4);font-weight:400;">(optional)</span></label>' +
                                '<input type="text" id="addName" class="stage-filter__control" data-add-name placeholder="Lars Holm"/>' +
                                '<span style="font-size:11px;color:rgba(255,255,255,0.5);">Leave empty if the email is provisioned before the person is selected.</span>' +
                            '</div>' +
                        '</form>' +
                        '<div class="reassign-confirm-banner" data-add-success hidden></div>' +
                    '</div>' +
                    '<footer class="release-modal__actions">' +
                        '<button type="button" class="release-modal__btn" data-add-close>Cancel</button>' +
                        '<button type="button" class="release-modal__btn release-modal__btn--primary" data-add-submit>Add to pool</button>' +
                    '</footer>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap.firstChild);
        addModal = document.getElementById('addResourceModal');
        return addModal;
    }

    function openAddModal() {
        ensureAddModal();
        addModalType = 'common';
        addModal.querySelectorAll('[data-add-type]').forEach(function(b) {
            b.classList.toggle('is-active', b.getAttribute('data-add-type') === 'common');
        });
        addModal.querySelector('[data-add-common-field]').hidden = false;
        addModal.querySelector('[data-add-noncommon-field]').hidden = true;
        addModal.querySelector('[data-add-email-local]').value = '';
        addModal.querySelector('[data-add-email-full]').value = '';
        addModal.querySelector('[data-add-name]').value = '';
        addModal.querySelector('[data-add-success]').hidden = true;
        addModal.querySelector('[data-add-form]').hidden = false;
        addModal.querySelector('[data-add-submit]').hidden = false;
        addModal.classList.add('open');
        addModal.setAttribute('aria-hidden', 'false');
    }
    function closeAddModal() {
        if (!addModal) return;
        addModal.classList.remove('open');
        addModal.setAttribute('aria-hidden', 'true');
    }

    function submitAdd() {
        let email = '';
        if (addModalType === 'common') {
            const local = addModal.querySelector('[data-add-email-local]').value.trim();
            if (!local) return;
            email = local + LABEL_DOMAIN;
        } else {
            email = addModal.querySelector('[data-add-email-full]').value.trim();
            if (!email || email.indexOf('@') < 1) return;
        }
        // Block duplicates
        if (RESOURCES.find(function(r) { return r.email.toLowerCase() === email.toLowerCase(); })) {
            const success = addModal.querySelector('[data-add-success]');
            success.hidden = false;
            success.style.background = 'rgba(255, 106, 85, 0.1)';
            success.style.borderColor = 'rgba(255, 106, 85, 0.4)';
            success.innerHTML = '<strong style="color:#FF6A55;">Email findes allerede i pool\'en.</strong>';
            return;
        }
        const name = addModal.querySelector('[data-add-name]').value.trim();
        const newResource = {
            id: 'r' + Date.now(),
            email: email,
            name: name || '',
            avatar: '',
            type: addModalType,
            status: 'available',
            profileType: '',
            profileName: '',
            profileId: null,
            createdAt: new Date().toISOString().slice(0, 10)
        };
        saveAddedResource(newResource);

        const success = addModal.querySelector('[data-add-success]');
        success.style.background = 'rgba(67, 196, 122, 0.1)';
        success.style.borderColor = 'rgba(67, 196, 122, 0.4)';
        success.innerHTML = '<strong>' + SC.escapeHtml(email) + '</strong> tilføjet til pool\'en. Den er nu <em>Available</em> og klar til at blive brugt ved næste profile-oprettelse.';
        success.hidden = false;
        addModal.querySelector('[data-add-form]').hidden = true;
        addModal.querySelector('[data-add-submit]').hidden = true;
        render();
    }

    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-resources-add]')) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            openAddModal();
            return;
        }
        // Per-row actions
        const useBtn = e.target.closest('[data-resources-use-id]');
        if (useBtn) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            const id = useBtn.getAttribute('data-resources-use-id');
            const r = RESOURCES.find(function(x) { return x.id === id; });
            if (r) {
                try { localStorage.setItem('stagecord:resource-pre-fill', r.email); } catch (e2) { /* ignore */ }
                window.location.href = '../manager/index.html';
            }
            return;
        }
        const resendBtn = e.target.closest('[data-resources-resend-id]');
        if (resendBtn) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            const id = resendBtn.getAttribute('data-resources-resend-id');
            const r = RESOURCES.find(function(x) { return x.id === id; });
            if (r) {
                resendBtn.textContent = '✓ Sent';
                resendBtn.disabled = true;
                resendBtn.style.opacity = '0.6';
                setTimeout(function() {
                    resendBtn.textContent = '↻ Resend';
                    resendBtn.disabled = false;
                    resendBtn.style.opacity = '';
                }, 2200);
            }
            return;
        }
        const manageBtn = e.target.closest('[data-resources-manage-id]');
        if (manageBtn) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            const id = manageBtn.getAttribute('data-resources-manage-id');
            const r = RESOURCES.find(function(x) { return x.id === id; });
            if (r && r.profileId) {
                try { localStorage.setItem('stagecord:focus-staff', r.profileId); } catch (e2) { /* ignore */ }
            }
            window.location.href = '../manager/index.html';
            return;
        }
        const reactivateBtn = e.target.closest('[data-resources-reactivate-id]');
        if (reactivateBtn) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            const id = reactivateBtn.getAttribute('data-resources-reactivate-id');
            const r = RESOURCES.find(function(x) { return x.id === id; });
            if (r) {
                r.status = 'available';
                r.profileId = null;
                r.profileType = '';
                r.profileName = '';
                r.name = r.name; // keep name as historical
                render();
            }
            return;
        }
        if (!addModal) return;
        if (e.target.closest('[data-add-close]')) { closeAddModal(); return; }
        if (e.target.closest('[data-add-submit]')) { submitAdd(); return; }
        const typeBtn = e.target.closest('[data-add-type]');
        if (typeBtn) {
            addModalType = typeBtn.getAttribute('data-add-type');
            addModal.querySelectorAll('[data-add-type]').forEach(function(b) {
                b.classList.toggle('is-active', b === typeBtn);
            });
            addModal.querySelector('[data-add-common-field]').hidden = (addModalType !== 'common');
            addModal.querySelector('[data-add-noncommon-field]').hidden = (addModalType !== 'non-common');
            return;
        }
        if (e.target === addModal) closeAddModal();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && addModal && addModal.classList.contains('open')) closeAddModal();
    });

    document.addEventListener('DOMContentLoaded', render);
    if (document.readyState !== 'loading') render();
})();
