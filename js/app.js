// (extracted to js/core.js)

// ============================================================
// ProjectLog — per-project activity log persisted in localStorage.
// Every meaningful action (upload, remove, restore, save, approve,
// rename) is appended as { id, ts, user, action, summary, detail }.
// The Log pill on each project card opens a modal that renders the
// feed. New actions stream into the open modal automatically.
// ============================================================
window.ProjectLog = (function() {
    const STORAGE_PREFIX = 'stagecord_pro_log_';
    const SUBSCRIBERS = [];

    // The "current user" doing the action. In a real app this comes from
    // session/auth — for the prototype we hardcode a team member so demo
    // entries from various people coexist with new ones the user creates.
    const CURRENT_USER = { id: 'jeremy-freedom', name: 'Jeremy Freedom' };

    function key(projectId) { return STORAGE_PREFIX + projectId; }

    function read(projectId) {
        try {
            const raw = localStorage.getItem(key(projectId));
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function write(projectId, entries) {
        try { localStorage.setItem(key(projectId), JSON.stringify(entries)); } catch (e) {}
    }

    function notify(projectId) {
        SUBSCRIBERS.forEach(function(fn) {
            try { fn(projectId); } catch (e) {}
        });
    }

    function log(projectId, opts) {
        if (!projectId || !opts) return;
        const entries = read(projectId);
        const entry = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            ts: Date.now(),
            user: opts.user || CURRENT_USER,
            action: opts.action || 'upload',
            summary: opts.summary || '',
            detail: opts.detail || ''
        };
        entries.unshift(entry);
        write(projectId, entries);
        notify(projectId);
    }

    function getEntries(projectId) { return read(projectId); }

    function getMembers(projectId) {
        // Unique list of users who have appeared in the log so far —
        // used to populate the filter pills in the modal.
        const seen = {};
        const out = [];
        read(projectId).forEach(function(e) {
            if (e.user && !seen[e.user.id]) {
                seen[e.user.id] = true;
                out.push(e.user);
            }
        });
        return out;
    }

    function subscribe(fn) { SUBSCRIBERS.push(fn); }

    // Pre-seed demo entries on first run for each project so the Log
    // modal isn't empty when a user opens it on a fresh prototype.
    function seedIfEmpty(projectId, demoEntries) {
        if (read(projectId).length) return;
        const now = Date.now();
        const entries = demoEntries.map(function(e, idx) {
            return {
                id: 'seed_' + projectId + '_' + idx,
                ts: now - (e.daysAgo * 86400000) - ((e.hoursAgo || 0) * 3600000),
                user: e.user,
                action: e.action,
                summary: e.summary,
                detail: e.detail || ''
            };
        });
        // Newest first
        entries.sort(function(a, b) { return b.ts - a.ts; });
        write(projectId, entries);
    }

    function currentUser() { return CURRENT_USER; }

    return {
        log: log,
        getEntries: getEntries,
        getMembers: getMembers,
        subscribe: subscribe,
        seedIfEmpty: seedIfEmpty,
        currentUser: currentUser
    };
})();

// Seed the Eternaty project with realistic demo activity so the Log modal
// has something to show on first open.
(function() {
    const eternatyMembers = [
        { id: 'jeremy-freedom',   name: 'Jeremy Freedom' },
        { id: 'malik-johnson',    name: 'Malik Johnson' },
        { id: 'maya-thompson',    name: 'Maya Thompson' },
        { id: 'winston-sinclair', name: 'Winston Sinclair' }
    ];
    window.ProjectLog.seedIfEmpty('eternaty', [
        { user: eternatyMembers[0], action: 'rename',  summary: 'Renamed project to <strong>Eternaty</strong>',     daysAgo: 18, hoursAgo: 3 },
        { user: eternatyMembers[2], action: 'upload',  summary: 'Uploaded lyrics draft',                            detail: 'eternaty_lyrics_v1.txt · 4 KB',         daysAgo: 16 },
        { user: eternatyMembers[0], action: 'upload',  summary: 'Uploaded WAVE stem · <strong>Lead vocal</strong>', detail: 'eternaty_lead_vox_v1.wav · 38.2 MB',    daysAgo: 14 },
        { user: eternatyMembers[1], action: 'upload',  summary: 'Uploaded WAVE stem · <strong>Drums (full kit)</strong>', detail: 'eternaty_drums_v1.wav · 47.6 MB',  daysAgo: 12 },
        { user: eternatyMembers[3], action: 'upload',  summary: 'Uploaded WAVE master mix',                         detail: 'eternaty_master_v1.wav · 52.1 MB',      daysAgo: 9  },
        { user: eternatyMembers[3], action: 'remove',  summary: 'Removed WAVE master mix',                          detail: 'eternaty_master_v1.wav',                daysAgo: 8  },
        { user: eternatyMembers[3], action: 'upload',  summary: 'Uploaded WAVE master mix',                         detail: 'eternaty_master_v2.wav · 53.8 MB',      daysAgo: 8, hoursAgo: -2 },
        { user: eternatyMembers[2], action: 'upload',  summary: 'Uploaded WAVE stem · <strong>Backing vocals</strong>', detail: 'eternaty_bgv_v1.wav · 22.4 MB',      daysAgo: 6 },
        { user: eternatyMembers[0], action: 'approve', summary: 'Approved release candidate',                       daysAgo: 4 },
        { user: eternatyMembers[1], action: 'restore', summary: 'Restored older version of <strong>Drums</strong>', detail: 'rolled back to eternaty_drums_v1.wav',  daysAgo: 2  },
        { user: eternatyMembers[3], action: 'save',    summary: 'Saved WAVE upload session',                        detail: '4 stems + master mix on file',          daysAgo: 1, hoursAgo: 5 }
    ]);
})();

// (extracted to js/sidebar.js)

document.addEventListener('DOMContentLoaded', function() {
    console.log('STAGECORD PRO initialized');

    // Format all existing STAGECORD text and names in the page
    formatStagecord(document.body);
    formatAllNames(document.body);
    linkifyMentionsAndTags(document.body);

    // Click handlers — @mention or #hashtag → fill the search input + show suggestions
    document.addEventListener('click', function(e) {
        const mention = e.target.closest('.mention');
        if (mention) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            // Convert CamelCase mention back to spaced name (Maya Thompson)
            const raw = (mention.dataset.mention || '').replace(/([a-z])([A-Z])/g, '$1 $2');
            const input = document.querySelector('.search-input');
            if (input) {
                input.focus();
                input.value = raw;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
            return;
        }
        const tag = e.target.closest('.hashtag');
        if (tag) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            const term = tag.dataset.hashtag || '';
            const input = document.querySelector('.search-input');
            if (input) {
                input.focus();
                input.value = '#' + term;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
            return;
        }
    });

    // -------------------- SUGGESTED FOR YOU — recommended artists carousel --------------------
    // Renders into #suggestGrid on the Overview page. Reuses the
    // stagecord_following localStorage so follow-state stays consistent
    // with the hover profile cards.
    function picAvatar(seed) {
        const POOL = ['placeholder-female-1.png','placeholder-female-2.png','placeholder-female-3.png','placeholder-female-4.png','placeholder-female-5.png','placeholder-female-6.png','placeholder-male-1.png','placeholder-male-2.png','placeholder-male-3.png','placeholder-male-4.png','placeholder-male-5.png','placeholder-male-6.png','placeholder-male-7.png'];
        let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
        return "url('" + localAsset('assets/images/artists/' + POOL[h % POOL.length]) + "') center/cover";
    }
    const SUGGEST_LIST = [
        { name: 'Maya Thompson',   role: 'Topliner',          reason: 'Co-writes with @JokesmithJohnson',     avatar: "url('" + localAsset('assets/images/artists/maya-thompson-profile.png') + "') center/cover",  followers: '328K' },
        { name: 'Liva Mai',        role: 'Dancer',            reason: 'Same creator-roles as you',            avatar: picAvatar('liva-mai'),       followers: '412K' },
        { name: 'DJ Frostbite',    role: 'Producer',          reason: 'Popular with fans of @DJFrostbite',    avatar: picAvatar('dj-frostbite'),   followers: '142K' },
        { name: 'Lars Vognsen',    role: 'Mixing engineer',   reason: 'Worked on tracks you saved',           avatar: picAvatar('lars-vognsen'),   followers: '64K' },
        { name: 'Sara Holm',       role: 'Podcaster',         reason: 'Trending in your area',                avatar: picAvatar('sara-holm'),      followers: '88K' },
        { name: 'Camilla Step',    role: 'Choreographer',     reason: 'Followed by @LivaMai',                 avatar: picAvatar('camilla-step'),   followers: '128K' },
        { name: 'Tobias Krogh',    role: 'Guitarist',         reason: 'Featured on tracks you streamed',      avatar: picAvatar('tobias-krogh'),   followers: '42K' },
        { name: 'Anchi Humifuku',  role: 'Vocalist',          reason: '5 mutual collaborators',               avatar: picAvatar('anchi-humifuku'), followers: '482K' }
    ];

    const suggestGrid = document.getElementById('suggestGrid');
    if (suggestGrid) {
        let following = {};
        try { following = JSON.parse(localStorage.getItem('stagecord_following') || '{}'); }
        catch (e) { following = {}; }

        function renderSuggestCard(p) {
            const isFollowing = !!following[p.name.toLowerCase()];
            const verified = (typeof isVerifiedName === 'function' && isVerifiedName(p.name));
            const verifiedHtml = verified
                ? '<span class="verified-badge" aria-label="Verified" title="Verified artist"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 10 17 19 7"/></svg></span>'
                : '';
            return '' +
                '<article class="suggest-card" data-suggest-name="' + p.name + '">' +
                    '<div class="suggest-card__avatar" style="background: ' + p.avatar + '"></div>' +
                    '<div class="suggest-card__name">' + p.name + verifiedHtml + '</div>' +
                    '<div class="suggest-card__role">' + p.role + '</div>' +
                    '<div class="suggest-card__reason">' + p.reason + '</div>' +
                    '<div class="suggest-card__followers">' + p.followers + ' <small>followers</small></div>' +
                    '<button type="button" class="suggest-card__follow' + (isFollowing ? ' is-following' : '') + '" data-suggest-follow="' + p.name + '">' +
                        (isFollowing ? 'Following ✓' : 'Follow') +
                    '</button>' +
                '</article>';
        }

        suggestGrid.innerHTML = SUGGEST_LIST.map(renderSuggestCard).join('');
        if (typeof formatAllNames === 'function') formatAllNames(suggestGrid);

        suggestGrid.addEventListener('click', function(e) {
            const btn = e.target.closest('[data-suggest-follow]');
            if (!btn) return;
            if (typeof helpActive !== 'undefined' && helpActive) return;
            const name = btn.dataset.suggestFollow;
            const key = name.toLowerCase();
            const wasFollowing = !!following[key];
            if (wasFollowing) delete following[key];
            else following[key] = { since: new Date().toISOString() };
            try { localStorage.setItem('stagecord_following', JSON.stringify(following)); }
            catch (err) {}
            btn.classList.toggle('is-following', !wasFollowing);
            btn.textContent = wasFollowing ? 'Follow' : 'Following ✓';
            if (typeof showToast === 'function') {
                showToast(wasFollowing ? 'Unfollowed ' + name : 'Now following ' + name);
            }
        });
    }

    // -------------------- HOVER PROFILE PREVIEW — mini-card on name hover --------------------
    // Standalone profile registry (search-bar setup is later in the same
    // closure, so referencing SEARCH_SUGGESTIONS here would TDZ).
    const HOVER_PROFILES = [
        { name: 'JokesmithJohnson', meta: 'Artist · Aarhus',           avatar: "url('" + localAsset('assets/images/artists/jokesmith-johnson-cover.png') + "') center/cover", roles: ['Comedian', 'Musician', 'Songwriter'], url: 'artist/index.html',    followers: '1.4M' },
        { name: 'Jokesmith Johnson',meta: 'Artist · Aarhus',           avatar: "url('" + localAsset('assets/images/artists/jokesmith-johnson-cover.png') + "') center/cover", roles: ['Comedian', 'Musician', 'Songwriter'], url: 'artist/index.html',    followers: '1.4M' },
        { name: 'Anchi Humifuku',   meta: 'Artist · NYC',              avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover", roles: ['Topliner', 'Songwriter', 'Vocalist'], url: 'fan/martin/index.html', followers: '482K' },
        { name: 'Maya Thompson',    meta: 'Artist · LA',               avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover", roles: ['Topliner', 'Producer'],               url: 'fan/martin/index.html', followers: '328K' },
        { name: 'Lars Vognsen',     meta: 'Artist · Copenhagen',       avatar: "url('" + localAsset('assets/images/artists/placeholder-male-3.png') + "') center/cover", roles: ['Producer', 'Mixing engineer'],        url: 'fan/martin/index.html', followers: '64K'  },
        { name: 'DJ Frostbite',     meta: 'Artist · Aalborg',          avatar: "url('" + localAsset('assets/images/artists/placeholder-male-1.png') + "') center/cover", roles: ['DJ', 'Producer'],                     url: 'fan/martin/index.html', followers: '142K' },
        { name: 'Sara Holm',        meta: 'Artist · Aarhus',           avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover", roles: ['Podcaster', 'Voice actor'],           url: 'fan/martin/index.html', followers: '88K'  },
        { name: 'Tobias Krogh',     meta: 'Artist · Aarhus',           avatar: "url('" + localAsset('assets/images/artists/placeholder-male-6.png') + "') center/cover", roles: ['Guitarist', 'Bassist'],               url: 'fan/martin/index.html', followers: '42K'  },
        { name: 'Frederik Holm',    meta: 'Artist · Aarhus',           avatar: "url('" + localAsset('assets/images/artists/placeholder-male-4.png') + "') center/cover", roles: ['Drummer', 'Pianist / Keyboardist'],   url: 'fan/martin/index.html', followers: '76K'  },
        { name: 'Emilie Bach',      meta: 'Artist · Copenhagen',       avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover", roles: ['Mastering engineer'],                 url: 'fan/martin/index.html', followers: '38K'  },
        { name: 'Liva Mai',         meta: 'Fan creator · Aarhus',      avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover", roles: ['Dancer', 'Content creator'],          url: 'fan/martin/index.html', followers: '412K' },
        { name: 'Anders Vlog',      meta: 'Fan creator · Copenhagen',  avatar: "url('" + localAsset('assets/images/artists/placeholder-male-2.png') + "') center/cover", roles: ['Content creator', 'Streamer'],        url: 'fan/martin/index.html', followers: '89K'  },
        { name: 'Camilla Step',     meta: 'Fan creator · Aalborg',     avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover", roles: ['Dancer', 'Choreographer'],            url: 'fan/martin/index.html', followers: '128K' },
        { name: 'Julie Andersen',   meta: 'Fan creator · Brooklyn',    avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover", roles: ['Dancer', 'Content creator'],          url: 'fan/index.html',        followers: '52,847' },
        { name: 'Martin Ruthkjær',  meta: 'Fan · Copenhagen',          avatar: "url('" + localAsset('assets/images/artists/placeholder-male-7.png') + "') center/cover", roles: ['Concertgoer'],                        url: 'fan/martin/index.html', followers: '874' },
        { name: 'Line Rasmussen',   meta: 'Fan · Aarhus',              avatar: "url('" + localAsset('assets/images/artists/placeholder-female-5.png') + "') center/cover", roles: ['Concertgoer'],                        url: 'fan/martin/index.html', followers: '218' },
        { name: 'Matt Samuel',      meta: 'Fan · Copenhagen',          avatar: "url('" + localAsset('assets/images/artists/placeholder-male-5.png') + "') center/cover", roles: ['Concertgoer'],                        url: 'fan/martin/index.html', followers: '142' },
        { name: 'Joakim Nielsen',   meta: 'Fan · Brooklyn',            avatar: "url('" + localAsset('assets/images/artists/placeholder-male-3.png') + "') center/cover", roles: ['Concertgoer'],                        url: 'fan/martin/index.html', followers: '96'  }
    ];
    const PROFILE_LOOKUP = {};
    HOVER_PROFILES.forEach(function(p) { PROFILE_LOOKUP[p.name.toLowerCase()] = p; });

    function lookupProfile(rawText) {
        if (!rawText) return null;
        // Strip @ prefix and badges; convert CamelCase mentions to spaced names
        let cleaned = rawText.replace(/[\u2713\u2714✓]/g, '').trim();
        cleaned = cleaned.replace(/^@/, '');
        // CamelCase → "Camel Case" only when no space already exists
        if (cleaned.indexOf(' ') === -1) {
            cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
        }
        const profile = PROFILE_LOOKUP[cleaned.toLowerCase()];
        return profile || null;
    }

    let hoverCard = null;
    let hoverHideTimer = null;
    let hoverFollowing = {};
    try { hoverFollowing = JSON.parse(localStorage.getItem('stagecord_following') || '{}'); }
    catch (e) { hoverFollowing = {}; }

    function ensureHoverCard() {
        if (hoverCard) return hoverCard;
        hoverCard = document.createElement('div');
        hoverCard.className = 'profile-hover-card';
        document.body.appendChild(hoverCard);
        hoverCard.addEventListener('mouseenter', function() { clearTimeout(hoverHideTimer); });
        hoverCard.addEventListener('mouseleave', function() { scheduleHoverHide(); });
        return hoverCard;
    }

    function buildHoverCardHtml(profile) {
        const verified = (typeof isVerifiedName === 'function' && isVerifiedName(profile.name));
        const verifiedHtml = verified
            ? '<span class="verified-badge" aria-label="Verified" title="Verified artist on STAGECORD"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 10 17 19 7"/></svg></span>'
            : '';
        const meta = profile.meta || '';
        const followers = profile.followers || '—';
        const isFollowing = !!hoverFollowing[profile.name.toLowerCase()];
        const role = (profile.roles && profile.roles[0]) || meta.split('·')[0].trim() || '—';
        return '' +
            '<div class="profile-hover-card__top">' +
                '<span class="profile-hover-card__avatar" style="background: ' + profile.avatar + '"></span>' +
                '<div class="profile-hover-card__main">' +
                    '<div class="profile-hover-card__name">' + profile.name + verifiedHtml + '</div>' +
                    '<div class="profile-hover-card__meta">' + meta + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="profile-hover-card__stats">' +
                '<div class="profile-hover-card__stat">' +
                    '<span class="profile-hover-card__stat-value">' + followers + '</span>' +
                    '<span class="profile-hover-card__stat-label">Followers</span>' +
                '</div>' +
                '<div class="profile-hover-card__stat">' +
                    '<span class="profile-hover-card__stat-value">' + role + '</span>' +
                    '<span class="profile-hover-card__stat-label">Primary role</span>' +
                '</div>' +
            '</div>' +
            '<button type="button" class="profile-hover-card__cta' + (isFollowing ? ' is-following' : '') + '" data-hover-follow="' + profile.name + '">' +
                (isFollowing ? '<span class="profile-hover-card__cta-default"></span>' : 'Follow') +
            '</button>';
    }

    function showHoverCard(target, profile) {
        const card = ensureHoverCard();
        clearTimeout(hoverHideTimer);
        card.innerHTML = buildHoverCardHtml(profile);
        card.dataset.profileUrl = profile.url || '';
        // Position below the target
        const rect = target.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const w = 280;
        let left = rect.left + scrollX;
        if (left + w > scrollX + window.innerWidth - 12) left = scrollX + window.innerWidth - w - 12;
        if (left < scrollX + 12) left = scrollX + 12;
        let top = rect.bottom + scrollY + 6;
        const cardH = card.offsetHeight || 220;
        if (top + cardH > scrollY + window.innerHeight - 12) {
            top = rect.top + scrollY - cardH - 6;
        }
        card.style.left = left + 'px';
        card.style.top = top + 'px';
        card.classList.add('is-visible');
    }

    function scheduleHoverHide() {
        clearTimeout(hoverHideTimer);
        hoverHideTimer = setTimeout(function() {
            if (hoverCard) hoverCard.classList.remove('is-visible');
        }, 250);
    }

    const HOVER_SELECTORS = '.mention, .auto-name, .artist-post__author';

    document.body.addEventListener('mouseover', function(e) {
        const trigger = e.target.closest(HOVER_SELECTORS);
        if (!trigger) return;
        // Skip if hover card already showing for the same trigger
        if (trigger === hoverCard) return;
        const text = trigger.dataset.mention || trigger.textContent;
        const profile = lookupProfile(text);
        if (!profile) return;
        clearTimeout(hoverHideTimer);
        showHoverCard(trigger, profile);
    });

    document.body.addEventListener('mouseout', function(e) {
        const trigger = e.target.closest(HOVER_SELECTORS);
        if (!trigger) return;
        // If we're moving into the hover card itself, don't hide
        if (e.relatedTarget && hoverCard && hoverCard.contains(e.relatedTarget)) return;
        scheduleHoverHide();
    });

    // Click on Follow CTA inside the card
    document.addEventListener('click', function(e) {
        if (!hoverCard) return;
        const btn = e.target.closest('[data-hover-follow]');
        if (!btn || !hoverCard.contains(btn)) return;
        e.preventDefault();
        e.stopPropagation();
        const name = btn.dataset.hoverFollow;
        const key = name.toLowerCase();
        const wasFollowing = !!hoverFollowing[key];
        if (wasFollowing) delete hoverFollowing[key];
        else hoverFollowing[key] = { since: new Date().toISOString() };
        try { localStorage.setItem('stagecord_following', JSON.stringify(hoverFollowing)); }
        catch (err) {}
        btn.classList.toggle('is-following', !wasFollowing);
        btn.innerHTML = wasFollowing ? 'Follow' : '<span class="profile-hover-card__cta-default"></span>';
        if (typeof showToast === 'function') {
            showToast(wasFollowing ? 'Unfollowed ' + name : 'Now following ' + name);
        }
    });

    // -------------------- EVENT RSVP — Going / Maybe / Not going + social proof --------------------
    // Injects an RSVP segment + friend-attendance count into every
    // .cal-event card on the calendar page. State persists in
    // localStorage; the friend count auto-increments when the current
    // user RSVPs going (or decrements when switching away from going).
    function getRsvpStore() {
        try { return JSON.parse(localStorage.getItem('stagecord_rsvp') || '{}'); }
        catch (e) { return {}; }
    }
    function saveRsvpStore(store) {
        try { localStorage.setItem('stagecord_rsvp', JSON.stringify(store)); }
        catch (e) { /* fail quietly */ }
    }

    // Mock friend avatar gradients used to populate social proof stacks
        const RSVP_AVATAR_PALETTE = [
        "url('" + localAsset('assets/images/artists/placeholder-male-3.png') + "') center/cover",
        "url('" + localAsset('assets/images/artists/placeholder-male-2.png') + "') center/cover",
        "url('" + localAsset('assets/images/artists/placeholder-male-2.png') + "') center/cover",
        "url('" + localAsset('assets/images/artists/placeholder-male-3.png') + "') center/cover",
        "url('" + localAsset('assets/images/artists/placeholder-male-3.png') + "') center/cover",
        "url('" + localAsset('assets/images/artists/placeholder-female-2.png') + "') center/cover",
        "url('" + localAsset('assets/images/artists/placeholder-female-2.png') + "') center/cover"
    ];

    function buildRsvpEventId(eventEl) {
        const titleEl = eventEl.querySelector('.cal-event__title');
        const dayEl = eventEl.querySelector('.cal-event__day');
        const monthEl = eventEl.querySelector('.cal-event__month');
        const slug = ((titleEl ? titleEl.textContent : '') + '-' + (dayEl ? dayEl.textContent : '') + '-' + (monthEl ? monthEl.textContent : ''))
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
        return slug || ('event-' + Math.random().toString(36).slice(2, 8));
    }

    function injectRsvpInto(eventEl) {
        if (!eventEl || eventEl.querySelector(':scope > .rsvp')) return;
        const id = buildRsvpEventId(eventEl);
        eventEl.dataset.rsvpId = id;

        // Mock baseline friend count — derive deterministically from id length
        const baseline = 4 + (id.length % 11);

        const rsvp = document.createElement('div');
        rsvp.className = 'rsvp';
        rsvp.innerHTML =
            '<button type="button" class="rsvp__btn" data-rsvp="going" data-help="Going: Du tilkendegiver at du deltager. Du tæller med i social proof for andre, og får automatisk en kalender-reminder dagen før.">Going</button>' +
            '<button type="button" class="rsvp__btn" data-rsvp="maybe" data-help="Maybe: Du er måske interesseret. Du får ikke automatisk reminder, men eventet gemmes på din watchlist.">Maybe</button>' +
            '<button type="button" class="rsvp__btn" data-rsvp="not" data-help="Not going: Du afviser eventet — det skjules fra dine forslag fremover.">Not going</button>';

        // Build social proof avatars + counter
        const proof = document.createElement('div');
        proof.className = 'rsvp-proof';
        const avatarsHtml = RSVP_AVATAR_PALETTE.slice(0, 4).map(function(bg) {
            return '<span class="rsvp-proof__avatar" style="background:' + bg + '"></span>';
        }).join('');
        proof.innerHTML =
            '<span class="rsvp-proof__avatars">' + avatarsHtml + '</span>' +
            '<span class="rsvp-proof__count" data-rsvp-proof><strong data-rsvp-count>' + baseline + '</strong> friends going</span>';

        eventEl.appendChild(rsvp);
        eventEl.appendChild(proof);

        // Restore state if previously RSVP'd
        const store = getRsvpStore();
        const saved = store[id];
        if (saved) {
            const btn = rsvp.querySelector('[data-rsvp="' + saved + '"]');
            if (btn) btn.classList.add('is-selected');
            // Adjust count if user said "going"
            if (saved === 'going') {
                const countEl = proof.querySelector('[data-rsvp-count]');
                if (countEl) countEl.textContent = String(baseline + 1);
            }
        }
    }

    function applyRsvpToAll() {
        document.querySelectorAll('.cal-event').forEach(injectRsvpInto);
    }

    applyRsvpToAll();

    // Watch for dynamically added events (calendar prev/next, day filter)
    const upcomingContainer = document.querySelector('.cal-events__title') &&
                              document.querySelector('.cal-events__title').parentElement;
    if (upcomingContainer && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(function() { applyRsvpToAll(); });
        observer.observe(upcomingContainer, { childList: true });
    }

    // Click → toggle RSVP state
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.rsvp__btn');
        if (!btn) return;
        if (typeof helpActive !== 'undefined' && helpActive) return;
        const rsvpRow = btn.closest('.rsvp');
        const eventEl = btn.closest('.cal-event');
        if (!rsvpRow || !eventEl) return;
        const id = eventEl.dataset.rsvpId;
        const choice = btn.dataset.rsvp;
        const store = getRsvpStore();
        const previous = store[id];

        // Toggle off if same button is clicked again
        const isToggleOff = (previous === choice);
        const newChoice = isToggleOff ? null : choice;
        if (newChoice) store[id] = newChoice;
        else delete store[id];
        saveRsvpStore(store);

        // Update visual state
        rsvpRow.querySelectorAll('.rsvp__btn').forEach(function(b) {
            b.classList.toggle('is-selected', !isToggleOff && b.dataset.rsvp === choice);
        });

        // Update social proof count
        const countEl = eventEl.querySelector('[data-rsvp-count]');
        if (countEl) {
            const current = parseInt(countEl.textContent, 10) || 0;
            const wasGoing = (previous === 'going');
            const nowGoing = (newChoice === 'going');
            if (!wasGoing && nowGoing) countEl.textContent = String(current + 1);
            else if (wasGoing && !nowGoing) countEl.textContent = String(Math.max(0, current - 1));
        }

        if (typeof showToast === 'function') {
            if (newChoice === 'going')      showToast('You\u2019re going ✓');
            else if (newChoice === 'maybe') showToast('Marked as maybe');
            else if (newChoice === 'not')   showToast('Marked as not going');
            else                            showToast('RSVP cleared');
        }
    });

    // -------------------- PHOTO LIGHTBOX — click any photo to view full-screen --------------------
    const PHOTO_SELECTORS = [
        '.photo-tile',
        '.fan-photo-tile',
        '.artist-photo-tile',
        '.event-photo__image',
        '.artist-post__image',
        '.artist-cover-card__thumb'
    ];

    function extractBg(el) {
        // Inline style takes priority (gradient placeholders or url(...))
        const inline = el.getAttribute('style');
        if (inline) {
            const match = inline.match(/background(?:-image)?:\s*([^;]+)/i);
            if (match) return match[1].trim();
        }
        const computed = window.getComputedStyle(el).backgroundImage;
        if (computed && computed !== 'none') return computed;
        const cBg = window.getComputedStyle(el).background;
        return cBg || '';
    }

    function buildLightbox() {
        if (document.getElementById('lightbox')) return document.getElementById('lightbox');
        const lb = document.createElement('div');
        lb.className = 'lightbox';
        lb.id = 'lightbox';
        lb.innerHTML =
            '<button type="button" class="lightbox__close" data-lightbox-close aria-label="Close">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
            '</button>' +
            '<button type="button" class="lightbox__nav lightbox__nav--prev" data-lightbox-prev aria-label="Previous">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
            '</button>' +
            '<button type="button" class="lightbox__nav lightbox__nav--next" data-lightbox-next aria-label="Next">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
            '</button>' +
            '<div class="lightbox__stage" data-lightbox-stage></div>' +
            '<span class="lightbox__counter" data-lightbox-counter></span>';
        document.body.appendChild(lb);
        return lb;
    }

    let lbGroup = [];
    let lbIndex = 0;

    function lightboxRender() {
        const lb = document.getElementById('lightbox');
        if (!lb) return;
        const stage = lb.querySelector('[data-lightbox-stage]');
        const counter = lb.querySelector('[data-lightbox-counter]');
        const prevBtn = lb.querySelector('[data-lightbox-prev]');
        const nextBtn = lb.querySelector('[data-lightbox-next]');
        const bg = lbGroup[lbIndex] || '';
        // Apply background — gradient or url(...) — both render via background shorthand
        stage.style.background = '#000 ' + bg;
        stage.style.backgroundSize = 'cover';
        stage.style.backgroundPosition = 'center';
        stage.style.backgroundRepeat = 'no-repeat';
        counter.textContent = (lbIndex + 1) + ' / ' + lbGroup.length;
        const single = lbGroup.length <= 1;
        if (prevBtn) prevBtn.hidden = single;
        if (nextBtn) nextBtn.hidden = single;
        if (counter) counter.style.visibility = single ? 'hidden' : 'visible';
    }

    function lightboxOpen(group, idx) {
        const lb = buildLightbox();
        lbGroup = group;
        lbIndex = idx || 0;
        lightboxRender();
        lb.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function lightboxClose() {
        const lb = document.getElementById('lightbox');
        if (!lb) return;
        lb.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    function lightboxNext() { lbIndex = (lbIndex + 1) % lbGroup.length; lightboxRender(); }
    function lightboxPrev() { lbIndex = (lbIndex - 1 + lbGroup.length) % lbGroup.length; lightboxRender(); }

    document.addEventListener('click', function(e) {
        if (typeof helpActive !== 'undefined' && helpActive) return;
        // Close + navigation buttons inside lightbox
        const lbEl = document.getElementById('lightbox');
        if (lbEl && lbEl.classList.contains('is-open')) {
            if (e.target.closest('[data-lightbox-close]')) { lightboxClose(); return; }
            if (e.target.closest('[data-lightbox-prev]')) { lightboxPrev(); return; }
            if (e.target.closest('[data-lightbox-next]')) { lightboxNext(); return; }
            // Click on backdrop (not on the stage or buttons) closes
            if (e.target === lbEl) { lightboxClose(); return; }
        }
        // Open lightbox on photo click
        const photo = e.target.closest(PHOTO_SELECTORS.join(','));
        if (!photo) return;
        // Don't trigger if click was on a nested control (e.g., like button on event-photo)
        if (e.target.closest('button') && !e.target.closest('button').classList.contains('artist-post__like')) {
            // Only block when the nested button isn't part of a non-photo overlay
        }
        if (e.target.closest('.event-photo__like')) return;
        e.preventDefault();
        // Find sibling group of the same selector inside the same parent
        const matched = PHOTO_SELECTORS.find(function(sel) { return photo.matches(sel); });
        const parent = photo.parentElement;
        const siblings = matched && parent ? Array.from(parent.querySelectorAll(matched)) : [photo];
        const styles = siblings.map(extractBg).filter(function(s) { return s; });
        const idx = Math.max(0, siblings.indexOf(photo));
        lightboxOpen(styles, idx);
    });

    document.addEventListener('keydown', function(e) {
        const lb = document.getElementById('lightbox');
        if (!lb || !lb.classList.contains('is-open')) return;
        if (e.key === 'Escape') lightboxClose();
        else if (e.key === 'ArrowRight') lightboxNext();
        else if (e.key === 'ArrowLeft') lightboxPrev();
    });

    // -------------------- BLOCK / MUTE / REPORT — profile-level safety actions --------------------
    // Profile kebab opens a small dropdown (Mute / Block / Report). Each
    // action confirms via a shared modal that adapts its copy + reason
    // picker. State is persisted in localStorage so the same user is hidden
    // / muted / flagged the next time you visit the platform.
    function getModerationStore() {
        try { return JSON.parse(localStorage.getItem('stagecord_moderation') || '{}'); }
        catch (e) { return {}; }
    }
    function saveModerationStore(store) {
        try { localStorage.setItem('stagecord_moderation', JSON.stringify(store)); }
        catch (e) { /* fail quietly */ }
    }

    const reportModal = document.getElementById('reportModal');
    let activeProfileMenu = null;
    let activeKebabBtn = null;

    function closeProfileMenu() {
        if (activeProfileMenu) activeProfileMenu.remove();
        activeProfileMenu = null;
        if (activeKebabBtn) activeKebabBtn.classList.remove('is-active');
        activeKebabBtn = null;
    }

    function buildProfileMenu(name) {
        const menu = document.createElement('div');
        menu.className = 'profile-menu';
        menu.innerHTML =
            '<button type="button" class="profile-menu__btn" data-profile-action="mute">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>' +
                '<span data-profile-mute-label>Mute ' + name + '</span>' +
            '</button>' +
            '<button type="button" class="profile-menu__btn" data-profile-action="block">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>' +
                '<span>Block ' + name + '</span>' +
            '</button>' +
            '<div class="profile-menu__divider"></div>' +
            '<button type="button" class="profile-menu__btn profile-menu__btn--danger" data-profile-action="report">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V4l7 4 9-3v9l-9 3-7-4z"/></svg>' +
                'Report ' + name +
            '</button>';
        return menu;
    }

    function openProfileMenu(btn) {
        const name = btn.dataset.profileName || 'this profile';
        const menu = buildProfileMenu(name);
        document.body.appendChild(menu);
        const rect = btn.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const menuW = menu.offsetWidth;
        let top = rect.bottom + scrollY + 6;
        let left = rect.right + scrollX - menuW;
        if (left < scrollX + 8) left = scrollX + 8;
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
        btn.classList.add('is-active');
        activeProfileMenu = menu;
        activeKebabBtn = btn;
    }

    document.querySelectorAll('[data-profile-kebab]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.stopPropagation();
            if (activeKebabBtn === btn) { closeProfileMenu(); return; }
            closeProfileMenu();
            openProfileMenu(btn);
        });
    });

    // Modal flow — open/configure/confirm. State stored on the modal's
    // dataset so the click handler that opens it does not need a shared
    // closure.
    if (reportModal) {
        const titleEl   = document.getElementById('reportModalTitle');
        const introEl   = document.getElementById('reportModalIntro');
        const reasonsEl = document.getElementById('reportModalReasons');
        const commentEl = document.getElementById('reportModalComment');
        const confirmEl = document.getElementById('reportConfirmBtn');

        function openReportModal(action, name) {
            const safeName = name || 'this user';
            reportModal.dataset.action = action;
            reportModal.dataset.targetName = safeName;
            reasonsEl.hidden = (action !== 'report');
            commentEl.hidden = (action !== 'report');
            commentEl.value = '';
            reasonsEl.querySelectorAll('input').forEach(function(r) { r.checked = false; });

            if (action === 'mute') {
                titleEl.textContent = 'Mute ' + safeName;
                introEl.textContent = 'You won\u2019t see content or messages from ' + safeName + ' anywhere on the platform. ' + safeName + ' won\u2019t be notified — you can unmute later from your privacy settings.';
                confirmEl.textContent = 'Mute';
            } else if (action === 'block') {
                titleEl.textContent = 'Block ' + safeName;
                introEl.textContent = 'Blocking removes any existing connection (friend or follower) between you. ' + safeName + ' won\u2019t be able to find your profile, message you, or see your content. This can be reversed from your privacy settings.';
                confirmEl.textContent = 'Block';
            } else {
                titleEl.textContent = 'Report ' + safeName;
                introEl.textContent = 'Send this profile to STAGECORD\u2019s moderation team. Pick the reason that fits best — they review reports within 24 hours.';
                confirmEl.textContent = 'Submit report';
            }
            reportModal.classList.add('open');
            reportModal.setAttribute('aria-hidden', 'false');
        }

        function closeReportModal() {
            reportModal.classList.remove('open');
            reportModal.setAttribute('aria-hidden', 'true');
            delete reportModal.dataset.action;
            delete reportModal.dataset.targetName;
        }

        reportModal.addEventListener('click', function(e) {
            if (e.target === reportModal || e.target.closest('[data-close-report]')) closeReportModal();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && reportModal.classList.contains('open')) closeReportModal();
        });

        confirmEl.addEventListener('click', function() {
            const action = reportModal.dataset.action;
            const name   = reportModal.dataset.targetName;
            if (!action || !name) return;
            const store  = getModerationStore();
            store.muted    = store.muted || [];
            store.blocked  = store.blocked || [];
            store.reports  = store.reports || [];

            if (action === 'mute') {
                if (store.muted.indexOf(name) === -1) store.muted.push(name);
                if (typeof showToast === 'function') showToast(name + ' muted');
            } else if (action === 'block') {
                if (store.blocked.indexOf(name) === -1) store.blocked.push(name);
                if (store.muted.indexOf(name) === -1) store.muted.push(name);
                if (typeof showToast === 'function') showToast(name + ' blocked');
            } else if (action === 'report') {
                const reasonInput = reasonsEl.querySelector('input[name="reportReason"]:checked');
                if (!reasonInput) {
                    reasonsEl.style.borderRadius = '8px';
                    reasonsEl.style.outline = '2px solid #ff4d4d';
                    setTimeout(function() { reasonsEl.style.outline = 'none'; }, 1400);
                    return;
                }
                store.reports.push({
                    target: name,
                    reason: reasonInput.value,
                    note: (commentEl.value || '').trim(),
                    time: new Date().toISOString()
                });
                if (typeof showToast === 'function') showToast('Report sent to moderation');
            }
            saveModerationStore(store);
            closeReportModal();
        });

        // Expose so the kebab click handler can call it
        reportModal._open = openReportModal;
    }

    // Click on a menu action OR outside the open menu
    document.addEventListener('click', function(e) {
        const actionBtn = e.target.closest('[data-profile-action]');
        if (actionBtn && activeProfileMenu && activeProfileMenu.contains(actionBtn)) {
            e.stopPropagation();
            const action = actionBtn.dataset.profileAction;
            const name = activeKebabBtn ? activeKebabBtn.dataset.profileName : 'this user';
            closeProfileMenu();
            if (reportModal && reportModal._open) reportModal._open(action, name);
            return;
        }
        if (activeProfileMenu && !activeProfileMenu.contains(e.target) && (!activeKebabBtn || !activeKebabBtn.contains(e.target))) {
            closeProfileMenu();
        }
    });

    // -------------------- POLLS — vote + live percentage recalc --------------------
    function getPollVotes() {
        try { return JSON.parse(localStorage.getItem('stagecord_polls') || '{}'); }
        catch (e) { return {}; }
    }
    function savePollVotes(store) {
        try { localStorage.setItem('stagecord_polls', JSON.stringify(store)); }
        catch (e) {}
    }

    function refreshPoll(pollEl) {
        const options = pollEl.querySelectorAll('.post-poll__option');
        let total = 0;
        options.forEach(function(opt) { total += parseInt(opt.dataset.votes, 10) || 0; });
        const totalEl = pollEl.querySelector('[data-poll-total]');
        if (totalEl) totalEl.textContent = total;
        options.forEach(function(opt) {
            const v = parseInt(opt.dataset.votes, 10) || 0;
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            const bar = opt.querySelector('.post-poll__bar');
            const pctEl = opt.querySelector('.post-poll__pct');
            if (bar) bar.style.width = pct + '%';
            if (pctEl) pctEl.textContent = pct + '%';
        });
    }

    document.querySelectorAll('.post-poll').forEach(function(poll) {
        const id = poll.dataset.pollId;
        if (!id) return;
        const store = getPollVotes();
        const myVote = store[id];
        if (myVote) {
            poll.classList.add('is-locked');
            const opt = poll.querySelector('[data-poll-option="' + myVote + '"]');
            if (opt) opt.classList.add('is-voted');
        }
    });

    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.post-poll__btn');
        if (!btn) return;
        if (typeof helpActive !== 'undefined' && helpActive) return;
        const opt = btn.closest('.post-poll__option');
        const poll = btn.closest('.post-poll');
        if (!opt || !poll) return;
        if (poll.classList.contains('is-locked')) return;
        const id = poll.dataset.pollId;
        const choice = opt.dataset.pollOption;
        // Increment this option's votes
        const v = parseInt(opt.dataset.votes, 10) || 0;
        opt.dataset.votes = String(v + 1);
        opt.classList.add('is-voted');
        poll.classList.add('is-locked');
        // Persist + recalc
        const store = getPollVotes();
        store[id] = choice;
        savePollVotes(store);
        refreshPoll(poll);
        if (typeof showToast === 'function') showToast('Vote counted ✓');
    });

    // -------------------- SHARE / REPOST — share button on every post + modal --------------------
    function getRepostStore() {
        try { return JSON.parse(localStorage.getItem('stagecord_reposts') || '[]'); }
        catch (e) { return []; }
    }
    function saveRepostStore(arr) {
        try { localStorage.setItem('stagecord_reposts', JSON.stringify(arr)); }
        catch (e) {}
    }

    // Build the shared repost modal (lazy)
    let repostModal = null;
    function ensureRepostModal() {
        if (repostModal) return repostModal;
        repostModal = document.createElement('div');
        repostModal.className = 'repost-modal-overlay';
        repostModal.dataset.repostModal = '1';
        repostModal.setAttribute('aria-hidden', 'true');
        repostModal.innerHTML =
            '<div class="repost-modal" role="dialog" aria-modal="true">' +
                '<header class="repost-modal__header">' +
                    '<h2 class="repost-modal__title">Share post</h2>' +
                    '<button type="button" class="repost-modal__close" data-repost-close aria-label="Close">&times;</button>' +
                '</header>' +
                '<div class="repost-modal__body">' +
                    '<div class="repost-modal__as">' +
                        '<span class="repost-modal__as-avatar"></span>' +
                        '<span>Sharing as <span class="repost-modal__as-name">Julie Andersen</span></span>' +
                    '</div>' +
                    '<textarea class="repost-modal__quote" id="repostQuote" maxlength="280" placeholder="Add a comment to your repost… (optional)"></textarea>' +
                    '<div class="repost-modal__quoted" data-repost-original>' +
                        '<div class="repost-modal__quoted-meta">' +
                            '<span data-repost-original-date>—</span>' +
                            '<span>·</span>' +
                            '<span class="repost-modal__quoted-author auto-name" data-repost-original-author>—</span>' +
                        '</div>' +
                        '<p class="repost-modal__quoted-text" data-repost-original-text>—</p>' +
                    '</div>' +
                '</div>' +
                '<footer class="repost-modal__actions">' +
                    '<button type="button" class="repost-modal__btn" data-repost-close>Cancel</button>' +
                    '<button type="button" class="repost-modal__btn repost-modal__btn--primary" data-repost-confirm>Repost</button>' +
                '</footer>' +
            '</div>';
        document.body.appendChild(repostModal);
        return repostModal;
    }

    let activeRepostPostId = null;

    function openRepostModal(post) {
        const modal = ensureRepostModal();
        const date = post.querySelector('.artist-post__date');
        const author = post.querySelector('.artist-post__author');
        const text = post.querySelector('.artist-post__text');
        modal.querySelector('[data-repost-original-date]').textContent = date ? date.textContent : '';
        modal.querySelector('[data-repost-original-author]').textContent = author ? author.textContent.trim() : '';
        const fullText = text ? text.textContent.trim() : '';
        modal.querySelector('[data-repost-original-text]').textContent = fullText;
        modal.querySelector('#repostQuote').value = '';
        activeRepostPostId = post.dataset.postId || ('p' + Math.random().toString(36).slice(2, 8));
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(function() { modal.querySelector('#repostQuote').focus(); }, 0);
    }

    function closeRepostModal() {
        if (!repostModal) return;
        repostModal.classList.remove('is-open');
        repostModal.setAttribute('aria-hidden', 'true');
        activeRepostPostId = null;
    }

    // Inject share button into every artist-post stats row (after bookmark)
    document.querySelectorAll('.artist-post').forEach(function(post) {
        const stats = post.querySelector('.artist-post__stats');
        if (!stats || stats.querySelector(':scope > .share-btn')) return;
        const id = post.dataset.postId || 'p' + Math.random().toString(36).slice(2, 8);
        post.dataset.postId = id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'share-btn';
        btn.dataset.sharePostId = id;
        btn.setAttribute('aria-label', 'Share post');
        btn.setAttribute('data-help', 'Share: Repost dette opslag til din egen feed — med valgfri kommentar oven på. Originalforfatteren får en notifikation.');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>';
        // Restore reposted state
        const stored = getRepostStore();
        if (stored.some(function(r) { return r.postId === id; })) {
            btn.classList.add('is-reposted');
        }
        stats.appendChild(btn);
    });

    document.addEventListener('click', function(e) {
        // Open modal on share button click
        const shareBtn = e.target.closest('.share-btn');
        if (shareBtn) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            const post = shareBtn.closest('.artist-post');
            if (post) openRepostModal(post);
            return;
        }
        // Close / confirm inside modal
        if (repostModal && repostModal.classList.contains('is-open')) {
            if (e.target === repostModal || e.target.closest('[data-repost-close]')) {
                closeRepostModal();
                return;
            }
            const confirmBtn = e.target.closest('[data-repost-confirm]');
            if (confirmBtn) {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                const quote = repostModal.querySelector('#repostQuote').value.trim();
                const author = repostModal.querySelector('[data-repost-original-author]').textContent;
                const store = getRepostStore();
                store.push({ postId: activeRepostPostId, author: author, quote: quote, time: new Date().toISOString() });
                saveRepostStore(store);
                // Visually mark the source post's share button as reposted
                const sourceBtn = document.querySelector('.share-btn[data-share-post-id="' + activeRepostPostId + '"]');
                if (sourceBtn) sourceBtn.classList.add('is-reposted');
                closeRepostModal();
                if (typeof showToast === 'function') showToast(quote ? 'Reposted with comment ✓' : 'Reposted ✓');
                return;
            }
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && repostModal && repostModal.classList.contains('is-open')) closeRepostModal();
    });

    // -------------------- BOOKMARKS — universal save/unsave with localStorage --------------------
    // Saveable surfaces: artist-posts, marketplace feature cards. Future
    // surfaces (events, fan covers, profiles) just need to call injectBookmark
    // with a stable ID. Storage is a single JSON array under the key
    // `stagecord_saved`, so views from any page share the same set.
    function getSavedIds() {
        try { return JSON.parse(localStorage.getItem('stagecord_saved') || '[]'); }
        catch (e) { return []; }
    }
    function setSavedIds(arr) {
        try { localStorage.setItem('stagecord_saved', JSON.stringify(arr)); }
        catch (e) { /* localStorage unavailable — fail quietly */ }
    }
    function isItemSaved(id) {
        return getSavedIds().indexOf(id) !== -1;
    }
    function setItemSaved(id, save) {
        let arr = getSavedIds();
        if (save) {
            if (arr.indexOf(id) === -1) arr.push(id);
        } else {
            arr = arr.filter(function(x) { return x !== id; });
        }
        setSavedIds(arr);
    }

    function buildBookmarkBtn(id, label) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bookmark-btn';
        btn.dataset.savedId = id;
        btn.setAttribute('aria-label', label || 'Save');
        btn.setAttribute('data-help', 'Bookmark: Gemmer dette opslag på tværs af platformen. Find dine gemte items i en samlet liste — bookmarken bevares mellem sessioner via localStorage.');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
        if (isItemSaved(id)) btn.classList.add('is-saved');

        btn.addEventListener('click', function(e) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            e.stopPropagation();
            const wasSaved = btn.classList.contains('is-saved');
            btn.classList.toggle('is-saved');
            setItemSaved(id, !wasSaved);
            if (typeof showToast === 'function') {
                showToast(wasSaved ? 'Removed from saved' : 'Saved ✓');
            }
        });
        return btn;
    }

    // Inject bookmark into every artist-post (placed at the end of the stats row)
    document.querySelectorAll('.artist-post').forEach(function(post) {
        const stats = post.querySelector('.artist-post__stats');
        if (!stats) return;
        if (stats.querySelector(':scope > .bookmark-btn')) return;
        const id = 'post:' + (post.dataset.postId || ('p' + Math.random().toString(36).slice(2, 8)));
        post.dataset.postId = id.split(':')[1];
        stats.appendChild(buildBookmarkBtn(id, 'Save post'));
    });

    // Inject bookmark into every marketplace feature card wrapper
    document.querySelectorAll('.feature-card-wrapper').forEach(function(wrap) {
        if (wrap.querySelector(':scope > .bookmark-btn')) return;
        // Build a stable id from the seller name + first description item
        const seller = wrap.querySelector('.feature-avatar__title');
        const desc = wrap.querySelector('.feature-description__item');
        const slug = ((seller ? seller.textContent : '') + '-' + (desc ? desc.textContent : ''))
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
        const id = 'feature:' + (slug || 'f' + Math.random().toString(36).slice(2, 8));
        wrap.appendChild(buildBookmarkBtn(id, 'Save feature'));
    });

    // -------------------- POSTS / COMMENTS — Edit · Delete · Pin · Copy link --------------------
    // Inject a kebab (⋯) menu trigger into every artist-post and artist-comment.
    // Clicking opens a shared dropdown anchored to the trigger. Demo treats
    // every post/comment as "your own" since there is no auth — in production
    // the kebab would only render on items authored by the logged-in user.
    function showToast(text) {
        let toast = document.querySelector('.post-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'post-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = text;
        // Force reflow so the transition triggers
        void toast.offsetWidth;
        toast.classList.add('is-visible');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(function() { toast.classList.remove('is-visible'); }, 2200);
    }

    function injectKebab(target, kind) {
        if (target.querySelector(':scope > .post-kebab')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'post-kebab';
        btn.dataset.postKebab = kind;
        btn.setAttribute('aria-label', 'Post options');
        btn.setAttribute('data-help', kind === 'post'
            ? 'Post-menu: Rediger, pin, kopier link eller slet dit eget opslag.'
            : 'Comment-menu: Rediger eller slet din egen kommentar.');
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
        target.appendChild(btn);
    }

    document.querySelectorAll('.artist-post').forEach(function(post) {
        const meta = post.querySelector('.artist-post__meta');
        if (meta) injectKebab(meta, 'post');
    });
    document.querySelectorAll('.artist-comment').forEach(function(comment) {
        const main = comment.querySelector('.artist-comment__main');
        if (main) injectKebab(main, 'comment');
    });

    // Shared dropdown menu — created lazily, re-positioned for each open
    let menuEl = null;
    let menuTarget = null;

    function buildMenu(kind) {
        const wrap = document.createElement('div');
        wrap.className = 'post-menu';
        wrap.hidden = true;
        const isPost = (kind === 'post');
        wrap.innerHTML =
            '<button type="button" class="post-menu__btn" data-menu-action="edit">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 4.4l4.4 4.4M3 21l4.6-1.1L20 7.4a1.5 1.5 0 0 0 0-2.1l-1.3-1.3a1.5 1.5 0 0 0-2.1 0L4.1 16.4 3 21z"/></svg>' +
                'Edit' +
            '</button>' +
            (isPost ?
                '<button type="button" class="post-menu__btn" data-menu-action="pin">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M9 11l3-9 3 9-3 6-3-6z"/></svg>' +
                    '<span data-menu-pin-label>Pin to top</span>' +
                '</button>' +
                '<button type="button" class="post-menu__btn" data-menu-action="copy">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>' +
                    'Copy link' +
                '</button>'
                : '') +
            '<div class="post-menu__divider"></div>' +
            '<button type="button" class="post-menu__btn post-menu__btn--danger" data-menu-action="delete">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>' +
                (isPost ? 'Delete post' : 'Delete comment') +
            '</button>';
        return wrap;
    }

    function positionMenu(menu, btn) {
        const rect = btn.getBoundingClientRect();
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        document.body.appendChild(menu);
        menu.hidden = false;
        const menuW = menu.offsetWidth;
        const menuH = menu.offsetHeight;
        let top  = rect.bottom + scrollY + 6;
        let left = rect.right + scrollX - menuW;
        if (top + menuH > scrollY + window.innerHeight - 8) top = rect.top + scrollY - menuH - 6;
        if (left < scrollX + 8) left = scrollX + 8;
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
    }

    function closeMenu() {
        if (!menuEl) return;
        menuEl.hidden = true;
        if (menuTarget) menuTarget.classList.remove('is-active');
        menuTarget = null;
    }

    function openMenu(btn) {
        const kind = btn.dataset.postKebab;
        if (menuEl) menuEl.remove();
        menuEl = buildMenu(kind);
        positionMenu(menuEl, btn);
        btn.classList.add('is-active');
        menuTarget = btn;

        // If this is a post and it's already pinned, swap label
        const post = btn.closest('.artist-post');
        if (post && post.classList.contains('is-pinned')) {
            const pinLabel = menuEl.querySelector('[data-menu-pin-label]');
            if (pinLabel) pinLabel.textContent = 'Unpin';
        }
    }

    function startInlineEdit(target, textSelector, onSave) {
        const textEl = target.querySelector(textSelector);
        if (!textEl) return;
        target.classList.add('is-editing');

        // For comments: edit only the body AFTER the <strong>name:</strong>
        let editor = textEl;
        let original = textEl.innerHTML;
        textEl.contentEditable = 'true';
        textEl.focus();

        // Place cursor at end of text
        const range = document.createRange();
        range.selectNodeContents(textEl);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        // Build inline Save / Cancel buttons
        const actions = document.createElement('div');
        actions.className = 'post-edit-actions';
        actions.innerHTML =
            '<button type="button" class="post-edit-actions__btn post-edit-actions__btn--save">Save</button>' +
            '<button type="button" class="post-edit-actions__btn">Cancel</button>';
        textEl.insertAdjacentElement('afterend', actions);

        const saveBtn = actions.children[0];
        const cancelBtn = actions.children[1];

        function cleanup() {
            textEl.contentEditable = 'false';
            actions.remove();
            target.classList.remove('is-editing');
        }

        saveBtn.addEventListener('click', function() {
            cleanup();
            if (onSave) onSave();
            showToast('Changes saved');
        });
        cancelBtn.addEventListener('click', function() {
            textEl.innerHTML = original;
            cleanup();
        });
    }

    document.addEventListener('click', function(e) {
        const kebab = e.target.closest('.post-kebab');
        if (kebab) {
            e.stopPropagation();
            if (menuTarget === kebab) { closeMenu(); return; }
            closeMenu();
            openMenu(kebab);
            return;
        }
        // Click inside the open menu — handle action
        if (menuEl && !menuEl.hidden && menuEl.contains(e.target)) {
            const actionBtn = e.target.closest('[data-menu-action]');
            if (!actionBtn || !menuTarget) return;
            const action = actionBtn.dataset.menuAction;
            const kind = menuTarget.dataset.postKebab;
            const container = (kind === 'post' ? menuTarget.closest('.artist-post') : menuTarget.closest('.artist-comment'));
            closeMenu();
            if (!container) return;

            if (action === 'edit') {
                if (kind === 'post') {
                    startInlineEdit(container, '.artist-post__text');
                } else {
                    startInlineEdit(container, '.artist-comment__body');
                }
                return;
            }
            if (action === 'delete') {
                const label = (kind === 'post' ? 'this post' : 'this comment');
                if (!confirm('Delete ' + label + '? This cannot be undone.')) return;
                container.classList.add('is-removing');
                setTimeout(function() {
                    container.remove();
                    showToast(kind === 'post' ? 'Post deleted' : 'Comment deleted');
                }, 250);
                return;
            }
            if (action === 'pin' && kind === 'post') {
                const wasPinned = container.classList.contains('is-pinned');
                // Only allow one pinned post per feed
                const feed = container.closest('.artist-feed');
                if (feed) feed.querySelectorAll('.artist-post.is-pinned').forEach(function(p) { p.classList.remove('is-pinned'); });
                if (!wasPinned) {
                    container.classList.add('is-pinned');
                    if (feed) feed.insertBefore(container, feed.firstElementChild);
                    showToast('Post pinned to top');
                } else {
                    showToast('Post unpinned');
                }
                return;
            }
            if (action === 'copy') {
                const id = container.dataset.postId || 'post';
                const url = window.location.origin + window.location.pathname + '#' + id;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url).then(function() { showToast('Link copied'); });
                } else {
                    showToast('Link: ' + url);
                }
                return;
            }
        }
        // Click outside the menu — close it
        if (menuEl && !menuEl.hidden) closeMenu();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && menuEl && !menuEl.hidden) closeMenu();
    });

    window.addEventListener('resize', closeMenu);


    // -------------------- TOPBAR SEARCH — suggestions dropdown --------------------
    // Mock data — represents profiles findable on the platform.
    // url is relative to the project root; the navigateToSuggestion()
    // function below resolves it against the current location so it works
    // from any page depth.
    const SEARCH_SUGGESTIONS = [
        { name: 'Martin Ruthkjær',  meta: 'Fan · Copenhagen',          url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-male-7.png') + "') center/cover" },
        { name: 'Marie Andersen',   meta: 'Fan · Aarhus',              url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-female-5.png') + "') center/cover" },
        { name: 'Mathias Kristensen', meta: 'Fan · Odense',            url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-male-5.png') + "') center/cover" },
        { name: 'Mads Larsen',      meta: 'Fan · Aalborg',             url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-male-7.png') + "') center/cover" },
        { name: 'Mette Nielsen',    meta: 'Fan · Copenhagen',          url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-female-5.png') + "') center/cover" },
        { name: 'Maja Sørensen',    meta: 'Fan · Roskilde',            url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-female-4.png') + "') center/cover" },
        { name: 'JokesmithJohnson', meta: 'Artist · Aarhus',           url: 'artist/index.html',     avatar: "url('" + localAsset('assets/images/artists/jokesmith-johnson-cover.png') + "') center/cover",
          roles: ['Comedian', 'Musician', 'Songwriter', 'Vocalist'] },
        { name: 'Anchi Humifuku',   meta: 'Artist · NYC',              url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover",
          roles: ['Topliner', 'Songwriter', 'Vocalist', 'Lyricist'] },
        { name: 'Maya Thompson',    meta: 'Artist · LA',               url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover",
          roles: ['Topliner', 'Songwriter', 'Producer', 'Vocalist'] },
        { name: 'Lars Vognsen',     meta: 'Artist · Copenhagen',       url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-male-3.png') + "') center/cover",
          roles: ['Producer', 'Audio engineer', 'Composer', 'Mixing engineer'] },
        { name: 'Sara Holm',        meta: 'Artist · Aarhus',           url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover",
          roles: ['Podcaster', 'Voice actor', 'Speaker'] },
        { name: 'DJ Frostbite',     meta: 'Artist · Aalborg',          url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-male-1.png') + "') center/cover",
          roles: ['DJ', 'Producer', 'Beatmaker'] },
        { name: 'Tobias Krogh',     meta: 'Artist · Aarhus',           url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-male-6.png') + "') center/cover",
          roles: ['Guitarist', 'Bassist', 'Musician'] },
        { name: 'Emilie Bach',      meta: 'Artist · Copenhagen',       url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover",
          roles: ['Mastering engineer', 'Mixing engineer', 'Audio engineer'] },
        { name: 'Frederik Holm',    meta: 'Artist · Aarhus',           url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-male-4.png') + "') center/cover",
          roles: ['Drummer', 'Pianist / Keyboardist', 'Musician'] },
        { name: 'Liva Mai',         meta: 'Fan creator · Aarhus',      url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover",
          roles: ['Dancer', 'Content creator', 'Choreographer'] },
        { name: 'Anders Vlog',      meta: 'Fan creator · Copenhagen',  url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-male-2.png') + "') center/cover",
          roles: ['Content creator', 'Streamer', 'Speaker'] },
        { name: 'Camilla Step',     meta: 'Fan creator · Aalborg',     url: 'fan/martin/index.html', avatar: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover",
          roles: ['Dancer', 'Choreographer'] },
        { name: 'Julie Andersen',   meta: 'Fan · Brooklyn (you)',      url: 'fan/index.html',        avatar: "url('" + localAsset('assets/images/artists/julie-andersen-profile.png') + "') center/cover" },
        { name: 'RUST',             meta: 'Venue · Copenhagen',        url: 'venue/index.html',      avatar: "url('" + localAsset('assets/images/artists/rust-cover.png') + "') center/cover", category: 'Venue' },

        // ----- Songs (streamable tracks) -----
        { name: 'Manhattan Rain',           meta: 'Song · Anchi Humifuku · 4:12',          url: 'streaming/song/index.html', category: 'Song',  avatar: "url('" + localAsset('assets/images/artists/placeholder-female-3.png') + "') center/cover" },
        { name: 'Brooklyn Air',             meta: 'Song · Jeremy Freedom · 3:48',          url: 'streaming/song/index.html', category: 'Song',  avatar: "url('" + localAsset('assets/images/artists/jeremy-freedom-profile.png') + "') center/cover" },
        { name: 'City Lights Are Calling',  meta: 'Song · Maya Thompson · 4:08',           url: 'streaming/song/index.html', category: 'Song',  avatar: "url('" + localAsset('assets/images/artists/maya-thompson-profile.png') + "') center/cover" },
        { name: 'Velvet Hours',             meta: 'Song · Malik Johnson · 4:12',           url: 'streaming/song/index.html', category: 'Song',  avatar: "url('" + localAsset('assets/images/artists/malik-johnson-profile.png') + "') center/cover" },
        { name: 'Eternaty',                 meta: 'Song · Jeremy Freedom & Maya Thompson · 3:54', url: 'streaming/song/index.html', category: 'Song', avatar: "url('" + localAsset('assets/images/artists/jeremy-freedom-profile.png') + "') center/cover" },
        { name: 'Stuck in the Loop',        meta: 'Song · Mellow · 3:32',                  url: 'streaming/song/index.html', category: 'Song',  avatar: "url('" + localAsset('assets/images/artists/mellow-profile.jpg') + "') center/cover" },
        { name: 'Backseat Love',            meta: 'Song · Rathcire · 3:14',                url: 'streaming/song/index.html', category: 'Song',  avatar: "url('" + localAsset('assets/images/artists/placeholder-male-2.png') + "') center/cover" },
        { name: 'Nordic Drive',             meta: 'Song · KEBU · 4:48',                    url: 'streaming/song/index.html', category: 'Song',  avatar: "url('" + localAsset('assets/images/artists/kebu-profile.jpg') + "') center/cover" },

        // ----- Albums / EPs -----
        { name: 'Jokes On Me — Live',  meta: 'Album · Jokesmith Johnson · 2024 · 75 min',  url: 'streaming/index.html', category: 'Album', avatar: "url('" + localAsset('assets/images/artists/jokesmith-johnson-project-1.png') + "') center/cover" },
        { name: 'Open Window',         meta: 'EP · Jeremy Freedom · 2024 · 24 min',         url: 'streaming/index.html', category: 'Album', avatar: "url('" + localAsset('assets/images/artists/jeremy-freedom-cover.png') + "') center/cover" },
        { name: 'Late Night Sessions', meta: 'Album · Maya Thompson · 2024 · 42 min',       url: 'streaming/index.html', category: 'Album', avatar: "url('" + localAsset('assets/images/artists/maya-thompson-profile.png') + "') center/cover" },
        { name: 'Soul Talk',           meta: 'EP · Lola Young · 2024 · 28 min',             url: 'streaming/index.html', category: 'Album', avatar: "url('" + localAsset('assets/images/artists/lola-young-profile.jpg') + "') center/cover" },
        { name: 'Affilærd Vol. 4',     meta: 'Album · Mellow · 2024 · 52 min',              url: 'streaming/index.html', category: 'Album', avatar: "url('" + localAsset('assets/images/artists/mellow-profile.jpg') + "') center/cover" },
        { name: 'Northern Drive',      meta: 'Album · KEBU · 2024 · 64 min',                url: 'streaming/index.html', category: 'Album', avatar: "url('" + localAsset('assets/images/artists/kebu-profile.jpg') + "') center/cover" },
        { name: 'Northern Lights',     meta: 'Album · Anchi Humifuku · 2024 · 38 min',      url: 'streaming/index.html', category: 'Album', avatar: "url('" + localAsset('assets/images/artists/placeholder-female-3.png') + "') center/cover" },

        // ----- Playlists -----
        { name: 'Late Nights at RUST', meta: 'Playlist · curated by RUST · 24 tracks',           url: 'streaming/index.html', category: 'Playlist', avatar: "url('" + localAsset('assets/images/artists/rust-cover.png') + "') center/cover" },
        { name: 'Indie Spotlight',     meta: 'Playlist · STAGECORD curators · 32 tracks',        url: 'streaming/index.html', category: 'Playlist', avatar: "url('" + localAsset('assets/images/artists/rust-cover.png') + "') center/cover" },
        { name: 'Synthwave All Night', meta: 'Playlist · curated by KEBU · 40 tracks',           url: 'streaming/index.html', category: 'Playlist', avatar: "url('" + localAsset('assets/images/artists/kebu-event.jpg') + "') center/cover" },
        { name: 'DK Hip-hop 2024',     meta: 'Playlist · STAGECORD curators · 28 tracks',        url: 'streaming/index.html', category: 'Playlist', avatar: "url('" + localAsset('assets/images/artists/lola-young-event.jpg') + "') center/cover" },
        { name: 'Sunday Acoustic',     meta: 'Playlist · STAGECORD curators · 22 tracks',        url: 'streaming/index.html', category: 'Playlist', avatar: "url('" + localAsset('assets/images/artists/lola-young-event.jpg') + "') center/cover" },
        { name: 'Pre-show warm-up',    meta: 'Playlist · curated by Mellow · 18 tracks',         url: 'streaming/index.html', category: 'Playlist', avatar: "url('" + localAsset('assets/images/artists/mellow-event.jpg') + "') center/cover" }
    ];

    // Derive a profile category for filtering. Most entries encode it as the
    // first word of `meta` ("Artist · Aarhus", "Venue · Copenhagen"); honor
    // an explicit `category` field if set.
    function categoryOf(s) {
        if (s.category) return s.category;
        const m = (s.meta || '').toLowerCase();
        if (m.indexOf('venue') === 0)    return 'Venue';
        if (m.indexOf('artist') === 0)   return 'Artist';
        if (m.indexOf('manager') === 0)  return 'Manager';
        if (m.indexOf('sponsor') === 0)  return 'Sponsor';
        if (m.indexOf('licensor') === 0 || m.indexOf('media') === 0) return 'Media Licensor';
        if (m.indexOf('fan') === 0)      return 'Fan';
        if (m.indexOf('song') === 0)     return 'Song';
        if (m.indexOf('album') === 0 || m.indexOf('ep ·') === 0) return 'Album';
        if (m.indexOf('playlist') === 0) return 'Playlist';
        return 'Other';
    }

    function getProjectRoot() {
        const url = window.location.href;
        const idx = url.indexOf('/STAGECORD%20PRO/');
        if (idx !== -1) return url.substring(0, idx + '/STAGECORD%20PRO/'.length);
        const idx2 = url.indexOf('/STAGECORD PRO/');
        if (idx2 !== -1) return url.substring(0, idx2 + '/STAGECORD PRO/'.length);
        return '';
    }

    function navigateToSuggestion(relPath) {
        const root = getProjectRoot();
        // Going to the song player? Remember where we came from so the
        // minimize button can take the user back to their search results.
        if (relPath.indexOf('streaming/song/') !== -1) {
            try {
                sessionStorage.setItem('stagecord:songReturnUrl', window.location.href);
            } catch (e) { /* private mode etc. — fail silently */ }
        }
        window.location.href = root + relPath;
    }

    // Filter groups offered in the search popover. The first group lets you
    // narrow by profile type (categories); the rest mirror the role chips
    // in artist settings — filtering by any role surfaces every profile
    // that has selected it.
    const FILTER_GROUPS = [
        { title: 'Profile type',             categories: ['Artist', 'Fan', 'Venue', 'Manager', 'Sponsor', 'Media Licensor'] },
        { title: 'Music',                    categories: ['Song', 'Album', 'Playlist'] },
        { title: 'Performance',              roles: ['Musician', 'Vocalist', 'Backing vocalist', 'Instrumentalist', 'Comedian', 'Speaker', 'Voice actor', 'Podcaster', 'DJ', 'Dancer', 'Choreographer', 'Content creator', 'Streamer'] },
        { title: 'Instruments',              roles: ['Guitarist', 'Bassist', 'Drummer', 'Pianist / Keyboardist', 'Saxophonist', 'Violinist', 'Trumpeter'] },
        { title: 'Writing & arrangement',    roles: ['Songwriter', 'Lyricist', 'Topliner', 'Composer', 'Arranger', 'Beatmaker'] },
        { title: 'Production & engineering', roles: ['Producer', 'Co-producer', 'Mixing engineer', 'Mastering engineer', 'Audio engineer', 'Sound designer'] }
    ];

    // Expose search data so the dedicated /search/ page can reuse it.
    window.STAGECORD = window.STAGECORD || {};
    window.STAGECORD.search = {
        items: SEARCH_SUGGESTIONS,
        FILTER_GROUPS: FILTER_GROUPS,
        categoryOf: categoryOf,
        navigateToSuggestion: navigateToSuggestion,
        getProjectRoot: getProjectRoot
    };

    document.querySelectorAll('.search-bar').forEach(function(searchBar) {
        const input = searchBar.querySelector('.search-input');
        if (!input) return;

        const escapeHtml = function(str) {
            return String(str).replace(/[&<>"']/g, function(c) {
                return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
            });
        };

        // ---------- Filter button + popover ----------
        const filterBtn = document.createElement('button');
        filterBtn.type = 'button';
        filterBtn.className = 'search-filter-btn';
        filterBtn.setAttribute('aria-label', 'Filter by role or category');
        filterBtn.setAttribute('data-help', 'Filtrér søgeresultater på rolle eller kategori — fx Mastering engineer, Guitarist eller Producer. Klik for at vælge en eller flere kategorier.');
        filterBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
        const searchIcon = searchBar.querySelector('.search-icon');
        if (searchIcon && searchIcon.nextSibling) searchBar.insertBefore(filterBtn, searchIcon.nextSibling);
        else searchBar.appendChild(filterBtn);

        const popover = document.createElement('div');
        popover.className = 'search-filter-popover';
        popover.innerHTML =
            '<div class="search-filter-popover__header">' +
                '<h3 class="search-filter-popover__title">Filter</h3>' +
                '<button type="button" class="search-filter-popover__clear" data-clear-filter>Clear all</button>' +
            '</div>' +
            FILTER_GROUPS.map(function(g) {
                const items = g.categories || g.roles;
                const attr = g.categories ? 'data-category' : 'data-role';
                return '<div class="search-filter-popover__group">' +
                    '<h4 class="search-filter-popover__group-title">' + escapeHtml(g.title) + '</h4>' +
                    '<div class="search-filter-popover__chips">' +
                        items.map(function(r) {
                            return '<label class="filter-chip">' +
                                '<input type="checkbox" ' + attr + '="' + escapeHtml(r) + '">' +
                                '<span class="filter-chip__label">' + escapeHtml(r) + '</span>' +
                            '</label>';
                        }).join('') +
                    '</div>' +
                '</div>';
            }).join('');
        searchBar.appendChild(popover);

        const activeRoles = new Set();
        const activeCategories = new Set();

        function updateFilterBtnState() {
            const count = activeRoles.size + activeCategories.size;
            let badge = filterBtn.querySelector('.search-filter-btn__count');
            if (count > 0) {
                filterBtn.classList.add('is-active');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'search-filter-btn__count';
                    filterBtn.appendChild(badge);
                }
                badge.textContent = count;
            } else {
                filterBtn.classList.remove('is-active');
                if (badge) badge.remove();
            }
        }

        const dropdown = document.createElement('div');
        dropdown.className = 'search-suggestions';
        searchBar.appendChild(dropdown);

        function render(query) {
            // While the filter popover is the active surface, keep the
            // suggestions dropdown hidden so the two don't stack on top of
            // each other.
            if (popover.classList.contains('open')) {
                dropdown.classList.remove('open');
                return;
            }

            const q = (query || '').trim().toLowerCase();
            const hasRoleFilter = activeRoles.size > 0;
            const hasCategoryFilter = activeCategories.size > 0;
            const hasFilter = hasRoleFilter || hasCategoryFilter;
            if (!q && !hasFilter) {
                dropdown.classList.remove('open');
                dropdown.innerHTML = '';
                return;
            }

            const matches = [];
            SEARCH_SUGGESTIONS.forEach(function(s) {
                // Apply category filter (profile type)
                if (hasCategoryFilter && !activeCategories.has(categoryOf(s))) return;
                // Apply role filter
                if (hasRoleFilter) {
                    const matchesRole = (s.roles || []).some(function(r) {
                        return activeRoles.has(r);
                    });
                    if (!matchesRole) return;
                }

                if (q) {
                    const nameHit = s.name.toLowerCase().indexOf(q) !== -1;
                    const metaHit = (s.meta || '').toLowerCase().indexOf(q) !== -1;
                    const roleHit = (s.roles || []).find(function(r) {
                        return r.toLowerCase().indexOf(q) !== -1;
                    });
                    if (!nameHit && !metaHit && !roleHit) return;
                    matches.push({
                        item: s,
                        matchedRole: nameHit ? null : roleHit,
                        // name hit ranks first, then meta (e.g. song matched
                        // by artist name in the byline), then role.
                        rank: nameHit ? 0 : (metaHit ? 1 : 2)
                    });
                } else {
                    // Filter-only mode (no query) — surface the role that
                    // caused the match so the user sees why it's listed.
                    const filterRole = (s.roles || []).find(function(r) {
                        return activeRoles.has(r);
                    });
                    matches.push({
                        item: s,
                        matchedRole: filterRole || null,
                        rank: 0
                    });
                }
            });
            matches.sort(function(a, b) { return a.rank - b.rank; });
            const top = matches.slice(0, 12);

            if (top.length === 0) {
                const label = q
                    ? 'No results for "' + escapeHtml(q) + '"'
                    : 'No profiles match the selected filters';
                dropdown.innerHTML = '<div class="search-suggestions__empty">' + label + '</div>';
            } else {
                dropdown.innerHTML = top.map(function(m) {
                    const s = m.item;
                    const meta = m.matchedRole
                        ? s.meta + ' · <span class="search-suggestion__role">' + escapeHtml(m.matchedRole) + '</span>'
                        : s.meta;
                    return '<a href="#" class="search-suggestion" data-url="' + s.url + '">' +
                        '<span class="search-suggestion__avatar" style="background: ' + s.avatar + ';"></span>' +
                        '<div class="search-suggestion__main">' +
                            '<div class="search-suggestion__name auto-name">' + s.name + '</div>' +
                            '<div class="search-suggestion__meta">' + meta + '</div>' +
                        '</div>' +
                    '</a>';
                }).join('') +
                '<a href="#" class="search-suggestions__viewall" data-viewall>View all ' + matches.length + ' result' + (matches.length === 1 ? '' : 's') + ' →</a>';
                formatAllNames(dropdown);
            }
            dropdown.classList.add('open');
        }

        // Build a search-results URL from the current query + active filters
        function buildSearchUrl() {
            const params = new URLSearchParams();
            const q = (input.value || '').trim();
            if (q) params.set('q', q);
            activeCategories.forEach(function(c) { params.append('category', c); });
            activeRoles.forEach(function(r) { params.append('role', r); });
            const qs = params.toString();
            return 'search/index.html' + (qs ? '?' + qs : '');
        }

        // ---------- Filter popover wiring ----------
        filterBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const willOpen = !popover.classList.contains('open');
            popover.classList.toggle('open', willOpen);
            if (willOpen) {
                dropdown.classList.remove('open');
            } else {
                // Closing the popover surfaces filtered results immediately.
                render(input.value);
            }
        });

        popover.addEventListener('click', function(e) {
            // Stop popover-internal clicks from bubbling to the document
            // outside-click handler that closes both surfaces.
            e.stopPropagation();
        });

        popover.addEventListener('change', function(e) {
            if (e.target.matches('input[data-role]')) {
                const role = e.target.dataset.role;
                if (e.target.checked) activeRoles.add(role);
                else activeRoles.delete(role);
                updateFilterBtnState();
            } else if (e.target.matches('input[data-category]')) {
                const cat = e.target.dataset.category;
                if (e.target.checked) activeCategories.add(cat);
                else activeCategories.delete(cat);
                updateFilterBtnState();
            }
        });

        const clearBtn = popover.querySelector('[data-clear-filter]');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                activeRoles.clear();
                activeCategories.clear();
                popover.querySelectorAll('input[data-role], input[data-category]').forEach(function(i) { i.checked = false; });
                updateFilterBtnState();
            });
        }

        // ---------- Input wiring ----------
        input.addEventListener('input', function() {
            // Typing closes the filter popover so the dropdown can show.
            popover.classList.remove('open');
            render(input.value);
        });
        input.addEventListener('focus', function() {
            if (popover.classList.contains('open')) return;
            if (input.value.trim() || activeRoles.size > 0) render(input.value);
        });
        input.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter') return;
            const q = (input.value || '').trim();
            if (!q && activeCategories.size === 0 && activeRoles.size === 0) return;
            e.preventDefault();
            navigateToSuggestion(buildSearchUrl());
        });

        dropdown.addEventListener('click', function(e) {
            const viewAll = e.target.closest('[data-viewall]');
            if (viewAll) {
                e.preventDefault();
                navigateToSuggestion(buildSearchUrl());
                return;
            }
            const link = e.target.closest('.search-suggestion');
            if (!link) return;
            e.preventDefault();
            const url = link.dataset.url;
            if (url) navigateToSuggestion(url);
        });

        // Click outside closes both popover and dropdown
        document.addEventListener('click', function(e) {
            if (!searchBar.contains(e.target)) {
                if (popover.classList.contains('open')) {
                    popover.classList.remove('open');
                    render(input.value);
                }
                dropdown.classList.remove('open');
            }
        });

        // Esc closes whichever is open
        document.addEventListener('keydown', function(e) {
            if (e.key !== 'Escape') return;
            if (popover.classList.contains('open')) {
                popover.classList.remove('open');
                render(input.value);
            } else if (dropdown.classList.contains('open')) {
                dropdown.classList.remove('open');
                input.blur();
            }
        });
    });

    // -------------------- FAN PROFILE — Add friend toggle --------------------
    document.querySelectorAll('.fan-cover__friend-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            if (helpActive) return;
            const sent = btn.getAttribute('aria-pressed') === 'true';
            btn.setAttribute('aria-pressed', sent ? 'false' : 'true');
            const icon = btn.querySelector('.fan-cover__friend-icon');
            const label = btn.querySelector('.fan-cover__friend-label');
            if (sent) {
                if (icon) icon.textContent = '+';
                if (label) label.textContent = 'Add friend';
            } else {
                if (icon) icon.textContent = '✓';
                if (label) label.textContent = 'Request sent';
            }
        });
    });

    // Navigation active state handling
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Remove active class from all items
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });

            // Add active class to clicked item
            this.parentElement.classList.add('active');
        });
    });

    // Placeholder for profile image if not loaded
    const profileImage = document.querySelector('.profile-image img');
    if (profileImage) {
        profileImage.addEventListener('error', function() {
            this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="82" height="82" viewBox="0 0 82 82"%3E%3Ccircle cx="41" cy="41" r="41" fill="%23333333"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23ffffff" font-size="32" font-family="Arial"%3EJF%3C/text%3E%3C/svg%3E';
        });
    }

    // -------------------- HELP MODE --------------------
    // Click the "?" button to activate. Next element with [data-help]
    // clicked shows its explanation in a tooltip. Esc or clicking "?"
    // again exits help mode.
    const helpButton = document.querySelector('.help-button');
    const tooltip = document.createElement('div');
    tooltip.className = 'help-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltip);

    let helpActive = false;

    function setHelpActive(on) {
        helpActive = on;
        document.body.classList.toggle('help-mode', on);
        if (helpButton) {
            helpButton.classList.toggle('active', on);
            helpButton.setAttribute('aria-pressed', on ? 'true' : 'false');
        }
        if (!on) hideTooltip();
    }

    function hideTooltip() {
        tooltip.classList.remove('visible');
        tooltip.setAttribute('aria-hidden', 'true');
    }

    function showTooltipFor(el, x, y) {
        const text = el.getAttribute('data-help');
        if (!text) return;
        tooltip.textContent = text;
        tooltip.classList.add('visible');
        tooltip.setAttribute('aria-hidden', 'false');

        // Measure after it's visible so width/height are real
        const ttRect = tooltip.getBoundingClientRect();
        const margin = 12;
        let left = x + 16;
        let top = y + 16;

        if (left + ttRect.width + margin > window.innerWidth) {
            left = window.innerWidth - ttRect.width - margin;
        }
        if (top + ttRect.height + margin > window.innerHeight) {
            top = y - ttRect.height - 16;
        }
        left = Math.max(margin, left);
        top = Math.max(margin, top);

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    if (helpButton) {
        helpButton.addEventListener('click', function(e) {
            e.stopPropagation();
            setHelpActive(!helpActive);
        });
    }

    // Intercept clicks in help mode (capture phase so we run before default handlers)
    document.addEventListener('click', function(e) {
        if (!helpActive) return;

        // Clicking the help button itself is handled by its own listener
        if (helpButton && helpButton.contains(e.target)) return;

        // Clicking inside the tooltip just dismisses it
        if (tooltip.contains(e.target)) {
            hideTooltip();
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const target = e.target.closest('[data-help]');
        if (target) {
            showTooltipFor(target, e.clientX, e.clientY);
        } else {
            // Nothing documented here — exit help mode
            setHelpActive(false);
        }
    }, true);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && helpActive) {
            setHelpActive(false);
        }
    });

    // -------------------- PROJECT NAMES: EDIT MODE & NEW PROJECT --------------------
    const projectsList = document.querySelector('.projects-list');
    const editBtn = document.getElementById('editProjectsBtn');
    const newBtn = document.getElementById('newProjectBtn');

    // Delegated handlers for Enter/Esc while editing a name
    if (projectsList) {
        projectsList.addEventListener('keydown', function(e) {
            const target = e.target;
            if (!target || !target.classList || !target.classList.contains('project-card__name-value')) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                target.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (target.dataset.prev != null) {
                    target.textContent = target.dataset.prev;
                }
                target.blur();
            }
        });

        projectsList.addEventListener('blur', function(e) {
            const target = e.target;
            if (!target || !target.classList || !target.classList.contains('project-card__name-value')) return;
            const text = target.textContent.trim();
            if (!text && target.dataset.prev) {
                target.textContent = target.dataset.prev;
            } else {
                target.textContent = text;
            }
        }, true);
    }

    function setEditMode(on) {
        if (!projectsList || !editBtn) return;
        editBtn.classList.toggle('active', on);
        editBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        projectsList.classList.toggle('editing-names', on);

        const names = projectsList.querySelectorAll('.project-card__name-value');
        names.forEach(function(el, i) {
            if (on) {
                el.dataset.prev = el.textContent.trim();
                el.setAttribute('contenteditable', 'true');
                if (i === 0) {
                    el.focus();
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            } else {
                el.setAttribute('contenteditable', 'false');
                delete el.dataset.prev;
            }
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', function() {
            if (helpActive) return;
            setEditMode(!editBtn.classList.contains('active'));
        });
    }

    // Current logged-in user — shown as the first team member of any new project
    const CURRENT_USER = {
        firstWord: 'Julie',
        restWords: 'Andersen',
        initials: 'JA',
        role: 'Artist',
        avatarColor: '#4A90E2',
        approver: ''    // set e.g. 'A&R: John Smith' to approve on the artist's behalf
    };

    // Approval icons
    const PENDING_ICON_HTML =
        '<svg class="approval-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Pending" role="img">' +
            '<rect x="2" y="6" width="20" height="14" rx="2" fill="#FFCC80"/>' +
            '<path d="M2 7l10 7 10-7" stroke="#E0A964" stroke-width="1.2" fill="none"/>' +
            '<circle cx="17" cy="15" r="5" fill="#F44336"/>' +
            '<path d="M15 13l4 4M19 13l-4 4" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>' +
        '</svg>';

    // Read the name to show in the approvals list for a given team member.
    // If the member has a data-approver attribute (e.g. 'A&R: John Smith'
    // or 'Manager: Mike'), that name is used instead of the artist's.
    function getApproverName(member) {
        if (member.dataset && member.dataset.approver) {
            return member.dataset.approver;
        }
        const first = member.querySelector('.collaborator-name__first');
        const rest = member.querySelector('.collaborator-name__rest');
        if (first && rest) {
            return first.textContent.trim() + ' ' + rest.textContent.trim();
        }
        if (first) return first.textContent.trim();
        if (rest) return rest.textContent.trim();
        const plain = member.querySelector('.collaborator-name');
        return plain ? plain.textContent.trim() : '';
    }

    function rebuildApprovalsFromTeam(card) {
        const team = card.querySelector('.project-team');
        const approvals = card.querySelector('.project-approvals');
        if (!team || !approvals) return;
        const members = team.querySelectorAll('.collaborator-card:not(.add-person)');
        approvals.innerHTML = '';
        members.forEach(function(member) {
            const name = getApproverName(member);
            if (!name) return;
            const row = document.createElement('div');
            row.className = 'approval-row';
            row.innerHTML = PENDING_ICON_HTML + '<span>' + name + '</span>';
            approvals.appendChild(row);
        });
    }

    function buildCurrentUserCard() {
        const card = document.createElement('div');
        card.className = 'collaborator-card';
        if (CURRENT_USER.approver) card.dataset.approver = CURRENT_USER.approver;
        card.innerHTML =
            '<span class="collaborator-role">' + CURRENT_USER.role + '</span>' +
            '<div class="collaborator-image collaborator-image--initials" style="background:' + CURRENT_USER.avatarColor + ';">' + CURRENT_USER.initials + '</div>' +
            '<span class="collaborator-name">' +
                '<span class="collaborator-name__first">' + CURRENT_USER.firstWord + '</span>' +
                '<span class="collaborator-name__rest">' + CURRENT_USER.restWords + '</span>' +
            '</span>';
        return card;
    }

    // Snapshot the first project card + its toggle, use as template
    let projectCounter = 2;
    let templateCardHTML = '';
    let templateToggleHTML = '';
    if (projectsList) {
        const firstCard = projectsList.querySelector('.project-card');
        const firstToggle = firstCard && firstCard.nextElementSibling;
        if (firstCard) templateCardHTML = firstCard.outerHTML;
        if (firstToggle && firstToggle.classList.contains('project-toggle')) {
            templateToggleHTML = firstToggle.outerHTML;
        }
    }

    if (newBtn) {
        newBtn.addEventListener('click', function() {
            if (helpActive) return;
            if (!projectsList || !templateCardHTML) return;

            // Build a fresh card from the template
            const wrapper = document.createElement('div');
            wrapper.innerHTML = templateCardHTML + templateToggleHTML;
            const newCard = wrapper.querySelector('.project-card');
            const newToggle = wrapper.querySelector('.project-toggle');

            // Set a default name for the new project
            const nameValue = newCard.querySelector('.project-card__name-value');
            if (nameValue) {
                nameValue.textContent = 'New Project ' + projectCounter;
                nameValue.setAttribute('contenteditable', 'false');
                delete nameValue.dataset.prev;
            }

            // Reset team: only the logged-in user + add-person slot
            const team = newCard.querySelector('.project-team');
            if (team) {
                const addPerson = team.querySelector('.collaborator-card.add-person');
                team.innerHTML = '';
                team.appendChild(buildCurrentUserCard());
                if (addPerson) team.appendChild(addPerson);
            }

            // Sync the approvals list to match the new team
            rebuildApprovalsFromTeam(newCard);

            // Reset toggle state
            if (newToggle) {
                const input = newToggle.querySelector('input');
                if (input) input.checked = false;
            }

            projectsList.appendChild(newCard);
            if (newToggle) projectsList.appendChild(newToggle);

            projectCounter++;

            // If edit mode is already on, make the new name editable too
            if (editBtn && editBtn.classList.contains('active') && nameValue) {
                nameValue.dataset.prev = nameValue.textContent.trim();
                nameValue.setAttribute('contenteditable', 'true');
                nameValue.focus();
                const range = document.createRange();
                range.selectNodeContents(nameValue);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            } else {
                // Otherwise scroll the new card into view
                newCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // Esc exits edit mode globally
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && editBtn && editBtn.classList.contains('active')) {
            setEditMode(false);
        }
    });

    // -------------------- REQUEST: ACCEPT / DISMISS --------------------
    function extractRequester(requestCard) {
        const artistCard = requestCard.querySelector('.collaborator-card');
        if (!artistCard) return null;
        const role = artistCard.querySelector('.collaborator-role');
        const first = artistCard.querySelector('.collaborator-name__first');
        const rest = artistCard.querySelector('.collaborator-name__rest');
        const img = artistCard.querySelector('.collaborator-image');
        return {
            role: role ? role.textContent.trim() : 'Artist',
            firstWord: first ? first.textContent.trim() : '',
            restWords: rest ? rest.textContent.trim() : '',
            initials: img ? img.textContent.trim() : '',
            avatarColor: img ? (img.style.background || '#4A90E2') : '#4A90E2'
        };
    }

    function buildRequesterCard(r) {
        const card = document.createElement('div');
        card.className = 'collaborator-card';
        if (r.approver) card.dataset.approver = r.approver;
        card.innerHTML =
            '<span class="collaborator-role">' + r.role + '</span>' +
            '<div class="collaborator-image collaborator-image--initials" style="background:' + r.avatarColor + ';">' + r.initials + '</div>' +
            '<span class="collaborator-name">' +
                '<span class="collaborator-name__first">' + r.firstWord + '</span>' +
                '<span class="collaborator-name__rest">' + r.restWords + '</span>' +
            '</span>';
        return card;
    }

    function acceptRequest(requestCard) {
        if (!projectsList || !templateCardHTML) return;

        const requester = extractRequester(requestCard);
        const moneyEl = requestCard.querySelector('.info-value--money');
        const fee = moneyEl ? moneyEl.textContent.trim() : '';
        const infoValues = requestCard.querySelectorAll('.info-value:not(.info-value--money)');
        const projectName = infoValues.length > 0 ? infoValues[0].textContent.trim() : 'Accepted Collab';

        // Build the new project card from the template
        const wrapper = document.createElement('div');
        wrapper.innerHTML = templateCardHTML + templateToggleHTML;
        const newCard = wrapper.querySelector('.project-card');
        const newToggle = wrapper.querySelector('.project-toggle');

        // Green outline
        newCard.classList.add('project-card--accepted');

        // Project name
        const nameValue = newCard.querySelector('.project-card__name-value');
        if (nameValue) {
            nameValue.textContent = projectName;
            nameValue.setAttribute('contenteditable', 'false');
            delete nameValue.dataset.prev;
        }

        // Team: current user + requester + add-person
        const team = newCard.querySelector('.project-team');
        if (team) {
            const addPerson = team.querySelector('.collaborator-card.add-person');
            team.innerHTML = '';
            team.appendChild(buildCurrentUserCard());
            if (requester) team.appendChild(buildRequesterCard(requester));
            if (addPerson) team.appendChild(addPerson);
        }

        // Sync approvals list to match the new team
        rebuildApprovalsFromTeam(newCard);

        // Reset privacy toggle
        if (newToggle) {
            const input = newToggle.querySelector('input');
            if (input) input.checked = false;
        }

        // Build the footer row with toggle + fee
        const footerRow = document.createElement('div');
        footerRow.className = 'project-footer-row';
        if (newToggle) footerRow.appendChild(newToggle);
        if (fee) {
            const feeEl = document.createElement('span');
            feeEl.className = 'project-toggle-fee';
            feeEl.setAttribute('data-help', 'Accepteret honorar: Det aftalte beløb for dette samarbejde.');
            feeEl.innerHTML =
                '<span class="project-toggle-fee__label">Collab fee:</span>' +
                '<span class="project-toggle-fee__value">' + fee + '</span>';
            footerRow.appendChild(feeEl);
        }

        projectsList.appendChild(newCard);
        projectsList.appendChild(footerRow);

        // Remove the accepted request card
        requestCard.remove();

        // Scroll to the new project card
        newCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.addEventListener('click', function(e) {
        if (helpActive) return;

        const acceptBtn = e.target.closest('.wide-btn--accept');
        if (acceptBtn) {
            const requestCard = acceptBtn.closest('.request-card');
            if (requestCard) acceptRequest(requestCard);
            return;
        }

        const dismissBtn = e.target.closest('.wide-btn--dismiss');
        if (dismissBtn) {
            const requestCard = dismissBtn.closest('.request-card');
            if (requestCard) requestCard.remove();
            return;
        }

        const buyBtn = e.target.closest('.wide-btn--buy');
        if (buyBtn) {
            const featureCard = buyBtn.closest('.feature-card-wrapper');
            if (featureCard) purchaseFeature(featureCard, buyBtn);
        }
    });

    // -------------------- FEATURE PURCHASE FLOW --------------------
    const PURCHASED_FEATURES_KEY = 'stagecord:purchased-features';
    const FEATURE_STATS_KEY = 'stagecord:feature-stats';

    function isOpenFeature(wrapper) {
        const badge = wrapper.querySelector('.feature-badge');
        return !!(badge && badge.textContent.trim() === 'Open');
    }

    function loadFeatureStats() {
        try { return JSON.parse(localStorage.getItem(FEATURE_STATS_KEY) || '{}'); }
        catch (e) { return {}; }
    }

    function saveFeatureStats(stats) {
        try { localStorage.setItem(FEATURE_STATS_KEY, JSON.stringify(stats)); }
        catch (e) { /* storage disabled */ }
    }

    function ensureFeatureStatsElement(wrapper) {
        if (!isOpenFeature(wrapper)) return null;
        let el = wrapper.querySelector('.feature-stats');
        if (!el) {
            el = document.createElement('div');
            el.className = 'feature-stats';
            el.setAttribute('data-help', 'Salgsstatistik: Antal gange dette Open-feature er blevet købt og den samlede indtjening.');
            const card = wrapper.querySelector('.feature-card');
            if (card) card.insertAdjacentElement('afterend', el);
            else wrapper.appendChild(el);
        }
        return el;
    }

    function renderFeatureStats(wrapper) {
        const el = ensureFeatureStatsElement(wrapper);
        if (!el) return;
        const titleEl = wrapper.querySelector('.feature-avatar__title');
        if (!titleEl) return;
        const key = titleEl.textContent.trim();
        const stored = loadFeatureStats()[key];

        // Always prefer the feature's listed currency. For new features with no
        // sales yet, stored stats don't exist — fall back to reading the price.
        let currency = 'DKK';
        const priceEl = wrapper.querySelector('.feature-price');
        if (priceEl) {
            const parts = priceEl.textContent.trim().split(/\s+/);
            if (parts.length > 1) currency = parts[parts.length - 1];
        }
        if (stored && stored.currency) currency = stored.currency;

        const stats = stored || { count: 0, total: 0 };
        const formatted = (stats.total || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        const label = stats.count === 1 ? 'purchase' : 'purchases';
        el.innerHTML =
            '<span class="feature-stats__value">' + stats.count + '</span> ' + label +
            '<span class="feature-stats__divider">·</span>' +
            '<span class="feature-stats__value">' + formatted + ' ' + currency + '</span> earned';
    }

    function recordOpenFeaturePurchase(wrapper) {
        const titleEl = wrapper.querySelector('.feature-avatar__title');
        const priceEl = wrapper.querySelector('.feature-price');
        if (!titleEl || !priceEl) return;
        const priceText = priceEl.textContent.trim();
        const numPrice = parseFloat(priceText.replace(/[^0-9.-]/g, '')) || 0;
        const parts = priceText.split(/\s+/);
        const currency = parts.length > 1 ? parts[parts.length - 1] : 'DKK';
        const key = titleEl.textContent.trim();
        const stats = loadFeatureStats();
        if (!stats[key]) stats[key] = { count: 0, total: 0, currency: currency };
        stats[key].count += 1;
        stats[key].total += numPrice;
        stats[key].currency = currency;
        saveFeatureStats(stats);
        renderFeatureStats(wrapper);
    }

    function renderAllOpenFeatureStats() {
        document.querySelectorAll('.feature-card-wrapper').forEach(renderFeatureStats);
    }

    function extractFeatureData(wrapper) {
        const badge = wrapper.querySelector('.feature-badge');
        const card = wrapper.querySelector('.feature-card');
        const avatarImg = card.querySelector('.feature-avatar__image');
        const title = card.querySelector('.feature-avatar__title');
        const description = card.querySelectorAll('.feature-description__item');
        const price = card.querySelector('.feature-price');
        const profileName = document.querySelector('.profile-name');
        return {
            type: badge ? badge.textContent.trim() : 'Feature',
            title: title ? title.textContent.trim() : '',
            initials: avatarImg ? avatarImg.textContent.trim() : '',
            avatarColor: avatarImg ? (avatarImg.style.backgroundColor || '#4A90E2') : '#4A90E2',
            price: price ? price.textContent.trim() : '',
            description: Array.from(description).map(function(el) { return el.innerHTML; }),
            artistName: profileName ? profileName.textContent.trim() : 'Unknown Artist',
            aiRules: wrapper.dataset.aiRules || '',
            aiForbidden: wrapper.dataset.aiForbidden || '',
            aiAttempts: wrapper.dataset.aiAttempts || '',
            purchasedAt: new Date().toISOString()
        };
    }

    function savePurchasedFeature(data) {
        let list = [];
        try {
            list = JSON.parse(localStorage.getItem(PURCHASED_FEATURES_KEY) || '[]');
        } catch (e) { list = []; }
        list.push(data);
        try {
            localStorage.setItem(PURCHASED_FEATURES_KEY, JSON.stringify(list));
        } catch (e) { /* storage full or disabled */ }
    }

    function showPurchaseToast(data) {
        const toast = document.createElement('div');
        toast.className = 'purchase-toast';
        toast.innerHTML =
            '<strong>' + data.title + '</strong> purchased for ' + data.price + '. ' +
            '<a href="projects/index.html">View in Projects →</a>';
        document.body.appendChild(toast);
        setTimeout(function() { toast.classList.add('visible'); }, 10);
        setTimeout(function() {
            toast.classList.remove('visible');
            setTimeout(function() { toast.remove(); }, 300);
        }, 5000);
    }

    function purchaseFeature(wrapper, buyBtn) {
        const data = extractFeatureData(wrapper);
        savePurchasedFeature(data);

        if (isOpenFeature(wrapper)) {
            // Open: multiple buyers allowed — record sale and leave the
            // button active so more buyers can purchase.
            recordOpenFeaturePurchase(wrapper);
        } else {
            // Exclusive / AI Voice: one-time purchase.
            buyBtn.disabled = true;
            buyBtn.classList.add('wide-btn--purchased');
            buyBtn.textContent = 'Purchased';
        }

        showPurchaseToast(data);
    }

    // -------------------- RENDER PURCHASED FEATURES ON PROJECTS PAGE --------------------
    // The projects page has a .projects-list. When it exists, read localStorage
    // and append each purchased feature as a feature-card at the bottom.
    function renderPurchasedFeatures() {
        const projectsListEl = document.querySelector('.projects-list');
        if (!projectsListEl) return;

        let list = [];
        try {
            list = JSON.parse(localStorage.getItem(PURCHASED_FEATURES_KEY) || '[]');
        } catch (e) { return; }
        if (list.length === 0) return;

        list.forEach(function(data) {
            projectsListEl.appendChild(buildPurchasedFeatureCard(data));
        });
    }

    function buildPurchasedFeatureCard(data) {
        const wrapper = document.createElement('div');
        wrapper.className = 'feature-card-wrapper';
        const descItemsHTML = (data.description || []).map(function(html) {
            return '<span class="feature-description__item">' + html + '</span>';
        }).join('');

        const isAi = (data.type === 'AI Voice');
        // Prefer the *current* logged-in profile name so the card always
        // reflects who is viewing it, even across sessions.
        const sidebarProfile = document.querySelector('.profile-name');
        const artistName = (sidebarProfile && sidebarProfile.textContent.trim()) || data.artistName || '';

        // Every purchased feature shows the artist's name. AI Voice adds a
        // green "AI" prefix badge that disappears when the seller accepts
        // the buyer's song.
        const attributionHTML =
            '<div class="ai-attribution' + (isAi ? '' : ' ai-attribution--accepted') + '">' +
                '<span class="ai-attribution__prefix">AI</span>' +
                '<span class="ai-attribution__name">' + artistName + '</span>' +
            '</div>';

        const lastColumnHTML = isAi ?
            '<div class="button-group ai-submission">' +
                '<span class="button-group__label">Submission</span>' +
                '<span class="ai-submission__status">Song not submitted yet.</span>' +
                '<button class="wide-btn wide-btn--buy ai-submit-btn" type="button">Submit song for approval</button>' +
            '</div>'
            :
            '<div class="button-group feature-purchase">' +
                '<span class="button-group__label">Paid</span>' +
                '<span class="feature-price">' + data.price + '</span>' +
            '</div>';

        wrapper.innerHTML =
            '<span class="feature-badge feature-badge--purchased">Purchased · ' + data.type + '</span>' +
            attributionHTML +
            '<article class="feature-card">' +
                '<div class="feature-card__body">' +
                    '<div class="feature-avatar">' +
                        '<div class="feature-avatar__image" style="background:' + data.avatarColor + ';">' + data.initials + '</div>' +
                        '<span class="feature-avatar__title">' + data.title + '</span>' +
                    '</div>' +
                    '<div class="button-group">' +
                        '<span class="button-group__label">Description</span>' +
                        '<div class="feature-description">' + descItemsHTML + '</div>' +
                    '</div>' +
                    '<div class="button-group">' +
                        '<span class="button-group__label">Sound snip</span>' +
                        '<div class="feature-snip">' +
                            '<button type="button" class="feature-play-btn" aria-label="Play preview">' +
                                '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 5v14l11-7L8 5z"/></svg>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="button-group">' +
                        '<span class="button-group__label">Files</span>' +
                        '<div class="action-col">' +
                            '<button class="pill-btn" type="button">WAVE</button>' +
                            '<button class="pill-btn" type="button">MP3</button>' +
                            '<button class="pill-btn" type="button">Lyrics</button>' +
                        '</div>' +
                    '</div>' +
                    lastColumnHTML +
                '</div>' +
            '</article>';

        if (isAi) wireAiSubmissionFlow(wrapper);
        return wrapper;
    }

    // Submit → Pending → Accept/Reject flow for purchased AI Voice features
    function wireAiSubmissionFlow(wrapper) {
        const submitBtn = wrapper.querySelector('.ai-submit-btn');
        const statusEl = wrapper.querySelector('.ai-submission__status');
        const attribution = wrapper.querySelector('.ai-attribution');
        const submissionCol = wrapper.querySelector('.ai-submission');
        if (!submitBtn || !statusEl || !submissionCol) return;

        submitBtn.addEventListener('click', function() {
            if (helpActive) return;
            // Move to Pending state — simulate seller decision buttons
            statusEl.textContent = 'Pending approval by artist…';
            statusEl.classList.add('ai-submission__status--pending');
            submitBtn.remove();

            // Add simulated seller action buttons
            const actions = document.createElement('div');
            actions.className = 'ai-submission__actions';
            actions.innerHTML =
                '<button class="wide-btn wide-btn--buy" type="button" data-action="accept">Seller accepts</button>' +
                '<button class="wide-btn" type="button" data-action="reject">Seller rejects</button>';
            actions.style.display = 'flex';
            actions.style.flexDirection = 'column';
            actions.style.gap = 'var(--project-gap, 10px)';
            submissionCol.appendChild(actions);

            actions.querySelector('[data-action="accept"]').addEventListener('click', function() {
                if (helpActive) return;
                if (attribution) attribution.classList.add('ai-attribution--accepted');
                statusEl.textContent = 'Accepted — song listed under the artist\'s own name.';
                statusEl.classList.remove('ai-submission__status--pending');
                statusEl.classList.add('ai-submission__status--accepted');
                actions.remove();
            });

            actions.querySelector('[data-action="reject"]').addEventListener('click', function() {
                if (helpActive) return;
                statusEl.textContent = 'Submission rejected — track stays listed as AI.';
                statusEl.classList.remove('ai-submission__status--pending');
                statusEl.classList.add('ai-submission__status--rejected');
                actions.remove();

                const retry = document.createElement('button');
                retry.className = 'wide-btn wide-btn--buy';
                retry.type = 'button';
                retry.textContent = 'Submit new song';
                retry.style.width = '100%';
                retry.addEventListener('click', function() {
                    retry.remove();
                    statusEl.classList.remove('ai-submission__status--rejected');
                    submissionCol.appendChild(submitBtn);
                    statusEl.textContent = 'Song not submitted yet.';
                });
                submissionCol.appendChild(retry);
            });
        });
    }

    renderPurchasedFeatures();
    renderAllOpenFeatureStats();

    // -------------------- ARTIST POSTS --------------------
    const feed = document.querySelector('.artist-feed');

    // Click on the post text to expand/collapse the truncation
    document.querySelectorAll('.artist-post__text').forEach(function(text) {
        text.addEventListener('click', function() {
            if (helpActive) return;
            const post = text.closest('.artist-post');
            if (!post) return;
            const expanded = post.classList.toggle('expanded');
            text.setAttribute('title', expanded ? 'Click to collapse' : 'Click to expand');
        });
    });

    // Comments toggle — open one post's thread, blur the rest of the feed
    document.querySelectorAll('.artist-post__comments-toggle').forEach(function(btn) {
        btn.addEventListener('click', function() {
            if (helpActive) return;
            const post = btn.closest('.artist-post');
            const commentsEl = post && post.querySelector('.artist-post__comments');
            if (!post || !commentsEl) return;

            const isOpening = commentsEl.hasAttribute('hidden');

            // Close every other post first
            document.querySelectorAll('.artist-post').forEach(function(p) {
                p.classList.remove('is-active');
                const c = p.querySelector('.artist-post__comments');
                const t = p.querySelector('.artist-post__comments-toggle');
                if (c) c.setAttribute('hidden', '');
                if (t) t.setAttribute('aria-expanded', 'false');
            });

            if (isOpening) {
                commentsEl.removeAttribute('hidden');
                btn.setAttribute('aria-expanded', 'true');
                post.classList.add('is-active');
                if (feed) feed.classList.add('has-active');
                post.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                if (feed) feed.classList.remove('has-active');
            }
        });
    });

    // Generic like-toggle: post likes, comment likes, photo likes
    function bindLikeToggle(selector, countSelector) {
        document.querySelectorAll(selector).forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                if (helpActive) return;
                e.stopPropagation();
                const wasPressed = btn.getAttribute('aria-pressed') === 'true';
                btn.setAttribute('aria-pressed', wasPressed ? 'false' : 'true');
                const countEl = btn.querySelector(countSelector);
                if (!countEl) return;
                const raw = countEl.textContent.trim();
                // Increment/decrement small numbers; leave string-formatted (e.g. "1.2K") alone
                const num = parseInt(raw, 10);
                if (!isNaN(num) && raw === String(num)) {
                    countEl.textContent = String(num + (wasPressed ? -1 : 1));
                }
            });
        });
    }

    bindLikeToggle('.artist-post__like', '.artist-post__like-count');
    bindLikeToggle('.artist-comment__like', '.count');
    bindLikeToggle('.event-photo__like', '.event-photo__count');

    // Submit a new comment — appended to the bottom of that post's comment list
    document.querySelectorAll('.artist-comment-form').forEach(function(form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            if (helpActive) return;
            const input = form.querySelector('.artist-comment-form__input');
            if (!input) return;
            const text = input.value.trim();
            if (!text) return;

            const list = form.parentElement.querySelector('.artist-post__comment-list');
            if (!list) return;

            const li = document.createElement('li');
            li.className = 'artist-comment';
            li.innerHTML =
                '<div class="artist-comment__avatar" style="background: url(\'' + localAsset('assets/images/artists/placeholder-male-5.png') + '\') center/cover;"></div>' +
                '<div class="artist-comment__main">' +
                    '<div class="artist-comment__body"><strong>You:</strong> ' + escapeHtml(text) + '</div>' +
                    '<div class="artist-comment__actions">' +
                        '<button type="button" class="artist-comment__like" aria-pressed="false"><span class="heart">♥</span><span class="count">0</span></button>' +
                        '<button type="button" class="artist-comment__reply">Reply</button>' +
                    '</div>' +
                '</div>';

            list.appendChild(li);

            // Auto-format any STAGECORD typed by the user
            formatStagecord(li);

            // Wire up like-toggle on the new comment
            const newLike = li.querySelector('.artist-comment__like');
            newLike.addEventListener('click', function(ev) {
                ev.stopPropagation();
                const pressed = newLike.getAttribute('aria-pressed') === 'true';
                newLike.setAttribute('aria-pressed', pressed ? 'false' : 'true');
                const c = newLike.querySelector('.count');
                const n = parseInt(c.textContent, 10) || 0;
                c.textContent = String(n + (pressed ? -1 : 1));
            });

            input.value = '';
            li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    });

    const escapeHtml = SC.escapeHtml;

    // -------------------- ARTIST EVENT MODAL --------------------
    const eventModal = document.getElementById('eventModal');

    function openEventModal(data) {
        if (!eventModal) return;
        eventModal.querySelector('#eventModalDate').textContent = data.date || '';
        eventModal.querySelector('#eventModalVenue').textContent = data.venue || '';
        eventModal.querySelector('#eventModalTime').textContent = data.time || '';
        eventModal.querySelector('#eventModalDescription').textContent = data.description || '';

        // Concert ticket option — toggle sold-out state
        const ticketPriceEl = eventModal.querySelector('#eventModalTicketPrice');
        const ticketBtn = eventModal.querySelector('#eventModalTicketBtn');
        if (data.ticketsAvailable) {
            ticketPriceEl.textContent = data.ticketPrice || '';
            ticketPriceEl.classList.remove('event-modal__option-price--soldout');
            ticketBtn.disabled = false;
            ticketBtn.textContent = 'Buy ticket';
        } else {
            ticketPriceEl.textContent = 'Sold out';
            ticketPriceEl.classList.add('event-modal__option-price--soldout');
            ticketBtn.disabled = true;
            ticketBtn.textContent = 'Sold out';
        }

        // Online viewer option — always available
        eventModal.querySelector('#eventModalViewerPrice').textContent = data.viewerPrice || '';

        // Reset entourage picker each time the modal opens
        const pickEl = eventModal.querySelector('#eventModalEntouragePick');
        const totalEl = eventModal.querySelector('#eventModalEntourageTotal');
        const entourageBtn = eventModal.querySelector('#eventModalEntourageBtn');
        if (pickEl) pickEl.value = '';
        if (totalEl) totalEl.textContent = '— DKK';
        if (entourageBtn) {
            entourageBtn.disabled = !data.ticketsAvailable;
            entourageBtn.textContent = data.ticketsAvailable ? 'Buy for entourage' : 'Sold out';
        }
        // Stash the per-ticket numeric price + currency for total calculation
        eventModal.dataset.unitPrice = (data.ticketPrice || '').replace(/[^0-9.,]/g, '').replace(/,/g, '');
        const parts = (data.ticketPrice || '').split(/\s+/);
        eventModal.dataset.currency = parts.length > 1 ? parts[parts.length - 1] : 'DKK';

        eventModal.classList.add('open');
        eventModal.setAttribute('aria-hidden', 'false');
    }

    // ---------- ENTOURAGE PURCHASE — future business rules (backend) ----------
    // When the user confirms an entourage purchase:
    //   1. Charge each member their per-head share of the ticket price.
    //   2. On success: a ticket is added to that member's "purchased tickets" list.
    //   3. On charge failure (insufficient funds, declined card, etc.):
    //        - If the event is more than 2 weeks away → place the ticket on
    //          RESERVATION; the member has 3 days to settle the payment.
    //        - If the event is less than 2 weeks away → reservation is not allowed
    //          and the entire group purchase is rolled back.
    //   4. For a 2-person entourage where one member fails to pay, BOTH tickets are
    //      cancelled so no member ends up attending alone.
    //   5. Tickets are non-transferable until paid — the QR-code is generated only
    //      after successful payment.

    // Recalculate the entourage total when the user picks a group
    const entouragePick = document.getElementById('eventModalEntouragePick');
    const entourageTotalEl = document.getElementById('eventModalEntourageTotal');
    const entourageBuyBtn = document.getElementById('eventModalEntourageBtn');
    if (entouragePick) {
        entouragePick.addEventListener('change', function() {
            if (!entourageTotalEl || !eventModal) return;
            const opt = entouragePick.options[entouragePick.selectedIndex];
            const members = opt ? parseInt(opt.dataset.members, 10) : 0;
            const unit = parseFloat(eventModal.dataset.unitPrice || '0');
            const currency = eventModal.dataset.currency || 'DKK';
            const ticketsAvailable = entourageBuyBtn && !entourageBuyBtn.dataset.soldout;

            if (members > 0 && unit > 0) {
                const total = (members * unit).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
                entourageTotalEl.textContent = total + ' ' + currency;
                if (entourageBuyBtn) {
                    entourageBuyBtn.disabled = !ticketsAvailable;
                    entourageBuyBtn.textContent = ticketsAvailable
                        ? 'Buy ' + members + ' tickets for entourage'
                        : 'Sold out';
                }
            } else {
                entourageTotalEl.textContent = '— ' + currency;
                if (entourageBuyBtn) {
                    entourageBuyBtn.disabled = true;
                    entourageBuyBtn.textContent = 'Buy for entourage';
                }
            }
        });
    }

    function closeEventModal() {
        if (!eventModal) return;
        eventModal.classList.remove('open');
        eventModal.setAttribute('aria-hidden', 'true');
    }

    if (eventModal) {
        // Backdrop click
        eventModal.addEventListener('click', function(e) {
            if (e.target === eventModal) closeEventModal();
        });
        // Close button
        eventModal.querySelectorAll('[data-close-modal]').forEach(function(btn) {
            btn.addEventListener('click', closeEventModal);
        });
        // Esc key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && eventModal.classList.contains('open')) closeEventModal();
        });
    }

    // Click an event-day → open the modal with its data
    document.querySelectorAll('.artist-calendar__day--event').forEach(function(day) {
        day.addEventListener('click', function() {
            if (helpActive) return;
            const d = day.dataset;
            openEventModal({
                date: d.eventDate,
                venue: d.eventVenue,
                time: d.eventTime,
                description: d.eventDescription,
                ticketPrice: d.eventTicketPrice,
                viewerPrice: d.eventViewerPrice,
                ticketsAvailable: d.eventTicketsAvailable === 'true'
            });
        });
    });

    // -------------------- ARTIST BIO EXPAND/COLLAPSE --------------------
    function toggleBio(bio) {
        const expanded = bio.classList.toggle('expanded');
        const text = bio.querySelector('.artist-bio__text');
        if (text) {
            text.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            text.setAttribute('title', expanded ? 'Click to collapse' : 'Click to expand');
        }
    }

    // Click anywhere on the bio text to toggle expand/collapse
    document.querySelectorAll('.artist-bio__text').forEach(function(text) {
        text.addEventListener('click', function() {
            if (helpActive) return;
            const bio = text.closest('.artist-bio');
            if (!bio) return;
            toggleBio(bio);
        });
        // Keyboard support: Enter / Space
        text.addEventListener('keydown', function(e) {
            const bio = text.closest('.artist-bio');
            if (!bio) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleBio(bio);
            }
        });
    });


    // -------------------- FEATURES PAGE: NEW + EDIT --------------------
    const featuresList = document.querySelector('.features-list');
    const newFeatureBtn = document.getElementById('newFeatureBtn');
    const editFeaturesBtn = document.getElementById('editFeaturesBtn');

    let featureCardTemplateHTML = '';
    let featureCounter = 1;
    if (featuresList) {
        const firstFeature = featuresList.querySelector('.feature-card-wrapper');
        if (firstFeature) featureCardTemplateHTML = firstFeature.outerHTML;
    }

    // ---------- New Feature Modal ----------
    const newFeatureModal = document.getElementById('newFeatureModal');
    const newFeatureForm = document.getElementById('newFeatureForm');
    const royaltyRange = newFeatureModal ? newFeatureModal.querySelector('input[name="royaltySplit"]') : null;
    const yourShareLabel = newFeatureModal ? newFeatureModal.querySelector('.your-share') : null;
    const buyerShareLabel = newFeatureModal ? newFeatureModal.querySelector('.buyer-share') : null;

    function updateRoyaltyLabels() {
        if (!royaltyRange || !yourShareLabel || !buyerShareLabel) return;
        const val = parseInt(royaltyRange.value, 10);
        yourShareLabel.textContent = val + '%';
        buyerShareLabel.textContent = (100 - val) + '%';
    }

    if (royaltyRange) royaltyRange.addEventListener('input', updateRoyaltyLabels);

    // AI Voice type toggles extra fields (rules / forbidden / max attempts)
    const aiFieldset = newFeatureForm ? newFeatureForm.querySelector('.form-field--ai-only') : null;
    function updateAiFieldVisibility() {
        if (!newFeatureForm || !aiFieldset) return;
        const selected = newFeatureForm.querySelector('input[name="type"]:checked');
        const isAi = selected && selected.value === 'AI Voice';
        if (isAi) aiFieldset.removeAttribute('hidden');
        else aiFieldset.setAttribute('hidden', '');
    }
    if (newFeatureForm) {
        newFeatureForm.querySelectorAll('input[name="type"]').forEach(function(r) {
            r.addEventListener('change', updateAiFieldVisibility);
        });
    }

    function openNewFeatureModal() {
        if (!newFeatureModal) return;
        newFeatureModal.classList.add('open');
        newFeatureModal.setAttribute('aria-hidden', 'false');
        const first = newFeatureModal.querySelector('input[name="title"]');
        if (first) setTimeout(function() { first.focus(); }, 30);
    }

    function closeNewFeatureModal() {
        if (!newFeatureModal) return;
        newFeatureModal.classList.remove('open');
        newFeatureModal.setAttribute('aria-hidden', 'true');
        if (newFeatureForm) newFeatureForm.reset();
        if (royaltyRange) royaltyRange.value = 50;
        updateRoyaltyLabels();
    }

    if (newFeatureModal) {
        // Close on backdrop click
        newFeatureModal.addEventListener('click', function(e) {
            if (e.target === newFeatureModal) closeNewFeatureModal();
        });
        // Close buttons
        newFeatureModal.querySelectorAll('[data-close-modal]').forEach(function(btn) {
            btn.addEventListener('click', closeNewFeatureModal);
        });
        // Esc closes
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && newFeatureModal.classList.contains('open')) {
                closeNewFeatureModal();
            }
        });
    }

    if (newFeatureBtn) {
        newFeatureBtn.addEventListener('click', function() {
            if (helpActive) return;
            openNewFeatureModal();
        });
    }

    // Handle submit — build the feature card from form values
    if (newFeatureForm && featuresList) {
        newFeatureForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (!featureCardTemplateHTML) return;

            const formData = new FormData(newFeatureForm);
            const title = (formData.get('title') || '').toString().trim() || ('New feature ' + featureCounter);
            const type = (formData.get('type') || 'Exclusive').toString();
            const priceRaw = parseFloat(formData.get('price'));
            const price = isNaN(priceRaw) ? 0 : priceRaw;
            const currency = (formData.get('currency') || 'DKK').toString();
            const split = parseInt(formData.get('royaltySplit'), 10) || 50;

            const files = {};
            ['wave', 'mp3', 'lyrics'].forEach(function(k) {
                const f = formData.get(k);
                if (f && f.name) files[k] = f.name;
            });

            // Build a new feature from the template
            const holder = document.createElement('div');
            holder.innerHTML = featureCardTemplateHTML;
            const newFeature = holder.firstElementChild;

            // Title + initials
            const titleEl = newFeature.querySelector('.feature-avatar__title');
            const imageEl = newFeature.querySelector('.feature-avatar__image');
            if (titleEl) titleEl.textContent = title;
            if (imageEl) {
                imageEl.textContent = title.substring(0, 3).toUpperCase();
                imageEl.style.background = '#4A90E2';
            }

            // Badge (Exclusive / Open)
            const badgeEl = newFeature.querySelector('.feature-badge');
            if (badgeEl) {
                badgeEl.textContent = type;
                badgeEl.className = 'feature-badge feature-badge--' + type.toLowerCase();
            }

            // Price (formatted with the chosen currency)
            const priceEl = newFeature.querySelector('.feature-price');
            if (priceEl) {
                priceEl.textContent = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
            }

            // Open features: remove negotiate button
            if (type === 'Open') {
                const negotiateBtn = newFeature.querySelector('.feature-purchase .wide-btn:not(.wide-btn--buy)');
                if (negotiateBtn) negotiateBtn.remove();
            }

            // Reset buy button state
            const buyBtn = newFeature.querySelector('.wide-btn--buy');
            if (buyBtn) {
                buyBtn.disabled = false;
                buyBtn.textContent = 'Buy feature project';
                buyBtn.classList.remove('wide-btn--purchased');
            }

            // Unlock files that were uploaded (show them active)
            if (files.wave || files.mp3 || files.lyrics) {
                const filePills = newFeature.querySelectorAll('.feature-files .pill-btn');
                const labelOrder = ['WAVE', 'MP3', 'Lyrics'];
                filePills.forEach(function(btn) {
                    const label = btn.textContent.trim();
                    const key = label.toLowerCase();
                    if (files[key]) {
                        btn.disabled = false;
                        btn.title = files[key];
                    }
                });
            }

            // Store metadata as data attributes for future use
            newFeature.dataset.featureType = type;
            newFeature.dataset.currency = currency;
            newFeature.dataset.royaltySplit = split;
            if (files.wave) newFeature.dataset.fileWave = files.wave;
            if (files.mp3) newFeature.dataset.fileMp3 = files.mp3;
            if (files.lyrics) newFeature.dataset.fileLyrics = files.lyrics;

            // AI Voice specifics
            if (type === 'AI Voice') {
                const aiRules = (formData.get('aiRules') || '').toString().trim();
                const aiForbidden = (formData.get('aiForbidden') || '').toString().trim();
                const aiAttempts = parseInt(formData.get('aiAttempts'), 10) || 3;
                if (aiRules) newFeature.dataset.aiRules = aiRules;
                if (aiForbidden) newFeature.dataset.aiForbidden = aiForbidden;
                newFeature.dataset.aiAttempts = aiAttempts;
                // Remove negotiate button — AI Voice is take-it-or-leave-it
                const negotiateBtn = newFeature.querySelector('.feature-purchase .wide-btn:not(.wide-btn--buy)');
                if (negotiateBtn) negotiateBtn.remove();
            }

            featuresList.appendChild(newFeature);
            featureCounter++;

            // Show sales stats if this is an Open feature
            if (type === 'Open') renderFeatureStats(newFeature);

            closeNewFeatureModal();
            newFeature.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // Edit mode: make every feature's title + price contenteditable
    function setFeatureFieldsEditable(wrapperOrCard, on, focusTitle) {
        const title = wrapperOrCard.querySelector('.feature-avatar__title');
        const price = wrapperOrCard.querySelector('.feature-price');
        [title, price].forEach(function(el) {
            if (!el) return;
            if (on) {
                el.dataset.prev = el.textContent.trim();
                el.setAttribute('contenteditable', 'true');
                el.classList.add('feature-editable');
            } else {
                const text = el.textContent.trim();
                if (!text && el.dataset.prev) el.textContent = el.dataset.prev;
                else el.textContent = text;
                el.setAttribute('contenteditable', 'false');
                el.classList.remove('feature-editable');
                delete el.dataset.prev;
            }
        });
        if (on && focusTitle && title) {
            title.focus();
            const range = document.createRange();
            range.selectNodeContents(title);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    function setFeaturesEditMode(on) {
        if (!editFeaturesBtn || !featuresList) return;
        editFeaturesBtn.classList.toggle('active', on);
        editFeaturesBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        featuresList.classList.toggle('editing-features', on);

        const wrappers = featuresList.querySelectorAll('.feature-card-wrapper');
        wrappers.forEach(function(wrap, i) {
            setFeatureFieldsEditable(wrap, on, on && i === 0);
        });

        // Purchased features: edit mode toggles downloads ↔ merge selection
        const purchasedSection = document.querySelector('.purchased-features');
        if (purchasedSection) {
            purchasedSection.classList.toggle('editing', on);
            if (!on) {
                // Leaving edit mode: clear any selection so the merge bar resets
                purchasedSection.querySelectorAll('input[data-purchased-check]').forEach(function(cb) { cb.checked = false; });
                purchasedSection.querySelectorAll('.purchased-card.is-selected').forEach(function(c) { c.classList.remove('is-selected'); });
                const actions = document.getElementById('purchasedActions');
                if (actions) actions.hidden = true;
            }
        }
    }

    if (editFeaturesBtn) {
        editFeaturesBtn.addEventListener('click', function() {
            if (helpActive) return;
            setFeaturesEditMode(!editFeaturesBtn.classList.contains('active'));
        });
    }

    // Enter commits / Esc reverts for feature-title and feature-price
    if (featuresList) {
        featuresList.addEventListener('keydown', function(e) {
            const t = e.target;
            if (!t || !t.classList) return;
            if (!(t.classList.contains('feature-avatar__title') || t.classList.contains('feature-price'))) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                t.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                if (t.dataset.prev != null) t.textContent = t.dataset.prev;
                t.blur();
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && editFeaturesBtn && editFeaturesBtn.classList.contains('active')) {
            setFeaturesEditMode(false);
        }
    });

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // -------------------- LOGIN — view switching + reset flow --------------------
    const loginForm = document.getElementById('loginForm');
    const forgotForm = document.getElementById('forgotForm');
    if (loginForm || forgotForm) {
        const views = document.querySelectorAll('[data-login-view]');
        function showView(name) {
            views.forEach(function(v) { v.hidden = (v.dataset.loginView !== name); });
        }

        document.querySelectorAll('[data-login-forgot]').forEach(function(btn) {
            btn.addEventListener('click', function() { showView('forgot'); });
        });
        document.querySelectorAll('[data-login-back]').forEach(function(btn) {
            btn.addEventListener('click', function() { showView('login'); });
        });

        // Password show/hide
        const pwToggle = document.getElementById('loginPwToggle');
        const pwInput = document.getElementById('login-password');
        if (pwToggle && pwInput) {
            pwToggle.addEventListener('click', function() {
                const isPw = pwInput.type === 'password';
                pwInput.type = isPw ? 'text' : 'password';
                pwToggle.classList.toggle('is-visible', isPw);
                pwToggle.setAttribute('aria-label', isPw ? 'Hide password' : 'Show password');
            });
        }

        if (loginForm) {
            loginForm.addEventListener('submit', function(e) {
                e.preventDefault();
                // Mock auth: any input passes through to the fan profile
                window.location.href = '../fan/index.html';
            });
        }

        if (forgotForm) {
            forgotForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const email = (document.getElementById('forgot-email').value || '').trim();
                const echo = document.getElementById('sentEmailEcho');
                if (echo && email) echo.textContent = email;
                showView('sent');
            });
        }

        // Resend on the "sent" view re-triggers the same flow
        document.querySelectorAll('[data-login-resend]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                btn.textContent = 'sent again ✓';
                setTimeout(function() { btn.textContent = 'resend'; }, 2200);
            });
        });
    }

    // -------------------- SIGN UP — redirect to Artist profile --------------------
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // Future: validate fields and save user data here.
            // For now, redirect straight to the Artist profile.
            window.location.href = '../artist/index.html';
        });
    }

    // -------------------- ARTIST SETTINGS — tabs, rewards, modal --------------------
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsPanels = document.querySelectorAll('.settings-panel');
    if (settingsTabs.length && settingsPanels.length) {
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const target = this.dataset.tab;
                settingsTabs.forEach(t => {
                    const isActive = t === this;
                    t.classList.toggle('active', isActive);
                    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
                });
                settingsPanels.forEach(p => {
                    p.classList.toggle('active', p.dataset.panel === target);
                });
            });
        });
    }

    const rewardModal = document.getElementById('rewardModal');
    const newRewardBtn = document.getElementById('newRewardBtn');
    const rewardForm = document.getElementById('rewardForm');
    const rewardList = document.getElementById('rewardList');

    function openRewardModal() {
        if (!rewardModal) return;
        rewardModal.classList.add('open');
        rewardModal.setAttribute('aria-hidden', 'false');
        const firstInput = rewardModal.querySelector('input, select');
        if (firstInput) setTimeout(() => firstInput.focus(), 0);
    }

    function closeRewardModal() {
        if (!rewardModal) return;
        rewardModal.classList.remove('open');
        rewardModal.setAttribute('aria-hidden', 'true');
        if (rewardForm) {
            rewardForm.reset();
            delete rewardForm.dataset.editingId;
            const submitBtn = rewardForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = 'Save reward';
            const heading = rewardModal.querySelector('.modal__header h2');
            if (heading) heading.textContent = 'New fan reward';
        }
    }

    if (newRewardBtn) {
        newRewardBtn.addEventListener('click', openRewardModal);
    }

    if (rewardModal) {
        rewardModal.addEventListener('click', function(e) {
            if (e.target === rewardModal) closeRewardModal();
            if (e.target.closest('[data-close-modal]')) closeRewardModal();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && rewardModal && rewardModal.classList.contains('open')) {
            closeRewardModal();
        }
    });

    function triggerLabel(type, threshold) {
        const labels = {
            concerts: 'concerts attended',
            months:   'months following',
            tickets:  'tickets purchased',
            merch:    'merch items purchased',
            streams:  'streams played'
        };
        return `${threshold}+ ${labels[type] || type}`;
    }

    function rewardLabel(type, value, applies) {
        const scope = {
            all:      'all purchases',
            tickets:  'tickets',
            merch:    'merch',
            features: 'features'
        }[applies] || 'all purchases';
        if (type === 'percent')   return `${value}% off ${scope}`;
        if (type === 'amount')    return `${value} DKK off ${scope}`;
        if (type === 'freeship')  return `Free shipping on ${scope}`;
        if (type === 'exclusive') return `Exclusive access for ${scope}`;
        return '';
    }

    function buildRewardCard(data) {
        const li = document.createElement('li');
        li.className = 'reward-card';
        li.dataset.triggerType = data.triggerType;
        li.dataset.triggerThreshold = data.triggerThreshold;
        li.dataset.rewardType = data.rewardType;
        if (data.rewardValue) li.dataset.rewardValue = data.rewardValue;
        li.dataset.rewardApplies = data.applies;

        li.innerHTML = `
            <div class="reward-card__main">
                <div class="reward-card__name auto-name">${data.name}</div>
                <p class="reward-card__desc">Custom reward program.</p>
            </div>
            <div class="reward-card__rule">
                <div class="reward-card__rule-line"><span class="reward-card__rule-key">Trigger</span><span class="reward-card__rule-value">${triggerLabel(data.triggerType, data.triggerThreshold)}</span></div>
                <div class="reward-card__rule-line"><span class="reward-card__rule-key">Reward</span><span class="reward-card__rule-value reward-card__rule-value--green">${rewardLabel(data.rewardType, data.rewardValue, data.applies)}</span></div>
            </div>
            <div class="reward-card__actions">
                <label class="reward-toggle"><input type="checkbox" checked><span class="reward-toggle__slider"></span></label>
                <button type="button" class="reward-card__icon-btn" aria-label="Edit reward">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M15.2 4.4l4.4 4.4M3 21l4.6-1.1L20 7.4a1.5 1.5 0 0 0 0-2.1l-1.3-1.3a1.5 1.5 0 0 0-2.1 0L4.1 16.4 3 21z" stroke="currentColor" stroke-width="2"/></svg>
                </button>
                <button type="button" class="reward-card__icon-btn reward-card__icon-btn--danger" aria-label="Delete reward">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>
        `;
        return li;
    }

    function fillRewardCard(card, data) {
        card.dataset.triggerType = data.triggerType;
        card.dataset.triggerThreshold = data.triggerThreshold;
        card.dataset.rewardType = data.rewardType;
        if (data.rewardValue) card.dataset.rewardValue = data.rewardValue;
        else delete card.dataset.rewardValue;
        card.dataset.rewardApplies = data.applies;

        const nameEl = card.querySelector('.reward-card__name');
        if (nameEl) nameEl.textContent = data.name;
        const lines = card.querySelectorAll('.reward-card__rule-value');
        if (lines[0]) lines[0].textContent = triggerLabel(data.triggerType, data.triggerThreshold);
        if (lines[1]) lines[1].textContent = rewardLabel(data.rewardType, data.rewardValue, data.applies);
    }

    if (rewardForm) {
        rewardForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const fd = new FormData(rewardForm);
            const data = {
                name:             (fd.get('name') || '').trim(),
                triggerType:      fd.get('triggerType'),
                triggerThreshold: fd.get('triggerThreshold'),
                rewardType:       fd.get('rewardType'),
                rewardValue:      fd.get('rewardValue'),
                applies:          fd.get('applies')
            };
            if (!data.name) return;

            const editingId = rewardForm.dataset.editingId;
            if (editingId) {
                const card = rewardList && rewardList.querySelector(`[data-edit-id="${editingId}"]`);
                if (card) {
                    fillRewardCard(card, data);
                    card.removeAttribute('data-edit-id');
                }
            } else if (rewardList) {
                rewardList.appendChild(buildRewardCard(data));
            }

            closeRewardModal();
            if (typeof formatAllNames === 'function') formatAllNames(rewardList);
        });
    }

    if (rewardList) {
        rewardList.addEventListener('click', function(e) {
            const deleteBtn = e.target.closest('.reward-card__icon-btn--danger');
            if (deleteBtn) {
                const card = deleteBtn.closest('.reward-card');
                if (card) card.remove();
                return;
            }
            const editBtn = e.target.closest('.reward-card__icon-btn:not(.reward-card__icon-btn--danger)');
            if (editBtn && rewardForm && rewardModal) {
                const card = editBtn.closest('.reward-card');
                if (!card) return;
                const id = 'edit-' + Date.now();
                card.setAttribute('data-edit-id', id);
                rewardForm.dataset.editingId = id;

                const nameEl = card.querySelector('.reward-card__name');
                rewardForm.elements.name.value             = nameEl ? nameEl.textContent.trim() : '';
                rewardForm.elements.triggerType.value      = card.dataset.triggerType || 'concerts';
                rewardForm.elements.triggerThreshold.value = card.dataset.triggerThreshold || '';
                rewardForm.elements.rewardType.value       = card.dataset.rewardType || 'percent';
                rewardForm.elements.rewardValue.value      = card.dataset.rewardValue || '';
                rewardForm.elements.applies.value          = card.dataset.rewardApplies || 'all';

                const submitBtn = rewardForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.textContent = 'Update reward';
                const heading = rewardModal.querySelector('.modal__header h2');
                if (heading) heading.textContent = 'Edit fan reward';
                openRewardModal();
            }
        });

        rewardList.addEventListener('change', function(e) {
            if (!e.target.matches('.reward-toggle input')) return;
            const card = e.target.closest('.reward-card');
            if (card) card.classList.toggle('is-inactive', !e.target.checked);
        });
    }

    // -------------------- FAN PROFILE — create-post modal --------------------
    const newPostBtn = document.getElementById('newPostBtn');
    const createPostModal = document.getElementById('createPostModal');
    if (newPostBtn && createPostModal) {
        // Mock song catalog — used by the song-tagger autocomplete. Tagging
        // a song boosts the post's exposure (followers of the artist see
        // it in their feed and the artist's royalty split kicks in).
        const SONG_CATALOG = [
            { title: 'Jokes On Me',          artist: 'JokesmithJohnson', cover: "url('" + localAsset('assets/images/artists/jokesmith-johnson-cover.png') + "') center/cover" },
            { title: 'Behind The Curtain',   artist: 'JokesmithJohnson', cover: "url('" + localAsset('assets/images/artists/jokesmith-johnson-post-1.png') + "') center/cover" },
            { title: 'Northern Lights',      artist: 'Anchi Humifuku',   cover: "url('" + localAsset('assets/images/artists/placeholder-female-3.png') + "') center/cover" },
            { title: 'Manhattan Rain',       artist: 'Anchi Humifuku',   cover: "url('" + localAsset('assets/images/artists/placeholder-female-3.png') + "') center/cover" },
            { title: 'City Lights Are Calling', artist: 'Maya Thompson', cover: "url('" + localAsset('assets/images/artists/maya-thompson-profile.png') + "') center/cover" },
            { title: 'Static In My Head',    artist: 'Lars Vognsen',     cover: "url('" + localAsset('assets/images/artists/placeholder-male-3.png') + "') center/cover" },
            { title: 'Frozen Roads',         artist: 'DJ Frostbite',     cover: "url('" + localAsset('assets/images/artists/placeholder-male-1.png') + "') center/cover" },
            { title: 'Voices In My Head',    artist: 'Sara Holm',        cover: "url('" + localAsset('assets/images/artists/placeholder-female-6.png') + "') center/cover" }
        ];

        const pickerView   = createPostModal.querySelector('[data-view="picker"]');
        const composerView = createPostModal.querySelector('[data-view="composer"]');
        const attachList   = document.getElementById('composerAttachments');
        const songInput    = document.getElementById('composerSongInput');
        const songResults  = document.getElementById('composerSongResults');
        const songSelected = document.getElementById('composerSongSelected');

        function showView(name) {
            if (pickerView)   pickerView.hidden   = (name !== 'picker');
            if (composerView) composerView.hidden = (name !== 'composer');
        }

        function openCreatePost() {
            showView('picker');
            createPostModal.classList.add('open');
            createPostModal.setAttribute('aria-hidden', 'false');
        }

        function closeCreatePost() {
            createPostModal.classList.remove('open');
            createPostModal.setAttribute('aria-hidden', 'true');
            // Reset composer state for the next time
            if (attachList) { attachList.innerHTML = ''; attachList.hidden = true; }
            if (songInput) songInput.value = '';
            if (songResults) { songResults.innerHTML = ''; songResults.hidden = true; }
            if (songSelected) { songSelected.innerHTML = ''; songSelected.hidden = true; }
            const textArea = composerView && composerView.querySelector('.composer__text');
            if (textArea) textArea.value = '';
            if (composerView) composerView.querySelectorAll('input[name="postCategory"]').forEach(function(r) { r.checked = false; });
        }

        newPostBtn.addEventListener('click', function() {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            openCreatePost();
        });

        createPostModal.addEventListener('click', function(e) {
            if (e.target === createPostModal) { closeCreatePost(); return; }
            if (e.target.closest('[data-close-create-post]')) { closeCreatePost(); return; }
            if (e.target.closest('[data-back-create-post]'))  { showView('picker'); return; }
        });

        // Step 1 → Step 2 routing
        createPostModal.querySelectorAll('[data-post-type]').forEach(function(opt) {
            opt.addEventListener('click', function() {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                const type = opt.dataset.postType;
                if (type === 'live') {
                    // Stub: a real build would launch the live-streaming UI.
                    closeCreatePost();
                } else {
                    showView('composer');
                    const textArea = composerView && composerView.querySelector('.composer__text');
                    if (textArea) setTimeout(function() { textArea.focus(); }, 0);
                }
            });
        });

        // Attachments (mock — adds a chip to the attachment list)
        if (attachList && composerView) {
            composerView.querySelectorAll('[data-attach-type]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    if (typeof helpActive !== 'undefined' && helpActive) return;
                    const type = btn.dataset.attachType;
                    const labels = { photo: 'Photo', video: 'Video', file: 'File' };
                    const idx = attachList.querySelectorAll('[data-attach-chip="' + type + '"]').length + 1;
                    const chip = document.createElement('span');
                    chip.className = 'composer__attachment';
                    chip.dataset.attachChip = type;
                    chip.innerHTML = labels[type] + ' ' + idx +
                        ' <button type="button" class="composer__attachment-remove" aria-label="Remove">&times;</button>';
                    attachList.appendChild(chip);
                    attachList.hidden = false;
                });
            });

            attachList.addEventListener('click', function(e) {
                const removeBtn = e.target.closest('.composer__attachment-remove');
                if (!removeBtn) return;
                const chip = removeBtn.closest('.composer__attachment');
                if (chip) chip.remove();
                if (!attachList.children.length) attachList.hidden = true;
            });
        }

        // Song tagger — autocomplete + selection
        function renderSongResults(query) {
            if (!songResults) return;
            const q = (query || '').trim().toLowerCase();
            if (!q) {
                songResults.innerHTML = '';
                songResults.hidden = true;
                return;
            }
            const matches = SONG_CATALOG.filter(function(s) {
                return s.title.toLowerCase().indexOf(q) !== -1 ||
                       s.artist.toLowerCase().indexOf(q) !== -1;
            }).slice(0, 6);

            if (matches.length === 0) {
                songResults.innerHTML = '<li class="composer__song-empty">No matches for "' +
                    String(q).replace(/[<>&"]/g, '') + '"</li>';
            } else {
                songResults.innerHTML = matches.map(function(s, i) {
                    return '<li class="composer__song-result" data-song-idx="' + SONG_CATALOG.indexOf(s) + '">' +
                        '<span class="composer__song-result-thumb" style="background: ' + s.cover + ';"></span>' +
                        '<div class="composer__song-result-main">' +
                            '<div class="composer__song-result-title">' + s.title + '</div>' +
                            '<div class="composer__song-result-artist">' + s.artist + '</div>' +
                        '</div>' +
                    '</li>';
                }).join('');
            }
            songResults.hidden = false;
        }

        function selectSong(song) {
            if (!songSelected) return;
            songSelected.innerHTML =
                '<span class="composer__song-selected-thumb" style="background: ' + song.cover + ';"></span>' +
                '<div class="composer__song-selected-main">' +
                    '<div class="composer__song-selected-title">' + song.title + '</div>' +
                    '<div class="composer__song-selected-artist">' + song.artist + ' · royalties auto-split</div>' +
                '</div>' +
                '<button type="button" class="composer__song-selected-remove" data-song-clear aria-label="Remove song">&times;</button>';
            songSelected.hidden = false;
            if (songInput) songInput.value = '';
            if (songResults) { songResults.innerHTML = ''; songResults.hidden = true; }
        }

        if (songInput) {
            songInput.addEventListener('input', function() { renderSongResults(songInput.value); });
            songInput.addEventListener('focus', function() { if (songInput.value.trim()) renderSongResults(songInput.value); });
        }

        if (songResults) {
            songResults.addEventListener('click', function(e) {
                const row = e.target.closest('.composer__song-result');
                if (!row) return;
                const idx = parseInt(row.dataset.songIdx, 10);
                if (!isNaN(idx) && SONG_CATALOG[idx]) selectSong(SONG_CATALOG[idx]);
            });
        }

        if (songSelected) {
            songSelected.addEventListener('click', function(e) {
                if (e.target.closest('[data-song-clear]')) {
                    songSelected.innerHTML = '';
                    songSelected.hidden = true;
                }
            });
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && createPostModal.classList.contains('open')) {
                closeCreatePost();
            }
        });
    }

    // -------------------- FAN PROFILE — stat list modals --------------------
    // Friends / Concerts / Following stats in the cover are buttons that
    // open a modal listing the items. The owner's privacy settings decide
    // whether visitors get the same access (currently always on for the
    // demo profile).
    const statModals = document.querySelectorAll('[data-stat-modal-overlay]');
    if (statModals.length) {
        document.querySelectorAll('[data-stat-modal]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                const target = btn.dataset.statModal;
                const modal = document.getElementById(target + 'Modal');
                if (!modal) return;
                modal.classList.add('open');
                modal.setAttribute('aria-hidden', 'false');
            });
        });

        function closeStatModal(modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }

        statModals.forEach(function(modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal || e.target.closest('[data-close-stat-modal]')) {
                    closeStatModal(modal);
                }
            });
        });

        document.addEventListener('keydown', function(e) {
            if (e.key !== 'Escape') return;
            statModals.forEach(function(modal) {
                if (modal.classList.contains('open')) closeStatModal(modal);
            });
        });
    }

    // -------------------- PROJECTS — Show collaboration in progress (Bilag A — giving it forward) --------------------
    document.querySelectorAll('[data-collab-progress]').forEach(function(section) {
        const countEl = section.querySelector('[data-collab-count]');
        const exposureEl = section.querySelector('[data-collab-exposure]');

        function fmtListeners(n) {
            if (n >= 1000000) return (n / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
            if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
            return String(Math.round(n));
        }

        function refresh() {
            const pills = section.querySelectorAll('.collab-toggle-pill');
            let optedIn = 0;
            let exposure = 0;
            pills.forEach(function(pill) {
                const cb = pill.querySelector('input[data-collab-member]');
                const isActive = cb && cb.checked;
                pill.classList.toggle('is-active', !!isActive);
                if (isActive) {
                    optedIn += 1;
                    exposure += (parseInt(cb.dataset.fanbase, 10) || 0) * 0.05;
                }
            });
            if (countEl) countEl.textContent = optedIn + ' of ' + pills.length + ' opted in';
            if (exposureEl) exposureEl.textContent = fmtListeners(exposure) + ' listeners';
        }

        section.addEventListener('change', function(e) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            if (e.target.matches('input[data-collab-member]')) refresh();
        });

        refresh();
    });

    // -------------------- PROJECTS — Add member modal (Bilag A — royalty share / fixed fee) --------------------
    const addMemberBtn = document.getElementById('addMemberBtn');
    const addMemberModal = document.getElementById('addMemberModal');
    if (addMemberBtn && addMemberModal) {
        const firstInput  = document.getElementById('addMemberFirst');
        const lastInput   = document.getElementById('addMemberLast');
        const funcSelect  = document.getElementById('addMemberFunction');
        const compRadios  = addMemberModal.querySelectorAll('input[name="addMemberComp"]');
        const feeFields   = document.getElementById('feeFields');
        const shareFields = document.getElementById('shareFields');
        const shareList   = document.getElementById('addMemberShareList');
        const shareReset  = document.getElementById('addMemberShareReset');
        const shareWarn   = document.getElementById('shareWarn');
        const SHARE_CATS = [
            { key: 'mechanical',  label: 'Mechanical' },
            { key: 'performance', label: 'Performance' },
            { key: 'covers',      label: 'Covers' },
            { key: 'sample',      label: 'Sample' },
            { key: 'synch',       label: 'Synch' },
            { key: 'print',       label: 'Print Music' },
            { key: 'tutorials',   label: 'Tutorials' },
            { key: 'commercial',  label: 'Commercial' }
        ];
        // proposedShares[catKey] = % the new member will receive in that category
        let proposedShares = {};
        const feeInput    = document.getElementById('addMemberFee');
        const royaltyInput = document.getElementById('addMemberRoyalty');
        const breakdown   = document.getElementById('feeBreakdown');
        const confirmAddBtn = document.getElementById('addMemberConfirmBtn');

        function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

        function refreshBreakdown() {
            const fee = parseFloat(feeInput.value) || 0;
            const platform = fee * 0.10;
            const net = fee - platform;
            const half = net / 2;
            breakdown.querySelector('[data-bd="platform"]').textContent = fmt(platform) + ' USD';
            breakdown.querySelector('[data-bd="net"]').textContent      = fmt(net) + ' USD';
            breakdown.querySelector('[data-bd="upfront"]').textContent  = fmt(half) + ' USD';
            breakdown.querySelector('[data-bd="release"]').textContent  = fmt(half) + ' USD';
            // Re-render fee-payer USD column whenever the fee amount changes
            renderFeePayers();
        }

        // ---- Fee payers: split who covers the fixed fee ----
        // feePayers[memberId] = % of the gross fee
        const feePayersListEl = document.querySelector('[data-fee-payers-list]');
        const feePayersTotalEl = document.querySelector('[data-fee-payers-total]');
        const feePayersTotalNumEl = document.querySelector('[data-fee-payers-total-num]');
        const feePayersTotalIcoEl = document.querySelector('[data-fee-payers-total-icon]');
        const feePayersBalanceBtn = document.querySelector('[data-fee-payers-balance]');
        let feePayers = {};

        function readFeePayerMembers() {
            return window.__getRoyaltyMembers ? window.__getRoyaltyMembers() : [];
        }

        function feePayerEqualSplit(ids) {
            const n = ids.length;
            if (n === 0) return {};
            const exact = Math.round((100 / n) * 100) / 100;
            const out = {};
            let sum = 0;
            ids.forEach(function(id) { out[id] = exact; sum += exact; });
            const drift = Math.round((100 - sum) * 100) / 100;
            if (drift !== 0 && ids.length) out[ids[0]] = Math.round((out[ids[0]] + drift) * 100) / 100;
            return out;
        }

        // Default to "creator pays everything" — first member 100%, rest 0%.
        function feePayerDefault(ids) {
            const out = {};
            ids.forEach(function(id, i) { out[id] = (i === 0) ? 100 : 0; });
            return out;
        }

        function renderFeePayers() {
            if (!feePayersListEl) return;
            const members = readFeePayerMembers();
            const ids = members.map(function(m) { return m.id; });
            // Drop members no longer present, default zeros for new ones.
            Object.keys(feePayers).forEach(function(id) { if (ids.indexOf(id) === -1) delete feePayers[id]; });
            const fee = parseFloat(feeInput.value) || 0;
            feePayersListEl.innerHTML = members.map(function(m) {
                const pct = feePayers[m.id] != null ? feePayers[m.id] : 0;
                const usd = (fee * pct) / 100;
                let avatar;
                if (m.initials) {
                    avatar = '<span class="add-member-modal__fee-payer__avatar add-member-modal__fee-payer__avatar--initials" style="' + (m.bg || 'background:#444;') + '">' + m.initials + '</span>';
                } else {
                    avatar = '<span class="add-member-modal__fee-payer__avatar" style="background:' + (m.bg || '#1a1a1a') + ';"></span>';
                }
                return '<div class="add-member-modal__fee-payer" data-member-id="' + m.id.replace(/"/g, '&quot;') + '">' +
                    avatar +
                    '<span class="add-member-modal__fee-payer__name">' + (m.name || '—') + '</span>' +
                    '<span class="add-member-modal__fee-payer__amount">' + fmt(usd) + ' USD</span>' +
                    '<span class="royalty-popup__input-wrap">' +
                        '<input type="number" class="royalty-popup__input" min="0" max="100" step="0.01" inputmode="decimal" ' +
                          'data-fee-payer-id="' + m.id.replace(/"/g, '&quot;') + '" value="' + (Math.round(pct * 100) / 100) + '">' +
                        '<span class="royalty-popup__input-suffix">%</span>' +
                    '</span>' +
                '</div>';
            }).join('');
            updateFeePayersTotal();
        }

        function updateFeePayersTotal() {
            let total = 0;
            Object.keys(feePayers).forEach(function(id) { total += (feePayers[id] || 0); });
            const t = Math.round(total * 100) / 100;
            const ok = t === 100;
            if (feePayersTotalNumEl) feePayersTotalNumEl.textContent = formatShareNum(t) + '%';
            if (feePayersTotalEl) feePayersTotalEl.classList.toggle('add-member-modal__fee-payers-total--off', !ok);
            if (feePayersTotalIcoEl) feePayersTotalIcoEl.textContent = ok ? '✓' : '!';
        }

        function resetFeePayers() {
            const ids = readFeePayerMembers().map(function(m) { return m.id; });
            feePayers = feePayerDefault(ids);
        }

        if (feePayersListEl) {
            feePayersListEl.addEventListener('input', function(e) {
                const inp = e.target.closest('input[data-fee-payer-id]');
                if (!inp) return;
                const raw = String(inp.value).replace(',', '.');
                let v = parseFloat(raw);
                if (!isFinite(v)) v = 0;
                v = Math.max(0, Math.min(100, Math.round(v * 100) / 100));
                feePayers[inp.dataset.feePayerId] = v;
                // Update USD label on this row
                const row = inp.closest('.add-member-modal__fee-payer');
                if (row) {
                    const amount = row.querySelector('.add-member-modal__fee-payer__amount');
                    const fee = parseFloat(feeInput.value) || 0;
                    if (amount) amount.textContent = fmt((fee * v) / 100) + ' USD';
                }
                updateFeePayersTotal();
            });
        }
        if (feePayersBalanceBtn) {
            feePayersBalanceBtn.addEventListener('click', function() {
                const ids = readFeePayerMembers().map(function(m) { return m.id; });
                feePayers = feePayerEqualSplit(ids);
                renderFeePayers();
            });
        }

        function isCompChecked(value) {
            const cb = addMemberModal.querySelector('input[name="addMemberComp"][value="' + value + '"]');
            return !!(cb && cb.checked);
        }

        function refreshComp() {
            const royalty = isCompChecked('royalty');
            const fee     = isCompChecked('fee');
            feeFields.hidden = !fee;
            if (shareFields) shareFields.hidden = !royalty;
            const freeNote = document.getElementById('freeNote');
            if (freeNote) freeNote.hidden = (royalty || fee);
            if (fee) renderFeePayers();
        }

        // Equal-split default for the proposed share = 100 / (currentTeamSize + 1)
        function currentTeamSize() {
            const team = document.querySelector('.project-team');
            if (!team) return 1;
            return team.querySelectorAll('.collaborator-card:not(.add-person)').length;
        }

        function equalShareDefault() {
            return Math.round((100 / (currentTeamSize() + 1)) * 100) / 100;
        }

        // Format a number with up to 2 decimals, trimming trailing zeros so
        // "25" stays as "25" and "33.33" shows in full.
        function formatShareNum(v) {
            if (v == null || isNaN(v)) return '0';
            const r = Math.round(v * 100) / 100;
            if (r === Math.floor(r)) return String(r);
            return r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
        }

        function escapeAttr(s) {
            return String(s).replace(/[&<>"']/g, function(c) {
                return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
            });
        }

        // Project what existing members' shares will be in a category if the
        // new member is given `proposed` percent. Existing values scale
        // proportionally to fit the remaining (100 - proposed) percent so
        // every category still totals 100. Values are kept to 2 decimals.
        function projectEffect(catKey, proposed) {
            const cur = (window.__getRoyaltySplits && window.__getRoyaltySplits()[catKey]) || {};
            const members = window.__getRoyaltyMembers ? window.__getRoyaltyMembers() : [];
            const ids = members.map(function(m) { return m.id; });
            const r2 = function(v) { return Math.round(v * 100) / 100; };
            const remaining = r2(100 - proposed);
            let existingTotal = 0;
            ids.forEach(function(id) { existingTotal += (cur[id] || 0); });
            if (existingTotal <= 0) existingTotal = 1;
            const after = {};
            let scaledSum = 0;
            ids.forEach(function(id) {
                after[id] = Math.max(0, r2((cur[id] || 0) * remaining / existingTotal));
                scaledSum += after[id];
            });
            const drift = r2(remaining - scaledSum);
            if (drift !== 0 && ids.length) {
                const order = ids.slice().sort(function(a, b) { return (after[b] || 0) - (after[a] || 0); });
                for (let i = 0; i < order.length; i++) {
                    const id = order[i];
                    const next = r2((after[id] || 0) + drift);
                    if (next >= 0 && next <= 100) { after[id] = next; break; }
                }
            }
            return { members: members, before: cur, after: after };
        }

        function renderCategoryBody(c) {
            const v = proposedShares[c.key];
            const proj = projectEffect(c.key, v);
            const eps = 0.005;
            const memRows = proj.members.map(function(m) {
                const before = proj.before[m.id] || 0;
                const after  = proj.after[m.id] || 0;
                const arrow = Math.abs(before - after) < eps ? 'unchanged' : (before > after ? 'down' : 'up');
                return '<li class="proposed-cat__member proposed-cat__member--' + arrow + '">' +
                    '<span class="proposed-cat__member-name">' + escapeAttr(m.name || '—') + '</span>' +
                    '<span class="proposed-cat__member-change">' +
                        '<span class="proposed-cat__before">' + formatShareNum(before) + '%</span>' +
                        '<span class="proposed-cat__arrow">→</span>' +
                        '<span class="proposed-cat__after">' + formatShareNum(after) + '%</span>' +
                    '</span>' +
                '</li>';
            }).join('');
            const remaining = Math.round((100 - v) * 100) / 100;
            return '<div class="proposed-cat__input-row">' +
                    '<label class="proposed-cat__input-label" for="share-input-' + c.key + '">New member’s share</label>' +
                    '<span class="add-member-modal__share-row__input">' +
                        '<input type="number" id="share-input-' + c.key + '" min="0" max="100" step="0.01" inputmode="decimal" value="' + formatShareNum(v) + '" data-share-cat="' + escapeAttr(c.key) + '">' +
                        '<span>%</span>' +
                    '</span>' +
                '</div>' +
                '<p class="proposed-cat__effect-label">Existing members scale to share the remaining <strong data-share-remaining>' + formatShareNum(remaining) + '%</strong>:</p>' +
                '<ul class="proposed-cat__members">' + memRows + '</ul>' +
                '<div class="proposed-cat__total">Total <strong>100%</strong> ✓</div>';
        }

        function renderShareList() {
            if (!shareList) return;
            const def = equalShareDefault();
            const getHelp = window.__getRoyaltyCatHelp || function() { return ''; };
            shareList.innerHTML = SHARE_CATS.map(function(c) {
                const v = proposedShares[c.key] != null ? proposedShares[c.key] : def;
                proposedShares[c.key] = v;
                const high = v > def + 0.005 ? ' proposed-cat--high' : '';
                const helpText = getHelp(c.key);
                const helpAttr = helpText ? ' data-help="' + escapeAttr(helpText) + '"' : '';
                return '<details class="proposed-cat' + high + '" data-cat="' + escapeAttr(c.key) + '">' +
                    '<summary class="proposed-cat__summary"' + helpAttr + '>' +
                        '<span class="proposed-cat__chevron" aria-hidden="true">▸</span>' +
                        '<span class="proposed-cat__label">' + escapeAttr(c.label) + '</span>' +
                        '<span class="proposed-cat__value" data-share-summary>' + formatShareNum(v) + '%</span>' +
                    '</summary>' +
                    '<div class="proposed-cat__body">' + renderCategoryBody(c) + '</div>' +
                '</details>';
            }).join('');
            refreshShareWarn();
        }

        function updateCategoryRow(catKey) {
            const block = shareList.querySelector('.proposed-cat[data-cat="' + catKey + '"]');
            if (!block) return;
            const v = proposedShares[catKey];
            const def = equalShareDefault();
            const summaryVal = block.querySelector('[data-share-summary]');
            if (summaryVal) summaryVal.textContent = formatShareNum(v) + '%';
            block.classList.toggle('proposed-cat--high', v > def + 0.005);
            const body = block.querySelector('.proposed-cat__body');
            if (body) {
                const c = SHARE_CATS.find(function(cc) { return cc.key === catKey; });
                if (c) body.innerHTML = renderCategoryBody(c);
            }
        }

        function refreshShareWarn() {
            if (!shareWarn) return;
            const def = equalShareDefault();
            const anyHigh = SHARE_CATS.some(function(c) {
                const v = proposedShares[c.key] != null ? proposedShares[c.key] : def;
                return v > def + 0.005;
            });
            shareWarn.hidden = !anyHigh;
        }

        function resetProposedShares() {
            proposedShares = {};
            const def = equalShareDefault();
            SHARE_CATS.forEach(function(c) { proposedShares[c.key] = def; });
        }

        if (shareList) {
            shareList.addEventListener('input', function(e) {
                const inp = e.target.closest('input[data-share-cat]');
                if (!inp) return;
                const raw = String(inp.value).replace(',', '.');
                let v = parseFloat(raw);
                if (!isFinite(v)) v = 0;
                v = Math.max(0, Math.min(100, Math.round(v * 100) / 100));
                const cat = inp.dataset.shareCat;
                proposedShares[cat] = v;
                updateCategoryRow(cat);
                refreshShareWarn();
                const restored = shareList.querySelector('input[data-share-cat="' + cat + '"]');
                if (restored && restored !== inp) {
                    restored.focus();
                    const len = String(formatShareNum(v)).length;
                    try { restored.setSelectionRange(len, len); } catch (e) {}
                }
            });
        }
        if (shareReset) {
            shareReset.addEventListener('click', function() {
                resetProposedShares();
                renderShareList();
            });
        }

        function openAdd() {
            firstInput.value = '';
            lastInput.value = '';
            funcSelect.selectedIndex = 0;
            compRadios.forEach(function(r) { r.checked = (r.value === 'royalty'); });
            feeInput.value = 5000;
            royaltyInput.value = 5;
            resetProposedShares();
            renderShareList();
            resetFeePayers();
            renderFeePayers();
            refreshComp();
            refreshBreakdown();
            addMemberModal.classList.add('open');
            addMemberModal.setAttribute('aria-hidden', 'false');
            setTimeout(function() { firstInput.focus(); }, 0);
        }

        function closeAdd() {
            addMemberModal.classList.remove('open');
            addMemberModal.setAttribute('aria-hidden', 'true');
        }

        addMemberBtn.addEventListener('click', function() {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            openAdd();
        });

        addMemberModal.addEventListener('click', function(e) {
            if (e.target === addMemberModal || e.target.closest('[data-close-add-member]')) closeAdd();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && addMemberModal.classList.contains('open')) closeAdd();
        });

        compRadios.forEach(function(r) { r.addEventListener('change', refreshComp); });
        if (feeInput) feeInput.addEventListener('input', refreshBreakdown);

        function colorPalette(seed) {
            const palettes = [
                'background:#8E44AD;', 'background:#27AE60;', 'background:#E67E22;',
                'background:#16a085;', 'background:#c0392b;', 'background:#2980b9;',
                'background:#d35400;', 'background:#9b59b6;', 'background:#f39c12;'
            ];
            return palettes[seed % palettes.length];
        }

        if (confirmAddBtn) {
            confirmAddBtn.addEventListener('click', function() {
                const first = (firstInput.value || '').trim();
                const last  = (lastInput.value || '').trim();
                if (!first) { firstInput.focus(); return; }
                const role  = funcSelect.options[funcSelect.selectedIndex].text;
                const royaltyOn = isCompChecked('royalty');
                const feeOn     = isCompChecked('fee');
                let comp = 'free';
                if (royaltyOn && feeOn) comp = 'royalty+fee';
                else if (royaltyOn) comp = 'royalty';
                else if (feeOn) comp = 'fee';

                // Build the new collaborator card and insert before the add-person button
                const team = document.querySelector('.project-team');
                const addBtn = team && team.querySelector('.add-person');
                if (!team || !addBtn) { closeAdd(); return; }

                const initials = (first.charAt(0) + (last.charAt(0) || '')).toUpperCase();
                const card = document.createElement('div');
                card.className = 'collaborator-card';
                card.dataset.comp = comp;

                let feeTag = '';
                if (feeOn) {
                    const fee = parseFloat(feeInput.value) || 0;
                    const royalty = parseFloat(royaltyInput.value) || 0;
                    feeTag = '<span class="collaborator-fee-tag">' + fmt(fee) + ' USD · ' + royalty + '% locked</span>';
                } else if (!royaltyOn) {
                    feeTag = '<span class="collaborator-fee-tag">Free</span>';
                }

                card.innerHTML =
                    '<span class="collaborator-role">' + role + '</span>' +
                    '<div class="collaborator-image collaborator-image--initials" style="' + colorPalette(team.children.length) + '">' + initials + '</div>' +
                    '<span class="collaborator-name">' +
                        '<span class="collaborator-name__first">' + first + '</span>' +
                        (last ? '<span class="collaborator-name__rest">' + last + '</span>' : '') +
                    '</span>' +
                    feeTag;
                team.insertBefore(card, addBtn);

                // Mirror into the dropdown list and bump the count badge
                const dropdownList = document.querySelector('.project-team-dropdown__list');
                const countEl = document.querySelector('.project-team-dropdown__count');
                if (dropdownList) {
                    const li = document.createElement('li');
                    li.innerHTML = '<span class="name"><strong>' + first + '</strong>' + (last ? ' ' + last : '') + '</span>';
                    const addLi = dropdownList.querySelector('.add-member');
                    dropdownList.insertBefore(li, addLi);
                }
                if (countEl) {
                    const memberCount = team.querySelectorAll('.collaborator-card:not(.add-person)').length;
                    countEl.textContent = '(' + memberCount + ' + add)';
                }

                // Add a pending approval row for the new member
                const approvals = document.querySelector('[data-project-approvals]');
                if (approvals) {
                    const row = document.createElement('button');
                    row.type = 'button';
                    row.className = 'approval-row';
                    row.dataset.approval = 'pending';
                    row.dataset.member = (first + ' ' + last).trim();
                    row.innerHTML =
                        '<span class="approval-status" aria-hidden="true"></span>' +
                        '<span class="approval-row__name auto-name">' + (first + ' ' + last).trim() + '</span>';
                    approvals.appendChild(row);
                    // Refresh release-button counter
                    const total = approvals.querySelectorAll('.approval-row').length;
                    const approved = approvals.querySelectorAll('.approval-row.is-approved').length;
                    const progressEl = document.querySelector('[data-release-progress]');
                    const releaseBtn = document.querySelector('[data-release-btn]');
                    if (progressEl) progressEl.textContent = approved + ' of ' + total + ' approved';
                    if (releaseBtn) releaseBtn.disabled = approved < total;
                }

                if (typeof formatAllNames === 'function') formatAllNames(team);
                if (typeof window.__royaltySplitsReconcile === 'function') {
                    // Pass the per-category proposed shares map so each
                    // category honours its own setting. If royalty isn't
                    // enabled (fee-only or free), pass an all-zero map so
                    // the new member gets 0% across all categories.
                    const royaltyOn = isCompChecked('royalty');
                    const sharesToPass = {};
                    SHARE_CATS.forEach(function(c) {
                        const raw = royaltyOn ? (proposedShares[c.key] || 0) : 0;
                        sharesToPass[c.key] = Math.round(raw * 100) / 100;
                    });
                    window.__royaltySplitsReconcile(sharesToPass);
                }
                closeAdd();
            });
        }
    }

    // -------------------- PROJECTS — WAVE upload modal --------------------
    // Click the WAVE pill in Uploads → opens a modal with a master-mix
    // slot and a flexible stem list. User picks a category, uploads a
    // .wav, and a row appears with the file's full-length waveform
    // visualisation. Repeat for as many stems as desired (Adlib, Male
    // vocals, custom names, etc.). The more stems uploaded, the more
    // mute/solo controls listeners get when streaming.
    (function() {
        const waveBtn = document.querySelector('[data-wave-upload]');
        const modal   = document.getElementById('waveUploadModal');
        if (!waveBtn || !modal) return;

        // Project the modal is currently editing — set on open() so every
        // log call attributes its entry to the right project.
        let activeProjectId = null;

        const stemsRoot    = modal.querySelector('[data-wave-stems]');
        const progressFill = modal.querySelector('[data-wave-progress-fill]');
        const progressText = modal.querySelector('[data-wave-progress-text]');
        const masterSlot   = modal.querySelector('[data-wave-slot="master"]');
        const catSelect    = modal.querySelector('[data-wave-cat-select]');
        const catCustom    = modal.querySelector('[data-wave-cat-custom]');
        const addInput     = modal.querySelector('[data-wave-add-input]');
        const addError     = modal.querySelector('[data-wave-add-error]');

        // Uploaded stems: array of { id, label, versions: [v3, v2, v1...] }
        // Each version: { id, fileName, fileSize, fileType, durationSec,
        //                 audioBuffer, objectUrl, uploadedAt, uploadedBy }
        // versions[0] is the current version; older entries are history.
        // Master mix is tracked separately in masterUpload.
        let stems = [];
        let masterUpload = null;
        let stemSeq = 0;
        let versionSeq = 0;
        // Track currently-playing <audio> element so a new play stops the
        // previous one (only one preview plays at a time).
        let currentAudio = null;
        let currentPlayBtn = null;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        let audioCtx = null;
        function getCtx() {
            if (!audioCtx && AudioCtx) audioCtx = new AudioCtx();
            return audioCtx;
        }

        const escapeHtml = SC.escapeHtml;
        const formatBytes = SC.formatBytes;
        const formatDuration = SC.fmtDuration;

        // Decode a .wav file with Web Audio API and return { buffer, durationSec }.
        // Falls back to { buffer: null, durationSec: NaN } if decoding fails
        // (e.g. older browsers, non-PCM .wav variants).
        function decodeFile(file) {
            return new Promise(function(resolve) {
                const ctx = getCtx();
                if (!ctx) { resolve({ buffer: null, durationSec: NaN }); return; }
                const reader = new FileReader();
                reader.onload = function() {
                    ctx.decodeAudioData(reader.result.slice(0)).then(function(buf) {
                        resolve({ buffer: buf, durationSec: buf.duration });
                    }).catch(function() { resolve({ buffer: null, durationSec: NaN }); });
                };
                reader.onerror = function() { resolve({ buffer: null, durationSec: NaN }); };
                reader.readAsArrayBuffer(file);
            });
        }

        // Draw a min/max waveform on a canvas. One pixel column per bucket
        // of the channel data. Resamples to canvas.width buckets so the
        // full file fits regardless of duration.
        function drawWaveform(canvas, audioBuffer) {
            const dpr = window.devicePixelRatio || 1;
            const cssW = canvas.clientWidth || 360;
            const cssH = canvas.clientHeight || 38;
            canvas.width  = cssW * dpr;
            canvas.height = cssH * dpr;
            const c = canvas.getContext('2d');
            c.scale(dpr, dpr);
            c.clearRect(0, 0, cssW, cssH);
            if (!audioBuffer) {
                c.fillStyle = 'rgba(255,255,255,0.4)';
                c.font = '11px Outfit, sans-serif';
                c.fillText('waveform unavailable', 8, cssH / 2 + 4);
                return;
            }
            const data = audioBuffer.getChannelData(0);
            const buckets = cssW;
            const step = Math.max(1, Math.floor(data.length / buckets));
            const mid = cssH / 2;
            c.fillStyle = '#43C47A';
            for (let i = 0; i < buckets; i++) {
                let min = 1, max = -1;
                const start = i * step;
                const end = Math.min(start + step, data.length);
                for (let j = start; j < end; j++) {
                    const v = data[j];
                    if (v < min) min = v;
                    if (v > max) max = v;
                }
                const yMax = mid - max * (mid - 1);
                const yMin = mid - min * (mid - 1);
                const h = Math.max(1, yMin - yMax);
                c.fillRect(i, yMax, 1, h);
            }
        }

        function formatTimeAgo(ts) {
            const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
            if (sec < 45) return 'just now';
            if (sec < 90) return '1 min ago';
            const min = Math.round(sec / 60);
            if (min < 45) return min + ' min ago';
            const hr = Math.round(min / 60);
            if (hr < 22) return hr + ' hr ago';
            const day = Math.round(hr / 24);
            if (day < 30) return day + (day === 1 ? ' day ago' : ' days ago');
            const d = new Date(ts);
            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        }

        function renderHistoryItem(stem, ver, idx) {
            return '<li class="wave-upload__history-item" data-version-id="' + ver.id + '">' +
                '<button type="button" class="wave-upload__history-play" data-stem-play="' + stem.id + '" data-version-id="' + ver.id + '" aria-label="Play this version">' +
                    '<span class="wave-upload__history-play-icon" aria-hidden="true">▶</span>' +
                '</button>' +
                '<div class="wave-upload__history-main">' +
                    '<div class="wave-upload__history-name">v' + (stem.versions.length - idx) + ' · ' + escapeHtml(ver.fileName) + '</div>' +
                    '<div class="wave-upload__history-meta">' + formatDuration(ver.durationSec) + ' · ' + formatBytes(ver.fileSize) + ' · uploaded by ' + escapeHtml(ver.uploadedBy) + ' · ' + escapeHtml(formatTimeAgo(ver.uploadedAt)) + '</div>' +
                '</div>' +
                (idx === 0 ? '' :
                    '<button type="button" class="wave-upload__history-restore" data-stem-restore="' + stem.id + '" data-version-id="' + ver.id + '">Make current</button>'
                ) +
            '</li>';
        }

        function renderStemRow(stem) {
            const cur = stem.versions[0];
            const versionCount = stem.versions.length;
            const versionBadge = '<span class="wave-upload__stem-row__version">v' + versionCount + '</span>';
            const historyToggle = versionCount > 1
                ? '<button type="button" class="wave-upload__stem-row__history-toggle" data-stem-history="' + stem.id + '" aria-expanded="' + (stem.expanded ? 'true' : 'false') + '">' +
                      (versionCount - 1) + ' previous version' + (versionCount - 1 === 1 ? '' : 's') +
                      '<span class="wave-upload__chevron" aria-hidden="true">' + (stem.expanded ? '▾' : '▸') + '</span>' +
                  '</button>'
                : '';
            const historyPanel = (versionCount > 1 && stem.expanded)
                ? '<ul class="wave-upload__history-list">' +
                    stem.versions.map(function(v, i) { return renderHistoryItem(stem, v, i); }).join('') +
                  '</ul>'
                : '';
            return '<li class="wave-upload__stem-row" data-stem-id="' + stem.id + '">' +
                '<div class="wave-upload__stem-row__main">' +
                    '<button type="button" class="wave-upload__stem-row__remove" data-stem-remove="' + stem.id + '">Remove</button>' +
                    '<div class="wave-upload__stem-row__name">' +
                        escapeHtml(stem.label) + versionBadge +
                        '<span class="wave-upload__stem-row__name-file">' + escapeHtml(cur.fileName) + '</span>' +
                    '</div>' +
                    '<canvas class="wave-upload__stem-row__waveform" data-stem-canvas="' + stem.id + '"></canvas>' +
                    '<div class="wave-upload__stem-row__meta">' +
                        formatDuration(cur.durationSec) + '<br>' + formatBytes(cur.fileSize) +
                    '</div>' +
                    '<div class="wave-upload__stem-row__actions">' +
                        '<button type="button" class="wave-upload__history-play wave-upload__history-play--current" data-stem-play="' + stem.id + '" data-version-id="' + cur.id + '" aria-label="Play current version">' +
                            '<span class="wave-upload__history-play-icon" aria-hidden="true">▶</span>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
                (historyToggle ? '<div class="wave-upload__stem-row__history">' + historyToggle + historyPanel + '</div>' : '') +
            '</li>';
        }

        function renderStems() {
            // Stop any preview that may have been pointing into a stale row
            stopCurrentPreview();
            stemsRoot.innerHTML = stems.map(renderStemRow).join('');
            stems.forEach(function(stem) {
                const canvas = stemsRoot.querySelector('[data-stem-canvas="' + stem.id + '"]');
                if (canvas) drawWaveform(canvas, stem.versions[0].audioBuffer);
            });
            refreshProgress();
        }

        function refreshProgress() {
            const stemCount = stems.length;
            const masterUploaded = !!masterUpload;
            // Progress bar: ~12% per stem, capped at 100, master alone gives 15%.
            let pct = stemCount * 12;
            if (masterUploaded && stemCount === 0) pct = 15;
            else if (masterUploaded) pct += 6;
            pct = Math.min(100, pct);
            if (progressFill) progressFill.style.width = pct + '%';
            if (!progressText) return;
            if (stemCount === 0 && !masterUploaded) {
                progressText.innerHTML = 'No files uploaded yet — listeners will hear your mix as a single bounced track.';
            } else if (stemCount === 0 && masterUploaded) {
                progressText.innerHTML = '<strong>Master mix only.</strong> Listeners hear the song as you mixed it. Add stems below to give them mute/solo controls.';
            } else {
                const names = stems.map(function(s) { return s.label; });
                progressText.innerHTML = '<strong>' + stemCount + ' stem' + (stemCount === 1 ? '' : 's') + ' uploaded.</strong> ' +
                    'Listeners can mute or solo: <strong>' + names.join(', ') + '</strong>.' +
                    (masterUploaded ? ' Master mix is on file as the default playback.' : '');
            }
        }

        function showAddError(msg) {
            if (!addError) return;
            addError.textContent = msg || '';
            addError.hidden = !msg;
        }

        // Read the chosen category — either a select option or the custom text.
        function chosenCategory() {
            const v = catSelect ? catSelect.value : '';
            if (!v) return null;
            if (v === '__custom') {
                const c = (catCustom && catCustom.value || '').trim();
                return c || null;
            }
            return v;
        }

        function findStemByLabel(label) {
            const norm = label.toLowerCase().trim();
            return stems.find(function(s) { return s.label.toLowerCase().trim() === norm; });
        }

        // Default uploader = the project creator (first member of the team).
        // This is the person whose action stamps each version.
        function currentUploader() {
            const team = document.querySelector('.project-team');
            if (!team) return 'You';
            const first = team.querySelector('.collaborator-card:not(.add-person) .collaborator-name__first');
            const rest  = team.querySelector('.collaborator-card:not(.add-person) .collaborator-name__rest');
            const a = first ? first.textContent : '';
            const b = rest ? rest.textContent : '';
            return (a + ' ' + b).trim() || 'You';
        }

        function makeVersion(file) {
            const objectUrl = URL.createObjectURL(file);
            return {
                id: 'v' + (++versionSeq),
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                durationSec: NaN,
                audioBuffer: null,
                objectUrl: objectUrl,
                uploadedAt: Date.now(),
                uploadedBy: currentUploader()
            };
        }

        function addStem(file) {
            const label = chosenCategory();
            if (!label) {
                showAddError(catSelect && catSelect.value === '__custom'
                    ? 'Type a name for this stem.'
                    : 'Pick a category for this stem first.');
                return;
            }
            showAddError('');

            const ver = makeVersion(file);
            const existing = findStemByLabel(label);
            let target;
            if (existing) {
                // Layer the new version on top — old current moves into history
                existing.versions.unshift(ver);
                target = existing;
            } else {
                target = {
                    id: 's' + (++stemSeq),
                    label: label,
                    versions: [ver],
                    expanded: false
                };
                stems.push(target);
            }
            renderStems();

            decodeFile(file).then(function(res) {
                ver.audioBuffer = res.buffer;
                ver.durationSec = res.durationSec;
                renderStems();
            });

            window.ProjectLog.log(activeProjectId, {
                action: 'upload',
                summary: (existing ? 'Uploaded new version of stem · <strong>' : 'Uploaded WAVE stem · <strong>') + escapeHtml(label) + '</strong>',
                detail: escapeHtml(file.name) + ' · ' + formatBytes(file.size)
            });

            // Reset the form so the user can pick the next stem
            if (catSelect) catSelect.selectedIndex = 0;
            if (catCustom) { catCustom.value = ''; catCustom.hidden = true; }
            if (addInput) addInput.value = '';
        }

        function removeStem(id) {
            stopCurrentPreview();
            const stem = stems.find(function(s) { return s.id === id; });
            if (stem) stem.versions.forEach(releaseVersion);
            stems = stems.filter(function(s) { return s.id !== id; });
            renderStems();
            if (stem) {
                window.ProjectLog.log(activeProjectId, {
                    action: 'remove',
                    summary: 'Removed WAVE stem · <strong>' + escapeHtml(stem.label) + '</strong>',
                    detail: escapeHtml(stem.versions[0].fileName)
                });
            }
        }

        function toggleHistory(id) {
            const stem = stems.find(function(s) { return s.id === id; });
            if (!stem) return;
            stem.expanded = !stem.expanded;
            renderStems();
        }

        function restoreVersion(stemId, versionId) {
            const stem = stems.find(function(s) { return s.id === stemId; });
            if (!stem) return;
            const idx = stem.versions.findIndex(function(v) { return v.id === versionId; });
            if (idx <= 0) return;
            // Move that version to the front (becomes the new current)
            const v = stem.versions.splice(idx, 1)[0];
            stem.versions.unshift(v);
            renderStems();
            window.ProjectLog.log(activeProjectId, {
                action: 'restore',
                summary: 'Restored older version of stem · <strong>' + escapeHtml(stem.label) + '</strong>',
                detail: 'rolled back to ' + escapeHtml(v.fileName)
            });
        }

        function releaseVersion(v) {
            if (v && v.objectUrl) {
                try { URL.revokeObjectURL(v.objectUrl); } catch (e) {}
                v.objectUrl = null;
            }
        }

        function stopCurrentPreview() {
            if (currentAudio) {
                try { currentAudio.pause(); } catch (e) {}
                currentAudio = null;
            }
            if (currentPlayBtn) {
                currentPlayBtn.classList.remove('is-playing');
                const ico = currentPlayBtn.querySelector('.wave-upload__history-play-icon');
                if (ico) ico.textContent = '▶';
                currentPlayBtn = null;
            }
        }

        function playVersion(stemId, versionId, btn) {
            const stem = stems.find(function(s) { return s.id === stemId; });
            if (!stem) return;
            const ver = stem.versions.find(function(v) { return v.id === versionId; });
            if (!ver || !ver.objectUrl) return;
            // If clicking the currently-playing button, toggle to pause.
            if (currentPlayBtn === btn && currentAudio && !currentAudio.paused) {
                stopCurrentPreview();
                return;
            }
            stopCurrentPreview();
            const audio = new Audio(ver.objectUrl);
            audio.addEventListener('ended', stopCurrentPreview);
            audio.play().catch(function() {});
            currentAudio = audio;
            currentPlayBtn = btn;
            btn.classList.add('is-playing');
            const ico = btn.querySelector('.wave-upload__history-play-icon');
            if (ico) ico.textContent = '❚❚';
        }

        // ---------- Master-mix slot (single drop area) ----------
        function renderMasterFilled(info) {
            if (!masterSlot) return;
            masterSlot.classList.add('is-uploaded');
            masterSlot.innerHTML =
                '<div class="wave-upload__slot-filled">' +
                    '<button type="button" class="wave-upload__slot-remove" data-master-remove>Remove</button>' +
                    '<span class="wave-upload__slot-filled-icon" aria-hidden="true">✓</span>' +
                    '<div class="wave-upload__slot-filled-main">' +
                        '<div class="wave-upload__slot-filled-name">Master mix — ' + escapeHtml(info.name) + '</div>' +
                        '<div class="wave-upload__slot-filled-meta">' + formatBytes(info.size) + '</div>' +
                    '</div>' +
                '</div>';
        }

        function renderMasterEmpty() {
            if (!masterSlot) return;
            masterSlot.classList.remove('is-uploaded');
            masterSlot.innerHTML =
                '<label class="wave-upload__slot-empty">' +
                    '<input type="file" accept=".wav,audio/wav" data-master-input>' +
                    '<span class="wave-upload__slot-icon" aria-hidden="true">+</span>' +
                    '<span class="wave-upload__slot-label">Drop your final mix here or <em>browse for a .wav file</em></span>' +
                '</label>';
        }

        function setMaster(file) {
            masterUpload = { name: file.name, size: file.size };
            renderMasterFilled(masterUpload);
            refreshProgress();
            window.ProjectLog.log(activeProjectId, {
                action: 'upload',
                summary: 'Uploaded WAVE master mix',
                detail: escapeHtml(file.name) + ' · ' + formatBytes(file.size)
            });
        }

        function clearMaster() {
            const removed = masterUpload;
            masterUpload = null;
            renderMasterEmpty();
            refreshProgress();
            if (removed) {
                window.ProjectLog.log(activeProjectId, {
                    action: 'remove',
                    summary: 'Removed WAVE master mix',
                    detail: escapeHtml(removed.name)
                });
            }
        }

        // ---------- Wiring ----------
        if (catSelect) {
            catSelect.addEventListener('change', function() {
                const isCustom = catSelect.value === '__custom';
                if (catCustom) {
                    catCustom.hidden = !isCustom;
                    if (isCustom) catCustom.focus();
                }
                showAddError('');
            });
        }

        if (addInput) {
            addInput.addEventListener('change', function() {
                if (!addInput.files || !addInput.files[0]) return;
                addStem(addInput.files[0]);
            });
        }

        // Master file input + remove button (events bubble up since master
        // slot is re-rendered repeatedly).
        modal.addEventListener('change', function(e) {
            const inp = e.target.closest('input[data-master-input]');
            if (inp && inp.files && inp.files[0]) setMaster(inp.files[0]);
        });

        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-master-remove]')) { clearMaster(); return; }
            const stemRm = e.target.closest('[data-stem-remove]');
            if (stemRm) { removeStem(stemRm.dataset.stemRemove); return; }
            const histToggle = e.target.closest('[data-stem-history]');
            if (histToggle) { toggleHistory(histToggle.dataset.stemHistory); return; }
            const restoreBtn = e.target.closest('[data-stem-restore]');
            if (restoreBtn) { restoreVersion(restoreBtn.dataset.stemRestore, restoreBtn.dataset.versionId); return; }
            const playBtn = e.target.closest('[data-stem-play]');
            if (playBtn) { playVersion(playBtn.dataset.stemPlay, playBtn.dataset.versionId, playBtn); return; }
            if (e.target === modal || e.target.closest('[data-close-wave-upload]')) close();
        });

        // Drag & drop on the master slot
        if (masterSlot) {
            masterSlot.addEventListener('dragover', function(e) {
                e.preventDefault();
                masterSlot.classList.add('is-dragover');
            });
            masterSlot.addEventListener('dragleave', function() {
                masterSlot.classList.remove('is-dragover');
            });
            masterSlot.addEventListener('drop', function(e) {
                e.preventDefault();
                masterSlot.classList.remove('is-dragover');
                const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (file) setMaster(file);
            });
        }

        const modalCard   = modal.querySelector('.release-modal--wave');
        const editToggle  = modal.querySelector('[data-wave-edit-toggle]');

        function setEditing(on) {
            if (modalCard) modalCard.classList.toggle('is-editing', !!on);
            if (editToggle) editToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
        }

        if (editToggle) {
            editToggle.addEventListener('click', function() {
                const isOn = editToggle.getAttribute('aria-pressed') === 'true';
                setEditing(!isOn);
            });
        }

        function open(triggerBtn) {
            // Resolve which project this WAVE session belongs to so log
            // entries created inside the modal land on the right project.
            const card = triggerBtn && triggerBtn.closest('.project-card');
            activeProjectId = (card && card.dataset.projectId) || 'eternaty';
            renderMasterEmpty();
            renderStems();
            refreshProgress();
            showAddError('');
            setEditing(false);
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }

        function close() {
            stopCurrentPreview();
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }

        waveBtn.addEventListener('click', function() {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            open(waveBtn);
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) close();
        });

        const confirmBtn = modal.querySelector('[data-confirm-wave-upload]');
        if (confirmBtn) confirmBtn.addEventListener('click', function() {
            const stemCount = stems.length;
            const masterUploaded = !!masterUpload;
            if (stemCount > 0 || masterUploaded) {
                const parts = [];
                if (stemCount) parts.push(stemCount + ' stem' + (stemCount === 1 ? '' : 's'));
                if (masterUploaded) parts.push('master mix');
                window.ProjectLog.log(activeProjectId, {
                    action: 'save',
                    summary: 'Saved WAVE upload session',
                    detail: parts.join(' + ') + ' on file'
                });
            }
            close();
        });
    })();

    // -------------------- PROJECTS — Activity log modal --------------------
    // Click the Log pill on any project card → opens a modal that lists
    // every action recorded against that project (uploads, removes,
    // restores, saves, approvals, renames). Filter pills at the top
    // narrow the feed to a single team member. The modal subscribes to
    // ProjectLog updates so new entries stream in live.
    (function() {
        const modal = document.getElementById('projectLogModal');
        if (!modal) return;

        const titleEl  = modal.querySelector('[data-project-log-title]');
        const listEl   = modal.querySelector('[data-project-log-list]');
        const emptyEl  = modal.querySelector('[data-project-log-empty]');
        const filterEl = modal.querySelector('[data-project-log-filter]');

        let activeProjectId = null;
        let activeProjectName = '';
        let activeUserFilter = null;   // null = all team members

        const escapeHtml = SC.escapeHtml;

        function timeAgo(ts) {
            const diff = Math.max(0, Date.now() - ts);
            const min = Math.floor(diff / 60000);
            if (min < 1) return 'just now';
            if (min < 60) return min + ' min ago';
            const hr = Math.floor(min / 60);
            if (hr < 24) return hr + ' hr ago';
            const days = Math.floor(hr / 24);
            if (days < 30) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
            const months = Math.floor(days / 30);
            return months + ' mo ago';
        }

        function actionLabel(action) {
            const map = {
                upload:  'Upload',
                remove:  'Remove',
                restore: 'Restore',
                save:    'Save',
                approve: 'Approve',
                rename:  'Rename'
            };
            return map[action] || 'Action';
        }

        function avatarStyle(userId) {
            const path = localAsset('assets/images/artists/' + userId + '-profile.png');
            return "background-image: url('" + path + "');";
        }

        function renderEntry(e) {
            const tagClass = 'project-log__action-tag--' + e.action;
            return '<li class="project-log__item" data-help="Log-post: ' + escapeHtml(e.user.name) + ' udførte handlingen ' + actionLabel(e.action) + '. Klik andre poster for at se hver enkelt handling.">' +
                '<span class="project-log__avatar" style="' + avatarStyle(e.user.id) + '" data-help="Avatar for personen der udførte handlingen."></span>' +
                '<div class="project-log__main">' +
                    '<div class="project-log__line">' +
                        '<span class="project-log__action-tag ' + tagClass + '" data-help="Handlings-tag: Farvekodet kategori (Upload=blå, Remove=rød, Restore=grøn, Save=gul, Approve=grøn, Rename=lilla, Lyrics=pink).">' + actionLabel(e.action) + '</span>' +
                        '<strong>' + escapeHtml(e.user.name) + '</strong> · ' + e.summary +
                    '</div>' +
                    (e.detail ? '<div class="project-log__detail">' + e.detail + '</div>' : '') +
                '</div>' +
                '<div class="project-log__time" data-help="Hvor længe siden handlingen blev udført.">' + timeAgo(e.ts) + '</div>' +
            '</li>';
        }

        function renderFilter() {
            if (!filterEl) return;
            const members = window.ProjectLog.getMembers(activeProjectId);
            const allActive = activeUserFilter === null ? ' is-active' : '';
            let html = '<button type="button" class="project-log__filter-pill' + allActive + '" data-log-filter="" data-help="All members: Vis alle teammedlemmers handlinger. Klik for at fjerne medlems-filteret.">All members</button>';
            members.forEach(function(m) {
                const active = activeUserFilter === m.id ? ' is-active' : '';
                html += '<button type="button" class="project-log__filter-pill' + active + '" data-log-filter="' + m.id + '" data-help="' + escapeHtml(m.name) + ': Filtrér loggen til kun at vise handlinger udført af ' + escapeHtml(m.name) + '.">' + escapeHtml(m.name) + '</button>';
            });
            filterEl.innerHTML = html;
        }

        function renderList() {
            if (!listEl) return;
            let entries = window.ProjectLog.getEntries(activeProjectId);
            if (activeUserFilter) {
                entries = entries.filter(function(e) { return e.user.id === activeUserFilter; });
            }
            if (!entries.length) {
                listEl.innerHTML = '';
                if (emptyEl) emptyEl.hidden = false;
                return;
            }
            if (emptyEl) emptyEl.hidden = true;
            listEl.innerHTML = entries.map(renderEntry).join('');
        }

        function refresh() {
            renderFilter();
            renderList();
        }

        function open(triggerBtn) {
            const card = triggerBtn && triggerBtn.closest('.project-card');
            activeProjectId   = (triggerBtn && triggerBtn.dataset.projectId)
                              || (card && card.dataset.projectId)
                              || 'eternaty';
            activeProjectName = (card && card.dataset.projectName) || '';
            activeUserFilter  = null;
            if (titleEl) {
                titleEl.textContent = activeProjectName
                    ? 'Activity log · ' + activeProjectName
                    : 'Activity log';
            }
            refresh();
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }

        function close() {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }

        // Open from any [data-project-log] pill on any project card.
        document.addEventListener('click', function(e) {
            const trigger = e.target.closest('[data-project-log]');
            if (trigger) {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                e.preventDefault();
                open(trigger);
            }
        });

        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-project-log]')) { close(); return; }
            const filterPill = e.target.closest('[data-log-filter]');
            if (filterPill) {
                const id = filterPill.dataset.logFilter;
                activeUserFilter = id ? id : null;
                refresh();
                return;
            }
            if (e.target === modal) close();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) close();
        });

        // Live-update the modal when new entries arrive while it's open.
        window.ProjectLog.subscribe(function(projectId) {
            if (modal.classList.contains('open') && projectId === activeProjectId) refresh();
        });
    })();

    // -------------------- PROJECTS — Notes & Lyrics notebook --------------------
    // Click the Notes & Lyrics pill on a project card → opens a modal.
    // Each team member has their own structured notebook for the project,
    // divided into reorderable song sections (Intro, Verse, Chorus, etc.).
    // Words can be tagged with rhyme colors (same color = same rhyme group)
    // and clicking a word brings up rhyme suggestions from a built-in
    // dictionary covering common English + Danish endings.
    (function() {
        const modal = document.getElementById('lyricsNotebookModal');
        if (!modal) return;

        // ---------- Built-in rhyme dictionary ----------
        // Each cluster is an array of words that rhyme with each other.
        // Lookup falls back to a last-2-letter heuristic across all words
        // when the input isn't directly listed.
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

        // Build word → cluster index for direct lookups.
        const WORD_INDEX = {};
        RHYME_CLUSTERS.forEach(function(cluster, idx) {
            cluster.forEach(function(w) { WORD_INDEX[w.toLowerCase()] = idx; });
        });

        // Suggest rhymes for a word. Tries direct cluster membership first,
        // then falls back to last-2/3 letter matches across the whole dict.
        function suggestRhymes(word) {
            const w = word.toLowerCase().replace(/[^a-zæøå0-9]/g, '');
            if (!w) return [];
            const direct = WORD_INDEX[w];
            const out = [];
            const seen = {};
            seen[w] = true;
            if (typeof direct === 'number') {
                RHYME_CLUSTERS[direct].forEach(function(c) {
                    if (!seen[c]) { out.push(c); seen[c] = true; }
                });
            }
            // Fallback: gather other words ending the same way.
            const tail3 = w.slice(-3);
            const tail2 = w.slice(-2);
            const tier3 = [];
            const tier2 = [];
            RHYME_CLUSTERS.forEach(function(cluster) {
                cluster.forEach(function(c) {
                    if (seen[c]) return;
                    if (tail3.length >= 3 && c.endsWith(tail3)) tier3.push(c);
                    else if (c.endsWith(tail2)) tier2.push(c);
                });
            });
            tier3.forEach(function(c) { if (!seen[c]) { out.push(c); seen[c] = true; } });
            tier2.forEach(function(c) { if (!seen[c]) { out.push(c); seen[c] = true; } });
            return out.slice(0, 18);
        }

        // ---------- Storage layer ----------
        const STORAGE_PREFIX = 'stagecord_pro_lyrics_';

        function readBook(projectId) {
            try {
                const raw = localStorage.getItem(STORAGE_PREFIX + projectId);
                return raw ? JSON.parse(raw) : { members: {} };
            } catch (e) { return { members: {} }; }
        }

        function writeBook(projectId, book) {
            try { localStorage.setItem(STORAGE_PREFIX + projectId, JSON.stringify(book)); } catch (e) {}
        }

        // Special tab ID used for the curated "Main Lyrics" view that's
        // assembled from team-member sections.
        const MAIN_TAB_ID = '__main__';

        function getMemberBook(projectId, memberId) {
            const book = readBook(projectId);
            if (!book.members) book.members = {};
            if (!book.members[memberId]) book.members[memberId] = { sections: [], rhymes: {} };
            return { full: book, member: book.members[memberId] };
        }

        function saveMemberBook(projectId, memberId, memberBook) {
            const book = readBook(projectId);
            if (!book.members) book.members = {};
            book.members[memberId] = memberBook;
            writeBook(projectId, book);
        }

        function getMainBook(projectId) {
            const book = readBook(projectId);
            if (!book.main) book.main = { sections: [], rhymes: {}, finalized: false, finalizedAt: null };
            return book.main;
        }

        function saveMainBook(projectId, mainBook) {
            const book = readBook(projectId);
            book.main = mainBook;
            writeBook(projectId, book);
        }

        function isMainTab() { return activeMemberId === MAIN_TAB_ID; }

        // ---------- Section type catalog ----------
        const SECTION_TYPES = {
            'intro':       { label: 'Intro' },
            'verse':       { label: 'Verse' },
            'pre-chorus':  { label: 'Pre-Chorus' },
            'chorus':      { label: 'Chorus' },
            'post-chorus': { label: 'Post-Chorus' },
            'middle-8':    { label: 'Middle-8' },
            'bridge':      { label: 'Bridge' },
            'hook':        { label: 'Hook' },
            'refrain':     { label: 'Refrain' },
            'outro':       { label: 'Outro' },
            'notes':       { label: 'Notes' },
            'custom':      { label: 'Custom' }
        };

        // Auto-number Verse / Chorus sections in render order.
        function buildLabel(section, sections) {
            if (section.type === 'custom') return section.customName || 'Custom';
            if (section.type === 'verse' || section.type === 'chorus') {
                const idx = sections.filter(function(s, i) {
                    return s.type === section.type && i <= sections.indexOf(section);
                }).length;
                const total = sections.filter(function(s) { return s.type === section.type; }).length;
                return SECTION_TYPES[section.type].label + (total > 1 ? ' ' + idx : '');
            }
            return SECTION_TYPES[section.type].label;
        }

        // ---------- Color palette ----------
        // Default seed palette. Each project's palette is stored on the
        // book record under `palette` and may be extended via the
        // "+ Add color" button. Colors are auto-generated to be visually
        // distinct from existing ones in the project palette.
        const DEFAULT_PALETTE = ['#FF6A55','#FFB547','#FFE066','#43C47A','#4A90E2','#A370F0','#FF8AC8','#7DD3C0'];

        function getProjectPalette() {
            const book = readBook(activeProjectId);
            if (!book.palette || !book.palette.length) return DEFAULT_PALETTE.slice();
            return book.palette.slice();
        }

        function setProjectPalette(palette) {
            const book = readBook(activeProjectId);
            book.palette = palette.slice();
            writeBook(activeProjectId, book);
        }

        // ---------- Color helpers (HSL <-> hex) ----------
        function hexToHsl(hex) {
            const m = String(hex).replace('#','').match(/^([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
            if (!m) return { h: 0, s: 0, l: 0 };
            let r = parseInt(m[1], 16) / 255;
            let g = parseInt(m[2], 16) / 255;
            let b = parseInt(m[3], 16) / 255;
            const max = Math.max(r,g,b), min = Math.min(r,g,b);
            let h = 0, s = 0, l = (max+min)/2;
            if (max !== min) {
                const d = max - min;
                s = l > 0.5 ? d/(2-max-min) : d/(max+min);
                if (max === r) h = (g - b)/d + (g < b ? 6 : 0);
                else if (max === g) h = (b - r)/d + 2;
                else h = (r - g)/d + 4;
                h *= 60;
            }
            return { h: h, s: s*100, l: l*100 };
        }

        function hslToHex(h, s, l) {
            s /= 100; l /= 100;
            const k = function(n) { return (n + h/30) % 12; };
            const a = s * Math.min(l, 1-l);
            const f = function(n) {
                const c = l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
                return Math.round(c * 255).toString(16).padStart(2, '0');
            };
            return '#' + f(0) + f(8) + f(4);
        }

        // Pick a hue at least N° away from every existing palette hue,
        // then snap to a clean saturation/lightness so generated swatches
        // look consistent with the seed palette.
        function generateNewColor(existing) {
            const usedHues = existing.map(function(c) { return hexToHsl(c).h; });
            let bestHue = 0, bestDistance = -1;
            for (let h = 0; h < 360; h += 5) {
                let minDist = 360;
                for (let i = 0; i < usedHues.length; i++) {
                    const d = Math.abs(h - usedHues[i]);
                    const wrapped = Math.min(d, 360 - d);
                    if (wrapped < minDist) minDist = wrapped;
                }
                if (minDist > bestDistance) { bestDistance = minDist; bestHue = h; }
            }
            // Slight S/L randomisation so swatches don't look identical
            // when the palette is full and hues start to crowd.
            const sat = 65 + Math.floor(Math.random() * 15);
            const light = 58 + Math.floor(Math.random() * 8);
            return hslToHex(bestHue, sat, light);
        }

        function addPaletteColor() {
            const palette = getProjectPalette();
            const newColor = generateNewColor(palette);
            palette.push(newColor);
            setProjectPalette(palette);
            renderPalette();
            window.ProjectLog.log(activeProjectId, {
                action: 'lyrics',
                summary: 'Tilføjede ny rim-farve til paletten',
                detail: newColor
            });
        }

        // ---------- Settings (per-user, persisted) ----------
        const SETTINGS_KEY_PREFIX = 'stagecord_pro_lyrics_settings_';

        function getUserSettings() {
            try {
                const userId = window.ProjectLog.currentUser().id;
                const raw = localStorage.getItem(SETTINGS_KEY_PREFIX + userId);
                if (raw) return Object.assign({ confirmNonRhyming: true }, JSON.parse(raw));
            } catch (e) {}
            return { confirmNonRhyming: true };
        }

        function setUserSettings(s) {
            try {
                const userId = window.ProjectLog.currentUser().id;
                localStorage.setItem(SETTINGS_KEY_PREFIX + userId, JSON.stringify(s));
            } catch (e) {}
        }

        // Heuristic rhyme check for the acceptance flow. Treats two
        // words as rhyming if they share a cluster in the dictionary or
        // share at least the last 2 letters.
        function wordsRhyme(a, b) {
            if (!a || !b) return false;
            a = a.toLowerCase(); b = b.toLowerCase();
            if (a === b) return true;
            const ai = WORD_INDEX[a], bi = WORD_INDEX[b];
            if (typeof ai === 'number' && ai === bi) return true;
            if (a.length >= 2 && b.length >= 2 && a.slice(-2) === b.slice(-2)) return true;
            // Slightly looser: same final 3 letters between longer words
            if (a.length >= 3 && b.length >= 3 && a.slice(-3) === b.slice(-3)) return true;
            return false;
        }

        // ---------- Team members for the active project ----------
        // For the Eternaty prototype these are hardcoded; in a real app
        // they'd come from the project record. Other projects could add
        // their own member list here.
        const PROJECT_MEMBERS = {
            'eternaty': [
                { id: 'jeremy-freedom',   name: 'Jeremy Freedom',   role: 'Artist' },
                { id: 'malik-johnson',    name: 'Malik Johnson',    role: 'Artist' },
                { id: 'maya-thompson',    name: 'Maya Thompson',    role: 'Topliner' },
                { id: 'winston-sinclair', name: 'Winston Sinclair', role: 'Producer' }
            ]
        };

        // ---------- DOM refs ----------
        const titleEl     = modal.querySelector('[data-lyrics-title]');
        const modalCard   = modal.querySelector('.release-modal--lyrics');
        const editToggle  = modal.querySelector('[data-lyrics-edit-toggle]');
        const tabsEl      = modal.querySelector('[data-lyrics-tabs]');
        const sectionsEl  = modal.querySelector('[data-lyrics-sections]');
        const emptyEl     = modal.querySelector('[data-lyrics-empty]');
        const addSelect   = modal.querySelector('[data-lyrics-add-select]');
        const addCustom   = modal.querySelector('[data-lyrics-add-custom]');
        const addBtn      = modal.querySelector('[data-lyrics-add-btn]');
        const paletteEl   = modal.querySelector('[data-lyrics-palette]');
        const clearBtn    = modal.querySelector('[data-lyrics-clear-colors]');
        const hintEl      = modal.querySelector('[data-lyrics-mode-hint]');
        const rhymePop    = modal.querySelector('[data-lyrics-rhyme-popover]');
        const rhymeWord   = modal.querySelector('[data-lyrics-rhyme-word]');
        const rhymeList   = modal.querySelector('[data-lyrics-rhyme-list]');
        const settingsPop = modal.querySelector('[data-lyrics-settings-popover]');
        const settingsCb  = modal.querySelector('[data-lyrics-setting-confirm]');

        function openSettingsPopover() {
            if (!settingsPop) return;
            const btn = modal.querySelector('[data-lyrics-settings-btn]');
            settingsCb.checked = !!getUserSettings().confirmNonRhyming;
            settingsPop.hidden = false;
            const r = btn.getBoundingClientRect();
            const popRect = settingsPop.getBoundingClientRect();
            let top  = r.bottom + 8;
            let left = r.left;
            if (left + popRect.width > window.innerWidth - 12) left = window.innerWidth - popRect.width - 12;
            if (top + popRect.height > window.innerHeight - 12) top = r.top - popRect.height - 8;
            settingsPop.style.top  = Math.max(12, top)  + 'px';
            settingsPop.style.left = Math.max(12, left) + 'px';
        }

        function hideSettingsPopover() {
            if (settingsPop) settingsPop.hidden = true;
        }

        if (settingsCb) {
            settingsCb.addEventListener('change', function() {
                const cur = getUserSettings();
                cur.confirmNonRhyming = !!settingsCb.checked;
                setUserSettings(cur);
            });
        }

        // Master Edit-mode toggle. When ON, the modal exposes destructive
        // actions (Delete button on each section). Off by default so the
        // user has to opt in before they can accidentally remove text.
        function setMasterEditing(on) {
            if (modalCard) modalCard.classList.toggle('is-editing', !!on);
            if (editToggle) editToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
        }

        if (editToggle) {
            editToggle.addEventListener('click', function() {
                const on = editToggle.getAttribute('aria-pressed') === 'true';
                setMasterEditing(!on);
            });
        }

        // ---------- State ----------
        let activeProjectId = null;
        let activeProjectName = '';
        let activeMemberId = null;
        let activeColor = null;          // null = suggest mode; else paint mode
        let sectionSeq = 0;
        let lastFocusedEditor = null;    // remembered for "insert rhyme" action

        // Section IDs currently in edit-text mode. Kept in-memory only —
        // edit/view is a UI affordance, not persistent state. Cleared
        // when the modal opens so each session starts in view mode.
        const editingIds = new Set();

        // ---------- Inspiration pool ----------
        // A curated bank of generic poetic / lyric lines used as next-
        // line suggestions while the user is writing. Never derived from
        // the user's text — the goal is fresh stimulus, not continuation.
        const SUGGESTION_POOL = [
            'Tomorrow never feels the same',
            'Heart in pieces on the floor',
            'Where the silence breaks the dawn',
            'Lights flicker in the distance',
            'We were fire, we were flood',
            'Lover, can you hear the rain?',
            'Find me where the wild things grow',
            'Holding on to fading dreams',
            'Whisper my name to the wind',
            'Faces blur in city lights',
            'Promise me one more goodbye',
            'Drowning in a sea of words',
            "Stars don't fall the way they used to",
            'Every shadow knows my name',
            'Burning bridges I never crossed',
            'Counting hours in your absence',
            'Walking circles in the dust',
            'Echoes of a younger me',
            'Catch me if the morning comes',
            'Waves arrive without a warning',
            'I never told you what I knew',
            "There's a secret in the static",
            'My hands remember everything',
            "Don't let go before the end",
            'The mirror lied again today',
            "We're just static on a frequency",
            'Saved your number for the storm',
            'Maybe forever is too long',
            'Some doors are meant to slam',
            'You looked away and the world stopped',
            'Would you stay if I asked twice?',
            "What's a kingdom without a queen?",
            'Did the silence sound like me?',
            'Show me the ghost of your laughter',
            'Trace the outline of my hands',
            'Roses bloom in empty rooms',
            'Cigarette smoke remembers you',
            'The piano knows my secrets',
            'Take the long way home tonight',
            'Run before the bells ring out',
            'Drive until the highway ends',
            'Burn the letters, keep the flame',
            'Climb the staircase to nowhere',
            'Step into the dawn and disappear',
            'Flowers in the empty vase',
            'Rooftop conversations with the moon',
            'Half a song, a thousand miles',
            'Coffee cold and curtains drawn',
            'Photographs that lost their color',
            'Sirens in the slow part of the night',
            'Vinyl crackle in your room',
            // Danish
            'Skyggen følger med på rejsen',
            'Vi danser videre i mørket',
            'Engang før solen står op',
            'Mit hjerte er en lukket dør',
            'Stilheden bærer dit navn',
            'Stjernerne glemte at falde',
            'Jeg så dig forsvinde i regnen',
            'Lyset rammer aldrig ens to gange',
            'Tiden løber baglæns igen',
            'Du var aldrig her for længe',
            'Himlen var rød den sidste nat',
            'Vinden husker hvad vi sagde',
            'Drømme falder som papir i sneen',
            'Byen sover, men jeg vågner',
            'Kender du lyden af et farvel?',
            'Hænder der ikke kan finde hvile',
            'En sang om alt jeg ikke skrev',
            'Spejlet viser kun det jeg mangler',
            'Vejen hjem er længere end jeg tror',
            'Vi mødtes i en pause mellem ord'
        ];

        // Per-textarea current suggestion. Keyed by section id so each
        // textarea remembers its own ghost line across focus changes.
        const suggestionState = new Map();

        function pickSuggestion(except) {
            const pool = SUGGESTION_POOL.filter(function(s) { return s !== except; });
            return pool[Math.floor(Math.random() * pool.length)];
        }

        function ensureSuggestion(sectionId) {
            if (!suggestionState.has(sectionId)) {
                suggestionState.set(sectionId, pickSuggestion(null));
            }
            return suggestionState.get(sectionId);
        }

        function cycleSuggestion(sectionId) {
            const prev = suggestionState.get(sectionId) || null;
            suggestionState.set(sectionId, pickSuggestion(prev));
            updateStrip(sectionId);
        }

        function updateStrip(sectionId) {
            const strip = sectionsEl.querySelector('[data-suggestion-for="' + sectionId + '"]');
            if (!strip) return;
            const textEl = strip.querySelector('[data-suggestion-text]');
            if (textEl) textEl.textContent = '“' + ensureSuggestion(sectionId) + '”';
        }

        function showStripFor(textarea) {
            const sectionId = textarea.dataset.sectionEditor;
            ensureSuggestion(sectionId);
            updateStrip(sectionId);
            const strip = sectionsEl.querySelector('[data-suggestion-for="' + sectionId + '"]');
            if (strip) strip.classList.add('is-active');
        }

        function hideStripFor(sectionId) {
            const strip = sectionsEl.querySelector('[data-suggestion-for="' + sectionId + '"]');
            if (strip) strip.classList.remove('is-active');
        }

        // Inserts the current suggestion at the textarea's cursor as a
        // fresh line (prepending \n if not already on a new line). Picks
        // a new suggestion afterward so the user has another line ready.
        function acceptSuggestion(textarea) {
            const sectionId = textarea.dataset.sectionEditor;
            const sug = suggestionState.get(sectionId);
            if (!sug) return;
            const start = textarea.selectionStart || 0;
            const end = textarea.selectionEnd || 0;
            const before = textarea.value.slice(0, start);
            const after = textarea.value.slice(end);
            const needsNewline = before && !before.endsWith('\n');
            const insert = (needsNewline ? '\n' : '') + sug;
            textarea.value = before + insert + after;
            const newPos = (before + insert).length;
            textarea.setSelectionRange(newPos, newPos);
            setSectionContent(sectionId, textarea.value);
            // Pick a fresh, unrelated line for the next position.
            suggestionState.set(sectionId, pickSuggestion(sug));
            updateStrip(sectionId);
        }

        const escapeHtml = SC.escapeHtml;

        const escapeAttr = SC.escapeAttr;

        function newSectionId() {
            sectionSeq += 1;
            return 'sec_' + Date.now().toString(36) + '_' + sectionSeq;
        }

        function projectMembers() { return PROJECT_MEMBERS[activeProjectId] || []; }

        function avatarUrl(memberId) {
            return localAsset('assets/images/artists/' + memberId + '-profile.png');
        }

        function currentMemberBook() {
            if (isMainTab()) return getMainBook(activeProjectId);
            return getMemberBook(activeProjectId, activeMemberId).member;
        }

        function persist(memberBook) {
            if (isMainTab()) saveMainBook(activeProjectId, memberBook);
            else saveMemberBook(activeProjectId, activeMemberId, memberBook);
        }

        function isMainFinalized() {
            return !!getMainBook(activeProjectId).finalized;
        }

        // ---------- Rendering: tabs ----------
        function renderTabs() {
            const me = window.ProjectLog.currentUser();
            const mainActive = isMainTab() ? ' is-active' : '';
            const memberCount = (getMainBook(activeProjectId).sections || []).length;
            const mainTab = '<button type="button" class="lyrics-tab lyrics-tab--main' + mainActive + '" data-lyrics-tab="' + MAIN_TAB_ID + '" data-help="Main Lyrics: Den endelige tekst sammensat af bidrag fra teamet. Brug → Main-knappen på medlemmernes sektioner for at tilføje. Når I er enige, klik Finalize for at låse versionen.">' +
                '<span>Main Lyrics</span>' +
                (memberCount ? '<span class="lyrics-tab__own" style="background:rgba(255,196,0,0.22);color:#FFC400;">' + memberCount + '</span>' : '') +
            '</button>';
            const memberTabs = projectMembers().map(function(m) {
                const isOwn = m.id === me.id;
                const isActive = m.id === activeMemberId;
                const helpText = isOwn
                    ? 'Dit eget hæfte. Skriv tekst, marker rim, og brug → Main for at sende sektioner til den endelige tekst.'
                    : escapeAttr(m.name) + 's hæfte. Du kan se hvad de har skrevet og bruge → Main for at indlemme sektioner i den endelige tekst.';
                return '<button type="button" class="lyrics-tab' + (isActive ? ' is-active' : '') + '" data-lyrics-tab="' + escapeAttr(m.id) + '" data-help="' + helpText + '">' +
                    '<span class="lyrics-tab__avatar" style="background-image:url(\'' + avatarUrl(m.id) + '\');"></span>' +
                    '<span>' + escapeHtml(m.name) + '</span>' +
                    (isOwn ? '<span class="lyrics-tab__own">You</span>' : '') +
                '</button>';
            }).join('');
            tabsEl.innerHTML = mainTab + memberTabs;
        }

        // ---------- Rendering: palette ----------
        function renderPalette() {
            const palette = getProjectPalette();
            const swatches = palette.map(function(c) {
                const active = c === activeColor ? ' is-active' : '';
                return '<button type="button" class="lyrics-palette__swatch' + active + '" data-lyrics-color="' + c + '" style="background:' + c + ';" aria-label="Rhyme color ' + c + '" data-help="Rim-farve ' + c + ': Klik for at tænde malertilstand med denne farve, og klik så på ord i sektionerne for at gruppere dem som rim. Klik samme farve igen for at slukke."></button>';
            }).join('');
            const addBtn = '<button type="button" class="lyrics-palette__add" data-lyrics-add-color aria-label="Add a new rhyme color" data-help="+ Add color: Genererer en ny visuelt distinkt farve og tilføjer den til paletten. Bruges når du har brug for flere rim-grupper end paletten viser. Den genererede farve er aldrig identisk med eksisterende farver.">+</button>';
            paletteEl.innerHTML = swatches + addBtn;
            updateHint();
        }

        function updateHint() {
            if (!hintEl) return;
            if (activeColor) {
                hintEl.innerHTML = '<strong>Paint mode:</strong> klik på et ord for at give det farven <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + activeColor + ';vertical-align:middle;"></span>. Klik samme farve igen for at slå tilstanden fra.';
                hintEl.classList.add('is-painting');
            } else {
                hintEl.textContent = 'Klik et ord for at se rim-forslag. Vælg en farve i paletten ovenfor og klik på ord for at markere dem som rim.';
                hintEl.classList.remove('is-painting');
            }
        }

        // ---------- Rendering: sections ----------
        function tokenize(text, rhymes) {
            // Splits on whitespace + punctuation while preserving them so
            // line breaks and commas keep their place. Each true word
            // becomes a clickable .word span; if its lowercase stem is in
            // the rhymes map we paint the matching color.
            if (!text) return '';
            const lines = text.split('\n');
            return lines.map(function(line) {
                if (!line.trim()) return '<p class="lyrics-line lyrics-line--empty">·</p>';
                let html = '';
                const re = /([\p{L}\p{N}'-]+)|([^\p{L}\p{N}]+)/gu;
                let match;
                while ((match = re.exec(line)) !== null) {
                    if (match[1]) {
                        const tok = match[1];
                        const key = tok.toLowerCase();
                        const color = rhymes[key];
                        const styleAttr = color ? ' style="color:' + color + ';"' : '';
                        const cls = 'word' + (color ? ' has-rhyme' : '');
                        html += '<span class="' + cls + '" data-word="' + escapeAttr(key) + '"' + styleAttr + '>' + escapeHtml(tok) + '</span>';
                    } else {
                        html += escapeHtml(match[2]);
                    }
                }
                return '<p class="lyrics-line">' + html + '</p>';
            }).join('');
        }

        function renderSection(section, sections) {
            const label = buildLabel(section, sections);
            const isCustom = section.type === 'custom';
            const isEditing = editingIds.has(section.id);
            const memberBook = currentMemberBook();
            const view = tokenize(section.content || '', memberBook.rhymes || {});
            const editor = '<textarea class="lyrics-section__editor" draggable="false" data-section-editor="' + section.id + '" placeholder="Skriv din tekst her — én linje pr. linjeskift…" data-help="Tekst-editor: Skriv en linje pr. linjeskift. Hvert ord bliver en klikbar markering når du går tilbage til view-mode. Tryk → ved enden af teksten for at cykle inspirations-forslag, og Tab for at indsætte det aktuelle forslag som ny linje.">' + escapeHtml(section.content || '') + '</textarea>' +
                '<div class="lyrics-suggestion-strip" data-suggestion-for="' + section.id + '" data-help="Inspirations-bar: Et tilfældigt poetisk forslag til den næste linje — aldrig udledt fra det du allerede har skrevet. Tryk → for et nyt forslag eller Tab for at indsætte det aktuelle som ny linje.">' +
                    '<span class="lyrics-suggestion-label">Inspiration</span>' +
                    '<span class="lyrics-suggestion-text" data-suggestion-text title="Klik for at indsætte" data-help="Klik for at indsætte forslaget som ny linje i teksten — samme som Tab.">—</span>' +
                    '<span class="lyrics-suggestion-actions">' +
                        '<button type="button" class="lyrics-suggestion-btn" data-suggestion-cycle="' + section.id + '" data-help="Næste forslag: Vis et nyt tilfældigt forslag. Samme som at trykke → ved enden af teksten."><kbd>→</kbd>Næste</button>' +
                        '<button type="button" class="lyrics-suggestion-btn" data-suggestion-accept="' + section.id + '" data-help="Indsæt forslag: Indsætter den aktuelle inspiration som en ny linje ved cursorens position. Samme som Tab."><kbd>Tab</kbd>Indsæt</button>' +
                    '</span>' +
                '</div>';
            const onMain = isMainTab();
            const locked = onMain && isMainFinalized();

            const optionTags = Object.keys(SECTION_TYPES).map(function(key) {
                const sel = key === section.type ? ' selected' : '';
                return '<option value="' + key + '"' + sel + '>' + SECTION_TYPES[key].label + '</option>';
            }).join('');

            // Attribution chip on Main sections — shows which member's
            // notebook the section was sourced from.
            let sourceChip = '';
            if (onMain && section.sourceMemberId) {
                const m = projectMembers().find(function(x) { return x.id === section.sourceMemberId; });
                const sourceName = m ? m.name : section.sourceMemberId;
                const origLabel = section.sourceLabel ? '<span class="lyrics-section__source-orig">· ' + escapeHtml(section.sourceLabel) + '</span>' : '';
                sourceChip = '<span class="lyrics-section__source" data-help="Attribution: Denne Main Lyrics-sektion stammer fra ' + escapeAttr(sourceName) + 's hæfte. Når Main finalizes, kan ' + escapeAttr(sourceName) + ' (men ikke andre) gemme sine ubrugte sektioner i sit Book of Rhymes.">' +
                    '<span class="lyrics-section__source-avatar" style="background-image:url(\'' + avatarUrl(section.sourceMemberId) + '\');"></span>' +
                    'From ' + escapeHtml(sourceName) + ' ' + origLabel +
                '</span>';
            }

            // "→ Main" button only appears when viewing a member tab (not Main).
            const toMainBtn = (!onMain && section.content)
                ? '<button type="button" class="lyrics-section__action lyrics-section__action--to-main" data-section-to-main="' + section.id + '" data-help="→ Main: Kopierer denne sektion til Main Lyrics (den endelige tekst). Attribution beholdes så det er tydeligt hvem der skrev hvad.">→ Main</button>'
                : '';

            const sectionHelp = onMain
                ? 'Main Lyrics-sektion: Den endelige version sammensat fra teamets bidrag. ' + (locked ? 'Hæftet er finalized — lås op via banneret øverst hvis du vil ændre.' : 'Træk drag-håndtaget for at omarrangere; brug → Main på medlemmernes sektioner for at tilføje flere.')
                : 'Sangsektion: ' + escapeAttr(label) + '. Hver sektion har en type, en tekst, og kan indeholde rim-farve-markeringer. Træk drag-håndtaget (⋮⋮) for at omarrangere.';
            return '<li class="lyrics-section' + (locked ? ' is-locked' : '') + '" data-section-id="' + section.id + '" draggable="false" data-help="' + sectionHelp + '">' +
                '<header class="lyrics-section__head">' +
                    '<button type="button" class="lyrics-section__drag" data-section-handle="' + section.id + '" aria-label="Drag to reorder" data-help="Drag-håndtag: Hold museknappen nede her og træk sektionen op eller ned for at omarrangere rækkefølgen i hæftet. Tekst og rim følger med.">⋮⋮</button>' +
                    '<select class="lyrics-section__type" data-section-type="' + section.id + '" aria-label="Section type" data-help="Sektionstype: Skift mellem Intro, Verse, Pre-Chorus, Chorus, osv. Verses og Choruses bliver auto-nummereret efter rækkefølge.">' + optionTags + '</select>' +
                    (isCustom ? '<input type="text" class="lyrics-section__custom-name" data-section-custom="' + section.id + '" value="' + escapeAttr(section.customName || '') + '" placeholder="Section name" data-help="Custom-navn: Selvvalgt navn på sektionen.">' : '<span class="lyrics-section__label" style="font-weight:600;color:rgba(255,255,255,0.85);font-size:13px;" data-help="Sektions-label: Auto-genereret navn baseret på sektionstypen og rækkefølgen.">' + escapeHtml(label) + '</span>') +
                    sourceChip +
                    '<span class="lyrics-section__head-spacer"></span>' +
                    toMainBtn +
                    '<button type="button" class="lyrics-section__action" data-section-toggle="' + section.id + '" data-help="Edit text: Skift mellem read-mode (klikbare ord til rim/forslag) og write-mode (textarea til at skrive eller redigere teksten).">' + (isEditing ? 'Done' : 'Edit text') + '</button>' +
                    '<button type="button" class="lyrics-section__action lyrics-section__action--delete" data-section-delete="' + section.id + '" data-help="Slet sektion: Fjerner sektionen og dens tekst permanent. Skjult som default — synlig kun når master-Edit i modal-headeren er slået til.">Delete</button>' +
                '</header>' +
                '<div class="lyrics-section__body">' +
                    (isEditing
                        ? editor
                        : (section.content
                            ? '<div class="lyrics-section__view" data-section-view="' + section.id + '" data-help="Read-mode: Hvert ord er klikbart. Klik et ord for at se rim-forslag. Vælg en farve i paletten ovenfor og klik ord for at gruppere dem som rim.">' + view + '</div>'
                            : '<div class="lyrics-section__view" data-help="Tom sektion: Klik Edit text for at åbne textareaen og skrive tekst."><span class="lyrics-section__placeholder">(Ingen tekst endnu — klik <em>Edit text</em> for at skrive.)</span></div>')) +
                '</div>' +
            '</li>';
        }

        function renderMainBanner() {
            // Only rendered while viewing the Main tab. Sits above the
            // sections list inside #data-lyrics-sections is overkill —
            // we inject it at the top of the body just before the list.
            const existing = modal.querySelector('[data-lyrics-main-banner]');
            if (existing) existing.remove();
            if (!isMainTab()) return;
            const main = getMainBook(activeProjectId);
            const finalized = !!main.finalized;
            const banner = document.createElement('div');
            banner.className = 'lyrics-main-banner' + (finalized ? ' is-finalized' : '');
            banner.setAttribute('data-lyrics-main-banner', '');
            if (finalized) {
                const dateStr = main.finalizedAt ? new Date(main.finalizedAt).toLocaleDateString() : '';
                banner.innerHTML =
                    '<div class="lyrics-main-banner__main" data-help="Finalized-tilstand: Main Lyrics er låst som read-only. Hver person kan nu gemme deres ubrugte sektioner i deres eget Book of Rhymes for senere genbrug i andre projekter."><strong>✓ Lyrics finalized</strong>' + (dateStr ? ' · ' + dateStr : '') + '. Hver person kan nu gemme sine ubrugte sektioner i deres private Book of Rhymes.</div>' +
                    '<div class="lyrics-main-banner__actions">' +
                        '<button type="button" class="lyrics-main-banner__btn" data-lyrics-save-unused data-help="Save my unused: Åbner en dialog der viser DINE sektioner som IKKE blev brugt i Main Lyrics. Vælg hvilke du vil gemme i dit Book of Rhymes og tag dem med en mood (Romantic, Sad, Energetic …).">Save my unused → Book of Rhymes</button>' +
                        '<button type="button" class="lyrics-main-banner__btn lyrics-main-banner__btn--unlock" data-lyrics-unfinalize data-help="Unlock: Låser Main Lyrics op igen så I kan tilføje, fjerne eller omarrangere sektioner. Du kan altid finalize på ny.">Unlock</button>' +
                    '</div>';
            } else {
                banner.innerHTML =
                    '<div class="lyrics-main-banner__main" data-help="Main Lyrics-banner: Forklarer hvordan I bygger den endelige tekst. Når banneret bliver grønt, er teksten finalized og låst."><strong>Main Lyrics</strong> — den endelige tekst sammensat fra teamets bidrag. Brug <em>→ Main</em>-knappen på medlemmernes sektioner for at tilføje. Når I er enige, klik <strong>Finalize</strong> for at låse versionen.</div>' +
                    '<div class="lyrics-main-banner__actions">' +
                        '<button type="button" class="lyrics-main-banner__btn" data-lyrics-finalize data-help="Finalize: Låser Main Lyrics som den endelige version. Sektioner bliver read-only, og hver person kan nu gemme sine ubrugte sektioner i deres Book of Rhymes.">Finalize lyrics</button>' +
                    '</div>';
            }
            sectionsEl.parentNode.insertBefore(banner, sectionsEl);
        }

        function renderSections() {
            renderMainBanner();
            const memberBook = currentMemberBook();
            const sections = memberBook.sections || [];
            if (!sections.length) {
                sectionsEl.innerHTML = '';
                if (emptyEl) {
                    emptyEl.hidden = false;
                    emptyEl.innerHTML = isMainTab()
                        ? 'Main Lyrics er tom. Skift til en teammedlems-tab og klik <em>→ Main</em> på de sektioner I vil bruge i den endelige tekst.'
                        : 'Ingen sektioner endnu — vælg en sektionstype ovenfor og klik <em>Add</em> for at starte dit hæfte.';
                }
                return;
            }
            if (emptyEl) emptyEl.hidden = true;
            sectionsEl.innerHTML = sections.map(function(s) { return renderSection(s, sections); }).join('');
        }

        function refresh() {
            renderTabs();
            renderPalette();
            renderSections();
        }

        // ---------- Mutations ----------
        function addSection(type, customName) {
            if (!type) return;
            const memberBook = currentMemberBook();
            const section = { id: newSectionId(), type: type, content: '' };
            if (type === 'custom') section.customName = customName || 'Custom';
            memberBook.sections.push(section);
            persist(memberBook);
            editingIds.add(section.id);   // open new section in edit mode
            renderSections();
            // Focus the new section's editor
            const ta = sectionsEl.querySelector('[data-section-editor="' + section.id + '"]');
            if (ta) { ta.focus(); ta.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            window.ProjectLog.log(activeProjectId, {
                action: 'lyrics',
                summary: 'Added <strong>' + escapeHtml(buildLabel(section, memberBook.sections)) + '</strong> to <strong>' + escapeHtml(isMainTab() ? 'Main Lyrics' : memberDisplayName(activeMemberId)) + '</strong>',
                detail: ''
            });
        }

        function deleteSection(id) {
            const memberBook = currentMemberBook();
            const idx = memberBook.sections.findIndex(function(s) { return s.id === id; });
            if (idx < 0) return;
            const removed = memberBook.sections[idx];
            memberBook.sections.splice(idx, 1);
            persist(memberBook);
            editingIds.delete(id);
            renderSections();
            window.ProjectLog.log(activeProjectId, {
                action: 'lyrics',
                summary: 'Removed <strong>' + escapeHtml(buildLabel(removed, memberBook.sections.concat([removed]))) + '</strong> from <strong>' + escapeHtml(isMainTab() ? 'Main Lyrics' : memberDisplayName(activeMemberId)) + '</strong>',
                detail: ''
            });
        }

        function reorderSection(fromId, toId) {
            if (!fromId || !toId || fromId === toId) return;
            const memberBook = currentMemberBook();
            const fromIdx = memberBook.sections.findIndex(function(s) { return s.id === fromId; });
            const toIdx   = memberBook.sections.findIndex(function(s) { return s.id === toId; });
            if (fromIdx < 0 || toIdx < 0) return;
            const moved = memberBook.sections.splice(fromIdx, 1)[0];
            memberBook.sections.splice(toIdx, 0, moved);
            persist(memberBook);
            renderSections();
            window.ProjectLog.log(activeProjectId, {
                action: 'lyrics',
                summary: 'Reordered sections in <strong>' + escapeHtml(memberDisplayName(activeMemberId)) + '</strong>’s lyrics',
                detail: 'Moved ' + escapeHtml(buildLabel(moved, memberBook.sections))
            });
        }

        function setSectionType(id, type) {
            const memberBook = currentMemberBook();
            const s = memberBook.sections.find(function(x) { return x.id === id; });
            if (!s) return;
            s.type = type;
            if (type !== 'custom') delete s.customName;
            persist(memberBook);
            renderSections();
        }

        function setSectionCustomName(id, name) {
            const memberBook = currentMemberBook();
            const s = memberBook.sections.find(function(x) { return x.id === id; });
            if (!s) return;
            s.customName = name;
            persist(memberBook);
        }

        function toggleSectionEditing(id) {
            if (editingIds.has(id)) editingIds.delete(id);
            else editingIds.add(id);
            renderSections();
            if (editingIds.has(id)) {
                const ta = sectionsEl.querySelector('[data-section-editor="' + id + '"]');
                if (ta) ta.focus();
            }
        }

        function setSectionContent(id, content) {
            const memberBook = currentMemberBook();
            const s = memberBook.sections.find(function(x) { return x.id === id; });
            if (!s) return;
            s.content = content;
            persist(memberBook);
        }

        function applyRhymeColor(word, color) {
            const memberBook = currentMemberBook();
            if (!memberBook.rhymes) memberBook.rhymes = {};
            const key = word.toLowerCase();

            // Toggling off — same color clicked twice on the same word.
            if (memberBook.rhymes[key] === color) {
                delete memberBook.rhymes[key];
                persist(memberBook);
                renderSections();
                return;
            }

            // Adding to (or creating) a color group. If the user has
            // confirmation enabled and the new word does not rhyme with
            // any word already in this group, ask before applying.
            const settings = getUserSettings();
            if (settings.confirmNonRhyming) {
                const groupWords = Object.keys(memberBook.rhymes).filter(function(w) {
                    return memberBook.rhymes[w] === color && w !== key;
                });
                if (groupWords.length > 0) {
                    const matches = groupWords.some(function(w) { return wordsRhyme(key, w); });
                    if (!matches) {
                        const list = groupWords.map(function(w) { return '"' + w + '"'; }).join(', ');
                        const msg = '"' + word + '" rimer ikke åbenlyst med ' + list + '.\n\nTilføj alligevel? Du kan slå denne bekræftelse fra under Settings.';
                        if (!confirm(msg)) return;
                    }
                }
            }

            memberBook.rhymes[key] = color;
            persist(memberBook);
            renderSections();
        }

        // Copy a member section into Main Lyrics, keeping a back-reference
        // to the source so attribution + "unused" detection work later.
        function copySectionToMain(memberId, sectionId) {
            if (isMainFinalized()) {
                alert('Main Lyrics is finalized. Unlock it first to add more sections.');
                return;
            }
            const src = getMemberBook(activeProjectId, memberId).member.sections.find(function(s) { return s.id === sectionId; });
            if (!src) return;
            const main = getMainBook(activeProjectId);
            // Avoid duplicates — same source already imported.
            if (main.sections.some(function(s) { return s.sourceMemberId === memberId && s.sourceSectionId === sectionId; })) {
                alert('Den sektion er allerede i Main Lyrics.');
                return;
            }
            const memberBook = getMemberBook(activeProjectId, memberId).member;
            const copy = {
                id: newSectionId(),
                type: src.type,
                content: src.content,
                sourceMemberId: memberId,
                sourceSectionId: sectionId,
                sourceLabel: buildLabel(src, memberBook.sections)
            };
            if (src.type === 'custom') copy.customName = src.customName;
            main.sections.push(copy);
            saveMainBook(activeProjectId, main);
            window.ProjectLog.log(activeProjectId, {
                action: 'lyrics',
                summary: 'Added <strong>' + escapeHtml(buildLabel(src, memberBook.sections)) + '</strong> from <strong>' + escapeHtml(memberDisplayName(memberId)) + '</strong> to <strong>Main Lyrics</strong>',
                detail: ''
            });
            // Switch to Main tab so user sees the result.
            activeMemberId = MAIN_TAB_ID;
            refresh();
        }

        function finalizeMain() {
            if (isMainFinalized()) return;
            const main = getMainBook(activeProjectId);
            if (!main.sections.length) { alert('Main Lyrics er tom — tilføj mindst én sektion før du kan finalize.'); return; }
            if (!confirm('Finalize Main Lyrics? Sektionerne låses som read-only, og hver person får adgang til at gemme deres ubrugte sektioner i deres Book of Rhymes.')) return;
            main.finalized = true;
            main.finalizedAt = Date.now();
            saveMainBook(activeProjectId, main);
            renderSections();
            window.ProjectLog.log(activeProjectId, {
                action: 'approve',
                summary: 'Finalized <strong>Main Lyrics</strong> for <strong>' + escapeHtml(activeProjectName || activeProjectId) + '</strong>',
                detail: main.sections.length + ' section' + (main.sections.length === 1 ? '' : 's') + ' locked'
            });
        }

        function unfinalizeMain() {
            if (!isMainFinalized()) return;
            if (!confirm('Lås Main Lyrics op igen? Du kan altid finalize den på ny.')) return;
            const main = getMainBook(activeProjectId);
            main.finalized = false;
            main.finalizedAt = null;
            saveMainBook(activeProjectId, main);
            renderSections();
            window.ProjectLog.log(activeProjectId, {
                action: 'lyrics',
                summary: 'Unlocked <strong>Main Lyrics</strong>',
                detail: ''
            });
        }

        // Compute "unused" sections for the current logged-in user — those
        // in their personal notebook that don't appear in Main Lyrics.
        function unusedSectionsForCurrentUser() {
            const me = window.ProjectLog.currentUser();
            const myBook = getMemberBook(activeProjectId, me.id).member;
            const main = getMainBook(activeProjectId);
            const usedIds = {};
            (main.sections || []).forEach(function(s) {
                if (s.sourceMemberId === me.id && s.sourceSectionId) usedIds[s.sourceSectionId] = true;
            });
            return (myBook.sections || []).filter(function(s) {
                return s.content && !usedIds[s.id];
            });
        }

        function openSaveUnusedDialog() {
            if (!window.BookOfRhymes) return;
            const unused = unusedSectionsForCurrentUser();
            const me = window.ProjectLog.currentUser();
            window.BookOfRhymes.openSaveUnused({
                userId: me.id,
                projectId: activeProjectId,
                projectName: activeProjectName,
                unused: unused.map(function(s) {
                    return {
                        sectionId: s.id,
                        type: s.type,
                        customName: s.customName || '',
                        content: s.content,
                        label: buildLabel(s, getMemberBook(activeProjectId, me.id).member.sections)
                    };
                })
            });
        }

        // Imports from Book of Rhymes — opens a picker that calls back
        // with the selected entry, which is then added as a new section
        // in the active member notebook (or Main, if user is on Main).
        function openImportPicker() {
            if (!window.BookOfRhymes) return;
            const me = window.ProjectLog.currentUser();
            window.BookOfRhymes.openPicker({
                userId: me.id,
                onPick: function(entry) {
                    if (isMainFinalized() && isMainTab()) {
                        alert('Main Lyrics er finalized. Unlock før du importerer.');
                        return;
                    }
                    const memberBook = currentMemberBook();
                    const section = {
                        id: newSectionId(),
                        type: entry.sectionType || 'verse',
                        content: entry.content
                    };
                    if (section.type === 'custom') section.customName = entry.customName || 'Custom';
                    memberBook.sections.push(section);
                    persist(memberBook);
                    refresh();
                    window.ProjectLog.log(activeProjectId, {
                        action: 'lyrics',
                        summary: 'Imported a <strong>' + escapeHtml(SECTION_TYPES[section.type] ? SECTION_TYPES[section.type].label : section.type) + '</strong> from Book of Rhymes' + (entry.mood ? ' (mood: <strong>' + escapeHtml(entry.mood) + '</strong>)' : ''),
                        detail: ''
                    });
                }
            });
        }

        function memberDisplayName(memberId) {
            const m = projectMembers().find(function(x) { return x.id === memberId; });
            return m ? m.name : memberId;
        }

        // ---------- Rhyme suggestion popover ----------
        function showRhymeSuggestions(word, anchorEl) {
            const suggestions = suggestRhymes(word);
            rhymeWord.textContent = word;
            if (!suggestions.length) {
                rhymeList.innerHTML = '<p class="lyrics-rhyme-popover__none">Ingen forslag fundet i indbygget ordbog.</p>';
            } else {
                rhymeList.innerHTML = suggestions.map(function(w) {
                    return '<button type="button" class="lyrics-rhyme-suggestion" data-lyrics-rhyme-pick="' + escapeAttr(w) + '">' + escapeHtml(w) + '</button>';
                }).join('');
            }
            // Position the popover near the clicked word, kept inside viewport.
            rhymePop.hidden = false;
            const rect = anchorEl.getBoundingClientRect();
            const popRect = rhymePop.getBoundingClientRect();
            let top = rect.bottom + 8;
            let left = rect.left;
            if (left + popRect.width > window.innerWidth - 12) left = window.innerWidth - popRect.width - 12;
            if (top + popRect.height > window.innerHeight - 12) top = rect.top - popRect.height - 8;
            rhymePop.style.top = Math.max(12, top) + 'px';
            rhymePop.style.left = Math.max(12, left) + 'px';
        }

        function hideRhymeSuggestions() { rhymePop.hidden = true; }

        function insertRhymeIntoActiveSection(word) {
            // Find the most recently focused editor; if none, use the last
            // editing section. Append the word at cursor position.
            let target = lastFocusedEditor;
            if (!target || !document.body.contains(target)) {
                target = sectionsEl.querySelector('.lyrics-section__editor');
            }
            if (!target) {
                // No editor open — flip the last section into edit mode and try again.
                const memberBook = currentMemberBook();
                const last = memberBook.sections[memberBook.sections.length - 1];
                if (!last) return;
                last._editing = true;
                renderSections();
                target = sectionsEl.querySelector('[data-section-editor="' + last.id + '"]');
            }
            if (!target) return;
            target.focus();
            const start = target.selectionStart || target.value.length;
            const end = target.selectionEnd || target.value.length;
            const before = target.value.slice(0, start);
            const after = target.value.slice(end);
            const needsSpace = before && !/\s$/.test(before);
            const insert = (needsSpace ? ' ' : '') + word;
            target.value = before + insert + after;
            target.setSelectionRange(start + insert.length, start + insert.length);
            // Persist and let view update on next blur/render
            const id = target.dataset.sectionEditor;
            setSectionContent(id, target.value);
        }

        // ---------- Drag & drop reordering ----------
        let dragSourceId = null;

        // Only arm draggability on the parent <li> when the user actually
        // grabs the drag handle. This frees up the textarea inside the
        // section for normal click-to-focus and text selection — otherwise
        // Chrome treats the whole li as draggable and starts a drag when
        // the user mousedowns on the textarea.
        sectionsEl.addEventListener('mousedown', function(e) {
            const li = e.target.closest('.lyrics-section');
            if (!li) return;
            const onHandle = !!e.target.closest('.lyrics-section__drag');
            li.setAttribute('draggable', onHandle ? 'true' : 'false');
        });

        // Reset draggability when the mouse is released anywhere — keeps
        // the li passive between drag attempts.
        document.addEventListener('mouseup', function() {
            sectionsEl.querySelectorAll('.lyrics-section[draggable="true"]').forEach(function(li) {
                li.setAttribute('draggable', 'false');
            });
        });

        sectionsEl.addEventListener('dragstart', function(e) {
            const li = e.target.closest('.lyrics-section');
            if (!li) return;
            dragSourceId = li.dataset.sectionId;
            li.classList.add('is-dragging');
            try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragSourceId); } catch (err) {}
        });

        sectionsEl.addEventListener('dragend', function(e) {
            const li = e.target.closest('.lyrics-section');
            if (li) li.classList.remove('is-dragging');
            sectionsEl.querySelectorAll('.lyrics-section.is-drop-target').forEach(function(el) {
                el.classList.remove('is-drop-target');
            });
            dragSourceId = null;
        });

        sectionsEl.addEventListener('dragover', function(e) {
            const li = e.target.closest('.lyrics-section');
            if (!li || !dragSourceId) return;
            e.preventDefault();
            try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
            sectionsEl.querySelectorAll('.lyrics-section.is-drop-target').forEach(function(el) {
                if (el !== li) el.classList.remove('is-drop-target');
            });
            if (li.dataset.sectionId !== dragSourceId) li.classList.add('is-drop-target');
        });

        sectionsEl.addEventListener('drop', function(e) {
            const li = e.target.closest('.lyrics-section');
            if (!li || !dragSourceId) return;
            e.preventDefault();
            const targetId = li.dataset.sectionId;
            const fromId = dragSourceId;
            dragSourceId = null;
            sectionsEl.querySelectorAll('.lyrics-section.is-drop-target').forEach(function(el) {
                el.classList.remove('is-drop-target');
            });
            if (fromId !== targetId) reorderSection(fromId, targetId);
        });

        // ---------- Click & input wiring ----------
        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-lyrics]')) { close(); return; }

            const tab = e.target.closest('[data-lyrics-tab]');
            if (tab) { activeMemberId = tab.dataset.lyricsTab; refresh(); return; }

            const swatch = e.target.closest('[data-lyrics-color]');
            if (swatch) {
                const c = swatch.dataset.lyricsColor;
                activeColor = (activeColor === c) ? null : c;
                renderPalette();
                return;
            }

            const word = e.target.closest('.word');
            if (word) {
                e.stopPropagation();
                if (activeColor) {
                    applyRhymeColor(word.dataset.word, activeColor);
                } else {
                    showRhymeSuggestions(word.dataset.word, word);
                }
                return;
            }

            const delBtn = e.target.closest('[data-section-delete]');
            if (delBtn) {
                if (confirm('Slet denne sektion og dens tekst?')) deleteSection(delBtn.dataset.sectionDelete);
                return;
            }

            const toggleBtn = e.target.closest('[data-section-toggle]');
            if (toggleBtn) { toggleSectionEditing(toggleBtn.dataset.sectionToggle); return; }

            const toMainBtn = e.target.closest('[data-section-to-main]');
            if (toMainBtn) { copySectionToMain(activeMemberId, toMainBtn.dataset.sectionToMain); return; }

            const cycleBtn = e.target.closest('[data-suggestion-cycle]');
            if (cycleBtn) {
                cycleSuggestion(cycleBtn.dataset.suggestionCycle);
                const ta = sectionsEl.querySelector('[data-section-editor="' + cycleBtn.dataset.suggestionCycle + '"]');
                if (ta) ta.focus();
                return;
            }

            const acceptBtn = e.target.closest('[data-suggestion-accept]');
            if (acceptBtn) {
                const ta = sectionsEl.querySelector('[data-section-editor="' + acceptBtn.dataset.suggestionAccept + '"]');
                if (ta) { ta.focus(); acceptSuggestion(ta); }
                return;
            }

            // Clicking the suggestion text inserts it (same as Tab).
            const sugTextHit = e.target.closest('[data-suggestion-text]');
            if (sugTextHit) {
                const strip = sugTextHit.closest('[data-suggestion-for]');
                if (strip) {
                    const id = strip.dataset.suggestionFor;
                    const ta = sectionsEl.querySelector('[data-section-editor="' + id + '"]');
                    if (ta) { ta.focus(); acceptSuggestion(ta); }
                }
                return;
            }

            if (e.target.closest('[data-lyrics-finalize]'))   { finalizeMain(); return; }
            if (e.target.closest('[data-lyrics-unfinalize]')) { unfinalizeMain(); return; }
            if (e.target.closest('[data-lyrics-save-unused]')) { openSaveUnusedDialog(); return; }
            if (e.target.closest('[data-lyrics-import-btn]')) { openImportPicker(); return; }

            const addBtnHit = e.target.closest('[data-lyrics-add-btn]');
            if (addBtnHit) {
                const type = addSelect.value;
                if (!type) return;
                const customName = (type === 'custom') ? (addCustom.value || '').trim() : '';
                if (type === 'custom' && !customName) { addCustom.focus(); return; }
                addSection(type, customName);
                addSelect.selectedIndex = 0;
                addCustom.value = '';
                addCustom.hidden = true;
                return;
            }

            if (e.target.closest('[data-lyrics-add-color]')) { addPaletteColor(); return; }

            if (e.target.closest('[data-lyrics-settings-btn]')) { openSettingsPopover(); return; }
            if (e.target.closest('[data-lyrics-settings-close]')) { hideSettingsPopover(); return; }

            const rhymePick = e.target.closest('[data-lyrics-rhyme-pick]');
            if (rhymePick) {
                insertRhymeIntoActiveSection(rhymePick.dataset.lyricsRhymePick);
                return;
            }

            if (e.target.closest('[data-lyrics-rhyme-close]')) { hideRhymeSuggestions(); return; }

            // Click on the modal backdrop closes; click elsewhere just dismisses popovers.
            if (e.target === modal) { close(); return; }
            // Dismiss the settings popover when clicking outside of it (and outside its toggle).
            if (settingsPop && !settingsPop.hidden &&
                !e.target.closest('[data-lyrics-settings-popover]') &&
                !e.target.closest('[data-lyrics-settings-btn]')) {
                hideSettingsPopover();
            }
            hideRhymeSuggestions();
        });

        // Custom-section-name field shows when user picks "Custom" in the
        // toolbar dropdown.
        if (addSelect) {
            addSelect.addEventListener('change', function() {
                if (addSelect.value === 'custom') { addCustom.hidden = false; addCustom.focus(); }
                else { addCustom.hidden = true; }
            });
        }

        // Editor input → persist on every change so reload restores text.
        sectionsEl.addEventListener('input', function(e) {
            const ta = e.target.closest('[data-section-editor]');
            if (!ta) return;
            setSectionContent(ta.dataset.sectionEditor, ta.value);
        });

        // Track which editor was last focused so "Insert rhyme" knows
        // where to drop the suggested word, and reveal the inspiration
        // strip with a fresh suggestion.
        sectionsEl.addEventListener('focusin', function(e) {
            const ta = e.target.closest('[data-section-editor]');
            if (!ta) return;
            lastFocusedEditor = ta;
            showStripFor(ta);
        });

        // Hide the inspiration strip when focus leaves the textarea —
        // unless focus moved onto the strip's own buttons (then it stays).
        sectionsEl.addEventListener('focusout', function(e) {
            const ta = e.target.closest('[data-section-editor]');
            if (!ta) return;
            const sectionId = ta.dataset.sectionEditor;
            // Defer so a click on the strip's button can re-focus the textarea.
            setTimeout(function() {
                const strip = sectionsEl.querySelector('[data-suggestion-for="' + sectionId + '"]');
                if (!strip) return;
                if (strip.contains(document.activeElement)) return;
                if (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.sectionEditor === sectionId) return;
                strip.classList.remove('is-active');
            }, 120);
        });

        // Keyboard handling: → cycles suggestion when cursor is at end of
        // the textarea; Tab inserts the suggestion as a new line.
        sectionsEl.addEventListener('keydown', function(e) {
            const ta = e.target.closest('[data-section-editor]');
            if (!ta) return;
            const sectionId = ta.dataset.sectionEditor;

            if (e.key === 'ArrowRight'
                && ta.selectionStart === ta.value.length
                && ta.selectionEnd === ta.value.length) {
                e.preventDefault();
                cycleSuggestion(sectionId);
                return;
            }

            if (e.key === 'Tab' && !e.shiftKey) {
                if (suggestionState.has(sectionId)) {
                    e.preventDefault();
                    acceptSuggestion(ta);
                }
                return;
            }

            // After Enter at end-of-text, refresh to a fresh line so the
            // ghost stays unrelated to the line that was just typed.
            if (e.key === 'Enter') {
                const isAtEnd = ta.selectionStart === ta.value.length;
                if (isAtEnd) {
                    setTimeout(function() {
                        const cur = suggestionState.get(sectionId);
                        suggestionState.set(sectionId, pickSuggestion(cur));
                        updateStrip(sectionId);
                    }, 0);
                }
            }
        });

        // Section-type select changes
        sectionsEl.addEventListener('change', function(e) {
            const sel = e.target.closest('[data-section-type]');
            if (sel) { setSectionType(sel.dataset.sectionType, sel.value); return; }
            const inp = e.target.closest('[data-section-custom]');
            if (inp) { setSectionCustomName(inp.dataset.sectionCustom, inp.value); return; }
        });

        // ---------- Open / close ----------
        function open(triggerBtn) {
            const card = triggerBtn && triggerBtn.closest('.project-card');
            activeProjectId   = (triggerBtn && triggerBtn.dataset.projectId)
                              || (card && card.dataset.projectId)
                              || 'eternaty';
            activeProjectName = (card && card.dataset.projectName) || '';
            // Default to the logged-in user's notebook if they're on the team,
            // else the first member.
            const me = window.ProjectLog.currentUser();
            const members = projectMembers();
            const myEntry = members.find(function(m) { return m.id === me.id; });
            activeMemberId = (myEntry && myEntry.id) || (members[0] && members[0].id) || null;
            activeColor = null;
            editingIds.clear();
            setMasterEditing(false);
            seedDemoIfEmpty();
            if (titleEl) {
                titleEl.textContent = activeProjectName
                    ? 'Notes & Lyrics · ' + activeProjectName
                    : 'Notes & Lyrics';
            }
            refresh();
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }

        function close() {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
            hideRhymeSuggestions();
            hideSettingsPopover();
        }

        // ---------- One-time demo seed ----------
        // Pre-populates Jeremy & Maya's notebooks for the Eternaty project
        // so the modal isn't empty on first open. Only runs if no member
        // has any sections yet.
        function seedDemoIfEmpty(projectId) {
            projectId = projectId || activeProjectId;
            if (projectId !== 'eternaty') return;
            const book = readBook(projectId);
            const hasAny = Object.keys(book.members || {}).some(function(k) {
                return book.members[k].sections && book.members[k].sections.length;
            });
            if (hasAny) return;
            const seed = {
                'jeremy-freedom': {
                    rhymes: { 'rain': PALETTE[0], 'pain': PALETTE[0], 'again': PALETTE[0], 'eyes': PALETTE[3], 'lies': PALETTE[3], 'skies': PALETTE[3] },
                    sections: [
                        { id: newSectionId(), type: 'intro',  content: 'Walking through the rain\nThinking of you again' },
                        { id: newSectionId(), type: 'verse',  content: 'I see it in your eyes\nNo more room for lies\nUnder the open skies\nThis is where the silence dies' },
                        { id: newSectionId(), type: 'chorus', content: 'Eternity is now\nWe figure out the how\nNo more whispered vow\nJust take a final bow' }
                    ]
                },
                'maya-thompson': {
                    rhymes: { 'fire': PALETTE[1], 'desire': PALETTE[1], 'higher': PALETTE[1] },
                    sections: [
                        { id: newSectionId(), type: 'notes', content: 'Topline ideas — try a half-time feel on the pre-chorus, push the falsetto on the second chorus.' },
                        { id: newSectionId(), type: 'pre-chorus', content: 'Light another fire\nReach a little higher\nBurning with desire' }
                    ]
                }
            };
            const updated = Object.assign({}, book, { members: Object.assign({}, book.members) });
            Object.keys(seed).forEach(function(memberId) {
                if (!updated.members[memberId] || !(updated.members[memberId].sections || []).length) {
                    updated.members[memberId] = seed[memberId];
                }
            });
            writeBook(projectId, updated);
        }

        // Seed once at script load so other features (Sheet Music) can
        // read content even if the user hasn't opened Notes & Lyrics yet.
        seedDemoIfEmpty('eternaty');

        // Open from any [data-lyrics-notebook] pill on any project card.
        document.addEventListener('click', function(e) {
            const trigger = e.target.closest('[data-lyrics-notebook]');
            if (trigger) {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                e.preventDefault();
                open(trigger);
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) {
                if (!rhymePop.hidden) { hideRhymeSuggestions(); return; }
                close();
            }
        });
    })();

    // -------------------- BOOK OF RHYMES — private text library --------------------
    // Each user has their own Book of Rhymes — a private archive of text
    // ideas saved from finalized projects. Entries are categorized by
    // section type (verse, chorus, …) and by mood (Romantic, Sad, etc.).
    // The library can be browsed standalone, used as a picker for
    // importing into a project notebook, or written into via the save-
    // unused dialog launched after a project's lyrics are finalized.
    (function() {
        const STORAGE_PREFIX = 'stagecord_pro_book_of_rhymes_';

        // 16 mood tags drawn from common music/streaming-platform taxonomies.
        // Each gets a hex color for visual recognition in cards and pills.
        const MOODS = [
            { id: 'romantic',     name: 'Romantic',     color: '#FF8AC8' },
            { id: 'sexy',         name: 'Sexy',         color: '#E62864' },
            { id: 'happy',        name: 'Happy',        color: '#FFE066' },
            { id: 'sad',          name: 'Sad',          color: '#5B7FBF' },
            { id: 'melancholy',   name: 'Melancholy',   color: '#7A8DB0' },
            { id: 'energetic',    name: 'Energetic',    color: '#FF6A55' },
            { id: 'chill',        name: 'Chill',        color: '#7DD3C0' },
            { id: 'aggressive',   name: 'Aggressive',   color: '#B33A3A' },
            { id: 'dreamy',       name: 'Dreamy',       color: '#A370F0' },
            { id: 'dark',         name: 'Dark',         color: '#3A3A4A' },
            { id: 'hopeful',      name: 'Hopeful',      color: '#43C47A' },
            { id: 'nostalgic',    name: 'Nostalgic',    color: '#C28B5A' },
            { id: 'empowering',   name: 'Empowering',   color: '#FFC400' },
            { id: 'heartbreak',   name: 'Heartbreak',   color: '#9B5DE5' },
            { id: 'playful',      name: 'Playful',      color: '#FFB547' },
            { id: 'reflective',   name: 'Reflective',   color: '#4A90E2' }
        ];
        const MOOD_INDEX = {};
        MOODS.forEach(function(m) { MOOD_INDEX[m.id] = m; });

        // Same section catalog as the lyrics module — duplicated here so
        // this module is self-contained.
        const SECTION_TYPES = {
            'intro':       'Intro',
            'verse':       'Verse',
            'pre-chorus':  'Pre-Chorus',
            'chorus':      'Chorus',
            'post-chorus': 'Post-Chorus',
            'middle-8':    'Middle-8',
            'bridge':      'Bridge',
            'hook':        'Hook',
            'refrain':     'Refrain',
            'outro':       'Outro',
            'notes':       'Notes',
            'custom':      'Custom'
        };

        // ---------- Storage ----------
        function read(userId) {
            try {
                const raw = localStorage.getItem(STORAGE_PREFIX + userId);
                return raw ? JSON.parse(raw) : { entries: [] };
            } catch (e) { return { entries: [] }; }
        }

        function write(userId, data) {
            try { localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(data)); } catch (e) {}
        }

        const escapeHtml = SC.escapeHtml;

        const escapeAttr = SC.escapeAttr;

        function newEntryId() {
            return 'bor_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
        }

        // ---------- Browse / picker modal ----------
        const modal = document.getElementById('bookOfRhymesModal');
        if (!modal) return;

        const titleEl     = modal.querySelector('[data-bor-title]');
        const introEl     = modal.querySelector('[data-bor-intro]');
        const listEl      = modal.querySelector('[data-bor-list]');
        const emptyEl     = modal.querySelector('[data-bor-empty]');
        const filterSec   = modal.querySelector('[data-bor-filter-section]');
        const filterMood  = modal.querySelector('[data-bor-filter-mood]');
        const modeTag     = modal.querySelector('[data-bor-mode-tag]');

        let currentUserId = null;
        let mode = 'browse';            // 'browse' | 'picker'
        let pickerCallback = null;
        let activeSectionFilter = '';   // '' = all
        let activeMoodFilter = '';      // '' = all

        // Populate section dropdown once at module load.
        if (filterSec) {
            Object.keys(SECTION_TYPES).forEach(function(key) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = SECTION_TYPES[key];
                filterSec.appendChild(opt);
            });
        }

        function renderMoodFilter() {
            const allActive = activeMoodFilter === '' ? ' is-active' : '';
            let html = '<button type="button" class="bor-mood-pill' + allActive + '" data-bor-mood-pill="" data-help="All moods: Vis poster med alle stemninger. Klik for at fjerne mood-filteret.">All moods</button>';
            MOODS.forEach(function(m) {
                const active = activeMoodFilter === m.id ? ' is-active' : '';
                html += '<button type="button" class="bor-mood-pill' + active + '" data-bor-mood-pill="' + m.id + '" style="' + (active ? 'color:' + m.color + ';' : '') + '" data-help="' + escapeAttr(m.name) + '-mood: Vis kun poster der er gemt med denne stemning.">' +
                    '<span class="bor-mood-pill__dot" style="background:' + m.color + ';"></span>' + m.name +
                '</button>';
            });
            filterMood.innerHTML = html;
        }

        function getEntries(userId) { return (read(userId).entries || []).slice(); }

        function addEntries(userId, newEntries) {
            const data = read(userId);
            (newEntries || []).forEach(function(e) {
                data.entries.unshift({
                    id: newEntryId(),
                    sectionType: e.sectionType || 'verse',
                    customName: e.customName || '',
                    content: e.content || '',
                    mood: e.mood || '',
                    addedAt: Date.now(),
                    sourceProject: e.sourceProject || '',
                    sourceProjectName: e.sourceProjectName || ''
                });
            });
            write(userId, data);
        }

        function deleteEntry(userId, entryId) {
            const data = read(userId);
            data.entries = data.entries.filter(function(e) { return e.id !== entryId; });
            write(userId, data);
        }

        function renderCard(entry) {
            const sectionLabel = SECTION_TYPES[entry.sectionType] || entry.sectionType;
            const mood = entry.mood ? MOOD_INDEX[entry.mood] : null;
            const moodPill = mood
                ? '<span class="bor-card__mood" style="color:' + mood.color + ';"><span class="bor-card__mood-dot" style="background:' + mood.color + ';"></span>' + mood.name + '</span>'
                : '<span class="bor-card__mood" style="color:rgba(255,255,255,0.4);">No mood</span>';
            const dateStr = entry.addedAt ? new Date(entry.addedAt).toLocaleDateString() : '';
            const sourceLine = entry.sourceProjectName
                ? 'From ' + escapeHtml(entry.sourceProjectName) + (dateStr ? ' · ' + dateStr : '')
                : (dateStr || '');
            const labelText = entry.sectionType === 'custom' && entry.customName
                ? escapeHtml(entry.customName)
                : escapeHtml(sectionLabel);
            const pickable = mode === 'picker' ? ' is-pickable' : '';
            const cardHelp = mode === 'picker'
                ? 'Tekst-post: Klik for at indsætte denne tekst-blok som ny sektion i dit aktive hæfte.'
                : 'Tekst-post: ' + labelText + (mood ? ' (mood: ' + mood.name + ')' : '') + '. Gemt fra ' + (entry.sourceProjectName ? escapeAttr(entry.sourceProjectName) : 'et tidligere projekt') + '.';
            return '<li><article class="bor-card' + pickable + '" data-bor-entry-id="' + entry.id + '" data-help="' + cardHelp + '">' +
                '<div class="bor-card__head">' +
                    '<span class="bor-card__type" data-help="Sektionstype som denne tekst er gemt under (Verse, Chorus, Bridge, osv.).">' + labelText + '</span>' +
                    moodPill +
                '</div>' +
                '<div class="bor-card__content" data-help="Tekst-indhold: Det der oprindeligt blev skrevet i sektionen. Klik kortet for at indsætte hele blokken som ny sektion i dit hæfte (i picker-mode).">' + escapeHtml(entry.content) + '</div>' +
                '<div class="bor-card__source">' +
                    '<span data-help="Kilde: Hvilket projekt og hvornår posten blev gemt.">' + sourceLine + '</span>' +
                    (mode === 'browse' ? '<button type="button" class="bor-card__delete" data-bor-entry-delete="' + entry.id + '" data-help="Slet post: Fjerner denne tekst-post permanent fra dit Book of Rhymes.">Delete</button>' : '') +
                '</div>' +
            '</article></li>';
        }

        function renderList() {
            const all = getEntries(currentUserId);
            const filtered = all.filter(function(e) {
                if (activeSectionFilter && e.sectionType !== activeSectionFilter) return false;
                if (activeMoodFilter && e.mood !== activeMoodFilter) return false;
                return true;
            });
            if (!filtered.length) {
                listEl.innerHTML = '';
                if (emptyEl) {
                    emptyEl.hidden = false;
                    if (!all.length) {
                        emptyEl.innerHTML = 'Dit Book of Rhymes er tomt. Når et projekt er finalized, kan du gemme dine ubrugte sektioner her via knappen <em>Save unused → Book of Rhymes</em> på Main Lyrics.';
                    } else {
                        emptyEl.innerHTML = 'Ingen poster matcher filtrene. Prøv at vælge <em>All sections</em> eller <em>All moods</em>.';
                    }
                }
                return;
            }
            if (emptyEl) emptyEl.hidden = true;
            listEl.innerHTML = filtered.map(renderCard).join('');
        }

        function refresh() {
            renderMoodFilter();
            renderList();
            if (modeTag) {
                modeTag.textContent = mode === 'picker' ? 'Picking section…' : 'Browse';
                modeTag.classList.toggle('is-picker', mode === 'picker');
            }
            if (introEl) {
                introEl.textContent = mode === 'picker'
                    ? 'Klik et kort for at indsætte tekst-blokken som en ny sektion i din aktive notebook. Filtrer efter sektion eller mood for at finde det rigtige idé-stykke.'
                    : 'Dit private bibliotek af tekstideer fra tidligere projekter. Klik en post for at se den fulde tekst. Filtrer efter sektion og mood, eller slet poster du ikke længere bruger.';
            }
            if (titleEl) {
                titleEl.textContent = mode === 'picker' ? 'Import from Book of Rhymes' : 'Book of Rhymes';
            }
        }

        function openBrowse() {
            currentUserId = window.ProjectLog.currentUser().id;
            mode = 'browse';
            pickerCallback = null;
            activeSectionFilter = '';
            activeMoodFilter = '';
            if (filterSec) filterSec.value = '';
            seedDemoIfEmpty(currentUserId);
            refresh();
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }

        function openPicker(opts) {
            currentUserId = (opts && opts.userId) || window.ProjectLog.currentUser().id;
            mode = 'picker';
            pickerCallback = opts && opts.onPick;
            activeSectionFilter = '';
            activeMoodFilter = '';
            if (filterSec) filterSec.value = '';
            seedDemoIfEmpty(currentUserId);
            refresh();
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }

        function close() {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
            pickerCallback = null;
        }

        // Demo seed for Jeremy (the prototype's logged-in user) so the
        // book isn't empty on first open.
        function seedDemoIfEmpty(userId) {
            const data = read(userId);
            if (data.entries && data.entries.length) return;
            if (userId !== 'jeremy-freedom') return;
            data.entries = [
                {
                    id: newEntryId(),
                    sectionType: 'verse',
                    content: 'Late night drives, the city is sleeping\nNeon reflections in puddles I\'m keeping\nEvery red light is a moment for thinking\nWhile the bassline keeps the heartbeat from sinking',
                    mood: 'nostalgic',
                    addedAt: Date.now() - 30 * 86400000,
                    sourceProjectName: 'Brooklyn Air'
                },
                {
                    id: newEntryId(),
                    sectionType: 'chorus',
                    content: 'I\'ll be the fire when the rain comes down\nHold you so close that we won\'t even drown\nLove like a wildfire — burning the town\nNothing can stop us now',
                    mood: 'romantic',
                    addedAt: Date.now() - 47 * 86400000,
                    sourceProjectName: 'Open Window'
                },
                {
                    id: newEntryId(),
                    sectionType: 'pre-chorus',
                    content: 'Push it, push it, no holding back\nLight up the world like a heart attack\nTurn it up — every wire on track',
                    mood: 'energetic',
                    addedAt: Date.now() - 12 * 86400000,
                    sourceProjectName: 'Open Window'
                },
                {
                    id: newEntryId(),
                    sectionType: 'bridge',
                    content: 'When the lights go out and the room gets quiet\nI think of all the things I never said\nMaybe silence was the loudest riot\nMaybe truth was something better left unsaid',
                    mood: 'melancholy',
                    addedAt: Date.now() - 90 * 86400000,
                    sourceProjectName: 'After Hours EP'
                }
            ];
            write(userId, data);
        }

        // Wiring
        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-bor]')) { close(); return; }

            const moodPill = e.target.closest('[data-bor-mood-pill]');
            if (moodPill) {
                activeMoodFilter = moodPill.dataset.borMoodPill || '';
                refresh();
                return;
            }

            const delBtn = e.target.closest('[data-bor-entry-delete]');
            if (delBtn) {
                e.stopPropagation();
                if (confirm('Slet denne post fra dit Book of Rhymes?')) {
                    deleteEntry(currentUserId, delBtn.dataset.borEntryDelete);
                    refresh();
                }
                return;
            }

            const card = e.target.closest('[data-bor-entry-id]');
            if (card && mode === 'picker' && pickerCallback) {
                const id = card.dataset.borEntryId;
                const entry = getEntries(currentUserId).find(function(x) { return x.id === id; });
                if (entry) {
                    try { pickerCallback(entry); } catch (err) {}
                    close();
                }
                return;
            }

            if (e.target === modal) close();
        });

        if (filterSec) {
            filterSec.addEventListener('change', function() {
                activeSectionFilter = filterSec.value;
                renderList();
            });
        }

        // Standalone toolbar button on the projects page.
        document.addEventListener('click', function(e) {
            const trigger = e.target.closest('[data-book-of-rhymes]');
            if (trigger) {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                e.preventDefault();
                openBrowse();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) close();
        });

        // ===== Save-unused dialog =====
        const saveModal       = document.getElementById('saveUnusedModal');
        const saveListEl      = saveModal && saveModal.querySelector('[data-save-unused-list]');
        const saveEmptyEl     = saveModal && saveModal.querySelector('[data-save-unused-empty]');
        const saveConfirmBtn  = saveModal && saveModal.querySelector('[data-save-unused-confirm]');

        let savePendingItems = [];     // [{ sectionId, type, customName, content, label }]
        let savePendingCtx   = null;   // { userId, projectId, projectName }

        function renderSaveUnusedList() {
            if (!saveListEl) return;
            if (!savePendingItems.length) {
                saveListEl.innerHTML = '';
                if (saveEmptyEl) saveEmptyEl.hidden = false;
                if (saveConfirmBtn) saveConfirmBtn.disabled = true;
                return;
            }
            if (saveEmptyEl) saveEmptyEl.hidden = true;
            if (saveConfirmBtn) saveConfirmBtn.disabled = false;

            const moodOptions = '<option value="">— No mood —</option>' + MOODS.map(function(m) {
                return '<option value="' + m.id + '">' + m.name + '</option>';
            }).join('');

            saveListEl.innerHTML = savePendingItems.map(function(it, idx) {
                return '<li class="save-unused__item" data-save-idx="' + idx + '" data-help="Ubrugt sektion: ' + escapeAttr(it.label) + '. Vælg om du vil gemme den til dit Book of Rhymes, og tag med en mood.">' +
                    '<div class="save-unused__head">' +
                        '<input type="checkbox" class="save-unused__check" data-save-include="' + idx + '" checked data-help="Inkluder: Hvis afkrydset, gemmes denne sektion til dit Book of Rhymes når du klikker Save selected.">' +
                        '<span class="save-unused__type" data-help="Sektionstype og navn — bevares automatisk så du kan finde teksten igen senere.">' + escapeHtml(it.label) + '</span>' +
                        '<span class="save-unused__head-spacer"></span>' +
                        '<select class="save-unused__mood-select" data-save-mood="' + idx + '" aria-label="Mood" data-help="Mood-tag: Vælg den stemning teksten bærer (Romantic, Sad, Energetic, osv.) for at kunne filtrere efter mood senere. Valgfrit.">' + moodOptions + '</select>' +
                    '</div>' +
                    '<div class="save-unused__preview" data-help="Preview af teksten — så du kan se hvad du gemmer.">' + escapeHtml(it.content) + '</div>' +
                '</li>';
            }).join('');
        }

        function openSaveUnused(opts) {
            if (!saveModal) return;
            savePendingCtx   = { userId: opts.userId, projectId: opts.projectId, projectName: opts.projectName };
            savePendingItems = (opts.unused || []).map(function(s) {
                return { sectionId: s.sectionId, type: s.type, customName: s.customName, content: s.content, label: s.label, _include: true, _mood: '' };
            });
            renderSaveUnusedList();
            saveModal.classList.add('open');
            saveModal.setAttribute('aria-hidden', 'false');
        }

        function closeSaveUnused() {
            if (!saveModal) return;
            saveModal.classList.remove('open');
            saveModal.setAttribute('aria-hidden', 'true');
            savePendingItems = [];
            savePendingCtx   = null;
        }

        function confirmSaveUnused() {
            if (!savePendingCtx) return;
            const toSave = savePendingItems.filter(function(it) { return it._include; });
            if (!toSave.length) { closeSaveUnused(); return; }
            const entries = toSave.map(function(it) {
                return {
                    sectionType: it.type,
                    customName: it.customName,
                    content: it.content,
                    mood: it._mood || '',
                    sourceProject: savePendingCtx.projectId,
                    sourceProjectName: savePendingCtx.projectName
                };
            });
            addEntries(savePendingCtx.userId, entries);
            window.ProjectLog.log(savePendingCtx.projectId, {
                action: 'lyrics',
                summary: 'Saved <strong>' + entries.length + '</strong> unused section' + (entries.length === 1 ? '' : 's') + ' to personal Book of Rhymes',
                detail: ''
            });
            closeSaveUnused();
            // Refresh the book modal if it happens to be open.
            if (modal.classList.contains('open')) refresh();
        }

        if (saveModal) {
            saveModal.addEventListener('click', function(e) {
                if (e.target.closest('[data-close-save-unused]')) { closeSaveUnused(); return; }
                if (e.target.closest('[data-save-unused-confirm]')) { confirmSaveUnused(); return; }
                if (e.target === saveModal) closeSaveUnused();
            });
            saveModal.addEventListener('change', function(e) {
                const cb = e.target.closest('[data-save-include]');
                if (cb) {
                    const idx = +cb.dataset.saveInclude;
                    if (savePendingItems[idx]) savePendingItems[idx]._include = !!cb.checked;
                    return;
                }
                const sel = e.target.closest('[data-save-mood]');
                if (sel) {
                    const idx = +sel.dataset.saveMood;
                    if (savePendingItems[idx]) savePendingItems[idx]._mood = sel.value;
                }
            });
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && saveModal.classList.contains('open')) closeSaveUnused();
            });
        }

        // Public surface
        window.BookOfRhymes = {
            openBrowse: openBrowse,
            openPicker: openPicker,
            openSaveUnused: openSaveUnused,
            getEntries: getEntries,
            addEntries: addEntries
        };
    })();

    // -------------------- PROJECTS — Sheet Music --------------------
    // Click the Sheet Music pill on a project card → opens a modal that
    // reads Main Lyrics from the project's lyrics book and lets the user
    // place a note (pitch + duration) on each word. Header inputs set the
    // project's tempo, time signature and key. A simplified treble-clef
    // staff renders above each line of lyrics and updates as notes are
    // placed. Auto-fill generates a quick melodic sketch from the chosen
    // key. All state is persisted per-project in localStorage.
    (function() {
        const modal = document.getElementById('sheetMusicModal');
        if (!modal) return;

        // ---------- Storage ----------
        const STORAGE_PREFIX = 'stagecord_pro_sheet_';

        function read(projectId) {
            try {
                const raw = localStorage.getItem(STORAGE_PREFIX + projectId);
                if (raw) return JSON.parse(raw);
            } catch (e) {}
            return { tempo: 120, time: '4/4', key: 'C', notes: {} };
        }

        function write(projectId, data) {
            try { localStorage.setItem(STORAGE_PREFIX + projectId, JSON.stringify(data)); } catch (e) {}
        }

        // ---------- Music theory constants ----------
        const PITCHES_LETTER = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        const WHITE_LETTERS  = ['C','D','E','F','G','A','B'];
        const BLACK_LETTERS  = ['C#','D#','','F#','G#','A#'];   // index aligns with white
        const OCTAVES        = [3, 4, 5];

        // Steps from C4 (treble-clef baseline). Diatonic step number per
        // letter inside an octave: C=0, D=1, E=2, F=3, G=4, A=5, B=6.
        const LETTER_STEP = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

        function pitchToStep(pitchStr) {
            // Returns diatonic step number from C4. Sharps share the
            // step of their natural neighbor (visualized in same line
            // position; key signature would normally show the accidental).
            if (!pitchStr || pitchStr === 'rest') return null;
            const m = pitchStr.match(/^([A-G])(#|b)?(\d)$/);
            if (!m) return null;
            const letter = m[1];
            const oct = parseInt(m[3], 10);
            return (oct - 4) * 7 + LETTER_STEP[letter];
        }

        // Map a step to a y-coordinate inside the SVG staff. The five
        // treble-clef lines sit at y=22, 28, 34, 40, 46 (F5 D5 B4 G4 E4).
        // Each diatonic step = 3px (half the line gap of 6px).
        const STAFF_BASELINE_Y = 46 + (LETTER_STEP.E + (4-4)*7) * 3;   // y at C4
        function stepToY(step) {
            // C4 (step 0) → y = 52. F5 (step 10) → y = 22.
            return 52 - step * 3;
        }

        // Major scales — letter-only for the autofill sketch (sharps and
        // flats are folded into the diatonic step).
        const KEY_SCALES = {
            'C':  ['C','D','E','F','G','A','B'],
            'G':  ['G','A','B','C','D','E','F#'],
            'D':  ['D','E','F#','G','A','B','C#'],
            'A':  ['A','B','C#','D','E','F#','G#'],
            'E':  ['E','F#','G#','A','B','C#','D#'],
            'B':  ['B','C#','D#','E','F#','G#','A#'],
            'F':  ['F','G','A','Bb','C','D','E'],
            'Bb': ['Bb','C','D','Eb','F','G','A'],
            'Eb': ['Eb','F','G','Ab','Bb','C','D'],
            'Ab': ['Ab','Bb','C','Db','Eb','F','G'],
            'Am': ['A','B','C','D','E','F','G'],
            'Em': ['E','F#','G','A','B','C','D'],
            'Bm': ['B','C#','D','E','F#','G','A'],
            'F#m':['F#','G#','A','B','C#','D','E'],
            'Dm': ['D','E','F','G','A','Bb','C'],
            'Gm': ['G','A','Bb','C','D','Eb','F'],
            'Cm': ['C','D','Eb','F','G','Ab','Bb']
        };

        const DURATIONS = [
            { id: 'whole',     glyph: '𝅝', label: 'Whole'    },
            { id: 'half',      glyph: '𝅗𝅥', label: 'Half'     },
            { id: 'quarter',   glyph: '♩', label: 'Quarter'  },
            { id: 'eighth',    glyph: '♪', label: 'Eighth'   },
            { id: 'sixteenth', glyph: '𝅘𝅥𝅯', label: 'Sixteenth'}
        ];
        const DURATION_INDEX = {};
        DURATIONS.forEach(function(d) { DURATION_INDEX[d.id] = d; });

        // ---------- DOM refs ----------
        const titleEl       = modal.querySelector('[data-sheet-title]');
        const sourceSel     = modal.querySelector('[data-sheet-source]');
        const tempoInp      = modal.querySelector('[data-sheet-tempo]');
        const timeSel       = modal.querySelector('[data-sheet-time]');
        const keySel        = modal.querySelector('[data-sheet-key]');
        const sectionsEl    = modal.querySelector('[data-sheet-sections]');
        const emptyEl       = modal.querySelector('[data-sheet-empty]');
        const notePop       = modal.querySelector('[data-sheet-note-popover]');
        const noteWordEl    = modal.querySelector('[data-sheet-note-word]');
        const octaveRowEl   = modal.querySelector('[data-sheet-octave-row]');
        const pitchGridEl   = modal.querySelector('[data-sheet-pitch-grid]');
        const durationRowEl = modal.querySelector('[data-sheet-duration-row]');

        // ---------- State ----------
        let activeProjectId = null;
        let activeProjectName = '';
        let activeSource = 'main';      // 'main' or a member id
        let pickerKey = null;            // which (sectionId, lineIdx, wordIdx) is being edited
        let pickerOctave = 4;

        const escapeHtml = SC.escapeHtml;

        const escapeAttr = SC.escapeAttr;

        // ---------- Reading lyrics from any source notebook ----------
        // Source can be 'main' or a member id. Returns array of
        // { sectionId, type, label, lines: [['word', 'word', ...], ...] }
        const SECTION_LABELS = {
            'intro': 'Intro', 'verse': 'Verse', 'pre-chorus': 'Pre-Chorus',
            'chorus': 'Chorus', 'post-chorus': 'Post-Chorus', 'middle-8': 'Middle-8',
            'bridge': 'Bridge', 'hook': 'Hook', 'refrain': 'Refrain',
            'outro': 'Outro', 'notes': 'Notes', 'custom': 'Custom'
        };

        const PROJECT_MEMBERS = {
            'eternaty': [
                { id: 'jeremy-freedom',   name: 'Jeremy Freedom' },
                { id: 'malik-johnson',    name: 'Malik Johnson' },
                { id: 'maya-thompson',    name: 'Maya Thompson' },
                { id: 'winston-sinclair', name: 'Winston Sinclair' }
            ]
        };

        function projectMembers() { return PROJECT_MEMBERS[activeProjectId] || []; }

        function readLyricsBook(projectId) {
            try {
                const raw = localStorage.getItem('stagecord_pro_lyrics_' + projectId);
                return raw ? JSON.parse(raw) : null;
            } catch (e) { return null; }
        }

        function sectionsToLines(sections) {
            return sections.map(function(s, idx) {
                let label = SECTION_LABELS[s.type] || s.type;
                if (s.type === 'custom') label = s.customName || 'Custom';
                if (s.type === 'verse' || s.type === 'chorus') {
                    const idxOfType = sections.filter(function(x, i) { return x.type === s.type && i <= idx; }).length;
                    const total     = sections.filter(function(x) { return x.type === s.type; }).length;
                    if (total > 1) label = label + ' ' + idxOfType;
                }
                const lines = (s.content || '').split('\n').map(function(line) {
                    return line.trim().split(/\s+/).filter(Boolean);
                });
                return { sectionId: s.id, type: s.type, label: label, lines: lines, sourceMember: s.sourceMemberId || '' };
            });
        }

        function readSourceLyrics(projectId, sourceId) {
            const book = readLyricsBook(projectId);
            if (!book) return [];
            if (sourceId === 'main') {
                if (!book.main || !book.main.sections) return [];
                return sectionsToLines(book.main.sections);
            }
            if (book.members && book.members[sourceId] && book.members[sourceId].sections) {
                return sectionsToLines(book.members[sourceId].sections);
            }
            return [];
        }

        // Picks the best default source for the current project. Prefers
        // Main if it has content; otherwise falls back to the first member
        // whose notebook has content; otherwise Main (empty state).
        function pickDefaultSource(projectId) {
            const book = readLyricsBook(projectId);
            const mainHasContent = book && book.main && (book.main.sections || []).some(function(s) {
                return (s.content || '').trim().length > 0;
            });
            if (mainHasContent) return 'main';
            if (book && book.members) {
                const me = window.ProjectLog.currentUser();
                const myBook = book.members[me.id];
                const myHas = myBook && (myBook.sections || []).some(function(s) {
                    return (s.content || '').trim().length > 0;
                });
                if (myHas) return me.id;
                const members = projectMembers();
                for (let i = 0; i < members.length; i++) {
                    const mb = book.members[members[i].id];
                    if (mb && (mb.sections || []).some(function(s) { return (s.content || '').trim().length > 0; })) {
                        return members[i].id;
                    }
                }
            }
            return 'main';
        }

        function sourceDisplayName(sourceId) {
            if (sourceId === 'main') return 'Main Lyrics';
            const m = projectMembers().find(function(x) { return x.id === sourceId; });
            return m ? m.name + '’s notebook' : sourceId;
        }

        // ---------- Data helpers ----------
        // Note keys include the source so each notebook keeps its own
        // note placements independently.
        function noteKey(sectionId, lineIdx, wordIdx) {
            return activeSource + '|' + sectionId + ':' + lineIdx + ':' + wordIdx;
        }

        function getNoteFor(sectionId, lineIdx, wordIdx) {
            const data = read(activeProjectId);
            return data.notes[noteKey(sectionId, lineIdx, wordIdx)] || null;
        }

        function setNoteFor(sectionId, lineIdx, wordIdx, note) {
            const data = read(activeProjectId);
            const k = noteKey(sectionId, lineIdx, wordIdx);
            if (note) data.notes[k] = note;
            else delete data.notes[k];
            write(activeProjectId, data);
        }

        function setHeader(field, value) {
            const data = read(activeProjectId);
            data[field] = value;
            write(activeProjectId, data);
        }

        // ---------- Rendering: staff (SVG) ----------
        function buildStaff(lineWords, sectionId, lineIdx) {
            // Width scales with word count so the staff stays readable.
            const padLeft = 36, padRight = 12, slotW = 36;
            const width = padLeft + padRight + Math.max(lineWords.length, 4) * slotW;
            const height = 70;
            // 5 staff lines spaced 6px apart, top line at y=22 (F5)
            let lines = '';
            for (let i = 0; i < 5; i++) {
                const y = 22 + i * 6;
                lines += '<line class="sheet-staff__line" x1="' + (padLeft - 4) + '" y1="' + y + '" x2="' + (width - padRight + 4) + '" y2="' + y + '"/>';
            }
            // Treble clef glyph (using a serif G; 𝄞 is the proper unicode).
            const clef = '<text class="sheet-staff__clef" x="' + (padLeft - 26) + '" y="46">𝄞</text>';
            // Time/key signature mini-labels at top right of clef
            const data = read(activeProjectId);
            const sig = '<text class="sheet-staff__signature" x="' + (padLeft - 4) + '" y="14">' + escapeHtml(data.key + ' · ' + data.time) + '</text>';

            // Notes / rests positioned per word.
            let notes = '';
            for (let i = 0; i < lineWords.length; i++) {
                const note = getNoteFor(sectionId, lineIdx, i);
                if (!note) continue;
                const cx = padLeft + i * slotW + slotW / 2;
                if (note.pitch === 'rest') {
                    notes += '<text class="sheet-staff__rest" x="' + (cx - 4) + '" y="40">𝄽</text>';
                    continue;
                }
                const step = pitchToStep(note.pitch);
                if (step === null) continue;
                const cy = stepToY(step);
                // Note head: filled for quarter+, hollow for half/whole.
                const filled = (note.duration === 'quarter' || note.duration === 'eighth' || note.duration === 'sixteenth');
                const noteHead = filled
                    ? '<ellipse class="sheet-staff__note" cx="' + cx + '" cy="' + cy + '" rx="4.2" ry="3.2"/>'
                    : '<ellipse class="sheet-staff__note" cx="' + cx + '" cy="' + cy + '" rx="4.2" ry="3.2" fill="none" stroke="#6AA9F0" stroke-width="1.4"/>';
                // Stem (skip for whole note)
                let stem = '';
                if (note.duration !== 'whole') {
                    const stemUp = step < 6;
                    const stemY1 = cy;
                    const stemY2 = stemUp ? cy - 22 : cy + 22;
                    const stemX  = stemUp ? cx + 4 : cx - 4;
                    stem = '<line class="sheet-staff__stem" x1="' + stemX + '" y1="' + stemY1 + '" x2="' + stemX + '" y2="' + stemY2 + '"/>';
                    // Flags for eighth/sixteenth: small arc(s) at the stem tip.
                    if (note.duration === 'eighth' || note.duration === 'sixteenth') {
                        const flagCount = note.duration === 'sixteenth' ? 2 : 1;
                        for (let f = 0; f < flagCount; f++) {
                            const fy = stemY2 + (stemUp ? f * 4 : -f * 4);
                            stem += '<path d="M ' + stemX + ' ' + fy + ' q 7 4 5 12" stroke="#6AA9F0" stroke-width="1.4" fill="none"/>';
                        }
                    }
                }
                // Ledger lines for notes outside the staff (above F5 step≥10, below E4 step<2).
                let ledgers = '';
                if (step < 2) {
                    for (let s = 0; s >= step; s -= 2) {
                        const ly = stepToY(s);
                        ledgers += '<line class="sheet-staff__ledger" x1="' + (cx - 7) + '" y1="' + ly + '" x2="' + (cx + 7) + '" y2="' + ly + '"/>';
                    }
                } else if (step > 10) {
                    for (let s = 12; s <= step; s += 2) {
                        const ly = stepToY(s);
                        ledgers += '<line class="sheet-staff__ledger" x1="' + (cx - 7) + '" y1="' + ly + '" x2="' + (cx + 7) + '" y2="' + ly + '"/>';
                    }
                }
                // Sharp accidental marker for # pitches.
                let acc = '';
                if (/#/.test(note.pitch)) {
                    acc = '<text x="' + (cx - 12) + '" y="' + (cy + 3) + '" class="sheet-staff__signature" style="font-size:13px;">♯</text>';
                }
                notes += ledgers + acc + noteHead + stem;
            }

            return '<svg class="sheet-staff" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMinYMid meet">' +
                lines + clef + sig + notes +
            '</svg>';
        }

        function renderWords(line, sectionId, lineIdx) {
            return '<div class="sheet-words">' + line.map(function(w, i) {
                const note = getNoteFor(sectionId, lineIdx, i);
                let cls = 'sheet-word', label = '';
                if (note) {
                    if (note.pitch === 'rest') {
                        cls += ' has-rest';
                        label = '<span class="sheet-word__pitch">REST</span>';
                    } else {
                        cls += ' has-note';
                        const dur = DURATION_INDEX[note.duration] ? DURATION_INDEX[note.duration].glyph : '';
                        label = '<span class="sheet-word__pitch">' + escapeHtml(note.pitch) + (dur ? ' ' + dur : '') + '</span>';
                    }
                }
                const helpText = note
                    ? 'Ord "' + escapeAttr(w) + '" har node ' + escapeAttr(note.pitch === 'rest' ? 'pause' : note.pitch + ' ' + (DURATION_INDEX[note.duration] ? DURATION_INDEX[note.duration].label : note.duration)) + '. Klik for at ændre.'
                    : 'Ord "' + escapeAttr(w) + '". Klik for at sætte pitch og varighed.';
                return '<button type="button" class="' + cls + '" data-sheet-word="' + escapeAttr(sectionId) + ':' + lineIdx + ':' + i + '" data-help="' + helpText + '">' +
                    escapeHtml(w) +
                    label +
                '</button>';
            }).join('') + '</div>';
        }

        function renderSourceSelect() {
            if (!sourceSel) return;
            const opts = [{ id: 'main', label: '★ Main Lyrics' }].concat(
                projectMembers().map(function(m) { return { id: m.id, label: m.name + '’s notebook' }; })
            );
            sourceSel.innerHTML = opts.map(function(o) {
                const sel = o.id === activeSource ? ' selected' : '';
                return '<option value="' + escapeAttr(o.id) + '"' + sel + '>' + escapeHtml(o.label) + '</option>';
            }).join('');
        }

        function renderSections() {
            const data = readSourceLyrics(activeProjectId, activeSource);
            if (!data.length || !data.some(function(s) { return s.lines.some(function(l) { return l.length; }); })) {
                sectionsEl.innerHTML = '';
                if (emptyEl) {
                    emptyEl.hidden = false;
                    emptyEl.innerHTML = activeSource === 'main'
                        ? '<strong>Main Lyrics er tom.</strong> Skift Source ovenfor til en team-deltagers hæfte for at placere noder direkte på deres tekst — eller gå til Notes &amp; Lyrics og brug → Main for at sammensætte den endelige tekst først.'
                        : '<strong>' + escapeHtml(sourceDisplayName(activeSource)) + ' har endnu ingen tekst.</strong> Vælg en anden Source ovenfor — eller gå til Notes &amp; Lyrics og skriv noget tekst i den persons hæfte.';
                }
                return;
            }
            if (emptyEl) emptyEl.hidden = true;
            sectionsEl.innerHTML = data.map(function(sec) {
                if (!sec.lines.some(function(l) { return l.length; })) return '';
                const sourceTag = sec.sourceMember ? '<span class="sheet-section__source">(' + escapeHtml(sec.label) + ')</span>' : '';
                let body = '';
                sec.lines.forEach(function(line, lineIdx) {
                    if (!line.length) return;
                    body += '<div class="sheet-line">' +
                        buildStaff(line, sec.sectionId, lineIdx) +
                        renderWords(line, sec.sectionId, lineIdx) +
                    '</div>';
                });
                return '<section class="sheet-section">' +
                    '<h3 class="sheet-section__title">' + escapeHtml(sec.label) + sourceTag + '</h3>' +
                    body +
                '</section>';
            }).join('');
        }

        // ---------- Note picker popover ----------
        function renderPicker() {
            const note = pickerKey ? getNoteFor(pickerKey.sec, pickerKey.line, pickerKey.word) : null;
            // Octave row
            octaveRowEl.innerHTML = OCTAVES.map(function(o) {
                const active = (o === pickerOctave) ? ' is-active' : '';
                return '<button type="button" class="sheet-octave-btn' + active + '" data-sheet-octave="' + o + '" data-help="Oktav ' + o + ': ' + (o === 4 ? 'centrale oktav (C4 = midt-C)' : (o < 4 ? 'én oktav under midt-C' : 'én oktav over midt-C')) + '.">' + o + '</button>';
            }).join('');
            // Pitch grid: 2 rows (white + black). Black row is offset.
            const activePitch = note && note.pitch !== 'rest' ? note.pitch : null;
            const whiteRow = WHITE_LETTERS.map(function(L) {
                const p = L + pickerOctave;
                const active = (p === activePitch) ? ' is-active' : '';
                return '<button type="button" class="sheet-pitch-btn' + active + '" data-sheet-pitch="' + p + '" data-help="Pitch ' + p + ': Hvid tangent (naturlig tone) i oktav ' + pickerOctave + '.">' + L + '</button>';
            }).join('');
            const blackRow = BLACK_LETTERS.map(function(L, idx) {
                if (!L) return '<button type="button" class="sheet-pitch-btn sheet-pitch-btn--spacer" disabled aria-hidden="true"></button>';
                const p = L + pickerOctave;
                const active = (p === activePitch) ? ' is-active' : '';
                return '<button type="button" class="sheet-pitch-btn sheet-pitch-btn--black' + active + '" data-sheet-pitch="' + p + '" data-help="Pitch ' + p + ': Sort tangent (krydset/forhøjet tone) i oktav ' + pickerOctave + '.">' + L + '</button>';
            }).join('');
            pitchGridEl.innerHTML =
                '<div class="sheet-pitch-row sheet-pitch-row--black">' + blackRow + '</div>' +
                '<div class="sheet-pitch-row">' + whiteRow + '</div>';
            // Duration row
            const activeDur = note ? note.duration : 'quarter';
            durationRowEl.innerHTML = DURATIONS.map(function(d) {
                const active = (d.id === activeDur) ? ' is-active' : '';
                return '<button type="button" class="sheet-duration-btn' + active + '" data-sheet-duration="' + d.id + '" data-help="' + d.label + ': ' + (d.id === 'whole' ? '4 slag' : d.id === 'half' ? '2 slag' : d.id === 'quarter' ? '1 slag' : d.id === 'eighth' ? '½ slag' : '¼ slag') + ' i 4/4.">' + d.glyph + ' <small>' + d.label + '</small></button>';
            }).join('');
        }

        function showPicker(sectionId, lineIdx, wordIdx, anchorEl, wordText) {
            pickerKey = { sec: sectionId, line: lineIdx, word: wordIdx };
            const existing = getNoteFor(sectionId, lineIdx, wordIdx);
            if (existing && existing.pitch && existing.pitch !== 'rest') {
                const m = existing.pitch.match(/(\d)$/);
                if (m) pickerOctave = parseInt(m[1], 10);
            } else {
                pickerOctave = 4;
            }
            noteWordEl.textContent = wordText;
            renderPicker();
            notePop.hidden = false;
            const r = anchorEl.getBoundingClientRect();
            const popRect = notePop.getBoundingClientRect();
            let top  = r.bottom + 8;
            let left = r.left;
            if (left + popRect.width > window.innerWidth - 12) left = window.innerWidth - popRect.width - 12;
            if (top + popRect.height > window.innerHeight - 12) top = r.top - popRect.height - 8;
            notePop.style.top  = Math.max(12, top)  + 'px';
            notePop.style.left = Math.max(12, left) + 'px';
        }

        function hidePicker() {
            notePop.hidden = true;
            pickerKey = null;
        }

        function applyPitch(pitch) {
            if (!pickerKey) return;
            const cur = getNoteFor(pickerKey.sec, pickerKey.line, pickerKey.word) || { duration: 'quarter' };
            const nextNote = { pitch: pitch, duration: cur.duration || 'quarter' };
            setNoteFor(pickerKey.sec, pickerKey.line, pickerKey.word, nextNote);
            renderPicker();
            renderSections();
        }

        function applyDuration(dur) {
            if (!pickerKey) return;
            const cur = getNoteFor(pickerKey.sec, pickerKey.line, pickerKey.word);
            if (!cur) return;
            cur.duration = dur;
            setNoteFor(pickerKey.sec, pickerKey.line, pickerKey.word, cur);
            renderPicker();
            renderSections();
        }

        function applyRest() {
            if (!pickerKey) return;
            setNoteFor(pickerKey.sec, pickerKey.line, pickerKey.word, { pitch: 'rest', duration: 'quarter' });
            renderPicker();
            renderSections();
        }

        function clearNote() {
            if (!pickerKey) return;
            setNoteFor(pickerKey.sec, pickerKey.line, pickerKey.word, null);
            renderPicker();
            renderSections();
        }

        // ---------- Auto-fill from key ----------
        // Generates a quick melodic sketch — for each word without a
        // note, picks a random pitch from the key's scale (octave 4 with
        // an occasional 5 on long lines) and a quarter duration.
        function autoFill() {
            const data = read(activeProjectId);
            const scale = KEY_SCALES[data.key] || KEY_SCALES.C;
            const sections = readSourceLyrics(activeProjectId, activeSource);
            let added = 0;
            sections.forEach(function(sec) {
                sec.lines.forEach(function(line, lineIdx) {
                    line.forEach(function(w, wordIdx) {
                        if (getNoteFor(sec.sectionId, lineIdx, wordIdx)) return;
                        const letter = scale[Math.floor(Math.random() * scale.length)];
                        const oct = (wordIdx % 7 === 0 && Math.random() < 0.3) ? 5 : 4;
                        const pitch = letter.replace('b','b') + oct;   // keep flats as-is for display
                        setNoteFor(sec.sectionId, lineIdx, wordIdx, { pitch: pitch, duration: 'quarter' });
                        added++;
                    });
                });
            });
            renderSections();
            if (added) {
                window.ProjectLog.log(activeProjectId, {
                    action: 'lyrics',
                    summary: 'Auto-fyldte <strong>Sheet Music</strong> med ' + added + ' node' + (added === 1 ? '' : 'r') + ' fra <strong>' + escapeHtml(data.key) + '</strong>',
                    detail: 'tempo ' + data.tempo + ' · taktart ' + data.time
                });
            }
        }

        function clearAllNotes() {
            if (!confirm('Fjern alle noder i Sheet Music? Tempo, taktart og toneart bevares.')) return;
            const data = read(activeProjectId);
            data.notes = {};
            write(activeProjectId, data);
            renderSections();
            window.ProjectLog.log(activeProjectId, {
                action: 'lyrics',
                summary: 'Nulstillede alle noder i <strong>Sheet Music</strong>',
                detail: ''
            });
        }

        // ---------- Open / close ----------
        function open(triggerBtn) {
            const card = triggerBtn && triggerBtn.closest('.project-card');
            activeProjectId   = (triggerBtn && triggerBtn.dataset.projectId)
                              || (card && card.dataset.projectId)
                              || 'eternaty';
            activeProjectName = (card && card.dataset.projectName) || '';
            // Pick the best source: Main if it has content, otherwise the
            // logged-in user's notebook, otherwise the first member with
            // content. This means Sheet Music is always usable, even if
            // Main Lyrics hasn't been built yet.
            activeSource = pickDefaultSource(activeProjectId);
            if (titleEl) {
                titleEl.textContent = activeProjectName ? 'Sheet Music · ' + activeProjectName : 'Sheet Music';
            }
            const data = read(activeProjectId);
            if (tempoInp) tempoInp.value = data.tempo || 120;
            if (timeSel)  timeSel.value  = data.time  || '4/4';
            if (keySel)   keySel.value   = data.key   || 'C';
            renderSourceSelect();
            renderSections();
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }

        function close() {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
            hidePicker();
        }

        // ---------- Wiring ----------
        if (tempoInp) tempoInp.addEventListener('change', function() {
            const v = parseInt(tempoInp.value, 10);
            if (!isNaN(v) && v >= 40 && v <= 240) setHeader('tempo', v);
            renderSections();
        });
        if (timeSel) timeSel.addEventListener('change', function() {
            setHeader('time', timeSel.value);
            renderSections();
        });
        if (keySel) keySel.addEventListener('change', function() {
            setHeader('key', keySel.value);
            renderSections();
        });
        if (sourceSel) sourceSel.addEventListener('change', function() {
            activeSource = sourceSel.value;
            hidePicker();
            renderSections();
        });

        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-sheet]')) { close(); return; }

            const wordHit = e.target.closest('[data-sheet-word]');
            if (wordHit) {
                const parts = wordHit.dataset.sheetWord.split(':');
                showPicker(parts[0], parseInt(parts[1], 10), parseInt(parts[2], 10), wordHit, wordHit.firstChild.textContent || wordHit.textContent.trim());
                return;
            }

            if (e.target.closest('[data-sheet-note-close]')) { hidePicker(); return; }
            if (e.target.closest('[data-sheet-rest]'))       { applyRest(); return; }
            if (e.target.closest('[data-sheet-note-clear]')) { clearNote(); return; }
            if (e.target.closest('[data-sheet-autofill]'))   { autoFill(); return; }
            if (e.target.closest('[data-sheet-clear]'))      { clearAllNotes(); return; }

            const octBtn = e.target.closest('[data-sheet-octave]');
            if (octBtn) { pickerOctave = parseInt(octBtn.dataset.sheetOctave, 10); renderPicker(); return; }

            const pBtn = e.target.closest('[data-sheet-pitch]');
            if (pBtn) { applyPitch(pBtn.dataset.sheetPitch); return; }

            const dBtn = e.target.closest('[data-sheet-duration]');
            if (dBtn) { applyDuration(dBtn.dataset.sheetDuration); return; }

            // Click outside picker (but inside modal) → hide picker.
            if (!notePop.hidden && !e.target.closest('[data-sheet-note-popover]') && !e.target.closest('[data-sheet-word]')) {
                hidePicker();
            }
            if (e.target === modal) close();
        });

        document.addEventListener('click', function(e) {
            const trigger = e.target.closest('[data-sheet-music]');
            if (trigger) {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                e.preventDefault();
                open(trigger);
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) {
                if (!notePop.hidden) { hidePicker(); return; }
                close();
            }
        });

        // ---------- Drag-and-drop note placement ----------
        // The user drags a duration shape from the palette onto a staff
        // line. Drop position determines: x → which word, y → which pitch
        // (snapped to the nearest diatonic step on the treble clef).
        // A live preview line follows the cursor showing the pitch that
        // would be placed if released right now.

        const STAFF_PAD_LEFT  = 36;
        const STAFF_PAD_RIGHT = 12;
        const STAFF_SLOT_W    = 36;
        const NATURAL_LETTERS = ['C','D','E','F','G','A','B'];

        function stepToPitchString(step) {
            // Map step (0=C4) to "C4" / "D5" etc., clamped to a safe range.
            let normalized = step;
            let oct = 4;
            while (normalized < 0)  { normalized += 7; oct--; }
            while (normalized >= 7) { normalized -= 7; oct++; }
            if (oct < 2) oct = 2;
            if (oct > 6) oct = 6;
            return NATURAL_LETTERS[normalized] + oct;
        }

        // Convert SVG-local coords back to (wordIdx, pitchString). Each
        // staff renders with viewBox width = padLeft + slotW * max(words,4)
        // + padRight; the SVG is preserveAspectRatio="xMinYMid meet" so x
        // is scaled. We measure in SVG-user units by reading viewBox.
        function svgPointToNote(svg, clientX, clientY, lineWordCount) {
            const r = svg.getBoundingClientRect();
            const vb = svg.viewBox && svg.viewBox.baseVal;
            const vbW = vb ? vb.width : r.width;
            const vbH = vb ? vb.height : r.height;
            // Calculate scale: meet preserves aspect ratio so width stretches
            // up to the SVG box; height is scaled by the same factor.
            const scale = vbW > 0 ? r.width / vbW : 1;
            // y is centered (yMid) — compute yOffset
            const renderedH = vbH * scale;
            const yOffset = (r.height - renderedH) / 2;
            const xUser = (clientX - r.left) / scale;
            const yUser = (clientY - r.top - yOffset) / scale;
            // Word index: floor((x - padLeft) / slotW), clamped.
            const slotsTotal = Math.max(lineWordCount, 4);
            let wordIdx = Math.floor((xUser - STAFF_PAD_LEFT) / STAFF_SLOT_W);
            if (wordIdx < 0) wordIdx = 0;
            if (wordIdx >= lineWordCount) wordIdx = lineWordCount - 1;
            // Pitch step: y = 52 - step*3. Clamp to a sensible range.
            const step = Math.round((52 - yUser) / 3);
            const clampedStep = Math.max(-7, Math.min(17, step));   // C3 to B5-ish
            return { wordIdx: wordIdx, step: clampedStep, pitch: stepToPitchString(clampedStep) };
        }

        let dragDuration = null;
        let activeDropLine = null;
        let dropPreviewEl = null;

        function ensurePreview() {
            if (dropPreviewEl) return dropPreviewEl;
            dropPreviewEl = document.createElement('div');
            dropPreviewEl.className = 'sheet-drop-preview';
            dropPreviewEl.innerHTML = '<span class="sheet-drop-preview__label" data-preview-label></span>';
            document.body.appendChild(dropPreviewEl);
            return dropPreviewEl;
        }

        function hidePreview() {
            if (dropPreviewEl) dropPreviewEl.style.display = 'none';
        }

        function showPreviewAt(line, svg, clientX, clientY) {
            const wordButtons = line.querySelectorAll('[data-sheet-word]');
            if (!wordButtons.length) { hidePreview(); return; }
            const info = svgPointToNote(svg, clientX, clientY, wordButtons.length);
            // Compute screen coordinates of the snapped pitch line above
            // the targeted word column.
            const r = svg.getBoundingClientRect();
            const vb = svg.viewBox && svg.viewBox.baseVal;
            const vbW = vb ? vb.width : r.width;
            const vbH = vb ? vb.height : r.height;
            const scale = vbW > 0 ? r.width / vbW : 1;
            const renderedH = vbH * scale;
            const yOffset = (r.height - renderedH) / 2;
            const yUser = 52 - info.step * 3;
            const cxUser = STAFF_PAD_LEFT + info.wordIdx * STAFF_SLOT_W + STAFF_SLOT_W / 2;
            const screenY = r.top + yOffset + yUser * scale;
            const screenX = r.left + cxUser * scale;
            const prev = ensurePreview();
            prev.style.display = 'block';
            prev.style.left = (screenX - 14) + 'px';
            prev.style.top  = (screenY - 1) + 'px';
            prev.style.width = '28px';
            const lbl = prev.querySelector('[data-preview-label]');
            const durLabel = dragDuration ? (DURATION_INDEX[dragDuration] ? DURATION_INDEX[dragDuration].label : dragDuration) : '';
            lbl.textContent = (dragDuration === 'rest' ? 'Rest' : info.pitch) + (dragDuration && dragDuration !== 'rest' ? ' · ' + durLabel : '');
        }

        modal.addEventListener('dragstart', function(e) {
            const item = e.target.closest('[data-sheet-palette-item]');
            if (!item) return;
            dragDuration = item.dataset.sheetPaletteItem;
            try {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/sheet-duration', dragDuration);
            } catch (err) {}
            item.classList.add('is-dragging');
            document.body.classList.add('sheet-is-dragging');
        });

        modal.addEventListener('dragend', function(e) {
            const item = e.target.closest('[data-sheet-palette-item]');
            if (item) item.classList.remove('is-dragging');
            document.body.classList.remove('sheet-is-dragging');
            if (activeDropLine) activeDropLine.classList.remove('is-drop-target');
            activeDropLine = null;
            dragDuration = null;
            hidePreview();
        });

        sectionsEl.addEventListener('dragover', function(e) {
            if (!dragDuration) return;
            const line = e.target.closest('.sheet-line');
            if (!line) return;
            const svg = line.querySelector('.sheet-staff');
            if (!svg) return;
            e.preventDefault();
            try { e.dataTransfer.dropEffect = 'copy'; } catch (err) {}
            if (activeDropLine && activeDropLine !== line) {
                activeDropLine.classList.remove('is-drop-target');
            }
            activeDropLine = line;
            line.classList.add('is-drop-target');
            showPreviewAt(line, svg, e.clientX, e.clientY);
        });

        sectionsEl.addEventListener('dragleave', function(e) {
            const line = e.target.closest('.sheet-line');
            if (!line) return;
            // Only clear when we leave the line entirely (not just moving
            // between its child elements).
            if (line.contains(e.relatedTarget)) return;
            line.classList.remove('is-drop-target');
            if (activeDropLine === line) activeDropLine = null;
            hidePreview();
        });

        sectionsEl.addEventListener('drop', function(e) {
            if (!dragDuration) return;
            const line = e.target.closest('.sheet-line');
            if (!line) return;
            const svg = line.querySelector('.sheet-staff');
            if (!svg) return;
            e.preventDefault();
            const wordButtons = line.querySelectorAll('[data-sheet-word]');
            if (!wordButtons.length) return;
            const info = svgPointToNote(svg, e.clientX, e.clientY, wordButtons.length);
            const wb = wordButtons[info.wordIdx];
            const parts = wb.dataset.sheetWord.split(':');
            const sectionId = parts[0];
            const lineIdx = parseInt(parts[1], 10);
            const wordIdx = parseInt(parts[2], 10);
            if (dragDuration === 'rest') {
                setNoteFor(sectionId, lineIdx, wordIdx, { pitch: 'rest', duration: 'quarter' });
            } else {
                setNoteFor(sectionId, lineIdx, wordIdx, { pitch: info.pitch, duration: dragDuration });
            }
            renderSections();
            line.classList.remove('is-drop-target');
            activeDropLine = null;
            dragDuration = null;
            hidePreview();
            document.body.classList.remove('sheet-is-dragging');
        });
    })();

    // -------------------- PROJECTS — Royalty splits popup (per-pill) --------------------
    // Each royalty pill on the project card opens a popup showing how that
    // royalty is distributed between every team member. Defaults to an
    // equal split. When a member is added through the add-member flow, the
    // splits scale down proportionally so the new person fits at 100/n.
    // Manual edits persist; the "Balance evenly" button resets to equal.
    (function() {
        const popup = document.getElementById('royaltySplitsPopup');
        const team = document.querySelector('.project-team');
        if (!popup || !team) return;

        const CATEGORIES = [
            { key: 'mechanical',  label: 'Mechanical',
              description: 'Mechanical royalty is earned every time the recording is reproduced — vinyl, CDs, downloads, and the per-stream payout from Spotify, Apple Music and other services.',
              help: 'Mechanical rights cover the right to reproduce a sound recording — physical copies, downloads, or streams. The per-stream payout is small individually but adds up at scale. In Denmark mechanical royalties are collected through NCB and split with the music publisher; in the US it’s the Mechanical Licensing Collective.' },
            { key: 'performance', label: 'Performance',
              description: 'Performance royalty is earned every time the song is performed publicly — radio, online streams, concerts, livestreams and venue playback.',
              help: 'Performance rights cover any public playback of the song — radio, TV, livestreams, venues, restaurants, gyms. Collected by KODA in Denmark (or ASCAP/BMI/SESAC, PRS, GEMA elsewhere) and split between songwriter and publisher. One of the most consistent recurring royalty streams for music creators.' },
            { key: 'covers',      label: 'Covers',
              description: 'Royalty earned when another artist records and releases their own version of the song.',
              help: 'When another artist wants to record their own version of your song they must clear a mechanical license. You receive the statutory royalty on every copy or stream of the cover — the same per-unit rate as the original. Cover income is tracked alongside mechanical and split with your publisher.' },
            { key: 'sample',      label: 'Sample',
              description: 'Royalty earned when another artist licenses a portion of your recording (a sample) for their own song.',
              help: 'Unlike covers, samples are not compulsory — every sample clearance is negotiated individually between you and the sampling artist. A typical deal gives them rights to use the snippet in exchange for an upfront fee plus a percentage of the new track’s royalties, scaled by how prominent the sample is in the final mix.' },
            { key: 'synch',       label: 'Synch',
              description: 'Synchronisation royalty is earned when the song or recording is synced to visual media — film, TV, ads, video games and trailers.',
              help: 'Synchronisation licensing pairs music with moving images. Each film, TV episode, advert or game placement is a one-off deal — a flat upfront fee plus, for some uses, ongoing royalties on broadcast. Income is split between the master-rights holder (label or self-owning artist) and the publishing-rights holder (songwriter and publisher). High-profile placements can be transformative for an artist’s career.' },
            { key: 'print',       label: 'Print Music',
              description: 'Royalty from printed and digital sheet music, tab transcriptions and lyric collections.',
              help: 'Print music royalties cover sheet music, tab books, chord-chart platforms (like Musicnotes) and digital lyric distribution. Typically a percentage of the retail price of each copy sold. Smaller stream than streaming for most artists, but still meaningful for instrumental music, music education, and widely-covered or widely-studied catalog.' },
            { key: 'tutorials',   label: 'Tutorials',
              description: 'Royalty from educational use of the song — guitar lessons, piano tutorials, music-theory walkthroughs and masterclasses.',
              help: 'Educational use of music — guitar lessons, piano walkthroughs, theory analysis, masterclass content — has historically been a grey area. STAGECORD aggregates this category so tutorial platforms can clear the rights upfront and pay a transparent per-track royalty back to the original artist and co-writers.' },
            { key: 'commercial',  label: 'Commercial',
              description: 'Royalty from commercial use beyond synch — merchandise, brand sponsorships, corporate events and name-and-likeness deals tied to the recording.',
              help: 'Commercial royalties cover any commercial use of the recording outside synchronisation: t-shirts, posters, brand sponsorships, name-and-likeness deals, corporate event playback, video-on-demand replay licensing, and similar. Each deal is typically negotiated individually. Splits between team members should reflect contribution to the recording itself, not just the songwriting.' }
        ];
        const CAT_LABELS = {};
        const CAT_DESCRIPTIONS = {};
        const CAT_HELP = {};
        CATEGORIES.forEach(function(c) {
            CAT_LABELS[c.key] = c.label;
            CAT_DESCRIPTIONS[c.key] = c.description || '';
            CAT_HELP[c.key] = c.help || c.description || '';
        });

        // splits[catKey][memberId] = percentage. Memberid is the full name.
        const splits = {};
        let activeCat = null;

        const titleEl    = popup.querySelector('[data-royalty-popup-title]');
        const hintEl     = popup.querySelector('[data-royalty-popup-hint]');
        const listEl     = popup.querySelector('[data-royalty-popup-list]');
        const totalEl    = popup.querySelector('[data-royalty-popup-total]');
        const totalNumEl = popup.querySelector('[data-royalty-popup-total-num]');
        const totalIcoEl = popup.querySelector('[data-royalty-popup-total-icon]');
        const balanceBtn = popup.querySelector('[data-royalty-popup-balance]');

        // Per-category payback: % of a derived use's earnings flowing
        // back to the original team. Defaults from the PDF spec:
        //   Covers   → 50% to original (cover artist keeps 50%)
        //   Sample   → 35% to original (sample user keeps 65%)
        //   Tutorials → 15% to original (tutorial creator keeps 85%)
        // The control is shown for any of these three categories.
        const paybackEl         = popup.querySelector('[data-royalty-payback]');
        const paybackInput      = popup.querySelector('[data-cover-payback]');
        const paybackOrigLabel  = popup.querySelector('[data-cover-payback-original]');
        const paybackCoverLabel = popup.querySelector('[data-cover-payback-cover]');
        const paybackTitleLabel = popup.querySelector('[data-cover-payback-label]');
        const paybackCreatorLbl = popup.querySelector('[data-cover-payback-creator-label]');

        const PAYBACK_DEFAULTS = {
            covers:    { pct: 50, paybackLabel: 'Cover payback (PDF default 50%)',     creator: 'cover-artisten' },
            sample:    { pct: 35, paybackLabel: 'Sample payback (PDF default 35%)',    creator: 'sample-brugeren' },
            tutorials: { pct: 15, paybackLabel: 'Tutorial payback (PDF default 15%)',  creator: 'tutorial-creatoren' }
        };
        const PAYBACK_CATEGORIES = Object.keys(PAYBACK_DEFAULTS);

        // Per-category payback values (persisted in memory across opens).
        const coverPayback = {
            covers:    PAYBACK_DEFAULTS.covers.pct,
            sample:    PAYBACK_DEFAULTS.sample.pct,
            tutorials: PAYBACK_DEFAULTS.tutorials.pct
        };

        function refreshPaybackUI(catKey) {
            const def = PAYBACK_DEFAULTS[catKey];
            if (!def) return;
            const v = coverPayback[catKey];
            if (paybackInput) paybackInput.value = formatNum(v);
            if (paybackOrigLabel) paybackOrigLabel.textContent = formatNum(v) + '%';
            if (paybackCoverLabel) paybackCoverLabel.textContent = formatNum(round2(100 - v)) + '%';
            if (paybackTitleLabel) paybackTitleLabel.textContent = def.paybackLabel;
            if (paybackCreatorLbl) paybackCreatorLbl.textContent = def.creator;
        }

        if (paybackInput) {
            paybackInput.addEventListener('input', function() {
                if (!activeCat || PAYBACK_CATEGORIES.indexOf(activeCat) < 0) return;
                const raw = String(paybackInput.value).replace(',', '.');
                let v = parseFloat(raw);
                if (!isFinite(v)) v = 0;
                v = Math.max(0, Math.min(100, round2(v)));
                coverPayback[activeCat] = v;
                if (paybackOrigLabel) paybackOrigLabel.textContent = formatNum(v) + '%';
                if (paybackCoverLabel) paybackCoverLabel.textContent = formatNum(round2(100 - v)) + '%';
            });
        }

        function readMembers() {
            const cards = team.querySelectorAll('.collaborator-card:not(.add-person)');
            return Array.from(cards).map(function(card) {
                const f = (card.querySelector('.collaborator-name__first') || {}).textContent || '';
                const r = (card.querySelector('.collaborator-name__rest')  || {}).textContent || '';
                const name = (f + ' ' + r).trim();
                const role = (card.querySelector('.collaborator-role') || {}).textContent || '';
                const img = card.querySelector('.collaborator-image');
                let bg = '', initials = '';
                if (img) {
                    if (img.classList.contains('collaborator-image--initials')) {
                        initials = img.textContent.trim();
                        bg = img.style.background || '';
                    } else {
                        bg = img.style.backgroundImage || '';
                    }
                }
                return { id: name, name: name, first: f, last: r, role: role, bg: bg, initials: initials };
            });
        }

        // Round to 2 decimal places — keeps an even split exact when 100/n
        // does not divide cleanly (e.g. 3 members → 33.33% each).
        function round2(v) { return Math.round(v * 100) / 100; }

        function equalSplit(ids) {
            const n = ids.length;
            if (n === 0) return {};
            const exact = round2(100 / n);
            const out = {};
            let sum = 0;
            ids.forEach(function(id) { out[id] = exact; sum += exact; });
            // Absorb any 0.01 drift into the first member so the total is exactly 100.
            const drift = round2(100 - sum);
            if (drift !== 0 && ids.length) out[ids[0]] = round2(out[ids[0]] + drift);
            return out;
        }

        function normaliseTo100(catSplits, ids) {
            let total = 0;
            ids.forEach(function(id) { total += (catSplits[id] || 0); });
            let drift = round2(100 - total);
            if (drift === 0) return;
            // Push the leftover into the largest share so totals always end at 100.
            const order = ids.slice().sort(function(a, b) { return (catSplits[b] || 0) - (catSplits[a] || 0); });
            for (let i = 0; i < order.length; i++) {
                const id = order[i];
                const next = round2((catSplits[id] || 0) + drift);
                if (next >= 0 && next <= 100) {
                    catSplits[id] = next;
                    return;
                }
            }
        }

        // Sync splits state with the current team. New members get squeezed
        // in at the requested share (or 100/n by default); existing values
        // scale down to make room. Removed members get dropped. Manual edits
        // stay otherwise untouched.
        //
        // proposed can be:
        //  - undefined / null: use 100/n default for all categories
        //  - a number: same share applied to every category (legacy)
        //  - an object {catKey: percent}: per-category share for the new member
        function reconcile(proposed) {
            const ids = readMembers().map(function(m) { return m.id; });
            CATEGORIES.forEach(function(c) {
                const cur = splits[c.key] = splits[c.key] || {};
                Object.keys(cur).forEach(function(id) {
                    if (ids.indexOf(id) === -1) delete cur[id];
                });
                if (ids.length === 0) return;
                const newOnes = ids.filter(function(id) { return !(id in cur); });
                if (Object.keys(cur).length === 0) {
                    Object.assign(cur, equalSplit(ids));
                    return;
                }
                if (newOnes.length === 0) return;
                const fallbackShare = round2(100 / ids.length);
                let categoryShare;
                if (proposed && typeof proposed === 'object') {
                    categoryShare = proposed[c.key];
                } else if (typeof proposed === 'number') {
                    categoryShare = proposed;
                }
                const newShare = (newOnes.length === 1 && categoryShare != null)
                    ? Math.max(0, Math.min(100, categoryShare))
                    : fallbackShare;
                const remaining = round2(100 - newShare * newOnes.length);
                let existingTotal = 0;
                Object.keys(cur).forEach(function(id) { existingTotal += cur[id]; });
                if (existingTotal <= 0) existingTotal = 1;
                Object.keys(cur).forEach(function(id) {
                    cur[id] = Math.max(0, round2(cur[id] * remaining / existingTotal));
                });
                newOnes.forEach(function(id) { cur[id] = round2(newShare); });
                normaliseTo100(cur, ids);
            });
            refreshPillStates();
        }

        const escapeHtml = SC.escapeHtml;

        // Show whole numbers as "25" and fractions trimmed to up to 2 decimals
        function formatNum(v) {
            if (v == null || isNaN(v)) return '0';
            const r = round2(v);
            if (r === Math.floor(r)) return String(r);
            return r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
        }

        function avatarHtml(m) {
            if (m.initials) {
                return '<span class="royalty-popup__avatar royalty-popup__avatar--initials" style="' + escapeHtml(m.bg || 'background:#444;') + '">' + escapeHtml(m.initials) + '</span>';
            }
            return '<span class="royalty-popup__avatar" style="background:' + (m.bg || '#1a1a1a') + ';"></span>';
        }

        function renderPopup(catKey) {
            activeCat = catKey;
            if (titleEl) titleEl.textContent = CAT_LABELS[catKey] + ' royalty';
            if (hintEl) {
                hintEl.textContent = CAT_DESCRIPTIONS[catKey] || '';
                hintEl.setAttribute('data-help', CAT_HELP[catKey] || '');
            }
            if (paybackEl) {
                const showPayback = PAYBACK_CATEGORIES.indexOf(catKey) >= 0;
                paybackEl.hidden = !showPayback;
                if (showPayback) refreshPaybackUI(catKey);
            }
            const members = readMembers();
            const cur = splits[catKey] || {};
            listEl.innerHTML = members.map(function(m, idx) {
                const val = cur[m.id] != null ? cur[m.id] : 0;
                const isCreator = idx === 0;  // first team member is the project creator
                const creatorBadge = isCreator
                    ? '<span class="royalty-popup__creator" data-help="Project creator. The creator is the only role authorised to adjust royalty splits — but reducing another member’s share requires that member’s approval before the change takes effect, to prevent silent dilution before release.">Creator</span>'
                    : '';
                return '<div class="royalty-popup__row' + (isCreator ? ' royalty-popup__row--creator' : '') + '" data-member-id="' + escapeHtml(m.id) + '">' +
                    avatarHtml(m) +
                    '<span class="royalty-popup__name">' + escapeHtml(m.name || '—') + creatorBadge +
                        (m.role ? '<span class="royalty-popup__name-role">' + escapeHtml(m.role) + '</span>' : '') +
                    '</span>' +
                    '<span class="royalty-popup__input-wrap">' +
                        '<input type="number" class="royalty-popup__input" min="0" max="100" step="0.01" inputmode="decimal" ' +
                          'data-member-id="' + escapeHtml(m.id) + '" value="' + formatNum(val) + '">' +
                        '<span class="royalty-popup__input-suffix">%</span>' +
                    '</span>' +
                '</div>';
            }).join('');
            updateTotal();
        }

        function updateTotal() {
            if (!activeCat) return;
            const cur = splits[activeCat] || {};
            let total = 0;
            Object.keys(cur).forEach(function(id) { total += (cur[id] || 0); });
            const totalRounded = round2(total);
            const isHundred = totalRounded === 100;
            if (totalNumEl) totalNumEl.textContent = formatNum(totalRounded) + '%';
            if (totalEl) totalEl.classList.toggle('royalty-popup__total--off', !isHundred);
            if (totalIcoEl) totalIcoEl.textContent = isHundred ? '✓' : '!';
        }

        // Mark each pill so the user can tell which categories have a
        // non-default (manually-tuned) split — helpful at a glance.
        function refreshPillStates() {
            const team = document.querySelector('.project-team');
            const ids = team ? Array.from(team.querySelectorAll('.collaborator-card:not(.add-person)')).map(function(card) {
                const f = (card.querySelector('.collaborator-name__first') || {}).textContent || '';
                const r = (card.querySelector('.collaborator-name__rest')  || {}).textContent || '';
                return (f + ' ' + r).trim();
            }) : [];
            const equal = equalSplit(ids);
            CATEGORIES.forEach(function(c) {
                const cur = splits[c.key] || {};
                let isCustom = false;
                ids.forEach(function(id) {
                    // Use a small epsilon to absorb float rounding noise.
                    if (Math.abs((cur[id] || 0) - (equal[id] || 0)) > 0.005) isCustom = true;
                });
                document.querySelectorAll('[data-royalty-cat="' + c.key + '"]').forEach(function(btn) {
                    btn.classList.toggle('is-set', isCustom);
                });
            });
        }

        function openPopup(catKey) {
            renderPopup(catKey);
            popup.classList.add('open');
            popup.setAttribute('aria-hidden', 'false');
            setTimeout(function() {
                const firstInput = listEl.querySelector('input.royalty-popup__input');
                if (firstInput) firstInput.focus();
            }, 0);
        }

        function closePopup() {
            popup.classList.remove('open');
            popup.setAttribute('aria-hidden', 'true');
            refreshPillStates();
        }

        // Wire each pill on the project card
        document.querySelectorAll('.pill-btn[data-royalty-cat]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                openPopup(btn.dataset.royaltyCat);
            });
        });

        // Popup interactions
        popup.addEventListener('click', function(e) {
            if (e.target === popup || e.target.closest('[data-close-royalty-popup]')) closePopup();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && popup.classList.contains('open')) closePopup();
        });
        if (listEl) {
            listEl.addEventListener('input', function(e) {
                const inp = e.target.closest('input.royalty-popup__input');
                if (!inp || !activeCat) return;
                // Accept comma OR period as decimal separator; clamp 0..100.
                const raw = String(inp.value).replace(',', '.');
                let val = parseFloat(raw);
                if (!isFinite(val)) val = 0;
                val = Math.max(0, Math.min(100, round2(val)));
                splits[activeCat] = splits[activeCat] || {};
                splits[activeCat][inp.dataset.memberId] = val;
                updateTotal();
            });
        }
        if (balanceBtn) {
            balanceBtn.addEventListener('click', function() {
                if (!activeCat) return;
                const ids = readMembers().map(function(m) { return m.id; });
                splits[activeCat] = equalSplit(ids);
                renderPopup(activeCat);
            });
        }

        // Initial sync + expose hooks for the add-member modal flow
        reconcile();
        window.__royaltySplitsReconcile = reconcile;
        window.__getRoyaltySplits = function() {
            return JSON.parse(JSON.stringify(splits));
        };
        window.__getRoyaltyMembers = readMembers;
        window.__getRoyaltyCatHelp = function(key) { return CAT_HELP[key] || ''; };
    })();

    // -------------------- PROJECTS — APPROVALS FOR RELEASE flow (Bilag A) --------------------
    document.querySelectorAll('[data-project-approvals]').forEach(function(approvals) {
        const card = approvals.closest('.project-card') || approvals.closest('.button-group--approvals').closest('article');
        const releaseBtn = (card || document).querySelector('[data-release-btn]');
        const progressEl = (card || document).querySelector('[data-release-progress]');

        function refresh() {
            const rows = approvals.querySelectorAll('.approval-row');
            const approved = approvals.querySelectorAll('.approval-row.is-approved').length;
            const total = rows.length;
            if (progressEl) {
                progressEl.textContent = approved + ' of ' + total + ' approved';
            }
            if (releaseBtn) releaseBtn.disabled = approved < total;
        }

        approvals.addEventListener('click', function(e) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            const row = e.target.closest('.approval-row');
            if (!row) return;
            row.classList.toggle('is-approved');
            row.dataset.approval = row.classList.contains('is-approved') ? 'approved' : 'pending';
            refresh();
        });

        refresh();
    });

    const releaseModal = document.getElementById('releaseModal');
    if (releaseModal) {
        const upcEl = document.getElementById('releaseUpcCode');
        const dateInput = document.getElementById('releaseDate');
        const subjectSelect = document.getElementById('releaseSubject');
        const confirmBtn = document.getElementById('releaseConfirmBtn');
        const feedback = releaseModal.querySelector('[data-release-feedback]');

        function generateUpc() {
            // Mock UPC-A code: 12 digits formatted in 1·5·5·1 groups
            let digits = '';
            for (let i = 0; i < 12; i++) digits += Math.floor(Math.random() * 10);
            return digits.charAt(0) + ' ' + digits.substr(1, 5) + ' ' + digits.substr(6, 5) + ' ' + digits.charAt(11);
        }

        function openReleaseModal() {
            if (upcEl) upcEl.textContent = generateUpc();
            if (dateInput) {
                const d = new Date();
                d.setDate(d.getDate() + 14);
                dateInput.value = d.toISOString().split('T')[0];
                dateInput.min = new Date().toISOString().split('T')[0];
            }
            if (feedback) { feedback.hidden = true; feedback.textContent = ''; }
            if (confirmBtn) confirmBtn.disabled = false;
            releaseModal.classList.add('open');
            releaseModal.setAttribute('aria-hidden', 'false');
        }

        function closeReleaseModal() {
            releaseModal.classList.remove('open');
            releaseModal.setAttribute('aria-hidden', 'true');
        }

        document.querySelectorAll('[data-release-btn]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                if (btn.disabled) return;
                openReleaseModal();
            });
        });

        releaseModal.addEventListener('click', function(e) {
            if (e.target === releaseModal || e.target.closest('[data-close-release]')) closeReleaseModal();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && releaseModal.classList.contains('open')) closeReleaseModal();
        });

        if (confirmBtn) {
            confirmBtn.addEventListener('click', function() {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                const date = dateInput ? dateInput.value : '';
                const subject = subjectSelect ? subjectSelect.options[subjectSelect.selectedIndex].text : '';
                feedback.hidden = false;
                feedback.textContent = 'Scheduled for release on ' + date + ' as ' + subject + ' · UPC ' + (upcEl ? upcEl.textContent : '') + ' written to metadata. Project will appear on every member\u2019s page.';
                confirmBtn.disabled = true;
                setTimeout(closeReleaseModal, 3000);
            });
        }
    }

    // -------------------- FEATURES — Buyer-side Original proposal modal --------------------
    const originalProposalBtn = document.getElementById('originalProposalBtn');
    const originalProposalModal = document.getElementById('originalProposalModal');
    if (originalProposalBtn && originalProposalModal) {
        const buyerActions = originalProposalModal.querySelectorAll('[data-buyer-action]');
        const buyerFeedback = originalProposalModal.querySelector('[data-buyer-feedback]');

        function openOriginalModal() {
            if (buyerFeedback) { buyerFeedback.hidden = true; buyerFeedback.textContent = ''; buyerFeedback.classList.remove('review-feature-modal__feedback--issue'); }
            buyerActions.forEach(function(b) { b.disabled = false; });
            originalProposalModal.classList.add('open');
            originalProposalModal.setAttribute('aria-hidden', 'false');
        }
        function closeOriginalModal() {
            originalProposalModal.classList.remove('open');
            originalProposalModal.setAttribute('aria-hidden', 'true');
        }

        originalProposalBtn.addEventListener('click', function() {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            openOriginalModal();
        });

        originalProposalModal.addEventListener('click', function(e) {
            if (e.target === originalProposalModal || e.target.closest('[data-close-original]')) closeOriginalModal();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && originalProposalModal.classList.contains('open')) closeOriginalModal();
        });

        buyerActions.forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                if (btn.disabled) return;
                const choice = btn.dataset.buyerAction;
                let label;
                if (choice === 'accept')  label = 'Accepted ✓ — project moved to USO\u2019s catalog and queued for promotion on their artist page. You stay credited as featured artist.';
                if (choice === 'decline') label = 'Declined — you keep full ownership and can release the project independently. It will not appear on USO\u2019s artist page.';
                if (!label) return;
                buyerFeedback.hidden = false;
                buyerFeedback.textContent = label;
                buyerFeedback.classList.toggle('review-feature-modal__feedback--issue', choice === 'decline');
                buyerActions.forEach(function(b) { b.disabled = true; });
                setTimeout(function() {
                    closeOriginalModal();
                    if (originalProposalBtn) originalProposalBtn.hidden = true;
                }, 2400);
            });
        });
    }

    // -------------------- FEATURES — For sale / Your purchased tab switcher --------------------
    const featuresTabs   = document.querySelectorAll('.features-tab');
    const featuresPanels = document.querySelectorAll('.features-panel');
    if (featuresTabs.length && featuresPanels.length) {
        featuresTabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                const target = tab.dataset.featuresTab;
                featuresTabs.forEach(function(t) {
                    const isActive = t === tab;
                    t.classList.toggle('active', isActive);
                    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
                });
                featuresPanels.forEach(function(p) {
                    p.classList.toggle('active', p.dataset.featuresPanel === target);
                });
            });
        });
    }

    // -------------------- FEATURES — Purchased features merge / split (Bilag B) --------------------
    const purchasedList   = document.getElementById('purchasedList');
    const purchasedActions = document.getElementById('purchasedActions');
    const selectionCount  = document.getElementById('purchasedSelectionCount');
    const mergeBtn        = document.getElementById('mergeBtn');
    const mergeModal      = document.getElementById('mergeModal');

    if (purchasedList && mergeModal) {
        const mergeModalTitle = document.getElementById('mergeModalTitle');
        const mergeModalIntro = document.getElementById('mergeModalIntro');
        const mergeModalList  = document.getElementById('mergeModalList');
        const mergeModalFee   = mergeModal.querySelector('.merge-modal__fee-value');
        const mergeConfirmBtn = document.getElementById('mergeConfirmBtn');

        let modalContext = null; // { mode: 'merge'|'split', cards: [el] }

        function getSelected() {
            return Array.from(purchasedList.querySelectorAll('.purchased-card:not(.is-merged)'))
                .filter(function(c) {
                    const cb = c.querySelector('input[data-purchased-check]');
                    return cb && cb.checked;
                });
        }

        function updateSelection() {
            purchasedList.querySelectorAll('.purchased-card').forEach(function(card) {
                const cb = card.querySelector('input[data-purchased-check]');
                card.classList.toggle('is-selected', !!(cb && cb.checked));
            });
            const sel = getSelected();
            if (sel.length >= 2) {
                purchasedActions.hidden = false;
                selectionCount.textContent = sel.length + ' selected';
                mergeBtn.disabled = false;
            } else {
                purchasedActions.hidden = true;
                mergeBtn.disabled = true;
            }
        }

        purchasedList.addEventListener('change', function(e) {
            if (e.target.matches('input[data-purchased-check]')) updateSelection();
        });

        function buildModalForMerge(cards) {
            modalContext = { mode: 'merge', cards: cards };
            mergeModalTitle.textContent = 'Merge ' + cards.length + ' features';
            mergeModalIntro.textContent = 'Combining these features into one project requires approval from every seller. The 10 USD platform fee is only charged when all sellers approve.';
            mergeModalFee.textContent = '10 USD';
            mergeConfirmBtn.textContent = 'Send merge request';
            mergeConfirmBtn.classList.remove('merge-modal__btn--danger');
            mergeConfirmBtn.classList.add('merge-modal__btn--primary');
            mergeModalList.innerHTML = cards.map(function(card) {
                const avatarEl = card.querySelector('.purchased-card__avatar');
                const name = card.querySelector('.purchased-card__name').textContent;
                const meta = card.querySelector('.purchased-card__meta').textContent;
                return '<li class="merge-modal__list-item">' +
                    '<span class="merge-modal__list-avatar" style="' + (avatarEl.getAttribute('style') || '') + '">' + avatarEl.textContent + '</span>' +
                    '<div class="merge-modal__list-main">' +
                        '<div class="merge-modal__list-name">' + name + '</div>' +
                        '<div class="merge-modal__list-meta">' + meta + '</div>' +
                    '</div>' +
                '</li>';
            }).join('');
        }

        function buildModalForSplit(card) {
            modalContext = { mode: 'split', cards: [card] };
            mergeModalTitle.textContent = 'Split merged feature';
            mergeModalIntro.textContent = 'Splitting will return this merged feature back to its original individual feature projects. The 20 USD fee is charged immediately. No seller approval is required.';
            mergeModalFee.textContent = '20 USD';
            mergeConfirmBtn.textContent = 'Confirm split (20 USD)';
            mergeConfirmBtn.classList.remove('merge-modal__btn--primary');
            mergeConfirmBtn.classList.add('merge-modal__btn--danger');

            const sources = JSON.parse(card.dataset.mergedSources || '[]');
            mergeModalList.innerHTML = sources.map(function(s) {
                return '<li class="merge-modal__list-item">' +
                    '<span class="merge-modal__list-avatar" style="background:' + s.bg + '">' + s.initials + '</span>' +
                    '<div class="merge-modal__list-main">' +
                        '<div class="merge-modal__list-name">' + s.name + '</div>' +
                        '<div class="merge-modal__list-meta">' + s.meta + '</div>' +
                    '</div>' +
                '</li>';
            }).join('');
        }

        function openMergeModal() { mergeModal.classList.add('open'); mergeModal.setAttribute('aria-hidden', 'false'); }
        function closeMergeModal() { mergeModal.classList.remove('open'); mergeModal.setAttribute('aria-hidden', 'true'); modalContext = null; }

        mergeBtn.addEventListener('click', function() {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            const sel = getSelected();
            if (sel.length < 2) return;
            buildModalForMerge(sel);
            openMergeModal();
        });

        purchasedList.addEventListener('click', function(e) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            const splitBtn = e.target.closest('[data-split-btn]');
            if (splitBtn) {
                const card = splitBtn.closest('.purchased-card');
                if (card) { buildModalForSplit(card); openMergeModal(); }
            }
        });

        mergeModal.addEventListener('click', function(e) {
            if (e.target === mergeModal || e.target.closest('[data-close-merge]')) closeMergeModal();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && mergeModal.classList.contains('open')) closeMergeModal();
        });

        mergeConfirmBtn.addEventListener('click', function() {
            if (!modalContext) return;
            if (modalContext.mode === 'merge') {
                // Capture sources for later split
                const sources = modalContext.cards.map(function(c) {
                    const av = c.querySelector('.purchased-card__avatar');
                    return {
                        id: c.dataset.featureId,
                        initials: av.textContent,
                        bg: av.getAttribute('style') || '',
                        name: c.querySelector('.purchased-card__name').textContent,
                        meta: c.querySelector('.purchased-card__meta').textContent,
                        price: c.querySelector('.purchased-card__price').textContent
                    };
                });
                const total = sources.reduce(function(sum, s) {
                    const n = parseFloat(s.price.replace(/[^\d]/g, '')) || 0;
                    return sum + n;
                }, 0);
                const merged = document.createElement('li');
                merged.className = 'purchased-card is-merged';
                merged.dataset.featureId = 'merged-' + Date.now();
                merged.dataset.mergedSources = JSON.stringify(sources);
                merged.innerHTML =
                    '<label class="purchased-card__select"><input type="checkbox" data-purchased-check></label>' +
                    '<div class="purchased-card__avatars">' +
                        sources.slice(0, 3).map(function(s) {
                            return '<div class="purchased-card__avatar" style="' + s.bg + '">' + s.initials + '</div>';
                        }).join('') +
                    '</div>' +
                    '<div class="purchased-card__main">' +
                        '<div class="purchased-card__name auto-name">Merged feature project<span class="purchased-card__pill">Merged · ' + sources.length + '</span></div>' +
                        '<div class="purchased-card__meta">Combined: ' + sources.map(function(s) { return s.name; }).join(' + ') + '</div>' +
                    '</div>' +
                    '<div class="purchased-card__price">' + total.toLocaleString('en-US') + ' DKK</div>' +
                    '<button type="button" class="purchased-card__split-btn" data-split-btn>' +
                        '<svg viewBox="0 0 24 24" fill="none"><path d="M17 7l-7 7M7 17l7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
                        'Split (20 USD)' +
                    '</button>';
                modalContext.cards.forEach(function(c) { c.remove(); });
                purchasedList.appendChild(merged);
                if (typeof formatAllNames === 'function') formatAllNames(purchasedList);
            } else if (modalContext.mode === 'split') {
                const mergedCard = modalContext.cards[0];
                const sources = JSON.parse(mergedCard.dataset.mergedSources || '[]');
                sources.forEach(function(s) {
                    const li = document.createElement('li');
                    li.className = 'purchased-card';
                    li.dataset.featureId = s.id;
                    li.innerHTML =
                        '<label class="purchased-card__select"><input type="checkbox" data-purchased-check></label>' +
                        '<div class="purchased-card__avatar" style="' + s.bg + '">' + s.initials + '</div>' +
                        '<div class="purchased-card__main">' +
                            '<div class="purchased-card__name auto-name">' + s.name + '</div>' +
                            '<div class="purchased-card__meta">' + s.meta + '</div>' +
                        '</div>' +
                        '<div class="purchased-card__price">' + s.price + '</div>';
                    purchasedList.appendChild(li);
                });
                mergedCard.remove();
                if (typeof formatAllNames === 'function') formatAllNames(purchasedList);
            }
            closeMergeModal();
            updateSelection();
        });

        updateSelection();
    }

    // -------------------- FEATURES — Royalty share popover (Bilag B) --------------------
    // Each pill in a `.button-group--royalties` is initialised with the
    // seller's share (default 50%). Clicking opens a popover that lets
    // the seller raise/lower their share within the 0–75% cap from the
    // spec. When the value differs from 50%, the pill switches to its
    // "brighter white" modified state.
    const royaltyPopover = document.getElementById('royaltyPopover');
    if (royaltyPopover) {
        const popoverTitle  = document.getElementById('royaltyPopoverTitle');
        const slider        = document.getElementById('royaltySlider');
        const numberInput   = document.getElementById('royaltyNumber');
        const sellerEl      = royaltyPopover.querySelector('[data-royalty-seller]');
        const buyerEl       = royaltyPopover.querySelector('[data-royalty-buyer]');
        let activePill = null;

        // Initialise every royalty pill with its current % (default 50)
        document.querySelectorAll('.button-group--royalties .pill-btn').forEach(function(pill) {
            const baseLabel = pill.textContent.trim();
            pill.dataset.royaltyName = baseLabel;
            if (!pill.dataset.royaltyShare) pill.dataset.royaltyShare = '50';
            renderPill(pill);
        });

        function renderPill(pill) {
            const share = parseInt(pill.dataset.royaltyShare, 10) || 50;
            pill.textContent = pill.dataset.royaltyName;
            pill.classList.toggle('is-modified', share !== 50);
            pill.setAttribute('title', pill.dataset.royaltyName + ': you ' + share + '% / buyer ' + (100 - share) + '%');
        }

        function applyValue(value) {
            const v = Math.max(0, Math.min(75, parseInt(value, 10) || 0));
            slider.value = v;
            numberInput.value = v;
            sellerEl.textContent = v + '%';
            buyerEl.textContent = (100 - v) + '%';
            return v;
        }

        function openPopover(pill) {
            activePill = pill;
            popoverTitle.textContent = pill.dataset.royaltyName;
            applyValue(pill.dataset.royaltyShare || 50);

            // Position the popover beneath the pill (or above if no room)
            royaltyPopover.hidden = false;
            const rect = pill.getBoundingClientRect();
            const popW = royaltyPopover.offsetWidth;
            const popH = royaltyPopover.offsetHeight;
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;

            let top = rect.bottom + scrollY + 8;
            // Flip above the pill if it would overflow the viewport
            if (rect.bottom + popH + 16 > window.innerHeight && rect.top - popH - 8 > 0) {
                top = rect.top + scrollY - popH - 8;
            }
            let left = rect.left + scrollX + (rect.width / 2) - (popW / 2);
            left = Math.max(scrollX + 8, Math.min(scrollX + window.innerWidth - popW - 8, left));

            royaltyPopover.style.top = top + 'px';
            royaltyPopover.style.left = left + 'px';
        }

        function closePopover() {
            activePill = null;
            royaltyPopover.hidden = true;
        }

        document.addEventListener('click', function(e) {
            const pill = e.target.closest('.button-group--royalties .pill-btn');
            if (pill) {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                e.preventDefault();
                openPopover(pill);
                return;
            }
            // Close if clicking outside the popover
            if (!royaltyPopover.hidden && !royaltyPopover.contains(e.target)) {
                closePopover();
            }
        });

        if (slider) slider.addEventListener('input', function() { applyValue(slider.value); });
        if (numberInput) numberInput.addEventListener('input', function() { applyValue(numberInput.value); });

        royaltyPopover.querySelector('[data-royalty-close]').addEventListener('click', closePopover);

        royaltyPopover.querySelectorAll('[data-royalty-action]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                const action = btn.dataset.royaltyAction;
                if (action === 'reset') { applyValue(50); return; }
                if (action === 'save' && activePill) {
                    activePill.dataset.royaltyShare = String(applyValue(slider.value));
                    renderPill(activePill);
                    closePopover();
                }
            });
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !royaltyPopover.hidden) closePopover();
        });
    }

    // -------------------- FEATURES — Review Feature modal (Bilag B) --------------------
    const reviewBtn   = document.getElementById('pendingReviewBtn');
    const reviewModal = document.getElementById('reviewFeatureModal');
    if (reviewBtn && reviewModal) {
        const playBtn   = reviewModal.querySelector('[data-review-play]');
        const progress  = reviewModal.querySelector('[data-review-progress]');
        const current   = reviewModal.querySelector('[data-review-current]');
        const totalEl   = reviewModal.querySelector('[data-review-total]');
        const message   = document.getElementById('reviewMessage');
        const counter   = reviewModal.querySelector('[data-review-count]');
        const feedback  = reviewModal.querySelector('[data-review-feedback]');
        const actionBtns = reviewModal.querySelectorAll('[data-review-action]');

        const TOTAL_SECONDS = 156; // 2:36 mock duration
        let playTimer = null;
        let elapsed = 0;

        function fmtTime(sec) {
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return m + ':' + (s < 10 ? '0' + s : s);
        }

        function renderTime() {
            if (current) current.textContent = fmtTime(elapsed);
            if (progress) progress.style.width = (elapsed / TOTAL_SECONDS * 100).toFixed(1) + '%';
        }

        function stopPlayback() {
            if (playTimer) { clearInterval(playTimer); playTimer = null; }
            if (playBtn) playBtn.classList.remove('is-playing');
        }

        function togglePlay() {
            if (playTimer) {
                stopPlayback();
                return;
            }
            playBtn.classList.add('is-playing');
            playTimer = setInterval(function() {
                elapsed += 1;
                if (elapsed >= TOTAL_SECONDS) {
                    elapsed = TOTAL_SECONDS;
                    renderTime();
                    stopPlayback();
                    return;
                }
                renderTime();
            }, 1000);
        }

        function openReview() {
            elapsed = 0;
            renderTime();
            if (feedback) { feedback.hidden = true; feedback.textContent = ''; feedback.classList.remove('review-feature-modal__feedback--issue'); }
            actionBtns.forEach(function(b) { b.disabled = false; });
            const stage = reviewModal.querySelector('[data-review-original]');
            if (stage) {
                stage.hidden = true;
                stage.querySelectorAll('[data-original-action]').forEach(function(b) { b.disabled = false; });
            }
            reviewModal.classList.add('open');
            reviewModal.setAttribute('aria-hidden', 'false');
        }

        function closeReview() {
            stopPlayback();
            reviewModal.classList.remove('open');
            reviewModal.setAttribute('aria-hidden', 'true');
        }

        reviewBtn.addEventListener('click', function() {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            openReview();
        });

        reviewModal.addEventListener('click', function(e) {
            if (e.target === reviewModal) { closeReview(); return; }
            if (e.target.closest('[data-close-review]')) { closeReview(); return; }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && reviewModal.classList.contains('open')) closeReview();
        });

        if (playBtn) playBtn.addEventListener('click', togglePlay);

        if (message && counter) {
            message.addEventListener('input', function() {
                counter.textContent = message.value.length;
            });
        }

        const originalStage = reviewModal.querySelector('[data-review-original]');
        const originalActions = originalStage ? originalStage.querySelectorAll('[data-original-action]') : [];

        actionBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                if (btn.disabled) return;
                const action = btn.dataset.reviewAction;

                if (action === 'accept') {
                    // Move into stage 2: ask whether to propose as Original
                    actionBtns.forEach(function(b) { b.disabled = true; });
                    stopPlayback();
                    if (originalStage) originalStage.hidden = false;
                    return;
                }

                let label;
                if (action === 'send')  label = 'Review sent — buyer notified. Track this in your inbox.';
                if (action === 'issue') label = 'Terms & conditions issue flagged — StageCord arbitration started (50 USD fee charged to the party at fault).';
                if (!label) return;
                feedback.hidden = false;
                feedback.textContent = label;
                feedback.classList.toggle('review-feature-modal__feedback--issue', action === 'issue');
                actionBtns.forEach(function(b) { b.disabled = true; });
                stopPlayback();
                setTimeout(closeReview, 2400);
                if (reviewBtn) reviewBtn.style.display = 'none';
            });
        });

        originalActions.forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                const choice = btn.dataset.originalAction;
                let label;
                if (choice === 'propose') label = 'Original proposal sent to Alex Lipsius — they decide whether to release as your original or keep full ownership.';
                if (choice === 'skip')    label = 'Project accepted ✓ — second payout released. Buyer keeps full creative control.';
                if (!label) return;
                feedback.hidden = false;
                feedback.textContent = label;
                feedback.classList.remove('review-feature-modal__feedback--issue');
                originalActions.forEach(function(b) { b.disabled = true; });
                if (originalStage) setTimeout(function() { originalStage.hidden = true; }, 1800);
                setTimeout(closeReview, 2400);
                if (reviewBtn) reviewBtn.style.display = 'none';
                // Reset original-stage state for next session
                setTimeout(function() {
                    if (originalStage) originalStage.hidden = true;
                    originalActions.forEach(function(b) { b.disabled = false; });
                }, 3000);
            });
        });

    }
});

// (extracted to js/modes.js)

// (extracted to js/topbar-widgets.js)

// (extracted to js/stage-cards.js)

// (extracted to js/acting-as-service.js)

// (extracted to js/stage-economy.js)

// (extracted to js/settings.js)

// (extracted to js/activity-feed.js)

// (extracted to js/stage-resources.js)

// (extracted to js/stage-label.js)

// (extracted to js/stage-badge.js)

// ============================================================
// Global "now playing" mini-bar
// ============================================================
// When the user is playing a song, a fixed bar sits at the bottom of
// every page (except the song player itself, which has its own controls
// and bar). The current track + play state lives in localStorage so
// playback feels persistent across navigation.
(function() {
    // Skip on the song player page — it handles its own bar.
    if (window.location.pathname.indexOf('/streaming/song/') !== -1) return;

    document.addEventListener('DOMContentLoaded', function() {
        // Skip pages that already render their own .streaming-player
        // (the streaming hub has a static one), unless we want to
        // hijack it. For now, leave existing bars untouched.
        if (document.querySelector('.streaming-player')) return;

        let track;
        try {
            const raw = localStorage.getItem('stagecord:nowPlaying');
            track = raw ? JSON.parse(raw) : null;
        } catch (e) { track = null; }
        if (!track) return;

        const isPlaying = localStorage.getItem('stagecord:isPlaying') === 'true';

        // Ensure streaming.css (which carries .streaming-player styles) is
        // loaded — most pages don't include it explicitly.
        if (!document.querySelector('link[href*="streaming.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = localAsset('css/streaming.css');
            document.head.appendChild(link);
        }

        const bar = document.createElement('div');
        bar.className = 'streaming-player streaming-player--global';
        bar.setAttribute('data-help',
            'Mini-player: Den aktuelle sang spiller her, mens du browser. Klik expand-pilen for at åbne den fulde afspiller.');
        bar.innerHTML =
            '<div class="streaming-player__cover" style="background-image: url(\'' + track.cover + '\');"></div>' +
            '<div class="streaming-player__main">' +
                '<div class="streaming-player__title"></div>' +
                '<div class="streaming-player__byline auto-name"></div>' +
            '</div>' +
            '<div class="streaming-player__controls">' +
                '<button type="button" class="streaming-player__btn" data-np-action="prev" aria-label="Previous track">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 17V7l-9 5 9 5zM5 7h2v10H5z"/></svg>' +
                '</button>' +
                '<button type="button" class="streaming-player__btn streaming-player__btn--play" data-np-action="play" data-playing="' + (isPlaying ? 'true' : 'false') + '" aria-label="Play/Pause">' +
                    '<svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>' +
                    '<svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' +
                '</button>' +
                '<button type="button" class="streaming-player__btn" data-np-action="next" aria-label="Next track">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 7v10l9-5-9-5zm12 0h2v10h-2z"/></svg>' +
                '</button>' +
            '</div>' +
            '<div class="streaming-player__progress">' +
                '<span class="streaming-player__time">0:34</span>' +
                '<div class="streaming-player__bar"><div class="streaming-player__bar-fill"></div></div>' +
                '<span class="streaming-player__time">' + (track.duration || '0:00') + '</span>' +
            '</div>' +
            '<button type="button" class="streaming-player__btn streaming-player__expand" data-np-action="expand" aria-label="Open player">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none">' +
                    '<path d="M6 15l6-6 6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
                '</svg>' +
            '</button>' +
            '<button type="button" class="streaming-player__btn streaming-player__close" data-np-action="close" aria-label="Close player" data-help="Close the player — removes the mini-bar from the bottom of the screen until you start a new song.">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">' +
                    '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
                '</svg>' +
            '</button>';
        document.body.appendChild(bar);

        // Set track text after element is in DOM so the brand formatter
        // can run on it.
        bar.querySelector('.streaming-player__title').textContent = track.title;
        bar.querySelector('.streaming-player__byline').textContent = track.artist || '';
        formatAllNames(bar);
        formatStagecord(bar);

        bar.addEventListener('click', function(e) {
            const btn = e.target.closest('[data-np-action]');
            if (!btn) return;
            const action = btn.dataset.npAction;
            if (action === 'play') {
                const playing = btn.dataset.playing === 'true';
                btn.dataset.playing = playing ? 'false' : 'true';
                localStorage.setItem('stagecord:isPlaying', btn.dataset.playing);
            } else if (action === 'expand') {
                window.location.href = localAsset('streaming/song/index.html');
            } else if (action === 'close') {
                // Dismiss the bar across the whole session — clear now-playing
                // so it does not re-appear on the next page load. User can start
                // a new track from the streaming pages to bring it back.
                bar.remove();
                localStorage.removeItem('stagecord:nowPlaying');
                localStorage.setItem('stagecord:isPlaying', 'false');
            }
            // prev/next on the global bar are visual only for now — actual
            // track switching needs a shared playlist; the song page handles
            // it locally for the moment.
        });
    });
})();

// ============================================================
// Search results page — renders into [data-search-results]
// ============================================================
// Reads ?q=, ?category=, ?role= from the URL, filters
// window.STAGECORD.search.items and groups by category. Reuses the same
// FILTER_GROUPS as the topbar popover so the chip set stays consistent.
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        const root = document.querySelector('[data-search-results]');
        if (!root) return;
        // Defer until the search bar IIFE has populated window.STAGECORD.search
        // (both run on DOMContentLoaded; the topbar IIFE registers earlier).
        const data = window.STAGECORD && window.STAGECORD.search;
        if (!data) return;

        const params = new URLSearchParams(window.location.search);
        const query = (params.get('q') || '').trim();
        const activeCategories = new Set(params.getAll('category'));
        const activeRoles = new Set(params.getAll('role'));

        // Reflect query in the topbar input + state in the heading
        const topbarInput = document.querySelector('.search-input');
        if (topbarInput && query) {
            topbarInput.value = query;
            topbarInput.setAttribute('value', query);
        }

        const headingEl = root.querySelector('[data-search-heading]');
        if (headingEl) {
            if (query) headingEl.textContent = 'Results for "' + query + '"';
            else if (activeCategories.size || activeRoles.size) headingEl.textContent = 'Filtered results';
            else headingEl.textContent = 'Search';
        }

        const escapeHtml = SC.escapeHtml;

        // ---------- Render filter chips (always visible, mirrors popover) ----------
        const chipsRoot = root.querySelector('[data-search-chips]');
        if (chipsRoot && data.FILTER_GROUPS) {
            chipsRoot.innerHTML = data.FILTER_GROUPS.map(function(g) {
                const items = g.categories || g.roles;
                const attr = g.categories ? 'data-category' : 'data-role';
                const activeSet = g.categories ? activeCategories : activeRoles;
                return '<div class="search-page-chips__group">' +
                    '<span class="search-page-chips__title">' + escapeHtml(g.title) + '</span>' +
                    '<div class="search-page-chips__row">' +
                        items.map(function(name) {
                            const isOn = activeSet.has(name);
                            return '<button type="button" class="search-page-chip' + (isOn ? ' is-active' : '') + '" ' +
                                attr + '="' + escapeHtml(name) + '">' + escapeHtml(name) + '</button>';
                        }).join('') +
                    '</div>' +
                '</div>';
            }).join('');
        }

        // Toggle a chip → rebuild URL with new filter and navigate
        if (chipsRoot) {
            chipsRoot.addEventListener('click', function(e) {
                const chip = e.target.closest('.search-page-chip');
                if (!chip) return;
                const cat = chip.getAttribute('data-category');
                const role = chip.getAttribute('data-role');
                const next = new URLSearchParams(window.location.search);
                if (cat) {
                    if (activeCategories.has(cat)) {
                        const remaining = next.getAll('category').filter(function(v) { return v !== cat; });
                        next.delete('category');
                        remaining.forEach(function(v) { next.append('category', v); });
                    } else next.append('category', cat);
                } else if (role) {
                    if (activeRoles.has(role)) {
                        const remaining = next.getAll('role').filter(function(v) { return v !== role; });
                        next.delete('role');
                        remaining.forEach(function(v) { next.append('role', v); });
                    } else next.append('role', role);
                }
                window.location.search = '?' + next.toString();
            });
        }

        // ---------- Filter + group results ----------
        const q = query.toLowerCase();
        const matched = [];
        data.items.forEach(function(s) {
            if (activeCategories.size && !activeCategories.has(data.categoryOf(s))) return;
            if (activeRoles.size) {
                const hit = (s.roles || []).some(function(r) { return activeRoles.has(r); });
                if (!hit) return;
            }
            if (q) {
                const nameHit = s.name.toLowerCase().indexOf(q) !== -1;
                const metaHit = (s.meta || '').toLowerCase().indexOf(q) !== -1;
                const roleHit = (s.roles || []).some(function(r) { return r.toLowerCase().indexOf(q) !== -1; });
                if (!nameHit && !metaHit && !roleHit) return;
            }
            matched.push(s);
        });

        const countEl = root.querySelector('[data-search-count]');
        if (countEl) countEl.textContent = matched.length + ' result' + (matched.length === 1 ? '' : 's');

        // Group by category in a stable display order
        const ORDER = ['Artist', 'Song', 'Album', 'Playlist', 'Venue', 'Fan', 'Manager', 'Sponsor', 'Media Licensor', 'Other'];
        const groups = {};
        matched.forEach(function(s) {
            const c = data.categoryOf(s);
            (groups[c] = groups[c] || []).push(s);
        });

        const resultsEl = root.querySelector('[data-search-list]');
        if (!resultsEl) return;

        if (matched.length === 0) {
            resultsEl.innerHTML =
                '<div class="search-page-empty">' +
                    '<h2>No results' + (query ? ' for "' + escapeHtml(query) + '"' : '') + '</h2>' +
                    '<p>Try a different keyword or remove some filters.</p>' +
                '</div>';
            return;
        }

        function cardHtml(s) {
            return '<a href="#" class="search-result-card" data-url="' + escapeHtml(s.url) + '">' +
                '<span class="search-result-card__avatar" style="background: ' + s.avatar + ';"></span>' +
                '<div class="search-result-card__main">' +
                    '<div class="search-result-card__name auto-name">' + escapeHtml(s.name) + '</div>' +
                    '<div class="search-result-card__meta">' + escapeHtml(s.meta || '') + '</div>' +
                '</div>' +
            '</a>';
        }

        resultsEl.innerHTML = ORDER
            .filter(function(cat) { return groups[cat] && groups[cat].length; })
            .map(function(cat) {
                const list = groups[cat];
                return '<section class="search-page-section">' +
                    '<header class="search-page-section__head">' +
                        '<h2 class="search-page-section__title">' + escapeHtml(cat) + (list.length === 1 ? '' : 's') + '</h2>' +
                        '<span class="search-page-section__count">' + list.length + '</span>' +
                    '</header>' +
                    '<div class="search-page-grid">' + list.map(cardHtml).join('') + '</div>' +
                '</section>';
            }).join('');

        // Format names + wire navigation
        if (typeof formatNameElement === 'function') {
            resultsEl.querySelectorAll('.auto-name').forEach(formatNameElement);
        }
        resultsEl.addEventListener('click', function(e) {
            const card = e.target.closest('.search-result-card');
            if (!card) return;
            e.preventDefault();
            const url = card.dataset.url;
            if (url) data.navigateToSuggestion(url);
        });
    });
})();

// ============================================================
// Set-list builder + viewer + auto-poster generator
// ============================================================
// Three small modules tied to the Pitch flow:
//
// 1. Set-list builder (venue/index.html) — opens when the artist clicks
//    "+ Set list" inside the pitch-submit modal. Lets them tick songs
//    from their registered catalog and add unreleased titles, reorder
//    via up/down arrows, and save.
//
// 2. Set-list viewer (pitch/index.html) — opens when the venue clicks
//    a "Set list" chip on an incoming pitch. Read-only; renders mock
//    data keyed by the pitching artist's name.
//
// 3. Auto-poster generator (pitch/index.html) — opens when the venue
//    clicks "Accept terms & conditions" on a pitch. Generates a 1:1
//    social-media poster with the venue name, artist name + photo,
//    date, doors/show times, and an optional LIVE-RECORDED badge.
//    Date and times are editable; the preview updates live.
(function() {
    const escapeHtml = SC.escapeHtml;
    const escapeAttr = SC.escapeAttr;

    function fmtDuration(sec) {
        if (!sec || sec < 0) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec - m * 60);
        return m + ':' + (s < 10 ? '0' + s : s);
    }
    function parseDuration(str) {
        const m = String(str || '').match(/^(\d+):(\d{1,2})$/);
        if (!m) return 0;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    }

    // Mock catalogs keyed by artist key (slug-ish). Each entry is the
    // pitching artist's registered songs. Used by the builder for the
    // logged-in artist and by the viewer to fabricate plausible set-
    // lists for incoming pitches.
    const ARTIST_CATALOGS = {
        'jokesmith-johnson': {
            label: 'Jokesmith Johnson',
            songs: [
                { id: 'js1', title: 'Brooklyn Air',         meta: 'Single · 2024',     duration: 228 },
                { id: 'js2', title: 'Open Window',          meta: 'EP · Open Window',  duration: 195 },
                { id: 'js3', title: 'Late Cellar Set',      meta: 'Live cut · 2024',   duration: 412 },
                { id: 'js4', title: 'Behind The Curtain',   meta: 'Podcast clip',      duration: 251 },
                { id: 'js5', title: 'Eternaty',             meta: 'Single · 2024',     duration: 234 },
                { id: 'js6', title: 'Manhattan Rain',       meta: 'Remix · 2023',      duration: 207 }
            ]
        },
        'rathcire': {
            label: 'Rathcire',
            songs: [
                { id: 'r1', title: 'Backseat Love',        meta: 'Single · 2024', duration: 215 },
                { id: 'r2', title: 'Headlights',           meta: 'EP cut',        duration: 198 },
                { id: 'r3', title: 'Hold On',              meta: 'Demo',          duration: 240 },
                { id: 'r4', title: 'Slow Down',            meta: 'Single · 2023', duration: 187 }
            ]
        },
        'uro': {
            label: 'URO',
            songs: [
                { id: 'u1', title: 'Cykelhjelm',           meta: 'Single · 2024', duration: 212 },
                { id: 'u2', title: 'Indre Storby',         meta: 'EP cut',        duration: 245 },
                { id: 'u3', title: 'Plovsporet',           meta: 'Single · 2023', duration: 233 },
                { id: 'u4', title: 'Nordvest',             meta: 'EP cut',        duration: 198 }
            ]
        },
        'aria-summers': {
            label: 'Aria Summers',
            songs: [
                { id: 'a1', title: 'Last Voice',           meta: 'Single · 2024', duration: 226 },
                { id: 'a2', title: 'Open Skies',           meta: 'EP cut',        duration: 252 },
                { id: 'a3', title: 'Heartland',            meta: 'Demo',          duration: 211 }
            ]
        }
    };

    // Slug helper — turns "Aria Summers" into "aria-summers".
    function slugify(s) {
        return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    // ---------------------------------------------------------------
    // 1) SET-LIST BUILDER (venue page)
    // ---------------------------------------------------------------
    (function() {
        const modal = document.getElementById('setlistBuilderModal');
        if (!modal) return;

        // For the prototype the venue page is the artist (Jokesmith) pitching
        // to RUST. The builder edits Jokesmith's set-list for that pitch.
        const ARTIST_KEY = 'jokesmith-johnson';
        const VENUE_KEY  = 'rust';
        const STORAGE_KEY = 'stagecord_pro_setlist_' + ARTIST_KEY + '_' + VENUE_KEY;

        const trigger      = document.querySelector('[data-open-setlist-builder]');
        const attachLabel  = document.querySelector('[data-setlist-attach-label]');
        const activeEl     = modal.querySelector('[data-setlist-active]');
        const emptyEl      = modal.querySelector('[data-setlist-empty]');
        const metaEl       = modal.querySelector('[data-setlist-meta]');
        const catalogEl    = modal.querySelector('[data-setlist-catalog]');
        const addForm      = modal.querySelector('[data-setlist-add-form]');
        const addNameEl    = modal.querySelector('[data-setlist-add-name]');
        const addDurEl     = modal.querySelector('[data-setlist-add-duration]');
        const addCoverEl   = modal.querySelector('[data-setlist-add-cover]');

        // State: array of { id, title, meta, duration, isCustom, isCover }
        let state = read();

        function read() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                return raw ? JSON.parse(raw) : [];
            } catch (e) { return []; }
        }
        function write() {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
        }

        function totalDuration() { return state.reduce(function(s, x) { return s + (x.duration || 0); }, 0); }

        function renderActive() {
            if (!state.length) {
                activeEl.innerHTML = '';
                if (emptyEl) emptyEl.hidden = false;
            } else {
                if (emptyEl) emptyEl.hidden = true;
                activeEl.innerHTML = state.map(function(s, idx) {
                    const tag = s.isCover
                        ? '<span class="setlist-active__title-tag setlist-active__title-tag--cover">Cover</span>'
                        : (s.isCustom ? '<span class="setlist-active__title-tag">Unreleased</span>' : '');
                    return '<li class="setlist-active__item" data-setlist-idx="' + idx + '">' +
                        '<div class="setlist-active__main">' +
                            '<span class="setlist-active__title">' + escapeHtml(s.title) + tag + '</span>' +
                            '<span class="setlist-active__meta">' + escapeHtml(s.meta || '') + '</span>' +
                        '</div>' +
                        '<span class="setlist-active__duration">' + fmtDuration(s.duration) + '</span>' +
                        '<span class="setlist-active__controls">' +
                            '<button type="button" class="setlist-ctrl" data-setlist-up="' + idx + '" aria-label="Move up" data-help="Flyt sangen ét trin op i set-listen.">▲</button>' +
                            '<button type="button" class="setlist-ctrl" data-setlist-down="' + idx + '" aria-label="Move down" data-help="Flyt sangen ét trin ned i set-listen.">▼</button>' +
                            '<button type="button" class="setlist-ctrl setlist-ctrl--remove" data-setlist-remove="' + idx + '" aria-label="Remove" data-help="Fjern sangen fra set-listen. Registerede sange kan tilføjes igen via katalog-listen.">✕</button>' +
                        '</span>' +
                    '</li>';
                }).join('');
            }
            metaEl.textContent = state.length + ' song' + (state.length === 1 ? '' : 's') + ' · ' + fmtDuration(totalDuration());
        }

        function renderCatalog() {
            const catalog = (ARTIST_CATALOGS[ARTIST_KEY] || { songs: [] }).songs;
            const inSet = {};
            state.forEach(function(s) { if (s.id) inSet[s.id] = true; });
            catalogEl.innerHTML = catalog.map(function(s) {
                const checked = inSet[s.id] ? 'checked' : '';
                return '<li class="setlist-catalog__item" data-setlist-toggle="' + s.id + '" data-help="Sang fra dit registered catalog: ' + escapeAttr(s.title) + '. Tjek af for at tilføje til set-listen.">' +
                    '<input type="checkbox" ' + checked + '>' +
                    '<div class="setlist-catalog__main">' +
                        '<span class="setlist-catalog__title">' + escapeHtml(s.title) + '</span>' +
                        '<span class="setlist-catalog__meta">' + escapeHtml(s.meta) + '</span>' +
                    '</div>' +
                    '<span class="setlist-catalog__duration">' + fmtDuration(s.duration) + '</span>' +
                '</li>';
            }).join('');
        }

        function syncAttachLabel() {
            if (!attachLabel) return;
            if (state.length) {
                attachLabel.textContent = 'Set list (' + state.length + ' · ' + fmtDuration(totalDuration()) + ')';
            } else {
                attachLabel.textContent = 'Set list';
            }
        }

        function refresh() {
            renderActive();
            renderCatalog();
        }

        function open() {
            state = read();
            refresh();
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }
        function close() {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }

        if (trigger) trigger.addEventListener('click', function(e) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            open();
        });

        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-setlist]')) { close(); return; }
            if (e.target.closest('[data-save-setlist]')) {
                write();
                syncAttachLabel();
                close();
                return;
            }

            const tog = e.target.closest('[data-setlist-toggle]');
            if (tog) {
                const id = tog.dataset.setlistToggle;
                const catalog = (ARTIST_CATALOGS[ARTIST_KEY] || { songs: [] }).songs;
                const songDef = catalog.find(function(x) { return x.id === id; });
                if (!songDef) return;
                const idx = state.findIndex(function(s) { return s.id === id; });
                if (idx >= 0) state.splice(idx, 1);
                else state.push(Object.assign({}, songDef));
                refresh();
                return;
            }
            const up = e.target.closest('[data-setlist-up]');
            if (up) {
                const i = parseInt(up.dataset.setlistUp, 10);
                if (i > 0) { const tmp = state[i-1]; state[i-1] = state[i]; state[i] = tmp; refresh(); }
                return;
            }
            const dn = e.target.closest('[data-setlist-down]');
            if (dn) {
                const i = parseInt(dn.dataset.setlistDown, 10);
                if (i < state.length - 1) { const tmp = state[i+1]; state[i+1] = state[i]; state[i] = tmp; refresh(); }
                return;
            }
            const rm = e.target.closest('[data-setlist-remove]');
            if (rm) {
                const i = parseInt(rm.dataset.setlistRemove, 10);
                state.splice(i, 1);
                refresh();
                return;
            }
            if (e.target === modal) close();
        });

        if (addForm) addForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const name = (addNameEl.value || '').trim();
            const dur = parseDuration(addDurEl.value || '0:00');
            if (!name) { addNameEl.focus(); return; }
            state.push({
                id: 'custom_' + Date.now().toString(36),
                title: name,
                meta: addCoverEl.checked ? 'Cover · unreleased' : 'Unreleased',
                duration: dur,
                isCustom: true,
                isCover: !!addCoverEl.checked
            });
            addNameEl.value = '';
            addDurEl.value  = '';
            addCoverEl.checked = false;
            refresh();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) close();
        });

        // On load, sync the attach-button label to whatever's saved.
        syncAttachLabel();
    })();

    // ---------------------------------------------------------------
    // 2) SET-LIST VIEWER (pitch page)
    // ---------------------------------------------------------------
    (function() {
        const modal = document.getElementById('setlistViewerModal');
        if (!modal) return;

        const titleEl = modal.querySelector('[data-setlist-viewer-title]');
        const listEl  = modal.querySelector('[data-setlist-viewer-list]');
        const metaEl  = modal.querySelector('[data-setlist-viewer-meta]');

        function buildMockSetlist(artistKey) {
            const catalog = (ARTIST_CATALOGS[artistKey] || ARTIST_CATALOGS['rathcire']).songs;
            // Take all + add a custom unreleased song to make it interesting.
            const list = catalog.slice(0, Math.min(catalog.length, 5)).map(function(s) {
                return Object.assign({}, s);
            });
            list.push({ title: 'New track (unreleased preview)', meta: 'Unreleased · debut tonight', duration: 215, isCustom: true });
            return list;
        }

        function renderList(list) {
            listEl.innerHTML = list.map(function(s) {
                const tag = s.isCover
                    ? '<span class="setlist-active__title-tag setlist-active__title-tag--cover">Cover</span>'
                    : (s.isCustom ? '<span class="setlist-active__title-tag">Unreleased</span>' : '');
                const playBtn = !s.isCustom
                    ? '<button type="button" class="setlist-ctrl" data-help="Quick-play: Afspil 30 sek af denne registered song direkte fra pitch-modalen.">▶</button>'
                    : '';
                return '<li class="setlist-active__item">' +
                    '<div class="setlist-active__main">' +
                        '<span class="setlist-active__title">' + escapeHtml(s.title) + tag + '</span>' +
                        '<span class="setlist-active__meta">' + escapeHtml(s.meta || '') + '</span>' +
                    '</div>' +
                    '<span class="setlist-active__duration">' + fmtDuration(s.duration) + '</span>' +
                    '<span class="setlist-active__controls">' + playBtn + '</span>' +
                '</li>';
            }).join('');
        }

        function open(artistName) {
            const artistKey = slugify(artistName);
            const list = buildMockSetlist(artistKey);
            const total = list.reduce(function(s, x) { return s + (x.duration || 0); }, 0);
            if (titleEl) titleEl.textContent = artistName + ' — Set list';
            renderList(list);
            metaEl.textContent = artistName + ' · ' + list.length + ' songs · ' + fmtDuration(total);
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }

        function close() {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }

        document.addEventListener('click', function(e) {
            // Click on a "Set list" pitch-chip opens the viewer.
            const chip = e.target.closest('.pitch-chip');
            if (chip && /set\s*list/i.test(chip.textContent || '')) {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                const card = chip.closest('.pitch-request');
                if (!card) return;
                const nameEl = card.querySelector('.pitch-request__name');
                const artistName = nameEl ? nameEl.textContent.trim() : 'Artist';
                e.preventDefault();
                open(artistName);
            }
        });

        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-setlist-viewer]')) { close(); return; }
            if (e.target === modal) close();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) close();
        });
    })();

    // ---------------------------------------------------------------
    // 3) AUTO-POSTER GENERATOR (pitch page)
    // ---------------------------------------------------------------
    (function() {
        const modal = document.getElementById('posterModal');
        if (!modal) return;

        const card     = modal.querySelector('[data-poster-card]');
        const bgEl     = modal.querySelector('[data-poster-bg]');
        const venueEl  = modal.querySelector('[data-poster-venue]');
        const artistEl = modal.querySelector('[data-poster-artist]');
        const projEl   = modal.querySelector('[data-poster-project]');
        const dayEl    = modal.querySelector('[data-poster-day]');
        const monthEl  = modal.querySelector('[data-poster-month]');
        const timeEl   = modal.querySelector('[data-poster-time]');
        const liveEl   = modal.querySelector('[data-poster-live]');
        const addrEl   = modal.querySelector('[data-poster-address]');

        const dateInp  = modal.querySelector('[data-poster-input-date]');
        const doorsInp = modal.querySelector('[data-poster-input-doors]');
        const showInp  = modal.querySelector('[data-poster-input-show]');
        const liveInp  = modal.querySelector('[data-poster-input-live]');

        function nextOpenDate() {
            // Look at the venue's mini-calendar on the page; pick the first
            // .pitch-mini-cal__day--open as the suggested concert date.
            const open = document.querySelector('.pitch-mini-cal__day--open');
            const today = new Date();
            if (!open) {
                today.setDate(today.getDate() + 14);
                return today;
            }
            const day = parseInt(open.textContent.trim(), 10);
            const candidate = new Date(today.getFullYear(), today.getMonth(), day);
            if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);
            return candidate;
        }

        const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

        function syncPreview() {
            const d = dateInp.value ? new Date(dateInp.value) : nextOpenDate();
            dayEl.textContent = d.getDate();
            monthEl.textContent = MONTHS[d.getMonth()];
            timeEl.textContent = 'Doors ' + (doorsInp.value || '19:00') + ' · Show ' + (showInp.value || '20:30');
            if (liveInp.checked) liveEl.hidden = false;
            else liveEl.hidden = true;
        }

        function open(artistName, project, photoUrl) {
            artistEl.textContent = (artistName || 'ARTIST').toUpperCase();
            projEl.textContent = project || '';
            // Try to render the artist photo as the poster background. If
            // none, fallback to a vivid gradient.
            if (photoUrl) {
                bgEl.style.backgroundImage = "url('" + photoUrl + "')";
            } else {
                bgEl.style.backgroundImage = 'linear-gradient(135deg, #6E72FC, #FF6A55 60%, #FFC400)';
            }
            // Default date = next open date on the venue calendar
            const d = nextOpenDate();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            dateInp.value = yyyy + '-' + mm + '-' + dd;
            doorsInp.value = '19:00';
            showInp.value = '20:30';
            liveInp.checked = false;
            // Use venue name + address from page if available
            const vAddr = document.querySelector('.pitch-specs__col .value');
            if (vAddr && addrEl) addrEl.textContent = vAddr.textContent.trim().replace(/\s+/g, ' ');
            if (venueEl) venueEl.textContent = (document.querySelector('.topbar-stage-label__primary') || {}).textContent || 'RUST';
            syncPreview();
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }

        function close() {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }

        // Live preview updates as user changes the controls.
        [dateInp, doorsInp, showInp, liveInp].forEach(function(el) {
            if (el) el.addEventListener('input', syncPreview);
        });

        // Click handler on Accept buttons in the pitch list.
        document.addEventListener('click', function(e) {
            const acceptBtn = e.target.closest('.pitch-action--accept');
            if (!acceptBtn) return;
            if (typeof helpActive !== 'undefined' && helpActive) return;
            const cardEl = acceptBtn.closest('.pitch-request');
            if (!cardEl) return;
            e.preventDefault();
            const artistName = (cardEl.querySelector('.pitch-request__name') || {}).textContent || 'Artist';
            const project = (cardEl.querySelector('.pitch-request__project') || {}).textContent || '';
            // Pull the portrait background-image url
            const portrait = cardEl.querySelector('.pitch-request__portrait');
            let photoUrl = '';
            if (portrait) {
                const m = (portrait.getAttribute('style') || '').match(/url\(['"]?([^)'"]+)['"]?\)/);
                if (m) photoUrl = m[1];
            }
            // Mark the request visually as accepted
            cardEl.style.opacity = '0.6';
            cardEl.style.borderColor = 'rgba(67,196,122,0.5)';
            open(artistName.trim(), project.trim(), photoUrl);
        });

        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-poster]')) { close(); return; }
            if (e.target.closest('[data-poster-share]')) {
                alert('Plakat klar til at deles til Instagram, Facebook og X. (Demo: i en rigtig integration ville platformen åbne hver enkelt deling-flow her.)');
                return;
            }
            if (e.target.closest('[data-poster-download]')) {
                downloadPoster();
                return;
            }
            if (e.target === modal) close();
        });

        function downloadPoster() {
            // Render the poster card to a 1080×1080 PNG via SVG <foreignObject>.
            try {
                const rect = card.getBoundingClientRect();
                const w = 1080, h = 1080;
                const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + rect.width + ' ' + rect.height + '">' +
                    '<foreignObject x="0" y="0" width="' + rect.width + '" height="' + rect.height + '">' +
                        '<div xmlns="http://www.w3.org/1999/xhtml">' + new XMLSerializer().serializeToString(card) + '</div>' +
                    '</foreignObject>' +
                '</svg>';
                const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(function(b) {
                        const a = document.createElement('a');
                        a.download = 'stagecord-poster.png';
                        a.href = URL.createObjectURL(b);
                        a.click();
                        setTimeout(function() { URL.revokeObjectURL(a.href); URL.revokeObjectURL(url); }, 1000);
                    });
                };
                img.onerror = function() {
                    URL.revokeObjectURL(url);
                    alert('Kunne ikke generere PNG. (Browseren tillader muligvis ikke embedded billeder i SVG. Prøv "Share to social" i stedet.)');
                };
                img.src = url;
            } catch (err) {
                alert('Download fejlede: ' + err.message);
            }
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) close();
        });
    })();

})();

// ============================================================
// Genre + Sub-genre tagging
// ============================================================
// Two surfaces: (1) inline chip-rows on the artist profile + each
// project card, and (2) a shared editor modal where a primary genre
// and 1-3 sub-genres can be picked. The primary genre determines the
// "Paying it forward" exposure group from the original concept.
// State is persisted to localStorage per target — artist-level and
// per-project — so chips survive reloads.
(function() {
    if (typeof window.localAsset !== 'function') {
        // Module loads only when the DOM has the genre containers.
    }

    // ---------- Catalog ----------
    // Each main genre carries a hue used for chip and modal accents.
    // Sub-genres inherit the parent's hue.
    const CATALOG = [
        { id: 'pop',         label: 'Pop',         color: '#FF8AC8',
          subs: ['Indiepop','Synthpop','K-pop','Afro-pop','Dance pop','Bubblegum','Dream pop'] },
        { id: 'rock',        label: 'Rock',        color: '#E62864',
          subs: ['Indie rock','Alt rock','Punk rock','Hard rock','Garage','Prog','Post-rock'] },
        { id: 'hip-hop',     label: 'Hip Hop',     color: '#FFB547',
          subs: ['Trap','Boom bap','Lo-fi','Cloud rap','Drill','Conscious','Old school'] },
        { id: 'r-and-b',     label: 'R&B',         color: '#A370F0',
          subs: ['Contemporary','Neo-soul','New jack swing','Alt R&B','Quiet storm'] },
        { id: 'electronic',  label: 'Electronic',  color: '#4A90E2',
          subs: ['House','Techno','Drum & bass','Ambient','Synthwave','EDM','Trance','Lo-fi'] },
        { id: 'jazz',        label: 'Jazz',        color: '#7DD3C0',
          subs: ['Bebop','Cool jazz','Smooth jazz','Free jazz','Fusion','Big band'] },
        { id: 'classical',   label: 'Classical',   color: '#C28B5A',
          subs: ['Baroque','Romantic','Modern','Chamber','Opera','Minimalism'] },
        { id: 'country',     label: 'Country',     color: '#FFC400',
          subs: ['Country pop','Outlaw','Bluegrass','Americana','Honky tonk'] },
        { id: 'folk',        label: 'Folk',        color: '#9DB35A',
          subs: ['Indie folk','Folk rock','Singer-songwriter','Traditional','Celtic'] },
        { id: 'latin',       label: 'Latin',       color: '#FF6A55',
          subs: ['Reggaeton','Bachata','Salsa','Latin pop','Cumbia','Trap latino'] },
        { id: 'metal',       label: 'Metal',       color: '#9B5DE5',
          subs: ['Heavy metal','Death metal','Black metal','Metalcore','Doom','Power metal'] },
        { id: 'reggae',      label: 'Reggae',      color: '#43C47A',
          subs: ['Roots','Dub','Dancehall','Ska','Lovers rock'] },
        { id: 'soul',        label: 'Soul',        color: '#E76F51',
          subs: ['Northern soul','Southern soul','Neo-soul','Motown'] },
        { id: 'blues',       label: 'Blues',       color: '#5B7FBF',
          subs: ['Delta','Chicago','Electric','Jump','Rhythm & blues'] },
        { id: 'indie',       label: 'Indie',       color: '#FFE066',
          subs: ['Indie pop','Indie rock','Indie folk','Lo-fi','Bedroom pop'] },
        { id: 'world',       label: 'World',       color: '#7A8DB0',
          subs: ['Afrobeats','K-pop','J-pop','Nordic folk','Bossa nova'] }
    ];
    const CATALOG_BY_ID = {};
    CATALOG.forEach(function(g) { CATALOG_BY_ID[g.id] = g; });

    // Slugify a sub-genre label so we can store it consistently.
    function subSlug(s) { return String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

    // Pre-build a sub-index: { primaryId: [{ slug, label, color }, …] }
    // Plus a flat list of all subs for cross-genre tagging.
    const SUBS_BY_PRIMARY = {};
    const ALL_SUBS = [];
    CATALOG.forEach(function(g) {
        SUBS_BY_PRIMARY[g.id] = g.subs.map(function(name) {
            const obj = { slug: g.id + ':' + subSlug(name), label: name, primaryId: g.id, color: g.color };
            ALL_SUBS.push(obj);
            return obj;
        });
    });
    const SUB_BY_SLUG = {};
    ALL_SUBS.forEach(function(s) { SUB_BY_SLUG[s.slug] = s; });

    // ---------- Storage ----------
    const STORAGE_PREFIX = 'stagecord_pro_genres_';

    function storageKey(target, key) {
        // target: 'artist' | 'project'
        // key: artist-id (e.g. 'jokesmith-johnson') or project-id (e.g. 'eternaty')
        return STORAGE_PREFIX + target + '_' + (key || 'default');
    }

    function read(target, key) {
        try {
            const raw = localStorage.getItem(storageKey(target, key));
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return { primary: '', subs: [] };
    }

    function write(target, key, data) {
        try { localStorage.setItem(storageKey(target, key), JSON.stringify(data)); } catch (e) {}
    }

    // Demo seed: Eternaty + Jokesmith get sensible defaults so chips are
    // visible on first load.
    function seedDefaults() {
        if (!read('artist', 'jokesmith-johnson').primary) {
            write('artist', 'jokesmith-johnson', { primary: 'pop', subs: ['pop:indiepop','pop:dream-pop','r-and-b:contemporary'] });
        }
        if (!read('project', 'eternaty').primary) {
            write('project', 'eternaty', { primary: 'pop', subs: ['pop:dream-pop','r-and-b:alt-r-and-b'] });
        }
    }
    seedDefaults();

    const escapeHtml = SC.escapeHtml;
    const escapeAttr = SC.escapeAttr;

    // ---------- Inline chip rows ----------
    function renderChipsInto(rowEl) {
        if (!rowEl || rowEl.dataset.genreRendered === 'done-bound') {
            // we still re-render content but do not duplicate the label
        }
        const target = rowEl.dataset.genreTarget || 'artist';
        const key = rowEl.dataset.genreKey || (target === 'artist' ? 'jokesmith-johnson' : 'default');
        const data = read(target, key);
        const labelHtml = '<span class="genre-chips__label">Genre</span>';
        let html = labelHtml;
        if (data.primary && CATALOG_BY_ID[data.primary]) {
            const g = CATALOG_BY_ID[data.primary];
            const style = '--genre-color:' + g.color + ';--genre-bg:' + g.color + '22;';
            html += '<button type="button" class="genre-chip genre-chip--primary" style="' + style + '" data-genre-edit data-help="Primær genre: ' + escapeAttr(g.label) + '. Bestemmer hvilken 5%-eksponerings-gruppe du tilhører. Klik for at ændre.">' +
                '<span class="genre-chip__dot"></span>' + escapeHtml(g.label) +
            '</button>';
        }
        (data.subs || []).forEach(function(slug) {
            const sub = SUB_BY_SLUG[slug];
            if (!sub) return;
            const style = '--genre-color:' + sub.color + ';--genre-bg:' + sub.color + '14;--genre-border:' + sub.color + '66;';
            html += '<button type="button" class="genre-chip genre-chip--sub" style="' + style + '" data-genre-edit data-help="Sub-genre: ' + escapeAttr(sub.label) + '. Klik for at redigere genrer.">' +
                '<span class="genre-chip__dot"></span>' + escapeHtml(sub.label) +
            '</button>';
        });
        if (!data.primary && !(data.subs || []).length) {
            html += '<button type="button" class="genre-chip genre-chip--placeholder" data-genre-edit data-help="Ingen genre sat endnu. Klik for at vælge primær genre + sub-genrer.">No genre yet</button>';
        }
        html += '<button type="button" class="genre-chip genre-chip--add" data-genre-edit data-help="Tilføj eller redigér genrer for ' + (target === 'project' ? 'projektet' : 'artisten') + '.">+ Edit</button>';
        rowEl.innerHTML = html;
        rowEl.dataset.genreRendered = 'done-bound';
    }

    function renderAllChipRows() {
        document.querySelectorAll('[data-genre-target]').forEach(renderChipsInto);
    }

    // ---------- Editor modal ----------
    const modal = document.getElementById('genreEditorModal');
    if (!modal) {
        // Pages without the editor modal still get inline chip rendering.
        renderAllChipRows();
        return;
    }

    const titleEl    = modal.querySelector('[data-genre-modal-title]');
    const mainGridEl = modal.querySelector('[data-genre-main-grid]');
    const subGridEl  = modal.querySelector('[data-genre-sub-grid]');
    const subCounter = modal.querySelector('[data-genre-sub-counter]');
    const noMainEl   = modal.querySelector('[data-genre-no-main]');
    const showAllBtn = modal.querySelector('[data-genre-show-all]');

    let activeTarget = 'artist';
    let activeKey = 'jokesmith-johnson';
    let draftPrimary = '';
    let draftSubs = [];          // array of slugs
    let showAllSubs = false;

    const MAX_SUBS = 3;

    function renderMainGrid() {
        mainGridEl.innerHTML = CATALOG.map(function(g) {
            const active = (g.id === draftPrimary) ? ' is-active' : '';
            const style = '--genre-color:' + g.color + ';--genre-bg:' + g.color + '22;';
            return '<button type="button" class="genre-main-pick' + active + '" data-genre-main="' + g.id + '" style="' + style + '" data-help="' + escapeAttr(g.label) + ': Vælg som primær genre. Bestemmer din eksponerings-gruppe.">' +
                '<span class="genre-main-pick__dot" style="background:' + g.color + ';"></span>' +
                escapeHtml(g.label) +
            '</button>';
        }).join('');
    }

    function renderSubGrid() {
        let pool;
        if (showAllSubs) pool = ALL_SUBS;
        else if (draftPrimary && SUBS_BY_PRIMARY[draftPrimary]) pool = SUBS_BY_PRIMARY[draftPrimary];
        else pool = [];
        if (!pool.length) {
            subGridEl.innerHTML = '';
            if (noMainEl) noMainEl.hidden = false;
        } else {
            if (noMainEl) noMainEl.hidden = true;
            subGridEl.innerHTML = pool.map(function(s) {
                const active = draftSubs.indexOf(s.slug) >= 0 ? ' is-active' : '';
                const style = '--genre-color:' + s.color + ';--genre-bg:' + s.color + '22;';
                return '<button type="button" class="genre-sub-pick' + active + '" data-genre-sub="' + escapeAttr(s.slug) + '" style="' + style + '" data-help="' + escapeAttr(s.label) + ' (under ' + escapeAttr(CATALOG_BY_ID[s.primaryId].label) + '): Toggle som sub-genre. Op til ' + MAX_SUBS + ' sub-genrer kan vælges.">' +
                    escapeHtml(s.label) +
                '</button>';
            }).join('');
        }
        if (subCounter) subCounter.textContent = draftSubs.length + ' / ' + MAX_SUBS + ' valgt';
        if (showAllBtn) showAllBtn.textContent = showAllSubs ? 'Show only matching' : 'Show all sub-genres';
    }

    function setPrimary(id) {
        draftPrimary = id;
        // Drop sub-genres that no longer match if we're filtering by main
        if (!showAllSubs) {
            const allowed = (SUBS_BY_PRIMARY[id] || []).map(function(s) { return s.slug; });
            draftSubs = draftSubs.filter(function(slug) { return allowed.indexOf(slug) >= 0; });
        }
        renderMainGrid();
        renderSubGrid();
    }

    function toggleSub(slug) {
        const idx = draftSubs.indexOf(slug);
        if (idx >= 0) {
            draftSubs.splice(idx, 1);
        } else {
            if (draftSubs.length >= MAX_SUBS) {
                // Bump out the oldest selection — common Spotify-style UX.
                draftSubs.shift();
            }
            draftSubs.push(slug);
        }
        renderSubGrid();
    }

    function open(target, key, sourceEl) {
        activeTarget = target;
        activeKey = key;
        const cur = read(target, key);
        draftPrimary = cur.primary || '';
        draftSubs = (cur.subs || []).slice();
        showAllSubs = false;
        if (titleEl) {
            titleEl.textContent = target === 'project'
                ? ('Edit genre · ' + (sourceEl && sourceEl.dataset.genreKey ? sourceEl.dataset.genreKey : key))
                : 'Edit artist genre';
        }
        renderMainGrid();
        renderSubGrid();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function close() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    function save() {
        write(activeTarget, activeKey, { primary: draftPrimary, subs: draftSubs });
        close();
        renderAllChipRows();
    }

    // Click delegation for opening the editor from any chip in any row.
    document.addEventListener('click', function(e) {
        const editTrigger = e.target.closest('[data-genre-edit]');
        if (editTrigger) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            const row = editTrigger.closest('[data-genre-target]');
            if (!row) return;
            e.preventDefault();
            const target = row.dataset.genreTarget;
            const key = row.dataset.genreKey || (target === 'artist' ? 'jokesmith-johnson' : 'default');
            open(target, key, row);
        }
    });

    modal.addEventListener('click', function(e) {
        if (e.target.closest('[data-close-genre]')) { close(); return; }
        if (e.target.closest('[data-genre-save]'))   { save();  return; }
        if (e.target.closest('[data-genre-show-all]')) {
            showAllSubs = !showAllSubs;
            renderSubGrid();
            return;
        }
        const main = e.target.closest('[data-genre-main]');
        if (main) { setPrimary(main.dataset.genreMain); return; }
        const sub = e.target.closest('[data-genre-sub]');
        if (sub) { toggleSub(sub.dataset.genreSub); return; }
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });

    // Initial render of all chip rows on the page
    renderAllChipRows();
})();

// ============================================================
// Vibes — music-specific engagement (≠ generic ♥ Likes)
// ============================================================
// Per the original PDF: "Vibes = Music likes". Vibes are a separate
// reaction type for music content (concert photos, songs, cover videos,
// live performance posts). Generic ♥ Likes stay on text posts and
// comments. Visually distinct: cyan audio-bar icon with a "soundwave"
// animation on hover/press.
//
// Two ways to opt content into Vibes:
//   1. Add the markup explicitly (e.g. via the helper renderer below).
//   2. Tag an existing like-button with `data-engagement="vibes"` and
//      this module rewrites it into the Vibes UI on load.
(function() {
    const STORAGE_KEY = 'stagecord_pro_vibes';

    function read() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }
    function write(state) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    const parseShortNumber = SC.parseShortNumber;
    const formatShort = SC.formatShort;

    // Build the inner HTML for a Vibes button. Same markup whether
    // small/compact or large variant; size is set via class on the
    // outer button.
    function buildInner(count, label) {
        return '<span class="vibe-btn__icon" aria-hidden="true">' +
                   '<span class="vibe-btn__bar"></span>' +
                   '<span class="vibe-btn__bar"></span>' +
                   '<span class="vibe-btn__bar"></span>' +
                   '<span class="vibe-btn__bar"></span>' +
               '</span>' +
               '<span class="vibe-btn__count" data-vibe-count>' + formatShort(count) + '</span>' +
               (label ? '<span class="vibe-btn__label">' + label + '</span>' : '');
    }

    // Convert any element with [data-engagement="vibes"] into a Vibes
    // button. Reads the existing count if available so we don't reset
    // engagement that the page authored.
    function convertMarkedElements() {
        document.querySelectorAll('[data-engagement="vibes"]').forEach(function(el) {
            if (el.classList.contains('vibe-btn')) return;
            // Pull the first numeric span as the count.
            const countNode = el.querySelector('[class*="count" i]') || el;
            const initial = parseShortNumber(countNode.textContent || el.dataset.vibeCount || '0');
            const variant = el.dataset.vibeVariant || '';
            el.classList.add('vibe-btn');
            if (variant === 'overlay')  el.classList.add('vibe-btn--overlay');
            if (variant === 'large')    el.classList.add('vibe-btn--large');
            if (variant === 'compact')  el.classList.add('vibe-btn--compact');
            el.classList.remove('event-photo__like', 'artist-post__like', 'artist-comment__like', 'explore-post__action');
            // Generate a stable id if none provided so toggle state persists.
            if (!el.dataset.vibeId) {
                el.dataset.vibeId = 'auto_' + Math.random().toString(36).slice(2, 10);
            }
            const showLabel = variant === 'large';
            el.innerHTML = buildInner(initial, showLabel ? 'Vibes' : '');
            el.setAttribute('aria-label', 'Vibe this');
            if (!el.hasAttribute('aria-pressed')) el.setAttribute('aria-pressed', 'false');
            if (!el.hasAttribute('data-help')) {
                el.setAttribute('data-help',
                    'Vibe: Klik for at give "Vibes" — det er musik-versionen af et like, brugt på sange, koncerter og andet music-content. Vibes-tællingen er det officielle music-engagement metric og er separat fra generelle ♥ likes.');
            }
        });
    }

    // Restore persisted vibe state (pressed + delta) on page load.
    function restoreState() {
        const state = read();
        document.querySelectorAll('.vibe-btn').forEach(function(btn) {
            const id = btn.dataset.vibeId;
            if (!id) return;
            const entry = state[id];
            if (!entry) return;
            if (entry.pressed) btn.setAttribute('aria-pressed', 'true');
            const cnt = btn.querySelector('[data-vibe-count]');
            if (cnt && typeof entry.count === 'number') cnt.textContent = formatShort(entry.count);
        });
    }

    // Click handler — toggle aria-pressed, bump count up/down by 1,
    // animate, persist.
    function onVibeClick(btn) {
        const id = btn.dataset.vibeId || ('auto_' + Math.random().toString(36).slice(2));
        btn.dataset.vibeId = id;
        const cntEl = btn.querySelector('[data-vibe-count]');
        const current = parseShortNumber(cntEl ? cntEl.textContent : '0');
        const wasOn = btn.getAttribute('aria-pressed') === 'true';
        const next = wasOn ? Math.max(0, current - 1) : current + 1;
        btn.setAttribute('aria-pressed', wasOn ? 'false' : 'true');
        if (cntEl) cntEl.textContent = formatShort(next);
        btn.classList.add('is-bumping');
        setTimeout(function() { btn.classList.remove('is-bumping'); }, 180);
        const state = read();
        state[id] = { pressed: !wasOn, count: next };
        write(state);
    }

    // ---------- Public helper used by other modules ----------
    // Lets other JS render Vibe buttons without duplicating markup.
    window.Vibes = {
        render: function(opts) {
            const count = (opts && typeof opts.count === 'number') ? opts.count : 0;
            const variant = (opts && opts.variant) || '';
            const id = (opts && opts.id) || ('vb_' + Math.random().toString(36).slice(2, 9));
            const cls = ['vibe-btn'];
            if (variant === 'overlay')  cls.push('vibe-btn--overlay');
            if (variant === 'large')    cls.push('vibe-btn--large');
            if (variant === 'compact')  cls.push('vibe-btn--compact');
            const showLabel = variant === 'large';
            return '<button type="button" class="' + cls.join(' ') + '" aria-pressed="false" aria-label="Vibe this" data-vibe-id="' + id + '" data-engagement="vibes" data-help="Vibe: Klik for at give Vibes — music-versionen af et like, separat metric fra ♥ likes på tekst-opslag.">' +
                buildInner(count, showLabel ? 'Vibes' : '') +
            '</button>';
        }
    };

    // ---------- Init ----------
    function init() {
        convertMarkedElements();
        restoreState();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Delegated click — works for buttons inserted later by other modules.
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.vibe-btn');
        if (!btn) return;
        if (typeof helpActive !== 'undefined' && helpActive) return;
        e.preventDefault();
        onVibeClick(btn);
    });
})();

// ============================================================
// Bidding rounds — sponsor auctions on upcoming videos
// ============================================================
// On the videos page, the new "Bidding rounds" tab lists videos with
// a future release date that are open for sponsor bids. Each round has
// three slot types: pre-roll commercial (per 3000 views), permanent
// corner logo, and limited-time corner logo. Sponsors place bids; the
// artist accepts the best ones via the details modal.
//
// Bid state persists in localStorage so accept/reject decisions survive
// reload. Mock seed data with realistic sponsor brands ensures the page
// is alive on first load.
(function() {
    const list = document.querySelector('[data-bidding-list]');
    if (!list) return;

    const detailsModal = document.getElementById('biddingDetailsModal');
    const titleEl  = detailsModal && detailsModal.querySelector('[data-bidding-title]');
    const thumbEl  = detailsModal && detailsModal.querySelector('[data-bidding-thumb]');
    const metaEl   = detailsModal && detailsModal.querySelector('[data-bidding-meta]');
    const summaryRoundsEl = document.querySelector('[data-bidding-stat-rounds]');
    const summaryTotalEl  = document.querySelector('[data-bidding-stat-total]');
    const summaryNextEl   = document.querySelector('[data-bidding-stat-next]');

    const STORAGE_KEY = 'stagecord_pro_bidding_rounds';

    // Slot catalog used for icons and labels in card + modal.
    // Each slot has a video-mode label and a concert-mode label. The
    // concept is the same — pre-roll/permanent/limited sponsorship — but
    // the framing for an online concert reads better as pre-show/stage
    // banner/in-set overlay.
    const SLOTS = {
        'preroll':   { label: 'Pre-roll',  short: '▶', units: 'per 3K views',
                        concertLabel: 'Pre-show',     concertUnits: 'before livestream' },
        'logo-perm': { label: 'Permanent', short: '∞', units: 'lifetime',
                        concertLabel: 'Stage banner', concertUnits: 'whole concert' },
        'logo-temp': { label: 'Limited',   short: '⏱', units: 'fixed window',
                        concertLabel: 'In-set overlay', concertUnits: 'specific song(s)' }
    };

    function slotLabel(slotKey, roundType) {
        const def = SLOTS[slotKey];
        if (!def) return slotKey;
        return roundType === 'concert' && def.concertLabel ? def.concertLabel : def.label;
    }
    function slotUnits(slotKey, roundType) {
        const def = SLOTS[slotKey];
        if (!def) return '';
        return roundType === 'concert' && def.concertUnits ? def.concertUnits : def.units;
    }

    // Mock sponsors — name, brand color (used as avatar background), initials.
    const SPONSORS = {
        'spotify':    { name: 'Spotify',           color: '#1DB954', initials: 'SP' },
        'apple':      { name: 'Apple Music',       color: '#FA243C', initials: 'A♪' },
        'nike':       { name: 'Nike',              color: '#111111', initials: 'NK' },
        'adidas':     { name: 'adidas',            color: '#1B1B1B', initials: 'aD' },
        'sony':       { name: 'Sony Music',        color: '#000000', initials: 'SO' },
        'redbull':    { name: 'Red Bull',          color: '#DA291C', initials: 'RB' },
        'heineken':   { name: 'Heineken',          color: '#03833A', initials: 'HK' },
        'carlsberg':  { name: 'Carlsberg',         color: '#0E5C2F', initials: 'CB' },
        'cocacola':   { name: 'Coca-Cola',         color: '#E61D2A', initials: 'CC' },
        'tinder':     { name: 'Tinder',            color: '#FF6849', initials: 'TI' },
        'samsung':    { name: 'Samsung',           color: '#1428A0', initials: 'SM' },
        'mcdonalds':  { name: "McDonald's",        color: '#FFC72C', initials: 'MD' },
        'cph-coffee': { name: 'CPH Coffee Roastery', color: '#7A4E2D', initials: 'CR' },
        'ducati':     { name: 'Ducati',            color: '#B30000', initials: 'DC' },
        'levis':      { name: "Levi's",            color: '#A60E10', initials: 'LV' },
        'roskilde':   { name: 'Roskilde Festival', color: '#DC4A1B', initials: 'RF' },
        'tuborg':     { name: 'Tuborg',            color: '#0EAD00', initials: 'TB' }
    };

    // Pre-built mock bidding rounds. The state shape matches what gets
    // persisted — we only swap in user accepts/rejects across sessions.
    const SEED_ROUNDS = [
        {
            videoId: 'late-night-sessions',
            title: '"Late Night Sessions" — feature single',
            thumb: '../assets/images/artists/lola-young-event.jpg',
            uploadedAt: Date.now() - 7 * 86400000,
            releaseAt:  Date.now() + 14 * 86400000,
            slots: {
                'preroll': {
                    bids: [
                        { id: 'b1',  sponsor: 'spotify',    amount: 5800, terms: 'Per 3,000 views · auto-skip after 5 sec' },
                        { id: 'b2',  sponsor: 'nike',       amount: 4500, terms: 'Per 3,000 views · 30 sec spot' },
                        { id: 'b3',  sponsor: 'redbull',    amount: 3800, terms: 'Per 3,000 views · 22 sec spot' },
                        { id: 'b4',  sponsor: 'sony',       amount: 3200, terms: 'Per 3,000 views · cross-promo with Sony Music artist' },
                        { id: 'b5',  sponsor: 'adidas',     amount: 2900, terms: 'Per 3,000 views · 15 sec spot' }
                    ]
                },
                'logo-perm': {
                    bids: [
                        { id: 'b6',  sponsor: 'cocacola',   amount: 14000, terms: 'Lifetime · bottom-right corner' },
                        { id: 'b7',  sponsor: 'heineken',   amount: 12000, terms: 'Lifetime · bottom-right corner · 60% opacity' },
                        { id: 'b8',  sponsor: 'samsung',    amount: 11500, terms: 'Lifetime · top-right corner · subtle' }
                    ]
                },
                'logo-temp': {
                    bids: [
                        { id: 'b9',  sponsor: 'apple',      amount: 3500, terms: '4 weeks · launch period · top-right' },
                        { id: 'b10', sponsor: 'tinder',     amount: 1900, terms: '2 weeks · subtle bottom-left' },
                        { id: 'b11', sponsor: 'cph-coffee', amount: 800,  terms: '4 weeks · CPH-only geo-target' },
                        { id: 'b12', sponsor: 'mcdonalds',  amount: 2400, terms: '3 weeks · weekend-only display' }
                    ]
                }
            }
        },
        {
            videoId: 'ep-rollout-bts',
            title: 'EP rollout BTS — color grade pass 2',
            thumb: '../assets/images/artists/jokesmith-johnson-post-3.png',
            uploadedAt: Date.now() - 3 * 86400000,
            releaseAt:  Date.now() + 7 * 86400000,
            slots: {
                'preroll': {
                    bids: [
                        { id: 'b20', sponsor: 'levis',      amount: 2400, terms: 'Per 3,000 views · 20 sec spot' },
                        { id: 'b21', sponsor: 'ducati',     amount: 2200, terms: 'Per 3,000 views · auto-skip after 5 sec' },
                        { id: 'b22', sponsor: 'carlsberg',  amount: 1800, terms: 'Per 3,000 views · DK + SE only' }
                    ]
                },
                'logo-perm': {
                    bids: [
                        { id: 'b23', sponsor: 'roskilde',   amount: 8500, terms: 'Lifetime · bottom-right · linked to festival profile' },
                        { id: 'b24', sponsor: 'tuborg',     amount: 6500, terms: 'Lifetime · bottom-left · 50% opacity' }
                    ]
                },
                'logo-temp': {
                    bids: [
                        { id: 'b25', sponsor: 'apple',      amount: 1900, terms: '2 weeks · launch week + 1' },
                        { id: 'b26', sponsor: 'cph-coffee', amount: 600,  terms: '4 weeks · CPH-only geo-target' },
                        { id: 'b27', sponsor: 'spotify',    amount: 2200, terms: '1 week · synced with Discover Weekly placement' },
                        { id: 'b28', sponsor: 'redbull',    amount: 1400, terms: '2 weeks · sport-content overlay' },
                        { id: 'b29', sponsor: 'tinder',     amount: 950,  terms: '3 weeks · 18-34 demographic only' }
                    ]
                }
            }
        },
        // ---- Online concerts open for sponsor bidding ----
        {
            videoId: 'vega-livestream-nov',
            type: 'concert',
            title: 'VEGA livestream · 9 Nov',
            thumb: '../assets/images/artists/jokesmith-johnson-cover.png',
            venue: 'VEGA, København',
            expectedViewers: '85-110K',
            uploadedAt: Date.now() - 5 * 86400000,
            releaseAt:  Date.now() + 21 * 86400000,
            slots: {
                'preroll': {
                    bids: [
                        { id: 'cb1',  sponsor: 'spotify',    amount: 7500, terms: 'Per 3,000 viewers · 30 sec spot before stream' },
                        { id: 'cb2',  sponsor: 'redbull',    amount: 6800, terms: 'Per 3,000 viewers · 22 sec spot · energy drink fit' },
                        { id: 'cb3',  sponsor: 'tuborg',     amount: 5200, terms: 'Per 3,000 viewers · 15 sec spot · DK + SE only' },
                        { id: 'cb4',  sponsor: 'samsung',    amount: 4500, terms: 'Per 3,000 viewers · device showcase' }
                    ]
                },
                'logo-perm': {
                    bids: [
                        { id: 'cb5',  sponsor: 'heineken',   amount: 28000, terms: 'Stage backdrop banner · whole concert' },
                        { id: 'cb6',  sponsor: 'cocacola',   amount: 32000, terms: 'Stage backdrop · brand-color stage lighting' },
                        { id: 'cb7',  sponsor: 'roskilde',   amount: 18000, terms: 'Co-presenter banner · cross-promo with festival' },
                        { id: 'cb8',  sponsor: 'samsung',    amount: 22000, terms: 'Backdrop banner · livestream platform branding' }
                    ]
                },
                'logo-temp': {
                    bids: [
                        { id: 'cb9',  sponsor: 'apple',      amount: 5800, terms: '3 songs · Apple Music corner overlay' },
                        { id: 'cb10', sponsor: 'spotify',    amount: 4900, terms: 'Encore song only · Spotify branding' },
                        { id: 'cb11', sponsor: 'cph-coffee', amount: 1200, terms: '2 acoustic songs · subtle bottom-left' },
                        { id: 'cb12', sponsor: 'tinder',     amount: 2400, terms: 'Opening song · romance-themed track' }
                    ]
                }
            }
        },
        {
            videoId: 'rust-livestream-dec',
            type: 'concert',
            title: 'RUST online concert · 2 Dec',
            thumb: '../assets/images/artists/rust-cover.png',
            venue: 'RUST, København',
            expectedViewers: '20-35K',
            uploadedAt: Date.now() - 2 * 86400000,
            releaseAt:  Date.now() + 30 * 86400000,
            slots: {
                'preroll': {
                    bids: [
                        { id: 'cb20', sponsor: 'tuborg',     amount: 2200, terms: 'Per 3,000 viewers · 20 sec spot' },
                        { id: 'cb21', sponsor: 'carlsberg',  amount: 1900, terms: 'Per 3,000 viewers · 15 sec spot' }
                    ]
                },
                'logo-perm': {
                    bids: [
                        { id: 'cb22', sponsor: 'heineken',   amount: 9500, terms: 'Stage banner · whole 90 min set' },
                        { id: 'cb23', sponsor: 'levis',      amount: 7800, terms: 'Backdrop banner · denim-themed stage lighting' }
                    ]
                },
                'logo-temp': {
                    bids: [
                        { id: 'cb24', sponsor: 'cph-coffee', amount: 800,  terms: 'Acoustic set only · subtle bottom-left' },
                        { id: 'cb25', sponsor: 'spotify',    amount: 1700, terms: '3 specific songs · livestream-locked' },
                        { id: 'cb26', sponsor: 'redbull',    amount: 1100, terms: 'Encore + outro · brand color matching' }
                    ]
                }
            }
        }
    ];

    const escapeHtml = SC.escapeHtml;
    const escapeAttr = SC.escapeAttr;

    function fmt$(n) {
        if (n >= 1000) return '$' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '') + 'K';
        return '$' + n;
    }

    function fullFmt$(n) {
        return '$' + n.toLocaleString('en-US');
    }

    function readState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
    function writeState(rounds) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rounds)); } catch (e) {}
    }

    function initSlotState(round) {
        Object.keys(round.slots).forEach(function(k) {
            if (!('accepted' in round.slots[k])) round.slots[k].accepted = null;
            if (!('rejected' in round.slots[k])) round.slots[k].rejected = {};
        });
    }

    // Load (or seed) rounds on first visit. On re-visits, merge in any
    // seed rounds that didn't exist before (e.g. when concert rounds were
    // added) so the user sees them without losing prior accept/reject state.
    let rounds = readState();
    if (!rounds) {
        rounds = JSON.parse(JSON.stringify(SEED_ROUNDS));
        rounds.forEach(initSlotState);
        writeState(rounds);
    } else {
        const existingIds = {};
        rounds.forEach(function(r) { existingIds[r.videoId] = true; });
        let added = false;
        SEED_ROUNDS.forEach(function(seed) {
            if (!existingIds[seed.videoId]) {
                const fresh = JSON.parse(JSON.stringify(seed));
                initSlotState(fresh);
                rounds.push(fresh);
                added = true;
            }
        });
        if (added) writeState(rounds);
    }

    // ---------- Helpers ----------
    function daysUntil(ts) {
        const diff = ts - Date.now();
        return Math.ceil(diff / 86400000);
    }

    function topBidIn(slot) {
        const live = (slot.bids || []).filter(function(b) { return !slot.rejected || !slot.rejected[b.id]; });
        if (!live.length) return null;
        return live.reduce(function(a, b) { return a.amount >= b.amount ? a : b; });
    }

    function totalAcceptedValue(round) {
        let total = 0;
        Object.keys(round.slots).forEach(function(k) {
            const s = round.slots[k];
            if (s.accepted) {
                const bid = (s.bids || []).find(function(b) { return b.id === s.accepted; });
                if (bid) total += bid.amount;
            }
        });
        return total;
    }

    function totalAllRoundsValue() {
        let total = 0;
        rounds.forEach(function(r) {
            Object.keys(r.slots).forEach(function(k) {
                const s = r.slots[k];
                (s.bids || []).forEach(function(b) {
                    if (!s.rejected || !s.rejected[b.id]) total += b.amount;
                });
            });
        });
        return total;
    }

    // ---------- Render: cards on the bidding tab ----------
    function renderCards() {
        list.innerHTML = rounds.map(function(round) {
            const days = daysUntil(round.releaseAt);
            const countdownClass = days <= 3
                ? 'bidding-card__countdown bidding-card__countdown--soon'
                : (days <= 0 ? 'bidding-card__countdown bidding-card__countdown--closed' : 'bidding-card__countdown');
            const countdownLabel = days <= 0 ? 'Closed' : (days === 1 ? '1 day' : days + ' days');

            const roundType = round.type || 'video';
            const slotsHtml = Object.keys(round.slots).map(function(slotKey) {
                const slot = round.slots[slotKey];
                const def = SLOTS[slotKey];
                const top = topBidIn(slot);
                const accepted = slot.accepted ? (slot.bids || []).find(function(b) { return b.id === slot.accepted; }) : null;
                const display = accepted || top;
                const sponsor = display ? SPONSORS[display.sponsor] : null;
                const liveCount = (slot.bids || []).filter(function(b) { return !slot.rejected || !slot.rejected[b.id]; }).length;
                const acceptedClass = accepted ? ' is-accepted' : '';
                const emptyClass = liveCount === 0 ? ' is-empty' : '';
                const iconCls = slotKey === 'logo-perm' ? 'bidding-slot__icon--logo-perm' : (slotKey === 'logo-temp' ? 'bidding-slot__icon--logo-temp' : '');
                const label = slotLabel(slotKey, roundType);
                const units = slotUnits(slotKey, roundType);
                const helpDescription = roundType === 'concert'
                    ? (slotKey === 'preroll' ? 'pre-show ad før livestream starter (per 3K seere).' : (slotKey === 'logo-perm' ? 'stage-banner under hele koncerten.' : 'in-set overlay på specifikke sange.'))
                    : (slotKey === 'preroll' ? 'pre-roll commercial per 3K views.' : (slotKey === 'logo-perm' ? 'permanent corner-logo i hele videoens levetid.' : 'tidsbegrænset corner-logo (1-4 uger).'));
                return '<button type="button" class="bidding-slot' + acceptedClass + emptyClass + '" data-bidding-slot="' + escapeAttr(round.videoId) + '" data-bidding-slot-key="' + slotKey + '" data-help="' + escapeAttr(label + ' slot: ' + helpDescription + ' Klik for at se alle bud og acceptere/afvise.') + '">' +
                    '<span class="bidding-slot__type"><span class="bidding-slot__icon ' + iconCls + '">' + def.short + '</span>' + escapeHtml(label) + '</span>' +
                    (display
                        ? '<span class="bidding-slot__top-bid">' + fmt$(display.amount) + '</span>' +
                          '<span class="bidding-slot__top-bid-meta">' + (sponsor ? escapeHtml(sponsor.name) : 'Sponsor') + ' · ' + escapeHtml(units) + '</span>' +
                          '<span class="bidding-slot__count">' + (accepted ? '<strong>✓ Accepted</strong>' : '<strong>' + liveCount + '</strong> bud' + (liveCount === 1 ? '' : 's')) + '</span>'
                        : '<span class="bidding-slot__top-bid" style="color:rgba(255,255,255,0.4);">—</span>' +
                          '<span class="bidding-slot__top-bid-meta">No bids yet</span>') +
                '</button>';
            }).join('');

            const total = totalAcceptedValue(round);
            const isConcert = roundType === 'concert';
            const typeBadgeCls = isConcert ? 'bidding-card__type-badge bidding-card__type-badge--concert' : 'bidding-card__type-badge bidding-card__type-badge--video';
            const typeBadgeLabel = isConcert ? 'Live concert' : 'Music video';
            const typeBadgeHelp = isConcert
                ? 'Online koncert: Sponsor-slots tager udgangspunkt i live-streaming-format — pre-show ad, stage-banner under hele koncerten, og in-set overlay på udvalgte sange.'
                : 'Music video: Sponsor-slots følger den klassiske video-model — pre-roll commercial, permanent corner-logo, og tidsbegrænset corner-logo.';
            const dateLabel = isConcert ? 'Concert date' : 'Releasing';
            const metaText = isConcert
                ? 'Listed ' + new Date(round.uploadedAt).toLocaleDateString() +
                  ' · ' + dateLabel + ' ' + new Date(round.releaseAt).toLocaleDateString() +
                  (round.expectedViewers ? ' · ~' + round.expectedViewers + ' viewers' : '') +
                  (round.venue ? ' · ' + round.venue : '')
                : 'Uploaded ' + new Date(round.uploadedAt).toLocaleDateString() +
                  ' · ' + dateLabel + ' ' + new Date(round.releaseAt).toLocaleDateString();
            const metaHelp = isConcert
                ? 'Online koncert-info: Hvornår koncerten blev oprettet til bidding, koncert-datoen, forventede streamere og venue. Bidding round lukker 24 timer før koncerten går live.'
                : 'Tids-info: Hvornår videoen blev uploadet og hvornår den udgives. Bidding round lukker 24 timer før release.';
            // Cover + 3 slots as 4 equal sections in one row (siblings).
            return '<article class="bidding-card" data-bidding-video="' + escapeAttr(round.videoId) + '" data-help="Bidding round-kort for: ' + escapeAttr(round.title) + '. Viser cover + de 3 sponsor-slots med højeste bud. Klik en slot for at se alle bud og acceptere de bedste.">' +
                '<div class="bidding-card__row">' +
                    '<div class="bidding-card__thumb" style="background-image:url(\'' + escapeAttr(round.thumb) + '\');" data-help="' + (isConcert ? 'Koncert-preview: Klik for at åbne koncert-detaljer.' : 'Video-preview: Klik for at åbne videoen i editor.') + '">' +
                        '<span class="' + countdownClass + '">' + countdownLabel + '</span>' +
                        '<span class="' + typeBadgeCls + '" data-help="' + escapeAttr(typeBadgeHelp) + '">' + typeBadgeLabel + '</span>' +
                        '<span class="bidding-card__thumb-overlay"></span>' +
                        '<span class="bidding-card__title">' + escapeHtml(round.title) + '</span>' +
                    '</div>' +
                    slotsHtml +
                '</div>' +
                '<footer class="bidding-card__footer">' +
                    '<div class="bidding-card__footer-info">' +
                        '<span class="bidding-card__meta" data-help="' + escapeAttr(metaHelp) + '">' + escapeHtml(metaText) + '</span>' +
                        (total > 0 ? '<span><span class="bidding-card__total-label">Accepted</span><span class="bidding-card__total">' + fullFmt$(total) + '</span></span>' : '') +
                    '</div>' +
                    '<button type="button" class="bid-action bid-action--accept" data-bidding-review="' + escapeAttr(round.videoId) + '" data-help="Review bids: Åbner detaljeret modal med alle bud per slot. Du kan acceptere/afvise individuelt og se sponsor-info + commercial-rules.">Review all bids →</button>' +
                '</footer>' +
            '</article>';
        }).join('');

        renderSummary();
    }

    function renderSummary() {
        if (summaryRoundsEl) summaryRoundsEl.textContent = String(rounds.length);
        if (summaryTotalEl)  summaryTotalEl.textContent  = fullFmt$(totalAllRoundsValue());
        if (summaryNextEl) {
            const closest = rounds.reduce(function(min, r) {
                const d = daysUntil(r.releaseAt);
                return d < min ? d : min;
            }, Infinity);
            summaryNextEl.textContent = closest === Infinity ? '—' : (closest + ' days');
        }
    }

    // ---------- Render: details modal ----------
    let activeRoundId = null;

    function findRound(id) {
        return rounds.find(function(r) { return r.videoId === id; });
    }

    function renderDetails(roundId, scrollToSlot) {
        const round = findRound(roundId);
        if (!round) return;
        activeRoundId = roundId;
        const roundType = round.type || 'video';
        const isConcert = roundType === 'concert';
        titleEl.textContent = round.title;
        thumbEl.style.backgroundImage = "url('" + round.thumb + "')";
        const closesAt = round.releaseAt - 86400000;
        metaEl.textContent = isConcert
            ? 'Listed ' + new Date(round.uploadedAt).toLocaleDateString() +
              ' · Concert ' + new Date(round.releaseAt).toLocaleDateString() +
              ' · Bidding closes ' + new Date(closesAt).toLocaleDateString() +
              (round.expectedViewers ? ' · ~' + round.expectedViewers + ' viewers' : '') +
              ' · Total accepted ' + fullFmt$(totalAcceptedValue(round))
            : 'Uploaded ' + new Date(round.uploadedAt).toLocaleDateString() +
              ' · Releasing ' + new Date(round.releaseAt).toLocaleDateString() +
              ' · Bidding closes ' + new Date(closesAt).toLocaleDateString() +
              ' · Total accepted ' + fullFmt$(totalAcceptedValue(round));

        // Adjust section titles in the modal to match the round's type.
        const titleMap = {
            'preroll':   isConcert ? 'Pre-show ad · per 3K viewers'        : 'Pre-roll commercial · per 3000 views',
            'logo-perm': isConcert ? 'Stage banner · whole concert'         : 'Permanent corner logo',
            'logo-temp': isConcert ? 'In-set overlay · specific song(s)'    : 'Limited-time corner logo'
        };
        const hintMap = {
            'preroll':   isConcert ? 'Plays before the livestream begins'  : '15-30 sec spot before video starts',
            'logo-perm': isConcert ? 'Stage backdrop for the entire set'    : "Logo in corner for the video's full lifetime · single payment",
            'logo-temp': isConcert ? 'Brand overlay during specific songs'  : 'Logo in corner for a fixed window (1-4 weeks) then expires'
        };
        Object.keys(titleMap).forEach(function(slotKey) {
            const section = detailsModal.querySelector('[data-bid-slot-section="' + slotKey + '"]');
            if (!section) return;
            const titleNode = section.querySelector('.bid-section__title');
            const hintNode  = section.querySelector('.bid-section__hint');
            if (titleNode) {
                // Preserve the icon span; rewrite only the trailing text.
                const icon = titleNode.querySelector('.bid-section__icon');
                titleNode.innerHTML = '';
                if (icon) titleNode.appendChild(icon);
                titleNode.appendChild(document.createTextNode(' ' + titleMap[slotKey]));
            }
            if (hintNode) hintNode.textContent = hintMap[slotKey];
        });

        Object.keys(round.slots).forEach(function(slotKey) {
            const slot = round.slots[slotKey];
            const listEl = detailsModal.querySelector('[data-bid-list="' + slotKey + '"]');
            if (!listEl) return;
            const sortedBids = (slot.bids || []).slice().sort(function(a, b) { return b.amount - a.amount; });
            listEl.innerHTML = sortedBids.map(function(bid) {
                const sponsor = SPONSORS[bid.sponsor] || { name: bid.sponsor, color: '#444', initials: '??' };
                const isAccepted = slot.accepted === bid.id;
                const isRejected = slot.rejected && slot.rejected[bid.id];
                const cls = 'bid-row' + (isAccepted ? ' is-accepted' : '') + (isRejected ? ' is-rejected' : '');
                const helpText = 'Bud fra ' + sponsor.name + ' på ' + fullFmt$(bid.amount) +
                    (slotKey === 'preroll' ? ' per 3K views' : '') +
                    '. Vilkår: ' + bid.terms;
                let actions = '';
                if (slot.accepted && slot.accepted !== bid.id) {
                    actions = '<button type="button" class="bid-action" disabled style="opacity:0.4;cursor:not-allowed;" data-help="Et andet bud er allerede accepteret på dette slot. Annullér det først for at acceptere dette i stedet.">Locked</button>';
                } else if (isAccepted) {
                    actions = '<button type="button" class="bid-action bid-action--accepted" data-bid-cancel-accept="' + bid.id + '" data-bid-slot="' + slotKey + '" data-help="Annullér accept: Frigør slottet så du kan acceptere et andet bud.">✓ Accepted</button>';
                } else if (isRejected) {
                    actions = '<button type="button" class="bid-action" data-bid-restore="' + bid.id + '" data-bid-slot="' + slotKey + '" data-help="Genaktivér det afviste bud så det igen kan accepteres.">Restore</button>';
                } else {
                    actions =
                        '<button type="button" class="bid-action bid-action--accept" data-bid-accept="' + bid.id + '" data-bid-slot="' + slotKey + '" data-help="Acceptér dette bud: Sponsoren får besked, slottet bliver booked, og beløbet tæller ind i din samlede bidding-værdi for denne video.">Accept</button>' +
                        '<button type="button" class="bid-action bid-action--reject" data-bid-reject="' + bid.id + '" data-bid-slot="' + slotKey + '" data-help="Afvis dette bud: Sponsoren får besked og kan placere et nyt bud. Du kan altid genaktivere et afvist bud senere.">Reject</button>';
                }
                return '<li class="' + cls + '" data-help="' + escapeAttr(helpText) + '">' +
                    '<span class="bid-row__avatar" style="background:' + sponsor.color + ';">' + escapeHtml(sponsor.initials) + '</span>' +
                    '<div class="bid-row__main">' +
                        '<span class="bid-row__sponsor">' + escapeHtml(sponsor.name) + '</span>' +
                        '<span class="bid-row__terms">' + escapeHtml(bid.terms) + '</span>' +
                    '</div>' +
                    '<span class="bid-row__amount">' + fullFmt$(bid.amount) +
                        (slotKey === 'preroll' ? '<span class="bid-row__amount-meta">per 3K views</span>' : '') +
                    '</span>' +
                    '<span class="bid-row__controls">' + actions + '</span>' +
                '</li>';
            }).join('');
        });

        detailsModal.classList.add('open');
        detailsModal.setAttribute('aria-hidden', 'false');

        if (scrollToSlot) {
            const target = detailsModal.querySelector('[data-bid-slot-section="' + scrollToSlot + '"]');
            if (target) setTimeout(function() { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
        }
    }

    function closeDetails() {
        detailsModal.classList.remove('open');
        detailsModal.setAttribute('aria-hidden', 'true');
        activeRoundId = null;
    }

    // ---------- Mutations ----------
    function acceptBid(slotKey, bidId) {
        const round = findRound(activeRoundId);
        if (!round) return;
        const slot = round.slots[slotKey];
        if (!slot) return;
        slot.accepted = bidId;
        if (slot.rejected) delete slot.rejected[bidId];
        writeState(rounds);
        renderDetails(activeRoundId);
        renderCards();
    }

    function cancelAccept(slotKey) {
        const round = findRound(activeRoundId);
        if (!round) return;
        const slot = round.slots[slotKey];
        if (!slot) return;
        slot.accepted = null;
        writeState(rounds);
        renderDetails(activeRoundId);
        renderCards();
    }

    function rejectBid(slotKey, bidId) {
        const round = findRound(activeRoundId);
        if (!round) return;
        const slot = round.slots[slotKey];
        if (!slot) return;
        if (!slot.rejected) slot.rejected = {};
        slot.rejected[bidId] = true;
        if (slot.accepted === bidId) slot.accepted = null;
        writeState(rounds);
        renderDetails(activeRoundId);
        renderCards();
    }

    function restoreBid(slotKey, bidId) {
        const round = findRound(activeRoundId);
        if (!round) return;
        const slot = round.slots[slotKey];
        if (!slot || !slot.rejected) return;
        delete slot.rejected[bidId];
        writeState(rounds);
        renderDetails(activeRoundId);
        renderCards();
    }

    // ---------- Wiring ----------
    document.addEventListener('click', function(e) {
        const slot = e.target.closest('[data-bidding-slot]');
        if (slot && !slot.classList.contains('is-empty')) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            renderDetails(slot.dataset.biddingSlot, slot.dataset.biddingSlotKey);
            return;
        }
        const review = e.target.closest('[data-bidding-review]');
        if (review) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            renderDetails(review.dataset.biddingReview);
            return;
        }
    });

    if (detailsModal) {
        detailsModal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-bidding]')) { closeDetails(); return; }
            const acc = e.target.closest('[data-bid-accept]');
            if (acc) { acceptBid(acc.dataset.bidSlot, acc.dataset.bidAccept); return; }
            const cancel = e.target.closest('[data-bid-cancel-accept]');
            if (cancel) { cancelAccept(cancel.dataset.bidSlot); return; }
            const rej = e.target.closest('[data-bid-reject]');
            if (rej) { rejectBid(rej.dataset.bidSlot, rej.dataset.bidReject); return; }
            const restore = e.target.closest('[data-bid-restore]');
            if (restore) { restoreBid(restore.dataset.bidSlot, restore.dataset.bidRestore); return; }
            if (e.target === detailsModal) closeDetails();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && detailsModal.classList.contains('open')) closeDetails();
        });
    }

    renderCards();
})();

// ============================================================
// Pitched songs — artist's outbound pitches to radio profiles
// ============================================================
// Renders a per-song table with radio-pitch status: ▶ icon turns cyan
// when at least one radio host has played the song for ≥30 seconds
// (the threshold from the original PDF: a real listen counts only after
// 30 sec). Click a row → modal with per-radio breakdown showing each
// host's individual play duration, rating, and comment. Stations with
// multiple hosts compute an internal average before contributing to
// the song's overall rating.
(function() {
    const rowsEl = document.querySelector('[data-pitched-rows]');
    if (!rowsEl) return;

    const sortSel  = document.querySelector('[data-pitched-sort]');
    const emptyEl  = document.querySelector('[data-pitched-empty]');
    const detailModal = document.getElementById('pitchedDetailModal');
    const detailTitle    = detailModal && detailModal.querySelector('[data-pitched-detail-title]');
    const detailMeta     = detailModal && detailModal.querySelector('[data-pitched-detail-meta]');
    const detailRadios   = detailModal && detailModal.querySelector('[data-pitched-radios]');
    const ratingNum      = detailModal && detailModal.querySelector('[data-pitched-rating-num]');
    const ratingStars    = detailModal && detailModal.querySelector('[data-pitched-rating-stars]');
    const ratingMeta     = detailModal && detailModal.querySelector('[data-pitched-rating-meta]');
    const modalTitle     = detailModal && detailModal.querySelector('[data-pitched-modal-title]');

    // Radio stations + their hosts (for the detail modal).
    const RADIOS = {
        'dr-p3':       { name: 'DR P3',         color: '#E62864', initials: 'P3', country: 'DK' },
        'dr-p4':       { name: 'DR P4',         color: '#0E5C2F', initials: 'P4', country: 'DK' },
        'dr-p6':       { name: 'DR P6 Beat',    color: '#FFC400', initials: 'P6', country: 'DK' },
        'nrj':         { name: 'NRJ',           color: '#000000', initials: 'NJ', country: 'DK' },
        'radio-happy': { name: 'Radio Happy',   color: '#FF8AC8', initials: 'RH', country: 'DK' },
        'mynd-radio':  { name: 'Mynd Radio',    color: '#A370F0', initials: 'MR', country: 'DK' },
        'p1-uk':       { name: 'BBC Radio 1',   color: '#DA1B1B', initials: 'R1', country: 'UK' },
        'kex-radio':   { name: 'KEX Radio',     color: '#43C47A', initials: 'KX', country: 'IS' },
        'rix-fm':      { name: 'Rix FM',        color: '#1428A0', initials: 'RX', country: 'SE' }
    };

    // Mock pitched songs with realistic listening + rating data.
    const SONGS = [
        {
            id: 'brooklyn-air',
            title: 'Brooklyn Air',
            type: 'Single',
            genre: 'Pop',
            subGenre: 'Indie pop',
            country: 'DK',
            releasedAt: '2024-09-12',
            radios: [
                {
                    radioId: 'dr-p3',
                    downloads: 2,
                    hosts: [
                        { name: 'Anders Bonde',  avatarColor: '#FF6A55', durationSec: 198, rating: 4.5, comment: 'Strong hook in the chorus, the verse melody could use more contrast.' },
                        { name: 'Mai Manniche',  avatarColor: '#7DD3C0', durationSec: 215, rating: 4.0, comment: 'Production is tight. Would consider for the Friday rotation.' },
                        { name: 'Esben Bjerre',  avatarColor: '#FFC400', durationSec: 12,  rating: null, comment: '' }
                    ]
                },
                {
                    radioId: 'dr-p6',
                    downloads: 1,
                    hosts: [
                        { name: 'Henrik Marstal', avatarColor: '#A370F0', durationSec: 240, rating: 4.5, comment: 'Reminds me of early Beach House. Will pencil in for next week.' }
                    ]
                },
                {
                    radioId: 'nrj',
                    downloads: 0,
                    hosts: [
                        { name: 'Heidi Frederikke', avatarColor: '#FF8AC8', durationSec: 22, rating: null, comment: '' },
                        { name: 'Felix Smith',      avatarColor: '#4A90E2', durationSec: 0,  rating: null, comment: '' }
                    ]
                }
            ]
        },
        {
            id: 'eternaty',
            title: 'Eternaty',
            type: 'Single (feat. Maya Thompson)',
            genre: 'Pop',
            subGenre: 'Dream pop',
            country: 'GLOBAL',
            releasedAt: '2024-11-15',
            radios: [
                {
                    radioId: 'dr-p3',
                    downloads: 3,
                    hosts: [
                        { name: 'Anders Bonde',  avatarColor: '#FF6A55', durationSec: 234, rating: 5.0, comment: 'This is a hit. Locked in for prime-time rotation.' },
                        { name: 'Mai Manniche',  avatarColor: '#7DD3C0', durationSec: 234, rating: 4.5, comment: 'Maya\'s topline elevates the whole track.' },
                        { name: 'Esben Bjerre',  avatarColor: '#FFC400', durationSec: 198, rating: 4.0, comment: '' }
                    ]
                },
                {
                    radioId: 'p1-uk',
                    downloads: 1,
                    hosts: [
                        { name: 'Annie Mac',     avatarColor: '#FF6A55', durationSec: 234, rating: 4.5, comment: 'Adding to my Hottest Records consideration list.' }
                    ]
                },
                {
                    radioId: 'kex-radio',
                    downloads: 0,
                    hosts: [
                        { name: 'Olafur Arnalds', avatarColor: '#7DD3C0', durationSec: 78, rating: 4.0, comment: 'Atmospheric mix, suits our late-night flow.' }
                    ]
                }
            ]
        },
        {
            id: 'manhattan-rain',
            title: 'Manhattan Rain',
            type: 'Single (feat. Anchi Humifuku)',
            genre: 'R&B',
            subGenre: 'Alt R&B',
            country: 'GLOBAL',
            releasedAt: '2024-08-04',
            radios: [
                {
                    radioId: 'radio-happy',
                    downloads: 1,
                    hosts: [
                        { name: 'Mette Werge',   avatarColor: '#FFB547', durationSec: 187, rating: 4.0, comment: 'Smooth groove. Slot it in the morning chill block.' }
                    ]
                },
                {
                    radioId: 'mynd-radio',
                    downloads: 0,
                    hosts: [
                        { name: 'Tobias Brandt', avatarColor: '#A370F0', durationSec: 0, rating: null, comment: '' },
                        { name: 'Lærke Skov',    avatarColor: '#FF8AC8', durationSec: 9, rating: null, comment: '' }
                    ]
                }
            ]
        },
        {
            id: 'late-cellar',
            title: 'Late Cellar Set',
            type: 'Live cut',
            genre: 'Pop',
            subGenre: 'Synthpop',
            country: 'DK',
            releasedAt: '2024-10-01',
            radios: [
                {
                    radioId: 'dr-p3',
                    downloads: 0,
                    hosts: [
                        { name: 'Anders Bonde',  avatarColor: '#FF6A55', durationSec: 0, rating: null, comment: '' },
                        { name: 'Mai Manniche',  avatarColor: '#7DD3C0', durationSec: 28, rating: null, comment: '' }
                    ]
                },
                {
                    radioId: 'rix-fm',
                    downloads: 0,
                    hosts: [
                        { name: 'Linus Bagge',   avatarColor: '#1428A0', durationSec: 0, rating: null, comment: '' }
                    ]
                }
            ]
        },
        {
            id: 'open-window',
            title: 'Open Window',
            type: 'EP cut',
            genre: 'Indie',
            subGenre: 'Bedroom pop',
            country: 'DK',
            releasedAt: '2024-06-20',
            radios: [
                {
                    radioId: 'dr-p6',
                    downloads: 1,
                    hosts: [
                        { name: 'Henrik Marstal', avatarColor: '#A370F0', durationSec: 195, rating: 3.5, comment: 'Charming. Verse is stronger than the chorus though.' }
                    ]
                },
                {
                    radioId: 'mynd-radio',
                    downloads: 0,
                    hosts: [
                        { name: 'Tobias Brandt', avatarColor: '#A370F0', durationSec: 184, rating: 4.0, comment: 'Will play this on next Sunday\'s acoustic show.' }
                    ]
                }
            ]
        }
    ];

    const escapeHtml = SC.escapeHtml;
    const escapeAttr = SC.escapeAttr;

    function fmtDate(iso) {
        try {
            return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) { return iso; }
    }

    function fmtMMSS(sec) {
        if (!sec) return '0:00';
        const m = Math.floor(sec / 60);
        const s = sec - m * 60;
        return m + ':' + (s < 10 ? '0' + s : s);
    }

    // ---------- Aggregation helpers ----------
    function songStats(song) {
        // PDF rule: a real listen = ≥30 sec. Stations with multiple hosts
        // average their hosts' ratings before the station's score is
        // counted toward the song's overall.
        const stationAverages = [];
        let totalHosts = 0, realPlays = 0, totalDuration = 0, commentCount = 0, downloads = 0;
        const radiosThatPlayed = [];
        song.radios.forEach(function(radio) {
            const ratings = [];
            let radioRealPlays = 0;
            radio.hosts.forEach(function(host) {
                totalHosts++;
                if (host.durationSec >= 30) { realPlays++; radioRealPlays++; }
                totalDuration += host.durationSec || 0;
                if (host.comment && host.comment.length) commentCount++;
                if (typeof host.rating === 'number') ratings.push(host.rating);
            });
            downloads += radio.downloads || 0;
            if (radioRealPlays > 0) radiosThatPlayed.push(radio.radioId);
            if (ratings.length) {
                const avg = ratings.reduce(function(a, b) { return a + b; }, 0) / ratings.length;
                stationAverages.push({ radioId: radio.radioId, avg: avg, ratingCount: ratings.length });
            }
        });
        const overall = stationAverages.length
            ? stationAverages.reduce(function(s, x) { return s + x.avg; }, 0) / stationAverages.length
            : null;
        return {
            totalHosts: totalHosts,
            realPlays: realPlays,
            totalDuration: totalDuration,
            commentCount: commentCount,
            downloads: downloads,
            radiosThatPlayed: radiosThatPlayed,
            stationAverages: stationAverages,
            ratingsCount: stationAverages.reduce(function(s, x) { return s + x.ratingCount; }, 0),
            overall: overall
        };
    }

    function starsHtml(rating) {
        if (rating == null) {
            return '<span class="pitched-stars">' + Array(5).fill('<span class="pitched-stars__star pitched-stars__star--off">★</span>').join('') + '</span>';
        }
        const full = Math.floor(rating);
        const half = (rating - full) >= 0.25 && (rating - full) < 0.75;
        const finalFull = (rating - full) >= 0.75 ? full + 1 : full;
        let html = '<span class="pitched-stars">';
        for (let i = 0; i < 5; i++) {
            if (i < finalFull) html += '<span class="pitched-stars__star">★</span>';
            else if (i === full && half) html += '<span class="pitched-stars__star pitched-stars__star--half">★</span>';
            else html += '<span class="pitched-stars__star pitched-stars__star--off">★</span>';
        }
        html += '</span>';
        return html;
    }

    // ---------- Render: table rows ----------
    function renderRows() {
        const sortBy = sortSel ? sortSel.value : 'recent';
        const songs = SONGS.slice();
        const stats = {};
        songs.forEach(function(s) { stats[s.id] = songStats(s); });
        songs.sort(function(a, b) {
            switch (sortBy) {
                case 'played':   return stats[b.id].realPlays - stats[a.id].realPlays;
                case 'rating':   return (stats[b.id].overall || 0) - (stats[a.id].overall || 0);
                case 'comments': return stats[b.id].commentCount - stats[a.id].commentCount;
                default:         return new Date(b.releasedAt) - new Date(a.releasedAt);
            }
        });

        if (!songs.length) {
            rowsEl.innerHTML = '';
            if (emptyEl) emptyEl.hidden = false;
            return;
        }
        if (emptyEl) emptyEl.hidden = true;

        rowsEl.innerHTML = songs.map(function(s) {
            const st = stats[s.id];
            const realPlay = st.realPlays > 0;
            const heardAvatars = s.radios.slice(0, 5).map(function(radio) {
                const r = RADIOS[radio.radioId] || { color: '#444', initials: '??', name: radio.radioId };
                const played = st.radiosThatPlayed.indexOf(radio.radioId) >= 0;
                const opacity = played ? 1 : 0.4;
                return '<span class="pitched-heard__avatar" style="background:' + r.color + ';opacity:' + opacity + ';" title="' + escapeAttr(r.name) + '">' + escapeHtml(r.initials) + '</span>';
            }).join('');
            const moreRadios = s.radios.length > 5 ? '<span class="pitched-heard__more">+' + (s.radios.length - 5) + '</span>' : '';

            const commentChip = st.commentCount > 0
                ? '<span class="pitched-cell__chip" data-help="' + st.commentCount + ' kommentar' + (st.commentCount === 1 ? '' : 'er') + ' fra radio-værter — klik rækken for at læse dem.">💬 ' + st.commentCount + '</span>'
                : '<span class="pitched-cell__chip pitched-cell__chip--zero" data-help="Ingen kommentarer fra radio-værter endnu.">—</span>';

            return '<div class="pitched-row' + (realPlay ? ' has-real-play' : '') + '" data-pitched-row="' + escapeAttr(s.id) + '" data-help="Pitched sang: ' + escapeAttr(s.title) + '. ' + (realPlay ? st.realPlays + ' radio-vært' + (st.realPlays === 1 ? '' : 'er') + ' har lyttet ≥30 sek.' : 'Ingen radio-vært har lyttet ≥30 sek endnu — afspilningsknappen forbliver grå indtil mindst én vært gør.') + ' Klik rækken for per-radio detaljer.">' +
                '<span class="pitched-cell pitched-cell--play"><span class="pitched-cell__play-icon">▶</span></span>' +
                '<span class="pitched-cell pitched-cell--song">' +
                    '<span class="pitched-cell__song-title">' + escapeHtml(s.title) + '</span>' +
                    '<span class="pitched-cell__song-meta">' + escapeHtml(s.type) + '</span>' +
                '</span>' +
                '<span class="pitched-cell pitched-cell--genre">' +
                    '<span class="pitched-cell__genre-main">' + escapeHtml(s.genre) + '</span>' +
                    '<span class="pitched-cell__genre-sub">' + escapeHtml(s.subGenre) + ' · ' + escapeHtml(s.country) + '</span>' +
                '</span>' +
                '<span class="pitched-cell pitched-cell--released">' + fmtDate(s.releasedAt) + '</span>' +
                '<span class="pitched-cell pitched-cell--played">' +
                    '<span class="pitched-cell__played-main">' + st.realPlays + ' / ' + st.totalHosts + '</span>' +
                    '<span class="pitched-cell__played-meta">' + (st.totalHosts ? Math.round(st.realPlays / st.totalHosts * 100) : 0) + '% of pitched hosts</span>' +
                '</span>' +
                '<span class="pitched-cell pitched-cell--heard">' +
                    '<span class="pitched-heard">' + heardAvatars + moreRadios + '</span>' +
                '</span>' +
                '<span class="pitched-cell pitched-cell--rating">' +
                    starsHtml(st.overall) +
                    '<span class="pitched-cell__rating-num">' + (st.overall != null ? st.overall.toFixed(1) + ' · ' + st.ratingsCount + ' rated' : 'Not rated') + '</span>' +
                '</span>' +
                '<span class="pitched-cell pitched-cell--comments">' + commentChip + '</span>' +
            '</div>';
        }).join('');
    }

    // ---------- Render: detail modal ----------
    function openDetail(songId) {
        const song = SONGS.find(function(s) { return s.id === songId; });
        if (!song) return;
        const st = songStats(song);
        if (modalTitle) modalTitle.textContent = song.title + ' — radio status';
        detailTitle.textContent = song.title;
        detailMeta.textContent =
            song.genre + ' · ' + song.subGenre +
            ' · Released ' + fmtDate(song.releasedAt) +
            ' · Target ' + song.country +
            ' · ' + st.realPlays + ' real listens (≥30s) across ' + st.totalHosts + ' radio hosts';
        ratingNum.textContent = st.overall != null ? st.overall.toFixed(1) : '—';
        ratingStars.innerHTML = starsHtml(st.overall);
        ratingMeta.textContent = st.ratingsCount + (st.ratingsCount === 1 ? ' host rated' : ' hosts rated') +
            ' · ' + st.stationAverages.length + (st.stationAverages.length === 1 ? ' station' : ' stations');

        detailRadios.innerHTML = song.radios.map(function(radio) {
            const r = RADIOS[radio.radioId] || { color: '#444', initials: '??', name: radio.radioId };
            const ratings = radio.hosts.map(function(h) { return h.rating; }).filter(function(x) { return typeof x === 'number'; });
            const avg = ratings.length ? ratings.reduce(function(a, b) { return a + b; }, 0) / ratings.length : null;
            const realPlays = radio.hosts.filter(function(h) { return h.durationSec >= 30; }).length;
            const hostsHtml = radio.hosts.map(function(host) {
                const realPlay = host.durationSec >= 30;
                const isPartial = host.durationSec > 0 && !realPlay;
                const playTagCls = realPlay ? 'pitched-host__play-tag' : (isPartial ? 'pitched-host__play-tag pitched-host__play-tag--partial' : 'pitched-host__play-tag pitched-host__play-tag--unplayed');
                const playLabel = realPlay
                    ? '✓ ' + fmtMMSS(host.durationSec) + ' (full listen)'
                    : (isPartial ? 'Stopped at ' + fmtMMSS(host.durationSec) : 'Not played');
                const ratingHtml = typeof host.rating === 'number' ? starsHtml(host.rating) : '<span class="pitched-host__rating-stars pitched-host__rating-stars--unrated">' + Array(5).fill('★').join('') + '</span>';
                const helpText = realPlay
                    ? host.name + ' lyttede ' + fmtMMSS(host.durationSec) + ' (≥30s = tæller som rigtig lytning)' + (host.rating ? ' og gav sangen ' + host.rating + '/5.' : '.')
                    : (isPartial ? host.name + ' begyndte at lytte men stoppede efter ' + fmtMMSS(host.durationSec) + ' — under 30 sek tæller ikke som en rigtig lytning.' : host.name + ' har ikke afspillet sangen endnu.');
                return '<li class="pitched-host' + (realPlay ? ' has-real-play' : '') + '" data-help="' + escapeAttr(helpText) + '">' +
                    '<span class="pitched-host__avatar" style="background:' + host.avatarColor + ';"></span>' +
                    '<div class="pitched-host__main">' +
                        '<div class="pitched-host__name">' + escapeHtml(host.name) + '</div>' +
                        '<div class="pitched-host__meta">' + (host.durationSec ? fmtMMSS(host.durationSec) + ' listened' : 'Not played') + '</div>' +
                    '</div>' +
                    '<span class="' + playTagCls + '">' + playLabel + '</span>' +
                    '<span class="pitched-host__rating-stars' + (typeof host.rating !== 'number' ? ' pitched-host__rating-stars--unrated' : '') + '">' + ratingHtml + '</span>' +
                    (host.comment ? '<div class="pitched-host__comment" data-help="Kommentar fra ' + escapeAttr(host.name) + ' om sangen.">' + escapeHtml(host.comment) + '</div>' : '') +
                '</li>';
            }).join('');
            return '<section class="pitched-radio" data-help="Radio-station: ' + escapeAttr(r.name) + '. ' + radio.hosts.length + ' vært(er) modtog pitchet. ' + realPlays + ' har lyttet ≥30 sek. ' + (radio.downloads ? radio.downloads + ' har downloadet sangen — du modtog notifikation hver gang.' : 'Ingen downloads endnu.') + '">' +
                '<div class="pitched-radio__head">' +
                    '<span class="pitched-radio__avatar" style="background:' + r.color + ';">' + escapeHtml(r.initials) + '</span>' +
                    '<div class="pitched-radio__main">' +
                        '<div class="pitched-radio__name">' + escapeHtml(r.name) + '</div>' +
                        '<div class="pitched-radio__meta">' + radio.hosts.length + ' host' + (radio.hosts.length === 1 ? '' : 's') + ' · ' + r.country + ' · ' + realPlays + ' real listen' + (realPlays === 1 ? '' : 's') + ' (≥30s)</div>' +
                    '</div>' +
                    '<div class="pitched-radio__rating">' +
                        '<div class="pitched-radio__rating-num">' + (avg != null ? avg.toFixed(1) : '—') + '</div>' +
                        '<div class="pitched-radio__rating-stars">' + starsHtml(avg) + '</div>' +
                    '</div>' +
                '</div>' +
                '<ul class="pitched-radio__hosts">' + hostsHtml + '</ul>' +
                (radio.downloads > 0
                    ? '<span class="pitched-radio__downloads" data-help="Downloads: Antallet af gange en vært på denne station har downloaded sangen som WAVE/MP3. Du fik en notifikation hver gang det skete."><strong>↓ ' + radio.downloads + '</strong> download' + (radio.downloads === 1 ? '' : 's') + '</span>'
                    : '') +
            '</section>';
        }).join('');

        detailModal.classList.add('open');
        detailModal.setAttribute('aria-hidden', 'false');
    }

    function closeDetail() {
        detailModal.classList.remove('open');
        detailModal.setAttribute('aria-hidden', 'true');
    }

    rowsEl.addEventListener('click', function(e) {
        const row = e.target.closest('[data-pitched-row]');
        if (!row) return;
        if (typeof helpActive !== 'undefined' && helpActive) return;
        e.preventDefault();
        openDetail(row.dataset.pitchedRow);
    });

    if (detailModal) {
        detailModal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-pitched]')) { closeDetail(); return; }
            if (e.target === detailModal) closeDetail();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && detailModal.classList.contains('open')) closeDetail();
        });
    }

    if (sortSel) sortSel.addEventListener('change', renderRows);

    renderRows();
})();

// ============================================================
// Intimate concerts — fan-bookable private performances
// ============================================================
// Renders the artist's intimate-concert offer + recent bookings on the
// artist page, plus the booking modal where fans submit a request
// (date, address, expected guests, optional message). Price is the base
// rate plus an extra-guest fee for anyone above the audience cap.
//
// Demo seed bookings show the typical flow: pending → confirmed → past.
(function() {
    const list = document.querySelector('[data-intimate-list]');
    if (!list) return;

    const STORAGE_KEY = 'stagecord_pro_intimate_bookings_jokesmith-johnson';
    const OFFER = {
        baseRate: 1800,
        audienceCap: 25,
        extraFee: 45,
        travelRange: 100
    };

    const SEED_BOOKINGS = [
        { id: 'ib1', fan: 'Sofia Nielsen',  fanColor: '#FF8AC8', date: '2025-03-18', address: 'Vesterbrogade 142, 1620 København V', guests: 22, message: 'Surprise birthday for my partner — they know your stuff by heart.', status: 'confirmed' },
        { id: 'ib2', fan: 'Mads Lyng',      fanColor: '#7DD3C0', date: '2025-04-05', address: 'Skovshoved Strandvej 4, 2920 Charlottenlund', guests: 35, message: 'Garden party · we know that\'s above the cap, happy to pay the extras.', status: 'pending' },
        { id: 'ib3', fan: 'Liva Mai',       fanColor: '#FFB547', date: '2024-11-12', address: 'Nørrebrogade 88, 2200 København N', guests: 18, message: '', status: 'past' },
        { id: 'ib4', fan: 'Joakim Nielsen', fanColor: '#A370F0', date: '2025-02-22', address: 'Aarhus C', guests: 28, message: 'Acoustic preferred · we have a baby grand.', status: 'pending' }
    ];

    const escapeHtml = SC.escapeHtml;
    const escapeAttr = SC.escapeAttr;
    function fmt$(n) { return '$' + n.toLocaleString('en-US'); }

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function read() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
    function write(bookings) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings)); } catch (e) {}
    }

    let bookings = read();
    if (!bookings) { bookings = SEED_BOOKINGS.slice(); write(bookings); }

    function statusClass(s) {
        return 'intimate-booking__status intimate-booking__status--' + s;
    }
    function statusLabel(s) {
        return s === 'pending' ? 'Pending' : (s === 'confirmed' ? 'Confirmed' : 'Past');
    }

    function renderBookings() {
        const sorted = bookings.slice().sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
        if (!sorted.length) {
            list.innerHTML = '';
            const empty = document.querySelector('[data-intimate-empty]');
            if (empty) empty.hidden = false;
            return;
        }
        const empty = document.querySelector('[data-intimate-empty]');
        if (empty) empty.hidden = true;
        list.innerHTML = sorted.slice(0, 4).map(function(b) {
            const d = new Date(b.date);
            const helpText = b.fan + ' har booket en intimate concert ' + d.toLocaleDateString() + ' på ' + b.address +
                ' med ' + b.guests + ' forventede gæster. Status: ' + statusLabel(b.status) +
                (b.message ? '. Besked: "' + b.message + '"' : '.');
            return '<li class="intimate-booking" data-help="' + escapeAttr(helpText) + '">' +
                '<span class="intimate-booking__avatar" style="background:' + b.fanColor + ';"></span>' +
                '<div class="intimate-booking__main">' +
                    '<div class="intimate-booking__fan">' + escapeHtml(b.fan) + '</div>' +
                    '<div class="intimate-booking__detail">' + b.guests + ' guests · ' + escapeHtml(b.address) + '</div>' +
                '</div>' +
                '<div class="intimate-booking__date">' +
                    '<div class="intimate-booking__date-day">' + d.getDate() + '</div>' +
                    '<div class="intimate-booking__date-month">' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + '</div>' +
                '</div>' +
                '<span class="' + statusClass(b.status) + '">' + statusLabel(b.status) + '</span>' +
            '</li>';
        }).join('');
    }

    renderBookings();

    // ---------- Booking modal ----------
    const modal = document.getElementById('intimateBookingModal');
    if (!modal) return;

    const dateInp    = modal.querySelector('[data-intimate-date]');
    const guestsInp  = modal.querySelector('[data-intimate-guests]');
    const addrInp    = modal.querySelector('[data-intimate-address]');
    const msgInp     = modal.querySelector('[data-intimate-message]');
    const extrasLine = modal.querySelector('[data-intimate-extras-line]');
    const extrasLabel = modal.querySelector('[data-intimate-extras-label]');
    const extrasAmt  = modal.querySelector('[data-intimate-extras-amount]');
    const totalEl    = modal.querySelector('[data-intimate-total]');

    function updatePrice() {
        const guests = Math.max(1, parseInt(guestsInp.value, 10) || 0);
        const extras = Math.max(0, guests - OFFER.audienceCap);
        const extrasCost = extras * OFFER.extraFee;
        if (extras > 0) {
            extrasLine.hidden = false;
            extrasLabel.textContent = extras + ' extra guest' + (extras === 1 ? '' : 's') + ' (over cap)';
            extrasAmt.textContent = fmt$(extrasCost);
        } else {
            extrasLine.hidden = true;
        }
        totalEl.textContent = fmt$(OFFER.baseRate + extrasCost);
    }

    function open() {
        // Seed sane defaults
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 21);
        dateInp.value = defaultDate.toISOString().slice(0, 10);
        guestsInp.value = 20;
        addrInp.value = '';
        msgInp.value = '';
        updatePrice();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function close() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    function submit() {
        if (!dateInp.value) { dateInp.focus(); return; }
        if (!addrInp.value.trim()) { addrInp.focus(); return; }
        const guests = Math.max(1, parseInt(guestsInp.value, 10) || 0);
        const me = (window.ProjectLog && window.ProjectLog.currentUser) ? window.ProjectLog.currentUser() : { name: 'You' };
        const newBooking = {
            id: 'ib_' + Date.now().toString(36),
            fan: me.name || 'You',
            fanColor: '#4A90E2',
            date: dateInp.value,
            address: addrInp.value.trim(),
            guests: guests,
            message: msgInp.value.trim(),
            status: 'pending'
        };
        bookings.push(newBooking);
        write(bookings);
        renderBookings();
        close();
        alert('Booking-anmodning sendt til artisten ✓ Du modtager besked så snart de har gennemgået den.');
    }

    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-open-intimate]')) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            open();
            return;
        }
    });

    modal.addEventListener('click', function(e) {
        if (e.target.closest('[data-close-intimate]')) { close(); return; }
        if (e.target.closest('[data-intimate-submit]')) { submit(); return; }
        if (e.target === modal) close();
    });

    if (guestsInp) guestsInp.addEventListener('input', updatePrice);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
})();

// ============================================================
// QR-befriend — quick friend-add via QR code
// ============================================================
// Click a QR icon on any profile → modal with a generated QR code that
// encodes a "send friend request" deep-link. Other users scan with their
// phone camera and the platform opens the matching profile with a
// pre-filled request. The shared modal is reused across fan + artist
// pages; trigger buttons carry name + handle in data attributes.
(function() {
    const modal = document.getElementById('qrBefriendModal');
    if (!modal) return;

    const codeEl = modal.querySelector('[data-qr-code]');
    const urlEl  = modal.querySelector('[data-qr-url]');
    const nameEl = modal.querySelector('[data-qr-name]');
    const tabs   = modal.querySelectorAll('[data-qr-tab]');
    const panels = modal.querySelectorAll('[data-qr-panel]');

    // Lightweight pseudo-QR generator: produces a 21×21 grid where dot
    // pattern is derived from a hash of the URL. Not scannable, but
    // visually distinct and stable for each profile — fine for prototype
    // use. (Real QR encoding would require a proper library.)
    function hashString(s) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h;
    }

    function generateQrSvg(url) {
        const size = 21;
        const seed = hashString(url);
        // Use a linear congruential generator seeded by the hash so each
        // URL produces a distinct but stable pattern.
        let state = seed || 1;
        function rand() {
            state = (state * 1664525 + 1013904223) >>> 0;
            return state / 4294967296;
        }
        const cell = 12;
        const padding = 6;
        const totalSize = size * cell + padding * 2;
        let cells = '';
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Three corner finder patterns (top-left, top-right, bottom-left)
                const inFinder =
                    (x < 7 && y < 7) ||
                    (x >= size - 7 && y < 7) ||
                    (x < 7 && y >= size - 7);
                let on = false;
                if (inFinder) {
                    const fx = x < 7 ? x : (x - (size - 7));
                    const fy = y < 7 ? y : (y - (size - 7));
                    // Outer 7×7 ring + inner 3×3 block (classic finder pattern)
                    on = (fx === 0 || fx === 6 || fy === 0 || fy === 6) ||
                         (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4);
                } else {
                    on = rand() < 0.48;
                }
                if (on) {
                    cells += '<rect x="' + (padding + x * cell) + '" y="' + (padding + y * cell) + '" width="' + cell + '" height="' + cell + '" fill="#000"/>';
                }
            }
        }
        return '<svg viewBox="0 0 ' + totalSize + ' ' + totalSize + '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">' +
            '<rect width="100%" height="100%" fill="#FFF"/>' + cells +
        '</svg>';
    }

    function open(triggerEl) {
        const name = (triggerEl && triggerEl.dataset.qrName) || 'Profile';
        const handle = (triggerEl && triggerEl.dataset.qrHandle) || '';
        const url = 'https://stagecord.com/befriend/' + handle.replace(/^@/, '') + '?ref=qr';
        nameEl.textContent = name;
        codeEl.innerHTML = generateQrSvg(url);
        urlEl.textContent = url;
        // Reset tabs
        tabs.forEach(function(t) { t.classList.toggle('is-active', t.dataset.qrTab === 'show'); });
        panels.forEach(function(p) { p.hidden = p.dataset.qrPanel !== 'show'; });
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function close() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    document.addEventListener('click', function(e) {
        const trigger = e.target.closest('[data-qr-trigger]');
        if (trigger) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            open(trigger);
        }
    });

    modal.addEventListener('click', function(e) {
        if (e.target.closest('[data-close-qr]')) { close(); return; }
        const tab = e.target.closest('[data-qr-tab]');
        if (tab) {
            const which = tab.dataset.qrTab;
            tabs.forEach(function(t) { t.classList.toggle('is-active', t.dataset.qrTab === which); });
            panels.forEach(function(p) { p.hidden = p.dataset.qrPanel !== which; });
            return;
        }
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
})();

// ============================================================
// Auto-tagging on video upload — detect material from other artists
// ============================================================
// PDF concept: when the user uploads a video whose title or description
// references another artist or song, the platform auto-detects it and
// surfaces a notice that earnings will be split between the uploader,
// the platform, and the tagged artists. The artists are notified and
// can sign off — at which point the video becomes a collaboration.
(function() {
    const modal = document.getElementById('uploadVideoModal');
    if (!modal) return;

    // Catalog of known artists / songs the uploader might reference.
    // Real implementation would query the platform's catalog API.
    const KNOWN = [
        { name: 'Ed Sheeran',        color: '#E62864', initials: 'ES' },
        { name: 'Miley Cyrus',       color: '#A370F0', initials: 'MC' },
        { name: 'Anchi Humifuku',    color: '#7DD3C0', initials: 'AH' },
        { name: 'Maya Thompson',     color: '#FF8AC8', initials: 'MT' },
        { name: 'Jokesmith Johnson', color: '#FFC400', initials: 'JJ' },
        { name: 'Jeremy Freedom',    color: '#43C47A', initials: 'JF' },
        { name: 'Beyoncé',           color: '#FFB547', initials: 'B♛' },
        { name: 'Drake',             color: '#4A90E2', initials: 'DR' },
        { name: 'Adele',             color: '#FF6A55', initials: 'AD' },
        { name: 'Taylor Swift',      color: '#9B5DE5', initials: 'TS' },
        { name: 'Aria Summers',      color: '#7DD3C0', initials: 'AS' }
    ];

    const titleEl = document.getElementById('uploadVideoTitle');
    const descEl  = document.getElementById('uploadVideoDesc');
    const banner  = document.getElementById('uploadAutoTagBanner');
    const rulesEl = document.getElementById('uploadCommercialRules');

    function detectArtists(text) {
        const found = {};
        const lower = String(text || '').toLowerCase();
        KNOWN.forEach(function(a) {
            if (lower.indexOf(a.name.toLowerCase()) >= 0) found[a.name] = a;
        });
        return Object.values(found);
    }

    function renderBanner(artists) {
        if (!artists.length) {
            banner.hidden = true;
            banner.className = '';
            banner.innerHTML = '';
            return;
        }
        // Each tagged artist gets an equal share, plus the uploader and
        // platform. Show the implied royalty math.
        const totalParties = artists.length + 2;   // uploader + platform + each artist
        const sharePerParty = (100 / totalParties).toFixed(1);

        const avatars = artists.map(function(a) {
            return '<span class="auto-avatar-pile__item" style="background:' + a.color + ';">' + a.initials + '</span>';
        }).join('');

        const names = artists.map(function(a) { return a.name; }).join(', ');

        banner.hidden = false;
        banner.className = 'auto-banner auto-banner--warning';
        banner.innerHTML =
            '<div class="auto-banner__head">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#FFC400" stroke-width="2"/><path d="M12 7v6M12 16h.01" stroke="#FFC400" stroke-width="2" stroke-linecap="round"/></svg>' +
                '<strong class="auto-banner__tag">Auto-tagged · ' + artists.length + ' artist' + (artists.length === 1 ? '' : 's') + '</strong>' +
            '</div>' +
            '<p class="auto-banner__text">' +
                'Du har valgt materiale fra <strong>' + names + '</strong>. Earnings fra denne video bliver auto-split mellem ' +
                '<strong>dig</strong>, <strong>platformen</strong> og <strong>' + (artists.length === 1 ? 'denne artist' : 'disse ' + artists.length + ' artister') + '</strong>. ' +
                'De tagged artister bliver notificeret og kan signere off — hvis de "Vibe"r eller kommenterer, bliver det fremhævet på din video. Hvis de deler den, får du en notifikation.' +
            '</p>' +
            '<div class="auto-banner__row">' +
                '<div class="auto-avatar-pile">' + avatars + '</div>' +
                '<span class="auto-banner__meta">Royalty split estimate: <strong>' + sharePerParty + '%</strong> each (you, platform, +' + artists.length + ' artist' + (artists.length === 1 ? '' : 's') + ')</span>' +
            '</div>';
    }

    function update() {
        const text = (titleEl ? titleEl.value : '') + ' ' + (descEl ? descEl.value : '');
        renderBanner(detectArtists(text));
    }

    function open() {
        if (titleEl) titleEl.value = '';
        if (descEl) descEl.value = '';
        if (rulesEl) rulesEl.checked = false;
        renderBanner([]);
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function close() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-open-upload-video]')) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            open();
        }
    });

    modal.addEventListener('click', function(e) {
        if (e.target.closest('[data-close-upload]')) { close(); return; }
        if (e.target.closest('[data-upload-video-confirm]')) {
            if (rulesEl && !rulesEl.checked) {
                alert('Du skal acceptere commercial rules før upload.');
                rulesEl.focus();
                return;
            }
            const tagged = detectArtists((titleEl ? titleEl.value : '') + ' ' + (descEl ? descEl.value : ''));
            if (tagged.length) {
                alert('Video uploaded ✓ — ' + tagged.length + ' tagged artist(s) bliver notificeret om royalty-split: ' + tagged.map(function(a) { return a.name; }).join(', '));
            } else {
                alert('Video uploaded ✓');
            }
            close();
            return;
        }
        if (e.target === modal) close();
    });

    if (titleEl) titleEl.addEventListener('input', update);
    if (descEl)  descEl.addEventListener('input', update);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
})();

// ============================================================
// 5-step onboarding wizard
// ============================================================
// Walks new users through the role choices outlined in the PDF —
// artist, venue, company, fan, accounting. The modal injects itself
// once on page load if the page has [data-open-onboarding] (currently
// the overview page). Each step is skippable; the final step shows a
// summary of what was configured.
(function() {
    const trigger = document.querySelector('[data-open-onboarding]');
    if (!trigger) return;

    const STORAGE_KEY = 'stagecord_pro_onboarding';

    const STEPS = [
        { id: 'artist',     label: 'Artist',     icon: '🎤', title: 'Are you an artist or in a band?',
          desc: 'Set up an artist profile so fans can follow you, stream your songs, and book intimate concerts. You can always upgrade later from a fan profile.' },
        { id: 'venue',      label: 'Venue',      icon: '🏛',  title: 'Do you operate a venue?',
          desc: 'Add your venue so artists can pitch shows. We support physical stages and online concert spaces with sponsor splits.' },
        { id: 'company',    label: 'Company',    icon: '🏢', title: 'Do you represent a company?',
          desc: 'Companies on STAGECORD can be labels, A&R agencies, sponsors, sync licensors or brands buying media rights.' },
        { id: 'fan',        label: 'Fan',        icon: '🎟', title: 'Tell us how you listen',
          desc: 'Even creators on STAGECORD have a fan-side — for tickets, entourages, friend-finder at concerts and sub-genre exposure ("Paying it forward").' },
        { id: 'accounting', label: 'Accounting', icon: '💰', title: 'Set up your bookkeeping',
          desc: 'Pick the country and tax setup so income from royalties, ticket sales and licensing is reported correctly. KODA / Performex / Gramex auto-import is available for DK artists.' }
    ];

    const ROLE_OPTIONS = {
        artist: [
            { id: 'solo',     icon: '🎤', name: 'Solo artist',  desc: 'Just me' },
            { id: 'band',     icon: '🎸', name: 'Band',         desc: '2+ members' },
            { id: 'producer', icon: '🎛',  name: 'Producer',     desc: 'Behind the boards' },
            { id: 'topliner', icon: '🎼', name: 'Topliner',     desc: 'Vocals & melody' },
            { id: 'dj',       icon: '🔊', name: 'DJ',           desc: 'Live performance' },
            { id: 'skip',     icon: '⤵',  name: "I'm not an artist", desc: 'Skip this step' }
        ],
        venue: [
            { id: 'physical', icon: '🏛',  name: 'Physical venue', desc: 'Live music room' },
            { id: 'online',   icon: '📡', name: 'Online stage',   desc: 'Livestream-only' },
            { id: 'festival', icon: '🎪', name: 'Festival',       desc: 'Multi-day event' },
            { id: 'skip',     icon: '⤵',  name: "I don't run a venue", desc: 'Skip this step' }
        ],
        company: [
            { id: 'label',    icon: '🎵', name: 'Music label',   desc: 'Sign artists' },
            { id: 'sponsor',  icon: '💼', name: 'Sponsor',       desc: 'Brand activations' },
            { id: 'licensor', icon: '🎬', name: 'Licensor',      desc: 'Sync TV/Film/Games' },
            { id: 'manager',  icon: '👔', name: 'Manager / A&R', desc: 'Talent scouting' },
            { id: 'skip',     icon: '⤵',  name: "Not a company", desc: 'Skip this step' }
        ],
        fan: [
            { id: 'casual',   icon: '🎧', name: 'Casual listener', desc: 'Mostly streaming' },
            { id: 'concerts', icon: '🎟', name: 'Concert-goer',    desc: 'Live shows weekly' },
            { id: 'curator',  icon: '📋', name: 'Playlist curator', desc: 'I tastemake' },
            { id: 'skip',     icon: '⤵',  name: "Skip this step", desc: '' }
        ]
    };

    const escapeHtml = SC.escapeHtml;

    function readState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : { selections: {}, completed: false };
        } catch (e) { return { selections: {}, completed: false }; }
    }
    function writeState(s) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
    }

    let state = readState();
    let currentStep = 0;
    let overlayEl = null;

    function buildOverlay() {
        const div = document.createElement('div');
        div.className = 'onboard-overlay';
        div.id = 'onboardOverlay';
        div.setAttribute('data-help', 'Onboarding wizard: 5 steps der konfigurerer dine roller på platformen. Hvert step kan springes over — du kan altid køre wizarden igen senere.');
        div.innerHTML = '<div class="onboard-modal" role="dialog" aria-modal="true"></div>';
        document.body.appendChild(div);
        return div;
    }

    function progressDots() {
        return STEPS.map(function(s, idx) {
            const cls = idx < currentStep ? 'is-done' : (idx === currentStep ? 'is-active' : '');
            return '<span class="onboard-step-dot ' + cls + '"></span>';
        }).join('');
    }

    function renderRoleStep(stepId, options) {
        const sel = state.selections[stepId];
        return '<div class="onboard-role-grid">' + options.map(function(opt) {
            const cls = sel === opt.id ? 'onboard-role is-selected' : 'onboard-role';
            return '<button type="button" class="' + cls + '" data-onboard-pick="' + opt.id + '" data-help="Vælg ' + escapeHtml(opt.name) + ': ' + escapeHtml(opt.desc) + '">' +
                '<span class="onboard-role__icon">' + opt.icon + '</span>' +
                '<span class="onboard-role__name">' + escapeHtml(opt.name) + '</span>' +
                '<span class="onboard-role__desc">' + escapeHtml(opt.desc) + '</span>' +
            '</button>';
        }).join('') + '</div>';
    }

    function renderAccountingStep() {
        const s = state.selections.accounting || {};
        return '<div class="onboard-row">' +
            '<div class="onboard-field">' +
                '<label class="onboard-field__label" data-help="Land: Bestemmer hvilken skattesats og PRO-organisation der gælder. Dansk artister kobles automatisk til KODA/Performex/Gramex.">Country</label>' +
                '<select class="onboard-field__select" data-onboard-input="country">' +
                    '<option' + (s.country === 'DK' ? ' selected' : '') + '>DK</option>' +
                    '<option' + (s.country === 'SE' ? ' selected' : '') + '>SE</option>' +
                    '<option' + (s.country === 'NO' ? ' selected' : '') + '>NO</option>' +
                    '<option' + (s.country === 'UK' ? ' selected' : '') + '>UK</option>' +
                    '<option' + (s.country === 'US' ? ' selected' : '') + '>US</option>' +
                    '<option' + (s.country === 'DE' ? ' selected' : '') + '>DE</option>' +
                '</select>' +
            '</div>' +
            '<div class="onboard-field">' +
                '<label class="onboard-field__label" data-help="Valuta: Hvilken valuta dine indtægter rapporteres i. Konvertering sker automatisk ved udbetaling.">Currency</label>' +
                '<select class="onboard-field__select" data-onboard-input="currency">' +
                    '<option' + (s.currency === 'DKK' ? ' selected' : '') + '>DKK</option>' +
                    '<option' + (s.currency === 'EUR' ? ' selected' : '') + '>EUR</option>' +
                    '<option' + (s.currency === 'USD' ? ' selected' : '') + '>USD</option>' +
                    '<option' + (s.currency === 'GBP' ? ' selected' : '') + '>GBP</option>' +
                '</select>' +
            '</div>' +
        '</div>' +
        '<div class="onboard-field">' +
            '<label class="onboard-field__label" data-help="Skattetype: Påvirker hvordan dine indtægter rapporteres. Selvstændige får et CVR-nummer-felt; lønmodtagere får CPR-baseret rapportering.">Tax setup</label>' +
            '<select class="onboard-field__select" data-onboard-input="taxType">' +
                '<option' + (s.taxType === 'sole'  ? ' selected' : '') + '>Sole proprietor (selvstændig)</option>' +
                '<option' + (s.taxType === 'company' ? ' selected' : '') + '>Limited company (ApS / A/S)</option>' +
                '<option' + (s.taxType === 'employee' ? ' selected' : '') + '>Employee (lønmodtager)</option>' +
                '<option' + (s.taxType === 'hobby' ? ' selected' : '') + '>Hobby (under tax-free threshold)</option>' +
            '</select>' +
        '</div>' +
        '<label style="display:flex;align-items:flex-start;gap:8px;margin-top:8px;font-size:12px;color:rgba(255,255,255,0.75);cursor:pointer;" data-help="KODA/Performex/Gramex: Når aktiveret, importeres dine PRO-royalties automatisk hver måned ind på din Sales-side. Kun tilgængelig for danske artister.">' +
            '<input type="checkbox" data-onboard-input="koda"' + (s.koda ? ' checked' : '') + ' style="margin-top:2px;accent-color:#4A90E2;">' +
            '<span><strong>KODA / Performex / Gramex auto-import</strong> — Mine royalties importeres automatisk månedligt (kun DK).</span>' +
        '</label>';
    }

    function renderStep() {
        const step = STEPS[currentStep];
        const modal = overlayEl.querySelector('.onboard-modal');
        const isLast = currentStep >= STEPS.length;
        if (isLast) {
            // Final celebrate screen
            const summary = STEPS.map(function(s) {
                const sel = state.selections[s.id];
                if (!sel || sel === 'skip') return '<div class="onboard-summary__row onboard-summary__row--skipped"><span>' + s.label + '</span><span>Skipped</span></div>';
                let display = sel;
                if (s.id === 'accounting' && typeof sel === 'object') {
                    display = sel.country + ' · ' + sel.currency + ' · ' + (sel.taxType || '?') + (sel.koda ? ' · KODA on' : '');
                } else if (typeof sel === 'string') {
                    const opt = (ROLE_OPTIONS[s.id] || []).find(function(o) { return o.id === sel; });
                    if (opt) display = opt.name;
                }
                return '<div class="onboard-summary__row"><span>' + s.label + '</span><strong>' + escapeHtml(display) + '</strong></div>';
            }).join('');
            modal.innerHTML =
                '<div class="onboard-modal__body">' +
                    '<div class="onboard-celebrate">' +
                        '<div class="onboard-celebrate__icon">🎉</div>' +
                        '<h2 class="onboard-celebrate__title">Welcome to STAGECORD</h2>' +
                        '<p class="onboard-celebrate__desc">Din profil er sat op. Du kan altid køre wizarden igen fra Overview-knappen, eller justere de enkelte profiler i Settings.</p>' +
                        '<div class="onboard-summary" data-help="Setup-summary: Hvad du valgte i hvert step. Skipped betyder du ikke aktiverede den rolle — du kan altid tilføje den senere.">' + summary + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="onboard-modal__foot">' +
                    '<span class="onboard-modal__foot-info">Wizarden er gennemført ✓</span>' +
                    '<div class="onboard-modal__foot-actions">' +
                        '<button type="button" class="onboard-btn onboard-btn--primary" data-onboard-finish>Take me to Overview</button>' +
                    '</div>' +
                '</div>';
            return;
        }
        const bodyHtml = step.id === 'accounting'
            ? renderAccountingStep()
            : renderRoleStep(step.id, ROLE_OPTIONS[step.id] || []);
        modal.innerHTML =
            '<div class="onboard-modal__head">' +
                '<div class="onboard-modal__progress">' + progressDots() + '</div>' +
                '<span class="onboard-modal__step-tag">Step ' + (currentStep + 1) + ' of ' + STEPS.length + ' · ' + step.label + '</span>' +
                '<h2 class="onboard-modal__title">' + step.title + '</h2>' +
                '<p class="onboard-modal__subtitle">' + step.desc + '</p>' +
            '</div>' +
            '<div class="onboard-modal__body">' + bodyHtml + '</div>' +
            '<div class="onboard-modal__foot">' +
                '<button type="button" class="onboard-btn onboard-btn--ghost" data-onboard-skip>Skip this step</button>' +
                '<div class="onboard-modal__foot-actions">' +
                    (currentStep > 0 ? '<button type="button" class="onboard-btn" data-onboard-back>Back</button>' : '') +
                    '<button type="button" class="onboard-btn onboard-btn--primary" data-onboard-next>' + (currentStep === STEPS.length - 1 ? 'Finish' : 'Continue') + '</button>' +
                '</div>' +
            '</div>';
    }

    function open() {
        if (!overlayEl) overlayEl = buildOverlay();
        currentStep = 0;
        renderStep();
        overlayEl.classList.add('open');
    }
    function close() {
        if (!overlayEl) return;
        overlayEl.classList.remove('open');
    }

    function next() {
        if (currentStep < STEPS.length) {
            currentStep++;
            renderStep();
        }
    }
    function back() {
        if (currentStep > 0) {
            currentStep--;
            renderStep();
        }
    }
    function skip() {
        const step = STEPS[currentStep];
        state.selections[step.id] = 'skip';
        writeState(state);
        next();
    }

    function pick(value) {
        const step = STEPS[currentStep];
        state.selections[step.id] = value;
        writeState(state);
        // Auto-advance after a small delay so the user sees the selection
        setTimeout(next, 250);
    }

    function captureAccountingFields() {
        if (!overlayEl) return;
        const fields = overlayEl.querySelectorAll('[data-onboard-input]');
        const acc = {};
        fields.forEach(function(el) {
            const k = el.dataset.onboardInput;
            if (el.type === 'checkbox') acc[k] = !!el.checked;
            else acc[k] = el.value;
        });
        state.selections.accounting = acc;
        writeState(state);
    }

    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-open-onboarding]')) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            open();
            return;
        }
        if (!overlayEl) return;
        const pickEl = e.target.closest('[data-onboard-pick]');
        if (pickEl) { pick(pickEl.dataset.onboardPick); return; }
        if (e.target.closest('[data-onboard-skip]')) { skip(); return; }
        if (e.target.closest('[data-onboard-back]')) { back(); return; }
        if (e.target.closest('[data-onboard-next]')) {
            const step = STEPS[currentStep];
            if (step && step.id === 'accounting') captureAccountingFields();
            next();
            return;
        }
        if (e.target.closest('[data-onboard-finish]')) {
            state.completed = true;
            writeState(state);
            close();
            return;
        }
        if (e.target === overlayEl) close();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlayEl && overlayEl.classList.contains('open')) close();
    });

    // Auto-open on first ever visit (when state.completed is false and
    // no selections exist). Only on the overview page since that's where
    // the trigger lives — avoids hijacking other pages.
    if (!state.completed && Object.keys(state.selections).length === 0) {
        // Tiny delay so the page paints first
        setTimeout(function() {
            if (document.querySelector('[data-open-onboarding]')) open();
        }, 600);
    }
})();

// ============================================================
// A&R / Team-invite — auto-bind by email domain
// ============================================================
// Manager / label admins invite team members; the email domain auto-
// detects which company the person should bind to (Universal Music,
// DR P3, KODA, etc.). PDF concept: "A&R profiles have to be connected
// to a label — could be done by recognising the last part of the mail."
(function() {
    const modal = document.getElementById('inviteTeamModal');
    if (!modal) return;

    // Known label / PRO / radio / management domains. Real install would
    // pull this from the platform's verified-organisation registry.
    const DOMAIN_REGISTRY = {
        // Major labels
        'universalmusic.com':   { name: 'Universal Music',  type: 'Major label',     color: '#1428A0', initials: 'UM' },
        'umusic.com':           { name: 'Universal Music',  type: 'Major label',     color: '#1428A0', initials: 'UM' },
        'sonymusic.com':        { name: 'Sony Music',       type: 'Major label',     color: '#000000', initials: 'SO' },
        'sony.com':             { name: 'Sony Music',       type: 'Major label',     color: '#000000', initials: 'SO' },
        'wmg.com':              { name: 'Warner Music',     type: 'Major label',     color: '#0066CC', initials: 'WM' },
        'warnermusic.com':      { name: 'Warner Music',     type: 'Major label',     color: '#0066CC', initials: 'WM' },
        // Indie labels
        'tomorrowrecords.com':  { name: 'Tomorrow Records', type: 'Indie label',     color: '#FF8AC8', initials: 'TR' },
        'cph-records.dk':       { name: 'CPH Records',      type: 'Indie label',     color: '#43C47A', initials: 'CR' },
        'mind-records.com':     { name: 'Mind Records',     type: 'Indie label',     color: '#A370F0', initials: 'MR' },
        // Danish radio (PDF examples)
        'drp3.com':             { name: 'DR P3',            type: 'Radio host',      color: '#E62864', initials: 'P3' },
        'dr.dk':                { name: 'DR (Danmarks Radio)', type: 'Public broadcaster', color: '#E62864', initials: 'DR' },
        'nrj.dk':               { name: 'NRJ',              type: 'Radio host',      color: '#000000', initials: 'NJ' },
        'radiohappy.dk':        { name: 'Radio Happy',      type: 'Radio host',      color: '#FFB547', initials: 'RH' },
        // PROs
        'koda.dk':              { name: 'KODA',             type: 'PRO',             color: '#0E5C2F', initials: 'KO' },
        'gramex.dk':            { name: 'Gramex',           type: 'PRO',             color: '#43C47A', initials: 'GX' },
        'performex.dk':         { name: 'Performex',        type: 'PRO',             color: '#7DD3C0', initials: 'PX' },
        // Sponsors / brands
        'redbull.com':          { name: 'Red Bull',         type: 'Sponsor / brand', color: '#DA291C', initials: 'RB' },
        'spotify.com':          { name: 'Spotify',          type: 'Streaming partner', color: '#1DB954', initials: 'SP' },
        // Festivals / venues
        'roskilde-festival.dk': { name: 'Roskilde Festival', type: 'Festival',       color: '#DC4A1B', initials: 'RF' },
        'vega.dk':              { name: 'VEGA',             type: 'Venue',           color: '#FF6A55', initials: 'VE' },
        'rust.dk':              { name: 'RUST',             type: 'Venue',           color: '#A370F0', initials: 'RU' }
    };

    const emailEl   = document.getElementById('inviteEmail');
    const banner    = document.getElementById('inviteAutoBindBanner');
    const roleEl    = document.getElementById('inviteRole');
    const messageEl = document.getElementById('inviteMessage');

    function detectOrg(email) {
        const m = String(email || '').toLowerCase().match(/@([^@\s]+)$/);
        if (!m) return null;
        return DOMAIN_REGISTRY[m[1]] || null;
    }

    const escapeHtml = SC.escapeHtml;

    function renderBanner() {
        const org = detectOrg(emailEl ? emailEl.value : '');
        if (!org) {
            // Show "no match" hint only after they've typed something
            const hasAt = emailEl && emailEl.value.indexOf('@') >= 0;
            if (!hasAt) {
                banner.hidden = true;
                banner.className = '';
                banner.innerHTML = '';
                return;
            }
            banner.hidden = false;
            banner.className = 'auto-banner auto-banner--neutral';
            banner.innerHTML = 'Domænet er ikke knyttet til en kendt organisation. Personen oprettes som <strong>independent</strong> A&amp;R uden auto-bind. Kan tilknyttes manuelt senere.';
            return;
        }

        banner.hidden = false;
        banner.className = 'auto-banner auto-banner--success';
        banner.innerHTML =
            '<div class="auto-banner__org">' +
                '<div class="auto-banner__org-logo" style="background:' + org.color + ';">' + escapeHtml(org.initials) + '</div>' +
                '<div class="auto-banner__org-main">' +
                    '<div class="auto-banner__head" style="margin-bottom:4px;">' +
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="5 12 10 17 19 7" stroke="#43C47A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                        '<strong class="auto-banner__tag">Auto-bound</strong>' +
                    '</div>' +
                    '<div class="auto-banner__org-name">' + escapeHtml(org.name) + '</div>' +
                    '<div class="auto-banner__org-type">' + escapeHtml(org.type) + ' · domain match</div>' +
                '</div>' +
            '</div>';
    }

    function open() {
        if (emailEl)   emailEl.value = '';
        if (roleEl)    roleEl.value = 'ar';
        if (messageEl) messageEl.value = '';
        renderBanner();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function close() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-open-invite-team]')) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            open();
            return;
        }
    });

    modal.addEventListener('click', function(e) {
        if (e.target.closest('[data-close-invite]')) { close(); return; }
        if (e.target.closest('[data-invite-confirm]')) {
            if (!emailEl.value) { emailEl.focus(); return; }
            const org = detectOrg(emailEl.value);
            const orgMsg = org ? ' og auto-bundet til ' + org.name : ' (no auto-bind — independent A&R)';
            alert('Invitation sendt til ' + emailEl.value + orgMsg + '. Når personen accepterer, oprettes deres profil med de rette rettigheder.');
            close();
            return;
        }
        if (e.target === modal) close();
    });

    if (emailEl) emailEl.addEventListener('input', renderBanner);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
})();

// ============================================================
// Venue map + Friend finder
// ============================================================
// Click "Open venue map" on a concert ticket → fullscreen modal with
// an SVG-based festival/venue layout: stages, food trucks, exits,
// first-aid, toilets, security, and friend positions color-coded by
// entourage. PDF concept — supports tent marking, hide-my-location,
// and a roster side-panel for entourage members.
(function() {
    const modal = document.getElementById('venueMapModal');
    if (!modal) return;

    const canvas    = modal.querySelector('[data-vm-canvas]');
    const titleEl   = modal.querySelector('[data-vm-title]');
    const metaEl    = modal.querySelector('[data-vm-meta]');
    const rosterEl  = modal.querySelector('[data-vm-roster]');
    const toggles   = modal.querySelectorAll('[data-vm-toggle]');

    const escapeHtml = SC.escapeHtml;
    const escapeAttr = SC.escapeAttr;

    // ---- Mock venue layouts ----
    // Each venue has stages, fixed amenities, tent-zone, friends.
    // Coordinates use the 1000×600 viewBox.
    const VENUES = {
        'vega': {
            title: 'VEGA · Hovedscenen',
            meta: 'VEGA · Jokes On Me Tour · 14 Aug 2026',
            stages: [
                { x: 380, y: 50, w: 240, h: 70, label: 'Main stage' }
            ],
            tents: [],
            tentZone: null,
            paths: [
                'M 100 350 Q 500 380 900 350'   // central walkway
            ],
            foodtrucks: [
                { x: 200, y: 250, label: 'Bar' },
                { x: 800, y: 250, label: 'Bar' }
            ],
            toilets: [
                { x: 120, y: 480, label: 'WC' },
                { x: 880, y: 480, label: 'WC' }
            ],
            firstaid: [
                { x: 880, y: 130, label: '+' }
            ],
            security: [
                { x: 480, y: 540, label: 'S' },
                { x: 520, y: 540, label: 'S' }
            ],
            exits: [
                { x: 50, y: 540, label: 'Exit 1' },
                { x: 950, y: 540, label: 'Exit 2' },
                { x: 500, y: 30, label: 'Stage exit' }
            ],
            entourages: [
                {
                    name: 'Brooklyn Crew',
                    color: '#FF6A55',
                    members: [
                        { name: 'Julie', isSelf: true, x: 480, y: 380, hidden: false },
                        { name: 'Sofia', x: 510, y: 360, hidden: false },
                        { name: 'Mads',  x: 460, y: 400, hidden: false },
                        { name: 'Liva',  x: 530, y: 380, hidden: true }
                    ]
                },
                {
                    name: 'Comedy Connoisseurs',
                    color: '#A370F0',
                    members: [
                        { name: 'Joakim', x: 280, y: 250, hidden: false },
                        { name: 'Matt',   x: 720, y: 280, hidden: false }
                    ]
                }
            ]
        },
        'roskilde': {
            title: 'Roskilde Festival 2026',
            meta: 'Roskilde · 27 Jun - 5 Jul · main weekend',
            stages: [
                { x: 50,  y: 50,  w: 220, h: 70, label: 'Orange Stage' },
                { x: 400, y: 50,  w: 220, h: 70, label: 'Apollo' },
                { x: 750, y: 50,  w: 220, h: 70, label: 'Pavilion' },
                { x: 200, y: 280, w: 180, h: 60, label: 'Avalon' },
                { x: 620, y: 280, w: 180, h: 60, label: 'Arena' }
            ],
            tents: [],
            tentZone: { x: 80, y: 420, w: 380, h: 140 },
            paths: [
                'M 60 200 Q 500 220 940 200',
                'M 60 380 Q 500 400 940 380'
            ],
            foodtrucks: [
                { x: 320, y: 200, label: 'Bao' },
                { x: 480, y: 200, label: 'Pizza' },
                { x: 640, y: 200, label: 'Vegan' },
                { x: 100, y: 200, label: 'Coffee' },
                { x: 880, y: 200, label: 'Burger' },
                { x: 540, y: 380, label: 'Tacos' }
            ],
            toilets: [
                { x: 250, y: 200, label: 'WC' },
                { x: 550, y: 200, label: 'WC' },
                { x: 760, y: 380, label: 'WC' },
                { x: 240, y: 510, label: 'WC' },
                { x: 380, y: 380, label: 'WC' }
            ],
            firstaid: [
                { x: 480, y: 380, label: '+' },
                { x: 880, y: 380, label: '+' },
                { x: 60,  y: 510, label: '+' }
            ],
            security: [
                { x: 510, y: 380, label: 'S' },
                { x: 540, y: 380, label: 'S' },
                { x: 60, y: 380, label: 'S' },
                { x: 940, y: 380, label: 'S' }
            ],
            exits: [
                { x: 30,  y: 200, label: 'Gate 1' },
                { x: 970, y: 200, label: 'Gate 2' },
                { x: 30,  y: 380, label: 'Gate 3' },
                { x: 970, y: 380, label: 'Gate 4' },
                { x: 500, y: 580, label: 'Camp gate' }
            ],
            entourages: [
                {
                    name: 'Brooklyn Crew',
                    color: '#FF6A55',
                    members: [
                        { name: 'Julie', isSelf: true, x: 480, y: 230, hidden: false },
                        { name: 'Sofia', x: 320, y: 480, hidden: false, atTent: true },
                        { name: 'Mads',  x: 200, y: 220, hidden: false },
                        { name: 'Liva',  x: 200, y: 460, hidden: true,  atTent: true }
                    ]
                },
                {
                    name: 'Comedy Connoisseurs',
                    color: '#A370F0',
                    members: [
                        { name: 'Joakim', x: 700, y: 200, hidden: false },
                        { name: 'Matt',   x: 880, y: 320, hidden: false }
                    ]
                },
                {
                    name: 'Synthwave Crew',
                    color: '#7DD3C0',
                    members: [
                        { name: 'Tara',  x: 540, y: 320, hidden: false },
                        { name: 'Anchi', x: 660, y: 220, hidden: false }
                    ]
                }
            ]
        }
    };

    let activeVenueKey = null;
    let invisibleMode = false;
    let activeVenue = null;

    function buildIcon(group, items, cls, labelCls, labelOffset) {
        return '<g class="' + group + '">' + items.map(function(it) {
            const lbl = labelCls ? '<text class="' + labelCls + '" x="' + it.x + '" y="' + (it.y + (labelOffset || 18)) + '">' + escapeHtml(it.label) + '</text>' : '';
            return '<g><circle class="' + cls + '" cx="' + it.x + '" cy="' + it.y + '" r="9"/>' +
                   '<text class="vm-icon-label" x="' + it.x + '" y="' + (it.y + 3) + '">' + escapeHtml(it.label.charAt(0)) + '</text>' +
                   lbl +
                   '</g>';
        }).join('') + '</g>';
    }

    function buildExits(items) {
        return '<g class="vm-exits-group">' + items.map(function(it) {
            return '<g><rect class="vm-exit" x="' + (it.x - 18) + '" y="' + (it.y - 8) + '" width="36" height="16" rx="2"/>' +
                   '<text class="vm-icon-label" style="fill:#0a0a0a;" x="' + it.x + '" y="' + (it.y + 3) + '">' + escapeHtml(it.label.split(' ')[0]) + '</text>' +
                   '</g>';
        }).join('') + '</g>';
    }

    function buildStages(items) {
        return items.map(function(s) {
            return '<g class="vm-stage-group">' +
                '<rect class="vm-stage" x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" rx="8"/>' +
                '<text class="vm-stage-label" x="' + (s.x + s.w / 2) + '" y="' + (s.y + s.h / 2 + 5) + '">' + escapeHtml(s.label) + '</text>' +
            '</g>';
        }).join('');
    }

    function buildTentZone(zone, members) {
        if (!zone) return '';
        // Draw the dashed area + a few tent triangles for atmosphere
        let tents = '';
        for (let i = 0; i < 6; i++) {
            const tx = zone.x + 30 + (i % 3) * 110;
            const ty = zone.y + 20 + Math.floor(i / 3) * 60;
            tents += '<polygon class="vm-tent" points="' + tx + ',' + (ty + 28) + ' ' + (tx + 18) + ',' + ty + ' ' + (tx + 36) + ',' + (ty + 28) + '"/>';
        }
        // Highlight friends' tents — pulsing dot tied to atTent positions
        const tentStars = (members || []).map(function(m) {
            if (!m.atTent) return '';
            return '<circle cx="' + m.x + '" cy="' + (m.y - 6) + '" r="3" fill="' + (m.color || '#FFFFFF') + '"/>';
        }).join('');
        return '<g class="vm-tents-group">' +
            '<rect class="vm-tent-area" x="' + zone.x + '" y="' + zone.y + '" width="' + zone.w + '" height="' + zone.h + '" rx="6"/>' +
            '<text class="vm-tent-area-label" x="' + (zone.x + zone.w / 2) + '" y="' + (zone.y - 8) + '">Tent zone</text>' +
            tents + tentStars +
        '</g>';
    }

    function buildFriends(entourages) {
        return '<g class="vm-friends-group">' + entourages.map(function(group) {
            return group.members.map(function(m) {
                if (m.hidden) {
                    // Hidden member — show subtle ghost dot
                    return '<g class="vm-friend" data-vm-friend="' + escapeAttr(m.name) + '" style="color:' + group.color + ';opacity:0.35;">' +
                        '<circle class="vm-friend__dot" cx="' + m.x + '" cy="' + m.y + '" r="5" stroke-dasharray="2 2" stroke="' + group.color + '" fill="rgba(0,0,0,0.4)"/>' +
                        '<text class="vm-friend__label" x="' + m.x + '" y="' + (m.y - 11) + '">' + escapeHtml(m.name) + ' (hidden)</text>' +
                    '</g>';
                }
                if (m.isSelf) {
                    // "You are here" marker
                    return '<g class="vm-friend vm-you" data-vm-friend="' + escapeAttr(m.name) + '">' +
                        '<circle class="vm-friend__halo" cx="' + m.x + '" cy="' + m.y + '" r="14" style="transform-origin:' + m.x + 'px ' + m.y + 'px;color:#4A90E2;"/>' +
                        '<circle class="vm-friend__dot" cx="' + m.x + '" cy="' + m.y + '" r="8"/>' +
                        '<text class="vm-you-label" x="' + m.x + '" y="' + (m.y - 14) + '">You · ' + escapeHtml(m.name) + '</text>' +
                    '</g>';
                }
                return '<g class="vm-friend" data-vm-friend="' + escapeAttr(m.name) + '" style="color:' + group.color + ';">' +
                    '<circle class="vm-friend__halo" cx="' + m.x + '" cy="' + m.y + '" r="11" style="transform-origin:' + m.x + 'px ' + m.y + 'px;"/>' +
                    '<circle class="vm-friend__dot" cx="' + m.x + '" cy="' + m.y + '" r="6"/>' +
                    '<text class="vm-friend__label" x="' + m.x + '" y="' + (m.y - 11) + '">' + escapeHtml(m.name) + '</text>' +
                '</g>';
            }).join('');
        }).join('') + '</g>';
    }

    function renderMap(venue) {
        const paths = (venue.paths || []).map(function(d) {
            return '<path class="vm-path" d="' + d + '"/>';
        }).join('');
        const exits = buildExits(venue.exits || []);
        canvas.innerHTML =
            '<rect class="vm-ground" x="0" y="0" width="1000" height="600"/>' +
            '<rect class="vm-grass" x="20" y="20" width="960" height="560" rx="14"/>' +
            paths +
            buildStages(venue.stages || []) +
            buildTentZone(venue.tentZone, flattenMembers(venue.entourages)) +
            buildIcon('vm-foodtruck-group', venue.foodtrucks || [], 'vm-foodtruck', null) +
            buildIcon('vm-toilet-group', venue.toilets || [], 'vm-toilet', null) +
            buildIcon('vm-firstaid-group', venue.firstaid || [], 'vm-firstaid', null) +
            buildIcon('vm-security-group', venue.security || [], 'vm-security', null) +
            exits +
            buildFriends(venue.entourages || []);
    }

    function flattenMembers(entourages) {
        const all = [];
        (entourages || []).forEach(function(g) {
            (g.members || []).forEach(function(m) {
                all.push(Object.assign({ color: g.color }, m));
            });
        });
        return all;
    }

    function renderRoster(venue) {
        rosterEl.innerHTML = (venue.entourages || []).map(function(group) {
            const members = (group.members || []).map(function(m) {
                const status = m.isSelf ? (invisibleMode ? '<span class="venue-map__roster-status venue-map__roster-status--hidden">You · invisible</span>' : '<span class="venue-map__roster-status">You · visible</span>')
                    : (m.hidden ? '<span class="venue-map__roster-status venue-map__roster-status--hidden">Hidden</span>' : '<span class="venue-map__roster-status">' + (m.atTent ? 'At tent' : 'On site') + '</span>');
                const avatarBg = 'background:' + group.color + ';display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:#FFFFFF;';
                return '<div class="venue-map__roster-member' + (m.isSelf ? ' is-self' : '') + '" data-vm-focus="' + escapeAttr(m.name) + '" data-help="' + escapeAttr(m.isSelf ? 'Du selv' : (m.name + ' i ' + group.name + (m.hidden ? ' — har skjult sin position' : ' — synlig på kortet'))) + '">' +
                    '<span class="venue-map__roster-avatar" style="' + avatarBg + '">' + escapeHtml(m.name.charAt(0)) + '</span>' +
                    '<span class="venue-map__roster-name">' + escapeHtml(m.name) + '</span>' +
                    status +
                '</div>';
            }).join('');
            return '<div class="venue-map__entourage" data-help="Entourage: ' + escapeHtml(group.name) + '. Hver entourage får sin egen farve på kortet — så du nemt kan se hvilken gruppe en ven tilhører.">' +
                '<div class="venue-map__entourage-name"><span class="venue-map__entourage-color" style="background:' + group.color + ';"></span>' + escapeHtml(group.name) + '</div>' +
                members +
            '</div>';
        }).join('');
    }

    function applyToggleClasses() {
        const map = {
            friends: 'show-friends',
            foodtrucks: 'show-foodtrucks',
            toilets: 'show-toilets',
            firstaid: 'show-firstaid',
            security: 'show-security',
            tents: 'show-tents'
        };
        toggles.forEach(function(btn) {
            const k = btn.dataset.vmToggle;
            if (k === 'invisible') return;
            const cls = map[k];
            if (!cls) return;
            if (btn.classList.contains('is-on')) canvas.classList.add(cls);
            else canvas.classList.remove(cls);
        });
        canvas.classList.toggle('is-invisible', invisibleMode);
    }

    function open(venueKey) {
        activeVenueKey = venueKey;
        const venue = VENUES[venueKey] || VENUES['vega'];
        activeVenue = venue;
        if (titleEl) titleEl.textContent = venue.title;
        if (metaEl) metaEl.textContent = venue.meta;
        renderMap(venue);
        renderRoster(venue);
        applyToggleClasses();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function close() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    document.addEventListener('click', function(e) {
        const trigger = e.target.closest('[data-open-venue-map]');
        if (trigger) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.preventDefault();
            open(trigger.dataset.openVenueMap || 'vega');
            return;
        }
    });

    modal.addEventListener('click', function(e) {
        if (e.target.closest('[data-close-venue-map]')) { close(); return; }
        const tog = e.target.closest('[data-vm-toggle]');
        if (tog) {
            const k = tog.dataset.vmToggle;
            if (k === 'invisible') {
                invisibleMode = !invisibleMode;
                tog.classList.toggle('is-on', invisibleMode);
                applyToggleClasses();
                if (activeVenue) renderRoster(activeVenue);
            } else {
                tog.classList.toggle('is-on');
                applyToggleClasses();
            }
            return;
        }
        const focus = e.target.closest('[data-vm-focus]');
        if (focus && activeVenue) {
            // Highlight the matching friend dot briefly with a temporary halo grow
            const name = focus.dataset.vmFocus;
            const dot = canvas.querySelector('[data-vm-friend="' + name + '"] .vm-friend__halo');
            if (dot) {
                dot.style.transition = 'transform 0.4s ease';
                dot.style.transform = 'scale(2.4)';
                setTimeout(function() { dot.style.transform = ''; }, 700);
            }
            return;
        }
        if (e.target === modal) close();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
})();

// ============================================================
// Instrument Exchange — sell, buy with serial verification, savings goals, donations
// ============================================================
// User-requested feature:
// 1. Marketplace for selling/buying physical instruments. Buy flow
//    requires the buyer to enter the serial number, which is verified
//    against the listing.
// 2. Savings goals — anyone can save up for a specific instrument and
//    other users can donate small amounts ("give it forward").
(function() {
    const escapeHtml = SC.escapeHtml;

    // ---------- Tab switcher (For sale / Savings goals) ----------
    document.querySelectorAll('.instruments').forEach(function(section) {
        const tabs = section.querySelectorAll('[data-instr-tab]');
        const panels = section.querySelectorAll('[data-instr-panel]');
        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                const which = tab.dataset.instrTab;
                tabs.forEach(function(t) { t.classList.toggle('is-active', t.dataset.instrTab === which); });
                panels.forEach(function(p) { p.hidden = p.dataset.instrPanel !== which; });
            });
        });
    });

    // ---------- List instrument modal ----------
    (function() {
        const modal = document.getElementById('listInstrumentModal');
        if (!modal) return;
        function open() { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
        function close() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
        document.addEventListener('click', function(e) {
            if (e.target.closest('[data-open-list-instrument]')) {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                e.preventDefault();
                open();
                return;
            }
        });
        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-list-instr]')) { close(); return; }
            if (e.target.closest('[data-list-instr-submit]')) {
                alert('Listing publiceret ✓ — STAGECORD verificerer serial-nummeret med brand-databasen og publicerer i Instrument Exchange. Du får besked når en køber sender købstilbud.');
                close();
                return;
            }
            if (e.target === modal) close();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) close();
        });
    })();

    // ---------- Buy instrument modal (with serial verification) ----------
    (function() {
        const modal = document.getElementById('buyInstrumentModal');
        if (!modal) return;
        const itemEl   = modal.querySelector('[data-buy-item]');
        const priceEl  = modal.querySelector('[data-buy-price]');
        const serialIn = modal.querySelector('[data-buy-serial-input]');
        const verifyEl = modal.querySelector('[data-buy-verify]');
        let expectedSerial = '';

        function fmt$(n) { return Number(n).toLocaleString('en-US') + ' DKK'; }

        function open(item, serial, price) {
            expectedSerial = serial;
            itemEl.value = item;
            priceEl.value = fmt$(price);
            serialIn.value = '';
            verifyEl.hidden = true;
            verifyEl.innerHTML = '';
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }
        function close() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }

        function verify() {
            const entered = (serialIn.value || '').trim().toUpperCase();
            const expected = (expectedSerial || '').trim().toUpperCase();
            if (!entered) {
                verifyEl.hidden = true;
                return null;
            }
            if (entered === expected) {
                verifyEl.hidden = false;
                verifyEl.classList.remove('instr-form__verify--fail');
                verifyEl.innerHTML = '<span class="instr-form__verify-icon">✓</span><div><strong>Serial verified</strong> — match med sælgerens listing. Klar til at gennemføre købet.</div>';
                return true;
            }
            verifyEl.hidden = false;
            verifyEl.classList.add('instr-form__verify--fail');
            verifyEl.innerHTML = '<span class="instr-form__verify-icon">⚠</span><div><strong>Serial mismatch</strong> — det indtastede nummer matcher ikke sælgerens listing. Tjek igen — pas på fake listings.</div>';
            return false;
        }

        document.addEventListener('click', function(e) {
            const trigger = e.target.closest('[data-open-buy-instrument]');
            if (trigger) {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                e.preventDefault();
                open(trigger.dataset.instrName, trigger.dataset.instrSerial, trigger.dataset.instrPrice);
                return;
            }
        });

        if (serialIn) serialIn.addEventListener('input', verify);

        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-buy-instr]')) { close(); return; }
            if (e.target.closest('[data-buy-instr-confirm]')) {
                const ok = verify();
                if (ok === null) { serialIn.focus(); return; }
                if (ok === false) { return; }
                alert('Køb gennemført ✓ — Pengene er holdt i escrow indtil du modtager instrumentet og bekræfter modtagelse. Sælger får besked og pakker det.');
                close();
                return;
            }
            if (e.target === modal) close();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) close();
        });
    })();

    // ---------- Create savings goal modal ----------
    (function() {
        const modal = document.getElementById('createGoalModal');
        if (!modal) return;
        const targetIn  = modal.querySelector('[data-goal-target]');
        const amountIn  = modal.querySelector('[data-goal-amount]');
        const msgIn     = modal.querySelector('[data-goal-msg]');

        function open(prefillTarget, prefillAmount) {
            targetIn.value = prefillTarget || '';
            amountIn.value = prefillAmount || '';
            msgIn.value = '';
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }
        function close() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }

        document.addEventListener('click', function(e) {
            if (e.target.closest('[data-open-create-goal]')) {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                e.preventDefault();
                open();
                return;
            }
            // Quick "+ Goal" from instrument cards pre-fills target + amount
            const presetGoal = e.target.closest('[data-instr-target]');
            if (presetGoal && !presetGoal.dataset.openBuyInstrument) {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                e.preventDefault();
                open(presetGoal.dataset.instrTarget, presetGoal.dataset.instrPrice);
                return;
            }
        });

        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-create-goal]')) { close(); return; }
            if (e.target.closest('[data-create-goal-submit]')) {
                if (!targetIn.value.trim()) { targetIn.focus(); return; }
                if (!amountIn.value || parseInt(amountIn.value, 10) < 100) { amountIn.focus(); return; }
                alert('Savings goal oprettet ✓ — Det er nu synligt på din profil og i Instrument Exchange under Savings goals. Andre brugere kan donere small beløb (give it forward) til at hjælpe dig nå målet.');
                close();
                return;
            }
            if (e.target === modal) close();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) close();
        });
    })();

    // ---------- Donate modal — give it forward ----------
    (function() {
        const modal = document.getElementById('donateModal');
        if (!modal) return;
        const titleEl    = modal.querySelector('[data-donate-title]');
        const recipientEl = modal.querySelector('[data-donate-recipient]');
        const instrLabelEl = modal.querySelector('[data-donate-instrument-label]');
        const amounts   = modal.querySelectorAll('[data-donate-amt]');
        const customIn  = modal.querySelector('[data-donate-custom]');
        const msgIn     = modal.querySelector('[data-donate-msg]');
        const totalEl   = modal.querySelector('[data-donate-total]');
        let currentAmount = 25;

        function fmt$(n) { return Number(n).toLocaleString('en-US') + ' DKK'; }

        function setAmount(n, fromQuick) {
            currentAmount = Math.max(0, parseInt(n, 10) || 0);
            totalEl.textContent = fmt$(currentAmount);
            // Update preset selection
            amounts.forEach(function(b) {
                b.classList.toggle('is-selected', fromQuick && parseInt(b.dataset.donateAmt, 10) === currentAmount);
            });
            if (!fromQuick) {
                amounts.forEach(function(b) { b.classList.remove('is-selected'); });
            }
        }

        function open(recipient, instrument) {
            titleEl.textContent = 'Donate · ' + recipient + '\'s ' + instrument;
            recipientEl.textContent = recipient;
            instrLabelEl.textContent = recipient + '\'s ' + instrument;
            customIn.value = '';
            msgIn.value = '';
            setAmount(25, true);
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
        }
        function close() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }

        document.addEventListener('click', function(e) {
            const trigger = e.target.closest('[data-open-donate]');
            if (trigger) {
                if (typeof helpActive !== 'undefined' && helpActive) return;
                e.preventDefault();
                open(trigger.dataset.donateTo || 'Friend', trigger.dataset.donateInstrument || 'instrument');
                return;
            }
        });

        modal.addEventListener('click', function(e) {
            if (e.target.closest('[data-close-donate]')) { close(); return; }
            const amt = e.target.closest('[data-donate-amt]');
            if (amt) {
                customIn.value = '';
                setAmount(amt.dataset.donateAmt, true);
                return;
            }
            if (e.target.closest('[data-donate-confirm]')) {
                if (currentAmount < 1) { customIn.focus(); return; }
                alert('Tak for din donation på ' + fmt$(currentAmount) + ' ✓ — Beløbet er overført direkte til mottagerens opsparingsmål. Du er nu listet som supporter på deres goal-kort. Give it forward!');
                close();
                return;
            }
            if (e.target === modal) close();
        });

        if (customIn) customIn.addEventListener('input', function() {
            if (customIn.value) setAmount(customIn.value, false);
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) close();
        });
    })();
})();
