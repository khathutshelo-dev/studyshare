const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

const users = [];
const studyMaterials = [];
const ratings = [];
const comments = [];
const savedMaterials = [];
const notifications = [];
const downloads = [];

let userIdCounter = 1;
let materialIdCounter = 1;
let ratingIdCounter = 1;
let commentIdCounter = 1;
let savedIdCounter = 1;
let notificationIdCounter = 1;
let downloadIdCounter = 1;

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

function getSafeUser(user) {
  return {
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
}

function getMaterialWithUploader(material) {
  const uploader = users.find((user) => user.id === material.user_id);
  return {
    ...material,
    uploader: uploader ? uploader.full_name : 'Unknown'
  };
}

function refreshMaterialRating(materialId) {
  const material = studyMaterials.find((entry) => entry.id === Number(materialId));
  if (!material) return;
  const materialRatings = ratings.filter((entry) => entry.material_id === Number(materialId));
  const average = materialRatings.length
    ? materialRatings.reduce((sum, item) => sum + item.score, 0) / materialRatings.length
    : 0;
  material.average_rating = Number(average.toFixed(2));
}

function createNotification(userId, message) {
  notifications.push({
    id: notificationIdCounter++,
    user_id: userId,
    message,
    is_read: false,
    created_at: new Date().toISOString()
  });
}

function seedData() {
  users.push({
    id: userIdCounter++,
    full_name: 'Demo Student',
    email: 'demo@student.com',
    password_hash: bcrypt.hashSync('password123', 10),
    bio: 'Sharing study resources for campus success',
    university: 'TUT',
    faculty: 'ICT',
    course: 'Computer Science',
    year_of_study: '2',
    profile_picture: '',
    created_at: new Date().toISOString()
  });

  studyMaterials.push({
    id: materialIdCounter++,
    user_id: 1,
    title: 'CAPF05X Programming Notes',
    description: 'Comprehensive notes for programming fundamentals.',
    university: 'TUT',
    faculty: 'ICT',
    course: 'Computer Science',
    module_code: 'CAPF05X',
    year: '2026',
    semester: '1',
    file_type: 'PDF',
    tags: 'notes,programming,capf05x',
    file_name: 'capf05x-notes.pdf',
    file_path: path.join(uploadsDir, 'sample.pdf'),
    downloads_count: 245,
    average_rating: 4.5,
    created_at: new Date().toISOString()
  });

  createNotification(1, 'Your file reached 100 downloads.');
}

app.get('/api/health', (req, res) => res.json({ ok: true, mode: 'memory' }));

app.post('/api/auth/register', async (req, res) => {
  const { fullName, email, password } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'Please provide full name, email and password' });
  }

  if (users.some((user) => user.email === email)) {
    return res.status(409).json({ error: 'A user with that email already exists' });
  }

  const user = {
    id: userIdCounter++,
    full_name: fullName,
    email,
    password_hash: await bcrypt.hash(password, 10),
    bio: '',
    university: '',
    faculty: '',
    course: '',
    year_of_study: '',
    profile_picture: '',
    created_at: new Date().toISOString()
  };
  users.push(user);
  const token = generateToken(user);
  res.status(201).json({ token, user: getSafeUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find((entry) => entry.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user);
  res.json({ token, user: getSafeUser(user) });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = users.find((entry) => entry.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user: getSafeUser(user) });
});

app.get('/api/dashboard', authenticateToken, (req, res) => {
  const userMaterials = studyMaterials.filter((item) => item.user_id === req.user.id);
  const savedCount = savedMaterials.filter((item) => item.user_id === req.user.id).length;
  res.json({
    totals: {
      uploaded: userMaterials.length,
      downloads: userMaterials.reduce((sum, item) => sum + item.downloads_count, 0),
      saved: savedCount
    },
    recentUploads: userMaterials.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    notifications: notifications.filter((item) => item.user_id === req.user.id).slice(0, 5)
  });
});

app.post('/api/materials', authenticateToken, upload.single('file'), (req, res) => {
  const { title, description, university, faculty, course, moduleCode, year, semester, fileType, tags } = req.body;
  if (!req.file || !title || !university || !faculty || !course || !moduleCode || !year || !semester || !fileType) {
    return res.status(400).json({ error: 'Please include all required fields and upload a file' });
  }

  const material = {
    id: materialIdCounter++,
    user_id: req.user.id,
    title,
    description,
    university,
    faculty,
    course,
    module_code: moduleCode,
    year,
    semester,
    file_type: fileType,
    tags,
    file_name: req.file.originalname,
    file_path: req.file.path,
    downloads_count: 0,
    average_rating: 0,
    created_at: new Date().toISOString()
  };
  studyMaterials.push(material);
  createNotification(req.user.id, `Your material "${title}" was uploaded successfully.`);
  res.status(201).json({ material: getMaterialWithUploader(material) });
});

app.get('/api/materials', (req, res) => {
  const { search, university, faculty, course, module, year, semester, fileType } = req.query;
  const filtered = studyMaterials.filter((material) => {
    const term = search ? search.toLowerCase() : '';
    const matchesSearch = !term || [material.title, material.description, material.module_code, material.course, material.tags].some((value) => (value || '').toLowerCase().includes(term));
    const matchesUniversity = !university || material.university.toLowerCase().includes(university.toLowerCase());
    const matchesFaculty = !faculty || material.faculty.toLowerCase().includes(faculty.toLowerCase());
    const matchesCourse = !course || material.course.toLowerCase().includes(course.toLowerCase());
    const matchesModule = !module || material.module_code.toLowerCase().includes(module.toLowerCase());
    const matchesYear = !year || material.year.toLowerCase().includes(year.toLowerCase());
    const matchesSemester = !semester || material.semester.toLowerCase().includes(semester.toLowerCase());
    const matchesFileType = !fileType || material.file_type.toLowerCase().includes(fileType.toLowerCase());
    return matchesSearch && matchesUniversity && matchesFaculty && matchesCourse && matchesModule && matchesYear && matchesSemester && matchesFileType;
  });
  res.json({ materials: filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(getMaterialWithUploader) });
});

