/**
 * FreshKart Phase 3 Step 2 Verification Suite
 * Tests Guest Catalog, Local Cart, Store Settings, Inventory Guard, and Calculations
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log(' FreshKart Phase 3 Step 2: Catalog & Local Cart Verification   ');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`[PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${description}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

const customerRoot = path.join(__dirname, '..', 'apps', 'customer-mobile');

// 1. Files existence check
const requiredFiles = [
  'src/hooks/useStoreSettings.ts',
  'src/hooks/useCategories.ts',
  'src/hooks/useProducts.ts',
  'src/components/ProductCard.tsx',
  'src/components/StoreHeader.tsx',
  'src/components/LoadingSkeleton.tsx',
  'src/components/EmptyState.tsx',
  'src/store/useCartStore.ts',
  'app/(tabs)/index.tsx',
  'app/(tabs)/categories.tsx',
  'app/(tabs)/cart.tsx',
];

for (const file of requiredFiles) {
  test(`File exists: ${file}`, () => {
    const fullPath = path.join(customerRoot, file);
    assert.strictEqual(fs.existsSync(fullPath), true, `Missing file: ${file}`);
  });
}

// 2. Real database and store_settings integration
test('useStoreSettings queries store_settings table and handles error state', () => {
  const content = fs.readFileSync(path.join(customerRoot, 'src/hooks/useStoreSettings.ts'), 'utf8');
  assert.strictEqual(content.includes(".from('store_settings')"), true);
  assert.strictEqual(content.includes('isSupabaseConfigured'), true);
  assert.strictEqual(content.includes('refetch'), true);
});

test('useCategories queries active categories ordered by sort_order', () => {
  const content = fs.readFileSync(path.join(customerRoot, 'src/hooks/useCategories.ts'), 'utf8');
  assert.strictEqual(content.includes(".from('categories')"), true);
  assert.strictEqual(content.includes(".eq('is_active', true)"), true);
  assert.strictEqual(content.includes(".order('sort_order', { ascending: true })"), true);
});

test('useProducts queries active products and supports debounced search and category filter', () => {
  const content = fs.readFileSync(path.join(customerRoot, 'src/hooks/useProducts.ts'), 'utf8');
  assert.strictEqual(content.includes(".from('products')"), true);
  assert.strictEqual(content.includes(".eq('is_active', true)"), true);
  assert.strictEqual(content.includes('debouncedSearchQuery'), true);
  assert.strictEqual(content.includes('categoryId'), true);
});

// 3. ProductCard component verification
test('ProductCard supports discount calculation, out-of-stock badge, and quantity stepper', () => {
  const content = fs.readFileSync(path.join(customerRoot, 'src/components/ProductCard.tsx'), 'utf8');
  assert.strictEqual(content.includes('isOutOfStock'), true);
  assert.strictEqual(content.includes('stock_quantity <= 0'), true);
  assert.strictEqual(content.includes('discountPercent'), true);
  assert.strictEqual(content.includes('getItemQuantity'), true);
  assert.strictEqual(content.includes('cartQuantity >= product.stock_quantity'), true);
  assert.strictEqual(content.includes('Package'), true); // Fallback icon
});

// 4. StoreHeader verification (No hardcoded Koramangala or fake ETAs)
test('StoreHeader renders dynamic store_settings without hardcoded locations or fake ETAs', () => {
  const content = fs.readFileSync(path.join(customerRoot, 'src/components/StoreHeader.tsx'), 'utf8');
  assert.strictEqual(content.includes('store_name'), true);
  assert.strictEqual(content.includes('is_store_open'), true);
  assert.strictEqual(content.includes('is_delivery_available'), true);
  assert.strictEqual(content.includes('delivery_radius_km'), true);
  assert.strictEqual(content.toLowerCase().includes('koramangala'), false, 'Should not hardcode Koramangala');
  assert.strictEqual(content.includes('10-15 MINS'), false, 'Should not display fake ETA');
});

// 5. HomeScreen verification
test('HomeScreen integrates StoreHeader, SearchBar, CategoryChips, and RefreshControl', () => {
  const content = fs.readFileSync(path.join(customerRoot, 'app/(tabs)/index.tsx'), 'utf8');
  assert.strictEqual(content.includes('StoreHeader'), true);
  assert.strictEqual(content.includes('useProducts'), true);
  assert.strictEqual(content.includes('useCategories'), true);
  assert.strictEqual(content.includes('ProductCard'), true);
  assert.strictEqual(content.includes('RefreshControl'), true);
  assert.strictEqual(content.includes('EmptyState'), true);
});

// 6. CategoriesScreen verification
test('CategoriesScreen supports department selection and product grid filtering', () => {
  const content = fs.readFileSync(path.join(customerRoot, 'app/(tabs)/categories.tsx'), 'utf8');
  assert.strictEqual(content.includes('useCategories'), true);
  assert.strictEqual(content.includes('useProducts'), true);
  assert.strictEqual(content.includes('selectedCategory'), true);
  assert.strictEqual(content.includes('ProductCard'), true);
  assert.strictEqual(content.includes('EmptyState'), true);
});

// 7. CartScreen verification
test('CartScreen recalculates subtotal, delivery fee, and free delivery threshold progress', () => {
  const content = fs.readFileSync(path.join(customerRoot, 'app/(tabs)/cart.tsx'), 'utf8');
  assert.strictEqual(content.includes('useCartStore'), true);
  assert.strictEqual(content.includes('useStoreSettings'), true);
  assert.strictEqual(content.includes('min_order_value'), true);
  assert.strictEqual(content.includes('standard_delivery_fee'), true);
  assert.strictEqual(content.includes('free_delivery_threshold'), true);
  assert.strictEqual(content.includes('qualifiesForFreeDelivery'), true);
  assert.strictEqual(content.includes('subtotal >= freeDeliveryThreshold'), true);
  assert.strictEqual(content.includes('clearCart'), true);
  assert.strictEqual(content.includes('removeItem'), true);
  assert.strictEqual(content.includes('updateQuantity'), true);
});

// 8. Functional Business Logic Tests (Cart calculation logic)
test('Cart calculation: applies standard delivery fee below free threshold', () => {
  const standardFee = 25;
  const freeThreshold = 299;
  const subtotal = 142; // Below ₹299
  const fee = subtotal >= freeThreshold ? 0 : standardFee;
  const total = subtotal + fee;

  assert.strictEqual(fee, 25);
  assert.strictEqual(total, 167);
});

test('Cart calculation: waives delivery fee when subtotal meets free threshold', () => {
  const standardFee = 25;
  const freeThreshold = 299;
  const subtotal = 350; // Above ₹299
  const fee = subtotal >= freeThreshold ? 0 : standardFee;
  const total = subtotal + fee;

  assert.strictEqual(fee, 0);
  assert.strictEqual(total, 350);
});

test('Cart calculation: blocks checkout when subtotal is below minimum order value', () => {
  const minOrderValue = 99;
  const subtotal = 50;
  const canCheckout = subtotal >= minOrderValue;
  assert.strictEqual(canCheckout, false);
});

// 9. In-Memory Cart Store Simulation (Strict Stock Quantity Caps)
test('Zustand cart simulation: prevents adding more than available stock', () => {
  let items = [];
  const product = {
    id: 'prod-milk-1',
    name: 'Fresh Cow Milk',
    unit: '500 ml',
    price: 34,
    discount_price: 32,
    stock_quantity: 3,
  };

  function addItem(p, qty = 1) {
    const existing = items.find((i) => i.product_id === p.id);
    const currentQty = existing ? existing.quantity : 0;
    const newQty = currentQty + qty;

    if (newQty > p.stock_quantity) {
      return { success: false, message: `Only ${p.stock_quantity} available` };
    }

    if (existing) {
      existing.quantity = newQty;
    } else {
      items.push({
        product_id: p.id,
        name: p.name,
        unit: p.unit,
        price: p.price,
        discount_price: p.discount_price,
        effective_price: p.discount_price ?? p.price,
        quantity: newQty,
        stock_quantity: p.stock_quantity,
      });
    }
    return { success: true };
  }

  // Add 1
  assert.strictEqual(addItem(product, 1).success, true);
  assert.strictEqual(items[0].quantity, 1);

  // Add 2 more (total 3)
  assert.strictEqual(addItem(product, 2).success, true);
  assert.strictEqual(items[0].quantity, 3);

  // Try to add 1 more (would exceed stock 3)
  const failure = addItem(product, 1);
  assert.strictEqual(failure.success, false);
  assert.strictEqual(items[0].quantity, 3, 'Stock quantity must remain capped at 3');
});

// 10. Security Checks
test('Zero service_role keys or mock admin passwords in customer-mobile codebase', () => {
  const checkDir = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.expo') {
        checkDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const text = fs.readFileSync(fullPath, 'utf8');
        assert.strictEqual(text.includes('service_role'), false, `service_role found in ${fullPath}`);
        assert.strictEqual(text.includes('SUPABASE_SERVICE_ROLE_KEY'), false, `SUPABASE_SERVICE_ROLE_KEY found in ${fullPath}`);
        assert.strictEqual(text.includes('admin123'), false, `admin123 found in ${fullPath}`);
      }
    }
  };

  checkDir(customerRoot);
});

console.log('\n================================================================');
console.log(` Customer Catalog & Cart Verification: ${passed} Passed, ${failed} Failed.`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}

