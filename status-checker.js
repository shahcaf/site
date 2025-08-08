require('dotenv').config();
const axios = require('axios');
const { Webhook, MessageBuilder } = require('discord-webhook-node');

// Load environment variables
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const WEBSITE_URL = process.env.WEBSITE_URL || 'http://localhost:3000';
const CHECK_INTERVAL = (process.env.STATUS_CHECK_INTERVAL || 5) * 60 * 1000; // Convert to milliseconds

if (!DISCORD_WEBHOOK_URL) {
    console.error('Error: DISCORD_WEBHOOK_URL is not defined in .env file');
    process.exit(1);
}

const hook = new Webhook(DISCORD_WEBHOOK_URL);
let isOnline = false;
let lastStatus = null;

async function checkWebsiteStatus() {
    try {
        const startTime = Date.now();
        const response = await axios.get(WEBSITE_URL, { timeout: 10000 });
        const responseTime = Date.now() - startTime;
        
        if (response.status >= 200 && response.status < 400) {
            if (!isOnline) {
                await sendStatusUpdate(true, responseTime);
            }
            isOnline = true;
            console.log(`✅ Website is online (${response.status} - ${response.statusText}) - Response time: ${responseTime}ms`);
        } else {
            if (isOnline || lastStatus === null) {
                await sendStatusUpdate(false, responseTime, `${response.status} - ${response.statusText}`);
            }
            isOnline = false;
            console.error(`❌ Website returned an error: ${response.status} - ${response.statusText}`);
        }
    } catch (error) {
        if (isOnline || lastStatus === null) {
            await sendStatusUpdate(false, null, error.message);
        }
        isOnline = false;
        console.error(`❌ Error checking website status: ${error.message}`);
    }
    
    lastStatus = isOnline ? 'online' : 'offline';
}

async function sendStatusUpdate(online, responseTime, errorMessage = '') {
    const status = online ? '🟢 ONLINE' : '🔴 OFFLINE';
    const color = online ? 3066993 : 15158332; // Green or Red
    
    const embed = new MessageBuilder()
        .setTitle('🚀 Website Status Update')
        .setColor(color)
        .setDescription(`**Status:** ${status}\n**URL:** ${WEBSITE_URL}`)
        .setTimestamp();
    
    if (online) {
        embed.addField('Response Time', `${responseTime}ms`, true);
    } else if (errorMessage) {
        embed.addField('Error', `\`\`\`${errorMessage}\`\`\``);
    }
    
    try {
        await hook.send(embed);
        console.log(`📢 Sent status update to Discord: ${status}`);
    } catch (error) {
        console.error('❌ Failed to send Discord webhook:', error.message);
    }
}

console.log(`🌐 Starting website status monitor for: ${WEBSITE_URL}`);
console.log(`⏱️  Checking every ${CHECK_INTERVAL / 60000} minutes`);

// Initial check
checkWebsiteStatus();

// Schedule regular checks
setInterval(checkWebsiteStatus, CHECK_INTERVAL);
