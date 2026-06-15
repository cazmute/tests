const CIDADES_FALLBACK = ['Goiânia','Recife','Salvador','Belo Horizonte','Curitiba','Manaus','Belém','Porto Alegre','Fortaleza','Campinas'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const city = req.headers['x-vercel-ip-city'];

  if (city) {
    return res.status(200).json({ city: decodeURIComponent(city) });
  }

  const fallback = CIDADES_FALLBACK[Math.floor(Math.random() * CIDADES_FALLBACK.length)];
  return res.status(200).json({ city: fallback });
}
