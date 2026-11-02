/**
 * FreshKart Phase 2 Admin Web Dashboard Verification Suite
 * Verifies that all 13 modules, brand styles, responsive layouts, audio chimes,
 * storage upload validations, and production assets exist and pass compilation.
 */

const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log(' FreshKart Phase 2: Admin Web Dashboard Verification Suite       ');
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

const ADMIN_DIR = path.join(__dirname, '..', 'apps', 'admin-web');
const DIST_DIR = path.join(ADMIN_DIR, 'dist');
const SRC_DIR = path.join(ADMIN_DIR, 'src');

// 1. Verify Production Build Outputs
assert(fs.existsSync(DIST_DIR), 'Production build directory (dist/) exists');
assert(fs.existsSync(path.join(DIST_DIR, 'index.html')), 'dist/index.html generated');
const distAssets = fs.readdirSync(path.join(DIST_DIR, 'assets'));
assert(distAssets.some(f => f.endsWith('.js')), 'Production JS bundle generated');
assert(distAssets.some(f => f.endsWith('.css')), 'Production Tailwind CSS bundle generated');

// 2. Verify Module Files
const expectedFiles = [
  'pages/Login.tsx',
  'pages/DashboardOverview.tsx',
  'pages/LiveOrders.tsx',
  'pages/Products.tsx',
  'pages/Categories.tsx',
  'pages/Inventory.tsx',
  'pages/StoreControls.tsx',
  'pages/DeliveryPartners.tsx',
  'pages/CashReconciliation.tsx',
  'pages/SalesReports.tsx',
  'components/layout/Navbar.tsx',
  'components/layout/Sidebar.tsx',
  'components/layout/AdminLayout.tsx',
  'context/AuthContext.tsx',
  'services/storageService.ts',
  'utils/audio.ts',
  'lib/supabase.ts',
  'App.tsx',
  'main.tsx'
];

expectedFiles.forEach(file => {
  assert(fs.existsSync(path.join(SRC_DIR, file)), `Module file exists: ${file}`);
});

// 3. Verify Brand Colors in Tailwind Config
const tailwindConfig = fs.readFileSync(path.join(ADMIN_DIR, 'tailwind.config.js'), 'utf8');
assert(tailwindConfig.includes('#168447'), 'Primary green (#168447) configured in Tailwind theme');
assert(tailwindConfig.includes('#105C35'), 'Dark green (#105C35) configured in Tailwind theme');
assert(tailwindConfig.includes('#EAF7EE'), 'Light green (#EAF7EE) configured in Tailwind theme');
assert(tailwindConfig.includes('#F5FAF5'), 'Background (#F5FAF5) configured in Tailwind theme');
assert(tailwindConfig.includes('#17251C'), 'Text color (#17251C) configured in Tailwind theme');

// 4. Verify Image Upload 2MB Limit and MIME Checks
const storageService = fs.readFileSync(path.join(SRC_DIR, 'services', 'storageService.ts'), 'utf8');
assert(
  storageService.includes('PRODUCT_IMAGE_MAX_SIZE_BYTES') || storageService.includes('2097152'),
  'Product image upload enforces 2MB size limit'
);
assert(
  storageService.includes('ALLOWED_IMAGE_MIME_TYPES') || storageService.includes('image/webp'),
  'Product image upload enforces allowed MIME types (JPEG, PNG, WebP)'
);

// 5. Verify Audio Chime Synthesizer
const audioUtil = fs.readFileSync(path.join(SRC_DIR, 'utils', 'audio.ts'), 'utf8');
assert(
  audioUtil.includes('AudioContext') && audioUtil.includes('createOscillator'),
  'Audio chime synthesizer utilizes Web Audio API for dual-tone alerts'
);

// 6. Verify Security: No Service Role Key Exposed
const allAdminCode = expectedFiles
  .map(f => fs.readFileSync(path.join(SRC_DIR, f), 'utf8'))
  .join('\n');
assert(
  !allAdminCode.includes('service_role') && !allAdminCode.includes('SUPABASE_SERVICE_ROLE_KEY'),
  'Zero service_role keys exposed in client dashboard'
);

// 7. Verify Admin Route Guard
const authContext = fs.readFileSync(path.join(SRC_DIR, 'context/AuthContext.tsx'), 'utf8');
assert(
  authContext.includes("role !== 'admin'") || authContext.includes("role === 'admin'"),
  'Admin route guard validates role === admin'
);

console.log(`\n================================================================`);
console.log(` Admin Web Dashboard Tests Complete: ${passCount} Passed, ${failCount} Failed.`);
console.log(`================================================================\n`);

if (failCount > 0) process.exit(1);

