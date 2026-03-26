// Componant/Favorites.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL || '';

function Favorites() {
    const [favorites, setFavorites] = useState([]);
    const [avatars, setAvatars]     = useState({});
    const [loading, setLoading]     = useState(true);
    const [userName, setUserName]   = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }

        fetch(`${API}/api/favorites`, {  // ✅ เพิ่ม API base URL
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(async r => {
                // ✅ เช็ค 401 ก่อน — token หมดอายุหรือไม่ถูกต้อง
                if (r.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    navigate('/login');
                    return null;
                }
                return r.json();
            })
            .then(async data => {
                if (!data) return;

                // ✅ เช็คว่ามี favorites จริงๆ ไม่ใช่แค่เช็ค message
                if (!data.favorites && data.message) {
                    console.error('Favorites error:', data.message);
                    navigate('/login');
                    return;
                }

                const favs = data.favorites || [];
                setFavorites(favs);
                setUserName(data.name || '');

                const avatarMap = {};
                await Promise.all(favs.map(async fav => {
                    try {
                        const r = await fetch(`${API}/api/avatar/${encodeURIComponent(fav.influencerName)}`);
                        const d = await r.json();
                        if (d.avatar) avatarMap[fav.influencerName] = d.avatar;
                    } catch {}
                }));
                setAvatars(avatarMap);
            })
            .catch((err) => {
                console.error('Favorites fetch error:', err);
                navigate('/login');
            })
            .finally(() => setLoading(false));
    }, [navigate]);

    const removeFavorite = async (influencerName) => {
        const token = localStorage.getItem('token');
        await fetch(`${API}/api/favorites/toggle`, {  // ✅ เพิ่ม API base URL
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ influencerName }),
        });
        setFavorites(prev => prev.filter(f => f.influencerName !== influencerName));
    };

    const viewInGraph = (fav) => {
        const platform = fav.platform || 'tiktok';
        navigate(`/analysis/${platform}?highlight=${fav.influencerName}`);
    };

    if (loading) {
        return (
            <div className="loading-wrap">
                <div className="spinner" />
                <p>กำลังโหลด...</p>
            </div>
        );
    }

    return (
        <div className="fav-page">
            <div className="fav-header">
                <h1 className="fav-title">⭐ Favorites ของคุณ</h1>
                <p className="fav-sub">
                    สวัสดีคุณ <b>{userName}</b> — คุณมี {favorites.length} Influencer ที่บันทึกไว้
                </p>
            </div>

            {favorites.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state__icon">⭐</div>
                    <p className="empty-state__title">ยังไม่มี Favorites</p>
                    <p className="empty-state__sub">
                        ไปที่หน้า Analysis แล้วกดดาวที่ Influencer ที่ชอบได้เลยครับ
                    </p>
                    <button className="btn btn--primary" onClick={() => navigate('/analysis')}>
                        ไปหน้า Analysis →
                    </button>
                </div>
            ) : (
                <div className="fav-grid">
                    {favorites.map((fav, i) => {
                        const isTikTok = (fav.platform || 'tiktok') === 'tiktok';
                        const avatarBg = isTikTok
                            ? 'linear-gradient(135deg, #1a1a2e, #4a4a6e)'
                            : 'linear-gradient(135deg, #FF0000, #cc0000)';
                        const badgeBg = isTikTok ? 'var(--color-navy)' : 'var(--color-youtube-bright)';
                        const viewBg  = isTikTok ? 'var(--color-navy)' : 'var(--color-youtube)';

                        return (
                            <div key={i} className="fav-card">
                                <div className="fav-card__avatar" style={{ background: avatarBg }}>
                                    {avatars[fav.influencerName] ? (
                                        <img src={avatars[fav.influencerName]} alt={fav.influencerName} />
                                    ) : (
                                        <span>{fav.influencerName.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>

                                <div className="fav-card__info">
                                    <p className="fav-card__name">@{fav.influencerName}</p>
                                    <p className="fav-card__meta">
                                        <span className="fav-card__badge" style={{ background: badgeBg }}>
                                            {isTikTok ? '🎵 TikTok' : '▶️ YouTube'}
                                        </span>
                                        บันทึกเมื่อ {new Date(fav.addedAt).toLocaleDateString('th-TH')}
                                    </p>
                                </div>

                                <div className="fav-card__actions">
                                    <button
                                        className="fav-card__view-btn"
                                        style={{ background: viewBg }}
                                        onClick={() => viewInGraph(fav)}
                                    >
                                        ดูในกราฟ 🔍
                                    </button>
                                    <button
                                        className="fav-card__remove-btn"
                                        onClick={() => removeFavorite(fav.influencerName)}
                                    >
                                        ลบ
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

export default Favorites;