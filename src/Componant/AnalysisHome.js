// Componant/AnalysisHome.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function AnalysisHome() {
    const navigate = useNavigate();
    const [hovered, setHovered] = useState(null);

    return (
        <div className="ah-page">
            <div className="ah-bg-grid" />

            <div className="ah-inner">
                <p className="ah-eyebrow">เลือก Platform ที่ต้องการวิเคราะห์</p>
                <h1 className="ah-title">
                    วิเคราะห์เครือข่าย<br />
                    <span className="ah-accent">Influencer</span>
                </h1>
                <p className="ah-subtitle">
                    ค้นหาและแมปความสัมพันธ์ระหว่าง Influencer กับแบรนด์<br />
                    บน TikTok และ YouTube ในรูปแบบ Graph Network
                </p>

                <div className="ah-cards">
                    {/* ── TikTok Card ── */}
                    <div
                        className={`ah-card ah-card--tiktok${hovered === 'tiktok' ? ' ah-card--hovered' : ''}`}
                        onMouseEnter={() => setHovered('tiktok')}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => navigate('/analysis/tiktok')}
                    >
                        <span className="ah-card__icon">🎵</span>
                        <h2 className="ah-card__title">TikTok</h2>
                        <p className="ah-card__desc">วิเคราะห์ Influencer และแบรนด์จากวิดีโอ TikTok</p>

                        <div className="ah-card__tags">
                            <span className="ah-card__tag">#Hashtag</span>
                            <span className="ah-card__tag">@Username</span>
                        </div>

                        <div className="ah-card__stats">
                            <div className="ah-card__stat-item">
                                <span className="ah-card__stat-num">∞</span>
                                <span className="ah-card__stat-label">Short-form Videos</span>
                            </div>
                            <div className="ah-card__stat-divider" />
                            <div className="ah-card__stat-item">
                                <span className="ah-card__stat-num">⭐</span>
                                <span className="ah-card__stat-label">Favorite & Bookmark</span>
                            </div>
                        </div>

                        <button className="ah-card__btn">
                            เริ่มวิเคราะห์ TikTok →
                        </button>
                    </div>

                    {/* ── YouTube Card ── */}
                    <div
                        className={`ah-card ah-card--youtube${hovered === 'youtube' ? ' ah-card--hovered' : ''}`}
                        onMouseEnter={() => setHovered('youtube')}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => navigate('/analysis/youtube')}
                    >
                        <span className="ah-card__icon">▶️</span>
                        <h2 className="ah-card__title">YouTube</h2>
                        <p className="ah-card__desc">วิเคราะห์ Influencer และแบรนด์จากคอนเทนต์ YouTube</p>

                        <div className="ah-card__tags">
                            <span className="ah-card__tag">Keyword</span>
                            <span className="ah-card__tag">@Channel</span>
                        </div>

                        <div className="ah-card__stats">
                            <div className="ah-card__stat-item">
                                <span className="ah-card__stat-num">∞</span>
                                <span className="ah-card__stat-label">Long-form Videos</span>
                            </div>
                            <div className="ah-card__stat-divider" />
                            <div className="ah-card__stat-item">
                                <span className="ah-card__stat-num">⭐</span>
                                <span className="ah-card__stat-label">Favorite & Bookmark</span>
                            </div>
                        </div>

                        <button className="ah-card__btn">
                            เริ่มวิเคราะห์ YouTube →
                        </button>
                    </div>
                </div>

                <p className="ah-hint">💡 ข้อมูลแต่ละ Platform แยกกันอิสระ ไม่ปะปนกัน</p>
            </div>
        </div>
    );
}

export default AnalysisHome;
