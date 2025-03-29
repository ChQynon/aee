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

// Инициализация бота в зависимости от среды
let bot;
let BOT_ID = null;

// Настройка для Vercel (вебхук) или локальной разработки (поллинг)
if (process.env.VERCEL_URL) {
    // Режим вебхука для Vercel
    const url = `https://${process.env.VERCEL_URL}`;
    bot = new TelegramBot(token);
    bot.setWebHook(`${url}/api/webhook`);
} else {
    // Режим поллинга для локальной разработки
    bot = new TelegramBot(token, { polling: true });
}

// Получаем информацию о боте при запуске
bot.getMe().then(botInfo => {
    BOT_ID = botInfo.id;
    console.log(`Бот ${botInfo.username} (ID: ${BOT_ID}) успешно запущен!`);
}).catch(error => {
    console.error(`Ошибка при получении информации о боте: ${error}`);
});

// Для Vercel - обработка вебхука
if (process.env.VERCEL_URL) {
    // Экспортируем бота и данные для использования в других файлах
    module.exports = { 
        bot,
        pendingForms,
        processedForms
    };
} else {
    // Делаем данные доступными глобально для локальной разработки
    global.pendingForms = pendingForms;
    global.processedForms = processedForms;
}

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

// Обработка новых заявок на вступление в группу
bot.on('chat_join_request', async (request) => {
    const chatId = request.chat.id;
    const userId = request.from.id;
    const username = request.from.username || `ID: ${userId}`;
    
    console.log(`Получена новая заявка на вступление от пользователя @${username} (ID: ${userId})`);
    
    // Уведомляем администраторов о новой заявке
    for (const adminId of ADMIN_IDS) {
        try {
            await bot.sendMessage(
                adminId,
                `📣 Получена новая заявка на вступление в чат от пользователя @${username} (ID: ${userId}).\n\n` +
                `Если у этого пользователя есть анкета, вы можете увидеть её в списке непринятых анкет (/list)`
            );
        } catch (error) {
            console.error(`Ошибка при отправке уведомления админу ${adminId}: ${error}`);
        }
    }
});

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (isAdmin(userId)) {
        bot.sendMessage(chatId, 
            "Привет, администратор! 👋\n\n" +
            "Я бот для приема анкет в хаус Sunset. " +
            "Ждите анкеты от пользователей, я буду пересылать их вам.\n\n" +
            "Команды для администраторов:\n" +
            "/list - просмотр списка непринятых анкет\n" +
            "/history_accepted - просмотр принятых анкет\n" +
            "/history_rejected - просмотр отклоненных анкет"
        );
    } else {
        // Устанавливаем состояние "ожидание имени и ника"
        userStates[chatId] = STATES.AWAITING_NAME;
        userForms[chatId] = {}; // Инициализируем пустую анкету
        
        bot.sendMessage(chatId, 
            "Привет! Я бот для приема анкет в хаус Sunset. " +
            "Давай начнем заполнение анкеты.\n\n" +
            "🍂 Укажи своё Имя + Ник:");
    }
});

// Обработка команды /history_accepted для просмотра принятых анкет
bot.onText(/\/history_accepted/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, "Эта команда доступна только администраторам.");
        return;
    }
    
    // Проверяем, есть ли принятые анкеты
    if (processedForms.accepted.length === 0) {
        bot.sendMessage(chatId, "История принятых анкет пуста.");
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
    bot.sendMessage(chatId, message);
});

// Обработка команды /history_rejected для просмотра отклоненных анкет
bot.onText(/\/history_rejected/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, "Эта команда доступна только администраторам.");
        return;
    }
    
    // Проверяем, есть ли отклоненные анкеты
    if (processedForms.rejected.length === 0) {
        bot.sendMessage(chatId, "История отклоненных анкет пуста.");
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
    bot.sendMessage(chatId, message);
});

// Обработка команды /list для администраторов
bot.onText(/\/list/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, "Эта команда доступна только администраторам.");
        return;
    }
    
    // Проверяем, есть ли непринятые анкеты
    const pendingFormsCount = Object.keys(pendingForms).length;
    
    if (pendingFormsCount === 0) {
        bot.sendMessage(chatId, "В настоящий момент нет непринятых анкет.");
        return;
    }
    
    // Создаем список непринятых анкет
    let message = `📋 Список непринятых анкет (${pendingFormsCount}):\n\n`;
    
    for (const [userId, formData] of Object.entries(pendingForms)) {
        const username = formData.userData.username;
        const form = formData.userData.form;
        
        message += `👤 @${username} (ID: ${userId})\n`;
        message += `📝 Имя и ник: ${form.name}\n`;
        message += `🔹 Возраст: ${form.age}\n\n`;
    }
    
    message += "Чтобы просмотреть полную анкету, используйте команду /view_[ID пользователя], например: /view_12345678";
    
    bot.sendMessage(chatId, message);
});

