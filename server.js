const express = require('express');
const path = require('path');
const { bot } = require('./bot');

// Создаем Express приложение
const app = express();
const port = process.env.PORT || 3000;

// Настройка EJS как шаблонизатора
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Глобальные переменные для статистики
let stats = {
  botStartTime: new Date(),
  pendingForms: 0,
  acceptedForms: 0,
  rejectedForms: 0,
  lastActivity: null,
  isRunning: true
};

// Обновление статистики
function updateStats() {
  try {
    if (global.pendingForms) {
      stats.pendingForms = Object.keys(global.pendingForms).length;
    }
    if (global.processedForms) {
      stats.acceptedForms = global.processedForms.accepted.length;
      stats.rejectedForms = global.processedForms.rejected.length;
    }
    stats.lastActivity = new Date();
  } catch (error) {
    console.error('Ошибка при обновлении статистики:', error);
  }
}

// Главная страница - статус бота и статистика
app.get('/', (req, res) => {
  updateStats();
  res.render('index', { 
    stats: stats,
    uptime: getUptime(stats.botStartTime)
  });
});

// API для перезапуска бота
app.post('/api/restart', (req, res) => {
  try {
    // Имитация перезапуска (в реальности здесь был бы код перезапуска бота)
    stats.isRunning = true;
    stats.botStartTime = new Date();
    
    res.json({ success: true, message: 'Бот успешно перезапущен' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Ошибка при перезапуске бота: ' + error.message });
  }
});

// API для остановки бота
app.post('/api/stop', (req, res) => {
  try {
    // Имитация остановки (в реальности здесь был бы код остановки бота)
    stats.isRunning = false;
    
    res.json({ success: true, message: 'Бот успешно остановлен' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Ошибка при остановке бота: ' + error.message });
  }
});

// Вебхук для Telegram
app.post('/api/webhook', async (req, res) => {
  try {
    if (req.method === 'POST') {
      const update = req.body;
      
      if (update && update.message) {
        await bot.processUpdate(update);
        stats.lastActivity = new Date();
      }
      
      return res.status(200).json({ status: 'ok' });
    }
    
    return res.status(200).json({ status: 'Сервер бота работает!' });
  } catch (error) {
    console.error('Ошибка в вебхуке:', error);
    return res.status(500).json({ status: 'error', message: error.message });
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

// Запуск сервера
if (!process.env.VERCEL_URL) {
  app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
  });
}

// Экспорт для Vercel
module.exports = app; 