// Упрощенный обработчик webhook для Telegram
const TelegramBot = require('node-telegram-bot-api');
const token = '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

// Константы состояний пользователей
const STATES = {
  IDLE: 'idle',
  AWAITING_NAME: 'awaiting_name',
  AWAITING_AGE: 'awaiting_age',
  AWAITING_TIMEZONE: 'awaiting_timezone',
  AWAITING_MINECRAFT_VERSION: 'awaiting_minecraft_version',
  AWAITING_MINECRAFT_TYPE: 'awaiting_minecraft_type',
  AWAITING_WHY_US: 'awaiting_why_us',
  AWAITING_ABOUT_YOURSELF: 'awaiting_about_yourself',
  CONFIRMATION: 'confirmation'
};

// ID группового чата
const GROUP_CHAT_ID = '-1001922624396'; 

// Список админов
const ADMIN_IDS = [1103834712, 1103834713]; // Замените на реальные ID админов

// Хранилище состояний пользователей и анкет
const userStates = {};
const userForms = {};
const pendingForms = {};
const processedForms = { accepted: [], rejected: [] };

// Обработчик запросов
module.exports = async (req, res) => {
  try {
    // Для GET-запросов просто возвращаем статус
    if (req.method === 'GET') {
      return res.status(200).json({ status: 'Bot is running' });
    }
    
    // Для POST-запросов обрабатываем события от Telegram
    if (req.method === 'POST') {
      const update = req.body;
      console.log('WEBHOOK:', JSON.stringify(update).slice(0, 200));
      
      // Создаем экземпляр бота для ответа
      const bot = new TelegramBot(token);
      
      // Обработка текстовых сообщений
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const userId = update.message.from.id;
        const username = update.message.from.username || `user${userId}`;
        
        console.log(`Сообщение: ${text} от ${chatId}`);
        
        // Обработка команд и сообщений
        if (text === '/start') {
          userStates[chatId] = STATES.IDLE;
          await bot.sendMessage(chatId, 
            "🍂 Привет! Добро пожаловать в бота для подачи заявки в хаус Sunset!\n\n" +
            "Заполни анкету, и мы рассмотрим твою кандидатуру. Начнем?",
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🍂 Заполнить анкету", callback_data: "start_form" }]
                ]
              }
            }
          );
        } else if (text === '/list' && isAdmin(userId)) {
          // Команда для админов для просмотра ожидающих анкет
          const pendingCount = Object.keys(pendingForms).length;
          if (pendingCount === 0) {
            await bot.sendMessage(chatId, "Нет ожидающих анкет на данный момент.");
            return;
          }
          
          await bot.sendMessage(chatId, `Ожидающие анкеты (${pendingCount}):`);
          
          for (const [userId, formData] of Object.entries(pendingForms)) {
            const { userData } = formData;
            await bot.sendMessage(
              chatId,
              generateApplicationMessage(userData.username, userData.form),
              {
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "✅ Принять", callback_data: `accept_${userId}` },
                      { text: "❌ Отклонить", callback_data: `reject_${userId}` }
                    ]
                  ]
                }
              }
            );
          }
        } else {
          // Обработка сообщений на основе состояния пользователя
          await handleTextMessage(bot, chatId, text, update.message.from);
        }
      }
      
      // Обработка callback_query (нажатия на кнопки)
      if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const userId = callbackQuery.from.id;
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        
        await handleCallbackQuery(bot, chatId, data, callbackQuery, userId);
      }
      
      return res.status(200).send('OK');
    }
    
    // Для всех других методов
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('ОШИБКА:', error);
    return res.status(500).json({
      error: String(error),
      location: 'webhook handler',
      stack: error.stack
    });
  }
};

// Проверка, является ли пользователь админом
function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

// Генерация сообщения с анкетой
function generateApplicationMessage(username, form) {
  return `<b>📝 НОВАЯ АНКЕТА</b>

<b>Пользователь:</b> @${username}

<b>Имя:</b> ${form.name}
<b>Возраст:</b> ${form.age}
<b>Часовой пояс:</b> ${form.timezone}
<b>Версия Minecraft:</b> ${form.minecraft_version}
<b>Тип Minecraft:</b> ${form.minecraft_type}
<b>Почему наш хаус:</b> ${form.why_us}
<b>О себе:</b> ${form.about_yourself}`;
}

