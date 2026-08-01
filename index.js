import { Telegraf, Markup } from 'telegraf';
import express from 'express';
import 'dotenv/config';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🗄️ मेमोरी और डेटाबेस
const allowedUsers = new Set([process.env.MASTER_ID || '']); 
const masterPassword = process.env.MASTER_PASSWORD || 'CP@2026';
const userStates = {}; 
const tempQueue = {}; 
const myQuizzes = new Map(); 
const activeSessions = new Map(); 
const activeGroups = new Set(); 

let requireAdmin = false; 
const BACKUP_CHANNEL_ID = process.env.BACKUP_CHANNEL_ID || ''; 
const CP_RAWAT_PHOTO_URL = 'https://i.ibb.co/twFTbpqq/1757043567213.png'; 

const links = [
    { text: "📚 Join Notes Channel", url: "https://t.me/gkandgs12", desc: "📚 सी. पी. रावत सर के नोट्स के लिए यहाँ क्लिक करें" },
    { text: "💬 Join Practice Group", url: "https://t.me/gkandgs85", desc: "💬 अपने प्रश्न पूछने और डिस्कशन के लिए यहाँ क्लिक करें" },
    { text: "🏆 Join Quiz Club", url: "https://t.me/QuizClub15seconds", desc: "🏆 डेली लाइव क्विज और लीडरबोर्ड के लिए यहाँ क्लिक करें" }
];

const singlePromos = [
    "🌟 <b>सटीक नोट्स और बेहतरीन तैयारी के लिए!</b> 🌟\n━━━━━━━━━━━━━━━━━━━━\n🔥 <i>क्या आप अपनी तैयारी को लेकर गंभीर हैं?</i>\nसही दिशा और सटीक मार्गदर्शन ही सफलता की एकमात्र कुंजी है!",
    "🚀 <b>MISSION GOVT JOB 2026</b> 🚀\n━━━━━━━━━━━━━━━━━━━━\n📚 <i>परीक्षा का पैटर्न तेजी से बदल रहा है!</i> \nक्या आप अपडेटेड हैं? CP Rawat Sir के विशेष मार्गदर्शन में तैयारी करें।",
    "🏆 <b>खुद को परखें, सबसे आगे बढ़ें!</b> 🏆\n━━━━━━━━━━━━━━━━━━━━\n⚡ <i>सिर्फ पढ़ने से काम नहीं चलेगा!</i>\nप्रैक्टिस और टाइम मैनेजमेंट सबसे ज्यादा जरूरी है!"
];

const megaPromoDesc = [
    "🌟 <b>नोट्स और स्टडी मटेरियल का खजाना!</b> 🌟\n━━━━━━━━━━━━━━━━━━━━\nसभी महत्वपूर्ण विषयों के हस्तलिखित नोट्स और पीडीएफ के लिए हमारे मुख्य चैनल से जुड़ना न भूलें。\n\n👇 <b>सफलता सुनिश्चित करने के लिए हमारे सभी चैनल्स से जुड़ें:</b>\n\n📚 <b>Notes Channel:</b> https://t.me/gkandgs12\n💬 <b>Practice Group:</b> https://t.me/gkandgs85\n🏆 <b>Quiz Club:</b> https://t.me/QuizClub15seconds"
];

let dailyPromoPost = "🌟 <b>Study with CP Rawat Sir</b> 🌟\n\n🔥 <i>सरकारी नौकरी की पक्की तैयारी के लिए आज ही जुड़ें!</i>\n👇 <b>नीचे दिए गए लिंक्स से हमारे चैनल्स जॉइन करें:</b>";
let promoIntervalHours = 12; 
let promoIntervalId = null;

process.on('uncaughtException', (err) => console.log('Error:', err.message));
process.on('unhandledRejection', (reason) => console.log('Promise Error:', reason));

// ==========================================
// 🔄 AUTO BACKUP SYSTEM
// ==========================================
let lastBackupMsgId = null;
async function saveBackup() {
    if (!BACKUP_CHANNEL_ID) return;
    try {
        const data = JSON.stringify(Array.from(myQuizzes.entries()));
        const buffer = Buffer.from(data, 'utf-8');
        const msg = await bot.telegram.sendDocument(
            BACKUP_CHANNEL_ID, 
            { source: buffer, filename: 'quiz_backup.json' }, 
            { caption: `🔄 Auto-Backup: ${new Date().toLocaleString()}` }
        );
        await bot.telegram.pinChatMessage(BACKUP_CHANNEL_ID, msg.message_id);
        if (lastBackupMsgId) { try { await bot.telegram.deleteMessage(BACKUP_CHANNEL_ID, lastBackupMsgId); } catch(e){} }
        lastBackupMsgId = msg.message_id;
    } catch (err) {}
}

