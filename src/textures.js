import * as THREE from 'three';

// Small procedural canvas textures for the static world. Generated once at
// start so the project needs no extra image assets. Browser only.
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function canvasTexture(size, draw, { color = true, repeat = [1, 1] } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  draw(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function speckle(context, size, random, count, colors, minSize, maxSize, alpha) {
  for (let i = 0; i < count; i++) {
    context.globalAlpha = alpha * (0.4 + random() * 0.6);
    context.fillStyle = colors[Math.floor(random() * colors.length)];
    const radius = minSize + random() * (maxSize - minSize);
    context.beginPath();
    context.arc(random() * size, random() * size, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function blotches(context, size, random, count, color, radius, alpha) {
  for (let i = 0; i < count; i++) {
    const x = random() * size;
    const y = random() * size;
    const r = radius * (0.4 + random());
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = alpha * (0.5 + random() * 0.5);
    context.fillStyle = gradient;
    context.fillRect(x - r, y - r, r * 2, r * 2);
  }
  context.globalAlpha = 1;
}

export function concreteTextures() {
  const draw = (bump) => (context, size) => {
    const random = seeded(bump ? 11 : 11);
    context.fillStyle = bump ? '#808080' : '#9a988f';
    context.fillRect(0, 0, size, size);
    blotches(context, size, random, 40, bump ? '#6a6a6a' : '#7d7a70', 90, 0.35);
    blotches(context, size, random, 30, bump ? '#959595' : '#b0aea4', 70, 0.3);
    speckle(context, size, random, 9000, bump ? ['#555', '#aaa'] : ['#6e6c66', '#b8b5ab', '#86847c'], 0.4, 1.6, 0.5);
    speckle(context, size, random, 260, bump ? ['#333'] : ['#55534e'], 1, 3, 0.55);
    // Rain streaks running down from the top edge.
    for (let i = 0; i < 26; i++) {
      const x = random() * size;
      const length = size * (0.15 + random() * 0.45);
      const gradient = context.createLinearGradient(0, 0, 0, length);
      gradient.addColorStop(0, bump ? 'rgba(90,90,90,0.5)' : 'rgba(70,68,60,0.35)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient;
      context.fillRect(x, 0, 2 + random() * 9, length);
    }
    // Formwork seams.
    context.fillStyle = bump ? '#4a4a4a' : 'rgba(60,58,52,0.45)';
    context.fillRect(0, size * 0.5 - 1, size, 2);
    context.fillRect(size * 0.5 - 1, 0, 2, size);
  };
  return {
    map: canvasTexture(512, draw(false)),
    bumpMap: canvasTexture(512, draw(true), { color: false })
  };
}

export function corrugatedTextures(paint = '#56654f', ribs = 16) {
  const draw = (bump) => (context, size) => {
    const random = seeded(23);
    const step = size / ribs;
    for (let i = 0; i < ribs; i++) {
      const gradient = context.createLinearGradient(i * step, 0, (i + 1) * step, 0);
      if (bump) {
        gradient.addColorStop(0, '#202020');
        gradient.addColorStop(0.5, '#e0e0e0');
        gradient.addColorStop(1, '#202020');
      } else {
        gradient.addColorStop(0, 'rgba(0,0,0,0.28)');
        gradient.addColorStop(0.45, 'rgba(255,255,255,0.08)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.28)');
      }
      if (!bump) {
        context.fillStyle = paint;
        context.fillRect(i * step, 0, step, size);
      }
      context.fillStyle = gradient;
      context.fillRect(i * step, 0, step, size);
    }
    if (!bump) {
      blotches(context, size, random, 22, '#7a4a2a', 40, 0.45);
      blotches(context, size, random, 18, '#3b3428', 60, 0.3);
      speckle(context, size, random, 3000, ['#2d2a24', '#8a7a5c'], 0.3, 1.2, 0.35);
      for (let i = 0; i < 30; i++) {
        const x = random() * size;
        const gradient = context.createLinearGradient(0, size * 0.55, 0, size);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(110,62,30,0.55)');
        context.fillStyle = gradient;
        context.fillRect(x, size * 0.55, 2 + random() * 6, size * 0.45);
      }
    }
  };
  return {
    map: canvasTexture(512, draw(false)),
    bumpMap: canvasTexture(256, draw(true), { color: false })
  };
}

export function woodTextures() {
  const draw = (bump) => (context, size) => {
    const random = seeded(41);
    const planks = 5;
    const step = size / planks;
    for (let p = 0; p < planks; p++) {
      const tone = 90 + Math.floor(random() * 40);
      context.fillStyle = bump ? '#8a8a8a' : `rgb(${tone + 40},${tone + 15},${tone - 25})`;
      context.fillRect(0, p * step, size, step);
      for (let g = 0; g < 40; g++) {
        context.globalAlpha = 0.18;
        context.strokeStyle = bump ? '#555' : '#4a3520';
        context.lineWidth = 0.5 + random() * 1.4;
        const y = p * step + random() * step;
        context.beginPath();
        context.moveTo(0, y);
        context.bezierCurveTo(size * 0.3, y + (random() - 0.5) * 6, size * 0.7, y + (random() - 0.5) * 6, size, y);
        context.stroke();
      }
      context.globalAlpha = 1;
      context.fillStyle = bump ? '#222' : '#2c2116';
      context.fillRect(0, p * step, size, 3);
    }
    if (!bump) blotches(context, size, random, 12, '#2e2418', 50, 0.3);
  };
  return {
    map: canvasTexture(256, draw(false)),
    bumpMap: canvasTexture(256, draw(true), { color: false })
  };
}

export function fabricTextures() {
  const draw = (bump) => (context, size) => {
    const random = seeded(57);
    context.fillStyle = bump ? '#808080' : '#8a7b5a';
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < size; i += 4) {
      context.fillStyle = bump ? 'rgba(30,30,30,0.5)' : 'rgba(50,40,25,0.25)';
      context.fillRect(i, 0, 1.5, size);
      context.fillRect(0, i, size, 1.5);
    }
    if (!bump) {
      blotches(context, size, random, 20, '#5a4c34', 50, 0.4);
      blotches(context, size, random, 10, '#a39470', 40, 0.3);
    }
  };
  return {
    map: canvasTexture(256, draw(false)),
    bumpMap: canvasTexture(128, draw(true), { color: false })
  };
}

export function plasterTextures(base = '#b9b2a2') {
  const draw = (bump) => (context, size) => {
    const random = seeded(73);
    context.fillStyle = bump ? '#808080' : base;
    context.fillRect(0, 0, size, size);
    blotches(context, size, random, 50, bump ? '#707070' : '#8f8878', 80, 0.35);
    speckle(context, size, random, 7000, bump ? ['#666', '#999'] : ['#a09888', '#cfc8b6'], 0.4, 1.4, 0.5);
    if (!bump) {
      // Dirt rising from the ground and streaks below the eaves.
      const gradient = context.createLinearGradient(0, size * 0.7, 0, size);
      gradient.addColorStop(0, 'rgba(70,60,45,0)');
      gradient.addColorStop(1, 'rgba(70,60,45,0.55)');
      context.fillStyle = gradient;
      context.fillRect(0, size * 0.7, size, size * 0.3);
      for (let i = 0; i < 18; i++) {
        const x = random() * size;
        const g = context.createLinearGradient(0, 0, 0, size * 0.4);
        g.addColorStop(0, 'rgba(60,55,45,0.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = g;
        context.fillRect(x, 0, 3 + random() * 10, size * 0.4);
      }
    }
  };
  return {
    map: canvasTexture(512, draw(false)),
    bumpMap: canvasTexture(256, draw(true), { color: false })
  };
}

export function rockTexture() {
  return canvasTexture(256, (context, size) => {
    const random = seeded(91);
    context.fillStyle = '#7a7a72';
    context.fillRect(0, 0, size, size);
    blotches(context, size, random, 30, '#5b5c55', 40, 0.5);
    blotches(context, size, random, 20, '#8f8d7f', 30, 0.4);
    blotches(context, size, random, 14, '#5d6a3c', 25, 0.35);
    speckle(context, size, random, 4000, ['#4a4a45', '#a3a198'], 0.4, 1.3, 0.5);
  });
}