// Обработка текстовых сообщений
async function handleTextMessage(bot, chatId, text, from) {
  const userId = from.id;
  const username = from.username || `user${userId}`;
  
  // Если состояния нет, устанавливаем IDLE
  if (!userStates[chatId]) {
    userStates[chatId] = STATES.IDLE;
    await bot.sendMessage(chatId, "Чтобы начать заполнение анкеты, отправь /start");
    return;
  }
  
  switch (userStates[chatId]) {
    case STATES.AWAITING_NAME:
      userForms[chatId].name = text;
      userStates[chatId] = STATES.AWAITING_AGE;
      await bot.sendMessage(chatId, "🍂 Сколько тебе лет?");
      break;
      
    case STATES.AWAITING_AGE:
      // Получаем первые цифры из строки, которые вероятно являются возрастом
      const ageMatch = text.match(/\d+/);
      const age = ageMatch ? parseInt(ageMatch[0]) : 0;
      
      if (age < 12) {
        await bot.sendMessage(chatId, 
          "⚠️ Извини, но в наш хаус принимаются только игроки от 12 лет. " +
          "Ты можешь попробовать снова, когда подрастешь!"
        );
        userStates[chatId] = STATES.IDLE;
        delete userForms[chatId];
        return;
      }
      
      userForms[chatId].age = text;
      userStates[chatId] = STATES.AWAITING_TIMEZONE;
      await bot.sendMessage(chatId, "🍂 Укажи свой Часовой пояс (например, МСК, МСК+1 и т.д.):");
      break;
      
    case STATES.AWAITING_TIMEZONE:
      userForms[chatId].timezone = text;
      userStates[chatId] = STATES.AWAITING_MINECRAFT_VERSION;
      await bot.sendMessage(chatId, "🍂 Какую версию Minecraft ты используешь?");
      break;
      
    case STATES.AWAITING_MINECRAFT_VERSION:
      userForms[chatId].minecraft_version = text;
      userStates[chatId] = STATES.AWAITING_MINECRAFT_TYPE;
      await bot.sendMessage(chatId, "🍂 Какой тип Minecraft ты используешь? (Java или Bedrock)");
      break;
      
    case STATES.AWAITING_MINECRAFT_TYPE:
      const type = text.toLowerCase();
      
      if (type.includes('java') || type.includes('джава') || type.includes('java edition')) {
        userForms[chatId].minecraft_type = "Java";
      } else if (type.includes('bedrock') || type.includes('бедрок') || type.includes('pe') || type.includes('телефон') || type.includes('phone')) {
        userForms[chatId].minecraft_type = "Bedrock";
      } else {
        userForms[chatId].minecraft_type = text;
      }
      
      userStates[chatId] = STATES.AWAITING_WHY_US;
      await bot.sendMessage(chatId, "🍂 Почему ты хочешь присоединиться именно к нашему хаусу?");
      break;
      
    case STATES.AWAITING_WHY_US:
      userForms[chatId].why_us = text;
      userStates[chatId] = STATES.AWAITING_ABOUT_YOURSELF;
      await bot.sendMessage(chatId, "🍂 Расскажи немного о себе:");
      break;
      
    case STATES.AWAITING_ABOUT_YOURSELF:
      userForms[chatId].about_yourself = text;
      userStates[chatId] = STATES.CONFIRMATION;
      
      // Формируем сообщение с анкетой
      const formMessage = `<b>📝 ТВОЯ АНКЕТА</b>

<b>Имя:</b> ${userForms[chatId].name}
<b>Возраст:</b> ${userForms[chatId].age}
<b>Часовой пояс:</b> ${userForms[chatId].timezone}
<b>Версия Minecraft:</b> ${userForms[chatId].minecraft_version}
<b>Тип Minecraft:</b> ${userForms[chatId].minecraft_type}
<b>Почему наш хаус:</b> ${userForms[chatId].why_us}
<b>О себе:</b> ${userForms[chatId].about_yourself}

Все верно?`;
      
      await bot.sendMessage(chatId, formMessage, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Подтвердить", callback_data: "confirm_form" },
              { text: "🔄 Начать заново", callback_data: "restart_form" }
            ]
          ]
        }
      });
      break;
      
    default:
      await bot.sendMessage(chatId, "Чтобы начать заполнение анкеты, отправь /start");
      break;
  }
}

