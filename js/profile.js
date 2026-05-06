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
    const usernameHint = document.getElementById('usernameHint');

    const avatar = document.getElementById('avatarTrigger');
    const avatarInput = document.getElementById('avatarInput');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    const avatarOverlay = document.getElementById('avatarOverlay');
    const removeAvatarBtn = document.getElementById('removeAvatarBtn');
    const avatarWrap = avatar?.parentElement;

    const coverWrap = document.getElementById('coverWrap');
    const coverTrigger = document.getElementById('coverTrigger');
    const coverInput = document.getElementById('coverInput');
    const coverPlaceholder = document.getElementById('coverPlaceholder');
    const coverOverlay = document.getElementById('coverOverlay');
    const coverRemoveBtn = document.getElementById('coverRemove');

    const signOutBtn = document.getElementById('signOutBtn');

    const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
    const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

    function setFeedback(message, kind) {
        feedback.textContent = message;
        feedback.classList.remove('is-success', 'is-error');
        if (kind) feedback.classList.add('is-' + kind);
    }

    function setAvatarPreview(url) {
        if (url) {
            avatar.style.backgroundImage = `url("${url}")`;
            avatarPlaceholder.style.display = 'none';
            if (avatarOverlay) avatarOverlay.textContent = 'Change photo';
            if (avatarWrap) avatarWrap.classList.add('has-photo');
        } else {
            avatar.style.backgroundImage = '';
            avatarPlaceholder.style.display = '';
            if (avatarOverlay) avatarOverlay.textContent = 'Add photo';
            if (avatarWrap) avatarWrap.classList.remove('has-photo');
        }
    }

    function setUsernameHint(text, kind) {
        if (!usernameHint) return;
        usernameHint.textContent = text;
        usernameHint.style.color = kind === 'error' ? '#FF6B6B'
            : kind === 'success' ? '#5CD66B'
            : '#5A6480';
    }

    function validateUsername(value) {
        if (!value) return { ok: true, msg: 'Optional. Used for your shareable profile URL.' };
        if (value.length < 3) return { ok: false, msg: 'Too short — minimum 3 characters.' };
        if (value.length > 30) return { ok: false, msg: 'Too long — maximum 30 characters.' };
        if (!USERNAME_RE.test(value)) return { ok: false, msg: 'Lowercase letters, numbers, _ or - only. Cannot start with _ or -.' };
        return { ok: true, msg: `Profile URL: stagecord.com/u/${value}` };
    }

    function avatarPathFromUrl(url) {
        if (!url) return null;
        const m = url.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/);
        return m ? decodeURIComponent(m[1]) : null;
    }

    function setCoverPreview(url) {
        if (!coverTrigger) return;
        if (url) {
            coverTrigger.style.backgroundImage = `url("${url}")`;
            coverPlaceholder.style.display = 'none';
            if (coverOverlay) coverOverlay.textContent = 'Change cover';
            if (coverWrap) coverWrap.classList.add('has-cover');
        } else {
            coverTrigger.style.backgroundImage = '';
            coverPlaceholder.style.display = '';
            if (coverOverlay) coverOverlay.textContent = 'Add cover photo';
            if (coverWrap) coverWrap.classList.remove('has-cover');
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
    let originalCoverUrl = null;
    let pendingCoverFile = null;

    const { data: profile, error: loadErr } = await sb
        .from('profiles')
        .select('forename, surname, username, bio, avatar_url, cover_url')
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
        originalCoverUrl = profile.cover_url || null;
        setAvatarPreview(originalAvatarUrl);
        setCoverPreview(originalCoverUrl);
        updatePublicProfileLink(profile.username);
        const v = validateUsername(profile.username || '');
        setUsernameHint(v.msg, v.ok ? null : 'error');
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

    userInput.addEventListener('input', () => {
        const before = userInput.value;
        const after = before.toLowerCase().replace(/\s+/g, '');
        if (after !== before) {
            const pos = userInput.selectionStart;
            userInput.value = after;
            try { userInput.setSelectionRange(pos, pos); } catch {}
        }
        const v = validateUsername(userInput.value);
        setUsernameHint(v.msg, v.ok ? (userInput.value ? 'success' : null) : 'error');
    });

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

    if (coverInput) {
        coverInput.addEventListener('change', () => {
            const file = coverInput.files?.[0];
            if (!file) return;
            if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
                setFeedback('Cover: pick a JPG, PNG or WebP image.', 'error');
                coverInput.value = '';
                return;
            }
            if (file.size > MAX_AVATAR_BYTES) {
                setFeedback('Cover image is over 5 MB — pick a smaller one.', 'error');
                coverInput.value = '';
                return;
            }
            pendingCoverFile = file;
            const reader = new FileReader();
            reader.onload = (e) => setCoverPreview(e.target.result);
            reader.readAsDataURL(file);
            setFeedback('Click "Save changes" to upload this cover.', null);
        });
    }

    if (coverRemoveBtn) {
        coverRemoveBtn.addEventListener('click', async () => {
            if (!confirm('Remove your cover photo?')) return;

            coverRemoveBtn.disabled = true;

            const path = avatarPathFromUrl(originalCoverUrl);
            if (path) {
                const { error: delErr } = await sb.storage.from('avatars').remove([path]);
                if (delErr) console.warn('Could not delete cover storage object:', delErr);
            }

            const { error: updErr } = await sb
                .from('profiles')
                .update({ cover_url: null, updated_at: new Date().toISOString() })
                .eq('id', userId);

            coverRemoveBtn.disabled = false;

            if (updErr) {
                console.error('Failed to clear cover_url:', updErr);
                setFeedback('Could not remove cover — try again.', 'error');
                return;
            }

            originalCoverUrl = null;
            pendingCoverFile = null;
            coverInput.value = '';
            setCoverPreview(null);
            setFeedback('Cover removed.', 'success');
        });
    }

    if (removeAvatarBtn) {
        removeAvatarBtn.addEventListener('click', async () => {
            if (!confirm('Remove your profile picture?')) return;

            removeAvatarBtn.disabled = true;
            const originalText = removeAvatarBtn.textContent;
            removeAvatarBtn.textContent = 'Removing…';

            const path = avatarPathFromUrl(originalAvatarUrl);
            if (path) {
                const { error: delErr } = await sb.storage.from('avatars').remove([path]);
                if (delErr) console.warn('Could not delete storage object (continuing anyway):', delErr);
            }

            const { error: updErr } = await sb
                .from('profiles')
                .update({ avatar_url: null, updated_at: new Date().toISOString() })
                .eq('id', userId);

            removeAvatarBtn.disabled = false;
            removeAvatarBtn.textContent = originalText;

            if (updErr) {
                console.error('Failed to clear avatar_url:', updErr);
                setFeedback('Could not remove photo — try again.', 'error');
                return;
            }

            originalAvatarUrl = null;
            pendingAvatarFile = null;
            avatarInput.value = '';
            setAvatarPreview(null);
            setFeedback('Photo removed.', 'success');
        });
    }

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
        pendingCoverFile = null;
        coverInput.value = '';
        setCoverPreview(originalCoverUrl);
        const v = validateUsername(userInput.value);
        setUsernameHint(v.msg, v.ok ? null : 'error');
        setFeedback('Changes discarded.', null);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        setFeedback('', null);

        const forename = foreInput.value.trim();
        const surname = surInput.value.trim();
        const username = userInput.value.trim();
        const bio = bioInput.value.trim();

        if (!forename) {
            setFeedback('First name is required.', 'error');
            foreInput.focus();
            return;
        }
        if (!surname) {
            setFeedback('Last name is required.', 'error');
            surInput.focus();
            return;
        }

        const v = validateUsername(username);
        if (!v.ok) {
            setFeedback(`Username: ${v.msg}`, 'error');
            userInput.focus();
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
                setFeedback(`Photo upload failed: ${upErr.message || 'please try again'}.`, 'error');
                return;
            }

            const { data: pub } = sb.storage.from('avatars').getPublicUrl(path);
            newAvatarUrl = pub.publicUrl;

            const oldPath = avatarPathFromUrl(originalAvatarUrl);
            if (oldPath && oldPath !== path) {
                sb.storage.from('avatars').remove([oldPath]).catch(() => {});
            }
        }

        let newCoverUrl = originalCoverUrl;

        if (pendingCoverFile) {
            const ext = (pendingCoverFile.name.split('.').pop() || 'jpg').toLowerCase();
            const path = `${userId}/cover-${Date.now()}.${ext}`;
            const { error: upErr } = await sb.storage
                .from('avatars')
                .upload(path, pendingCoverFile, { cacheControl: '3600', upsert: false });

            if (upErr) {
                console.error('Cover upload failed:', upErr);
                saveBtn.disabled = false;
                saveBtn.textContent = originalLabel;
                setFeedback(`Cover upload failed: ${upErr.message || 'please try again'}.`, 'error');
                return;
            }

            const { data: pub } = sb.storage.from('avatars').getPublicUrl(path);
            newCoverUrl = pub.publicUrl;

            const oldCoverPath = avatarPathFromUrl(originalCoverUrl);
            if (oldCoverPath && oldCoverPath !== path) {
                sb.storage.from('avatars').remove([oldCoverPath]).catch(() => {});
            }
        }

        const updates = {
            forename,
            surname,
            username: username || null,
            bio: bio || null,
            avatar_url: newAvatarUrl,
            cover_url: newCoverUrl,
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
            let msg = saveErr.message || 'Could not save your profile.';
            if (saveErr.code === '23505') {
                msg = `That username is already taken — try another one.`;
                userInput.focus();
            } else if (/invalid input syntax/i.test(msg)) {
                msg = 'One of the fields contains invalid data — please check and try again.';
            }
            setFeedback(msg, 'error');
            return;
        }

        originalAvatarUrl = newAvatarUrl;
        originalCoverUrl = newCoverUrl;
        pendingAvatarFile = null;
        pendingCoverFile = null;
        avatarInput.value = '';
        coverInput.value = '';
        updatePublicProfileLink(username);
        setFeedback('Saved ✓', 'success');
    });

    signOutBtn.addEventListener('click', async () => {
        await sb.auth.signOut();
        window.location.href = '/';
    });
})();
