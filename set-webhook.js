const axios = require('axios');

// Конфигурация
const BOT_TOKEN = '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';
const VERCEL_URL = process.argv[2]; // Получаем URL из аргументов командной строки

if (!VERCEL_URL) {
  console.error('Ошибка: URL не указан. Используйте: node set-webhook.js YOUR_VERCEL_URL');
  process.exit(1);
}

// Сначала проверим текущий статус вебхука
async function checkWebhook() {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    console.log('Текущие настройки вебхука:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении информации о вебхуке:', error.message);
    if (error.response) {
      console.error('Ответ API:', error.response.data);
    }
    return null;
  }
}

// Удаляем текущий вебхук
async function deleteWebhook() {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
    console.log('Вебхук удален:', response.data);
    return response.data;
  } catch (error) {
    console.error('Ошибка при удалении вебхука:', error.message);
    if (error.response) {
      console.error('Ответ API:', error.response.data);
    }
    return null;
  }
}

// Устанавливаем новый вебхук
async function setWebhook() {
  const webhookUrl = `https://${VERCEL_URL}/api/webhook`;
  try {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      params: {
        url: webhookUrl,
        drop_pending_updates: true
      }
    });
    console.log('Новый вебхук установлен:', response.data);
    console.log('URL вебхука:', webhookUrl);
    return response.data;
  } catch (error) {
    console.error('Ошибка при установке вебхука:', error.message);
    if (error.response) {
      console.error('Ответ API:', error.response.data);
    }
    return null;
  }
}

// Выполнение всех операций последовательно
async function main() {
  console.log('Начинаем настройку вебхука для Telegram бота...');
  
  // Проверяем текущий статус
  await checkWebhook();
  
  // Удаляем текущий вебхук
  await deleteWebhook();
  
  // Устанавливаем новый вебхук
  await setWebhook();
  
  // Проверяем новую конфигурацию
  await checkWebhook();
  
  console.log('Настройка вебхука завершена!');
}

main().catch(error => {
  console.error('Ошибка при выполнении скрипта:', error);
}); 