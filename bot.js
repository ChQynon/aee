const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN || '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

const ADMIN_IDS = [
    7683124601,
    1971986164,
    1663401570,
    6844219237,
    1536993655,
    718910310
];

const GROUP_CHAT_ID = -1002081050841;

const GROUP_LINK = 'https://t.me/+mjIfXRUDx19iOGQy';

// Инициализируем бота в разных режимах в зависимости от окружения
let bot;
let BOT_ID = null;

// Проверяем, находимся ли мы в среде разработки или на Vercel
if (process.env.VERCEL_URL) {
    // В среде Vercel используем webhook
    const webhookUrl = `https://${process.env.VERCEL_URL}/api/webhook`;
    bot = new TelegramBot(token, {
        webhook: {
            url: webhookUrl,
            maxConnections: 40
        }
    });
    console.log(`Запущен в режиме webhook: ${webhookUrl}`);
    
    // Установка webhook
    bot.setWebHook(webhookUrl).then(() => {
        console.log('Webhook установлен успешно');
    }).catch(error => {
        console.error('Ошибка при установке webhook:', error);
    });
} else {
    // В локальной среде используем long polling
    bot = new TelegramBot(token, { polling: true });
    console.log('Запущен в режиме long polling');
}

// Получаем информацию о боте при запуске
try {
    bot.getMe().then(botInfo => {
        BOT_ID = botInfo.id;
        console.log(`Бот ${botInfo.username} (ID: ${BOT_ID}) успешно запущен!`);
    }).catch(error => {
        console.error(`Ошибка при получении информации о боте: ${error}`);
    });
} catch (error) {
    console.error('Ошибка при инициализации бота:', error);
}

const userStates = {};
const userForms = {};
const pendingForms = {};
const processedForms = {
    accepted: [],
    rejected: []
};

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

function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

bot.on('chat_join_request', async (request) => {
    const chatId = request.chat.id;
    const userId = request.from.id;
    const username = request.from.username || `ID: ${userId}`;
    
    console.log(`Получена новая заявка на вступление от пользователя @${username} (ID: ${userId})`);
    
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

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
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
        userStates[chatId] = STATES.AWAITING_NAME;
        
        bot.sendMessage(chatId, 
            "Привет! Я бот для приема анкет в хаус Sunset. " +
            "Давай начнем заполнение анкеты.\n\n" +
            "🍂 Укажи своё Имя + Ник:");
    }
});

bot.onText(/\/history_accepted/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, "Эта команда доступна только администраторам.");
        return;
    }
    
    if (processedForms.accepted.length === 0) {
        bot.sendMessage(chatId, "История принятых анкет пуста.");
        return;
    }
    
    let message = `📋 История принятых анкет (${processedForms.accepted.length}):\n\n`;
    
    for (const form of processedForms.accepted) {
        message += `👤 @${form.username} (ID: ${form.userId})\n`;
        message += `📝 Имя и ник: ${form.formData.name}\n`;
        message += `🔹 Принята админом: @${form.adminUsername} (ID: ${form.adminId})\n`;
        message += `🕒 Дата: ${form.date}\n\n`;
    }
    
    bot.sendMessage(chatId, message);
});

bot.onText(/\/history_rejected/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, "Эта команда доступна только администраторам.");
        return;
    }
    
    if (processedForms.rejected.length === 0) {
        bot.sendMessage(chatId, "История отклоненных анкет пуста.");
        return;
    }
    
    let message = `📋 История отклоненных анкет (${processedForms.rejected.length}):\n\n`;
    
    for (const form of processedForms.rejected) {
        message += `👤 @${form.username} (ID: ${form.userId})\n`;
        message += `📝 Имя и ник: ${form.formData.name}\n`;
        message += `🔹 Отклонена админом: @${form.adminUsername} (ID: ${form.adminId})\n`;
        message += `🕒 Дата: ${form.date}\n\n`;
    }
    
    bot.sendMessage(chatId, message);
});

bot.onText(/\/list/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, "Эта команда доступна только администраторам.");
        return;
    }
    
    const pendingFormsCount = Object.keys(pendingForms).length;
    
    if (pendingFormsCount === 0) {
        bot.sendMessage(chatId, "В настоящий момент нет непринятых анкет.");
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
    
    bot.sendMessage(chatId, message);
});