async function loadBackup() {
    if (!BACKUP_CHANNEL_ID) return;
    try {
        const chat = await bot.telegram.getChat(BACKUP_CHANNEL_ID);
        if (chat.pinned_message && chat.pinned_message.document) {
            const fileId = chat.pinned_message.document.file_id;
            const link = await bot.telegram.getFileLink(fileId);
            const response = await fetch(link.href);
            const data = await response.json();
            myQuizzes.clear();
            for (const [key, value] of data) { myQuizzes.set(key, value); }
            lastBackupMsgId = chat.pinned_message.message_id;
        }
    } catch (err) {}
}

bot.on('channel_post', (ctx) => {
    if (ctx.channelPost.text === '/getid') {
        ctx.reply(`✅ इस चैनल की ID है:\n\n<code>${ctx.chat.id}</code>\n\nइसे कॉपी करें और अपने कोड में BACKUP_CHANNEL_ID की जगह पर डाल दें!`, { parse_mode: 'HTML' });
    }
});

function getMainMenu() {
    return Markup.keyboard([
      ['📝 Create New Quiz', '📊 My Quizzes'],
      ['📢 दैनिक पोस्ट सेट करें', '🕒 पोस्ट का टाइम सेट करें'],
      [`⚙️ एडमिन लॉक: ${requireAdmin ? 'ON' : 'OFF'}`]
    ]).resize();
}

bot.start((ctx) => {
    const payload = ctx.startPayload;
    if (payload && payload.startsWith('CP_')) {
        activeGroups.add(ctx.chat.id);
        return initGroupLobby(ctx, payload);
    }
    const userId = ctx.from.id.toString();
    if (allowedUsers.has(userId)) {
        ctx.reply('👑 Welcome CP Rawat Sir!\nThe Ultimate Official Quiz Engine is ready. 👇', getMainMenu());
    } else {
        ctx.reply(`👑 <b>CP Rawat Sir's Official Quiz Bot में आपका स्वागत है!</b> 👑\n━━━━━━━━━━━━━━━━━━━━\n\nयह एक सुरक्षित और प्राइवेट सिस्टम है।\n🔒 आगे बढ़ने के लिए कृपया अपना <b>मास्टर पासवर्ड (Master Key)</b> दर्ज करें:`, { parse_mode: 'HTML' });
    }
});

bot.command('stopquiz', async (ctx) => {
    const chatId = ctx.chat.id;
    if (!activeSessions.has(chatId)) return ctx.reply('❌ इस ग्रुप में अभी कोई क्विज नहीं चल रहा है।');
    finishQuiz(chatId, true);
});

bot.on('message', async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (chatId && activeSessions.has(chatId)) {
        const session = activeSessions.get(chatId);
        const msg = ctx.message;
        if (!msg) return next();
        const txt = msg.text || msg.caption || '';
        const isQuizBotTrigger = txt.includes('Get ready for the quiz') || txt.includes('The quiz will begin when') || (txt.match(/^\/start@/i) && txt.toLowerCase().includes('quiz')) || (msg.via_bot && msg.via_bot.username && msg.via_bot.username.toLowerCase().includes('quiz'));

        if (isQuizBotTrigger) {
            if (session.isAdmin) { try { await ctx.deleteMessage(msg.message_id); } catch (e) {} }
            const botName = ctx.botInfo.first_name || 'CP Rawat Sir';
            return ctx.reply(`⚠️ <b>चेतावनी:</b> इस ग्रुप में पहले से <b>${botName}</b> का एक मैराथन क्विज चल रहा है। कृपया इसके समाप्त होने तक कोई अन्य क्विज न चलाएं!`, { parse_mode: 'HTML' });
        }
    }
    return next();
});

