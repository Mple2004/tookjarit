// Analysis/tiktok/TikTokAnalysis.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import * as d3 from 'd3';

import { useGraphData } from './useGraphData';
import { useHighlight } from '../hooks/useHighlight';
import { useAvatarCache } from '../hooks/useAvatarCache';
import NodePopupCard from './NodePopupCard';
import FilterToolbar from '../components/FilterToolbar';
import LoadingOverlay from '../../LoadingOverlay';
import { CATEGORIES, CATEGORY_COLOR_MAP } from '../constants/categories';

const API = 'http://localhost:5000';
const PLATFORM_COLOR = '#1a1a2e';

// ─── Node Helpers ─────────────────────────────────────────────────────────────
function getNodeColor(node) {
    if (node.type === 'Influencer') return '#2d3436';
    return CATEGORY_COLOR_MAP[node.category] || '#BDC3C7';
}
function getNodeSize(node) {
    if (node.type === 'Brand') return 30;
    if (!node.followers) return 25;
    return Math.min(Math.max(Math.log(node.followers) * 4 + 10, 25), 80);
}

// ─── Raw Score (Weighted Engagement) ─────────────────────────────────────────
function calcRawScore(link) {
    return (
        (link.totalViews || 0) * 0.1 +
        (link.totalLikes || 0) * 0.4 +
        (link.totalComments || 0) * 0.3 +
        (link.totalShares || 0) * 0.2
    );
}

// ─── Per-Brand Normalized Rating /10 ─────────────────────────────────────────
function calcRating(link, allLinks) {
    const brandId = typeof link.target === 'object' ? link.target.id : link.target;
    const sameBrand = allLinks.filter(l => {
        if (l.isPhantom) return false;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return t === brandId;
    });
    const maxRaw = Math.max(...sameBrand.map(calcRawScore), 1);
    return (calcRawScore(link) / maxRaw) * 10;
}

// ─── Link Width (based on raw score, global scale) ───────────────────────────
function getLinkWidth(link, allLinks) {
    if (link.isPhantom) return 0;
    if (!allLinks || allLinks.length === 0) return 1.5;
    const rating = calcRating(link, allLinks);
    return 1.5 + (rating / 10) * 6.5;
}

function fmtNum(n) {
    if (!n || n === 0) return '-';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
}

function getTier(followers) {
    if (!followers) return { label: 'Unknown', color: '#b2bec3' };
    if (followers >= 1_000_000) return { label: '👑 Mega', color: '#6c5ce7' };
    if (followers >= 100_000) return { label: '🔥 Macro', color: '#e17055' };
    if (followers >= 50_000) return { label: '⚡ Mid-Tier', color: '#f39c12' };
    if (followers >= 10_000) return { label: '✨ Micro', color: '#00b894' };
    if (followers >= 1_000) return { label: '🌱 Nano', color: '#74b9ff' };
    return { label: '🔰 New', color: '#b2bec3' };
}

