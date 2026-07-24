// file: api/status.js
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
      scope: 'payments:read',  // escopo necessário
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    console.error('[STATUS] Erro ao obter token:', data);
    throw new Error('Falha ao obter token LivePix');
  }

  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { hash } = req.query;  // hash = reference
  if (!hash) return res.status(400).json({ error: 'Missing hash' });

  console.log(`[STATUS] Consultando pagamento com reference: ${hash}`);

  try {
    const token = await getLivePixToken();

    // 1. Busca pagamentos pelo reference
    const listUrl = `https://api.livepix.gg/v2/payments?reference=${encodeURIComponent(hash)}`;
    console.log(`[STATUS] URL de listagem: ${listUrl}`);

    const listResponse = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!listResponse.ok) {
      console.error('[STATUS] Erro ao listar pagamentos:', listResponse.status);
      return res.status(200).json({ payment_status: 'pending' });
    }

    const listData = await listResponse.json();
    console.log('[STATUS] Lista de pagamentos:', JSON.stringify(listData, null, 2));

    // Verifica se encontrou algum pagamento com esse reference
    if (listData.data && listData.data.length > 0) {
      const payment = listData.data[0]; // pega o primeiro (deve ser o único)
      
      // Se tem proof, está pago
      if (payment.proof && payment.proof.trim().length > 0) {
        console.log('[STATUS] Pagamento CONFIRMADO via proof!');
        return res.status(200).json({ payment_status: 'paid', proof: payment.proof });
      }
      
      // Se não tem proof, ainda pendente
      console.log('[STATUS] Pagamento encontrado mas sem proof (pendente)');
      return res.status(200).json({ payment_status: 'pending' });
    }

    // Nenhum pagamento encontrado com esse reference
    console.log('[STATUS] Nenhum pagamento encontrado para o reference fornecido');
    return res.status(200).json({ payment_status: 'pending' });
  } catch (e) {
    console.error('[STATUS] Exceção:', e);
    return res.status(500).json({ error: 'Status check failed', message: e.message });
  }
}
