// fix-api-url.js
// วางที่ root project แล้วรัน: node fix-api-url.js
// เปลี่ยน const API = 'http://localhost:5000' → const API = process.env.REACT_APP_API_URL || ''

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const OLD = "const API = 'http://localhost:5000'";
const NEW = "const API = process.env.REACT_APP_API_URL || ''";

let count = 0;

function walk(dir) {
    fs.readdirSync(dir).forEach(file => {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
            if (file !== 'node_modules' && file !== 'build' && file !== 'server') walk(full);
        } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
            let content = fs.readFileSync(full, 'utf-8');
            if (content.includes(OLD)) {
                content = content.replace(OLD, NEW);
                fs.writeFileSync(full, content, 'utf-8');
                count++;
                console.log('✅', path.relative(__dirname, full));
            }
        }
    });
}

walk(SRC_DIR);
console.log(`\nเสร็จ! แก้ ${count} ไฟล์`);
console.log('\n⚠️  ไม่ได้แก้ server.js — server ยังใช้ localhost ตามปกติ');
console.log('⚠️  ถ้าจะกลับไปรัน localhost ให้สร้างไฟล์ .env ที่ root:');
console.log('    REACT_APP_API_URL=http://localhost:5000');
