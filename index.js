import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import 'dotenv/config';

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🗄️ डेटाबेस
const masterPassword = process.env.MASTER_PASSWORD || 'CP@2026';
const allowedUsers = new Set();
const userStates = {}; 
const tempQueue = {}; 
const myQuizzes = new Map(); 
const activeSessions = new Map(); 

// 🎯 प्रोमो लिंक्स का क्रम
const promoLinks = [
    "📚 **स्टडी मटेरियल व नोट्स के लिए:**\n👉 https://t.me/gkandgs12",
    "💬 **डाउट क्लियरिंग व डिस्कशन के लिए:**\n👉 https://t.me/gkandgs85",
    "🏆 **डेली लाइव टेस्ट व रैंक के लिए:**\n👉 https://t.me/QuizClub15seconds"
];

// 🎨 आकर्षक प्रोमो पोस्ट्स (लंबे और इमोजी से भरे)
const attractivePromos = [
    "🌟 **Study with CP Rawat Sir** 🌟\n━━━━━━━━━━━━━━━━━━━━\n🔥 क्या आप अपनी तैयारी को लेकर गंभीर हैं? सही दिशा और सटीक मार्गदर्शन ही सफलता की एकमात्र कुंजी है! हजारों छात्र पहले से ही हमारे साथ जुड़कर अपनी सरकारी नौकरी की पक्की तैयारी कर रहे हैं। पीछे न रहें!",
    "🚀 **MISSION GOVT JOB 2026** 🚀\n━━━━━━━━━━━━━━━━━━━━\n📚 परीक्षा का पैटर्न बदल रहा है! क्या आप अपडेटेड हैं? सी. पी. रावत सर के विशेष मार्गदर्शन में तैयार किए गए नए और महत्वपूर्ण प्रश्नों के साथ अपना लेवल चेक करें और खुद को परीक्षा के लिए 100% तैयार करें।",
    "🏆 **खुद को परखें, आगे बढ़ें!** 🏆\n━━━━━━━━━━━━━━━━━━━━\n⚡ सिर्फ पढ़ने से काम नहीं चलेगा, प्रैक्टिस सबसे ज्यादा जरूरी है! जो छात्र समय प्रबंधन (Time Management) सीखते हैं, वही टॉप करते हैं। आज ही हमारे स्मार्ट स्टडी हब का हिस्सा बनें और अपनी स्पीड बढ़ाएं।",
    "🧠 **आपकी सफलता, हमारा लक्ष्य** 🧠\n━━━━━━━━━━━━━━━━━━━━\n📖 कठिन टॉपिक्स को आसान भाषा में समझें और बिना कोचिंग के घर बैठे टॉप-लेवल की तैयारी करें। सी. पी. रावत सर का अनुभव और आपका समर्पण मिलकर जरूर इतिहास रचेंगे!",
    "✨ **स्मार्ट स्टडी का नया तरीका!** ✨\n━━━━━━━━━━━━━━━━━━━━\n🎯 इधर-उधर भटकना बंद करें! आपको सफलता के लिए जो कुछ भी चाहिए (PDF, प्रैक्टिस, लाइव टेस्ट), वह सब कुछ हमने एक ही जगह पर उपलब्ध करा दिया है। अभी जुड़ें और अपनी तैयारी को रफ्तार दें!"
];

process.on('uncaughtException', (err) => console.log('Error:', err.message));
process.on('unhandledRejection', (reason) => console.log('Promise Error:', reason));

const mainMenu = Markup.keyboard([
  ['📝 Create New Quiz', '📊 My Quizzes'],
  ['🛑 Lock System']
]).resize();

bot.start((ctx) => {
    const payload = ctx.startPayload;
    if (payload) return initGroupLobby(ctx, payload);
    
    if (allowedUsers.has(ctx.from.id.toString())) {
        ctx.reply('👑 Welcome CP Rawat Sir!\nThe Ultimate Official Quiz Engine is ready.', mainMenu);
    } else {
        ctx.reply('🔒 System Locked. Enter Master Password:');
    }
});

// 🛑 Stop Command (Fixed for groups)
bot.command(['stop', 'stopquiz'], async (ctx) => {
    const chatId = ctx.chat.id;
    if (!activeSessions.has(chatId)) return;
    
    // Check if user is admin
    const member = await ctx.telegram.getChatMember(chatId, ctx.from.id);
    if (member.status === 'administrator' || member.status === 'creator' || allowedUsers.has(ctx.from.id.toString())) {
        finishQuiz(chatId, true);
    }
});

