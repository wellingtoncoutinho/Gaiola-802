import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const svgGaiolaContent = (rounded = true, opaqueBg = true) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#243862" />
      <stop offset="100%" stop-color="#141F36" />
    </linearGradient>
    <radialGradient id="innerGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#1B2A4A" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Background -->
  ${opaqueBg ? `
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="url(#bgGrad)" />
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="url(#innerGlow)" />
  ${rounded ? '<rect x="4" y="4" width="504" height="504" rx="108" fill="none" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="4" />' : ''}
  ` : ''}

  <!-- Cage & Birds Group (centered at 256, 256, scaled 1.76) -->
  <g transform="translate(256, 256) scale(1.76) translate(-100, -198)" fill="none" stroke="#FEF9C3" stroke-linecap="round" stroke-linejoin="round">
    <!-- Top connecting ring -->
    <circle cx="100" cy="110" r="8" stroke-width="4.5" fill="none" />

    <!-- Cage finial cap -->
    <path d="M 94 125 C 94 119 106 119 106 125 Z" fill="#FEF9C3" stroke="#FEF9C3" stroke-width="2" />

    <!-- Outer Bell-shaped Frame -->
    <path d="M 100 125 C 92 142 66 160 52 184 C 44 198 46 222 51 252 C 54 266 56 276 58 284" stroke-width="5" fill="none" />
    <path d="M 100 125 C 108 142 134 160 148 184 C 156 198 154 222 149 252 C 146 266 144 276 142 284" stroke-width="5" fill="none" />

    <!-- Cage Base -->
    <path d="M 54 284 L 146 284 L 149 294 L 51 294 Z" fill="#FEF9C3" stroke="#FEF9C3" stroke-width="2.5" />

    <!-- Horizontal Perches / Crossbars -->
    <line x1="52" y1="190" x2="148" y2="190" stroke-width="4.5" />
    <line x1="53" y1="238" x2="147" y2="238" stroke-width="4.5" />

    <!-- Vertical Bars -->
    <line x1="100" y1="125" x2="100" y2="284" stroke-width="3" />
    <path d="M 87 137 C 86 160 84 210 85 284" stroke-width="3" fill="none" />
    <path d="M 72 154 C 71 180 70 220 72 284" stroke-width="3" fill="none" />
    <path d="M 113 137 C 114 160 116 210 115 284" stroke-width="3" fill="none" />
    <path d="M 128 154 C 129 180 130 220 128 284" stroke-width="3" fill="none" />

    <!-- Bird 1 (Upper right, perched on top crossbar at Y=190, looking left) -->
    <g fill="#FEF9C3" stroke="none">
      <path d="M 132 172 C 126 172, 120 176, 118 181 C 116 183, 113 184, 111 185 C 114 187, 117 188, 119 190 C 122 195, 127 197, 134 195 C 137 194, 140 197, 142 201 C 142 196, 140 191, 139 187 C 138 180, 136 172, 132 172 Z" />
      <ellipse cx="123" cy="178" rx="5.5" ry="5" />
      <polygon points="119,177 113,179 119,181" />
      <path d="M 135 192 L 143 203 L 138 202 Z" />
    </g>

    <!-- Bird 2 (Lower left, perched on bottom crossbar at Y=238, looking right) -->
    <g fill="#FEF9C3" stroke="none">
      <path d="M 82 222 C 89 222, 96 226, 98 231 C 101 233, 104 234, 107 235 C 104 237, 101 238, 98 240 C 95 244, 88 246, 81 245 C 77 244, 73 248, 70 254 C 71 248, 73 243, 74 239 C 76 230, 78 222, 82 222 Z" />
      <ellipse cx="93" cy="227" rx="6" ry="5.5" />
      <polygon points="98,225 105,228 98,231" />
      <path d="M 77 241 L 69 253 L 74 251 Z" />
    </g>
  </g>
</svg>`;

// Write public/icon.svg
const iconSvg = svgGaiolaContent(true, true);
fs.writeFileSync(path.resolve('public', 'icon.svg'), iconSvg, 'utf-8');
console.log('Generated public/icon.svg');

// Also write temp HTML files to render with headless Edge
const createHtmlWrapper = (svgStr, size) => `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
    svg { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  ${svgStr}
</body>
</html>`;

const tempDir = process.env.TEMP || 'C:\\Windows\\Temp';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const renderSvgToPng = (svgStr, targetFile, size) => {
  const tempHtml = path.join(tempDir, `render-${size}.html`);
  const tempPng = path.join(tempDir, `render-${size}.png`);
  fs.writeFileSync(tempHtml, createHtmlWrapper(svgStr, size), 'utf-8');

  try {
    const cmd = `"${edgePath}" --headless=new --disable-gpu --user-data-dir="${tempDir}\\edge-render-${size}" --screenshot="${tempPng}" --window-size=${size},${size} "file:///${tempHtml.replace(/\\/g, '/')}"`;
    execSync(cmd, { stdio: 'pipe' });

    if (fs.existsSync(tempPng)) {
      fs.copyFileSync(tempPng, targetFile);
      fs.unlinkSync(tempPng);
      console.log(`Rendered ${targetFile} (${size}x${size})`);
    } else {
      console.error(`Failed to generate ${targetFile}`);
    }
  } catch (err) {
    console.error(`Error rendering ${targetFile}:`, err.message);
  } finally {
    if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
  }
};

// 1. Apple Touch Icon (180x180 / 512x512 with solid square background)
renderSvgToPng(svgGaiolaContent(false, true), path.resolve('public', 'apple-touch-icon.png'), 512);

// 2. PWA 512x512
renderSvgToPng(svgGaiolaContent(true, true), path.resolve('public', 'pwa-512x512.png'), 512);

// 3. PWA 192x192
renderSvgToPng(svgGaiolaContent(true, true), path.resolve('public', 'pwa-192x192.png'), 192);

console.log('Icon generation complete!');
