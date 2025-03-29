// Упрощенный обработчик webhook для Telegram
const TelegramBot = require('node-telegram-bot-api');
const token = '7417777601:AAGy92M0pjoizRHILNT7d72xMNf8a0BkKK8';

const ADMIN_IDS = [
    7683124601,
    1971986164,
    1663401570,
    6844219237,
    1536993655,
    718910310
];

const GROUP_CHAT_ID = '-1001922624396';

let BOT_ID = null;

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
    return ADMIN_IDS.includes(Number(userId));
}

// Функция для сохранения всех текущих данных в лог для отладки
function logDebugState() {
    console.log('==== DEBUG STATE ====');
    console.log(`pendingForms keys: ${JSON.stringify(Object.keys(pendingForms))}`);
    console.log(`userStates count: ${Object.keys(userStates).length}`);
    console.log(`userForms count: ${Object.keys(userForms).length}`);
    console.log('==== END DEBUG STATE ====');
}

// Обработчик запросов
module.exports = async (req, res) => {
    try {
        // Логируем все входящие запросы для отладки
        console.log(`[${new Date().toISOString()}] Получен ${req.method} запрос`);
        
        // Для GET-запросов просто возвращаем статус
        if (req.method === 'GET') {
            const bot = new TelegramBot(token);
            try {
                const botInfo = await bot.getMe();
                console.log(`Бот активен: ${botInfo.username} (ID: ${botInfo.id})`);
                BOT_ID = botInfo.id;
                return res.status(200).json({ 
                    status: 'Bot is running', 
                    bot_name: botInfo.username,
                    bot_id: botInfo.id 
                });
            } catch (error) {
                console.error('Ошибка при проверке бота:', error);
                return res.status(500).json({ 
                    status: 'Bot error', 
                    error: String(error) 
                });
            }
        }
        
        // Для POST-запросов обрабатываем события от Telegram
        if (req.method === 'POST') {
            const update = req.body;
            console.log('WEBHOOK:', JSON.stringify(update).slice(0, 200));
            
            // Создаем экземпляр бота для ответа
            const bot = new TelegramBot(token);
            
            // Получаем ID бота если еще не получили
            if (!BOT_ID) {
                try {
                    const botInfo = await bot.getMe();
                    BOT_ID = botInfo.id;
                    console.log(`ID бота получен: ${BOT_ID}`);
                } catch (error) {
                    console.error(`Ошибка при получении информации о боте: ${error}`);
                }
            }
            
            // Обработка заявок на вступление в группу
            if (update.chat_join_request) {
                const request = update.chat_join_request;
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
                
                return res.status(200).send('OK');
            }
            
            // Обработка текстовых сообщений
            if (update.message && update.message.text) {
                const chatId = update.message.chat.id;
                const text = update.message.text;
                const userId = update.message.from.id;
                const username = update.message.from.username || `user${userId}`;
                const chatType = update.message.chat.type;
                
                console.log(`Сообщение: ${text} от ${chatId}, тип чата: ${chatType}`);
                
                // Игнорируем обычные сообщения в групповых чатах
                if (chatType === 'group' || chatType === 'supergroup') {
                    if (text.startsWith('/start')) {
                        await bot.sendMessage(chatId, 
                            "Привет! Чтобы подать заявку в хаус Sunset, напиши мне в личные сообщения."
                        );
                    }
                    // Никак не реагируем на обычные сообщения в группе
                    return res.status(200).send('OK');
                }
                
                // Далее обрабатываем только сообщения из личных чатов
                
                // Обработка команд
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
                        
                        await bot.sendMessage(chatId, 
                            "Привет! Я бот для приема анкет в хаус Sunset. " +
                            "Давай начнем заполнение анкеты.\n\n" +
                            "🍂 Укажи своё Имя + Ник:");
                    }
                    
                    return res.status(200).send('OK');
                } 
                else if (text === '/history_accepted' && isAdmin(userId)) {
                    if (processedForms.accepted.length === 0) {
                        await bot.sendMessage(chatId, "История принятых анкет пуста.");
                        return res.status(200).send('OK');
                    }
                    
                    let message = `📋 История принятых анкет (${processedForms.accepted.length}):\n\n`;
                    
                    for (const form of processedForms.accepted) {
                        message += `👤 @${form.username} (ID: ${form.userId})\n`;
                        message += `📝 Имя и ник: ${form.formData.name}\n`;
                        message += `🔹 Принята админом: @${form.adminUsername} (ID: ${form.adminId})\n`;
                        message += `🕒 Дата: ${form.date}\n\n`;
                    }
                    
                    await bot.sendMessage(chatId, message);
                    return res.status(200).send('OK');
                }
                else if (text === '/history_rejected' && isAdmin(userId)) {
                    if (processedForms.rejected.length === 0) {
                        await bot.sendMessage(chatId, "История отклоненных анкет пуста.");
                        return res.status(200).send('OK');
                    }
                    
                    let message = `📋 История отклоненных анкет (${processedForms.rejected.length}):\n\n`;
                    
                    for (const form of processedForms.rejected) {
                        message += `👤 @${form.username} (ID: ${form.userId})\n`;
                        message += `📝 Имя и ник: ${form.formData.name}\n`;
                        message += `🔹 Отклонена админом: @${form.adminUsername} (ID: ${form.adminId})\n`;
                        message += `🕒 Дата: ${form.date}\n\n`;
                    }
                    
                    await bot.sendMessage(chatId, message);
                    return res.status(200).send('OK');
                }
                else if (text === '/list' && isAdmin(userId)) {
                    const pendingFormsCount = Object.keys(pendingForms).length;
                    
                    if (pendingFormsCount === 0) {
                        await bot.sendMessage(chatId, "В настоящий момент нет непринятых анкет.");
                        return res.status(200).send('OK');
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
                    return res.status(200).send('OK');
                }
                else if (text.match(/^\/view_\d+$/) && isAdmin(userId)) {
                    const targetUserId = text.split('_')[1];
                    
                    if (!pendingForms[targetUserId]) {
                        await bot.sendMessage(chatId, "Анкета не найдена или уже обработана.");
                        return res.status(200).send('OK');
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
                    
                    return res.status(200).send('OK');
                }
                else if (text === '/cancel') {
                    if (isAdmin(userId)) {
                        await bot.sendMessage(chatId, "Нечего отменять, вы - администратор.");
                        return res.status(200).send('OK');
                    }
                    
                    userStates[chatId] = STATES.IDLE;
                    delete userForms[chatId];
                    
                    await bot.sendMessage(chatId, "Заполнение анкеты отменено.");
                    return res.status(200).send('OK');
                }
                else if (!text.startsWith('/') && !isAdmin(userId)) {
                    // Обработка обычных сообщений от пользователей
                    const currentState = userStates[chatId] || STATES.IDLE;
                    
                    switch (currentState) {
                        case STATES.AWAITING_NAME:
                            if (!userForms[chatId]) userForms[chatId] = {};
                            userForms[chatId].name = text;
                            userStates[chatId] = STATES.AWAITING_AGE;
                            await bot.sendMessage(chatId, "🍂 Укажи свой Возраст + День рождения (вам должно быть 12+ лет):");
                            break;
                            
                        case STATES.AWAITING_AGE:
                            userForms[chatId].age = text;
                            userStates[chatId] = STATES.AWAITING_TIMEZONE;
                            await bot.sendMessage(chatId, "🍂 Укажи свой Часовой пояс:");
                            break;
                            
                        case STATES.AWAITING_TIMEZONE:
                            userForms[chatId].timezone = text;
                            userStates[chatId] = STATES.AWAITING_ACTIVITY;
                            await bot.sendMessage(chatId, "🍂 Ты Активный или Неактивный игрок?");
                            break;
                            
                        case STATES.AWAITING_ACTIVITY:
                            userForms[chatId].activity = text;
                            userStates[chatId] = STATES.AWAITING_WHY_US;
                            await bot.sendMessage(chatId, "🍂 Почему ты выбрал(а) именно наш хаус Sunset?");
                            break;
                            
                        case STATES.AWAITING_WHY_US:
                            userForms[chatId].why_us = text;
                            userStates[chatId] = STATES.AWAITING_MINECRAFT_VERSION;
                            await bot.sendMessage(chatId, "🍂 Укажи версию Minecraft, на которой ты играешь (например, 1.20.1):");
                            break;
                            
                        case STATES.AWAITING_MINECRAFT_VERSION:
                            userForms[chatId].minecraft_version = text;
                            userStates[chatId] = STATES.AWAITING_MINECRAFT_TYPE;
                            await bot.sendMessage(chatId, "🍂 Укажи тип Minecraft (Java или Bedrock):");
                            break;
                            
                        case STATES.AWAITING_MINECRAFT_TYPE:
                            userForms[chatId].minecraft_type = text;
                            userStates[chatId] = STATES.AWAITING_SERVER_ACTIVITY;
                            
                            const typeLower = text.toLowerCase();
                            if (!typeLower.includes('java')) {
                                await bot.sendMessage(chatId, 
                                    "❗ Внимание! Для вступления в хаус Sunset требуется Java-версия Minecraft.\n" +
                                    "Вы указали: " + text + ". Если это ошибка, то перезапустите заполнение анкеты с помощью команды /start.\n\n" +
                                    "Если у вас все-таки Java-версия, то продолжим:");
                            }
                            
                            await bot.sendMessage(chatId, "🍂 Подтверди, что ты будешь активен/активна на сервере и в съёмках:");
                            break;
                            
                        case STATES.AWAITING_SERVER_ACTIVITY:
                            userForms[chatId].server_activity = text;
                            userStates[chatId] = STATES.AWAITING_CHAT_ACTIVITY;
                            await bot.sendMessage(chatId, "🍂 Подтверди, что ты будешь активен/активна в чате (наша норма 150-200 сообщений в неделю):");
                            break;
                            
                        case STATES.AWAITING_CHAT_ACTIVITY:
                            userForms[chatId].chat_activity = text;
                            userStates[chatId] = STATES.AWAITING_OTHER_HOUSES;
                            await bot.sendMessage(chatId, "🍂 Подтверди, что ты не состоишь в других хаусах/командах:");
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
                                
                                await bot.sendMessage(chatId, errorMessage);
                                userStates[chatId] = STATES.IDLE;
                                delete userForms[chatId];
                                return res.status(200).send('OK');
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
                            
                            await bot.sendMessage(chatId, formText + "\n\nВсё правильно?", options);
                            break;
                            
                        default:
                            // Проверяем, что это личный чат, прежде чем отвечать
                            if (chatType === 'private') {
                                await bot.sendMessage(chatId, "Чтобы начать заполнение анкеты, отправь /start");
                            }
                            break;
                    }
                }
                
                return res.status(200).send('OK');
            }
            
            // Обработка callback_query (нажатия на кнопки)
            if (update.callback_query) {
                const callbackQuery = update.callback_query;
                const message = callbackQuery.message;
                const chatId = message.chat.id;
                const userId = callbackQuery.from.id;
                const data = callbackQuery.data;
                
                console.log(`Получен callback_query: ${data} от пользователя ${userId}`);
                
                // Проверяем, является ли это групповой чат
                const isGroupChat = (message.chat.type === 'group' || message.chat.type === 'supergroup');
                
                // При обработке webhook сначала разбираемся с командами начала/отмены заполнения,
                // так как они не зависят от прав администратора
                if (data === 'confirm' && userStates[chatId] === STATES.AWAITING_CONFIRMATION) {
                    // Базовый ответ для отладки
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: "Анкета отправлена на рассмотрение",
                        show_alert: true
                    });
                    
                    await bot.sendMessage(chatId, "Анкета принята к рассмотрению!");
                    userStates[chatId] = STATES.IDLE;
                    
                    console.log("Обработано подтверждение анкеты");
                    return res.status(200).send('OK');
                }
                else if (data === 'restart') {
                    // Базовый ответ для отладки
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: "Начинаем заново",
                        show_alert: true
                    });
                    
                    await bot.sendMessage(chatId, "Давай начнем заново. Напиши /start");
                    userStates[chatId] = STATES.IDLE;
                    
                    console.log("Обработана перезагрузка анкеты");
                    return res.status(200).send('OK');
                }
                else if (data.startsWith('accept_') || data.startsWith('reject_')) {
                    // Базовый ответ для отладки
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: data.startsWith('accept_') ? "Анкета принята" : "Анкета отклонена",
                        show_alert: true
                    });
                    
                    console.log(`Обработана кнопка ${data}`);
                    return res.status(200).send('OK');
                }
                else {
                    // Неизвестная кнопка
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: "Неизвестная команда",
                        show_alert: true
                    });
                    
                    console.log(`Получена неизвестная команда: ${data}`);
                    return res.status(200).send('OK');
                }
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