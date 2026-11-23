import { SYSTEM_PROMPT } from './prompts.js';
import { KNOWLEDGE_BASE } from './knowledge_base.js';

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
];

// ==========================================
// СЛОВАРЬ ИНТЕРФЕЙСА (UK / RU)
// ==========================================
const TEXTS = {
  uk: {
    btnCheck: '🔍 Перевірити залізо',
    btnBalance: '💳 Мої перевірки',
    btnLang: '🌐 Мова',
    btnOrderPersonal: '🤝 Замовити особистий підбір',
    btnBuyOrOrder: '💳 Оплата / Особистий підбір',
    btnWriteAdmin: (handle) => `💬 Написати ${handle}`,
    langSaved: '✅ Мову встановлено: <b>Українська</b>',
    welcome: (name, bonusLine, credits) =>
      `👋 Вітаю, <b>${name}</b>!\n\n` +
      `Я — <b>Чесний аналізатор заліза</b>. Надішліть мені скріншот товару або текст із характеристиками ` +
      `ноутбука, ПК чи смартфона: я простою мовою оціню залізо, покажу, що продавець приховав, ` +
      `і перевірю відомі підводні камені моделі в мережі.\n` +
      `${bonusLine}\n` +
      `💳 Доступно перевірок: <b>${credits}</b>\n\n` +
      `Натисніть <b>«🔍 Перевірити залізо»</b>, щоб почати.`,
    bonusLine: '\n🎁 Як новому користувачеві, вам нарахована <b>1 безкоштовна перевірка</b>!\n',
    balanceText: (credits, userId) =>
      `💳 <b>Ваш баланс перевірок:</b> ${credits}\n` +
      `🆔 <b>Ваш Telegram ID:</b> <code>${userId}</code>\n\n` +
      `<b>Тарифи:</b>\n` +
      `• ⚡ <b>10 перевірок у боті</b> — 149 грн ($3.5)\n` +
      `• 🤝 <b>Особистий підбір техніки за 24 год</b> (3 найкращі варіанти від інженера) — 690 грн ($16)\n\n` +
      `Натисніть кнопку нижче, щоб переглянути способи оплати та контакти адміністратора.`,
    zeroCreditsText: (userId) =>
      `😔 На вашому балансі <b>0 перевірок</b>.\n\n` +
      `<b>Продовжити вибір без помилок:</b>\n` +
      `• ⚡ <b>Пакет 10 перевірок</b> — 149 грн ($3.5)\n` +
      `• 🤝 <b>Особистий підбір під ключ</b> (знайду 3 найкращі моделі для вас) — 690 грн ($16)\n\n` +
      `📌 Ваш Telegram ID: <code>${userId}</code>\n` +
      `<i>Натисніть кнопку нижче, щоб побачити способи оплати або домовитися з адміністратором.</i>`,
    orderScreenText: (userId, adminDisplay) =>
      `🤝 <b>Замовлення підбору або купівля перевірок</b>\n\n` +
      `<b>Що ви можете замовити:</b>\n` +
      `• ⚡ <b>10 перевірок у боті</b> — 149 грн ($3.5)\n` +
      `• 🤝 <b>Особистий підбір під ключ (до 24 год)</b> — 690 грн ($16): вивчу ваші задачі, знайду 3 найкращі моделі у перевірених магазинах, перевірю приховані мінуси та дам інструкцію перевірки.\n\n` +
      `<b>Доступні способи оплати:</b>\n` +
      `• 🇺🇦 Картка / Банка Monobank (Україна)\n` +
      `• 🪙 Криптовалюта USDT (TRC-20 / TON)\n` +
      `• 🌍 PayPal / картка (для Європи та США)\n\n` +
      `❗️ <i>Якщо жоден із цих способів вам не підходить (або ви знаходитесь в іншій країні) — все одно напишіть адміністратору, ми індивідуально домовимося про зручний для вас варіант оплати!</i>\n\n` +
      `👤 Адміністратор: <b>${adminDisplay}</b>\n` +
      `🆔 Ваш ID (натисніть, щоб скопіювати): <code>${userId}</code>`,
    step1Task: '🛠 <b>Крок 1 з 3.</b> Для яких задач купуєте техніку?',
    tasks: [
      { label: '🎮 Ігри', value: 'Ігри' },
      { label: '🎬 Монтаж і дизайн', value: 'Монтаж і дизайн' },
      { label: '💻 Програмування', value: 'Програмування' },
      { label: '📚 Навчання / офіс', value: 'Навчання та офіс' },
    ],
    askUseButtons: 'Будь ласка, оберіть задачу за допомогою кнопок вище 👆',
    step2Budget: (task) =>
      `✅ Обрана задача: <b>${task}</b>\n\n` +
      `💰 <b>Крок 2 з 3.</b> Який у вас бюджет?\n` +
      `<i>Напишіть текстом (наприклад: 30 000 грн / $800) або натисніть «Пропустити».</i>`,
    btnSkip: '⏭ Пропустити',
    askBudgetText: 'Напишіть бюджет текстом (наприклад: 30 000 грн / $800) або натисніть кнопку «Пропустити».',
    step3InputWithBudget: (budget) =>
      `✅ Бюджет: <b>${budget}</b>\n\n` +
      `📸 <b>Крок 3 з 3.</b> Надішліть <b>СКРІНШОТ</b> товару з характеристиками ` +
      `або вставте <b>текст / точну назву моделі</b>.`,
    step3InputSkipped:
      `⏭ Бюджет пропущено.\n\n` +
      `📸 <b>Крок 3 з 3.</b> Надішліть <b>СКРІНШОТ</b> товару з характеристиками ` +
      `або вставте <b>текст / точну назву моделі</b>.`,
    defaultPromptMenu:
      'Щоб почати розбір ноутбука, ПК чи смартфона, натисніть кнопку <b>«🔍 Перевірити залізо»</b> у меню нижче.',
    needPhotoOrText:
      'Будь ласка, надішліть <b>стиснуте фото (скріншот)</b> або <b>текст</b> із характеристиками.\n' +
      '<i>Якщо надсилаєте картинку, переконайтеся, що вона відправлена як «Фото», а не як «Файл».</i>',
    analyzing: '⏳ Зчитую ваші характеристики та перевіряю модель у мережі...',
    creditsLeftLine: (rem) => `\n\n💳 **Залишилось перевірок:** ${rem}`,
    analysisError: (reason) =>
      '⚠️ Не вдалося завершити аналіз.\n' +
      'Ваша перевірка <b>не списана</b>. Спробуйте ще раз трохи пізніше.\n\n' +
      `<i>Технічна причина: ${reason}</i>`,
    notSpecified: 'Не вказано',
  },
  ru: {
    btnCheck: '🔍 Проверить железо',
    btnBalance: '💳 Мои проверки',
    btnLang: '🌐 Язык',
    btnOrderPersonal: '🤝 Заказать личный подбор',
    btnBuyOrOrder: '💳 Оплата / Личный подбор',
    btnWriteAdmin: (handle) => `💬 Написать ${handle}`,
    langSaved: '✅ Выбран язык: <b>Русский</b>',
    welcome: (name, bonusLine, credits) =>
      `👋 Привет, <b>${name}</b>!\n\n` +
      `Я — <b>Честный анализатор железа</b>. Пришли мне скриншот товара или текст с характеристиками ` +
      `ноутбука, ПК или смартфона: я простым языком оценю железо, покажу, что продавец скрыл, ` +
      `и проверю известные подвохи модели в сети.\n` +
      `${bonusLine}\n` +
      `💳 Доступно проверок: <b>${credits}</b>\n\n` +
      `Нажми <b>«🔍 Проверить железо»</b>, чтобы начать.`,
    bonusLine: '\n🎁 Как новому пользователю, тебе начислена <b>1 бесплатная проверка</b>!\n',
    balanceText: (credits, userId) =>
      `💳 <b>Ваш баланс проверок:</b> ${credits}\n` +
      `🆔 <b>Ваш Telegram ID:</b> <code>${userId}</code>\n\n` +
      `<b>Тарифы:</b>\n` +
      `• ⚡ <b>10 проверок в боте</b> — 149 грн ($3.5)\n` +
      `• 🤝 <b>Личный подбор техники за 24ч</b> (3 лучших варианта от инженера) — 690 грн ($16)\n\n` +
      `Нажмите кнопку ниже, чтобы посмотреть способы оплаты и контакты администратора.`,
    zeroCreditsText: (userId) =>
      `😔 На вашем балансе <b>0 проверок</b>.\n\n` +
      `<b>Продолжить выбор без ошибок:</b>\n` +
      `• ⚡ <b>Пакет 10 проверок</b> — 149 грн ($3.5)\n` +
      `• 🤝 <b>Личный подбор под ключ</b> (найду 3 лучших модели для вас) — 690 грн ($16)\n\n` +
      `📌 Ваш Telegram ID: <code>${userId}</code>\n` +
      `<i>Нажмите кнопку ниже, чтобы увидеть способы оплаты или договориться с администратором.</i>`,
    orderScreenText: (userId, adminDisplay) =>
      `🤝 <b>Заказ личного подбора или покупка проверок</b>\n\n` +
      `<b>Что вы можете заказать:</b>\n` +
      `• ⚡ <b>10 проверок в боте</b> — 149 грн ($3.5)\n` +
      `• 🤝 <b>Личный подбор под ключ (до 24 ч)</b> — 690 грн ($16): изучу ваши задачи, найду 3 лучшие модели в проверенных магазинах, проверю скрытые минусы и дам инструкцию проверки.\n\n` +
      `<b>Доступные способы оплаты:</b>\n` +
      `• 🇺🇦 Карта / Банка Monobank (Украина)\n` +
      `• 🪙 Криптовалюта USDT (TRC-20 / TON)\n` +
      `• 🌍 PayPal / карта (для Европы и США)\n\n` +
      `❗️ <i>Если ни один из этих способов вам не подходит (или вы находитесь в другой стране) — всё равно напишите администратору, мы индивидуально договоримся об удобном для вас варианте оплаты!</i>\n\n` +
      `👤 Администратор: <b>${adminDisplay}</b>\n` +
      `🆔 Ваш ID (нажмите, чтобы скопировать): <code>${userId}</code>`,
    step1Task: '🛠 <b>Шаг 1 из 3.</b> Для каких задач берете технику?',
    tasks: [
      { label: '🎮 Игры', value: 'Игры' },
      { label: '🎬 Монтаж и дизайн', value: 'Монтаж и дизайн' },
      { label: '💻 Программирование', value: 'Программирование' },
      { label: '📚 Учеба / офис', value: 'Учеба и офис' },
    ],
    askUseButtons: 'Пожалуйста, выберите задачу с помощью кнопок выше 👆',
    step2Budget: (task) =>
      `✅ Выбрана задача: <b>${task}</b>\n\n` +
      `💰 <b>Шаг 2 из 3.</b> Какой у вас бюджет?\n` +
      `<i>Напишите текстом (например: 30 000 грн / $800) или нажмите «Пропустить».</i>`,
    btnSkip: '⏭ Пропустить',
    askBudgetText: 'Напишите бюджет текстом (например: 30 000 грн / $800) или нажмите кнопку «Пропустить».',
    step3InputWithBudget: (budget) =>
      `✅ Бюджет: <b>${budget}</b>\n\n` +
      `📸 <b>Шаг 3 из 3.</b> Пришлите <b>СКРИНШОТ</b> товара с характеристиками ` +
      `или отправьте <b>текст / точное название модели</b>.`,
    step3InputSkipped:
      `⏭ Бюджет пропущен.\n\n` +
      `📸 <b>Шаг 3 из 3.</b> Пришлите <b>СКРИНШОТ</b> товара с характеристиками ` +
      `или отправьте <b>текст / точное название модели</b>.`,
    defaultPromptMenu:
      'Чтобы начать разбор ноутбука, ПК или смартфона, нажмите кнопку <b>«🔍 Проверить железо»</b> в меню ниже.',
    needPhotoOrText:
      'Пожалуйста, отправьте <b>сжатое фото (скриншот)</b> или <b>текст</b> с характеристиками.\n' +
      '<i>Если отправляете картинку, убедитесь, что она отправлена как «Фото», а не как «Файл».</i>',
    analyzing: '⏳ Считываю ваши характеристики и проверяю модель в сети...',
    creditsLeftLine: (rem) => `\n\n💳 **Осталось проверок:** ${rem}`,
    analysisError: (reason) =>
      '⚠️ Не удалось завершить анализ.\n' +
      'Ваша проверка <b>не списана</b>. Попробуйте ещё раз чуть позже.\n\n' +
      `<i>Техническая причина: ${reason}</i>`,
    notSpecified: 'Не указан',
  },
};

