// ============================================
// SPEEDX BOT - FIXED FOR RENDER
// Owner: 237651707126
// ============================================

const { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ytdl = require('ytdl-core');
const moment = require('moment');

// ============================================
// CONFIGURATION - YOUR NUMBER IS ALREADY SET!
// ============================================
const CONFIG = {
    PREFIX: '.',
    BOT_NAME: 'SpeedX',
    OWNER_NUMBER: '237651707126@s.whatsapp.net',  // ✅ YOUR NUMBER IS HERE!
    OWNER_NAME: 'SpeedX Owner',
    AUTO_VIEW_STATUS: true,
    AUTO_LIKE_STATUS: true,
    AUTO_RECOVER: true
};

// Allowed users
let allowedUsers = new Set();

// Load allowed users
if (fs.existsSync('./allowed.json')) {
    try {
        const data = fs.readFileSync('./allowed.json', 'utf8');
        allowedUsers = new Set(JSON.parse(data));
    } catch(e) {
        console.log('No allowed users file found');
    }
}

// Message cache
let messageCache = new Map();

// Bot settings
let autoViewEnabled = CONFIG.AUTO_VIEW_STATUS;
let autoLikeEnabled = CONFIG.AUTO_LIKE_STATUS;
let autoRecoverEnabled = CONFIG.AUTO_RECOVER;
let botStartTime = Date.now();

// Waiting users for spam
let waitingUsers = new Map();

function isAllowed(userJid) {
    if (userJid === CONFIG.OWNER_NUMBER) return true;
    return allowedUsers.has(userJid);
}

function saveAllowedUsers() {
    fs.writeFileSync('./allowed.json', JSON.stringify(Array.from(allowedUsers)));
}

function loadSpamMessage(type) {
    const filePath = path.join(__dirname, 'T', `${type}.js`);
    if (!fs.existsSync(filePath)) return null;
    try {
        const messageModule = require(filePath);
        return messageModule.message || messageModule.default || null;
    } catch (error) {
        console.error(`Failed to load ${type} message:`, error);
        return null;
    }
}

async function sendSpamMessages(sock, targetNumber, message, count, from) {
    const targetJid = targetNumber.includes('@') ? targetNumber : `${targetNumber}@s.whatsapp.net`;
    let successCount = 0;
    let failCount = 0;
    
    await sock.sendMessage(from, { text: `🚀 Starting spam to ${targetNumber}\n🔁 Count: ${count} times\n⏳ Sending...` });
    
    for (let i = 1; i <= count; i++) {
        try {
            await sock.sendMessage(targetJid, { text: message });
            successCount++;
            if (i % 10 === 0 || i === count) {
                await sock.sendMessage(from, { text: `📊 Progress: ${i}/${count} sent to ${targetNumber}` });
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            failCount++;
            console.error(`Failed to send message ${i}:`, error.message);
            if (error.message.includes('blocked')) {
                await sock.sendMessage(from, { text: `⚠️ User ${targetNumber} has blocked the bot! Stopping.` });
                break;
            }
        }
    }
    
    await sock.sendMessage(from, { 
        text: `✅ *Spam Complete!*\n\n📱 Target: ${targetNumber}\n✅ Sent: ${successCount}\n❌ Failed: ${failCount}\n📝 Message: ${message.substring(0, 50)}...` 
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
    
    // MENU
    if (command === 'menu') {
        const menu = `╭───❒ *${CONFIG.BOT_NAME} MENU* ❒───
│
├─❒ *📱 GENERAL*
│  • ${CONFIG.PREFIX}menu - Show menu
│  • ${CONFIG.PREFIX}ping - Check bot status
│  • ${CONFIG.PREFIX}owner - Contact owner
│
├─❒ *👁️ STATUS*
│  • ${CONFIG.PREFIX}autoview on/off - Auto view status
│  • ${CONFIG.PREFIX}autolike on/off - Auto like status
│  • Status: ${autoViewEnabled ? '✅' : '❌'} View | ${autoLikeEnabled ? '✅' : '❌'} Like
│
├─❒ *🐕 K-9 SPAM SYSTEM*
│  • ${CONFIG.PREFIX}fish +237651707126 - Spam fish message
│  • ${CONFIG.PREFIX}dog +237651707126 - Spam dog message
│  • ${CONFIG.PREFIX}cat +237651707126 - Spam cat message
│  *How to use:* Send command with number, bot asks for count, reply with number (1-100)
│
├─❒ *👑 OWNER ONLY*
│  • ${CONFIG.PREFIX}adduser @user - Add user access
│  • ${CONFIG.PREFIX}removeuser @user - Remove user
│  • ${CONFIG.PREFIX}listusers - Show allowed users
│  • ${CONFIG.PREFIX}shutdown - Turn off bot
│
╰───❒ *Version: 2.0* ❒───

⚡ *Powered by ${CONFIG.BOT_NAME}*`;
        
        await sock.sendMessage(from, { text: menu });
    }
    
    // PING
    else if (command === 'ping') {
        const start = Date.now();
        await sock.sendMessage(from, { text: '🏓 Pinging...' });
        const ping = Date.now() - start;
        await sock.sendMessage(from, { text: `🏓 *Pong!*\n⏱️ Latency: ${ping}ms\n🤖 Bot: Online\n⚡ ${CONFIG.BOT_NAME} Active` });
    }
    
    // OWNER
    else if (command === 'owner') {
        await sock.sendMessage(from, { 
            text: `👑 *Bot Owner*\n\nNumber: ${CONFIG.OWNER_NUMBER.split('@')[0]}\n\nFor support or issues, contact the owner.` 
        });
    }
    
    // AUTOVIEW
    else if (command === 'autoview') {
        if (!isOwner) return await sock.sendMessage(from, { text: '❌ Only owner can change this!' });
        if (args[0] === 'on') {
            autoViewEnabled = true;
            await sock.sendMessage(from, { text: '✅ Auto view status ENABLED' });
        } else if (args[0] === 'off') {
            autoViewEnabled = false;
            await sock.sendMessage(from, { text: '❌ Auto view status DISABLED' });
        } else {
            await sock.sendMessage(from, { text: `Auto view is currently ${autoViewEnabled ? 'ON' : 'OFF'}\nUse .autoview on/off` });
        }
    }
    
    // AUTOLIKE
    else if (command === 'autolike') {
        if (!isOwner) return await sock.sendMessage(from, { text: '❌ Only owner can change this!' });
        if (args[0] === 'on') {
            autoLikeEnabled = true;
            await sock.sendMessage(from, { text: '✅ Auto like status ENABLED' });
        } else if (args[0] === 'off') {
            autoLikeEnabled = false;
            await sock.sendMessage(from, { text: '❌ Auto like status DISABLED' });
        } else {
            await sock.sendMessage(from, { text: `Auto like is currently ${autoLikeEnabled ? 'ON' : 'OFF'}\nUse .autolike on/off` });
        }
    }
    
    // FISH SPAM
    else if (command === 'fish') {
        if (!args[0]) {
            return await sock.sendMessage(from, { text: `❌ Please provide a number!\nExample: ${CONFIG.PREFIX}fish +237651707126` });
        }
        const phoneNumber = args[0];
        if (!phoneNumber.match(/^\+?[0-9]{10,15}$/)) {
            return await sock.sendMessage(from, { text: '❌ Invalid number! Use format: +237651707126' });
        }
        const spamMessage = loadSpamMessage('fish');
        if (!spamMessage) {
            return await sock.sendMessage(from, { text: '❌ No spam message found for fish! Create T/fish.js file.' });
        }
        waitingUsers.set(sender, {
            command: 'spam',
            type: 'fish',
            number: phoneNumber,
            message: spamMessage
        });
        await sock.sendMessage(from, { 
            text: `🐟 *Fish Spam Ready!*\n\nTarget: ${phoneNumber}\n\n📝 *Reply with the number of times (1-100)*` 
        });
    }
    
    // DOG SPAM
    else if (command === 'dog') {
        if (!args[0]) {
            return await sock.sendMessage(from, { text: `❌ Please provide a number!\nExample: ${CONFIG.PREFIX}dog +237651707126` });
        }
        const phoneNumber = args[0];
        if (!phoneNumber.match(/^\+?[0-9]{10,15}$/)) {
            return await sock.sendMessage(from, { text: '❌ Invalid number! Use format: +237651707126' });
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
        await sock.sendMessage(from, { 
            text: `🐕 *Dog Spam Ready!*\n\nTarget: ${phoneNumber}\n\n📝 *Reply with the number of times (1-100)*` 
        });
    }
    
    // CAT SPAM
    else if (command === 'cat') {
        if (!args[0]) {
            return await sock.sendMessage(from, { text: `❌ Please provide a number!\nExample: ${CONFIG.PREFIX}cat +237651707126` });
        }
        const phoneNumber = args[0];
        if (!phoneNumber.match(/^\+?[0-9]{10,15}$/)) {
            return await sock.sendMessage(from, { text: '❌ Invalid number! Use format: +237651707126' });
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
        await sock.sendMessage(from, { 
            text: `🐱 *Cat Spam Ready!*\n\nTarget: ${phoneNumber}\n\n📝 *Reply with the number of times (1-100)*` 
        });
    }
    
    // ADD USER
    else if (command === 'adduser') {
        if (!isOwner) return await sock.sendMessage(from, { text: '❌ Only owner can use this!' });
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (!mentioned || mentioned.length === 0) {
            return await sock.sendMessage(from, { text: '❌ Please mention the user to add!\nExample: .adduser @user' });
        }
        const userToAdd = mentioned[0];
        allowedUsers.add(userToAdd);
        saveAllowedUsers();
        await sock.sendMessage(from, { text: `✅ User ${userToAdd.split('@')[0]} has been added!` });
    }
    
    // REMOVE USER
    else if (command === 'removeuser') {
        if (!isOwner) return await sock.sendMessage(from, { text: '❌ Only owner can use this!' });
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
        if (!mentioned || mentioned.length === 0) {
            return await sock.sendMessage(from, { text: '❌ Please mention the user to remove!' });
        }
        const userToRemove = mentioned[0];
        allowedUsers.delete(userToRemove);
        saveAllowedUsers();
        await sock.sendMessage(from, { text: `❌ User ${userToRemove.split('@')[0]} has been removed.` });
    }
    
    // LIST USERS
    else if (command === 'listusers') {
        if (!isOwner) return await sock.sendMessage(from, { text: '❌ Only owner can view this!' });
        if (allowedUsers.size === 0) {
            return await sock.sendMessage(from, { text: '📋 No users added yet.' });
        }
        let userList = '📋 *Allowed Users*\n\n';
        allowedUsers.forEach(user => {
            userList += `• ${user.split('@')[0]}\n`;
        });
        await sock.sendMessage(from, { text: userList });
    }
    
    // SHUTDOWN
    else if (command === 'shutdown') {
        if (!isOwner) return await sock.sendMessage(from, { text: '❌ Only owner can shutdown!' });
        await sock.sendMessage(from, { text: '🔄 Shutting down bot...' });
        process.exit(0);
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
        console.log('📁 Created T folder');
    }
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    
    const sock = makeWASocket({
        auth: state,
        logger: Pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['SpeedX Bot', 'Chrome', '1.0.0']
    });
    
    // Handle connection events
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n📱 SCAN THIS QR CODE WITH WHATSAPP:');
            console.log('Open WhatsApp > Settings > Linked Devices > Link a Device\n');
            // Generate QR in terminal
            const qrcode = require('qrcode-terminal');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'open') {
            console.log(`\n✅ ${CONFIG.BOT_NAME} is ONLINE!`);
            console.log(`📅 Started at: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
            console.log(`👑 Owner: ${CONFIG.OWNER_NUMBER.split('@')[0]}`);
            console.log(`⚡ Bot is ready to use!\n`);
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log('🔄 Reconnecting in 5 seconds...');
                setTimeout(startBot, 5000);
            } else {
                console.log('❌ Bot logged out. Please restart.');
            }
        }
        
        sock.ev.on('creds.update', saveCreds);
    });
    
    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? msg.key.participant : from;
        
        // Store message for recovery
        if (msg.message && autoRecoverEnabled) {
            messageCache.set(msg.key.id, {
                id: msg.key.id,
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
                    await sock.sendMessage(from, { text: '❌ Invalid! Send a number between 1 and 100.' });
                    waitingUsers.delete(sender);
                    return;
                }
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
            
            const publicCommands = ['menu', 'ping', 'owner'];
            if (!publicCommands.includes(command) && !isAllowed(sender)) {
                await sock.sendMessage(from, { 
                    text: `❌ *Access Denied*\n\nContact owner: ${CONFIG.OWNER_NUMBER.split('@')[0]} to get access.` 
                });
                return;
            }
            
            await handleCommand(sock, msg, command, args, { isGroup, sender, isOwner: sender === CONFIG.OWNER_NUMBER });
        }
    });
    
    // Handle deleted messages
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update.update.messageStubType === 0 && update.update.messageStubParameters && autoRecoverEnabled) {
                const deletedMsgId = update.key.id;
                const recoveredMsg = messageCache.get(deletedMsgId);
                if (recoveredMsg) {
                    let content = '';
                    if (recoveredMsg.content?.conversation) content = recoveredMsg.content.conversation;
                    else if (recoveredMsg.content?.extendedTextMessage?.text) content = recoveredMsg.content.extendedTextMessage.text;
                    else content = '[Media]';
                    
                    await sock.sendMessage(update.key.remoteJid, {
                        text: `📎 *Message Recovered*\n👤 From: ${recoveredMsg.from.split('@')[0]}\n💬 ${content}\n⏰ ${moment(recoveredMsg.timestamp).format('HH:mm:ss')}`
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
                    console.log(`👁️ Viewed status`);
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
║     Owner: 237651707126              ║
╚═══════════════════════════════════════╝
`);

startBot().catch(err => {
    console.error('Failed to start bot:', err);
});
