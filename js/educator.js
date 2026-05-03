// STAGECORD PRO — Educator profile interactions
// Builds the 14-day availability calendar, handles "Book lesson" CTA,
// and shared logic for the educator pages (bookings, students, materials).
(function() {
    if (window.location.pathname.indexOf('/educator/') === -1) return;

    const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // -------------- 14-day availability calendar --------------
    function renderCalendar() {
        const root = document.querySelector('[data-edu-calendar]');
        if (!root) return;
        const today = new Date();
        // Hash-based pseudo-availability so each day shows a stable slot count
        function slotsFor(d) {
            const seed = d.getDate() * 31 + d.getMonth() * 7 + d.getDay() * 3;
            // Sundays are always closed; Saturdays are 1-2 slots; weekdays vary
            if (d.getDay() === 0) return 0;
            if (d.getDay() === 6) return (seed % 2) + 1;
            return (seed % 5);
        }
        let html = '';
        for (let i = 0; i < 14; i++) {
            const d = new Date(today.getTime() + i * 86400000);
            const slots = slotsFor(d);
            const cls = slots > 0 ? '' : ' edu-calendar__day--unavailable';
            const slotsHtml = slots > 0
                ? '<div class="edu-calendar__slots">' + slots + ' slot' + (slots === 1 ? '' : 's') + '</div>'
                : '<div class="edu-calendar__slots edu-calendar__slots--none">—</div>';
            html += '<button type="button" class="edu-calendar__day' + cls + '" ' +
                'data-help="' + WEEKDAYS[(d.getDay() + 6) % 7] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' — ' + (slots > 0 ? slots + ' booking slot' + (slots === 1 ? '' : 's') + ' available. Click to view time slots and book.' : 'Closed — no slots available this day.') + '"' +
                (slots > 0 ? '' : ' disabled') + '>' +
                '<div class="edu-calendar__weekday">' + WEEKDAYS[(d.getDay() + 6) % 7] + '</div>' +
                '<div class="edu-calendar__date">' + d.getDate() + '</div>' +
                slotsHtml +
            '</button>';
        }
        root.innerHTML = html;
    }

    // -------------- Booking modal (visitor side) --------------
    let modal = null;

    function ensureModal() {
        if (modal) return modal;
        if (!document.querySelector('link[href*="pitch-modals.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = localAsset('css/pitch-modals.css');
            document.head.appendChild(link);
        }
        if (!document.querySelector('link[href*="stage.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = localAsset('css/stage.css');
            document.head.appendChild(link);
        }
        const wrap = document.createElement('div');
        wrap.innerHTML =
            '<div class="release-modal-overlay" id="eduBookModal" aria-hidden="true" role="dialog" aria-modal="true">' +
                '<div class="release-modal release-modal--contract">' +
                    '<header class="release-modal__header">' +
                        '<h2 class="release-modal__title">Book a lesson</h2>' +
                        '<button type="button" class="release-modal__close" data-edu-close aria-label="Close">&times;</button>' +
                    '</header>' +
                    '<div class="release-modal__body" data-edu-body></div>' +
                    '<footer class="release-modal__actions" data-edu-actions></footer>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap.firstChild);
        modal = document.getElementById('eduBookModal');
        return modal;
    }

    const bookState = { format: '60', mode: 'online', date: '', time: '', topic: '' };

    function openBookModal() {
        ensureModal();
        bookState.format = '60';
        bookState.mode = 'online';
        bookState.date = '';
        bookState.time = '';
        bookState.topic = '';
        renderBookForm();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function closeBookModal() {
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    function renderBookForm() {
        const body = modal.querySelector('[data-edu-body]');
        const acts = modal.querySelector('[data-edu-actions]');
        const formats = [
            { id:'60', label:'1:1 · 60 min',  meta:'650 DKK' },
            { id:'90', label:'1:1 · 90 min',  meta:'920 DKK' },
            { id:'pkg',label:'10-lesson pkg', meta:'5,520 DKK · save 15%' },
            { id:'grp',label:'Group cohort',  meta:'2,800 DKK · 8 weeks' }
        ];
        body.innerHTML =
            '<p class="ar-page-intro" style="margin:0 0 14px;color:rgba(255,255,255,0.75);">Book a lesson with <strong>Lasse Søndergård</strong>. Pick a format, mode, and date — Lasse will confirm within 24 hours.</p>' +
            '<div class="create-profile-section">' +
                '<label class="create-profile-section__label">Format</label>' +
                '<div class="chip-row">' +
                    formats.map(function(f) {
                        return '<button type="button" class="chip' + (f.id === bookState.format ? ' is-active' : '') + '" data-edu-format="' + f.id + '">' + f.label + ' · ' + f.meta + '</button>';
                    }).join('') +
                '</div>' +
            '</div>' +
            '<div class="create-profile-section">' +
                '<label class="create-profile-section__label">Mode</label>' +
                '<div class="chip-row">' +
                    '<button type="button" class="chip' + (bookState.mode === 'online' ? ' is-active' : '') + '" data-edu-mode="online">Online (screen-share)</button>' +
                    '<button type="button" class="chip' + (bookState.mode === 'in-person' ? ' is-active' : '') + '" data-edu-mode="in-person">In-person · Copenhagen</button>' +
                '</div>' +
            '</div>' +
            '<div class="create-profile-section">' +
                '<label class="create-profile-section__label">Date &amp; time</label>' +
                '<div style="display:flex;gap:8px;">' +
                    '<input type="date" class="stage-filter__control" data-edu-date value="' + bookState.date + '" style="flex:1;"/>' +
                    '<input type="time" class="stage-filter__control" data-edu-time value="' + bookState.time + '" style="flex:1;"/>' +
                '</div>' +
            '</div>' +
            '<div class="create-profile-section">' +
                '<label class="create-profile-section__label">What do you want to work on?</label>' +
                '<textarea class="stage-filter__control" data-edu-topic placeholder="e.g. Help me mix the vocals on my new single — they sit too far back" style="min-height:80px;padding:10px;">' + bookState.topic + '</textarea>' +
            '</div>';
        acts.innerHTML =
            '<button type="button" class="release-modal__btn" data-edu-close>Cancel</button>' +
            '<button type="button" class="release-modal__btn release-modal__btn--primary" data-edu-submit>Send booking request</button>';
    }

    function showBookConfirm() {
        const body = modal.querySelector('[data-edu-body]');
        const acts = modal.querySelector('[data-edu-actions]');
        body.innerHTML =
            '<div class="reassign-confirm-banner">' +
                '<strong>✓ Booking request sent.</strong> Lasse will confirm or suggest an alternate time within 24 hours. You will get an email and an in-app notification.' +
            '</div>' +
            '<p class="ar-page-intro" style="margin:14px 0 0;color:rgba(255,255,255,0.7);">No payment is taken until the lesson is confirmed. You can cancel free of charge up to 24 hours before the lesson.</p>';
        acts.innerHTML = '<button type="button" class="release-modal__btn release-modal__btn--primary" data-edu-close>Done</button>';
    }

    document.addEventListener('click', function(e) {
        if (typeof helpActive !== 'undefined' && helpActive) return;
        if (e.target.closest('[data-edu-book]')) { openBookModal(); return; }
        if (!modal || !modal.classList.contains('open')) return;
        if (e.target.closest('[data-edu-close]')) { closeBookModal(); return; }
        if (e.target === modal) { closeBookModal(); return; }
        const fmt = e.target.closest('[data-edu-format]');
        if (fmt) { bookState.format = fmt.getAttribute('data-edu-format'); renderBookForm(); return; }
        const md = e.target.closest('[data-edu-mode]');
        if (md) { bookState.mode = md.getAttribute('data-edu-mode'); renderBookForm(); return; }
        if (e.target.closest('[data-edu-submit]')) {
            const dEl = modal.querySelector('[data-edu-date]');
            const tEl = modal.querySelector('[data-edu-time]');
            const topicEl = modal.querySelector('[data-edu-topic]');
            bookState.date = dEl ? dEl.value : '';
            bookState.time = tEl ? tEl.value : '';
            bookState.topic = topicEl ? topicEl.value : '';
            showBookConfirm();
            return;
        }
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeBookModal();
    });

    document.addEventListener('DOMContentLoaded', renderCalendar);
    if (document.readyState !== 'loading') renderCalendar();
})();
