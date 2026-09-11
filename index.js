require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActivityType, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const express = require('express');
const db = require('./db');
const { renderLeaderboardImage } = require('./leaderboard_renderer');
const { handleWordChainMessage } = require('./word_chain');

// 1. Tạo Web Server giữ Bot sống 24/7 trên Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🟢 English Study Bot is online and healthy 24/7!'));
app.listen(PORT, () => console.log([HTTP] Server listening on port ));

// 2. Khởi tạo Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const PREFIX = process.env.PREFIX || '.';

// Voice session tracking (tính giờ học voice)
const voiceSessions = new Map(); // userId -> joinTimestamp

client.once('ready', () => {
    console.log([BOT] 🚀 Đăng nhập thành công với tên: );
    client.user.setActivity('English Study Room 📚 | .help', { type: ActivityType.Watching });
});

// Xử lý Voice State Update: Tích lũy thời gian học tập trong Voice Channel
client.on('voiceStateUpdate', (oldState, newState) => {
    const userId = newState.id;
    if (newState.member && newState.member.user.bot) return;

    const wasInVoice = !!oldState.channelId;
    const isInVoice = !!newState.channelId;

    if (!wasInVoice && isInVoice) {
        // Tham gia voice room học tập
        voiceSessions.set(userId, Date.now());
    } else if (wasInVoice && !isInVoice) {
        // Rời voice room
        const joinTime = voiceSessions.get(userId);
        if (joinTime) {
            const seconds = Math.floor((Date.now() - joinTime) / 1000);
            if (seconds >= 30) {
                db.addVoiceTime(userId, seconds);
            }
            voiceSessions.delete(userId);
        }
    }
});

// 3. Xử lý tin nhắn và lệnh
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Tích lũy tin nhắn & XP học tập
    const { user, leveledUp } = db.addMessageXP(message.author.id);
    if (leveledUp) {
        message.channel.send(🎉 Chúc mừng ! Bạn đã nâng cấp trình độ học tập lên **Level **!);
    }

    // Xử lý game Nối Từ (nếu ở kênh nối từ)
    if (message.channel.name.includes('nối-từ') || message.channel.name.includes('noi-tu') || message.channel.name.includes('word-chain')) {
        const handled = await handleWordChainMessage(message, db);
        if (handled) return;
    }

    // Kiểm tra prefix
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // Lệnh trợ giúp .help
    if (cmd === 'help' || cmd === 'trogiup') {
        const embed = new EmbedBuilder()
            .setTitle('📚 ENGLISH STUDY BOT - DANH SÁCH LỆNH')
            .setColor(0x38BDF8)
            .setDescription('Chào mừng bạn đến với Server Học Tập Tiếng Anh! Dưới đây là các lệnh hỗ trợ:')
            .addFields(
                { name: '📊 Bảng Vinh Danh', value: '.top / .xephang / .bxh — Xem Bảng xếp hạng Top 10 học viên chăm chỉ nhất server (Canvas HD).' },
                { name: '🎯 Hồ Sơ & Điểm Học Tập', value: '.diem / .profile / .bal — Kiểm tra Level, XP, Điểm học tập, số tin nhắn và giờ học voice.' },
                { name: '🎁 Điểm Danh Hằng Ngày', value: '.daily — Điểm danh chuyên cần mỗi ngày để nhận ngay **+50,000 điểm**.' },
                { name: '🔤 Mini-Game Nối Từ', value: '.noitu / .goiy / .bxh-noitu — Tham gia luyện từ vựng trong kênh #nối-từ.' }
            )
            .setFooter({ text: 'Chăm chỉ mỗi ngày để cùng nâng cao trình độ Tiếng Anh!' });
        return message.reply({ embeds: [embed] });
    }

    // Lệnh .xephang / .top / .bxh (Render bảng xếp hạng bằng Canvas)
    if (cmd === 'xephang' || cmd === 'top' || cmd === 'bxh') {
        const topUsers = db.getTopUsers('coins', 10);
        
        // Enrich với avatar & display name từ Discord Guild
        const enrichedUsers = await Promise.all(topUsers.map(async (u) => {
            try {
                const member = await message.guild.members.fetch(u.id).catch(() => null);
                return {
                    ...u,
                    displayName: member ? member.displayName : (client.users.cache.get(u.id)?.username || User ),
                    avatarURL: member ? member.displayAvatarURL({ extension: 'png', size: 128 }) : (client.users.cache.get(u.id)?.displayAvatarURL({ extension: 'png', size: 128 }) || null)
                };
            } catch (e) {
                return u;
            }
        }));

        const imageBuffer = await renderLeaderboardImage(enrichedUsers, client);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'study_leaderboard.png' });
        return message.reply({ files: [attachment] });
    }

    // Lệnh .diem / .profile / .balance / .bal
    if (cmd === 'diem' || cmd === 'profile' || cmd === 'balance' || cmd === 'bal') {
        const target = message.mentions.users.first() || message.author;
        const u = db.getUser(target.id);
        const voiceMins = Math.floor((u.voiceTime || 0) / 60);

        const embed = new EmbedBuilder()
            .setTitle(🎓 Hồ Sơ Học Tập: )
            .setColor(0x38BDF8)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '⭐ Cấp Độ (Level)', value: **Level ** ( XP), inline: true },
                { name: '💎 Điểm Học Tập', value: **** điểm, inline: true },
                { name: '💬 Đóng Góp Thảo Luận', value: **** tin nhắn, inline: true },
                { name: '🎙️ Thời Gian Học Voice', value: **** phút ( giờ), inline: true }
            )
            .setFooter({ text: 'Tham gia học tập và thảo luận thường xuyên để gia tăng thứ hạng!' });
        return message.reply({ embeds: [embed] });
    }

    // Lệnh .daily (Điểm danh học tập mỗi ngày)
    if (cmd === 'daily') {
        const u = db.getUser(message.author.id);
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        if (u.lastDaily && now - u.lastDaily < oneDay) {
            const timeLeft = oneDay - (now - u.lastDaily);
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const mins = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            return message.reply(⏳ Bạn đã điểm danh hôm nay rồi. Hãy quay lại sau ** giờ  phút** nhé!);
        }
        const reward = 50000;
        db.updateUser(message.author.id, user => {
            user.coins = (user.coins || 0) + reward;
            user.lastDaily = now;
        });
        return message.reply(🎁 Bạn đã điểm danh chuyên cần hôm nay: **+ điểm học tập**! Tiếp tục phát huy nhé! 🌟);
    }
});

// Đăng nhập bot
client.login(process.env.DISCORD_TOKEN);