// ==========================================
// 📂 My Quizzes & View Quiz System
// ==========================================
bot.hears(/view_(.+)/, (ctx) => {
    if (!allowedUsers.has(ctx.from.id.toString())) return;
    showAdminDashboard(ctx, ctx.match[1]);
});

bot.hears('📊 My Quizzes', (ctx) => {
    if (!allowedUsers.has(ctx.from.id.toString())) return;
    sendQuizzesPage(ctx, ctx.from.id.toString(), 1);
});

bot.action(/page_(.+)/, (ctx) => {
    sendQuizzesPage(ctx, ctx.from.id.toString(), parseInt(ctx.match[1]), true);
});

function sendQuizzesPage(ctx, userId, page, isEdit = false) {
    const quizzes = Array.from(myQuizzes.values()).filter(q => q.owner === userId).reverse();
    if (quizzes.length === 0) return ctx.reply('No quizzes found.');
    
    const perPage = 5;
    const totalPages = Math.ceil(quizzes.length / perPage);
    const start = (page - 1) * perPage;
    const currentList = quizzes.slice(start, start + perPage);

    let text = `📂 **Your Quizzes (Page ${page}/${totalPages})**\n\n`;
    currentList.forEach((q, i) => {
        text += `**${start + i + 1}. ${q.title}**\n🖊 ${q.questions.length} questions · ⏱ ${q.time} sec\n/view_${q.id}\n\n`;
    });

    const buttons = [];
    if (page > 1) buttons.push(Markup.button.callback('« Prev', `page_${page - 1}`));
    if (page < totalPages) buttons.push(Markup.button.callback('Next »', `page_${page + 1}`));

    const markup = Markup.inlineKeyboard([buttons, [Markup.button.callback('Create New Quiz', 'create_quiz')]]);
    if (isEdit) ctx.editMessageText(text, { parse_mode: 'Markdown', ...markup });
    else ctx.reply(text, { parse_mode: 'Markdown', ...markup });
}

// ==========================================
// 📝 Creation & Edit Flow 
// ==========================================
bot.hears('📝 Create New Quiz', (ctx) => initQuizCreation(ctx));
bot.action('create_quiz', (ctx) => initQuizCreation(ctx));

function initQuizCreation(ctx) {
    const userId = ctx.from.id.toString();
    userStates[userId] = 'AWAITING_TITLE';
    tempQueue[userId] = { owner: userId, title: '', description: '', questions: [] };
    ctx.reply('📝 Send me the **Title** of your quiz:');
}

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    if (text === masterPassword) {
        allowedUsers.add(userId);
        return ctx.reply('✅ Access Granted!', mainMenu);
    }
    if (!allowedUsers.has(userId)) return next();
    if (text === '🛑 Lock System') { allowedUsers.delete(userId); return ctx.reply('Locked.'); }

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

    // 🔧 FIX: Edit/Add Questions Logic
    if (userStates[userId] && userStates[userId].startsWith('EDIT_ADDQ_') && text.includes('✅')) {
        const quizId = userStates[userId].replace('EDIT_ADDQ_', '');
        const targetQuiz = myQuizzes.get(quizId);
        if(targetQuiz) {
            parseQuestions(ctx, text, targetQuiz, `back_to_admin_${quizId}`);
        } else {
            ctx.reply('❌ Quiz not found in memory.');
        }
        return;
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
            targetObj.questions.push({ question, options, correctId, explanation: explanation });
            added++;
        }
    }
    ctx.reply(`📥 **${added} questions added!** (Total: ${targetObj.questions.length})`,
        Markup.inlineKeyboard([[Markup.button.callback('✅ Finish / Done', callbackData)]])
    );
}

bot.action('ask_timer_NEW', (ctx) => {
    ctx.editMessageText('⏱ **How much time should users have to answer each question?**',
        Markup.inlineKeyboard([
            [Markup.button.callback('10 sec', 'setT_10'), Markup.button.callback('15 sec', 'setT_15')],
            [Markup.button.callback('30 sec', 'setT_30'), Markup.button.callback('1 min', 'setT_60')]
        ])
    );
});

