'use strict';
require('dotenv').config();
const express  = require('express');
const multer   = require('multer');
const jwt      = require('jsonwebtoken');
const fs       = require('fs');
const path     = require('path');
const { v4: uuid } = require('uuid');
const cloudinary = require('cloudinary').v2;

const app  = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'changeme';
const DB   = path.join(__dirname, 'data', 'portfolio.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Ensure local seed directories exist (for the 5 committed photos)
['uploads/photos', 'uploads/videos'].forEach(d => {
  fs.mkdirSync(path.join(__dirname, d), { recursive: true });
});

app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOAD_DIR)); // Serve seed photos from disk

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

/* ── multer (memory storage for Cloudinary upload) ── */
const upload = multer({
  storage: multer.memoryStorage(),
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

  // Upload to Cloudinary
  const uploadStream = cloudinary.uploader.upload_stream(
    {
      folder: `shahriar/${isVideo ? 'videos' : 'photos'}`,
      resource_type: isVideo ? 'video' : 'auto',
      timeout: 60000
    },
    (error, result) => {
      if (error) {
        console.error('Cloudinary upload error:', error);
        return res.status(500).json({ error: 'Upload failed' });
      }

      const item = {
        id:          uuid(),
        type:        isVideo ? 'video' : 'photo',
        title:       title || 'Untitled',
        category:    category || 'product',
        description: description || '',
        featured:    featured === 'true',
        src:         result.secure_url,
        date:        new Date().toISOString()
      };

      const db = readDB();
      db.items.unshift(item);
      writeDB(db);
      res.json(item);
    }
  );

  uploadStream.end(req.file.buffer);
});

app.post('/api/portfolio/writeup', auth, upload.single('cover'), (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });

  let coverUrl = null;

  if (req.file) {
    // Upload cover to Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'shahriar/writeups', resource_type: 'auto', timeout: 60000 },
      (error, result) => {
        if (!error) coverUrl = result.secure_url;
        finishWriteup();
      }
    );
    uploadStream.end(req.file.buffer);
  } else {
    finishWriteup();
  }

  function finishWriteup() {
    const item = {
      id:       uuid(),
      type:     'writeup',
      title,
      category: category || 'blog',
      content,
      cover:    coverUrl,
      date:     new Date().toISOString()
    };
    const db = readDB();
    db.items.unshift(item);
    writeDB(db);
    res.json(item);
  }
});

app.delete('/api/portfolio/:id', auth, (req, res) => {
  const db = readDB();
  const item = db.items.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  // Delete from Cloudinary if it's a Cloudinary URL
  if (item.src && item.src.includes('cloudinary')) {
    // Extract public_id from URL for deletion (optional - Cloudinary auto-cleans old files)
    // For now, just remove from portfolio
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
