const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

// Náº¡p tá»« Ä‘iá»ƒn tiáº¿ng Viá»‡t
const DICT_PATH = path.join(__dirname, 'vietnamese_dict.json');
let dict = {};
try {
    if (fs.existsSync(DICT_PATH)) {
        dict = JSON.parse(fs.readFileSync(DICT_PATH, 'utf8'));
        console.log(`[WORD-CHAIN] ÄÃ£ náº¡p tá»« Ä‘iá»ƒn: ${Object.keys(dict).length} má»¥c tá»«`);
    } else {
        console.error('[WORD-CHAIN] KhÃ´ng tÃ¬m tháº¥y file vietnamese_dict.json!');
    }
} catch (e) {
    console.error('[WORD-CHAIN] Lá»—i khi náº¡p tá»« Ä‘iá»ƒn:', e);
}

// Danh sÃ¡ch cÃ¡c tá»« khá»Ÿi Ä‘áº§u Ä‘áº¹p máº¯t, phong phÃº
const STARTER_WORDS = [
    'há»c táº­p', 'thÃ nh phá»‘', 'phá»‘ phÆ°á»ng', 'quÃª hÆ°Æ¡ng', 'gia Ä‘Ã¬nh',
    'báº¡n bÃ¨', 'cÃ´ng viá»‡c', 'phÃ¡t triá»ƒn', 'tÆ°Æ¡ng lai', 'hy vá»ng',
    'yÃªu thÆ°Æ¡ng', 'cuá»™c sá»‘ng', 'tháº¿ giá»›i', 'con ngÆ°á»i', 'vÄƒn hÃ³a',
    'tri thá»©c', 'thÃ nh cÃ´ng', 'sÃ¡ng táº¡o', 'bÃ¬nh minh', 'mÃ¹a xuÃ¢n',
    'hoa há»“ng', 'tiáº¿ng cÆ°á»i', 'niá»m vui', 'chiáº¿n tháº¯ng', 'báº§u trá»i'
];

/**
 * Kiá»ƒm tra xem cá»¥m 2 tá»« cÃ³ há»£p lá»‡ trong tá»« Ä‘iá»ƒn khÃ´ng
 */
function isValidWord(w1, w2) {
    w1 = w1.toLowerCase().trim();
    w2 = w2.toLowerCase().trim();
    if (!dict[w1]) return false;
    return dict[w1].includes(w2);
}

/**
 * Láº¥y danh sÃ¡ch tá»« ná»‘i tiáº¿p kháº£ thi
 */
function getFollowUps(word) {
    word = word.toLowerCase().trim();
    return dict[word] || [];
}

/**
 * Láº¥y tá»« khá»Ÿi Ä‘áº§u ngáº«u nhiÃªn
 */
function getRandomStarter() {
    // Æ¯u tiÃªn cÃ¡c tá»« quen thuá»™c trong STARTER_WORDS
    const filtered = STARTER_WORDS.filter(w => {
        const parts = w.split(' ');
        return isValidWord(parts[0], parts[1]) && getFollowUps(parts[1]).length >= 5;
    });
    if (filtered.length > 0) {
        return filtered[Math.floor(Math.random() * filtered.length)];
    }
    return 'há»c táº­p';
}

/**
 * Khá»Ÿi táº¡o hoáº·c láº¥y tráº¡ng thÃ¡i game ná»‘i tá»«
 */
function getWordChainState(db) {
    const data = db.saveData ? require('./server_data.json') : {};
    if (!data.wordChain) {
        const starter = getRandomStarter();
        const parts = starter.split(' ');
        data.wordChain = {
            currentWord: starter,
            lastWord: parts[1],
            lastUserId: null,
            streak: 0,
            highStreak: 0,
            usedWords: [starter],
            scores: {}
        };
    }
    return data.wordChain;
}

/**
 * LÆ°u tráº¡ng thÃ¡i game
 */
function saveWordChainState(state) {
    try {
        const DB_FILE = path.join(__dirname, 'server_data.json');
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf-8');
            const data = JSON.parse(raw);
            data.wordChain = state;
            fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
        }
    } catch (e) {
        console.error('[WORD-CHAIN] Lá»—i khi lÆ°u state:', e);
    }
}

/**
 * Xá»­ lÃ½ tin nháº¯n trong kÃªnh Ná»‘i Tá»«
 */
