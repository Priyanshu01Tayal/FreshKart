import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  Clock,
  Package,
  Bike,
  XCircle,
  MapPin,
  ShieldCheck,
  Phone,
  User,
  ShoppingBag,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react-native';
import { colors } from '../../src/theme/colors';
import { useOrderTracking } from '../../src/hooks/useOrderTracking';
import type { OrderStatus } from '@freshkart/shared';

const STATUS_STEPS: { status: OrderStatus; label: string; desc: string }[] = [
  { status: 'PLACED', label: 'Order Placed', desc: 'Received by store hub' },
  { status: 'CONFIRMED', label: 'Order Confirmed', desc: 'Store accepted your order' },
  { status: 'PACKED', label: 'Packed & Assigned', desc: 'Items packed in eco-bag' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', desc: 'Rider is on the way to you' },
  { status: 'DELIVERED', label: 'Delivered', desc: 'Cash collected at your door' },
];

function getStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'PLACED':
      return 0;
    case 'CONFIRMED':
      return 1;
    case 'PACKED':
      return 2;
    case 'OUT_FOR_DELIVERY':
      return 3;
    case 'DELIVERED':
      return 4;
    default:
      return -1;
  }
}

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    order,
    items,
    deliveryPartner,
    loading,
    error,
    isCancelling,
    refetch,
    cancelOrder,
  } = useOrderTracking(id);

  const [confirmCancelModal, setConfirmCancelModal] = useState<boolean>(false);

  if (loading && !order) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Connecting to live tracking...</Text>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <XCircle color={colors.danger} size={48} />
        <Text style={styles.errorTitle}>Order Tracking Unavailable</Text>
        <Text style={styles.errorSubtitle}>
          {error || 'Could not locate order with the requested identifier.'}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
          <RotateCcw color={colors.textInverse} size={16} />
          <Text style={styles.retryBtnText}>Retry Connection</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isCancelled = order.status === 'CANCELLED';
  const currentStep = getStepIndex(order.status);
  const canCancel = order.status === 'PLACED';

  const deliveryAddress = (order.delivery_address as any) || {};

  const handlePromptCancel = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? Once confirmed by the store, cancellation will no longer be possible.',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            const res = await cancelOrder('Cancelled by customer');
            if (!res.success) {
              Alert.alert('Cancellation Error', res.message || 'Unable to cancel order.');
            }
          },
        },
      ]
    );
  };

  const handleCallPartner = () => {
    if (deliveryPartner?.phone_number) {
      Linking.openURL(`tel:${deliveryPartner.phone_number}`).catch(() => {
        Alert.alert('Error', 'Unable to initiate phone call.');
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Cancelled Banner */}
        {isCancelled && (
          <View style={styles.cancelledBanner}>
            <XCircle color={colors.danger} size={22} />
            <View style={styles.cancelledContent}>
              <Text style={styles.cancelledTitle}>Order Cancelled</Text>
              <Text style={styles.cancelledReason}>
                Reason: {order.cancellation_reason || 'Cancelled'}
              </Text>
              {order.cancelled_at && (
                <Text style={styles.cancelledTime}>
                  Cancelled on: {new Date(order.cancelled_at).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Order Identifier Header */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View>
              <Text style={styles.orderLabel}>ORDER TRACKING</Text>
              <Text style={styles.orderNumber}>{order.order_number}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                isCancelled && styles.statusBadgeCancelled,
                order.status === 'DELIVERED' && styles.statusBadgeDelivered,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isCancelled && styles.statusBadgeTextCancelled,
                  order.status === 'DELIVERED' && styles.statusBadgeTextDelivered,
                ]}
              >
                {order.status.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>
        </View>

        {/* Realtime 5-Step Status Timeline (Hidden if Cancelled) */}
        {!isCancelled && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Order Progress</Text>
            <View style={styles.timeline}>
              {STATUS_STEPS.map((step, index) => {
                const isCompleted = index <= currentStep;
                const isCurrent = index === currentStep;

                return (
                  <View key={step.status} style={styles.stepContainer}>
                    <View style={styles.indicatorCol}>
                      <View
                        style={[
                          styles.stepDot,
                          isCompleted && styles.stepDotCompleted,
                          isCurrent && styles.stepDotCurrent,
                        ]}
                      >
                        {isCompleted ? (
                          <CheckCircle2 color={colors.textInverse} size={14} />
                        ) : (
                          <View style={styles.pendingDot} />
                        )}
                      </View>
                      {index < STATUS_STEPS.length - 1 && (
                        <View
                          style={[
                            styles.stepLine,
                            index < currentStep && styles.stepLineCompleted,
                          ]}
                        />
                      )}
                    </View>

                    <View style={styles.stepTextCol}>
                      <Text
                        style={[
                          styles.stepTitle,
                          isCompleted && styles.stepTitleCompleted,
                          isCurrent && styles.stepTitleCurrent,
                        ]}
                      >
                        {step.label}
                      </Text>
                      <Text style={styles.stepDesc}>{step.desc}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Delivery Partner Info (When Assigned) */}
        {deliveryPartner && !isCancelled && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Bike color={colors.primary} size={18} />
              <Text style={styles.cardTitle}>Delivery Partner Assigned</Text>
            </View>
            <View style={styles.partnerRow}>
              <View style={styles.partnerAvatar}>
                <User color={colors.primary} size={22} />
              </View>
              <View style={styles.partnerDetails}>
                <Text style={styles.partnerName}>{deliveryPartner.full_name}</Text>
                <Text style={styles.partnerSubtitle}>FreshKart Delivery Fleet</Text>
              </View>
              {deliveryPartner.phone_number && (
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={handleCallPartner}
                  activeOpacity={0.7}
                >
                  <Phone color={colors.textInverse} size={16} />
                  <Text style={styles.callBtnText}>Call</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Cash on Delivery Details */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ShieldCheck color={colors.primary} size={18} />
            <Text style={styles.cardTitle}>Payment Details (COD)</Text>
          </View>
          <View style={styles.codRow}>
            <Text style={styles.codLabel}>Cash on Delivery Status:</Text>
            <Text
              style={[
                styles.codStatusText,
                order.cod_status === 'HELD_BY_PARTNER' && styles.codPaidText,
              ]}
            >
              {order.cod_status === 'PENDING_COLLECTION'
                ? 'Pending Collection at Door'
                : 'Collected by Partner'}
            </Text>
          </View>
          <View style={styles.codRow}>
            <Text style={styles.codAmountLabel}>Payable Total Amount:</Text>
            <Text style={styles.codAmountVal}>₹{Number(order.total_amount).toFixed(2)}</Text>
          </View>
        </View>

        {/* Delivery Address Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MapPin color={colors.primary} size={18} />
            <Text style={styles.cardTitle}>Delivering To</Text>
          </View>
          <Text style={styles.recipientName}>
            {deliveryAddress.recipient_name} ({deliveryAddress.phone})
          </Text>
          <Text style={styles.addressLine}>
            {deliveryAddress.address_line1}
            {deliveryAddress.address_line2 ? `, ${deliveryAddress.address_line2}` : ''}
          </Text>
          {deliveryAddress.landmark && (
            <Text style={styles.landmarkText}>Landmark: {deliveryAddress.landmark}</Text>
          )}
          <Text style={styles.cityText}>
            {deliveryAddress.city}, {deliveryAddress.state} - {deliveryAddress.pincode}
          </Text>
        </View>

        {/* Ordered Line Items Summary */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <ShoppingBag color={colors.primary} size={18} />
            <Text style={styles.cardTitle}>Order Items ({items.length})</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemUnit}>
                  {item.quantity} × ₹{Number(item.unit_price).toFixed(2)} / {item.unit}
                </Text>
              </View>
              <Text style={styles.itemTotal}>₹{Number(item.total_price).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Customer Order Cancellation Action (Strictly while PLACED) */}
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelActionBtn}
            onPress={handlePromptCancel}
            disabled={isCancelling}
            activeOpacity={0.8}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <XCircle color={colors.danger} size={18} />
                <Text style={styles.cancelActionText}>Cancel Order (Allowed in Placed state)</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {!canCancel && !isCancelled && order.status !== 'DELIVERED' && (
          <View style={styles.lockNotice}>
            <AlertTriangle color={colors.textMuted} size={15} />
            <Text style={styles.lockNoticeText}>
              Order is being processed. Cancellations are no longer permitted.
            </Text>
          </View>
        )}
      </ScrollView>
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
  },
  errorSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    marginTop: 12,
  },
  retryBtnText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderLabel: {
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
  statusBadge: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  statusBadgeCancelled: {
    backgroundColor: '#FEE2E2',
    borderColor: colors.danger,
  },
  statusBadgeDelivered: {
    backgroundColor: colors.surfaceHighlight,
    borderColor: colors.primary,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  statusBadgeTextCancelled: {
    color: colors.danger,
  },
  statusBadgeTextDelivered: {
    color: colors.primary,
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEE2E2',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  cancelledContent: {
    flex: 1,
  },
  cancelledTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.danger,
  },
  cancelledReason: {
    fontSize: 12,
    color: '#7F1D1D',
    marginTop: 2,
  },
  cancelledTime: {
    fontSize: 11,
    color: '#991B1B',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 14,
  },
  timeline: {
    paddingLeft: 6,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  indicatorCol: {
    alignItems: 'center',
    width: 24,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotCompleted: {
    backgroundColor: colors.primary,
  },
  stepDotCurrent: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 1.15 }],
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface,
  },
  stepLine: {
    width: 2,
    height: 36,
    backgroundColor: colors.border,
  },
  stepLineCompleted: {
    backgroundColor: colors.primary,
  },
  stepTextCol: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 22,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  stepTitleCompleted: {
    color: colors.text,
    fontWeight: '700',
  },
  stepTitleCurrent: {
    color: colors.primary,
    fontWeight: '800',
  },
  stepDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
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
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  partnerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerDetails: {
    flex: 1,
  },
  partnerName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  partnerSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
  },
  callBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  callBtnText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
  codRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  codLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  codStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
  },
  codPaidText: {
    color: colors.primary,
  },
  codAmountLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  codAmountVal: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  recipientName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  addressLine: {
    fontSize: 12,
    color: colors.textSecondary,
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
  itemRow: {
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
  itemUnit: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  cancelActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    gap: 8,
    marginTop: 6,
  },
  cancelActionText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  lockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
  },
  lockNoticeText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
