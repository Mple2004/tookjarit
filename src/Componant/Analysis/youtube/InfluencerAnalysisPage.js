// Analysis/youtube/InfluencerAnalysisPage.js
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAvatarCache } from '../hooks/useAvatarCache';
import { Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const PLATFORM_COLOR = '#cc0000';
const CHART_COLORS = {
    views: { stroke: '#0984e3', fill: 'url(#colorViews)' }, // ฟ้า Blue
    likes: { stroke: '#6c5ce7', fill: '#6c5ce7' },          // ม่วง Purple
    comments: { stroke: '#00b894', fill: '#00b894' }       // เขียว Mint
};

function fmtNum(n) {
    if (!n || n === 0) return '-';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
}

function StatCard({ icon, label, value, color, note }) {
    return (
        <div style={{
            background: '#fff', borderRadius: 14, padding: '16px 12px',
            border: '1px solid #f0f0f0', // ใส่กรอบบางๆ แทน Box Shadow ซ้อนทับ
            borderTop: `4px solid ${color || '#e0e0e0'}`, minWidth: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
        }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', fontFamily: "'Prompt', sans-serif" }}>{value}</div>
            <div style={{ fontSize: 11, color: '#999', fontFamily: "'Prompt', sans-serif", marginTop: 2 }}>{label}</div>
            {note && <div style={{ fontSize: 10, color: '#ccc', marginTop: 4 }}>{note}</div>}
        </div>
    );
}

function SentimentDonut({ data }) {
    const total = data ? (data.positive.count + data.neutral.count + data.negative.count) : 0;
    if (!data || total === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{
                    width: 120, height: 120, borderRadius: '50%',
                    border: '12px solid #f0f0f0', margin: '0 auto 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <span style={{ fontSize: 12, color: '#ccc', fontFamily: "'Prompt', sans-serif" }}>รอข้อมูล</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {[{ color: '#00b894', label: 'เชิงบวก' }, { color: '#e17055', label: 'เชิงลบ' }, { color: '#b2bec3', label: 'เป็นกลาง' }].map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                            <span style={{ fontSize: 12, color: '#888', fontFamily: "'Prompt', sans-serif" }}>{s.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    const segments = [
        { key: 'positive', color: '#00b894', label: 'เชิงบวก', percent: data.positive.percent },
        { key: 'negative', color: '#e17055', label: 'เชิงลบ',  percent: data.negative.percent },
        { key: 'neutral',  color: '#b2bec3', label: 'เป็นกลาง',    percent: data.neutral.percent  },
    ];
    const R = 54, cx = 70, cy = 70, stroke = 22;
    const circumference = 2 * Math.PI * R;
    let offset = 0;
    const dominant = segments.reduce((a, b) => a.percent > b.percent ? a : b);
    return (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ position: 'relative', width: 140, margin: '0 auto 12px' }}>
                <svg width="140" height="140" viewBox="0 0 140 140">
                    {segments.map(seg => {
                        const dash = (seg.percent / 100) * circumference;
                        const gap  = circumference - dash;
                        const el = (
                            <circle key={seg.key} cx={cx} cy={cy} r={R}
                                fill="none" stroke={seg.color} strokeWidth={stroke}
                                strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset}
                                style={{ transition: 'stroke-dasharray 0.6s ease' }}
                                transform={`rotate(-90 ${cx} ${cy})`}
                            />
                        );
                        offset += dash;
                        return el;
                    })}
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: dominant.color }}>{dominant.percent}%</div>
                    <div style={{ fontSize: 10, color: '#aaa', fontFamily: "'Prompt', sans-serif" }}>{dominant.label}</div>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
                {segments.map(s => (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                        <span style={{ fontSize: 11, color: '#666', fontFamily: "'Prompt', sans-serif" }}>{s.label} {s.percent}%</span>
                    </div>
                ))}
            </div>
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 8, fontFamily: "'Prompt', sans-serif" }}>
                จากทั้งหมด {total.toLocaleString()} คอมเม้น
            </div>
        </div>
    );
}