function getLang(user) {
  return user?.lang === 'uk' ? 'uk' : 'ru';
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'GET') {
      return new Response('Hardware Analyzer Bot is running on Cloudflare Workers!', {
        status: 200,
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const update = await request.json();
      ctx.waitUntil(
        handleUpdate(update, env).catch((err) => {
          console.error('Unhandled error in handleUpdate:', err);
        })
      );
      return new Response('OK', { status: 200 });
    } catch (err) {
      console.error('Invalid JSON in webhook:', err);
      return new Response('Bad Request', { status: 400 });
    }
  },
};

// ==========================================
// ГЛАВНЫЙ ОБРАБОТЧИК СОБЫТИЙ TELEGRAM
// ==========================================
async function handleUpdate(update, env) {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, env);
    return;
  }

  if (update.message) {
    await handleMessage(update.message, env);
  }
}

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  if (!userId) return;

  const text = (message.text || '').trim();

  // --- 1. Админ-команды ---
  if (String(userId) === String(env.ADMIN_ID)) {
    if (text.startsWith('/add')) {
      await handleAdminAdd(chatId, text, env);
      return;
    }
    if (text === '/stats') {
      await handleAdminStats(chatId, env);
      return;
    }
  }

  // --- 2. Команда /start ---
  if (text === '/start' || text.startsWith('/start ')) {
    await registerOrResetUser(env.DB, userId);
    const user = await getUser(env.DB, userId);

    // Если язык ещё не выбран — показываем выбор языка ДО всех остальных кнопок
    if (!user || !user.lang) {
      await sendLanguagePicker(env.BOT_TOKEN, chatId);
      return;
    }

    const lang = getLang(user);
    const t = TEXTS[lang];
    const firstName = escapeHtml(message.from?.first_name || 'друг');
    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      t.welcome(firstName, '', user.credits ?? 1),
      {
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(lang),
      }
    );
    return;
  }

  // --- 3. Смена языка ---
  if (text === '/lang' || text === '🌐 Мова' || text === '🌐 Язык') {
    await ensureUserExists(env.DB, userId);
    await sendLanguagePicker(env.BOT_TOKEN, chatId);
    return;
  }

  await ensureUserExists(env.DB, userId);
  const user = await getUser(env.DB, userId);

  // Если пользователь старый и ещё не выбирал язык
  if (!user || !user.lang) {
    await sendLanguagePicker(env.BOT_TOKEN, chatId);
    return;
  }

  const lang = getLang(user);
  const t = TEXTS[lang];

  // --- 4. Кнопки главного меню ---
  if (text === '💳 Мои проверки' || text === '💳 Мої перевірки') {
    await updateUserState(env.DB, userId, { step: 'idle', temp_task: '', temp_budget: '' });
    const credits = user.credits ?? 0;

    await sendTelegramMessage(env.BOT_TOKEN, chatId, t.balanceText(credits, userId), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: t.btnBuyOrOrder, callback_data: 'show_order' }]],
      },
    });
    return;
  }

  if (text === '🔍 Проверить железо' || text === '🔍 Перевірити залізо') {
    const credits = user.credits ?? 0;

    if (credits <= 0) {
      await updateUserState(env.DB, userId, { step: 'idle', temp_task: '', temp_budget: '' });
      await sendTelegramMessage(env.BOT_TOKEN, chatId, t.zeroCreditsText(userId), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: t.btnBuyOrOrder, callback_data: 'show_order' }]],
        },
      });
      return;
    }

    await updateUserState(env.DB, userId, {
      step: 'wait_task',
      temp_task: '',
      temp_budget: '',
    });

    await sendTelegramMessage(env.BOT_TOKEN, chatId, t.step1Task, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: t.tasks.map((item) => [
          { text: item.label, callback_data: `task:${item.value}` },
        ]),
      },
    });
    return;
  }

  // --- 5. Обработка шагов диалога из D1 ---
  const step = user.step || 'idle';

  if (step === 'wait_task') {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, t.askUseButtons);
    return;
  }

  if (step === 'wait_budget') {
    if (!text) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, t.askBudgetText);
      return;
    }

    await updateUserState(env.DB, userId, {
      step: 'wait_input',
      temp_budget: text.slice(0, 120),
    });

    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      t.step3InputWithBudget(escapeHtml(text)),
      { parse_mode: 'HTML' }
    );
    return;
  }

  if (step === 'wait_input') {
    await processHardwareAnalysis(message, user, env);
    return;
  }

  await sendTelegramMessage(env.BOT_TOKEN, chatId, t.defaultPromptMenu, {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(lang),
  });
}

