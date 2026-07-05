import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import 'dotenv/config';

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🗄️ डेटाबेस और मेमोरी मैनेजमेंट
const masterPassword = process.env.MASTER_PASSWORD || 'CP@2026';
const allowedUsers = new Set();
const userStates = {}; 
const tempQueue = {}; 
const myQuizzes = new Map(); 
const activeSessions = new Map(); 
const activeGroups = new Set(); // उन ग्रुप्स की लिस्ट जहाँ बोट काम कर रहा है
let dailyPromoPost = "🌟 Study with CP Rawat Sir!\nसर्वश्रेष्ठ नोट्स व क्विज के लिए हमारे चैनल्स से जुड़ें।";

// 📢 प्रोमो लिंक्स (शानदार इंटरलिंकिंग फॉर्मेट)
const promo1 = "📚 PDF & Notes: @gkandgs12";
const promo2 = "💬 Practice Group: @gkandgs85";
const promo3 = "🏆 Quiz Club: @QuizClub15seconds";
const megaPromo = `\n━━━━━━━━━━━━━━━━━━━\n🌟 𝗦𝘁𝘂𝗱𝘆 𝘄𝗶𝘁𝗵 𝗖𝗣 𝗥𝗮𝘄𝗮𝘁 𝗦𝗶𝗿 🌟\n${promo1}\n${promo2}\n${promo3}`;

// 🛡️ क्रैश-प्रूफ कवच
process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

// 🎛️ मुख्य ऐप-स्टाइल मेनू
const mainMenu = Markup.keyboard([
  ['📝 नया मैराथन बनाएं', '📄 PDF मेकर (VIP / सामान्य)'],
  ['📢 दैनिक पोस्ट सेट करें', '📊 My Quizzes'],
  ['🛑 सिस्टम लॉक करें']
]).resize();

const pdfMenu = Markup.keyboard([
  ['🌟 VIP PDF (वेबसाइट स्टाइल)', '📄 सामान्य PDF (सिंपल)'],
  ['🔙 मुख्य मेनू']
]).resize();

bot.start((ctx) => {
    const payload = ctx.startPayload;
    if (payload && payload.startsWith('quiz_')) {
        activeGroups.add(ctx.chat.id); // ग्रुप को डेटाबेस में जोड़ें
        return initGroupLobby(ctx, payload);
    }
    
    if (allowedUsers.has(ctx.from.id.toString())) {
        ctx.reply('👑 प्रणाम CP Rawat Sir!\nआपका सुपर मैराथन और दैनिक प्रमोशन इंजन पूरी तरह तैयार है। 👇', mainMenu);
    } else {
        ctx.reply('🔒 सुरक्षित सिस्टम! कृपया मास्टर密码 दर्ज करें:');
    }
});

