(function () {
    const form = document.getElementById('waitlistForm');
    if (!form) return;

    const submitBtn = document.getElementById('waitlistSubmit') || form.querySelector('button[type="submit"]');
    const feedback = document.getElementById('waitlistFeedback');
    const countEl = document.getElementById('waitlistCount');
    const disciplinesField = document.getElementById('waitlist-disciplines-field');
    const disciplinesChips = document.getElementById('waitlist-disciplines-chips');

    const selectedDisciplines = new Set();

    function renderDisciplineChips() {
        if (!disciplinesChips || !window.STAGECORD?.DISCIPLINES) return;
        disciplinesChips.innerHTML = window.STAGECORD.DISCIPLINES.map((d) => {
            const on = selectedDisciplines.has(d.slug) ? ' is-on' : '';
            return `<button type="button" class="discipline-chip${on}" data-slug="${d.slug}">${d.label}</button>`;
        }).join('');
        disciplinesChips.querySelectorAll('[data-slug]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const slug = btn.getAttribute('data-slug');
                if (selectedDisciplines.has(slug)) {
                    selectedDisciplines.delete(slug);
                    btn.classList.remove('is-on');
                } else {
                    selectedDisciplines.add(slug);
                    btn.classList.add('is-on');
                }
            });
        });
    }
    renderDisciplineChips();

    // Waitlist is creator-only — disciplines are always visible.
    function toggleDisciplines() {
        if (!disciplinesField) return;
        disciplinesField.hidden = false;
    }
    toggleDisciplines();

    function setFeedback(message, kind) {
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.remove('is-success', 'is-error');
        if (kind) feedback.classList.add('is-' + kind);
    }

    function getRole() {
        // Waitlist is creator-only — there's no Fan radio anymore.
        const checked = form.querySelector('input[name="role"]:checked');
        if (checked) return checked.value;
        return 'artist';
    }

    function fmt(n) {
        return n.toLocaleString('en-US');
    }

    function animateCount(to, duration) {
        if (!countEl) return;
        const from = parseInt((countEl.textContent || '0').replace(/,/g, ''), 10) || 0;
        const start = performance.now();
        function tick(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            countEl.textContent = fmt(Math.round(from + (to - from) * eased));
            if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    async function loadCount() {
        if (!countEl || !window.supabaseClient) return;
        const { data, error } = await window.supabaseClient.rpc('get_waitlist_count');
        if (error) {
            console.error('Failed to load waitlist count:', error);
            return;
        }
        const n = typeof data === 'number' ? data : parseInt(data, 10) || 0;
        animateCount(n, 1200);
    }

    loadCount();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setFeedback('', null);

        const name = (form.elements['name']?.value || '').trim();
        const email = (form.elements['email']?.value || '').trim().toLowerCase();
        const role = getRole();
        const wantsUpdates = !!(form.elements['updates']?.checked);
        const website = (form.elements['website']?.value || '').trim();
        const disciplines = role === 'artist'
            ? (window.STAGECORD?.sanitizeDisciplines?.(Array.from(selectedDisciplines)) || [])
            : [];

        if (!name || !email || !role) {
            setFeedback('Please fill in name, email and role.', 'error');
            return;
        }

        const originalLabel = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        let response, data;
        try {
            response = await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, role, wantsUpdates, website, disciplines, turnstileToken: window.turnstileToken || '' })
            });
            data = await response.json().catch(() => ({}));
        } catch (err) {
            console.error('Waitlist request failed:', err);
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
            setFeedback('Network problem — please try again.', 'error');
            return;
        }

        submitBtn.disabled = false;

        if (!response.ok) {
            submitBtn.textContent = originalLabel;
            setFeedback(data.error || 'Something went wrong. Please try again.', 'error');
            return;
        }

        if (data.duplicate) {
            submitBtn.textContent = "You're already on the list ✓";
            setFeedback("You're already on the list — we'll be in touch.", 'success');
            form.reset();
            selectedDisciplines.clear();
            renderDisciplineChips();
            toggleDisciplines();
            return;
        }

        submitBtn.textContent = "You're on the list — see you soon ✓";
        const confirmText = data.emailed
            ? "You're on the list — check your inbox for confirmation."
            : "You're on the list! We'll email you when your invite is ready.";
        setFeedback(confirmText, 'success');
        form.reset();
        selectedDisciplines.clear();
        renderDisciplineChips();
        toggleDisciplines();

        if (countEl) {
            const current = parseInt((countEl.textContent || '0').replace(/,/g, ''), 10) || 0;
            animateCount(current + 1, 500);
            setTimeout(loadCount, 1500);
        }
    });
})();
