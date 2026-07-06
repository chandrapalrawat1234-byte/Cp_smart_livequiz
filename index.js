import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import 'dotenv/config';

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🗄️ मेमोरी और डेटाबेस
const allowedUsers = new Set([process.env.MASTER_ID || '']); 
const masterPassword = process.env.MASTER_PASSWORD || 'CP@2026';
const userStates = {}; 
const tempQueue = {}; 
const myQuizzes = new Map(); 
const activeSessions = new Map(); 
const activeGroups = new Set(); 

// 📸 आपकी फोटो का URL
const CP_RAWAT_PHOTO_URL = 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'; 

const links = [
    { text: "📚 Join Notes Channel", url: "https://t.me/gkandgs12", desc: "📚 सी. पी. रावत सर के नोट्स के लिए यहाँ क्लिक करें" },
    { text: "💬 Join Practice Group", url: "https://t.me/gkandgs85", desc: "💬 अपने प्रश्न पूछने और डिस्कशन के लिए यहाँ क्लिक करें" },
    { text: "🏆 Join Quiz Club", url: "https://t.me/QuizClub15seconds", desc: "🏆 डेली लाइव क्विज और लीडरबोर्ड के लिए यहाँ क्लिक करें" }
];

const singlePromos = [
    "🌟 <b>सटीक नोट्स और बेहतरीन तैयारी के लिए!</b> 🌟\n━━━━━━━━━━━━━━━━━━━━\n🔥 <i>क्या आप अपनी तैयारी को लेकर गंभीर हैं?</i>\nसही दिशा और सटीक मार्गदर्शन ही सफलता की एकमात्र कुंजी है! हजारों छात्र पहले से ही हमारे साथ जुड़कर अपनी सरकारी नौकरी की पक्की तैयारी कर रहे हैं। बिना देर किए हमारे मुख्य चैनल से जुड़ें और पीडीएफ प्राप्त करें।",
    "🚀 <b>MISSION GOVT JOB 2026</b> 🚀\n━━━━━━━━━━━━━━━━━━━━\n📚 <i>परीक्षा का पैटर्न तेजी से बदल रहा है!</i> \nक्या आप अपडेटेड हैं? CP Rawat Sir के विशेष मार्गदर्शन में तैयार किए गए नए और महत्वपूर्ण प्रश्नों के साथ अपना लेवल चेक करें और खुद को परीक्षा के लिए 100% तैयार करें।",
    "🏆 <b>खुद को परखें, सबसे आगे बढ़ें!</b> 🏆\n━━━━━━━━━━━━━━━━━━━━\n⚡ <i>सिर्फ पढ़ने से काम नहीं चलेगा!</i>\nप्रैक्टिस और टाइम मैनेजमेंट सबसे ज्यादा जरूरी है! जो छात्र समय बचाना सीखते हैं, वही टॉप करते हैं। आज ही हमारे स्मार्ट प्रैक्टिस ग्रुप का हिस्सा बनें।"
];

const megaPromoDesc = [
    "🌟 <b>नोट्स और स्टडी मटेरियल का खजाना!</b> 🌟\n━━━━━━━━━━━━━━━━━━━━\nसभी महत्वपूर्ण विषयों के हस्तलिखित नोट्स और पीडीएफ के लिए हमारे मुख्य चैनल से जुड़ना न भूलें।\n\n👇 <b>सफलता सुनिश्चित करने के लिए हमारे सभी चैनल्स से जुड़ें:</b>",
    "💬 <b>डाउट्स क्लियर करें और प्रैक्टिस करें!</b> 💬\n━━━━━━━━━━━━━━━━━━━━\nसवालों में उलझ गए हैं? हमारे डिस्कशन ग्रुप में आएं और हज़ारों छात्रों के साथ मिलकर अपने डाउट्स सॉल्व करें।\n\n👇 <b>सफलता सुनिश्चित करने के लिए हमारे सभी चैनल्स से जुड़ें:</b>",
    "🏆 <b>डेली लाइव टेस्ट और लीडरबोर्ड!</b> 🏆\n━━━━━━━━━━━━━━━━━━━━\nअपनी स्पीड और एक्यूरेसी बढ़ाने के लिए हमारे क्विज क्लब में रोज़ाना टेस्ट दें और अपनी रैंक चेक करें।\n\n👇 <b>सफलता सुनिश्चित करने के लिए हमारे सभी चैनल्स से जुड़ें:</b>"
];

