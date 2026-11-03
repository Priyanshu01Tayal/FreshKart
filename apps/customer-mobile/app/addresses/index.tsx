import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, MapPin, AlertTriangle } from 'lucide-react-native';
import { colors } from '../../src/theme/colors';
import { useAddresses, Address, AddressInput } from '../../src/hooks/useAddresses';
import { useAuthStore } from '../../src/store/useAuthStore';
import { AddressCard } from '../../src/components/AddressCard';
import { AddressFormModal } from '../../src/components/AddressFormModal';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadingSkeleton } from '../../src/components/LoadingSkeleton';

export default function AddressesScreen() {
  const profile = useAuthStore((state) => state.profile);
  const user = useAuthStore((state) => state.user);

  const {
    addresses,
    loading,
    error,
    refetch,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  } = useAddresses();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleOpenAdd = () => {
    setEditingAddress(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (addr: Address) => {
    setEditingAddress(addr);
    setModalVisible(true);
  };

  const handleDelete = (addr: Address) => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to remove this ${addr.label} address?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteAddress(addr.id);
            if (!res.success && res.message) {
              Alert.alert('Error', res.message);
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (addr: Address) => {
    const res = await setDefaultAddress(addr.id);
    if (!res.success && res.message) {
      Alert.alert('Error', res.message);
    }
  };

  const handleSaveModal = async (data: AddressInput) => {
    if (editingAddress) {
      return updateAddress(editingAddress.id, data);
    } else {
      return addAddress(data);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Top Banner to Add Address */}
      <View style={styles.topBar}>
        <View style={styles.topInfo}>
          <Text style={styles.topTitle}>Saved Addresses</Text>
          <Text style={styles.topSubtitle}>
            {addresses.length} {addresses.length === 1 ? 'address' : 'addresses'} saved
          </Text>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd} activeOpacity={0.8}>
          <Plus color={colors.textInverse} size={16} />
          <Text style={styles.addBtnText}>Add New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {loading && !refreshing ? (
          <LoadingSkeleton message="Loading your addresses..." />
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load addresses"
            description={error}
            actionLabel="Try Again"
            onAction={refetch}
          />
        ) : addresses.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No Saved Addresses"
            description="Add your delivery address so FreshKart can deliver groceries right to your doorstep."
            actionLabel="Add Your First Address"
            onAction={handleOpenAdd}
          />
        ) : (
          addresses.map((item) => (
            <AddressCard
              key={item.id}
              address={item}
              onEdit={() => handleOpenEdit(item)}
              onDelete={() => handleDelete(item)}
              onSetDefault={() => handleSetDefault(item)}
            />
          ))
        )}
      </ScrollView>

      {/* Address Add / Edit Modal */}
      <AddressFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveModal}
        initialAddress={editingAddress}
        defaultName={profile?.full_name || ''}
        defaultPhone={profile?.phone_number || user?.phone || ''}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topInfo: {
    gap: 2,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  topSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  addBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  addBtnText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
});

