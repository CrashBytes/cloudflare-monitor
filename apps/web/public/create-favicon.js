#!/usr/bin/env node
/**
 * Simple script to create PNG favicon from SVG using Node.js canvas
 */
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function createFavicon() {
  try {
    // Read the SVG
    const svgPath = './favicon.svg';
    const svgData = fs.readFileSync(svgPath, 'utf8');
    
    // Create a simple colored square as fallback
    const canvas = createCanvas(32, 32);
    const ctx = canvas.getContext('2d');
    
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 32, 32);
    gradient.addColorStop(0, '#f97316');
    gradient.addColorStop(0.5, '#ea580c');
    gradient.addColorStop(1, '#c2410c');
    
    // Draw rounded rectangle background
    ctx.fillStyle = gradient;
    roundRect(ctx, 0, 0, 32, 32, 7);
    ctx.fill();
    
    // Draw "C" shape
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(16, 16, 8, 0.5 * Math.PI, 2.5 * Math.PI);
    ctx.stroke();
    
    // Draw dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    [11, 16, 21].forEach(y => {
      ctx.beginPath();
      ctx.arc(25, y, 1.5, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // Save as PNG
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync('./favicon.png', buffer);
    console.log('[+] Created favicon.png');
  } catch (error) {
    console.error('Error creating favicon:', error.message);
    process.exit(1);
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

createFavicon();