let dailyPromoPost = "🌟 <b>Study with CP Rawat Sir</b> 🌟\n\n🔥 <i>सरकारी नौकरी की पक्की तैयारी के लिए आज ही जुड़ें!</i>\n👇 <b>नीचे दिए गए लिंक्स से हमारे चैनल्स जॉइन करें:</b>";

process.on('uncaughtException', (err) => console.log('Error:', err.message));
process.on('unhandledRejection', (reason) => console.log('Promise Error:', reason));

const mainMenu = Markup.keyboard([
  ['📝 Create New Quiz', '📊 My Quizzes'],
  ['📢 दैनिक पोस्ट सेट करें']
]).resize();

bot.start((ctx) => {
    const payload = ctx.startPayload;
    if (payload) {
        activeGroups.add(ctx.chat.id);
        return initGroupLobby(ctx, payload);
    }
    ctx.reply('👑 Welcome to CP Rawat Sir\'s Official Quiz Engine. 👇', mainMenu);
});

// 🛑 STOP COMMAND (Changed to /stopquiz to avoid Official Bot Conflict)
bot.hears(/^\/stopquiz(?:@\w+)?$/i, async (ctx) => {
    const chatId = ctx.chat.id;
    if (!activeSessions.has(chatId)) return;
    
    if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        const member = await ctx.telegram.getChatMember(chatId, ctx.from.id);
        if (member.status === 'administrator' || member.status === 'creator' || allowedUsers.has(ctx.from.id.toString())) {
            finishQuiz(chatId, true);
        }
    } else {
        finishQuiz(chatId, true); 
    }
});

// ==========================================
// 📂 My Quizzes 
// ==========================================
bot.hears(/view_(.+)/, (ctx) => showAdminDashboard(ctx, ctx.match[1]));
bot.hears('📊 My Quizzes', (ctx) => sendQuizzesPage(ctx, ctx.from.id.toString(), 1));
bot.action(/page_(.+)/, (ctx) => sendQuizzesPage(ctx, ctx.from.id.toString(), parseInt(ctx.match[1]), true));

function sendQuizzesPage(ctx, userId, page, isEdit = false) {
    const quizzes = Array.from(myQuizzes.values()).filter(q => q.owner === userId).reverse();
    if (quizzes.length === 0) return ctx.reply('No quizzes found.');
    
    const perPage = 5;
    const totalPages = Math.ceil(quizzes.length / perPage);
    const start = (page - 1) * perPage;
    const currentList = quizzes.slice(start, start + perPage);

    let text = `📂 <b>Your Quizzes (Page ${page}/${totalPages})</b>\n\n`;
    currentList.forEach((q, i) => {
        text += `<b>${start + i + 1}. ${q.title}</b>\n🖊 ${q.questions.length} questions · ⏱ ${q.time} sec\n/view_${q.id}\n\n`;
    });

    const buttons = [];
    if (page > 1) buttons.push(Markup.button.callback('« Prev', `page_${page - 1}`));
    if (page < totalPages) buttons.push(Markup.button.callback('Next »', `page_${page + 1}`));

    const markup = Markup.inlineKeyboard([buttons, [Markup.button.callback('Create New Quiz', 'create_quiz')]]);
    if (isEdit) ctx.editMessageText(text, { parse_mode: 'HTML', ...markup });
    else ctx.reply(text, { parse_mode: 'HTML', ...markup });
}

// ==========================================
// 📝 Creation & Edit Flow 
// ==========================================
bot.hears('📝 Create New Quiz', (ctx) => initQuizCreation(ctx));
bot.action('create_quiz', (ctx) => initQuizCreation(ctx));

