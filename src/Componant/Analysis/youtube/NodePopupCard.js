// Analysis/youtube/NodePopupCard.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORY_COLOR_MAP } from '../constants/categories';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const PLATFORM_COLOR = '#cc0000';

function getNodeColor(node) {
    if (node.type === 'Influencer') return '#2d3436';
    return CATEGORY_COLOR_MAP[node.category] || '#BDC3C7';
}

function fmtNum(n) {
    if (!n || n === 0) return '-';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
}

// ─── Trend Badge ──────────────────────────────────────────────────────────────
// sentiment: 'positive' | 'negative' | 'neutral' | null (ยังไม่มีข้อมูล)
function TrendBadge({ sentiment }) {
    const cfg = {
        positive: { color: '#00b894', label: 'Trend', bg: '#eafaf5' },
        negative: { color: '#e17055', label: 'Trend', bg: '#fdf0ee' },
        neutral:  { color: '#b2bec3', label: 'Trend', bg: '#f4f4f4' },
    };
    const c = cfg[sentiment] || cfg.neutral;
    return (
        <span style={{
            fontSize: 12, fontWeight: 700,
            color: c.color,
            background: c.bg,
            borderRadius: 6,
            padding: '2px 8px',
            fontFamily: "'Prompt', sans-serif",
        }}>
            {c.label}
        </span>
    );
}