// Обработка команды /view_[userId] для просмотра анкеты
bot.onText(/\/view_(\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const targetUserId = match[1];
    
    // Проверяем, является ли пользователь администратором
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, "Эта команда доступна только администраторам.");
        return;
    }
    
    // Проверяем, существует ли анкета
    if (!pendingForms[targetUserId]) {
        bot.sendMessage(chatId, "Анкета не найдена или уже обработана.");
        return;
    }
    
    // Получаем данные анкеты
    const { userData } = pendingForms[targetUserId];
    const username = userData.username;
    const form = userData.form;
    
    // Формируем полный текст анкеты
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
    
    // Отправляем анкету с кнопками для принятия/отклонения
    bot.sendMessage(chatId, formText, {
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

// Обработка команды /cancel
bot.onText(/\/cancel/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Проверяем, является ли пользователь администратором
    if (isAdmin(userId)) {
        bot.sendMessage(chatId, "Нечего отменять, вы - администратор.");
        return;
    }
    
    // Очищаем состояние и анкету пользователя
    userStates[chatId] = STATES.IDLE;
    delete userForms[chatId];
    
    bot.sendMessage(chatId, "Заполнение анкеты отменено.");
});

// Основной обработчик сообщений
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;
    
    // Игнорируем команды
    if (text && text.startsWith('/')) {
        return;
    }
    
    // Игнорируем сообщения от администраторов
    if (isAdmin(userId)) {
        return;
    }
    
    // Получаем текущее состояние пользователя
    const currentState = userStates[chatId] || STATES.IDLE;
    
    // Обрабатываем сообщения в зависимости от состояния
    switch (currentState) {
        case STATES.AWAITING_NAME:
            userForms[chatId].name = text;
            userStates[chatId] = STATES.AWAITING_AGE;
            bot.sendMessage(chatId, "🍂 Укажи свой Возраст + День рождения (вам должно быть 12+ лет):");
            break;
            
        case STATES.AWAITING_AGE:
            userForms[chatId].age = text;
            userStates[chatId] = STATES.AWAITING_TIMEZONE;
            bot.sendMessage(chatId, "🍂 Укажи свой Часовой пояс:");
            break;
            
        case STATES.AWAITING_TIMEZONE:
            userForms[chatId].timezone = text;
            userStates[chatId] = STATES.AWAITING_ACTIVITY;
            bot.sendMessage(chatId, "🍂 Ты Активный или Неактивный игрок?");
            break;
            
        case STATES.AWAITING_ACTIVITY:
            userForms[chatId].activity = text;
            userStates[chatId] = STATES.AWAITING_WHY_US;
            bot.sendMessage(chatId, "🍂 Почему ты выбрал(а) именно наш хаус Sunset?");
            break;
            
        case STATES.AWAITING_WHY_US:
            userForms[chatId].why_us = text;
            userStates[chatId] = STATES.AWAITING_MINECRAFT_VERSION;
            bot.sendMessage(chatId, "🍂 Укажи версию Minecraft, на которой ты играешь (например, 1.20.1):");
            break;
            
        case STATES.AWAITING_MINECRAFT_VERSION:
            userForms[chatId].minecraft_version = text;
            userStates[chatId] = STATES.AWAITING_MINECRAFT_TYPE;
            bot.sendMessage(chatId, "🍂 Укажи тип Minecraft (Java или Bedrock):");
            break;
            
        case STATES.AWAITING_MINECRAFT_TYPE:
            userForms[chatId].minecraft_type = text;
            userStates[chatId] = STATES.AWAITING_SERVER_ACTIVITY;
            
            // Проверка на Java
            const typeLower = text.toLowerCase();
            if (!typeLower.includes('java')) {
                bot.sendMessage(chatId, 
                    "❗ Внимание! Для вступления в хаус Sunset требуется Java-версия Minecraft.\n" +
                    "Вы указали: " + text + ". Если это ошибка, то перезапустите заполнение анкеты с помощью команды /start.\n\n" +
                    "Если у вас все-таки Java-версия, то продолжим:");
            }
            
            bot.sendMessage(chatId, "🍂 Подтверди, что ты будешь активен/активна на сервере и в съёмках:");
            break;
            
        case STATES.AWAITING_SERVER_ACTIVITY:
            userForms[chatId].server_activity = text;
            userStates[chatId] = STATES.AWAITING_CHAT_ACTIVITY;
            bot.sendMessage(chatId, "🍂 Подтверди, что ты будешь активен/активна в чате (наша норма 150-200 сообщений в неделю):");
            break;
            
        case STATES.AWAITING_CHAT_ACTIVITY:
            userForms[chatId].chat_activity = text;
            userStates[chatId] = STATES.AWAITING_OTHER_HOUSES;
            bot.sendMessage(chatId, "🍂 Подтверди, что ты не состоишь в других хаусах/командах:");
            break;
            
        case STATES.AWAITING_OTHER_HOUSES:
            userForms[chatId].other_houses = text;
            userStates[chatId] = STATES.AWAITING_CONFIRMATION;
            
            // Проверяем требования
            const ageStr = userForms[chatId].age.toLowerCase();
            let meetsAgeRequirement = false;
            let meetsJavaRequirement = false;
            
            // Проверка возраста
            const ageMatch = ageStr.match(/(\d+)/);
            if (ageMatch && parseInt(ageMatch[1]) >= 12) {
                meetsAgeRequirement = true;
            }
            
            // Проверка версии Java
            const minecraft_type = userForms[chatId].minecraft_type.toLowerCase();
            if (minecraft_type.includes('java')) {
                meetsJavaRequirement = true;
            }
            
            if (!meetsAgeRequirement || !meetsJavaRequirement) {
                let errorMessage = "К сожалению, твоя анкета не соответствует требованиям:\n\n";
                
                if (!meetsAgeRequirement) {
                    errorMessage += "- Возраст должен быть 12 лет или старше\n";
                }
                
                if (!meetsJavaRequirement) {
                    errorMessage += "- Требуется Java-версия Minecraft\n";
                }
                
                errorMessage += "\nПожалуйста, начни заполнение анкеты заново с учетом этих требований (/start).";
                
                bot.sendMessage(chatId, errorMessage);
                userStates[chatId] = STATES.IDLE;
                delete userForms[chatId];
                return;
            }
            
            // Формируем анкету для подтверждения
            const formText = 
            `Твоя анкета:

🍂 Имя + Ник: ${userForms[chatId].name}
🍂 Возраст + День рождения: ${userForms[chatId].age}
🍂 Часовой пояс: ${userForms[chatId].timezone}
🍂 Актив/Неактив: ${userForms[chatId].activity}
🍂 Почему выбрал(а) именно нас: ${userForms[chatId].why_us}
🍂 Версия Minecraft: ${userForms[chatId].minecraft_version}
🍂 Тип: ${userForms[chatId].minecraft_type}
🍂 Активность на сервере и в съёмках: ${userForms[chatId].server_activity}
🍂 Активность в чате (150-200 сообщений в неделю): ${userForms[chatId].chat_activity}
🍂 Подтверждение отсутствия в других хаусах: ${userForms[chatId].other_houses}`;
            
            // Создаем клавиатуру для подтверждения
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Подтвердить ✅', callback_data: 'confirm' },
                            { text: 'Заполнить заново ❌', callback_data: 'restart' }
                        ]
                    ]
                }
            };
            
            bot.sendMessage(chatId, formText + "\n\nВсё правильно?", options);
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
        
        bot.editMessageText(
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
        
        bot.editMessageText(
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
            bot.answerCallbackQuery(callbackQuery.id, { text: "У вас нет прав для этого действия" });
            return;
        }
        
        // Проверяем, что форма существует
        if (!pendingForms[targetUserId]) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "Эта анкета больше недоступна" });
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
                bot.sendMessage(
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
                    
                    bot.answerCallbackQuery(callbackQuery.id, { 
                        text: "Пользователь успешно принят в хаус Sunset! Заявка одобрена.", 
                        show_alert: true 
                    });
                } else {
                    // Если бот не админ, то отправляем сообщение админу с инструкцией
                    bot.sendMessage(
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
                    
                    bot.answerCallbackQuery(callbackQuery.id, { 
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
                bot.sendMessage(
                    chatId,
                    `❌ Ошибка при автоматическом принятии заявки: ${error.message}\n` +
                    `Пожалуйста, примите заявку пользователя @${username} вручную через интерфейс Telegram.`
                );
                
                bot.answerCallbackQuery(callbackQuery.id, { 
                    text: "Произошла ошибка при принятии заявки. Пожалуйста, примите заявку вручную.", 
                    show_alert: true 
                });
            }
            
            // Удаляем анкету из ожидающих
            delete pendingForms[targetUserId];
            
        } catch (error) {
            console.error(`Ошибка при принятии анкеты: ${error}`);
            
            bot.answerCallbackQuery(callbackQuery.id, { 
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
            bot.answerCallbackQuery(callbackQuery.id, { text: "У вас нет прав для этого действия" });
            return;
        }
        
        // Проверяем, что форма существует
        if (!pendingForms[targetUserId]) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "Эта анкета больше недоступна" });
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
            bot.sendMessage(
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
        
        bot.answerCallbackQuery(callbackQuery.id, { text: "Анкета отклонена" });
    }
});

// Запускаем бота с обработкой ошибок
process.on('unhandledRejection', (reason, promise) => {
    console.error('Необработанная ошибка в Promise:', reason);
});

// Обрабатываем остановку процесса
process.on('SIGINT', () => {
    console.log('Бот остановлен');
    process.exit(0);
});

console.log('Бот запущен. Нажмите Ctrl+C для остановки.'); 