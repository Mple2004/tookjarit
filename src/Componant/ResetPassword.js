// Componant/ResetPassword.js
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL || '';

function ResetPassword() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password.length < 6) return setMsg('❌ รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
        if (password !== confirm) return setMsg('❌ รหัสผ่านไม่ตรงกัน');
        setLoading(true);
        setMsg('');
        try {
            const res = await fetch(`${API}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setMsg('✅ ' + data.message);
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            setMsg('❌ ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#f8f9fa', fontFamily: "'Prompt', sans-serif",
        }}>
            <div style={{
                background: '#fff', borderRadius: 20, padding: '40px 32px', maxWidth: 420, width: '90%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
            }}>
                <h2 style={{ margin: '0 0 8px', fontSize: 22, color: '#1a1a2e' }}>🔑 ตั้งรหัสผ่านใหม่</h2>
                <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>กรอกรหัสผ่านใหม่ที่ต้องการ</p>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
                            รหัสผ่านใหม่
                        </label>
                        <input
                            type="password"
                            placeholder="อย่างน้อย 6 ตัวอักษร"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: 12,
                                border: '1.5px solid #e0e0e0', fontSize: 14, boxSizing: 'border-box',
                                fontFamily: "'Prompt', sans-serif", outline: 'none',
                            }}
                            onFocus={e => (e.target.style.borderColor = '#ff4757')}
                            onBlur={e => (e.target.style.borderColor = '#e0e0e0')}
                        />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
                            ยืนยันรหัสผ่าน
                        </label>
                        <input
                            type="password"
                            placeholder="กรอกรหัสผ่านอีกครั้ง"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: 12,
                                border: '1.5px solid #e0e0e0', fontSize: 14, boxSizing: 'border-box',
                                fontFamily: "'Prompt', sans-serif", outline: 'none',
                            }}
                            onFocus={e => (e.target.style.borderColor = '#ff4757')}
                            onBlur={e => (e.target.style.borderColor = '#e0e0e0')}
                        />
                    </div>

                    {msg && (
                        <p style={{ fontSize: 13, margin: '0 0 12px', color: msg.startsWith('✅') ? '#00b894' : '#e74c3c' }}>
                            {msg}
                        </p>
                    )}

                    <button type="submit" disabled={loading} style={{
                        width: '100%', padding: '14px 0', borderRadius: 50, border: 'none',
                        background: '#ff4757', color: '#fff', fontSize: 15, fontWeight: 700,
                        cursor: 'pointer', fontFamily: "'Prompt', sans-serif",
                        opacity: loading ? 0.5 : 1,
                    }}>
                        {loading ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#999' }}>
                    <span onClick={() => navigate('/login')} style={{ color: '#ff4757', cursor: 'pointer', fontWeight: 600 }}>
                        ← กลับหน้าเข้าสู่ระบบ
                    </span>
                </p>
            </div>
        </div>
    );
}

export default ResetPassword;
