/**
 * FreshKart Phase 3 Step 1 Verification Suite:
 * Scaffolding, Shared Setup, Theme, Router & State Management
 */

const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log(' FreshKart Phase 3 Step 1: Customer App Scaffolding Verification ');
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

const APP_DIR = path.join(__dirname, '..', 'apps', 'customer-mobile');

// 1. Verify Directory and Package configuration
assert(fs.existsSync(APP_DIR), 'apps/customer-mobile directory exists');
const pkg = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8'));
assert(pkg.name === 'freshkart-customer-mobile', 'package.json has correct name');
assert(pkg.dependencies['zustand'] !== undefined, 'Zustand dependency configured');
assert(pkg.dependencies['@react-native-async-storage/async-storage'] !== undefined, 'AsyncStorage configured');
assert(pkg.dependencies['@supabase/supabase-js'] !== undefined, 'Supabase JS configured');
assert(pkg.dependencies['lucide-react-native'] !== undefined, 'lucide-react-native configured');
assert(pkg.dependencies['expo-router'] !== undefined, 'expo-router configured');

// 2. Verify Android Package & App Configuration in app.json
const appJson = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'app.json'), 'utf8')).expo;
assert(appJson.name === 'FreshKart', 'app.json configures Android App Name as "FreshKart"');
assert(appJson.android.package === 'com.freshkart.customer', 'app.json configures unique package identifier "com.freshkart.customer"');
const splashBg = appJson.splash?.backgroundColor || 
  (Array.isArray(appJson.plugins) && appJson.plugins.find(p => Array.isArray(p) && p[0] === 'expo-splash-screen')?.[1]?.backgroundColor);
assert(splashBg === '#168447', 'Splash background color configured as primary green (#168447)');
assert(appJson.android.adaptiveIcon.backgroundColor === '#168447', 'Adaptive icon background color configured as #168447');

// 3. Verify Brand Asset Files
const assetsDir = path.join(APP_DIR, 'assets');
assert(fs.existsSync(path.join(assetsDir, 'icon.png')), 'Brand asset icon.png exists');
assert(fs.existsSync(path.join(assetsDir, 'adaptive-icon.png')), 'Brand asset adaptive-icon.png exists');
assert(fs.existsSync(path.join(assetsDir, 'splash.png')), 'Brand asset splash.png exists');

// 4. Verify Brand Colors in Theme
const colorsSrc = fs.readFileSync(path.join(APP_DIR, 'src', 'theme', 'colors.ts'), 'utf8');
assert(colorsSrc.includes('#168447'), 'Primary green (#168447) defined in theme');
assert(colorsSrc.includes('#105C35'), 'Dark green (#105C35) defined in theme');
assert(colorsSrc.includes('#EAF7EE'), 'Light green (#EAF7EE) defined in theme');
assert(colorsSrc.includes('#F5FAF5'), 'Background (#F5FAF5) defined in theme');
assert(colorsSrc.includes('#17251C'), 'Text color (#17251C) defined in theme');

// 5. Verify Supabase Client with AsyncStorage Persistence
const supabaseSrc = fs.readFileSync(path.join(APP_DIR, 'src', 'services', 'supabase.ts'), 'utf8');
assert(supabaseSrc.includes('AsyncStorage'), 'Supabase client configured with AsyncStorage session persistence');
assert(supabaseSrc.includes("import type { Database } from '@freshkart/shared'"), 'Supabase client imports shared types from @freshkart/shared');
assert(!supabaseSrc.includes('service_role'), 'Zero service_role keys exposed in client mobile service');

// 6. Verify Zustand Cart Store with Inventory Safety
const cartStoreSrc = fs.readFileSync(path.join(APP_DIR, 'src', 'store', 'useCartStore.ts'), 'utf8');
assert(cartStoreSrc.includes('newQty > product.stock_quantity'), 'Cart store enforces stock_quantity cap on add');
assert(cartStoreSrc.includes('quantity > item.stock_quantity'), 'Cart store enforces stock_quantity cap on update');
assert(cartStoreSrc.includes('createJSONStorage(() => AsyncStorage)'), 'Cart store persists locally across app restarts via AsyncStorage');

// 7. Verify Expo Router Screen Hierarchy
const expectedScreens = [
  'app/_layout.tsx',
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/categories.tsx',
  'app/(tabs)/cart.tsx',
  'app/(tabs)/orders.tsx',
  'app/(tabs)/profile.tsx',
  'app/checkout.tsx',
  'app/order/[id].tsx',
  'app/(auth)/login.tsx',
];

expectedScreens.forEach((screen) => {
  assert(fs.existsSync(path.join(APP_DIR, screen)), `Expo Router screen exists: ${screen}`);
});

// 8. Verify .env.example
assert(fs.existsSync(path.join(APP_DIR, '.env.example')), '.env.example template exists');
const envExample = fs.readFileSync(path.join(APP_DIR, '.env.example'), 'utf8');
assert(envExample.includes('EXPO_PUBLIC_SUPABASE_URL'), '.env.example includes EXPO_PUBLIC_SUPABASE_URL');
assert(envExample.includes('EXPO_PUBLIC_SUPABASE_ANON_KEY'), '.env.example includes EXPO_PUBLIC_SUPABASE_ANON_KEY');

console.log(`\n================================================================`);
console.log(` Customer App Scaffolding Complete: ${passCount} Passed, ${failCount} Failed.`);
console.log(`================================================================\n`);

if (failCount > 0) process.exit(1);
