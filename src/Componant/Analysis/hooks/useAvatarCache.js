import { useRef, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || '';
const PLACEHOLDER = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

export function useAvatarCache(fgRef, platform = 'tiktok') {
    const imgCache = useRef({});
    const fetching = useRef({});

    const loadAvatarForNode = useCallback((node) => {
        const name = node.name;
        if (imgCache.current[name] || fetching.current[name]) return;
        fetching.current[name] = true;

        fetch(`${API}/api/avatar/${encodeURIComponent(name)}?platform=${platform}`)
            .then(r => r.json())
            .then(({ avatar }) => {
                const img = new Image();
                img.src = avatar || PLACEHOLDER;
                img.onload = () => {
                    imgCache.current[name] = img;
                    if (fgRef.current) {
                        fgRef.current.pauseAnimation();
                        fgRef.current.resumeAnimation();
                    }
                };
                img.onerror = () => {
                    const fallback = new Image();
                    fallback.src = PLACEHOLDER;
                    imgCache.current[name] = fallback;
                };
            })
            .catch(() => { fetching.current[name] = false; });
    }, [fgRef]);

    return { imgCache, loadAvatarForNode };
}
