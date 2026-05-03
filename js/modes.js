// STAGECORD PRO — Viewing-as mode switcher (prototype tool)
// Persists current profile type to localStorage and provides the bottom-of-
// sidebar dropdown for switching between Artist / Fan / Venue / Filming Stage
// / Brand Stage / Label Stage / A&R during demos.

// ============================================================
// User Mode switcher — temporary prototyping tool
// ============================================================
// Lets you preview the app as different profile types (artist, fan, venue,
// manager/label, sponsor/business, media licensor). Selection persists across
// pages via localStorage. Switching to a built mode navigates to that mode's
// home page; stubbed modes just reload (sidebar profile name updates).
(function() {
    const MODES = {
        artist:   { label: 'Artist',          profileName: 'Jokesmith Johnson', profileImage: 'assets/images/artists/jokesmith-johnson-cover.png', homePath: 'artist/index.html' },
        fan:      { label: 'Fan',             profileName: 'Julie Andersen',    profileImage: 'assets/images/artists/julie-andersen-profile.png', homePath: 'explore/index.html' },
        venue:    { label: 'Venue',           profileName: 'RUST',              profileImage: 'assets/images/artists/rust-cover.png',             homePath: 'venue/index.html'  },
        manager:  { label: 'Label Stage',     profileName: 'Tomorrow Records',  profileImage: 'assets/images/artists/harvey-davis-profile.png',   homePath: 'manager/index.html',  stage: 'label'   },
        sponsor:  { label: 'Brand Stage',     profileName: 'Coca-Cola DK',      profileImage: 'assets/images/artists/winston-sinclair-profile.png', homePath: 'sponsor/index.html',  stage: 'brand'   },
        licensor: { label: 'Filming Stage',   profileName: 'Nordisk Film',      profileImage: 'assets/images/artists/emily-rose-parker-profile.png', homePath: 'licensor/index.html', stage: 'filming' },
        ar:       { label: 'A&R',             profileName: 'Victoria Larsen',   profileImage: 'assets/images/artists/placeholder-female-5.png',     homePath: 'ar/index.html' },
        educator: { label: 'Educator',        profileName: 'Lasse Søndergård',  profileImage: 'assets/images/artists/placeholder-male-2.png',       homePath: 'educator/index.html' }
    };
    const ORDER = ['artist', 'fan', 'venue', 'manager', 'sponsor', 'licensor', 'ar', 'educator'];
    const STORAGE_KEY = 'stagecord:userMode';

    function getCurrentMode() {
        const saved = localStorage.getItem(STORAGE_KEY);
        return MODES[saved] ? saved : 'artist';
    }

    function setMode(mode) {
        if (!MODES[mode]) return;
        localStorage.setItem(STORAGE_KEY, mode);
        // Acting-as state is exclusive to A&R mode. If we're switching to any
        // other mode, clear it so banners and post-buttons don't linger.
        if (mode !== 'ar') {
            try { localStorage.removeItem('stagecord:actingAs'); } catch (e) { /* ignore */ }
        }
        const home = MODES[mode].homePath;
        if (home) {
            window.location.href = localAsset(home);
        } else {
            window.location.reload();
        }
    }

    function applyModeToProfileName(mode) {
        const name = MODES[mode].profileName;
        document.querySelectorAll('.sidebar-profile .profile-name').forEach(function(el) {
            delete el.dataset.nameFormatted;
            el.textContent = name;
            if (typeof formatNameElement === 'function') formatNameElement(el);
        });
    }

    function applyModeToProfileImage(mode) {
        const src = MODES[mode].profileImage;
        if (!src) return;
        const url = localAsset(src);
        document.querySelectorAll('.sidebar-profile .profile-image').forEach(function(el) {
            el.style.backgroundImage = "url('" + url + "')";
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        });
    }

    // Hide elements based on the current mode. Two attributes are honored:
    //   data-modes="…"      — whitelist; element is shown only if mode is listed
    //   data-hide-modes="…" — blacklist; element is hidden if mode is listed
    // Elements with neither attribute are visible to all. Elements tagged with
    // .requires-pitch-active are also hidden unless the page sets
    // <body data-pitch-active="true">. If the active sidebar nav-item gets
    // hidden, the page redirects to the mode's home page.
    function applyModeRestrictions(mode) {
        let activeNavHidden = false;

        function markHidden(el, hide) {
            el.hidden = hide;
            if (hide && el.classList.contains('nav-item') && el.classList.contains('active')) {
                activeNavHidden = true;
            }
        }

        document.querySelectorAll('[data-modes]').forEach(function(el) {
            const allowed = el.getAttribute('data-modes').split(/\s+/).filter(Boolean);
            markHidden(el, allowed.indexOf(mode) === -1);
        });

        document.querySelectorAll('[data-hide-modes]').forEach(function(el) {
            if (el.hidden) return;  // already hidden by whitelist
            const blocked = el.getAttribute('data-hide-modes').split(/\s+/).filter(Boolean);
            if (blocked.indexOf(mode) !== -1) markHidden(el, true);
        });

        const pitchActive = document.body.dataset.pitchActive === 'true';
        if (!pitchActive) {
            document.querySelectorAll('.requires-pitch-active').forEach(function(el) { el.hidden = true; });
        }

        if (activeNavHidden) {
            const fallback = MODES[mode].homePath || 'artist/index.html';
            window.location.replace(localAsset(fallback));
        }
    }

    const escapeHtml = SC.escapeHtml;

    function renderSwitcher() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar || sidebar.querySelector('.sidebar-mode')) return;

        const current = getCurrentMode();
        const wrapper = document.createElement('div');
        wrapper.className = 'sidebar-mode';
        wrapper.setAttribute('data-help', 'Bruger-mode (midlertidigt prototype-værktøj): Skift mellem profiltyper for at se applikationen som den valgte brugertype.');
        wrapper.innerHTML =
            '<div class="sidebar-mode__label">Viewing as</div>' +
            '<button type="button" class="sidebar-mode__current" aria-haspopup="true" aria-expanded="false">' +
              '<span class="sidebar-mode__name">' + escapeHtml(MODES[current].label) + '</span>' +
              '<span class="sidebar-mode__chevron" aria-hidden="true">▾</span>' +
            '</button>' +
            '<ul class="sidebar-mode__menu" hidden>' +
              ORDER.map(function(key) {
                  const stubbed = !MODES[key].homePath;
                  return '<li><button type="button" data-mode="' + key + '"' +
                         (key === current ? ' class="is-active"' : '') + '>' +
                         escapeHtml(MODES[key].label) +
                         (stubbed ? '<span class="sidebar-mode__stub">stub</span>' : '') +
                         '</button></li>';
              }).join('') +
            '</ul>';
        sidebar.appendChild(wrapper);

        const btn = wrapper.querySelector('.sidebar-mode__current');
        const menu = wrapper.querySelector('.sidebar-mode__menu');
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const open = menu.hidden;
            menu.hidden = !open;
            btn.setAttribute('aria-expanded', String(open));
        });
        menu.addEventListener('click', function(e) {
            const item = e.target.closest('button[data-mode]');
            if (item) setMode(item.dataset.mode);
        });
        document.addEventListener('click', function(e) {
            if (!wrapper.contains(e.target)) {
                menu.hidden = true;
                btn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        renderSwitcher();
        const current = getCurrentMode();
        applyModeToProfileName(current);
        applyModeToProfileImage(current);
        applyModeRestrictions(current);
    });
})();
