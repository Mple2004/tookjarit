// Analysis/tiktok/useGraphData.js
// ดึงข้อมูล graph เฉพาะ TikTok (followers, likes, hashtag search)
import { useState, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || '';

export function useGraphData() {
    const [data, setData] = useState({ nodes: [], links: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [thaiOnly, setThaiOnly] = useState(false);

    const loadGraphData = useCallback(async (overrideThaiOnly) => {
        const useThai = overrideThaiOnly !== undefined ? overrideThaiOnly : thaiOnly;
        try {
            const res = await fetch(`${API}/api/graph-data?platform=tiktok&thaiOnly=${useThai}`);
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

            // ★ ลบ fx/fy ที่อาจค้างจาก grid layout
            rawData.nodes.forEach(node => {
                delete node.fx;
                delete node.fy;
            });

            setData({ nodes: rawData.nodes, links: [...Object.values(linkMap), ...phantomLinks] });
        } catch (err) {
            console.error('❌ TikTok graph error:', err);
        }
    }, [thaiOnly]);

    // ค้นหาด้วย hashtag หรือ @username
    const searchTikTok = useCallback(async (keyword) => {
        setIsLoading(true);
        try {
            await fetch(`${API}/api/search-tiktok`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, limit: 5 }),
            });
            await loadGraphData();
        } catch {
            alert('เกิดข้อผิดพลาดในการค้นหา TikTok');
        } finally {
            setIsLoading(false);
        }
    }, [loadGraphData]);

    const syncDB = useCallback(async () => {
        await fetch(`${API}/api/sync-mongo-to-neo4j`);
        await loadGraphData();
    }, [loadGraphData]);

    // toggle + reload graph ทันที
    const toggleThaiOnly = useCallback(async () => {
        const newVal = !thaiOnly;
        setThaiOnly(newVal);
        await loadGraphData(newVal);
    }, [thaiOnly, loadGraphData]);

    return { data, isLoading, loadGraphData, searchTikTok, syncDB, thaiOnly, toggleThaiOnly };
}