bot.onText(/\/view_(\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const targetUserId = match[1];
    
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, "Эта команда доступна только администраторам.");
        return;
    }
    
    if (!pendingForms[targetUserId]) {
        bot.sendMessage(chatId, "Анкета не найдена или уже обработана.");
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

bot.onText(/\/cancel/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (isAdmin(userId)) {
        bot.sendMessage(chatId, "Нечего отменять, вы - администратор.");
        return;
    }
    
    userStates[chatId] = STATES.IDLE;
    delete userForms[chatId];
    
    bot.sendMessage(chatId, "Заполнение анкеты отменено.");
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;
    
    if (text && text.startsWith('/')) {
        return;
    }
    
    if (isAdmin(userId)) {
        return;
    }
    
    const currentState = userStates[chatId] || STATES.IDLE;
    
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
            
            const ageStr = userForms[chatId].age.toLowerCase();
            let meetsAgeRequirement = false;
            let meetsJavaRequirement = false;
            
            const ageMatch = ageStr.match(/(\d+)/);
            if (ageMatch && parseInt(ageMatch[1]) >= 12) {
                meetsAgeRequirement = true;
            }
            
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

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    
    if (data === 'confirm' && userStates[chatId] === STATES.AWAITING_CONFIRMATION) {
        const username = callbackQuery.from.username || "без имени пользователя";
        
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
        
        for (const adminId of ADMIN_IDS) {
            try {
                await bot.sendMessage(adminId, 
                    "📬 Поступила новая анкета в хаус Sunset!\n" +
                    "Используйте команду /list для просмотра всех непринятых анкет.");
            } catch (error) {
                console.error(`Ошибка при отправке уведомления админу ${adminId}: ${error}`);
            }
        }
        
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
        
        userStates[chatId] = STATES.IDLE;
        
        if (pendingForms[userId]) {
            pendingForms[userId].userChatId = chatId;
        }
    } 
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
    else if (data.startsWith('accept_')) {
        const targetUserId = data.split('_')[1];
        const adminId = callbackQuery.from.id;
        const adminUsername = callbackQuery.from.username || `ID: ${adminId}`;
        
        if (!isAdmin(adminId)) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "У вас нет прав для этого действия" });
            return;
        }
        
        if (!pendingForms[targetUserId]) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "Эта анкета больше недоступна" });
            return;
        }
        
        try {
            const { userData, adminMessages, userChatId } = pendingForms[targetUserId];
            const username = userData.username;
            
            processedForms.accepted.push({
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
            
            if (userChatId) {
                bot.sendMessage(
                    userChatId,
                    "🎉 Поздравляем! Твоя анкета была принята админом @" + adminUsername + "! Добро пожаловать в хаус Sunset! 🎉"
                );
            }
            
            try {
                if (!BOT_ID) {
                    const botInfo = await bot.getMe();
                    BOT_ID = botInfo.id;
                    console.log(`ID бота получен: ${BOT_ID}`);
                }
                
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
                    bot.sendMessage(
                        chatId,
                        `⚠️ Внимание! Бот не имеет прав администратора в группе.\n` +
                        `Пожалуйста, добавьте бота как администратора группы с правом добавления участников, ` +
                        `чтобы он мог автоматически принимать заявки.`
                    );
                    
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
                
                try {
                    await bot.sendMessage(
                        GROUP_CHAT_ID,
                        `🎉 Поздравляем @${username} с официальным принятием в хаус Sunset! 🎉\nПринят админом: @${adminUsername} (ID: ${adminId})`
                    );
                } catch (chatError) {
                    console.error(`Ошибка при отправке сообщения в групповой чат: ${chatError}`);
                }
                
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
            
            delete pendingForms[targetUserId];
            
        } catch (error) {
            console.error(`Ошибка при принятии анкеты: ${error}`);
            
            bot.answerCallbackQuery(callbackQuery.id, { 
                text: "Произошла ошибка при принятии анкеты. Пожалуйста, попробуйте снова.",
                show_alert: true
            });
        }
    }
    else if (data.startsWith('reject_')) {
        const targetUserId = data.split('_')[1];
        const adminId = callbackQuery.from.id;
        const adminUsername = callbackQuery.from.username || `ID: ${adminId}`;
        
        if (!isAdmin(adminId)) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "У вас нет прав для этого действия" });
            return;
        }
        
        if (!pendingForms[targetUserId]) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "Эта анкета больше недоступна" });
            return;
        }
        
        const { userData, adminMessages, userChatId } = pendingForms[targetUserId];
        const username = userData.username;
        
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
        
        if (userChatId) {
            bot.sendMessage(
                userChatId,
                "К сожалению, твоя анкета была отклонена админом @" + adminUsername + ". Ты можешь попробовать еще раз позже или связаться с администрацией для получения подробной информации."
            );
        }
        
        try {
            await bot.declineChatJoinRequest(GROUP_CHAT_ID, targetUserId);
        } catch (error) {
            console.error(`Ошибка при отклонении заявки в групповой чат: ${error}`);
        }
        
        delete pendingForms[targetUserId];
        
        bot.answerCallbackQuery(callbackQuery.id, { text: "Анкета отклонена" });
    }
});

