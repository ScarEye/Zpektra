// Builds the visualizer picker grid (full screen) and the bottom dock (live
// switcher shown over a running visualizer).

import { VISUALIZERS } from '../visualizers/registry.js';

function tagFor(v) {
  return v.description.startsWith('3D') ? '3D · drag to rotate' : '2D shader';
}

export function buildPicker(onPick) {
  const grid = document.getElementById('picker-grid');
  grid.innerHTML = '';
  VISUALIZERS.forEach((v) => {
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = `<h3>${v.name}</h3><p>${v.description}</p>`;
    card.addEventListener('click', () => onPick(v.id));
    grid.appendChild(card);
  });
}

// Bottom horizontal dock. Returns a setActive(id) function to highlight the
// current visualizer.
export function buildDock(onPick) {
  const dock = document.getElementById('vis-dock');
  dock.innerHTML = '';
  const items = {};
  VISUALIZERS.forEach((v) => {
    const b = document.createElement('button');
    b.className = 'dock-item';
    b.innerHTML = `<div class="dock-name">${v.name}</div><div class="dock-tag">${tagFor(v)}</div>`;
    b.addEventListener('click', () => onPick(v.id));
    dock.appendChild(b);
    items[v.id] = b;
  });
  return function setActive(id) {
    Object.entries(items).forEach(([k, elBtn]) => elBtn.classList.toggle('active', k === id));
    const act = items[id];
    if (act) act.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };
}
