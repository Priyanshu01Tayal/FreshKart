import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, ShoppingBag, ArrowRight, Home, MapPin, ShieldCheck, Clock } from 'lucide-react-native';
import { colors } from '../../src/theme/colors';
import { useOrderTracking } from '../../src/hooks/useOrderTracking';

export default function OrderConfirmationScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const { order, items, loading, error } = useOrderTracking(orderId);

  const formattedDate = order?.placed_at
    ? new Date(order.placed_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  // Extract address snapshot from JSONB
  const deliveryAddress = (order?.delivery_address as any) || {};

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Header with FreshKart Branding */}
        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <CheckCircle2 color={colors.primary} size={48} strokeWidth={2.5} />
          </View>
          <Text style={styles.brandTitle}>FreshKart</Text>
          <Text style={styles.heroTitle}>Order Placed Successfully!</Text>
          <Text style={styles.heroSubtitle}>
            Your order has been received by our dark store hub and is being prepared.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Fetching order confirmation details...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : order ? (
          <>
            {/* Order Identity Card */}
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View>
                  <Text style={styles.label}>ORDER NUMBER</Text>
                  <Text style={styles.orderNumber}>{order.order_number}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{order.status}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Clock color={colors.textSecondary} size={15} />
                <Text style={styles.infoLabel}>Placed On:</Text>
                <Text style={styles.infoValue}>{formattedDate}</Text>
              </View>

              <View style={styles.infoRow}>
                <ShieldCheck color={colors.primary} size={15} />
                <Text style={styles.infoLabel}>Payment Mode:</Text>
                <Text style={styles.paymentValue}>Cash on Delivery (COD)</Text>
              </View>
            </View>

            {/* Delivery Address Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MapPin color={colors.primary} size={18} />
                <Text style={styles.cardTitle}>Delivery Address</Text>
              </View>
              <Text style={styles.recipientName}>
                {deliveryAddress.recipient_name} ({deliveryAddress.phone})
              </Text>
              <Text style={styles.addressLine}>
                {deliveryAddress.address_line1}
                {deliveryAddress.address_line2 ? `, ${deliveryAddress.address_line2}` : ''}
              </Text>
              {deliveryAddress.landmark && (
                <Text style={styles.landmarkLine}>Landmark: {deliveryAddress.landmark}</Text>
              )}
              <Text style={styles.cityLine}>
                {deliveryAddress.city}, {deliveryAddress.state} - {deliveryAddress.pincode}
              </Text>
            </View>

            {/* Ordered Products Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <ShoppingBag color={colors.primary} size={18} />
                <Text style={styles.cardTitle}>Ordered Items ({items.length})</Text>
              </View>
              {items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>{item.product_name}</Text>
                    <Text style={styles.itemUnit}>
                      {item.quantity} × ₹{Number(item.unit_price).toFixed(2)} / {item.unit}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>₹{Number(item.total_price).toFixed(2)}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              {/* Bill Details */}
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Items Subtotal</Text>
                <Text style={styles.billValue}>₹{Number(order.subtotal).toFixed(2)}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Standard Delivery Fee</Text>
                <Text style={styles.billValue}>
                  {Number(order.delivery_fee) === 0 ? 'FREE' : `₹${Number(order.delivery_fee).toFixed(2)}`}
                </Text>
              </View>
              <View style={[styles.billRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total Payable at Door</Text>
                <Text style={styles.totalValue}>₹{Number(order.total_amount).toFixed(2)}</Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        {order && (
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => router.replace(`/order/${order.id}`)}
            activeOpacity={0.8}
          >
            <Text style={styles.trackBtnText}>Track Live Order</Text>
            <ArrowRight color={colors.textInverse} size={18} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.continueBtn}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Home color={colors.primary} size={18} />
          <Text style={styles.continueBtnText}>Continue Shopping</Text>
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
    gap: 14,
    paddingBottom: 32,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
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
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  paymentValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  addressLine: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  landmarkLine: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  cityLine: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  itemDetails: {
    flex: 1,
    paddingRight: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  itemUnit: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
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
  billValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
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
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
  },
  loadingBox: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorBox: {
    backgroundColor: '#FDE8E8',
    padding: 16,
    borderRadius: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: colors.surface,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  trackBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  trackBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textInverse,
  },
  continueBtn: {
    backgroundColor: colors.surfaceHighlight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  continueBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});

