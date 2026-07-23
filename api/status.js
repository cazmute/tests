// file: status.js
// Cache do token OAuth com expiração (1 hora)
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

  try {
    const token = await getLivePixToken();

    const response = await fetch(`https://api.livepix.gg/v2/payments/${hash}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Se 404, pagamento ainda não existe (criado mas não confirmado)
    if (response.status === 404) {
      return res.status(200).json({ payment_status: 'pending' });
    }

    if (!response.ok) {
      console.error('LivePix status error:', response.status);
      return res.status(200).json({ payment_status: 'pending' });
    }

    const data = await response.json();

    // Se o campo "proof" existe e tem valor, o pagamento foi confirmado
    if (data.data && data.data.proof && data.data.proof.trim().length > 0) {
      return res.status(200).json({ payment_status: 'paid' });
    }

    // Pagamento existe mas ainda não foi pago
    return res.status(200).json({ payment_status: 'pending' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Status check failed' });
  }
}
