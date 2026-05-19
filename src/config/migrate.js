require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./database');

const rootSchemaPath = path.join(__dirname, '../../schema.sql');
const migrationsDir = path.join(__dirname, '../../sql/migrations');

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName],
  );
  return rows[0].exists;
}

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running database migrations...');

    const hasBaseSchema = await tableExists(client, 'users');
    if (!hasBaseSchema) {
      console.log('Applying base schema...');
      const sql = fs.readFileSync(rootSchemaPath, 'utf8');
      await client.query(sql);
    } else {
      console.log('Base schema already exists, skipping schema.sql.');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    if (fs.existsSync(migrationsDir)) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const applied = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
        if (applied.rows.length) {
          console.log(`Skipping ${file}, already applied.`);
          continue;
        }
        console.log(`Applying ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const noTransactionNeeded = /\bVACUUM\b/i.test(sql);
        try {
          if (noTransactionNeeded) {
            const parts = sql.split(/(^|\n)(?=\s*VACUUM\b)/i);
            const transactionalSql = parts[0].trim();
            const vacuumSql = parts.slice(1).join('').trim();

            await client.query('BEGIN');
            if (transactionalSql) {
              await client.query(transactionalSql);
            }
            await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
            await client.query('COMMIT');

            if (vacuumSql) {
              await client.query(vacuumSql);
            }
          } else {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
            await client.query('COMMIT');
          }
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          console.error(`Migration failed while applying ${file}.`);
          throw err;
        }
      }
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
