const TelegramBot = require('node-telegram-bot-api');

// Отладочная информация - записываем все, что происходит
console.log('Webhook запущен: ' + new Date().toISOString());
console.log('Версия Node.js:', process.version);
console.log('Переменные окружения:', {
  VERCEL_URL: process.env.VERCEL_URL,
  NODE_ENV: process.env.NODE_ENV
});

// Токен бота
const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';
console.log('Используется токен бота:', token.substring(0, 10) + '...');

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

// Хранилище для состояний пользователей
const userStates = {};
// Хранилище для анкет пользователей
const userForms = {};
// Хранилище для ожидающих анкет (id пользователя -> message_id для обновления)
const pendingForms = {};
// Хранилище для истории обработанных анкет
const processedForms = {
    accepted: [], // Принятые анкеты
    rejected: []  // Отклоненные анкеты
};

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

// Переменная для хранения ID бота
let BOT_ID = null;

// Получаем информацию о боте при запуске
bot.getMe().then(botInfo => {
    BOT_ID = botInfo.id;
    console.log(`Бот ${botInfo.username} (ID: ${BOT_ID}) успешно запущен!`);
}).catch(error => {
    console.error(`Ошибка при получении информации о боте: ${error}`);
});

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

// Функция проверки, является ли пользователь администратором
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

// Добавляем обработчики команд
bot.onText(/\/start/, async (msg) => {
    try {
        console.log('Получена команда /start от пользователя', msg.from.id);
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        // Проверяем, является ли пользователь администратором
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
            console.log('Отправлено сообщение админу', userId);
        } else {
            // Устанавливаем состояние "ожидание имени и ника"
            userStates[chatId] = STATES.AWAITING_NAME;
            userForms[chatId] = {}; // Инициализируем пустую анкету
            
            await bot.sendMessage(chatId, 
                "Привет! Я бот для приема анкет в хаус Sunset. " +
                "Давай начнем заполнение анкеты.\n\n" +
                "🍂 Укажи своё Имя + Ник:");
            console.log('Отправлено начальное сообщение пользователю', userId);
        }
    } catch (error) {
        console.error('Ошибка при обработке команды /start:', error);
    }
});

// Упрощенная функция тестовой отправки сообщения
bot.onText(/\/test/, async (msg) => {
    try {
        console.log('Получена команда /test от пользователя', msg.from.id);
        const chatId = msg.chat.id;
        await bot.sendMessage(chatId, "Тестовое сообщение! Бот работает!");
        console.log('Отправлено тестовое сообщение пользователю', msg.from.id);
    } catch (error) {
        console.error('Ошибка при отправке тестового сообщения:', error);
    }
});

// Обработка команды /list для просмотра ожидающих анкет
bot.onText(/\/list/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
        await bot.sendMessage(chatId, "Эта команда доступна только администраторам.");
        return;
    }
    
    // Проверяем, есть ли ожидающие анкеты
    const pendingKeys = Object.keys(pendingForms);
    if (pendingKeys.length === 0) {
        await bot.sendMessage(chatId, "Нет непринятых анкет.");
        return;
    }
    
    // Создаем список ожидающих анкет
    let message = `📋 Непринятые анкеты (${pendingKeys.length}):\n\n`;
    
    for (const key of pendingKeys) {
        const form = pendingForms[key];
        message += `👤 @${form.userData.username} (ID: ${key})\n`;
        message += `📝 Имя и ник: ${form.userData.form.name}\n`;
        message += `/view_${key} - посмотреть подробнее\n\n`;
    }
    
    // Отправляем список
    await bot.sendMessage(chatId, message);
});