function initQuizCreation(ctx) {
    const userId = ctx.from.id.toString();
    if (!allowedUsers.has(userId)) return ctx.reply('🔒 Please enter the Master Password to access the bot:');
    
    userStates[userId] = 'AWAITING_TITLE';
    tempQueue[userId] = { owner: userId, title: '', description: '', questions: [], playCount: 0 };
    ctx.reply('📝 Send me the **Title** of your quiz:');
}

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    // 🔑 Master Key Access for Anyone
    if (text === masterPassword) {
        allowedUsers.add(userId);
        return ctx.reply('✅ Access Granted! You can now use the bot.', mainMenu);
    }

    if (!allowedUsers.has(userId)) return next();

    if (text === '📢 दैनिक पोस्ट सेट करें') {
        userStates[userId] = 'SET_DAILY_POST';
        return ctx.reply(`📢 <b>वर्तमान ऑटो-पोस्ट:</b>\n\n${dailyPromoPost}\n\n✏️ HTML फॉर्मेट में नया पोस्ट टेक्स्ट भेजें:`, {parse_mode: 'HTML'});
    }
    if (userStates[userId] === 'SET_DAILY_POST') {
        dailyPromoPost = text;
        userStates[userId] = '';
        return ctx.reply('✅ दैनिक पोस्ट अपडेट हो गई!', mainMenu);
    }

    if (userStates[userId] === 'AWAITING_TITLE') {
        tempQueue[userId].title = text;
        userStates[userId] = 'AWAITING_DESC';
        return ctx.reply('✅ Send me a **Description** (or type "skip"):');
    }
    if (userStates[userId] === 'AWAITING_DESC') {
        tempQueue[userId].description = text.toLowerCase() === 'skip' ? '' : text;
        userStates[userId] = 'AWAITING_Q';
        return ctx.reply(`🚀 Now send your questions (with ✅).\nClick Finish when done.`,
            Markup.inlineKeyboard([[Markup.button.callback('✅ Finish / Done', `ask_timer_NEW`)]])
        );
    }

    if (userStates[userId] === 'AWAITING_Q' && text.includes('✅')) {
        return parseQuestions(ctx, text, tempQueue[userId], 'ask_timer_NEW');
    }

    // ✏️ Edit Mode Updates (With Live Preview)
    if (userStates[userId] && userStates[userId].startsWith('EDIT_TITLE_')) {
        const quizId = userStates[userId].replace('EDIT_TITLE_', '');
        myQuizzes.get(quizId).title = text;
        userStates[userId] = '';
        ctx.reply('✅ Title Updated successfully!');
        return showAdminDashboard(ctx, quizId);
    }
    if (userStates[userId] && userStates[userId].startsWith('EDIT_DESC_')) {
        const quizId = userStates[userId].replace('EDIT_DESC_', '');
        myQuizzes.get(quizId).description = text;
        userStates[userId] = '';
        ctx.reply('✅ Description Updated successfully!');
        return showAdminDashboard(ctx, quizId);
    }
    if (userStates[userId] && userStates[userId].startsWith('EDIT_ADDQ_') && text.includes('✅')) {
        const quizId = userStates[userId].replace('EDIT_ADDQ_', '');
        return parseQuestions(ctx, text, myQuizzes.get(quizId), `reask_timer_${quizId}`); 
    }

    next();
});

