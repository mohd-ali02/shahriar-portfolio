'use strict';

const API   = '/api';
let   TOKEN = localStorage.getItem('sz_token') || '';
let   allItems = [];
let   manageFilter = 'all';

/* ── API helpers ── */
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(opts.headers || {}) }
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

/* ── LOGIN / SESSION ── */
async function checkSession() {
  if (!TOKEN) return showLogin();
  try {
    await apiFetch(`${API}/me`);
    showDashboard();
  } catch { showLogin(); }
}

function showLogin()     { document.getElementById('loginScreen').style.display = ''; document.getElementById('dashboard').classList.add('hidden'); }
function showDashboard() { document.getElementById('loginScreen').style.display = 'none'; document.getElementById('dashboard').classList.remove('hidden'); loadManage(); }

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('loginErr');
  err.textContent = '';
  try {
    const data = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.getElementById('loginEmail').value, password: document.getElementById('loginPass').value })
    }).then(r => r.json());
    if (data.error) throw new Error(data.error);
    TOKEN = data.token;
    localStorage.setItem('sz_token', TOKEN);
    showDashboard();
  } catch (ex) { err.textContent = ex.message; }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  TOKEN = '';
  localStorage.removeItem('sz_token');
  showLogin();
});

/* ── TABS ── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'manage') loadManage();
  });
});

/* ── DROP ZONE ── */
const dropZone   = document.getElementById('dropZone');
const fileInput  = document.getElementById('mediaFile');
const dropInner  = document.getElementById('dropInner');
const previewWrap = document.getElementById('previewWrap');

document.getElementById('browseBtn').addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', (e) => { if (!e.target.closest('#browseBtn') && !previewWrap.contains(e.target)) fileInput.click(); });

dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) showPreview(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) showPreview(fileInput.files[0]); });

function showPreview(file) {
  previewWrap.innerHTML = '';
  previewWrap.classList.remove('hidden');
  dropInner.classList.add('hidden');
  const url = URL.createObjectURL(file);
  const el  = file.type.startsWith('video/') ? document.createElement('video') : document.createElement('img');
  el.src = url;
  if (el.tagName === 'VIDEO') { el.controls = true; el.muted = true; }
  previewWrap.appendChild(el);
  // Sync file to form
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
}

/* ── UPLOAD MEDIA ── */
document.getElementById('mediaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('uploadMsg');
  const btn = document.getElementById('uploadBtn');
  msg.textContent = ''; msg.className = 'upload-msg';
  if (!fileInput.files[0]) { msg.textContent = 'Please select a file.'; msg.className = 'upload-msg err'; return; }
  btn.disabled = true; btn.textContent = 'Uploading...';
  try {
    const fd = new FormData(e.target);
    if (!document.querySelector('[name=featured]').checked) fd.delete('featured');
    await apiFetch(`${API}/portfolio/photo`, { method: 'POST', body: fd });
    msg.textContent = 'Uploaded successfully!'; msg.className = 'upload-msg ok';
    e.target.reset(); previewWrap.innerHTML = ''; previewWrap.classList.add('hidden'); dropInner.classList.remove('hidden');
  } catch (ex) { msg.textContent = ex.message; msg.className = 'upload-msg err'; }
  btn.disabled = false; btn.textContent = 'Upload';
});

/* ── UPLOAD WRITE-UP ── */
document.getElementById('writeupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('writeupMsg');
  msg.textContent = ''; msg.className = 'upload-msg';
  try {
    const fd = new FormData(e.target);
    await apiFetch(`${API}/portfolio/writeup`, { method: 'POST', body: fd });
    msg.textContent = 'Write-up published!'; msg.className = 'upload-msg ok';
    e.target.reset();
  } catch (ex) { msg.textContent = ex.message; msg.className = 'upload-msg err'; }
});

/* ── MANAGE ── */
async function loadManage() {
  try {
    const data = await fetch(`${API}/portfolio`).then(r => r.json());
    allItems = data.items || [];
    renderManage();
  } catch { /* silent */ }
}

function renderManage() {
  const grid = document.getElementById('manageGrid');
  const empty = document.getElementById('emptyMsg');
  const items = manageFilter === 'all' ? allItems : allItems.filter(i => i.type === manageFilter);
  grid.innerHTML = '';
  empty.classList.toggle('hidden', items.length > 0);
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'mg-card';
    const thumb = item.type === 'video' ? `<video src="${item.src}" muted></video>` :
                  item.type === 'photo'  ? `<img src="${item.src}" alt="${item.title}" loading="lazy" />` :
                  `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:2rem">&#9998;</div>`;
    card.innerHTML = `
      <div class="mg-thumb">
        ${thumb}
        <span class="mg-type">${item.type}</span>
      </div>
      <div class="mg-body">
        <p class="mg-title">${item.title}</p>
        <p class="mg-cat">${item.category}</p>
        <div class="mg-actions">
          <button class="mg-feat${item.featured ? ' on' : ''}" data-id="${item.id}" title="Toggle featured">${item.featured ? 'Featured' : 'Feature'}</button>
          <button class="mg-del" data-id="${item.id}" title="Delete">Delete</button>
        </div>
      </div>`;
    card.querySelector('.mg-del').addEventListener('click', () => deleteItem(item.id));
    card.querySelector('.mg-feat').addEventListener('click', () => toggleFeatured(item));
    grid.appendChild(card);
  });
}

async function deleteItem(id) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  try {
    await apiFetch(`${API}/portfolio/${id}`, { method: 'DELETE' });
    allItems = allItems.filter(i => i.id !== id);
    renderManage();
  } catch (ex) { alert(ex.message); }
}

async function toggleFeatured(item) {
  try {
    const updated = await apiFetch(`${API}/portfolio/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: !item.featured })
    });
    const idx = allItems.findIndex(i => i.id === item.id);
    if (idx !== -1) allItems[idx] = updated;
    renderManage();
  } catch (ex) { alert(ex.message); }
}

document.querySelectorAll('.mf').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mf').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    manageFilter = btn.dataset.f;
    renderManage();
  });
});

/* ── INIT ── */
checkSession();
