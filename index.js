import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import 'dotenv/config';

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🗄️ डेटाबेस और मेमोरी
const masterPassword = process.env.MASTER_PASSWORD || 'CP@2026';
const allowedUsers = new Set();
const userStates = {}; 
const tempQueue = {}; // मैराथन कतार के लिए
const myQuizzes = new Map(); // सेव किए गए क्विज
const activeSessions = new Map(); // लाइव चल रहे ग्रुप क्विज

// 📢 आपकी शानदार प्रोमो लिंक्स
const promo1 = "📚 PDF & Notes: @gkandgs12";
const promo2 = "💬 Practice Group: @gkandgs85";
const promo3 = "🏆 Quiz Club: @QuizClub15seconds";
const megaPromo = `\n━━━━━━━━━━━━━━━━━━━\n🌟 𝗦𝘁𝘂𝗱𝘆 𝘄𝗶𝘁𝗵 𝗖𝗣 𝗥𝗮𝘄𝗮𝘁 𝗦𝗶𝗿 🌟\n${promo1}\n${promo2}\n${promo3}`;

bot.start((ctx) => {
    const payload = ctx.startPayload;
    if (payload && payload.startsWith('quiz_')) {
        return initGroupLobby(ctx, payload);
    }
    
    if (allowedUsers.has(ctx.from.id.toString())) {
        ctx.reply('👑 प्रणाम CP Rawat Sir!\nसुपर मैराथन और ऑफिशियल क्विज इंजन तैयार है। 👇', 
            Markup.keyboard([
                ['📝 नया मैराथन बनाएं', '⚙️ क्विज सेटिंग्स'],
                ['🛑 सिस्टम लॉक करें']
            ]).resize()
        );
    } else {
        ctx.reply('🔒 कृपया मास्टर पासवर्ड दर्ज करें:');
    }
});

// 🔐 पासवर्ड और मैराथन कतार सिस्टम
bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    if (text === masterPassword) {
        allowedUsers.add(userId);
        return ctx.reply('✅ एक्सेस ग्रांटेड!', Markup.keyboard([['📝 नया मैराथन बनाएं', '⚙️ क्विज सेटिंग्स']]).resize());
    }
    if (!allowedUsers.has(userId)) return next();

    if (text === '📝 नया मैराथन बनाएं') {
        userStates[userId] = 'AWAITING_TITLE';
        tempQueue[userId] = { title: '', questions: [] };
        return ctx.reply('📝 **नए मैराथन का टाइटल भेजें:**');
    }

    if (userStates[userId] === 'AWAITING_TITLE') {
        tempQueue[userId].title = text;
        userStates[userId] = 'AWAITING_Q';
        return ctx.reply(`✅ टाइटल सेट!\n\n🚀 अब अपने प्रश्न (✅ सहित) भेजना शुरू करें। आप 100-100 करके कई बार भेज सकते हैं, मैं कतार में लगाता रहूँगा। जब सारे प्रश्न डल जाएं, तो 'सेट पूरा हुआ' दबाएं।`,
            Markup.inlineKeyboard([Markup.button.callback('✅ सेट पूरा हुआ (Finish)', 'setup_settings')])
        );
    }

    if (userStates[userId] === 'AWAITING_Q' && text.includes('✅')) {
        return queueQuestions(ctx, text, userId);
    }

    next();
});

// ==========================================
// 🧠 प्रश्न छांटना, कतार और ऑटो-लिंकिंग
// ==========================================
function queueQuestions(ctx, text, userId) {
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
            let qIndex = tempQueue[userId].questions.length;
            let finalExp = explanation;
            
            // 🔄 प्रोमो इंजन (हर 5-6 पर लिंक्स, बीच में मेगा प्रोमो)
            if ((qIndex + 1) % 15 === 0) finalExp += megaPromo;
            else if ((qIndex + 1) % 5 === 0) finalExp += `\n\n${promo1}`;
            else if ((qIndex + 1) % 6 === 0) finalExp += `\n\n${promo2}`;

            tempQueue[userId].questions.push({ question, options, correctId, explanation: finalExp.substring(0, 195) });
            added++;
        }
    }
    ctx.reply(`📥 **${added} नए प्रश्न कतार में जुड़े!** (कुल: ${tempQueue[userId].questions.length})\nऔर भेजें या 'सेट पूरा हुआ' दबाएं।`,
        Markup.inlineKeyboard([Markup.button.callback('✅ सेट पूरा हुआ (Finish)', 'setup_settings')])
    );
}

