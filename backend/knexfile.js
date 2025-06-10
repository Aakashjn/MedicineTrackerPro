// backend/knexfile.js

// Load environment variables from the project root .env file
// This ensures that DATABASE_URL_DEVELOPMENT (and other variables) are available
// when running 'npx knex' commands locally.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

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
      directory: './migrations', // Directory for migration files (relative to knexfile.js)
      tableName: 'knex_migrations', // Table to track applied migrations
    },
    seeds: {
      directory: './seeds' // Optional: for seeding initial data
    }
  },

  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL, // Railway provides DATABASE_URL
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
    pool: {
      min: 2,
      max: 10
    }
  }
};
