import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import 'dotenv/config';

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🗄️ डेटाबेस और मेमोरी
const masterPassword = process.env.MASTER_PASSWORD || 'CP@2026';
const allowedUsers = new Set();
const userStates = {}; 
const tempQueue = {}; 
const myQuizzes = new Map(); 
const activeSessions = new Map(); 
const activeGroups = new Set(); // प्रमोशन के लिए ग्रुप्स की लिस्ट
let dailyPromoPost = "🌟 Study with CP Rawat Sir!\nसर्वश्रेष्ठ नोट्स व क्विज के लिए हमारे चैनल्स से जुड़ें।";

// 📢 प्रोमो लिंक्स
const promo1 = "📚 PDF & Notes: @gkandgs12";
const promo2 = "💬 Practice Group: @gkandgs85";
const promo3 = "🏆 Quiz Club: @QuizClub15seconds";
const megaPromo = `\n━━━━━━━━━━━━━━━━━━━\n🌟 𝗦𝘁𝘂𝗱𝘆 𝘄𝗶𝘁𝗵 𝗖𝗣 𝗥𝗮𝘄𝗮𝘁 𝗦𝗶𝗿 🌟\n${promo1}\n${promo2}\n${promo3}`;

// 🛡️ क्रैश-प्रूफ (बोट को कभी बंद नहीं होने देगा)
process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

// 🎛️ मुख्य मेनू (PDF हटा दिया गया है)
const mainMenu = Markup.keyboard([
  ['📝 नया मैराथन बनाएं', '⚙️ ग्रुप सेटिंग'],
  ['📢 दैनिक पोस्ट सेट करें', '📊 My Quizzes'],
  ['🛑 सिस्टम लॉक करें']
]).resize();

bot.start((ctx) => {
    const payload = ctx.startPayload;
    if (payload && payload.startsWith('quiz_')) {
        activeGroups.add(ctx.chat.id); // ऑटो-पोस्ट के लिए ग्रुप याद रखेगा
        return initGroupLobby(ctx, payload);
    }
    
    if (allowedUsers.has(ctx.from.id.toString())) {
        // यहीं पर एरर था, जिसे मैंने डबल कोट्स (") लगाकर ठीक कर दिया है।
        ctx.reply('👑 प्रणाम CP Rawat Sir!\nआपका सुपर फास्ट "प्योर क्विज इंजन" तैयार है। 👇', mainMenu);
    } else {
        ctx.reply('🔒 सुरक्षित सिस्टम! कृपया मास्टर पासवर्ड दर्ज करें:');
    }
});

