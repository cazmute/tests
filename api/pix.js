export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { desconto } = req.body;

  const VALOR_NORMAL   = 1990;
  const VALOR_DESCONTO = 990;
  const valor = desconto ? VALOR_DESCONTO : VALOR_NORMAL;

  const payload = {
    api_token: process.env.INVICTUSPAY_KEY,
    amount: valor,
    offer_hash: process.env.OFFER_HASH,
    payment_method: 'pix',
    customer: {
      name: 'clienteHot',
      email: 'clientehot@gmail.com',
      phone_number: '11999999999',
      document: '09115751031',
      street_name: 'Rua das Flores',
      number: '123',
      complement: '',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      zip_code: '01310100',
    },
    cart: [{
      product_hash: process.env.PRODUCT_HASH,
      title: 'chamada de video',
      cover: null,
      price: valor,
      quantity: 1,
      operation_type: 1,
      tangible: false,
    }],
    expire_in_days: 1,
    transaction_origin: 'api',
    tracking: {
      src: '', utm_source: 'whatsapp', utm_medium: 'chat',
      utm_campaign: 'gospel-bot', utm_term: '', utm_content: '',
    },
    postback_url: 'https://webhook.site/invictuspay-gospel',
  };

  try {
    const response = await fetch(`${process.env.INVICTUSPAY_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'PIX request failed' });
  }
}
