const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'pizarra',
  password: 'Unklow33',
  port: 5432
});

module.exports = pool;
