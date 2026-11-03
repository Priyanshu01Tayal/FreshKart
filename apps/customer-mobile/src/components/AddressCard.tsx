import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Home, Briefcase, Tag, Check, Trash2, Edit3 } from 'lucide-react-native';
import { colors } from '../theme/colors';
import type { Address } from '../hooks/useAddresses';

interface AddressCardProps {
  address: Address;
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetDefault?: () => void;
  selectable?: boolean;
}

export function AddressCard({
  address,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
  selectable = false,
}: AddressCardProps) {
  const getIcon = () => {
    switch (address.label.toLowerCase()) {
      case 'work':
        return <Briefcase color={colors.primary} size={16} />;
      case 'home':
        return <Home color={colors.primary} size={16} />;
      default:
        return <Tag color={colors.primary} size={16} />;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && styles.cardSelected,
      ]}
      onPress={selectable ? onSelect : undefined}
      activeOpacity={selectable ? 0.7 : 1}
    >
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View style={styles.labelGroup}>
          <View style={styles.iconCircle}>{getIcon()}</View>
          <Text style={styles.labelText}>{address.label}</Text>
          {address.is_default && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>DEFAULT</Text>
            </View>
          )}
        </View>

        {selectable && isSelected && (
          <View style={styles.selectedCircle}>
            <Check color={colors.textInverse} size={12} />
          </View>
        )}
      </View>

      {/* Recipient Details */}
      <View style={styles.recipientRow}>
        <Text style={styles.recipientName}>{address.recipient_name}</Text>
        <Text style={styles.recipientPhone}>• {address.phone}</Text>
      </View>

      {/* Address Details */}
      <View style={styles.addressBlock}>
        <Text style={styles.addressLine}>
          {address.address_line1}
          {address.address_line2 ? `, ${address.address_line2}` : ''}
        </Text>
        {address.landmark && (
          <Text style={styles.landmarkText}>Landmark: {address.landmark}</Text>
        )}
        <Text style={styles.cityText}>
          {address.city}, {address.state} - {address.pincode}
        </Text>
      </View>

      {/* Action Footer */}
      {(onEdit || onDelete || onSetDefault) && (
        <View style={styles.actionFooter}>
          {!address.is_default && onSetDefault && (
            <TouchableOpacity onPress={onSetDefault} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>Set as Default</Text>
            </TouchableOpacity>
          )}

          <View style={styles.rightActions}>
            {onEdit && (
              <TouchableOpacity onPress={onEdit} style={styles.iconAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Edit3 color={colors.primaryDark} size={16} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity onPress={onDelete} style={styles.iconAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash2 color={colors.danger} size={16} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  defaultBadge: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  selectedCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  recipientPhone: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  addressBlock: {
    marginTop: 6,
    gap: 2,
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
    marginTop: 2,
  },
  actionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.background,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginLeft: 'auto',
  },
  iconAction: {
    padding: 4,
  },
});

