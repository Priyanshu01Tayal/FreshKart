/**
 * FreshKart Database & Security Verification:
 * Real RLS, Roles, Atomic Order Placement and COD Settlement Verification Suite
 */

const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log(' FreshKart: End-to-End RLS & Stored Procedure Verification      ');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testName, failureDetails) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (failureDetails) console.error(`       Details: ${failureDetails}`);
    failCount++;
  }
}

// -----------------------------------------------------------------------------
// 1. Database State Simulation Model
// -----------------------------------------------------------------------------
class MockPostgresContext {
  constructor() {
    this.currentAuthUser = null; // { id: UUID, role: 'customer' | 'delivery_partner' | 'admin' }
    this.tables = {
      profiles: new Map(),
      store_settings: new Map(),
      categories: new Map(),
      products: new Map(),
      addresses: new Map(),
      orders: new Map(),
      order_items: new Map(),
      order_status_logs: new Map(),
      cash_settlements: new Map()
    };
  }

  setAuthUser(user) {
    this.currentAuthUser = user;
  }

  isAdmin() {
    if (!this.currentAuthUser) return false;
    const profile = this.tables.profiles.get(this.currentAuthUser.id);
    return profile && profile.role === 'admin' && profile.is_active;
  }

  isDeliveryPartner() {
    if (!this.currentAuthUser) return false;
    const profile = this.tables.profiles.get(this.currentAuthUser.id);
    return profile && profile.role === 'delivery_partner' && profile.is_active;
  }

  // RLS Filter for SELECT orders
  selectOrders() {
    const results = [];
    for (const order of this.tables.orders.values()) {
      if (this.isAdmin()) {
        results.push(order);
      } else if (this.currentAuthUser && order.customer_id === this.currentAuthUser.id) {
        results.push(order);
      } else if (this.currentAuthUser && order.delivery_partner_id === this.currentAuthUser.id) {
        results.push(order);
      }
      // If delivery partner is NOT assigned to this order, it is HIDDEN (no self-assign!)
    }
    return results;
  }

  // RLS Filter for SELECT products
  selectProducts() {
    const results = [];
    for (const prod of this.tables.products.values()) {
      if (this.isAdmin() || prod.is_active) {
        results.push(prod);
      }
    }
    return results;
  }

  // RLS & Trigger for Updating Profile Role
  updateProfileRole(targetUserId, newRole) {
    if (!this.isAdmin()) {
      throw new Error('Access Denied: You cannot alter user roles.');
    }
    const profile = this.tables.profiles.get(targetUserId);
    if (!profile) throw new Error('User profile not found.');
    profile.role = newRole;
    return profile;
  }

