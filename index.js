import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import 'dotenv/config';

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🗄️ मेमोरी और एक्सेस डेटाबेस
const masterPassword = process.env.MASTER_PASSWORD || 'CP@2026';
const masterId = process.env.MASTER_ID || ''; // आपका अपना टेलीग्राम ID (ताकि आपको पासवर्ड न डालना पड़े)
const allowedUsers = new Set([masterId]); // जिन लोगों को परमिशन मिलेगी
const myQuizzes = new Map(); // आपके बनाए गए क्विज सेव रखने के लिए

// 📢 आपकी इंटरलिंकिंग (Promo Links)
const promoLinks = [
    '📢 चैनल: https://t.me/gkandgs12',
    '💬 ग्रुप: https://t.me/gkandgs85',
    '🏆 क्विज: https://t.me/QuizClub15seconds'
];
const defaultAutoShareChannel = '@QuizClub15seconds';

// 🛡️ क्रैश-प्रूफ सिस्टम
process.on('uncaughtException', (err) => console.log('क्रैश रोका गया:', err.message));
process.on('unhandledRejection', (reason) => console.log('प्रॉमिस एरर रोका गया:', reason));

// 🎛️ मुख्य मेनू (App Style)
const mainMenu = Markup.keyboard([
  ['📝 लाइव क्विज (Bulk Mode)', '📄 PDF मेकर (VIP / सामान्य)'],
  ['⚙️ ग्रुप सेटिंग', '📊 My Quizzes'],
  ['🛑 सिस्टम लॉक करें']
]).resize();

const pdfMenu = Markup.keyboard([
  ['🌟 VIP PDF (वेबसाइट स्टाइल)', '📄 सामान्य PDF (सिंपल)'],
  ['🔙 मुख्य मेनू']
]).resize();

// 🚀 बोट स्टार्ट कमांड
bot.start((ctx) => {
    const userId = ctx.from.id.toString();
    const payload = ctx.startPayload; // डीप लिंक से आने वाले क्विज के लिए

    // अगर कोई यूजर डीप-लिंक (Start in Group) से आया है
    if (payload && payload.startsWith('quiz_')) {
        return handleDeepLinkQuiz(ctx, payload);
    }

    if (allowedUsers.has(userId) || userId === masterId) {
        ctx.reply('👑 प्रणाम CP Rawat Sir!\nआपका एडवांस क्विज और PDF सिस्टम पूरी तरह रेडी है। 👇', mainMenu);
    } else {
        ctx.reply('🔒 सुरक्षित सिस्टम! कृपया मास्टर पासवर्ड दर्ज करें:');
    }
});

// 👥 एडमिन जोड़ने का कमांड (सिर्फ आप कर सकते हैं)
bot.command('addadmin', (ctx) => {
    const userId = ctx.from.id.toString();
    if (userId !== masterId && !allowedUsers.has(userId)) return;

    const text = ctx.message.text.split(' ');
    if (text.length === 2 && !isNaN(text[1])) {
        allowedUsers.add(text[1]);
        ctx.reply(`✅ यूज़र ID ${text[1]} को सिस्टम का एक्सेस दे दिया गया है!`);
    } else {
        ctx.reply('❌ गलत फॉर्मेट! कृपया ऐसे लिखें: /addadmin 123456789');
    }
});

// 🔐 पासवर्ड और टेक्स्ट हैंडलर
bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    // पासवर्ड चेकिंग
    if (text === masterPassword) {
        allowedUsers.add(userId);
        return ctx.reply('✅ एक्सेस ग्रांटेड! स्वागत है सर।', mainMenu);
    }
    if (!allowedUsers.has(userId) && userId !== masterId) return;

    // मेनू नेविगेशन
    if (text === '🔙 मुख्य मेनू') return ctx.reply('🔙 मुख्य मेनू:', mainMenu);
    if (text === '📄 PDF मेकर (VIP / सामान्य)') return ctx.reply('📄 **PDF मेकर मोड:**', pdfMenu);
    
    if (text === '🌟 VIP PDF (वेबसाइट स्टाइल)') {
        return ctx.reply('🌟 **VIP PDF मोड:**\nमैटर भेजें। यह आपके ब्लॉग जैसी 50-60 रैंडम कलर थीम और शानदार बॉक्स के साथ बनेगी।');
    }
    if (text === '📄 सामान्य PDF (सिंपल)') {
        return ctx.reply('📄 **सामान्य PDF मोड:**\nमैटर भेजें। यह सिंपल और क्लीन बनेगी।');
    }
    
    if (text === '📝 लाइव क्विज (Bulk Mode)') {
        return ctx.reply('📝 **लाइव क्विज (बल्क मेकर):**\nअपने 100-200 प्रश्न (✅ लगाकर) पेस्ट करें। मैं सेट बनाकर आपको शेयर और ऑटो-पोस्ट के बटन दूँगा।');
    }

    // 💡 अगर बल्क प्रश्न भेजे गए हैं (क्विज सेट जनरेटर)
    if (text.includes('✅') && text.length > 50) {
        return processBulkQuiz(ctx, text, userId);
    }

    next();
});

