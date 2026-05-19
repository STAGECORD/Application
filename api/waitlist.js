const SUPABASE_URL = 'https://jkleiomqhmrnpsflyuoz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Q3FwltyNkd42CJ7gJ8meoA_txr9jqEW';
const FROM_EMAIL = 'STAGECORD <noreply@stagecord.com>';

const ALLOWED_ROLES = ['artist', 'fan'];
const ALLOWED_DISCIPLINES = new Set([
    'vocalist', 'songwriter', 'composer', 'producer', 'dj-beatmaker',
    'guitarist', 'bassist', 'drummer', 'pianist', 'multi-instrumentalist',
    'dancer', 'choreographer', 'comedian', 'podcaster',
    'visual-artist', 'filmmaker', 'photographer'
]);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }
    body = body || {};

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const role = String(body.role || '').trim();
    const wantsUpdates = !!body.wantsUpdates;
    const website = String(body.website || '').trim();
    const disciplinesRaw = Array.isArray(body.disciplines) ? body.disciplines : [];
    const disciplines = role === 'artist'
        ? Array.from(new Set(disciplinesRaw
            .filter((s) => typeof s === 'string')
            .filter((s) => ALLOWED_DISCIPLINES.has(s))))
        : [];

    // Honeypot: hidden field that real users never see/fill. If it has any
    // value, the submission almost certainly comes from a form-scraping bot.
    // Return 200 (silent success) so bots can't tell they were filtered.
    if (website) {
        console.warn('Honeypot tripped:', { name, email, role, website });
        return res.status(200).json({ ok: true, emailed: false });
    }

    // Cloudflare Turnstile verification (when TURNSTILE_SECRET_KEY is set).
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
        const tsToken = String(body.turnstileToken || '').trim();
        if (!tsToken) {
            return res.status(400).json({ error: 'Captcha missing' });
        }
        try {
            const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ secret: turnstileSecret, response: tsToken })
            });
            const verifyJson = await verifyRes.json();
            if (!verifyJson.success) {
                console.warn('Turnstile rejected:', verifyJson);
                return res.status(403).json({ error: 'Captcha failed' });
            }
        } catch (err) {
            console.error('Turnstile verify call failed:', err);
            return res.status(500).json({ error: 'Captcha check failed' });
        }
    }

    if (!name || name.length > 200) {
        return res.status(400).json({ error: 'Name required' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
        return res.status(400).json({ error: 'Valid email required' });
    }
    if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    const message = wantsUpdates ? 'wants_updates: true' : null;
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ name, email, role, message, disciplines })
    });

    if (!insertRes.ok) {
        let errPayload = {};
        try { errPayload = await insertRes.json(); } catch {}
        if (errPayload.code === '23505') {
            return res.status(200).json({ ok: true, duplicate: true });
        }
        console.error('Supabase insert failed:', insertRes.status, errPayload);
        return res.status(500).json({ error: 'Could not save signup' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.warn('RESEND_API_KEY missing — saved to waitlist but no email sent. Available env keys:', Object.keys(process.env).filter(k => !k.startsWith('AWS_')).join(', '));
        return res.status(200).json({ ok: true, emailed: false });
    }

    const roleLabel = role === 'artist' ? 'Artist' : 'General user / Fan';
    const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: FROM_EMAIL,
            to: [email],
            subject: "You're on the STAGECORD waitlist",
            html: buildEmailHtml(name, roleLabel),
            text: buildEmailText(name, roleLabel)
        })
    });

    if (!emailRes.ok) {
        const errText = await emailRes.text().catch(() => '');
        console.error('Resend send failed:', emailRes.status, errText);
        return res.status(200).json({ ok: true, emailed: false });
    }

    return res.status(200).json({ ok: true, emailed: true });
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function buildEmailText(name, roleLabel) {
    return `Hi ${name},

Thanks for joining the STAGECORD waitlist as ${roleLabel}.

We're letting people in role-by-role across 2026, and we'll send you an invite the moment your wave opens.

A few things to expect:
- We'll only email you when there's something real to share
- Your invite will land in this inbox — keep an eye out
- This is an automated message — please don't reply

See you soon,
The STAGECORD team

---
STAGECORD · Closed Beta · 2026
stagecord.com`;
}

function buildEmailHtml(name, roleLabel) {
    const safeName = escapeHtml(name);
    const safeRole = escapeHtml(roleLabel);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>You're on the STAGECORD waitlist</title>
</head>
<body style="margin:0;padding:0;background:#02040C;font-family:'Helvetica Neue',Arial,sans-serif;color:#F1F1F4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#02040C;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:linear-gradient(180deg,#0B1A38 0%,#060B1A 100%);border-radius:14px;">
        <tr><td style="padding:40px;">
          <h1 style="margin:0 0 6px 0;font-size:32px;font-weight:300;letter-spacing:0.02em;color:#FFFFFF;">
            <span style="font-weight:700;">STAGE</span><span style="font-weight:300;">CORD</span>
          </h1>
          <p style="margin:0 0 32px 0;font-size:12px;color:#7E89A6;letter-spacing:0.08em;text-transform:uppercase;">Closed Beta · 2026</p>

          <h2 style="margin:0 0 20px 0;font-size:24px;font-weight:600;color:#FFFFFF;line-height:1.3;">You're on the list, ${safeName}.</h2>

          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#D1D6E0;">
            Thanks for joining the STAGECORD waitlist as <strong style="color:#FFFFFF;">${safeRole}</strong>.
          </p>
          <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#D1D6E0;">
            We're letting people in role-by-role across 2026 and we'll send you an invite the moment your wave opens.
          </p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0 0;border-top:1px solid rgba(255,255,255,0.08);">
            <tr><td style="padding-top:18px;">
              <p style="margin:0 0 10px 0;font-size:13px;color:#7E89A6;text-transform:uppercase;letter-spacing:0.08em;">A few things to expect</p>
              <ul style="margin:0;padding:0 0 0 18px;color:#D1D6E0;font-size:15px;line-height:1.7;">
                <li>We'll only email you when there's something real to share.</li>
                <li>Your invite will land in this inbox — keep an eye out.</li>
                <li>This is an automated message — please don't reply.</li>
              </ul>
            </td></tr>
          </table>

          <p style="margin:32px 0 0 0;font-size:15px;line-height:1.6;color:#D1D6E0;">See you soon,<br><span style="color:#FFFFFF;">The STAGECORD team</span></p>
        </td></tr>
      </table>

      <p style="margin:24px 0 0 0;font-size:12px;color:#5A6480;">
        STAGECORD · Closed Beta · 2026 · <a href="https://stagecord.com" style="color:#7E89A6;text-decoration:underline;">stagecord.com</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}
