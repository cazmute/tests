// pages/api/transcribe.js
import Busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false, // essencial para processar arquivos
  },
};

export default async function handler(req, res) {
  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Usa busboy para extrair o arquivo do multipart/form-data
  const bb = Busboy({ headers: req.headers });
  let audioBuffer = null;
  let mimeType = 'audio/webm';

  bb.on('file', (fieldname, file, info) => {
    const { filename, mimeType: mime } = info;
    mimeType = mime || 'audio/webm';
    const chunks = [];
    file.on('data', (data) => chunks.push(data));
    file.on('end', () => {
      audioBuffer = Buffer.concat(chunks);
    });
  });

  bb.on('error', (err) => {
    console.error('Busboy error:', err);
    return res.status(500).json({ error: 'Erro no upload', details: err.message });
  });

  bb.on('finish', async () => {
    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'Nenhum áudio enviado' });
    }

    try {
      // Calcula duração aproximada (estimativa)
      let duration = Math.round(audioBuffer.length / 8000);
      if (duration < 1) duration = 1;

      // Chama a API do OpenRouter
      const transcribedText = await transcribeAudio(audioBuffer, mimeType);

      return res.status(200).json({
        text: transcribedText,
        duration: duration,
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

  // Pipe da requisição para o busboy
  req.pipe(bb);
}

// Função separada para chamar a API OpenRouter
async function transcribeAudio(buffer, mimeType) {
  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });
  formData.append('file', blob, 'audio.webm');
  formData.append('model', 'openai/whisper-1');
  formData.append('language', 'pt');

  const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OR_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenRouter error:', response.status, errorText);
    throw new Error(`OpenRouter retornou ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.text; // texto transcrito
}
