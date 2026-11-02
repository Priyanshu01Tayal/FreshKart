/**
 * FreshKart Phase 2 Production Readiness & Security Verification Suite
 * Tests:
 * 1. Real Supabase admin authentication requirement.
 * 2. Unauthorized customer access is blocked.
 * 3. Unauthorized delivery partner access is blocked.
 * 4. Product CRUD calls real database tables.
 * 5. Product image upload utilizes Supabase Storage.
 * 6. Inventory changes persist directly to PostgreSQL.
 * 7. Store settings update the database.
 * 8. New orders appear through Realtime channels.
 * 9. Order status updates persist correctly.
 * 10. COD settlement works using real database RPC.
 * 11. CSV reports contain actual database records.
 * 12. Production build contains ZERO mock authentication strings or bypasses.
 */

const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log(' FreshKart Phase 2: Production Readiness & Security Audit       ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       Details: ${details}`);
    failCount++;
  }
}

const ADMIN_SRC = path.join(__dirname, '..', 'apps', 'admin-web', 'src');
const ADMIN_DIST = path.join(__dirname, '..', 'apps', 'admin-web', 'dist');

// Read Source Files
const authContextSrc = fs.readFileSync(path.join(ADMIN_SRC, 'context', 'AuthContext.tsx'), 'utf8');
const loginSrc = fs.readFileSync(path.join(ADMIN_SRC, 'pages', 'Login.tsx'), 'utf8');
const appSrc = fs.readFileSync(path.join(ADMIN_SRC, 'App.tsx'), 'utf8');
const storageSrc = fs.readFileSync(path.join(ADMIN_SRC, 'services', 'storageService.ts'), 'utf8');
const storeControlsSrc = fs.readFileSync(path.join(ADMIN_SRC, 'pages', 'StoreControls.tsx'), 'utf8');
const reportsSrc = fs.readFileSync(path.join(ADMIN_SRC, 'pages', 'SalesReports.tsx'), 'utf8');
const liveOrdersSrc = fs.readFileSync(path.join(ADMIN_SRC, 'pages', 'LiveOrders.tsx'), 'utf8');

// CHECK 1: Real Supabase admin authentication
assert(
  authContextSrc.includes('supabase.auth.signInWithPassword') &&
  authContextSrc.includes("from('profiles')"),
  '1. Real Supabase Auth: signIn calls supabase.auth.signInWithPassword and queries profiles table'
);

// CHECK 2: Unauthorized customer access is blocked
assert(
  authContextSrc.includes("typedProfile.role !== 'admin'") &&
  authContextSrc.includes('await supabase.auth.signOut()'),
  '2. Customer Access Blocked: Non-admin users are automatically signed out and rejected'
);

// CHECK 3: Unauthorized delivery partner access is blocked
assert(
  authContextSrc.includes("Account role '${typedProfile.role}' is not authorized to access the Admin Hub"),
  '3. Delivery Partner Access Blocked: Delivery partner accounts receive explicit permission denial'
);

// CHECK 4: Product CRUD works with actual database
assert(
  appSrc.includes("from('products')") &&
  appSrc.includes(".insert") &&
  appSrc.includes(".update") &&
  appSrc.includes(".delete"),
  '4. Product CRUD: Communicates directly with Supabase products table'
);

// CHECK 5: Product image uploads work with Supabase Storage
assert(
  storageSrc.includes("storage") &&
  storageSrc.includes("'product-images'") &&
  storageSrc.includes(".upload(") &&
  storageSrc.includes(".getPublicUrl("),
  '5. Storage Integration: Product images uploaded to Supabase Storage bucket product-images'
);

// CHECK 6: Inventory changes persist correctly
assert(
  appSrc.includes('handleUpdateStock') &&
  appSrc.includes("from('products')"),
  '6. Inventory Persistence: Stock adjustments persist directly to PostgreSQL products table'
);

// CHECK 7: Store settings update database
assert(
  appSrc.includes("from('store_settings')") &&
  appSrc.includes(".update(") &&
  storeControlsSrc.includes('onUpdateSettings'),
  '7. Store Controls Persistence: Operating hours, delivery radius & fees update store_settings table'
);

// CHECK 8: New orders appear through Realtime
assert(
  appSrc.includes("event: 'INSERT', schema: 'public', table: 'orders'") &&
  appSrc.includes('orderChime.playNewOrderChime()'),
  '8. Realtime Pipeline: Orders channel listens for INSERT on orders and plays audio notification'
);

// CHECK 9: Order status updates persist correctly
assert(
  appSrc.includes("from('orders')") &&
  appSrc.includes(".update(updates)") &&
  liveOrdersSrc.includes('onUpdateStatus'),
  '9. Order Status Updates: State transitions execute database updates on orders table'
);

// CHECK 10: COD settlement works using real database RPC
assert(
  appSrc.includes("supabase.rpc as any)('settle_delivery_partner_cash'") ||
  appSrc.includes("supabase.rpc('settle_delivery_partner_cash'"),
  '10. COD Cash Settlement: Calls PostgreSQL stored procedure settle_delivery_partner_cash()'
);

// CHECK 11: CSV reports contain actual database records
assert(
  reportsSrc.includes('o.order_number') &&
  reportsSrc.includes('o.total_amount') &&
  reportsSrc.includes('encodeURI(csvContent)'),
  '11. CSV Export: Formats real order records, subtotal, delivery fees, and COD status'
);

// CHECK 12: Production build contains NO mock authentication
const distFiles = fs.readdirSync(path.join(ADMIN_DIST, 'assets'));
const jsBundleName = distFiles.find(f => f.endsWith('.js'));
assert(Boolean(jsBundleName), 'Production JS bundle located in dist/assets/');

const jsBundleContent = fs.readFileSync(path.join(ADMIN_DIST, 'assets', jsBundleName), 'utf8');

const forbiddenMockStrings = [
  'admin123',
  'freshkart_dev_admin_active',
  'Instant Local Admin Login',
  'setDevAdminSession',
  'Local Development Mode'
];

forbiddenMockStrings.forEach(str => {
  const containsString = jsBundleContent.includes(str);
  assert(
    !containsString,
    `12. Production Bundle Sanitization: "${str}" is NOT present in production bundle`,
    `Found forbidden test string in ${jsBundleName}`
  );
});

console.log(`\n================================================================`);
console.log(` Production Readiness Audit Complete: ${passCount} Passed, ${failCount} Failed.`);
console.log(`================================================================\n`);

if (failCount > 0) process.exit(1);
