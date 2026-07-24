// file: pix.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { desconto } = req.body;

  const VALOR_NORMAL = 3000;
  const VALOR_DESCONTO = 2000;
  const valor = desconto ? VALOR_DESCONTO : VALOR_NORMAL;

  try {
    // 1. Obtém token
    const tokenRes = await fetch('https://oauth.livepix.gg/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.LIVEPIX_CLIENT_ID,
        client_secret: process.env.LIVEPIX_CLIENT_SECRET,
        scope: 'payments:write',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('LivePix token error:', tokenData);
      return res.status(500).json({ error: 'Falha ao autenticar com LivePix' });
    }

    // 2. Cria pagamento
    const redirectUrl = process.env.LIVEPIX_REDIRECT_URL || 'https://www.google.com/';
    const payload = {
      amount: valor,
      currency: 'BRL',
      redirectUrl,
    };

    const payRes = await fetch('https://api.livepix.gg/v2/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const payData = await payRes.json();
    if (!payData.data || !payData.data.id) {
      console.error('LivePix payment error:', payData);
      return res.status(500).json({ error: 'Falha ao criar pagamento' });
    }

    // 3. RETORNA O ID REAL DA TRANSAÇÃO (NÃO O REFERENCE)
    return res.status(200).json({
      paymentId: payData.data.id,        // <- CHAVE CORRETA PARA POLLING
      redirectUrl: payData.data.redirectUrl,
      amount: valor,
      currency: 'BRL',
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'LivePix request failed' });
  }
}
