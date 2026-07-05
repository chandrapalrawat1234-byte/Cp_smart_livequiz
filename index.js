import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import 'dotenv/config';

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🗄️ डेटाबेस और मेमोरी
const masterPassword = process.env.MASTER_PASSWORD || 'CP@2026';
const allowedUsers = new Set();
const userStates = {}; // यह ट्रैक करेगा कि बोट अभी टाइटल मांग रहा है या प्रश्न
const tempQuizData = {}; // मैराथन प्रश्नों की कतार
const myQuizzes = new Map(); // सेव किए गए क्विज

// 📢 VIP प्रोमोशनल लिंक्स (शानदार फॉर्मेट में)
const promoLinks = [
    '📚 𝗝𝗼𝗶𝗻 𝗠𝗮𝗶𝗻 𝗖𝗵𝗮𝗻𝗻𝗲𝗹:\n👉 https://t.me/gkandgs12',
    '💬 𝗝𝗼𝗶𝗻 𝗣𝗿𝗮𝗰𝘁𝗶𝗰𝗲 𝗚𝗿𝗼𝘂𝗽:\n👉 https://t.me/gkandgs85',
    '🏆 𝗝𝗼𝗶𝗻 𝗤𝘂𝗶𝘇 𝗖𝗹𝘂𝗯:\n👉 https://t.me/QuizClub15seconds'
];

const megaPromo = `\n\n🌟 𝗦𝘁𝘂𝗱𝘆 𝘄𝗶𝘁𝗵 𝗖𝗣 𝗥𝗮𝘄𝗮𝘁 𝗦𝗶𝗿 🌟\n━━━━━━━━━━━━━━━━━━━\n📚 चैनल: t.me/gkandgs12\n💬 प्रैक्टिस: t.me/gkandgs85\n🏆 क्विज: t.me/QuizClub15seconds`;

// 🛡️ क्रैश-प्रूफ
process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

// 🎛️ मेनू
const mainMenu = Markup.keyboard([
  ['📝 नया लाइव क्विज (मैराथन)', '📄 PDF मेकर (VIP / सामान्य)'],
  ['⚙️ ग्रुप सेटिंग', '📊 My Quizzes'],
  ['🛑 सिस्टम लॉक करें']
]).resize();

const pdfMenu = Markup.keyboard([
  ['🌟 VIP PDF (वेबसाइट स्टाइल)', '📄 सामान्य PDF (सिंपल)'],
  ['🔙 मुख्य मेनू']
]).resize();

bot.start((ctx) => {
    const payload = ctx.startPayload;
    if (payload && payload.startsWith('quiz_')) {
        return startQuizInGroup(ctx, payload);
    }
    
    if (allowedUsers.has(ctx.from.id.toString())) {
        ctx.reply('👑 प्रणाम CP Rawat Sir!\nआपका सुपर मैराथन सिस्टम तैयार है। 👇', mainMenu);
    } else {
        ctx.reply('🔒 कृपया मास्टर पासवर्ड दर्ज करें:');
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
    if (!allowedUsers.has(userId)) return;

    // मेनू
    if (text === '🔙 मुख्य मेनू') {
        userStates[userId] = '';
        return ctx.reply('🔙 मुख्य मेनू:', mainMenu);
    }
    
    // नया क्विज शुरू करना (टाइटल पूछना)
    if (text === '📝 नया लाइव क्विज (मैराथन)') {
        userStates[userId] = 'AWAITING_TITLE';
        return ctx.reply('📝 **नया क्विज बन रहा है...**\nकृपया इस क्विज का **टाइटल (Title)** लिखकर भेजें:');
    }

    // स्टेट मशीन: टाइटल -> डिस्क्रिप्शन -> प्रश्न कतार
    if (userStates[userId] === 'AWAITING_TITLE') {
        tempQuizData[userId] = { title: text, description: '', questions: [] };
        userStates[userId] = 'AWAITING_DESC';
        return ctx.reply('✅ टाइटल सेट हो गया।\nअब इसका **डिस्क्रिप्शन (Description)** लिखकर भेजें:');
    }

    if (userStates[userId] === 'AWAITING_DESC') {
        tempQuizData[userId].description = text;
        userStates[userId] = 'AWAITING_QUESTIONS';
        return ctx.reply(`✅ डिस्क्रिप्शन सेट हो गया!\n\n🚀 **मैराथन कतार चालू है!**\nअब आप अपने प्रश्न (✅ और व्याख्या के साथ) भेजना शुरू करें।\nआप चाहें तो 100-100 करके कई बार भेज सकते हैं। मैं सब जोड़ता रहूँगा।\n\nजब सारे प्रश्न डल जाएं, तो नीचे दिया गया बटन दबाएं।`, 
            Markup.inlineKeyboard([Markup.button.callback('✅ सेट पूरा हुआ (Finish)', 'finish_quiz')])
        );
    }

    // अगर यूजर प्रश्न भेज रहा है (कतार मोड)
    if (userStates[userId] === 'AWAITING_QUESTIONS' && text.includes('✅')) {
        return parseAndQueueQuestions(ctx, text, userId);
    }

    // PDF मेनू
    if (text === '📄 PDF मेकर (VIP / सामान्य)') return ctx.reply('📄 **PDF मेकर मोड:**', pdfMenu);
    if (text === '🌟 VIP PDF (वेबसाइट स्टाइल)' || text === '📄 सामान्य PDF (सिंपल)') {
        return ctx.reply('यह फीचर अभी अगले अपडेट में पूरी तरह कॉन्फ़िगर होगा। अभी क्विज सिस्टम चेक करें!');
    }

    next();
});

// ==========================================
// 🧠 कोर इंजन: व्याख्या, कतार और प्रोमो
// ==========================================
async function parseAndQueueQuestions(ctx, text, userId) {
    const rawQuestions = text.split(/(?=Q\.|Q\s|प्रश्न\s|प्र\.)/i);
    let newQuestionsCount = 0;

    for (const rawQ of rawQuestions) {
        if (rawQ.trim().length < 10) continue;
        
        const lines = rawQ.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let question = lines[0];
        let options = [];
        let correctOptionId = -1;
        let explanationText = "";

        // व्याख्या और ऑप्शन छांटना
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.toLowerCase().startsWith('व्याख्या:') || line.toLowerCase().startsWith('explain:')) {
                explanationText = line.replace(/व्याख्या:|explain:/i, '').trim();
                break; // व्याख्या मिल गई तो लूप रोकें
            }
            if (line.match(/^[A-D]\)|^[A-D]\.|^[1-4]\)|^[1-4]\./i)) {
                let cleanOption = line.replace(/^[A-D]\)|^[A-D]\.|^[1-4]\)|^[1-4]\./i, '').trim();
                if (line.includes('✅')) {
                    cleanOption = cleanOption.replace('✅', '').trim();
                    correctOptionId = options.length;
                }
                options.push(cleanOption);
            }
        }

        if (options.length >= 2 && correctOptionId !== -1) {
            // इंटरलिंकिंग (हर प्रश्न में अल्टरनेट लिंक या मेगा प्रोमो)
            let currentQIndex = tempQuizData[userId].questions.length;
            let finalExplanation = explanationText;
            
            if ((currentQIndex + 1) % 10 === 0) {
                finalExplanation += megaPromo; // हर 10वें प्रश्न पर मेगा प्रोमो
            } else if ((currentQIndex + 1) % 3 === 0) {
                finalExplanation += `\n\n${promoLinks[currentQIndex % 3]}`; // हर तीसरे प्रश्न पर अल्टरनेट लिंक
            }

            if (finalExplanation.length > 190) {
                finalExplanation = finalExplanation.substring(0, 180) + '...\n' + megaPromo;
            }

            tempQuizData[userId].questions.push({
                question, options, correctOptionId, explanation: finalExplanation
            });
            newQuestionsCount++;
        }
    }

    const totalInQueue = tempQuizData[userId].questions.length;
    ctx.reply(`📥 **${newQuestionsCount} नए प्रश्न कतार में जुड़ गए!**\n(कुल जमा प्रश्न: ${totalInQueue})\n\nऔर प्रश्न भेजें या काम खत्म होने पर 'सेट पूरा हुआ' दबाएं।`, 
        Markup.inlineKeyboard([Markup.button.callback('✅ सेट पूरा हुआ (Finish)', 'finish_quiz')])
    );
}

