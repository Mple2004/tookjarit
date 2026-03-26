// src/Componant/Jobboard/MyCampaigns.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

function getTimeAgo(dateStr) {
    if (!dateStr) return '-';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return 'เมื่อกี้นี้';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
    const days = Math.floor(diff / 86400);
    if (days < 30) return `${days} วันที่แล้ว`;
    return new Date(dateStr).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getImageUrl(img) {
    if (!img) return '';
    if (img.startsWith('http')) return img;
    return `${API}${img}`;
}

function getUserName() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        return JSON.parse(atob(token.split('.')[1])).name;
    } catch { return null; }
}

function MyCampaigns() {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [togglingId, setTogglingId] = useState(null);
    const [filter, setFilter] = useState('all'); // all | open | closed
    const userName = getUserName();

    useEffect(() => {
        if (!localStorage.getItem('token')) { navigate('/login'); return; }
        fetchMyCampaigns();
    }, [navigate]);

    const fetchMyCampaigns = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/my-campaigns`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const data = await res.json();
            setCampaigns(Array.isArray(data) ? data : []);
        } catch { setCampaigns([]); }
        finally { setLoading(false); }
    };

    const handleDelete = async (campaignId, title) => {
        if (!window.confirm(`ลบแคมเปญ "${title}" ใช่ไหม?`)) return;
        setDeletingId(campaignId);
        try {
            const res = await fetch(`${API}/api/campaigns/${campaignId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (!res.ok) throw new Error((await res.json()).message);
            setCampaigns(p => p.filter(c => c._id !== campaignId));
        } catch (err) { alert(err.message); }
        finally { setDeletingId(null); }
    };

    const handleToggleStatus = async (campaign) => {
        const newStatus = campaign.status === 'open' ? 'closed' : 'open';
        if (!window.confirm(newStatus === 'closed' ? 'ปิดรับสมัคร?' : 'เปิดรับสมัครอีกครั้ง?')) return;
        setTogglingId(campaign._id);
        try {
            const res = await fetch(`${API}/api/campaigns/${campaign._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error((await res.json()).message);
            setCampaigns(p => p.map(c => c._id === campaign._id ? { ...c, status: newStatus } : c));
        } catch (err) { alert(err.message); }
        finally { setTogglingId(null); }
    };

    const filtered = campaigns.filter(c => filter === 'all' || c.status === filter);
    const stats = {
        total: campaigns.length,
        open: campaigns.filter(c => c.status === 'open').length,
        closed: campaigns.filter(c => c.status === 'closed').length,
        totalApplicants: campaigns.reduce((sum, c) => sum + (c.applicants?.length || 0), 0),
    };

    return (
        <div className="jobboard-page">
            {/* Header */}
            <div className="jobboard-header">
                <div className="jobboard-header-inner">
                    <div>
                        <h1 className="jobboard-title">📌 แคมเปญของฉัน</h1>
                        <p className="jobboard-subtitle">
                            {userName ? `สวัสดี ${userName} · ` : ''}จัดการแคมเปญที่คุณโพสต์ไว้
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="jobboard-create-btn" onClick={() => navigate('/jobboard')}>
                            ← Jobboard
                        </button>
                        <button className="jobboard-create-btn" onClick={() => navigate('/jobboard/create')}>
                            + โพสต์ใหม่
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            {!loading && campaigns.length > 0 && (
                <div className="my-stats-bar">
                    <div className="my-stat-item">
                        <div className="my-stat-num">{stats.total}</div>
                        <div className="my-stat-label">แคมเปญทั้งหมด</div>
                    </div>
                    <div className="my-stat-divider" />
                    <div className="my-stat-item">
                        <div className="my-stat-num" style={{ color: '#00b894' }}>{stats.open}</div>
                        <div className="my-stat-label">เปิดรับอยู่</div>
                    </div>
                    <div className="my-stat-divider" />
                    <div className="my-stat-item">
                        <div className="my-stat-num" style={{ color: '#e17055' }}>{stats.closed}</div>
                        <div className="my-stat-label">ปิดแล้ว</div>
                    </div>
                    <div className="my-stat-divider" />
                    <div className="my-stat-item">
                        <div className="my-stat-num" style={{ color: '#ff4757' }}>{stats.totalApplicants}</div>
                        <div className="my-stat-label">ผู้สนใจรวม</div>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            {!loading && campaigns.length > 0 && (
                <div className="my-filter-tabs">
                    {[
                        { key: 'all',    label: `ทั้งหมด (${stats.total})` },
                        { key: 'open',   label: `🟢 เปิดรับ (${stats.open})` },
                        { key: 'closed', label: `🔴 ปิดแล้ว (${stats.closed})` },
                    ].map(t => (
                        <button key={t.key}
                            className={`my-filter-tab ${filter === t.key ? 'active' : ''}`}
                            onClick={() => setFilter(t.key)}>
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            <div className="jobboard-content">
                {loading ? (
                    <div className="jobboard-loading"><div className="jobboard-spinner" /><p>กำลังโหลด...</p></div>
                ) : campaigns.length === 0 ? (
                    <div className="my-empty-state">
                        <div className="my-empty-icon">📭</div>
                        <h3>ยังไม่มีแคมเปญ</h3>
                        <p>เริ่มโพสต์หา Influencer สำหรับแบรนด์ของคุณได้เลย</p>
                        <button className="create-submit-btn" style={{ width: 'auto', padding: '14px 32px', marginTop: 20 }}
                            onClick={() => navigate('/jobboard/create')}>
                            🚀 โพสต์แคมเปญแรก
                        </button>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="jobboard-empty"><p>ไม่มีแคมเปญในหมวดนี้</p></div>
                ) : (
                    <div className="my-campaigns-list">
                        {filtered.map(c => {
                            const jobInfo = JOB_TYPE_LABEL[c.jobType] || JOB_TYPE_LABEL.freelance;
                            const applicantCount = c.applicants?.length || 0;
                            const isDeleting = deletingId === c._id;
                            const isToggling = togglingId === c._id;

                            return (
                                <div key={c._id} className={`my-campaign-row ${c.status === 'closed' ? 'my-campaign-row--closed' : ''}`}>
                                    {/* รูปภาพ */}
                                    {c.images?.[0] ? (
                                        <div className="my-campaign-thumb">
                                            <img src={getImageUrl(c.images[0])} alt={c.title} onError={e => { e.target.style.display = 'none'; }} />
                                        </div>
                                    ) : (
                                        <div className="my-campaign-thumb my-campaign-thumb--empty">
                                            {CATEGORY_EMOJI[c.category] || '📋'}
                                        </div>
                                    )}

                                    {/* ข้อมูล */}
                                    <div className="my-campaign-body" onClick={() => navigate(`/jobboard/${c._id}`)}>
                                        <div className="my-campaign-tags">
                                            <span className="campaign-tag" style={{ color: jobInfo.color, background: jobInfo.bg, fontSize: 11 }}>
                                                {jobInfo.text}
                                            </span>
                                            <span className="campaign-tag-category" style={{ fontSize: 11 }}>
                                                {CATEGORY_EMOJI[c.category]} {c.category}
                                            </span>
                                            <span style={{
                                                fontSize: 11, padding: '3px 10px', borderRadius: 50,
                                                background: c.status === 'open' ? '#f0fff0' : '#fff0f0',
                                                color: c.status === 'open' ? '#00b894' : '#e74c3c',
                                            }}>
                                                {c.status === 'open' ? '🟢 เปิดรับ' : '🔴 ปิดแล้ว'}
                                            </span>
                                        </div>
                                        <h3 className="my-campaign-title">{c.title}</h3>
                                        <div className="my-campaign-meta">
                                            <span>📅 {getTimeAgo(c.createdAt)}</span>
                                            <span className="my-campaign-applicants">
                                                👥 {applicantCount} คนสนใจ
                                            </span>
                                            {c.budget > 0 && <span>💰 ฿{c.budget.toLocaleString()}</span>}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="my-campaign-actions">
                                        {/* ปุ่มแก้ไข */}
                                        <button className="my-action-btn my-action-btn--edit"
                                            onClick={(e) => { e.stopPropagation(); navigate(`/jobboard/${c._id}/edit`); }}>
                                            ✏️ แก้ไข
                                        </button>
                                        {/* ปุ่มเปิด/ปิด */}
                                        <button
                                            className={`my-action-btn ${c.status === 'open' ? 'my-action-btn--pause' : 'my-action-btn--resume'}`}
                                            onClick={(e) => { e.stopPropagation(); handleToggleStatus(c); }}
                                            disabled={isToggling}>
                                            {isToggling ? '...' : c.status === 'open' ? '⏸ ปิดรับ' : '▶ เปิดรับ'}
                                        </button>
                                        {/* ปุ่มลบ */}
                                        <button className="my-action-btn my-action-btn--delete"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(c._id, c.title); }}
                                            disabled={isDeleting}>
                                            {isDeleting ? '...' : '🗑'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MyCampaigns;
