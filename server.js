const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const jwtSecret = process.env.JWT_SECRET || 'study-share-secret';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: '7d' });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

async function query(text, params = []) {
  return pool.query(text, params);
}

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      bio TEXT DEFAULT '',
      university TEXT DEFAULT '',
      faculty TEXT DEFAULT '',
      course TEXT DEFAULT '',
      year_of_study TEXT DEFAULT '',
      profile_picture TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS universities (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS faculties (
      id SERIAL PRIMARY KEY,
      university_name TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS courses (
      id SERIAL PRIMARY KEY,
      faculty_name TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS modules (
      id SERIAL PRIMARY KEY,
      course_name TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS study_materials (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      university TEXT NOT NULL,
      faculty TEXT NOT NULL,
      course TEXT NOT NULL,
      module_code TEXT NOT NULL,
      year TEXT NOT NULL,
      semester TEXT NOT NULL,
      file_type TEXT NOT NULL,
      tags TEXT DEFAULT '',
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      downloads_count INTEGER DEFAULT 0,
      average_rating NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS downloads (
      id SERIAL PRIMARY KEY,
      material_id INTEGER REFERENCES study_materials(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ratings (
      id SERIAL PRIMARY KEY,
      material_id INTEGER REFERENCES study_materials(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(material_id, user_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      material_id INTEGER REFERENCES study_materials(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS saved_materials (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      material_id INTEGER REFERENCES study_materials(id) ON DELETE CASCADE,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, material_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await seedData();
}

async function seedData() {
  const { rows: uniRows } = await query('SELECT COUNT(*)::int AS count FROM universities');
  if (uniRows[0].count === 0) {
    await query(`INSERT INTO universities (name) VALUES ('TUT'), ('UJ'), ('UP')`);
    await query(`INSERT INTO faculties (university_name, name) VALUES ('TUT', 'ICT'), ('TUT', 'Engineering'), ('UJ', 'Science')`);
    await query(`INSERT INTO courses (faculty_name, name) VALUES ('ICT', 'Computer Science'), ('ICT', 'Information Technology'), ('Engineering', 'Mechanical Engineering')`);
    await query(`INSERT INTO modules (course_name, code, name) VALUES ('Computer Science', 'CAPF05X', 'Programming Fundamentals'), ('Information Technology', 'ITM101', 'Computer Literacy')`);
    await query(`INSERT INTO categories (name) VALUES ('Notes'), ('Past Papers'), ('Assignments'), ('Slides')`);
  }
}

async function refreshMaterialRating(materialId) {
  const { rows } = await query('SELECT AVG(score)::numeric(10,2) AS avg FROM ratings WHERE material_id = $1', [materialId]);
  const average = rows[0].avg || 0;
  await query('UPDATE study_materials SET average_rating = $2 WHERE id = $1', [materialId, average]);
}

async function createNotification(userId, message) {
  await query('INSERT INTO notifications (user_id, message) VALUES ($1, $2)', [userId, message]);
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/register', async (req, res) => {
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Please provide full name, email and password' });
  }

  try {
    const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'A user with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name, email, university, faculty, course, year_of_study, bio, profile_picture',
      [fullName, email, passwordHash]
    );

    const user = result.rows[0];
    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    const safeUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      university: user.university,
      faculty: user.faculty,
      course: user.course,
      year_of_study: user.year_of_study,
      bio: user.bio,
      profile_picture: user.profile_picture
    };
    res.json({ token, user: safeUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT id, full_name, email, university, faculty, course, year_of_study, bio, profile_picture FROM users WHERE id = $1', [req.user.id]);
    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Unable to load user profile' });
  }
});

app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const uploaded = await query('SELECT COUNT(*)::int AS count FROM study_materials WHERE user_id = $1', [req.user.id]);
    const downloads = await query(`SELECT COALESCE(SUM(downloads_count), 0)::int AS count FROM study_materials WHERE user_id = $1`, [req.user.id]);
    const recent = await query(`SELECT * FROM study_materials WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`, [req.user.id]);
    const saved = await query(`SELECT COUNT(*)::int AS count FROM saved_materials WHERE user_id = $1`, [req.user.id]);
    const notifications = await query(`SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`, [req.user.id]);

    res.json({
      totals: {
        uploaded: uploaded.rows[0].count,
        downloads: downloads.rows[0].count,
        saved: saved.rows[0].count
      },
      recentUploads: recent.rows,
      notifications: notifications.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load dashboard' });
  }
});

app.post('/api/materials', authenticateToken, upload.single('file'), async (req, res) => {
  const { title, description, university, faculty, course, moduleCode, year, semester, fileType, tags } = req.body;
  if (!req.file || !title || !university || !faculty || !course || !moduleCode || !year || !semester || !fileType) {
    return res.status(400).json({ error: 'Please include all required fields and upload a file' });
  }

  try {
    const result = await query(
      `INSERT INTO study_materials (user_id, title, description, university, faculty, course, module_code, year, semester, file_type, tags, file_name, file_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [req.user.id, title, description, university, faculty, course, moduleCode, year, semester, fileType, tags, req.file.originalname, req.file.path]
    );
    await createNotification(req.user.id, `Your material "${title}" was uploaded successfully.`);
    res.status(201).json({ material: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/materials', async (req, res) => {
  const { search, university, faculty, course, module, year, semester, fileType } = req.query;
  let queryText = `SELECT m.*, u.full_name AS uploader FROM study_materials m LEFT JOIN users u ON u.id = m.user_id WHERE 1=1`;
  const values = [];
  let index = 1;

  if (search) {
    queryText += ` AND (m.title ILIKE $${index} OR m.description ILIKE $${index} OR m.module_code ILIKE $${index} OR m.course ILIKE $${index} OR m.tags ILIKE $${index})`;
    values.push(`%${search}%`);
    index += 1;
  }
  if (university) {
    queryText += ` AND m.university ILIKE $${index}`;
    values.push(`%${university}%`);
    index += 1;
  }
  if (faculty) {
    queryText += ` AND m.faculty ILIKE $${index}`;
    values.push(`%${faculty}%`);
    index += 1;
  }
  if (course) {
    queryText += ` AND m.course ILIKE $${index}`;
    values.push(`%${course}%`);
    index += 1;
  }
  if (module) {
    queryText += ` AND m.module_code ILIKE $${index}`;
    values.push(`%${module}%`);
    index += 1;
  }
  if (year) {
    queryText += ` AND m.year ILIKE $${index}`;
    values.push(`%${year}%`);
    index += 1;
  }
  if (semester) {
    queryText += ` AND m.semester ILIKE $${index}`;
    values.push(`%${semester}%`);
    index += 1;
  }
  if (fileType) {
    queryText += ` AND m.file_type ILIKE $${index}`;
    values.push(`%${fileType}%`);
    index += 1;
  }

  queryText += ' ORDER BY m.created_at DESC';
  try {
    const result = await query(queryText, values);
    res.json({ materials: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load materials' });
  }
});

app.get('/api/materials/:id', async (req, res) => {
  try {
    const materialResult = await query(`SELECT m.*, u.full_name AS uploader FROM study_materials m LEFT JOIN users u ON u.id = m.user_id WHERE m.id = $1`, [req.params.id]);
    const commentsResult = await query(`SELECT c.*, u.full_name AS user_name FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.material_id = $1 ORDER BY c.created_at DESC`, [req.params.id]);
    const ratingsResult = await query('SELECT score FROM ratings WHERE material_id = $1', [req.params.id]);
    res.json({ material: materialResult.rows[0], comments: commentsResult.rows, ratings: ratingsResult.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load material details' });
  }
});

app.post('/api/materials/:id/rate', authenticateToken, async (req, res) => {
  const { score } = req.body;
  try {
    await query('INSERT INTO ratings (material_id, user_id, score) VALUES ($1, $2, $3) ON CONFLICT (material_id, user_id) DO UPDATE SET score = EXCLUDED.score', [req.params.id, req.user.id, score]);
    await refreshMaterialRating(req.params.id);
    const updated = await query('SELECT average_rating FROM study_materials WHERE id = $1', [req.params.id]);
    res.json({ averageRating: updated.rows[0].average_rating });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to submit rating' });
  }
});

app.post('/api/materials/:id/comment', authenticateToken, async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Comment content is required' });
  }
  try {
    const result = await query('INSERT INTO comments (material_id, user_id, content) VALUES ($1, $2, $3) RETURNING *', [req.params.id, req.user.id, content]);
    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to post comment' });
  }
});

app.post('/api/materials/:id/save', authenticateToken, async (req, res) => {
  try {
    const existing = await query('SELECT id FROM saved_materials WHERE user_id = $1 AND material_id = $2', [req.user.id, req.params.id]);
    if (existing.rows.length) {
      await query('DELETE FROM saved_materials WHERE user_id = $1 AND material_id = $2', [req.user.id, req.params.id]);
      return res.json({ saved: false });
    }
    await query('INSERT INTO saved_materials (user_id, material_id) VALUES ($1, $2)', [req.user.id, req.params.id]);
    res.json({ saved: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update saved materials' });
  }
});

app.get('/api/materials/:id/download', async (req, res) => {
  try {
    const result = await query('SELECT id, file_path, file_name, title FROM study_materials WHERE id = $1', [req.params.id]);
    const material = result.rows[0];
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    await query('UPDATE study_materials SET downloads_count = downloads_count + 1 WHERE id = $1', [req.params.id]);
    await query('INSERT INTO downloads (material_id, user_id) VALUES ($1, $2)', [req.params.id, req.user ? req.user.id : null]);
    res.download(material.file_path, material.file_name);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Download failed' });
  }
});

app.get('/api/uploads', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM study_materials WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ materials: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to fetch your uploads' });
  }
});

app.put('/api/uploads/:id', authenticateToken, upload.single('file'), async (req, res) => {
  const { title, description } = req.body;
  try {
    const existing = await query('SELECT * FROM study_materials WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    const material = existing.rows[0];
    const nextTitle = title || material.title;
    const nextDescription = description || material.description;
    const nextFileName = req.file ? req.file.originalname : material.file_name;
    const nextFilePath = req.file ? req.file.path : material.file_path;
    const result = await query(
      `UPDATE study_materials SET title = $1, description = $2, file_name = $3, file_path = $4 WHERE id = $5 AND user_id = $6 RETURNING *`,
      [nextTitle, nextDescription, nextFileName, nextFilePath, req.params.id, req.user.id]
    );
    res.json({ material: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update upload' });
  }
});

app.delete('/api/uploads/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('DELETE FROM study_materials WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Upload not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to delete upload' });
  }
});

app.get('/api/saved', authenticateToken, async (req, res) => {
  try {
    const result = await query(`SELECT sm.*, m.title, m.file_name, m.file_type, m.university, m.course, m.module_code
      FROM saved_materials sm
      JOIN study_materials m ON m.id = sm.material_id
      WHERE sm.user_id = $1
      ORDER BY sm.saved_at DESC`, [req.user.id]);
    res.json({ materials: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load saved materials' });
  }
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ notifications: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load notifications' });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update notification' });
  }
});

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to load profile' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  const { fullName, bio, university, faculty, course, yearOfStudy } = req.body;
  try {
    const result = await query(
      `UPDATE users SET full_name = $1, bio = $2, university = $3, faculty = $4, course = $5, year_of_study = $6 WHERE id = $7 RETURNING id, full_name, email, university, faculty, course, year_of_study, bio, profile_picture`,
      [fullName, bio, university, faculty, course, yearOfStudy, req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update profile' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  try {
    await initDb();
    app.listen(port, () => {
      console.log(`StudyShare app listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

start();