app.get('/api/materials/:id', (req, res) => {
  const material = studyMaterials.find((entry) => entry.id === Number(req.params.id));
  if (!material) {
    return res.status(404).json({ error: 'Material not found' });
  }
  res.json({
    material: getMaterialWithUploader(material),
    comments: comments.filter((entry) => entry.material_id === Number(req.params.id)).map((comment) => ({ ...comment, user_name: users.find((user) => user.id === comment.user_id)?.full_name || 'Student' })),
    ratings: ratings.filter((entry) => entry.material_id === Number(req.params.id))
  });
});

app.post('/api/materials/:id/rate', authenticateToken, (req, res) => {
  const { score } = req.body;
  const existing = ratings.find((entry) => entry.material_id === Number(req.params.id) && entry.user_id === req.user.id);
  if (existing) {
    existing.score = Number(score);
  } else {
    ratings.push({ id: ratingIdCounter++, material_id: Number(req.params.id), user_id: req.user.id, score: Number(score) });
  }
  refreshMaterialRating(req.params.id);
  const material = studyMaterials.find((entry) => entry.id === Number(req.params.id));
  res.json({ averageRating: material.average_rating });
});

app.post('/api/materials/:id/comment', authenticateToken, (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Comment content is required' });
  }
  const comment = { id: commentIdCounter++, material_id: Number(req.params.id), user_id: req.user.id, content, created_at: new Date().toISOString() };
  comments.push(comment);
  res.status(201).json({ comment });
});

app.post('/api/materials/:id/save', authenticateToken, (req, res) => {
  const existing = savedMaterials.find((entry) => entry.user_id === req.user.id && entry.material_id === Number(req.params.id));
  if (existing) {
    const index = savedMaterials.indexOf(existing);
    savedMaterials.splice(index, 1);
    return res.json({ saved: false });
  }
  savedMaterials.push({ id: savedIdCounter++, user_id: req.user.id, material_id: Number(req.params.id), saved_at: new Date().toISOString() });
  res.json({ saved: true });
});

app.get('/api/materials/:id/download', (req, res) => {
  const material = studyMaterials.find((entry) => entry.id === Number(req.params.id));
  if (!material) {
    return res.status(404).json({ error: 'Material not found' });
  }
  material.downloads_count += 1;
  downloads.push({ id: downloadIdCounter++, material_id: Number(req.params.id), user_id: req.user ? req.user.id : null, downloaded_at: new Date().toISOString() });
  res.download(material.file_path, material.file_name);
});

app.get('/api/uploads', authenticateToken, (req, res) => {
  const userMaterials = studyMaterials.filter((item) => item.user_id === req.user.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json({ materials: userMaterials });
});

app.put('/api/uploads/:id', authenticateToken, upload.single('file'), (req, res) => {
  const material = studyMaterials.find((entry) => entry.id === Number(req.params.id) && entry.user_id === req.user.id);
  if (!material) {
    return res.status(404).json({ error: 'Upload not found' });
  }
  if (req.body.title) material.title = req.body.title;
  if (req.body.description !== undefined) material.description = req.body.description;
  if (req.file) {
    material.file_name = req.file.originalname;
    material.file_path = req.file.path;
  }
  res.json({ material });
});

app.delete('/api/uploads/:id', authenticateToken, (req, res) => {
  const index = studyMaterials.findIndex((entry) => entry.id === Number(req.params.id) && entry.user_id === req.user.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Upload not found' });
  }
  studyMaterials.splice(index, 1);
  res.json({ success: true });
});

app.get('/api/saved', authenticateToken, (req, res) => {
  const saved = savedMaterials.filter((entry) => entry.user_id === req.user.id).map((entry) => {
    const material = studyMaterials.find((item) => item.id === entry.material_id);
    return { ...entry, title: material?.title || 'Material', file_name: material?.file_name || '', file_type: material?.file_type || '', university: material?.university || '', course: material?.course || '', module_code: material?.module_code || '' };
  });
  res.json({ materials: saved });
});

app.get('/api/notifications', authenticateToken, (req, res) => {
  res.json({ notifications: notifications.filter((entry) => entry.user_id === req.user.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) });
});

app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const notification = notifications.find((entry) => entry.id === Number(req.params.id) && entry.user_id === req.user.id);
  if (notification) {
    notification.is_read = true;
  }
  res.json({ success: true });
});

app.get('/api/profile', authenticateToken, (req, res) => {
  const user = users.find((entry) => entry.id === req.user.id);
  res.json({ user: getSafeUser(user) });
});

app.put('/api/profile', authenticateToken, (req, res) => {
  const user = users.find((entry) => entry.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { fullName, bio, university, faculty, course, yearOfStudy } = req.body;
  user.full_name = fullName || user.full_name;
  user.bio = bio || user.bio;
  user.university = university || user.university;
  user.faculty = faculty || user.faculty;
  user.course = course || user.course;
  user.year_of_study = yearOfStudy || user.year_of_study;
  res.json({ user: getSafeUser(user) });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

seedData();

app.listen(port, () => {
  console.log(`StudyShare app listening on http://localhost:${port}`);
});