bot.action(/setT_(.+)/, (ctx) => {
    const t = parseInt(ctx.match[1]);
    const userId = ctx.from.id.toString();
    if(tempQueue[userId]) tempQueue[userId].time = t;
    
    ctx.editMessageText('🔀 **Shuffle questions and options?**',
        Markup.inlineKeyboard([
            [Markup.button.callback('No shuffle', 'setS_none'), Markup.button.callback('Shuffle all', 'setS_all')],
            [Markup.button.callback('Shuffle questions', 'setS_q'), Markup.button.callback('Shuffle answers', 'setS_a')]
        ])
    );
});

bot.action(/setS_(.+)/, (ctx) => {
    const s = ctx.match[1];
    const userId = ctx.from.id.toString();
    if(!tempQueue[userId]) return;

    const quizId = `CP_${Date.now()}`;
    myQuizzes.set(quizId, { ...tempQueue[userId], id: quizId, shufQ: (s === 'all' || s === 'q'), shufO: (s === 'all' || s === 'a') });
    delete tempQueue[userId];
    userStates[userId] = '';

    showAdminDashboard(ctx, quizId, true);
});

// ==========================================
// 👑 Admin Dashboard & INLINE SHARE MAGIC
// ==========================================
function showAdminDashboard(ctx, quizId, isEditMsg = false) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.reply('Quiz not found.');
    
    let text = `🏁 **The quiz '${quiz.title}' has been created!**\n\n`;
    text += `🖊 ${quiz.questions.length} questions · ⏱ ${quiz.time} sec\n\n`;
    text += `**External sharing link:**\nhttps://t.me/${ctx.botInfo.username}?start=${quizId}`;

    const kb = Markup.inlineKeyboard([
        [Markup.button.url('Start this quiz', `https://t.me/${ctx.botInfo.username}?start=${quizId}`)],
        [Markup.button.url('Start quiz in group', `https://t.me/${ctx.botInfo.username}?startgroup=${quizId}`)],
        [Markup.button.switchToChat('Share quiz', quizId)], // 🎯 OFFICIAL INLINE SHARE
        [Markup.button.callback('Edit quiz', `editmenu_${quizId}`), Markup.button.callback('Quiz stats', `stats_${quizId}`)]
    ]);

    if (isEditMsg) ctx.editMessageText(text, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true }, ...kb });
    else ctx.reply(text, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true }, ...kb });
}

// 🎯 INLINE QUERY ENGINE (For sharing 3 buttons directly to channels)
bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query;
    if (!query) return;
    const quiz = myQuizzes.get(query);
    if (!quiz) return;

    const descText = quiz.description ? `\n${quiz.description}\n` : '';
    const text = `🏁 The quiz '${quiz.title}'${descText}\n🖊 ${quiz.questions.length} questions\n⏱ ${quiz.time} seconds per question\n\n🏁 The quiz will begin when at least 2 people are ready to play. Send /stop to stop it.`;

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
        input_message_content: { message_text: text, link_preview_options: { is_disabled: true } },
        reply_markup: kb.reply_markup
    }], { cache_time: 0 });
});

bot.action(/editmenu_(.+)/, (ctx) => {
    const quizId = ctx.match[1];
    ctx.editMessageText('✏️ **Edit Quiz**',
        Markup.inlineKeyboard([[Markup.button.callback('Add Questions', `edQ_${quizId}`), Markup.button.callback('« Back', `back_to_admin_${quizId}`)]])
    );
});
bot.action(/back_to_admin_(.+)/, (ctx) => showAdminDashboard(ctx, ctx.match[1], true));
bot.action(/edQ_(.+)/, (ctx) => {
    userStates[ctx.from.id.toString()] = `EDIT_ADDQ_${ctx.match[1]}`;
    ctx.reply('📥 Send new questions to append:');
});
bot.action(/stats_(.+)/, (ctx) => ctx.answerCbQuery('Feature coming soon!', { show_alert: true }));

// ==========================================
// 🤝 Public Lobby & Live Execution
// ==========================================
function initGroupLobby(ctx, quizId) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.reply('❌ Quiz unavailable.');
    const chatId = ctx.chat.id;
    
    let finalQuestions = [...quiz.questions];
    if (quiz.shufQ) finalQuestions.sort(() => Math.random() - 0.5);

    activeSessions.set(chatId, { quiz, questions: finalQuestions, players: new Set(), scores: {}, qIndex: 0, zeroCount: 0, pollId: null, timerObj: null, isPaused: false });
    
    const descText = quiz.description ? `\n${quiz.description}\n` : '';
    // 🔧 FIX: Disable link preview in lobby
    const text = `🏁 The quiz '${quiz.title}'${descText}\n🖊 ${finalQuestions.length} questions\n⏱ ${quiz.time} seconds per question\n\n🏁 The quiz will begin when at least 2 people are ready to play. Send /stop to stop it.\n\nNobody is ready yet.`;
    
    ctx.reply(text, { link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: [[Markup.button.callback(`I am ready!`, `ready_${chatId}`)]] } });
}