// 🛑 ऑफिशियल स्टॉप कमांड (ग्रुप एडमिन हेतु)
bot.command('stopquiz', async (ctx) => {
    const chatId = ctx.chat.id;
    if (activeSessions.has(chatId)) {
        const chatMember = await ctx.telegram.getChatMember(chatId, ctx.from.id);
        if (chatMember.status === 'administrator' || chatMember.status === 'creator' || allowedUsers.has(ctx.from.id.toString())) {
            finishQuiz(chatId, true); // तुरंत रोकें और रिजल्ट दिखाएं
        } else {
            ctx.reply('❌ केवल ग्रुप एडमिन या सी. पी. रावत सर ही क्विज रोक सकते हैं।');
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

    // दैनिक पोस्ट सेट करने का सिस्टम
    if (text === '📢 दैनिक पोस्ट सेट करें') {
        userStates[userId] = 'SET_DAILY_POST';
        return ctx.reply(`📢 **वर्तमान दैनिक विज्ञापन पोस्ट:**\n\n"${dailyPromoPost}"\n\n✏️ नई पोस्ट सेट करने के लिए टेक्स्ट लिखकर भेजें:`);
    }
    if (userStates[userId] === 'SET_DAILY_POST') {
        dailyPromoPost = text;
        userStates[userId] = '';
        return ctx.reply('✅ दैनिक ऑटो-प्रमोशन पोस्ट सफलतापूर्वक अपडेट हो गई है!', mainMenu);
    }

    // ==========================================
    // 📄 PDF मेकर मोड
    // ==========================================
    if (text === '📄 PDF मेकर (VIP / सामान्य)') return ctx.reply('📄 **PDF मेकर मोड:**', pdfMenu);
    if (text === '🌟 VIP PDF (वेबसाइट स्टाइल)') {
        userStates[userId] = 'AWAITING_VIP_PDF';
        return ctx.reply('🌟 **VIP PDF मोड एक्टिव!** थ्योरी या नोट्स पेस्ट करें:');
    }
    if (text === '📄 सामान्य PDF (सिंपल)') {
        userStates[userId] = 'AWAITING_NORMAL_PDF';
        return ctx.reply('📄 **सामान्य PDF मोड एक्टिव!** सामग्री भेजें:');
    }
    if (userStates[userId] === 'AWAITING_VIP_PDF' || userStates[userId] === 'AWAITING_NORMAL_PDF') {
        const type = userStates[userId] === 'AWAITING_VIP_PDF' ? 'VIP' : 'NORMAL';
        const filename = `CP_Rawat_${Date.now()}.pdf`;
        ctx.reply('⏳ रंग-बिरंगी PDF तैयार हो रही है...');
        createPDF(type, text, filename);
        setTimeout(async () => {
            await ctx.replyWithDocument({ source: filename });
            fs.unlinkSync(filename);
            userStates[userId] = '';
            ctx.reply('✅ PDF सफलतापूर्वक भेज दी गई है!', mainMenu);
        }, 2000);
        return;
    }

    // ==========================================
    // 📝 मैराथन क्विज कतार (Title -> Description -> Queue)
    // ==========================================
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
        userStates[userId] = 'AWAITING_Q';
        const quizId = `quiz_${Date.now()}`;
        myQuizzes.set(quizId, { ...tempQueue[userId], id: quizId, time: 15, shuffleQ: true, shuffleO: false });
        delete tempQueue[userId];
        userStates[userId] = `EDITING_${quizId}`;
        return ctx.reply(`🚀 **मैराथन इंजन एक्टिव!**\n\nअब अपने प्रश्न (✅ और व्याख्या के साथ) भेजें। जब सारे प्रश्न लोड हो जाएं, तो नीचे दिया बटन दबाएं:`,
            Markup.inlineKeyboard([[Markup.button.callback('✅ सेट पूरा हुआ (Finish)', `settings_${quizId}`)]])
        );
    }

    // प्रश्न कतार में जोड़ना या एडिट (Append) करना
    if (userStates[userId] && userStates[userId].startsWith('EDITING_') && text.includes('✅')) {
        const quizId = userStates[userId].replace('EDITING_', '');
        return queueQuestions(ctx, text, quizId);
    }

    next();
});

// 🧠 प्रश्नों को पार्स करना और कतार में जोड़ना (Append Mode)
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
            
            // 🔄 प्रोमो इंटरलिंकिंग
            if ((qIndex + 1) % 15 === 0) finalExp += megaPromo;
            else if ((qIndex + 1) % 5 === 0) finalExp += `\n\n${promo1}`;
            else if ((qIndex + 1) % 6 === 0) finalExp += `\n\n${promo2}`;

            quiz.questions.push({ question, options, correctId, explanation: finalExp.substring(0, 195) });
            added++;
        }
    }
    ctx.reply(`📥 **${added} नए प्रश्न कतार में जुड़े!** (कुल मैराथन प्रश्न: ${quiz.questions.length})\nऔर प्रश्न भेजते रहें या फाइनल करने के लिए नीचे बटन दबाएं:`,
        Markup.inlineKeyboard([[Markup.button.callback('✅ सेट पूरा हुआ (Finish)', `settings_${quizId}`)]])
    );
}

// ⚙️ सेटिंग्स पैनल (Timer, Shuffle & Edit)
bot.action(/settings_(.+)/, (ctx) => {
    const quizId = ctx.match[1];
    const quiz = myQuizzes.get(quizId);
    userStates[ctx.from.id.toString()] = ''; // कतार रोके

    ctx.editMessageText(`⚙️ **मैराथन डैशबोर्ड**\n\n📌 **टाइटल:** ${quiz.title}\n📊 **कुल प्रश्न:** ${quiz.questions.length}\n⏱️ **टाइमर:** ${quiz.time} सेकंड\n🔀 **शफल:** ${quiz.shuffleQ ? 'चालू' : 'बंद'}\n\nनीचे से सेटिंग्स बदलें या प्रश्न और जोड़ें:`,
        Markup.inlineKeyboard([
            [Markup.button.callback(`⏱️ टाइमर बदलें (${quiz.time}s)`, `toggletime_${quizId}`)],
            [Markup.button.callback(`🔀 शफल: ${quiz.shuffleQ ? 'ON' : 'OFF'}`, `toggleshuf_${quizId}`), Markup.button.callback('✏️ और प्रश्न जोड़ें (Edit)', `editmore_${quizId}`)],
            [Markup.button.url('🚀 ग्रुप में चलाएं (Start Group)', `https://t.me/${ctx.botInfo.username}?startgroup=${quizId}&admin=post_messages`)],
            [Markup.button.callback('📢 ऑटो-शेयर (क्लब)', `shareclub_${quizId}`)]
        ])
    );
});

