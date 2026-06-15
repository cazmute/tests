export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { hash } = req.query;
  if (!hash) return res.status(400).json({ error: 'Missing hash' });

  try {
    const response = await fetch(
      `${process.env.INVICTUSPAY_URL}/transactions/${hash}?api_token=${process.env.INVICTUSPAY_KEY}`
    );
    const data = await response.json();
    return res.status(200).json({ payment_status: data.payment_status || null });
  } catch (e) {
    return res.status(500).json({ error: 'Status check failed' });
  }
}
