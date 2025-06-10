// backend/knexfile.js

// Ensure dotenv loads environment variables for local testing
// Adjust path if your .env file is in the project root, not backend/
require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? null : '../.env' });

module.exports = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL_DEVELOPMENT || {
      host: process.env.DB_HOST_DEV || 'localhost',
      port: process.env.DB_PORT_DEV || 5432,
      user: process.env.DB_USER_DEV || 'postgres', // <<< IMPORTANT: Use your actual local PostgreSQL username
      password: process.env.DB_PASSWORD_DEV || 'your_local_pg_password', // <<< IMPORTANT: Use your actual local PostgreSQL password
      database: process.env.DB_NAME_DEV || 'medicine_tracker_dev', // <<< IMPORTANT: Use your actual local PostgreSQL database name
    },
    migrations: {
      directory: './migrations', // Directory for migration files
      tableName: 'knex_migrations', // Table to track applied migrations
    },
    seeds: {
      directory: './seeds' // Optional: for seeding initial data
    }
  },

  production: {
    client: 'pg',
    // Railway automatically provides DATABASE_URL to your application service.
    // Knex will pick this up.
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
    pool: { // Connection pool settings for production
      min: 2,
      max: 10
    },
    // Optional: if you need to enable SSL for secure connection on some cloud providers
    // ssl: { rejectUnauthorized: false }
  }
};