function parseQuestions(ctx, text, targetObj, callbackData) {
    const rawQs = text.split(/(?=Q\.|Q\s|प्रश्न\s|प्र\.)/i);
    let added = 0;

    for (const rawQ of rawQs) {
        if (rawQ.trim().length < 10) continue;
        const lines = rawQ.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let question = lines[0].replace(/^(Q\.|Q\s|प्रश्न\s|प्र\.)/i, '').trim(); 
        let options = [], correctId = -1, explanation = "";

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].match(/^(व्याख्या:|explain:)/i)) {
                explanation = lines[i].replace(/^(व्याख्या:|explain:)/i, '').trim(); break;
            }
            if (lines[i].match(/^[A-D]\)|^[A-D]\.|^[1-4]\)|^[1-4]\./i)) {
                let opt = lines[i].replace(/^[A-D]\)|^[A-D]\.|^[1-4]\)|^[1-4]\./i, '').trim();
                if (opt.includes('✅')) { opt = opt.replace('✅', '').trim(); correctId = options.length; }
                options.push(opt);
            }
        }

        if (options.length >= 2 && correctId !== -1) {
            let qIndex = targetObj.questions.length;
            let finalExp = explanation ? `${explanation}\n\n` : "";
            
            if ((qIndex + 1) % 3 === 1) finalExp += `📚 Notes: ${links[0].url}`;
            else if ((qIndex + 1) % 3 === 2) finalExp += `💬 Practice: ${links[1].url}`;
            else finalExp += `🏆 Quiz: ${links[2].url}`;

            targetObj.questions.push({ question, options, correctId, explanation: finalExp.substring(0, 195) });
            added++;
        }
    }
    ctx.reply(`📥 **${added} questions added!** (Total: ${targetObj.questions.length})`,
        Markup.inlineKeyboard([[Markup.button.callback('✅ Next Step', callbackData)]])
    );
}

// ⏱️ Ask Timer & Shuffle
bot.action('ask_timer_NEW', (ctx) => {
    ctx.editMessageText('⏱ **How much time should users have to answer each question?**',
        Markup.inlineKeyboard([
            [Markup.button.callback('10 sec', 'setT_10_NEW'), Markup.button.callback('15 sec', 'setT_15_NEW')],
            [Markup.button.callback('30 sec', 'setT_30_NEW'), Markup.button.callback('1 min', 'setT_60_NEW')]
        ])
    );
});

bot.action(/reask_timer_(.+)/, (ctx) => {
    const quizId = ctx.match[1];
    ctx.editMessageText('⏱ **How much time should users have to answer each question?**',
        Markup.inlineKeyboard([
            [Markup.button.callback('10 sec', `setT_10_${quizId}`), Markup.button.callback('15 sec', `setT_15_${quizId}`)],
            [Markup.button.callback('30 sec', `setT_30_${quizId}`), Markup.button.callback('1 min', `setT_60_${quizId}`)]
        ])
    );
});

bot.action(/setT_(.+?)_(.+)/, (ctx) => {
    const t = parseInt(ctx.match[1]);
    const quizId = ctx.match[2]; 
    const userId = ctx.from.id.toString();

    if (quizId === 'NEW') {
        if(tempQueue[userId]) tempQueue[userId].time = t;
    } else {
        const quiz = myQuizzes.get(quizId);
        if(quiz) quiz.time = t;
    }
    
    ctx.editMessageText('🔀 **Shuffle questions and options?**',
        Markup.inlineKeyboard([
            [Markup.button.callback('No shuffle', `setS_none_${quizId}`), Markup.button.callback('Shuffle all', `setS_all_${quizId}`)],
            [Markup.button.callback('Shuffle questions', `setS_q_${quizId}`), Markup.button.callback('Shuffle answers', `setS_a_${quizId}`)]
        ])
    );
});

bot.action(/setS_(.+?)_(.+)/, (ctx) => {
    const s = ctx.match[1];
    const quizIdArg = ctx.match[2];
    const userId = ctx.from.id.toString();

    let finalQuizId;

    if (quizIdArg === 'NEW') {
        if(!tempQueue[userId]) return;
        finalQuizId = `CP_${Date.now()}`;
        myQuizzes.set(finalQuizId, { ...tempQueue[userId], id: finalQuizId, shufQ: (s === 'all' || s === 'q'), shufO: (s === 'all' || s === 'a') });
        delete tempQueue[userId];
    } else {
        finalQuizId = quizIdArg;
        const quiz = myQuizzes.get(finalQuizId);
        if(quiz) {
            quiz.shufQ = (s === 'all' || s === 'q');
            quiz.shufO = (s === 'all' || s === 'a');
        }
    }
    
    userStates[userId] = '';
    showAdminDashboard(ctx, finalQuizId, true);
});

