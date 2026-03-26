// refresh-stats.js
// วางไว้ใน src/server/ แล้วรัน: node refresh-stats.js

const MAX_VIDEOS = 100;  // จำนวนคลิปที่อัพเดตต่อรอบ
const STALE_DAYS = 30;   // อัพเดตถ้าเกิน 30 วัน

console.log(`🔄 Refreshing stats (max ${MAX_VIDEOS} clips, stale > ${STALE_DAYS} days)...`);

fetch('/api/refresh-stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxVideos: MAX_VIDEOS, staleDays: STALE_DAYS }),
})
.then(r => r.json())
.then(r => {
    console.log('✅', r.message);
    console.log(`   อัพเดต ${r.refreshed}/${r.total} คลิป`);
})
.catch(e => console.error('❌', e.message));