// 🏁 जब सेट पूरा हो जाए
bot.action('finish_quiz', (ctx) => {
    const userId = ctx.from.id.toString();
    const data = tempQuizData[userId];

    if (!data || data.questions.length === 0) {
        return ctx.answerCbQuery('❌ कतार खाली है!', { show_alert: true });
    }

    const quizId = `quiz_${Date.now()}`;
    myQuizzes.set(quizId, { ...data, owner: userId, count: data.questions.length });
    
    // कतार साफ करें
    userStates[userId] = '';
    delete tempQuizData[userId];

    const quizMenu = Markup.inlineKeyboard([
        [Markup.button.url('↗️ ग्रुप में चलाएं (Start in Group)', `https://t.me/${ctx.botInfo.username}?startgroup=${quizId}`)],
        [Markup.button.callback('✏️ और प्रश्न जोड़ें (Edit)', `addmore_${quizId}`)]
    ]);

    ctx.editMessageText(`🎉 **मैराथन क्विज सेट शानदार तरीके से तैयार है!**\n\n📌 **टाइटल:** ${data.title}\n📝 **विवरण:** ${data.description}\n📊 **कुल प्रश्न:** ${data.count}\n🆔 **क्विज ID:** #${quizId}\n\nनीचे दिए गए बटन से इसे किसी भी ग्रुप में चलाएं:`, quizMenu);
});

// 🚀 ग्रुप में क्विज चलाने का फंक्शन
async function startQuizInGroup(ctx, quizId) {
    const quizData = myQuizzes.get(quizId);
    if (!quizData) return ctx.reply('❌ यह क्विज अब उपलब्ध नहीं है।');

    ctx.reply(`🔥 **${quizData.title}** शुरू हो रहा है!\n${quizData.description}\n\nकुल प्रश्न: ${quizData.count}\nसौजन्य से: CP Rawat Sir`);
    
    // यहाँ हम एक-एक करके ग्रुप में पोल भेजेंगे (हर 10-15 सेकंड में)
    let i = 0;
    const interval = setInterval(async () => {
        if (i >= quizData.questions.length) {
            clearInterval(interval);
            return ctx.reply(`🏆 **क्विज समाप्त!**\nउम्मीद है आपने बेहतरीन प्रदर्शन किया होगा।\n${megaPromo}`);
        }
        const q = quizData.questions[i];
        try {
            await ctx.telegram.sendQuiz(ctx.chat.id, q.question, q.options, {
                correct_option_id: q.correctOptionId,
                explanation: q.explanation,
                is_anonymous: false // ताकि लोगों को अपना रिजल्ट दिखे
            });
        } catch (err) { console.log('Poll Error:', err.message); }
        i++;
    }, 15000); // 15 सेकंड का गैप
}

// 🌐 सर्वर
const app = express();
app.get('/', (req, res) => res.send('CP Rawat Marathon Engine Active!'));
app.listen(process.env.PORT || 3000);
bot.launch();
