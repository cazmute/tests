const SYSTEM = process.env.SYSTEM_PROMPT;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { history, city, audio, audioMime, image, imageMime } = req.body;

  if (!history || !Array.isArray(history)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const cityRule = "REGRA ABSOLUTA: Se perguntarem onde mora, diga que está de passagem em " + (city || 'sua cidade') + ", visitando uma amiga. NUNCA inclua \"[CIDADE_LEAD:\" ou qualquer tag de localização nas suas respostas. Essas informações são apenas contexto interno, nunca devem aparecer no chat. Na primeira resposta, substitua [CIDADE] por " + (city || 'Campinas') + ".";
  
  const fullSystem = SYSTEM + "\n\n" + cityRule;

  try {
    // Monta o histórico: se a última mensagem for do user e tiver mídia, transforma em content array
    const msgs = history.map((m, idx) => {
      const isLastUser = idx === history.length - 1 && m.role === 'user' && (audio || image);
      if (!isLastUser) return { role: m.role, content: m.content };

      const parts = [];
      if (m.content && m.content.trim()) parts.push({ type: 'text', text: m.content });
      if (image) parts.push({ type: 'image_url', image_url: { url: `data:${imageMime || 'image/jpeg'};base64,${image}` } });
      if (audio) parts.push({ type: 'input_audio', input_audio: { data: audio, format: (audioMime || 'audio/webm').replace('audio/', '') } });
      return { role: 'user', content: parts };
    });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OR_KEY}`,
        'HTTP-Referer': 'https://reliquiasgospel.vercel.app',
        'X-Title': 'Vanessa Macedo Bot',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-v4-flash',
        temperature: 0.4,
        messages: [
          { role: 'system', content: fullSystem },
          ...msgs,
        ],
      }),
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || null;
    return res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'AI request failed' });
  }
}