// ==========================================
// ОБРАБОТКА INLINE-КНОПОК
// ==========================================
async function handleCallbackQuery(callbackQuery, env) {
  const callbackId = callbackQuery.id;
  const userId = callbackQuery.from?.id;
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const data = callbackQuery.data || '';

  await answerCallbackQuery(env.BOT_TOKEN, callbackId);
  if (!userId || !chatId) return;

  await ensureUserExists(env.DB, userId);
  let user = await getUser(env.DB, userId);

  // --- Выбор языка ---
  if (data.startsWith('set_lang:')) {
    const chosenLang = data.slice(9) === 'uk' ? 'uk' : 'ru';
    const isFirstLanguagePick = !user?.lang;

    await env.DB.prepare('UPDATE users SET lang = ?, step = ?, temp_task = ?, temp_budget = ? WHERE user_id = ?')
      .bind(chosenLang, 'idle', '', '', userId)
      .run();

    user = await getUser(env.DB, userId);
    const t = TEXTS[chosenLang];
    const firstName = escapeHtml(callbackQuery.from?.first_name || 'друг');

    await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, t.langSaved, {
      parse_mode: 'HTML',
    });

    const bonusLine = isFirstLanguagePick ? t.bonusLine : '';
    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      t.welcome(firstName, bonusLine, user?.credits ?? 1),
      {
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(chosenLang),
      }
    );
    return;
  }

  const lang = getLang(user);
  const t = TEXTS[lang];

  // --- Экран заказа личного подбора и способов оплаты ---
  if (data === 'show_order') {
    const cleanUsername = (env.ADMIN_USERNAME || '').replace(/^@/, '').trim();
    const adminDisplay = cleanUsername ? `@${cleanUsername}` : `ID ${env.ADMIN_ID}`;
    const contactUrl = cleanUsername
      ? `https://t.me/${cleanUsername}`
      : `tg://user?id=${env.ADMIN_ID}`;

    await sendTelegramMessage(env.BOT_TOKEN, chatId, t.orderScreenText(userId, adminDisplay), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: t.btnWriteAdmin(adminDisplay), url: contactUrl }]],
      },
    });
    return;
  }

  if (data.startsWith('task:')) {
    if (!user || user.credits <= 0) {
      await sendTelegramMessage(env.BOT_TOKEN, chatId, t.zeroCreditsText(userId), {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: t.btnBuyOrOrder, callback_data: 'show_order' }]],
        },
      });
      return;
    }

    const chosenTask = data.slice(5);
    await updateUserState(env.DB, userId, {
      step: 'wait_budget',
      temp_task: chosenTask,
    });

    await editTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      messageId,
      t.step2Budget(escapeHtml(chosenTask)),
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: t.btnSkip, callback_data: 'skip_budget' }]],
        },
      }
    );
    return;
  }

  if (data === 'skip_budget') {
    await updateUserState(env.DB, userId, {
      step: 'wait_input',
      temp_budget: t.notSpecified,
    });

    await editTelegramMessage(env.BOT_TOKEN, chatId, messageId, t.step3InputSkipped, {
      parse_mode: 'HTML',
    });
  }
}

