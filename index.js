import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import 'dotenv/config';

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🗄️ डेटाबेस (Memory)
const masterPassword = process.env.MASTER_PASSWORD || 'CP@2026';
const allowedUsers = new Set();
const userStates = {}; 
const tempQueue = {}; 
const myQuizzes = new Map(); 
const activeSessions = new Map(); 
const activeGroups = new Set(); 

let dailyPromoPost = "🌟 *Study with CP Rawat Sir!*\nसर्वश्रेष्ठ नोट्स व क्विज के लिए हमारे चैनल्स से जुड़ें:\n👉 https://t.me/gkandgs12";

// 🎯 प्रोमोशन माइलस्टोन्स (तीनों लिंक एक साथ)
const megaMilestones = [15, 30, 50, 70, 80, 100, 150, 200, 250, 300, 400, 500];

// 🎨 30 बदलती हुई आकर्षक पोस्ट्स (लिंक प्रिव्यू के लिए सीधे लिंक्स के साथ)
const promoPool = [
    "🌟 *CP Rawat Sir* के बेस्ट हस्तलिखित नोट्स के लिए मेन चैनल जॉइन करें: https://t.me/gkandgs12",
    "💬 अपने डाउट क्लियर करने के लिए हमारे डिस्कशन ग्रुप में आएं: https://t.me/gkandgs85",
    "🏆 *Quiz Club* में अपनी रैंक चेक करें: https://t.me/QuizClub15seconds",
    "🔥 सरकारी नौकरी की पक्की तैयारी, सी. पी. रावत सर के साथ! नोट्स यहाँ: https://t.me/gkandgs12",
    "⚡ 15 सेकंड का चैलेंज! क्या आप तैयार हैं? जॉइन करें: https://t.me/QuizClub15seconds",
    "📖 परीक्षा में 100% सफलता के लिए फ्री PDF डाउनलोड करें: https://t.me/gkandgs12",
    "🎯 सटीक और शानदार स्टडी मटेरियल के लिए यहाँ क्लिक करें: https://t.me/gkandgs12",
    "💡 ग्रुप स्टडी और डिस्कशन के लिए बेस्ट प्लेटफॉर्म: https://t.me/gkandgs85",
    "🚀 क्विज लीडरबोर्ड में टॉप करें और खुद को साबित करें: https://t.me/QuizClub15seconds",
    "🎉 सी. पी. रावत सर के टॉप MCQ सेट्स से प्रैक्टिस करें: https://t.me/QuizClub15seconds",
    "📚 सामान्य ज्ञान (GK) और विज्ञान (GS) के ब्रह्मास्त्र नोट्स: https://t.me/gkandgs12",
    "📝 अपनी तैयारी को जांचें, रोज़ाना नए क्विज के साथ: https://t.me/QuizClub15seconds",
    "👥 हजारों छात्रों के साथ ग्रुप प्रैक्टिस का हिस्सा बनें: https://t.me/gkandgs85",
    "✨ सटीक मार्गदर्शन और बेहतरीन कंटेंट: https://t.me/gkandgs12",
    "🧠 स्मार्ट तरीके से पढ़ें, रोज़ टेस्ट दें: https://t.me/QuizClub15seconds",
    "🎯 सिलेक्शन चाहिए तो सही कंटेंट पढ़ें। जुड़ें: https://t.me/gkandgs12",
    "💬 प्रैक्टिस मेक्स परफेक्ट! हमारे ग्रुप से जुड़ें: https://t.me/gkandgs85",
    "🏆 सबसे तेज़ जवाब दें और नंबर 1 बनें: https://t.me/QuizClub15seconds",
    "📚 बिना कोचिंग के घर बैठे तैयारी: https://t.me/gkandgs12",
    "🔥 सी. पी. रावत सर के स्पेशल मैराथन टेस्ट: https://t.me/QuizClub15seconds",
    "⚡ सुपर फास्ट रिवीजन के लिए क्विज खेलें: https://t.me/QuizClub15seconds",
    "📖 सब्जेक्ट वाइज नोट्स फ्री में प्राप्त करें: https://t.me/gkandgs12",
    "💡 अपने सवाल पूछें और तुरंत जवाब पाएं: https://t.me/gkandgs85",
    "🚀 सफलता का एकमात्र विकल्प - सही तैयारी: https://t.me/gkandgs12",
    "🎯 टाइम मैनेजमेंट सीखें लाइव क्विज से: https://t.me/QuizClub15seconds",
    "🎉 परीक्षा से पहले खुद को परखें: https://t.me/QuizClub15seconds",
    "📚 नए पैटर्न पर आधारित स्टडी मटेरियल: https://t.me/gkandgs12",
    "📝 दूसरों से आगे निकलें, डेली क्विज लगाकर: https://t.me/QuizClub15seconds",
    "👥 हमारा प्रैक्टिस ग्रुप आपकी सफलता की कुंजी है: https://t.me/gkandgs85",
    "✨ सी. पी. रावत सर के साथ जीत पक्की: https://t.me/gkandgs12"
];

