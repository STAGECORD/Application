const SUPABASE_URL = 'https://jkleiomqhmrnpsflyuoz.supabase.co';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
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

    const url = new URL(req.url, `http://${req.headers.host || 'x'}`);
    const includeDeleted = url.searchParams.get('include_deleted') === 'true';

    const baseSelect = 'select=id,name,email,role,disciplines,created_at,invite_sent_at,invite_used_at,deleted_at';
    const filter = includeDeleted ? '' : '&deleted_at=is.null';
    const fetchUrl = `${SUPABASE_URL}/rest/v1/waitlist?${baseSelect}${filter}&order=created_at.desc`;

    const fetchRes = await fetch(fetchUrl, {
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
        }
    });

    if (!fetchRes.ok) {
        const errText = await fetchRes.text().catch(() => '');
        console.error('list-waitlist supabase fetch failed:', fetchRes.status, errText.slice(0, 400));
        return res.status(500).json({ error: 'Lookup failed', status: fetchRes.status, detail: errText.slice(0, 400) });
    }

    const rows = await fetchRes.json();
    return res.status(200).json({ rows });
}