// ==========================================
// 👑 Admin Dashboard (Live Preview)
// ==========================================
function showAdminDashboard(ctx, quizId, isEditMsg = false) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.reply('Quiz not found.');
    
    let text = `🏁 <b>The quiz '${quiz.title}' has been created/updated!</b>\n\n`;
    text += `🖊 ${quiz.questions.length} questions · ⏱ ${quiz.time} sec\n`;
    if(quiz.description) text += `\n<i>Description: ${quiz.description}</i>\n`;
    text += `\n<b>External sharing link:</b>\nhttps://t.me/${ctx.botInfo.username}?start=${quizId}`;

    const kb = Markup.inlineKeyboard([
        [Markup.button.url('Start this quiz', `https://t.me/${ctx.botInfo.username}?start=${quizId}`)],
        [Markup.button.url('Start quiz in group', `https://t.me/${ctx.botInfo.username}?startgroup=${quizId}`)],
        [Markup.button.switchToChat('Share quiz', quizId)], 
        [Markup.button.callback('Edit quiz', `editmenu_${quizId}`), Markup.button.callback('📊 Quiz Stats', `stats_${quizId}`)]
    ]);

    if (isEditMsg) ctx.editMessageText(text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...kb });
    else ctx.reply(text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...kb });
}

// 📊 Stats Button
bot.action(/stats_(.+)/, (ctx) => {
    const quiz = myQuizzes.get(ctx.match[1]);
    if(quiz) {
        ctx.answerCbQuery(`📊 Stats for ${quiz.title}:\n\nTotal Questions: ${quiz.questions.length}\nTimes Played: ${quiz.playCount || 0}`, { show_alert: true });
    } else {
        ctx.answerCbQuery('Quiz not found!', { show_alert: true });
    }
});

// 🎯 INLINE QUERY (Clickable Links Supported)
bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query;
    if (!query) return;
    const quiz = myQuizzes.get(query);
    if (!quiz) return;

    // HTML Parse Mode makes links clickable in the description
    const descText = quiz.description ? `\n<i>${quiz.description}</i>\n` : '';
    const text = `🏁 <b>The quiz '${quiz.title}'</b>${descText}\n🖊 ${quiz.questions.length} questions\n⏱ ${quiz.time} seconds per question`;

    const kb = Markup.inlineKeyboard([
        [Markup.button.url('Start this quiz', `https://t.me/${ctx.botInfo.username}?start=${quiz.id}`)],
        [Markup.button.url('Start quiz in group', `https://t.me/${ctx.botInfo.username}?startgroup=${quiz.id}`)],
        [Markup.button.switchToChat('Share quiz', quiz.id)]
    ]);

    await ctx.answerInlineQuery([{
        type: 'article',
        id: quiz.id,
        title: `Share Quiz: ${quiz.title}`,
        description: `${quiz.questions.length} questions, ${quiz.time} sec`,
        input_message_content: { message_text: text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
        reply_markup: kb.reply_markup
    }], { cache_time: 0 });
});

bot.action(/editmenu_(.+)/, (ctx) => {
    const quizId = ctx.match[1];
    ctx.editMessageText('✏️ **Edit Quiz**\nChoose what you want to edit:',
        Markup.inlineKeyboard([
            [Markup.button.callback('Edit Title', `edT_${quizId}`), Markup.button.callback('Edit Description', `edD_${quizId}`)],
            [Markup.button.callback('Add Questions', `edQ_${quizId}`), Markup.button.callback('« Back', `back_to_admin_${quizId}`)]
        ])
    );
});
bot.action(/edT_(.+)/, (ctx) => {
    userStates[ctx.from.id.toString()] = `EDIT_TITLE_${ctx.match[1]}`;
    ctx.reply('📝 नया टाइटल (Title) भेजें:');
});
bot.action(/edD_(.+)/, (ctx) => {
    userStates[ctx.from.id.toString()] = `EDIT_DESC_${ctx.match[1]}`;
    ctx.reply('📝 नया डिस्क्रिप्शन (Description) भेजें (आप इसमें Link भी डाल सकते हैं):');
});
bot.action(/edQ_(.+)/, (ctx) => {
    userStates[ctx.from.id.toString()] = `EDIT_ADDQ_${ctx.match[1]}`;
    ctx.reply('📥 नए प्रश्न भेजें (वे इसी क्विज के अंत में जुड़ जाएंगे):');
});

