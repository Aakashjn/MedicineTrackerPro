exports.up = function(knex) {
  return knex.schema
    .createTable('users', function(table) {
      table.increments('id').primary(); // Auto-incrementing primary key
      table.string('username').notNullable().unique();
      table.string('email').notNullable().unique();
      table.string('password').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now()); // PostgreSQL equivalent of CURRENT_TIMESTAMP
    })
    .createTable('medicines', function(table) {
      table.increments('id').primary();
      // Foreign key with cascading delete: if user is deleted, their medicines are deleted
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('name').notNullable();
      table.string('dosage').notNullable();
      table.string('frequency').notNullable();
      table.date('start_date').notNullable();
      table.date('end_date');
      table.text('notes');
      table.boolean('active').defaultTo(true); // Default boolean value
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('schedules', function(table) {
      table.increments('id').primary();
      table.integer('medicine_id').notNullable().references('id').inTable('medicines').onDelete('CASCADE');
      table.time('scheduled_time').notNullable();
      table.boolean('taken').defaultTo(false);
      table.timestamp('taken_at'); // Nullable timestamp
      table.date('scheduled_date').defaultTo(knex.fn.now());
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('medicine_history', function(table) {
      table.increments('id').primary();
      table.integer('medicine_id').notNullable().references('id').inTable('medicines').onDelete('CASCADE');
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('taken_at').notNullable();
      table.string('status').defaultTo('taken'); // 'taken', 'missed', etc.
      table.text('notes');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('reminders', function(table) {
      table.increments('id').primary();
      table.integer('medicine_id').notNullable().references('id').inTable('medicines').onDelete('CASCADE');
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.time('reminder_time').notNullable();
      table.boolean('enabled').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  // This function defines how to "undo" the migration (for rollbacks).
  // Drop tables in reverse order of creation to avoid foreign key issues.
  return knex.schema
    .dropTableIfExists('reminders')
    .dropTableIfExists('medicine_history')
    .dropTableIfExists('schedules')
    .dropTableIfExists('medicines')
    .dropTableIfExists('users');
};