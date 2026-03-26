// Componant/HowItWorks.js
import React, { useEffect, useRef } from 'react';

const STEPS = [
    {
        icon: '🔎',
        step: '1',
        title: 'ค้นหา',
        desc: 'พิมพ์ #hashtag หรือ @username บน TikTok หรือ YouTube ที่สนใจ',
    },
    {
        icon: '🕸️',
        step: '2',
        title: 'วิเคราะห์กราฟ',
        desc: 'ดูเครือข่ายความสัมพันธ์ระหว่าง Influencer กับแบรนด์แบบ visual',
    },
    {
        icon: '⭐',
        step: '3',
        title: 'บันทึก Favorite',
        desc: 'กด ⭐ เพื่อบันทึกอินฟูที่ถูกใจไว้ ดูได้ทุกเมื่อในหน้า Favorites',
    },
];

function HowItWorks() {
    const cardRefs = useRef([]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('hiw-card--visible');
                    }
                });
            },
            { threshold: 0.15 }
        );
        cardRefs.current.forEach((el) => { if (el) observer.observe(el); });
        return () => observer.disconnect();
    }, []);

    return (
        <section className="hiw">
            <div className="hiw__blob hiw__blob--tl" />
            <div className="hiw__blob hiw__blob--br" />

            <div className="hiw__inner">
                <h2 className="hiw__title">ใช้งานยังไง? 🤔</h2>
                <p className="hiw__sub">3 ขั้นตอนง่ายๆ ก็เจออินฟูในดวงใจแล้ว</p>

                <div className="hiw__grid">
                    {STEPS.map((s, i) => (
                        <div
                            key={s.step}
                            className="hiw-card"
                            ref={(el) => (cardRefs.current[i] = el)}
                        >
                            <div className="hiw-card__watermark">{s.step}</div>
                            <div className="hiw-card__icon">{s.icon}</div>
                            <h3 className="hiw-card__title">{s.title}</h3>
                            <p className="hiw-card__desc">{s.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default HowItWorks;
