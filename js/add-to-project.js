// "Add to project" popover — only shown on a track the current user owns
// (because projects link to the track owner, not anyone who finds it).
window.STAGECORD_AddToProject = (function () {
    const sb = window.supabaseClient;
    let cachedProjects = null;
    let popover = null;

    function ensureStyles() {
        if (document.getElementById('atpr-styles')) return;
        const style = document.createElement('style');
        style.id = 'atpr-styles';
        style.textContent = `
            .atpr-popover {
                position: absolute; z-index: 250;
                background: #0B1A38;
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 12px;
                padding: 8px;
                box-shadow: 0 14px 40px rgba(0,0,0,0.55);
                min-width: 240px; max-width: 320px;
                max-height: 320px; overflow-y: auto;
            }
            .atpr-popover__head {
                color: #7E89A6; font-size: 11px;
                text-transform: uppercase; letter-spacing: 0.06em;
                padding: 6px 10px 8px 10px;
            }
            .atpr-popover button.atpr-item {
                display: block; width: 100%;
                background: transparent; border: none;
                color: #FFFFFF; font-family: inherit; font-size: 14px;
                text-align: left; padding: 9px 10px;
                border-radius: 8px; cursor: pointer;
            }
            .atpr-popover button.atpr-item:hover { background: rgba(255,255,255,0.06); }
            .atpr-popover .atpr-item-meta { color: #7E89A6; font-size: 12px; margin-top: 2px; }
            .atpr-popover .atpr-empty { color: #7E89A6; font-size: 13px; padding: 10px; text-align: center; }
            .atpr-popover .atpr-create {
                margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;
            }
            .atpr-trigger {
                background: transparent; border: 1px solid rgba(255,255,255,0.12);
                color: #C2CADD; cursor: pointer;
                padding: 6px 10px; border-radius: 999px;
                font-family: inherit; font-size: 12px;
                display: inline-flex; align-items: center; gap: 6px;
            }
            .atpr-trigger:hover { color: #FFFFFF; border-color: rgba(255,255,255,0.24); }
        `;
        document.head.appendChild(style);
    }

    async function loadProjects(force) {
        if (!force && cachedProjects) return cachedProjects;
        const { data, error } = await sb.rpc('get_my_projects');
        if (error) {
            console.error('Load projects failed:', error);
            return [];
        }
        cachedProjects = data || [];
        return cachedProjects;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function closePopover() {
        if (popover && popover.parentNode) popover.parentNode.removeChild(popover);
        popover = null;
        document.removeEventListener('click', onDocClick, true);
    }
    function onDocClick(e) {
        if (popover && !popover.contains(e.target) && !e.target.closest('[data-atpr-trigger]')) {
            closePopover();
        }
    }

    async function openPopover(button, trackId) {
        ensureStyles();
        closePopover();

        popover = document.createElement('div');
        popover.className = 'atpr-popover';
        popover.innerHTML = `<div class="atpr-empty">Loading…</div>`;

        const rect = button.getBoundingClientRect();
        document.body.appendChild(popover);

        const top = rect.bottom + window.scrollY + 6;
        const left = Math.max(8, rect.left + window.scrollX - (popover.offsetWidth - rect.width));
        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;

        setTimeout(() => document.addEventListener('click', onDocClick, true), 0);

        const projects = await loadProjects(true);
        if (!projects.length) {
            popover.innerHTML = `
                <div class="atpr-popover__head">No projects yet</div>
                <div class="atpr-empty"><a href="/projects/" style="color:#FFFFFF;">Create or join a project →</a></div>
            `;
            return;
        }

        popover.innerHTML = `
            <div class="atpr-popover__head">Add to a project</div>
            ${projects.map((p) => `
                <button class="atpr-item" data-add-to="${escapeHtml(p.id)}">
                    <div>${escapeHtml(p.title)}</div>
                    <div class="atpr-item-meta">${p.member_count} member${p.member_count === 1 ? '' : 's'} · ${p.track_count} track${p.track_count === 1 ? '' : 's'}</div>
                </button>
            `).join('')}
            <div class="atpr-create">
                <a class="atpr-item" href="/projects/" style="text-decoration:none;display:block;">+ New project…</a>
            </div>
        `;

        popover.querySelectorAll('[data-add-to]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const projectId = btn.getAttribute('data-add-to');
                btn.disabled = true;
                btn.querySelector('div').textContent = 'Adding…';
                const { error } = await sb.rpc('add_track_to_project', {
                    p_project_id: projectId,
                    p_track_id: trackId
                });
                if (error) {
                    if (/duplicate/i.test(error.message || '') || error.code === '23505') {
                        btn.querySelector('div').textContent = 'Already in this project';
                    } else {
                        btn.querySelector('div').textContent = error.message || 'Could not add';
                    }
                    setTimeout(closePopover, 1500);
                    return;
                }
                cachedProjects = null;
                btn.querySelector('div').textContent = 'Added ✓';
                setTimeout(closePopover, 800);
            });
        });
    }

    function attach({ button, trackId }) {
        if (!button || !trackId) return;
        button.setAttribute('data-atpr-trigger', '');
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openPopover(button, trackId);
        });
    }

    function makeButton(trackId) {
        ensureStyles();
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'atpr-trigger';
        btn.setAttribute('data-atpr-trigger', '');
        btn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            <span>Add to project</span>
        `;
        attach({ button: btn, trackId });
        return btn;
    }

    return { attach, makeButton };
})();