// सेटिंग्स टॉगल बटन्स के एक्शन्स
bot.action(/toggletime_(.+)/, (ctx) => {
    const quizId = ctx.match[1];
    const quiz = myQuizzes.get(quizId);
    quiz.time = quiz.time === 15 ? 30 : quiz.time === 30 ? 60 : 15; // 15s -> 30s -> 60s
    ctx.answerCbQuery(`⏱️ टाइमर ${quiz.time}s सेट हुआ!`);
    bot.handleUpdate({ callback_query: { data: `settings_${quizId}`, from: ctx.from } }); // रिफ्रेश पैनल
});

bot.action(/toggleshuf_(.+)/, (ctx) => {
    const quizId = ctx.match[1];
    const quiz = myQuizzes.get(quizId);
    quiz.shuffleQ = !quiz.shuffleQ;
    ctx.answerCbQuery(`🔀 शफल ${quiz.shuffleQ ? 'चालू' : 'बंद'} हुआ!`);
    bot.handleUpdate({ callback_query: { data: `settings_${quizId}`, from: ctx.from } });
});

bot.action(/editmore_(.+)/, (ctx) => {
    const quizId = ctx.match[1];
    userStates[ctx.from.id.toString()] = `EDITING_${quizId}`;
    ctx.reply('✏️ **एडिट मोड एक्टिव!** अब आप जो भी प्रश्न भेजेंगे, वे इसी क्विज के आगे जुड़ते जाएंगे। पूरा होने पर फिर से "सेट पूरा हुआ" दबाएं।');
    ctx.answerCbQuery();
});

bot.action(/shareclub_(.+)/, async (ctx) => {
    const quizId = ctx.match[1];
    await ctx.telegram.sendMessage('@QuizClub15seconds', `🔥 **नया लाइव मैराथन!**\n\nCP Rawat Sir ने नया क्विज सेट किया है। नीचे क्लिक करें!`,
        Markup.inlineKeyboard([[Markup.button.url('👉 क्विज शुरू करें', `https://t.me/${ctx.botInfo.username}?start=${quizId}`)]])
    );
    ctx.answerCbQuery('✅ क्लब में शेयर हो गया!');
});

// ==========================================
// ✋ लॉबी & लाइव क्विज इंजन (100% सटीक एडमिन चेकर)
// ==========================================
function initGroupLobby(ctx, quizId) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.reply('❌ यह क्विज सर्वर पर उपलब्ध नहीं है।');
    
    const chatId = ctx.chat.id;
    
    // शफलिंग लॉजिक
    let finalQuestions = [...quiz.questions];
    if (quiz.shuffleQ) finalQuestions.sort(() => Math.random() - 0.5);

    activeSessions.set(chatId, { quiz, questions: finalQuestions, players: new Set(), scores: {}, qIndex: 0, zeroVoteCount: 0, activePoll: null, timerObj: null });

    ctx.reply(`🏁 **मैराथन: ${quiz.title}**\n${quiz.description}\n\n📊 कुल प्रश्न: ${finalQuestions.length}\n⏱️ टाइमर: ${quiz.time} सेकंड\n\n👉 शुरू करने के लिए 2 छात्रों का 'I am ready' दबाना अनिवार्य है!`,
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
        await ctx.editMessageText(`🚀 **लॉबी तैयार! क्विज 3 सेकंड में शुरू हो रहा है...**\n\n${megaPromo}`);
        setTimeout(() => sendNextQuestion(chatId), 3000);
    } else {
        ctx.editMessageReplyMarkup({ inline_keyboard: [[Markup.button.callback(`✋ I am ready (${count}/2)`, `ready_${chatId}`)]] });
        ctx.answerCbQuery('✅ आप तैयार हैं!');
    }
});

