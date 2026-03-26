// src/Componant/Jobboard/CreateCampaign.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

function CreateCampaign() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [imageFiles, setImageFiles] = useState([]);      // File objects
    const [imagePreviews, setImagePreviews] = useState([]); // preview URLs
    const [form, setForm] = useState({
        title: '', description: '', budget: '', category: '', jobType: 'freelance', contact: '',
    });

    useEffect(() => {
        if (!localStorage.getItem('token')) { alert('กรุณาเข้าสู่ระบบก่อนโพสต์แคมเปญ'); navigate('/login'); }
    }, [navigate]);

    const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    // ── จัดการไฟล์รูปภาพ ──
    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files);
        const totalFiles = imageFiles.length + files.length;
        if (totalFiles > 5) { alert('อัปโหลดได้สูงสุด 5 รูป'); return; }

        // สร้าง preview
        const newPreviews = files.map(f => URL.createObjectURL(f));
        setImageFiles(prev => [...prev, ...files]);
        setImagePreviews(prev => [...prev, ...newPreviews]);
    };

    const removeImage = (idx) => {
        URL.revokeObjectURL(imagePreviews[idx]);
        setImageFiles(prev => prev.filter((_, i) => i !== idx));
        setImagePreviews(prev => prev.filter((_, i) => i !== idx));
    };

    // ── Submit ── ใช้ FormData เพื่อส่งไฟล์
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title || !form.description || !form.category) {
            alert('กรุณากรอก ชื่องาน, รายละเอียด, และหมวดหมู่'); return;
        }
        if (!form.contact.trim()) {
            alert('กรุณากรอกช่องทางการติดต่อ'); return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', form.title);
            formData.append('description', form.description);
            formData.append('budget', form.budget || '0');
            formData.append('category', form.category);
            formData.append('jobType', form.jobType);
            formData.append('contact', form.contact.trim());

            // แนบรูปแต่ละไฟล์
            imageFiles.forEach(file => {
                formData.append('images', file);
            });

            const res = await fetch(`${API}/api/campaigns`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                // ไม่ต้องใส่ Content-Type — browser จะตั้ง multipart/form-data เอง
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert('โพสต์แคมเปญเรียบร้อย! 🎉');
            navigate('/jobboard');
        } catch (err) { alert(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="jobboard-page">
            <div className="create-container">
                <button className="jobboard-back-btn" onClick={() => navigate('/jobboard')}>← กลับ Jobboard</button>
                <div className="create-form-card">
                    <h1 className="create-form-title">📝 สร้างแคมเปญใหม่</h1>
                    <p className="create-form-sub">โพสต์งานเพื่อหา Influencer โปรโมทสินค้าของคุณ</p>

                    <form onSubmit={handleSubmit}>
                        {/* ชื่องาน */}
                        <div className="create-field">
                            <label className="create-label">ชื่องาน *</label>
                            <input type="text" placeholder="เช่น หาคนรีวิวครีมกันแดด, ชวนปักตะกร้าใน TikTok" value={form.title} onChange={e => updateForm('title', e.target.value)} className="create-input" maxLength={120} />
                            <span className="create-char-count">{form.title.length}/120</span>
                        </div>

                        {/* รายละเอียด */}
                        <div className="create-field">
                            <label className="create-label">รายละเอียดงาน *</label>
                            <textarea placeholder={"อธิบายรายละเอียดแคมเปญ เช่น:\n• สิ่งที่คุณจะได้รับ\n• รูปแบบการรีวิว\n• เงื่อนไขการโพสต์\n• ช่องทางที่ต้องโพสต์ (IG / Reels / TikTok / Facebook)"} value={form.description} onChange={e => updateForm('description', e.target.value)} className="create-input create-textarea" maxLength={3000} />
                            <span className="create-char-count">{form.description.length}/3000</span>
                        </div>

                        {/* ── ช่องทางการติดต่อ (บังคับ) ── */}
                        <div className="create-field">
                            <label className="create-label">📞 ช่องทางการติดต่อ * <span className="create-label-hint">— บังคับกรอก</span></label>
                            <textarea
                                placeholder={"เช่น:\n• Line: @brandname\n• Email: brand@email.com\n• IG: @brandname\n• Tel: 08x-xxx-xxxx"}
                                value={form.contact}
                                onChange={e => updateForm('contact', e.target.value)}
                                className="create-input"
                                style={{ minHeight: 80, resize: 'vertical' }}
                                maxLength={500}
                            />
                            <span className="create-char-count">{form.contact.length}/500</span>
                        </div>

                        {/* หมวดหมู่ */}
                        <div className="create-field">
                            <label className="create-label">หมวดหมู่สินค้า *</label>
                            <div className="create-category-grid">
                                {CATEGORIES.map(cat => (
                                    <button key={cat} type="button" className={`create-cat-option ${form.category === cat ? 'active' : ''}`} onClick={() => updateForm('category', cat)}>
                                        <span style={{ fontSize: 20 }}>{CATEGORY_EMOJI[cat]}</span>
                                        <span>{cat}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ลักษณะการจ้าง */}
                        <div className="create-field">
                            <label className="create-label">ลักษณะการจ้าง</label>
                            <div className="create-jobtype-row">
                                {[
                                    { value: 'freelance', label: '💼 ฟรีแลนซ์', desc: 'จ้างเป็นงานๆ' },
                                    { value: 'contract',  label: '📝 สัญญาจ้าง', desc: 'รายเดือน/รายปี' },
                                    { value: 'parttime',  label: '⏰ พาร์ทไทม์', desc: 'รายชั่วโมง/รายวัน' },
                                ].map(jt => (
                                    <button key={jt.value} type="button" className={`create-jobtype-card ${form.jobType === jt.value ? 'active' : ''}`} onClick={() => updateForm('jobType', jt.value)}>
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>{jt.label}</div>
                                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{jt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* งบประมาณ */}
                        <div className="create-field">
                            <label className="create-label">งบประมาณ (บาท)</label>
                            <div className="create-budget-wrap">
                                <span className="create-budget-prefix">฿</span>
                                <input type="number" placeholder="0" value={form.budget} onChange={e => updateForm('budget', e.target.value)} className="create-budget-input" min={0} />
                            </div>
                        </div>

                        {/* ── อัปโหลดรูปภาพจากเครื่อง ── */}
                        <div className="create-field">
                            <label className="create-label">🖼️ รูปภาพสินค้า / โปสเตอร์ <span className="create-label-hint">— สูงสุด 5 รูป (jpg, png, webp)</span></label>

                            {/* ปุ่มเลือกไฟล์ */}
                            {imageFiles.length < 5 && (
                                <label className="create-upload-btn">
                                    📎 เลือกรูปจากเครื่อง
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/gif,image/webp"
                                        multiple
                                        onChange={handleImageSelect}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            )}

                            {/* Preview รูปที่เลือก */}
                            {imagePreviews.length > 0 && (
                                <div className="create-preview-row">
                                    {imagePreviews.map((url, i) => (
                                        <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                                            <img src={url} alt="" className="create-preview-thumb" />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(i)}
                                                style={{
                                                    position: 'absolute', top: -6, right: -6,
                                                    width: 22, height: 22, borderRadius: '50%',
                                                    background: '#ff4757', color: '#fff', border: 'none',
                                                    fontSize: 12, cursor: 'pointer', display: 'flex',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                                                }}
                                            >✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>
                                เลือกแล้ว {imageFiles.length}/5 รูป
                            </p>
                        </div>

                        <button type="submit" className="create-submit-btn" disabled={loading}>
                            {loading ? 'กำลังโพสต์...' : '🚀 โพสต์แคมเปญ'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default CreateCampaign;
