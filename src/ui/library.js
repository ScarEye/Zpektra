import { VISUALIZERS, byTier } from '../visualizers/registry.js';

const FAV_KEY = 'zpektra.favorites';

function loadFavs() {
  try {
    const arr = JSON.parse(localStorage.getItem(FAV_KEY));
    if (Array.isArray(arr)) {
      return arr.filter((id) => VISUALIZERS.some((v) => v.id === id));
    }
  } catch {
    return byTier('release').slice(0, 6).map((v) => v.id);
  }
  return byTier('release').slice(0, 6).map((v) => v.id);
}

function saveFavs() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  } catch {
    return;
  }
}

let favorites = loadFavs();
const renderers = new Set();

function notify() {
  renderers.forEach((fn) => fn());
}

function isFav(id) {
  return favorites.includes(id);
}

function toggleFav(id) {
  favorites = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
  saveFavs();
  notify();
}

function tagFor(v) {
  if (v.tier === 'prototype') return 'Prototype';
  return v.kind === '3d' ? '3D' : '2D';
}

function starBtn(id) {
  const s = document.createElement('button');
  s.type = 'button';
  s.className = 'star-btn' + (isFav(id) ? ' on' : '');
  s.setAttribute('aria-label', isFav(id) ? 'Remove from favorites' : 'Add to favorites');
  s.setAttribute('aria-pressed', isFav(id) ? 'true' : 'false');
  s.textContent = isFav(id) ? '★' : '☆';
  s.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFav(id);
  });
  return s;
}

function card(v, onPick) {
  const root = document.createElement('article');
  root.className = 'card' + (isFav(v.id) ? ' is-fav' : '');

  const hit = document.createElement('button');
  hit.type = 'button';
  hit.className = 'card-hit';

  const kicker = document.createElement('span');
  kicker.className = 'kicker';
  kicker.textContent = v.kind === '3d' ? '3D' : '2D';

  const name = document.createElement('span');
  name.className = 'card-name';
  name.textContent = v.name;

  const blurb = document.createElement('span');
  blurb.className = 'card-blurb';
  blurb.textContent = v.blurb;

  hit.append(kicker, name, blurb);
  hit.addEventListener('click', onPick);
  root.append(hit, starBtn(v.id));
  return root;
}

function fill(grid, list, onPick) {
  grid.replaceChildren();
  list.forEach((v) => grid.appendChild(card(v, () => onPick(v.id))));
}

export function mountLibrary(onPick) {
  const release = document.getElementById('release-grid');
  const proto = document.getElementById('proto-grid');
  const panel = document.getElementById('proto-panel');
  if (!release || !proto) return;

  const render = () => {
    fill(release, byTier('release'), onPick);
    const studies = byTier('prototype');
    fill(proto, studies, onPick);
    if (panel) panel.classList.toggle('hidden', studies.length === 0);
  };

  renderers.add(render);
  render();
}

export function mountDock(onPick) {
  const dock = document.getElementById('vis-dock');
  let items = {};
  let activeId = null;

  const paintActive = () => {
    Object.entries(items).forEach(([id, node]) => {
      node.classList.toggle('active', id === activeId);
    });
    const act = items[activeId];
    if (act) act.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const render = () => {
    dock.replaceChildren();
    items = {};

    const ids = favorites.filter((id) => VISUALIZERS.some((v) => v.id === id));
    if (activeId && !ids.includes(activeId)) ids.push(activeId);

    ids.forEach((id) => {
      const v = VISUALIZERS.find((item) => item.id === id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dock-item' + (v.tier === 'prototype' ? ' is-proto' : '');

      const name = document.createElement('span');
      name.className = 'dock-name';
      name.textContent = v.name;

      const tag = document.createElement('span');
      tag.className = 'dock-tag';
      tag.textContent = tagFor(v);

      b.append(name, tag);
      b.addEventListener('click', () => onPick(v.id));
      dock.appendChild(b);
      items[v.id] = b;
    });

    const all = document.createElement('button');
    all.type = 'button';
    all.className = 'dock-item dock-all';
    const allName = document.createElement('span');
    allName.className = 'dock-name';
    allName.textContent = 'All';
    const allTag = document.createElement('span');
    allTag.className = 'dock-tag';
    allTag.textContent = 'Library';
    all.append(allName, allTag);
    all.addEventListener('click', openCatalog);
    dock.appendChild(all);

    paintActive();
  };

  renderers.add(render);
  render();

  return (id) => {
    activeId = id;
    if (!items[id]) render();
    else paintActive();
  };
}

function openCatalog() {
  document.getElementById('catalog-modal')?.classList.remove('hidden');
}

export function closeCatalog() {
  document.getElementById('catalog-modal')?.classList.add('hidden');
}

export function mountCatalog(onPick) {
  const overlay = document.getElementById('catalog-modal');
  const release = document.getElementById('catalog-release');
  const proto = document.getElementById('catalog-proto');
  const wrap = document.getElementById('catalog-proto-wrap');
  const closeBtn = document.getElementById('btn-catalog-close');
  if (!overlay || !release || !proto) return;

  const pick = (id) => {
    closeCatalog();
    onPick(id);
  };

  const render = () => {
    fill(release, byTier('release'), pick);
    const studies = byTier('prototype');
    fill(proto, studies, pick);
    if (wrap) wrap.classList.toggle('hidden', studies.length === 0);
  };

  renderers.add(render);
  render();

  closeBtn?.addEventListener('click', closeCatalog);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeCatalog();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeCatalog();
  });
}