async function sendLanguagePicker(botToken, chatId) {
  await sendTelegramMessage(
    botToken,
    chatId,
    '🌐 <b>Оберіть мову спілкування / Выберите язык общения:</b>',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🇺🇦 Українська', callback_data: 'set_lang:uk' },
            { text: '🇷🇺 Русский', callback_data: 'set_lang:ru' },
          ],
        ],
      },
    }
  );
}

// ==========================================
// ГЛАВНЫЙ КОНВЕЙЕР АНАЛИЗА С ЖИВЫМ ПОИСКОМ
// ==========================================
async function processHardwareAnalysis(message, user, env) {
  const chatId = message.chat.id;
  const userId = user.user_id;
  const lang = getLang(user);
  const t = TEXTS[lang];

  if (user.credits <= 0) {
    await updateUserState(env.DB, userId, { step: 'idle', temp_task: '', temp_budget: '' });
    await sendTelegramMessage(env.BOT_TOKEN, chatId, t.zeroCreditsText(userId), {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: t.btnBuyOrOrder, callback_data: 'show_order' }]],
      },
    });
    return;
  }

  const hasPhoto = Array.isArray(message.photo) && message.photo.length > 0;
  const textInput = (message.text || message.caption || '').trim();

  if (!hasPhoto && !textInput) {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, t.needPhotoOrText, {
      parse_mode: 'HTML',
    });
    return;
  }

  await sendChatAction(env.BOT_TOKEN, chatId, 'typing');
  const statusMsg = await sendTelegramMessage(env.BOT_TOKEN, chatId, t.analyzing);

  const deadline = Date.now() + 26000;

  try {
    let extractedSpecs = '';
    let searchQuery = '';

    // --- ЭТАП 1: Извлекаем модель и спеки ---
    if (hasPhoto) {
      const lastPhoto = message.photo[message.photo.length - 1];
      const chosenPhoto =
        message.photo.length >= 2 && lastPhoto.file_size && lastPhoto.file_size > 120000
          ? message.photo[message.photo.length - 2]
          : lastPhoto;

      const imageInfo = await downloadTelegramPhotoAsBase64(env.BOT_TOKEN, chosenPhoto.file_id);
      const ocrResult = await extractSpecsFromImage(env, imageInfo, deadline);

      extractedSpecs = ocrResult.specsText;
      searchQuery = ocrResult.modelQuery;
      console.log('OCR extracted searchQuery:', searchQuery);
    } else {
      searchQuery = textInput.split('\n')[0].replace(/https?:\/\/\S+/g, '').slice(0, 90).trim();
    }

    // --- ЭТАП 2: Живой поиск в Google / интернете ---
    let liveSearchData = '';
    if (searchQuery && Date.now() < deadline - 6000) {
      liveSearchData = await runLiveWebSearch(env, searchQuery);
      console.log('Live search chars:', liveSearchData.length);
    }

    // --- ЭТАП 3: Финальный разбор на выбранном языке ---
    const targetLangLabel =
      lang === 'uk'
        ? 'Українська (пиши весь звіт чистою грамотною українською мовою без русизмів!)'
        : 'Русский';

    const userPromptText =
      `ЯЗЫК ОТВЕТА: ${targetLangLabel}\n` +
      `Задача пользователя: ${user.temp_task || t.notSpecified}\n` +
      `Бюджет пользователя: ${user.temp_budget || t.notSpecified}\n\n` +
      (textInput ? `=== ДАННЫЕ ОТ ПОЛЬЗОВАТЕЛЯ (ТЕКСТ) ===\n${textInput}\n\n` : '') +
      (extractedSpecs ? `=== ДАННЫЕ СО СКРИНШОТА ПОЛЬЗОВАТЕЛЯ ===\n${extractedSpecs}\n\n` : '') +
      (liveSearchData
        ? `=== ДОПОЛНИТЕЛЬНАЯ СПРАВКА ИЗ ЖИВОГО ПОИСКА (ТОЛЬКО ДЛЯ БЛОКА 2 С ОГОВОРКОЙ, НЕ СМЕШИВАЙ С БЛОКОМ 1!) ===\n${liveSearchData}\n`
        : '=== ПОИСК В СЕТИ НЕ ВЕРНУЛ ДАННЫХ ===\nОпирайся ТОЛЬКО на данные пользователя и предупреди, что скрытые параметры неизвестны.\n');

    const aiResponse = await generateFinalAnalysis(
      env,
      userPromptText,
      Boolean(liveSearchData),
      deadline
    );

    await env.DB.prepare(
      `UPDATE users
       SET credits = MAX(credits - 1, 0),
           total_checks = total_checks + 1,
           step = 'idle',
           temp_task = '',
           temp_budget = ''
       WHERE user_id = ?`
    )
      .bind(userId)
      .run();

    const updatedUser = await getUser(env.DB, userId);
    const remainingCredits = updatedUser ? updatedUser.credits : 0;

    if (statusMsg?.result?.message_id) {
      await deleteTelegramMessage(env.BOT_TOKEN, chatId, statusMsg.result.message_id);
    }

    const fullAnswer = `${aiResponse}${t.creditsLeftLine(remainingCredits)}`;
    const helpKeyboard = {
      inline_keyboard: [[{ text: t.btnOrderPersonal, callback_data: 'show_order' }]],
    };

    await sendLongFormattedResponse(env.BOT_TOKEN, chatId, fullAnswer, helpKeyboard);
  } catch (err) {
    console.error('Analysis error:', err.message);

    if (statusMsg?.result?.message_id) {
      await deleteTelegramMessage(env.BOT_TOKEN, chatId, statusMsg.result.message_id);
    }

    const safeReason = escapeHtml((err?.message || 'Unknown error').slice(0, 260));
    await sendTelegramMessage(env.BOT_TOKEN, chatId, t.analysisError(safeReason), {
      parse_mode: 'HTML',
    });
  }
}

