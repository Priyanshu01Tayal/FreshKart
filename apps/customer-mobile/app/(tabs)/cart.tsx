import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Package,
  AlertCircle,
  Truck,
  Sparkles,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { useCartStore, CartItem } from '../../src/store/useCartStore';
import { useStoreSettings } from '../../src/hooks/useStoreSettings';

export default function CartScreen() {
  const router = useRouter();
  const { settings, loading: settingsLoading } = useStoreSettings();

  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const subtotal = useCartStore((state) => state.getSubtotal());

  // Store configurable rules with safe fallback defaults
  const minOrderValue = settings?.min_order_value ?? 99;
  const standardDeliveryFee = settings?.standard_delivery_fee ?? 25;
  const freeDeliveryThreshold = settings?.free_delivery_threshold ?? 299;
  const isStoreOpen = settings?.is_store_open ?? true;
  const isDeliveryAvailable = settings?.is_delivery_available ?? true;

  // Real-time bill calculations
  const qualifiesForFreeDelivery = subtotal >= freeDeliveryThreshold;
  const deliveryFee = qualifiesForFreeDelivery ? 0 : standardDeliveryFee;
  const totalAmount = subtotal + deliveryFee;
  const freeDeliveryRemaining = Math.max(0, freeDeliveryThreshold - subtotal);
  const minOrderRemaining = Math.max(0, minOrderValue - subtotal);

  const canProceedToCheckout =
    items.length > 0 &&
    subtotal >= minOrderValue &&
    isStoreOpen &&
    isDeliveryAvailable;

  const handleIncrement = (item: CartItem) => {
    if (item.quantity >= item.stock_quantity) {
      Alert.alert('Stock Limit', `Only ${item.stock_quantity} units available.`);
      return;
    }
    const res = updateQuantity(item.product_id, item.quantity + 1);
    if (!res.success && res.message) {
      Alert.alert('Limit Reached', res.message);
    }
  };

  const handleDecrement = (item: CartItem) => {
    updateQuantity(item.product_id, item.quantity - 1);
  };

  const handleRemove = (item: CartItem) => {
    Alert.alert(
      'Remove Item',
      `Remove ${item.name} from your cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeItem(item.product_id),
        },
      ]
    );
  };

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearCart },
      ]
    );
  };

  const handleProceedToCheckout = () => {
    if (!isStoreOpen) {
      Alert.alert('Store Closed', 'The store is currently closed. Please check back later.');
      return;
    }
    if (!isDeliveryAvailable) {
      Alert.alert('Delivery Paused', 'Delivery is temporarily paused. Please check back shortly.');
      return;
    }
    if (subtotal < minOrderValue) {
      Alert.alert(
        'Minimum Order Required',
        `Minimum order amount is ₹${minOrderValue}. Please add ₹${minOrderRemaining.toFixed(0)} more.`
      );
      return;
    }

    // Step 2 stops here; navigates to checkout screen
    router.push('/checkout');
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>My Cart</Text>
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <ShoppingBag color={colors.primary} size={48} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse our fresh farm produce and daily essentials to start adding items.
          </Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.8}
          >
            <Text style={styles.browseBtnText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with Clear Cart */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Cart ({items.length} items)</Text>
          <TouchableOpacity onPress={handleClearCart}>
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Store Operational Warning */}
        {(!isStoreOpen || !isDeliveryAvailable) && (
          <View style={styles.warningStrip}>
            <AlertCircle color={colors.danger} size={16} />
            <Text style={styles.warningText}>
              {!isStoreOpen
                ? 'Store is currently closed for new orders.'
                : 'Delivery service is temporarily paused.'}
            </Text>
          </View>
        )}

        {/* Free Delivery Threshold Banner */}
        <View
          style={[
            styles.deliveryThresholdBanner,
            qualifiesForFreeDelivery && styles.deliveryThresholdUnlocked,
          ]}
        >
          {qualifiesForFreeDelivery ? (
            <View style={styles.bannerRow}>
              <Sparkles color={colors.primaryDark} size={16} />
              <Text style={styles.unlockedText}>
                Awesome! You unlocked FREE Delivery! 🎉
              </Text>
            </View>
          ) : (
            <View style={styles.bannerRow}>
              <Truck color={colors.primary} size={16} />
              <Text style={styles.thresholdText}>
                Add <Text style={styles.boldText}>₹{freeDeliveryRemaining.toFixed(0)}</Text> more for <Text style={styles.boldText}>FREE delivery</Text>
              </Text>
            </View>
          )}
        </View>

        {/* Minimum Order Value Alert if below */}
        {subtotal < minOrderValue && (
          <View style={styles.minOrderAlert}>
            <AlertCircle color={colors.warning} size={14} />
            <Text style={styles.minOrderText}>
              Min order is ₹{minOrderValue}. Add ₹{minOrderRemaining.toFixed(0)} more to checkout.
            </Text>
          </View>
        )}

        {/* Line Items List */}
        <View style={styles.itemsCard}>
          {items.map((item, index) => {
            const lineTotal = item.effective_price * item.quantity;
            const isLast = index === items.length - 1;

            return (
              <View
                key={item.product_id}
                style={[styles.itemRow, !isLast && styles.itemBorder]}
              >
                {/* Item Thumbnail */}
                <View style={styles.itemImageContainer}>
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.itemImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Package color={colors.textMuted} size={24} />
                  )}
                </View>

                {/* Details */}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemUnit}>{item.unit}</Text>
                  <View style={styles.itemPriceRow}>
                    <Text style={styles.itemUnitPrice}>
                      ₹{item.effective_price.toFixed(0)}
                    </Text>
                    {item.discount_price !== null && item.discount_price < item.price && (
                      <Text style={styles.itemMrpPrice}>
                        ₹{item.price.toFixed(0)}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Stepper & Remove */}
                <View style={styles.stepperActions}>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => handleDecrement(item)}
                      activeOpacity={0.7}
                    >
                      <Minus color={colors.textInverse} size={13} />
                    </TouchableOpacity>
                    <Text style={styles.stepCount}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={[
                        styles.stepBtn,
                        item.quantity >= item.stock_quantity && styles.stepBtnDisabled,
                      ]}
                      onPress={() => handleIncrement(item)}
                      disabled={item.quantity >= item.stock_quantity}
                      activeOpacity={0.7}
                    >
                      <Plus color={colors.textInverse} size={13} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.linePriceRow}>
                    <Text style={styles.lineTotalText}>₹{lineTotal.toFixed(0)}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemove(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 color={colors.danger} size={15} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Bill Breakdown Card */}
        <View style={styles.billCard}>
          <Text style={styles.billTitle}>Bill Details</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total (MRP & Discounts)</Text>
            <Text style={styles.billValue}>₹{subtotal.toFixed(2)}</Text>
          </View>

          <View style={styles.billRow}>
            <View style={styles.deliveryLabelRow}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              {qualifiesForFreeDelivery && (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>FREE</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.billValue,
                qualifiesForFreeDelivery && styles.strikethroughPrice,
              ]}
            >
              ₹{standardDeliveryFee.toFixed(2)}
            </Text>
          </View>

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.grandTotalLabel}>To Pay (Cash on Delivery)</Text>
            <Text style={styles.grandTotalValue}>₹{totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        {/* COD & Server Authority Note */}
        <View style={styles.codNoteContainer}>
          <Text style={styles.codNoteText}>
            🛡️ Cash on Delivery: Final inventory and pricing are verified securely by FreshKart backend upon placing your order.
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Checkout Bar at Bottom */}
      <View style={styles.footer}>
        <View style={styles.footerPriceCol}>
          <Text style={styles.footerPriceLabel}>TOTAL</Text>
          <Text style={styles.footerPriceValue}>₹{totalAmount.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.checkoutBtn,
            !canProceedToCheckout && styles.checkoutBtnDisabled,
          ]}
          onPress={handleProceedToCheckout}
          disabled={!canProceedToCheckout}
          activeOpacity={0.8}
        >
          <Text style={styles.checkoutBtnText}>
            {!isStoreOpen
              ? 'Store Closed'
              : !isDeliveryAvailable
              ? 'Delivery Paused'
              : subtotal < minOrderValue
              ? `Min Order ₹${minOrderValue}`
              : 'Proceed to Checkout'}
          </Text>
          {canProceedToCheckout && <ArrowRight color={colors.textInverse} size={18} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 280,
  },
  browseBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseBtnText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  warningStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEC',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
    flex: 1,
  },
  deliveryThresholdBanner: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primaryLightHover,
  },
  deliveryThresholdUnlocked: {
    backgroundColor: '#EAF7EE',
    borderColor: colors.primary,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thresholdText: {
    fontSize: 12,
    color: colors.text,
  },
  boldText: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
  unlockedText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  minOrderAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF8EC',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  minOrderText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
  itemsCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  itemUnit: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  itemUnitPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  itemMrpPrice: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  stepperActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 6,
  },
  stepBtn: {
    padding: 2,
  },
  stepBtnDisabled: {
    opacity: 0.5,
  },
  stepCount: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 14,
    textAlign: 'center',
  },
  linePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineTotalText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  billCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  billTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  billLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  deliveryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  freeBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  freeBadgeText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
  },
  billValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  strikethroughPrice: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  billDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  codNoteContainer: {
    paddingHorizontal: 4,
  },
  codNoteText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  footerPriceCol: {
    justifyContent: 'center',
  },
  footerPriceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  footerPriceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  checkoutBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  checkoutBtnDisabled: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkoutBtnText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '800',
  },
});
