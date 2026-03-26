// App.js — เพิ่ม routes Jobboard
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import './styles/global.css';
import './styles/components.css';
import ResetPassword from './Componant/ResetPassword';

import Navbar from './Componant/Nav';
import Search from './Componant/Search';
import HowItWorks from './Componant/HowItWorks';
import AnalysisHome from './Componant/AnalysisHome';
import Analysis from './Componant/Analysis';
import Favorites from './Componant/Favorites';
import Login from './Componant/Login';


// ── Jobboard ──
import Jobboard from './Componant/Jobboard';
import CreateCampaign from './Componant/Jobboard/CreateCampaign';
import CampaignDetail from './Componant/Jobboard/CampaignDetail';
import EditCampaign from './Componant/Jobboard/EditCampaign';
import MyCampaigns  from './Componant/Jobboard/MyCampaigns';

// ─── Home Page ────────────────────────────────
function HomePage() {
    return (
        <>
            <Search />
            <HowItWorks />
        </>
    );
}

// ─── App ──────────────────────────────────────
function App() {
    return (
        <Router>
            <Navbar />
            <Routes>
                <Route path="/"                    element={<HomePage />} />
                <Route path="/analysis"            element={<AnalysisHome />} />
                <Route path="/analysis/tiktok"     element={<Analysis platform="tiktok" />} />
                <Route path="/analysis/youtube"    element={<Analysis platform="youtube" />} />
                <Route path="/favorites"           element={<Favorites />} />
                <Route path="/login"               element={<Login />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />

                {/* ── Jobboard — specific routes ต้องอยู่ก่อน :id ── */}
                <Route path="/jobboard"              element={<Jobboard />} />
                <Route path="/jobboard/create"       element={<CreateCampaign />} />
                {/* ✅ เพิ่ม /jobboard/my และลบ /my-campaigns เก่าออก */}
                <Route path="/jobboard/my"           element={<MyCampaigns />} />
                {/* ⚠️ :id ต้องอยู่หลัง specific routes เสมอ */}
                <Route path="/jobboard/:id"          element={<CampaignDetail />} />
                <Route path="/jobboard/:id/edit"     element={<EditCampaign />} />
            </Routes>
        </Router>
    );
}

export default App;
