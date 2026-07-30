const { Client } = require('pg');

async function main() {
  const clientConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'mediconnect',
  };

  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('Altering hospitals.support_phone type to VARCHAR(255)...');
    await client.query('ALTER TABLE hospitals ALTER COLUMN support_phone TYPE VARCHAR(255)');
    console.log('Column altered successfully.');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Error altering column:', err.message);
    process.exit(1);
  }
}

main();
