import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Clock, Package, Bike, XCircle } from 'lucide-react-native';
import { colors } from '../../src/theme/colors';

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* Order Identifier Header */}
        <View style={styles.card}>
          <Text style={styles.orderLabel}>Tracking Order</Text>
          <Text style={styles.orderNumber}>#{id || 'FK-20261102-XXXX'}</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>Status: Live Tracking</Text>
          </View>
        </View>

        {/* Realtime 5-Step Order Status Timeline */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Progress</Text>
          <View style={styles.stepper}>
            <View style={styles.stepRow}>
              <CheckCircle2 color={colors.primary} size={20} />
              <View style={styles.stepDetails}>
                <Text style={styles.stepTitle}>Order Placed</Text>
                <Text style={styles.stepDesc}>Received by store backend</Text>
              </View>
            </View>

            <View style={styles.stepRow}>
              <Clock color={colors.textMuted} size={20} />
              <View style={styles.stepDetails}>
                <Text style={[styles.stepTitle, styles.pendingTitle]}>Order Confirmed</Text>
                <Text style={styles.stepDesc}>Store accepted your order</Text>
              </View>
            </View>

            <View style={styles.stepRow}>
              <Package color={colors.textMuted} size={20} />
              <View style={styles.stepDetails}>
                <Text style={[styles.stepTitle, styles.pendingTitle]}>Packed & Rider Assigned</Text>
                <Text style={styles.stepDesc}>Grocery packed in eco-bag</Text>
              </View>
            </View>

            <View style={styles.stepRow}>
              <Bike color={colors.textMuted} size={20} />
              <View style={styles.stepDetails}>
                <Text style={[styles.stepTitle, styles.pendingTitle]}>Out for Delivery</Text>
                <Text style={styles.stepDesc}>Rider is on the way to you</Text>
              </View>
            </View>

            <View style={styles.stepRow}>
              <CheckCircle2 color={colors.textMuted} size={20} />
              <View style={styles.stepDetails}>
                <Text style={[styles.stepTitle, styles.pendingTitle]}>Delivered (COD Collected)</Text>
                <Text style={styles.stepDesc}>Payment settled with rider</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Cancellation Option (Active strictly during PLACED) */}
        <TouchableOpacity style={styles.cancelBtn}>
          <XCircle color={colors.danger} size={16} />
          <Text style={styles.cancelText}>Cancel Order (Only available while Placed)</Text>
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
  orderLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
  },
  stepper: {
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepDetails: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  pendingTitle: {
    color: colors.textMuted,
  },
  stepDesc: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerLight,
    backgroundColor: colors.dangerLight,
    gap: 6,
  },
  cancelText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
});

