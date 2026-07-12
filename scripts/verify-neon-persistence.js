const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const email = `persist${Date.now()}@example.com`;
  const response = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Persistence Test', email, password: 'pass123' })
  });
  const data = await response.json();
  console.log('register-status', response.status);
  console.log('register-response', JSON.stringify(data));

  const result = await pool.query('SELECT email FROM users WHERE email = $1', [email]);
  console.log('db-rows', JSON.stringify(result.rows));

  await pool.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