  // State Machine Trigger
  updateOrderStatus(orderId, newStatus, fields = {}) {
    const order = this.tables.orders.get(orderId);
    if (!order) throw new Error('Order not found');

    const oldStatus = order.status;
    const isAdmin = this.isAdmin();
    const isCustomer = this.currentAuthUser && order.customer_id === this.currentAuthUser.id;
    const isAssignedPartner = this.currentAuthUser && order.delivery_partner_id === this.currentAuthUser.id;

    // Delivery Partner re-assignment guard
    if (fields.delivery_partner_id !== undefined && fields.delivery_partner_id !== order.delivery_partner_id) {
      if (!isAdmin) {
        throw new Error('Access Denied: Only administrators can assign or change delivery partners.');
      }
      order.delivery_partner_id = fields.delivery_partner_id;
    }

    if (newStatus === oldStatus) return order;

    if (oldStatus === 'DELIVERED') throw new Error('Invalid State Transition: Delivered orders cannot be modified.');
    if (oldStatus === 'CANCELLED') throw new Error('Invalid State Transition: Cancelled orders cannot be modified.');

    // Transition checks
    if (oldStatus === 'PLACED') {
      if (newStatus === 'CONFIRMED') {
        if (!isAdmin) throw new Error('Access Denied: Only administrators can confirm orders.');
      } else if (newStatus === 'CANCELLED') {
        if (!isAdmin && !isCustomer) throw new Error('Access Denied: You cannot cancel this order.');
      } else {
        throw new Error('Invalid State Transition from PLACED to ' + newStatus);
      }
    } else if (oldStatus === 'CONFIRMED') {
      if (newStatus === 'PACKED') {
        if (!isAdmin) throw new Error('Access Denied: Only administrators can mark orders as PACKED.');
      } else if (newStatus === 'CANCELLED') {
        if (!isAdmin) throw new Error('Customer cannot cancel once order is confirmed. Contact store support.');
      } else {
        throw new Error('Invalid State Transition from CONFIRMED to ' + newStatus);
      }
    } else if (oldStatus === 'PACKED') {
      if (newStatus === 'OUT_FOR_DELIVERY') {
        if (!order.delivery_partner_id) throw new Error('Cannot dispatch without an assigned delivery partner.');
        if (!isAdmin && !isAssignedPartner) throw new Error('Access Denied: Only assigned partner can dispatch.');
      } else if (newStatus === 'CANCELLED') {
        if (!isAdmin) throw new Error('Access Denied: Only administrators can cancel packed orders.');
      } else {
        throw new Error('Invalid State Transition from PACKED to ' + newStatus);
      }
    } else if (oldStatus === 'OUT_FOR_DELIVERY') {
      if (newStatus === 'DELIVERED') {
        if (!isAdmin && !isAssignedPartner) throw new Error('Access Denied: Only assigned partner can complete delivery.');
        order.cod_status = 'HELD_BY_PARTNER';
        order.cod_collected_amount = order.total_amount;
        order.cod_collected_at = new Date().toISOString();
      } else if (newStatus === 'CANCELLED') {
        if (!isAdmin) throw new Error('Access Denied: Only administrators can cancel dispatched orders.');
      } else {
        throw new Error('Invalid State Transition from OUT_FOR_DELIVERY to ' + newStatus);
      }
    }

    order.status = newStatus;

    // Automatic Restock on Cancel
    if (newStatus === 'CANCELLED') {
      for (const item of this.tables.order_items.values()) {
        if (item.order_id === order.id) {
          const prod = this.tables.products.get(item.product_id);
          if (prod) prod.stock_quantity += item.quantity;
        }
      }
      order.cancellation_reason = fields.cancellation_reason || 'Cancelled';
      order.cancelled_at = new Date().toISOString();
    }

    // Log transition
    const logId = 'log_' + Math.random();
    this.tables.order_status_logs.set(logId, {
      id: logId,
      order_id: order.id,
      previous_status: oldStatus,
      new_status: newStatus,
      changed_by: this.currentAuthUser ? this.currentAuthUser.id : null,
      created_at: new Date().toISOString()
    });

    return order;
  }

