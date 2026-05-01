import React from 'react';
import { CATEGORIES } from '../constants/categories';

//component declaration
function CategoryLegend({ selectedCategory, setSelectedCategory, fgRef }) {
    const handleClick = (name) => {
        if (selectedCategory === name) {
            setSelectedCategory('');
            if (fgRef?.current) fgRef.current.zoomToFit(1000, 50);
        } else {
            setSelectedCategory(name);
        }
    };

    return (
        <div className="color-legend-section">
            // Header with icon and title
            <div className="legend-header">
                <i className="fi fi-rr-palette"></i>
                <span>คำอธิบายสี (Color Legend)</span>
                <small>คลิกเพื่อกรองตามหมวดหมู่</small>
            </div>

            <div className="legend-grid">
                {CATEGORIES.map((cat, i) => (
                    <div key={i} className="legend-item"
                        onClick={() => handleClick(cat.name)}
                        style={{ 
                            opacity: selectedCategory && selectedCategory !== cat.name ? 0.4 : 1, 
                            cursor: 'pointer', 
                            transition: 'all 0.3s ease' 
                        }}
                    >
                        <div className="legend-color-box" style={{
                            background: cat.color,
                            boxShadow: selectedCategory === cat.name ? `0 0 12px ${cat.color}80` : 'none',
                            transform: selectedCategory === cat.name ? 'scale(1.2)' : 'scale(1)',
                            transition: 'all 0.3s ease',
                            border: selectedCategory === cat.name ? `2px solid ${cat.color}` : '2px solid transparent'
                        }} />
                        <span className="legend-label" style={{ fontWeight: selectedCategory === cat.name ? '600' : '400' }}>
                            {cat.name}
                        </span>
                    </div>
                ))}
                <div className="legend-item"
                    onClick={() => { setSelectedCategory(''); if (fgRef?.current) fgRef.current.zoomToFit(1000, 50); }}
                    style={{ opacity: selectedCategory === '' ? 1 : 0.4, cursor: 'pointer', transition: 'all 0.3s ease' }}
                >
                    <div className="legend-color-box" style={{
                        background: '#96c5b9',
                        boxShadow: selectedCategory === '' ? '0 0 12px #2d2d3680' : 'none',
                        transform: selectedCategory === '' ? 'scale(1.2)' : 'scale(1)',
                        transition: 'all 0.3s ease',
                        border: selectedCategory === '' ? '2px solid #96C1C5' : '2px solid transparent'
                    }} />
                    <span className="legend-label" style={{ fontWeight: selectedCategory === '' ? '600' : '400' }}>All Categories</span>
                </div>
            </div>
        </div>
    );
}

export default CategoryLegend;