// ==========================================
// 🧠 कोर इंजन: बल्क क्विज और इंटरलिंकिंग
// ==========================================
async function processBulkQuiz(ctx, text, userId) {
    const rawQuestions = text.split(/(?=Q\.|Q\s|प्रश्न\s|प्र\.)/i);
    let parsed = [];
    let promoIndex = 0;

    for (let i = 0; i < rawQuestions.length; i++) {
        if (rawQuestions[i].trim().length < 10) continue;
        
        let qData = { text: rawQuestions[i], hasPromo: false };
        
        // 🔄 इंटरलिंकिंग लॉजिक (हर 5 प्रश्नों के बाद प्रोमो लिंक डालना)
        if ((parsed.length + 1) % 5 === 0) {
            qData.promo = promoLinks[promoIndex % promoLinks.length];
            qData.hasPromo = true;
            promoIndex++;
        }
        parsed.push(qData);
    }

    if (parsed.length > 0) {
        const quizId = `quiz_${Date.now()}`;
        myQuizzes.set(quizId, { owner: userId, questions: parsed, count: parsed.length });

        // 🔗 शेयरिंग, एडिट और ऑटो-सेंड बटन्स (Official Style)
        const quizMenu = Markup.inlineKeyboard([
            [Markup.button.url('↗️ ग्रुप में चलाएं (Start in Group)', `https://t.me/${ctx.botInfo.username}?startgroup=${quizId}`)],
            [Markup.button.callback('📢 ऑटो-शेयर (क्लब में भेजें)', `autoshare_${quizId}`)],
            [Markup.button.callback('✏️ एडिट करें', `edit_${quizId}`), Markup.button.callback('❌ डिलीट करें', `del_${quizId}`)]
        ]);

        ctx.reply(`✅ **नया क्विज सेट तैयार!**\nकुल प्रश्न: ${parsed.length}\nक्विज ID: #${quizId}\n(हर 5वें प्रश्न में लिंक इंटरलिंकिंग सेट कर दी गई है)`, quizMenu);
    }
}

// 🎯 ऑटो-शेयर बटन का एक्शन (क्लब चैनल में भेजने के लिए)
bot.action(/autoshare_(.+)/, async (ctx) => {
    const quizId = ctx.match[1];
    const quizData = myQuizzes.get(quizId);
    
    if (quizData) {
        await ctx.telegram.sendMessage(defaultAutoShareChannel, `🔥 **नया लाइव क्विज!**\nCP Rawat Sir द्वारा तैयार ${quizData.count} महत्वपूर्ण प्रश्न।\nनीचे दिए गए बटन से अभी शुरू करें!`, 
            Markup.inlineKeyboard([Markup.button.url('👉 क्विज शुरू करें', `https://t.me/${ctx.botInfo.username}?start=${quizId}`)])
        );
        ctx.answerCbQuery('✅ क्विज सफलतापूर्वक क्लब चैनल में भेज दिया गया है!');
    }
});

// ==========================================
// 🎨 कोर इंजन: VIP PDF और सामान्य PDF
// ==========================================
function createPDF(type, contentText, filename) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(fs.createWriteStream(filename));

    // 💧 वाटरमार्क (हर पेज पर)
    doc.on('pageAdded', () => {
        doc.fillColor('#F0F0F0').fontSize(50).opacity(0.4)
           .text('Study with CP Rawat Sir', 50, 400, { angle: -45 });
        doc.opacity(1); // अपारदर्शिता (Opacity) वापस नॉर्मल
        
        // हेडर (Header)
        doc.fillColor('#000080').fontSize(12).text('GK & GS By CP Rawat Sir | MP TET & Board Exams', 40, 20);
        // फुटर (Footer)
        doc.fillColor('#FF4500').fontSize(10).text('Subscribe: https://t.me/gkandgs12', 40, 800, { align: 'center' });
    });

    if (type === 'VIP') {
        // 🌟 VIP वेबसाइट पैटर्न (50-60 पैटर्न के लिए रैंडम कलर जनरेटर)
        const colors = ['#FFD700', '#FF6347', '#4682B4', '#32CD32', '#8A2BE2'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        // कवर पेज डिज़ाइन
        doc.rect(0, 0, 600, 850).fill(randomColor).fillColor('white');
        doc.fontSize(35).text('🌟 Premium Study Material', { align: 'center' });
        doc.moveDown();
        doc.fontSize(20).text('By: Chandrapal Rawat (CP Sir)', { align: 'center' });
        doc.addPage();
        
        // कंटेंट को हाईलाइट और बॉक्स में रखना
        doc.rect(40, 40, 515, 750).stroke('#FF4500'); // बॉर्डर
        doc.fillColor('black').fontSize(14).text(contentText, { align: 'justify' });
    } else {
        // 📄 सामान्य PDF
        doc.fillColor('black').fontSize(12).text(contentText);
    }
    doc.end();
}

// 🌐 24/7 वेब सर्वर
const app = express();
app.get('/', (req, res) => res.send('CP Rawat Master EdTech Engine Active!'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 Ultimate Smart Bot Launched!'));

