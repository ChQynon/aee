// Полный обработчик webhook для Telegram
const TelegramBot = require('node-telegram-bot-api');
const token = '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

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

// Состояния пользователей
const userStates = {};
const userForms = {};
const pendingForms = {};
const processedForms = {
    accepted: [],
    rejected: []
};

// Состояния разговора
const STATES = {
    IDLE: 'IDLE',
    AWAITING_NAME: 'AWAITING_NAME',
    AWAITING_AGE: 'AWAITING_AGE',
    AWAITING_TIMEZONE: 'AWAITING_TIMEZONE',
    AWAITING_ACTIVITY: 'AWAITING_ACTIVITY',
    AWAITING_WHY_US: 'AWAITING_WHY_US',
    AWAITING_MINECRAFT_VERSION: 'AWAITING_MINECRAFT_VERSION',
    AWAITING_MINECRAFT_TYPE: 'AWAITING_MINECRAFT_TYPE',
    AWAITING_SERVER_ACTIVITY: 'AWAITING_SERVER_ACTIVITY',
    AWAITING_CHAT_ACTIVITY: 'AWAITING_CHAT_ACTIVITY',
    AWAITING_OTHER_HOUSES: 'AWAITING_OTHER_HOUSES',
    AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION'
};

// Функция для проверки, является ли пользователь администратором
function isAdmin(userId) {
    return ADMIN_IDS.includes(Number(userId));
}

// Обработчик веб-хука для Vercel
module.exports = async (req, res) => {
  try {
    // GET-запрос для проверки работоспособности
    if (req.method === 'GET') {
      return res.status(200).json({ status: 'Bot is running' });
    }
    
    // Обработка POST-запросов от Telegram
    if (req.method === 'POST') {
      const update = req.body;
      console.log('WEBHOOK:', JSON.stringify(update).slice(0, 200));
      
      // Создаем экземпляр бота
      const bot = new TelegramBot(token);
      
      // Обработка текстовых сообщений
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const userId = update.message.from.id;
        
        console.log(`Сообщение: ${text} от ${userId} (${chatId})`);
        
        // Команда /start
        if (text === '/start') {
          if (isAdmin(userId)) {
            await bot.sendMessage(chatId, 
              "Привет, администратор! 👋\n\n" +
              "Я бот для приема анкет в хаус Sunset. " +
              "Ждите анкеты от пользователей, я буду пересылать их вам.\n\n" +
              "Команды для администраторов:\n" +
              "/list - просмотр списка непринятых анкет\n" +
              "/history_accepted - просмотр принятых анкет\n" +
              "/history_rejected - просмотр отклоненных анкет"
            );
          } else {
            userStates[chatId] = STATES.AWAITING_NAME;
            userForms[chatId] = {};
            
            await bot.sendMessage(chatId, 
              "Привет! Я бот для приема анкет в хаус Sunset. " +
              "Давай начнем заполнение анкеты.\n\n" +
              "🍂 Укажи своё Имя + Ник:");
          }
        }
        // Команда /cancel для отмены заполнения анкеты
        else if (text === '/cancel') {
          if (userStates[chatId]) {
            userStates[chatId] = STATES.IDLE;
            delete userForms[chatId];
            
            await bot.sendMessage(chatId, "Заполнение анкеты отменено. Если захотите начать заново, используйте команду /start");
          } else {
            await bot.sendMessage(chatId, "У вас нет активного заполнения анкеты для отмены.");
          }
        }
        // Команда /list для администраторов
        else if (text === '/list' && isAdmin(userId)) {
          const pendingFormsCount = Object.keys(pendingForms).length;
          
          if (pendingFormsCount === 0) {
            await bot.sendMessage(chatId, "В настоящий момент нет непринятых анкет.");
            return;
          }
          
          let message = `📋 Список непринятых анкет (${pendingFormsCount}):\n\n`;
          
          for (const [userId, formData] of Object.entries(pendingForms)) {
            const username = formData.userData.username;
            const form = formData.userData.form;
            
            message += `👤 @${username} (ID: ${userId})\n`;
            message += `📝 Имя и ник: ${form.name}\n`;
            message += `🔹 Возраст: ${form.age}\n\n`;
          }
          
          message += "Чтобы просмотреть полную анкету, используйте команду /view_[ID пользователя], например: /view_12345678";
          
          await bot.sendMessage(chatId, message);
        }
        // Другие команды админа
        else if (text === '/history_accepted' && isAdmin(userId)) {
          // ... код для истории принятых анкет ...
          await bot.sendMessage(chatId, "История принятых анкет будет доступна в следующем обновлении");
        }
        else if (text === '/history_rejected' && isAdmin(userId)) {
          // ... код для истории отклоненных анкет ...
          await bot.sendMessage(chatId, "История отклоненных анкет будет доступна в следующем обновлении");
        }
        // Просмотр анкеты /view_ID
        else if (text.startsWith('/view_') && isAdmin(userId)) {
          const targetUserId = text.split('_')[1];
          
          if (!pendingForms[targetUserId]) {
            await bot.sendMessage(chatId, "Анкета не найдена или уже обработана.");
            return;
          }
          
          const { userData } = pendingForms[targetUserId];
          const username = userData.username;
          const form = userData.form;
          
          const formText = 
          `АНКЕТА ПОЛЬЗОВАТЕЛЯ (ID: ${targetUserId}):

От пользователя: @${username}

🍂 Имя + Ник: ${form.name}
🍂 Возраст + День рождения: ${form.age}
🍂 Часовой пояс: ${form.timezone}
🍂 Актив/Неактив: ${form.activity}
🍂 Почему выбрал(а) именно нас: ${form.why_us}
🍂 Версия Minecraft: ${form.minecraft_version}
🍂 Тип: ${form.minecraft_type}
🍂 Активность на сервере и в съёмках: ${form.server_activity}
🍂 Активность в чате (150-200 сообщений в неделю): ${form.chat_activity}
🍂 Подтверждение отсутствия в других хаусах: ${form.other_houses}`;
          
          const options = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Принять в хаус ✅', callback_data: `accept_${targetUserId}` },
                  { text: 'Отклонить ❌', callback_data: `reject_${targetUserId}` }
                ]
              ]
            }
          };
          
          await bot.sendMessage(chatId, formText, options);
        }
        // Обычные сообщения (заполнение анкеты)
        else if (userStates[chatId]) {
          await handleTextMessage(bot, chatId, text, userId);
        }
      }
      // Обработка нажатий на кнопки
      else if (update.callback_query) {
        const callbackQuery = update.callback_query;
        await handleCallbackQuery(bot, callbackQuery);
      }
      
      return res.status(200).send('OK');
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('ОШИБКА:', error);
    return res.status(500).json({
      error: String(error),
      stack: error.stack
    });
  }
};

