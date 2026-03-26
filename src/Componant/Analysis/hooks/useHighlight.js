import { useState, useCallback } from 'react';

export function useHighlight(links) {
    const [highlightNodes, setHighlightNodes] = useState(new Set());
    const [highlightLinks, setHighlightLinks] = useState(new Set());
    const [hoverNode, setHoverNode]           = useState(null);

    const updateHighlights = useCallback((node) => {
        const hNodes = new Set();
        const hLinks = new Set();
        if (node) {
            hNodes.add(node.id);
            links.forEach(link => {
                if (link.isPhantom) return;
                const s = typeof link.source === 'object' ? link.source.id : link.source;
                const t = typeof link.target === 'object' ? link.target.id : link.target;
                if (s === node.id || t === node.id) {
                    hLinks.add(link);
                    hNodes.add(s);
                    hNodes.add(t);
                }
            });
        }
        setHighlightNodes(hNodes);
        setHighlightLinks(hLinks);
    }, [links]);

    const clearHighlights = useCallback(() => {
        setHighlightNodes(new Set());
        setHighlightLinks(new Set());
        setHoverNode(null);
    }, []);

    return { highlightNodes, highlightLinks, hoverNode, setHoverNode, updateHighlights, clearHighlights };
}