// Обработка callback_query (нажатия на кнопки)
async function handleCallbackQuery(bot, chatId, data, callbackQuery, userId) {
  // Кнопка начала заполнения анкеты
  if (data === "start_form") {
    userStates[chatId] = STATES.AWAITING_NAME;
    userForms[chatId] = {};
    
    await bot.answerCallbackQuery(callbackQuery.id);
    await bot.sendMessage(chatId, "🍂 Как тебя зовут?");
  }
  // Кнопка подтверждения анкеты
  else if (data === "confirm_form") {
    await bot.answerCallbackQuery(callbackQuery.id);
    
    const username = callbackQuery.from.username || `user${userId}`;
    
    // Сохраняем анкету в ожидающие
    pendingForms[userId] = {
      userData: {
        username: username,
        form: userForms[chatId]
      },
      adminMessages: {},
      userChatId: chatId
    };
    
    // Отправляем анкету всем админам
    for (const adminId of ADMIN_IDS) {
      try {
        const applicationMessage = generateApplicationMessage(username, userForms[chatId]);
        const msg = await bot.sendMessage(
          adminId,
          applicationMessage,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Принять", callback_data: `accept_${userId}` },
                  { text: "❌ Отклонить", callback_data: `reject_${userId}` }
                ]
              ]
            }
          }
        );
        
        // Сохраняем ID сообщения для обновления
        pendingForms[userId].adminMessages[adminId] = {
          chat_id: adminId,
          message_id: msg.message_id
        };
      } catch (error) {
        console.error(`Ошибка при отправке анкеты админу ${adminId}: ${error}`);
      }
    }
    
    await bot.sendMessage(
      chatId,
      "✅ Твоя анкета отправлена на рассмотрение! Мы сообщим тебе о результате."
    );
    
    userStates[chatId] = STATES.IDLE;
  }
  // Кнопка начала заполнения анкеты заново
  else if (data === "restart_form") {
    userStates[chatId] = STATES.AWAITING_NAME;
    userForms[chatId] = {};
    
    await bot.answerCallbackQuery(callbackQuery.id);
    await bot.sendMessage(chatId, "🍂 Давай начнем заново. Как тебя зовут?");
  }
  // Кнопки для админов
  else if (data.startsWith('accept_')) {
    const targetUserId = data.split('_')[1];
    const adminId = callbackQuery.from.id;
    const adminUsername = callbackQuery.from.username || `ID: ${adminId}`;
    
    if (!isAdmin(userId)) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: "У вас нет прав для этого действия" });
      return;
    }
    
    if (!pendingForms[targetUserId]) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: "Эта анкета больше недоступна" });
      return;
    }
    
    try {
      const { userData, adminMessages, userChatId } = pendingForms[targetUserId];
      const username = userData.username;
      
      // Добавляем анкету в историю принятых
      processedForms.accepted.push({
        userId: targetUserId,
        username: username,
        formData: userData.form,
        adminId: adminId,
        adminUsername: adminUsername,
        date: new Date().toLocaleString('ru-RU')
      });
      
      // Обновляем сообщения у всех админов
      for (const [id, msgData] of Object.entries(adminMessages)) {
        try {
          await bot.editMessageText(
            `✅ АНКЕТА ПРИНЯТА ✅\n\nПользователь @${username} (ID: ${targetUserId}) был принят в хаус админом @${adminUsername} (ID: ${adminId})`,
            {
              chat_id: msgData.chat_id,
              message_id: msgData.message_id
            }
          );
        } catch (error) {
          console.error(`Ошибка при обновлении сообщения у админа ${id}: ${error}`);
        }
      }
      
      // Уведомляем пользователя о принятии
      if (userChatId) {
        await bot.sendMessage(
          userChatId,
          "🎉 Поздравляем! Твоя анкета была принята админом @" + adminUsername + "! Добро пожаловать в хаус Sunset! 🎉"
        );
      }
      
      // Отправляем сообщение в групповой чат
      await bot.sendMessage(
        GROUP_CHAT_ID,
        `🎉 Поздравляем @${username} с официальным принятием в хаус Sunset! 🎉\nПринят админом: @${adminUsername} (ID: ${adminId})`
      );
      
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: "Пользователь принят в хаус Sunset!", 
        show_alert: true 
      });
      
      // Удаляем анкету из ожидающих
      delete pendingForms[targetUserId];
      
    } catch (error) {
      console.error(`Ошибка при принятии анкеты: ${error}`);
      
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: "Произошла ошибка при принятии анкеты. Пожалуйста, попробуйте снова.",
        show_alert: true
      });
    }
  }
  else if (data.startsWith('reject_')) {
    const targetUserId = data.split('_')[1];
    const adminId = callbackQuery.from.id;
    const adminUsername = callbackQuery.from.username || `ID: ${adminId}`;
    
    if (!isAdmin(userId)) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: "У вас нет прав для этого действия" });
      return;
    }
    
    if (!pendingForms[targetUserId]) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: "Эта анкета больше недоступна" });
      return;
    }
    
    // Получаем данные из анкеты
    const { userData, adminMessages, userChatId } = pendingForms[targetUserId];
    const username = userData.username;
    
    // Добавляем анкету в историю отклоненных
    processedForms.rejected.push({
      userId: targetUserId,
      username: username,
      formData: userData.form,
      adminId: adminId,
      adminUsername: adminUsername,
      date: new Date().toLocaleString('ru-RU')
    });
    
    // Обновляем сообщения у всех админов
    for (const [id, msgData] of Object.entries(adminMessages)) {
      try {
        await bot.editMessageText(
          `❌ АНКЕТА ОТКЛОНЕНА ❌\n\nАнкета пользователя @${username} (ID: ${targetUserId}) была отклонена админом @${adminUsername} (ID: ${adminId})`,
          {
            chat_id: msgData.chat_id,
            message_id: msgData.message_id
          }
        );
      } catch (error) {
        console.error(`Ошибка при обновлении сообщения у админа ${id}: ${error}`);
      }
    }
    
    // Уведомляем пользователя об отклонении
    if (userChatId) {
      await bot.sendMessage(
        userChatId,
        "К сожалению, твоя анкета была отклонена админом @" + adminUsername + ". Ты можешь попробовать еще раз позже или связаться с администрацией для получения подробной информации."
      );
    }
    
    // Удаляем анкету из ожидающих
    delete pendingForms[targetUserId];
    
    await bot.answerCallbackQuery(callbackQuery.id, { 
      text: "Анкета отклонена", 
      show_alert: true 
    });
  }
  else {
    await bot.answerCallbackQuery(callbackQuery.id);
  }
} 