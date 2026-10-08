import React from 'react';

interface GaiolaLogoProps {
  className?: string;
  size?: number;
  color?: string;
  showChain?: boolean;
}

export const GaiolaLogo: React.FC<GaiolaLogoProps> = ({
  className = 'w-8 h-8',
  size,
  color = 'currentColor',
  showChain = true,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={showChain ? '0 0 200 320' : '30 95 140 200'}
      className={className}
      style={size ? { width: size, height: size } : undefined}
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Gaiola 802 Logo"
    >
      {/* 1. Chain with beads (hanging cord) */}
      {showChain && (
        <g fill={color} stroke="none">
          <circle cx="100" cy="8" r="3" />
          <circle cx="100" cy="18" r="3" />
          <circle cx="100" cy="28" r="3" />
          <circle cx="100" cy="38" r="3" />
          <circle cx="100" cy="48" r="3" />
          <circle cx="100" cy="58" r="3" />
          <circle cx="100" cy="68" r="3" />
          <circle cx="100" cy="78" r="3" />
          <circle cx="100" cy="88" r="3" />
          <circle cx="100" cy="98" r="3" />
        </g>
      )}

      {/* 2. Top connecting ring */}
      <circle
        cx="100"
        cy={showChain ? '110' : '110'}
        r="8"
        strokeWidth="3.5"
        fill="none"
      />

      {/* 3. Cage finial cap */}
      <path
        d="M 94 125 C 94 119 106 119 106 125 Z"
        fill={color}
        stroke={color}
        strokeWidth="1.5"
      />

      {/* 4. Cage Outer Bell-shaped Frame */}
      {/* Left side */}
      <path
        d="M 100 125 C 92 142 66 160 52 184 C 44 198 46 222 51 252 C 54 266 56 276 58 284"
        strokeWidth="4"
        fill="none"
      />
      {/* Right side */}
      <path
        d="M 100 125 C 108 142 134 160 148 184 C 156 198 154 222 149 252 C 146 266 144 276 142 284"
        strokeWidth="4"
        fill="none"
      />

      {/* 5. Cage Base */}
      <path
        d="M 54 284 L 146 284 L 149 294 L 51 294 Z"
        fill={color}
        stroke={color}
        strokeWidth="2"
      />

      {/* 6. Horizontal Perches / Crossbars */}
      {/* Top Crossbar */}
      <line
        x1="52"
        y1="190"
        x2="148"
        y2="190"
        strokeWidth="3.5"
      />
      {/* Bottom Crossbar */}
      <line
        x1="53"
        y1="238"
        x2="147"
        y2="238"
        strokeWidth="3.5"
      />

      {/* 7. Vertical Bars (following cage contour) */}
      {/* Center bar */}
      <line x1="100" y1="125" x2="100" y2="284" strokeWidth="2.5" />

      {/* Inner-left bar */}
      <path
        d="M 87 137 C 86 160 84 210 85 284"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Outer-left bar */}
      <path
        d="M 72 154 C 71 180 70 220 72 284"
        strokeWidth="2.5"
        fill="none"
      />

      {/* Inner-right bar */}
      <path
        d="M 113 137 C 114 160 116 210 115 284"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Outer-right bar */}
      <path
        d="M 128 154 C 129 180 130 220 128 284"
        strokeWidth="2.5"
        fill="none"
      />

      {/* 8. Bird 1 (Upper right, perched on top crossbar at Y=190, looking left) */}
      <g fill={color} stroke="none">
        {/* Upper bird body silhouette */}
        <path
          d="M 132 172
             C 126 172, 120 176, 118 181
             C 116 183, 113 184, 111 185
             C 114 187, 117 188, 119 190
             C 122 195, 127 197, 134 195
             C 137 194, 140 197, 142 201
             C 142 196, 140 191, 139 187
             C 138 180, 136 172, 132 172 Z"
        />
        {/* Upper bird head & beak pointing left */}
        <ellipse cx="123" cy="178" rx="5" ry="4.5" />
        <polygon points="119,177 114,179 119,181" />
        {/* Tail below bar */}
        <path d="M 135 192 L 143 203 L 138 202 Z" />
      </g>

      {/* 9. Bird 2 (Lower left, perched on bottom crossbar at Y=238, looking right) */}
      <g fill={color} stroke="none">
        {/* Lower bird body silhouette */}
        <path
          d="M 82 222
             C 89 222, 96 226, 98 231
             C 101 233, 104 234, 107 235
             C 104 237, 101 238, 98 240
             C 95 244, 88 246, 81 245
             C 77 244, 73 248, 70 254
             C 71 248, 73 243, 74 239
             C 76 230, 78 222, 82 222 Z"
        />
        {/* Lower bird head & beak pointing right */}
        <ellipse cx="93" cy="227" rx="5.5" ry="5" />
        <polygon points="98,225 104,228 98,230" />
        {/* Tail below bar */}
        <path d="M 77 241 L 69 253 L 74 251 Z" />
      </g>
    </svg>
  );
};