// Функция для обработки текстовых сообщений для webhook
function handleTextMessage(chatId, text, userId) {
    if (!text || text.startsWith('/')) {
        return;
    }
    
    switch (userStates[chatId]) {
        case STATES.AWAITING_NAME:
            userForms[chatId].name = text;
            userStates[chatId] = STATES.AWAITING_AGE;
            bot.sendMessage(chatId, "🍂 Укажи свой Возраст + День рождения:");
            break;
            
        case STATES.AWAITING_AGE:
            if (text.includes('11') || text.includes('10') || text.includes('9') || text.includes('8')) {
                bot.sendMessage(chatId, 
                    "⚠️ Извини, но в наш хаус принимаются только игроки от 12 лет. " +
                    "Ты можешь попробовать снова, когда подрастешь!"
                );
                userStates[chatId] = STATES.IDLE;
                delete userForms[chatId];
                return;
            }
            
            userForms[chatId].age = text;
            userStates[chatId] = STATES.AWAITING_TIMEZONE;
            bot.sendMessage(chatId, "🍂 Укажи свой Часовой пояс (например, МСК, МСК+1 и т.д.):");
            break;
            
        case STATES.AWAITING_TIMEZONE:
            userForms[chatId].timezone = text;
            userStates[chatId] = STATES.AWAITING_ACTIVITY;
            bot.sendMessage(chatId, "🍂 Какой у тебя Актив/Неактив (когда обычно находишься в игре):");
            break;
            
        case STATES.AWAITING_ACTIVITY:
            userForms[chatId].activity = text;
            userStates[chatId] = STATES.AWAITING_WHY_US;
            bot.sendMessage(chatId, "🍂 Почему ты выбрал(а) именно нас:");
            break;
            
        case STATES.AWAITING_WHY_US:
            userForms[chatId].why_us = text;
            userStates[chatId] = STATES.AWAITING_MINECRAFT_VERSION;
            bot.sendMessage(chatId, "What version of Minecraft do you play?");
            break;
            
        case STATES.AWAITING_MINECRAFT_VERSION:
            userForms[chatId].minecraft_version = text;
            userStates[chatId] = STATES.AWAITING_MINECRAFT_TYPE;
            bot.sendMessage(chatId, "What type of Minecraft do you play? (Java or Bedrock)");
            break;
            
        case STATES.AWAITING_MINECRAFT_TYPE:
            userForms[chatId].minecraft_type = text;
            
            if (text.toLowerCase().includes('bedrock')) {
                bot.sendMessage(chatId, 
                    "⚠️ Извини, но в наш хаус принимаются только игроки Java-версии. " +
                    "Ты можешь попробовать снова, если перейдешь на Java-версию Minecraft!"
                );
                userStates[chatId] = STATES.IDLE;
                delete userForms[chatId];
                return;
            }
            
            userStates[chatId] = STATES.AWAITING_SERVER_ACTIVITY;
            bot.sendMessage(chatId, "🍂 Расскажи о своей активности на сервере и в съёмках:");
            break;
            
        case STATES.AWAITING_SERVER_ACTIVITY:
            userForms[chatId].server_activity = text;
            userStates[chatId] = STATES.AWAITING_CHAT_ACTIVITY;
            bot.sendMessage(chatId, "🍂 Подтверди, что согласен(на) быть активным(ой) в чате (150-200 сообщений в неделю):");
            break;
            
        case STATES.AWAITING_CHAT_ACTIVITY:
            userForms[chatId].chat_activity = text;
            userStates[chatId] = STATES.AWAITING_OTHER_HOUSES;
            bot.sendMessage(chatId, "🍂 Подтверди, что не состоишь в других хаусах:");
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
            
            bot.sendMessage(chatId, formText, options);
            break;
    }
}

