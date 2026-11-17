const mysql = require('mysql2/promise');

let pool;

function getDatabaseConfig() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('Database is not configured. Set DATABASE_URL to your MySQL connection string.');
    error.statusCode = 503;
    throw error;
  }

  try {
    const url = new URL(process.env.DATABASE_URL);

    if (!['mysql:', 'mysql2:'].includes(url.protocol)) {
      throw new Error('DATABASE_URL must use a MySQL connection string like mysql://user:password@host:3306/database');
    }

    const config = {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password || ''),
      database: url.pathname.replace(/^\/+/, ''),
      charset: 'utf8mb4',
      timezone: 'Z',
      namedPlaceholders: false,
      multipleStatements: false,
      connectionLimit: 5,
      waitForConnections: true,
      queueLimit: 0
    };

    if (process.env.DB_SSL === 'true') {
      config.ssl = { rejectUnauthorized: false };
    }

    return config;
  } catch (error) {
    if (error instanceof TypeError) {
      return {
        uri: process.env.DATABASE_URL,
        charset: 'utf8mb4',
        timezone: 'Z',
        connectionLimit: 5,
        waitForConnections: true,
        queueLimit: 0
      };
    }
    throw error;
  }
}

function getPool() {
  if (!pool) {
    const config = getDatabaseConfig();
    pool = mysql.createPool(config);
  }
  return pool;
}

module.exports = { getPool };
