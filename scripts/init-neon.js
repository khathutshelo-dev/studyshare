const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await pool.query(schemaSql);
    console.log('Neon database schema initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Neon database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
