// src/Componant/Analysis/components/ExportButton.js
import React, { useState } from 'react';
import ExportModal from './ExportModal';

function ExportButton({ currentPlatform }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                className="action-text"
                onClick={() => setOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Excel
            </button>

            <ExportModal
                isOpen={open}
                onClose={() => setOpen(false)}
                currentPlatform={currentPlatform}
            />
        </>
    );
}

export default ExportButton;
