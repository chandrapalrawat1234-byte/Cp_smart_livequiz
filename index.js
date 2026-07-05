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
const activeGroups = new Set(); 

let dailyPromoPost = "🌟 Study with CP Rawat Sir!\nसर्वश्रेष्ठ नोट्स व क्विज के लिए हमारे चैनल्स से जुड़ें।";

// 🎯 मेगा माइलस्टोन्स (तीनों लिंक एक साथ बटन के रूप में)
const megaMilestones = [15, 30, 50, 70, 80, 100, 120, 150, 180, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000];

// 🎨 30 बदलती हुई आकर्षक पोस्ट्स (लिंक हटा दी गई है, अब लिंक ऑटोमैटिक अल्टरनेट आएगी)
const promoPool = [
    "🌟 *CP Rawat Sir* के बेस्ट हस्तलिखित नोट्स के लिए जुड़ें:",
    "💬 अपने डाउट क्लियर करने के लिए हमारे डिस्कशन ग्रुप में आएं:",
    "🏆 *Quiz Club* में अपनी रैंक चेक करें:",
    "🔥 सरकारी नौकरी की पक्की तैयारी, सी. पी. रावत सर के साथ!",
    "⚡ 15 सेकंड का चैलेंज! क्या आप तैयार हैं?",
    "📖 परीक्षा में 100% सफलता के लिए फ्री PDF डाउनलोड करें:",
    "🎯 MP TET और अन्य परीक्षाओं का अचूक मटेरियल:",
    "💡 ग्रुप स्टडी और डिस्कशन के लिए बेस्ट प्लेटफॉर्म:",
    "🚀 क्विज लीडरबोर्ड में टॉप करें और खुद को साबित करें:",
    "🎉 सी. पी. रावत सर के टॉप MCQ सेट्स से प्रैक्टिस करें:",
    "📚 सामान्य ज्ञान (GK) और विज्ञान (GS) के ब्रह्मास्त्र नोट्स:",
    "📝 अपनी तैयारी को जांचें, रोज़ाना नए क्विज के साथ:",
    "👥 हजारों छात्रों के साथ ग्रुप प्रैक्टिस का हिस्सा बनें:",
    "✨ सटीक मार्गदर्शन और बेहतरीन कंटेंट:",
    "🧠 स्मार्ट तरीके से पढ़ें, रोज़ टेस्ट दें:",
    "🎯 सिलेक्शन चाहिए तो सही कंटेंट पढ़ें। जुड़ें:",
    "💬 प्रैक्टिस मेक्स परफेक्ट! हमारे ग्रुप से जुड़ें:",
    "🏆 सबसे तेज़ जवाब दें और नंबर 1 बनें:",
    "📚 बिना कोचिंग के घर बैठे तैयारी:",
    "🔥 सी. पी. रावत सर के स्पेशल मैराथन टेस्ट:",
    "⚡ सुपर फास्ट रिवीजन के लिए क्विज खेलें:",
    "📖 सब्जेक्ट वाइज नोट्स फ्री में प्राप्त करें:",
    "💡 अपने सवाल पूछें और तुरंत जवाब पाएं:",
    "🚀 सफलता का एकमात्र विकल्प - सही तैयारी:",
    "🎯 टाइम मैनेजमेंट सीखें लाइव क्विज से:",
    "🎉 परीक्षा से पहले खुद को परखें:",
    "📚 नए पैटर्न पर आधारित स्टडी मटेरियल:",
    "📝 दूसरों से आगे निकलें, डेली क्विज लगाकर:",
    "👥 हमारा प्रैक्टिस ग्रुप आपकी सफलता की कुंजी है:",
    "✨ सी. पी. रावत सर के साथ जीत पक्की:"
];

// 🛡️ क्रैश-प्रूफ
process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

const mainMenu = Markup.keyboard([
  ['📝 नया मैराथन बनाएं', '⚙️ ग्रुप सेटिंग'],
  ['📢 दैनिक पोस्ट सेट करें', '📊 My Quizzes'],
  ['🛑 सिस्टम लॉक करें']
]).resize();

bot.start((ctx) => {
    const payload = ctx.startPayload;
    if (payload && payload.startsWith('quiz_')) {
        activeGroups.add(ctx.chat.id);
        return initGroupLobby(ctx, payload);
    }
    if (allowedUsers.has(ctx.from.id.toString())) {
        ctx.reply('👑 प्रणाम CP Rawat Sir!\nआपका सुपर मैराथन इंजन तैयार है। 👇', mainMenu);
    } else {
        ctx.reply('🔒 सुरक्षित सिस्टम! कृपया मास्टर पासवर्ड दर्ज करें:');
    }
});

