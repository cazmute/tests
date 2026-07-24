// file: status.js
let cachedToken = null;
let tokenExpiresAt = 0;

async function getLivePixToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const res = await fetch('https://oauth.livepix.gg/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.LIVEPIX_CLIENT_ID,
      client_secret: process.env.LIVEPIX_CLIENT_SECRET,
      scope: 'payments:read',
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Falha ao obter token LivePix');
  }

  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { hash } = req.query;
  if (!hash) return res.status(400).json({ error: 'Missing hash' });

  console.log(`[STATUS] Consultando pagamento ${hash}`);

  try {
    const token = await getLivePixToken();

    const response = await fetch(`https://api.livepix.gg/v2/payments/${hash}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log(`[STATUS] Resposta da LivePix: ${response.status}`);

    if (response.status === 404) {
      console.log('[STATUS] Pagamento não encontrado (pendente)');
      return res.status(200).json({ payment_status: 'pending' });
    }

    if (!response.ok) {
      console.error('[STATUS] Erro na LivePix:', response.status);
      return res.status(200).json({ payment_status: 'pending' });
    }

    const data = await response.json();
    console.log('[STATUS] Dados do pagamento:', JSON.stringify(data.data, null, 2));

    if (data.data && data.data.proof && data.data.proof.trim().length > 0) {
      console.log('[STATUS] Pagamento CONFIRMADO! Proof:', data.data.proof);
      return res.status(200).json({ payment_status: 'paid', proof: data.data.proof });
    }

    console.log('[STATUS] Pagamento ainda pendente');
    return res.status(200).json({ payment_status: 'pending' });
  } catch (e) {
    console.error('[STATUS] Exception:', e);
    return res.status(500).json({ error: 'Status check failed', message: e.message });
  }
}
