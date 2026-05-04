(async function () {
    const sb = window.supabaseClient;
    const form = document.getElementById('signupForm');
    if (!form) return;

    const submitBtn = document.getElementById('signupSubmit');
    const feedback = document.getElementById('signupFeedback');
    const emailInput = document.getElementById('signup-email');
    const roleNote = document.createElement('p');
    roleNote.className = 'signup-subtitle';
    roleNote.style.marginTop = '8px';
    roleNote.style.fontSize = '14px';

    function setFeedback(message, kind) {
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.remove('is-success', 'is-error');
        if (kind) feedback.classList.add('is-' + kind);
    }

    function disableForm(message) {
        const subtitle = document.querySelector('.signup-subtitle');
        if (subtitle) subtitle.textContent = message;
        Array.from(form.elements).forEach((el) => { el.disabled = true; });
        submitBtn.disabled = true;
        submitBtn.textContent = 'Invite required';
    }

    const token = new URLSearchParams(window.location.search).get('invite');

    if (!token) {
        disableForm('Signing up is invite-only right now. Join the waitlist and we\'ll send you a link when your wave opens.');
        const link = document.createElement('p');
        link.className = 'signup-login';
        link.innerHTML = '<a href="/">Join the waitlist instead →</a>';
        form.appendChild(link);
        return;
    }

    const { data, error: rpcError } = await sb.rpc('validate_invite', { p_token: token });

    if (rpcError || !data || !data.valid) {
        const reason = data?.reason;
        let msg = 'This invite link is not valid.';
        if (reason === 'used') msg = 'This invite has already been used. Try logging in instead.';
        else if (reason === 'unknown') msg = 'This invite link is not recognized. Did you copy the full URL?';
        disableForm(msg);
        const link = document.createElement('p');
        link.className = 'signup-login';
        link.innerHTML = reason === 'used'
            ? '<a href="../login/index.html">Go to log in →</a>'
            : '<a href="/">Join the waitlist →</a>';
        form.appendChild(link);
        return;
    }

    if (emailInput) {
        emailInput.value = data.email || '';
        emailInput.readOnly = true;
        emailInput.style.opacity = '0.7';
    }

    if (data.name) {
        const parts = data.name.trim().split(/\s+/);
        const fore = document.getElementById('signup-forename');
        const sur = document.getElementById('signup-surname');
        if (fore && !fore.value) fore.value = parts[0] || '';
        if (sur && !sur.value && parts.length > 1) sur.value = parts.slice(1).join(' ');
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

        const { error } = await sb.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/welcome/`,
                data: {
                    forename,
                    surname,
                    username: username || null,
                    role: data.role || 'fan',
                    invite_token: token
                }
            }
        });

        if (error) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalLabel;
            let msg = error.message || 'Could not create account. Please try again.';
            if (/already registered|already exists/i.test(error.message || '')) {
                msg = 'An account with this email already exists. Try logging in instead.';
            }
            setFeedback(msg, 'error');
            return;
        }

        await sb.rpc('mark_invite_used', { p_token: token }).catch(() => {});

        const target = `/check-email/?email=${encodeURIComponent(email)}`;
        window.location.href = target;
    });
})();