// ==========================================
// ЭТАП 1: РАСПОЗНАВАНИЕ СКРИНШОТА
// ==========================================
async function extractSpecsFromImage(env, imageInfo, deadline) {
  const ocrSystem = 'Ты — точный OCR-сканер характеристик техники со скриншотов. Выдавай только факты.';
  const ocrPrompt =
    'Изучи скриншот товара.\n' +
    'ПЕРВОЙ СТРОКОЙ строго напиши: MODEL_FOR_SEARCH: <бренд, точная модель, артикул И главный GPU/CPU если есть, например Gigabyte GAMING A16 3WH RTX 5070 Ryzen 7 260>\n' +
    'Дальше списком перепиши со скриншота ВСЕ видимые характеристики: цену, валюту, процессор, видеокарту, ОЗУ, накопитель, экран, порты, теги и описание. Ничего не придумывай и не оценивай.';

  let rawText = '';
  const ocrErrors = [];

  if (env.GROQ_API_KEY) {
    const groqVisionModels = [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'qwen/qwen3.8-27b',
    ];

    for (const vModel of groqVisionModels) {
      if (Date.now() > deadline - 10000) break;
      try {
        rawText = await callOpenAICompatibleAPI(
          'https://api.groq.com/openai/v1/chat/completions',
          env.GROQ_API_KEY,
          vModel,
          ocrSystem,
          ocrPrompt,
          imageInfo,
          Math.min(7000, Math.max(3000, deadline - Date.now() - 10000)),
          700
        );
        if (rawText) {
          console.log(`OCR success via ${vModel}`);
          break;
        }
      } catch (err) {
        console.warn(`Groq OCR (${vModel}) failed:`, err.message);
        ocrErrors.push(`${vModel}: ${err.message}`);
      }
    }
  }

  if (!rawText && env.GEMINI_API_KEY) {
    for (const gModel of GEMINI_MODELS) {
      if (Date.now() > deadline - 7000) break;
      try {
        rawText = await callGeminiSingleModel(
          env.GEMINI_API_KEY,
          gModel,
          ocrSystem,
          ocrPrompt,
          imageInfo,
          Math.min(7000, Math.max(3000, deadline - Date.now() - 7000))
        );
        if (rawText) {
          console.log(`OCR success via ${gModel}`);
          break;
        }
      } catch (err) {
        console.warn(`Gemini OCR (${gModel}) failed:`, err.message);
        ocrErrors.push(`${gModel}: ${err.message}`);
      }
    }
  }

  if (!rawText) {
    throw new Error(`OCR failed (${ocrErrors.join(' | ')})`);
  }

  const match = rawText.match(/MODEL_FOR_SEARCH:\s*(.+)/i);
  const modelQuery = match
    ? match[1].replace(/[*`#\[\]]/g, '').trim().slice(0, 90)
    : rawText.split('\n')[0].replace(/[*`#]/g, '').trim().slice(0, 90);

  return {
    modelQuery,
    specsText: rawText,
  };
}

// ==========================================
// ЭТАП 2: ЖИВОЙ ПОИСК В GOOGLE (SERPER / TAVILY)
// ==========================================
async function runLiveWebSearch(env, query) {
  if (env.SERPER_API_KEY) {
    try {
      const [specsRes, priceRes] = await Promise.all([
        fetchSerper(env.SERPER_API_KEY, `${query} specs display sRGB TGP battery Wh cooling review`),
        fetchSerper(env.SERPER_API_KEY, `${query} характеристики цена отзывы проблемы`),
      ]);
      const combined = [specsRes, priceRes].filter(Boolean).join('\n---\n');
      if (combined.trim()) {
        return combined.slice(0, 2200);
      }
    } catch (err) {
      console.warn('Serper search failed:', err.message);
    }
  }

  if (env.TAVILY_API_KEY) {
    try {
      const tavilyText = await fetchTavily(
        env.TAVILY_API_KEY,
        `${query} specs display sRGB TGP battery review price`
      );
      if (tavilyText.trim()) {
        return tavilyText.slice(0, 2200);
      }
    } catch (err) {
      console.warn('Tavily search failed:', err.message);
    }
  }

  return '';
}

async function fetchSerper(apiKey, q) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q, num: 5 }),
    signal: AbortSignal.timeout(3500),
  });

  if (!res.ok) {
    throw new Error(`Serper HTTP ${res.status}`);
  }

  const data = await res.json();
  const lines = [];

  if (data.answerBox?.answer || data.answerBox?.snippet) {
    lines.push(`Быстрый факт Google: ${data.answerBox.answer || data.answerBox.snippet}`);
  }
  if (data.knowledgeGraph?.description) {
    lines.push(`Карточка Google: ${data.knowledgeGraph.description}`);
  }
  if (Array.isArray(data.organic)) {
    for (const item of data.organic.slice(0, 4)) {
      if (item.title || item.snippet) {
        lines.push(`• ${item.title}: ${item.snippet || ''}`);
      }
    }
  }
  return lines.join('\n');
}

