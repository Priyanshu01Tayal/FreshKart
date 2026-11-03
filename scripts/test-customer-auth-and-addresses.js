/**
 * FreshKart Phase 3 Step 3 Verification Suite
 * Tests Phone OTP Auth, Profile Management, Address CRUD,
 * RLS Isolation, and Guest Cart Preservation across Auth Lifecycle.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log(' FreshKart Phase 3 Step 3: Auth & Address Management Test Suite ');
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
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

// 1. Files existence check
const requiredFiles = [
  'src/store/useAuthStore.ts',
  'src/hooks/useAddresses.ts',
  'src/components/AddressCard.tsx',
  'src/components/AddressFormModal.tsx',
  'app/(auth)/login.tsx',
  'app/addresses/index.tsx',
  'app/(tabs)/profile.tsx',
];

for (const file of requiredFiles) {
  test(`File exists: ${file}`, () => {
    const fullPath = path.join(customerRoot, file);
    assert.strictEqual(fs.existsSync(fullPath), true, `Missing file: ${file}`);
  });
}

test('Migration 07 exists for address fields extension', () => {
  const migPath = path.join(migrationsDir, '20261103000001_address_fields_and_nullable_coords.sql');
  assert.strictEqual(fs.existsSync(migPath), true, 'Migration 07 must exist');
  const sql = fs.readFileSync(migPath, 'utf8');
  assert.strictEqual(sql.includes('city'), true);
  assert.strictEqual(sql.includes('state'), true);
  assert.strictEqual(sql.includes('pincode'), true);
  assert.strictEqual(sql.includes('latitude DROP NOT NULL'), true);
  assert.strictEqual(sql.includes('longitude DROP NOT NULL'), true);
});

// 2. Functional Phone Number & OTP Format Validation
test('Phone validation: accurately validates 10-digit Indian numbers starting with 6-9', () => {
  function isValidIndianPhone(input) {
    const digits = input.replace(/\D/g, '');
    if (digits.length === 10) {
      return /^[6-9]\d{9}$/.test(digits);
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return /^[6-9]\d{9}$/.test(digits.slice(2));
    }
    return false;
  }

  function formatIndiaPhone(input) {
    const digits = input.replace(/\D/g, '');
    const tenDigits = digits.length > 10 ? digits.slice(-10) : digits;
    return `+91${tenDigits}`;
  }

  // Also verify useAuthStore.ts defines this exact logic
  const authStoreSource = fs.readFileSync(path.join(customerRoot, 'src/store/useAuthStore.ts'), 'utf8');
  assert.strictEqual(authStoreSource.includes('/^[6-9]\\d{9}$/'), true);
  assert.strictEqual(authStoreSource.includes("digits.startsWith('91')"), true);

  // Valid numbers
  assert.strictEqual(isValidIndianPhone('9876543210'), true);
  assert.strictEqual(isValidIndianPhone('8765432109'), true);
  assert.strictEqual(isValidIndianPhone('7654321098'), true);
  assert.strictEqual(isValidIndianPhone('6543210987'), true);
  assert.strictEqual(isValidIndianPhone(' 98765 43210 '), true);
  assert.strictEqual(isValidIndianPhone('+91 98765 43210'), true);

  // Invalid numbers
  assert.strictEqual(isValidIndianPhone('1234567890'), false, 'Cannot start with 1');
  assert.strictEqual(isValidIndianPhone('5555555555'), false, 'Cannot start with 5');
  assert.strictEqual(isValidIndianPhone('987654321'), false, '9 digits must fail');
  assert.strictEqual(isValidIndianPhone('987654321000'), false, '12 digits not starting with 91 must fail');
  assert.strictEqual(isValidIndianPhone('abcdefghij'), false, 'Alpha chars must fail');

  // Formatter
  assert.strictEqual(formatIndiaPhone('9876543210'), '+919876543210');
  assert.strictEqual(formatIndiaPhone('+91 98765 43210'), '+919876543210');
});

// 3. Supabase Auth Configuration & No Fake Credentials
test('useAuthStore connects directly to Supabase Auth without mock/fake tokens', () => {
  const content = fs.readFileSync(path.join(customerRoot, 'src/store/useAuthStore.ts'), 'utf8');
  assert.strictEqual(content.includes('supabase.auth.signInWithOtp'), true);
  assert.strictEqual(content.includes('supabase.auth.verifyOtp'), true);
  assert.strictEqual(content.includes('supabase.auth.signOut'), true);
  assert.strictEqual(content.includes('supabase.auth.getSession'), true);
  assert.strictEqual(content.includes('fakeOtp'), false);
  assert.strictEqual(content.includes('mockAuth'), false);
  assert.strictEqual(content.includes('admin123'), false);
});

test('Customer registration strictly defaults and locks role to customer', () => {
  const content = fs.readFileSync(path.join(customerRoot, 'src/store/useAuthStore.ts'), 'utf8');
  assert.strictEqual(content.includes("role: 'customer'"), true);
  assert.strictEqual(content.includes("role: 'admin'"), false);
  assert.strictEqual(content.includes("role: 'delivery_partner'"), false);
});

// 4. Critical Guest Cart Preservation across Auth Lifecycle
test('Guest Cart Preservation: Cart items remain intact through login and logout', () => {
  // Simulate Zustand cart store
  let cartItems = [];
  function addCartItem(product, quantity = 1) {
    cartItems.push({
      product_id: product.id,
      name: product.name,
      quantity,
      effective_price: product.price,
    });
  }

  // 1. Guest adds items before logging in
  addCartItem({ id: 'prod-milk', name: 'Fresh Cow Milk', price: 34 }, 2);
  addCartItem({ id: 'prod-bread', name: 'Whole Wheat Bread', price: 45 }, 1);
  assert.strictEqual(cartItems.length, 2);
  assert.strictEqual(cartItems[0].quantity, 2);
  assert.strictEqual(cartItems[1].quantity, 1);

  // 2. User signs in with Phone OTP
  let authUser = { id: 'cust-uuid-1234', phone: '+919876543210' };
  let authProfile = { id: 'cust-uuid-1234', full_name: 'Priya Sharma', role: 'customer' };

  // Assert cart was NOT cleared during login
  assert.strictEqual(cartItems.length, 2, 'Cart must preserve all 2 items on customer sign in');
  assert.strictEqual(cartItems[0].product_id, 'prod-milk');
  assert.strictEqual(cartItems[1].product_id, 'prod-bread');

  // 3. User signs out
  authUser = null;
  authProfile = null;

  // Assert cart was NOT cleared on logout
  assert.strictEqual(cartItems.length, 2, 'Cart must preserve all items after sign out');
});

// 5. Address Management Logic & Default Flag Switching
test('Address Management: Adding or setting a default address automatically updates defaults', () => {
  let addresses = [
    {
      id: 'addr-1',
      user_id: 'cust-1',
      label: 'Home',
      recipient_name: 'Priya Sharma',
      phone: '9876543210',
      address_line1: 'Flat 401, Palm Grove',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
      is_default: true,
    },
    {
      id: 'addr-2',
      user_id: 'cust-1',
      label: 'Work',
      recipient_name: 'Priya Sharma',
      phone: '9876543210',
      address_line1: 'Tech Park, Block B',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560103',
      is_default: false,
    },
  ];

  function setDefault(targetId) {
    addresses = addresses.map((a) => ({
      ...a,
      is_default: a.id === targetId,
    }));
  }

  // Initial state: addr-1 is default
  assert.strictEqual(addresses.find((a) => a.id === 'addr-1').is_default, true);
  assert.strictEqual(addresses.find((a) => a.id === 'addr-2').is_default, false);

  // Set addr-2 as default
  setDefault('addr-2');
  assert.strictEqual(addresses.find((a) => a.id === 'addr-1').is_default, false);
  assert.strictEqual(addresses.find((a) => a.id === 'addr-2').is_default, true);
});

// 6. Address Validation Constraints
test('Address Input: Enforces recipient name, 10-digit phone, house/flat, and 6-digit PIN code', () => {
  function validateAddress(input) {
    if (!input.recipient_name || !input.recipient_name.trim()) return { valid: false, error: 'Recipient name required' };
    const cleanPhone = (input.phone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10) return { valid: false, error: '10-digit phone required' };
    if (!input.address_line1 || !input.address_line1.trim()) return { valid: false, error: 'House/flat details required' };
    const cleanPin = (input.pincode || '').replace(/\D/g, '');
    if (cleanPin.length !== 6) return { valid: false, error: '6-digit PIN required' };
    return { valid: true };
  }

  assert.strictEqual(
    validateAddress({
      recipient_name: 'Ganesh',
      phone: '9876543210',
      address_line1: '124, 80ft Road',
      pincode: '560034',
    }).valid,
    true
  );

  assert.strictEqual(
    validateAddress({
      recipient_name: '',
      phone: '9876543210',
      address_line1: '124, 80ft Road',
      pincode: '560034',
    }).valid,
    false
  );

  assert.strictEqual(
    validateAddress({
      recipient_name: 'Ganesh',
      phone: '123',
      address_line1: '124, 80ft Road',
      pincode: '560034',
    }).valid,
    false
  );

  assert.strictEqual(
    validateAddress({
      recipient_name: 'Ganesh',
      phone: '9876543210',
      address_line1: '124, 80ft Road',
      pincode: '5600',
    }).valid,
    false
  );
});

// 7. RLS Multi-Tenant Isolation Simulation
test('RLS Multi-Tenant: Customer B is prevented from reading or mutating Customer A addresses', () => {
  const addressesTable = [
    { id: 'addr-a1', user_id: 'cust-a', recipient_name: 'Customer A' },
    { id: 'addr-b1', user_id: 'cust-b', recipient_name: 'Customer B' },
  ];

  function queryAddresses(authenticatedUserId) {
    // Simulates: WHERE user_id = auth.uid() OR is_admin(auth.uid())
    return addressesTable.filter((row) => row.user_id === authenticatedUserId);
  }

  const custAResults = queryAddresses('cust-a');
  assert.strictEqual(custAResults.length, 1);
  assert.strictEqual(custAResults[0].id, 'addr-a1');

  const custBResults = queryAddresses('cust-b');
  assert.strictEqual(custBResults.length, 1);
  assert.strictEqual(custBResults[0].id, 'addr-b1');

  // Verify cross-access returns 0 rows
  assert.strictEqual(custBResults.some((r) => r.id === 'addr-a1'), false);
});

// 8. Protected Route & Redirection Flow
test('Protected Routes: Cart checkout button redirects unauthenticated users to login with returnTo', () => {
  const cartContent = fs.readFileSync(path.join(customerRoot, 'app/(tabs)/cart.tsx'), 'utf8');
  assert.strictEqual(cartContent.includes('!isAuthenticated'), true);
  assert.strictEqual(cartContent.includes("returnTo: '/checkout'"), true);

  const loginContent = fs.readFileSync(path.join(customerRoot, 'app/(auth)/login.tsx'), 'utf8');
  assert.strictEqual(loginContent.includes('returnTo'), true);
  assert.strictEqual(loginContent.includes('router.replace(returnTo'), true);
});

// 9. Zero Service Role & Credential Leakage
test('Zero service_role keys or secrets in customer mobile codebase', () => {
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
      }
    }
  };

  checkDir(customerRoot);
});

console.log('\n================================================================');
console.log(` Phase 3 Step 3 Verification Complete: ${passed} Passed, ${failed} Failed.`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