// ==========================================
// 🎨 PDF GENERATION LOGIC (ऑप्शन, लोगो और बैनर के साथ)
// ==========================================
async function generateQuizPDF(quizId) {
    return new Promise((resolve, reject) => {
        const quiz = myQuizzes.get(quizId);
        if (!quiz) return reject("Quiz not found");

        const doc = new PDFDocument({ margin: 30, size: 'A4', autoFirstPage: false });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const fontPath = path.join(process.cwd(), 'hindi.ttf');
        const logoPath = path.join(process.cwd(), 'logo.png');
        const bannerPng = path.join(process.cwd(), 'banner.png');
        const bannerJpg = path.join(process.cwd(), 'banner.jpg');
        
        let hasFont = fs.existsSync(fontPath);
        let hasLogo = fs.existsSync(logoPath);
        let hasBanner = fs.existsSync(bannerPng) ? bannerPng : (fs.existsSync(bannerJpg) ? bannerJpg : null);

        const marginX = 30; const colWidth = 250; const col1X = 30; const col2X = 315;
        const startY = 80; const bottomY = 780;
        let currentX = col1X; let currentY = startY;

        function addPageWithBranding() {
            doc.addPage();
            if (hasLogo) {
                doc.save(); doc.opacity(0.1);
                doc.image(logoPath, 140, 250, { width: 320 });
                doc.restore();
            }
            if (hasFont) doc.font(fontPath);
            doc.fontSize(16).fillColor('#D32F2F').text("GK and GS classes by cprawat", marginX, 20, { align: 'center' });
            doc.moveTo(30, 45).lineTo(565, 45).lineWidth(1).strokeColor('#000000').stroke();
            currentY = startY; currentX = col1X;
            drawFooter();
        }

        function drawFooter() {
            const pages = doc.bufferedPageRange();
            if (hasFont) doc.font(fontPath);
            doc.fontSize(10).fillColor('#1976D2').text("YouTube & Telegram: @gkandgs12 | Page " + (pages.count || 1), marginX, 800, { align: 'center' });
        }

        addPageWithBranding();

        const optLabels = ['A)', 'B)', 'C)', 'D)', 'E)', 'F)'];

        quiz.questions.forEach((q, index) => {
            if (hasFont) doc.font(fontPath);
            doc.fontSize(11);
            
            let qHeight = doc.heightOfString(`Q${index + 1}. ${q.question}`, { width: colWidth });
            
            // ऑप्शंस की हाइट जोड़ना
            let optionsHeight = 0;
            q.options.forEach((opt, i) => {
                optionsHeight += doc.heightOfString(`${optLabels[i] || '-'} ${opt}`, { width: colWidth });
            });

            let ansHeight = doc.heightOfString(`✅ उत्तर: ${q.options[q.correctId]}`, { width: colWidth });
            
            let expText = "";
            let expHeight = 0;
            if (q.explanation) {
                expText = q.explanation.replace(/📚 Notes:.*|💬 Practice:.*|🏆 Quiz:.*/g, '').trim(); 
                expHeight = doc.heightOfString(`व्याख्या: ${expText}`, { width: colWidth });
            }

            let totalNeeded = qHeight + optionsHeight + ansHeight + (expHeight > 0 ? expHeight + 10 : 0) + 15;

            // पेज बदलने का लॉजिक
            if (currentY + totalNeeded > bottomY) {
                if (currentX === col1X) { currentX = col2X; currentY = startY; } 
                else { addPageWithBranding(); }
            }

            // 1. प्रश्न प्रिंट करना
            doc.fillColor('#0D47A1');
            doc.text(`Q${index + 1}. ${q.question}`, currentX, currentY, { width: colWidth });
            currentY += qHeight + 2;

            // 2. सारे ऑप्शंस प्रिंट करना
            doc.fillColor('#000000');
            q.options.forEach((opt, i) => {
                doc.text(`${optLabels[i] || '-'} ${opt}`, currentX, currentY, { width: colWidth });
                currentY += doc.heightOfString(`${optLabels[i] || '-'} ${opt}`, { width: colWidth });
            });
            currentY += 3;

            // 3. सही उत्तर प्रिंट करना
            doc.fillColor('#2E7D32');
            doc.text(`✅ उत्तर: ${q.options[q.correctId]}`, currentX, currentY, { width: colWidth });
            currentY += ansHeight + 5;

            // 4. व्याख्या प्रिंट करना
            if (expHeight > 0) {
                doc.fontSize(10).fillColor('#424242');
                doc.text(`व्याख्या: ${expText}`, currentX, currentY, { width: colWidth });
                currentY += expHeight + 10;
            } else { currentY += 10; }
        });

        // 🌟 नया फीचर: आखिरी पेज पर बैनर और विशेषताएं
        doc.addPage();
        let featureY = 50;
        
        if (hasBanner) {
            try {
                doc.image(hasBanner, 30, 40, { width: 535 });
                featureY = 280; // बैनर के साइज के हिसाब से जगह छोड़ना
            } catch (e) {}
        }
        
        if (hasFont) doc.font(fontPath);
        doc.fontSize(20).fillColor('#D32F2F').text("🎯 'GK and GS classes by cprawat' की प्रमुख विशेषताएं:", 30, featureY, { align: 'left' });
        doc.moveDown(1);
        
        doc.fontSize(14).fillColor('#0D47A1');
        const features = [
            "✅ CP Rawat Sir का सटीक मार्गदर्शन: प्रतियोगी परीक्षाओं के लिए विशेष और अनुभवी मार्गदर्शन।",
            "✅ बेहतरीन हस्तलिखित नोट्स: इतिहास, भूगोल, विज्ञान और अर्थशास्त्र के आसान भाषा में टू-द-पॉइंट नोट्स।",
            "✅ डेली लाइव टेस्ट और क्विज़: अपनी स्पीड और एक्यूरेसी बढ़ाने के लिए टेलीग्राम पर रोज़ाना मैराथन प्रैक्टिस।",
            "✅ अपडेटेड स्टडी मटेरियल: परीक्षाओं के बदलते हुए पैटर्न पर आधारित बिल्कुल नए और महत्वपूर्ण प्रश्न।",
            "✅ डाउट क्लियरिंग सुविधा: हज़ारों छात्रों के डिस्कशन ग्रुप में अपने सभी सवालों के तुरंत जवाब पाएं।"
        ];
        
        features.forEach(f => {
            doc.text(f, { width: 535, align: 'left' });
            doc.moveDown(0.8);
        });
        
        drawFooter();
        doc.end();
    });
}

