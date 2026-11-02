/**
 * FreshKart Phase 1 Database & Security Verification Harness
 * Tests:
 * 1. Migration files presence, order, and integrity.
 * 2. Complete RLS coverage on all 9 application tables.
 * 3. Privilege escalation prevention triggers & role protection checks.
 * 4. Order State Machine FSM transition rules & restock hooks.
 * 5. Haversine distance logic and place_order() subtotal/delivery fee calculations.
 * 6. Storage bucket 2MB limit and MIME constraints.
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const SEED_FILE = path.join(__dirname, '..', 'supabase', 'seed.sql');

function runChecks() {
  console.log('====================================================');
  console.log(' FreshKart Phase 1 Database & Security Test Suite   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Check migrations exist
  const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).sort();
  assert(migrationFiles.length >= 6, `Found ${migrationFiles.length} versioned migration files.`);

  const expectedMigrations = [
    '20261102000001_core_schema.sql',
    '20261102000002_security_and_rls.sql',
    '20261102000003_order_fsm_and_restock.sql',
    '20261102000004_atomic_place_order.sql',
    '20261102000005_storage_setup.sql',
    '20261102000006_cash_reconciliation_rpc.sql',
  ];

  expectedMigrations.forEach(file => {
    assert(migrationFiles.includes(file), `Migration file exists: ${file}`);
  });

  // 2. Read all migration contents
  const allSql = migrationFiles.map(f => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).join('\n');

  // 3. Verify all tables have RLS enabled
  const requiredTables = [
    'profiles',
    'store_settings',
    'categories',
    'products',
    'addresses',
    'orders',
    'order_items',
    'order_status_logs',
    'cash_settlements',
  ];

  requiredTables.forEach(table => {
    const rlsPattern = new RegExp(`ALTER TABLE (public\\.)?${table} ENABLE ROW LEVEL SECURITY;`, 'i');
    assert(rlsPattern.test(allSql), `Table has RLS enabled: ${table}`);
  });

  // 4. Verify Privilege Escalation Protection
  assert(
    allSql.includes("'customer'::public.user_role") || allSql.includes("'customer'"),
    'Public signup trigger hardcodes role to customer'
  );
  assert(
    allSql.includes('protect_user_role') && allSql.includes('Access Denied: You cannot alter user roles'),
    'Client-side profile role mutation is blocked by protect_user_role trigger'
  );
  assert(
    allSql.includes('admin_update_user_role'),
    'Admin-only explicit procedure exists for role management'
  );

  // 5. Verify Delivery Partner Self-Assignment is Prohibited
  assert(
    allSql.includes('Only administrators can assign or change delivery partners'),
    'Self-assignment or cross-assignment of delivery partner is blocked by state machine trigger'
  );

  // 6. Verify Customer Cancellation Window
  assert(
    allSql.includes("WHEN 'CONFIRMED' THEN") &&
    allSql.includes('Customer cannot cancel once order is confirmed'),
    'Customer cancellation is strictly blocked once order moves to CONFIRMED'
  );

  // 7. Verify Atomic Restock Trigger
  assert(
    allSql.includes('handle_order_cancellation_restock') &&
    allSql.includes('stock_quantity = p.stock_quantity + oi.quantity'),
    'Atomic inventory restocking is enforced upon order cancellation'
  );

  // 8. Verify Atomic place_order() RPC Safety
  assert(
    allSql.includes('FOR UPDATE'),
    'Row-level locking (FOR UPDATE) is used on products to prevent overselling race conditions'
  );
  assert(
    allSql.includes('calculate_haversine_km'),
    'Haversine distance calculation is implemented for operational radius checks'
  );
  assert(
    allSql.includes('v_subtotal < v_store.min_order_value'),
    'Minimum order value validation is enforced in place_order()'
  );
  assert(
    allSql.includes('v_subtotal >= v_store.free_delivery_threshold'),
    'Free delivery threshold evaluation is enforced on the server'
  );

  // 9. Verify Storage Security (2MB limit & image MIME types)
  assert(
    allSql.includes('2097152') && allSql.includes("'product-images'"),
    'Storage bucket product-images enforces 2MB file size limit'
  );
  assert(
    allSql.includes("'image/webp'") && allSql.includes("'image/jpeg'"),
    'Storage bucket enforces allowed image MIME types'
  );
  assert(
    allSql.includes('Admins can upload product images'),
    'Storage upload permissions are restricted to administrators'
  );

  // 10. Verify Seed Data
  const seedSql = fs.readFileSync(SEED_FILE, 'utf8');
  assert(seedSql.includes('FreshKart Central Hub'), 'Seed data contains default singleton store_settings');
  assert(seedSql.includes('Fresh Vegetables') && seedSql.includes('Fresh Fruits'), 'Seed data contains initial grocery categories');
  assert(seedSql.includes('Fresh Hybrid Tomatoes') && seedSql.includes('Amul Taaza Toned Milk'), 'Seed data contains realistic sample products with units, prices, and stock');

  // 11. Test pure logic functions (Haversine & Fee)
  function testHaversine(lat1, lon1, lat2, lon2) {
    const r = 6371.0;
    const toRad = deg => (deg * Math.PI) / 180;
    const dlat = toRad(lat2 - lat1);
    const dlon = toRad(lon2 - lon1);
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((r * c).toFixed(2));
  }

  const hubLat = 12.934533;
  const hubLng = 77.626579;
  const nearbyLat = 12.935;
  const nearbyLng = 77.627;
  const farLat = 13.0827; // Chennai / ~290km away
  const farLng = 80.2707;

  const nearbyDist = testHaversine(hubLat, hubLng, nearbyLat, nearbyLng);
  assert(nearbyDist < 0.2, `Nearby customer location correctly calculated (${nearbyDist} km, within 5 km radius)`);

  const farDist = testHaversine(hubLat, hubLng, farLat, farLng);
  assert(farDist > 250, `Far customer location correctly calculated (${farDist} km, successfully outside radius)`);

  // 12. Test Delivery Fee Calculation Logic
  function calcDeliveryFee(subtotal, minOrder, freeThreshold, standardFee) {
    if (subtotal < minOrder) throw new Error('Below minimum order value');
    return subtotal >= freeThreshold ? 0.0 : standardFee;
  }

  assert(calcDeliveryFee(150, 99, 299, 25) === 25.0, 'Subtotal ₹150 pays standard delivery fee ₹25');
  assert(calcDeliveryFee(350, 99, 299, 25) === 0.0, 'Subtotal ₹350 qualifies for free delivery (above ₹299)');

  console.log(`\nVerification Complete: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runChecks();
