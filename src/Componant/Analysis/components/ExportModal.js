// src/Componant/Analysis/components/ExportModal.js
import React, { useState } from 'react';

const CATEGORIES = [
    'Fashion', 'Beauty & Personal Care', 'Health & Wellness',
    'Food & Beverage', 'Mom & Kids', 'IT & Gadgets',
    'Home & Living', 'Toys & Collectibles', 'Pet', 'Automotive', 'Lifestyle'
];

function ExportModal({ isOpen, onClose, currentPlatform }) {
    const [categories, setCategories] = useState([]);
    const [keyword,    setKeyword]    = useState('');
    const [loading,    setLoading]    = useState(false);

    if (!isOpen) return null;

    const toggleCategory = (cat) => {
        setCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const handleExport = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('platform', currentPlatform || 'tiktok');
            params.set('dataType', 'both');
            if (categories.length > 0) params.set('categories', categories.join(','));

            const kwPart = keyword.trim() ? `&keyword=${keyword.trim()}` : '';
            const res = await fetch(
                `/api/export-excel?${params.toString().replace(/%2C/g, ',')}${kwPart}`
            );
            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const blob = await res.blob();
            const url  = window.URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `TookJaRit_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            onClose();
        } catch (err) {
            alert(`Export ล้มเหลว: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const platformLabel = currentPlatform === 'youtube' ? 'YouTube' : 'TikTok';
    const platformEmoji = currentPlatform === 'youtube' ? '▶️' : '🎵';

    return (
        <>
            {/* Backdrop */}
            <div className="em-backdrop" onClick={onClose} />

            {/* Modal */}
            <div className="em-modal">
                {/* Header */}
                <div className="em-header">
                    <div className="em-header__left">
                        <div className="em-header__icon">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                                stroke="#1D6F42" strokeWidth="2.5">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </div>
                        <div>
                            <p className="em-header__title">Export ข้อมูล</p>
                            <p className="em-header__subtitle">บันทึกเป็น Excel (.xlsx)</p>
                        </div>
                    </div>
                    <button className="em-header__close" onClick={onClose}>✕</button>
                </div>

                {/* Body */}
                <div className="em-body">
                    {/* Platform */}
                    <div className="em-section">
                        <p className="em-section__label">📱 Platform</p>
                        <div className="em-platform-badge">
                            {platformEmoji} {platformLabel}
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="em-section">
                        <p className="em-section__label">🏷️ กรอง Category (ไม่เลือก = ทุก Category)</p>
                        <div className="em-cat-grid">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => toggleCategory(cat)}
                                    className={`em-cat-btn${categories.includes(cat) ? ' em-cat-btn--active' : ''}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        {categories.length > 0 && (
                            <button className="em-clear-btn" onClick={() => setCategories([])}>
                                ✕ ล้าง Category ที่เลือก ({categories.length})
                            </button>
                        )}
                    </div>

                    {/* Keyword */}
                    <div className="em-section">
                        <p className="em-section__label">🔍 กรอง Keyword (ไม่ระบุ = ทั้งหมด)</p>
                        <input
                            type="text"
                            className="em-input"
                            placeholder="เช่น beauty, skincare..."
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                        />
                    </div>

                    {/* Summary */}
                    <div className="em-summary">
                        <span>📊</span>
                        <span className="em-summary__text">
                            จะ Export: <b>{platformEmoji} {platformLabel}</b>
                            {categories.length > 0 && <> · <b>{categories.length} Categories</b></>}
                            {keyword.trim() && <> · keyword "<b>{keyword.trim()}</b>"</>}
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div className="em-footer">
                    <button className="em-cancel-btn" onClick={onClose}>ยกเลิก</button>
                    <button
                        className={`em-export-btn${loading ? ' em-export-btn--loading' : ''}`}
                        onClick={handleExport}
                        disabled={loading}
                    >
                        {loading ? (
                            <><Spinner /> กำลัง Export...</>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}>
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Export Excel
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}

function Spinner() {
    return <span className="em-spinner" />;
}

export default ExportModal;
