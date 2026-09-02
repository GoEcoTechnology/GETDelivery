const postgres = require('postgres');
require('dotenv').config({ path: '.env' });
const sql = postgres(process.env.DATABASE_URL);

async function fix() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS platform_delivery_settings (
        id SERIAL PRIMARY KEY,
        price_per_km DECIMAL(10, 2) NOT NULL DEFAULT '0',
        currency_code VARCHAR(10) NOT NULL DEFAULT 'PHP',
        updated_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    console.log('Created platform_delivery_settings');

    await sql`
      CREATE TABLE IF NOT EXISTS vehicle_delivery_rates (
        id SERIAL PRIMARY KEY,
        vehicle_type VARCHAR(100) NOT NULL UNIQUE,
        base_price DECIMAL(10, 2) NOT NULL DEFAULT '0',
        is_active BOOLEAN NOT NULL DEFAULT true,
        updated_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    console.log('Created vehicle_delivery_rates');

    // Create an initial platform settings row if it doesn't exist
    await sql`
      INSERT INTO platform_delivery_settings (price_per_km, currency_code, updated_by)
      SELECT 20, 'PHP', 1
      WHERE NOT EXISTS (SELECT 1 FROM platform_delivery_settings);
    `;
    console.log('Inserted default platform_delivery_settings');

    // Create default vehicle rates
    const vehicles = [
      { type: 'Motorcycle', price: 50 },
      { type: 'Car', price: 100 },
      { type: 'Van', price: 200 }
    ];
    for (const v of vehicles) {
      await sql`
        INSERT INTO vehicle_delivery_rates (vehicle_type, base_price)
        VALUES (${v.type}, ${v.price})
        ON CONFLICT (vehicle_type) DO NOTHING;
      `;
    }
    console.log('Inserted default vehicle_delivery_rates');

  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

fix();
