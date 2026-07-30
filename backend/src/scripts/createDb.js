const { Client } = require('pg');

async function main() {
  const clientConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    port: Number(process.env.DB_PORT || 5432),
    database: 'postgres', // connect to default 'postgres' database first
  };

  const client = new Client(clientConfig);

  try {
    await client.connect();
    const dbName = process.env.DB_NAME || 'mediconnect';
    console.log(`Checking if database "${dbName}" exists...`);
    
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    
    if (res.rows.length === 0) {
      console.log(`Database "${dbName}" does not exist. Creating...`);
      // CREATE DATABASE cannot run inside a transaction block, so we execute it directly
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created successfully.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
    
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Error creating database:', err.message);
    process.exit(1);
  }
}

main();
