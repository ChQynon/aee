const axios = require('axios');

module.exports = async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';
  
  try {
    // Получаем информацию о боте через API Telegram
    const telegramResponse = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    
    // Получаем информацию о вебхуке
    const webhookResponse = await axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`);

    // Возвращаем информацию о сервере и боте
    return res.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      nodeVersion: process.version,
      env: {
        VERCEL_URL: process.env.VERCEL_URL,
        NODE_ENV: process.env.NODE_ENV
      },
      bot: telegramResponse.data.result,
      webhook: webhookResponse.data.result
    });
  } catch (error) {
    console.error('Ошибка при проверке бота:', error);
    
    return res.status(500).json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? '🥞' : error.stack,
      response: error.response?.data || null
    });
  }
}; 