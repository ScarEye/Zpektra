import { VISUALIZERS } from '../visualizers/registry.js';

const FAV_KEY = 'zpektra.favorites';

function loadFavs() {
  try {
    const arr = JSON.parse(localStorage.getItem(FAV_KEY));
    if (Array.isArray(arr)) return arr.filter((id) => VISUALIZERS.some((v) => v.id === id));
  } catch {
    // ignore malformed storage
  }
  return VISUALIZERS.slice(0, 6).map((v) => v.id);
}

function saveFavs() {
  localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
}

let favorites = loadFavs();
const renderers = new Set();

function notify() {
  renderers.forEach((fn) => fn());
}

export function isFav(id) {
  return favorites.includes(id);
}

export function toggleFav(id) {
  favorites = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
  saveFavs();
  notify();
}

function tagFor(v) {
  return v.description.startsWith('3D') ? '3D · drag to rotate' : '2D shader';
}

function favList() {
  return VISUALIZERS.filter((v) => favorites.includes(v.id));
}

function starBtn(id) {
  const s = document.createElement('button');
  s.type = 'button';
  s.className = 'star-btn' + (isFav(id) ? ' on' : '');
  s.title = isFav(id) ? 'Remove from favorites' : 'Add to favorites';
  s.textContent = isFav(id) ? '★' : '☆';
  s.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFav(id);
  });
  return s;
}

export function openVisModal() {
  const overlay = document.getElementById('vis-modal');
  if (overlay) overlay.classList.remove('hidden');
}

function closeVisModal() {
  const overlay = document.getElementById('vis-modal');
  if (overlay) overlay.classList.add('hidden');
}

export function buildPicker(onPick) {
  const grid = document.getElementById('picker-grid');

  const render = () => {
    grid.innerHTML = '';
    const favs = favList();
    if (!favs.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.textContent = 'No favorites yet — tap “Browse all” and star the ones you like.';
      grid.appendChild(empty);
    }
    favs.forEach((v) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<h3>${v.name}</h3><p>${v.description}</p>`;
      card.appendChild(starBtn(v.id));
      card.addEventListener('click', () => onPick(v.id));
      grid.appendChild(card);
    });

    const browse = document.createElement('div');
    browse.className = 'card card-browse';
    browse.innerHTML = `<h3>＋ Browse all</h3><p>See every visualizer and pick your favorites.</p>`;
    browse.addEventListener('click', openVisModal);
    grid.appendChild(browse);
  };

  renderers.add(render);
  render();
}

export function buildDock(onPick) {
  const dock = document.getElementById('vis-dock');
  let items = {};
  let activeId = null;

  const setActive = (id) => {
    activeId = id;
    Object.entries(items).forEach(([k, elBtn]) => elBtn.classList.toggle('active', k === id));
    const act = items[id];
    if (act) act.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const render = () => {
    dock.innerHTML = '';
    items = {};
    favList().forEach((v) => {
      const b = document.createElement('button');
      b.className = 'dock-item';
      b.innerHTML = `<div class="dock-name">${v.name}</div><div class="dock-tag">${tagFor(v)}</div>`;
      b.addEventListener('click', () => onPick(v.id));
      dock.appendChild(b);
      items[v.id] = b;
    });

    const all = document.createElement('button');
    all.className = 'dock-item dock-all';
    all.innerHTML = `<div class="dock-name">＋ All</div><div class="dock-tag">browse &amp; favorite</div>`;
    all.addEventListener('click', openVisModal);
    dock.appendChild(all);

    if (activeId) setActive(activeId);
  };

  renderers.add(render);
  render();
  return setActive;
}

export function buildModal(onPick) {
  const overlay = document.getElementById('vis-modal');
  const grid = document.getElementById('modal-grid');
  const closeBtn = document.getElementById('btn-modal-close');
  if (!overlay || !grid) return;

  const render = () => {
    grid.innerHTML = '';
    VISUALIZERS.forEach((v) => {
      const card = document.createElement('div');
      card.className = 'card' + (isFav(v.id) ? ' fav' : '');
      card.innerHTML = `<h3>${v.name}</h3><p>${v.description}</p>`;
      card.appendChild(starBtn(v.id));
      card.addEventListener('click', () => {
        onPick(v.id);
        closeVisModal();
      });
      grid.appendChild(card);
    });
  };

  renderers.add(render);
  render();

  if (closeBtn) closeBtn.addEventListener('click', closeVisModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeVisModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeVisModal();
  });
}
