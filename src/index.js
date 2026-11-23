import { SYSTEM_PROMPT } from './prompts.js';
import { KNOWLEDGE_BASE } from './knowledge_base.js';

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
];

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
    const isNew = await registerOrResetUser(env.DB, userId);
    const user = await getUser(env.DB, userId);
    const credits = user ? user.credits : 1;

    const bonusLine = isNew
      ? '\n🎁 Как новому пользователю, тебе начислена <b>1 бесплатная проверка</b>!\n'
      : '';

    const firstName = escapeHtml(message.from?.first_name || 'друг');
    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      `👋 Привет, <b>${firstName}</b>!\n\n` +
        `Я — <b>Честный анализатор железа</b>. Пришли мне скриншот товара или текст с характеристиками ` +
        `ноутбука, ПК или смартфона: я простым языком оценю железо, покажу, что продавец скрыл, ` +
        `и проверю известные подвохи и актуальную цену модели в сети.\n` +
        `${bonusLine}\n` +
        `💳 Доступно проверок: <b>${credits}</b>\n\n` +
        `Нажми <b>«🔍 Проверить железо»</b>, чтобы начать.`,
      {
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(),
      }
    );
    return;
  }

  await ensureUserExists(env.DB, userId);

  // --- 3. Кнопки главного меню ---
  if (text === '💳 Мои проверки') {
    await updateUserState(env.DB, userId, { step: 'idle', temp_task: '', temp_budget: '' });
    const user = await getUser(env.DB, userId);
    const credits = user ? user.credits : 0;

    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      `💳 <b>Ваш баланс проверок:</b> ${credits}\n` +
        `🆔 <b>Ваш Telegram ID:</b> <code>${userId}</code>\n\n` +
        `<b>Тарифы:</b>\n` +
        `• ⚡ <b>10 проверок в боте</b> — 149 грн ($3.5)\n` +
        `• 🤝 <b>Личный подбор техники за 24ч</b> (3 лучших варианта от инженера) — 690 грн ($16)\n\n` +
        `Для оплаты и начисления напишите администратору и отправьте свой ID.`,
      {
        parse_mode: 'HTML',
        reply_markup: getAdminContactInlineKeyboard(env, '💬 Написать администратору'),
      }
    );
    return;
  }

  if (text === '🔍 Проверить железо') {
    const user = await getUser(env.DB, userId);
    const credits = user ? user.credits : 0;

    if (credits <= 0) {
      await updateUserState(env.DB, userId, { step: 'idle', temp_task: '', temp_budget: '' });
      await sendTelegramMessage(
        env.BOT_TOKEN,
        chatId,
        `😔 На вашем балансе <b>0 проверок</b>.\n\n` +
          `<b>Продолжить выбор без ошибок:</b>\n` +
          `• ⚡ <b>Пакет 10 проверок</b> — 149 грн ($3.5)\n` +
          `• 🤝 <b>Личный подбор под ключ</b> (найду 3 лучших модели за вас) — 690 грн ($16)\n\n` +
          `📌 Ваш Telegram ID: <code>${userId}</code>\n` +
          `<i>Нажмите на ID, чтобы скопировать, и отправьте его администратору для оплаты.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: getAdminContactInlineKeyboard(env, '💬 Купить проверки / Подбор'),
        }
      );
      return;
    }

    await updateUserState(env.DB, userId, {
      step: 'wait_task',
      temp_task: '',
      temp_budget: '',
    });

    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      '🛠 <b>Шаг 1 из 3.</b> Для каких задач берете технику?',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 Игры', callback_data: 'task:Игры' }],
            [{ text: '🎬 Монтаж и дизайн', callback_data: 'task:Монтаж и дизайн' }],
            [{ text: '💻 Программирование', callback_data: 'task:Программирование' }],
            [{ text: '📚 Учеба и офис', callback_data: 'task:Учеба и офис' }],
          ],
        },
      }
    );
    return;
  }

  // --- 4. Обработка шагов диалога из D1 ---
  const user = await getUser(env.DB, userId);
  const step = user?.step || 'idle';

  if (step === 'wait_task') {
    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      'Пожалуйста, выберите задачу с помощью кнопок выше 👆'
    );
    return;
  }

  if (step === 'wait_budget') {
    if (!text) {
      await sendTelegramMessage(
        env.BOT_TOKEN,
        chatId,
        'Напишите бюджет текстом (например: 40 000 грн / $1000) или нажмите кнопку «Пропустить».'
      );
      return;
    }

    await updateUserState(env.DB, userId, {
      step: 'wait_input',
      temp_budget: text.slice(0, 120),
    });

    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      `✅ Бюджет: <b>${escapeHtml(text)}</b>\n\n` +
        `📸 <b>Шаг 3 из 3.</b> Пришлите <b>СКРИНШОТ</b> товара с характеристиками ` +
        `или отправьте <b>текст / точное название модели</b>.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  if (step === 'wait_input') {
    await processHardwareAnalysis(message, user, env);
    return;
  }

  await sendTelegramMessage(
    env.BOT_TOKEN,
    chatId,
    'Чтобы начать разбор ноутбука, ПК или смартфона, нажмите кнопку <b>«🔍 Проверить железо»</b> в меню ниже.',
    {
      parse_mode: 'HTML',
      reply_markup: getMainMenuKeyboard(),
    }
  );
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
  const user = await getUser(env.DB, userId);

  if (data.startsWith('task:')) {
    if (!user || user.credits <= 0) {
      await sendTelegramMessage(
        env.BOT_TOKEN,
        chatId,
        `На вашем балансе 0 проверок. Ваш ID: <code>${userId}</code>`,
        {
          parse_mode: 'HTML',
          reply_markup: getAdminContactInlineKeyboard(env, '💬 Купить проверки'),
        }
      );
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
      `✅ Выбрана задача: <b>${escapeHtml(chosenTask)}</b>\n\n` +
        `💰 <b>Шаг 2 из 3.</b> Какой у вас бюджет?\n` +
        `<i>Напишите текстом (например: 40 000 грн / $1000) или нажмите «Пропустить».</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '⏭ Пропустить', callback_data: 'skip_budget' }]],
        },
      }
    );
    return;
  }

  if (data === 'skip_budget') {
    await updateUserState(env.DB, userId, {
      step: 'wait_input',
      temp_budget: 'Не указан',
    });

    await editTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      messageId,
      `⏭ Бюджет пропущен.\n\n` +
        `📸 <b>Шаг 3 из 3.</b> Пришлите <b>СКРИНШОТ</b> товара с характеристиками ` +
        `или отправьте <b>текст / точное название модели</b>.`,
      { parse_mode: 'HTML' }
    );
  }
}

// ==========================================
// ГЛАВНЫЙ КОНВЕЙЕР АНАЛИЗА С ЖИВЫМ ПОИСКОМ
// ==========================================
async function processHardwareAnalysis(message, user, env) {
  const chatId = message.chat.id;
  const userId = user.user_id;
  const isAdmin = String(userId) === String(env.ADMIN_ID);

  if (user.credits <= 0) {
    await updateUserState(env.DB, userId, { step: 'idle', temp_task: '', temp_budget: '' });
    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      `😔 У вас 0 проверок на балансе. Ваш ID: <code>${userId}</code>`,
      {
        parse_mode: 'HTML',
        reply_markup: getAdminContactInlineKeyboard(env, '💬 Купить проверки'),
      }
    );
    return;
  }

  const hasPhoto = Array.isArray(message.photo) && message.photo.length > 0;
  const rawTextInput = (message.text || message.caption || '').trim();

  if (!hasPhoto && !rawTextInput) {
    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      'Пожалуйста, отправьте <b>сжатое фото (скриншот)</b> или <b>текст</b> с характеристиками.\n' +
        '<i>Если отправляете картинку, убедитесь, что она отправлена как «Фото», а не как «Файл».</i>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Секретные админ-теги для проверки качества любой модели:
  // #test_120b, #test_cerebras, #test_llama70, #test_mistral, #test_gemini35, #test_gemini36, #test_grok
  let forcedModel = '';
  if (isAdmin && rawTextInput) {
    const tagMatch = rawTextInput.match(
      /#test_(120b|cerebras|llama70|mistral|gemini35|gemini36|grok)\b/i
    );
    if (tagMatch) {
      forcedModel = tagMatch[1].toLowerCase();
    }
  }
  const textInput = forcedModel
    ? rawTextInput
        .replace(/#test_(120b|cerebras|llama70|mistral|gemini35|gemini36|grok)\b/gi, '')
        .trim()
    : rawTextInput;

  await sendChatAction(env.BOT_TOKEN, chatId, 'typing');
  const statusMsg = await sendTelegramMessage(
    env.BOT_TOKEN,
    chatId,
    '⏳ Считываю ваши характеристики и проверяю модель в сети...'
  );

  // Потолок 26 сек (безопасный запас от лимита Cloudflare 30 сек)
  const deadline = Date.now() + 26000;

  try {
    let extractedSpecs = '';
    let searchQuery = '';

    // --- ЭТАП 1: Извлекаем модель и спеки со скриншота (или текста) ---
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

    // --- ЭТАП 2: Живой поиск в Google / интернете (Serper -> Tavily) ---
    let liveSearchData = '';
    if (searchQuery && Date.now() < deadline - 6000) {
      liveSearchData = await runLiveWebSearch(env, searchQuery);
      console.log('Live search chars:', liveSearchData.length);
    }

    // --- ЭТАП 3: Финальный разбор ---
    const userPromptText =
      `Задача пользователя: ${user.temp_task || 'Не указана'}\n` +
      `Бюджет пользователя: ${user.temp_budget || 'Не указан'}\n\n` +
      (textInput ? `=== ДАННЫЕ ОТ ПОЛЬЗОВАТЕЛЯ (ТЕКСТ) ===\n${textInput}\n\n` : '') +
      (extractedSpecs ? `=== ДАННЫЕ СО СКРИНШОТА ПОЛЬЗОВАТЕЛЯ ===\n${extractedSpecs}\n\n` : '') +
      (liveSearchData
        ? `=== ДОПОЛНИТЕЛЬНАЯ СПРАВКА ИЗ ЖИВОГО ПОИСКА (ТОЛЬКО ДЛЯ БЛОКА 2 С ОГОВОРКОЙ, НЕ СМЕШИВАЙ С БЛОКОМ 1!) ===\n${liveSearchData}\n`
        : '=== ПОИСК В СЕТИ НЕ ВЕРНУЛ ДАННЫХ ===\nОпирайся ТОЛЬКО на данные пользователя и предупреди, что скрытые параметры неизвестны.\n');

    const aiResult = await generateFinalAnalysis(env, userPromptText, deadline, forcedModel);
    console.log('Final analysis model used:', aiResult.modelUsed);

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

    const adminModelBadge = isAdmin ? `\n🤖 [Админ-лог] Модель: ${aiResult.modelUsed}` : '';
    const fullAnswer = `${aiResult.text}\n\n💳 **Осталось проверок:** ${remainingCredits}${adminModelBadge}`;
    const helpKeyboard = getAdminContactInlineKeyboard(env, '🤝 Заказать личный подбор');

    await sendLongFormattedResponse(env.BOT_TOKEN, chatId, fullAnswer, helpKeyboard);
  } catch (err) {
    console.error('Analysis error:', err.message);

    if (statusMsg?.result?.message_id) {
      await deleteTelegramMessage(env.BOT_TOKEN, chatId, statusMsg.result.message_id);
    }

    const safeReason = escapeHtml((err?.message || 'Неизвестная ошибка').slice(0, 260));
    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      '⚠️ Не удалось завершить анализ.\n' +
        'Ваша проверка <b>не списана</b>. Попробуйте ещё раз чуть позже.\n\n' +
        `<i>Техническая причина: ${safeReason}</i>`,
      { parse_mode: 'HTML' }
    );
  }
}

// ==========================================
// ЭТАП 1: РАСПОЗНАВАНИЕ СКРИНШОТА (GROQ QWEN -> MISTRAL -> GEMINI)
// ==========================================
async function extractSpecsFromImage(env, imageInfo, deadline) {
  const ocrSystem = 'Ты — точный OCR-сканер характеристик техники со скриншотов. Выдавай только факты.';
  const ocrPrompt =
    'Изучи скриншот товара.\n' +
    'ПЕРВОЙ СТРОКОЙ строго напиши: MODEL_FOR_SEARCH: <бренд, точная модель, артикул И главный GPU/CPU если есть, например Gigabyte GAMING A16 3WH RTX 5070 Ryzen 7 260>\n' +
    'Дальше списком перепиши со скриншота ВСЕ видимые характеристики: цену, валюту, процессор, видеокарту, ОЗУ, накопитель, экран, порты, теги и описание. Ничего не придумывай и не оценивай.';

  let rawText = '';
  const ocrErrors = [];

  // 1. Groq Qwen 3.8
  if (env.GROQ_API_KEY && Date.now() < deadline - 10000) {
    try {
      rawText = await callOpenAICompatibleAPI(
        'https://api.groq.com/openai/v1/chat/completions',
        env.GROQ_API_KEY,
        'qwen/qwen3.8-27b',
        ocrSystem,
        ocrPrompt,
        imageInfo,
        Math.min(7000, Math.max(3000, deadline - Date.now() - 10000)),
        700
      );
      if (rawText) console.log('OCR success via Groq qwen/qwen3.8-27b');
    } catch (err) {
      console.warn('Groq OCR failed:', err.message);
      ocrErrors.push(`GroqQwen: ${err.message}`);
    }
  }

  // 2. Запасной Mistral Vision (mistral-small-latest, 500K TPM!)
  if (!rawText && env.MISTRAL_API_KEY && Date.now() < deadline - 8000) {
    try {
      rawText = await callOpenAICompatibleAPI(
        'https://api.mistral.ai/v1/chat/completions',
        env.MISTRAL_API_KEY,
        'mistral-small-latest',
        ocrSystem,
        ocrPrompt,
        imageInfo,
        Math.min(7500, Math.max(3000, deadline - Date.now() - 8000)),
        700
      );
      if (rawText) console.log('OCR success via Mistral mistral-small-latest');
    } catch (err) {
      console.warn('Mistral OCR failed:', err.message);
      ocrErrors.push(`MistralOCR: ${err.message}`);
    }
  }

  // 3. Запасной Gemini
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
    throw new Error(`Не удалось распознать скриншот (${ocrErrors.join(' | ')})`);
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
        fetchSerper(env.SERPER_API_KEY, `${query} цена купить украина характеристики отзывы`),
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
async function generateFinalAnalysis(env, userPromptText, deadline, forcedModel = '') {
  const errors = [];
  const today = new Date().toISOString().slice(0, 10);
  const fullSystemPrompt = `ТЕКУЩАЯ ДАТА: ${today}. Оценивай актуальность и новизну железа строго относительно этой даты.\n\n${SYSTEM_PROMPT}\n\n${KNOWLEDGE_BASE}`;

  const getTimeout = (maxMs = 9500) => Math.max(3000, Math.min(maxMs, deadline - Date.now() - 800));

  // Принудительный тест конкретной модели (только для админа #test_...)
  if (forcedModel) {
    if (forcedModel === '120b' || forcedModel === 'llama70') {
      const mName = forcedModel === '120b' ? 'openai/gpt-oss-120b' : 'llama-3.3-70b-versatile';
      const text = await callOpenAICompatibleAPI(
        'https://api.groq.com/openai/v1/chat/completions',
        env.GROQ_API_KEY,
        mName,
        fullSystemPrompt,
        userPromptText,
        null,
        getTimeout(11000),
        2100
      );
      return { text, modelUsed: `Groq ${mName} (тест)` };
    }
    if (forcedModel === 'cerebras') {
      if (!env.CEREBRAS_API_KEY) throw new Error('Не задан ключ CEREBRAS_API_KEY в Cloudflare');
      const text = await callOpenAICompatibleAPI(
        'https://api.cerebras.ai/v1/chat/completions',
        env.CEREBRAS_API_KEY,
        'gpt-oss-120b',
        fullSystemPrompt,
        userPromptText,
        null,
        getTimeout(10000),
        2100
      );
      return { text, modelUsed: 'Cerebras gpt-oss-120b (тест)' };
    }
    if (forcedModel === 'mistral') {
      if (!env.MISTRAL_API_KEY) throw new Error('Не задан ключ MISTRAL_API_KEY в Cloudflare');
      const text = await callOpenAICompatibleAPI(
        'https://api.mistral.ai/v1/chat/completions',
        env.MISTRAL_API_KEY,
        'mistral-large-latest',
        fullSystemPrompt,
        userPromptText,
        null,
        getTimeout(12000),
        2100
      );
      return { text, modelUsed: 'Mistral large-latest (тест)' };
    }
    if (forcedModel === 'gemini35' || forcedModel === 'gemini36') {
      const gName = forcedModel === 'gemini36' ? 'gemini-3.6-flash' : 'gemini-3.5-flash-lite';
      const text = await callGeminiSingleModel(
        env.GEMINI_API_KEY,
        gName,
        fullSystemPrompt,
        userPromptText,
        null,
        getTimeout(13000)
      );
      return { text, modelUsed: `${gName} (тест)` };
    }
    if (forcedModel === 'grok') {
      const grokKey = env.GROK_API_KEY || env.XAI_API_KEY;
      const text = await callOpenAICompatibleAPI(
        'https://api.x.ai/v1/chat/completions',
        grokKey,
        'grok-4.7',
        fullSystemPrompt,
        userPromptText,
        null,
        getTimeout(12000),
        2100
      );
      return { text, modelUsed: 'grok-4.7 (тест)' };
    }
  }

  // 1. Cerebras gpt-oss-120b (1M токенов/день бесплатно, 60K TPM!)
  if (env.CEREBRAS_API_KEY && Date.now() < deadline - 2500) {
    try {
      const text = await callOpenAICompatibleAPI(
        'https://api.cerebras.ai/v1/chat/completions',
        env.CEREBRAS_API_KEY,
        'gpt-oss-120b',
        fullSystemPrompt,
        userPromptText,
        null,
        getTimeout(8500),
        2100
      );
      return { text, modelUsed: 'Cerebras gpt-oss-120b' };
    } catch (err) {
      console.warn('Cerebras failed:', err.message);
      errors.push(`Cerebras: ${err.message}`);
    }
  }

  // 2. Groq (120B и Llama 3.3 70B)
  if (env.GROQ_API_KEY) {
    const groqTextModels = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'];
    for (const gModel of groqTextModels) {
      if (Date.now() > deadline - 2500) break;
      try {
        const text = await callOpenAICompatibleAPI(
          'https://api.groq.com/openai/v1/chat/completions',
          env.GROQ_API_KEY,
          gModel,
          fullSystemPrompt,
          userPromptText,
          null,
          getTimeout(8000),
          2100
        );
        return { text, modelUsed: `Groq ${gModel}` };
      } catch (err) {
        console.warn(`Groq (${gModel}) failed:`, err.message);
        errors.push(`${gModel}: ${err.message}`);
      }
    }
  }

  // 3. Mistral (1B токенов/мес бесплатно)
  if (env.MISTRAL_API_KEY && Date.now() < deadline - 2500) {
    try {
      const text = await callOpenAICompatibleAPI(
        'https://api.mistral.ai/v1/chat/completions',
        env.MISTRAL_API_KEY,
        'mistral-large-latest',
        fullSystemPrompt,
        userPromptText,
        null,
        getTimeout(9000),
        2100
      );
      return { text, modelUsed: 'Mistral large-latest' };
    } catch (err) {
      console.warn('Mistral failed:', err.message);
      errors.push(`Mistral: ${err.message}`);
    }
  }

  // 4. Google Gemini
  if (env.GEMINI_API_KEY) {
    for (const model of GEMINI_MODELS) {
      if (Date.now() > deadline - 2500) break;
      try {
        const text = await callGeminiSingleModel(
          env.GEMINI_API_KEY,
          model,
          fullSystemPrompt,
          userPromptText,
          null,
          getTimeout(7000)
        );
        return { text, modelUsed: model };
      } catch (err) {
        console.warn(`Gemini (${model}) failed:`, err.message);
        errors.push(`${model}: ${err.message}`);
      }
    }
  }

  // 5. xAI Grok (если будет платный ключ console.x.ai)
  const grokKey = env.GROK_API_KEY || env.XAI_API_KEY;
  if (grokKey && Date.now() < deadline - 2500) {
    try {
      const text = await callOpenAICompatibleAPI(
        'https://api.x.ai/v1/chat/completions',
        grokKey,
        'grok-4.7',
        fullSystemPrompt,
        userPromptText,
        null,
        getTimeout(8000),
        2100
      );
      return { text, modelUsed: 'grok-4.7' };
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

  if (model === 'openai/gpt-oss-120b' || model === 'gpt-oss-120b') {
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
    `INSERT INTO users (user_id, credits, step, temp_task, temp_budget, total_checks)
     VALUES (?, ?, 'idle', '', '', 0)
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

  const notifyRes = await sendTelegramMessage(
    env.BOT_TOKEN,
    targetUserId,
    `🎉 Вам начислено ${amount} проверок!`
  );

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
      `INSERT OR IGNORE INTO users (user_id, credits, step, temp_task, temp_budget, total_checks)
       VALUES (?, 1, 'idle', '', '', 0)`
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
function getMainMenuKeyboard() {
  return {
    keyboard: [[{ text: '🔍 Проверить железо' }, { text: '💳 Мои проверки' }]],
    resize_keyboard: true,
  };
}

function getAdminContactInlineKeyboard(env, buttonText) {
  const cleanUsername = (env.ADMIN_USERNAME || '').replace(/^@/, '').trim();
  const url = cleanUsername
    ? `https://t.me/${cleanUsername}`
    : `tg://user?id=${env.ADMIN_ID}`;

  return {
    inline_keyboard: [[{ text: buttonText, url }]],
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
