(function () {
    const form = document.getElementById('signupForm');
    if (!form) return;

    const submitBtn = document.getElementById('signupSubmit');
    const feedback = document.getElementById('signupFeedback');

    function setFeedback(message, kind) {
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.remove('is-success', 'is-error');
        if (kind) feedback.classList.add('is-' + kind);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setFeedback('', null);

        const forename = (form.elements['forename']?.value || '').trim();
        const surname = (form.elements['surname']?.value || '').trim();
        const email = (form.elements['email']?.value || '').trim().toLowerCase();
        const username = (form.elements['username']?.value || '').trim();
        const password = form.elements['password']?.value || '';
        const passwordConfirm = form.elements['passwordConfirm']?.value || '';

        if (!forename || !surname) {
            setFeedback('Please fill in your forename and surname.', 'error');
            return;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFeedback('Please enter a valid email.', 'error');
            return;
        }
        if (password.length < 8) {
            setFeedback('Password must be at least 8 characters.', 'error');
            return;
        }
        if (password !== passwordConfirm) {
            setFeedback('Passwords do not match.', 'error');
            return;
        }

        const originalLabel = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';

        const { error } = await window.supabaseClient.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/welcome/`,
                data: {
                    forename,
                    surname,
                    username: username || null,
                    role: 'fan'
                }
            }
        });

        if (error) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
            let msg = error.message || 'Could not create account. Please try again.';
            if (/already registered|already exists/i.test(error.message || '')) {
                msg = 'An account with this email already exists. Try logging in instead.';
            } else if (/password/i.test(error.message || '')) {
                msg = error.message;
            }
            setFeedback(msg, 'error');
            return;
        }

        const target = `/check-email/?email=${encodeURIComponent(email)}`;
        window.location.href = target;
    });
})();
