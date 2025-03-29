const TelegramBot = require('node-telegram-bot-api');

// Токен бота
const token = '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

// ВАЖНО: Код отключен - не используйте поллинг, когда активен вебхук!
console.log('⚠️ НЕ ИСПОЛЬЗУЙТЕ ПОЛЛИНГ, КОГДА АКТИВЕН ВЕБХУК!');
console.log('⚠️ Этот файл отключен. Вместо этого используйте API webhook.');
console.log('⚠️ Откройте https://sunset-one.vercel.app/debug.html для управления ботом.');

process.exit(0); // Немедленно завершаем работу

// ОТКЛЮЧЕННЫЙ КОД НИЖЕ
/*
// Режим polling для локальной разработки
const bot = new TelegramBot(token, { polling: true });

console.log('Бот запущен в режиме опроса (polling)...');

// Добавляем обработчик команды /test для проверки
bot.onText(/\/test/, async (msg) => {
    try {
        console.log('Получена команда /test от пользователя', msg.from.id);
        const chatId = msg.chat.id;
        await bot.sendMessage(chatId, "Тестовое сообщение! Бот работает в режиме polling!");
        console.log('Отправлено тестовое сообщение пользователю', msg.from.id);
    } catch (error) {
        console.error('Ошибка при отправке тестового сообщения:', error);
    }
});

// Простой обработчик команды /start
bot.onText(/\/start/, async (msg) => {
    try {
        console.log('Получена команда /start от пользователя', msg.from.id);
        const chatId = msg.chat.id;
        await bot.sendMessage(chatId, "Привет! Я бот для приема анкет в хаус Sunset. Этот ответ отправлен в тестовом режиме polling.");
        console.log('Отправлено приветственное сообщение пользователю', msg.from.id);
    } catch (error) {
        console.error('Ошибка при обработке команды /start:', error);
    }
});

// Обработчик для любых сообщений
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    console.log(`Получено сообщение от ${msg.from.id}: ${msg.text}`);
    
    // НЕ дублируем сообщения пользователей
});

process.on('SIGINT', () => {
    console.log('Бот остановлен');
    process.exit(0);
});
*/ 