// Обработка команды /view_ для просмотра конкретной анкеты
bot.onText(/\/view_(\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const targetUserId = match[1];
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
        await bot.sendMessage(chatId, "Эта команда доступна только администраторам.");
        return;
    }
    
    // Проверяем, существует ли анкета с таким ID
    if (!pendingForms[targetUserId]) {
        await bot.sendMessage(chatId, "Анкета с таким ID не найдена или уже рассмотрена.");
        return;
    }
    
    const form = pendingForms[targetUserId].userData.form;
    const username = pendingForms[targetUserId].userData.username;
    
    // Формируем текст анкеты
    const formText = 
    `АНКЕТА ОТ @${username} (ID: ${targetUserId})

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
    
    // Отправляем анкету с кнопками принять/отклонить
    await bot.sendMessage(chatId, formText, {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Принять в хаус ✅', callback_data: `accept_${targetUserId}` },
                    { text: 'Отклонить ❌', callback_data: `reject_${targetUserId}` }
                ]
            ]
        }
    });
});

// Обработка команды /cancel для отмены анкеты
bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Проверяем, находится ли пользователь в процессе заполнения анкеты
    if (userStates[chatId] && userStates[chatId] !== STATES.IDLE) {
        // Сбрасываем состояние
        userStates[chatId] = STATES.IDLE;
        delete userForms[chatId];
        
        await bot.sendMessage(chatId, "Заполнение анкеты отменено. Чтобы начать заново, введите /start");
    } else {
        await bot.sendMessage(chatId, "Нет активного заполнения анкеты для отмены.");
    }
});

// Обработка команды /history_accepted для просмотра принятых анкет
bot.onText(/\/history_accepted/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
        await bot.sendMessage(chatId, "Эта команда доступна только администраторам.");
        return;
    }
    
    // Проверяем, есть ли принятые анкеты
    if (processedForms.accepted.length === 0) {
        await bot.sendMessage(chatId, "История принятых анкет пуста.");
        return;
    }
    
    // Создаем список принятых анкет
    let message = `📋 История принятых анкет (${processedForms.accepted.length}):\n\n`;
    
    for (const form of processedForms.accepted) {
        message += `👤 @${form.username} (ID: ${form.userId})\n`;
        message += `📝 Имя и ник: ${form.formData.name}\n`;
        message += `🔹 Принята админом: @${form.adminUsername} (ID: ${form.adminId})\n`;
        message += `🕒 Дата: ${form.date}\n\n`;
    }
    
    // Отправляем список
    await bot.sendMessage(chatId, message);
});

// Обработка команды /history_rejected для просмотра отклоненных анкет
bot.onText(/\/history_rejected/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
        await bot.sendMessage(chatId, "Эта команда доступна только администраторам.");
        return;
    }
    
    // Проверяем, есть ли отклоненные анкеты
    if (processedForms.rejected.length === 0) {
        await bot.sendMessage(chatId, "История отклоненных анкет пуста.");
        return;
    }
    
    // Создаем список отклоненных анкет
    let message = `📋 История отклоненных анкет (${processedForms.rejected.length}):\n\n`;
    
    for (const form of processedForms.rejected) {
        message += `👤 @${form.username} (ID: ${form.userId})\n`;
        message += `📝 Имя и ник: ${form.formData.name}\n`;
        message += `🔹 Отклонена админом: @${form.adminUsername} (ID: ${form.adminId})\n`;
        message += `🕒 Дата: ${form.date}\n\n`;
    }
    
    // Отправляем список
    await bot.sendMessage(chatId, message);
});

// Обработка текстовых сообщений (заполнение анкеты)
bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return; // Игнорируем команды
    
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Проверяем, находится ли пользователь в процессе заполнения анкеты
    if (!userStates[chatId] || userStates[chatId] === STATES.IDLE) return;
    
    // Обрабатываем сообщение в зависимости от состояния
    switch (userStates[chatId]) {
        case STATES.AWAITING_NAME:
            userForms[chatId].name = text;
            userStates[chatId] = STATES.AWAITING_AGE;
            await bot.sendMessage(chatId, "🍂 Укажи свой Возраст + День рождения (должно быть минимум 12 лет):");
            break;
            
        case STATES.AWAITING_AGE:
            // Проверка на возраст (должно быть минимум 12 лет)
            const age = parseInt(text);
            if (!isNaN(age) && age < 12) {
                await bot.sendMessage(chatId, "К сожалению, минимальный возраст для вступления в хаус - 12 лет. Попробуй позже!");
                userStates[chatId] = STATES.IDLE;
                delete userForms[chatId];
                return;
            }
            
            userForms[chatId].age = text;
            userStates[chatId] = STATES.AWAITING_TIMEZONE;
            await bot.sendMessage(chatId, "🍂 Укажи свой Часовой пояс:");
            break;
            
        case STATES.AWAITING_TIMEZONE:
            userForms[chatId].timezone = text;
            userStates[chatId] = STATES.AWAITING_ACTIVITY;
            await bot.sendMessage(chatId, "🍂 Укажи свой Актив/Неактив:");
            break;
            
        case STATES.AWAITING_ACTIVITY:
            userForms[chatId].activity = text;
            userStates[chatId] = STATES.AWAITING_WHY_US;
            await bot.sendMessage(chatId, "🍂 Почему ты выбрал(а) именно нас:");
            break;
            
        case STATES.AWAITING_WHY_US:
            userForms[chatId].why_us = text;
            userStates[chatId] = STATES.AWAITING_MINECRAFT_VERSION;
            await bot.sendMessage(chatId, "🍂 What Minecraft version do you play? (Какую версию Minecraft вы используете?)");
            break;
            
        case STATES.AWAITING_MINECRAFT_VERSION:
            userForms[chatId].minecraft_version = text;
            userStates[chatId] = STATES.AWAITING_MINECRAFT_TYPE;
            await bot.sendMessage(chatId, "🍂 Do you play Java or Bedrock Edition? (Вы играете на Java или Bedrock Edition?)");
            break;
            
        case STATES.AWAITING_MINECRAFT_TYPE:
            // Проверка на тип Minecraft (должен быть Java)
            const type = text.toLowerCase();
            if (type.includes("bedrock")) {
                await bot.sendMessage(chatId, "К сожалению, для вступления в хаус требуется Java-версия Minecraft. Попробуй позже, когда у тебя будет Java!");
                userStates[chatId] = STATES.IDLE;
                delete userForms[chatId];
                return;
            }
            
            userForms[chatId].minecraft_type = text;
            userStates[chatId] = STATES.AWAITING_SERVER_ACTIVITY;
            await bot.sendMessage(chatId, "🍂 Подтверди свою Активность на сервере и в съёмках:");
            break;
            
        case STATES.AWAITING_SERVER_ACTIVITY:
            userForms[chatId].server_activity = text;
            userStates[chatId] = STATES.AWAITING_CHAT_ACTIVITY;
            await bot.sendMessage(chatId, "🍂 Подтверди свою Активность в чате (норма 150-200 сообщений в неделю):");
            break;
            
        case STATES.AWAITING_CHAT_ACTIVITY:
            userForms[chatId].chat_activity = text;
            userStates[chatId] = STATES.AWAITING_OTHER_HOUSES;
            await bot.sendMessage(chatId, "🍂 Подтверди, что ты не состоишь в других хаусах/командах:");
            break;
            
        case STATES.AWAITING_OTHER_HOUSES:
            userForms[chatId].other_houses = text;
            userStates[chatId] = STATES.AWAITING_CONFIRMATION;
            
            // Отображаем заполненную анкету для подтверждения
            const formPreview = 
            `Проверь свою анкету:

🍂 Имя + Ник: ${userForms[chatId].name}
🍂 Возраст + День рождения: ${userForms[chatId].age}
🍂 Часовой пояс: ${userForms[chatId].timezone}
🍂 Актив/Неактив: ${userForms[chatId].activity}
🍂 Почему выбрал(а) именно нас: ${userForms[chatId].why_us}
🍂 Версия Minecraft: ${userForms[chatId].minecraft_version}
🍂 Тип: ${userForms[chatId].minecraft_type}
🍂 Активность на сервере и в съёмках: ${userForms[chatId].server_activity}
🍂 Активность в чате (150-200 сообщений в неделю): ${userForms[chatId].chat_activity}
🍂 Подтверждение отсутствия в других хаусах: ${userForms[chatId].other_houses}

Всё верно? Ты можешь отправить анкету или заполнить заново.`;
            
            await bot.sendMessage(chatId, formPreview, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Отправить анкету ✅', callback_data: 'confirm' },
                            { text: 'Заполнить заново 🔄', callback_data: 'restart' }
                        ]
                    ]
                }
            });
            break;
    }
});

// Обработка нажатий на кнопки
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    
    // Подтверждение анкеты
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
    // Перезапуск заполнения анкеты
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
    // Принятие анкеты админом
    else if (data.startsWith('accept_')) {
        const targetUserId = data.split('_')[1];
        const adminId = callbackQuery.from.id;
        const adminUsername = callbackQuery.from.username || `ID: ${adminId}`;
        
        // Проверяем, что это админ
        if (!isAdmin(adminId)) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "У вас нет прав для этого действия" });
            return;
        }
        
        // Проверяем, что форма существует
        if (!pendingForms[targetUserId]) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "Эта анкета больше недоступна" });
            return;
        }
        
        try {
            // Получаем данные из анкеты
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
            
            // АВТОМАТИЧЕСКИ ПРИНИМАЕМ ВСЕ ЗАЯВКИ ОТ ЭТОГО ПОЛЬЗОВАТЕЛЯ
            try {
                // Проверяем, что ID бота инициализирован
                if (!BOT_ID) {
                    // Попытка получить ID бота, если он не был инициализирован
                    const botInfo = await bot.getMe();
                    BOT_ID = botInfo.id;
                    console.log(`ID бота получен: ${BOT_ID}`);
                }
                
                // Получаем все заявки на вступление в группу
                const chatAdmins = await bot.getChatAdministrators(GROUP_CHAT_ID);
                if (chatAdmins.some(admin => admin.user.id === BOT_ID)) {
                    await bot.approveChatJoinRequest(GROUP_CHAT_ID, targetUserId);
                    await bot.sendMessage(
                        GROUP_CHAT_ID,
                        `🎉 Поздравляем @${username} с официальным принятием в хаус Sunset! 🎉\nПринят админом: @${adminUsername} (ID: ${adminId})`
                    );
                    
                    await bot.answerCallbackQuery(callbackQuery.id, { 
                        text: "Пользователь успешно принят в хаус Sunset! Заявка одобрена.", 
                        show_alert: true 
                    });
                } else {
                    // Если бот не админ, то отправляем сообщение админу с инструкцией
                    await bot.sendMessage(
                        chatId,
                        `⚠️ Внимание! Бот не имеет прав администратора в группе.\n` +
                        `Пожалуйста, добавьте бота как администратора группы с правом добавления участников, ` +
                        `чтобы он мог автоматически принимать заявки.`
                    );
                    
                    // Отправляем сообщение в чат всё равно
                    await bot.sendMessage(
                        GROUP_CHAT_ID,
                        `🎉 Поздравляем @${username} с официальным принятием в хаус Sunset! 🎉\nПринят админом: @${adminUsername} (ID: ${adminId})`
                    );
                    
                    await bot.answerCallbackQuery(callbackQuery.id, { 
                        text: "Пользователь принят, но заявку нужно принять вручную. Бот не имеет прав администратора.", 
                        show_alert: true 
                    });
                }
            } catch (error) {
                console.error(`Ошибка при принятии заявки в группу: ${error}`);
                
                // Пытаемся отправить сообщение в чат в любом случае
                try {
                    await bot.sendMessage(
                        GROUP_CHAT_ID,
                        `🎉 Поздравляем @${username} с официальным принятием в хаус Sunset! 🎉\nПринят админом: @${adminUsername} (ID: ${adminId})`
                    );
                } catch (chatError) {
                    console.error(`Ошибка при отправке сообщения в групповой чат: ${chatError}`);
                }
                
                // Уведомляем админа об ошибке
                await bot.sendMessage(
                    chatId,
                    `❌ Ошибка при автоматическом принятии заявки: ${error.message}\n` +
                    `Пожалуйста, примите заявку пользователя @${username} вручную через интерфейс Telegram.`
                );
                
                await bot.answerCallbackQuery(callbackQuery.id, { 
                    text: "Произошла ошибка при принятии заявки. Пожалуйста, примите заявку вручную.", 
                    show_alert: true 
                });
            }
            
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
    // Отклонение анкеты админом
    else if (data.startsWith('reject_')) {
        const targetUserId = data.split('_')[1];
        const adminId = callbackQuery.from.id;
        const adminUsername = callbackQuery.from.username || `ID: ${adminId}`;
        
        // Проверяем, что это админ
        if (!isAdmin(adminId)) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "У вас нет прав для этого действия" });
            return;
        }
        
        // Проверяем, что форма существует
        if (!pendingForms[targetUserId]) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "Эта анкета больше недоступна" });
            return;
        }
        
        // Обновляем сообщения у всех админов
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
        
        // Попытка отклонить заявку в групповой чат, если такая есть
        try {
            await bot.declineChatJoinRequest(GROUP_CHAT_ID, targetUserId);
        } catch (error) {
            console.error(`Ошибка при отклонении заявки в групповой чат: ${error}`);
            // Тихо игнорируем ошибку, т.к. заявки может и не быть
        }
        
        // Удаляем анкету из ожидающих
        delete pendingForms[targetUserId];
        
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Анкета отклонена" });
    }
});

// Основной обработчик запросов
module.exports = async (req, res) => {
  try {
    // Отладочная информация
    console.log(`Получен запрос: ${req.method} ${req.url}`);
    console.log('Заголовки запроса:', req.headers);
    
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
        console.error('Ошибка при получении информации о боте:', error);
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
        if (!update) {
          console.error('Пустое тело запроса');
          return res.status(400).json({ ok: false, error: 'Пустое тело запроса' });
        }
        
        console.log('Получен апдейт:', JSON.stringify(update, null, 2));
        
        if (update.message) {
          console.log('Тип сообщения:', update.message.text ? 'Текстовое' : 'Другое');
          console.log('От пользователя:', update.message.from?.id, update.message.from?.username);
        }
        
        // Используем обещание для обработки обновления
        await new Promise((resolve) => {
          bot.processUpdate(update);
          resolve();
        });
        
        // Отвечаем Telegram успешным статусом немедленно
        console.log('Апдейт обработан успешно');
        return res.status(200).json({ ok: true });
      } catch (error) {
        console.error('Ошибка обработки апдейта:', error);
        return res.status(500).json({ ok: false, error: error.message });
      }
    }
    
    // Для других методов
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('Необработанная ошибка в обработчике запросов:', error);
    return res.status(500).json({ ok: false, error: 'Внутренняя ошибка сервера' });
  }
}; 