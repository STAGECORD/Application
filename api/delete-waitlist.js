const SUPABASE_URL = 'https://jkleiomqhmrnpsflyuoz.supabase.co';

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
        res.setHeader('Allow', 'POST, DELETE');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const adminSecret = process.env.ADMIN_SECRET;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!adminSecret || !serviceKey) {
        return res.status(500).json({ error: 'Server is missing ADMIN_SECRET or SUPABASE_SERVICE_ROLE_KEY env var.' });
    }

    const auth = req.headers['authorization'] || req.headers['Authorization'];
    if (!auth || auth !== `Bearer ${adminSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const email = String(body.email || '').trim().toLowerCase();
    if (!email) {
        return res.status(400).json({ error: 'Missing email' });
    }

    const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/waitlist?email=eq.${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Prefer': 'return=representation'
        }
    });

    if (!deleteRes.ok) {
        const errText = await deleteRes.text().catch(() => '');
        console.error('delete-waitlist supabase delete failed:', deleteRes.status, errText.slice(0, 400));
        return res.status(500).json({ error: 'Delete failed', status: deleteRes.status, detail: errText.slice(0, 400) });
    }

    const deleted = await deleteRes.json().catch(() => []);
    return res.status(200).json({ ok: true, deleted: deleted.length });
}
