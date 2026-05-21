(function () {
    const players = new Set();
    let currentPlaying = null;

    function fmtTime(secs) {
        if (!Number.isFinite(secs) || secs < 0) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7L8 5z"/></svg>';
    const PAUSE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

    function attach(container, audioUrl) {
        if (!container || !audioUrl) return null;
        if (!window.WaveSurfer) {
            console.warn('WaveSurfer not loaded — falling back to <audio> for', audioUrl);
            const fallback = document.createElement('audio');
            fallback.controls = true;
            fallback.preload = 'none';
            fallback.src = audioUrl;
            container.replaceWith(fallback);
            return null;
        }

        container.classList.add('wf-player', 'wf-player--loading');
        container.innerHTML = `
            <button type="button" class="wf-player__play" aria-label="Play" disabled>${PLAY_ICON}</button>
            <div class="wf-player__main">
                <div class="wf-player__wave" data-wf-wave></div>
                <div class="wf-player__time">
                    <span data-wf-current>0:00</span>
                    <span data-wf-total>—</span>
                </div>
            </div>
        `;

        const playBtn = container.querySelector('.wf-player__play');
        const waveEl  = container.querySelector('[data-wf-wave]');
        const curEl   = container.querySelector('[data-wf-current]');
        const totEl   = container.querySelector('[data-wf-total]');

        const ws = WaveSurfer.create({
            container: waveEl,
            url: audioUrl,
            height: waveEl.clientHeight || 56,
            waveColor: 'rgba(255,255,255,0.35)',
            progressColor: '#43C47A',
            cursorColor: 'rgba(255,255,255,0.6)',
            cursorWidth: 1,
            barWidth: 2,
            barGap: 1,
            barRadius: 2,
            normalize: true,
            interact: true,
        });

        const handle = { ws, container, playBtn };
        players.add(handle);

        ws.on('ready', () => {
            container.classList.remove('wf-player--loading');
            playBtn.disabled = false;
            totEl.textContent = fmtTime(ws.getDuration());
        });

        ws.on('error', (err) => {
            console.warn('WaveSurfer error for', audioUrl, err);
            container.classList.remove('wf-player--loading');
            container.classList.add('wf-player--error');
            waveEl.textContent = 'Could not load audio';
            playBtn.disabled = true;
        });

        ws.on('audioprocess', () => {
            curEl.textContent = fmtTime(ws.getCurrentTime());
        });
        ws.on('seeking', () => {
            curEl.textContent = fmtTime(ws.getCurrentTime());
        });
        ws.on('play', () => {
            if (currentPlaying && currentPlaying !== handle) {
                currentPlaying.ws.pause();
            }
            currentPlaying = handle;
            playBtn.innerHTML = PAUSE_ICON;
            playBtn.setAttribute('aria-label', 'Pause');
        });
        ws.on('pause', () => {
            playBtn.innerHTML = PLAY_ICON;
            playBtn.setAttribute('aria-label', 'Play');
        });
        ws.on('finish', () => {
            playBtn.innerHTML = PLAY_ICON;
            playBtn.setAttribute('aria-label', 'Play');
            curEl.textContent = fmtTime(ws.getDuration());
        });

        playBtn.addEventListener('click', () => {
            if (playBtn.disabled) return;
            ws.playPause();
        });

        return handle;
    }

    function attachAll(root) {
        const scope = root || document;
        scope.querySelectorAll('[data-audio-url]').forEach((el) => {
            if (el.dataset.wfInited) return;
            el.dataset.wfInited = '1';
            attach(el, el.getAttribute('data-audio-url'));
        });
    }

    function destroyAll(root) {
        const scope = root || document;
        const containers = new Set(scope.querySelectorAll('[data-wf-inited="1"], .wf-player'));
        Array.from(players).forEach((p) => {
            if (!document.body.contains(p.container) || containers.has(p.container)) {
                try { p.ws.destroy(); } catch {}
                players.delete(p);
                if (currentPlaying === p) currentPlaying = null;
            }
        });
    }

    window.STAGECORD_Waveform = { attach, attachAll, destroyAll };
})();