// Функция для обработки callback запросов (кнопок) для webhook
async function handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    
    if (data === 'confirm' && userStates[chatId] === STATES.AWAITING_CONFIRMATION) {
        const username = callbackQuery.from.username || "без имени пользователя";
        
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
        
        for (const adminId of ADMIN_IDS) {
            try {
                await bot.sendMessage(adminId, 
                    "📬 Поступила новая анкета в хаус Sunset!\n" +
                    "Используйте команду /list для просмотра всех непринятых анкет.");
            } catch (error) {
                console.error(`Ошибка при отправке уведомления админу ${adminId}: ${error}`);
            }
        }
        
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
        
        userStates[chatId] = STATES.IDLE;
        
        if (pendingForms[userId]) {
            pendingForms[userId].userChatId = chatId;
        }
    } 
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
    else if (data.startsWith('accept_')) {
        const targetUserId = data.split('_')[1];
        const adminId = callbackQuery.from.id;
        const adminUsername = callbackQuery.from.username || `ID: ${adminId}`;
        
        if (!isAdmin(adminId)) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "У вас нет прав для этого действия" });
            return;
        }
        
        if (!pendingForms[targetUserId]) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "Эта анкета больше недоступна" });
            return;
        }
        
        try {
            const { userData, adminMessages, userChatId } = pendingForms[targetUserId];
            const username = userData.username;
            
            processedForms.accepted.push({
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
            
            if (userChatId) {
                bot.sendMessage(
                    userChatId,
                    "🎉 Поздравляем! Твоя анкета была принята админом @" + adminUsername + "! Добро пожаловать в хаус Sunset! 🎉"
                );
            }
            
            try {
                if (!BOT_ID) {
                    const botInfo = await bot.getMe();
                    BOT_ID = botInfo.id;
                    console.log(`ID бота получен: ${BOT_ID}`);
                }
                
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
                    bot.sendMessage(
                        chatId,
                        `⚠️ Внимание! Бот не имеет прав администратора в группе.\n` +
                        `Пожалуйста, добавьте бота как администратора группы с правом добавления участников, ` +
                        `чтобы он мог автоматически принимать заявки.`
                    );
                    
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
                
                try {
                    await bot.sendMessage(
                        GROUP_CHAT_ID,
                        `🎉 Поздравляем @${username} с официальным принятием в хаус Sunset! 🎉\nПринят админом: @${adminUsername} (ID: ${adminId})`
                    );
                } catch (chatError) {
                    console.error(`Ошибка при отправке сообщения в групповой чат: ${chatError}`);
                }
                
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
            
            delete pendingForms[targetUserId];
            
        } catch (error) {
            console.error(`Ошибка при принятии анкеты: ${error}`);
            
            bot.answerCallbackQuery(callbackQuery.id, { 
                text: "Произошла ошибка при принятии анкеты. Пожалуйста, попробуйте снова.",
                show_alert: true
            });
        }
    }
    else if (data.startsWith('reject_')) {
        const targetUserId = data.split('_')[1];
        const adminId = callbackQuery.from.id;
        const adminUsername = callbackQuery.from.username || `ID: ${adminId}`;
        
        if (!isAdmin(adminId)) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "У вас нет прав для этого действия" });
            return;
        }
        
        if (!pendingForms[targetUserId]) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "Эта анкета больше недоступна" });
            return;
        }
        
        const { userData, adminMessages, userChatId } = pendingForms[targetUserId];
        const username = userData.username;
        
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
        
        if (userChatId) {
            bot.sendMessage(
                userChatId,
                "К сожалению, твоя анкета была отклонена админом @" + adminUsername + ". Ты можешь попробовать еще раз позже или связаться с администрацией для получения подробной информации."
            );
        }
        
        try {
            await bot.declineChatJoinRequest(GROUP_CHAT_ID, targetUserId);
        } catch (error) {
            console.error(`Ошибка при отклонении заявки в групповой чат: ${error}`);
        }
        
        delete pendingForms[targetUserId];
        
        bot.answerCallbackQuery(callbackQuery.id, { text: "Анкета отклонена" });
    }
}

// Экспортируем компоненты бота для использования в webhook
module.exports = {
    bot,
    ADMIN_IDS,
    GROUP_CHAT_ID, 
    GROUP_LINK,
    userStates,
    userForms,
    pendingForms,
    processedForms,
    STATES,
    isAdmin,
    handleTextMessage,
    handleCallbackQuery
};

// Если запущен напрямую (не через require), слушаем события завершения
if (require.main === module) {
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Необработанная ошибка в Promise:', reason);
    });

    process.on('SIGINT', () => {
        console.log('Бот остановлен');
        process.exit(0);
    });

    console.log('Бот запущен. Нажмите Ctrl+C для остановки.');
} 