bot.action(/download_pdf_(.+)/, async (ctx) => {
    const quizId = ctx.match[1];
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.answerCbQuery('❌ Quiz data not found!', { show_alert: true });
    
    ctx.answerCbQuery('⏳ PDF जनरेट हो रही है, कृपया प्रतीक्षा करें...');
    try {
        const pdfBuffer = await generateQuizPDF(quizId);
        await ctx.replyWithDocument(
            { source: pdfBuffer, filename: `${quiz.title}_CP_Rawat.pdf` },
            { caption: `📚 <b>${quiz.title}</b>\n\n✅ यह रही आपकी रंगीन बुकलेट PDF। इसे डाउनलोड करें और रिवीजन करें!\n\n👇 <b>Join:</b>\nhttps://t.me/gkandgs12`, parse_mode: 'HTML' }
        );
    } catch (err) { ctx.reply('❌ PDF बनाने में समस्या आई।'); }
});

// ==========================================
// ⚙️ सेटिंग्स और मेन्यू ऑपरेशन्स
// ==========================================
bot.hears(/⚙️ एडमिन लॉक: (ON|OFF)/, (ctx) => {
    const userId = ctx.from.id.toString();
    if (!allowedUsers.has(userId)) return;
    requireAdmin = !requireAdmin;
    ctx.reply(`✅ <b>सेटिंग अपडेट:</b>\nएडमिन लॉक अब <b>${requireAdmin ? 'ON' : 'OFF'}</b> हो गया है।`, { parse_mode: 'HTML', ...getMainMenu() });
});

bot.hears(/view_(.+)/, (ctx) => showAdminDashboard(ctx, ctx.match[1]));
bot.hears('📊 My Quizzes', (ctx) => sendQuizzesPage(ctx, ctx.from.id.toString(), 1));
bot.action(/page_(.+)/, (ctx) => sendQuizzesPage(ctx, ctx.from.id.toString(), parseInt(ctx.match[1]), true));

