'use strict';

const CAT_LABELS = {
  product:        'Product Photography',
  beauty:         'Beauty & Cosmetics',
  commercial:     'Commercial',
  setdesign:      'Set Design',
  cinematography: 'Cinematography',
  blog:           'Blog Post',
  behindscenes:   'Behind the Scenes',
  review:         'Review',
};

let allItems    = [];
let visibleItems = [];
let activeFilter = 'all';

/* ── FETCH PORTFOLIO ── */
async function loadPortfolio() {
  try {
    const data = await fetch('/api/portfolio').then(r => r.json());
    allItems = (data.items || []).filter(i => i.type === 'photo' || i.type === 'video');
  } catch {
    allItems = [];
  }
  initHero();
  buildGallery('all');
}

/* ── HERO SLIDESHOW ── */
function initHero() {
  const container = document.getElementById('heroSlides');
  container.innerHTML = '';
  const featured = allItems.filter(p => p.featured).slice(0, 6);
  const slides   = featured.length ? featured : allItems.slice(0, 6);

  if (!slides.length) {
    container.style.background = '#111';
    return;
  }

  slides.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'hero-slide' + (i === 0 ? ' active' : '');
    div.style.backgroundImage  = `url('${p.src}')`;
    div.style.backgroundSize   = 'cover';
    div.style.backgroundPosition = 'center';
    container.appendChild(div);
  });

  let idx = 0;
  setInterval(() => {
    const els = container.querySelectorAll('.hero-slide');
    if (els.length < 2) return;
    els[idx].classList.remove('active');
    idx = (idx + 1) % els.length;
    els[idx].classList.add('active');
  }, 5000);
}

/* ── GALLERY ── */
function buildGallery(filter) {
  activeFilter  = filter;
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = '';
  visibleItems  = filter === 'all' ? allItems : allItems.filter(i => i.category === filter);

  if (!visibleItems.length) {
    gallery.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#6a6a6a;padding:4rem 0;">No portfolio items yet. Check back soon.</p>';
    return;
  }

  visibleItems.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'gallery-item' + (item.featured ? ' tall' : '');
    el.dataset.index = i;

    const media = item.type === 'video'
      ? `<video src="${item.src}" muted loop playsinline></video>`
      : `<img src="${item.src}" alt="${item.title}" loading="lazy" />`;

    el.innerHTML = `
      ${media}
      <div class="item-overlay">
        <div class="item-info">
          <p>${item.title}</p>
          <p>${CAT_LABELS[item.category] || item.category}</p>
        </div>
      </div>`;
    el.addEventListener('click', () => openLightbox(i));
    gallery.appendChild(el);

    el.style.opacity   = '0';
    el.style.transform = 'scale(0.96)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'scale(1)'; }, i * 50);
  });
}

/* ── FILTER ── */
function initFilters() {
  document.querySelectorAll('.filt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      buildGallery(btn.dataset.filter);
    });
  });
}

/* ── LIGHTBOX ── */
let lbIndex = 0;
const lightbox = document.getElementById('lightbox');
const lbImg    = document.getElementById('lbImg');
const lbTitle  = document.getElementById('lbTitle');
const lbCat    = document.getElementById('lbCat');

function openLightbox(i)  { lbIndex = i; renderLb(); lightbox.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeLightbox()  { lightbox.classList.remove('open'); document.body.style.overflow = ''; }
function lbPrev() { lbIndex = (lbIndex - 1 + visibleItems.length) % visibleItems.length; renderLb(); }
function lbNext() { lbIndex = (lbIndex + 1) % visibleItems.length; renderLb(); }

function renderLb() {
  const item = visibleItems[lbIndex];
  lbImg.style.opacity = '0';
  setTimeout(() => {
    lbImg.src = item.src;
    lbImg.alt = item.title;
    lbTitle.textContent = item.title;
    lbCat.textContent   = CAT_LABELS[item.category] || item.category;
    lbImg.style.opacity = '1';
  }, 150);
}

function initLightbox() {
  document.querySelector('.lb-close').addEventListener('click', closeLightbox);
  document.querySelector('.lb-prev').addEventListener('click', lbPrev);
  document.querySelector('.lb-next').addEventListener('click', lbNext);
  document.querySelector('.lb-overlay').addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  lbPrev();
    if (e.key === 'ArrowRight') lbNext();
  });
  let tx = 0;
  lightbox.addEventListener('touchstart', e => { tx = e.changedTouches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend',   e => { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) dx < 0 ? lbNext() : lbPrev(); });
}

/* ── NAVBAR ── */
function initNavbar() {
  const nav    = document.getElementById('navbar');
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  window.addEventListener('scroll', () => { nav.classList.toggle('scrolled', window.scrollY > 60); }, { passive: true });
  toggle.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
}

/* ── SCROLL REVEAL ── */
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal-up, .reveal-left').forEach(el => obs.observe(el));
}

/* ── CONTACT FORM ── */
function initForm() {
  const form = document.getElementById('contactForm');
  const msg  = document.getElementById('formMsg');
  form.addEventListener('submit', e => {
    e.preventDefault();
    msg.textContent = 'Thank you! Your message has been sent.';
    form.reset();
    setTimeout(() => { msg.textContent = ''; }, 5000);
  });
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  loadPortfolio();
  initFilters();
  initLightbox();
  initNavbar();
  initReveal();
  initForm();
});
