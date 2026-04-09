import pg from "pg";

const { Client } = pg;
const dbName = process.env.LISTING_DB_NAME || "agromarket_listing";
const adminUrl = process.env.LISTING_DB_ADMIN_URL || "postgresql://agromarket:agromarket@localhost:5432/postgres";

const client = new Client({ connectionString: adminUrl });

try {
  await client.connect();
  const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (res.rowCount > 0) {
    console.log(`exists:${dbName}`);
  } else {
    await client.query(`CREATE DATABASE ${dbName}`);
    console.log(`created:${dbName}`);
  }
} finally {
  await client.end();
}
