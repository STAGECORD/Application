// STAGECORD PRO — topbar Stage badge
// Two-line "FILMING / STAGE" style label injected into the topbar when the
// current mode is Filming/Brand/Label Stage admin. Hidden for other modes.

// ============================================================
// Stage badge — two-line label in topbar showing active Stage
// ============================================================
// When the current Viewing-as mode is one of the Stage admin types
// (Filming/Brand/Label), inject a "FILMING / STAGE"-style label into
// the topbar (between bell+inbox+QR and help). Hidden for artist/fan/
// venue modes since they have their own header conventions or none.
(function() {
    const STAGE_BADGES = {
        filming: { primary: 'FILMING', secondary: 'STAGE' },
        brand:   { primary: 'BRAND',   secondary: 'STAGE' },
        label:   { primary: 'LABEL',   secondary: 'STAGE' }
    };

    function currentStageKey() {
        try {
            const mode = localStorage.getItem('stagecord:userMode');
            const map = { manager: 'label', sponsor: 'brand', licensor: 'filming' };
            return map[mode] || null;
        } catch (e) { return null; }
    }

    document.addEventListener('DOMContentLoaded', function() {
        const helpBtn = document.querySelector('.topbar .help-button');
        if (!helpBtn) return;
        // If a page hardcodes its own stage label (e.g. pitch/index.html with
        // "VENUE / STAGE"), leave it alone — that's an intentional override.
        if (document.querySelector('.topbar .topbar-stage-label, .topbar-stage-label')) return;

        const key = currentStageKey();
        if (!key || !STAGE_BADGES[key]) return;

        const badge = STAGE_BADGES[key];
        const span = document.createElement('span');
        span.className = 'topbar-stage-label';
        span.innerHTML =
            '<span class="topbar-stage-label__primary">' + badge.primary + '</span>' +
            '<span class="topbar-stage-label__secondary">' + badge.secondary + '</span>';
        // Insert before the help button — bell/inbox/QR also insertBefore help,
        // so they end up sandwiched between the stage label and help.
        helpBtn.parentNode.insertBefore(span, helpBtn);
    });
})();
