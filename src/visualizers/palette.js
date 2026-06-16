import * as THREE from 'three';

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

export async function paletteFromImage(url) {
  const fallback = {
    primary: new THREE.Color('#22d3ee'),
    secondary: new THREE.Color('#2dd4bf'),
    accent: new THREE.Color('#ffffff'),
  };
  if (!url) return fallback;

  try {
    const img = await loadImage(url);
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let best = null, bestScore = -1;
    let second = null, secondScore = -1;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const [h, s, l] = rgbToHsl(r, g, b);
      if (l < 0.15 || l > 0.92) continue;
      const score = s * (1 - Math.abs(l - 0.55));
      if (score > bestScore) {
        secondScore = bestScore; second = best;
        bestScore = score; best = { r, g, b, h };
      } else if (score > secondScore) {
        secondScore = score; second = { r, g, b, h };
      }
    }

    const primary = best
      ? new THREE.Color(best.r / 255, best.g / 255, best.b / 255)
      : fallback.primary;
    let secondary;
    if (second) {
      secondary = new THREE.Color(second.r / 255, second.g / 255, second.b / 255);
    } else {

      const c = primary.clone();
      const hsl = {};
      c.getHSL(hsl);
      secondary = new THREE.Color().setHSL((hsl.h + 0.5) % 1, Math.max(0.5, hsl.s), 0.55);
    }

    return { primary, secondary, accent: new THREE.Color('#ffffff') };
  } catch (e) {
    console.warn('[palette] extraction failed, using fallback', e);
    return fallback;
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
