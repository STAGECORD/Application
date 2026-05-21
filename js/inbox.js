(async function () {
    const sb = window.supabaseClient;

    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = '/login/';
        return;
    }
    const user = session.user;

    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            await sb.auth.signOut();
            window.location.href = '/';
        });
    }

    const inboxListEl = document.getElementById('inboxList');
    const inboxThreadEl = document.getElementById('inboxThread');
    const conversationsListEl = document.getElementById('conversationsList');
    const threadTitleEl = document.getElementById('threadTitle');
    const threadMessagesEl = document.getElementById('threadMessages');
    const composerForm = document.getElementById('composerForm');
    const composerInput = document.getElementById('composerInput');
    const composerSend = document.getElementById('composerSend');
    const composerEmojiBtn = document.getElementById('composerEmojiBtn');
    if (composerEmojiBtn && window.STAGECORD?.EmojiPicker) {
        window.STAGECORD.EmojiPicker.attach(composerEmojiBtn, composerInput);
    }
    const inboxBack = document.getElementById('inboxBack');

    const composeBtn = document.getElementById('composeBtn');
    const composeOverlay = document.getElementById('composeOverlay');
    const composeClose = document.getElementById('composeClose');
    const composeSearch = document.getElementById('composeSearch');
    const composeResults = document.getElementById('composeResults');

    let activeConvoId = null;
    let conversationsCache = [];
    let participantsById = {};
    let renderedMsgIds = new Set();
    let messagesChannel = null;
    let allMembers = null;

    function escapeHtml(s) {
        return String(s).replace(/[<>&"']/g, (c) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function timeAgo(iso) {
        const t = new Date(iso).getTime();
        const diff = (Date.now() - t) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
        return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function fmtTime(iso) {
        return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    // Load own profile so we can hydrate optimistic + realtime inserts for self.
    const { data: meProfile } = await sb
        .from('profiles')
        .select('id, forename, surname, username, avatar_url')
        .eq('id', user.id)
        .single();
    if (meProfile) {
        participantsById[user.id] = meProfile;
    }

    function syncMobileLayout() {
        if (window.innerWidth <= 720) {
            if (activeConvoId) {
                inboxListEl.setAttribute('data-mobile-hidden', '');
                inboxThreadEl.removeAttribute('data-mobile-hidden');
            } else {
                inboxListEl.removeAttribute('data-mobile-hidden');
                inboxThreadEl.setAttribute('data-mobile-hidden', '');
            }
        } else {
            inboxListEl.removeAttribute('data-mobile-hidden');
            inboxThreadEl.removeAttribute('data-mobile-hidden');
        }
    }
    window.addEventListener('resize', syncMobileLayout);

    inboxBack.addEventListener('click', () => {
        activeConvoId = null;
        renderedMsgIds = new Set();
        history.replaceState(null, '', '/inbox/');
        threadTitleEl.textContent = 'Choose a conversation';
        threadMessagesEl.innerHTML = `<div class="inbox-placeholder">Pick a conversation on the left.</div>`;
        composerForm.hidden = true;
        renderList();
        syncMobileLayout();
    });

    async function loadConversations() {
        const { data, error } = await sb.rpc('get_my_conversations');
        if (error) {
            console.error('get_my_conversations failed:', error);
            conversationsListEl.innerHTML = `<div class="inbox-empty">Couldn't load conversations: ${escapeHtml(error.message || '')}</div>`;
            return;
        }
        conversationsCache = data || [];
        // Cache "other party" profiles so realtime inserts can hydrate.
        conversationsCache.forEach((c) => {
            if (c.other_user_id) {
                participantsById[c.other_user_id] = {
                    id: c.other_user_id,
                    forename: c.other_forename,
                    surname: c.other_surname,
                    username: c.other_username,
                    avatar_url: c.other_avatar_url
                };
            }
        });
        renderList();
    }

    function renderList() {
        if (conversationsCache.length === 0) {
            conversationsListEl.innerHTML = `<div class="inbox-empty">No conversations yet. Tap <strong>New</strong> above or open someone's <strong>profile</strong>.</div>`;
            return;
        }
        conversationsListEl.innerHTML = conversationsCache.map((c) => {
            const F = window.STAGECORD;
            const plainName = F ? F.plainName(c.other_forename, c.other_surname, c.other_username) : ([c.other_forename, c.other_surname].filter(Boolean).join(' ') || c.other_username || 'STAGECORD member');
            const styledName = F ? F.formatName(c.other_forename, c.other_surname, c.other_username) : escapeHtml(plainName);
            const initial = (plainName[0] || '?').toUpperCase();
            const avatarHtml = c.other_avatar_url
                ? `<div class="convo__avatar" style="background-image:url('${escapeHtml(c.other_avatar_url)}');"></div>`
                : `<div class="convo__avatar">${escapeHtml(initial)}</div>`;
            const preview = c.last_message_content
                ? (c.last_message_user_id === user.id ? 'You: ' : '') + c.last_message_content
                : 'No messages yet';
            const unread = (Number(c.unread_count) > 0)
                ? `<span class="convo__unread">${Number(c.unread_count)}</span>`
                : '';
            return `<a class="convo${activeConvoId === c.conversation_id ? ' convo--active' : ''}" href="?c=${escapeHtml(c.conversation_id)}" data-convo-id="${escapeHtml(c.conversation_id)}">
                ${avatarHtml}
                <div class="convo__main">
                    <div class="convo__top">
                        <span class="convo__name">${styledName}</span>
                        <span class="convo__time">${escapeHtml(timeAgo(c.last_message_at))}</span>
                        ${unread}
                    </div>
                    <div class="convo__preview">${escapeHtml(preview)}</div>
                </div>
            </a>`;
        }).join('');

        conversationsListEl.querySelectorAll('[data-convo-id]').forEach((el) => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const id = el.getAttribute('data-convo-id');
                openConversation(id);
            });
        });
    }

    function setThreadTitleFromCache(convoId) {
        const meta = conversationsCache.find((c) => c.conversation_id === convoId);
        if (meta) {
            const F = window.STAGECORD;
            const styledName = F ? F.formatName(meta.other_forename, meta.other_surname, meta.other_username) : escapeHtml([meta.other_forename, meta.other_surname].filter(Boolean).join(' ') || meta.other_username || 'STAGECORD member');
            const link = meta.other_username
                ? `<a href="/u/${encodeURIComponent(meta.other_username)}" style="color:#FFFFFF;text-decoration:none;">${styledName}</a>`
                : styledName;
            threadTitleEl.innerHTML = link;
        } else {
            threadTitleEl.textContent = '…';
        }
    }

    function renderMessage(m) {
        const isOut = m.user_id === user.id;
        // Hydrate from row fields if present (server RPC) or from cache (realtime payload).
        const p = participantsById[m.user_id] || {};
        const forename = m.forename ?? p.forename;
        const surname = m.surname ?? p.surname;
        const username = m.username ?? p.username;
        const avatar_url = m.avatar_url ?? p.avatar_url;
        const name = [forename, surname].filter(Boolean).join(' ') || username || '?';
        const initial = (name[0] || '?').toUpperCase();
        const avatarHtml = avatar_url
            ? `<div class="msg__avatar" style="background-image:url('${escapeHtml(avatar_url)}');"></div>`
            : `<div class="msg__avatar">${escapeHtml(initial)}</div>`;
        const idAttr = m.id ? ` data-msg-id="${escapeHtml(m.id)}"` : '';
        const pendingClass = m._pending ? ' msg__bubble--pending' : '';
        return `<div class="msg${isOut ? ' msg--out' : ''}"${idAttr}>
            ${avatarHtml}
            <div>
                <div class="msg__bubble${pendingClass}">${escapeHtml(m.content)}</div>
                <div class="msg__time">${m.created_at ? escapeHtml(fmtTime(m.created_at)) : ''}</div>
            </div>
        </div>`;
    }

    function appendMessageDOM(m) {
        if (m.id && renderedMsgIds.has(m.id)) return false;
        if (m.id) renderedMsgIds.add(m.id);
        const placeholder = threadMessagesEl.querySelector('.inbox-placeholder');
        if (placeholder) placeholder.remove();
        const wasNearBottom = threadMessagesEl.scrollHeight - threadMessagesEl.scrollTop - threadMessagesEl.clientHeight < 80;
        threadMessagesEl.insertAdjacentHTML('beforeend', renderMessage(m));
        if (wasNearBottom) {
            threadMessagesEl.scrollTop = threadMessagesEl.scrollHeight;
        }
        return true;
    }

    async function openConversation(convoId) {
        activeConvoId = convoId;
        renderedMsgIds = new Set();
        history.replaceState(null, '', `?c=${convoId}`);
        setThreadTitleFromCache(convoId);

        threadMessagesEl.innerHTML = '<div class="inbox-placeholder">Loading…</div>';
        composerForm.hidden = false;
        composerInput.value = '';
        composerSend.disabled = true;

        const { data: messages, error } = await sb.rpc('get_conversation_messages', {
            p_conversation_id: convoId,
            p_limit: 200
        });

        if (error) {
            console.error('get_conversation_messages failed:', error);
            threadMessagesEl.innerHTML = `<div class="inbox-placeholder">Couldn't load messages: ${escapeHtml(error.message || '')}</div>`;
            return;
        }

        // Hydrate participant cache from server rows.
        (messages || []).forEach((m) => {
            if (m.user_id && (m.forename || m.surname || m.username || m.avatar_url)) {
                participantsById[m.user_id] = {
                    id: m.user_id,
                    forename: m.forename,
                    surname: m.surname,
                    username: m.username,
                    avatar_url: m.avatar_url
                };
            }
        });

        if (!messages || messages.length === 0) {
            threadMessagesEl.innerHTML = `<div class="inbox-placeholder">No messages yet. Say hello!</div>`;
        } else {
            threadMessagesEl.innerHTML = messages.map((m) => {
                if (m.id) renderedMsgIds.add(m.id);
                return renderMessage(m);
            }).join('');
            threadMessagesEl.scrollTop = threadMessagesEl.scrollHeight;
        }

        renderList();
        syncMobileLayout();
        composerInput.focus();

        // Bump unread → 0 in sidebar by refreshing the count.
        loadConversations();
    }

    // ---------- Realtime ----------

    async function handleRealtimeInsert(m) {
        if (!m) return;

        // 1. Update conversation list (debounced).
        debouncedRefreshList();

        // 2. Update active thread.
        if (m.conversation_id !== activeConvoId) return;
        if (renderedMsgIds.has(m.id)) return;

        // Resolve a pending optimistic bubble from same author.
        if (m.user_id === user.id) {
            const pending = threadMessagesEl.querySelector('.msg[data-pending-content]');
            if (pending && pending.getAttribute('data-pending-content') === m.content) {
                pending.setAttribute('data-msg-id', m.id);
                pending.removeAttribute('data-pending-content');
                const bubble = pending.querySelector('.msg__bubble');
                if (bubble) bubble.classList.remove('msg__bubble--pending');
                const timeEl = pending.querySelector('.msg__time');
                if (timeEl) timeEl.textContent = fmtTime(m.created_at);
                renderedMsgIds.add(m.id);
                return;
            }
        }

        // Unknown sender — refetch thread once to backfill profile fields.
        if (!participantsById[m.user_id]) {
            const { data: messages } = await sb.rpc('get_conversation_messages', {
                p_conversation_id: activeConvoId,
                p_limit: 200
            });
            if (!messages) return;
            messages.forEach((mm) => {
                if (mm.user_id && (mm.forename || mm.surname || mm.username || mm.avatar_url)) {
                    participantsById[mm.user_id] = {
                        id: mm.user_id,
                        forename: mm.forename,
                        surname: mm.surname,
                        username: mm.username,
                        avatar_url: mm.avatar_url
                    };
                }
            });
            renderedMsgIds = new Set();
            threadMessagesEl.innerHTML = messages.map((mm) => {
                if (mm.id) renderedMsgIds.add(mm.id);
                return renderMessage(mm);
            }).join('');
            threadMessagesEl.scrollTop = threadMessagesEl.scrollHeight;
            return;
        }

        appendMessageDOM(m);
    }

    function startRealtime() {
        if (messagesChannel) return;
        messagesChannel = sb
            .channel('inbox-messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => { handleRealtimeInsert(payload.new); }
            )
            .subscribe();
    }

    let listRefreshTimer = null;
    function debouncedRefreshList() {
        if (listRefreshTimer) return;
        listRefreshTimer = setTimeout(() => {
            listRefreshTimer = null;
            loadConversations();
        }, 400);
    }

    // ---------- Composer ----------

    composerInput.addEventListener('input', () => {
        composerSend.disabled = composerInput.value.trim().length === 0;
    });

    composerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = composerInput.value.trim();
        if (!content || !activeConvoId) return;

        // Optimistic append.
        const optimistic = {
            id: null,
            user_id: user.id,
            content: content,
            created_at: new Date().toISOString(),
            _pending: true
        };
        const placeholder = threadMessagesEl.querySelector('.inbox-placeholder');
        if (placeholder) placeholder.remove();
        const html = renderMessage(optimistic);
        const wrap = document.createElement('div');
        wrap.innerHTML = html;
        const node = wrap.firstElementChild;
        node.setAttribute('data-pending-content', content);
        threadMessagesEl.appendChild(node);
        threadMessagesEl.scrollTop = threadMessagesEl.scrollHeight;

        composerInput.value = '';
        composerSend.disabled = true;

        const { data, error } = await sb.rpc('send_message', {
            p_conversation_id: activeConvoId,
            p_content: content
        });

        if (error) {
            console.error('send_message failed:', error);
            const bubble = node.querySelector('.msg__bubble');
            if (bubble) {
                bubble.classList.remove('msg__bubble--pending');
                bubble.classList.add('msg__bubble--failed');
                bubble.title = error.message || 'Failed to send';
            }
            return;
        }

        // RPC now returns the inserted row. Reconcile the optimistic bubble.
        const row = Array.isArray(data) ? data[0] : data;
        if (row && row.id && node.isConnected) {
            node.setAttribute('data-msg-id', row.id);
            node.removeAttribute('data-pending-content');
            const bubble = node.querySelector('.msg__bubble');
            if (bubble) bubble.classList.remove('msg__bubble--pending');
            const timeEl = node.querySelector('.msg__time');
            if (timeEl) timeEl.textContent = fmtTime(row.created_at);
            renderedMsgIds.add(row.id);
        }

        // Refresh conversation list (also picks up last_message_at + ordering).
        loadConversations();
    });

    // ---------- Compose modal ----------

    function openCompose() {
        composeOverlay.setAttribute('data-open', '');
        composeSearch.value = '';
        composeSearch.focus();
        loadMembers();
    }
    function closeCompose() {
        composeOverlay.removeAttribute('data-open');
    }
    composeBtn.addEventListener('click', openCompose);
    composeClose.addEventListener('click', closeCompose);
    composeOverlay.addEventListener('click', (e) => {
        if (e.target === composeOverlay) closeCompose();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && composeOverlay.hasAttribute('data-open')) closeCompose();
    });

    async function loadMembers() {
        if (allMembers) {
            renderCompose(allMembers);
            return;
        }
        composeResults.innerHTML = `<div class="compose-empty">Loading members…</div>`;
        const { data, error } = await sb.rpc('list_public_profiles');
        if (error) {
            console.error('list_public_profiles failed:', error);
            composeResults.innerHTML = `<div class="compose-empty">Couldn't load members: ${escapeHtml(error.message || '')}</div>`;
            return;
        }
        allMembers = (data || []).filter((r) => r && r.username && r.id !== user.id);
        renderCompose(allMembers);
    }

    function renderCompose(list) {
        if (!list || list.length === 0) {
            composeResults.innerHTML = `<div class="compose-empty">No members found.</div>`;
            return;
        }
        const F = window.STAGECORD;
        composeResults.innerHTML = list.slice(0, 50).map((m) => {
            const plainName = F ? F.plainName(m.forename, m.surname, m.username) : ([m.forename, m.surname].filter(Boolean).join(' ') || m.username);
            const styledName = F ? F.formatName(m.forename, m.surname, m.username) : escapeHtml(plainName);
            const initial = (plainName[0] || '?').toUpperCase();
            const avatarHtml = m.avatar_url
                ? `<div class="compose-result__avatar" style="background-image:url('${escapeHtml(m.avatar_url)}');"></div>`
                : `<div class="compose-result__avatar">${escapeHtml(initial)}</div>`;
            return `<div class="compose-result" data-username="${escapeHtml(m.username)}">
                ${avatarHtml}
                <div class="compose-result__main">
                    <div class="compose-result__name">${styledName}</div>
                    <div class="compose-result__handle">@${escapeHtml(m.username)}</div>
                </div>
            </div>`;
        }).join('');

        composeResults.querySelectorAll('[data-username]').forEach((el) => {
            el.addEventListener('click', () => startConversationWith(el.getAttribute('data-username'), el));
        });
    }

    async function startConversationWith(username, rowEl) {
        if (rowEl) rowEl.style.opacity = '0.6';
        const { data, error } = await sb.rpc('start_or_get_conversation', { p_target_username: username });
        if (error || !data) {
            console.error('start_or_get_conversation failed:', error);
            alert('Could not start conversation: ' + (error?.message || 'unknown error'));
            if (rowEl) rowEl.style.opacity = '';
            return;
        }
        closeCompose();
        await loadConversations();
        await openConversation(data);
    }

    let composeDebounce = null;
    composeSearch.addEventListener('input', () => {
        clearTimeout(composeDebounce);
        composeDebounce = setTimeout(() => {
            if (!allMembers) return;
            const q = composeSearch.value.trim().toLowerCase();
            if (!q) {
                renderCompose(allMembers);
                return;
            }
            const filtered = allMembers.filter((m) => {
                const hay = [m.forename, m.surname, m.username, m.bio].filter(Boolean).join(' ').toLowerCase();
                return hay.includes(q);
            });
            renderCompose(filtered);
        }, 120);
    });

    // ---------- Initial load ----------

    await loadConversations();
    startRealtime();

    const params = new URLSearchParams(window.location.search);
    const convoFromUrl = params.get('c');
    if (convoFromUrl) {
        await openConversation(convoFromUrl);
    } else {
        syncMobileLayout();
    }

    // Fallback poll — if realtime drops, we still refresh every 30s.
    setInterval(() => {
        if (document.hidden) return;
        loadConversations();
    }, 30000);
})();