async function fetchTavily(apiKey, query) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: true,
    }),
    signal: AbortSignal.timeout(4000),
  });

  if (!res.ok) {
    throw new Error(`Tavily HTTP ${res.status}`);
  }

  const data = await res.json();
  const lines = [];
  if (data.answer) {
    lines.push(`Сводка Tavily: ${data.answer}`);
  }
  if (Array.isArray(data.results)) {
    for (const r of data.results.slice(0, 4)) {
      lines.push(`• ${r.title}: ${(r.content || '').slice(0, 320)}`);
    }
  }
  return lines.join('\n');
}

// ==========================================
// ЭТАП 3: ФИНАЛЬНЫЙ ИНЖЕНЕРНЫЙ АНАЛИЗ
// ==========================================
async function generateFinalAnalysis(env, userPromptText, hasLiveSearch, deadline) {
  const errors = [];
  const today = new Date().toISOString().slice(0, 10);
  const fullSystemPrompt = `ТЕКУЩАЯ ДАТА: ${today}. Оценивай актуальность и новизну железа строго относительно этой даты.\n\n${SYSTEM_PROMPT}\n\n${KNOWLEDGE_BASE}`;

  const getTimeout = (maxMs = 9500) => Math.max(3000, Math.min(maxMs, deadline - Date.now() - 800));

  if (!hasLiveSearch && env.GROQ_API_KEY && Date.now() < deadline - 4000) {
    try {
      console.log('Using groq/compound-mini built-in web search');
      return await callOpenAICompatibleAPI(
        'https://api.groq.com/openai/v1/chat/completions',
        env.GROQ_API_KEY,
        'groq/compound-mini',
        fullSystemPrompt,
        userPromptText,
        null,
        getTimeout(13000),
        2100
      );
    } catch (err) {
      console.warn('groq/compound-mini failed:', err.message);
      errors.push(`CompoundMini: ${err.message}`);
    }
  }

  if (env.GROQ_API_KEY && Date.now() < deadline - 2500) {
    try {
      return await callOpenAICompatibleAPI(
        'https://api.groq.com/openai/v1/chat/completions',
        env.GROQ_API_KEY,
        'openai/gpt-oss-120b',
        fullSystemPrompt,
        userPromptText,
        null,
        getTimeout(8500),
        2100
      );
    } catch (err) {
      console.warn('gpt-oss-120b failed:', err.message);
      errors.push(`Groq120B: ${err.message}`);

      if (Date.now() < deadline - 3000) {
        try {
          return await callOpenAICompatibleAPI(
            'https://api.groq.com/openai/v1/chat/completions',
            env.GROQ_API_KEY,
            'groq/compound-mini',
            fullSystemPrompt,
            userPromptText,
            null,
            getTimeout(11000),
            2100
          );
        } catch (err2) {
          errors.push(`CompoundBackup: ${err2.message}`);
        }
      }
    }
  }

  if (env.GEMINI_API_KEY) {
    for (const model of GEMINI_MODELS) {
      if (Date.now() > deadline - 3000) break;
      try {
        return await callGeminiSingleModel(
          env.GEMINI_API_KEY,
          model,
          fullSystemPrompt,
          userPromptText,
          null,
          getTimeout(7000)
        );
      } catch (err) {
        console.warn(`Gemini (${model}) failed:`, err.message);
        errors.push(`${model}: ${err.message}`);
      }
    }
  }

  const grokKey = env.GROK_API_KEY || env.XAI_API_KEY;
  if (grokKey && Date.now() < deadline - 2500) {
    try {
      return await callOpenAICompatibleAPI(
        'https://api.x.ai/v1/chat/completions',
        grokKey,
        'grok-4.7',
        fullSystemPrompt,
        userPromptText,
        null,
        getTimeout(8000),
        2100
      );
    } catch (err) {
      errors.push(`Grok: ${err.message}`);
    }
  }

  throw new Error(errors.join(' | '));
}

