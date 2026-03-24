// Analysis/youtube/NodePopupCard.js
// Popup เฉพาะ YouTube: แสดง Subscribers, Views, ลิงก์ YouTube channel
import React, { useEffect, useState } from 'react';
import { CATEGORY_COLOR_MAP } from '../constants/categories';

const API = 'http://localhost:5000';
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

function NodePopupCard({ node, imgCache, favorites, favLoading, onClose, onToggleFavorite }) {
    const [brandVideos, setBrandVideos] = useState([]);
    const [loadingBrands, setLoadingBrands] = useState(false);
    const [channelId, setChannelId] = useState(null);
    
    useEffect(() => {
        if (!node || node.type !== 'Influencer') {
            setBrandVideos([]);
            setChannelId(null);
            return;
        }

        // ✅ ดึง brand videos
        setLoadingBrands(true);
        fetch(`${API}/api/top-videos-by-brand?authorName=${encodeURIComponent(node.name)}&platform=youtube`)
            .then(r => r.json())
            .then(data => setBrandVideos(Array.isArray(data) ? data : []))
            .catch(() => setBrandVideos([]))
            .finally(() => setLoadingBrands(false));

        // ✅ ดึง channelId จริงจาก MongoDB
        fetch(`${API}/api/youtube/data?authorName=${encodeURIComponent(node.name)}&limit=1`)
            .then(r => r.json())
            .then(d => {
                const id = d.data?.[0]?.channelId;
                console.log('channelId:', id); // ✅ เช็ค
                if (id) setChannelId(id);
            })
            .catch(() => {});
    }, [node]);

    if (!node) return null;
    const color = getNodeColor(node);

    return (
        <div className="node-popup-card" style={{ zIndex: 1000}}>
            <button className="popup-close-btn" onClick={onClose}>✖</button>

            {/* Avatar */}
            <div className="popup-avatar" style={{
                background: color, boxShadow: `0 4px 15px ${color}40`,
                overflow: 'hidden', padding: 0,
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
                    {/* Stats: Subscribers + Views */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', width: '100%' }}>
                        <div className="popup-stat-box">
                            <div className="popup-stat-label">
                                <i className="fi fi-rr-users-alt" /> Subscribers
                            </div>
                            <span className="popup-stat-value">
                                {node.subscribers?.toLocaleString() || node.followers?.toLocaleString() || '-'}
                            </span>
                        </div>
                        <div className="popup-stat-box">
                            <div className="popup-stat-label" style={{ color: PLATFORM_COLOR }}>
                                <i className="fi fi-rr-play-alt" /> Views
                            </div>
                            <span className="popup-stat-value">
                                {fmtNum(node.channelViews || node.totalViews)}
                            </span>
                        </div>
                    </div>

                    {/* ✅ แบรนด์ที่โปรโมท */}
                    <div style={{ width: '100%', marginTop: 10 }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 12, fontWeight: 700, color: '#555',
                            marginBottom: 8, fontFamily: "'Prompt', sans-serif",
                        }}>
                            <span>🏷️ แบรนด์ที่โปรโมท</span>
                            <span style={{ color: '#bbb', fontWeight: 400 }}>· คลิปยอดวิวสูงสุด</span>
                        </div>

                        {loadingBrands ? (
                            <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '10px 0' }}>
                                กำลังโหลด...
                            </div>
                        ) : brandVideos.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: '8px 0' }}>
                                ไม่มีข้อมูลแบรนด์
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {brandVideos.map((item, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex', alignItems: 'center',
                                        justifyContent: 'space-between', gap: 8,
                                        background: '#f8f9fa', borderRadius: 10,
                                        padding: '7px 10px', border: '1px solid #eee',
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: 12, fontWeight: 700, color: '#2d3436',
                                                fontFamily: "'Prompt', sans-serif",
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>
                                                {item.brand || item._id || 'Unknown'}
                                            </div>
                                            <div style={{ fontSize: 11, color: PLATFORM_COLOR, marginTop: 1 }}>
                                                👁️ {fmtNum(item.totalViews)}
                                            </div>
                                        </div>

                                        {item.videoUrl ? (
                                            <a href={item.videoUrl} target="_blank" rel="noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    padding: '5px 10px', borderRadius: 8,
                                                    background: PLATFORM_COLOR, color: '#fff',
                                                    fontSize: 11, fontWeight: 600, textDecoration: 'none',
                                                    whiteSpace: 'nowrap', flexShrink: 0,
                                                }}>
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

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <a  href={channelId 
                                ? `https://www.youtube.com/channel/${channelId}`
                                : `https://www.youtube.com/results?search_query=${encodeURIComponent(node.name)}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="popup-view-btn"
                            style={{ flex: 1, textAlign: 'center', background: PLATFORM_COLOR }}
                        >
                            View Channel
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