function sendQuizzesPage(ctx, userId, page, isEdit = false) {
    const quizzes = Array.from(myQuizzes.values()).filter(q => q.owner === userId).reverse();
    if (quizzes.length === 0) return ctx.reply('No quizzes found.');
    const perPage = 5; const totalPages = Math.ceil(quizzes.length / perPage);
    const start = (page - 1) * perPage; const currentList = quizzes.slice(start, start + perPage);

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

bot.hears('📝 Create New Quiz', (ctx) => initQuizCreation(ctx));
bot.action('create_quiz', (ctx) => initQuizCreation(ctx));

function initQuizCreation(ctx) {
    const userId = ctx.from.id.toString();
    if (!allowedUsers.has(userId)) return;
    userStates[userId] = 'AWAITING_TITLE';
    tempQueue[userId] = { owner: userId, title: '', description: '', questions: [], negMark: 0 };
    ctx.reply('📝 Send me the **Title** of your quiz:');
}

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;
    const userId = ctx.from.id.toString();

    if (text === masterPassword) {
        allowedUsers.add(userId);
        return ctx.reply('✅ Access Granted!', getMainMenu());
    }
    if (!allowedUsers.has(userId)) return next();

    if (text === '📢 दैनिक पोस्ट सेट करें') {
        userStates[userId] = 'SET_DAILY_POST';
        return ctx.reply(`📢 <b>वर्तमान ऑटो-पोस्ट:</b>\n\n${dailyPromoPost}\n\n✏️ HTML फॉर्मेट में नया पोस्ट टेक्स्ट भेजें:`, {parse_mode: 'HTML'});
    }
    if (userStates[userId] === 'SET_DAILY_POST') {
        dailyPromoPost = text;
        userStates[userId] = '';
        return ctx.reply('✅ दैनिक पोस्ट अपडेट हो गई!', getMainMenu());
    }

    if (text === '🕒 पोस्ट का टाइम सेट करें') {
        userStates[userId] = 'SET_PROMO_TIME';
        return ctx.reply(`🕒 <b>वर्तमान टाइम:</b> हर ${promoIntervalHours} घंटे में।\n\n✏️ कृपया नया टाइम (सिर्फ घंटों में) लिखकर भेजें:`, {parse_mode: 'HTML'});
    }
    if (userStates[userId] === 'SET_PROMO_TIME') {
        const hrs = parseInt(text);
        if (!isNaN(hrs) && hrs > 0) {
            promoIntervalHours = hrs;
            startPromoInterval(); 
            userStates[userId] = '';
            return ctx.reply(`✅ <b>डन!</b> अब दैनिक पोस्ट हर ${promoIntervalHours} घंटे में जाएगी।`, getMainMenu());
        }
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
    if (userStates[userId] === 'EDIT_ADDQ_CLONE' && text.includes('✅')) {
        return parseQuestions(ctx, text, tempQueue[userId], 'ask_timer_NEW');
    }
    if (userStates[userId] && userStates[userId].startsWith('EDIT_TITLE_')) {
        const quizId = userStates[userId].replace('EDIT_TITLE_', '');
        myQuizzes.get(quizId).title = text; userStates[userId] = '';
        await saveBackup(); return showAdminDashboard(ctx, quizId);
    }
    if (userStates[userId] && userStates[userId].startsWith('EDIT_DESC_')) {
        const quizId = userStates[userId].replace('EDIT_DESC_', '');
        myQuizzes.get(quizId).description = text; userStates[userId] = '';
        await saveBackup(); return showAdminDashboard(ctx, quizId);
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
    ctx.reply(`📥 **${added} questions added!**`, Markup.inlineKeyboard([[Markup.button.callback('✅ Next Step', callbackData)]]));
}

bot.action('ask_timer_NEW', (ctx) => {
    ctx.editMessageText('⏱ **Timer:**', Markup.inlineKeyboard([
        [Markup.button.callback('10 sec', 'setT_10_NEW'), Markup.button.callback('15 sec', 'setT_15_NEW')],
        [Markup.button.callback('30 sec', 'setT_30_NEW'), Markup.button.callback('1 min', 'setT_60_NEW')]
    ]));
});

bot.action(/setT_(.+?)_(.+)/, (ctx) => {
    const t = parseInt(ctx.match[1]); const quizId = ctx.match[2]; const userId = ctx.from.id.toString();
    if (quizId === 'NEW') { if(tempQueue[userId]) tempQueue[userId].time = t; } 
    ctx.editMessageText('➖ **Negative Marking:**', Markup.inlineKeyboard([
        [Markup.button.callback('0', `setN_0_${quizId}`), Markup.button.callback('-0.25', `setN_0.25_${quizId}`)],
        [Markup.button.callback('-0.33', `setN_0.33_${quizId}`), Markup.button.callback('-0.50', `setN_0.5_${quizId}`)]
    ]));
});

bot.action(/setN_(.+?)_(.+)/, (ctx) => {
    const n = parseFloat(ctx.match[1]); const quizId = ctx.match[2]; const userId = ctx.from.id.toString();
    if (quizId === 'NEW') { if(tempQueue[userId]) tempQueue[userId].negMark = n; } 
    ctx.editMessageText('🔀 **Shuffle:**', Markup.inlineKeyboard([
        [Markup.button.callback('No', `setS_none_${quizId}`), Markup.button.callback('Yes (All)', `setS_all_${quizId}`)]
    ]));
});

bot.action(/setS_(.+?)_(.+)/, async (ctx) => {
    const s = ctx.match[1]; const quizIdArg = ctx.match[2]; const userId = ctx.from.id.toString();
    let finalQuizId;
    if (quizIdArg === 'NEW') {
        if(!tempQueue[userId]) return;
        finalQuizId = `CP_${Date.now()}`;
        myQuizzes.set(finalQuizId, { ...tempQueue[userId], id: finalQuizId, shufQ: (s === 'all' || s === 'q'), shufO: (s === 'all' || s === 'a') });
        delete tempQueue[userId];
    }
    userStates[userId] = ''; await saveBackup();
    showAdminDashboard(ctx, finalQuizId, true);
});

function showAdminDashboard(ctx, quizId, isEditMsg = false) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.reply('Quiz not found.');
    const kb = Markup.inlineKeyboard([
        [Markup.button.url('Start quiz in group', `https://t.me/${ctx.botInfo.username}?startgroup=${quizId}`)],
        [Markup.button.switchToChat('Share quiz', quizId)], 
        [Markup.button.callback('Edit quiz', `editmenu_${quizId}`), Markup.button.callback('📊 Stats', `stats_${quizId}`)]
    ]);
    const text = `🏁 <b>The quiz '${quiz.title}' has been created!</b>\n🖊 ${quiz.questions.length} questions · ⏱ ${quiz.time} sec\n\nExternal link:\nhttps://t.me/${ctx.botInfo.username}?start=${quizId}`;
    if (isEditMsg) ctx.editMessageText(text, { parse_mode: 'HTML', ...kb });
    else ctx.reply(text, { parse_mode: 'HTML', ...kb });
}

bot.action(/stats_(.+)/, (ctx) => {
    const quiz = myQuizzes.get(ctx.match[1]);
    if(quiz) ctx.answerCbQuery(`📊 Total Questions: ${quiz.questions.length}`, { show_alert: true });
});

bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query; if (!query) return;
    const quiz = myQuizzes.get(query); if (!quiz) return;
    const text = `🏁 <b>The quiz '${quiz.title}'</b>\n🖊 ${quiz.questions.length} questions\n⏱ ${quiz.time} sec/q\n➖ Neg: -${quiz.negMark || 0}`;
    const kb = Markup.inlineKeyboard([
        [Markup.button.url('Start quiz in group', `https://t.me/${ctx.botInfo.username}?startgroup=${quiz.id}`)]
    ]);
    await ctx.answerInlineQuery([{
        type: 'article', id: quiz.id, title: `Share: ${quiz.title}`,
        input_message_content: { message_text: text, parse_mode: 'HTML' }, reply_markup: kb.reply_markup
    }], { cache_time: 0 });
});

