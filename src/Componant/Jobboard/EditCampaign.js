// src/Componant/Jobboard/EditCampaign.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

function getCurrentUserId() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        return JSON.parse(atob(token.split('.')[1])).id;
    } catch { return null; }
}

function getImageUrl(img) {
    if (!img) return '';
    if (img.startsWith('http')) return img;
    return `${API}${img}`;
}

function EditCampaign() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [existingImages, setExistingImages] = useState([]);
    const [newImageFiles, setNewImageFiles] = useState([]);
    const [newImagePreviews, setNewImagePreviews] = useState([]);
    const [form, setForm] = useState({
        title: '', description: '', budget: '', category: '', jobType: 'freelance', contact: '',
    });

    useEffect(() => {
        if (!localStorage.getItem('token')) { alert('กรุณาเข้าสู่ระบบก่อน'); navigate('/login'); return; }
        (async () => {
            try {
                const res = await fetch(`${API}/api/campaigns/${id}`);
                if (!res.ok) throw new Error('ไม่พบแคมเปญ');
                const data = await res.json();
                const uid = getCurrentUserId();
                if (data.author?.userId !== uid) { alert('คุณไม่มีสิทธิ์แก้ไขแคมเปญนี้'); navigate('/jobboard'); return; }
                setForm({ title: data.title || '', description: data.description || '', budget: data.budget ? String(data.budget) : '', category: data.category || '', jobType: data.jobType || 'freelance', contact: data.contact || '' });
                setExistingImages(data.images || []);
            } catch (err) { alert(err.message); navigate('/jobboard'); }
            finally { setFetching(false); }
        })();
    }, [id, navigate]);

    const updateForm = (key, val) => setForm(p => ({ ...p, [key]: val }));

    const removeExisting = (idx) => setExistingImages(p => p.filter((_, i) => i !== idx));

    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files);
        if (existingImages.length + newImageFiles.length + files.length > 5) { alert('รูปรวมกันได้สูงสุด 5 รูป'); return; }
        setNewImageFiles(p => [...p, ...files]);
        setNewImagePreviews(p => [...p, ...files.map(f => URL.createObjectURL(f))]);
    };

    const removeNew = (idx) => {
        URL.revokeObjectURL(newImagePreviews[idx]);
        setNewImageFiles(p => p.filter((_, i) => i !== idx));
        setNewImagePreviews(p => p.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title || !form.description || !form.category) { alert('กรุณากรอก ชื่องาน, รายละเอียด, และหมวดหมู่'); return; }
        if (!form.contact.trim()) { alert('กรุณากรอกช่องทางการติดต่อ'); return; }
        setLoading(true);
        try {
            // ถ้ามีรูปใหม่ → อัปโหลดผ่าน endpoint พิเศษก่อน
            let uploadedPaths = [];
            if (newImageFiles.length > 0) {
                const fd = new FormData();
                newImageFiles.forEach(f => fd.append('images', f));
                // ต้องส่ง required fields ให้ multer ผ่าน
                fd.append('title', form.title);
                fd.append('description', form.description);
                fd.append('budget', form.budget || '0');
                fd.append('category', form.category);
                fd.append('jobType', form.jobType);
                fd.append('contact', form.contact);
                const uploadRes = await fetch(`${API}/api/campaigns/${id}/upload-images`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                    body: fd,
                });
                if (uploadRes.ok) {
                    const d = await uploadRes.json();
                    uploadedPaths = d.paths || [];
                }
            }

            const res = await fetch(`${API}/api/campaigns/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({
                    title: form.title.trim(), description: form.description.trim(),
                    budget: parseInt(form.budget) || 0, category: form.category,
                    jobType: form.jobType, contact: form.contact.trim(),
                    images: [...existingImages, ...uploadedPaths],
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert('แก้ไขแคมเปญเรียบร้อย! ✅');
            navigate(`/jobboard/${id}`);
        } catch (err) { alert(err.message); }
        finally { setLoading(false); }
    };

    if (fetching) return <div className="jobboard-page"><div className="jobboard-loading"><div className="jobboard-spinner" /><p>กำลังโหลด...</p></div></div>;

    const totalImages = existingImages.length + newImageFiles.length;

    return (
        <div className="jobboard-page">
            <div className="create-container">
                <button className="jobboard-back-btn" onClick={() => navigate(`/jobboard/${id}`)}>← กลับ</button>
                <div className="create-form-card">
                    <h1 className="create-form-title">✏️ แก้ไขแคมเปญ</h1>
                    <p className="create-form-sub">แก้ไขรายละเอียดแคมเปญของคุณ</p>
                    <form onSubmit={handleSubmit}>
                        <div className="create-field">
                            <label className="create-label">ชื่องาน *</label>
                            <input type="text" value={form.title} onChange={e => updateForm('title', e.target.value)} className="create-input" maxLength={120} />
                            <span className="create-char-count">{form.title.length}/120</span>
                        </div>
                        <div className="create-field">
                            <label className="create-label">รายละเอียดงาน *</label>
                            <textarea value={form.description} onChange={e => updateForm('description', e.target.value)} className="create-input create-textarea" maxLength={3000} />
                            <span className="create-char-count">{form.description.length}/3000</span>
                        </div>
                        <div className="create-field">
                            <label className="create-label">📞 ช่องทางการติดต่อ * <span className="create-label-hint">— บังคับกรอก</span></label>
                            <textarea placeholder={"เช่น:\n• Line: @brandname\n• https://linktr.ee/yourname"} value={form.contact} onChange={e => updateForm('contact', e.target.value)} className="create-input" style={{ minHeight: 80, resize: 'vertical' }} maxLength={500} />
                            <span className="create-char-count">{form.contact.length}/500</span>
                        </div>
                        <div className="create-field">
                            <label className="create-label">หมวดหมู่สินค้า *</label>
                            <div className="create-category-grid">
                                {CATEGORIES.map(cat => (
                                    <button key={cat} type="button" className={`create-cat-option ${form.category === cat ? 'active' : ''}`} onClick={() => updateForm('category', cat)}>
                                        <span style={{ fontSize: 20 }}>{CATEGORY_EMOJI[cat]}</span><span>{cat}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="create-field">
                            <label className="create-label">ลักษณะการจ้าง</label>
                            <div className="create-jobtype-row">
                                {[{ value: 'freelance', label: '💼 ฟรีแลนซ์', desc: 'จ้างเป็นงานๆ' }, { value: 'contract', label: '📝 สัญญาจ้าง', desc: 'รายเดือน/รายปี' }, { value: 'parttime', label: '⏰ พาร์ทไทม์', desc: 'รายชั่วโมง/รายวัน' }].map(jt => (
                                    <button key={jt.value} type="button" className={`create-jobtype-card ${form.jobType === jt.value ? 'active' : ''}`} onClick={() => updateForm('jobType', jt.value)}>
                                        <div style={{ fontSize: 14, fontWeight: 600 }}>{jt.label}</div>
                                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{jt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="create-field">
                            <label className="create-label">งบประมาณ (บาท)</label>
                            <div className="create-budget-wrap">
                                <span className="create-budget-prefix">฿</span>
                                <input type="number" placeholder="0" value={form.budget} onChange={e => updateForm('budget', e.target.value)} className="create-budget-input" min={0} />
                            </div>
                        </div>
                        <div className="create-field">
                            <label className="create-label">🖼️ รูปภาพ <span className="create-label-hint">— {totalImages}/5 รูป</span></label>
                            {existingImages.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>รูปปัจจุบัน</div>
                                    <div className="create-preview-row">
                                        {existingImages.map((img, i) => (
                                            <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                                                <img src={getImageUrl(img)} alt="" className="create-preview-thumb" />
                                                <button type="button" onClick={() => removeExisting(i)} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: '#ff4757', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {newImagePreviews.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 12, color: '#00b894', marginBottom: 8 }}>✚ รูปที่จะเพิ่ม</div>
                                    <div className="create-preview-row">
                                        {newImagePreviews.map((url, i) => (
                                            <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                                                <img src={url} alt="" className="create-preview-thumb" style={{ border: '2px solid #00b894' }} />
                                                <button type="button" onClick={() => removeNew(i)} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: '#ff4757', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {totalImages < 5 && (
                                <label className="create-upload-btn">
                                    📎 เพิ่มรูปจากเครื่อง
                                    <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={handleImageSelect} style={{ display: 'none' }} />
                                </label>
                            )}
                        </div>
                        <button type="submit" className="create-submit-btn" disabled={loading}>
                            {loading ? 'กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default EditCampaign;