// 🛡️ क्रैश-प्रूफ
process.on('uncaughtException', (err) => console.log('Error:', err.message));
process.on('unhandledRejection', (reason) => console.log('Promise Error:', reason));

// 🎛️ मुख्य मेनू
const mainMenu = Markup.keyboard([
  ['📝 Create New Quiz', '📊 My Quizzes'],
  ['📢 दैनिक पोस्ट सेट करें', '🛑 Lock System']
]).resize();

bot.start((ctx) => {
    const payload = ctx.startPayload;
    if (payload) {
        activeGroups.add(ctx.chat.id);
        return initGroupLobby(ctx, payload); // Deep link start
    }
    if (allowedUsers.has(ctx.from.id.toString())) {
        ctx.reply('👑 Welcome CP Rawat Sir!\nThe Ultimate Official Quiz Engine is ready. 👇', mainMenu);
    } else {
        ctx.reply('🔒 System Locked. Enter Master Password:');
    }
});

bot.command('stop', (ctx) => {
    if (activeSessions.has(ctx.chat.id)) finishQuiz(ctx.chat.id, true);
});

// ==========================================
// 📂 My Quizzes & View Quiz System (Pagination)
// ==========================================
bot.hears(/view_(.+)/, (ctx) => {
    if (!allowedUsers.has(ctx.from.id.toString())) return;
    const quizId = ctx.match[1];
    showAdminDashboard(ctx, quizId);
});

bot.hears('📊 My Quizzes', (ctx) => {
    if (!allowedUsers.has(ctx.from.id.toString())) return;
    sendQuizzesPage(ctx, ctx.from.id.toString(), 1);
});

bot.action(/page_(.+)/, (ctx) => {
    const page = parseInt(ctx.match[1]);
    sendQuizzesPage(ctx, ctx.from.id.toString(), page, true);
});

function sendQuizzesPage(ctx, userId, page, isEdit = false) {
    const quizzes = Array.from(myQuizzes.values()).filter(q => q.owner === userId).reverse();
    if (quizzes.length === 0) return ctx.reply('No quizzes found. Press "Create New Quiz".');
    
    const perPage = 5;
    const totalPages = Math.ceil(quizzes.length / perPage);
    const start = (page - 1) * perPage;
    const currentList = quizzes.slice(start, start + perPage);

    let text = `📂 **Your Quizzes (Page ${page}/${totalPages})**\n\n`;
    currentList.forEach((q, i) => {
        text += `**${start + i + 1}. ${q.title}**\n`;
        text += `🖊 ${q.questions.length} questions · ⏱ ${q.time} sec\n`;
        text += `/view_${q.id}\n\n`;
    });

    const buttons = [];
    if (page > 1) buttons.push(Markup.button.callback('« Prev', `page_${page - 1}`));
    if (page < totalPages) buttons.push(Markup.button.callback('Next »', `page_${page + 1}`));

    const markup = Markup.inlineKeyboard([buttons, [Markup.button.callback('Create New Quiz', 'create_quiz')]]);
    
    if (isEdit) ctx.editMessageText(text, { parse_mode: 'Markdown', ...markup });
    else ctx.reply(text, { parse_mode: 'Markdown', ...markup });
}

