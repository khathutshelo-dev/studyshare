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

CREATE TABLE IF NOT EXISTS universities (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faculties (
  id SERIAL PRIMARY KEY,
  university_name TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  faculty_name TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS modules (
  id SERIAL PRIMARY KEY,
  course_name TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS downloads (
  id SERIAL PRIMARY KEY,
  material_id INTEGER REFERENCES study_materials(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  material_id INTEGER REFERENCES study_materials(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(material_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  material_id INTEGER REFERENCES study_materials(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saved_materials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES study_materials(id) ON DELETE CASCADE,
  saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, material_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO universities (name)
SELECT 'TUT' WHERE NOT EXISTS (SELECT 1 FROM universities WHERE name = 'TUT');

INSERT INTO universities (name)
SELECT 'UJ' WHERE NOT EXISTS (SELECT 1 FROM universities WHERE name = 'UJ');

INSERT INTO universities (name)
SELECT 'UP' WHERE NOT EXISTS (SELECT 1 FROM universities WHERE name = 'UP');

INSERT INTO faculties (university_name, name)
SELECT 'TUT', 'ICT' WHERE NOT EXISTS (SELECT 1 FROM faculties WHERE university_name = 'TUT' AND name = 'ICT');

INSERT INTO faculties (university_name, name)
SELECT 'TUT', 'Engineering' WHERE NOT EXISTS (SELECT 1 FROM faculties WHERE university_name = 'TUT' AND name = 'Engineering');

INSERT INTO faculties (university_name, name)
SELECT 'UJ', 'Science' WHERE NOT EXISTS (SELECT 1 FROM faculties WHERE university_name = 'UJ' AND name = 'Science');

INSERT INTO courses (faculty_name, name)
SELECT 'ICT', 'Computer Science' WHERE NOT EXISTS (SELECT 1 FROM courses WHERE faculty_name = 'ICT' AND name = 'Computer Science');

INSERT INTO courses (faculty_name, name)
SELECT 'ICT', 'Information Technology' WHERE NOT EXISTS (SELECT 1 FROM courses WHERE faculty_name = 'ICT' AND name = 'Information Technology');

INSERT INTO courses (faculty_name, name)
SELECT 'Engineering', 'Mechanical Engineering' WHERE NOT EXISTS (SELECT 1 FROM courses WHERE faculty_name = 'Engineering' AND name = 'Mechanical Engineering');

INSERT INTO modules (course_name, code, name)
SELECT 'Computer Science', 'CAPF05X', 'Programming Fundamentals' WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code = 'CAPF05X');

INSERT INTO modules (course_name, code, name)
SELECT 'Information Technology', 'ITM101', 'Computer Literacy' WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code = 'ITM101');

INSERT INTO categories (name)
SELECT 'Notes' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Notes');

INSERT INTO categories (name)
SELECT 'Past Papers' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Past Papers');

INSERT INTO categories (name)
SELECT 'Assignments' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Assignments');

INSERT INTO categories (name)
SELECT 'Slides' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Slides');