// ==========================================
// ⚙️ सेटिंग्स (Timer & Shuffle)
// ==========================================
bot.action('setup_settings', (ctx) => {
    const userId = ctx.from.id.toString();
    const quizId = `quiz_${Date.now()}`;
    myQuizzes.set(quizId, { ...tempQueue[userId], id: quizId, time: 15, shuffleQ: true, shuffleO: false });
    userStates[userId] = ''; delete tempQueue[userId];

    ctx.editMessageText(`⚙️ **मैराथन सेटिंग्स**\nक्विज ID: #${quizId}\n\nनीचे दिए गए बटन से टाइमर और शफलिंग सेट करें, फिर 'तैयार करें' दबाएं:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('⏱️ टाइमर: 15s', `time_${quizId}`)],
            [Markup.button.callback('🔀 प्रश्न शफल: चालू', `shufQ_${quizId}`), Markup.button.callback('🔀 ऑप्शन शफल: बंद', `shufO_${quizId}`)],
            [Markup.button.callback('🚀 क्विज तैयार करें', `publish_${quizId}`)]
        ])
    );
});

bot.action(/publish_(.+)/, (ctx) => {
    const quizId = ctx.match[1];
    ctx.editMessageText(`🎉 **मैराथन बिल्कुल तैयार है!**\n\nअब इसे ऑफिशियल तरीके से किसी भी ग्रुप में चलाएं:`,
        Markup.inlineKeyboard([
            // जादुई लिंक: एडमिन परमिशन के साथ ग्रुप में ले जाएगा
            [Markup.button.url('↗️ ग्रुप में चलाएं (Start in Group)', `https://t.me/${ctx.botInfo.username}?startgroup=${quizId}&admin=post_messages`)],
            [Markup.button.callback('📢 ऑटो-शेयर (क्लब में)', `shareclub_${quizId}`)]
        ])
    );
});

bot.action(/shareclub_(.+)/, async (ctx) => {
    const quizId = ctx.match[1];
    await ctx.telegram.sendMessage('@QuizClub15seconds', `🔥 **नया लाइव मैराथन!**\n\nCP Rawat Sir ने नया क्विज सेट किया है। नीचे क्लिक करें!`,
        Markup.inlineKeyboard([[Markup.button.url('👉 क्विज शुरू करें', `https://t.me/${ctx.botInfo.username}?start=${quizId}`)]])
    );
    ctx.answerCbQuery('✅ क्लब में शेयर हो गया!');
});

// ==========================================
// ✋ लॉबी सिस्टम (I am ready)
// ==========================================
function initGroupLobby(ctx, quizId) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return;
    
    const chatId = ctx.chat.id;
    activeSessions.set(chatId, { quiz, players: new Set(), scores: {}, qIndex: 0, zeroVoteCount: 0, activePoll: null });

    ctx.reply(`🏁 **${quiz.title}**\n\nकुल प्रश्न: ${quiz.questions.length}\n⏱️ टाइमर: 15 सेकंड\n\n**नियम:** शुरू करने के लिए कम से कम 2 लोगों का तैयार होना ज़रूरी है!`,
        Markup.inlineKeyboard([[Markup.button.callback(`✋ I am ready (0/2)`, `ready_${chatId}`)]])
    );
}

bot.action(/ready_(.+)/, async (ctx) => {
    const chatId = ctx.match[1];
    const session = activeSessions.get(Number(chatId));
    if (!session) return;

    session.players.add(ctx.from.id);
    const count = session.players.size;
    
    if (count >= 2) {
        await ctx.editMessageText(`🚀 **लॉबी फुल! क्विज 3 सेकंड में शुरू हो रहा है...**\n\n${megaPromo}`);
        setTimeout(() => sendNextQuestion(chatId), 3000);
    } else {
        ctx.editMessageReplyMarkup({ inline_keyboard: [[Markup.button.callback(`✋ I am ready (${count}/2)`, `ready_${chatId}`)]] });
        ctx.answerCbQuery('✅ आप तैयार हैं! 1 और खिलाड़ी का इंतज़ार है...');
    }
});

