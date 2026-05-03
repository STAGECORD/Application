// STAGECORD PRO — Stage project cards click handlers (used on /licensor/, /sponsor/)
// Card selection + tab interactivity for the wide horizontal Stage cards.

// ============================================================
// Stage project cards — selection + tab interactivity
// ============================================================
// Used by /licensor/, /sponsor/, /manager/ portfolio pages.
// Click a card → toggle is-active across the list (only one active
// at a time). Click a tab inside a card → swap is-active among the
// tabs in that card. Tab content is placeholder until fase 4.
(function() {
    document.addEventListener('click', function(e) {
        const tab = e.target.closest('.stage-project-card__tab');
        if (tab) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.stopPropagation();
            const card = tab.closest('.stage-project-card');
            if (!card) return;
            card.querySelectorAll('.stage-project-card__tab').forEach(function(t) {
                t.classList.toggle('is-active', t === tab);
            });
            return;
        }

        const card = e.target.closest('.stage-project-card');
        if (card && !e.target.closest('.stage-action-btn')) {
            const list = card.parentElement;
            if (!list) return;
            list.querySelectorAll('.stage-project-card.is-active').forEach(function(c) {
                if (c !== card) c.classList.remove('is-active');
            });
            card.classList.add('is-active');

            // Move the team row (if any) to sit directly after the active card
            const teamRow = list.querySelector('[data-stage-team]');
            if (teamRow) {
                card.insertAdjacentElement('afterend', teamRow);
                teamRow.classList.remove('is-hidden');
            }
        }
    });
})();
