// Componant/Login.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL || '';
const GOOGLE_CLIENT_ID = '218769002436-tec39cisqmk7n3r43nqq3ah9gokfid21.apps.googleusercontent.com';

function Login() {
    const [isLogin, setIsLogin]   = useState(true);
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [name, setName]         = useState('');
    const [loading, setLoading]   = useState(false);
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotMsg, setForgotMsg] = useState('');
    const navigate = useNavigate();

    // ✅ ใช้ ref เพื่อให้ Google SDK เรียก callback ล่าสุดเสมอ โดยไม่ต้อง re-initialize
    const handleGoogleResponseRef = useRef(null);
    handleGoogleResponseRef.current = async (response) => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            navigate('/');
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ✅ รันครั้งเดียว ไม่ initialize ซ้ำ
    useEffect(() => {
        if (window.__googleInitialized) return;

        const initGoogle = () => {
            if (!window.google || window.__googleInitialized) return;
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: (response) => handleGoogleResponseRef.current(response),
            });
            window.__googleInitialized = true;
            console.log('✅ Google initialized');
        };

        if (window.google) {
            initGoogle();
            return;
        }

        const existing = document.querySelector(
            'script[src="https://accounts.google.com/gsi/client"]'
        );
        if (existing) {
            existing.addEventListener('load', initGoogle);
            return () => existing.removeEventListener('load', initGoogle);
        }

        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initGoogle;
        document.head.appendChild(script);
    }, []);

    const handleGoogleClick = () => {
        if (window.google) {
            window.google.accounts.id.prompt();
        } else {
            alert('Google Sign-In ยังไม่พร้อม กรุณารอสักครู่');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) return alert('กรุณากรอกข้อมูลให้ครบ');
        setLoading(true);
        try {
            const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
            const body     = isLogin ? { email, password } : { name, email, password };
            const res = await fetch(`${API}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'เกิดข้อผิดพลาด');
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            navigate('/');
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!forgotEmail) return;
        setForgotLoading(true);
        setForgotMsg('');
        try {
            const res = await fetch(`${API}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setForgotMsg('✅ ' + data.message);
        } catch (err) {
            setForgotMsg('❌ ' + err.message);
        } finally {
            setForgotLoading(false);
        }
    };

    return (
        <div className="login-wrapper">
            {/* ── Form Side ── */}
            <div className="login-form-side">
                <div className="login-form-inner">
                    <h2 className="login-title">
                        {isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
                    </h2>
                    <p className="login-sub">
                        {isLogin ? 'ยินดีต้อนรับกลับมา!' : 'เริ่มต้นหา Influencer ที่ใช่วันนี้'}
                    </p>

                    <button
                        onClick={handleGoogleClick}
                        disabled={loading}
                        style={{
                            width: '100%', padding: '12px 0', borderRadius: 50,
                            border: '1.5px solid #e0e0e0', background: '#fff',
                            fontSize: 14, fontWeight: 600, cursor: 'pointer',
                            fontFamily: "'Prompt', sans-serif",
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                            marginBottom: 16, transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8f8f8'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                        <img
                            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                            alt="Google"
                            style={{ width: 20, height: 20 }}
                        />
                        {isLogin ? 'เข้าสู่ระบบด้วย Google' : 'สมัครด้วย Google'}
                    </button>

                    <div className="login-divider">
                        <span className="login-divider-text">หรือใช้อีเมล</span>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {!isLogin && (
                            <div className="login-field">
                                <label className="login-label">ชื่อ</label>
                                <input
                                    type="text"
                                    placeholder="ชื่อของคุณ"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="login-input"
                                    onFocus={e  => (e.target.style.borderColor = '#ff4757')}
                                    onBlur={e   => (e.target.style.borderColor = '#e0e0e0')}
                                />
                            </div>
                        )}

                        <div className="login-field">
                            <label className="login-label">อีเมล</label>
                            <input
                                type="email"
                                placeholder="example@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="login-input"
                                onFocus={e => (e.target.style.borderColor = '#ff4757')}
                                onBlur={e  => (e.target.style.borderColor = '#e0e0e0')}
                            />
                        </div>

                        <div className="login-field">
                            <label className="login-label">รหัสผ่าน</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="login-input"
                                onFocus={e => (e.target.style.borderColor = '#ff4757')}
                                onBlur={e  => (e.target.style.borderColor = '#e0e0e0')}
                            />
                        </div>

                        {isLogin && (
                            <p
                                onClick={() => { setShowForgot(true); setForgotMsg(''); setForgotEmail(email); }}
                                style={{ cursor: 'pointer', color: '#ff4757', fontSize: 13, textAlign: 'right', marginTop: 4 }}
                            >
                                ลืมรหัสผ่าน?
                            </p>
                        )}

                        <button type="submit" className="login-submit" disabled={loading}>
                            {loading ? '...' : isLogin ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
                        </button>
                    </form>

                    <p className="login-switch">
                        {isLogin ? 'ยังไม่มีบัญชี?' : 'มีบัญชีแล้ว?'}{' '}
                        <span className="login-switch-link" onClick={() => setIsLogin(!isLogin)}>
                            {isLogin ? 'สมัครเลย' : 'เข้าสู่ระบบ'}
                        </span>
                    </p>
                </div>
            </div>

            {/* ── Panel Side ── */}
            <div className="login-panel-side">
                <div className="login-panel-content">
                    <span className="login-panel-emoji">✨</span>
                    <h2 className="login-panel-title">
                        {isLogin ? 'สวัสดี, เพื่อน!' : 'ยินดีต้อนรับ!'}
                    </h2>
                    <p className="login-panel-sub">
                        {isLogin
                            ? 'ยังไม่มีบัญชี? สมัครเพื่อเข้าถึง Influencer ที่ #ถูกจริต กับแบรนด์ของคุณ'
                            : 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบเพื่อเริ่มใช้งานได้เลย'}
                    </p>
                    <button className="login-panel-btn" onClick={() => setIsLogin(!isLogin)}>
                        {isLogin ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
                    </button>
                </div>
                <div className="login-blob login-blob--1" />
                <div className="login-blob login-blob--2" />
            </div>

            {/* ── Forgot Password Modal ── */}
            {showForgot && (
                <div
                    onClick={() => setShowForgot(false)}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', zIndex: 99999,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: '#fff', borderRadius: 20, padding: '32px 28px',
                            maxWidth: 400, width: '90%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                            fontFamily: "'Prompt', sans-serif",
                        }}
                    >
                        <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#1a1a2e' }}>🔑 ลืมรหัสผ่าน</h3>
                        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
                            กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านให้
                        </p>
                        <input
                            type="email"
                            placeholder="example@email.com"
                            value={forgotEmail}
                            onChange={e => setForgotEmail(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: 12,
                                border: '1.5px solid #e0e0e0', fontSize: 14, marginBottom: 12,
                                boxSizing: 'border-box', fontFamily: "'Prompt', sans-serif", outline: 'none',
                            }}
                            onFocus={e => (e.target.style.borderColor = '#ff4757')}
                            onBlur={e  => (e.target.style.borderColor = '#e0e0e0')}
                        />
                        {forgotMsg && (
                            <p style={{
                                fontSize: 13, margin: '0 0 12px',
                                color: forgotMsg.startsWith('✅') ? '#00b894' : '#e74c3c',
                            }}>
                                {forgotMsg}
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={() => setShowForgot(false)}
                                style={{
                                    flex: 1, padding: '12px 0', borderRadius: 50,
                                    border: '1.5px solid #e0e0e0', background: '#fff',
                                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                                    fontFamily: "'Prompt', sans-serif",
                                }}
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleForgotPassword}
                                disabled={forgotLoading || !forgotEmail}
                                style={{
                                    flex: 1, padding: '12px 0', borderRadius: 50, border: 'none',
                                    background: '#ff4757', color: '#fff', fontSize: 14,
                                    fontWeight: 600, cursor: 'pointer',
                                    fontFamily: "'Prompt', sans-serif",
                                    opacity: forgotLoading || !forgotEmail ? 0.5 : 1,
                                }}
                            >
                                {forgotLoading ? 'กำลังส่ง...' : 'ส่งลิงก์'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Login;