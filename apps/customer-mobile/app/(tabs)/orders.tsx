import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Clock,
  ChevronRight,
  PackageCheck,
  ShoppingBag,
  AlertCircle,
  LogIn,
  ShieldAlert,
} from 'lucide-react-native';
import { colors } from '../../src/theme/colors';
import { useOrders, OrderWithSummary } from '../../src/hooks/useOrders';
import { useAuthStore } from '../../src/store/useAuthStore';
import type { OrderStatus, CodStatus } from '@freshkart/shared';

function getStatusBadgeStyle(status: OrderStatus) {
  switch (status) {
    case 'PLACED':
      return { bg: '#EBF5FF', text: '#1E429F', border: '#C3DDFD' };
    case 'CONFIRMED':
      return { bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF' };
    case 'PACKED':
      return { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' };
    case 'OUT_FOR_DELIVERY':
      return { bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA' };
    case 'DELIVERED':
      return { bg: colors.surfaceHighlight, text: colors.primary, border: colors.primaryLight };
    case 'CANCELLED':
      return { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' };
    default:
      return { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };
  }
}

function getCodBadgeStyle(codStatus: CodStatus) {
  switch (codStatus) {
    case 'PENDING_COLLECTION':
      return { text: 'Cash Pending', color: '#B45309' };
    case 'HELD_BY_PARTNER':
      return { text: 'Cash Paid to Rider', color: '#15803D' };
    case 'SETTLED_WITH_ADMIN':
      return { text: 'COD Settled', color: '#047857' };
    default:
      return { text: codStatus, color: colors.textMuted };
  }
}

export default function OrdersScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { orders, loading, error, refetch } = useOrders();

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Orders</Text>
        </View>
        <View style={styles.emptyContainer}>
          <LogIn color={colors.primary} size={48} />
          <Text style={styles.emptyTitle}>Login to View Orders</Text>
          <Text style={styles.emptySubtitle}>
            Sign in with your mobile number to view past orders and track active deliveries.
          </Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              router.push({
                pathname: '/(auth)/login',
                params: { returnTo: '/(tabs)/orders' },
              })
            }
          >
            <Text style={styles.actionBtnText}>Sign In / Register</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderOrderItem = ({ item }: { item: OrderWithSummary }) => {
    const statusStyle = getStatusBadgeStyle(item.status);
    const codStyle = getCodBadgeStyle(item.cod_status);
    const placedDate = new Date(item.placed_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => router.push(`/order/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardTopRow}>
          <View>
            <Text style={styles.orderNumber}>{item.order_number}</Text>
            <Text style={styles.orderDate}>{placedDate}</Text>
          </View>

          <View
            style={[
              styles.statusPill,
              { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
            ]}
          >
            <Text style={[styles.statusPillText, { color: statusStyle.text }]}>
              {item.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        {item.items_summary ? (
          <Text style={styles.itemsSummary} numberOfLines={2}>
            {item.items_summary}
          </Text>
        ) : null}

        <View style={styles.cardDivider} />

        <View style={styles.cardBottomRow}>
          <View>
            <Text style={styles.codLabel}>{codStyle.text}</Text>
            <Text style={styles.totalAmount}>₹{Number(item.total_amount).toFixed(2)}</Text>
          </View>

          <View style={styles.viewDetailsRow}>
            <Text style={styles.viewDetailsText}>Track Order</Text>
            <ChevronRight color={colors.primary} size={16} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
      </View>

      {loading && orders.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching your orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <AlertCircle color={colors.danger} size={44} />
          <Text style={styles.emptyTitle}>Could not load orders</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={refetch}>
            <Text style={styles.actionBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ShoppingBag color={colors.textMuted} size={48} />
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptySubtitle}>
            You haven't placed any grocery orders yet. Start filling your cart with fresh essentials!
          </Text>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.actionBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
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
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  orderDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  itemsSummary: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 1,
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  actionBtnText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
});