bot.action(/editmenu_(.+)/, (ctx) => {
    const quizId = ctx.match[1];
    ctx.editMessageText('✏️ **Edit Quiz**', Markup.inlineKeyboard([
        [Markup.button.callback('Edit Title', `edT_${quizId}`), Markup.button.callback('Edit Desc', `edD_${quizId}`)],
        [Markup.button.callback('Add Questions', `edQ_${quizId}`), Markup.button.callback('« Back', `back_to_admin_${quizId}`)]
    ]));
});
bot.action(/edT_(.+)/, (ctx) => { userStates[ctx.from.id.toString()] = `EDIT_TITLE_${ctx.match[1]}`; ctx.reply('📝 नया टाइटल भेजें:'); });
bot.action(/edD_(.+)/, (ctx) => { userStates[ctx.from.id.toString()] = `EDIT_DESC_${ctx.match[1]}`; ctx.reply('📝 नया डिस्क्रिप्शन भेजें:'); });
bot.action(/edQ_(.+)/, (ctx) => { 
    const o = myQuizzes.get(ctx.match[1]); if(!o) return;
    tempQueue[ctx.from.id.toString()] = JSON.parse(JSON.stringify(o));
    userStates[ctx.from.id.toString()] = 'EDIT_ADDQ_CLONE';
    ctx.reply('📥 नए प्रश्न भेजें:');
});
bot.action(/back_to_admin_(.+)/, (ctx) => showAdminDashboard(ctx, ctx.match[1], true));

// ==========================================
// 🤝 Public Lobby & Live Execution
// ==========================================
async function initGroupLobby(ctx, quizId) {
    const quiz = myQuizzes.get(quizId);
    if (!quiz) return ctx.reply('❌ Quiz unavailable.');
    const chatId = ctx.chat.id;
    let isAdminStatus = false;
    if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        try {
            const botMember = await ctx.telegram.getChatMember(chatId, ctx.botInfo.id);
            if (botMember.status === 'administrator' && botMember.can_delete_messages) isAdminStatus = true;
            if (requireAdmin && botMember.status !== 'administrator') return ctx.reply('⚠️ कृपया बोट को <b>Admin</b> बनाएं।', { parse_mode: 'HTML' });
        } catch (e) { if (requireAdmin) return ctx.reply('⚠️ एडमिन बनाएं।'); }
    }

    if (activeSessions.has(chatId)) {
        const existingSession = activeSessions.get(chatId);
        let isGhostSession = false;
        if (!existingSession.isStarting && existingSession.lobbyMsgId) {
            try {
                await bot.telegram.editMessageReplyMarkup(chatId, existingSession.lobbyMsgId, undefined, { inline_keyboard: [[Markup.button.callback(`I am ready!`, `ready_${chatId}`)]] });
            } catch (e) { isGhostSession = true; }
        }
        if (isGhostSession) activeSessions.delete(chatId);
        else return ctx.reply(`⚠️ <b>चेतावनी:</b> इस ग्रुप में पहले से एक क्विज चल रहा है।`, { parse_mode: 'HTML' });
    }
    
    let finalQuestions = [...quiz.questions];
    if (quiz.shufQ) finalQuestions.sort(() => Math.random() - 0.5);

    activeSessions.set(chatId, { quiz, questions: finalQuestions, players: new Set(), scores: {}, qIndex: 0, zeroCount: 0, pollId: null, timerObj: null, currentPollCorrectId: null, isPaused: false, isStarting: false, isAdmin: isAdminStatus, lobbyMsgId: null });
    
    const text = `🏁 <b>The quiz '${quiz.title}'</b>\n🖊 ${finalQuestions.length} questions\n⏱ ${quiz.time} seconds per question\n\n🏁 The quiz will begin when at least 2 people are ready to play.\n\nNobody is ready yet.`;
    const lobbyMsg = await ctx.reply(text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[Markup.button.callback(`I am ready!`, `ready_${chatId}`)]] } });
    activeSessions.get(chatId).lobbyMsgId = lobbyMsg.message_id;
}

