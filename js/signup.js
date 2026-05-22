(async function () {
    const sb = window.supabaseClient;
    const form = document.getElementById('signupForm');
    if (!form) return;

    const submitBtn = document.getElementById('signupSubmit');
    const feedback = document.getElementById('signupFeedback');
    const emailInput = document.getElementById('signup-email');
    const disciplinesField = document.getElementById('signup-disciplines-field');
    const disciplinesChips = document.getElementById('signup-disciplines-chips');

    const profileBtn = document.getElementById('signupProfileBtn');
    const avatarInput = document.getElementById('signupAvatarInput');
    const profileLabel = document.getElementById('signupProfileLabel');
    const profileIcon = document.getElementById('signupProfileIcon');
    let pendingAvatarDataUrl = null;

    if (profileBtn && avatarInput) {
        profileBtn.addEventListener('click', () => avatarInput.click());
        avatarInput.addEventListener('change', async () => {
            const file = avatarInput.files?.[0];
            if (!file) return;
            if (!/^image\//.test(file.type)) {
                setFeedback('Please pick a JPG, PNG or WebP image.', 'error');
                avatarInput.value = '';
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                setFeedback('Image is over 10 MB — pick a smaller one.', 'error');
                avatarInput.value = '';
                return;
            }
            try {
                pendingAvatarDataUrl = await resizeImageToDataUrl(file, 512);
                profileBtn.style.backgroundImage = `url("${pendingAvatarDataUrl}")`;
                if (profileIcon) profileIcon.style.display = 'none';
                if (profileLabel) profileLabel.textContent = 'Change';
            } catch (err) {
                console.error('Image resize failed:', err);
                setFeedback('Could not read that image — try another.', 'error');
                pendingAvatarDataUrl = null;
                avatarInput.value = '';
            }
        });
    }

    function resizeImageToDataUrl(file, maxDim) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('decode_failed'));
                img.onload = () => {
                    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                    const w = Math.round(img.width * scale);
                    const h = Math.round(img.height * scale);
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

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

    function toggleDisciplines() {
        const role = (form.elements['role']?.value) || '';
        if (disciplinesField) disciplinesField.hidden = role !== 'artist';
    }
    Array.from(form.querySelectorAll('input[name="role"]')).forEach((r) => {
        r.addEventListener('change', toggleDisciplines);
    });
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
    console.log('validate_invite response:', { data, rpcError });

    if (rpcError || !data || !data.valid) {
        const reason = data?.reason;
        let msg = 'This invite link is not valid.';
        if (rpcError) msg = `Could not verify invite (${rpcError.code || rpcError.message || 'unknown error'}).`;
        else if (reason === 'used') msg = 'This invite has already been used. Try logging in instead.';
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

    // Pre-select role from the invite (whatever the user picked on the waitlist)
    const invitedRole = data.role === 'artist' ? 'artist' : (data.role === 'fan' ? 'fan' : '');
    if (invitedRole) {
        const radio = form.querySelector(`input[name="role"][value="${invitedRole}"]`);
        if (radio) {
            radio.checked = true;
            toggleDisciplines();
        }
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
        const role = (form.elements['role']?.value || '').trim();

        if (!forename || !surname) {
            setFeedback('Please fill in your forename and surname.', 'error');
            return;
        }
        if (!role) {
            setFeedback('Please pick whether you\'re joining as an Artist or General user / Fan.', 'error');
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

        const disciplines = role === 'artist'
            ? (window.STAGECORD?.sanitizeDisciplines?.(Array.from(selectedDisciplines)) || [])
            : [];

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
                    role,
                    disciplines,
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

        try { await sb.rpc('mark_invite_used', { p_token: token }); } catch (err) { console.warn('mark_invite_used failed:', err); }

        if (pendingAvatarDataUrl) {
            try {
                localStorage.setItem('stagecord_pending_avatar', pendingAvatarDataUrl);
                localStorage.setItem('stagecord_pending_avatar_email', email);
            } catch (err) {
                console.warn('Could not stash pending avatar:', err);
            }
        }

        const target = `/check-email/?email=${encodeURIComponent(email)}`;
        window.location.href = target;
    });
})();
