const fs = require('fs');
const path = require('path');
const envFile = path.join(__dirname, '.env');
const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter(Boolean);
const env = {};
for (const line of lines) {
  const idx = line.indexOf('=');
  if (idx > -1) env[line.slice(0, idx)] = line.slice(idx + 1);
}
const postgres = require('postgres');
const sql = postgres(env.DATABASE_URL, { prepare: false });
(async () => {
  try {
    const rows = await sql`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_name = 'delivery_orders' order by ordinal_position`;
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('ERR:', err && err.message ? err.message : err);
    console.error(err && err.stack ? err.stack : '');
  } finally {
    await sql.end();
  }
})();
