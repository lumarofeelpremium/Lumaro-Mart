import React from 'react';

interface GroceryTrolleyFooterProps {
  className?: string;
}

export const GroceryTrolleyFooter: React.FC<GroceryTrolleyFooterProps> = ({
  className = ''
}) => {
  return (
    <div 
      className={`relative w-full overflow-hidden flex justify-center items-end pointer-events-none select-none -mt-3 mb-0 ${className}`}
      style={{ height: '115px' }}
      aria-hidden="true"
    >
      {/* Soft Ambient Radial Mint Glow */}
      <div className="absolute bottom-0 w-84 h-28 bg-emerald-100/35 rounded-full blur-2xl pointer-events-none -z-10" />

      {/* Fresh Grocery Market Basket Watermark */}
      {/* Top half is fully visible & beautiful; Bottom is cleanly sliced flat as if cut by the page edge */}
      <div className="relative w-72 sm:w-80 max-w-[90vw] translate-y-6 transition-opacity duration-300 opacity-40 hover:opacity-55">
        <svg
          viewBox="0 0 280 185"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto drop-shadow-sm"
        >
          <defs>
            {/* Clean bottom cut mask - like page cleanly cut off */}
            <clipPath id="pageBottomCut">
              <rect x="0" y="0" width="280" height="175" />
            </clipPath>

            {/* Rich Gradients */}
            <linearGradient id="basketWarm" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#059669" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>

            <linearGradient id="basketRib" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="50%" stopColor="#6EE7B7" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>

            <linearGradient id="basketRim" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#047857" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#065F46" />
            </linearGradient>

            <linearGradient id="handleMetal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#CBD5E1" />
              <stop offset="50%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>

            <linearGradient id="baguette" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="60%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#92400E" />
            </linearGradient>

            <linearGradient id="bottleGlass" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#E0F2FE" />
              <stop offset="50%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#BAE6FD" />
            </linearGradient>

            <linearGradient id="rubyApple" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F87171" />
              <stop offset="40%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#991B1B" />
            </linearGradient>

            <linearGradient id="sunOrange" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FED7AA" />
              <stop offset="40%" stopColor="#FB923C" />
              <stop offset="100%" stopColor="#C2410C" />
            </linearGradient>

            <linearGradient id="freshCarrot" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FB923C" />
              <stop offset="60%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#9A3412" />
            </linearGradient>

            <linearGradient id="leafyLush" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#86EFAC" />
              <stop offset="50%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#15803D" />
            </linearGradient>

            <linearGradient id="freshPepper" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4ADE80" />
              <stop offset="60%" stopColor="#16A34A" />
              <stop offset="100%" stopColor="#14532D" />
            </linearGradient>
          </defs>

          {/* Sliced Group - Cleaved cleanly at the bottom edge */}
          <g clipPath="url(#pageBottomCut)">
            {/* ========================================================== */}
            {/* 1. FRESH GROCERY PRODUCTS OVERFLOWING FROM BASKET */}
            {/* ========================================================== */}

            {/* Farm Fresh Milk / Juice Glass Bottle (Left Leaning) */}
            <g transform="translate(68, 20) rotate(-10)">
              {/* Bottle Body */}
              <rect x="0" y="24" width="28" height="60" rx="6" fill="url(#bottleGlass)" stroke="#93C5FD" strokeWidth="1.5" />
              {/* Milk Liquid inside */}
              <rect x="2" y="34" width="24" height="48" rx="4" fill="#FFFFFF" opacity="0.9" />
              {/* Bottle Shoulders & Neck */}
              <path d="M 0 26 Q 4 12 10 10 L 18 10 Q 24 12 28 26 Z" fill="url(#bottleGlass)" stroke="#93C5FD" strokeWidth="1.5" />
              <rect x="9" y="4" width="10" height="8" fill="url(#bottleGlass)" stroke="#93C5FD" strokeWidth="1.2" />
              {/* Emerald Cap */}
              <rect x="7" y="0" width="14" height="6" rx="2" fill="#059669" />
              {/* Organic Fresh Label */}
              <rect x="4" y="42" width="20" height="20" rx="3" fill="#ECFDF5" stroke="#10B981" strokeWidth="1" />
              <circle cx="14" cy="50" r="4" fill="#10B981" />
              <path d="M 12 50 L 13.5 52 L 16 48" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* Artisan French Baguette / Loaf (Center Tall) */}
            <g transform="translate(112, 10) rotate(8)">
              <rect x="0" y="0" width="24" height="85" rx="12" fill="url(#baguette)" stroke="#78350F" strokeWidth="1.5" />
              {/* Artisan Baker's Slashes with golden glow */}
              <path d="M 4 20 Q 12 16 20 22" stroke="#FEF3C7" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M 4 20 Q 12 16 20 22" stroke="#78350F" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
              <path d="M 4 36 Q 12 32 20 38" stroke="#FEF3C7" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M 4 36 Q 12 32 20 38" stroke="#78350F" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
              <path d="M 4 52 Q 12 48 20 54" stroke="#FEF3C7" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M 4 52 Q 12 48 20 54" stroke="#78350F" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
              <path d="M 5 68 Q 12 64 19 70" stroke="#FEF3C7" strokeWidth="2.5" strokeLinecap="round" />
            </g>

            {/* Fresh Celery / Herb Leaves Spray (Top Right) */}
            <g transform="translate(154, 18) rotate(15)">
              <path d="M 10 60 Q 28 28 42 12 Q 32 34 20 62" fill="url(#leafyLush)" stroke="#15803D" strokeWidth="1.5" />
              <path d="M 14 60 Q 24 20 18 4 Q 12 26 10 64" fill="url(#leafyLush)" stroke="#15803D" strokeWidth="1.5" />
              <path d="M 8 62 Q -4 34 8 18 Q 4 40 8 64" fill="url(#leafyLush)" stroke="#15803D" strokeWidth="1.5" />
              {/* Small Leaf Veins */}
              <path d="M 14 36 L 24 28" stroke="#15803D" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M 12 46 L 2 40" stroke="#15803D" strokeWidth="1.2" strokeLinecap="round" />
            </g>

            {/* Crisp Juicy Carrot with Bushy Green Leaves */}
            <g transform="translate(138, 38) rotate(32)">
              <polygon points="5,48 18,48 12,8" fill="url(#freshCarrot)" stroke="#9A3412" strokeWidth="1.5" />
              <line x1="8" y1="20" x2="13" y2="20" stroke="#7C2D12" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="9" y1="30" x2="15" y2="30" stroke="#7C2D12" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="7" y1="40" x2="14" y2="40" stroke="#7C2D12" strokeWidth="1.2" strokeLinecap="round" />
              {/* Feathery Top */}
              <path d="M 12 8 Q 8 -2 3 -8 Q 11 -1 12 8" fill="url(#leafyLush)" />
              <path d="M 12 8 Q 17 -4 23 -6 Q 16 1 12 8" fill="url(#leafyLush)" />
              <path d="M 12 8 Q 13 -6 11 -12 Q 10 -3 12 8" fill="url(#leafyLush)" />
            </g>

            {/* Farm Green Bell Pepper / Capsicum */}
            <g transform="translate(162, 60) rotate(-8)">
              <path d="M 14 12 C 6 12 2 20 2 30 C 2 42 12 48 20 48 C 28 48 38 42 38 30 C 38 20 34 12 26 12 C 22 12 20 16 20 16 C 20 16 18 12 14 12 Z" fill="url(#freshPepper)" stroke="#14532D" strokeWidth="1.5" />
              {/* Pepper Grooves */}
              <path d="M 14 14 Q 10 30 14 46" stroke="#15803D" strokeWidth="1.5" fill="none" opacity="0.6" />
              <path d="M 26 14 Q 30 30 26 46" stroke="#15803D" strokeWidth="1.5" fill="none" opacity="0.6" />
              {/* Stem */}
              <path d="M 20 14 Q 19 6 25 4 Q 24 10 20 14" fill="#14532D" stroke="#052E16" strokeWidth="1" />
              {/* Gloss Highlight */}
              <ellipse cx="10" cy="24" rx="3.5" ry="7" fill="#FFFFFF" opacity="0.45" transform="rotate(-15 10 24)" />
            </g>

            {/* Crisp Red Gala Apple */}
            <g transform="translate(62, 54)">
              <circle cx="20" cy="22" r="19" fill="url(#rubyApple)" stroke="#7F1D1D" strokeWidth="1.5" />
              {/* Apple Indent & Stem */}
              <path d="M 20 4 C 18 2 19 -2 24 -4" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />
              {/* Little Green Leaf */}
              <path d="M 21 4 Q 30 1 29 9 Q 23 7 21 4" fill="url(#leafyLush)" stroke="#15803D" strokeWidth="0.8" />
              {/* Apple Gloss crescent */}
              <ellipse cx="14" cy="16" rx="4.5" ry="7.5" fill="#FFFFFF" opacity="0.45" transform="rotate(-28 14 16)" />
            </g>

            {/* Sun-ripened Juicy Orange */}
            <g transform="translate(98, 62)">
              <circle cx="18" cy="18" r="18" fill="url(#sunOrange)" stroke="#9A3412" strokeWidth="1.5" />
              {/* Tiny orange blossom calyx */}
              <circle cx="18" cy="4" r="2" fill="#15803D" />
              {/* Orange Skin Texture */}
              <circle cx="13" cy="13" r="1" fill="#FFFFFF" opacity="0.5" />
              <circle cx="23" cy="15" r="1" fill="#FFFFFF" opacity="0.5" />
              <circle cx="18" cy="22" r="1" fill="#FFFFFF" opacity="0.4" />
              {/* Highlight */}
              <ellipse cx="12" cy="12" rx="4" ry="6" fill="#FFFFFF" opacity="0.4" transform="rotate(-30 12 12)" />
            </g>

            {/* Fresh Ripe Purple/Indigo Grapes cluster peek */}
            <g transform="translate(132, 70)">
              <circle cx="6" cy="12" r="6" fill="#7C3AED" stroke="#4C1D95" strokeWidth="1" />
              <circle cx="16" cy="10" r="6" fill="#8B5CF6" stroke="#4C1D95" strokeWidth="1" />
              <circle cx="11" cy="18" r="6" fill="#6D28D9" stroke="#4C1D95" strokeWidth="1" />
              <circle cx="21" cy="18" r="6" fill="#7C3AED" stroke="#4C1D95" strokeWidth="1" />
            </g>

            {/* ========================================================== */}
            {/* 2. CHIC CONTEMPORARY SHOPPING BASKET CONTAINER */}
            {/* ========================================================== */}

            {/* Overhead Arched Metallic / Emerald Handle */}
            <g>
              {/* Main Handle Arc */}
              <path
                d="M 52 92 C 52 38, 228 38, 228 92"
                stroke="url(#handleMetal)"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Ergonomic Comfort Handle Grip at Top */}
              <path
                d="M 112 43 C 122 40, 158 40, 168 43"
                stroke="#047857"
                strokeWidth="9"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 114 43 C 123 40.5, 157 40.5, 166 43"
                stroke="#10B981"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />
              {/* Handle Pivot Mounts on Basket Rim */}
              <circle cx="52" cy="92" r="5" fill="#334155" stroke="#CBD5E1" strokeWidth="1.5" />
              <circle cx="228" cy="92" r="5" fill="#334155" stroke="#CBD5E1" strokeWidth="1.5" />
            </g>

            {/* Basket Body (Flared Trapezoid Body, Cut Cleanly at Baseline Y=175) */}
            <path
              d="M 40 90 
                 L 240 90 
                 L 224 175 
                 L 56 175 
                 Z"
              fill="url(#basketWarm)"
              stroke="#064E3B"
              strokeWidth="3"
              strokeLinejoin="round"
            />

            {/* Basket Horizontal Molded Ribs (Modern Grooved Texture) */}
            <path d="M 43 104 L 237 104" stroke="url(#basketRib)" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
            <path d="M 46 118 L 234 118" stroke="url(#basketRib)" strokeWidth="3.2" strokeLinecap="round" opacity="0.85" />
            <path d="M 49 132 L 231 132" stroke="url(#basketRib)" strokeWidth="3.2" strokeLinecap="round" opacity="0.85" />
            <path d="M 52 146 L 228 146" stroke="url(#basketRib)" strokeWidth="3.2" strokeLinecap="round" opacity="0.85" />
            <path d="M 54 160 L 226 160" stroke="url(#basketRib)" strokeWidth="3.2" strokeLinecap="round" opacity="0.85" />
            <path d="M 55 170 L 225 170" stroke="url(#basketRib)" strokeWidth="3" strokeLinecap="round" opacity="0.75" />

            {/* Vertical Rib Accents / Weave Pillars */}
            <line x1="72" y1="92" x2="78" y2="175" stroke="#047857" strokeWidth="2.5" opacity="0.7" />
            <line x1="102" y1="92" x2="105" y2="175" stroke="#047857" strokeWidth="2.5" opacity="0.7" />
            <line x1="140" y1="92" x2="140" y2="175" stroke="#047857" strokeWidth="2.5" opacity="0.7" />
            <line x1="178" y1="92" x2="175" y2="175" stroke="#047857" strokeWidth="2.5" opacity="0.7" />
            <line x1="208" y1="92" x2="202" y2="175" stroke="#047857" strokeWidth="2.5" opacity="0.7" />

            {/* Sturdy Reinforced Upper Rim with Rounded Bumpers */}
            <path
              d="M 34 88 L 246 88 C 249 88, 250 93, 246 94 L 34 94 C 30 93, 31 88, 34 88 Z"
              fill="url(#basketRim)"
              stroke="#064E3B"
              strokeWidth="2.5"
            />
            {/* Top Rim Highlight */}
            <line x1="38" y1="90" x2="242" y2="90" stroke="#6EE7B7" strokeWidth="1.8" strokeLinecap="round" />

            {/* Lumaro Fresh Brand Badge Centered on Basket */}
            <g transform="translate(122, 108)">
              <rect x="0" y="0" width="36" height="22" rx="6" fill="#FFFFFF" opacity="0.95" stroke="#10B981" strokeWidth="1.5" />
              <path d="M 12 11 L 18 5 L 24 11 L 18 17 Z" fill="#10B981" />
              <circle cx="18" cy="11" r="2.5" fill="#FFFFFF" />
            </g>

            {/* Sparkles / Fresh Glow Accents */}
            <g transform="translate(236, 48)" opacity="0.8">
              <path d="M 5 0 L 6.5 3.5 L 10 5 L 6.5 6.5 L 5 10 L 3.5 6.5 L 0 5 L 3.5 3.5 Z" fill="#10B981" />
            </g>
            <g transform="translate(42, 38)" opacity="0.75">
              <path d="M 4 0 L 5 3 L 8 4 L 5 5 L 4 8 L 3 5 L 0 4 L 3 3 Z" fill="#34D399" />
            </g>
            <g transform="translate(196, 24)" opacity="0.7">
              <path d="M 3 0 L 4 2 L 6 3 L 4 4 L 3 6 L 2 4 L 0 3 L 2 2 Z" fill="#FBBF24" />
            </g>
          </g>

          {/* Clean Razor Cut Baseline Line (like page sliced through the bottom edge) */}
          <line
            x1="55"
            y1="174"
            x2="225"
            y2="174"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinecap="square"
            opacity="0.85"
          />
        </svg>
      </div>
    </div>
  );
};
