const axios = require('axios');

// URL da API local
const API_URL = 'http://localhost:3000/api/weather';

// Parâmetros da requisição
const params = {
  city: 'Maputo', // Nome da cidade
};

// Função para testar a rota da API
async function testWeather() {
  try {
    const response = await axios.get(API_URL, { params });
    console.log('Resposta da API:', response.data);
  } catch (error) {
    console.error('Erro ao testar a rota da API:', error.message);
  }
}

// Chama a função para testar a rota
testWeather();
