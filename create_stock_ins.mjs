import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  try {
    await sql`
      ALTER TABLE quota_accumulations
      ADD COLUMN IF NOT EXISTS source_item_id INTEGER REFERENCES delivery_items(id) ON DELETE CASCADE
    `;
    console.log("Added source_item_id to quota_accumulations if it did not exist!");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
