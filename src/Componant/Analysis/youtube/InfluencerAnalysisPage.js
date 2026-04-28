// Analysis/youtube/InfluencerAnalysisPage.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAvatarCache } from '../hooks/useAvatarCache';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const PLATFORM_COLOR = '#cc0000';

function fmtNum(n) {
    if (!n || n === 0) return '-';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
}

function StatCard({ icon, label, value, color, note }) {
    return (
        <div style={{
            background: '#fff', borderRadius: 14, padding: '18px 20px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
            borderTop: `4px solid ${color || '#e0e0e0'}`, minWidth: 0,
        }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', fontFamily: "'Prompt', sans-serif" }}>{value}</div>
            <div style={{ fontSize: 12, color: '#999', fontFamily: "'Prompt', sans-serif", marginTop: 2 }}>{label}</div>
            {note && <div style={{ fontSize: 11, color: '#ccc', marginTop: 4 }}>{note}</div>}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, opacity: 0.45 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#aaa', fontFamily: "'Prompt', sans-serif" }}>
                    {label} — ไม่มีตัวอย่าง
                </span>
            </div>
        );
    }
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 6 }}>{label}</div>
            {comments.slice(0, 2).map((c, i) => (
                <div key={i} style={{ borderRadius: 8, padding: '8px 12px', marginBottom: 5, background: bg, borderLeft: `3px solid ${color}` }}>
                    <span style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
                        {c.text?.slice(0, 90)}{c.text?.length > 90 ? '…' : ''}
                    </span>
                    {c.confidence != null && (
                        <span style={{ fontSize: 10, color: '#bbb', marginLeft: 6 }}>({(c.confidence * 100).toFixed(0)}%)</span>
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
    // const [analyzing, setAnalyzing]               = useState(false);
    // const [analyzeMsg, setAnalyzeMsg]             = useState('');

    const [commentSamples, setCommentSamples] = useState({ positive: [], negative: [], neutral: [] });

    const decodedBrand      = decodeURIComponent(brandName      || '');
    const decodedInfluencer = decodeURIComponent(influencerName || '');

    // ── ดึง videoIds ทั้งหมดของ influencer + brand นี้จาก youtuber collection ──
    // ใช้ /api/youtube/data ที่มีอยู่แล้ว กรองด้วย authorName + brand
    const fetchBrandVideoIds = useCallback(async () => {
        try {
            const res = await fetch(
                `${API}/api/youtube/data` +
                `?authorName=${encodeURIComponent(decodedInfluencer)}` +
                `&brand=${encodeURIComponent(decodedBrand)}` +
                `&limit=200`
            );
            const data = await res.json();
            const ids = (data?.data || [])
                .map(d => d.videoId)
                .filter(Boolean);
            return ids;
        } catch {
            return [];
        }
    }, [decodedInfluencer, decodedBrand]);

    // ── loadSentiment รับ videoIds ──────────────────────────────────────────
    const loadSentiment = useCallback(async (brandVideoIds) => {
        if (!brandVideoIds || brandVideoIds.length === 0) {
            setSentiment(null);
            return;
        }
        setSentimentLoading(true);
        try {
            const res = await fetch(
                `${API}/api/youtube/sentiment-summary` +
                `?influencerName=${encodeURIComponent(decodedInfluencer)}` +
                `&videoIds=${brandVideoIds.join(',')}`
            );
            const data = await res.json();
            setSentiment(data && !data.message ? data : null);
        } catch (err) {
            console.error('sentiment-summary error:', err);
            setSentiment(null);
        } finally {
            setSentimentLoading(false);
        }
    }, [decodedInfluencer]);

    // ── loadCommentSamples ──────────────────────────────────────────────────
    const loadCommentSamples = useCallback(async () => {
        try {
            const res = await fetch(
                `${API}/api/youtube/comment-samples` +
                `?influencerName=${encodeURIComponent(decodedInfluencer)}` +
                `&brand=${encodeURIComponent(decodedBrand)}` +
                `&limit=1`
            );
            const data = await res.json();
            setCommentSamples({
                positive: data.positive || [],
                negative: data.negative || [],
                neutral:  data.neutral  || [],
            });
        } catch (err) {
            console.error('comment samples error:', err);
        }
    }, [decodedInfluencer, decodedBrand]);

    // ── Main useEffect ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!influencerName) return;
        setLoading(true);

        // โหลดข้อมูลหลัก + top videos พร้อมกัน
        Promise.all([
            fetch(`${API}/api/youtube/data?authorName=${encodeURIComponent(decodedInfluencer)}&limit=1`)
                .then(r => r.json()).catch(() => ({})),
            fetch(`${API}/api/youtube/data?authorName=${encodeURIComponent(decodedInfluencer)}&limit=500`)  // เพิ่ม limit ให้สูงขึ้น
            .then(r => r.json()).catch(() => ({ data: [] })),
        ]).then(([ytData, videos]) => {
            setYtInfo(ytData?.data?.[0] || null);
            const allVideos = videos?.data || [];
            setTopVideos(allVideos);
            loadAvatarForNode({ name: decodedInfluencer });
        }).finally(() => setLoading(false));

        // ✅ ดึง videoIds ทั้งหมดของแบรนด์นี้ แล้วโหลด sentiment
        fetchBrandVideoIds().then(ids => {
            loadSentiment(ids);
        });

        // comment samples โหลดพร้อมกันได้เลย
        loadCommentSamples();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [influencerName]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (imgCache.current[decodedInfluencer]?.complete) {
                forceUpdate(n => n + 1);
                clearInterval(timer);
            }
        }, 300);
        return () => clearInterval(timer);
    }, [decodedInfluencer, imgCache]);

    if (loading) {
        return (
            <div style={styles.loadingWrap}>
                <div style={styles.spinner} />
                <p style={{ color: '#888', fontSize: 14, fontFamily: "'Prompt', sans-serif" }}>กำลังโหลด...</p>
            </div>
        );
    }

    const hasSentiment    = sentiment && sentiment.totalComments > 0;
    const brandVideos     = topVideos.filter(v => v.brand?.toLowerCase() === decodedBrand?.toLowerCase());
    const totalVideos     = brandVideos.length;
    const hasAnySample    = commentSamples.positive.length + commentSamples.negative.length + commentSamples.neutral.length > 0;

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

            {/* Channel Header */}
            <div style={styles.channelHeader}>
                <div style={styles.channelAvatar}>
                    {imgCache.current[decodedInfluencer]?.src
                        ? <img src={imgCache.current[decodedInfluencer].src} alt={decodedInfluencer}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        : decodedInfluencer.charAt(0).toUpperCase()
                    }
                </div>
                <div style={{ flex: 1 }}>
                    <h1 style={styles.channelName}>{decodedInfluencer}</h1>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={styles.platformBadge}>▶ YouTube</span>
                        <span style={styles.brandBadge}>🏷️ {decodedBrand}</span>
                    </div>
                </div>
            </div>

            {/* Stat Grid */}
            <div style={styles.statGrid}>
                <StatCard icon="👥" label="Subscribers" value={fmtNum(ytInfo?.subscribers)} color="#6c5ce7" />
                <StatCard icon="👁️" label="Channel Views" value={fmtNum(ytInfo?.channelViews)} color="#0984e3" />
                <StatCard icon="🎬" label="วิดีโอที่โปรโมทแบรนด์"
                    value={totalVideos > 0 ? totalVideos : '-'} color={PLATFORM_COLOR}
                    note={totalVideos === 0 ? 'รอผลวิเคราะห์' : undefined} />
                <StatCard icon="💬" label="คอมเม้นที่วิเคราะห์แล้ว"
                    value={hasSentiment ? fmtNum(sentiment.totalComments) : '-'} color="#00b894"
                    note={!hasSentiment ? 'กด "วิเคราะห์ Sentiment" ด้านล่าง' : undefined} />
            </div>

            {/* Analysis Grid */}
            <div style={styles.analysisGrid}>

                {/* Sentiment */}
                <div style={styles.card}>
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
                        ? <div style={{ textAlign: 'center', padding: 24, color: '#ccc', fontSize: 13 }}>กำลังโหลด...</div>
                        : <SentimentDonut data={hasSentiment ? sentiment : null} />
                    }
                    {!hasSentiment && (
                        <div style={{ 
                            textAlign: 'center', 
                            marginTop: 16, 
                            fontSize: 13, 
                            color: '#666',
                            fontFamily: "'Prompt', sans-serif"
                        }}>
                            ระบบจะแสดงผล Sentiment โดยอัตโนมัติเมื่อมีคอมเมนต์ในวิดีโอที่โปรโมทแบรนด์
                        </div>
                    )}
                    {hasSentiment && (
                        <div style={{ marginTop: 12, padding: '10px 12px', background: '#fafafa', borderRadius: 10, display: 'flex', justifyContent: 'space-around' }}>
                            {[
                                { label: '😊 บวก', val: sentiment.positive },
                                { label: '😐 กลาง', val: sentiment.neutral },
                                { label: '😞 ลบ',  val: sentiment.negative },
                            ].map(s => (
                                <div key={s.label} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2d3436' }}>{s.val.count.toLocaleString()}</div>
                                    <div style={{ fontSize: 10, color: '#aaa' }}>{s.label}</div>
                                    <div style={{ fontSize: 10, color: '#bbb' }}>conf {(s.val.avgConfidence * 100).toFixed(0)}%</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Content Analysis placeholder */}
                <div style={styles.card}>
                    <div style={styles.cardTitle}>
                        <span>📝 Content Analysis</span>
                        <span style={styles.pendingTag}>รอผลวิเคราะห์</span>
                    </div>
                    <div style={{ padding: '20px 0' }}>
                        <div style={styles.placeholderLabel}>Keyword ที่พบบ่อย</div>
                        <div style={styles.tagCloud}>
                            {['คำสำคัญ', 'Topic', 'Theme', 'Brand mention', 'Engagement'].map(t => (
                                <span key={t} style={{ ...styles.tag, background: '#f0f0f0', color: '#bbb' }}>{t}</span>
                            ))}
                        </div>
                        <div style={styles.placeholderNote}>
                            ระบบจะแสดง keyword หลัก, theme ของคอนเทนต์<br />และการกล่าวถึงแบรนด์ในวิดีโอ
                        </div>
                    </div>
                </div>

                {/* Engagement Trend placeholder */}
                <div style={styles.card}>
                    <div style={styles.cardTitle}>
                        <span>📈 Engagement Trend</span>
                        <span style={styles.pendingTag}>รอผลวิเคราะห์</span>
                    </div>
                    <div style={{ padding: '20px 0', textAlign: 'center' }}>
                        <div style={styles.chartPlaceholder}>
                            <span style={{ fontSize: 32 }}>📊</span>
                            <div style={{ fontSize: 12, color: '#ccc', marginTop: 8, fontFamily: "'Prompt', sans-serif" }}>กราฟ engagement ตามเวลา</div>
                        </div>
                        <div style={styles.placeholderNote}>
                            แสดง views, likes, comments<br />ของวิดีโอที่โปรโมทแบรนด์ตามลำดับเวลา
                        </div>
                    </div>
                </div>

                {/* Comment Samples */}
                <div style={styles.card}>
                    <div style={styles.cardTitle}>
                        <span>🔍 ตัวอย่างคอมเม้น</span>
                        {hasAnySample
                            ? <span style={{ ...styles.pendingTag, background: '#eafaf5', color: '#00b894' }}>มีข้อมูล</span>
                            : <span style={styles.pendingTag}>รอผลวิเคราะห์</span>
                        }
                    </div>
                    <div style={{ padding: '12px 0' }}>
                        <CommentSampleRow label="😊 เชิงบวก" color="#00b894" bg="#eafaf5" comments={commentSamples.positive} />
                        <CommentSampleRow label="😞 เชิงลบ"  color="#e17055" bg="#fdf0ee" comments={commentSamples.negative} />
                        <CommentSampleRow label="😐 เป็นกลาง"    color="#b2bec3" bg="#f4f4f4" comments={commentSamples.neutral}  />
                        {!hasAnySample && (
                            <div style={styles.placeholderNote}>
                                กด "วิเคราะห์ Sentiment" เพื่อดูตัวอย่างคอมเม้นที่ถูกจัดประเภทแล้ว
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Top Videos */}
            {/* วิดีโอทั้งหมดที่โปรโมทแบรนด์ */}
            {brandVideos.length > 0 && (
                <div style={{ marginTop: 24 }}>
                    <div style={styles.sectionTitle}>
                        🎬 วิดีโอทั้งหมดที่โปรโมท {decodedBrand} ({brandVideos.length} วิดีโอ)
                    </div>
                    
                    <div style={styles.videoList}>
                        {brandVideos
                            .sort((a, b) => (b.totalViews || b.views || 0) - (a.totalViews || a.views || 0))
                            .map((v, i) => {
                                
                                // สร้างลิงก์วิดีโอให้ครอบคลุมหลายกรณีที่ API อาจส่งมา
                                const videoUrl = v.videoUrl || 
                                            v.url || 
                                            v.link || 
                                            (v.videoId ? `https://www.youtube.com/watch?v=${v.videoId}` : '');

                                return (
                                    <div key={v.videoId || i} style={styles.videoRow}>
                                        <div style={styles.videoRank}>#{i + 1}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={styles.videoTitle}>
                                                {v.title || `วิดีโอโปรโมท ${decodedBrand}`}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                                                👁️ {fmtNum(v.totalViews || v.views)} views
                                                {v.publishedAt && (
                                                    <> • {new Date(v.publishedAt).toLocaleDateString('th-TH')}</>
                                                )}
                                            </div>
                                        </div>

                                        {/* ปุ่มดูวิดีโอ - แก้ไขให้แสดงเสมอเมื่อมี videoId */}
                                        {videoUrl ? (
                                            <a 
                                                href={videoUrl} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                style={styles.watchBtn} 
                                                onClick={e => e.stopPropagation()}
                                            >
                                                ▶ ดูวิดีโอ
                                            </a>
                                        ) : (
                                            <span style={{ 
                                                padding: '6px 14px', 
                                                fontSize: 11, 
                                                color: '#999', 
                                                fontWeight: 500 
                                            }}>
                                                ไม่มีลิงก์
                                            </span>
                                        )}
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
    channelHeader: { display: 'flex', alignItems: 'center', gap: 18, background: '#fff', borderRadius: 16, padding: '18px 22px', marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' },
    channelAvatar: { width: 64, height: 64, borderRadius: '50%', background: '#2d3436', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', fontWeight: 800, flexShrink: 0 },
    channelName: { fontSize: 20, fontWeight: 800, color: '#1a1a2e', margin: '0 0 8px' },
    platformBadge: { fontSize: 11, fontWeight: 700, color: '#fff', background: PLATFORM_COLOR, borderRadius: 20, padding: '3px 12px' },
    brandBadge: { fontSize: 11, fontWeight: 700, color: '#636e72', background: '#f0f0f0', borderRadius: 20, padding: '3px 12px' },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 },
    analysisGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
    card: { background: '#fff', borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' },
    cardTitle: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 },
    pendingTag: { fontSize: 10, fontWeight: 600, color: '#aaa', background: '#f4f4f4', borderRadius: 20, padding: '2px 8px' },
    placeholderNote: { fontSize: 11, color: '#ccc', textAlign: 'center', lineHeight: 1.6, padding: '8px 0', fontFamily: "'Prompt', sans-serif" },
    placeholderLabel: { fontSize: 11, color: '#aaa', fontWeight: 600, marginBottom: 8, fontFamily: "'Prompt', sans-serif" },
    tagCloud: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    tag: { fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '3px 10px' },
    chartPlaceholder: { height: 100, background: '#fafafa', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1.5px dashed #ececec' },
    sectionTitle: { fontSize: 15, fontWeight: 700, color: '#2d3436', marginBottom: 12, fontFamily: "'Prompt', sans-serif" },
    videoList: { background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' },
    videoRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid #f5f5f5' },
    videoRank: { fontSize: 16, fontWeight: 800, color: '#ddd', width: 28, textAlign: 'center' },
    videoTitle: { fontSize: 13, fontWeight: 600, color: '#2d3436', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    watchBtn: { padding: '6px 14px', borderRadius: 8, background: PLATFORM_COLOR, color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: "'Prompt', sans-serif" },
};

export default InfluencerAnalysisPage;