bot.command('stopquiz', async (ctx) => {
    const chatId = ctx.chat.id;
    if (activeSessions.has(chatId)) {
        finishQuiz(chatId, true); 
    } else {
        ctx.reply('❌ No active quiz in this chat.');
    }
});

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    if (text === masterPassword) {
        allowedUsers.add(userId);
        return ctx.reply('✅ एक्सेस ग्रांटेड!', mainMenu);
    }
    if (!allowedUsers.has(userId)) return next();
    if (text === '🔙 मुख्य मेनू') { userStates[userId] = ''; return ctx.reply('🔙 मुख्य मेनू:', mainMenu); }

    if (text === '📢 दैनिक पोस्ट सेट करें') {
        userStates[userId] = 'SET_DAILY_POST';
        return ctx.reply(`📢 **वर्तमान दैनिक विज्ञापन पोस्ट:**\n\n"${dailyPromoPost}"\n\n✏️ नई पोस्ट सेट करने के लिए टेक्स्ट लिखकर भेजें:`);
    }
    if (userStates[userId] === 'SET_DAILY_POST') {
        dailyPromoPost = text;
        userStates[userId] = '';
        return ctx.reply('✅ दैनिक पोस्ट अपडेट हो गई!', mainMenu);
    }

    if (text === '📝 नया मैराथन बनाएं') {
        userStates[userId] = 'AWAITING_TITLE';
        tempQueue[userId] = { title: '', description: '', questions: [] };
        return ctx.reply('📝 **मैराथन का टाइटल (Title) लिखें:**');
    }
    if (userStates[userId] === 'AWAITING_TITLE') {
        tempQueue[userId].title = text;
        userStates[userId] = 'AWAITING_DESC';
        return ctx.reply('✅ टाइटल सेट! अब **विवरण (Description)** भेजें:');
    }
    if (userStates[userId] === 'AWAITING_DESC') {
        tempQueue[userId].description = text;
        const quizId = `quiz_${Date.now()}`;
        myQuizzes.set(quizId, { ...tempQueue[userId], id: quizId, time: 15, shufQ: false, shufO: false });
        delete tempQueue[userId];
        userStates[userId] = `EDITING_${quizId}`;
        return ctx.reply(`🚀 **मैराथन एक्टिव!**\n\nअपने प्रश्न (✅ सहित) भेजें। पूरा होने पर बटन दबाएं:`,
            Markup.inlineKeyboard([[Markup.button.callback('✅ सेट पूरा हुआ (Finish)', `settings_${quizId}`)]])
        );
    }

    if (userStates[userId] && userStates[userId].startsWith('EDITING_') && text.includes('✅')) {
        const quizId = userStates[userId].replace('EDITING_', '');
        return queueQuestions(ctx, text, quizId);
    }
    next();
});

function queueQuestions(ctx, text, quizId) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return;
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
            let qIndex = quiz.questions.length;
            let finalExp = explanation ? `${explanation}\n\n` : "";
            
            // 🔄 हिंट में अल्टरनेट लिंक्स
            if ((qIndex + 1) % 3 === 1) finalExp += `📚 Notes PDF: @gkandgs12`;
            else if ((qIndex + 1) % 3 === 2) finalExp += `💬 Practice: @gkandgs85`;
            else finalExp += `🏆 Live Quiz: @QuizClub15seconds`;

            quiz.questions.push({ question, options, correctId, explanation: finalExp.substring(0, 195) });
            added++;
        }
    }
    ctx.reply(`📥 **${added} प्रश्न जुड़े!** (कुल: ${quiz.questions.length})`,
        Markup.inlineKeyboard([[Markup.button.callback('✅ सेट पूरा हुआ (Finish)', `settings_${quizId}`)]])
    );
}