async function callGeminiSingleModel(apiKey, model, systemText, userPromptText, imageInfo, timeoutMs) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const userParts = [{ text: userPromptText }];
  if (imageInfo) {
    userParts.push({
      inlineData: {
        mimeType: imageInfo.mimeType,
        data: imageInfo.base64,
      },
    });
  }

  const payload = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: userParts }],
    generationConfig: {
      temperature: 0.3,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`HTTP ${response.status} (${errBody.slice(0, 120)})`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || '')
    .join('')
    .trim();

  if (!text) throw new Error('Пустой ответ модели');
  return text;
}

async function callOpenAICompatibleAPI(
  endpointUrl,
  apiKey,
  model,
  systemText,
  userPromptText,
  imageInfo,
  timeoutMs,
  maxTokens = 2100
) {
  const userContent = imageInfo
    ? [
        { type: 'text', text: userPromptText },
        {
          type: 'image_url',
          image_url: { url: `data:${imageInfo.mimeType};base64,${imageInfo.base64}` },
        },
      ]
    : userPromptText;

  const requestBody = {
    model,
    messages: [
      { role: 'system', content: systemText },
      { role: 'user', content: userContent },
    ],
    temperature: 0.3,
    max_tokens: maxTokens,
  };

  if (model === 'openai/gpt-oss-120b') {
    requestBody.reasoning_effort = 'low';
  }

  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`HTTP ${response.status} (${errBody.slice(0, 120)})`);
  }

  const data = await response.json();
  const text = (data?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('Пустой ответ модели');
  return text;
}

