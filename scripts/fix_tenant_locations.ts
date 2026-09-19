import * as dotenv from 'dotenv';
dotenv.config();
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!.replace(':6543', ':5432'), { ssl: 'require', max: 1 });
  
  const tenants = await sql`SELECT id, lat, lng FROM tenants WHERE address = 'My Current Location' AND lat IS NOT NULL AND lng IS NOT NULL`;
  
  for (const t of tenants) {
    try {
      console.log(`Reverse geocoding tenant ${t.id} at ${t.lat}, ${t.lng}...`);
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${t.lat}&lon=${t.lng}`, {
        headers: {
          'User-Agent': 'GETDeliveryApp/1.0 (contact@getdelivery.app)'
        }
      });
      const data = await res.json();
      
      if (data && data.display_name) {
        console.log(`Found address: ${data.display_name}`);
        await sql`UPDATE tenants SET address = ${data.display_name} WHERE id = ${t.id}`;
      }
      
      // Delay to respect nominatim usage policy
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`Error processing tenant ${t.id}:`, err);
    }
  }
  
  console.log('Done!');
  await sql.end();
  process.exit(0);
}

main();
