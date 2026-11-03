import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, MapPin, ArrowRight, ChevronRight, AlertCircle, LogIn, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors } from '../src/theme/colors';
import { useCartStore } from '../src/store/useCartStore';
import { useStoreSettings } from '../src/hooks/useStoreSettings';
import { useAuthStore } from '../src/store/useAuthStore';
import { useAddresses } from '../src/hooks/useAddresses';

export default function CheckoutScreen() {
  const router = useRouter();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const subtotal = useCartStore((state) => state.getSubtotal());
  const itemCount = useCartStore((state) => state.getItemCount());

  const { settings } = useStoreSettings();
  const { selectedAddress, addresses, loading: addressesLoading } = useAddresses();

  const standardDeliveryFee = settings?.standard_delivery_fee ?? 25;
  const freeDeliveryThreshold = settings?.free_delivery_threshold ?? 299;
  const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : standardDeliveryFee;
  const total = subtotal + deliveryFee;

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

  const handlePlaceOrder = () => {
    if (!selectedAddress) {
      Alert.alert('Address Required', 'Please select or add a delivery address to proceed.');
      return;
    }
    // Step 3 stops here; Step 4 implements atomic order placement RPC
    Alert.alert(
      'Order Placement Ready',
      `Address: ${selectedAddress.recipient_name}, ${selectedAddress.address_line1}\nPayment: Cash on Delivery (₹${total.toFixed(2)})\n\nOrder placement transaction will be finalized in Phase 3 Step 4.`
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
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
            </View>
          ) : (
            <TouchableOpacity
              style={styles.noAddressBox}
              onPress={() => router.push('/addresses')}
              activeOpacity={0.7}
            >
              <Plus color={colors.primary} size={20} />
              <Text style={styles.noAddressText}>No address selected. Tap to add or choose one.</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Payment Method Section (Strictly COD) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ShieldCheck color={colors.primary} size={18} />
            <Text style={styles.cardTitle}>Payment Method</Text>
          </View>
          <View style={styles.codRow}>
            <Text style={styles.codLabel}>Cash on Delivery (COD)</Text>
            <Text style={styles.codBadge}>V1 Supported</Text>
          </View>
          <Text style={styles.codNote}>
            Pay in cash to your delivery partner upon package handover. No online payment needed.
          </Text>
        </View>

        {/* Order Summary */}
        <View style={styles.billCard}>
          <Text style={styles.billTitle}>Order Summary ({itemCount} items)</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Items Subtotal</Text>
            <Text style={styles.billVal}>₹{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Standard Delivery Fee</Text>
            <Text style={styles.billVal}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee.toFixed(2)}`}
            </Text>
          </View>
          <View style={[styles.billRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Payable at Door</Text>
            <Text style={styles.totalVal}>₹{total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Place Order CTA */}
      <View style={styles.footer}>
        <View style={styles.footerPriceCol}>
          <Text style={styles.footerPriceLabel}>TOTAL PAYABLE</Text>
          <Text style={styles.footerPriceValue}>₹{total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.placeOrderBtn, !selectedAddress && styles.placeOrderDisabled]}
          onPress={handlePlaceOrder}
          disabled={!selectedAddress}
          activeOpacity={0.8}
        >
          <Text style={styles.placeOrderText}>Place COD Order</Text>
          <ArrowRight color={colors.textInverse} size={18} />
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
    gap: 4,
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  addressTypeBadge: {
    backgroundColor: colors.primaryLight,
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recipientName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  recipientPhone: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  addressLine: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  landmarkText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  cityText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  noAddressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  noAddressText: {
    fontSize: 13,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  codRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  codBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  billCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  billTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  totalVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  footer: {
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  },
  footerPriceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  placeOrderBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  placeOrderDisabled: {
    opacity: 0.6,
  },
  placeOrderText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },
});
