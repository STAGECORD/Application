// STAGECORD PRO — acting-as service (cross-page state)
// A&R/Manager impersonating an artist they're assigned to. State lives in
// localStorage so it survives navigation; the artist page reads it and
// shows a banner indicator.

// ============================================================
// Acting-as service — A&R/Manager impersonating an artist
// ============================================================
// Label staff can act on behalf of artists they're assigned to. This
// stores the impersonation state in localStorage so it persists across
// page navigation. The artist page reads it and shows a banner; any
// actions performed in this state get attributed to the actor (visible
// only to the artist owner, not to the public).
window.SC.actAs = (function() {
    const KEY = 'stagecord:actingAs';
    return {
        set: function(state) {
            try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
        },
        get: function() {
            try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
        },
        clear: function() {
            try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
        }
    };
})();

// Global click delegation for [data-act-as] links — used on /ar/ and any
// other page where we want a static <a> to set acting-as state before
// navigation. We register at capture phase to run before any handler that
// might preventDefault, then explicitly navigate so the link is reliable
// regardless of what bubble-phase handlers do.
document.addEventListener('click', function(e) {
    const link = e.target.closest('[data-act-as]');
    if (!link) return;
    if (typeof helpActive !== 'undefined' && helpActive) return;
    window.SC.actAs.set({
        actorId: link.getAttribute('data-actor-id'),
        actorRole: link.getAttribute('data-actor-role'),
        actorName: link.getAttribute('data-actor-name'),
        actorAvatar: link.getAttribute('data-actor-avatar') || '',
        subjectId: link.getAttribute('data-subject-id'),
        subjectName: link.getAttribute('data-subject-name'),
        startedAt: new Date().toISOString()
    });
    // Explicit navigation — guarantees we land on the linked page even if
    // another handler later calls preventDefault on the same click.
    if (link.tagName === 'A') {
        const href = link.getAttribute('href');
        if (href && href !== '#' && !link.hasAttribute('target')) {
            e.preventDefault();
            window.location.href = link.href;
        }
    }
}, true);