// ==========================================
// 🚀 लाइव क्विज इंजन & ऑटो-स्टॉप
// ==========================================
async function sendNextQuestion(chatId) {
    const session = activeSessions.get(Number(chatId));
    if (!session || session.qIndex >= session.quiz.questions.length) return finishQuiz(chatId);

    // 0 वोट पर ऑटो-स्टॉप चेक
    if (session.zeroVoteCount >= 2) {
        bot.telegram.sendMessage(chatId, `🛑 **क्विज ऑटो-स्टॉप!**\nलगातार 2 प्रश्नों का किसी ने उत्तर नहीं दिया, इसलिए क्विज रोक दिया गया है।`);
        return finishQuiz(chatId);
    }

    let q = session.quiz.questions[session.qIndex];
    // ऑटो-नंबरिंग
    let qText = `[${session.qIndex + 1}/${session.quiz.questions.length}] ${q.question}`;

    try {
        const poll = await bot.telegram.sendQuiz(chatId, qText, q.options, {
            correct_option_id: q.correctId,
            explanation: q.explanation,
            is_anonymous: false, // ऑफिशियल बोट की तरह (View Votes)
            open_period: 15 // 15 सेकंड का टाइमर
        });
        
        session.activePoll = poll.poll.id;
        session.currentPollVotes = 0;
        
        // टाइमर खत्म होने पर अगला प्रश्न
        setTimeout(() => {
            if (session.currentPollVotes === 0) session.zeroVoteCount++;
            else session.zeroVoteCount = 0;
            session.qIndex++;
            sendNextQuestion(chatId);
        }, 16000); // 15s + 1s बफर
    } catch (e) {
        console.log(e);
    }
}

// 🛑 एडमिन स्टॉप कमांड
bot.command('stopquiz', async (ctx) => {
    const chatMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    if (chatMember.status === 'administrator' || chatMember.status === 'creator') {
        activeSessions.delete(ctx.chat.id);
        ctx.reply('🛑 **ग्रुप एडमिन द्वारा क्विज तुरंत रोक दिया गया है!**');
    } else {
        ctx.reply('❌ केवल ग्रुप एडमिन ही क्विज रोक सकते हैं।');
    }
});

// ==========================================
// 📊 लीडरबोर्ड (Top 50 & Golden Folders)
// ==========================================
bot.on('poll_answer', (ctx) => {
    const ans = ctx.pollAnswer;
    activeSessions.forEach((session) => {
        if (session.activePoll === ans.poll_id) {
            session.currentPollVotes++;
            if (!session.scores[ans.user.id]) session.scores[ans.user.id] = { name: ans.user.first_name, score: 0, time: 0 };
            
            // अगर सही ऑप्शन चुना है
            const q = session.quiz.questions[session.qIndex];
            if (ans.option_ids[0] === q.correctId) {
                session.scores[ans.user.id].score++;
            }
        }
    });
});

function finishQuiz(chatId) {
    const session = activeSessions.get(Number(chatId));
    if (!session) return;
    
    // टॉप 50 बच्चों का रिजल्ट बनाना
    let results = Object.values(session.scores).sort((a, b) => b.score - a.score).slice(0, 50);
    
    let leaderboard = `🏁 **मैराथन '${session.quiz.title}' समाप्त!**\n\n`;
    if (results.length === 0) {
        leaderboard += "😔 किसी ने भी सही उत्तर नहीं दिया।";
    } else {
        const medals = ['🥇', '🥈', '🥉'];
        results.forEach((r, i) => {
            let rank = i < 3 ? medals[i] : `🎗 ${i+1}.`;
            leaderboard += `${rank} ${r.name} – ${r.score} सही\n`;
        });
    }
    
    bot.telegram.sendMessage(chatId, `${leaderboard}\n${megaPromo}`);
    activeSessions.delete(Number(chatId));
}

const app = express();
app.get('/', (req, res) => res.send('CP Rawat Official Marathon Bot Active!'));
app.listen(process.env.PORT || 3000);
bot.launch();