bot.action(/settings_(.+)/, (ctx) => {
    const quizId = ctx.match[1];
    const quiz = myQuizzes.get(quizId);
    userStates[ctx.from.id.toString()] = '';

    const shareText = encodeURIComponent(`🔥 Quiz: ${quiz.title}\n📊 Questions: ${quiz.questions.length}\n👇 Click below to play!`);
    const shareUrl = `https://t.me/share/url?url=https://t.me/${ctx.botInfo.username}?start=${quizId}&text=${shareText}`;

    ctx.editMessageText(`⚙️ **मैराथन सेटिंग्स**\n📌 **टाइटल:** ${quiz.title}\n📊 **कुल प्रश्न:** ${quiz.questions.length}`,
        Markup.inlineKeyboard([
            [Markup.button.callback(`⏱️ Time: ${quiz.time}s`, `toggletime_${quizId}`)],
            [Markup.button.callback(`🔀 Q-Shuffle: ${quiz.shufQ ? 'ON' : 'OFF'}`, `toggleshufQ_${quizId}`), 
             Markup.button.callback(`🔀 Opt-Shuffle: ${quiz.shufO ? 'ON' : 'OFF'}`, `toggleshufO_${quizId}`)],
            [Markup.button.callback('✏️ Edit / Add More', `editmore_${quizId}`)],
            [Markup.button.url('📢 Share to Club', shareUrl)],
            [Markup.button.url('🚀 Start in Group', `https://t.me/${ctx.botInfo.username}?startgroup=${quizId}`)]
        ])
    );
});

bot.action(/toggletime_(.+)/, (ctx) => {
    const quizId = ctx.match[1]; const quiz = myQuizzes.get(quizId);
    quiz.time = quiz.time === 15 ? 30 : quiz.time === 30 ? 60 : 15;
    bot.handleUpdate({ callback_query: { data: `settings_${quizId}`, from: ctx.from } });
});
bot.action(/toggleshufQ_(.+)/, (ctx) => {
    const quizId = ctx.match[1]; const quiz = myQuizzes.get(quizId); quiz.shufQ = !quiz.shufQ;
    bot.handleUpdate({ callback_query: { data: `settings_${quizId}`, from: ctx.from } });
});
bot.action(/toggleshufO_(.+)/, (ctx) => {
    const quizId = ctx.match[1]; const quiz = myQuizzes.get(quizId); quiz.shufO = !quiz.shufO;
    bot.handleUpdate({ callback_query: { data: `settings_${quizId}`, from: ctx.from } });
});
bot.action(/editmore_(.+)/, (ctx) => {
    const quizId = ctx.match[1]; userStates[ctx.from.id.toString()] = `EDITING_${quizId}`;
    ctx.reply('✏️ **एडिट मोड!** अपने प्रश्न भेजें।');
});

// ==========================================
// 🤝 लॉबी सिस्टम (Official English Style)
// ==========================================
function initGroupLobby(ctx, quizId) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.reply('❌ Quiz unavailable.');
    const chatId = ctx.chat.id;
    
    let finalQuestions = [...quiz.questions];
    if (quiz.shufQ) finalQuestions.sort(() => Math.random() - 0.5);

    activeSessions.set(chatId, { quiz, questions: finalQuestions, players: new Set(), scores: {}, qIndex: 0, zeroCount: 0, pollId: null, timerObj: null, isPaused: false });
    
    const descText = quiz.description ? `\n${quiz.description}\n` : '';
    ctx.reply(`🏁 *${quiz.title}*${descText}\nNobody is ready yet.`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[Markup.button.callback(`I'm ready!`, `ready_${chatId}`)]] }
    });
}

bot.action(/ready_(.+)/, async (ctx) => {
    const chatId = Number(ctx.match[1]);
    const session = activeSessions.get(chatId);
    if (!session) return;
    session.players.add(ctx.from.id);
    const count = session.players.size;
    
    if (count >= 2) {
        await ctx.editMessageText(`🏁 *${session.quiz.title}*\n\n${count} people ready...\nThe quiz will start in 3 seconds!`, { parse_mode: 'Markdown' });
        setTimeout(() => sendNextQuestion(chatId), 3000);
    } else {
        ctx.editMessageText(`🏁 *${session.quiz.title}*\n\n${count} person is ready so far.`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[Markup.button.callback(`I'm ready!`, `ready_${chatId}`)]] }
        });
        ctx.answerCbQuery('You are ready!');
    }
});

