'use strict';
require('dotenv').config();
const express  = require('express');
const multer   = require('multer');
const jwt      = require('jsonwebtoken');
const fs       = require('fs');
const path     = require('path');
const { v4: uuid } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'changeme';

// On Render: use persistent disk at RENDER_DATA_PATH; locally: use project root
const DATA_ROOT  = process.env.RENDER_DATA_PATH || __dirname;
const DB         = path.join(DATA_ROOT, 'data', 'portfolio.json');
const UPLOAD_DIR = path.join(DATA_ROOT, 'uploads');

// Ensure directories exist on persistent disk
['data', 'uploads/photos', 'uploads/videos'].forEach(d => {
  fs.mkdirSync(path.join(DATA_ROOT, d), { recursive: true });
});

// Seed portfolio.json on persistent disk if it doesn't exist
if (!fs.existsSync(DB)) {
  const seed = path.join(__dirname, 'data', 'portfolio.json');
  if (fs.existsSync(seed)) fs.copyFileSync(seed, DB);
  else fs.writeFileSync(DB, '{"items":[]}');
}

// Seed uploaded photos to persistent disk if missing
const seedPhotos = path.join(__dirname, 'uploads', 'photos');
const diskPhotos = path.join(UPLOAD_DIR, 'photos');
if (fs.existsSync(seedPhotos)) {
  fs.readdirSync(seedPhotos).forEach(f => {
    const dest = path.join(diskPhotos, f);
    if (!fs.existsSync(dest)) fs.copyFileSync(path.join(seedPhotos, f), dest);
  });
}

app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(diskPhotos.replace('/photos', '')));

/* ── helpers ── */
const readDB  = () => JSON.parse(fs.readFileSync(DB, 'utf8'));
const writeDB = (data) => fs.writeFileSync(DB, JSON.stringify(data, null, 2));

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/* ── multer storage ── */
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const isVideo = file.mimetype.startsWith('video/');
    cb(null, path.join(UPLOAD_DIR, isVideo ? 'videos' : 'photos'));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter(req, file, cb) {
    const allowed = /image\/(jpeg|png|webp|gif)|video\/(mp4|mov|webm)/;
    cb(null, allowed.test(file.mimetype));
  }
});

/* ── AUTH ── */
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ email }, SECRET, { expiresIn: '7d' });
  res.json({ token });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ email: req.user.email });
});

/* ── PORTFOLIO ── */
app.get('/api/portfolio', (req, res) => {
  res.json(readDB());
});

app.post('/api/portfolio/photo', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { title, category, description, featured } = req.body;
  const isVideo = req.file.mimetype.startsWith('video/');
  const item = {
    id:          uuid(),
    type:        isVideo ? 'video' : 'photo',
    title:       title || 'Untitled',
    category:    category || 'product',
    description: description || '',
    featured:    featured === 'true',
    src:         `/uploads/${isVideo ? 'videos' : 'photos'}/${req.file.filename}`,
    date:        new Date().toISOString()
  };
  const db = readDB();
  db.items.unshift(item);
  writeDB(db);
  res.json(item);
});

app.post('/api/portfolio/writeup', auth, upload.single('cover'), (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  const item = {
    id:       uuid(),
    type:     'writeup',
    title,
    category: category || 'blog',
    content,
    cover:    req.file ? `/uploads/photos/${req.file.filename}` : null,
    date:     new Date().toISOString()
  };
  const db = readDB();
  db.items.unshift(item);
  writeDB(db);
  res.json(item);
});

app.delete('/api/portfolio/:id', auth, (req, res) => {
  const db = readDB();
  const item = db.items.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  // Remove file from disk
  if (item.src) {
    const filePath = path.join(DATA_ROOT, item.src);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.items = db.items.filter(i => i.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

app.patch('/api/portfolio/:id', auth, (req, res) => {
  const db = readDB();
  const idx = db.items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.items[idx] = { ...db.items[idx], ...req.body };
  writeDB(db);
  res.json(db.items[idx]);
});

/* ── START ── */
app.listen(PORT, () => {
  console.log(`\n  Shahriar Portfolio running at http://localhost:${PORT}`);
  console.log(`  Admin panel: http://localhost:${PORT}/admin\n`);
});
