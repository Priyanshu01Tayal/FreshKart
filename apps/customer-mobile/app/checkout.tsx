import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  MapPin,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  LogIn,
  Plus,
  ShoppingBag,
  Store,
  Bike,
  Sparkles,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors } from '../src/theme/colors';
import { useCartStore } from '../src/store/useCartStore';
import { useStoreSettings } from '../src/hooks/useStoreSettings';
import { useAuthStore } from '../src/store/useAuthStore';
import { useAddresses } from '../src/hooks/useAddresses';
import { useServiceability } from '../src/hooks/useServiceability';
import { supabase } from '../src/services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_IDEMPOTENCY_KEY = '@freshkart_pending_checkout_idempotency_key';

export default function CheckoutScreen() {
  const router = useRouter();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const itemCount = useCartStore((state) => state.getItemCount());
  const clearCart = useCartStore((state) => state.clearCart);

  const { settings, loading: settingsLoading } = useStoreSettings();
  const { selectedAddress, loading: addressesLoading } = useAddresses();

  // Serviceability check based on server allowlist and store radius
  const serviceability = useServiceability(selectedAddress, settings);

  // Form State
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Persisted idempotency key across retries, network timeouts, and app restarts
  const [persistedKey, setPersistedKey] = useState<string>('');

  useEffect(() => {
    let active = true;
    async function initKey() {
      try {
        const existing = await AsyncStorage.getItem(PENDING_IDEMPOTENCY_KEY);
        if (existing && existing.trim()) {
          if (active) setPersistedKey(existing.trim());
        } else {
          const freshKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await AsyncStorage.setItem(PENDING_IDEMPOTENCY_KEY, freshKey);
          if (active) setPersistedKey(freshKey);
        }
      } catch {
        const fallbackKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        if (active) setPersistedKey(fallbackKey);
      }
    }
    initKey();
    return () => {
      active = false;
    };
  }, []);

  const standardDeliveryFee = settings?.standard_delivery_fee ?? 25;
  const freeDeliveryThreshold = settings?.free_delivery_threshold ?? 299;
  const minOrderValue = settings?.min_order_value ?? 99;

  const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : standardDeliveryFee;
  const total = subtotal + deliveryFee;
  const isBelowMinOrder = subtotal < minOrderValue;
  const freeDeliveryGap = freeDeliveryThreshold - subtotal;

  const isStoreOpen = settings?.is_store_open ?? true;
  const isDeliveryAvailable = settings?.is_delivery_available ?? true;

  // Protect route
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace({
        pathname: '/(auth)/login',
        params: { returnTo: '/checkout' },
      });
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authNotice}>
          <LogIn color={colors.primary} size={36} />
          <Text style={styles.authTitle}>Login Required</Text>
          <Text style={styles.authSubtitle}>
            Please sign in to your account to review addresses and place orders.
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() =>
              router.replace({
                pathname: '/(auth)/login',
                params: { returnTo: '/checkout' },
              })
            }
          >
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Can place order check
  const canPlaceOrder =
    selectedAddress !== null &&
    serviceability.isServiceable &&
    !isBelowMinOrder &&
    isStoreOpen &&
    isDeliveryAvailable &&
    items.length > 0 &&
    !isSubmitting;

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please select or add a delivery address to proceed.');
      return;
    }

    if (!serviceability.isServiceable) {
      Alert.alert('Address Unserviceable', serviceability.reason || 'We cannot deliver to this address.');
      return;
    }

    if (!isStoreOpen) {
      Alert.alert('Store Closed', 'FreshKart store is currently closed. Please check back later.');
      return;
    }

    if (!isDeliveryAvailable) {
      Alert.alert('Delivery Paused', 'Delivery services are temporarily paused. Please try again shortly.');
      return;
    }

    if (isBelowMinOrder) {
      Alert.alert(
        'Minimum Order Required',
        `Minimum order amount is ₹${minOrderValue.toFixed(2)}. Current subtotal is ₹${subtotal.toFixed(2)}.`
      );
      return;
    }

    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty. Please add items before checking out.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      // Prepare payload for atomic place_order RPC
      const rpcItems = items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      // Use the persisted idempotency key (or fallback if storage is initializing)
      let activeKey = persistedKey;
      if (!activeKey) {
        activeKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        await AsyncStorage.setItem(PENDING_IDEMPOTENCY_KEY, activeKey).catch(() => {});
      }

      const { data, error } = await supabase.rpc('place_order', {
        p_address_id: selectedAddress.id,
        p_items: rpcItems as any,
        p_customer_notes: customerNotes.trim() ? customerNotes.trim() : null,
        p_idempotency_key: activeKey,
      });

      if (error) {
        throw new Error(error.message);
      }

      const res = data as any;
      if (!res || !res.order_id) {
        throw new Error('Order creation was not acknowledged by the server.');
      }

      // Order definitively resolved on server: clear persisted idempotency key
      await AsyncStorage.removeItem(PENDING_IDEMPOTENCY_KEY).catch(() => {});

      // CRITICAL UX REQUIREMENT: Clear cart ONLY after confirmed database success!
      clearCart();

      // Navigate to Order Confirmation Screen
      router.replace({
        pathname: '/order/confirmation',
        params: { orderId: res.order_id },
      });
    } catch (err) {
      // Cart remains 100% intact on failure!
      const msg = err instanceof Error ? err.message : 'Failed to place order. Please try again.';
      setErrorMessage(msg);
      Alert.alert('Order Placement Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Store Closed / Paused Alerts */}
        {!isStoreOpen && (
          <View style={styles.alertBanner}>
            <Store color={colors.danger} size={18} />
            <Text style={styles.alertBannerText}>
              Store is currently closed. Orders cannot be accepted right now.
            </Text>
          </View>
        )}

        {isStoreOpen && !isDeliveryAvailable && (
          <View style={styles.alertBanner}>
            <Bike color={colors.warning} size={18} />
            <Text style={styles.alertBannerText}>
              Delivery services are temporarily paused in your area.
            </Text>
          </View>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <AlertCircle color={colors.danger} size={18} />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {/* Delivery Address Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MapPin color={colors.primary} size={18} />
            <Text style={styles.cardTitle}>Delivery Address</Text>
            <TouchableOpacity
              onPress={() => router.push('/addresses')}
              style={styles.changeAddressBtn}
            >
              <Text style={styles.changeAddressText}>
                {selectedAddress ? 'Change' : 'Add'}
              </Text>
              <ChevronRight color={colors.primary} size={14} />
            </TouchableOpacity>
          </View>

          {selectedAddress ? (
            <View style={styles.addressBox}>
              <View style={styles.addressLabelRow}>
                <Text style={styles.addressTypeBadge}>{selectedAddress.label}</Text>
                <Text style={styles.recipientName}>{selectedAddress.recipient_name}</Text>
                <Text style={styles.recipientPhone}>({selectedAddress.phone})</Text>
              </View>
              <Text style={styles.addressLine}>
                {selectedAddress.address_line1}
                {selectedAddress.address_line2 ? `, ${selectedAddress.address_line2}` : ''}
              </Text>
              {selectedAddress.landmark && (
                <Text style={styles.landmarkText}>Landmark: {selectedAddress.landmark}</Text>
              )}
              <Text style={styles.cityText}>
                {selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}
              </Text>

              {/* Server-Gated Serviceability Check Indicator */}
              {!serviceability.isServiceable && (
                <View style={styles.unserviceablePill}>
                  <AlertCircle color={colors.danger} size={14} />
                  <Text style={styles.unserviceableText}>
                    {serviceability.reason}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.noAddressBox}
              onPress={() => router.push('/addresses')}
              activeOpacity={0.7}
            >
              <Plus color={colors.primary} size={20} />
              <Text style={styles.noAddressText}>No address selected. Tap to choose one.</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cart Products Summary */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ShoppingBag color={colors.primary} size={18} />
            <Text style={styles.cardTitle}>Cart Items ({itemCount})</Text>
          </View>
          {items.map((item) => (
            <View key={item.product_id} style={styles.itemSummaryRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} × ₹{item.effective_price.toFixed(2)} / {item.unit}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                ₹{(item.effective_price * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Customer Delivery Notes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="e.g. Please ring doorbell / Leave at security gate"
            placeholderTextColor={colors.textMuted}
            value={customerNotes}
            onChangeText={setCustomerNotes}
            maxLength={200}
          />
        </View>

        {/* Payment Method Section (Strictly COD) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ShieldCheck color={colors.primary} size={18} />
            <Text style={styles.cardTitle}>Payment Method</Text>
          </View>
          <View style={styles.codRow}>
            <Text style={styles.codLabel}>Cash on Delivery (COD)</Text>
            <View style={styles.codBadge}>
              <Text style={styles.codBadgeText}>Selected</Text>
            </View>
          </View>
          <Text style={styles.codNote}>
            Pay in cash to your delivery partner upon package handover. No online payment required in V1.
          </Text>
        </View>

        {/* Free Delivery / Threshold Progress */}
        {freeDeliveryGap > 0 ? (
          <View style={styles.freeDeliveryBanner}>
            <Sparkles color={colors.primary} size={16} />
            <Text style={styles.freeDeliveryText}>
              Add ₹{freeDeliveryGap.toFixed(2)} more to unlock <Text style={styles.boldText}>FREE delivery</Text>!
            </Text>
          </View>
        ) : (
          <View style={styles.freeDeliveryUnlocked}>
            <Sparkles color={colors.primary} size={16} />
            <Text style={styles.freeDeliveryUnlockedText}>
              🎉 You have unlocked <Text style={styles.boldText}>FREE delivery</Text>!
            </Text>
          </View>
        )}

        {/* Bill Summary */}
        <View style={styles.billCard}>
          <Text style={styles.billTitle}>Bill Breakdown</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Items Subtotal</Text>
            <Text style={styles.billVal}>₹{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Standard Delivery Fee</Text>
            <Text style={[styles.billVal, deliveryFee === 0 && styles.freeFeeText]}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee.toFixed(2)}`}
            </Text>
          </View>

          {isBelowMinOrder && (
            <View style={styles.minOrderNotice}>
              <AlertCircle color={colors.danger} size={14} />
              <Text style={styles.minOrderText}>
                Minimum order value is ₹{minOrderValue.toFixed(2)}. Add ₹
                {(minOrderValue - subtotal).toFixed(2)} more to proceed.
              </Text>
            </View>
          )}

          <View style={[styles.billRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Payable at Door</Text>
            <Text style={styles.totalVal}>₹{total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Place Order CTA */}
      <View style={styles.footer}>
        <View style={styles.footerPriceCol}>
          <Text style={styles.footerPriceLabel}>TOTAL AMOUNT (COD)</Text>
          <Text style={styles.footerPriceValue}>₹{total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.placeOrderBtn, !canPlaceOrder && styles.placeOrderDisabled]}
          onPress={handlePlaceOrder}
          disabled={!canPlaceOrder}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <>
              <Text style={styles.placeOrderText}>Place COD Order</Text>
              <ArrowRight color={colors.textInverse} size={18} />
            </>
          )}
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
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  authNotice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  authSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  loginBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  loginBtnText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDE8E8',
    padding: 12,
    borderRadius: 12,
  },
  alertBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 12,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
    flex: 1,
  },
  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
  },
  changeAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  changeAddressText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  addressBox: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  addressTypeBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  recipientName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  recipientPhone: {
    fontSize: 12,
    color: colors.textMuted,
  },
  addressLine: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  landmarkText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  cityText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
  unserviceablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDE8E8',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  unserviceableText: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: '700',
    flex: 1,
  },
  noAddressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.surfaceHighlight,
    gap: 8,
  },
  noAddressText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  itemSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  itemMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  notesInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: colors.text,
    marginTop: 6,
  },
  codRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  codLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  codBadge: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  codBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  codNote: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  freeDeliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceHighlight,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  freeDeliveryText: {
    fontSize: 12,
    color: colors.primaryDark,
    flex: 1,
  },
  freeDeliveryUnlocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceHighlight,
    padding: 12,
    borderRadius: 12,
  },
  freeDeliveryUnlockedText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  boldText: {
    fontWeight: '800',
  },
  billCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  billTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  billLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  billVal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  freeFeeText: {
    color: colors.primary,
    fontWeight: '800',
  },
  minOrderNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDE8E8',
    padding: 8,
    borderRadius: 8,
    marginVertical: 6,
  },
  minOrderText: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: '700',
    flex: 1,
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  totalVal: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
  },
  footer: {
    backgroundColor: colors.surface,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerPriceCol: {
    flex: 1,
  },
  footerPriceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  footerPriceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  placeOrderBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    minWidth: 160,
  },
  placeOrderDisabled: {
    backgroundColor: colors.disabled,
  },
  placeOrderText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '800',
  },
});