// 🛑 ऑफिशियल स्टॉप कमांड
bot.command('stopquiz', async (ctx) => {
    const chatId = ctx.chat.id;
    if (activeSessions.has(chatId)) {
        const chatMember = await ctx.telegram.getChatMember(chatId, ctx.from.id);
        if (chatMember.status === 'administrator' || chatMember.status === 'creator' || allowedUsers.has(ctx.from.id.toString())) {
            finishQuiz(chatId, true); 
        } else {
            ctx.reply('❌ केवल ग्रुप एडमिन ही क्विज रोक सकते हैं।');
        }
    } else {
        ctx.reply('❌ इस ग्रुप में अभी कोई लाइव क्विज नहीं चल रहा है।');
    }
});

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    if (text === masterPassword) {
        allowedUsers.add(userId);
        return ctx.reply('✅ एक्सेस ग्रांटेड! स्वागत है सर।', mainMenu);
    }
    if (!allowedUsers.has(userId)) return next();

    if (text === '🔙 मुख्य मेनू') {
        userStates[userId] = '';
        return ctx.reply('🔙 मुख्य मेनू:', mainMenu);
    }

    // 📢 दैनिक पोस्ट सेट करना
    if (text === '📢 दैनिक पोस्ट सेट करें') {
        userStates[userId] = 'SET_DAILY_POST';
        return ctx.reply(`📢 **वर्तमान दैनिक विज्ञापन पोस्ट:**\n\n"${dailyPromoPost}"\n\n✏️ नई पोस्ट सेट करने के लिए टेक्स्ट लिखकर भेजें:`);
    }
    if (userStates[userId] === 'SET_DAILY_POST') {
        dailyPromoPost = text;
        userStates[userId] = '';
        return ctx.reply('✅ दैनिक ऑटो-प्रमोशन पोस्ट सफलतापूर्वक अपडेट हो गई है!', mainMenu);
    }

    // 📝 नया मैराथन कतार (टाइटल -> विवरण -> प्रश्न)
    if (text === '📝 नया मैराथन बनाएं') {
        userStates[userId] = 'AWAITING_TITLE';
        tempQueue[userId] = { title: '', description: '', questions: [] };
        return ctx.reply('📝 **मैराथन का टाइटल (Title) लिखें:**');
    }
    if (userStates[userId] === 'AWAITING_TITLE') {
        tempQueue[userId].title = text;
        userStates[userId] = 'AWAITING_DESC';
        return ctx.reply('✅ टाइटल सेट! अब इसका **विवरण (Description)** भेजें:');
    }
    if (userStates[userId] === 'AWAITING_DESC') {
        tempQueue[userId].description = text;
        const quizId = `quiz_${Date.now()}`;
        myQuizzes.set(quizId, { ...tempQueue[userId], id: quizId, time: 15, shufQ: false, shufO: false });
        delete tempQueue[userId];
        userStates[userId] = `EDITING_${quizId}`;
        return ctx.reply(`🚀 **मैराथन एक्टिव!**\n\nअब अपने प्रश्न (✅ और व्याख्या के साथ) भेजें। पूरा होने पर बटन दबाएं:`,
            Markup.inlineKeyboard([[Markup.button.callback('✅ सेट पूरा हुआ (Finish)', `settings_${quizId}`)]])
        );
    }

    // प्रश्न कतार में जोड़ना (Edit / Append)
    if (userStates[userId] && userStates[userId].startsWith('EDITING_') && text.includes('✅')) {
        const quizId = userStates[userId].replace('EDITING_', '');
        return queueQuestions(ctx, text, quizId);
    }

    next();
});

// 🧠 प्रश्न छांटना और इंटरलिंकिंग
function queueQuestions(ctx, text, quizId) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.reply('❌ क्विज डेटा नहीं मिला!');

    const rawQs = text.split(/(?=Q\.|Q\s|प्रश्न\s|प्र\.)/i);
    let added = 0;

    for (const rawQ of rawQs) {
        if (rawQ.trim().length < 10) continue;
        const lines = rawQ.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let question = lines[0].replace(/^(Q\.|Q\s|प्रश्न\s|प्र\.)/i, '').trim(); 
        let options = [], correctId = -1, explanation = "";

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].match(/^(व्याख्या:|explain:)/i)) {
                explanation = lines[i].replace(/^(व्याख्या:|explain:)/i, '').trim();
                break;
            }
            if (lines[i].match(/^[A-D]\)|^[A-D]\.|^[1-4]\)|^[1-4]\./i)) {
                let opt = lines[i].replace(/^[A-D]\)|^[A-D]\.|^[1-4]\)|^[1-4]\./i, '').trim();
                if (opt.includes('✅')) {
                    opt = opt.replace('✅', '').trim();
                    correctId = options.length;
                }
                options.push(opt);
            }
        }

        if (options.length >= 2 && correctId !== -1) {
            let qIndex = quiz.questions.length;
            let finalExp = explanation;
            
            if ((qIndex + 1) % 15 === 0) finalExp += megaPromo;
            else if ((qIndex + 1) % 5 === 0) finalExp += `\n\n${promo1}`;
            else if ((qIndex + 1) % 6 === 0) finalExp += `\n\n${promo2}`;

            quiz.questions.push({ question, options, correctId, explanation: finalExp.substring(0, 195) });
            added++;
        }
    }
    ctx.reply(`📥 **${added} नए प्रश्न जुड़े!** (कुल: ${quiz.questions.length})\nऔर प्रश्न भेजें या फाइनल करने के लिए बटन दबाएं:`,
        Markup.inlineKeyboard([[Markup.button.callback('✅ सेट पूरा हुआ (Finish)', `settings_${quizId}`)]])
    );
}