// ─── Brand Popup (ใหม่) ───────────────────────────────────────────────────────
function BrandPopup({ node, relatedYoutubers, loadingYoutubers, onClose, color, imgCache, loadAvatarForNode }) {
    const navigate = useNavigate();
    // ใช้ state เพื่อ trigger re-render เมื่อรูปใน imgCache โหลดเสร็จ
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        if (!relatedYoutubers.length) return;
        relatedYoutubers.forEach(yt => {
            if (!imgCache?.current?.[yt.name]) {
                // สร้าง fake node object ที่ loadAvatarForNode ต้องการ
                loadAvatarForNode?.({ name: yt.name });
            }
        });

        // poll ทุก 300ms จนกว่ารูปจะโหลดครบ แล้ว re-render
        const timer = setInterval(() => {
            const allLoaded = relatedYoutubers.every(yt => imgCache?.current?.[yt.name]?.complete);
            forceUpdate(n => n + 1);
            if (allLoaded) clearInterval(timer);
        }, 300);

        return () => clearInterval(timer);
    }, [relatedYoutubers, imgCache, loadAvatarForNode]);

    return (
        <div style={{ width: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                    width: 54, height: 54, borderRadius: '50%',
                    background: color, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 22, color: '#fff',
                    fontWeight: 700, flexShrink: 0, boxShadow: `0 4px 14px ${color}55`,
                    fontFamily: "'Prompt', sans-serif",
                }}>
                    {node.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.2, fontFamily: "'Prompt', sans-serif" }}>
                        {node.name}
                    </div>
                    <span style={{
                        fontSize: 11, fontWeight: 600, color: '#fff',
                        background: '#888', borderRadius: 6, padding: '2px 9px',
                        fontFamily: "'Prompt', sans-serif",
                    }}>
                        Brand
                    </span>
                </div>
            </div>

            {/* Info Row */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr auto',
                gap: 10, marginBottom: 14, alignItems: 'center',
            }}>
                {/* Category */}
                <div style={{
                    background: `${color}18`, borderRadius: 10, padding: '8px 12px',
                    borderLeft: `3px solid ${color}`,
                }}>
                    <div style={{ fontSize: 10, color: '#999', fontFamily: "'Prompt', sans-serif", marginBottom: 2 }}>Category</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: color, fontFamily: "'Prompt', sans-serif" }}>
                        {node.category || '-'}
                    </div>
                </div>

                {/* Channel count */}
                <div style={{
                    background: '#f4f6fb', borderRadius: 10, padding: '8px 12px',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: 10, color: '#999', fontFamily: "'Prompt', sans-serif", marginBottom: 2 }}>Channel</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#2d3436', fontFamily: "'Prompt', sans-serif" }}>
                        {loadingYoutubers ? '...' : relatedYoutubers.length}
                    </div>
                </div>

                {/* View All Button */}
                <button
                    onClick={() => navigate(`/analysis/youtube/brand/${encodeURIComponent(node.name)}`)}
                    style={{
                        padding: '10px 14px', borderRadius: 10, border: 'none',
                        background: '#1a1a2e', color: '#fff', cursor: 'pointer',
                        fontSize: 12, fontWeight: 700, fontFamily: "'Prompt', sans-serif",
                        lineHeight: 1.3, whiteSpace: 'nowrap',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.22)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                >
                    View all<br />Analysis
                </button>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#ececec', margin: '10px 0 12px' }} />

            {/* Youtuber List */}
            {loadingYoutubers ? (
                <div style={{ textAlign: 'center', fontSize: 12, color: '#aaa', padding: '16px 0', fontFamily: "'Prompt', sans-serif" }}>
                    กำลังโหลด...
                </div>
            ) : relatedYoutubers.length === 0 ? (
                <div style={{ textAlign: 'center', fontSize: 12, color: '#ccc', padding: '12px 0', fontFamily: "'Prompt', sans-serif" }}>
                    ไม่พบ YouTuber ที่เกี่ยวข้อง
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                    {relatedYoutubers
                    .sort((a, b) => (b.subscribers || 0) - (a.subscribers || 0))
                    .map((yt, idx) => (
                        <div key={idx} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            background: '#fafafa', borderRadius: 10, padding: '8px 10px',
                            border: '1px solid #efefef',
                        }}>
                            {/* Avatar — ใช้ imgCache เหมือน InfluencerPopup */}
                            <div style={{
                                width: 38, height: 38, borderRadius: '50%',
                                background: '#dfe6e9', overflow: 'hidden',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, fontSize: 16, fontWeight: 700, color: '#636e72',
                            }}>
                                {imgCache?.current?.[yt.name]?.src
                                    ? <img src={imgCache.current[yt.name].src} alt={yt.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : yt.name.charAt(0).toUpperCase()
                                }
                            </div>

                            {/* Name */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 13, fontWeight: 700, color: '#2d3436',
                                    fontFamily: "'Prompt', sans-serif",
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                    {yt.name}
                                </div>
                            </div>

                            {/* Trend badge */}
                            <TrendBadge sentiment={yt.sentiment || 'neutral'} />

                            {/* View button */}
                            <button
                                onClick={() => navigate(`/analysis/youtube/brand/${encodeURIComponent(node.name)}/influencer/${encodeURIComponent(yt.name)}`)}
                                style={{
                                    padding: '5px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0',
                                    background: '#fff', color: '#2d3436', cursor: 'pointer',
                                    fontSize: 11, fontWeight: 600, fontFamily: "'Prompt', sans-serif",
                                    whiteSpace: 'nowrap', flexShrink: 0,
                                    transition: 'border-color 0.15s, background 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = PLATFORM_COLOR; e.currentTarget.style.color = PLATFORM_COLOR; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#2d3436'; }}
                            >
                                view
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Influencer Popup (เดิม ไม่เปลี่ยน) ──────────────────────────────────────
function InfluencerPopup({ node, imgCache, favorites, favLoading, onClose, onToggleFavorite }) {
    const [brandVideos, setBrandVideos] = useState([]);
    const [loadingBrands, setLoadingBrands] = useState(false);
    const [channelId, setChannelId] = useState(null);

    useEffect(() => {
        if (!node) return;
        setLoadingBrands(true);
        fetch(`${API}/api/top-videos-by-brand?authorName=${encodeURIComponent(node.name)}&platform=youtube`)
            .then(r => r.json())
            .then(data => setBrandVideos(Array.isArray(data) ? data : []))
            .catch(() => setBrandVideos([]))
            .finally(() => setLoadingBrands(false));

        fetch(`${API}/api/youtube/data?authorName=${encodeURIComponent(node.name)}&limit=1`)
            .then(r => r.json())
            .then(d => { const id = d.data?.[0]?.channelId; if (id) setChannelId(id); })
            .catch(() => {});
    }, [node]);

    const color = getNodeColor(node);

    return (
        <>
            <div className="popup-avatar" style={{ background: color, boxShadow: `0 4px 15px ${color}40`, overflow: 'hidden', padding: 0 }}>
                {imgCache?.current?.[node.name]?.src
                    ? <img src={imgCache.current[node.name].src} alt={node.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : node.name.charAt(0).toUpperCase()
                }
            </div>
            <div>
                <h3 className="popup-name">{node.name}</h3>
                <span className="popup-type-badge" style={{ background: PLATFORM_COLOR }}>{node.type}</span>
            </div>
            <div className="popup-divider" />
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', width: '100%' }}>
                <div className="popup-stat-box">
                    <div className="popup-stat-label"><i className="fi fi-rr-users-alt" /> Subscribers</div>
                    <span className="popup-stat-value">{node.subscribers?.toLocaleString() || node.followers?.toLocaleString() || '-'}</span>
                </div>
                <div className="popup-stat-box">
                    <div className="popup-stat-label" style={{ color: PLATFORM_COLOR }}><i className="fi fi-rr-play-alt" /> Views</div>
                    <span className="popup-stat-value">{fmtNum(node.channelViews || node.totalViews)}</span>
                </div>
            </div>
            <div style={{ width: '100%', marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8, fontFamily: "'Prompt', sans-serif" }}>
                    <span>🏷️ แบรนด์ที่โปรโมท</span>
                    <span style={{ color: '#bbb', fontWeight: 400 }}>· คลิปยอดวิวสูงสุด</span>
                </div>
                {loadingBrands ? (
                    <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '10px 0' }}>กำลังโหลด...</div>
                ) : brandVideos.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: '8px 0' }}>ไม่มีข้อมูลแบรนด์</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {brandVideos.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#f8f9fa', borderRadius: 10, padding: '7px 10px', border: '1px solid #eee' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#2d3436', fontFamily: "'Prompt', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.brand || item._id || 'Unknown'}
                                    </div>
                                    <div style={{ fontSize: 11, color: PLATFORM_COLOR, marginTop: 1 }}>👁️ {fmtNum(item.totalViews)}</div>
                                </div>
                                {item.videoUrl
                                    ? <a href={item.videoUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, background: PLATFORM_COLOR, color: '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>▶ ดูคลิป</a>
                                    : <span style={{ fontSize: 11, color: '#ccc' }}>ไม่มีลิงก์</span>
                                }
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="popup-divider" style={{ margin: '10px 0' }} />
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <a href={channelId ? `https://www.youtube.com/channel/${channelId}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(node.name)}`}
                    target="_blank" rel="noreferrer" className="popup-view-btn"
                    style={{ flex: 1, textAlign: 'center', background: PLATFORM_COLOR }}>
                    View Channel
                </a>
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(node.name); }}
                    disabled={favLoading}
                    style={{ padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '18px', transition: 'all 0.2s', flexShrink: 0, border: favorites.has(node.name) ? '2px solid #ffc800' : '2px solid #e0e0e0', background: favorites.has(node.name) ? '#fff9e6' : '#fff' }}>
                    {favorites.has(node.name) ? '⭐' : '☆'}
                </button>
            </div>
        </>
    );
}

// ─── Main NodePopupCard ───────────────────────────────────────────────────────
function NodePopupCard({ node, imgCache, loadAvatarForNode, favorites, favLoading, onClose, onToggleFavorite, graphLinks = [] }) {
    const [relatedYoutubers, setRelatedYoutubers] = useState([]);
    const [loadingYoutubers, setLoadingYoutubers] = useState(false);

    // เมื่อ node เปลี่ยนเป็น Brand → หา youtubers ที่เชื่อมกับแบรนด์นี้จาก graphLinks
    useEffect(() => {
        if (!node || node.type !== 'Brand') {
            setRelatedYoutubers([]);
            return;
        }

        setLoadingYoutubers(true);

        // หา influencer nodes จาก links ที่เชื่อมกับ brand node นี้
        const youtubers = graphLinks
            .filter(l => {
                if (l.isPhantom) return false;
                const src = typeof l.source === 'object' ? l.source : null;
                const tgt = typeof l.target === 'object' ? l.target : null;
                return src?.id === node.id || tgt?.id === node.id;
            })
            .map(l => {
                const src = typeof l.source === 'object' ? l.source : null;
                const tgt = typeof l.target === 'object' ? l.target : null;
                return src?.type === 'Influencer' ? src : tgt?.type === 'Influencer' ? tgt : null;
            })
            .filter(Boolean)
            // dedup
            .filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i);

        // sentiment ยังไม่มีข้อมูล → ตั้งเป็น null ไว้ก่อน (TrendBadge จะแสดงสีเทา)
        setRelatedYoutubers(youtubers.map(yt => ({ ...yt, sentiment: null })));
        setLoadingYoutubers(false);
    }, [node, graphLinks]);

    if (!node) return null;

    const color = getNodeColor(node);

    return (
        <div className="node-popup-card" style={{ zIndex: 1000 }}>
            <button className="popup-close-btn" onClick={onClose}>✖</button>

            {node.type === 'Brand' ? (
                <BrandPopup
                    node={node}
                    relatedYoutubers={relatedYoutubers}
                    loadingYoutubers={loadingYoutubers}
                    onClose={onClose}
                    color={color}
                    imgCache={imgCache}
                    loadAvatarForNode={loadAvatarForNode}
                />
            ) : (
                <InfluencerPopup
                    node={node}
                    imgCache={imgCache}
                    favorites={favorites}
                    favLoading={favLoading}
                    onClose={onClose}
                    onToggleFavorite={onToggleFavorite}
                />
            )}
        </div>
    );
}

export default NodePopupCard;