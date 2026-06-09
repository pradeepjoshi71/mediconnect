const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function run() {
  console.log('Starting MediConnect Database Migration Runner...');

  try {
    // 1. Check if hospitals table exists to determine if we need to run bootstrap schema
    const checkTableRes = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'hospitals'
      )
    `);
    const hospitalsTableExists = checkTableRes.rows[0].exists;

    // 2. Create migration tracking table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // 3. If hospitals table does not exist, run the bootstrap init.sql
    if (!hospitalsTableExists) {
      console.log('Hospitals table not found. Bootstrapping initial schema (init.sql)...');
      const initSqlPath = path.join(__dirname, '../../../database/init.sql');
      const initSql = fs.readFileSync(initSqlPath, 'utf8');
      
      await db.withTransaction(async (client) => {
        await client.query(initSql);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
          ['001_init.sql']
        );
      });
      console.log('Initial schema bootstrap (init.sql) applied successfully.');
    } else {
      console.log('Hospitals table already exists. Skipping init.sql bootstrap.');
      // Mark 001_init.sql as applied if not already
      await db.query(
        'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
        ['001_init.sql']
      );
    }

    // 4. Read and sort all migration files in migrations directory
    const migrationsDir = path.join(__dirname, '../../../database/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sorting ensures sequential execution (002, 003, ..., 016)

    console.log(`Found ${files.length} migration files in migrations directory.`);

    // 5. Apply each migration sequentially in a transaction if not already applied
    for (const file of files) {
      const checkRes = await db.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [file]
      );
      if (checkRes.rows.length > 0) {
        console.log(`Migration ${file} is already applied. Skipping.`);
        continue;
      }

      console.log(`Applying migration: ${file}...`);
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      await db.withTransaction(async (client) => {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1)',
          [file]
        );
      });
      console.log(`Migration ${file} applied successfully.`);
    }

    console.log('All migrations applied successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration execution failed:', err);
    process.exit(1);
  }
}

run();
