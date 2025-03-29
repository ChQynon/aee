// Простой обработчик webhook
module.exports = (req, res) => {
  // Для тестового GET-запроса
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'Bot is running' });
  }
  
  try {
    if (req.method === 'POST') {
      console.log('Получен webhook от Telegram:', JSON.stringify(req.body).slice(0, 100) + '...');
      return res.status(200).send('OK');
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Ошибка webhook:', error);
    return res.status(500).json({ error: String(error) });
  }
}; 