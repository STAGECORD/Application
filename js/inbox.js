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
    const inboxBack = document.getElementById('inboxBack');

    let activeConvoId = null;
    let conversationsCache = [];

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

    function syncMobileLayout() {
        // On mobile, show only one panel at a time based on activeConvoId.
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
        renderList();
    }

    function renderList() {
        if (conversationsCache.length === 0) {
            conversationsListEl.innerHTML = `<div class="inbox-empty">No conversations yet. Start one from someone's <strong>profile</strong>.</div>`;
            return;
        }
        conversationsListEl.innerHTML = conversationsCache.map((c) => {
            const name = [c.other_forename, c.other_surname].filter(Boolean).join(' ') || c.other_username || 'STAGECORD member';
            const initial = (name[0] || '?').toUpperCase();
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
                        <span class="convo__name">${escapeHtml(name)}</span>
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

    async function openConversation(convoId) {
        activeConvoId = convoId;
        history.replaceState(null, '', `?c=${convoId}`);

        const meta = conversationsCache.find((c) => c.conversation_id === convoId);
        if (meta) {
            const name = [meta.other_forename, meta.other_surname].filter(Boolean).join(' ') || meta.other_username || 'STAGECORD member';
            const link = meta.other_username
                ? `<a href="/u/${encodeURIComponent(meta.other_username)}" style="color:#FFFFFF;text-decoration:none;">${escapeHtml(name)}</a>`
                : escapeHtml(name);
            threadTitleEl.innerHTML = link;
        } else {
            threadTitleEl.textContent = '…';
        }

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

        if (!messages || messages.length === 0) {
            threadMessagesEl.innerHTML = `<div class="inbox-placeholder">No messages yet. Say hello!</div>`;
        } else {
            threadMessagesEl.innerHTML = messages.map(renderMessage).join('');
            threadMessagesEl.scrollTop = threadMessagesEl.scrollHeight;
        }

        renderList();
        syncMobileLayout();
        composerInput.focus();

        // refresh count for sidebar — user just read the convo so unread should drop
        loadConversations();
    }

    function renderMessage(m) {
        const isOut = m.user_id === user.id;
        const name = [m.forename, m.surname].filter(Boolean).join(' ') || m.username || '?';
        const initial = (name[0] || '?').toUpperCase();
        const avatarHtml = m.avatar_url
            ? `<div class="msg__avatar" style="background-image:url('${escapeHtml(m.avatar_url)}');"></div>`
            : `<div class="msg__avatar">${escapeHtml(initial)}</div>`;
        return `<div class="msg${isOut ? ' msg--out' : ''}">
            ${avatarHtml}
            <div>
                <div class="msg__bubble">${escapeHtml(m.content)}</div>
                <div class="msg__time">${escapeHtml(fmtTime(m.created_at))}</div>
            </div>
        </div>`;
    }

    composerInput.addEventListener('input', () => {
        composerSend.disabled = composerInput.value.trim().length === 0;
    });

    composerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = composerInput.value.trim();
        if (!content || !activeConvoId) return;

        composerSend.disabled = true;
        composerSend.textContent = '…';

        const { error } = await sb.rpc('send_message', {
            p_conversation_id: activeConvoId,
            p_content: content
        });

        composerSend.textContent = 'Send';

        if (error) {
            console.error('send_message failed:', error);
            alert('Could not send: ' + (error.message || 'try again'));
            composerSend.disabled = composerInput.value.trim().length === 0;
            return;
        }

        composerInput.value = '';
        composerSend.disabled = true;
        await openConversation(activeConvoId);
    });

    // Initial load
    await loadConversations();

    const params = new URLSearchParams(window.location.search);
    const convoFromUrl = params.get('c');
    if (convoFromUrl) {
        await openConversation(convoFromUrl);
    } else {
        syncMobileLayout();
    }

    // Lightweight polling every 15s to pick up new messages while page is open
    setInterval(async () => {
        if (document.hidden) return;
        await loadConversations();
        if (activeConvoId) {
            const { data: messages } = await sb.rpc('get_conversation_messages', {
                p_conversation_id: activeConvoId,
                p_limit: 200
            });
            if (messages) {
                const before = threadMessagesEl.children.length;
                threadMessagesEl.innerHTML = messages.length === 0
                    ? `<div class="inbox-placeholder">No messages yet. Say hello!</div>`
                    : messages.map(renderMessage).join('');
                if (messages.length > before) {
                    threadMessagesEl.scrollTop = threadMessagesEl.scrollHeight;
                }
            }
        }
    }, 15000);
})();