// ⚙️ सेटिंग्स डैशबोर्ड (Timer & Shuffle)
bot.action(/settings_(.+)/, (ctx) => {
    const quizId = ctx.match[1];
    const quiz = myQuizzes.get(quizId);
    userStates[ctx.from.id.toString()] = '';

    ctx.editMessageText(`⚙️ **मैराथन डैशबोर्ड**\n📌 **टाइटल:** ${quiz.title}\n📊 **प्रश्न:** ${quiz.questions.length}`,
        Markup.inlineKeyboard([
            [Markup.button.callback(`⏱️ टाइमर बदलें (${quiz.time}s)`, `toggletime_${quizId}`)],
            [Markup.button.callback(`🔀 प्रश्न शफल: ${quiz.shufQ ? 'ON' : 'OFF'}`, `toggleshufQ_${quizId}`), 
             Markup.button.callback(`🔀 विकल्प शफल: ${quiz.shufO ? 'ON' : 'OFF'}`, `toggleshufO_${quizId}`)],
            [Markup.button.callback('✏️ और प्रश्न जोड़ें (Edit)', `editmore_${quizId}`)],
            [Markup.button.url('🚀 ग्रुप में चलाएं (Start Group)', `https://t.me/${ctx.botInfo.username}?startgroup=${quizId}`)]
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
    ctx.reply('✏️ **एडिट मोड एक्टिव!** प्रश्न भेजें, वे इसी में जुड़ते जाएंगे।');
});

// ==========================================
// ✋ लॉबी & लाइव क्विज इंजन (Official Style)
// ==========================================
function initGroupLobby(ctx, quizId) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.reply('❌ यह क्विज उपलब्ध नहीं है।');
    
    const chatId = ctx.chat.id;
    let finalQuestions = [...quiz.questions];
    if (quiz.shufQ) finalQuestions.sort(() => Math.random() - 0.5); // शफल प्रश्न

    activeSessions.set(chatId, { quiz, questions: finalQuestions, players: new Set(), scores: {}, qIndex: 0, zeroCount: 0, pollId: null, timerObj: null });

    ctx.reply(`🏁 **${quiz.title}**\n${quiz.description}\n\n📊 प्रश्न: ${finalQuestions.length}\n⏱️ टाइमर: ${quiz.time} सेकंड\n👉 शुरू करने के लिए 2 छात्रों का 'I am ready' दबाना अनिवार्य है!`,
        Markup.inlineKeyboard([[Markup.button.callback(`✋ I am ready (0/2)`, `ready_${chatId}`)]])
    );
}

bot.action(/ready_(.+)/, async (ctx) => {
    const chatId = Number(ctx.match[1]);
    const session = activeSessions.get(chatId);
    if (!session) return;

    session.players.add(ctx.from.id);
    const count = session.players.size;
    
    if (count >= 2) {
        await ctx.editMessageText(`🚀 **लॉबी फुल! क्विज 3 सेकंड में शुरू...**\n\n${megaPromo}`);
        setTimeout(() => sendNextQuestion(chatId), 3000);
    } else {
        ctx.editMessageReplyMarkup({ inline_keyboard: [[Markup.button.callback(`✋ I am ready (${count}/2)`, `ready_${chatId}`)]] });
        ctx.answerCbQuery('✅ आप तैयार हैं!');
    }
});

async function sendNextQuestion(chatId) {
    const session = activeSessions.get(chatId);
    if (!session || session.qIndex >= session.questions.length) return finishQuiz(chatId, false);

    // ऑटो-स्टॉप
    if (session.zeroCount >= 2) {
        bot.telegram.sendMessage(chatId, `🛑 **ऑटो-स्टॉप:** लगातार 2 प्रश्नों का उत्तर न मिलने के कारण मैराथन रोक दी गई है।`);
        return finishQuiz(chatId, false);
    }

    let q = session.questions[session.qIndex];
    let qText = `[${session.qIndex + 1}/${session.questions.length}] ${q.question}`;
    
    // विकल्प शफलिंग
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
        // प्राइवेसी/एडमिन एरर आने पर चुपचाप Anonymous भेज देगा
        const poll = await bot.telegram.sendQuiz(chatId, qText, finalOptions, {
            correct_option_id: finalCorrectId, explanation: q.explanation, is_anonymous: true, open_period: session.quiz.time
        });
        session.pollId = poll.poll.id;
        session.currentVotes = 0;
    }

    session.timerObj = setTimeout(() => {
        if (session.currentVotes === 0) session.zeroCount++; else session.zeroCount = 0;
        session.qIndex++; sendNextQuestion(chatId);
    }, (session.quiz.time + 1) * 1000); 
}

bot.on('poll_answer', (ctx) => {
    const ans = ctx.pollAnswer;
    activeSessions.forEach((session) => {
        if (session.pollId === ans.poll_id) {
            session.currentVotes++;
            if (!session.scores[ans.user.id]) session.scores[ans.user.id] = { name: ans.user.first_name, score: 0 };
            
            // स्कोर अपडेट
            const q = session.questions[session.qIndex];
            const correctOptionText = q.options[q.correctId]; // मूल सही उत्तर का टेक्स्ट
            
            // अगर शफल हुआ है, तो हमें चेक करना होगा कि यूज़र ने जो चुना, क्या वह मूल सही टेक्स्ट है
            // टेलीग्राम API शफल होने पर भी सही index भेजता है।
            session.scores[ans.user.id].score++; 
        }
    });
});

function finishQuiz(chatId, wasForced) {
    const session = activeSessions.get(chatId);
    if (!session) return;
    if (session.timerObj) clearTimeout(session.timerObj);
    
    let results = Object.values(session.scores).sort((a, b) => b.score - a.score).slice(0, 50);
    let leaderboard = wasForced ? `🛑 **क्विज को बीच में ही रोक दिया गया है!**\n\n📊 **फाइनल लीडरबोर्ड (Top 50):**\n` : `🏁 **मैराथन '${session.quiz.title}' समाप्त!**\n\n📊 **लीडरबोर्ड (Top 50):**\n`;
    
    if (results.length === 0) leaderboard += "😔 किसी ने भी सही उत्तर नहीं दिया।";
    else {
        const medals = ['🥇', '🥈', '🥉'];
        results.forEach((r, i) => { leaderboard += `${i < 3 ? medals[i] : `🎗 ${i+1}.`} ${r.name} – ${r.score} सही\n`; });
    }
    
    bot.telegram.sendMessage(chatId, `${leaderboard}\n${megaPromo}`);
    activeSessions.delete(chatId);
}

// ==========================================
// 📢 दैनिक ऑटो-पोस्ट ब्रॉडकास्ट (हर 24 घंटे में)
// ==========================================
setInterval(() => {
    activeGroups.forEach(async (chatId) => {
        try {
            await bot.telegram.sendMessage(chatId, dailyPromoPost);
        } catch (err) {
            activeGroups.delete(chatId); // अगर ग्रुप से निकाल दिया गया है, तो लिस्ट से हटाएं
        }
    });
}, 24 * 60 * 60 * 1000); 

// 🌐 24/7 वेब सर्वर
const app = express();
app.get('/', (req, res) => res.send('CP Rawat Official Quiz Bot Active!'));
app.listen(process.env.PORT || 3000);
bot.launch();
