(async function () {
    const sb = window.supabaseClient;

    const form = document.getElementById('profileForm');
    const saveBtn = document.getElementById('profileSave');
    const cancelBtn = document.getElementById('profileCancel');
    const feedback = document.getElementById('profileFeedback');

    const emailInput = document.getElementById('profile-email');
    const foreInput = document.getElementById('profile-forename');
    const surInput = document.getElementById('profile-surname');
    const userInput = document.getElementById('profile-username');
    const bioInput = document.getElementById('profile-bio');

    const avatar = document.getElementById('avatarTrigger');
    const avatarInput = document.getElementById('avatarInput');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');

    const signOutBtn = document.getElementById('signOutBtn');

    const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

    function setFeedback(message, kind) {
        feedback.textContent = message;
        feedback.classList.remove('is-success', 'is-error');
        if (kind) feedback.classList.add('is-' + kind);
    }

    function setAvatarPreview(url) {
        if (url) {
            avatar.style.backgroundImage = `url("${url}")`;
            avatarPlaceholder.style.display = 'none';
        } else {
            avatar.style.backgroundImage = '';
            avatarPlaceholder.style.display = '';
        }
    }

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = '/login/';
        return;
    }

    const userId = session.user.id;
    emailInput.value = session.user.email || '';

    let originalAvatarUrl = null;
    let pendingAvatarFile = null;

    const { data: profile, error: loadErr } = await sb
        .from('profiles')
        .select('forename, surname, username, bio, avatar_url')
        .eq('id', userId)
        .single();

    if (loadErr) {
        console.error('Failed to load profile:', loadErr);
        setFeedback('Could not load your profile. Refresh and try again.', 'error');
    } else if (profile) {
        foreInput.value = profile.forename || '';
        surInput.value = profile.surname || '';
        userInput.value = profile.username || '';
        bioInput.value = profile.bio || '';
        originalAvatarUrl = profile.avatar_url || null;
        if (originalAvatarUrl) setAvatarPreview(originalAvatarUrl);
        updatePublicProfileLink(profile.username);
    }

    function updatePublicProfileLink(username) {
        const link = document.getElementById('viewPublicProfileLink');
        if (!link) return;
        if (username) {
            link.href = `/u/${encodeURIComponent(username)}`;
            link.style.display = '';
        } else {
            link.style.display = 'none';
        }
    }

    avatarInput.addEventListener('change', () => {
        const file = avatarInput.files?.[0];
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
            setFeedback('Please pick a JPG, PNG or WebP image.', 'error');
            avatarInput.value = '';
            return;
        }
        if (file.size > MAX_AVATAR_BYTES) {
            setFeedback('Image is over 5 MB — pick a smaller one.', 'error');
            avatarInput.value = '';
            return;
        }
        pendingAvatarFile = file;
        const reader = new FileReader();
        reader.onload = (e) => setAvatarPreview(e.target.result);
        reader.readAsDataURL(file);
        setFeedback('Click "Save changes" to upload this photo.', null);
    });

    cancelBtn.addEventListener('click', () => {
        if (profile) {
            foreInput.value = profile.forename || '';
            surInput.value = profile.surname || '';
            userInput.value = profile.username || '';
            bioInput.value = profile.bio || '';
        }
        pendingAvatarFile = null;
        avatarInput.value = '';
        setAvatarPreview(originalAvatarUrl);
        setFeedback('Changes discarded.', null);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setFeedback('', null);

        const forename = foreInput.value.trim();
        const surname = surInput.value.trim();
        const username = userInput.value.trim();
        const bio = bioInput.value.trim();

        if (!forename || !surname) {
            setFeedback('First and last name are required.', 'error');
            return;
        }

        const originalLabel = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';

        let newAvatarUrl = originalAvatarUrl;

        if (pendingAvatarFile) {
            const ext = (pendingAvatarFile.name.split('.').pop() || 'jpg').toLowerCase();
            const path = `${userId}/avatar-${Date.now()}.${ext}`;
            const { error: upErr } = await sb.storage
                .from('avatars')
                .upload(path, pendingAvatarFile, { cacheControl: '3600', upsert: false });

            if (upErr) {
                console.error('Avatar upload failed:', upErr);
                saveBtn.disabled = false;
                saveBtn.textContent = originalLabel;
                setFeedback(`Avatar upload failed: ${upErr.message || 'try again'}`, 'error');
                return;
            }

            const { data: pub } = sb.storage.from('avatars').getPublicUrl(path);
            newAvatarUrl = pub.publicUrl;
        }

        const updates = {
            forename,
            surname,
            username: username || null,
            bio: bio || null,
            avatar_url: newAvatarUrl,
            updated_at: new Date().toISOString()
        };

        const { error: saveErr } = await sb
            .from('profiles')
            .update(updates)
            .eq('id', userId);

        saveBtn.disabled = false;
        saveBtn.textContent = originalLabel;

        if (saveErr) {
            console.error('Profile save failed:', saveErr);
            let msg = saveErr.message || 'Could not save profile.';
            if (saveErr.code === '23505') msg = 'That username is already taken.';
            setFeedback(msg, 'error');
            return;
        }

        originalAvatarUrl = newAvatarUrl;
        pendingAvatarFile = null;
        avatarInput.value = '';
        updatePublicProfileLink(username);
        setFeedback('Saved ✓', 'success');
    });

    signOutBtn.addEventListener('click', async () => {
        await sb.auth.signOut();
        window.location.href = '/';
    });
})();