async function handleWordChainMessage(message, db) {
    if (message.author.bot) return;

    const raw = message.content.trim();
    if (!raw) return;

    const state = getWordChainState(db);

    // 1. Lá»‡nh tiá»‡n Ã­ch: .goiy / .hint
    if (raw.toLowerCase() === '.goiy' || raw.toLowerCase() === '.hint') {
        const followUps = getFollowUps(state.lastWord);
        // Lá»c cÃ¡c tá»« chÆ°a bá»‹ sá»­ dá»¥ng gáº§n Ä‘Ã¢y
        const recentSet = new Set(state.usedWords.slice(-50).map(w => w.split(' ')[1]));
        const available = followUps.filter(w2 => !recentSet.has(w2));

        if (available.length > 0) {
            const sample = available.slice(0, 3).map(w2 => `\`${state.lastWord} ${w2}\``).join(', ');
            return message.reply(`ðŸ’¡ **Gá»£i Ã½ tá»« tiáº¿p theo báº¯t Ä‘áº§u báº±ng "${state.lastWord}":** ${sample}`);
        } else {
            return message.reply(`âš ï¸ KhÃ´ng tÃ¬m tháº¥y tá»« thÃ´ng dá»¥ng nÃ o tiáº¿p theo! Báº¡n cÃ³ thá»ƒ gÃµ \`.noitu-reset\` Ä‘á»ƒ má»Ÿ vÃ¡n má»›i.`);
        }
    }

    // 2. Lá»‡nh xem tráº¡ng thÃ¡i: .noitu / .status
    if (raw.toLowerCase() === '.noitu' || raw.toLowerCase() === '.status') {
        const embed = new EmbedBuilder()
            .setTitle('ðŸ“– TRáº NG THÃI PHÃ’NG Ná»I Tá»ª')
            .setColor(0x3498DB)
            .setDescription(
                `â€¢ Tá»« hiá»‡n táº¡i: **${state.currentWord}**\n` +
                `â€¢ Tá»« tiáº¿p theo pháº£i báº¯t Ä‘áº§u báº±ng: **${state.lastWord.toUpperCase()}**\n` +
                `â€¢ NgÆ°á»i vá»«a ná»‘i: ${state.lastUserId ? `<@${state.lastUserId}>` : '*ChÆ°a cÃ³*'}\n` +
                `â€¢ Chuá»—i ná»‘i liÃªn tiáº¿p hiá»‡n táº¡i: **${state.streak}** tá»« ðŸ”¥\n` +
                `â€¢ Ká»· lá»¥c server: **${state.highStreak || 0}** tá»« ðŸ†\n\n` +
                `*GÃµ cá»¥m 2 tá»« Ä‘á»ƒ tiáº¿p tá»¥c (VÃ­ dá»¥: "${state.lastWord} ...")*`
            )
            .setFooter({ text: 'DÃ¹ng .goiy náº¿u báº¡n bá»‹ bÃ­ tá»« | Má»—i tá»« Ä‘Ãºng +100 điểm học tập' });
        return message.reply({ embeds: [embed] });
    }

    // 3. Lá»‡nh reset: .noitu-reset (Chá»‰ Admin / Mod)
    if (raw.toLowerCase() === '.noitu-reset' || raw.toLowerCase() === '.reset-noitu') {
        const newStarter = getRandomStarter();
        const parts = newStarter.split(' ');
        state.currentWord = newStarter;
        state.lastWord = parts[1];
        state.lastUserId = null;
        state.streak = 0;
        state.usedWords = [newStarter];
        saveWordChainState(state);

        return message.reply(`ðŸ”„ **ÄÃƒ KHá»žI Äá»˜NG Láº I PHÃ’NG Ná»I Tá»ª!**\n> Tá»« má»Ÿ mÃ n má»›i: **${newStarter}**\n> NgÆ°á»i tiáº¿p theo hÃ£y ná»‘i tá»« báº¯t Ä‘áº§u báº±ng chá»¯: **${parts[1].toUpperCase()}**`);
    }

    // 4. Lá»‡nh BXH Ná»‘i tá»«: .bxh-noitu / .top-noitu
    if (raw.toLowerCase() === '.bxh-noitu' || raw.toLowerCase() === '.top-noitu') {
        const scores = Object.entries(state.scores || {})
            .map(([id, count]) => ({ id, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const medals = ['ðŸ¥‡', 'ðŸ¥ˆ', 'ðŸ¥‰', '4ï¸âƒ£', '5ï¸âƒ£', '6ï¸âƒ£', '7ï¸âƒ£', '8ï¸âƒ£', '9ï¸âƒ£', 'ðŸ”Ÿ'];
        const desc = scores.map((s, i) => `${medals[i]} <@${s.id}> â€” **${s.count}** tá»«`).join('\n') || '*ChÆ°a cÃ³ dá»¯ liá»‡u báº£ng xáº¿p háº¡ng.*';

        const embed = new EmbedBuilder()
            .setTitle('ðŸ† Báº¢NG Xáº¾P Háº NG CAO THá»¦ Ná»I Tá»ª')
            .setColor(0xF1C40F)
            .setDescription(desc)
            .setFooter({ text: 'Tham gia ná»‘i tá»« chuáº©n xÃ¡c Ä‘á»ƒ leo báº£ng xáº¿p háº¡ng!' });
        return message.reply({ embeds: [embed] });
    }

    // Bá» qua cÃ¡c lá»‡nh bot khÃ¡c báº¯t Ä‘áº§u báº±ng dáº¥u cháº¥m
    if (raw.startsWith('.')) return;

    // 5. KIá»‚M TRA Äá»ŠNH Dáº NG Tá»ª (Pháº£i Ä‘Ãºng 2 tá»« tiáº¿ng Viá»‡t)
    const cleanText = raw.toLowerCase().replace(/[-_]/g, ' ').replace(/[.,!?;:\"\'\(\)]/g, '').trim();
    const parts = cleanText.split(/\s+/).filter(Boolean);

    if (parts.length !== 2) {
        await message.react('âš ï¸').catch(() => null);
        return message.reply(`> âš ï¸ Cá»¥m tá»« ná»‘i pháº£i gá»“m **Ä‘Ãºng 2 tá»« tiáº¿ng Viá»‡t**! Báº¡n cáº§n ná»‘i tá»« báº¯t Ä‘áº§u báº±ng chá»¯ "**${state.lastWord}**" (VD: *${state.lastWord} ...*).`);
    }

    const [w1, w2] = parts;
    const phrase = `${w1} ${w2}`;

    // 6. KIá»‚M TRA LUáº¬T Tá»° Ná»I Tá»ª Cá»¦A CHÃNH MÃŒNH
    if (state.lastUserId && message.author.id === state.lastUserId) {
        await message.react('â³').catch(() => null);
        return message.reply(`> â³ <@${message.author.id}>, báº¡n vá»«a ná»‘i tá»« trÆ°á»›c Ä‘Ã³ rá»“i! HÃ£y nhÆ°á»ng lÆ°á»£t cho ngÆ°á»i khÃ¡c ná»‘i tiáº¿p nhÃ©.`);
    }

    // 7. KIá»‚M TRA Tá»ª Äáº¦U TIÃŠN CÃ“ TRÃ™NG Vá»šI Tá»ª CUá»I Cá»¦A NGÆ¯á»œI TRÆ¯á»šC KHÃ”NG
    if (w1 !== state.lastWord.toLowerCase()) {
        await message.react('1547511614323036230').catch(() => message.react('âŒ').catch(() => null));
        return message.reply(`> <a:mxt_cross_red:1547511614323036230> **Sai chá»¯ ná»‘i rá»“i!** NgÆ°á»i trÆ°á»›c káº¿t thÃºc báº±ng chá»¯ "**${state.lastWord}**", báº¡n pháº£i ná»‘i tá»« báº¯t Ä‘áº§u báº±ng "**${state.lastWord}**" má»›i Ä‘Ãºng.`);
    }

    // 8. KIá»‚M TRA Tá»ª CÃ“ TRONG Tá»ª ÄIá»‚N KHÃ”NG
    if (!isValidWord(w1, w2)) {
        await message.react('1547511614323036230').catch(() => message.react('â“').catch(() => null));
        return message.reply(`> <a:mxt_cross_red:1547511614323036230> Tá»« "**${phrase}**" khÃ´ng cÃ³ trong tá»« Ä‘iá»ƒn tiáº¿ng Viá»‡t hoáº·c khÃ´ng pháº£i tá»« ghÃ©p há»£p lá»‡! Vui lÃ²ng chá»n tá»« khÃ¡c.`);
    }

    // 9. KIá»‚M TRA Tá»ª ÄÃƒ DÃ™NG TRONG 50 LÆ¯á»¢T Gáº¦N ÄÃ‚Y CHÆ¯A
    const recentIndex = state.usedWords.indexOf(phrase);
    if (recentIndex !== -1) {
        const turnsAgo = state.usedWords.length - 1 - recentIndex;
        if (turnsAgo < 50) {
            const waitTurns = 50 - turnsAgo;
            await message.react('1547511614323036230').catch(() => message.react('ðŸ”').catch(() => null));
            return message.reply(`> <a:mxt_cross_red:1547511614323036230> Tá»« "**${phrase}**" Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng trong 50 lÆ°á»£t gáº§n Ä‘Ã¢y! CÃ³ thá»ƒ dÃ¹ng láº¡i sau **${waitTurns}** lÆ°á»£t ná»¯a.`);
        }
    }

    // ==========================================
    // 10. Ná»I Tá»ª Há»¢P Lá»† THÃ€NH CÃ”NG!
    // ==========================================
    await message.react('1547511610594173009').catch(() => message.react('âœ…').catch(() => null));

    state.currentWord = phrase;
    state.lastWord = w2;
    state.lastUserId = message.author.id;
    state.usedWords.push(phrase);
    if (state.usedWords.length > 100) {
        state.usedWords = state.usedWords.slice(-100);
    }
    state.streak += 1;
    if (state.streak > (state.highStreak || 0)) {
        state.highStreak = state.streak;
    }
    if (!state.scores) state.scores = {};
    state.scores[message.author.id] = (state.scores[message.author.id] || 0) + 1;

    // Cá»™ng thÆ°á»Ÿng cho ngÆ°á»i chÆ¡i: +100 điểm học tập & +15 XP
    db.updateUser(message.author.id, u => {
        u.coins += 100;
        u.xp += 15;
    });

    saveWordChainState(state);

    // Kiá»ƒm tra xem tá»« vá»«a Ä‘Æ°a ra cÃ³ pháº£i "CHIáº¾U TÆ¯á»šNG" (KhÃ´ng cÃ²n tá»« nÃ o ná»‘i tiáº¿p Ä‘Æ°á»£c)
    const followUps = getFollowUps(w2);
    if (followUps.length === 0) {
        // ThÆ°á»Ÿng lá»›n vÃ¬ chiáº¿u tÆ°á»›ng
        db.updateUser(message.author.id, u => {
            u.coins += 500;
        });

        const newStarter = getRandomStarter();
        const newParts = newStarter.split(' ');
        state.currentWord = newStarter;
        state.lastWord = newParts[1];
        state.lastUserId = null;
        state.streak = 0;
        state.usedWords = [newStarter];
        saveWordChainState(state);

        return message.reply(
            `ðŸ’¥ðŸ’¥ **CHIáº¾U TÆ¯á»šNG!** <@${message.author.id}> Ä‘Ã£ chá»‘t háº¡ xuáº¥t sáº¯c vá»›i tá»« "**${phrase}**" (Tá»« Ä‘iá»ƒn khÃ´ng cÃ²n tá»« nÃ o báº¯t Ä‘áº§u báº±ng "${w2}")!\n` +
            `ðŸŽ ThÆ°á»Ÿng nÃ³ng **+500 điểm học tập** cho cao thá»§!\n\n` +
            `ðŸ”„ **VÃ¡n má»›i báº¯t Ä‘áº§u!** Tá»« má»Ÿ mÃ n: **${newStarter}** âž” HÃ£y ná»‘i tá»« chá»¯: **${newParts[1].toUpperCase()}**`
        );
    }

    // Khen ngá»£i cá»™t má»‘c chuá»—i dÃ i
    if (state.streak % 25 === 0) {
        return message.channel.send(`ðŸ”¥ **Äáº²NG Cáº¤P!** Chuá»—i ná»‘i tá»« server Ä‘Ã£ Ä‘áº¡t má»‘c **${state.streak} Tá»ª LIÃŠN TIáº¾P**! HÃ£y tiáº¿p tá»¥c duy trÃ¬ ká»· lá»¥c nÃ o!`);
    }
}

module.exports = {
    isValidWord,
    getFollowUps,
    getRandomStarter,
    getWordChainState,
    saveWordChainState,
    handleWordChainMessage
};