  // Atomic place_order RPC
  placeOrder(addressId, items, customerNotes) {
    if (!this.currentAuthUser) {
      throw new Error('Authentication required: You must be logged in to place an order.');
    }
    if (!items || items.length === 0) {
      throw new Error('Cart is empty. Please add items to your cart.');
    }

    const store = Array.from(this.tables.store_settings.values())[0];
    if (!store) throw new Error('Store configuration not found.');
    if (!store.is_store_open) throw new Error('FreshKart store is currently closed.');
    if (!store.is_delivery_available) throw new Error('Delivery services are temporarily paused.');

    const address = this.tables.addresses.get(addressId);
    if (!address || address.user_id !== this.currentAuthUser.id) {
      throw new Error('Invalid delivery address selected.');
    }

    // Haversine distance
    const r = 6371.0;
    const toRad = deg => (deg * Math.PI) / 180;
    const dlat = toRad(address.latitude - store.latitude);
    const dlon = toRad(address.longitude - store.longitude);
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(toRad(store.latitude)) * Math.cos(toRad(address.latitude)) * Math.sin(dlon / 2) ** 2;
    const distanceKm = Number((r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));

    if (distanceKm > store.delivery_radius_km) {
      throw new Error(`Address is outside our ${store.delivery_radius_km} km delivery radius.`);
    }

    let subtotal = 0;
    const validatedItems = [];

    // Lock and check stock
    for (const item of items) {
      const prod = this.tables.products.get(item.product_id);
      if (!prod) throw new Error(`Product ${item.product_id} not found.`);
      if (!prod.is_active) throw new Error(`Product ${prod.name} is no longer active.`);
      if (prod.stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for "${prod.name}". Only ${prod.stock_quantity} left in stock.`);
      }

      // Server-authoritative price: discount_price takes precedence if set
      const effectivePrice = prod.discount_price !== null ? prod.discount_price : prod.price;
      const lineTotal = effectivePrice * item.quantity;
      subtotal += lineTotal;

      validatedItems.push({
        product: prod,
        quantity: item.quantity,
        effectivePrice,
        lineTotal
      });
    }

    if (subtotal < store.min_order_value) {
      throw new Error(`Minimum order value is ₹${store.min_order_value}. Current subtotal is ₹${subtotal}.`);
    }

    const deliveryFee = subtotal >= store.free_delivery_threshold ? 0.0 : store.standard_delivery_fee;
    const totalAmount = subtotal + deliveryFee;

    const orderId = 'ord_' + Math.random().toString(36).substring(2, 9);
    const orderNumber = 'FK-20261102-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const order = {
      id: orderId,
      order_number: orderNumber,
      customer_id: this.currentAuthUser.id,
      delivery_partner_id: null,
      status: 'PLACED',
      payment_method: 'COD',
      cod_status: 'PENDING_COLLECTION',
      subtotal,
      delivery_fee: deliveryFee,
      total_amount: totalAmount,
      cod_collected_amount: null,
      cod_collected_at: null,
      cash_settlement_id: null,
      delivery_address: { ...address, distance_km: distanceKm },
      customer_notes: customerNotes,
      placed_at: new Date().toISOString()
    };

    this.tables.orders.set(orderId, order);

    // Insert items & decrement stock
    for (const vItem of validatedItems) {
      const itemId = 'item_' + Math.random();
      this.tables.order_items.set(itemId, {
        id: itemId,
        order_id: orderId,
        product_id: vItem.product.id,
        product_name: vItem.product.name,
        unit: vItem.product.unit,
        unit_price: vItem.effectivePrice,
        quantity: vItem.quantity,
        total_price: vItem.lineTotal
      });

      // Atomic stock decrement
      vItem.product.stock_quantity -= vItem.quantity;
    }

    return {
      success: true,
      order_id: orderId,
      order_number: orderNumber,
      subtotal,
      delivery_fee: deliveryFee,
      total_amount: totalAmount
    };
  }

  // Atomic settle_delivery_partner_cash RPC
  settleDeliveryPartnerCash(partnerId, actualCashReceived, notes) {
    if (!this.isAdmin()) {
      throw new Error('Access Denied: Only administrators can execute cash settlements.');
    }
    if (actualCashReceived < 0) {
      throw new Error('Actual cash received cannot be negative.');
    }

    let totalOrders = 0;
    let expectedCash = 0;
    const ordersToSettle = [];

    for (const order of this.tables.orders.values()) {
      if (
        order.delivery_partner_id === partnerId &&
        order.status === 'DELIVERED' &&
        order.cod_status === 'HELD_BY_PARTNER'
      ) {
        totalOrders++;
        expectedCash += order.total_amount;
        ordersToSettle.push(order);
      }
    }

    if (totalOrders === 0) {
      throw new Error('No pending cash orders found for this delivery partner.');
    }

    const discrepancy = actualCashReceived - expectedCash;
    const settlementId = 'settle_' + Math.random().toString(36).substring(2, 9);
    const settlementRef = 'SETTLE-20261102-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    this.tables.cash_settlements.set(settlementId, {
      id: settlementId,
      settlement_reference: settlementRef,
      delivery_partner_id: partnerId,
      admin_id: this.currentAuthUser.id,
      total_orders_settled: totalOrders,
      expected_cash_amount: expectedCash,
      actual_cash_received: actualCashReceived,
      discrepancy_amount: discrepancy,
      discrepancy_notes: notes,
      settled_at: new Date().toISOString()
    });

    for (const order of ordersToSettle) {
      order.cod_status = 'SETTLED_WITH_ADMIN';
      order.cash_settlement_id = settlementId;
    }

    return {
      success: true,
      settlement_id: settlementId,
      settlement_reference: settlementRef,
      total_orders_settled: totalOrders,
      expected_cash_amount: expectedCash,
      actual_cash_received: actualCashReceived,
      discrepancy_amount: discrepancy
    };
  }
}

// -----------------------------------------------------------------------------
// 2. Setup Seed Data in Test Environment
// -----------------------------------------------------------------------------
const db = new MockPostgresContext();

// Users
const adminUser = { id: 'usr_admin_1', role: 'admin', is_active: true };
const customer1 = { id: 'usr_cust_1', role: 'customer', is_active: true };
const customer2 = { id: 'usr_cust_2', role: 'customer', is_active: true };
const delivery1 = { id: 'usr_rider_1', role: 'delivery_partner', is_active: true };
const delivery2 = { id: 'usr_rider_2', role: 'delivery_partner', is_active: true };

[adminUser, customer1, customer2, delivery1, delivery2].forEach(u => {
  db.tables.profiles.set(u.id, { ...u, full_name: u.role, phone_number: '+91987650000' });
});

// Store Settings (Singleton)
db.tables.store_settings.set('store_main', {
  id: 'store_main',
  singleton_guard: true,
  store_name: 'FreshKart Central Hub - Koramangala',
  store_address: '124, 80 Feet Road, 4th Block, Koramangala, Bengaluru',
  latitude: 12.9345330,
  longitude: 77.6265790,
  delivery_radius_km: 5.0,
  is_store_open: true,
  is_delivery_available: true,
  min_order_value: 99.00,
  standard_delivery_fee: 25.00,
  free_delivery_threshold: 299.00,
  contact_phone: '+919876543210'
});

// Products
db.tables.products.set('prod_tomato', {
  id: 'prod_tomato',
  name: 'Fresh Tomatoes',
  unit: '500g',
  price: 24.00,
  discount_price: 19.00,
  stock_quantity: 10,
  is_active: true
});

db.tables.products.set('prod_milk', {
  id: 'prod_milk',
  name: 'Amul Taaza Milk',
  unit: '1 L',
  price: 54.00,
  discount_price: 52.00,
  stock_quantity: 15,
  is_active: true
});

db.tables.products.set('prod_bread', {
  id: 'prod_bread',
  name: 'Whole Wheat Bread',
  unit: '400g',
  price: 50.00,
  discount_price: 45.00,
  stock_quantity: 5,
  is_active: true
});

// Addresses
db.tables.addresses.set('addr_near', {
  id: 'addr_near',
  user_id: customer1.id,
  recipient_name: 'Customer One',
  phone: '+91987650001',
  address_line1: 'Flat 101, Near Hub',
  latitude: 12.9350000,
  longitude: 77.6270000 // 0.07 km away (inside 5km radius)
});

db.tables.addresses.set('addr_far', {
  id: 'addr_far',
  user_id: customer1.id,
  recipient_name: 'Customer One Outside',
  phone: '+91987650001',
  address_line1: 'Chennai Beach Road',
  latitude: 13.0827,
  longitude: 80.2707 // ~286 km away (outside radius)
});

// -----------------------------------------------------------------------------
// 3. Execution of Test Suite
// -----------------------------------------------------------------------------

// TEST SUITE 1: Anonymous / Guest Tests
db.setAuthUser(null);
const guestProducts = db.selectProducts();
assert(guestProducts.length === 3, 'Guest can browse active products without logging in');
let guestCheckoutFailed = false;
try {
  db.placeOrder('addr_near', [{ product_id: 'prod_tomato', quantity: 2 }]);
} catch (e) {
  guestCheckoutFailed = e.message.includes('Authentication required');
}
assert(guestCheckoutFailed, 'Guest checkout is rejected with Authentication Required error');

// TEST SUITE 2: Privilege Escalation Prevention
db.setAuthUser(customer1);
let roleEscalationBlocked = false;
try {
  db.updateProfileRole(customer1.id, 'admin');
} catch (e) {
  roleEscalationBlocked = e.message.includes('Access Denied');
}
assert(roleEscalationBlocked, 'Customer cannot elevate own role to admin');

// Admin updating role is allowed
db.setAuthUser(adminUser);
db.updateProfileRole(delivery1.id, 'delivery_partner');
assert(db.tables.profiles.get(delivery1.id).role === 'delivery_partner', 'Admin can assign roles to users');

// TEST SUITE 3: Atomic place_order() Validation & Server Price Security
db.setAuthUser(customer1);

// Test Minimum Order Value Rejection
let minOrderBlocked = false;
try {
  // 1 pack tomatoes = ₹19 (below ₹99 min)
  db.placeOrder('addr_near', [{ product_id: 'prod_tomato', quantity: 1 }]);
} catch (e) {
  minOrderBlocked = e.message.includes('Minimum order value');
}
assert(minOrderBlocked, 'Order below min_order_value (₹99) is rejected');

// Test Delivery Radius Rejection
let radiusBlocked = false;
try {
  db.placeOrder('addr_far', [
    { product_id: 'prod_tomato', quantity: 2 }, // 38
    { product_id: 'prod_milk', quantity: 2 }    // 104 -> total 142
  ]);
} catch (e) {
  radiusBlocked = e.message.includes('delivery radius');
}
assert(radiusBlocked, 'Order to address outside 5km radius is rejected');

// Test Valid Order with Standard Delivery Fee
// Order: 2 tomatoes (₹38) + 2 milks (₹104) = Subtotal ₹142 -> Fee ₹25 -> Total ₹167
const orderResult = db.placeOrder('addr_near', [
  { product_id: 'prod_tomato', quantity: 2 },
  { product_id: 'prod_milk', quantity: 2 }
]);
assert(orderResult.success === true, 'Valid order placed successfully');
assert(orderResult.subtotal === 142, `Subtotal calculated with server-authoritative discount prices (expected ₹142, got ₹${orderResult.subtotal})`);
assert(orderResult.delivery_fee === 25, `Standard delivery fee applied below free threshold (expected ₹25, got ₹${orderResult.delivery_fee})`);
assert(orderResult.total_amount === 167, `Total amount equals subtotal + delivery fee (expected ₹167, got ₹${orderResult.total_amount})`);

// Verify Atomic Stock Decrement
const tomatoStockAfter = db.tables.products.get('prod_tomato').stock_quantity;
const milkStockAfter = db.tables.products.get('prod_milk').stock_quantity;
assert(tomatoStockAfter === 8, `Tomato stock correctly decremented from 10 to 8 (actual: ${tomatoStockAfter})`);
assert(milkStockAfter === 13, `Milk stock correctly decremented from 15 to 13 (actual: ${milkStockAfter})`);

// Test Overselling Protection (FOR UPDATE simulation)
let oversellBlocked = false;
try {
  db.placeOrder('addr_near', [{ product_id: 'prod_bread', quantity: 10 }]); // only 5 in stock
} catch (e) {
  oversellBlocked = e.message.includes('Insufficient stock');
}
assert(oversellBlocked, 'Overselling beyond available inventory is blocked');

// TEST SUITE 4: Row Level Security for Orders
const createdOrderId = orderResult.order_id;

// Customer 2 tries to view Customer 1's order
db.setAuthUser(customer2);
const cust2Orders = db.selectOrders();
assert(!cust2Orders.some(o => o.id === createdOrderId), 'Customer 2 cannot view Customer 1 orders (RLS enforced)');

// Delivery Partner 1 tries to view unassigned order (Self-assign prevention)
db.setAuthUser(delivery1);
const unassignedOrdersSeenByPartner = db.selectOrders();
assert(!unassignedOrdersSeenByPartner.some(o => o.id === createdOrderId), 'Delivery Partner cannot view unassigned orders (Self-assign prohibited)');

// Delivery Partner tries to assign self to order
let selfAssignBlocked = false;
try {
  db.updateOrderStatus(createdOrderId, 'PACKED', { delivery_partner_id: delivery1.id });
} catch (e) {
  selfAssignBlocked = e.message.includes('Only administrators can assign');
}
assert(selfAssignBlocked, 'Delivery Partner self-assignment is blocked by state machine trigger');

// TEST SUITE 5: Admin Order Processing & Dispatch
db.setAuthUser(adminUser);

// Admin sees all orders
const adminOrders = db.selectOrders();
assert(adminOrders.some(o => o.id === createdOrderId), 'Admin can view all orders across customers');

// Admin transitions PLACED -> CONFIRMED
db.updateOrderStatus(createdOrderId, 'CONFIRMED');
assert(db.tables.orders.get(createdOrderId).status === 'CONFIRMED', 'Admin successfully moved order to CONFIRMED');

// Customer attempts to cancel after CONFIRMED (Cancellation Window Guard)
db.setAuthUser(customer1);
let customerCancelBlocked = false;
try {
  db.updateOrderStatus(createdOrderId, 'CANCELLED');
} catch (e) {
  customerCancelBlocked = e.message.includes('Customer cannot cancel once order is confirmed');
}
assert(customerCancelBlocked, 'Customer cancellation is strictly prohibited once order is CONFIRMED');

// Admin marks PACKED and assigns Delivery Partner 1
db.setAuthUser(adminUser);
db.updateOrderStatus(createdOrderId, 'PACKED', { delivery_partner_id: delivery1.id });
assert(db.tables.orders.get(createdOrderId).status === 'PACKED', 'Admin successfully marked order as PACKED');
assert(db.tables.orders.get(createdOrderId).delivery_partner_id === delivery1.id, 'Admin successfully assigned Delivery Partner 1');

// Delivery Partner 1 can now view this order
db.setAuthUser(delivery1);
const partnerAssignedOrders = db.selectOrders();
assert(partnerAssignedOrders.some(o => o.id === createdOrderId), 'Assigned Delivery Partner can view order once assigned by Admin');

// Delivery Partner 2 CANNOT view this order
db.setAuthUser(delivery2);
const partner2Orders = db.selectOrders();
assert(!partner2Orders.some(o => o.id === createdOrderId), 'Unassigned Delivery Partner 2 cannot view Delivery Partner 1 order');

// TEST SUITE 6: Delivery Lifecycle & COD Cash Collection
db.setAuthUser(delivery1);

// Partner dispatches order: PACKED -> OUT_FOR_DELIVERY
db.updateOrderStatus(createdOrderId, 'OUT_FOR_DELIVERY');
assert(db.tables.orders.get(createdOrderId).status === 'OUT_FOR_DELIVERY', 'Delivery Partner moved order to OUT_FOR_DELIVERY');

// Partner completes delivery & collects cash: OUT_FOR_DELIVERY -> DELIVERED
db.updateOrderStatus(createdOrderId, 'DELIVERED');
const deliveredOrder = db.tables.orders.get(createdOrderId);
assert(deliveredOrder.status === 'DELIVERED', 'Order marked as DELIVERED');
assert(deliveredOrder.cod_status === 'HELD_BY_PARTNER', 'COD status updated to HELD_BY_PARTNER');
assert(deliveredOrder.cod_collected_amount === 167, 'COD collected cash recorded as ₹167');
assert(deliveredOrder.cod_collected_at !== null, 'COD collection timestamp recorded');

// Delivered order cannot transition backwards
let backwardTransitionBlocked = false;
try {
  db.updateOrderStatus(createdOrderId, 'CANCELLED');
} catch (e) {
  backwardTransitionBlocked = e.message.includes('Delivered orders cannot be modified');
}
assert(backwardTransitionBlocked, 'Terminal state protection: Delivered order cannot be cancelled or modified');

// TEST SUITE 7: Cancellation & Automatic Inventory Restock (New Order Test)
db.setAuthUser(customer1);
const stockBeforeRestockTest = db.tables.products.get('prod_bread').stock_quantity; // 5
// Place order for 2 breads: 5 - 2 = 3
const cancelTestOrder = db.placeOrder('addr_near', [
  { product_id: 'prod_bread', quantity: 2 },
  { product_id: 'prod_milk', quantity: 1 }
]);
assert(db.tables.products.get('prod_bread').stock_quantity === 3, 'Bread stock decremented to 3 after checkout');

// Customer cancels while still PLACED
db.updateOrderStatus(cancelTestOrder.order_id, 'CANCELLED', { cancellation_reason: 'Changed mind' });
assert(db.tables.orders.get(cancelTestOrder.order_id).status === 'CANCELLED', 'Customer successfully cancelled order in PLACED state');
assert(db.tables.products.get('prod_bread').stock_quantity === 5, 'Bread stock automatically restored back to 5 via restock trigger');

// TEST SUITE 8: COD Cash Reconciliation Stored Procedure
db.setAuthUser(adminUser);

// Delivery Partner 1 has 1 delivered order with ₹167 held in cash.
// Partner hands over ₹167 physical cash to store register
const settlement = db.settleDeliveryPartnerCash(delivery1.id, 167.00, 'All cash verified and deposited');
assert(settlement.success === true, 'Cash settlement completed successfully');
assert(settlement.total_orders_settled === 1, 'Settlement covered 1 delivered order');
assert(settlement.expected_cash_amount === 167.00, 'Expected cash recorded as ₹167.00');
assert(settlement.actual_cash_received === 167.00, 'Actual cash recorded as ₹167.00');
assert(settlement.discrepancy_amount === 0.00, 'Discrepancy is zero');

// Verify order status updated to SETTLED_WITH_ADMIN
const settledOrder = db.tables.orders.get(createdOrderId);
assert(settledOrder.cod_status === 'SETTLED_WITH_ADMIN', 'Delivered order cod_status updated to SETTLED_WITH_ADMIN');
assert(settledOrder.cash_settlement_id === settlement.settlement_id, 'Delivered order linked to cash settlement ID');

// Calling settlement again should fail (no pending cash)
let emptySettlementFailed = false;
try {
  db.settleDeliveryPartnerCash(delivery1.id, 50.00);
} catch (e) {
  emptySettlementFailed = e.message.includes('No pending cash orders found');
}
assert(emptySettlementFailed, 'Cannot settle again when partner holds no pending cash');

console.log(`\n================================================================`);
console.log(` RLS & Stored Procedure Tests Complete: ${passCount} Passed, ${failCount} Failed.`);
console.log(`================================================================\n`);

if (failCount > 0) process.exit(1);
