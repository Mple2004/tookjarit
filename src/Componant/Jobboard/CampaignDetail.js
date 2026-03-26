// src/Componant/Jobboard/CampaignDetail.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Jobboard.css';

const API = process.env.REACT_APP_API_URL || '';

const JOB_TYPE_LABEL = {
    freelance: { text: 'ฟรีแลนซ์', color: '#6c5ce7', bg: '#f0eeff', icon: '💼' },
    contract:  { text: 'สัญญาจ้าง', color: '#e17055', bg: '#fff3f0', icon: '📝' },
    parttime:  { text: 'พาร์ทไทม์', color: '#00b894', bg: '#f0fff8', icon: '⏰' },
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

function getCurrentUserId() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        return JSON.parse(atob(token.split('.')[1])).id;
    } catch { return null; }
}

function renderWithLinks(text) {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
            return (
                <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="contact-link"
                    onClick={e => e.stopPropagation()}>
                    🔗 {part}
                </a>
            );
        }
        return <span key={i}>{part}</span>;
    });
}

function ApplicantCard({ applicant, index }) {
    const [expanded, setExpanded] = useState(false);
    const colors = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fd79a8', '#fdcb6e', '#a29bfe'];
    const color = colors[index % colors.length];
    const initial = applicant.name?.[0]?.toUpperCase() || '?';

    return (
        <div className="applicant-card">
            <div className="applicant-card-header" onClick={() => setExpanded(e => !e)}>
                <div className="applicant-avatar" style={{ background: color }}>{initial}</div>
                <div className="applicant-info">
                    <div className="applicant-name">{applicant.name || 'ไม่ระบุชื่อ'}</div>
                    <div className="applicant-time">สมัครเมื่อ {getTimeAgo(applicant.appliedAt)}</div>
                </div>
                {applicant.message && (
                    <div className="applicant-expand-btn" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>▾</div>
                )}
            </div>
            {applicant.message && (
                <div className={`applicant-message-wrap ${expanded ? 'expanded' : ''}`}>
                    <div className="applicant-message-inner">
                        <div className="applicant-message-label">💬 ข้อความ</div>
                        <p className="applicant-message-text">{applicant.message}</p>
                    </div>
                </div>
            )}
            {!expanded && applicant.message && (
                <div className="applicant-preview">
                    {applicant.message.length > 80 ? applicant.message.slice(0, 80) + '...' : applicant.message}
                </div>
            )}
        </div>
    );
}

function CampaignDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [campaign, setCampaign] = useState(null);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [message, setMessage] = useState('');
    const [applied, setApplied] = useState(false);
    const [currentImg, setCurrentImg] = useState(0);
    const [deleting, setDeleting] = useState(false);
    const [toggling, setToggling] = useState(false);
    const [showApplicants, setShowApplicants] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);  // ✅ NEW

    const isLoggedIn = !!localStorage.getItem('token');
    const currentUserId = getCurrentUserId();

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API}/api/campaigns/${id}`);
                if (!res.ok) throw new Error();
                const data = await res.json();
                setCampaign(data);
                if (currentUserId) setApplied(data.applicants?.some(a => a.userId === currentUserId));
            } catch { setCampaign(null); }
            finally { setLoading(false); }
        })();
    }, [id, currentUserId]);

    // ✅ NEW: ปิด lightbox ด้วย Escape
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') setLightboxOpen(false); };
        if (lightboxOpen) window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [lightboxOpen]);

    const isOwner = campaign && currentUserId && campaign.author?.userId === currentUserId;

    const handleApply = async () => {
        if (!isLoggedIn) { navigate('/login'); return; }
        setApplying(true);
        try {
            const res = await fetch(`${API}/api/campaigns/${id}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ message }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setApplied(true);
            alert('สมัครเข้าร่วมแคมเปญเรียบร้อย! 🎉');
        } catch (err) { alert(err.message); }
        finally { setApplying(false); }
    };

    const handleDelete = async () => {
        if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบแคมเปญนี้?')) return;
        setDeleting(true);
        try {
            const res = await fetch(`${API}/api/campaigns/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert('ลบแคมเปญเรียบร้อย');
            navigate('/jobboard');
        } catch (err) { alert(err.message); }
        finally { setDeleting(false); }
    };

    const handleToggleStatus = async () => {
        const newStatus = campaign.status === 'open' ? 'closed' : 'open';
        if (!window.confirm(newStatus === 'closed' ? 'ปิดรับสมัครแคมเปญนี้?' : 'เปิดรับสมัครแคมเปญนี้อีกครั้ง?')) return;
        setToggling(true);
        try {
            const res = await fetch(`${API}/api/campaigns/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setCampaign(prev => ({ ...prev, status: newStatus }));
        } catch (err) { alert(err.message); }
        finally { setToggling(false); }
    };

    if (loading) return (
    <div className="jobboard-page">
        <div className="jobboard-loading">
            <div className="jobboard-spinner" />
            <p>กำลังโหลด...</p>
        </div>
    </div>
);
    if (!campaign) return (
        <div className="jobboard-page">
            <div className="jobboard-empty">
                <span style={{ fontSize: 48 }}>😕</span><p>ไม่พบแคมเปญนี้</p>
                <button className="jobboard-back-btn" onClick={() => navigate('/jobboard')}>← กลับ Jobboard</button>
            </div>
        </div>
    );

    const c = campaign;
    const jobInfo = JOB_TYPE_LABEL[c.jobType] || JOB_TYPE_LABEL.freelance;
    const hasImages = c.images && c.images.length > 0;
    const applicantCount = c.applicants?.length || 0;

    return (
        <div className="jobboard-page">
            <div className="detail-container">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <button className="jobboard-back-btn" style={{ margin: 0 }} onClick={() => navigate('/jobboard')}>← กลับ Jobboard</button>
                    {isOwner && (
                        <button className="jobboard-back-btn" style={{ margin: 0, color: '#ff4757', border: '1px solid #ffcdd2', background: '#fff5f5' }}
                            onClick={() => navigate('/my-campaigns')}>
                            📌 แคมเปญของฉัน
                        </button>
                    )}
                </div>

                <div className="detail-layout">
                    {/* Main */}
                    <div className="detail-main">
                        {hasImages && (
                            <div className="detail-gallery">
                                <img
                                    src={getImageUrl(c.images[currentImg])}
                                    alt={c.title}
                                    className="detail-main-image"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setLightboxOpen(true)}
                                    onError={e => { e.target.style.display = 'none'; }}
                                />
                                {c.images.length > 1 && (
                                    <div className="detail-thumbs">
                                        {c.images.map((img, i) => (
                                            <img key={i} src={getImageUrl(img)} alt="" className={`detail-thumb ${i === currentImg ? 'active' : ''}`} onClick={() => setCurrentImg(i)} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ✅ NEW: Lightbox — คลิกรูปแล้วขยายเต็มจอ */}
                        {lightboxOpen && hasImages && (
                            <div
                                onClick={() => setLightboxOpen(false)}
                                style={{
                                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(0,0,0,0.85)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    zIndex: 99999, cursor: 'pointer',
                                    animation: 'fadeIn 0.2s ease',
                                }}
                            >
                                {/* ปุ่มปิด */}
                                <div style={{
                                    position: 'absolute', top: 20, right: 20,
                                    color: '#fff', fontSize: 32, fontWeight: 300,
                                    cursor: 'pointer', lineHeight: 1,
                                }}>✕</div>

                                {/* ปุ่มเลื่อนซ้าย */}
                                {c.images.length > 1 && (
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setCurrentImg(i => i > 0 ? i - 1 : c.images.length - 1); }}
                                        style={{
                                            position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
                                            color: '#fff', fontSize: 40, cursor: 'pointer',
                                            background: 'rgba(255,255,255,0.15)', borderRadius: '50%',
                                            width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}
                                    >‹</div>
                                )}

                                {/* รูปเต็มจอ */}
                                <img
                                    src={getImageUrl(c.images[currentImg])}
                                    alt={c.title}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        maxWidth: '90vw', maxHeight: '90vh',
                                        objectFit: 'contain', borderRadius: 8,
                                        cursor: 'default',
                                    }}
                                />

                                {/* ปุ่มเลื่อนขวา */}
                                {c.images.length > 1 && (
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setCurrentImg(i => i < c.images.length - 1 ? i + 1 : 0); }}
                                        style={{
                                            position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
                                            color: '#fff', fontSize: 40, cursor: 'pointer',
                                            background: 'rgba(255,255,255,0.15)', borderRadius: '50%',
                                            width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}
                                    >›</div>
                                )}

                                {/* ตัวบอกรูปที่เท่าไหร่ */}
                                {c.images.length > 1 && (
                                    <div style={{
                                        position: 'absolute', bottom: 20,
                                        color: '#fff', fontSize: 14, background: 'rgba(0,0,0,0.5)',
                                        padding: '4px 14px', borderRadius: 20,
                                    }}>
                                        {currentImg + 1} / {c.images.length}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="detail-title-section">
                            <div className="campaign-card-tags">
                                <span className="campaign-tag" style={{ color: jobInfo.color, background: jobInfo.bg }}>{jobInfo.icon} {jobInfo.text}</span>
                                <span className="campaign-tag-category">{CATEGORY_EMOJI[c.category]} {c.category}</span>
                                <span className="detail-status-badge" style={{ background: c.status === 'open' ? '#f0fff0' : '#fff0f0', color: c.status === 'open' ? '#00b894' : '#e74c3c' }}>
                                    {c.status === 'open' ? '🟢 เปิดรับ' : '🔴 ปิดแล้ว'}
                                </span>
                            </div>
                            <h1 className="detail-title">{c.title}</h1>
                            <p className="detail-time">โพสต์เมื่อ {getTimeAgo(c.createdAt)}</p>
                        </div>

                        <div className="detail-desc-section">
                            <h3 className="detail-section-title">รายละเอียดงาน</h3>
                            <p className="detail-desc-text">{c.description}</p>
                        </div>

                        {isOwner && (
                            <div className="applicants-section">
                                <button className="applicants-toggle-btn" onClick={() => setShowApplicants(v => !v)}>
                                    <span>👥 ผู้สนใจสมัคร <span style={{ color: '#ff4757', fontWeight: 800 }}>{applicantCount}</span> คน</span>
                                    <span style={{ transform: showApplicants ? 'rotate(180deg)' : 'rotate(0)', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
                                </button>
                                {showApplicants && (
                                    <div className="applicants-list">
                                        {applicantCount === 0 ? (
                                            <div style={{ padding: '24px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>
                                                📭 ยังไม่มีผู้สนใจสมัคร
                                            </div>
                                        ) : (
                                            c.applicants.map((a, i) => <ApplicantCard key={a.userId || i} applicant={a} index={i} />)
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="detail-sidebar">
                        <div className="detail-side-card">
                            <div className="detail-author-row">
                                <div className="campaign-card-avatar">{c.author?.name?.[0]?.toUpperCase() || '?'}</div>
                                <div>
                                    <div className="detail-author-name">{c.author?.name}</div>
                                    <div className="detail-author-label">ผู้ประกาศ</div>
                                </div>
                            </div>
                        </div>

                        {c.contact && (
                            <div className="detail-side-card">
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>📞 ช่องทางการติดต่อ</div>
                                <div className="contact-text">{renderWithLinks(c.contact)}</div>
                            </div>
                        )}

                        {c.budget > 0 && (
                            <div className="detail-side-card">
                                <div className="detail-budget-label">งบประมาณ</div>
                                <div className="detail-budget-value">฿{c.budget.toLocaleString()}</div>
                            </div>
                        )}

                        <div className="detail-side-card">
                            <div style={{ fontSize: 13, color: '#888' }}>
                                👥 ผู้สนใจ <strong style={{ color: applicantCount > 0 ? '#ff4757' : '#888' }}>{applicantCount}</strong> คน
                            </div>
                        </div>

                        {isOwner && (
                            <div className="detail-side-card">
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 12 }}>⚙️ จัดการแคมเปญ</div>
                                <button onClick={() => navigate(`/jobboard/${id}/edit`)}
                                    style={{
                                        width: '100%', padding: '12px 0', borderRadius: 50, border: 'none',
                                        fontSize: 14, fontWeight: 600, fontFamily: "'Prompt', sans-serif",
                                        cursor: 'pointer', marginBottom: 10, background: '#fff8e1', color: '#f39c12',
                                    }}>
                                    ✏️ แก้ไขแคมเปญ
                                </button>
                                <button onClick={handleToggleStatus} disabled={toggling}
                                    style={{
                                        width: '100%', padding: '12px 0', borderRadius: 50, border: 'none',
                                        fontSize: 14, fontWeight: 600, fontFamily: "'Prompt', sans-serif",
                                        cursor: 'pointer', marginBottom: 10, transition: 'all 0.2s',
                                        background: c.status === 'open' ? '#fff3f0' : '#f0fff0',
                                        color: c.status === 'open' ? '#e17055' : '#00b894',
                                    }}>
                                    {toggling ? '...' : c.status === 'open' ? '⏸️ ปิดรับสมัคร' : '▶️ เปิดรับอีกครั้ง'}
                                </button>
                                <button onClick={handleDelete} disabled={deleting}
                                    style={{
                                        width: '100%', padding: '12px 0', borderRadius: 50,
                                        border: '1.5px solid #ff4757', background: '#fff',
                                        color: '#ff4757', fontSize: 14, fontWeight: 600,
                                        fontFamily: "'Prompt', sans-serif", cursor: 'pointer',
                                    }}>
                                    {deleting ? 'กำลังลบ...' : '🗑️ ลบแคมเปญ'}
                                </button>
                            </div>
                        )}

                        {!isOwner && (
                            <div className="detail-side-card">
                                {applied ? (
                                    <div className="detail-applied-badge">✅ คุณสมัครแล้ว</div>
                                ) : c.status !== 'open' ? (
                                    <div style={{ color: '#999', textAlign: 'center', fontSize: 14 }}>แคมเปญนี้ปิดรับสมัครแล้ว</div>
                                ) : (
                                    <>
                                        <textarea
                                            placeholder="แนะนำตัวสั้นๆ เช่น โปรไฟล์ ผลงานที่ผ่านมา... (ไม่บังคับ)"
                                            value={message} onChange={e => setMessage(e.target.value)}
                                            className="detail-apply-textarea" rows={3} />
                                        <button className="detail-apply-btn" onClick={handleApply} disabled={applying}>
                                            {applying ? 'กำลังสมัคร...' : isLoggedIn ? '🚀 สนใจงานนี้' : 'เข้าสู่ระบบเพื่อสมัคร'}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CampaignDetail;
