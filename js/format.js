// Tiny shared formatters so we apply the STAGECORD typography rules
// consistently across feed posts, comments, member cards, public
// profile, DMs and notifications.
window.STAGECORD = window.STAGECORD || {};

window.STAGECORD.escapeHtml = function (s) {
    return String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));
};

// Forename bold, surname normal/light. Either field may be empty;
// falls back to whichever is present (or username, or a placeholder).
window.STAGECORD.formatName = function (forename, surname, fallback) {
    const e = window.STAGECORD.escapeHtml;
    const fore = (forename || '').trim();
    const sur = (surname || '').trim();
    if (fore && sur) return `<strong>${e(fore)}</strong> ${e(sur)}`;
    if (fore) return `<strong>${e(fore)}</strong>`;
    if (sur) return e(sur);
    return e(fallback || 'STAGECORD member');
};

// Plain-text version (no HTML wrappers) — for places like document.title
window.STAGECORD.plainName = function (forename, surname, fallback) {
    const fore = (forename || '').trim();
    const sur = (surname || '').trim();
    if (fore && sur) return `${fore} ${sur}`;
    if (fore) return fore;
    if (sur) return sur;
    return fallback || 'STAGECORD member';
};