bot.action(/ready_(.+)/, async (ctx) => {
    const chatId = Number(ctx.match[1]);
    const session = activeSessions.get(chatId);
    if (!session) return;
    session.players.add(ctx.from.id);
    const count = session.players.size;
    
    // 🔧 FIX: Maintain original text while updating ready count
    const descText = session.quiz.description ? `\n${session.quiz.description}\n` : '';
    const baseText = `🏁 The quiz '${session.quiz.title}'${descText}\n🖊 ${session.questions.length} questions\n⏱ ${session.quiz.time} seconds per question\n\n🏁 The quiz will begin when at least 2 people are ready to play. Send /stop to stop it.\n\n`;

    if (count >= 2) {
        await ctx.editMessageText(`${baseText}${count} people ready...\nThe quiz will start in 3 seconds!`, { link_preview_options: { is_disabled: true } });
        setTimeout(() => sendNextQuestion(chatId), 3000);
    } else {
        ctx.editMessageText(`${baseText}${count} person is ready so far.`, {
            link_preview_options: { is_disabled: true },
            reply_markup: { inline_keyboard: [[Markup.button.callback(`I am ready!`, `ready_${chatId}`)]] }
        });
        ctx.answerCbQuery('You are ready!');
    }
});

async function sendNextQuestion(chatId) {
    const session = activeSessions.get(chatId);
    if (!session || session.isPaused) return;
    if (session.qIndex >= session.questions.length) return finishQuiz(chatId, false);

    // ⏸️ Auto-Pause Official Text
    if (session.zeroCount >= 2) {
        session.isPaused = true;
        if (session.timerObj) clearTimeout(session.timerObj);
        return bot.telegram.sendMessage(chatId, `The quiz '${session.quiz.title}' was paused because nobody was answering.`,
            Markup.inlineKeyboard([[Markup.button.callback('▶️ Resume', `resume_${chatId}`)]])
        );
    }

    // 🚀 Strict Rotation Promo Engine (Fixed Logic)
    if (session.qIndex > 0 && session.zeroCount === 0) {
        if (session.qIndex % 5 === 0) {
            // Pick attractive text based on qIndex for variety
            const promoText = attractivePromos[(session.qIndex / 5) % attractivePromos.length];
            // STRICT 1-2-3 Link Rotation
            const linkIndex = ((session.qIndex / 5) - 1) % 3; 
            const finalPromo = `${promoText}\n\n${promoLinks[linkIndex]}`;
            
            await bot.telegram.sendMessage(chatId, finalPromo, { link_preview_options: { is_disabled: true } });
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

function finishQuiz(chatId, wasForced) {
    const session = activeSessions.get(chatId);
    if (!session) return;
    if (session.timerObj) clearTimeout(session.timerObj);
    
    let results = Object.values(session.scores).sort((a, b) => b.score === a.score ? a.time - b.time : b.score - a.score).slice(0, 50);
    
    let leaderboard = wasForced ? `🛑 The quiz was stopped!\n\n` : `🏁 The quiz '${session.quiz.title}' has finished!\n\n`;
    leaderboard += `${session.qIndex} questions answered\n\n`;

    if (results.length === 0) leaderboard += "Nobody answered correctly.\n";
    else {
        const medals = ['🥇', '🥈', '🥉'];
        results.forEach((r, i) => { 
            let rank = i < 3 ? medals[i] : `🎗 ${i+1}.`;
            leaderboard += `${rank} ${r.name} – ${r.score} (${r.time.toFixed(1)} sec)\n`; 
        });
        leaderboard += `\n🏆 Congratulations to the winners!`;
    }
    
    bot.telegram.sendMessage(chatId, leaderboard, Markup.inlineKeyboard([[Markup.button.switchToChat('Share quiz', session.quiz.id)]]));
    activeSessions.delete(chatId);
}

const app = express();
app.get('/', (req, res) => res.send('CP Rawat Official Engine is Live!'));
app.listen(process.env.PORT || 3000);
bot.launch();
