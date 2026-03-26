export const CATEGORIES = [
    { name: 'Fashion',                color: '#FEF7C5' },
    { name: 'Beauty & Personal Care', color: '#ff6ba4' },
    { name: 'Health & Wellness',      color: '#3ad8ec' },
    { name: 'Food & Beverage',        color: '#F0816D' },
    { name: 'Mom & Kids',             color: '#F5D1EF' },
    { name: 'IT & Gadgets',           color: '#253A82' },
    { name: 'Home & Living',          color: '#ffc800' },
    { name: 'Toys & Collectibles',    color: '#BCD3F9' },
    { name: 'Pet',                    color: '#F5842B' },
    { name: 'Automotive',             color: '#234C58' },
    { name: 'Lifestyle',              color: '#3fc974' },
];

export const CATEGORY_COLOR_MAP = Object.fromEntries(
    CATEGORIES.map(c => [c.name, c.color])
);

export const FOLLOWER_TIERS = [
    { key: 'mega',  label: '1,000,000+',         emoji: '👑', min: 1_000_000, max: Infinity,   color: '#6c5ce7' },
    { key: 'macro', label: '100,000 – 1,000,000', emoji: '🔥', min: 100_000,   max: 999_999,    color: '#e17055' },
    { key: 'mid',   label: '50,000 – 100,000',    emoji: '⚡', min: 50_000,    max: 99_999,     color: '#f39c12' },
    { key: 'micro', label: '10,000 – 50,000',     emoji: '✨', min: 10_000,    max: 49_999,     color: '#00b894' },
    { key: 'nano',  label: '1,000 – 10,000',      emoji: '🌱', min: 1_000,     max: 9_999,      color: '#74b9ff' },
    { key: 'new',   label: 'ต่ำกว่า 1,000',        emoji: '🔰', min: 0,         max: 999,        color: '#b2bec3' },
];