// ==========================================
// 📝 Creation Flow (Title -> Desc -> Questions -> Timer -> Shuffle)
// ==========================================
bot.hears('📝 Create New Quiz', (ctx) => initQuizCreation(ctx));
bot.action('create_quiz', (ctx) => initQuizCreation(ctx));

function initQuizCreation(ctx) {
    const userId = ctx.from.id.toString();
    userStates[userId] = 'AWAITING_TITLE';
    tempQueue[userId] = { owner: userId, title: '', description: '', questions: [] };
    ctx.reply('Let\'s create a new quiz. First, send me the **Title** of your quiz:');
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

    // State Machine
    if (userStates[userId] === 'AWAITING_TITLE') {
        tempQueue[userId].title = text;
        userStates[userId] = 'AWAITING_DESC';
        return ctx.reply('Good. Now, send me a **Description** (or type "skip"):');
    }
    
    if (userStates[userId] === 'AWAITING_DESC') {
        tempQueue[userId].description = text.toLowerCase() === 'skip' ? '' : text;
        userStates[userId] = 'AWAITING_Q';
        return ctx.reply(`Perfect! Now send your questions (with ✅ for correct answer).\n\nWhen you are done, click the button below.`,
            Markup.inlineKeyboard([[Markup.button.callback('✅ Finish / Done', `ask_timer_NEW`)]])
        );
    }

    if (userStates[userId] === 'AWAITING_Q' && text.includes('✅')) {
        return parseQuestions(ctx, text, tempQueue[userId], 'ask_timer_NEW');
    }

    if (userStates[userId] && userStates[userId].startsWith('EDIT_ADDQ_') && text.includes('✅')) {
        const quizId = userStates[userId].replace('EDIT_ADDQ_', '');
        return parseQuestions(ctx, text, myQuizzes.get(quizId), `back_to_admin_${quizId}`);
    }

    if (text === '📢 दैनिक पोस्ट सेट करें') {
        userStates[userId] = 'SET_DAILY_POST';
        return ctx.reply(`📢 वर्तमान ऑटो-पोस्ट:\n\n${dailyPromoPost}\n\nनया सेट करने के लिए टेक्स्ट भेजें:`);
    }
    if (userStates[userId] === 'SET_DAILY_POST') {
        dailyPromoPost = text;
        userStates[userId] = '';
        return ctx.reply('✅ दैनिक पोस्ट अपडेट हो गई!', mainMenu);
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
            
            // 🔄 Alternate Links in Hint
            if ((qIndex + 1) % 3 === 1) finalExp += `📚 Notes: https://t.me/gkandgs12`;
            else if ((qIndex + 1) % 3 === 2) finalExp += `💬 Practice: https://t.me/gkandgs85`;
            else finalExp += `🏆 Quiz: https://t.me/QuizClub15seconds`;

            targetObj.questions.push({ question, options, correctId, explanation: finalExp.substring(0, 195) });
            added++;
        }
    }
    ctx.reply(`📥 **${added} questions added!** (Total: ${targetObj.questions.length})`,
        Markup.inlineKeyboard([[Markup.button.callback(callbackData.includes('NEW') ? '✅ Finish Creating' : '✅ Back to Menu', callbackData)]])
    );
}

// ⏱️ Ask Timer
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
    const quizData = { 
        ...tempQueue[userId], id: quizId, 
        shufQ: (s === 'all' || s === 'q'), 
        shufO: (s === 'all' || s === 'a') 
    };
    
    myQuizzes.set(quizId, quizData);
    delete tempQueue[userId];
    userStates[userId] = '';

    showAdminDashboard(ctx, quizId, true);
});

