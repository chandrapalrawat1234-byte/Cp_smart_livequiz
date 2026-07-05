import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import 'dotenv/config';

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🗄️ डेटाबेस और मेमोरी
const masterPassword = process.env.MASTER_PASSWORD || 'CP@2026';
const allowedUsers = new Set();
const userStates = {}; 
const tempQueue = {}; // मैराथन कतार के लिए
const myQuizzes = new Map(); // सेव किए गए क्विज
const activeSessions = new Map(); // लाइव चल रहे ग्रुप क्विज

// 📢 प्रोमो लिंक्स (इमोजी और शानदार टेक्स्ट के साथ)
const promo1 = "📚 PDF & Notes: @gkandgs12";
const promo2 = "💬 Practice Group: @gkandgs85";
const promo3 = "🏆 Quiz Club: @QuizClub15seconds";
const megaPromo = `\n━━━━━━━━━━━━━━━━━━━\n🌟 𝗦𝘁𝘂𝗱𝘆 𝘄𝗶𝘁𝗵 𝗖𝗣 𝗥𝗮𝘄𝗮𝘁 𝗦𝗶𝗿 🌟\n${promo1}\n${promo2}\n${promo3}`;

// 🛡️ क्रैश-प्रूफ
process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

// 🎛️ मेनू सिस्टम
const mainMenu = Markup.keyboard([
  ['📝 नया मैराथन बनाएं', '📄 PDF मेकर (VIP / सामान्य)'],
  ['⚙️ ग्रुप सेटिंग', '📊 My Quizzes'],
  ['🛑 सिस्टम लॉक करें']
]).resize();

const pdfMenu = Markup.keyboard([
  ['🌟 VIP PDF (वेबसाइट स्टाइल)', '📄 सामान्य PDF (सिंपल)'],
  ['🔙 मुख्य मेनू']
]).resize();

