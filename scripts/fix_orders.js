const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/getdelivery' });
pool.query(`UPDATE delivery_orders SET order_source = 'SUB_ORDER' WHERE order_source = 'CREATED' AND customer_id IS NOT NULL AND status = 'DRAFT' AND created_at > NOW() - INTERVAL '1 day'`)
  .then(res => { console.log('Fixed:', res.rowCount); pool.end(); })
  .catch(console.error);
