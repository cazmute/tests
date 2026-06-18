// pages/api/transcribe.js
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

async function transcribeAudio(buffer, mimeType) {
  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });
  formData.append('file', blob, 'audio.webm');
  formData.append('model', 'openai/whisper-1');
  formData.append('language', 'pt');

  const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OR_KEY}`, // <--- AQUI
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na transcrição: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.text;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  upload.single('audio')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: 'Erro no upload do áudio' });
    }

    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Nenhum áudio enviado' });
      }

      let duration = Math.round(file.buffer.length / 8000);
      if (duration < 1) duration = 1;

      const text = await transcribeAudio(file.buffer, file.mimetype);

      return res.status(200).json({
        text,
        duration,
        success: true,
      });
    } catch (error) {
      console.error('Erro na transcrição:', error);
      return res.status(500).json({
        error: 'Erro ao transcrever o áudio',
        details: error.message,
      });
    }
  });
}