bot.start((ctx) => {
    const payload = ctx.startPayload;
    // अगर कोई डीप लिंक से आया है (ग्रुप में क्विज चलाने के लिए)
    if (payload && payload.startsWith('quiz_')) {
        return initGroupLobby(ctx, payload);
    }
    
    if (allowedUsers.has(ctx.from.id.toString())) {
        ctx.reply('👑 प्रणाम CP Rawat Sir!\nआपका ऑल-इन-वन (क्विज + PDF) सिस्टम पूरी तरह तैयार है। 👇', mainMenu);
    } else {
        ctx.reply('🔒 सुरक्षित सिस्टम! कृपया मास्टर पासवर्ड दर्ज करें:');
    }
});

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    // पासवर्ड चेक
    if (text === masterPassword) {
        allowedUsers.add(userId);
        return ctx.reply('✅ एक्सेस ग्रांटेड! स्वागत है सर।', mainMenu);
    }
    if (!allowedUsers.has(userId)) return next();

    // मेनू नेविगेशन
    if (text === '🔙 मुख्य मेनू') {
        userStates[userId] = '';
        return ctx.reply('🔙 मुख्य मेनू:', mainMenu);
    }

    // ==========================================
    // 📄 PDF मेकर सिस्टम (VIP / Normal)
    // ==========================================
    if (text === '📄 PDF मेकर (VIP / सामान्य)') {
        return ctx.reply('📄 **PDF मेकर मोड:**\nकिस तरह की PDF बनानी है? नीचे से चुनें:', pdfMenu);
    }
    if (text === '🌟 VIP PDF (वेबसाइट स्टाइल)') {
        userStates[userId] = 'AWAITING_VIP_PDF';
        return ctx.reply('🌟 **VIP PDF मोड एक्टिव!**\nअपनी थ्योरी या प्रश्न भेजें। मैं इसे रंगीन बॉक्स, इमोजी और वाटरमार्क के साथ तैयार करूँगा।');
    }
    if (text === '📄 सामान्य PDF (सिंपल)') {
        userStates[userId] = 'AWAITING_NORMAL_PDF';
        return ctx.reply('📄 **सामान्य PDF मोड एक्टिव!**\nअपनी सामग्री भेजें। यह सिंपल फॉर्मेट में बनेगी।');
    }

    // PDF कंटेंट रिसीव करना
    if (userStates[userId] === 'AWAITING_VIP_PDF' || userStates[userId] === 'AWAITING_NORMAL_PDF') {
        const type = userStates[userId] === 'AWAITING_VIP_PDF' ? 'VIP' : 'NORMAL';
        const filename = `CP_Rawat_${Date.now()}.pdf`;
        ctx.reply('⏳ शानदार PDF बन रही है, कृपया कुछ सेकंड रुकें...');
        
        createPDF(type, text, filename);
        
        setTimeout(async () => {
            await ctx.replyWithDocument({ source: filename });
            fs.unlinkSync(filename); // सर्वर से डिलीट (स्पेस बचाने के लिए)
            userStates[userId] = '';
            ctx.reply('✅ आपकी PDF तैयार है!', mainMenu);
        }, 2000);
        return;
    }

    // ==========================================
    // 📝 मैराथन क्विज सिस्टम (Title -> Description -> Questions)
    // ==========================================
    if (text === '📝 नया मैराथन बनाएं') {
        userStates[userId] = 'AWAITING_TITLE';
        tempQueue[userId] = { title: '', description: '', questions: [] };
        return ctx.reply('📝 **नए मैराथन का टाइटल (Title) भेजें:**');
    }

    if (userStates[userId] === 'AWAITING_TITLE') {
        tempQueue[userId].title = text;
        userStates[userId] = 'AWAITING_DESC';
        return ctx.reply('✅ टाइटल सेट!\nअब इसका **डिस्क्रिप्शन (Description)** लिखकर भेजें:');
    }

    if (userStates[userId] === 'AWAITING_DESC') {
        tempQueue[userId].description = text;
        userStates[userId] = 'AWAITING_Q';
        return ctx.reply(`✅ डिस्क्रिप्शन सेट हो गया!\n\n🚀 **मैराथन कतार चालू है!**\nअब अपने प्रश्न (✅ और व्याख्या के साथ) भेजना शुरू करें। 100-200 जितने चाहें भेजें।\n\nपूरा होने पर नीचे बटन दबाएं:`,
            Markup.inlineKeyboard([Markup.button.callback('✅ सेट पूरा हुआ (Finish)', 'setup_settings')])
        );
    }

    if (userStates[userId] === 'AWAITING_Q' && text.includes('✅')) {
        return queueQuestions(ctx, text, userId);
    }

    next();
});

// 🧠 प्रश्न छांटना और प्रोमो लिंकिंग
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

// ⚙️ सेटिंग्स (Timer)
bot.action('setup_settings', (ctx) => {
    const userId = ctx.from.id.toString();
    const quizId = `quiz_${Date.now()}`;
    myQuizzes.set(quizId, { ...tempQueue[userId], id: quizId, time: 15 });
    userStates[userId] = ''; delete tempQueue[userId];

    ctx.editMessageText(`⚙️ **मैराथन तैयार है!**\n\n📌 **टाइटल:** ${myQuizzes.get(quizId).title}\n📝 **विवरण:** ${myQuizzes.get(quizId).description}\n\nनीचे दिए गए बटन से इसे पब्लिश करें:`,
        Markup.inlineKeyboard([
            [Markup.button.url('↗️ ग्रुप में चलाएं (Start in Group)', `https://t.me/${ctx.botInfo.username}?startgroup=${quizId}&admin=post_messages`)],
            [Markup.button.callback('📢 ऑटो-शेयर (क्लब में)', `shareclub_${quizId}`)]
        ])
    );
});

// 📢 ऑटो-शेयर क्लब
bot.action(/shareclub_(.+)/, async (ctx) => {
    const quizId = ctx.match[1];
    await ctx.telegram.sendMessage('@QuizClub15seconds', `🔥 **नया लाइव मैराथन!**\n\nCP Rawat Sir ने नया क्विज सेट किया है। नीचे क्लिक करें!`,
        Markup.inlineKeyboard([[Markup.button.url('👉 क्विज शुरू करें', `https://t.me/${ctx.botInfo.username}?start=${quizId}`)]])
    );
    ctx.answerCbQuery('✅ क्लब में शेयर हो गया!');
});

