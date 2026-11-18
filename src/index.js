import { SYSTEM_PROMPT } from './prompts.js';
import { KNOWLEDGE_BASE } from './knowledge_base.js';

// Список бесплатных моделей Gemini по приоритету (сначала с самыми большими лимитами)
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite', // ~500 бесплатных запросов в день
  'gemini-3.1-flash-lite', // Запасная бесплатная лёгкая модель
  'gemini-3.8-flash',      // Самая умная, но на бесплатном тарифе лимит ~20/день
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
  console.log('Incoming message from:', userId, 'text:', text);
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
        `ноутбука, ПК или комплектующих, и я разберу его без маркетинговой шелухи: найду урезанный TGP, ` +
        `блёклый экран, проблемы с охлаждением и переплату.\n` +
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
        `Для покупки пакета проверок или заказа персонального подбора техники напишите администратору и отправьте свой ID.`,
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
          `Вы можете приобрести пакет проверок (например, 10 штук) или заказать персональный подбор техники.\n\n` +
          `📌 Ваш Telegram ID: <code>${userId}</code>\n` +
          `<i>Нажмите на ID, чтобы скопировать, и отправьте его администратору после оплаты.</i>`,
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
    'Чтобы начать разбор ноутбука или ПК, нажмите кнопку <b>«🔍 Проверить железо»</b> в меню ниже.',
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
// АНАЛИЗ ЖЕЛЕЗА (GEMINI + ЗАПАСНЫЕ GROQ / GROK)
// ==========================================
async function processHardwareAnalysis(message, user, env) {
  const chatId = message.chat.id;
  const userId = user.user_id;

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
  const textInput = (message.text || message.caption || '').trim();

  if (!hasPhoto && !textInput) {
    await sendTelegramMessage(
      env.BOT_TOKEN,
      chatId,
      'Пожалуйста, отправьте <b>сжатое фото (скриншот)</b> или <b>текст</b> с характеристиками.\n' +
        '<i>Если отправляете картинку, убедитесь, что она отправлена как «Фото», а не как «Файл».</i>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  await sendChatAction(env.BOT_TOKEN, chatId, 'typing');
  const statusMsg = await sendTelegramMessage(
    env.BOT_TOKEN,
    chatId,
    '⏳ Анализирую характеристики и проверяю скрытые подвохи...'
  );

  try {
    let imageInfo = null;

    if (hasPhoto) {
      const lastPhoto = message.photo[message.photo.length - 1];
      const chosenPhoto =
        message.photo.length >= 2 && lastPhoto.file_size && lastPhoto.file_size > 500000
          ? message.photo[message.photo.length - 2]
          : lastPhoto;

      imageInfo = await downloadTelegramPhotoAsBase64(env.BOT_TOKEN, chosenPhoto.file_id);
    }

    const webHint = !hasPhoto && textInput ? await optionalWebLookup(textInput) : '';

    const userPromptText =
      `Задача пользователя: ${user.temp_task || 'Не указана'}\n` +
      `Бюджет пользователя: ${user.temp_budget || 'Не указан'}\n\n` +
      (textInput
        ? `Текст / комментарий пользователя:\n${textInput}\n\n`
        : 'Пользователь прислал скриншот без текстового описания. Изучи изображение.\n\n') +
      (webHint ? `Дополнительная справка из сети:\n${webHint}\n` : '');

    // Вызываем нейросеть с автоматическим переключением на запасные варианты
    const aiResponse = await callAIWithFallback(env, userPromptText, imageInfo);

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

    const fullAnswer = `${aiResponse}\n\n💳 <i>Осталось проверок: ${remainingCredits}</i>`;
    const helpKeyboard = getAdminContactInlineKeyboard(env, '🤝 Заказать личный подбор');

    await sendLongFormattedResponse(env.BOT_TOKEN, chatId, fullAnswer, helpKeyboard);
  } catch (err) {
    console.error('Analysis error:', err);

    if (statusMsg?.result?.message_id) {
      await deleteTelegramMessage(env.BOT_TOKEN, chatId, statusMsg.result.message_id);
    }

    const safeReason = escapeHtml((err?.message || 'Неизвестная ошибка').slice(0, 180));
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
// ЦЕПОЧКА НЕЙРОСЕТЕЙ: GEMINI -> GROQ -> GROK
// ==========================================
async function callAIWithFallback(env, userPromptText, imageInfo) {
  const errors = [];
  const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n${KNOWLEDGE_BASE}`;

  // 1. Пробуем бесплатные модели Gemini по очереди
  if (env.GEMINI_API_KEY) {
    for (const model of GEMINI_MODELS) {
      try {
        return await callGeminiSingleModel(
          env.GEMINI_API_KEY,
          model,
          fullSystemPrompt,
          userPromptText,
          imageInfo
        );
      } catch (err) {
        console.warn(`Gemini (${model}) failed:`, err.message);
        errors.push(`${model}: ${err.message}`);
      }
    }
  } else {
    errors.push('GEMINI_API_KEY не задан в Cloudflare');
  }

  // 2. Запасной вариант 1: Бесплатный Groq (console.groq.com)
  if (env.GROQ_API_KEY) {
    try {
      // qwen/qwen3.8-27b умеет читать скриншоты; openai/gpt-oss-120b — мощный текстовый анализ
      const groqModel = imageInfo ? 'qwen/qwen3.8-27b' : 'openai/gpt-oss-120b';
      return await callOpenAICompatibleAPI(
        'https://api.groq.com/openai/v1/chat/completions',
        env.GROQ_API_KEY,
        groqModel,
        fullSystemPrompt,
        userPromptText,
        imageInfo
      );
    } catch (err) {
      console.warn('Groq failed:', err.message);
      errors.push(`Groq: ${err.message}`);
    }
  }

  // 3. Запасной вариант 2: xAI Grok (console.x.ai)
  const grokKey = env.GROK_API_KEY || env.XAI_API_KEY;
  if (grokKey) {
    try {
      return await callOpenAICompatibleAPI(
        'https://api.x.ai/v1/chat/completions',
        grokKey,
        'grok-4.7',
        fullSystemPrompt,
        userPromptText,
        imageInfo
      );
    } catch (err) {
      console.warn('xAI Grok failed:', err.message);
      errors.push(`Grok: ${err.message}`);
    }
  }

  throw new Error(errors.join(' | '));
}

async function callGeminiSingleModel(apiKey, model, systemText, userPromptText, imageInfo) {
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
    systemInstruction: {
      parts: [{ text: systemText }],
    },
    contents: [
      {
        role: 'user',
        parts: userParts,
      },
    ],
    generationConfig: {
      temperature: 0.4,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.text();
    let shortMsg = errBody;
    try {
      const parsed = JSON.parse(errBody);
      shortMsg = parsed?.error?.message || errBody;
    } catch {
      // Оставляем как есть
    }
    throw new Error(`HTTP ${response.status} (${shortMsg.slice(0, 100)})`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Пустой ответ модели');
  }

  return text;
}

async function callOpenAICompatibleAPI(
  endpointUrl,
  apiKey,
  model,
  systemText,
  userPromptText,
  imageInfo
) {
  const userContent = imageInfo
    ? [
        { type: 'text', text: userPromptText },
        {
          type: 'image_url',
          image_url: {
            url: `data:${imageInfo.mimeType};base64,${imageInfo.base64}`,
          },
        },
      ]
    : userPromptText;

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemText },
      { role: 'user', content: userContent },
    ],
    temperature: 0.4,
  };

  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`HTTP ${response.status} (${errBody.slice(0, 100)})`);
  }

  const data = await response.json();
  const text = (data?.choices?.[0]?.message?.content || '').trim();
  if (!text) {
    throw new Error('Пустой ответ модели');
  }

  return text;
}

async function optionalWebLookup(queryText) {
  try {
    const cleanQuery = queryText.split('\n')[0].slice(0, 80).trim();
    if (!cleanQuery) return '';

    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HardwareAnalyzerBot/1.0' },
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) return '';
    const json = await res.json();
    const abstract = (json.AbstractText || '').trim();
    return abstract ? abstract.slice(0, 500) : '';
  } catch {
    return '';
  }
}

// ==========================================
// СКАЧИВАНИЕ ФОТО И БЕЗОПАСНЫЙ BASE64
// ==========================================
async function downloadTelegramPhotoAsBase64(botToken, fileId) {
  const fileInfoRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  const fileInfo = await fileInfoRes.json();

  if (!fileInfo.ok || !fileInfo.result?.file_path) {
    throw new Error('Не удалось получить путь к фото от Telegram');
  }

  const filePath = fileInfo.result.file_path;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!fileRes.ok) {
    throw new Error(`Ошибка скачивания фото: HTTP ${fileRes.status}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const lowerPath = filePath.toLowerCase();
  const mimeType = lowerPath.endsWith('.png')
    ? 'image/png'
    : lowerPath.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';

  return { base64, mimeType };
}

// ==========================================
// АДМИН-КОМАНДЫ
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
      `🔍 Проведено проверок: <b>${allChecks}</b>\n` +
      `🤖 Основная модель: <code>${GEMINI_MODELS[0]}</code>`,
    { parse_mode: 'HTML' }
  );
}

// ==========================================
// РАБОТА С БАЗОЙ CLOUDFLARE D1
// ==========================================
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
