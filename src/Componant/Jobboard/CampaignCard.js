// src/Componant/Jobboard/CampaignCard.js
import React, { useState } from 'react';
import './Jobboard.css';

const API = process.env.REACT_APP_API_URL || '';

const JOB_TYPE_LABEL = {
    freelance: { text: 'ฟรีแลนซ์', color: '#6c5ce7', bg: '#f0eeff' },
    contract:  { text: 'สัญญาจ้าง', color: '#e17055', bg: '#fff3f0' },
    parttime:  { text: 'พาร์ทไทม์', color: '#00b894', bg: '#f0fff8' },
};
const CATEGORY_EMOJI = {
    'Fashion': '👗', 'Beauty & Personal Care': '💄', 'Health & Wellness': '💊',
    'Food & Beverage': '🍜', 'Mom & Kids': '👶', 'IT & Gadgets': '📱',
    'Home & Living': '🏠', 'Toys & Collectibles': '🧸', 'Pet': '🐾',
    'Automotive': '🚗', 'Lifestyle': '✨',
};

function getImageUrl(img) {
    if (!img) return '';
    if (img.startsWith('http')) return img;
    // ตรวจสอบว่า path มี /uploads/ นำหน้าหรือเปล่า
    const clean = img.startsWith('/') ? img : `/${img}`;
    return `${API}${clean}`;
}

function CampaignCard({ campaign, onClick }) {
    const c = campaign;
    const jobInfo = JOB_TYPE_LABEL[c.jobType] || JOB_TYPE_LABEL.freelance;
    const hasImage = c.images && c.images.length > 0;
    const [imgError, setImgError] = useState(false);

    const imageUrl = hasImage ? getImageUrl(c.images[0]) : '';

    // Debug: log URL ที่จะโหลด
    if (hasImage && imageUrl) {
        console.log('🖼️ Card image URL:', imageUrl);
    }

    return (
        <div className="campaign-card" onClick={onClick}>
            {hasImage && !imgError ? (
                <div className="campaign-card-image">
                    <img
                        src={imageUrl}
                        alt={c.title}
                        onError={(e) => {
                            console.error('❌ Image load failed:', imageUrl);
                            setImgError(true);
                        }}
                    />
                </div>
            ) : hasImage && imgError ? (
                // placeholder เมื่อรูปโหลดไม่ได้ — แสดง emoji แทน
                <div className="campaign-card-image campaign-card-image--placeholder">
                    <span>{CATEGORY_EMOJI[c.category] || '🖼️'}</span>
                    <small style={{ fontSize: 10, color: '#ccc', display: 'block', marginTop: 4 }}>
                        {imageUrl}
                    </small>
                </div>
            ) : null}

            <div className="campaign-card-body">
                <div className="campaign-card-tags">
                    <span className="campaign-tag" style={{ color: jobInfo.color, background: jobInfo.bg }}>
                        {jobInfo.text}
                    </span>
                    <span className="campaign-tag-category">
                        {CATEGORY_EMOJI[c.category]} {c.category}
                    </span>
                </div>
                <h3 className="campaign-card-title">{c.title}</h3>
                <p className="campaign-card-desc">
                    {c.description.length > 100 ? c.description.slice(0, 100) + '...' : c.description}
                </p>
                <div className="campaign-card-footer">
                    <div className="campaign-card-author">
                        <div className="campaign-card-avatar">
                            {c.author?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span>{c.author?.name || 'Unknown'}</span>
                    </div>
                    {c.budget > 0 && (
                        <span className="campaign-card-budget">฿{c.budget.toLocaleString()}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CampaignCard;
