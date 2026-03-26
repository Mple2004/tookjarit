// Analysis/youtube/useGraphData.js
// ดึงข้อมูล graph เฉพาะ YouTube (subscribers, views, keyword search)
import { useState, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || '';

export function useGraphData() {
    const [data, setData] = useState({ nodes: [], links: [] });
    const [isLoading, setIsLoading] = useState(false);

    const loadGraphData = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/graph-data?platform=youtube`);
            const rawData = await res.json();

            // dedup links
            const linkMap = {};
            rawData.links.forEach(link => {
                const s = typeof link.source === 'object' ? link.source.id : link.source;
                const t = typeof link.target === 'object' ? link.target.id : link.target;
                if (rawData.nodes.find(n => n.id === s) && rawData.nodes.find(n => n.id === t)) {
                    const key = `${s}__${t}`;
                    linkMap[key] = linkMap[key] || { ...link, source: s, target: t };
                }
            });

            // phantom links จัดกลุ่ม brand ตาม category
            const categoryGroups = {};
            rawData.nodes.forEach(node => {
                if (node.type === 'Brand' && node.category) {
                    if (!categoryGroups[node.category]) categoryGroups[node.category] = [];
                    categoryGroups[node.category].push(node.id);
                }
            });
            const phantomLinks = [];
            Object.values(categoryGroups).forEach(ids => {
                for (let i = 0; i < ids.length - 1; i++) {
                    phantomLinks.push({ source: ids[i], target: ids[i + 1], isPhantom: true, weight: 1 });
                }
            });

            setData({ nodes: rawData.nodes, links: [...Object.values(linkMap), ...phantomLinks] });
        } catch (err) {
            console.error('❌ YouTube graph error:', err);
        }
    }, []);

    // ค้นหาด้วย keyword หรือ @channel (ต่างจาก TikTok ที่ใช้ hashtag)
    const searchYoutube = useCallback(async (input) => {
        if (!input?.trim()) return;

        // ถ้าใส่ @ชื่อ → ต้องบอก user ว่าต้องใช้ channelId จริงๆ
        // ถ้าขึ้นต้นด้วย UC → เป็น channelId โดยตรง
        const channelId = input.trim().startsWith('@')
            ? input.trim()          // ส่งไปให้ backend จัดการ (เพิ่ม logic ได้ทีหลัง)
            : input.trim();         // channelId เช่น UCxxxxxx

        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API}/api/search-youtube`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // ✅ ส่ง token เพราะ server.js ใช้ authMiddleware
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                // ✅ แก้: ส่ง channelId และ max (ไม่ใช่ keyword/limit)
                body: JSON.stringify({ search: input.trim(), max: 5 }),
            });

            if (res.status === 401) {
                alert('กรุณาเข้าสู่ระบบก่อนค้นหา');
                return;
            }
            if (!res.ok) {
                const err = await res.json();
                alert(`เกิดข้อผิดพลาด: ${err.error || 'Unknown error'}`);
                return;
            }

            await loadGraphData();
            return input.trim(); // ส่งกลับ search term เพื่อให้ UI แสดงผลได้ถูกต้อง (เช่นใน input box)
        } catch {
            alert('เกิดข้อผิดพลาดในการค้นหา YouTube');
        } finally {
            setIsLoading(false);
        }
    }, [loadGraphData]);

    // ✅ แก้: เรียก YouTube sync endpoint (ไม่ใช่ TikTok)
    const syncDB = useCallback(async () => {
        const token = localStorage.getItem('token');
        try {
            await fetch(`${API}/api/youtube-sync-neo4j`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
            });
            await loadGraphData();
        } catch (err) {
            console.error('❌ Sync error:', err);
        }
    }, [loadGraphData]);

    return { data, isLoading, loadGraphData, searchYoutube, syncDB };
}
