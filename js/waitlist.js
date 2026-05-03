(function () {
    const form = document.getElementById('waitlistForm');
    const submitBtn = document.getElementById('waitlistSubmit');
    const feedback = document.getElementById('waitlistFeedback');

    if (!form) return;

    function setFeedback(message, kind) {
        feedback.textContent = message;
        feedback.classList.remove('is-success', 'is-error');
        if (kind) feedback.classList.add('is-' + kind);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setFeedback('', null);

        const name = form.elements['name'].value.trim();
        const email = form.elements['email'].value.trim().toLowerCase();
        const role = form.elements['role'].value;
        const message = form.elements['message'].value.trim();

        if (!name || !email || !role) {
            setFeedback('Please fill in name, email and role.', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        const { error } = await window.supabaseClient
            .from('waitlist')
            .insert([{ name, email, role, message: message || null }]);

        submitBtn.disabled = false;
        submitBtn.textContent = 'Join waitlist';

        if (error) {
            if (error.code === '23505') {
                setFeedback("You're already on the list — we'll be in touch.", 'success');
                form.reset();
            } else {
                setFeedback('Something went wrong. Please try again in a moment.', 'error');
                console.error('Waitlist insert error:', error);
            }
            return;
        }

        setFeedback("You're on the list! We'll email you when your invite is ready.", 'success');
        form.reset();
    });
})();
