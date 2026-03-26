// src/Componant/Jobboard/JobboardList.js
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CampaignCard from './CampaignCard';
import './Jobboard.css';

const API = process.env.REACT_APP_API_URL || '';

const CATEGORIES = [
    'Fashion', 'Beauty & Personal Care', 'Health & Wellness',
    'Food & Beverage', 'Mom & Kids', 'IT & Gadgets',
    'Home & Living', 'Toys & Collectibles', 'Pet', 'Automotive', 'Lifestyle',
];

const CATEGORY_EMOJI = {
    'Fashion': '👗', 'Beauty & Personal Care': '💄', 'Health & Wellness': '💊',
    'Food & Beverage': '🍜', 'Mom & Kids': '👶', 'IT & Gadgets': '📱',
    'Home & Living': '🏠', 'Toys & Collectibles': '🧸', 'Pet': '🐾',
    'Automotive': '🚗', 'Lifestyle': '✨',
};

function JobboardList() {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [page, setPage] = useState(1);
    const isLoggedIn = !!localStorage.getItem('token');

    const fetchCampaigns = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 12, status: 'open' });
            if (selectedCategory) params.set('category', selectedCategory);
            if (search.trim()) params.set('search', search.trim());
            const res = await fetch(`${API}/api/campaigns?${params}`);
            const data = await res.json();
            setCampaigns(data.campaigns || []);
            setTotal(data.total || 0);
        } catch {
            setCampaigns([]);
        } finally {
            setLoading(false);
        }
    }, [page, selectedCategory, search]);

    useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchCampaigns();
    };

    return (
        <div className="jobboard-page">
            {/* Header */}
            <div className="jobboard-header">
                <div className="jobboard-header-inner">
                    <div>
                        <h1 className="jobboard-title">📋 Jobboard</h1>
                        <p className="jobboard-subtitle">ค้นหาแคมเปญจากแบรนด์ · รับงานรีวิว · โปรโมทสินค้า</p>
                    </div>

                    {/* ✅ ปุ่มฝั่งขวา */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {/* ✅ แสดงเฉพาะตอน login */}
                        {isLoggedIn && (
                            <button
                                className="jobboard-create-btn"
                                onClick={() => navigate('/jobboard/my')}
                                style={{
                                    background: '#fff',
                                    border: '1.5px solid rgba(255,255,255,0.5)',
                                    backdropFilter: 'blur(4px)',
                                    
                                }}
                            >
                                📌 แคมเปญของฉัน
                            </button>
                        )}

                        {isLoggedIn ? (
                            <button
                                className="jobboard-create-btn"
                                onClick={() => navigate('/jobboard/create')}
                            >
                                + โพสต์แคมเปญ
                            </button>
                        ) : (
                            <button
                                className="jobboard-create-btn jobboard-create-btn--disabled"
                                onClick={() => navigate('/login')}
                            >
                                เข้าสู่ระบบเพื่อโพสต์
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Search & Filter */}
            <div className="jobboard-filter-bar">
                <form onSubmit={handleSearch} className="jobboard-search-form">
                    <span className="jobboard-search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="ค้นหาแคมเปญ..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="jobboard-search-input"
                    />
                    <button type="submit" className="jobboard-search-btn">ค้นหา</button>
                </form>

                <div className="jobboard-category-row">
                    <button
                        className={`jobboard-cat-pill ${selectedCategory === '' ? 'active' : ''}`}
                        onClick={() => { setSelectedCategory(''); setPage(1); }}
                    >
                        ทั้งหมด
                    </button>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            className={`jobboard-cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                            onClick={() => { setSelectedCategory(cat); setPage(1); }}
                        >
                            {CATEGORY_EMOJI[cat]} {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="jobboard-content">
                {loading ? (
                    <div className="jobboard-loading">
                        <div className="jobboard-spinner" />
                        <p>กำลังโหลดแคมเปญ...</p>
                    </div>
                ) : campaigns.length === 0 ? (
                    <div className="jobboard-empty">
                        <span style={{ fontSize: 48 }}>📭</span>
                        <p>ยังไม่มีแคมเปญ</p>
                    </div>
                ) : (
                    <>
                        <p className="jobboard-result-count">พบ {total} แคมเปญ</p>
                        <div className="jobboard-grid">
                            {campaigns.map(c => (
                                <CampaignCard
                                    key={c._id}
                                    campaign={c}
                                    onClick={() => navigate(`/jobboard/${c._id}`)}
                                />
                            ))}
                        </div>
                        {total > 12 && (
                            <div className="jobboard-pagination">
                                <button className="jobboard-page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← ก่อนหน้า</button>
                                <span>หน้า {page}</span>
                                <button className="jobboard-page-btn" disabled={campaigns.length < 12} onClick={() => setPage(p => p + 1)}>ถัดไป →</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default JobboardList;