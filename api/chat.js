import busboy from 'busboy';
import FormData from 'form-data';

const SYSTEM = `...`; // (use o mesmo SYSTEM que você já tem, não vou repetir para não alongar)

async function transcribeAudio(audioBuffer, mimeType) {
  try {
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.' + (mimeType.split('/')[1] || 'webm'),
      contentType: mimeType
    });
    formData.append('model', 'openai/whisper');
    formData.append('response_format', 'text');

    const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OR_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
    }
    const text = await response.text();
    return text.trim();
  } catch (err) {
    console.error('Transcription error:', err);
    throw err;
  }
}

export default async function handler(req, res) {
  // Habilita CORS para desenvolvimento (opcional)
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const contentType = req.headers['content-type'] || '';
    let fileBuffer = null;
    let fileMime = null;
    let userText = '';
    let history = [];
    let city = 'Campinas';

    if (contentType.includes('multipart/form-data')) {
      const bb = busboy({ headers: req.headers });
      const result = await new Promise((resolve, reject) => {
        let fields = {};
        let fileData = null;
        bb.on('field', (name, value) => {
          fields[name] = value;
        });
        bb.on('file', (name, file, info) => {
          const { mimeType } = info;
          const chunks = [];
          file.on('data', (data) => chunks.push(data));
          file.on('end', () => {
            fileData = { buffer: Buffer.concat(chunks), mimeType };
          });
        });
        bb.on('finish', () => resolve({ fields, fileData }));
        bb.on('error', (err) => reject(err));
        req.pipe(bb);
      });

      userText = result.fields.text || '';
      if (result.fields.history) {
        try { history = JSON.parse(result.fields.history); } catch (e) { console.warn('History parse error', e); }
      }
      if (result.fields.city) {
        city = result.fields.city;
      }
      if (result.fileData) {
        fileBuffer = result.fileData.buffer;
        fileMime = result.fileData.mimeType;
      }
    } else {
      // Modo JSON (compatibilidade)
      const { history: hist, city: c } = req.body;
      if (!hist || !Array.isArray(hist)) {
        return res.status(400).json({ error: 'Invalid payload' });
      }
      history = hist;
      if (c) city = c;
      const lastUser = history.filter(m => m.role === 'user').pop();
      if (lastUser) {
        userText = lastUser.content;
      }
    }

    const cityRule = "REGRA ABSOLUTA: Se perguntarem onde mora, diga que está de passagem em " + city + ", visitando uma amiga. NUNCA inclua \"[CIDADE_LEAD:\" ou qualquer tag de localização nas suas respostas. Essas informações são apenas contexto interno, nunca devem aparecer no chat. Na primeira resposta, substitua [CIDADE] por " + city + ".";
    const fullSystem = SYSTEM + "\n\n" + cityRule;

    const messages = [{ role: 'system', content: fullSystem }];

    if (fileBuffer && fileMime) {
      let userContent = [];
      if (userText) {
        userContent.push({ type: 'text', text: userText });
      }

      if (fileMime.startsWith('image/')) {
        const base64 = fileBuffer.toString('base64');
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:${fileMime};base64,${base64}` }
        });
      } else if (fileMime.startsWith('audio/')) {
        try {
          const transcription = await transcribeAudio(fileBuffer, fileMime);
          userContent.push({ type: 'text', text: `[Transcrição do áudio: ${transcription}]` });
        } catch (err) {
          console.error('Transcription error:', err);
          return res.status(500).json({ error: 'Transcription failed', details: err.message });
        }
      } else {
        userContent.push({ type: 'text', text: userText || 'Arquivo enviado' });
      }

      if (userContent.length === 0) {
        userContent.push({ type: 'text', text: 'Arquivo enviado' });
      }

      messages.push({ role: 'user', content: userContent });
    } else {
      if (history.length > 0) {
        const last = history[history.length - 1];
        if (!last || last.role !== 'user' || last.content !== userText) {
          if (userText) history.push({ role: 'user', content: userText });
        }
        messages.push(...history);
      } else {
        if (userText) messages.push({ role: 'user', content: userText });
        else return res.status(400).json({ error: 'No message provided' });
      }
    }

    const model = process.env.AI_MODEL || 'google/gemini-2.0-flash-exp';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OR_KEY}`,
        'HTTP-Referer': 'https://reliquiasgospel.vercel.app',
        'X-Title': 'Vanessa Macedo Bot',
      },
      body: JSON.stringify({
        model: model,
        temperature: 0.4,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', response.status, errorText);
      return res.status(response.status).json({ error: 'OpenRouter API error' });
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || null;
    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}