// Функция для обработки текстовых сообщений
async function handleTextMessage(bot, chatId, text, userId) {
  try {
    switch (userStates[chatId]) {
      case STATES.AWAITING_NAME:
        userForms[chatId].name = text;
        userStates[chatId] = STATES.AWAITING_AGE;
        await bot.sendMessage(chatId, "🍂 Укажи свой Возраст + День рождения:");
        break;
        
      case STATES.AWAITING_AGE:
        if (text.includes('11') || text.includes('10') || text.includes('9') || text.includes('8')) {
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
        userStates[chatId] = STATES.AWAITING_ACTIVITY;
        await bot.sendMessage(chatId, "🍂 Какой у тебя Актив/Неактив (когда обычно находишься в игре):");
        break;
        
      case STATES.AWAITING_ACTIVITY:
        userForms[chatId].activity = text;
        userStates[chatId] = STATES.AWAITING_WHY_US;
        await bot.sendMessage(chatId, "🍂 Почему ты выбрал(а) именно нас:");
        break;
        
      case STATES.AWAITING_WHY_US:
        userForms[chatId].why_us = text;
        userStates[chatId] = STATES.AWAITING_MINECRAFT_VERSION;
        await bot.sendMessage(chatId, "What version of Minecraft do you play?");
        break;
        
      case STATES.AWAITING_MINECRAFT_VERSION:
        userForms[chatId].minecraft_version = text;
        userStates[chatId] = STATES.AWAITING_MINECRAFT_TYPE;
        await bot.sendMessage(chatId, "What type of Minecraft do you play? (Java or Bedrock)");
        break;
        
      case STATES.AWAITING_MINECRAFT_TYPE:
        userForms[chatId].minecraft_type = text;
        
        if (text.toLowerCase().includes('bedrock')) {
          await bot.sendMessage(chatId, 
            "⚠️ Извини, но в наш хаус принимаются только игроки Java-версии. " +
            "Ты можешь попробовать снова, если перейдешь на Java-версию Minecraft!"
          );
          userStates[chatId] = STATES.IDLE;
          delete userForms[chatId];
          return;
        }
        
        userStates[chatId] = STATES.AWAITING_SERVER_ACTIVITY;
        await bot.sendMessage(chatId, "🍂 Расскажи о своей активности на сервере и в съёмках:");
        break;
        
      case STATES.AWAITING_SERVER_ACTIVITY:
        userForms[chatId].server_activity = text;
        userStates[chatId] = STATES.AWAITING_CHAT_ACTIVITY;
        await bot.sendMessage(chatId, "🍂 Подтверди, что согласен(на) быть активным(ой) в чате (150-200 сообщений в неделю):");
        break;
        
      case STATES.AWAITING_CHAT_ACTIVITY:
        userForms[chatId].chat_activity = text;
        userStates[chatId] = STATES.AWAITING_OTHER_HOUSES;
        await bot.sendMessage(chatId, "🍂 Подтверди, что не состоишь в других хаусах:");
        break;
        
      case STATES.AWAITING_OTHER_HOUSES:
        userForms[chatId].other_houses = text;
        userStates[chatId] = STATES.AWAITING_CONFIRMATION;
        
        const form = userForms[chatId];
        const formText = 
          `Твоя анкета:

🍂 Имя + Ник: ${form.name}
🍂 Возраст + День рождения: ${form.age}
🍂 Часовой пояс: ${form.timezone}
🍂 Актив/Неактив: ${form.activity}
🍂 Почему выбрал(а) именно нас: ${form.why_us}
🍂 Версия Minecraft: ${form.minecraft_version}
🍂 Тип: ${form.minecraft_type}
🍂 Активность на сервере и в съёмках: ${form.server_activity}
🍂 Активность в чате (150-200 сообщений в неделю): ${form.chat_activity}
🍂 Подтверждение отсутствия в других хаусах: ${form.other_houses}

Всё верно? Можно отправлять на рассмотрение?`;
        
        const options = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Да, отправить ✅', callback_data: 'confirm' },
                { text: 'Нет, заполнить заново ❌', callback_data: 'restart' }
              ]
            ]
          }
        };
        
        await bot.sendMessage(chatId, formText, options);
        break;
    }
  } catch (error) {
    console.error("Ошибка при обработке сообщения:", error);
    await bot.sendMessage(chatId, "Произошла ошибка при обработке сообщения. Пожалуйста, попробуйте снова или используйте /start для перезапуска.");
  }
}

