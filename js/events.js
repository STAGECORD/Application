(async function () {
    const sb = window.supabaseClient;

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = '/login/';
        return;
    }
    const user = session.user;

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            await sb.auth.signOut();
            window.location.href = '/';
        });
    }

    const titleInput = document.getElementById('ev-title');
    const dateInput = document.getElementById('ev-date');
    const venueInput = document.getElementById('ev-venue');
    const cityInput = document.getElementById('ev-city');
    const ticketInput = document.getElementById('ev-ticket');
    const descInput = document.getElementById('ev-desc');
    const submitBtn = document.getElementById('evSubmit');
    const feedback = document.getElementById('evFeedback');
    const form = document.getElementById('eventForm');
    const listEl = document.getElementById('evList');
    const countEl = document.getElementById('evCount');

    function escapeHtml(s) {
        return String(s).replace(/[<>&"']/g, (c) => ({
            '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    function setFeedback(msg, kind) {
        feedback.textContent = msg || '';
        feedback.classList.remove('is-success', 'is-error');
        if (kind) feedback.classList.add('is-' + kind);
    }

    function updateButtonState() {
        const ok = titleInput.value.trim() && dateInput.value;
        submitBtn.disabled = !ok;
    }

    titleInput.addEventListener('input', updateButtonState);
    dateInput.addEventListener('input', updateButtonState);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = titleInput.value.trim();
        const startsAt = dateInput.value;
        const venue = venueInput.value.trim();
        const city = cityInput.value.trim();
        const ticket = ticketInput.value.trim();
        const desc = descInput.value.trim();

        if (!title || !startsAt) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding…';
        setFeedback('', null);

        const isoDate = new Date(startsAt).toISOString();

        const { error } = await sb.from('events').insert({
            user_id: user.id,
            title,
            starts_at: isoDate,
            venue_name: venue || null,
            city: city || null,
            description: desc || null,
            ticket_url: ticket || null
        });

        submitBtn.disabled = false;
        submitBtn.textContent = 'Add event';

        if (error) {
            console.error('Event insert failed:', error);
            setFeedback(error.message || 'Could not add event — try again.', 'error');
            updateButtonState();
            return;
        }

        titleInput.value = '';
        dateInput.value = '';
        venueInput.value = '';
        cityInput.value = '';
        ticketInput.value = '';
        descInput.value = '';
        updateButtonState();
        setFeedback('Event added ✓', 'success');
        setTimeout(() => setFeedback('', null), 2200);
        loadEvents();
    });

    function fmtDate(iso) {
        const d = new Date(iso);
        return {
            day: d.getDate(),
            month: d.toLocaleDateString('en-US', { month: 'short' }),
            time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            full: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
            isPast: d.getTime() < Date.now() - 86400000
        };
    }

    async function loadEvents() {
        listEl.innerHTML = `<div class="ev-empty">Loading…</div>`;
        const { data: rows, error } = await sb
            .from('events')
            .select('id, title, starts_at, venue_name, city, description, ticket_url')
            .eq('user_id', user.id)
            .order('starts_at', { ascending: true })
            .limit(200);

        if (error) {
            console.error('Load events failed:', error);
            listEl.innerHTML = `<div class="ev-empty">Couldn't load events: ${escapeHtml(error.message || '')}</div>`;
            return;
        }

        if (!rows || rows.length === 0) {
            listEl.innerHTML = `<div class="ev-empty">No events yet — add one above.</div>`;
            countEl.textContent = '';
            return;
        }

        const upcoming = rows.filter((r) => !fmtDate(r.starts_at).isPast);
        countEl.textContent = `${upcoming.length} upcoming · ${rows.length} total`;

        listEl.innerHTML = rows.map((r) => {
            const f = fmtDate(r.starts_at);
            const where = [r.venue_name, r.city].filter(Boolean).map(escapeHtml).join(' · ');
            const desc = r.description ? `<p class="ev-item__desc">${escapeHtml(r.description)}</p>` : '';
            const ticket = r.ticket_url
                ? `<a class="ev-item__ticket" href="${escapeHtml(r.ticket_url)}" target="_blank" rel="noopener">Tickets ↗</a>`
                : '';
            return `<article class="ev-item${f.isPast ? ' ev-item--past' : ''}">
                <div class="ev-item__date">
                    <div class="ev-item__day">${f.day}</div>
                    <div class="ev-item__month">${escapeHtml(f.month)}</div>
                </div>
                <div class="ev-item__main">
                    <h3 class="ev-item__title">${escapeHtml(r.title)}</h3>
                    ${where ? `<div class="ev-item__where">${where}</div>` : ''}
                    <div class="ev-item__time">${escapeHtml(f.full)} · ${escapeHtml(f.time)}</div>
                    ${desc}
                    ${ticket}
                </div>
                <button class="ev-item__delete" data-delete-event="${escapeHtml(r.id)}" aria-label="Delete">×</button>
            </article>`;
        }).join('');

        listEl.querySelectorAll('[data-delete-event]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this event?')) return;
                const id = btn.getAttribute('data-delete-event');
                const { error } = await sb.from('events').delete().eq('id', id);
                if (error) {
                    alert('Could not delete: ' + (error.message || 'try again'));
                    return;
                }
                loadEvents();
            });
        });
    }

    loadEvents();
    updateButtonState();
})();