// 🚀 लाइव क्विज इंजन
async function sendNextQuestion(chatId) {
    const session = activeSessions.get(chatId);
    if (!session || session.isPaused) return;
    if (session.qIndex >= session.questions.length) return finishQuiz(chatId, false);

    if (session.zeroCount >= 2) {
        session.isPaused = true;
        if (session.timerObj) clearTimeout(session.timerObj);
        return bot.telegram.sendMessage(chatId, `Nobody answered. Quiz paused.`,
            Markup.inlineKeyboard([[Markup.button.callback('▶️ Resume Quiz', `resume_${chatId}`)]])
        );
    }

    // 🚀 प्रोमोशन इंजन (Mega Milestones & Rotating Alternate Links)
    if (session.qIndex > 0 && session.zeroCount === 0) {
        // 1. अगर फिक्स मेगा माइलस्टोन है तो तीनों लिंक बटन वाला मैसेज
        if (megaMilestones.includes(session.qIndex)) {
            const promoText = `🌟 **Study with CP Rawat Sir** 🌟\n\nसफलता सुनिश्चित करने के लिए हमारे सभी चैनल्स से जुड़ें:`;
            const promoButtons = Markup.inlineKeyboard([
                [Markup.button.url('📚 Notes & PDF Channel', 'https://t.me/gkandgs12')],
                [Markup.button.url('💬 Daily Practice Group', 'https://t.me/gkandgs85')],
                [Markup.button.url('🏆 Official Quiz Club', 'https://t.me/QuizClub15seconds')]
            ]);
            await bot.telegram.sendMessage(chatId, promoText, promoButtons);
            await new Promise(resolve => setTimeout(resolve, 3000));
        } 
        // 2. अगर माइलस्टोन नहीं है, लेकिन 5 का मल्टीपल है, तो एक रैंडम पोस्ट के साथ अल्टरनेट लिंक
        else if (session.qIndex % 5 === 0) {
            const randomPromo = promoPool[Math.floor(Math.random() * promoPool.length)];
            
            let altLink = "";
            let linkIndex = (session.qIndex / 5) % 3; // अल्टरनेट कैलकुलेटर
            if (linkIndex === 1) altLink = "👉 📚 Join: @gkandgs12";
            else if (linkIndex === 2) altLink = "👉 💬 Join: @gkandgs85";
            else altLink = "👉 🏆 Join: @QuizClub15seconds";

            await bot.telegram.sendMessage(chatId, `${randomPromo}\n\n${altLink}`, { parse_mode: 'Markdown' });
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
        session.currentVotes = 0;
    } catch (e) { 
        const poll = await bot.telegram.sendQuiz(chatId, qText, finalOptions, {
            correct_option_id: finalCorrectId, explanation: q.explanation, is_anonymous: true, open_period: session.quiz.time
        });
        session.pollId = poll.poll.id;
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
    ctx.editMessageText('▶️ Resuming quiz...');
    setTimeout(() => sendNextQuestion(chatId), 2000);
    ctx.answerCbQuery('Quiz Resumed!');
});

bot.on('poll_answer', (ctx) => {
    const ans = ctx.pollAnswer;
    activeSessions.forEach((session) => {
        if (session.pollId === ans.poll_id) {
            session.currentVotes++;
            if (!session.scores[ans.user.id]) session.scores[ans.user.id] = { name: ans.user.first_name, score: 0 };
            session.scores[ans.user.id].score++;
        }
    });
});

function finishQuiz(chatId, wasForced) {
    const session = activeSessions.get(chatId);
    if (!session) return;
    if (session.timerObj) clearTimeout(session.timerObj);
    
    let results = Object.values(session.scores).sort((a, b) => b.score - a.score).slice(0, 50);
    let leaderboard = wasForced ? `🛑 *Quiz stopped!* \n\n📊 *Final Results:*\n` : `🏁 *The quiz '${session.quiz.title}' has finished!*\n\n📊 *Results:*\n`;
    
    if (results.length === 0) leaderboard += "Nobody answered correctly.";
    else {
        const medals = ['🥇', '🥈', '🥉'];
        results.forEach((r, i) => { leaderboard += `${i < 3 ? medals[i] : `🎗 ${i+1}.`} ${r.name} – ${r.score}\n`; });
    }
    
    bot.telegram.sendMessage(chatId, leaderboard, { parse_mode: 'Markdown' });
    activeSessions.delete(chatId);
}

setInterval(() => {
    activeGroups.forEach(async (chatId) => {
        try { await bot.telegram.sendMessage(chatId, dailyPromoPost); } 
        catch (err) { activeGroups.delete(chatId); }
    });
}, 24 * 60 * 60 * 1000); 

const app = express();
app.get('/', (req, res) => res.send('CP Rawat Official Style Active!'));
app.listen(process.env.PORT || 3000);
bot.launch();
