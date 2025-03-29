const { bot } = require('../bot');

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const update = req.body;
      await bot.processUpdate(update);
      return res.status(200).json({ status: 'ok' });
    }
    
    return res.status(200).json({ status: 'Сервер бота работает!' });
  } catch (error) {
    console.error('Ошибка в вебхуке:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}; 