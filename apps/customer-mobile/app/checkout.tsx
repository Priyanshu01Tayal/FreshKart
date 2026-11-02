import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, MapPin, ArrowRight } from 'lucide-react-native';
import { colors } from '../src/theme/colors';
import { useCartStore } from '../src/store/useCartStore';

export default function CheckoutScreen() {
  const subtotal = useCartStore((state) => state.getSubtotal());

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* Delivery Address Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MapPin color={colors.primary} size={18} />
            <Text style={styles.cardTitle}>Delivery Destination</Text>
          </View>
          <Text style={styles.addressName}>Home (Koramangala Hub Zone)</Text>
          <Text style={styles.addressLine}>
            124, 80 Feet Road, 4th Block, Koramangala, Bengaluru
          </Text>
        </View>

        {/* Payment Method Section (Strictly COD) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ShieldCheck color={colors.primary} size={18} />
            <Text style={styles.cardTitle}>Payment Method</Text>
          </View>
          <View style={styles.codRow}>
            <Text style={styles.codLabel}>Cash on Delivery (COD)</Text>
            <Text style={styles.codBadge}>Only V1 Option</Text>
          </View>
          <Text style={styles.codNote}>
            Pay in cash to the delivery partner upon arrival. Please keep exact change ready.
          </Text>
        </View>

        {/* Bill Summary */}
        <View style={styles.billCard}>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Items Subtotal</Text>
            <Text style={styles.billVal}>₹{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Standard Delivery Fee</Text>
            <Text style={styles.billVal}>₹25.00</Text>
          </View>
          <View style={[styles.billRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Payable at Door</Text>
            <Text style={styles.totalVal}>₹{(subtotal + 25).toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Place Order CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.placeOrderBtn}>
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
    flex: 1,
    padding: 16,
    gap: 12,
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
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  addressName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  addressLine: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
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
    color: colors.textMuted,
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
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billLabel: {
    fontSize: 13,
    color: colors.textMuted,
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
  },
  placeOrderBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  placeOrderText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },
});
