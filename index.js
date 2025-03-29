// Простой файл перенаправления для корневого пути
module.exports = (req, res) => {
  res.status(200).json({ 
    status: 'Telegram Bot is running', 
    endpoints: ['/api/webhook'],
    environment: process.env.VERCEL ? 'Vercel' : 'Development'
  });
}; 