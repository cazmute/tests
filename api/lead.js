export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id, mensagens, clicou_cta, ultima_mensagem, lead_id } = req.body;

  const SUPA_URL = process.env.SUPA_URL;
  const SUPA_KEY = process.env.SUPA_KEY;

  const payload = { session_id, mensagens, clicou_cta, ultima_mensagem };

  try {
    if (!lead_id) {
      const r = await fetch(SUPA_URL + '/rest/v1/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPA_KEY,
          'Authorization': 'Bearer ' + SUPA_KEY,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      return res.status(200).json({ lead_id: d?.[0]?.id || null });
    } else {
      await fetch(SUPA_URL + '/rest/v1/leads?id=eq.' + lead_id, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPA_KEY,
          'Authorization': 'Bearer ' + SUPA_KEY,
        },
        body: JSON.stringify(payload),
      });
      return res.status(200).json({ lead_id });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Supabase request failed' });
  }
}
