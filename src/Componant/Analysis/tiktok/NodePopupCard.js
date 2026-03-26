// Analysis/tiktok/NodePopupCard.js
import React, { useEffect, useState } from 'react';
import { CATEGORY_COLOR_MAP } from '../constants/categories';

const API = process.env.REACT_APP_API_URL || '';
const PLATFORM_COLOR = '#1a1a2e';

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

function NodePopupCard({ node, imgCache, favorites, favLoading, onClose, onToggleFavorite }) {
    const [brandVideos, setBrandVideos] = useState([]);
    const [loadingBrands, setLoadingBrands] = useState(false);

    useEffect(() => {
        if (!node || node.type !== 'Influencer') {
            setBrandVideos([]);
            return;
        }
        setLoadingBrands(true);
        fetch(`${API}/api/top-videos-by-brand?authorName=${encodeURIComponent(node.name)}&platform=tiktok`)
            .then(r => r.json())
            .then(data => setBrandVideos(Array.isArray(data) ? data : []))
            .catch(() => setBrandVideos([]))
            .finally(() => setLoadingBrands(false));
    }, [node]);

    if (!node) return null;
    const color = getNodeColor(node);

    return (
        <div className="node-popup-card" style={{ zIndex: 1000 }}>
            <button className="popup-close-btn" onClick={onClose}>✖</button>

            <div className="popup-avatar" style={{
                background: color,
                boxShadow: `0 4px 15px ${color}40`,
                overflow: 'hidden',
                padding: 0,
            }}>
                {imgCache?.current?.[node.name]?.src
                    ? <img src={imgCache.current[node.name].src} alt={node.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : node.name.charAt(0).toUpperCase()
                }
            </div>

            <div>
                <h3 className="popup-name">{node.name}</h3>
                <span className="popup-type-badge"
                    style={{ background: node.type === 'Influencer' ? PLATFORM_COLOR : '#888' }}>
                    {node.type}
                </span>
            </div>

            <div className="popup-divider" />

            {node.type === 'Brand' ? (
                <div style={{ marginBottom: '10px' }}>
                    <span style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '4px' }}>Category</span>
                    <span style={{
                        fontSize: '16px', fontWeight: 'bold', color,
                        background: `${color}15`, padding: '6px 15px', borderRadius: '8px'
                    }}>
                        {node.category || '-'}
                    </span>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', width: '100%' }}>
    <div className="popup-stat-box">
        <div className="popup-stat-label">
            <i className="fi fi-rr-users-alt" /> Followers
        </div>
        <span className="popup-stat-value">
            {node.followers?.toLocaleString() || '-'}
        </span>
    </div>
    <div className="popup-stat-box">
        <div className="popup-stat-label" style={{ color: '#ff4757' }}>
            <i className="fi fi-rr-heart" /> Likes
        </div>
        <span className="popup-stat-value">
            {node.profileLikes
                ? fmtNum(node.profileLikes)
                : <span style={{ fontSize: 11, color: '#bbb', fontWeight: 400 }}>ยังไม่ sync</span>
            }
        </span>
    </div>
</div>

                    <div style={{ width: '100%', marginTop: 10 }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 12, fontWeight: 700, color: '#555',
                            marginBottom: 8, fontFamily: "'Prompt', sans-serif",
                        }}>
                            <span>🏷️ แบรนด์ที่โปรโมท</span>
                            <span style={{ color: '#bbb', fontWeight: 400 }}>· คลิปยอดไลค์สูงสุด</span>
                        </div>

                        {loadingBrands ? (
                            <div style={{
                                fontSize: 12, color: '#aaa', textAlign: 'center', padding: '10px 0',
                                fontFamily: "'Prompt', sans-serif",
                            }}>
                                กำลังโหลดข้อมูลแบรนด์...
                            </div>
                        ) : brandVideos.length === 0 ? (
                            <div style={{
                                fontSize: 12, color: '#ccc', textAlign: 'center', padding: '8px 0',
                                fontFamily: "'Prompt', sans-serif",
                            }}>
                                ไม่มีข้อมูลแบรนด์
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {brandVideos.map((item, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex', alignItems: 'center',
                                        justifyContent: 'space-between', gap: 8,
                                        background: '#f8f9fa', borderRadius: 10,
                                        padding: '7px 10px',
                                        border: '1px solid #eee',
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: 12, fontWeight: 700, color: '#2d3436',
                                                fontFamily: "'Prompt', sans-serif",
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>
                                                {item.brand || item._id || 'Unknown'}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 1 }}>
                                                ❤️ {fmtNum(item.totalLikes)}
                                            </div>
                                        </div>

                                        {item.videoUrl ? (
                                            <a
                                                href={item.videoUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    padding: '5px 10px', borderRadius: 8,
                                                    background: PLATFORM_COLOR, color: '#fff',
                                                    fontSize: 11, fontWeight: 600, textDecoration: 'none',
                                                    fontFamily: "'Prompt', sans-serif",
                                                    whiteSpace: 'nowrap', flexShrink: 0,
                                                }}
                                            >
                                                ▶ ดูคลิป
                                            </a>
                                        ) : (
                                            <span style={{ fontSize: 11, color: '#ccc' }}>ไม่มีลิงก์</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="popup-divider" style={{ margin: '10px 0' }} />

                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <a
                            href={`https://www.tiktok.com/@${node.name}`}
                            target="_blank" rel="noreferrer"
                            className="popup-view-btn"
                            style={{ flex: 1, textAlign: 'center', background: PLATFORM_COLOR }}
                        >
                            View Profile <i className="fi fi-rr-arrow-small-right" />
                        </a>
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(node.name); }}
                            disabled={favLoading}
                            style={{
                                padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                                fontSize: '18px', transition: 'all 0.2s', flexShrink: 0,
                                border: favorites.has(node.name) ? '2px solid #ffc800' : '2px solid #e0e0e0',
                                background: favorites.has(node.name) ? '#fff9e6' : '#fff',
                            }}
                            title={favorites.has(node.name) ? 'ลบออกจาก Favorites' : 'เพิ่มใน Favorites'}
                        >
                            {favorites.has(node.name) ? '⭐' : '☆'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export default NodePopupCard;
