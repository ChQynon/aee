const { bot } = require('../bot');

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const update = req.body;
      
      if (update && (update.message || update.callback_query || update.chat_join_request)) {
        await bot.processUpdate(update);
      }
      
      return res.status(200).json({ status: 'ok' });
    }
    
    // Для проверки, что сервер работает
    return res.status(200).json({ 
      status: 'Сервер бота работает!',
      timestamp: new Date().toISOString(),
      bot: bot ? 'initialized' : 'not initialized'
    });
  } catch (error) {
    console.error('Ошибка в вебхуке:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}; 