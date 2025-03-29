// Простая реализация для Vercel
const express = require('express');
const app = express();

// Базовые middleware
app.use(express.json());

// Главная страница - простой текст
app.get('/', (req, res) => {
  res.send('Бот хауса Sunset работает!');
});

// Простой пинг для проверки статуса
app.get('/ping', (req, res) => {
  res.send('pong');
});

// Обработка вебхука
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);
  res.status(200).send('OK');
});

// Порт для локального запуска
const PORT = process.env.PORT || 3000;

// Запуск локально, если не в Vercel
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Экспорт для Vercel
module.exports = app; 