// ─── Link Tooltip ─────────────────────────────────────────────────────────────
function LinkTooltip({ link, pos, allLinks }) {
    if (!link || !pos) return null;

    const followers = typeof link.source === 'object' ? link.source.followers : 0;
    const tier = getTier(followers);
    const rating = calcRating(link, allLinks);
    const brandName = typeof link.target === 'object' ? link.target.name : link.target;
    const infName = typeof link.source === 'object' ? link.source.name : link.source;
    const engage = (link.totalLikes || 0) + (link.totalComments || 0);

    const ratingColor = rating >= 7.5 ? '#00b894'
        : rating >= 5 ? '#f39c12'
            : '#e17055';

    return (
        <div style={{
            position: 'absolute',
            left: pos.x + 16,
            top: pos.y - 10,
            background: 'rgba(15,15,25,0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14,
            padding: '10px 14px',
            minWidth: 175,
            pointerEvents: 'none',
            zIndex: 99999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            fontFamily: "'Prompt', sans-serif",
            animation: 'tooltipIn 0.15s ease',
        }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8, whiteSpace: 'nowrap' }}>
                @{infName}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>🛍️ Brand</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{brandName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>⭐ Rating</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: ratingColor }}>
                    {rating.toFixed(1)} / 10
                </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>👁️ Views</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{fmtNum(link.totalViews)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>❤️ Engage</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{fmtNum(engage)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 0 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>🎖️ Tier</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: tier.color }}>{tier.label}</span>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function TikTokAnalysis() {
    const location = useLocation();
    const navigate = useNavigate();

    const fgRef = useRef();
    const containerRef = useRef();

    const { data, isLoading, loadGraphData, searchTikTok } = useGraphData();
    const { highlightNodes, highlightLinks, hoverNode, setHoverNode, updateHighlights, clearHighlights } = useHighlight(data.links);
    const { imgCache, loadAvatarForNode } = useAvatarCache(fgRef);

    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [selectedNode, setSelectedNode] = useState(null);
    const [globalSearch, setGlobalSearch] = useState('');
    const [localFilter, setLocalFilter] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    const [hoverLink, setHoverLink] = useState(null);
    const [linkTooltipPos, setLinkTooltipPos] = useState(null);

    const [favorites, setFavorites] = useState(new Set());
    const [favLoading, setFavLoading] = useState(false);

    const [konamiProgress, setKonamiProgress] = useState(0);
    const [easterEggActive, setEasterEggActive] = useState(false);
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

    useEffect(() => { loadGraphData(); }, [loadGraphData]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        fetch(`${API}/api/favorites`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => { if (d.favorites) setFavorites(new Set(d.favorites.map(f => f.influencerName))); })
            .catch(() => { });
    }, []);

    const handleToggleFavorite = async (influencerName) => {
        const token = localStorage.getItem('token');
        if (!token) { alert('กรุณาเข้าสู่ระบบก่อน'); return; }
        setFavLoading(true);
        try {
            const res = await fetch(`${API}/api/favorites/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ influencerName, platform: 'tiktok' }),
            });
            const d = await res.json();
            setFavorites(prev => {
                const next = new Set(prev);
                d.favorited ? next.add(influencerName) : next.delete(influencerName);
                return next;
            });
        } catch { alert('เกิดข้อผิดพลาด'); }
        finally { setFavLoading(false); }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            const newProg = e.key === konamiCode[konamiProgress] ? konamiProgress + 1 : 0;
            setKonamiProgress(newProg);
            if (newProg === konamiCode.length) {
                setEasterEggActive(true); setKonamiProgress(0);
                setTimeout(() => setEasterEggActive(false), 5000);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [konamiProgress]);

    // ── Physics ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!fgRef.current) return;
        fgRef.current.d3Force('charge', d3.forceManyBody().strength(-300));
        fgRef.current.d3Force('collide', d3.forceCollide().radius(n => getNodeSize(n) + 15).iterations(3));
        fgRef.current.d3Force('link').distance(l => l.isPhantom ? 50 : 150);
        fgRef.current.d3ReheatSimulation();
    }, [data, dimensions]);

    // ── Resize ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const update = () => {
            if (isFullScreen) {
                setDimensions({ width: window.innerWidth, height: window.innerHeight });
            } else if (containerRef.current) {
                setDimensions({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
            }
        };
        const resizeTimer = setTimeout(update, 150);
        window.addEventListener('resize', update);
        return () => {
            clearTimeout(resizeTimer);
            window.removeEventListener('resize', update);
        };
    }, [isFullScreen]);

    // ── ✅ FIX: Auto Zoom Fit — เช็ค fgRef ข้างใน setTimeout + cleanup ───
    useEffect(() => {
        const timer = setTimeout(() => {
            if (fgRef.current) fgRef.current.zoomToFit(1000, 50);
        }, 800);
        return () => clearTimeout(timer);
    }, [data]);

    // ── ✅ FIX: Zoom to Category — รวมเป็นอันเดียว + cleanup ──────────────
    useEffect(() => {
        if (!selectedCategory || !fgRef.current || !data.nodes.length) return;
        const catNodes = data.nodes.filter(node => {
            if (node.category === selectedCategory) return true;
            if (node.type === 'Influencer') {
                return data.links.some(l => {
                    const src = typeof l.source === 'object' ? l.source : data.nodes.find(n => n.id === l.source);
                    const tgt = typeof l.target === 'object' ? l.target : data.nodes.find(n => n.id === l.target);
                    return (src?.id === node.id && tgt?.category === selectedCategory) ||
                        (tgt?.id === node.id && src?.category === selectedCategory);
                });
            }
            return false;
        });
        if (!catNodes.length) return;
        const avgX = catNodes.reduce((s, n) => s + (n.x || 0), 0) / catNodes.length;
        const avgY = catNodes.reduce((s, n) => s + (n.y || 0), 0) / catNodes.length;
        let maxD = 0;
        catNodes.forEach(n => { const d = Math.sqrt((n.x - avgX) ** 2 + (n.y - avgY) ** 2); if (d > maxD) maxD = d; });
        const timer = setTimeout(() => {
            if (fgRef.current) {
                fgRef.current.centerAt(avgX, avgY, 1000);
                fgRef.current.zoom(Math.min(3, Math.max(1.2, 400 / (maxD + 100))), 400);
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [selectedCategory, data]);

    // ── ✅ FIX: Highlight from URL — เช็ค fgRef ข้างใน setTimeout ──────────
    useEffect(() => {
        const name = new URLSearchParams(location.search).get('highlight');
        if (!name || !data.nodes.length || !fgRef.current) return;
        const target = data.nodes.find(n => n.name === name);
        if (!target) return;
        setLocalFilter(name); setSelectedNode(target); setHoverNode(target); updateHighlights(target);
        const timer = setTimeout(() => {
            if (fgRef.current && target.x != null) {
                fgRef.current.centerAt(target.x, target.y, 1000);
                fgRef.current.zoom(2, 900);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [location.search, data.nodes]);

    // ── Local Filter ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!localFilter.trim()) { if (!selectedNode) clearHighlights(); return; }

        const directMatch = data.nodes.find(n =>
            n.name.toLowerCase().includes(localFilter.toLowerCase())
        );

        if (directMatch && fgRef.current) {
            setHoverNode(directMatch);
            updateHighlights(directMatch);
            fgRef.current.centerAt(directMatch.x, directMatch.y, 1000);
            fgRef.current.zoom(3, 1000);
            return;
        }

        const relatedNodeIds = new Set();
        data.links.forEach(link => {
            const src = typeof link.source === 'object' ? link.source : data.nodes.find(n => n.id === link.source);
            const tgt = typeof link.target === 'object' ? link.target : data.nodes.find(n => n.id === link.target);
            if (!src || !tgt) return;

            const brandNode = tgt.type === 'Brand' ? tgt : src.type === 'Brand' ? src : null;
            const infNode = src.type === 'Influencer' ? src : tgt.type === 'Influencer' ? tgt : null;

            if (brandNode && brandNode.category?.toLowerCase().includes(localFilter.toLowerCase())) {
                relatedNodeIds.add(brandNode.id);
                if (infNode) relatedNodeIds.add(infNode.id);
            }
        });

        if (relatedNodeIds.size > 0 && fgRef.current) {
            const relatedNodes = data.nodes.filter(n => relatedNodeIds.has(n.id));
            const avgX = relatedNodes.reduce((s, n) => s + (n.x || 0), 0) / relatedNodes.length;
            const avgY = relatedNodes.reduce((s, n) => s + (n.y || 0), 0) / relatedNodes.length;
            updateHighlights({ id: null, _relatedIds: relatedNodeIds });
            fgRef.current.centerAt(avgX, avgY, 1000);
            fgRef.current.zoom(1.5, 1000);
        }
    }, [localFilter, data.nodes, data.links]);

    // ── Hover Node ────────────────────────────────────────────────────────
    const handleNodeHover = useCallback((node, prevNode, event) => {
        if (selectedNode || localFilter) return;
        setHoverNode(node || null);
        updateHighlights(node);
        setHoverLink(null);
        setLinkTooltipPos(null);
    }, [selectedNode, localFilter, updateHighlights]);

    // ── Hover Link ────────────────────────────────────────────────────────
    const handleLinkHover = useCallback((link, prevLink, event) => {
        if (link && !link.isPhantom) {
            setHoverLink(link);
            if (event) {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) setLinkTooltipPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
            }
        } else {
            setHoverLink(null);
            setLinkTooltipPos(null);
        }
    }, []);

    // ── Mouse Move — follow cursor ────────────────────────────────────────
    useEffect(() => {
        const canvas = containerRef.current?.querySelector('canvas');
        if (!canvas) return;
        const onMove = (e) => {
            if (!hoverLink) return;
            const rect = containerRef.current.getBoundingClientRect();
            setLinkTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        };
        canvas.addEventListener('mousemove', onMove);
        return () => canvas.removeEventListener('mousemove', onMove);
    }, [hoverLink]);

    // ── ✅ FIX: Node Click — เช็ค fgRef ก่อนเรียก ────────────────────────
    const handleNodeClick = (node) => {
        const n = node === selectedNode ? null : node;
        setSelectedNode(n); setHoverNode(n); updateHighlights(n); setLocalFilter('');
        setHoverLink(null); setLinkTooltipPos(null);
        if (fgRef.current) {
            if (n) { fgRef.current.centerAt(node.x, node.y, 1000); fgRef.current.zoom(1.75, 1000); }
            else fgRef.current.zoomToFit(1000, 50);
        }
    };

    // ── ✅ FIX: Background Click — เช็ค fgRef ก่อนเรียก ──────────────────
    const handleBackgroundClick = () => {
        setSelectedNode(null); setLocalFilter('');
        clearHighlights();
        setHoverLink(null); setLinkTooltipPos(null);
        if (fgRef.current) fgRef.current.zoomToFit(1000);
    };

    // ── Paint Node ────────────────────────────────────────────────────────
    const paintNode = useCallback((node, ctx, globalScale) => {
        const isHover = hoverNode === node;
        const isSelected = selectedNode === node;
        const isNeighbor = highlightNodes.has(node.id);
        const isInf = node.type === 'Influencer';
        const radius = getNodeSize(node);
        const color = getNodeColor(node);

        let alpha = 1;
        if (selectedCategory) {
            const match = node.category === selectedCategory ||
                (isInf && data.links.some(l =>
                    (l.source?.id === node.id || l.target?.id === node.id) &&
                    (l.source?.category === selectedCategory || l.target?.category === selectedCategory)
                ));
            alpha = match ? 1 : 0.1;
        } else if (hoverNode || selectedNode || localFilter) {
            alpha = (isHover || isSelected || isNeighbor) ? 1 : 0.1;
        }
        ctx.globalAlpha = alpha;

        if (easterEggActive && isInf) {
            ctx.shadowBlur = Math.sin(Date.now() / 200) * 10 + 10;
            ctx.shadowColor = '#ff00ff';
        }

        ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff'; ctx.fill();

        if (isInf) {
            const cached = imgCache.current[node.name];
            if (cached?.complete && cached.naturalHeight !== 0) {
                ctx.save();
                ctx.beginPath(); ctx.arc(node.x, node.y, radius - 2, 0, 2 * Math.PI); ctx.clip();
                ctx.drawImage(cached, node.x - radius, node.y - radius, radius * 2, radius * 2);
                ctx.restore();
            } else {
                ctx.fillStyle = '#dfe6e9';
                ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI); ctx.fill();
                ctx.fillStyle = '#2d3436';
                ctx.font = `bold ${radius * 0.6}px Arial`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(node.name.charAt(0).toUpperCase(), node.x, node.y);
                loadAvatarForNode(node);
            }
        } else {
            ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = color; ctx.fill();
        }

        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = (isHover || isSelected) ? '#ff5757' : (isInf ? '#b2bec3' : '#fff');
        ctx.lineWidth = (isHover || isSelected) ? 4 : 2;
        ctx.stroke();

        const fs = (isInf ? 14 : 12) / globalScale;
        if (globalScale > 0.8 || isHover || isSelected || (isInf && node.followers > 500000)) {
            ctx.font = `${isHover ? 'bold ' : ''}${fs}px Prompt, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const ly = node.y + radius + 10;
            ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.strokeText(node.name, node.x, ly);
            ctx.fillStyle = '#2d3436'; ctx.fillText(node.name, node.x, ly);
        }
        ctx.globalAlpha = 1;
    }, [hoverNode, selectedNode, highlightNodes, selectedCategory, data.links,
        localFilter, easterEggActive, loadAvatarForNode, imgCache]);

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="analysis-page">
            <style>{`@keyframes tooltipIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }`}</style>
            <LoadingOverlay isLoading={isLoading} platform="tiktok" />

            <div className="analysis-header-container">
                <button className="back-to-platform-btn" onClick={() => navigate('/analysis')}>← เลือก Platform</button>
                <div className="platform-badge-display" style={{ background: PLATFORM_COLOR }}>🎵 TikTok</div>
                <div className="search-bar-wrapper">
                    <i className="fi fi-br-search search-icon" />
                    <input
                        type="text"
                        placeholder="ค้นหา #Hashtag หรือ @username บน TikTok"
                        className="search-input-top"
                        value={globalSearch}
                        onChange={e => setGlobalSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && searchTikTok(globalSearch).then(() => setGlobalSearch(''))}
                    />
                </div>
                <button className="analyze-btn-small" style={{ background: PLATFORM_COLOR }}
                    onClick={() => searchTikTok(globalSearch).then(() => setGlobalSearch(''))} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'ค้นหา'}
                </button>
            </div>

            <div className="analysis-content">
                <div className="legend-section">
                    <div className="legend-title">🎨 COLOR LEGEND — คลิกเพื่อกรอง</div>
                    <div className="legend-pills">
                        <div className={`legend-pill ${selectedCategory === '' ? 'selected' : ''}`}
                            onClick={() => { setSelectedCategory(''); if (fgRef.current) fgRef.current.zoomToFit(1000, 50); }}>
                            <div className="legend-dot" style={{ background: '#f0f0f0', border: '1.5px solid #ccc' }} />
                            All
                        </div>
                        {CATEGORIES.map((cat, i) => (
                            <div key={i}
                                className={`legend-pill ${selectedCategory === cat.name ? 'selected' : ''}`}
                                onClick={() => {
                                    setSelectedCategory(prev => prev === cat.name ? '' : cat.name);
                                    if (selectedCategory === cat.name && fgRef.current) fgRef.current.zoomToFit(1000, 50);
                                }}>
                                <div className="legend-dot" style={{ background: cat.color }} />
                                {cat.name}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="graph-wrapper">
                    <FilterToolbar
                        localFilter={localFilter}
                        setLocalFilter={setLocalFilter}
                        onRefresh={() => { loadGraphData(); setLocalFilter(''); setSelectedCategory(''); }}
                        platform="tiktok"
                        onSelectCategory={(cat) => {
                            setSelectedCategory(cat);
                            setLocalFilter('');
                        }}
                    />

                    <div className="graph-outer">
                        <NodePopupCard
                            node={selectedNode}
                            imgCache={imgCache}
                            favorites={favorites}
                            favLoading={favLoading}
                            onClose={handleBackgroundClick}
                            onToggleFavorite={handleToggleFavorite}
                        />

                        <div ref={containerRef}
                            className={`graph-container ${isFullScreen ? 'fullscreen' : ''}`}
                            style={{
                                position: isFullScreen ? 'fixed' : 'relative',
                                top: 0, left: 0,
                                width: isFullScreen ? '100vw' : '100%',
                                zIndex: isFullScreen ? 99999 : 1,
                                backgroundColor: '#f8f9fa',
                            }}
                        >
                            <button className="fullscreen-btn" onClick={() => setIsFullScreen(!isFullScreen)}>
                                {isFullScreen ? '✖️' : '⤢'}
                            </button>

                            <LinkTooltip link={hoverLink} pos={linkTooltipPos} allLinks={data.links} />

                            <ForceGraph2D
                                ref={fgRef}
                                graphData={data}
                                width={dimensions.width}
                                height={dimensions.height}
                                backgroundColor="#e6e6e6"
                                linkColor={link => {
                                    if (link.isPhantom) return 'rgba(0,0,0,0)';
                                    if (!hoverNode && !selectedNode && !localFilter && !selectedCategory) return 'rgba(66,66,66,0.3)';
                                    if (selectedCategory) return (link.source?.category === selectedCategory || link.target?.category === selectedCategory) ? '#a5a5a5' : 'rgba(200,200,200,0.1)';
                                    return highlightLinks.has(link) ? '#333' : 'rgba(200,200,200,0.1)';
                                }}
                                linkWidth={link => {
                                    if (link.isPhantom) return 0;
                                    const width = getLinkWidth(link, data.links);
                                    return isNaN(width) ? 1.5 : Math.min(width, 8);
                                }}
                                linkHoverPrecision={8}
                                nodeCanvasObject={paintNode}
                                nodePointerAreaPaint={(node, color, ctx) => {
                                    ctx.fillStyle = color;
                                    ctx.beginPath(); ctx.arc(node.x, node.y, getNodeSize(node) + 5, 0, 2 * Math.PI); ctx.fill();
                                }}
                                onNodeHover={handleNodeHover}
                                onNodeClick={handleNodeClick}
                                onLinkHover={(link, prevLink, event) => handleLinkHover(link, prevLink, event)}
                                onBackgroundClick={handleBackgroundClick}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TikTokAnalysis;