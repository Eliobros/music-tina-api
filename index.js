const express = require('express');
const fs = require('fs');
const uuid = require('uuid');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const ytsr = require('youtube-api-v3-search');
const ytdl = require('ytdl-core');
const app = express();
const PORT = 3000;
const { YOUTUBE_API_KEY, AUTOR_API, DONO_API, DEVELOPMENT_DAY, NAME_API, VERSION_API, INFO_USE, DIR_GENERATE_KEY } = require('./config');

app.use(express.json()); // Para processar o corpo das requisições JSON

// Funções para manipular as chaves de API
const getApiKeys = () => {
  if (!fs.existsSync('apiKeys.json')) {
    fs.writeFileSync('apiKeys.json', JSON.stringify([]));
  }
  const data = fs.readFileSync('apiKeys.json', 'utf8');
  return JSON.parse(data);
};

const saveApiKeys = (keys) => {
  fs.writeFileSync('apiKeys.json', JSON.stringify(keys, null, 2));
};

// Middleware para verificar a chave de API
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key']; 

  if (!apiKey) {
    return res.status(401).json({ error: 'Chave de API é necessária.' });
  }

  const apiKeys = getApiKeys();
  const key = apiKeys.find(k => k.apiKey === apiKey);

  if (!key) {
    return res.status(403).json({ error: 'Chave de API inválida.' });
  }

  // Verifica se a chave de API ainda está válida
  const currentDate = new Date();
  const expirationDate = new Date(key.expirationDate);
  if (currentDate > expirationDate) {
    return res.status(403).json({ error: 'Chave de API expirada.' });
  }

  req.apiKey = key;
  next();
};

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota para obter informações sobre a API
app.get('/api', (req, res) => {
    res.json({
        name: `${NAME_API}`,
        version: `${VERSION_API}`,
        development_day: `${DEVELOPMENT_DAY}`,
        description: "API para baixar e converter áudio de vídeos do YouTube. Esta API foi desenvolvida pela empresa Eliobros Tech.",
        autor: `${AUTOR_API}`,
        routes: "api/music, generate-api-key",
        dono: `${DONO_API}`,
        info: `${INFO_USE}`,
        endpoints: [
            {
                path: "/api/music",
                method: "GET",
                description: "Obtém o áudio de um vídeo do YouTube (requisição de música).",
                parameters: [
                    {
                        name: "query",
                        type: "string",
                        required: true,
                        description: "Nome da música ou vídeo para buscar no YouTube."
                    }
                ],
                example_request: "GET /api/music?query=nome+da+musica",
                example_response: {
                    status: 200,
                    body: {
                        message: "Áudio baixado com sucesso.",
                        data: {
                            title: "Nome da música",
                            download_link: "https://example.com/download.mp3"
                        }
                    }
                },
                status_codes: {
                    "200": "Sucesso",
                    "400": "Parâmetro 'query' é necessário.",
                    "404": "Vídeo não encontrado no YouTube.",
                    "500": "Erro ao processar o áudio."
                }
            },
            {
                path: "/api/generate-api-key",
                method: "POST",
                description: "Gera uma nova chave de API para o usuário.",
                parameters: [
                    {
                        name: "apiName",
                        type: "string",
                        required: true,
                        description: "Nome da API para gerar a chave."
                    }
                ],
                example_request: {
                    method: "POST",
                    body: {
                        apiName: "Nome da API"
                    }
                },
                example_response: {
                    status: 200,
                    body: {
                        message: "Chave de API gerada com sucesso.",
                        apiKey: "gerada-api-key",
                        expirationDate: "2025-01-07T00:00:00Z"
                    }
                },
                status_codes: {
                    "200": "Sucesso",
                    "400": "Nome da API é obrigatório."
                }
            }
        ],
        contact: {
            email: "suporte@eliobrostech.com",
            website: "https://eliobrostech.com"
        },
        limits: {
            requests_per_minute: 60,
            requests_per_hour: 1000
        },
        faq: [
            {
                question: "Como obtenho uma chave de API?",
                answer: "Você pode obter uma chave de API acessando a rota /generate-api-key com uma requisição POST."
            },
            {
                question: "Qual é o limite de uso da API?",
                answer: "Você pode fazer até 60 requisições por minuto e 1000 requisições por hora."
            }
        ]
    });
});

// Rota para gerar uma chave de API
app.post('/api/generate-api-key', (req, res) => {
  const { apiName } = req.body;

  if (!apiName) {
    return res.status(400).json({ error: 'Nome da API é obrigatório.' });
  }

  const apiKey = uuid.v4(); 

  // Data de expiração (30 dias a partir da data atual)
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 30); // Chave válida por 30 dias

  const apiKeys = getApiKeys();
  apiKeys.push({ apiName, apiKey, expirationDate: expirationDate.toISOString() });
  saveApiKeys(apiKeys);

  res.json({
    message: 'Chave de API gerada com sucesso.',
    apiKey,
    expirationDate: expirationDate.toISOString()
  });
});

// Função para buscar e baixar o áudio do YouTube
const downloadAudio = (videoUrl, audioFilePath, videoTitle, res) => {
  const videoStream = ytdl(videoUrl, { quality: 'highestaudio' });

  ffmpeg(videoStream)
    .audioCodec('libmp3lame')
    .audioBitrate(192)
    .save(audioFilePath)
    .on('end', () => {
      res.download(audioFilePath, `${videoTitle}.mp3`, (err) => {
        if (err) {
          console.error('Erro ao enviar o áudio:', err);
        }
        fs.unlink(audioFilePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Erro ao deletar o arquivo de áudio:', unlinkErr);
          }
        });
      });
    })
    .on('error', (err) => {
      console.error('Erro ao extrair áudio:', err);
      res.status(500).json({ error: 'Erro ao processar o áudio.' });
    });
};

// Rota de música - Exemplo de como pegar áudio do YouTube
app.get('/api/music', verifyApiKey, async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Parâmetro "query" é necessário.' });
  }

  try {
    const response = await ytsr(YOUTUBE_API_KEY, query);
    const video = response.items[0];

    if (!video) {
      return res.status(404).json({ error: 'Vídeo não encontrado no YouTube.' });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
    const videoTitle = video.snippet.title;

    const audioFilePath = path.join(__dirname, 'audio', `${uuid.v4()}.mp3`);
    downloadAudio(videoUrl, audioFilePath, videoTitle, res);

  } catch (error) {
    console.error('Erro ao buscar vídeo no YouTube:', error);
    res.status(500).json({ error: 'Erro ao buscar o vídeo no YouTube.' });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
