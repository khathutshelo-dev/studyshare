# StudyShare

StudyShare is a web application for students to upload, browse, search, rate, comment on, bookmark, and download study materials.
<a href="https://studyshare-cd06.onrender.com/">LIVE DEMO</a>
## Features
- User registration and login
- JWT authentication
- Student dashboard
- Upload study materials
- Browse and search resources
- Download tracking
- Ratings and comments
- Saved materials
- Profile management

## Tech Stack
- Node.js
- Express.js
- PostgreSQL
- Neon
- HTML, CSS, and JavaScript

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Neon PostgreSQL database and copy the connection string to `.env`:
   ```env
   DATABASE_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require
   JWT_SECRET=study-share-secret
   PORT=3000
   ```
3. Initialize the database schema:
   ```bash
   npm run init:neon
   ```
4. Start the app:
   ```bash
   npm start
   ```

## Demo Login
- Email: demo@student.com
- Password: password123

## Project Structure
- `server.js` – Express server and API routes
- `public/` – frontend pages and assets
- `db/schema.sql` – database schema for Neon
- `scripts/init-neon.js` – schema initialization script

## Notes
The app currently uses the Neon-backed server implementation for persistent storage.
