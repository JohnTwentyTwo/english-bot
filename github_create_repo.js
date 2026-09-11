const https = require('https');
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function githubRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'api.github.com',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'User-Agent': 'Node-Bot-Deployer',
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function createRepo(repoName) {
    if (!repoName) {
        console.error('❌ Vui lòng cung cấp tên repo! Ví dụ: node github_create_repo.js my-new-bot');
        process.exit(1);
    }
    console.log(`[GITHUB] 🚀 Đang tạo repo mới: ${repoName}...`);
    const res = await githubRequest('/user/repos', 'POST', {
        name: repoName,
        description: 'Discord Bot auto-created by Agent',
        private: false, // Public để Render free tier clone được
        auto_init: false
    });

    if (res.status === 201) {
        console.log(`[GITHUB] ✅ Tạo repo thành công: ${res.data.clone_url}`);
        console.log(`[GITHUB] HTML URL: ${res.data.html_url}`);
        return res.data;
    } else {
        console.error(`[GITHUB] ❌ Lỗi tạo repo (${res.status}):`, res.data);
        process.exit(1);
    }
}

const repoName = process.argv[2] || process.env.REPO_NAME;
createRepo(repoName).catch(console.error);