// Функция для обработки callback-запросов (кнопок)
async function handleCallbackQuery(bot, callbackQuery) {
  try {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    
    if (data === 'confirm' && userStates[chatId] === STATES.AWAITING_CONFIRMATION) {
      const username = callbackQuery.from.username || "без имени пользователя";
      
      // Формируем окончательный текст анкеты
      const form = userForms[chatId];
      const formText = 
      `НОВАЯ АНКЕТА В ХАУС SUNSET!

От пользователя: @${username} (ID: ${userId})

🍂 Имя + Ник: ${form.name}
🍂 Возраст + День рождения: ${form.age}
🍂 Часовой пояс: ${form.timezone}
🍂 Актив/Неактив: ${form.activity}
🍂 Почему выбрал(а) именно нас: ${form.why_us}
🍂 Версия Minecraft: ${form.minecraft_version}
🍂 Тип: ${form.minecraft_type}
🍂 Активность на сервере и в съёмках: ${form.server_activity}
🍂 Активность в чате (150-200 сообщений в неделю): ${form.chat_activity}
🍂 Подтверждение отсутствия в других хаусах: ${form.other_houses}`;
      
      // Уведомляем всех админов о новой анкете
      for (const adminId of ADMIN_IDS) {
        try {
          await bot.sendMessage(adminId, 
            "📬 Поступила новая анкета в хаус Sunset!\n" +
            "Используйте команду /list для просмотра всех непринятых анкет.");
        } catch (error) {
          console.error(`Ошибка при отправке уведомления админу ${adminId}: ${error}`);
        }
      }
      
      // Отправляем анкету всем админам с кнопками для принятия/отклонения
      for (const adminId of ADMIN_IDS) {
        try {
          const adminMsg = await bot.sendMessage(adminId, formText, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Принять в хаус ✅', callback_data: `accept_${userId}` },
                  { text: 'Отклонить ❌', callback_data: `reject_${userId}` }
                ]
              ]
            }
          });
          
          // Сохраняем сообщение для каждого админа, чтобы потом обновить кнопки
          if (!pendingForms[userId]) {
            pendingForms[userId] = {
              adminMessages: {},
              userData: {
                username,
                form
              }
            };
          }
          
          pendingForms[userId].adminMessages[adminId] = {
            chat_id: adminId,
            message_id: adminMsg.message_id
          };
        } catch (error) {
          console.error(`Ошибка при отправке анкеты админу ${adminId}: ${error}`);
        }
      }
      
      // Отправляем ссылку на групповой чат
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Присоединиться к чату Sunset', url: GROUP_LINK }]
          ]
        }
      };
      
      await bot.editMessageText(
        "Спасибо! Твоя анкета принята и отправлена на рассмотрение админам.\n\n" +
        "ОБЯЗАТЕЛЬНО отправь заявку в наш чатик по ссылке ниже! Без заявки твоя анкета не будет рассмотрена.", 
        {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          reply_markup: options.reply_markup
        }
      );
      
      // Очищаем данные пользователя
      userStates[chatId] = STATES.IDLE;
      
      // Сохраняем чат ID для будущего уведомления
      if (pendingForms[userId]) {
        pendingForms[userId].userChatId = chatId;
      }
    } 
    else if (data === 'restart') {
      userStates[chatId] = STATES.AWAITING_NAME;
      userForms[chatId] = {};
      
      await bot.editMessageText(
        "Давай заполним анкету заново. Пожалуйста, укажи своё Имя + Ник:", 
        {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id
        }
      );
    }
    // Кнопки для админов
    else if (data.startsWith('accept_') || data.startsWith('reject_')) {
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: "Эта функция будет доступна в следующем обновлении.", 
        show_alert: true 
      });
    }
    
    // Отвечаем на callback_query, чтобы удалить состояние загрузки кнопки
    await bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error("Ошибка при обработке callback_query:", error);
    await bot.answerCallbackQuery(callbackQuery.id, { 
      text: "Произошла ошибка при обработке запроса. Пожалуйста, попробуйте снова.", 
      show_alert: true 
    });
  }
} 