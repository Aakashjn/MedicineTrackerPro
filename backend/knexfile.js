// backend/knexfile.js

// Load environment variables immediately and absolutely.
// This ensures variables are available regardless of how knex is invoked.
// If your .env is in the project root (one level up from 'backend'), this path is correct.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

module.exports = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL_DEVELOPMENT || {
      host: process.env.DB_HOST_DEV || 'localhost',
      port: process.env.DB_PORT_DEV || 5432,
      user: process.env.DB_USER_DEV || 'postgres', // <<< IMPORTANT: Your local PG username
      password: process.env.DB_PASSWORD_DEV || 'your_local_pg_password', // <<< IMPORTANT: Your local PG password
      database: process.env.DB_NAME_DEV || 'medicine_tracker_dev', // <<< IMPORTANT: Your local PG database name
    },
    migrations: {
      directory: './migrations', // This path is relative to knexfile.js, which is in 'backend'
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds'
    }
  },

  production: {
    client: 'pg',
    // In production (e.g., on Railway), DATABASE_URL will be provided by the environment.
    // We explicitly set it to process.env.DATABASE_URL.
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './migrations', // This path is relative to knexfile.js, which is in 'backend'
      tableName: 'knex_migrations',
    },
    pool: {
      min: 2,
      max: 10
    }
    // ssl: { rejectUnauthorized: false } // Uncomment if your production DB requires self-signed certs
  }
};