// ==========================================
// 👑 Admin Dashboard (Official View)
// ==========================================
function showAdminDashboard(ctx, quizId, isEditMsg = false) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.reply('Quiz not found.');

    const shareUrl = `https://t.me/share/url?url=https://t.me/${ctx.botInfo.username}?start=${quizId}`;
    
    let text = `🏁 **The quiz '${quiz.title}' has been created!**\n\n`;
    text += `🖊 ${quiz.questions.length} questions · ⏱ ${quiz.time} sec\n`;
    text += `🔀 Shuffle: ${quiz.shufQ && quiz.shufO ? 'All' : quiz.shufQ ? 'Questions' : quiz.shufO ? 'Answers' : 'None'}\n\n`;
    text += `**External sharing link:**\nhttps://t.me/${ctx.botInfo.username}?start=${quizId}`;

    const kb = Markup.inlineKeyboard([
        [Markup.button.url('Start this quiz', `https://t.me/${ctx.botInfo.username}?start=${quizId}`)],
        [Markup.button.url('Start quiz in group', `https://t.me/${ctx.botInfo.username}?startgroup=${quizId}`)],
        [Markup.button.url('Share quiz', shareUrl)],
        [Markup.button.callback('Edit quiz', `editmenu_${quizId}`), Markup.button.callback('Quiz stats', `stats_${quizId}`)]
    ]);

    if (isEditMsg) ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb });
    else ctx.reply(text, { parse_mode: 'Markdown', ...kb });
}

// ✏️ Edit Menu
bot.action(/editmenu_(.+)/, (ctx) => {
    const quizId = ctx.match[1];
    ctx.editMessageText('✏️ **Edit Quiz**\nChoose what you want to edit:',
        Markup.inlineKeyboard([
            [Markup.button.callback('Edit Title', `edT_${quizId}`), Markup.button.callback('Edit Description', `edD_${quizId}`)],
            [Markup.button.callback('Add Questions', `edQ_${quizId}`), Markup.button.callback('« Back', `back_to_admin_${quizId}`)]
        ])
    );
});

bot.action(/back_to_admin_(.+)/, (ctx) => showAdminDashboard(ctx, ctx.match[1], true));
bot.action(/edQ_(.+)/, (ctx) => {
    userStates[ctx.from.id.toString()] = `EDIT_ADDQ_${ctx.match[1]}`;
    ctx.reply('📥 Send new questions to append to this quiz:');
});
bot.action(/stats_(.+)/, (ctx) => ctx.answerCbQuery('Stats feature coming soon!', { show_alert: true }));

// ==========================================
// 🤝 Public Lobby & Live Execution (Official Style)
// ==========================================
function initGroupLobby(ctx, quizId) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.reply('❌ Quiz unavailable.');
    const chatId = ctx.chat.id;
    
    let finalQuestions = [...quiz.questions];
    if (quiz.shufQ) finalQuestions.sort(() => Math.random() - 0.5);

    activeSessions.set(chatId, { quiz, questions: finalQuestions, players: new Set(), scores: {}, qIndex: 0, zeroCount: 0, pollId: null, timerObj: null, isPaused: false });
    
    const descText = quiz.description ? `\n${quiz.description}\n` : '';
    const text = `🏁 The quiz '${quiz.title}'${descText}\n\n🖊 ${finalQuestions.length} questions\n⏱ ${quiz.time} seconds per question\n\n🏁 The quiz will begin when at least 2 people are ready to play. Send /stop to stop it.`;
    
    ctx.reply(text, Markup.inlineKeyboard([[Markup.button.callback(`I am ready!`, `ready_${chatId}`)]]));
}

