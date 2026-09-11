require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActivityType, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const express = require('express');
const db = require('./db');
const { renderLeaderboardImage } = require('./leaderboard_renderer');
const { handleWordChainMessage } = require('./word_chain');

// 1. Tạo Web Server giữ Bot sống 24/7 trên Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🟢 Bot is online and healthy!'));
app.listen(PORT, () => console.log(`[HTTP] Server listening on port ${PORT}`));

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

client.once('ready', () => {
    console.log(`[BOT] 🚀 Đăng nhập thành công với tên: ${client.user.tag}`);
    client.user.setActivity('vstep-mastery.pages.dev 📚 | .help', { type: ActivityType.Watching });
});

// Voice session tracking (tính giờ học voice)
const voiceSessions = new Map();

client.on('voiceStateUpdate', (oldState, newState) => {
    const userId = newState.id;
    if (newState.member && newState.member.user.bot) return;

    const wasInVoice = !!oldState.channelId;
    const isInVoice = !!newState.channelId;

    if (!wasInVoice && isInVoice) {
        voiceSessions.set(userId, Date.now());
    } else if (wasInVoice && !isInVoice) {
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

    // Tích lũy tin nhắn & XP
    const { user, leveledUp } = db.addMessageXP(message.author.id);
    if (leveledUp) {
        message.channel.send(`🎉 Chúc mừng ${message.author}! Bạn đã thăng cấp học tập lên **Level ${user.level}**!`);
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

    // Lệnh .web / .cbt / .link
    if (cmd === 'web' || cmd === 'cbt' || cmd === 'link' || cmd === 'platform') {
        const embed = new EmbedBuilder()
            .setTitle('🌐 VSTEP C1 & IELTS MASTERY PLATFORM')
            .setColor(0x0284C7)
            .setDescription(
                '🔗 **CỔNG KHẢO THÍ & LUYỆN THI CHUẨN HÓA:**\n\n' +
                '• 🌐 **Trang chủ**: [vstep-mastery.pages.dev](https://vstep-mastery.pages.dev/)\n' +
                '• 💻 **Thi Thử CBT Máy Tính (52 Đề)**: [Mở CBT Player](https://vstep-mastery.pages.dev/ielts-cbt/player/cbt_player.html)\n' +
                '• 🔑 **Ngân hàng Đáp án & Giải thích**: [Tra cứu Answer Keys](https://vstep-mastery.pages.dev/ielts-cbt/player/answer_keys.html)\n' +
                '• ❓ **Hỏi Đáp (FAQ)**: [vstep-mastery.pages.dev/faq.html](https://vstep-mastery.pages.dev/faq.html)\n\n' +
                '📞 Hotline: **092.743.4662** | ✉️ Email: **vqvinh22@gmail.com**'
            )
            .setFooter({ text: 'VSTEP C1 & IELTS Mastery Platform' });
        return message.reply({ embeds: [embed] });
    }

    // Lệnh .help
    if (cmd === 'help' || cmd === 'trogiup') {
        const embed = new EmbedBuilder()
            .setTitle('📚 VSTEP & IELTS MASTERY BOT - DANH SÁCH LỆNH')
            .setColor(0x38BDF8)
            .setDescription('Chào mừng bạn đến với Hệ sinh thái Khảo thí VSTEP C1 & IELTS Mastery! Dưới đây là các lệnh hỗ trợ:')
            .addFields(
                { name: '🌐 Cổng Nền Tảng Web', value: '`.web` / `.cbt` — Lấy link trực tiếp trang chủ, 52 bộ đề thi CBT và đáp án.' },
                { name: '📊 Bảng Vinh Danh', value: '`.top` / `.xephang` / `.bxh` — Xem Bảng xếp hạng Top 10 học viên chăm chỉ nhất server (Canvas HD).' },
                { name: '🎯 Hồ Sơ & Điểm Học Tập', value: '`.diem` / `.profile` / `.bal` — Kiểm tra Level, XP, Điểm học tập, số tin nhắn và giờ học voice.' },
                { name: '🎁 Điểm Danh Hằng Ngày', value: '`.daily` — Điểm danh chuyên cần mỗi ngày để nhận ngay **+50,000 điểm**.' },
                { name: '🔤 Mini-Game Nối Từ', value: '`.noitu` / `.goiy` / `.bxh-noitu` — Tham gia luyện từ vựng trong kênh `#nối-từ`.' }
            )
            .setFooter({ text: 'Chăm chỉ mỗi ngày để cùng nâng cao trình độ Tiếng Anh!' });
        return message.reply({ embeds: [embed] });
    }

    // Lệnh .xephang / .top / .bxh (Render bảng xếp hạng bằng Canvas)
    if (cmd === 'xephang' || cmd === 'top' || cmd === 'bxh') {
        const topUsers = db.getTopUsers('coins', 10);
        const enrichedUsers = await Promise.all(topUsers.map(async (u) => {
            try {
                const member = await message.guild.members.fetch(u.id).catch(() => null);
                return {
                    ...u,
                    displayName: member ? member.displayName : (client.users.cache.get(u.id)?.username || `User ${u.id.slice(0, 6)}`),
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

    // Lệnh .diem / .balance / .bal / .profile
    if (cmd === 'diem' || cmd === 'profile' || cmd === 'balance' || cmd === 'bal') {
        const target = message.mentions.users.first() || message.author;
        const u = db.getUser(target.id);
        const voiceMins = Math.floor((u.voiceTime || 0) / 60);

        const embed = new EmbedBuilder()
            .setTitle(`🎓 Hồ Sơ Học Tập: ${target.username}`)
            .setColor(0x38BDF8)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '⭐ Cấp Độ (Level)', value: `**Level ${u.level || 1}** (${u.xp || 0} XP)`, inline: true },
                { name: '💎 Điểm Học Tập', value: `**${(u.coins || 0).toLocaleString('vi-VN')}** điểm`, inline: true },
                { name: '💬 Đóng Góp Thảo Luận', value: `**${(u.messages || 0).toLocaleString('vi-VN')}** tin nhắn`, inline: true },
                { name: '🎙️ Thời Gian Học Voice', value: `**${voiceMins}** phút (${(voiceMins / 60).toFixed(1)} giờ)`, inline: true }
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
            return message.reply(`⏳ Bạn đã điểm danh học tập hôm nay rồi. Vui lòng quay lại sau **${hours} giờ ${mins} phút**.`);
        }
        const reward = 50000;
        db.updateUser(message.author.id, user => {
            user.coins = (user.coins || 0) + reward;
            user.lastDaily = now;
        });
        return message.reply(`🎁 Bạn đã nhận điểm danh học tập chuyên cần: **+${reward.toLocaleString('vi-VN')} điểm**!`);
    }
});

// Xử lý nút bấm nhận vai trò (Self-assign role button)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'btn_role_notify') {
        const role = interaction.guild.roles.cache.find(r => r.name.includes('Nhận Thông Báo Lịch Thi'));
        if (!role) {
            return interaction.reply({ content: '⚠️ Không tìm thấy vai trò thông báo!', ephemeral: true });
        }
        const member = interaction.member;
        if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role.id).catch(() => null);
            return interaction.reply({ content: '🔕 Đã hủy nhận vai trò **🔔 Nhận Thông Báo Lịch Thi**.', ephemeral: true });
        } else {
            await member.roles.add(role.id).catch(() => null);
            return interaction.reply({ content: '🔔 Bạn đã nhận vai trò **🔔 Nhận Thông Báo Lịch Thi** thành công! Bạn sẽ nhận được ping khi có lịch thi thử CBT và workshop.', ephemeral: true });
        }
    }
});

// Đăng nhập bot
client.login(process.env.DISCORD_TOKEN);