// ==========================================
// 🤝 Public Lobby & Live Execution
// ==========================================
function initGroupLobby(ctx, quizId) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.reply('❌ Quiz unavailable.');
    const chatId = ctx.chat.id;
    
    // 🛡️ Double Quiz Protection
    if (activeSessions.has(chatId)) {
        return ctx.reply('⚠️ कृपया प्रतीक्षा करें! इस ग्रुप में पहले से ही एक क्विज चल रहा है। पहले उसे खत्म होने दें या /stopquiz कमांड का उपयोग करें।');
    }

    quiz.playCount = (quiz.playCount || 0) + 1; // Update Stats
    
    let finalQuestions = [...quiz.questions];
    if (quiz.shufQ) finalQuestions.sort(() => Math.random() - 0.5);

    activeSessions.set(chatId, { quiz, questions: finalQuestions, players: new Set(), scores: {}, qIndex: 0, zeroCount: 0, pollId: null, timerObj: null, isPaused: false });
    
    const descText = quiz.description ? `\n<i>${quiz.description}</i>\n` : '';
    const text = `🏁 <b>The quiz '${quiz.title}'</b>${descText}\n🖊 ${finalQuestions.length} questions\n⏱ ${quiz.time} seconds per question\n\n🏁 The quiz will begin when at least 2 people are ready to play. Send /stopquiz to stop it.\n\nNobody is ready yet.`;
    
    ctx.reply(text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: [[Markup.button.callback(`I am ready!`, `ready_${chatId}`)]] } });
}

