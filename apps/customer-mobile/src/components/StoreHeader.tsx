import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Store, MapPin, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { colors } from '../theme/colors';
import type { StoreSettings } from '../hooks/useStoreSettings';

interface StoreHeaderProps {
  settings: StoreSettings | null;
  loading: boolean;
}

export function StoreHeader({ settings, loading }: StoreHeaderProps) {
  if (loading && !settings) {
    return (
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Store color={colors.primary} size={16} />
          <Text style={styles.storeName}>FreshKart Store</Text>
        </View>
        <Text style={styles.loadingText}>Fetching store status...</Text>
      </View>
    );
  }

  const storeName = settings?.store_name || 'FreshKart Delivery';
  const isStoreOpen = settings?.is_store_open ?? true;
  const isDeliveryAvailable = settings?.is_delivery_available ?? true;
  const storeAddress = settings?.store_address || '';
  const radiusKm = settings?.delivery_radius_km;

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.storeInfo}>
          <Store color={colors.primary} size={16} />
          <Text style={styles.storeName} numberOfLines={1}>
            {storeName}
          </Text>
        </View>

        {/* Live Store Status Indicator */}
        {isStoreOpen && isDeliveryAvailable ? (
          <View style={styles.statusBadgeOpen}>
            <CheckCircle2 color={colors.primaryDark} size={12} />
            <Text style={styles.statusTextOpen}>Open for Delivery</Text>
          </View>
        ) : !isStoreOpen ? (
          <View style={styles.statusBadgeClosed}>
            <AlertCircle color={colors.danger} size={12} />
            <Text style={styles.statusTextClosed}>Store Closed</Text>
          </View>
        ) : (
          <View style={styles.statusBadgePaused}>
            <AlertCircle color={colors.warning} size={12} />
            <Text style={styles.statusTextPaused}>Delivery Paused</Text>
          </View>
        )}
      </View>

      {/* Store Location and Radius Info */}
      {storeAddress ? (
        <View style={styles.locationRow}>
          <MapPin color={colors.textSecondary} size={13} />
          <Text style={styles.addressText} numberOfLines={1}>
            {storeAddress}
            {radiusKm ? ` • Serving ${radiusKm} km radius` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  storeName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  statusBadgeOpen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextOpen: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  statusBadgeClosed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDECEC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextClosed: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
  },
  statusBadgePaused: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF8EC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextPaused: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  addressText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
});
