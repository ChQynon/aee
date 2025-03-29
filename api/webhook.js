const TelegramBot = require('node-telegram-bot-api');

// Токен бота
const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

// ID админов
const ADMIN_IDS = [
  7683124601,
  1971986164,
  1663401570,
  6844219237,
  1536993655,
  718910310
];

// ID группового чата
const GROUP_CHAT_ID = -1002081050841;

// Групповая ссылка
const GROUP_LINK = 'https://t.me/+mjIfXRUDx19iOGQy';

// Создаем бота с пустыми настройками (без поллинга)
const bot = new TelegramBot(token);

// Если запущено на Vercel, настраиваем вебхук
if (process.env.VERCEL_URL) {
  const url = `https://${process.env.VERCEL_URL}`;
  console.log(`Настраиваем вебхук для бота на URL: ${url}/api/webhook`);
  bot.setWebHook(`${url}/api/webhook`);
} else {
  console.log('Локальный режим, вебхук не настроен');
}

// Основной обработчик запросов
module.exports = async (req, res) => {
  // Отладочная информация
  console.log(`Получен запрос: ${req.method} ${req.url}`);
  
  // Для GET-запросов просто возвращаем статус
  if (req.method === 'GET') {
    try {
      const botInfo = await bot.getMe();
      return res.json({
        status: 'Бот работает',
        bot: botInfo.username,
        botId: botInfo.id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return res.json({
        status: 'Ошибка',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Для POST-запросов обрабатываем апдейты от Telegram
  if (req.method === 'POST') {
    try {
      const update = req.body;
      
      // Обрабатываем обновление
      await bot.processUpdate(update);
      
      // Отвечаем Telegram успешным статусом
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Ошибка обработки апдейта:', error);
      return res.status(500).json({ ok: false, error: error.message });
    }
  }
  
  // Для других методов
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}; 