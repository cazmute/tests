// file: pix.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { desconto } = req.body;

  const VALOR_NORMAL = 3000;
  const VALOR_DESCONTO = 2000;
  const valor = desconto ? VALOR_DESCONTO : VALOR_NORMAL;

  try {
    console.log('[PIX] Obtendo token...');
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
    console.log('[PIX] Token status:', tokenRes.status);
    if (!tokenData.access_token) {
      console.error('[PIX] Token error:', tokenData);
      return res.status(500).json({ error: 'Falha ao autenticar com LivePix', details: tokenData });
    }

    const redirectUrl = process.env.LIVEPIX_REDIRECT_URL || 'https://www.google.com/';
    const payload = {
      amount: valor,
      currency: 'BRL',
      redirectUrl,
    };
    console.log('[PIX] Payload:', payload);

    const payRes = await fetch('https://api.livepix.gg/v2/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const payData = await payRes.json();
    console.log('[PIX] Payment status:', payRes.status);
    console.log('[PIX] Payment data:', payData);

    if (!payRes.ok) {
      console.error('[PIX] LivePix error:', payData);
      return res.status(500).json({
        error: 'Erro na LivePix ao criar pagamento',
        status: payRes.status,
        details: payData,
      });
    }

    // ⭐ CORREÇÃO: a LivePix retorna 'reference' como identificador único
    if (!payData.data || !payData.data.reference) {
      console.error('[PIX] Missing reference:', payData);
      return res.status(500).json({ error: 'Resposta inesperada da LivePix', details: payData });
    }

    return res.status(200).json({
      paymentId: payData.data.reference,   // <-- Usamos 'reference'
      redirectUrl: payData.data.redirectUrl,
      amount: valor,
      currency: 'BRL',
    });
  } catch (e) {
    console.error('[PIX] Exception:', e);
    return res.status(500).json({ error: 'LivePix request failed', message: e.message });
  }
}
