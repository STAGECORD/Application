// Shared like button. Renders into a passed container with given target.
//
// Usage: STAGECORD_Likes.render({
//   container: <div>,
//   targetType: 'post' | 'track',
//   targetId: uuid,
//   initialCount: int,
//   initiallyLiked: bool,
//   currentUserId: uuid|null   // null hides toggle behaviour and routes to /login/
// });
window.STAGECORD_Likes = (function () {
    const sb = window.supabaseClient;

    function escapeHtml(s) {
        return String(s).replace(/[<>&"']/g, (c) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function heartSvg(filled) {
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>`;
    }

    function setState(btn, liked, count) {
        btn.dataset.liked = liked ? '1' : '0';
        btn.classList.toggle('like-btn--active', liked);
        const heart = btn.querySelector('.like-btn__icon');
        if (heart) heart.innerHTML = heartSvg(liked);
        const countEl = btn.querySelector('.like-btn__count');
        if (countEl) countEl.textContent = count;
        const labelEl = btn.querySelector('.like-btn__label');
        if (labelEl) labelEl.textContent = count === 1 ? 'like' : 'likes';
    }

    function render({ container, targetType, targetId, initialCount, initiallyLiked, currentUserId }) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'like-btn' + (initiallyLiked ? ' like-btn--active' : '');
        btn.dataset.liked = initiallyLiked ? '1' : '0';
        btn.dataset.targetType = targetType;
        btn.dataset.targetId = targetId;
        btn.innerHTML = `
            <span class="like-btn__icon">${heartSvg(initiallyLiked)}</span>
            <span class="like-btn__count">${initialCount || 0}</span>
            <span class="like-btn__label">${(initialCount || 0) === 1 ? 'like' : 'likes'}</span>
        `;
        container.appendChild(btn);

        btn.addEventListener('click', async () => {
            if (!currentUserId) {
                window.location.href = '/login/';
                return;
            }

            const wasLiked = btn.dataset.liked === '1';
            const oldCount = parseInt(btn.querySelector('.like-btn__count').textContent, 10) || 0;
            const optimisticCount = wasLiked ? Math.max(0, oldCount - 1) : oldCount + 1;
            setState(btn, !wasLiked, optimisticCount);
            btn.disabled = true;

            const { data, error } = await sb.rpc('toggle_like', {
                p_target_type: targetType,
                p_target_id: targetId
            });

            btn.disabled = false;

            if (error) {
                console.error('toggle_like failed:', error);
                setState(btn, wasLiked, oldCount);
                return;
            }

            const row = data && data[0] ? data[0] : null;
            if (row) {
                setState(btn, !!row.liked, Number(row.like_count) || 0);
            }
        });

        return btn;
    }

    return { render };
})();
