const express = require('express');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

console.log('⭐ Запуск server.js...');

// Токен бота
const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

// Создаем Express приложение
const app = express();
const port = process.env.PORT || 3000;

// Создаем бота для этого сервера
let bot;
try {
  // Если запущено на Vercel, можно не настраивать вебхук здесь,
  // он настраивается в api/webhook.js
  if (process.env.VERCEL_URL) {
    bot = new TelegramBot(token);
    console.log('🤖 Бот создан без поллинга (для Vercel)');
  } else {
    bot = new TelegramBot(token, { polling: true });
    console.log('🤖 Бот запущен в режиме поллинга (для локальной разработки)');
  }
} catch (error) {
  console.error('❌ Ошибка создания бота:', error);
}

// Глобальные переменные для статистики
let stats = {
  botStartTime: new Date(),
  pendingForms: 0,
  acceptedForms: 0,
  rejectedForms: 0,
  lastActivity: null,
  isRunning: true
};

// Настройка EJS как шаблонизатора
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Обновление статистики
function updateStats() {
  try {
    // В упрощенном режиме просто показываем время запуска
    stats.lastActivity = new Date();
  } catch (error) {
    console.error('Ошибка при обновлении статистики:', error);
  }
}

// Главная страница - статус бота и статистика
app.get('/', (req, res) => {
  updateStats();
  
  // Проверяем работоспособность бота
  let botStatus = 'unknown';
  
  if (bot) {
    // Пытаемся получить информацию о боте
    bot.getMe()
      .then(botInfo => {
        res.render('index', { 
          stats: {
            ...stats,
            botInfo: botInfo
          },
          uptime: getUptime(stats.botStartTime)
        });
      })
      .catch(error => {
        console.error('Ошибка при проверке бота:', error);
        res.render('index', { 
          stats: {
            ...stats,
            botInfo: null,
            error: error.message
          },
          uptime: getUptime(stats.botStartTime)
        });
      });
  } else {
    res.render('index', { 
      stats: {
        ...stats,
        botInfo: null,
        error: 'Бот не инициализирован'
      },
      uptime: getUptime(stats.botStartTime)
    });
  }
});

// API для перезапуска бота
app.post('/api/restart', (req, res) => {
  try {
    stats.isRunning = true;
    stats.botStartTime = new Date();
    
    if (bot) {
      bot.getMe().then(botInfo => {
        res.json({ 
          success: true, 
          message: 'Бот успешно перезапущен',
          botInfo: botInfo
        });
      }).catch(error => {
        res.status(500).json({ 
          success: false, 
          message: 'Ошибка при перезапуске бота: ' + error.message 
        });
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Бот не инициализирован' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Ошибка при перезапуске бота: ' + error.message 
    });
  }
});

// API для проверки статуса бота
app.get('/api/status', async (req, res) => {
  try {
    if (bot) {
      const botInfo = await bot.getMe();
      res.json({ 
        status: 'online',
        botInfo: botInfo,
        uptime: getUptime(stats.botStartTime)
      });
    } else {
      res.json({ 
        status: 'offline',
        error: 'Бот не инициализирован',
        uptime: getUptime(stats.botStartTime)
      });
    }
  } catch (error) {
    res.json({ 
      status: 'error',
      error: error.message,
      uptime: getUptime(stats.botStartTime)
    });
  }
});

// Функция для расчета времени работы
function getUptime(startTime) {
  const uptime = new Date() - startTime;
  const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
  
  return `${days}д ${hours}ч ${minutes}м ${seconds}с`;
}

// Запуск сервера для локальной разработки
if (!process.env.VERCEL_URL) {
  app.listen(port, () => {
    console.log(`🌐 Сервер запущен на порту ${port}`);
  });
}

// Логирование завершения запуска
console.log('✅ server.js загружен успешно');

// Экспорт для Vercel
module.exports = app; 