async function sendNextQuestion(chatId) {
    const session = activeSessions.get(chatId);
    if (!session || session.qIndex >= session.questions.length) return finishQuiz(chatId, false);

    if (session.zeroVoteCount >= 2) {
        bot.telegram.sendMessage(chatId, `🛑 **ऑटो-स्टॉप:** लगातार 2 प्रश्नों का उत्तर किसी ने नहीं दिया, इसलिए मैराथन रोक दी गई है।`);
        return finishQuiz(chatId, false);
    }

    let q = session.questions[session.qIndex];
    let qText = `[${session.qIndex + 1}/${session.questions.length}] ${q.question}`;

    try {
        const poll = await bot.telegram.sendQuiz(chatId, qText, q.options, {
            correct_option_id: q.correctId,
            explanation: q.explanation,
            is_anonymous: false, // खिलाड़ियों के नाम स्कोर में आने के लिए
            open_period: session.quiz.time
        });
        
        session.activePoll = poll.poll.id;
        session.currentPollVotes = 0;
        
        session.timerObj = setTimeout(() => {
            if (session.currentPollVotes === 0) session.zeroVoteCount++;
            else session.zeroVoteCount = 0;
            session.qIndex++;
            sendNextQuestion(chatId);
        }, (session.quiz.time + 1) * 1000); 
    } catch (e) { 
        console.log("Admin Check Bypass Error Handler: ", e.message);
        // अगर प्राइवेसी एरर आए तो एनोनिमस भेजें
        const poll = await bot.telegram.sendQuiz(chatId, qText, q.options, {
            correct_option_id: q.correctId,
            explanation: q.explanation,
            is_anonymous: true,
            open_period: session.quiz.time
        });
        session.activePoll = poll.poll.id;
    }
}

bot.on('poll_answer', (ctx) => {
    const ans = ctx.pollAnswer;
    activeSessions.forEach((session) => {
        if (session.activePoll === ans.poll_id) {
            session.currentPollVotes++;
            if (!session.scores[ans.user.id]) session.scores[ans.user.id] = { name: ans.user.first_name, score: 0 };
            const q = session.questions[session.qIndex];
            if (ans.option_ids[0] === q.correctId) {
                session.scores[ans.user.id].score++;
            }
        }
    });
});

function finishQuiz(chatId, wasForced) {
    const session = activeSessions.get(chatId);
    if (!session) return;
    
    if (session.timerObj) clearTimeout(session.timerObj);
    
    let results = Object.values(session.scores).sort((a, b) => b.score - a.score).slice(0, 50);
    let leaderboard = wasForced ? `🛑 **क्विज को बीच में ही रोक दिया गया है!**\n\n📊 **फाइनल लीडरबोर्ड (Top 50):**\n` : `🏁 **मैराथन '${session.quiz.title}' समाप्त!**\n\n📊 **लीडरबोर्ड (Top 50):**\n`;
    
    if (results.length === 0) {
        leaderboard += "😔 किसी भी छात्र ने सही उत्तर नहीं दिया।";
    } else {
        const medals = ['🥇', '🥈', '🥉'];
        results.forEach((r, i) => {
            let rank = i < 3 ? medals[i] : `🎗 ${i+1}.`;
            leaderboard += `${rank} ${r.name} – ${r.score} सही जवाब\n`;
        });
    }
    
    bot.telegram.sendMessage(chatId, `${leaderboard}\n${megaPromo}`);
    activeSessions.delete(chatId);
}

// ==========================================
// 📢 दैनिक ऑटो-पोस्ट ब्रॉडकास्ट इंजन (हर 24 घंटे में)
// ==========================================
setInterval(() => {
    console.log("दैनिक विज्ञापन ब्रॉडकास्ट चालू हो रहा है...");
    activeGroups.forEach(async (chatId) => {
        try {
            await bot.telegram.sendMessage(chatId, dailyPromoPost);
        } catch (err) {
            console.log(`ग्रुप ${chatId} में पोस्ट नहीं जा सकी (बोट रिमूव हो चुका है)`);
            activeGroups.delete(chatId);
        }
    });
}, 24 * 60 * 60 * 1000); // सटीक 24 घंटे का चक्र

// ==========================================
// 🎨 वेबसाइट स्टाइल PDF मेकर इंजन
// ==========================================
function createPDF(type, contentText, filename) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(fs.createWriteStream(filename));

    doc.on('pageAdded', () => {
        doc.fillColor('#F0F0F0').fontSize(50).opacity(0.4)
           .text('Study with CP Rawat Sir', 50, 400, { angle: -45 });
        doc.opacity(1); 
        doc.fillColor('#000080').fontSize(12).text('GK & GS By CP Rawat Sir | MP TET', 40, 20);
        doc.fillColor('#FF4500').fontSize(10).text('चैनल से जुड़ें: t.me/gkandgs12', 40, 800, { align: 'center' });
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
app.get('/', (req, res) => res.send('CP Rawat Super Marathon Active!'));
app.listen(process.env.PORT || 3000);
bot.launch();
