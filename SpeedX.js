// ============================================
// SPEEDX BOT - Complete with K-9 Spam Features
// ============================================

const { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ytdl = require('ytdl-core');
const yts = require('yt-search');
const moment = require('moment');

// ============================================
// CONFIGURATION - CHANGE THESE!
// ============================================
const CONFIG = {
    PREFIX: '.',
    BOT_NAME: 'SpeedX',
    OWNER_NUMBER: '237651707126@s.whatsapp.net', // 🔴 CHANGE THIS TO YOUR PHONE NUMBER!
    OWNER_NAME: 'Speed',
    AUTO_VIEW_STATUS: true,
    AUTO_LIKE_STATUS: true,
    AUTO_RECOVER: true,
    AUTO_TYPING: true,      // Auto typing indicator
    AUTO_RECORDING: true    // Auto recording indicator
};

// Allowed users
let allowedUsers = new Set();

// Load allowed users
if (fs.existsSync('./allowed.json')) {
    allowedUsers = new Set(JSON.parse(fs.readFileSync('./allowed.json')));
}

// Message cache for recovery
let messageCache = new Map();

// Bot settings
let autoViewEnabled = CONFIG.AUTO_VIEW_STATUS;
let autoLikeEnabled = CONFIG.AUTO_LIKE_STATUS;
let autoRecoverEnabled = CONFIG.AUTO_RECOVER;
let autoTypingEnabled = CONFIG.AUTO_TYPING;
let autoRecordingEnabled = CONFIG.AUTO_RECORDING;
let botStartTime = Date.now();

// Store waiting users for spam commands
let waitingUsers = new Map(); // { userId: { command, number, type } }

// ============================================
// HELPER FUNCTIONS
// ============================================

function isAllowed(userJid) {
    if (userJid === CONFIG.OWNER_NUMBER) return true;
    return allowedUsers.has(userJid);
}

function saveAllowedUsers() {
    fs.writeFileSync('./allowed.json', JSON.stringify(Array.from(allowedUsers)));
}

function formatUptime() {
    const uptime = Date.now() - botStartTime;
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// Function to simulate typing
async function simulateTyping(sock, jid, duration = 3000) {
    if (!autoTypingEnabled) return;
    await sock.sendPresenceUpdate('composing', jid);
    setTimeout(() => {}, duration);
}

// Function to simulate recording
async function simulateRecording(sock, jid, duration = 3000) {
    if (!autoRecordingEnabled) return;
    await sock.sendPresenceUpdate('recording', jid);
    setTimeout(() => {}, duration);
}

// Function to load spam message from T folder
function loadSpamMessage(type) {
    const filePath = path.join(__dirname, 'T', `${type}.js`);
    
    if (!fs.existsSync(filePath)) {
        return null;
    }
    
    try {
        const messageModule = require(filePath);
        return messageModule.message || messageModule.default || null;
    } catch (error) {
        console.error(`Failed to load message for ${type}:`, error);
        return null;
    }
}

// Function to send spam messages
async function sendSpamMessages(sock, targetNumber, message, count, from) {
    const targetJid = targetNumber.includes('@') ? targetNumber : `${targetNumber}@s.whatsapp.net`;
    
    let successCount = 0;
    let failCount = 0;
    
    // Send initial status
    await sock.sendMessage(from, { text: `🚀 Starting spam to ${targetNumber}\n📝 Message: ${message.substring(0, 50)}...\n🔁 Count: ${count} times\n⏳ Sending...` });
    
    for (let i = 1; i <= count; i++) {
        try {
            // Simulate typing before each message
            await simulateTyping(sock, targetJid, 1000);
            
            // Send the message
            await sock.sendMessage(targetJid, { text: message });
            successCount++;
            
            // Send progress update every 10 messages
            if (i % 10 === 0 || i === count) {
                await sock.sendMessage(from, { text: `📊 Progress: ${i}/${count} messages sent to ${targetNumber}` });
            }
            
            // Small delay between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            failCount++;
            console.error(`Failed to send message ${i}:`, error);
            
            if (error.message.includes('blocked')) {
                await sock.sendMessage(from, { text: `⚠️ User ${targetNumber} has blocked the bot! Stopping spam.` });
                break;
            }
        }
    }
    
    // Send final report
    await sock.sendMessage(from, { 
        text: `✅ *Spam Complete!*\n\n📱 Target: ${targetNumber}\n✅ Sent: ${successCount} messages\n❌ Failed: ${failCount} messages\n📝 Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}` 
    });
}

// ============================================
// COMMAND HANDLER
// ============================================

async function handleCommand(sock, msg, command, args, context) {
    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = isGroup ? msg.key.participant : from;
    const isOwner = sender === CONFIG.OWNER_NUMBER;
    
    // ==================== MENU ====================
    if (command === 'menu') {
        const menu = `╭───❒ *${CONFIG.BOT_NAME} MENU* ❒───
│
├─❒ *📱 GENERAL*
│  • ${CONFIG.PREFIX}menu - Show this menu
│  • ${CONFIG.PREFIX}ping - Check bot status
│  • ${CONFIG.PREFIX}owner - Contact owner
│  • ${CONFIG.PREFIX}runtime - Bot uptime
│
├─❒ *👁️ STATUS*
│  • ${CONFIG.PREFIX}autoview on/off - Auto view status
│  • ${CONFIG.PREFIX}autolike on/off - Auto like status
│  • Status: ${autoViewEnabled ? '✅' : '❌'} AutoView | ${autoLikeEnabled ? '✅' : '❌'} AutoLike
│
├─❒ *🛡️ RECOVERY*
│  • ${CONFIG.PREFIX}antidelete - View deleted messages
│  • ${CONFIG.PREFIX}recover - Recover last 10 messages
│  • Status: ${autoRecoverEnabled ? '✅ Active' : '❌ Inactive'}
│
├─❒ *📥 DOWNLOAD*
│  • ${CONFIG.PREFIX}yt <url> - YouTube video
│  • ${CONFIG.PREFIX}tt <url> - TikTok video
│  • ${CONFIG.PREFIX}fb <url> - Facebook video
│
├─❒ *🐕 K-9 SPAM SYSTEM*
│  • ${CONFIG.PREFIX}fish +1234567890 - Spam fish message
│  • ${CONFIG.PREFIX}dog +1234567890 - Spam dog message
│  • ${CONFIG.PREFIX}cat +1234567890 - Spam cat message
│  • *How it works:* Send command with number, bot asks for count, reply with number
│
├─❒ *🎨 UTILITIES*
│  • ${CONFIG.PREFIX}sticker - Make sticker from image
│  • ${CONFIG.PREFIX}weather <city> - Weather info
│  • ${CONFIG.PREFIX}calc <expression> - Calculator
│  • ${CONFIG.PREFIX}google <query> - Google search
│  • ${CONFIG.PREFIX}shorten <url> - Shorten URL
│
├─❒ *👑 OWNER ONLY*
│  • ${CONFIG.PREFIX}adduser @user - Add user access
│  • ${CONFIG.PREFIX}removeuser @user - Remove user
│  • ${CONFIG.PREFIX}listusers - Show allowed users
│  • ${CONFIG.PREFIX}shutdown - Turn off bot
│  • ${CONFIG.PREFIX}broadcast <text> - Broadcast message
│  • ${CONFIG.PREFIX}typing on/off - Toggle auto typing
│  • ${CONFIG.PREFIX}recording on/off - Toggle auto recording
│
├─❒ *👥 GROUP ADMIN*
│  • ${CONFIG.PREFIX}promote @user - Promote to admin
│  • ${CONFIG.PREFIX}demote @user - Demote admin
│  • ${CONFIG.PREFIX}kick @user - Kick user
│  • ${CONFIG.PREFIX}add <number> - Add user to group
│  • ${CONFIG.PREFIX}group open/close - Group settings
│
╰───❒ *Version: 1.0.0* ❒───

⚡ *Powered by ${CONFIG.BOT_NAME}*`;
        
        await simulateTyping(sock, from, 2000);
        await sock.sendMessage(from, { text: menu });
    }
    
    // ==================== PING ====================
    else if (command === 'ping') {
        await simulateTyping(sock, from, 1000);
        const start = Date.now();
        await sock.sendMessage(from, { text: '🏓 Pinging...' });
        const ping = Date.now() - start;
        await sock.sendMessage(from, { text: `🏓 *Pong!*\n⏱️ Latency: ${ping}ms\n🤖 Bot: Online\n⚡ SpeedX Active` });
    }
    
    // ==================== OWNER ====================
    else if (command === 'owner') {
        await simulateTyping(sock, from, 1500);
        await sock.sendMessage(from, { 
            text: `👑 *Bot Owner*\n\nName: ${CONFIG.OWNER_NAME}\nContact: ${CONFIG.OWNER_NUMBER.split('@')[0]}\n\nFor support or issues, contact the owner.` 
        });
    }
    
    // ==================== RUNTIME ====================
    else if (command === 'runtime') {
        await simulateTyping(sock, from, 1000);
        await sock.sendMessage(from, { text: `⏰ *Bot Uptime*\n${formatUptime()}` });
    }
    
    // ==================== AUTO TYPING TOGGLE ====================
    else if (command === 'typing') {
        if (!isOwner) {
            return await sock.sendMessage(from, { text: '❌ Only owner can change this setting!' });
        }
        if (args[0] === 'on') {
            autoTypingEnabled = true;
            await sock.sendMessage(from, { text: '✅ Auto typing ENABLED' });
        } else if (args[0] === 'off') {
            autoTypingEnabled = false;
            await sock.sendMessage(from, { text: '❌ Auto typing DISABLED' });
        } else {
            await sock.sendMessage(from, { text: `Auto typing is currently ${autoTypingEnabled ? 'ON' : 'OFF'}\nUse .typing on/off to change` });
        }
    }
    
    // ==================== AUTO RECORDING TOGGLE ====================
    else if (command === 'recording') {
        if (!isOwner) {
            return await sock.sendMessage(from, { text: '❌ Only owner can change this setting!' });
        }
        if (args[0] === 'on') {
            autoRecordingEnabled = true;
            await sock.sendMessage(from, { text: '✅ Auto recording ENABLED' });
        } else if (args[0] === 'off') {
            autoRecordingEnabled = false;
            await sock.sendMessage(from, { text: '❌ Auto recording DISABLED' });
        } else {
            await sock.sendMessage(from, { text: `Auto recording is currently ${autoRecordingEnabled ? 'ON' : 'OFF'}\nUse .recording on/off to change` });
        }
    }
    
    // ==================== AUTOVIEW ====================
    else if (command === 'autoview') {
        if (!isOwner) {
            return await sock.sendMessage(from, { text: '❌ Only owner can change this setting!' });
        }
        if (args[0] === 'on') {
            autoViewEnabled = true;
            await sock.sendMessage(from, { text: '✅ Auto view status ENABLED' });
        } else if (args[0] === 'off') {
            autoViewEnabled = false;
            await sock.sendMessage(from, { text: '❌ Auto view status DISABLED' });
        } else {
            await sock.sendMessage(from, { text: 'Usage: .autoview on/off' });
        }
    }
    
    // ==================== AUTOLIKE ====================
    else if (command === 'autolike') {
        if (!isOwner) {
            return await sock.sendMessage(from, { text: '❌ Only owner can change this setting!' });
        }
        if (args[0] === 'on') {
            autoLikeEnabled = true;
            await sock.sendMessage(from, { text: '✅ Auto like status ENABLED' });
        } else if (args[0] === 'off') {
            autoLikeEnabled = false;
            await sock.sendMessage(from, { text: '❌ Auto like status DISABLED' });
        } else {
            await sock.sendMessage(from, { text: 'Usage: .autolike on/off' });
        }
    }
    
    // ==================== K-9 SPAM: FISH ====================
    else if (command === 'fish') {
        if (!args[0]) {
            return await sock.sendMessage(from, { text: '❌ Please provide a phone number!\nExample: .fish +1234567890' });
        }
        
        const phoneNumber = args[0];
        // Validate phone number format
        if (!phoneNumber.match(/^\+?[0-9]{10,15}$/)) {
            return await sock.sendMessage(from, { text: '❌ Invalid phone number! Use format: +1234567890' });
        }
        
        // Load fish message from T folder
        const spamMessage = loadSpamMessage('fish');
        if (!spamMessage) {
            return await sock.sendMessage(from, { text: '❌ No spam message found for fish! Create T/fish.js file.' });
        }
        
        // Store user waiting for count
        waitingUsers.set(sender, {
            command: 'spam',
            type: 'fish',
            number: phoneNumber,
            message: spamMessage
        });
        
        await simulateTyping(sock, from, 1500);
        await sock.sendMessage(from, { 
            text: `🐟 *Fish Spam Ready!*\n\nTarget: ${phoneNumber}\nMessage: ${spamMessage.substring(0, 100)}${spamMessage.length > 100 ? '...' : ''}\n\n📝 *Reply with the number of times you want to send this message (1-100)*` 
        });
    }
    
    // ==================== K-9 SPAM: DOG ====================
    else if (command === 'dog') {
        if (!args[0]) {
            return await sock.sendMessage(from, { text: '❌ Please provide a phone number!\nExample: .dog +1234567890' });
        }
        
        const phoneNumber = args[0];
        if (!phoneNumber.match(/^\+?[0-9]{10,15}$/)) {
            return await sock.sendMessage(from, { text: '❌ Invalid phone number! Use format: +1234567890' });
        }
        
        const spamMessage = loadSpamMessage('dog');
        if (!spamMessage) {
            return await sock.sendMessage(from, { text: '❌ No spam message found for dog! Create T/dog.js file.' });
        }
        
        waitingUsers.set(sender, {
            command: 'spam',
            type: 'dog',
            number: phoneNumber,
            message: spamMessage
        });
        
        await simulateTyping(sock, from, 1500);
        await sock.sendMessage(from, { 
            text: `🐕 *Dog Spam Ready!*\n\nTarget: ${phoneNumber}\nMessage: ${spamMessage.substring(0, 100)}${spamMessage.length > 100 ? '...' : ''}\n\n📝 *Reply with the number of times you want to send this message (1-100)*` 
        });
    }
    
    // ==================== K-9 SPAM: CAT ====================
    else if (command === 'cat') {
        if (!args[0]) {
            return await sock.sendMessage(from, { text: '❌ Please provide a phone number!\nExample: .cat +1234567890' });
        }
        
        const phoneNumber = args[0];
        if (!phoneNumber.match(/^\+?[0-9]{10,15}$/)) {
            return await sock.sendMessage(from, { text: '❌ Invalid phone number! Use format: +1234567890' });
        }
        
        const spamMessage = loadSpamMessage('cat');
        if (!spamMessage) {
            return await sock.sendMessage(from, { text: '❌ No spam message found for cat! Create T/cat.js file.' });
        }
        
        waitingUsers.set(sender, {
            command: 'spam',
            type: 'cat',
            number: phoneNumber,
            message: spamMessage
        });
        
        await simulateTyping(sock, from, 1500);
        await sock.sendMessage(from, { 
            text: `🐱 *Cat Spam Ready!*\n\nTarget: ${phoneNumber}\nMessage: ${spamMessage.substring(0, 100)}${spamMessage.length > 100 ? '...' : ''}\n\n📝 *Reply with the number of times you want to send this message (1-100)*` 
        });
    }
    
    // ==================== ADD USER ====================
    else if (command === 'adduser') {
        if (!isOwner) {
            return await sock.sendMessage(from, { text: '❌ Only bot owner can use this command!' });
        }
        
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (!mentioned || mentioned.length === 0) {
            return await sock.sendMessage(from, { text: '❌ Please mention the user to add!\nExample: .adduser @user' });
        }
        
        const userToAdd = mentioned[0];
        allowedUsers.add(userToAdd);
        saveAllowedUsers();
        
        await simulateTyping(sock, from, 1000);
        await sock.sendMessage(from, { text: `✅ User ${userToAdd.split('@')[0]} has been added! They can now use the bot.` });
    }
    
    // ==================== REMOVE USER ====================
    else if (command === 'removeuser') {
        if (!isOwner) {
            return await sock.sendMessage(from, { text: '❌ Only bot owner can use this command!' });
        }
        
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (!mentioned || mentioned.length === 0) {
            return await sock.sendMessage(from, { text: '❌ Please mention the user to remove!' });
        }
        
        const userToRemove = mentioned[0];
        allowedUsers.delete(userToRemove);
        saveAllowedUsers();
        
        await simulateTyping(sock, from, 1000);
        await sock.sendMessage(from, { text: `❌ User ${userToRemove.split('@')[0]} has been removed.` });
    }
    
    // ==================== LIST USERS ====================
    else if (command === 'listusers') {
        if (!isOwner) {
            return await sock.sendMessage(from, { text: '❌ Only owner can view this!' });
        }
        
        if (allowedUsers.size === 0) {
            return await sock.sendMessage(from, { text: '📋 No users added yet.' });
        }
        
        let userList = '📋 *Allowed Users*\n\n';
        allowedUsers.forEach(user => {
            userList += `• ${user.split('@')[0]}\n`;
        });
        
        await simulateTyping(sock, from, 1500);
        await sock.sendMessage(from, { text: userList });
    }
    
    // ==================== SHUTDOWN ====================
    else if (command === 'shutdown') {
        if (!isOwner) {
            return await sock.sendMessage(from, { text: '❌ Only bot owner can shutdown the bot!' });
        }
        
        await simulateTyping(sock, from, 1000);
        await sock.sendMessage(from, { text: '🔄 Shutting down bot...' });
        process.exit(0);
    }
    
    // ==================== BROADCAST ====================
    else if (command === 'broadcast') {
        if (!isOwner) {
            return await sock.sendMessage(from, { text: '❌ Only owner can broadcast!' });
        }
        
        if (!args.length) {
            return await sock.sendMessage(from, { text: '❌ Please provide a message to broadcast!' });
        }
        
        const message = args.join(' ');
        await sock.sendMessage(from, { text: `📢 Broadcasting: "${message}" to all chats...` });
        
        let sentCount = 0;
        for (const user of allowedUsers) {
            try {
                await simulateTyping(sock, user, 500);
                await sock.sendMessage(user, { text: `📢 *Broadcast from Owner*\n\n${message}` });
                sentCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                // User might have left or blocked
            }
        }
        
        await sock.sendMessage(from, { text: `✅ Broadcast sent to ${sentCount} users!` });
    }
    
    // ==================== YOUTUBE DOWNLOAD ====================
    else if (command === 'yt') {
        if (!args[0]) {
            return await sock.sendMessage(from, { text: '❌ Please provide a YouTube URL!\nExample: .yt https://youtu.be/...' });
        }
        
        const url = args[0];
        
        if (!ytdl.validateURL(url)) {
            return await sock.sendMessage(from, { text: '❌ Invalid YouTube URL!' });
        }
        
        await simulateTyping(sock, from, 2000);
        await sock.sendMessage(from, { text: '📥 Fetching video info...' });
        
        try {
            const info = await ytdl.getInfo(url);
            const title = info.videoDetails.title;
            const duration = info.videoDetails.lengthSeconds;
            
            await sock.sendMessage(from, { 
                text: `🎬 *YouTube Video*\n📹 Title: ${title}\n⏱️ Duration: ${Math.floor(duration / 60)}:${duration % 60}\n\nReply with quality:\n1. 360p\n2. 720p\n3. 1080p` 
            });
        } catch (error) {
            await sock.sendMessage(from, { text: '❌ Failed to fetch video info!' });
        }
    }
    
    // ==================== WEATHER ====================
    else if (command === 'weather') {
        if (!args[0]) {
            return await sock.sendMessage(from, { text: '❌ Please provide a city name!\nExample: .weather London' });
        }
        
        const city = args.join(' ');
        
        try {
            await simulateTyping(sock, from, 2000);
            const response = await axios.get(`https://wttr.in/${city}?format=%C+%t+%w+%h`);
            const weather = response.data;
            
            await sock.sendMessage(from, { text: `🌤️ *Weather in ${city}*\n\n${weather}` });
        } catch (error) {
            await sock.sendMessage(from, { text: '❌ Could not fetch weather data!' });
        }
    }
    
    // ==================== CALCULATOR ====================
    else if (command === 'calc') {
        if (!args[0]) {
            return await sock.sendMessage(from, { text: '❌ Please provide an expression!\nExample: .calc 2+2' });
        }
        
        try {
            const expression = args.join(' ');
            const result = new Function('return ' + expression)();
            
            await simulateTyping(sock, from, 1000);
            await sock.sendMessage(from, { text: `🧮 *Calculator*\n${expression} = ${result}` });
        } catch (error) {
            await sock.sendMessage(from, { text: '❌ Invalid expression!' });
        }
    }
    
    // ==================== GOOGLE SEARCH ====================
    else if (command === 'google') {
        if (!args[0]) {
            return await sock.sendMessage(from, { text: '❌ Please provide a search query!\nExample: .google whatsapp' });
        }
        
        const query = args.join(' ');
        
        await simulateTyping(sock, from, 1500);
        await sock.sendMessage(from, { text: `🔍 *Google Search*\n\nhttps://www.google.com/search?q=${encodeURIComponent(query)}\n\n(Click the link to see results)` });
    }
    
    // ==================== SHORTEN URL ====================
    else if (command === 'shorten') {
        if (!args[0]) {
            return await sock.sendMessage(from, { text: '❌ Please provide a URL to shorten!\nExample: .shorten https://example.com' });
        }
        
        const url = args[0];
        
        try {
            await simulateTyping(sock, from, 1500);
            const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
            const shortUrl = response.data;
            
            await sock.sendMessage(from, { text: `🔗 *Shortened URL*\n\nOriginal: ${url}\nShort: ${shortUrl}` });
        } catch (error) {
            await sock.sendMessage(from, { text: '❌ Failed to shorten URL!' });
        }
    }
    
    // ==================== STICKER ====================
    else if (command === 'sticker') {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quoted) {
            return await sock.sendMessage(from, { text: '❌ Reply to an image/video with .sticker' });
        }
        
        let mediaMsg = null;
        if (quoted.imageMessage) mediaMsg = quoted.imageMessage;
        else if (quoted.videoMessage) mediaMsg = quoted.videoMessage;
        else return await sock.sendMessage(from, { text: '❌ Reply to an image or video!' });
        
        await simulateTyping(sock, from, 2000);
        await sock.sendMessage(from, { text: '🎨 Making sticker...' });
        
        try {
            const media = await downloadMediaMessage(
                { message: { [mediaMsg.type]: mediaMsg } },
                'buffer',
                {},
                { logger: Pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
            );
            
            await sock.sendMessage(from, { 
                sticker: media,
                mimetype: 'image/webp'
            });
        } catch (error) {
            await sock.sendMessage(from, { text: '❌ Failed to make sticker!' });
        }
    }
    
    // ==================== PROMOTE ====================
    else if (command === 'promote') {
        if (!isGroup) {
            return await sock.sendMessage(from, { text: '❌ This command only works in groups!' });
        }
        
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (!mentioned || mentioned.length === 0) {
            return await sock.sendMessage(from, { text: '❌ Please mention the user to promote!' });
        }
        
        try {
            await simulateTyping(sock, from, 1000);
            await sock.groupParticipantsUpdate(from, mentioned, 'promote');
            await sock.sendMessage(from, { text: `✅ Promoted ${mentioned[0].split('@')[0]} to admin!` });
        } catch (error) {
            await sock.sendMessage(from, { text: '❌ Failed to promote user!' });
        }
    }
    
    // ==================== DEMOTE ====================
    else if (command === 'demote') {
        if (!isGroup) {
            return await sock.sendMessage(from, { text: '❌ This command only works in groups!' });
        }
        
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (!mentioned || mentioned.length === 0) {
            return await sock.sendMessage(from, { text: '❌ Please mention the user to demote!' });
        }
        
        try {
            await simulateTyping(sock, from, 1000);
            await sock.groupParticipantsUpdate(from, mentioned, 'demote');
            await sock.sendMessage(from, { text: `❌ Demoted ${mentioned[0].split('@')[0]} from admin!` });
        } catch (error) {
            await sock.sendMessage(from, { text: '❌ Failed to demote user!' });
        }
    }
    
    // ==================== KICK ====================
    else if (command === 'kick') {
        if (!isGroup) {
            return await sock.sendMessage(from, { text: '❌ This command only works in groups!' });
        }
        
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (!mentioned || mentioned.length === 0) {
            return await sock.sendMessage(from, { text: '❌ Please mention the user to kick!' });
        }
        
        try {
            await simulateTyping(sock, from, 1000);
            await sock.groupParticipantsUpdate(from, mentioned, 'remove');
            await sock.sendMessage(from, { text: `👢 Kicked ${mentioned[0].split('@')[0]} from group!` });
        } catch (error) {
            await sock.sendMessage(from, { text: '❌ Failed to kick user!' });
        }
    }
    
    // ==================== ADD TO GROUP ====================
    else if (command === 'add') {
        if (!isGroup) {
            return await sock.sendMessage(from, { text: '❌ This command only works in groups!' });
        }
        
        if (!args[0]) {
            return await sock.sendMessage(from, { text: '❌ Please provide a phone number!\nExample: .add 1234567890' });
        }
        
        const number = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        
        try {
            await simulateTyping(sock, from, 1000);
            await sock.groupParticipantsUpdate(from, [number], 'add');
            await sock.sendMessage(from, { text: `✅ Added ${args[0]} to group!` });
        } catch (error) {
            await sock.sendMessage(from, { text: '❌ Failed to add user! Make sure they haven\'t blocked the bot.' });
        }
    }
    
    // ==================== GROUP SETTINGS ====================
    else if (command === 'group') {
        if (!isGroup) {
            return await sock.sendMessage(from, { text: '❌ This command only works in groups!' });
        }
        
        if (!args[0]) {
            return await sock.sendMessage(from, { text: 'Usage: .group open/close' });
        }
        
        try {
            await simulateTyping(sock, from, 1000);
            if (args[0] === 'open') {
                await sock.groupSettingUpdate(from, 'unlocked');
                await sock.sendMessage(from, { text: '🔓 Group is now OPEN! Anyone can send messages.' });
            } else if (args[0] === 'close') {
                await sock.groupSettingUpdate(from, 'locked');
                await sock.sendMessage(from, { text: '🔒 Group is now CLOSED! Only admins can send messages.' });
            }
        } catch (error) {
            await sock.sendMessage(from, { text: '❌ Failed to change group settings!' });
        }
    }
    
    // ==================== ANTIDELETE ====================
    else if (command === 'antidelete') {
        if (!isOwner) {
            return await sock.sendMessage(from, { text: '❌ Only owner can toggle this!' });
        }
        
        if (args[0] === 'on') {
            autoRecoverEnabled = true;
            await sock.sendMessage(from, { text: '✅ Anti-delete ENABLED' });
        } else if (args[0] === 'off') {
            autoRecoverEnabled = false;
            await sock.sendMessage(from, { text: '❌ Anti-delete DISABLED' });
        } else {
            await sock.sendMessage(from, { text: `Anti-delete is currently ${autoRecoverEnabled ? 'ON' : 'OFF'}\nUse .antidelete on/off to change` });
        }
    }
    
    // ==================== RECOVER ====================
    else if (command === 'recover') {
        if (!autoRecoverEnabled) {
            return await sock.sendMessage(from, { text: '❌ Anti-delete is disabled! Enable with .antidelete on' });
        }
        
        const lastMessages = Array.from(messageCache.values()).slice(-10);
        if (lastMessages.length === 0) {
            return await sock.sendMessage(from, { text: '📭 No messages in cache!' });
        }
        
        let recoveryText = '📎 *Last 10 Cached Messages*\n\n';
        lastMessages.forEach((msg, i) => {
            let content = '';
            if (msg.content?.conversation) content = msg.content.conversation;
            else if (msg.content?.extendedTextMessage?.text) content = msg.content.extendedTextMessage.text;
            else content = '[Media/Sticker]';
            
            recoveryText += `${i+1}. From: ${msg.from.split('@')[0]}\n   ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}\n   Time: ${moment(msg.timestamp).format('HH:mm:ss')}\n\n`;
        });
        
        await simulateTyping(sock, from, 2000);
        await sock.sendMessage(from, { text: recoveryText });
    }
    
    // Unknown command
    else {
        return;
    }
}

// ============================================
// MAIN BOT FUNCTION
// ============================================

async function startBot() {
    console.log('🚀 Starting SpeedX Bot...');
    
    // Create T folder if it doesn't exist
    if (!fs.existsSync('./T')) {
        fs.mkdirSync('./T');
        console.log('📁 Created T folder. Add your spam message files there!');
    }
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    
    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['SpeedX Bot', 'Chrome', '1.0.0']
    });
    
    // Handle connection
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📱 SCAN THIS QR CODE WITH WHATSAPP:');
            console.log('Open WhatsApp > Settings > Linked Devices > Link a Device');
            const qrcode = require('qrcode-terminal');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'open') {
            console.log(`✅ ${CONFIG.BOT_NAME} is ONLINE!`);
            console.log(`📅 Started at: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
            console.log(`👑 Owner: ${CONFIG.OWNER_NUMBER.split('@')[0]}`);
            console.log(`⚡ Bot is ready to use!`);
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('🔄 Reconnecting in 5 seconds...');
                setTimeout(startBot, 5000);
            } else {
                console.log('❌ Bot logged out. Please restart and scan QR again.');
            }
        }
        
        sock.ev.on('creds.update', saveCreds);
    });
    
    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? msg.key.participant : from;
        
        // Store message for recovery
        if (msg.message && autoRecoverEnabled) {
            const msgId = msg.key.id;
            messageCache.set(msgId, {
                id: msgId,
                from: sender,
                content: msg.message,
                timestamp: Date.now()
            });
            
            if (messageCache.size > 500) {
                const oldest = Array.from(messageCache.keys())[0];
                messageCache.delete(oldest);
            }
        }
        
        // Check if user is waiting for spam count
        if (waitingUsers.has(sender)) {
            const waitingData = waitingUsers.get(sender);
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            
            if (text && waitingData.command === 'spam') {
                const count = parseInt(text);
                
                if (isNaN(count) || count < 1 || count > 100) {
                    await sock.sendMessage(from, { text: '❌ Invalid number! Please send a number between 1 and 100.' });
                    waitingUsers.delete(sender);
                    return;
                }
                
                // Start spamming
                await sendSpamMessages(sock, waitingData.number, waitingData.message, count, from);
                waitingUsers.delete(sender);
                return;
            }
        }
        
        // Handle commands
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        if (text && text.startsWith(CONFIG.PREFIX)) {
            const args = text.slice(CONFIG.PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            
            // Check if user is allowed
            const publicCommands = ['menu', 'ping', 'owner'];
            if (!publicCommands.includes(command) && !isAllowed(sender)) {
                await simulateTyping(sock, from, 1500);
                await sock.sendMessage(from, { 
                    text: `❌ *Access Denied*\n\nYou are not authorized to use this bot.\n\nContact owner: ${CONFIG.OWNER_NUMBER.split('@')[0]} to get access.` 
                });
                return;
            }
            
            // Execute command
            await handleCommand(sock, msg, command, args, { isGroup, sender, isOwner: sender === CONFIG.OWNER_NUMBER });
        }
    });
    
    // Handle message deletions
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update.update.messageStubType === 0 && update.update.messageStubParameters && autoRecoverEnabled) {
                const deletedMsgId = update.key.id;
                const recoveredMsg = messageCache.get(deletedMsgId);
                
                if (recoveredMsg) {
                    let content = '';
                    if (recoveredMsg.content?.conversation) {
                        content = recoveredMsg.content.conversation;
                    } else if (recoveredMsg.content?.extendedTextMessage?.text) {
                        content = recoveredMsg.content.extendedTextMessage.text;
                    } else {
                        content = '[Media/Sticker]';
                    }
                    
                    await sock.sendMessage(update.key.remoteJid, {
                        text: `📎 *Message Recovered*\n👤 From: ${recoveredMsg.from.split('@')[0]}\n💬 Content: ${content}\n⏰ Time: ${moment(recoveredMsg.timestamp).format('HH:mm:ss')}`
                    });
                }
            }
        }
    });
    
    // Handle status updates
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (msg.key.remoteJid === 'status@broadcast') {
                if (autoViewEnabled) {
                    await sock.readMessages([msg.key]);
                    console.log(`👁️ Viewed status from: ${msg.key.participant?.split('@')[0] || 'Unknown'}`);
                }
                
                if (autoLikeEnabled) {
                    await sock.sendMessage(msg.key.remoteJid, {
                        react: { text: '🔥', key: msg.key }
                    });
                }
            }
        }
    });
}

// ============================================
// START THE BOT
// ============================================

console.log(`
╔═══════════════════════════════════════╗
║     🚀 SPEEDX WHATSAPP BOT v2.0      ║
║     With K-9 Spam System             ║
╚═══════════════════════════════════════╝
`);

startBot().catch(err => {
    console.error('Failed to start bot:', err);
});
