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
        if (!countEl) return;
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

        if (!name || !email || !role) {
            setFeedback('Please fill in name, email and role.', 'error');
            return;
        }

        const originalLabel = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        const message = wantsUpdates ? 'wants_updates: true' : null;

        const { error } = await window.supabaseClient
            .from('waitlist')
            .insert([{ name, email, role, message }]);

        submitBtn.disabled = false;

        if (error) {
            if (error.code === '23505') {
                submitBtn.textContent = "You're already on the list ✓";
                setFeedback("You're already on the list — we'll be in touch.", 'success');
                form.reset();
            } else {
                submitBtn.textContent = originalLabel;
                setFeedback('Something went wrong. Please try again in a moment.', 'error');
                console.error('Waitlist insert error:', error);
            }
            return;
        }

        submitBtn.textContent = "You're on the list — see you soon ✓";
        setFeedback("You're on the list! We'll email you when your invite is ready.", 'success');
        form.reset();

        // Bump counter by 1 (and refresh from server in background to stay in sync)
        if (countEl) {
            const current = parseInt((countEl.textContent || '0').replace(/,/g, ''), 10) || 0;
            animateCount(current + 1, 500);
            setTimeout(loadCount, 1500);
        }
    });
})();