// ==========================================
// СКАЧИВАНИЕ ФОТО И СВЕРХБЫСТРЫЙ BASE64
// ==========================================
async function downloadTelegramPhotoAsBase64(botToken, fileId) {
  const fileInfoRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
    { signal: AbortSignal.timeout(4000) }
  );
  const fileInfo = await fileInfoRes.json();

  if (!fileInfo.ok || !fileInfo.result?.file_path) {
    throw new Error('Не удалось получить путь к фото от Telegram');
  }

  const filePath = fileInfo.result.file_path;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!fileRes.ok) {
    throw new Error(`Ошибка скачивания фото: HTTP ${fileRes.status}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let base64;
  if (typeof bytes.toBase64 === 'function') {
    base64 = bytes.toBase64();
  } else {
    let binary = '';
    const chunkSize = 0x4000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    base64 = btoa(binary);
  }

  const lowerPath = filePath.toLowerCase();
  const mimeType = lowerPath.endsWith('.png')
    ? 'image/png'
    : lowerPath.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';

  return { base64, mimeType };
}

// ==========================================
// АДМИН-КОМАНДЫ И РАБОТА С D1
// ==========================================
async function handleAdminAdd(chatId, text, env) {
  const parts = text.split(/\s+/);
  if (parts.length !== 3 || !/^\d+$/.test(parts[1]) || !/^\d+$/.test(parts[2])) {
    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      'Использование: <code>/add user_id количество</code>\nПример: <code>/add 123456789 10</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const targetUserId = Number(parts[1]);
  const amount = Number(parts[2]);

  if (amount <= 0) {
    await sendTelegramMessage(env.BOT_TOKEN, chatId, 'Количество проверок должно быть больше 0.');
    return;
  }

  await env.DB.prepare(
    `INSERT INTO users (user_id, credits, step, temp_task, temp_budget, total_checks, lang)
     VALUES (?, ?, 'idle', '', '', 0, '')
     ON CONFLICT(user_id) DO UPDATE SET credits = credits + excluded.credits`
  )
    .bind(targetUserId, amount)
    .run();

  await sendTelegramMessage(
    env.BOT_TOKEN,
    chatId,
    `✅ Пользователю <code>${targetUserId}</code> начислено <b>${amount}</b> проверок.`,
    { parse_mode: 'HTML' }
  );

  const user = await getUser(env.DB, targetUserId);
  const notifyMsg =
    user?.lang === 'uk'
      ? `🎉 Вам нараховано ${amount} перевірок!`
      : `🎉 Вам начислено ${amount} проверок!`;

  const notifyRes = await sendTelegramMessage(env.BOT_TOKEN, targetUserId, notifyMsg);

  if (!notifyRes.ok) {
    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      `⚠️ Проверки начислены, но уведомить пользователя не удалось.`
    );
  }
}

async function handleAdminStats(chatId, env) {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS total_users, COALESCE(SUM(total_checks), 0) AS all_checks FROM users'
  ).first();

  const totalUsers = row?.total_users || 0;
  const allChecks = row?.all_checks || 0;

  await sendTelegramMessage(
    env.BOT_TOKEN,
    chatId,
    `📊 <b>Статистика бота</b>\n\n` +
      `👥 Пользователей в D1: <b>${totalUsers}</b>\n` +
      `🔍 Проведено проверок: <b>${allChecks}</b>`,
    { parse_mode: 'HTML' }
  );
}

async function getUser(db, userId) {
  return await db.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first();
}

async function ensureUserExists(db, userId) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO users (user_id, credits, step, temp_task, temp_budget, total_checks, lang)
       VALUES (?, 1, 'idle', '', '', 0, '')`
    )
    .bind(userId)
    .run();
}

async function registerOrResetUser(db, userId) {
  const existing = await getUser(db, userId);
  if (!existing) {
    await ensureUserExists(db, userId);
    return true;
  }
  await updateUserState(db, userId, { step: 'idle', temp_task: '', temp_budget: '' });
  return false;
}

async function updateUserState(db, userId, fields) {
  const updates = [];
  const values = [];

  if (fields.step !== undefined) {
    updates.push('step = ?');
    values.push(fields.step);
  }
  if (fields.temp_task !== undefined) {
    updates.push('temp_task = ?');
    values.push(fields.temp_task);
  }
  if (fields.temp_budget !== undefined) {
    updates.push('temp_budget = ?');
    values.push(fields.temp_budget);
  }

  if (updates.length === 0) return;

  values.push(userId);
  await db
    .prepare(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`)
    .bind(...values)
    .run();
}

// ==========================================
// УТИЛИТЫ TELEGRAM API И ФОРМАТИРОВАНИЕ
// ==========================================
function getMainMenuKeyboard(lang) {
  const t = TEXTS[lang] || TEXTS.ru;
  return {
    keyboard: [[{ text: t.btnCheck }, { text: t.btnBalance }, { text: t.btnLang }]],
    resize_keyboard: true,
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatMarkdownToSafeHtml(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');
  safe = safe.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>');
  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
  safe = safe.replace(/^\*\s+/gm, '• ');
  return safe;
}

function splitLongText(text, maxLength = 3500) {
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let current = '';
  const lines = text.split('\n');

  for (const line of lines) {
    const lineWithBreak = line + '\n';
    if (current.length + lineWithBreak.length > maxLength) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = '';
      }
      if (lineWithBreak.length > maxLength) {
        let rest = lineWithBreak;
        while (rest.length > maxLength) {
          chunks.push(rest.slice(0, maxLength));
          rest = rest.slice(maxLength);
        }
        current = rest;
        continue;
      }
    }
    current += lineWithBreak;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }
  return chunks;
}

async function sendLongFormattedResponse(botToken, chatId, rawText, lastReplyMarkup) {
  const chunks = splitLongText(rawText, 3500);

  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const replyMarkup = isLast ? lastReplyMarkup : undefined;
    const htmlChunk = formatMarkdownToSafeHtml(chunks[i]);

    const res = await sendTelegramMessage(botToken, chatId, htmlChunk, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    });

    if (!res.ok) {
      await sendTelegramMessage(botToken, chatId, chunks[i], {
        reply_markup: replyMarkup,
      });
    }
  }
}

async function sendTelegramMessage(botToken, chatId, text, extra = {}) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...extra,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram API error:', JSON.stringify(data));
    }
    return data;
  } catch (err) {
    console.error('sendTelegramMessage error:', err);
    return { ok: false };
  }
}

async function editTelegramMessage(botToken, chatId, messageId, text, extra = {}) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        ...extra,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('editTelegramMessage error:', err);
    return { ok: false };
  }
}

async function deleteTelegramMessage(botToken, chatId, messageId) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  } catch {
    // Игнорируем
  }
}

async function sendChatAction(botToken, chatId, action) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    // Игнорируем
  }
}

async function answerCallbackQuery(botToken, callbackQueryId) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  } catch {
    // Игнорируем
  }
}