bot.action(/ready_(.+)/, async (ctx) => {
    const chatId = Number(ctx.match[1]);
    const session = activeSessions.get(chatId);
    if (!session) return ctx.answerCbQuery('❌ No active session!');
    
    session.players.add(ctx.from.id);
    const count = session.players.size;
    
    if (session.isStarting) return ctx.answerCbQuery('✅ You are ready! Quiz is starting...');

    const baseText = `🏁 <b>The quiz '${session.quiz.title}'</b>\n🖊 ${session.questions.length} questions\n⏱ ${session.quiz.time} sec/q\n\n`;

    if (count >= 2) {
        session.isStarting = true; 
        await ctx.editMessageText(`${baseText}${count} people ready...\n<b>The quiz will start in 10 seconds!</b>`, { parse_mode: 'HTML' });
        
        // 🌟 10 सेकंड का मोटिवेशनल पॉप-अप मैसेज 
        try {
            const prepMsg = await ctx.telegram.sendPhoto(chatId, CP_RAWAT_PHOTO_URL, {
                caption: "🌟 <b>चलिए, क्विज शुरू करते हैं!</b> 🌟\n\n🎯 <i>सभी छात्र अपना सर्वश्रेष्ठ प्रदर्शन करें। आपकी मेहनत ही आपकी असली पहचान है!</i> 📚🏆\n\n👍 <b>All the Best! - CP Rawat Sir</b>", parse_mode: 'HTML'
            });
            setTimeout(async () => {
                try { await ctx.telegram.deleteMessage(chatId, prepMsg.message_id); } catch(e){}
                sendNextQuestion(chatId);
            }, 10000); 
        } catch (err) {
            const prepMsg = await ctx.telegram.sendMessage(chatId, "🌟 <b>चलिए, क्विज शुरू करते हैं!</b> 🌟\n\n🎯 <i>सभी छात्र अपना सर्वश्रेष्ठ प्रदर्शन करें।</i> 📚🏆\n\n👍 <b>All the Best! - CP Rawat Sir</b>", { parse_mode: 'HTML' });
            setTimeout(async () => {
                try { await ctx.telegram.deleteMessage(chatId, prepMsg.message_id); } catch(e){}
                sendNextQuestion(chatId);
            }, 10000); 
        }
    } else {
        ctx.editMessageText(`${baseText}${count} person is ready so far.`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[Markup.button.callback(`I am ready!`, `ready_${chatId}`)]] } });
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
        return bot.telegram.sendMessage(chatId, `The quiz was paused because nobody was answering.`, Markup.inlineKeyboard([[Markup.button.callback('▶️ Resume', `resume_${chatId}`)]]));
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
            await bot.telegram.sendMessage(chatId, promoText, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...promoButtons });
            await new Promise(resolve => setTimeout(resolve, 3000));
        } 
        else if (session.qIndex % 5 === 0) {
            const promoIndex = ((session.qIndex / 5) - 1) % singlePromos.length;
            const randomPromo = singlePromos[promoIndex];
            const linkObj = links[promoIndex % 3]; 
            const btn = Markup.inlineKeyboard([[Markup.button.url(linkObj.text, linkObj.url)]]);
            await bot.telegram.sendMessage(chatId, `${randomPromo}\n\n👉 <a href="${linkObj.url}">${linkObj.text}</a>\n🌐 ${linkObj.url}`, { parse_mode: 'HTML', link_preview_options: { is_disabled: false }, ...btn });
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
    session.currentPollCorrectId = finalCorrectId;

    try {
        const poll = await bot.telegram.sendQuiz(chatId, qText, finalOptions, {
            correct_option_id: finalCorrectId, explanation: q.explanation, is_anonymous: false, open_period: session.quiz.time
        });
        session.pollId = poll.poll.id;
        session.pollSendTime = Date.now(); 
        session.currentVotes = 0;
    } catch (e) {}

    session.timerObj = setTimeout(() => {
        if (session.currentVotes === 0) session.zeroCount++; else session.zeroCount = 0;
        session.qIndex++; sendNextQuestion(chatId);
    }, (session.quiz.time + 1) * 1000); 
}

bot.action(/resume_(.+)/, (ctx) => {
    const chatId = Number(ctx.match[1]); const session = activeSessions.get(chatId);
    if (!session) return ctx.answerCbQuery('❌ No active session!');
    session.isPaused = false; session.zeroCount = 0;
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
            const chosenOption = ans.option_ids[0];
            if (chosenOption === session.currentPollCorrectId) { session.scores[ans.user.id].score += 1; } 
            else { session.scores[ans.user.id].score -= (session.quiz.negMark || 0); }
            session.scores[ans.user.id].time += parseFloat(timeTaken);
        }
    });
});

