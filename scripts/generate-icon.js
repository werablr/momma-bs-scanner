// Generate Scanner icon from approved icon-generator.html settings
// Approved settings (lines 365-372 of icon-generator.html):
// - frameColor: '#00f900'
// - tileColor: '#ffffff'
// - tileOpacity: 1.0
// - dimOpacity: 0.70
// - tileRadius: 14
// - tileDepth: 0
// - emphasis: [0, 1, 3, 4, 6, 7]

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Approved configuration from icon-generator.html
const config = {
  frameColor: '#00f900',
  tileColor: '#ffffff',
  tileOpacity: 1.0,
  dimOpacity: 0.70,
  tileRadius: 14,
  tileDepth: 0,
  emphasis: [0, 1, 3, 4, 6, 7],
  tileGapPercent: 0.065,
  frameRadius: 18,
};

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Calculate dimensions
  const scale = size / 1024;
  const tileGap = Math.round(size * config.tileGapPercent);
  const tileSize = Math.round((size - tileGap * 4) / 3);
  const frameRadius = config.frameRadius * scale;
  const tileRadius = config.tileRadius * scale;
  const innerFrameRadius = Math.max(0, frameRadius - (4 * scale));

  const emphasized = new Set(config.emphasis);
  const hasEmphasis = emphasized.size > 0;

  // Draw outer frame
  ctx.fillStyle = config.frameColor;
  ctx.beginPath();
  roundRect(ctx, 0, 0, size, size, frameRadius);
  ctx.fill();

  // Draw inner frame border (micro-depth)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  roundRect(
    ctx,
    tileGap,
    tileGap,
    size - tileGap * 2,
    size - tileGap * 2,
    innerFrameRadius
  );
  ctx.stroke();

  // Draw 3x3 grid of tiles
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const index = row * 3 + col;
      const isEmph = emphasized.has(index);

      const x = tileGap * 2 + col * (tileSize + tileGap);
      const y = tileGap * 2 + row * (tileSize + tileGap);

      const opacity = hasEmphasis
        ? (isEmph ? config.tileOpacity : config.dimOpacity)
        : config.tileOpacity;

      ctx.globalAlpha = opacity;
      ctx.fillStyle = config.tileColor;
      ctx.beginPath();
      roundRect(ctx, x, y, tileSize, tileSize, tileRadius);
      ctx.fill();

      // Reset
      ctx.globalAlpha = 1.0;
    }
  }

  return canvas;
}

// Helper function for rounded rectangles
function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Generate 1024x1024 icon
const canvas = drawIcon(1024);
const buffer = canvas.toBuffer('image/png');

// Save to assets/images/icon.png
const outputPath = path.join(__dirname, '..', 'assets', 'images', 'icon.png');
fs.writeFileSync(outputPath, buffer);

console.log('✅ Icon generated:', outputPath);
console.log('Settings:', config);