bot.action(/ready_(.+)/, async (ctx) => {
    const chatId = Number(ctx.match[1]);
    const session = activeSessions.get(chatId);
    if (!session) return;
    session.players.add(ctx.from.id);
    const count = session.players.size;
    
    const descText = session.quiz.description ? `\n<i>${session.quiz.description}</i>\n` : '';
    const baseText = `🏁 <b>The quiz '${session.quiz.title}'</b>${descText}\n🖊 ${session.questions.length} questions\n⏱ ${session.quiz.time} seconds per question\n\n🏁 The quiz will begin when at least 2 people are ready to play. Send /stopquiz to stop it.\n\n`;

    if (count >= 2) {
        await ctx.editMessageText(`${baseText}${count} people ready...\n<b>The quiz will start in 10 seconds!</b>`, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
        
        const prepMsg = await ctx.telegram.sendPhoto(chatId, CP_RAWAT_PHOTO_URL, {
            caption: "🌟 <b>चलिए, क्विज शुरू करते हैं!</b> 🌟\n\n🎯 <i>सभी छात्र अपना सर्वश्रेष्ठ प्रदर्शन करें। आपकी मेहनत ही आपकी असली पहचान है!</i> 📚🏆\n\n👍 <b>All the Best! - CP Rawat Sir</b>",
            parse_mode: 'HTML'
        });

        setTimeout(async () => {
            try { await ctx.telegram.deleteMessage(chatId, prepMsg.message_id); } catch(e){}
            sendNextQuestion(chatId);
        }, 10000); 
    } else {
        ctx.editMessageText(`${baseText}${count} person is ready so far.`, {
            parse_mode: 'HTML', link_preview_options: { is_disabled: true },
            reply_markup: { inline_keyboard: [[Markup.button.callback(`I am ready!`, `ready_${chatId}`)]] }
        });
        ctx.answerCbQuery('You are ready!');
    }
});

async function sendNextQuestion(chatId) {
    const session = activeSessions.get(chatId);
    if (!session || session.isPaused) return;
    if (session.qIndex >= session.questions.length) return finishQuiz(chatId, false);

    if (session.zeroCount >= 2) {
        session.isPaused = true;
        if (session.timerObj) clearTimeout(session.timerObj);
        return bot.telegram.sendMessage(chatId, `The quiz '${session.quiz.title}' was paused because nobody was answering.`,
            Markup.inlineKeyboard([[Markup.button.callback('▶️ Resume', `resume_${chatId}`)]])
        );
    }

    if (session.qIndex > 0 && session.zeroCount === 0) {
        if (session.qIndex % 15 === 0) {
            const linkIndex = ((session.qIndex / 15) - 1) % 3; 
            const promoText = megaPromoDesc[linkIndex];
            const promoButtons = Markup.inlineKeyboard([
                [Markup.button.url(links[0].text, links[0].url)],
                [Markup.button.url(links[1].text, links[1].url)],
                [Markup.button.url(links[2].text, links[2].url)]
            ]);
            await bot.telegram.sendMessage(chatId, promoText, { parse_mode: 'HTML', link_preview_options: { is_disabled: false }, ...promoButtons });
            await new Promise(resolve => setTimeout(resolve, 3000));
        } 
        else if (session.qIndex % 5 === 0) {
            const randomPromo = singlePromos[((session.qIndex / 5) - 1) % singlePromos.length];
            const linkObj = links[((session.qIndex / 5) - 1) % 3]; 
            
            const btn = Markup.inlineKeyboard([[Markup.button.url(linkObj.text, linkObj.url)]]);
            await bot.telegram.sendMessage(chatId, `${randomPromo}\n\n👉 <a href="${linkObj.url}">${linkObj.text}</a>`, { parse_mode: 'HTML', link_preview_options: { is_disabled: false }, ...btn });
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    let q = session.questions[session.qIndex];
    let qText = `[${session.qIndex + 1}/${session.questions.length}] ${q.question}`;
    
    let finalOptions = [...q.options];
    let finalCorrectId = q.correctId;
    if (session.quiz.shufO) {
        let correctText = finalOptions[finalCorrectId];
        finalOptions.sort(() => Math.random() - 0.5);
        finalCorrectId = finalOptions.indexOf(correctText);
    }

    try {
        const poll = await bot.telegram.sendQuiz(chatId, qText, finalOptions, {
            correct_option_id: finalCorrectId, explanation: q.explanation, is_anonymous: false, open_period: session.quiz.time
        });
        session.pollId = poll.poll.id;
        session.pollSendTime = Date.now(); 
        session.currentVotes = 0;
    } catch (e) { 
        const poll = await bot.telegram.sendQuiz(chatId, qText, finalOptions, {
            correct_option_id: finalCorrectId, explanation: q.explanation, is_anonymous: true, open_period: session.quiz.time
        });
        session.pollId = poll.poll.id;
        session.pollSendTime = Date.now();
        session.currentVotes = 0;
    }

    session.timerObj = setTimeout(() => {
        if (session.currentVotes === 0) session.zeroCount++; else session.zeroCount = 0;
        session.qIndex++; 
        sendNextQuestion(chatId);
    }, (session.quiz.time + 1) * 1000); 
}

bot.action(/resume_(.+)/, (ctx) => {
    const chatId = Number(ctx.match[1]);
    const session = activeSessions.get(chatId);
    if (!session) return ctx.answerCbQuery('❌ No active session!');
    session.isPaused = false;
    session.zeroCount = 0;
    ctx.editMessageText('▶️ Resuming...');
    setTimeout(() => sendNextQuestion(chatId), 2000);
    ctx.answerCbQuery();
});

bot.on('poll_answer', (ctx) => {
    const ans = ctx.pollAnswer;
    activeSessions.forEach((session) => {
        if (session.pollId === ans.poll_id) {
            session.currentVotes++;
            const timeTaken = ((Date.now() - session.pollSendTime) / 1000).toFixed(1); 
            if (!session.scores[ans.user.id]) session.scores[ans.user.id] = { name: ans.user.first_name, score: 0, time: 0 };
            session.scores[ans.user.id].score++;
            session.scores[ans.user.id].time += parseFloat(timeTaken);
        }
    });
});

// 🏆 Official Result Format
function finishQuiz(chatId, wasForced) {
    const session = activeSessions.get(chatId);
    if (!session) return;
    if (session.timerObj) clearTimeout(session.timerObj);
    
    let results = Object.values(session.scores).sort((a, b) => b.score === a.score ? a.time - b.time : b.score - a.score).slice(0, 50);
    
    let leaderboard = wasForced ? `🛑 <b>The quiz was stopped!</b>\n\n` : `🏁 <b>The quiz '${session.quiz.title}' has finished!</b>\n\n`;
    leaderboard += `<i>${session.qIndex} questions answered</i>\n\n`;
    
    if (results.length === 0) {
        leaderboard += "Nobody answered correctly.\n";
    } else {
        results.forEach((r, i) => { 
            let rank;
            if (i === 0) rank = '🥇';
            else if (i === 1) rank = '🥈';
            else if (i === 2) rank = '🥉';
            else rank = `${i+1}.`;
            leaderboard += `${rank} ${r.name} – <b>${r.score}</b> (${r.time.toFixed(1)} sec)\n`; 
        });
        leaderboard += `\n🏆 Congratulations to the winners!`;
    }
    bot.telegram.sendMessage(chatId, leaderboard, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.switchToChat('Share quiz', session.quiz.id)]]) });

    // 🌟 सुपर आकर्षक रिजल्ट मैसेज
    const top1 = results.length > 0 ? results[0] : null;
    const top2 = results.length > 1 ? results[1] : null;
    const top3 = results.length > 2 ? results[2] : null;

    let thankYouMsg = `🎉 <b>बहुत-बहुत बधाई एवं शुभकामनाएँ!</b> 🎉\n━━━━━━━━━━━━━━━━━━━━\n\nप्रिय विद्यार्थियों, आप सभी ने इस मैराथन टेस्ट में शानदार प्रदर्शन किया। 🌟\n\n`;
    
    if (top1) thankYouMsg += `🥇 <b>आपको फर्स्ट आने पर बहुत-बहुत बधाई:</b> ${top1.name} (Score: ${top1.score}/${session.questions.length})\n`;
    if (top2) thankYouMsg += `🥈 <b>द्वितीय स्थान प्राप्त करने पर बधाई:</b> ${top2.name} (Score: ${top2.score}/${session.questions.length})\n`;
    if (top3) thankYouMsg += `🥉 <b>तृतीय स्थान प्राप्त करने पर बधाई:</b> ${top3.name} (Score: ${top3.score}/${session.questions.length})\n\n`;
    
    thankYouMsg += `यह सफलता आपकी कड़ी मेहनत का परिणाम है! 📚 जो छात्र टॉप नहीं कर पाए, वे बिल्कुल भी निराश न हों। निरंतर अभ्यास और लगन से आप भी सफलता के शिखर तक पहुँच सकते हैं। <b>CP Rawat Sir</b> हमेशा आपके उज्ज्वल भविष्य की कामना करते हैं! 🎯\n\n👇 <b>निरंतर बेहतरीन तैयारी के लिए हमारे चैनल्स से जुड़े रहें:</b>`;
    
    const thankYouBtns = Markup.inlineKeyboard([
        [Markup.button.url(links[0].text, links[0].url)],
        [Markup.button.url(links[1].text, links[1].url)],
        [Markup.button.url(links[2].text, links[2].url)]
    ]);

    setTimeout(() => {
        bot.telegram.sendPhoto(chatId, CP_RAWAT_PHOTO_URL, {
            caption: thankYouMsg,
            parse_mode: 'HTML',
            ...thankYouBtns
        });
    }, 2000);

    activeSessions.delete(chatId);
}

// 📢 दैनिक HTML ब्रॉडकास्ट
setInterval(() => {
    activeGroups.forEach(async (chatId) => {
        const btns = Markup.inlineKeyboard([
            [Markup.button.url(links[0].text, links[0].url)],
            [Markup.button.url(links[1].text, links[1].url), Markup.button.url(links[2].text, links[2].url)]
        ]);
        try { await bot.telegram.sendMessage(chatId, dailyPromoPost, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...btns }); } 
        catch (err) { activeGroups.delete(chatId); }
    });
}, 12 * 60 * 60 * 1000); 

const app = express();
app.get('/', (req, res) => res.send('CP Rawat Official Engine is Live!'));
app.listen(process.env.PORT || 3000);
bot.launch();
