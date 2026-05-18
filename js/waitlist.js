(function () {
    const form = document.getElementById('waitlistForm');
    if (!form) return;

    const submitBtn = document.getElementById('waitlistSubmit') || form.querySelector('button[type="submit"]');
    const feedback = document.getElementById('waitlistFeedback');
    const countEl = document.getElementById('waitlistCount');

    function setFeedback(message, kind) {
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.remove('is-success', 'is-error');
        if (kind) feedback.classList.add('is-' + kind);
    }

    function getRole() {
        const checked = form.querySelector('input[name="role"]:checked');
        return checked ? checked.value : '';
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
                body: JSON.stringify({ name, email, role, wantsUpdates, website })
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
            return;
        }

        submitBtn.textContent = "You're on the list — see you soon ✓";
        const confirmText = data.emailed
            ? "You're on the list — check your inbox for confirmation."
            : "You're on the list! We'll email you when your invite is ready.";
        setFeedback(confirmText, 'success');
        form.reset();

        if (countEl) {
            const current = parseInt((countEl.textContent || '0').replace(/,/g, ''), 10) || 0;
            animateCount(current + 1, 500);
            setTimeout(loadCount, 1500);
        }
    });
})();