function CommentSampleRow({ label, color, bg, comments }) {
    if (comments.length === 0) {
        return (
            <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.45 }}>
                    <span style={{ fontSize: 11, color: '#aaa', fontFamily: "'Prompt', sans-serif" }}>
                        ไม่มีตัวอย่าง
                    </span>
                </div>
            </div>
        );
    }
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
            {comments.slice(0, 3).map((c, i) => (
                <div key={i} style={{ borderRadius: 8, padding: '10px 12px', marginBottom: 8, background: bg, borderLeft: `3px solid ${color}` }}>
                    <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {c.text?.slice(0, 100)}{c.text?.length > 100 ? '…' : ''}
                    </div>
                    {c.confidence != null && (
                        <div style={{ fontSize: 10, color: '#bbb', marginTop: 4, textAlign: 'right' }}>ความมั่นใจ {(c.confidence * 100).toFixed(0)}%</div>
                    )}
                </div>
            ))}
        </div>
    );
}

function InfluencerAnalysisPage() {
    const { brandName, influencerName } = useParams();
    const navigate = useNavigate();

    const fgRef = useRef(null);
    const { imgCache, loadAvatarForNode } = useAvatarCache(fgRef, 'youtube');
    const [, forceUpdate] = useState(0);

    const [ytInfo, setYtInfo]       = useState(null);
    const [topVideos, setTopVideos] = useState([]);
    const [loading, setLoading]     = useState(true);

    const [sentiment, setSentiment]               = useState(null);
    const [sentimentLoading, setSentimentLoading] = useState(false);
    
    const [contentAnalysis, setContentAnalysis] = useState(null);
    const [contentLoading, setContentLoading]   = useState(false);
    const [analyzingVideos, setAnalyzingVideos] = useState({}); // { videoId: true/false }

    const [commentSamples, setCommentSamples] = useState({ positive: [], negative: [], neutral: [] });

    const decodedBrand      = decodeURIComponent(brandName      || '');
    const decodedInfluencer = decodeURIComponent(influencerName || '');

    const fetchBrandVideoIds = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/youtube/data?authorName=${encodeURIComponent(decodedInfluencer)}&brand=${encodeURIComponent(decodedBrand)}&limit=200`);
            const data = await res.json();
            return (data?.data || []).map(d => d.videoId).filter(Boolean);
        } catch { return []; }
    }, [decodedInfluencer, decodedBrand]);

    const loadSentiment = useCallback(async (brandVideoIds) => {
        if (!brandVideoIds || brandVideoIds.length === 0) { setSentiment(null); return; }
        setSentimentLoading(true);
        try {
            const res = await fetch(`${API}/api/youtube/sentiment-summary?influencerName=${encodeURIComponent(decodedInfluencer)}&videoIds=${brandVideoIds.join(',')}`);
            const data = await res.json();
            setSentiment(data && !data.message ? data : null);
        } catch (err) { setSentiment(null); } 
        finally { setSentimentLoading(false); }
    }, [decodedInfluencer]);

    const loadCommentSamples = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/youtube/comment-samples?influencerName=${encodeURIComponent(decodedInfluencer)}&brand=${encodeURIComponent(decodedBrand)}&limit=3`);
            const data = await res.json();
            setCommentSamples({ positive: data.positive || [], negative: data.negative || [], neutral:  data.neutral  || [] });
        } catch (err) { console.error(err); }
    }, [decodedInfluencer, decodedBrand]);

    useEffect(() => {
        if (!influencerName) return;
        setLoading(true);

        Promise.all([
            fetch(`${API}/api/youtube/data?authorName=${encodeURIComponent(decodedInfluencer)}&limit=1`).then(r => r.json()).catch(() => ({})),
            fetch(`${API}/api/youtube/data?authorName=${encodeURIComponent(decodedInfluencer)}&limit=500`).then(r => r.json()).catch(() => ({ data: [] })),
        ]).then(([ytData, videos]) => {
            setYtInfo(ytData?.data?.[0] || null);
            setTopVideos(videos?.data || []);
            loadAvatarForNode({ name: decodedInfluencer });
        }).finally(() => setLoading(false));

        fetchBrandVideoIds().then(ids => loadSentiment(ids));
        loadCommentSamples();

        setContentLoading(true);
        fetch(`${API}/api/youtube/content-analysis?influencerName=${encodeURIComponent(decodedInfluencer)}&brand=${encodeURIComponent(decodedBrand)}`)
        .then(r => r.json())
        .then(data => {setContentAnalysis(data?.results || []);})
        .catch(() => setContentAnalysis(null))
        .finally(() => setContentLoading(false));

    }, [influencerName, decodedInfluencer, decodedBrand, fetchBrandVideoIds, loadSentiment, loadCommentSamples, loadAvatarForNode]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (imgCache.current[decodedInfluencer]?.complete) {
                forceUpdate(n => n + 1);
                clearInterval(timer);
            }
        }, 300);
        return () => clearInterval(timer);
    }, [decodedInfluencer, imgCache]);
    const hasSentiment    = sentiment && sentiment.totalComments > 0;
    const brandVideos     = topVideos.filter(v => v.brand?.toLowerCase() === decodedBrand?.toLowerCase());
    const totalVideos     = brandVideos.length;
    const hasAnySample    = commentSamples.positive.length + commentSamples.negative.length + commentSamples.neutral.length > 0;

    const chartData = useMemo(() => {
        if (!brandVideos || brandVideos.length === 0) return [];
        
        // 1. เตรียมข้อมูลพื้นฐานและเรียงลำดับวันที่
        const baseData = [...brandVideos]
            .filter(v => v.publishedAt)
            .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt))
            .map(v => ({
                date: new Date(v.publishedAt).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }),
                views: v.totalViews || v.views || 0,
                likes: v.totalLikes || 0,
                comments: v.totalComments || 0,
                title: v.title
            }));

        // 2. หาค่าสูงสุดของแต่ละประเภทในกลุ่มวิดีโอนี้ (เพื่อใช้เป็นฐาน 100%)
        const maxViews = Math.max(...baseData.map(d => d.views), 1);
        const maxLikes = Math.max(...baseData.map(d => d.likes), 1);
        const maxComments = Math.max(...baseData.map(d => d.comments), 1);

        // 3. คำนวณค่า Normalized (%) เพื่อให้กราฟแสดงผลในสเกลเดียวกัน (เทียบกันเอง)
        return baseData.map(d => ({
            ...d,
            normViews: (d.views / maxViews) * 100,
            normLikes: (d.likes / maxLikes) * 100,
            normComments: (d.comments / maxComments) * 100
        }));
    }, [brandVideos]);

    const analyzeVideo = useCallback(async (videoId, caption, title) => {
        setAnalyzingVideos(prev => ({ ...prev, [videoId]: true }));
        try {
            const res = await fetch(`${API}/api/youtube/content-analysis/${videoId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caption, title })
            });
            const data = await res.json();
            if (data.hashtags) {
                // อัปเดต contentAnalysis ใน state โดยตรง ไม่ต้อง reload หน้า
                setContentAnalysis(prev => {
                    const filtered = (prev || []).filter(a => a.videoId !== videoId);
                    return [...filtered, { videoId, hashtags: data.hashtags, summary: data.summary }];
                });
            }
        } catch (err) {
            console.error('analyzeVideo error:', err);
        } finally {
            setAnalyzingVideos(prev => ({ ...prev, [videoId]: false }));
        }
    }, []);

    if (loading) {
        return (
            <div style={styles.loadingWrap}>
                <div style={styles.spinner} />
                <p style={{ color: '#888', fontSize: 14, fontFamily: "'Prompt', sans-serif" }}>กำลังโหลด...</p>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            {/* Breadcrumb */}
            <div style={styles.breadcrumb}>
                <button style={styles.backBtn} onClick={() => navigate(-1)}>← กลับ</button>
                <span style={styles.breadPath}>
                    <span style={{ color: '#aaa' }}>{decodedBrand}</span>
                    <span style={{ color: '#ddd', margin: '0 6px' }}>›</span>
                    <span style={{ color: '#2d3436', fontWeight: 700 }}>{decodedInfluencer}</span>
                </span>
            </div>

            {/* แถวที่ 1: Engagement (ซ้าย) + Profile & Stat (ขวา) */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
                
                {/* ซ้ายกว้าง: Engagement Trend */}
                <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', minHeight: 400 }}>
                    <div style={styles.cardTitle}>
                        <span>📈 Engagement Trend (ตามวิดีโอที่โปรโมท)</span>
                    </div>
                    <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                        {chartData.length > 0 ? (
                            <>
                                {/* 1. ส่วนแสดงกราฟ */}
                                <div style={{ width: '100%', height: 350 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                            <defs>
                                                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={CHART_COLORS.views.stroke} stopOpacity={0.2}/>
                                                    <stop offset="95%" stopColor={CHART_COLORS.views.stroke} stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                            <XAxis dataKey="date" fontSize={11} tickMargin={12} axisLine={{ stroke: '#eee' }} tickLine={false} />
                                            <YAxis yAxisId="left" orientation="left" stroke={CHART_COLORS.views.stroke} fontSize={11} tickFormatter={fmtNum} axisLine={false} tickLine={false} label={{ value: 'ยอดการเข้าชม (Views)', angle: -90, position: 'insideLeft', offset: 10, fill: CHART_COLORS.views.stroke }} />
                                            <YAxis yAxisId="right" orientation="right" stroke={CHART_COLORS.likes.stroke} fontSize={11} tickFormatter={fmtNum} axisLine={false} tickLine={false} label={{ value: 'การตอบรับ (Engagement)', angle: 90, position: 'insideRight', offset: 10, dx:10, fill: CHART_COLORS.likes.stroke }} />
                                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
                                            <Legend verticalAlign="top" align="center" height={36} iconType="circle" />
                                            <Area yAxisId="left" type="monotone" dataKey="views" name="Views" stroke={CHART_COLORS.views.stroke} fill="url(#colorViews)" />
                                            <Line yAxisId="right" type="monotone" dataKey="likes" name="Likes" stroke={CHART_COLORS.likes.stroke} />
                                            <Line yAxisId="right" type="monotone" dataKey="comments" name="Comments" stroke={CHART_COLORS.comments.stroke} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* 2. ส่วนสรุปผลการวิเคราะห์ (รวมอยู่ใน Card เดียวกัน) */}
                                <div style={{ 
                                    marginTop: '20px', 
                                    padding: '16px', 
                                    backgroundColor: '#f8faff', 
                                    borderRadius: '12px',
                                    borderLeft: `5px solid ${CHART_COLORS.views.stroke}`,
                                    fontFamily: "'Prompt', sans-serif"
                                }}>
                                    <h4 style={{ margin: '0 0 6px 0', color: '#2d3436', fontSize: '15px' }}>📊 สรุปภาพรวมข้อมูล</h4>
                                    <p style={{ fontSize: '14px', color: '#636e72', lineHeight: '1.5', margin: 0 }}>
                                        วิดีโอที่ได้รับความสนใจสูงสุดคือวันที่ {" "}
                                        <span style={{ color: CHART_COLORS.views.stroke, fontWeight: 700 }}>
                                            {chartData.reduce((prev, current) => (prev.views > current.views) ? prev : current).date}
                                        </span> 
                                        {" "} โดยมีค่าเฉลี่ย Engagement ต่อการเข้าชมประมาณ {" "}
                                        <strong>
                                            { (chartData.reduce((a, b) => a + b.likes, 0) / chartData.reduce((a, b) => a + b.views, 0) * 100).toFixed(2) }%
                                        </strong>
                                        <br />
                                        <span style={{ fontSize: '12px', color: '#999' }}>
                                            * วิเคราะห์จากความสัมพันธ์ระหว่างยอดรับชมและการมีส่วนร่วมในแต่ละช่วงเวลา
                                        </span>
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', color: '#ccc', paddingTop: 100 }}>
                                ไม่มีข้อมูลวันที่เผยแพร่สำหรับการสร้างกราฟ
                            </div>
                        )}
                    </div>
                </div>

                {/* ขวาแคบ: 1 Grid ใหญ่ ครอบ Profile และ Stat 2x2 (ดีไซน์ตามรูป 1) */}
                <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Profile Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '8px' }}>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#2d3436', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#fff', fontWeight: 800, marginBottom: 12 }}>
                            {imgCache.current[decodedInfluencer]?.src
                                ? <img src={imgCache.current[decodedInfluencer].src} alt={decodedInfluencer} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : decodedInfluencer.charAt(0).toUpperCase()
                            }
                        </div>
                        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', margin: '0 0 10px', textAlign: 'center' }}>{decodedInfluencer}</h1>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <span style={styles.platformBadge}>YouTube</span>
                            <span style={styles.brandBadge}>{decodedBrand}</span>
                        </div>
                    </div>

                    {/* Stat Grid 2x2 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <StatCard icon="👥" label="Subscribers" value={fmtNum(ytInfo?.subscribers)} color="#6c5ce7" />
                        <StatCard icon="👁️" label="Channel Views" value={fmtNum(ytInfo?.channelViews)} color="#0984e3" />
                        <StatCard icon="🎬" label="วิดีโอที่โปรโมท" value={totalVideos > 0 ? totalVideos : '-'} color={PLATFORM_COLOR} />
                        <StatCard icon="💬" label="คอมเม้นที่วิเคราะห์" value={hasSentiment ? fmtNum(sentiment.totalComments) : '-'} color="#00b894" />
                    </div>

                    {/* ✅ เพิ่มปุ่ม View Channel ใต้ badge */}
                    {ytInfo?.channelId && (
                        <a  
                            href={`https://www.youtube.com/channel/${ytInfo.channelId}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                marginTop: 10,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '10px 28px',
                                borderRadius: 50,
                                background: PLATFORM_COLOR,
                                color: '#fff',
                                fontSize: 13,
                                fontWeight: 700,
                                textDecoration: 'none',
                                fontFamily: "'Prompt', sans-serif",
                                letterSpacing: '0.3px',
                                transition: 'background 0.2s',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            }}
                            onMouseOver={e => e.currentTarget.style.background = '#aa0000'}
                            onMouseOut={e => e.currentTarget.style.background = PLATFORM_COLOR}
                        >
                            View Channel
                        </a>
                    )}
                </div>
            </div>

            {/* แถวที่ 2: Sentiment (ซ้าย) + Comment Samples (ขวา) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '20px' }}>
                
                {/* ซ้ายแคบ: Sentiment Analysis */}
                <div style={{ ...styles.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={styles.cardTitle}>
                        <span>💬 Sentiment Analysis</span>
                        {hasSentiment
                            ? <span style={{ ...styles.pendingTag, background: '#eafaf5', color: '#00b894' }}>
                                {sentiment.dominantSentiment === 'POSITIVE' ? '😊 เชิงบวก' :
                                 sentiment.dominantSentiment === 'NEGATIVE' ? '😞 เชิงลบ' : '😐 เป็นกลาง'}
                              </span>
                            : <span style={styles.pendingTag}>ไม่มีคอมเมนต์</span>
                        }
                    </div>
                    {sentimentLoading
                        ? <div style={{ textAlign: 'center', padding: 24, color: '#ccc', fontSize: 13, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>กำลังโหลด...</div>
                        : <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <SentimentDonut data={hasSentiment ? sentiment : null} />
                            {!hasSentiment && (
                                <div style={{ textAlign: 'center', fontSize: 12, color: '#999', padding: '0 10px' }}>
                                    ระบบจะแสดงผลอัตโนมัติเมื่อมีคอมเมนต์
                                </div>
                            )}
                          </div>
                    }
                    {hasSentiment && (
                        <div style={{ marginTop: 12, padding: '12px', background: '#fafafa', borderRadius: 10, display: 'flex', justifyContent: 'space-between' }}>
                            {[
                                { label: '😊 บวก', val: sentiment.positive },
                                { label: '😞 ลบ',  val: sentiment.negative },
                                { label: '😐 กลาง', val: sentiment.neutral },
                            ].map(s => (
                                <div key={s.label} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#2d3436' }}>{s.val.count.toLocaleString()}</div>
                                    <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>{s.label}</div>
                                    {/* 3. เอา Confidence กลับมาแสดงใต้ Label */}
                                    <div style={{ fontSize: 10, color: '#bbb' }}>conf {(s.val.avgConfidence * 100).toFixed(0)}%</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ขวากว้าง: ตัวอย่างคอมเม้น (แบ่ง 3 คอลัมน์) */}
                <div style={styles.card}>
                    <div style={styles.cardTitle}>
                        <span>🔍 ตัวอย่างคอมเม้น</span>
                        {hasAnySample
                            ? <span style={{ ...styles.pendingTag, background: '#eafaf5', color: '#00b894' }}>มีข้อมูล</span>
                            : <span style={styles.pendingTag}>รอผลวิเคราะห์</span>
                        }
                    </div>
                    <div style={{ padding: '12px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        <CommentSampleRow label="😊 เชิงบวก" color="#00b894" bg="#eafaf5" comments={commentSamples.positive} />
                        <CommentSampleRow label="😞 เชิงลบ"  color="#e17055" bg="#fdf0ee" comments={commentSamples.negative} />
                        <CommentSampleRow label="😐 เป็นกลาง"    color="#b2bec3" bg="#f4f4f4" comments={commentSamples.neutral}  />
                    </div>
                    {!hasAnySample && (
                        <div style={styles.placeholderNote}>
                            กด "วิเคราะห์ Sentiment" เพื่อดูตัวอย่างคอมเม้นที่ถูกจัดประเภทแล้ว
                        </div>
                    )}
                </div>
            </div>

            {/* แถวที่ 3: วิดีโอทั้งหมด (แสดงเป็นกล่อง Content Analysis รายคลิป) */}
            {brandVideos.length > 0 && (
                <div style={{ marginTop: '32px' }}>
                    <div style={{ ...styles.sectionTitle, marginBottom: '24px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span>🎬 วิดีโอที่เกี่ยวข้องกับแบรนด์</span>
                        <span style={{ fontSize: 14, color: '#999', fontWeight: 500 }}>({brandVideos.length} รายการ)</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {brandVideos
                            .sort((a, b) => (b.totalViews || b.views || 0) - (a.totalViews || a.views || 0))
                            .map((v, i) => {
                                const analysis = Array.isArray(contentAnalysis) 
                                    ? contentAnalysis.find(a => a.videoId === v.videoId) 
                                    : null;
                                const videoUrl = v.videoUrl || v.url || v.link || (v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}` : '');
                                
                                return (
                                    <div key={v.videoId || i} style={{ ...styles.card, padding: '20px', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', position: 'relative' }}>
                                        {/* อันดับวิดีโอ (Badge เล็กๆ มุมซ้าย) */}
                                        <div style={{ position: 'absolute', top: -10, left: -10, width: 32, height: 32, background: '#1a1a2e', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, boxShadow: '0 4px 8px rgba(0,0,0,0.2)', zIndex: 2 }}>
                                            {i + 1}
                                        </div>

                                        {/* ส่วนภาพปก (Thumbnail) - คลิกเพื่อเปิดวิดีโอ */}
                                        <a 
                                            href={videoUrl} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            style={{ 
                                                display: 'block', 
                                                background: '#000', 
                                                borderRadius: '12px', 
                                                overflow: 'hidden', 
                                                aspectRatio: '16/9', 
                                                cursor: 'pointer',
                                                position: 'relative',
                                                border: '1px solid #eee'
                                            }}
                                        >
                                            {v.videoId ? (
                                                <img 
                                                    src={`https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`} 
                                                    alt="ปกคลิป" 
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                                                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                                />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>ไม่มีภาพปก</div>
                                            )}
                                            {/* Play Overlay */}
                                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)' }}>
                                                <div style={{ width: 44, height: 44, background: 'rgba(204, 0, 0, 0.9)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>▶</div>
                                            </div>
                                        </a>

                                        {/* ส่วนข้อมูลด้านขวา */}
                                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                                                    <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px', lineHeight: 1.4 }}>
                                                        {v.title || `วิดีโอโปรโมท ${decodedBrand}`}
                                                    </h3>
                                                    {videoUrl && (
                                                        <a href={videoUrl} target="_blank" rel="noreferrer" style={styles.watchBtn}>
                                                            ดูบน YouTube
                                                        </a>
                                                    )}
                                                </div>

                                                <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>👁️ {fmtNum(v.totalViews || v.views)} views</span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>👍 {fmtNum(v.totalLikes)} likes</span>
                                                    {v.publishedAt && <span>📅 {new Date(v.publishedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>}
                                                </div>

                                                {/* Content Analysis Inner Box */}
                                                <div style={{ background: '#f8f9fa', padding: '14px', borderRadius: '10px', border: '1px solid #f0f0f0' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#2d3436' }}>📝 สรุปเนื้อหา</span>
                                                        {analysis
                                                            ? <span style={{ ...styles.pendingTag, background: '#eafaf5', color: '#00b894' }}>วิเคราะห์แล้ว</span>
                                                            : <span style={styles.pendingTag}>ยังไม่ได้วิเคราะห์</span>
                                                        }
                                                    </div>

                                                    {contentLoading ? (
                                                        <div style={{ color: '#ccc', fontSize: 13 }}>กำลังโหลด...</div>
                                                    ) : analysis ? (
                                                        // ✅ มีข้อมูลแล้ว — แสดงปกติ
                                                        <div>
                                                            {analysis.summary && (
                                                                <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
                                                                    {analysis.summary}
                                                                </div>
                                                            )}
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                                {analysis.hashtags?.map((tag, idx) => (
                                                                    <span key={idx} style={styles.tagStyle}>{tag}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        // ✅ ยังไม่มี — แสดงปุ่ม
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                            <span style={{ fontSize: 13, color: '#999' }}>ยังไม่มีข้อมูลสรุปเนื้อหา</span>
                                                            <button
                                                                onClick={() => analyzeVideo(v.videoId, v.caption, v.title)}
                                                                disabled={analyzingVideos[v.videoId]}
                                                                style={{
                                                                    padding: '7px 16px',
                                                                    borderRadius: 8,
                                                                    background: analyzingVideos[v.videoId] ? '#f0f0f0' : '#1a1a2e',
                                                                    color: analyzingVideos[v.videoId] ? '#aaa' : '#fff',
                                                                    border: 'none',
                                                                    fontSize: 12,
                                                                    fontWeight: 700,
                                                                    cursor: analyzingVideos[v.videoId] ? 'not-allowed' : 'pointer',
                                                                    fontFamily: "'Prompt', sans-serif",
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                {analyzingVideos[v.videoId] ? '⏳ กำลังวิเคราะห์...' : '🔍 วิเคราะห์เนื้อหา'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    page: { minHeight: '100vh', background: '#f5f6fa', padding: '28px 24px 60px', fontFamily: "'Prompt', 'Noto Sans Thai', sans-serif" },
    loadingWrap: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#f5f6fa' },
    spinner: { width: 40, height: 40, border: '4px solid #e0e0e0', borderTop: `4px solid ${PLATFORM_COLOR}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
    breadcrumb: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' },
    backBtn: { background: 'none', border: '1.5px solid #ddd', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, color: '#555', fontFamily: "'Prompt', sans-serif" },
    breadPath: { fontSize: 14, fontFamily: "'Prompt', sans-serif" },
    
    // Cards
    card: { background: '#fff', borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' },
    cardTitle: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 },
    
    // Badges
    platformBadge: { fontSize: 10, fontWeight: 700, color: '#fff', background: PLATFORM_COLOR, borderRadius: 20, padding: '3px 10px', border: '1px solid #cc0000' },
    brandBadge: { fontSize: 10, fontWeight: 700, color: '#2d3436', background: '#fff', borderRadius: 20, padding: '3px 10px', border: '1px solid #ddd' },
    pendingTag: { fontSize: 10, fontWeight: 600, color: '#aaa', background: '#f4f4f4', borderRadius: 20, padding: '4px 10px' },
    
    // Placeholders
    placeholderNote: { fontSize: 12, color: '#aaa', textAlign: 'center', lineHeight: 1.6, padding: '8px 0', fontFamily: "'Prompt', sans-serif" },
    chartPlaceholder: { background: '#fafafa', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1.5px dashed #ececec' },
    
    // Video section
    sectionTitle: { fontSize: 18, fontWeight: 800, color: '#2d3436', marginBottom: 20, fontFamily: "'Prompt', sans-serif" },
    videoList: { background: '#fff', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden' },
    videoRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid #f5f5f5' },
    videoRank: { fontSize: 18, fontWeight: 800, color: '#ddd', width: 28, textAlign: 'center' },
    videoTitle: { fontSize: 14, fontWeight: 700, color: '#2d3436', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
    watchBtn: { padding: '8px 16px', borderRadius: 8, background: PLATFORM_COLOR, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'Prompt', sans-serif" },
};

export default InfluencerAnalysisPage;