bot.action(/ready_(.+)/, async (ctx) => {
    const chatId = Number(ctx.match[1]);
    const session = activeSessions.get(chatId);
    if (!session) return;
    session.players.add(ctx.from.id);
    const count = session.players.size;
    
    if (count >= 2) {
        await ctx.editMessageText(`🏁 The quiz '${session.quiz.title}'\n\n${count} people ready...\nThe quiz will start in 3 seconds!`);
        setTimeout(() => sendNextQuestion(chatId), 3000);
    } else {
        ctx.editMessageText(`🏁 The quiz '${session.quiz.title}'\n\n${count} person is ready so far.\n\n🏁 The quiz will begin when at least 2 people are ready to play. Send /stop to stop it.`, 
            Markup.inlineKeyboard([[Markup.button.callback(`I am ready!`, `ready_${chatId}`)]])
        );
        ctx.answerCbQuery('You are ready!');
    }
});

async function sendNextQuestion(chatId) {
    const session = activeSessions.get(chatId);
    if (!session || session.isPaused) return;
    if (session.qIndex >= session.questions.length) return finishQuiz(chatId, false);

    // ⏸️ Auto-Pause
    if (session.zeroCount >= 2) {
        session.isPaused = true;
        if (session.timerObj) clearTimeout(session.timerObj);
        return bot.telegram.sendMessage(chatId, `The quiz '${session.quiz.title}' was paused because nobody was answering.`,
            Markup.inlineKeyboard([[Markup.button.callback('▶️ Resume', `resume_${chatId}`)]])
        );
    }

    // 🚀 Promo Injection
    if (session.qIndex > 0 && session.zeroCount === 0) {
        if (megaMilestones.includes(session.qIndex)) {
            const promoText = `🌟 **Study with CP Rawat Sir** 🌟\n\nसफलता सुनिश्चित करने के लिए हमारे सभी चैनल्स से जुड़ें:`;
            const promoButtons = Markup.inlineKeyboard([
                [Markup.button.url('📚 Notes Channel', 'https://t.me/gkandgs12')],
                [Markup.button.url('💬 Practice Group', 'https://t.me/gkandgs85')],
                [Markup.button.url('🏆 Quiz Club', 'https://t.me/QuizClub15seconds')]
            ]);
            await bot.telegram.sendMessage(chatId, promoText, promoButtons);
            await new Promise(resolve => setTimeout(resolve, 3000));
        } 
        else if (session.qIndex % 5 === 0) {
            const randomPromo = promoPool[Math.floor(Math.random() * promoPool.length)];
            await bot.telegram.sendMessage(chatId, randomPromo, { parse_mode: 'Markdown', link_preview_options: { is_disabled: false } });
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
        session.pollSendTime = Date.now(); // ⏱️ Time tracker
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
            const timeTaken = ((Date.now() - session.pollSendTime) / 1000).toFixed(1); // Calculate time
            
            if (!session.scores[ans.user.id]) session.scores[ans.user.id] = { name: ans.user.first_name, score: 0, time: 0 };
            
            session.scores[ans.user.id].score++;
            session.scores[ans.user.id].time += parseFloat(timeTaken);
        }
    });
});

// 🏆 Final Leaderboard (Time Included)
function finishQuiz(chatId, wasForced) {
    const session = activeSessions.get(chatId);
    if (!session) return;
    if (session.timerObj) clearTimeout(session.timerObj);
    
    // Sort by Score (Desc), then Time (Asc)
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
    
    const shareUrl = `https://t.me/share/url?url=https://t.me/${bot.botInfo.username}?start=${session.quiz.id}`;
    bot.telegram.sendMessage(chatId, leaderboard, Markup.inlineKeyboard([[Markup.button.url('Share quiz', shareUrl)]]));
    activeSessions.delete(chatId);
}

// 📢 Daily Broadcast
setInterval(() => {
    activeGroups.forEach(async (chatId) => {
        try { await bot.telegram.sendMessage(chatId, dailyPromoPost); } 
        catch (err) { activeGroups.delete(chatId); }
    });
}, 24 * 60 * 60 * 1000); 

const app = express();
app.get('/', (req, res) => res.send('CP Rawat Official Engine is Live!'));
app.listen(process.env.PORT || 3000);
bot.launch();
