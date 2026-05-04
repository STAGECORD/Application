(async function () {
    const sb = window.supabaseClient;

    const loginForm = document.getElementById('loginForm');
    const loginSubmit = document.getElementById('loginSubmit');
    const loginFeedback = document.getElementById('loginFeedback');

    const forgotForm = document.getElementById('forgotForm');
    const forgotSubmit = document.getElementById('forgotSubmit');
    const forgotFeedback = document.getElementById('forgotFeedback');

    const pwToggleBtn = document.getElementById('loginPwToggle');
    const pwInput = document.getElementById('login-password');

    const sentEmailEcho = document.getElementById('sentEmailEcho');
    const views = document.querySelectorAll('[data-login-view]');

    function showView(name) {
        views.forEach((el) => {
            el.hidden = el.getAttribute('data-login-view') !== name;
        });
    }

    function setFeedback(el, message, kind) {
        if (!el) return;
        el.textContent = message;
        el.classList.remove('is-success', 'is-error');
        if (kind) el.classList.add('is-' + kind);
    }

    document.querySelectorAll('[data-login-forgot]').forEach((b) => {
        b.addEventListener('click', () => {
            setFeedback(forgotFeedback, '', null);
            showView('forgot');
        });
    });
    document.querySelectorAll('[data-login-back]').forEach((b) => {
        b.addEventListener('click', () => {
            setFeedback(loginFeedback, '', null);
            showView('login');
        });
    });

    if (pwToggleBtn && pwInput) {
        pwToggleBtn.addEventListener('click', () => {
            const showing = pwInput.type === 'text';
            pwInput.type = showing ? 'password' : 'text';
            pwToggleBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        });
    }

    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        window.location.href = '/welcome/';
        return;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setFeedback(loginFeedback, '', null);

            const email = (loginForm.elements['email']?.value || '').trim().toLowerCase();
            const password = loginForm.elements['password']?.value || '';

            if (!email || !password) {
                setFeedback(loginFeedback, 'Please enter your email and password.', 'error');
                return;
            }

            const originalLabel = loginSubmit.textContent;
            loginSubmit.disabled = true;
            loginSubmit.textContent = 'Signing in...';

            const { error } = await sb.auth.signInWithPassword({ email, password });

            if (error) {
                loginSubmit.disabled = false;
                loginSubmit.textContent = originalLabel;
                let msg = error.message || 'Could not sign in.';
                if (/invalid login credentials/i.test(msg)) {
                    msg = 'That email and password combination didn\'t work.';
                } else if (/email not confirmed/i.test(msg)) {
                    msg = 'Please confirm your email first — check your inbox for the confirmation link.';
                }
                setFeedback(loginFeedback, msg, 'error');
                return;
            }

            window.location.href = '/welcome/';
        });
    }

    let lastForgotEmail = '';

    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setFeedback(forgotFeedback, '', null);

            const email = (forgotForm.elements['email']?.value || '').trim().toLowerCase();
            if (!email) {
                setFeedback(forgotFeedback, 'Please enter your email.', 'error');
                return;
            }

            const originalLabel = forgotSubmit.textContent;
            forgotSubmit.disabled = true;
            forgotSubmit.textContent = 'Sending...';

            const { error } = await sb.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password/`
            });

            forgotSubmit.disabled = false;
            forgotSubmit.textContent = originalLabel;

            if (error) {
                setFeedback(forgotFeedback, error.message || 'Could not send reset link.', 'error');
                return;
            }

            lastForgotEmail = email;
            if (sentEmailEcho) sentEmailEcho.textContent = email;
            showView('sent');
        });
    }

    document.querySelectorAll('[data-login-resend]').forEach((b) => {
        b.addEventListener('click', async () => {
            if (!lastForgotEmail) return;
            await sb.auth.resetPasswordForEmail(lastForgotEmail, {
                redirectTo: `${window.location.origin}/reset-password/`
            });
            b.textContent = 'sent ✓';
            setTimeout(() => { b.textContent = 'resend'; }, 2200);
        });
    });
})();