// 🏆 Final Leaderboard & Super Thank You Message
function finishQuiz(chatId, wasForced) {
    const session = activeSessions.get(chatId);
    if (!session) return;
    if (session.timerObj) clearTimeout(session.timerObj);
    
    let results = Object.values(session.scores).sort((a, b) => b.score === a.score ? a.time - b.time : b.score - a.score);
    const askedQuestionsCount = session.qIndex === 0 ? 1 : session.qIndex; 

    let leaderboard = wasForced ? `🛑 <b>The quiz '${session.quiz.title}' was stopped!</b>\n\n` : `🏁 <b>The quiz '${session.quiz.title}' has finished!</b>\n\n`;
    leaderboard += `<i>${session.qIndex} questions answered</i>\n\n`;
    
    if (results.length === 0) {
        leaderboard += "Nobody answered correctly.\n";
    } else {
        results.slice(0, 10).forEach((r, i) => { 
            let rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `🎗️ ${i+1}.`;
            let finalScore = Number(r.score.toFixed(2));
            let emoji = finalScore <= 0 ? '🥺 (निराश न हों, मेहनत करें 💡)' : '🔥';
            leaderboard += `${rank} <b>${r.name}</b> – <b>${finalScore}/${askedQuestionsCount}</b> (${r.time.toFixed(1)}s) ${emoji}\n`; 
        });
        leaderboard += `\n🏆 <b>Congratulations to the winners!</b>`;
    }

    const pdfButton = Markup.inlineKeyboard([
        [Markup.button.callback('📥 रंगीन PDF डाउनलोड करें', `download_pdf_${session.quiz.id}`)],
        [Markup.button.switchToChat('Share quiz', session.quiz.id)]
    ]);

    bot.telegram.sendMessage(chatId, leaderboard, { parse_mode: 'HTML', ...pdfButton });

    const top1 = results.length > 0 ? results[0] : null;
    const top2 = results.length > 1 ? results[1] : null;
    const top3 = results.length > 2 ? results[2] : null;

    let thankYouMsg = `🎉 <b>बहुत-बहुत बधाई एवं शुभकामनाएँ!</b> 🎉\n━━━━━━━━━━━━━━━━━━━━\n\nप्रिय विद्यार्थियों, आप सभी ने शानदार प्रदर्शन किया। 🌟\n\n`;
    if (top1) thankYouMsg += `🥇 <b>फर्स्ट:</b> ${top1.name} (Score: ${Number(top1.score.toFixed(2))}/${askedQuestionsCount})\n`;
    if (top2) thankYouMsg += `🥈 <b>सेकंड:</b> ${top2.name} (Score: ${Number(top2.score.toFixed(2))}/${askedQuestionsCount})\n`;
    if (top3) thankYouMsg += `🥉 <b>थर्ड:</b> ${top3.name} (Score: ${Number(top3.score.toFixed(2))}/${askedQuestionsCount})\n\n`;
    thankYouMsg += `यह सफलता आपकी कड़ी मेहनत का परिणाम है! 📚 जो छात्र टॉप नहीं कर पाए, वे बिल्कुल भी निराश न हों। <b>CP Rawat Sir</b> हमेशा आपके उज्ज्वल भविष्य की कामना करते हैं! 🎯\n\n👇 <b>बेहतरीन तैयारी के लिए जुड़ें:</b>`;
    
    const thankYouBtns = Markup.inlineKeyboard([
        [Markup.button.url(links[0].text, links[0].url)],
        [Markup.button.url(links[1].text, links[1].url), Markup.button.url(links[2].text, links[2].url)]
    ]);
    
    setTimeout(async () => {
        try {
            await bot.telegram.sendPhoto(chatId, CP_RAWAT_PHOTO_URL, { caption: thankYouMsg, parse_mode: 'HTML', ...thankYouBtns });
        } catch (err) {
            await bot.telegram.sendMessage(chatId, thankYouMsg, { parse_mode: 'HTML', ...thankYouBtns });
        }
    }, 5000);

    activeSessions.delete(chatId);
}

function sendDailyPromo() {
    activeGroups.forEach(async (chatId) => {
        const btns = Markup.inlineKeyboard([
            [Markup.button.url(links[0].text, links[0].url)],
            [Markup.button.url(links[1].text, links[1].url), Markup.button.url(links[2].text, links[2].url)]
        ]);
        try { await bot.telegram.sendMessage(chatId, dailyPromoPost, { parse_mode: 'HTML', ...btns }); } 
        catch (err) { activeGroups.delete(chatId); }
    });
}
function startPromoInterval() {
    if (promoIntervalId) clearInterval(promoIntervalId);
    promoIntervalId = setInterval(sendDailyPromo, promoIntervalHours * 60 * 60 * 1000);
}
startPromoInterval();

const app = express();
app.get('/', (req, res) => res.send('CP Rawat Official Engine is Live!'));
app.listen(process.env.PORT || 3000);

setInterval(() => {
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
    fetch(url).catch(() => {});
}, 10 * 60 * 1000);

loadBackup().then(() => {
    bot.launch();
    console.log("✅ Bot is running and connected to Backup Channel!");
});