// ==========================================
// ✋ लॉबी सिस्टम (I am ready - Official Style)
// ==========================================
function initGroupLobby(ctx, quizId) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return;
    
    const chatId = ctx.chat.id;
    activeSessions.set(chatId, { quiz, players: new Set(), scores: {}, qIndex: 0, zeroVoteCount: 0, activePoll: null });

    ctx.reply(`🏁 **${quiz.title}**\n${quiz.description}\n\nकुल प्रश्न: ${quiz.questions.length}\n⏱️ टाइमर: 15 सेकंड\n\n**नियम:** शुरू करने के लिए 2 लोगों का तैयार होना ज़रूरी है!`,
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
        ctx.answerCbQuery('✅ आप तैयार हैं! 1 और का इंतज़ार है...');
    }
});

// 🚀 लाइव क्विज इंजन (Auto-Stop & Numbering)
async function sendNextQuestion(chatId) {
    const session = activeSessions.get(Number(chatId));
    if (!session || session.qIndex >= session.quiz.questions.length) return finishQuiz(chatId);

    // 0 वोट पर ऑटो-स्टॉप
    if (session.zeroVoteCount >= 2) {
        bot.telegram.sendMessage(chatId, `🛑 **क्विज ऑटो-स्टॉप!**\nलगातार 2 प्रश्नों का उत्तर न मिलने के कारण क्विज रोक दिया गया।`);
        return finishQuiz(chatId);
    }

    let q = session.quiz.questions[session.qIndex];
    let qText = `[${session.qIndex + 1}/${session.quiz.questions.length}] ${q.question}`;

    try {
        const poll = await bot.telegram.sendQuiz(chatId, qText, q.options, {
            correct_option_id: q.correctId,
            explanation: q.explanation,
            is_anonymous: false, // ताकि व्यू वोट्स दिखे
            open_period: 15
        });
        
        session.activePoll = poll.poll.id;
        session.currentPollVotes = 0;
        
        setTimeout(() => {
            if (session.currentPollVotes === 0) session.zeroVoteCount++;
            else session.zeroVoteCount = 0;
            session.qIndex++;
            sendNextQuestion(chatId);
        }, 16000); 
    } catch (e) { console.log(e); }
}

bot.on('poll_answer', (ctx) => {
    const ans = ctx.pollAnswer;
    activeSessions.forEach((session) => {
        if (session.activePoll === ans.poll_id) {
            session.currentPollVotes++;
            if (!session.scores[ans.user.id]) session.scores[ans.user.id] = { name: ans.user.first_name, score: 0 };
            
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

// ==========================================
// 🎨 PDF इंजन
// ==========================================
function createPDF(type, contentText, filename) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(fs.createWriteStream(filename));

    doc.on('pageAdded', () => {
        doc.fillColor('#F0F0F0').fontSize(50).opacity(0.4)
           .text('Study with CP Rawat Sir', 50, 400, { angle: -45 });
        doc.opacity(1); 
        doc.fillColor('#000080').fontSize(12).text('GK & GS By CP Rawat Sir', 40, 20);
        doc.fillColor('#FF4500').fontSize(10).text('Join: t.me/gkandgs12', 40, 800, { align: 'center' });
    });

    if (type === 'VIP') {
        const colors = ['#FFD700', '#FF6347', '#4682B4', '#32CD32'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        doc.rect(0, 0, 600, 850).fill(randomColor).fillColor('white');
        doc.fontSize(35).text('🌟 Premium Study Material', { align: 'center' });
        doc.moveDown();
        doc.fontSize(20).text('By: Chandrapal Rawat (CP Sir)', { align: 'center' });
        doc.addPage();
        
        doc.rect(40, 40, 515, 750).stroke('#FF4500');
        doc.fillColor('black').fontSize(14).text(contentText, { align: 'justify' });
    } else {
        doc.fillColor('black').fontSize(12).text(contentText);
    }
    doc.end();
}

const app = express();
app.get('/', (req, res) => res.send('CP Rawat Official Marathon Bot Active!'));
app.listen(process.env.PORT || 3000);
bot.launch();

