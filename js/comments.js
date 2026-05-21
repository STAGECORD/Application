// Shared comments UI used by /welcome/ feed and /u/<username> posts.
// Inject the markup once after a post card is in the DOM, then call
// window.STAGECORD_Comments.attach({ post element, postId, currentUserId }).
//
// Replies are flat (single level): clicking "Reply" on a top-level comment
// opens an inline composer that posts a child comment with
// parent_comment_id pointing at that top. Replies don't get their own
// reply button — to keep threads readable.
window.STAGECORD_Comments = (function () {
    const sb = window.supabaseClient;

    function escapeHtml(s) {
        return String(s).replace(/[<>&"']/g, (c) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function timeAgo(iso) {
        const t = new Date(iso).getTime();
        const diff = (Date.now() - t) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function renderComment(c, currentUserId, isReply) {
        const F = window.STAGECORD;
        const plainName = F ? F.plainName(c.forename, c.surname, c.username) : ([c.forename, c.surname].filter(Boolean).join(' ') || c.username || 'STAGECORD member');
        const styledName = F ? F.formatName(c.forename, c.surname, c.username) : escapeHtml(plainName);
        const initial = (plainName[0] || '?').toUpperCase();
        const avatarHtml = c.avatar_url
            ? `<div class="cm__avatar" style="background-image:url('${escapeHtml(c.avatar_url)}');"></div>`
            : `<div class="cm__avatar">${escapeHtml(initial)}</div>`;
        const handleLink = c.username
            ? `<a class="cm__author" href="/u/${encodeURIComponent(c.username)}">${styledName}</a>`
            : `<span class="cm__author">${styledName}</span>`;
        const isOwn = c.user_id === currentUserId;
        const deleteBtn = isOwn
            ? `<button class="cm__delete" data-delete-comment="${escapeHtml(c.id)}" aria-label="Delete">×</button>`
            : '';
        const replyBtn = !isReply && currentUserId
            ? `<button class="cm__reply-btn" data-reply-to="${escapeHtml(c.id)}">Reply</button>`
            : '';
        return `<div class="cm${isReply ? ' cm--reply' : ''}" data-comment-id="${escapeHtml(c.id)}">
            ${avatarHtml}
            <div class="cm__body">
                <div class="cm__head">
                    ${handleLink}
                    <span class="cm__time">${escapeHtml(timeAgo(c.created_at))}</span>
                    ${deleteBtn}
                </div>
                <p class="cm__content">${escapeHtml(c.content)}</p>
                ${replyBtn}
                <div class="cm__reply-composer" data-reply-composer hidden></div>
            </div>
        </div>`;
    }

    function attachDeleteHandlers(scope, thread, postId, currentUserId) {
        scope.querySelectorAll('[data-delete-comment]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!confirm('Delete this comment?')) return;
                const id = btn.getAttribute('data-delete-comment');
                const { error } = await sb.from('post_comments').delete().eq('id', id);
                if (error) {
                    alert('Could not delete: ' + (error.message || 'try again'));
                    return;
                }
                loadAndRender(thread, postId, currentUserId);
                refreshCount(thread, postId);
            });
        });
    }

    function attachReplyHandlers(scope, thread, postId, currentUserId) {
        scope.querySelectorAll('[data-reply-to]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const parentId = btn.getAttribute('data-reply-to');
                const composer = btn.parentElement.querySelector('[data-reply-composer]');
                if (!composer) return;

                if (!composer.hidden && composer.innerHTML.trim()) {
                    composer.hidden = true;
                    composer.innerHTML = '';
                    return;
                }

                composer.innerHTML = `
                    <input type="text" class="cm-composer__input" placeholder="Write a reply…" maxlength="500">
                    <button type="button" class="emoji-trigger cm-composer__emoji" aria-label="Insert emoji">😊</button>
                    <button type="button" class="cm-composer__btn" disabled>Reply</button>
                `;
                composer.hidden = false;

                const input = composer.querySelector('.cm-composer__input');
                const emojiBtn = composer.querySelector('.cm-composer__emoji');
                const submitBtn = composer.querySelector('.cm-composer__btn');
                if (emojiBtn && window.STAGECORD?.EmojiPicker) {
                    window.STAGECORD.EmojiPicker.attach(emojiBtn, input);
                }
                input.focus();
                input.addEventListener('input', () => {
                    submitBtn.disabled = input.value.trim().length === 0;
                });
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !submitBtn.disabled) {
                        e.preventDefault();
                        submitBtn.click();
                    }
                });
                submitBtn.addEventListener('click', async () => {
                    const content = input.value.trim();
                    if (!content) return;
                    submitBtn.disabled = true;
                    submitBtn.textContent = '…';
                    const { error } = await sb.from('post_comments').insert({
                        post_id: postId,
                        user_id: currentUserId,
                        content,
                        parent_comment_id: parentId
                    });
                    submitBtn.textContent = 'Reply';
                    if (error) {
                        console.error('Reply insert failed:', error);
                        alert('Could not post reply: ' + (error.message || 'try again'));
                        return;
                    }
                    composer.innerHTML = '';
                    composer.hidden = true;
                    await loadAndRender(thread, postId, currentUserId);
                    refreshCount(thread, postId);
                });
            });
        });
    }

    async function loadAndRender(thread, postId, currentUserId) {
        const list = thread.querySelector('[data-cm-list]');
        list.innerHTML = '<div class="cm-empty">Loading…</div>';
        const { data: comments, error } = await sb.rpc('get_post_comments', { p_post_id: postId });
        if (error) {
            console.error('get_post_comments failed:', error);
            list.innerHTML = `<div class="cm-empty">Couldn't load comments.</div>`;
            return;
        }
        if (!comments || comments.length === 0) {
            list.innerHTML = `<div class="cm-empty">No comments yet.</div>`;
            return;
        }

        const tops = comments.filter((c) => !c.parent_comment_id);
        const repliesByParent = {};
        comments.filter((c) => c.parent_comment_id).forEach((r) => {
            (repliesByParent[r.parent_comment_id] ||= []).push(r);
        });

        list.innerHTML = tops.map((top) => {
            const replies = repliesByParent[top.id] || [];
            const replyHtml = replies
                .map((r) => renderComment(r, currentUserId, true))
                .join('');
            const repliesBlock = replies.length
                ? `<div class="cm-replies">${replyHtml}</div>`
                : '';
            return renderComment(top, currentUserId, false) + repliesBlock;
        }).join('');

        attachDeleteHandlers(list, thread, postId, currentUserId);
        attachReplyHandlers(list, thread, postId, currentUserId);
    }

    async function refreshCount(thread, postId) {
        const { count } = await sb
            .from('post_comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);
        const toggle = thread.parentElement.querySelector('[data-cm-toggle]');
        if (toggle && typeof count === 'number') {
            toggle.textContent = count === 0
                ? 'Add a comment'
                : (count === 1 ? '1 comment' : `${count} comments`);
        }
    }

    function attach({ postElement, postId, currentUserId }) {
        if (!postElement || postElement.querySelector('[data-cm-thread]')) return;

        const thread = document.createElement('div');
        thread.className = 'cm-thread';
        thread.setAttribute('data-cm-thread', '');
        thread.hidden = true;

        const composerHtml = currentUserId
            ? `<div class="cm-composer">
                <input type="text" class="cm-composer__input" placeholder="Write a comment…" maxlength="500">
                <button type="button" class="emoji-trigger cm-composer__emoji" aria-label="Insert emoji">😊</button>
                <button type="button" class="cm-composer__btn" disabled>Post</button>
            </div>`
            : `<div class="cm-empty"><a href="/login/" style="color:#FFFFFF;">Log in</a> to leave a comment.</div>`;

        thread.innerHTML = `
            <div class="cm-list" data-cm-list></div>
            ${composerHtml}
        `;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'cm-toggle';
        toggle.setAttribute('data-cm-toggle', '');
        toggle.textContent = '…';

        postElement.appendChild(toggle);
        postElement.appendChild(thread);

        refreshCount(thread, postId);

        toggle.addEventListener('click', async () => {
            thread.hidden = !thread.hidden;
            if (!thread.hidden && !thread.dataset.loaded) {
                await loadAndRender(thread, postId, currentUserId);
                thread.dataset.loaded = '1';
            }
        });

        if (currentUserId) {
            const input = thread.querySelector('.cm-composer > .cm-composer__input');
            const btn = thread.querySelector('.cm-composer > .cm-composer__btn');
            const emojiBtn = thread.querySelector('.cm-composer > .cm-composer__emoji');
            if (emojiBtn && input && window.STAGECORD?.EmojiPicker) {
                window.STAGECORD.EmojiPicker.attach(emojiBtn, input);
            }
            if (input && btn) {
                input.addEventListener('input', () => {
                    btn.disabled = input.value.trim().length === 0;
                });
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !btn.disabled) {
                        e.preventDefault();
                        btn.click();
                    }
                });
                btn.addEventListener('click', async () => {
                    const content = input.value.trim();
                    if (!content) return;
                    btn.disabled = true;
                    btn.textContent = '…';
                    const { error } = await sb.from('post_comments').insert({
                        post_id: postId,
                        user_id: currentUserId,
                        content,
                        parent_comment_id: null
                    });
                    btn.textContent = 'Post';
                    if (error) {
                        console.error('Comment insert failed:', error);
                        alert('Could not post comment: ' + (error.message || 'try again'));
                        return;
                    }
                    input.value = '';
                    btn.disabled = true;
                    if (thread.hidden) thread.hidden = false;
                    await loadAndRender(thread, postId, currentUserId);
                    thread.dataset.loaded = '1';
                    refreshCount(thread, postId);
                });
            }
        }
    }

    return { attach, refreshCount };
})();
