// Componant/Analysis/index.js
import React from 'react';
import TikTokAnalysis from './tiktok/TikTokAnalysis';
import YoutubeAnalysis from './youtube/YoutubeAnalysis';
import './Analysis.css';

function Analysis({ platform }) {  // ← เปลี่ยนจาก useParams() มาเป็น prop
    if (platform === 'tiktok')  return <TikTokAnalysis />;
    if (platform === 'youtube') return <YoutubeAnalysis />;
    return null;
}

export default Analysis;
