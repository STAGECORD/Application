const SUPABASE_URL = 'https://jkleiomqhmrnpsflyuoz.supabase.co';
const FROM_EMAIL = 'STAGECORD <noreply@stagecord.com>';
const SITE_URL = 'https://stagecord.com';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const adminSecret = process.env.ADMIN_SECRET;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!adminSecret || !serviceKey || !resendKey) {
        return res.status(500).json({ error: 'Server is missing ADMIN_SECRET, SUPABASE_SERVICE_ROLE_KEY or RESEND_API_KEY env var.' });
    }

    const auth = req.headers['authorization'] || req.headers['Authorization'];
    if (!auth || auth !== `Bearer ${adminSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
    }
    body = body || {};

    const emails = Array.isArray(body.emails) ? body.emails : [];
    if (emails.length === 0) {
        return res.status(400).json({ error: 'Provide an emails array.' });
    }

    const results = [];

    for (const rawEmail of emails) {
        const email = String(rawEmail || '').trim().toLowerCase();
        if (!email) {
            results.push({ email: rawEmail, ok: false, error: 'empty' });
            continue;
        }

        const fetchRes = await fetch(`${SUPABASE_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}&select=id,name,email,role,invite_token,invite_used_at`, {
            headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`
            }
        });

        if (!fetchRes.ok) {
            const errText = await fetchRes.text().catch(() => '');
            results.push({ email, ok: false, error: `lookup_failed: ${fetchRes.status} ${errText.slice(0,80)}` });
            continue;
        }

        const rows = await fetchRes.json();
        if (rows.length === 0) {
            results.push({ email, ok: false, error: 'not_in_waitlist' });
            continue;
        }

        const row = rows[0];
        if (row.invite_used_at) {
            results.push({ email, ok: false, error: 'already_used' });
            continue;
        }

        let token = row.invite_token;
        if (!token) {
            token = crypto.randomUUID();
            const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/waitlist?id=eq.${row.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': serviceKey,
                    'Authorization': `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ invite_token: token, invite_sent_at: new Date().toISOString() })
            });
            if (!updateRes.ok) {
                const errText = await updateRes.text().catch(() => '');
                results.push({ email, ok: false, error: `token_save_failed: ${updateRes.status} ${errText.slice(0,80)}` });
                continue;
            }
        } else {
            await fetch(`${SUPABASE_URL}/rest/v1/waitlist?id=eq.${row.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': serviceKey,
                    'Authorization': `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ invite_sent_at: new Date().toISOString() })
            });
        }

        const inviteUrl = `${SITE_URL}/signup/?invite=${token}`;
        const roleLabel = row.role === 'artist' ? 'Artist' : 'General user / Fan';
        const name = row.name || 'there';

        const sendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: [email],
                subject: 'Your STAGECORD invite is here',
                html: buildInviteHtml(name, roleLabel, inviteUrl),
                text: buildInviteText(name, roleLabel, inviteUrl)
            })
        });

        if (!sendRes.ok) {
            const errText = await sendRes.text().catch(() => '');
            results.push({ email, ok: false, error: `email_failed: ${sendRes.status} ${errText.slice(0,120)}` });
            continue;
        }

        results.push({ email, ok: true });
    }

    return res.status(200).json({ results });
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function buildInviteText(name, roleLabel, url) {
    return `Hi ${name},

Your invite to STAGECORD is ready. Click the link below to claim your account.

${url}

Once you click the link you'll set a password and your account will be live as ${roleLabel}.

If you didn't request this invite, you can safely ignore the email.

— The STAGECORD team

---
STAGECORD · Closed Beta · 2026
stagecord.com`;
}

function buildInviteHtml(name, roleLabel, url) {
    const safeName = escapeHtml(name);
    const safeRole = escapeHtml(roleLabel);
    const safeUrl = escapeHtml(url);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your STAGECORD invite</title>
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

          <h2 style="margin:0 0 20px 0;font-size:24px;font-weight:600;color:#FFFFFF;line-height:1.3;">You're in, ${safeName}.</h2>

          <p style="margin:0 0 28px 0;font-size:16px;line-height:1.6;color:#D1D6E0;">
            Your invite to STAGECORD is ready. The link below will create your <strong style="color:#FFFFFF;">${safeRole}</strong> account once you set a password.
          </p>

          <div style="margin:0 0 28px 0;">
            <a href="${safeUrl}" style="display:inline-block;background:#FFFFFF;color:#0B0B0F;padding:14px 28px;border-radius:999px;font-size:16px;font-weight:600;text-decoration:none;">Claim your account</a>
          </div>

          <p style="margin:0 0 12px 0;font-size:13px;color:#7E89A6;">Or copy and paste this link into your browser:</p>
          <p style="margin:0 0 24px 0;font-size:13px;color:#D1D6E0;word-break:break-all;">${safeUrl}</p>

          <p style="margin:24px 0 0 0;font-size:13px;color:#7E89A6;">If you didn't expect this email, you can safely ignore it. Invites are single-use.</p>
        </td></tr>
      </table>

      <p style="margin:24px 0 0 0;font-size:12px;color:#5A6480;">
        STAGECORD · Closed Beta · 2026 · <a href="${SITE_URL}" style="color:#7E89A6;text-decoration:underline;">stagecord.com</a>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}
