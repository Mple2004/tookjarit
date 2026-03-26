// import-local.js
// วางไฟล์นี้ไว้ใน src/server/ แล้วรัน: node import-local.js

const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.startsWith('dataset_free-tiktok-scraper') && f.endsWith('.json'));
console.log('พบ ' + files.length + ' ไฟล์');

const seen = new Set();
const all = [];
files.forEach(f => {
    JSON.parse(fs.readFileSync(f, 'utf-8')).forEach(item => {
        if (item.id && !seen.has(item.id)) {
            seen.add(item.id);
            all.push(item);
        }
    });
});

const thaiCount = all.filter(d => d.textLanguage === 'th').length;
console.log('รวม ' + all.length + ' items (Thai: ' + thaiCount + ')');
console.log('กำลังส่งไป server...');

fetch('/api/import-tiktok-json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: all, thaiOnly: false })
})
.then(r => r.json())
.then(r => console.log('✅', r.message || r))
.catch(e => console.error('❌', e.message));
