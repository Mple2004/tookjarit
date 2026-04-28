// Analysis/youtube/BrandAnalysisPage.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CATEGORY_COLOR_MAP } from '../constants/categories';
import { useAvatarCache } from '../hooks/useAvatarCache';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const PLATFORM_COLOR = '#cc0000';

function fmtNum(n) {
    if (!n || n === 0) return '-';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
}

// ─── TrendChip (คงเดิม แต่ใช้ dominantSentiment จริง) ─────────────────────
function TrendChip({ sentiment }) {
    const cfg = {
        POSITIVE: { color: '#00b894', bg: '#eafaf5', label: 'เชิงบวก' },
        NEGATIVE: { color: '#e17055', bg: '#fdf0ee', label: 'เชิงลบ' },
        NEUTRAL:  { color: '#636e72', bg: '#f4f4f4', label: 'เป็นกลาง' },
    };
    const c = cfg[sentiment] || cfg.NEUTRAL;
    return (
        <span style={{
            fontSize: 12, fontWeight: 700, color: c.color,
            background: c.bg, borderRadius: 20,
            padding: '4px 14px', display: 'inline-block',
        }}>
            {c.label}
        </span>
    );
}

// ─── BrandAnalysisPage ────────────────────────────────────────────────────────
function BrandAnalysisPage() {
    const { brandName } = useParams();
    const navigate = useNavigate();

    const fgRef = useRef(null);
    const { imgCache, loadAvatarForNode } = useAvatarCache(fgRef, 'youtube');

    const [brandInfo, setBrandInfo] = useState(null);
    const [youtubers, setYoutubers] = useState([]);
    const [sentimentData, setSentimentData] = useState({});
    const [videoCounts, setVideoCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [sentimentLoading, setSentimentLoading] = useState(false);
    const [, forceUpdate] = useState(0);
    const [totalBrandViews, setTotalBrandViews] = useState({});

    const decodedBrand = decodeURIComponent(brandName || '');

    // ─── ฟังก์ชันโหลด Sentiment + Video Count (ย้ายขึ้นมาไว้ก่อน) ─────────────────
    const loadAllSentimentsAndVideoCounts = useCallback(async (influencers) => {
        if (!influencers || influencers.length === 0) return;
        setSentimentLoading(true);

        try {
            const promises = influencers.map(async (yt) => {
                const name = yt.name;
                let videoIds = [];
                let totalBrandViews = 0;
                let videoCount = 0;

                try {
                    const videoRes = await fetch(
                        `${API}/api/youtube/data?authorName=${encodeURIComponent(name)}&brand=${encodeURIComponent(decodedBrand)}&limit=200`
                    );
                    console.log("📡 GET:", videoRes); // ← ดู URL ที่ยิงจริง
                    if (videoRes.ok) {
                        const videoData = await videoRes.json();
                        console.log("📦 videoData:", videoData); // ← ดูว่าได้ข้อมูลกลับมาไหม
                        const videos = videoData.data || [];
                        videoIds = videos.map(v => v.videoId).filter(Boolean);
                        videoCount = videoIds.length;
                        // ✅ คำนวณ views จากรอบเดียวกันเลย ไม่ต้องยิงซ้ำ
                        totalBrandViews = videos.reduce((sum, v) => sum + (Number(v.totalViews) || 0), 0);
                    }
                } catch (e) {
                    console.warn(`ไม่สามารถดึง videoIds ของ ${name}`);
                }
                console.log("🎬 videoIds found:", videoIds); // ← ได้ videoIds ไหม

                let sentData = { totalComments: 0 };
                if (videoIds.length > 0) {
                    try {
                        const sentRes = await fetch(
                            `${API}/api/youtube/sentiment-summary?influencerName=${encodeURIComponent(name)}&videoIds=${videoIds.join(',')}`
                        );
                        if (sentRes.ok) {
                            const data = await sentRes.json();
                            console.log("💬 sentimentData raw:", data); // ← ดู response จริง
                            if (data && typeof data.totalComments === 'number') sentData = data;
                        }
                    } catch (e) {
                        console.warn(`ไม่สามารถโหลด sentiment ของ ${name}`);
                    }
                }

                return { name, sentiment: sentData, videoCount, totalBrandViews };
            });

            const results = await Promise.all(promises);

            const newSentiment = {};
            const newVideoCounts = {};
            const newTotalViews = {};

            results.forEach(r => {
                newSentiment[r.name] = r.sentiment;
                newVideoCounts[r.name] = r.videoCount;
                newTotalViews[r.name] = r.totalBrandViews;
            });

            setSentimentData(newSentiment);
            setVideoCounts(newVideoCounts);
            setTotalBrandViews(newTotalViews);

        } catch (err) {
            console.error("โหลดข้อมูลล้มเหลว:", err);
        } finally {
            setSentimentLoading(false);
        }
    }, [decodedBrand]);

    // ─── โหลดข้อมูลกราฟ + YouTubers ─────────────────────────────────────────────
    useEffect(() => {
        if (!brandName) return;
        setLoading(true);

        const loadData = async () => {
            try {
                const res = await fetch(`${API}/api/graph-data?platform=youtube`);
                const raw = await res.json();
                console.log("🗂️ raw nodes count:", raw.nodes?.length);  // ← เพิ่ม

                const brand = raw.nodes.find(
                    n => n.name === decodedBrand && n.type === 'Brand'
                );
                console.log("🏷️ brand found:", brand);  // ← เพิ่ม
                if (!brand) {
                    setLoading(false);
                    return;
                }
                setBrandInfo(brand);

                const linked = raw.links
                    .filter(l => {
                        if (l.isPhantom) return false;
                        const s = typeof l.source === 'object' ? l.source : raw.nodes.find(n => n.id === l.source);
                        const t = typeof l.target === 'object' ? l.target : raw.nodes.find(n => n.id === l.target);
                        return s?.id === brand.id || t?.id === brand.id;
                    })
                    .map(l => {
                        const s = typeof l.source === 'object' ? l.source : raw.nodes.find(n => n.id === l.source);
                        const t = typeof l.target === 'object' ? l.target : raw.nodes.find(n => n.id === l.target);
                        const inf = s?.type === 'Influencer' ? s : t?.type === 'Influencer' ? t : null;
                        return inf ? { ...inf, linkData: l } : null;
                    })
                    .filter(Boolean)
                    .filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i);
                console.log("👥 linked influencers:", linked);  // ← เพิ่มหลัง linked

                setYoutubers(linked);
                linked.forEach(inf => loadAvatarForNode({ name: inf.name }));

                // โหลด sentiment และ video count
                await loadAllSentimentsAndVideoCounts(linked);

            } catch (err) {
                console.error("โหลดข้อมูล BrandAnalysis ล้มเหลว:", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [brandName, decodedBrand, loadAllSentimentsAndVideoCounts, loadAvatarForNode]);

    // ─── Poll สำหรับ avatar ─────────────────────────────────────────────────────
    useEffect(() => {
        if (youtubers.length === 0) return;
        const timer = setInterval(() => {
            const allLoaded = youtubers.every(yt => imgCache.current[yt.name]?.complete);
            forceUpdate(n => n + 1);
            if (allLoaded) clearInterval(timer);
        }, 300);
        return () => clearInterval(timer);
    }, [youtubers, imgCache]);

    const [sortBy, setSortBy] = useState('subscribers');

    const color = brandInfo ? (CATEGORY_COLOR_MAP[brandInfo.category] || '#BDC3C7') : '#BDC3C7';

    if (loading) {
        return (
            <div style={styles.loadingWrap}>
                <div style={styles.spinner} />
                <p style={styles.loadingText}>กำลังโหลดข้อมูล...</p>
            </div>
        );
    }

    // เรียงข้อมูล
    const sortedYoutubers = [...youtubers].sort((a, b) => {
        if (sortBy === 'views') {
            const vA = totalBrandViews[a.name] || 0;
            const vB = totalBrandViews[b.name] || 0;
            return vB - vA;
        }
        const sA = a.subscribers || a.followers || 0;
        const sB = b.subscribers || b.followers || 0;
        return sB - sA;
    });

    return (
        <div style={styles.page}>
            {/* Back button + Brand Header (เหมือนเดิม) */}
            <button style={styles.backBtn} onClick={() => navigate(-1)}>← กลับ</button>

            <div style={{ ...styles.brandHeader, borderColor: color }}>
                <div style={{ ...styles.brandAvatar, background: color }}>
                    {brandInfo?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                    <h1 style={styles.brandName}>{decodedBrand}</h1>
                    <div style={styles.brandMeta}>
                        <span style={{ ...styles.catChip, background: `${color}22`, color }}>
                            {brandInfo?.category || 'ไม่มีหมวดหมู่'}
                        </span>
                        <span style={styles.countChip}>
                            {youtubers.length} Channels
                        </span>
                    </div>
                </div>
            </div>

            <div style={styles.sectionTitle}>
                <span>📋 รายการ Influencer ที่โปรโมทแบรนด์นี้</span>
                <span style={styles.sectionSub}>คลิก "วิเคราะห์" เพื่อดูผลวิเคราะห์คอมเม้นและเนื้อหา</span>
            </div>

            <div style={styles.sortBar}>
                <span style={styles.sortLabel}>เรียงตาม:</span>
                <button style={{ ...styles.sortBtn, ...(sortBy === 'subscribers' ? styles.sortBtnActive : {}) }}
                    onClick={() => setSortBy('subscribers')}>Subscribers</button>
                <button style={{ ...styles.sortBtn, ...(sortBy === 'views' ? styles.sortBtnActive : {}) }}
                    onClick={() => setSortBy('views')}>Views</button>
            </div>

            {youtubers.length === 0 ? (
                <div style={styles.empty}>ไม่พบ Influencer ที่เชื่อมโยงกับแบรนด์นี้</div>
            ) : (
                <div style={styles.tableWrap}>
                    <div style={styles.tableHeader}>
                        <span style={{ flex: 2 }}>ช่อง / Influencer</span>
                        <span style={{ flex: 1, textAlign: 'center' }}>Subscribers</span>
                        <span style={{ flex: 1, textAlign: 'center' }}>Views</span>
                        <span style={{ flex: 1, textAlign: 'center' }}>Videos</span>   {/* คอลัมน์ใหม่ */}
                        <span style={{ flex: 1, textAlign: 'center' }}>Sentiment</span>
                        <span style={{ flex: 1, textAlign: 'right' }}>Details</span>
                    </div>

                    {sortedYoutubers.map((yt, idx) => {
                        //const sent = sentimentData[yt.name] || {};
                        //const hasSentiment = sent.totalComments > 0;
                        //const dominant = sent.dominantSentiment || null;
                        const videoCount = videoCounts[yt.name] || 0;

                        return (
                            <div key={yt.id || yt.name} style={{ ...styles.tableRow, animationDelay: `${idx * 0.04}s` }}>
                                {/* Avatar + Name (เหมือนเดิม) */}
                                <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={styles.avatar}>
                                        {imgCache.current[yt.name]?.src ? (
                                            <img src={imgCache.current[yt.name].src} alt={yt.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                        ) : (
                                            yt.name?.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <div style={styles.ytName}>{yt.name}</div>
                                        {(yt.subscribers || yt.followers) && (
                                            <div style={styles.ytSub}>{fmtNum(yt.subscribers || yt.followers)} subs</div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ flex: 1, textAlign: 'center', ...styles.statVal }}>
                                    {fmtNum(yt.subscribers || yt.followers)}
                                </div>

                                <div style={{ flex: 1, textAlign: 'center', ...styles.statVal }}>
                                    {fmtNum(totalBrandViews[yt.name] || 0)}
                                </div>

                                {/* คอลัมน์ใหม่: จำนวนวิดีโอ */}
                                <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#636e72' }}>
                                    {videoCount} วิดีโอ
                                </div>

                                {/* === Sentiment Column - แก้ไขเด็ดขาด === */}
                                <div style={{ flex: 1, textAlign: 'center' }}>
                                    {sentimentLoading ? (
                                        <span style={{ fontSize: 12, color: '#aaa' }}>กำลังโหลด...</span>
                                    ) : (
                                        (() => {
                                            const sent = sentimentData[yt.name] || {};
                                            const totalComments = Number(sent.totalComments) || 0;

                                            // เงื่อนไขเข้มงวดที่สุด
                                            if (totalComments === 0) {
                                                return (
                                                    <span style={{
                                                        fontSize: 12,
                                                        color: '#888',
                                                        fontStyle: 'italic',
                                                        background: '#f8f9fa',
                                                        padding: '6px 14px',
                                                        borderRadius: 20,
                                                        display: 'inline-block',
                                                        border: '1px solid #e0e0e0'
                                                    }}>
                                                        ไม่มีคอมเมนต์
                                                    </span>
                                                );
                                            }

                                            // มีคอมเมนต์จริง ๆ (totalComments > 0)
                                            if (sent.dominantSentiment) {
                                                return <TrendChip sentiment={sent.dominantSentiment} />;
                                            }

                                            // กรณีอื่น ๆ (มีข้อมูลแต่ไม่มี dominantSentiment)
                                            return (
                                                <span style={{
                                                    fontSize: 12,
                                                    color: '#999',
                                                    background: '#fff8e1',
                                                    padding: '5px 12px',
                                                    borderRadius: 20,
                                                }}>
                                                    รอวิเคราะห์
                                                </span>
                                            );
                                        })()
                                    )}
                                </div>

                                {/* ปุ่มวิเคราะห์ */}
                                <div style={{ flex: 1, textAlign: 'right' }}>
                                    <button style={styles.analyzeBtn}
                                        onClick={() => navigate(`/analysis/youtube/brand/${encodeURIComponent(brandName)}/influencer/${encodeURIComponent(yt.name)}`)}
                                        onMouseEnter={e => { e.currentTarget.style.background = PLATFORM_COLOR; e.currentTarget.style.color = '#fff'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#2d3436'; }}
                                    >
                                        View →
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Styles (เพิ่ม/ปรับเล็กน้อย)
// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
    page: {
        minHeight: '100vh',
        background: '#f5f6fa',
        padding: '28px 24px 48px',
        fontFamily: "'Prompt', 'Noto Sans Thai', sans-serif",
    },
    loadingWrap: {
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: '#f5f6fa', fontFamily: "'Prompt', sans-serif",
    },
    spinner: {
        width: 40, height: 40, border: '4px solid #e0e0e0',
        borderTop: `4px solid ${PLATFORM_COLOR}`,
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    },
    loadingText: { color: '#888', fontSize: 14 },
    backBtn: {
        background: 'none', border: '1.5px solid #ddd', borderRadius: 8,
        padding: '7px 16px', cursor: 'pointer', fontSize: 13, color: '#555',
        fontFamily: "'Prompt', sans-serif", marginBottom: 22,
        transition: 'border-color 0.15s, color 0.15s',
    },
    brandHeader: {
        display: 'flex', alignItems: 'center', gap: 18,
        background: '#fff', borderRadius: 16, padding: '18px 22px',
        borderLeft: '5px solid', marginBottom: 22,
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    },
    brandAvatar: {
        width: 58, height: 58, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, color: '#fff', fontWeight: 800, flexShrink: 0,
    },
    brandName: { fontSize: 22, fontWeight: 800, color: '#1a1a2e', margin: 0, marginBottom: 8 },
    brandMeta: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
    catChip: {
        fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '3px 12px',
    },
    countChip: {
        fontSize: 12, fontWeight: 600, background: '#f0f0f0', color: '#555',
        borderRadius: 20, padding: '3px 12px',
    },
    sectionTitle: {
        display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14,
        flexWrap: 'wrap',
    },
    sectionSub: {
        fontSize: 12, color: '#aaa',
    },
    empty: {
        textAlign: 'center', color: '#bbb', padding: '40px 0', fontSize: 14,
    },
    tableWrap: {
        background: '#fff', borderRadius: 16,
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
        overflow: 'hidden',
    },
    tableHeader: {
        display: 'flex', alignItems: 'center', padding: '12px 20px',
        background: '#f8f9fa', borderBottom: '1.5px solid #efefef',
        fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase',
    },
    tableRow: {
        display: 'flex', alignItems: 'center', padding: '14px 20px',
        borderBottom: '1px solid #f5f5f5', transition: 'background 0.15s',
        animation: 'fadeUp 0.3s ease both',
        cursor: 'default',
    },
    avatar: {
        width: 42, height: 42, borderRadius: '50%',
        background: '#dfe6e9', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 700, color: '#636e72', flexShrink: 0,
    },
    ytName: { fontSize: 14, fontWeight: 700, color: '#2d3436' },
    ytSub: { fontSize: 11, color: '#aaa', marginTop: 2 },
    statVal: { fontSize: 13, fontWeight: 600, color: '#636e72' },
    analyzeBtn: {
        padding: '7px 16px', borderRadius: 8,
        border: '1.5px solid #e0e0e0', background: '#fff',
        color: '#2d3436', cursor: 'pointer',
        fontSize: 12, fontWeight: 700,
        fontFamily: "'Prompt', sans-serif",
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
    },
    sortBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    },
    sortLabel: {
        fontSize: 12,
        color: '#aaa',
    },
    // ✅ แบบแก้แล้ว
    sortBtn: {
        padding: '5px 14px',
        borderRadius: 20,
        borderWidth: '1.5px',          // แยกออกเป็น non-shorthand ทั้งหมด
        borderStyle: 'solid',
        borderColor: '#ddd',
        background: '#fff',
        color: '#555',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: "'Prompt', sans-serif",
        transition: 'all 0.15s',
    },
    sortBtnActive: {
        background: PLATFORM_COLOR,
        color: '#fff',
        borderColor: PLATFORM_COLOR,   // ✅ ใช้ non-shorthand เหมือนกันแล้ว
    },
};

// inject keyframes
const styleTag = document.createElement('style');
styleTag.textContent = `
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
`;
document.head.appendChild(styleTag);

export default BrandAnalysisPage;