import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  LogIn,
  MapPin,
  LogOut,
  ChevronRight,
  Edit2,
  ShieldCheck,
  ShoppingBag,
  Info,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useAddresses } from '../../src/hooks/useAddresses';
import { useCartStore } from '../../src/store/useCartStore';

export default function ProfileScreen() {
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const signOut = useAuthStore((state) => state.signOut);

  const { addresses } = useAddresses();
  const itemCount = useCartStore((state) => state.getItemCount());

  // Edit Name Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [fullNameInput, setFullNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  const handleOpenEditName = () => {
    setFullNameInput(profile?.full_name || '');
    setEditModalVisible(true);
  };

  const handleSaveName = async () => {
    setSavingName(true);
    const res = await updateProfile(fullNameInput);
    setSavingName(false);
    if (res.success) {
      setEditModalVisible(false);
    } else {
      Alert.alert('Error', res.message || 'Could not update name.');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your cart items will remain safe in this app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Account & Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isAuthenticated ? (
          <>
            {/* User Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <User color={colors.textInverse} size={32} />
              </View>

              <View style={styles.profileInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {profile?.full_name || 'Customer'}
                  </Text>
                  <TouchableOpacity onPress={handleOpenEditName} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Edit2 color={colors.primary} size={16} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.profilePhone}>
                  {profile?.phone_number || user?.phone || 'No phone number'}
                </Text>
                <View style={styles.roleBadge}>
                  <ShieldCheck color={colors.primaryDark} size={12} />
                  <Text style={styles.roleBadgeText}>
                    {profile?.role?.toUpperCase() || 'CUSTOMER'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Menu Sections */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Quick Actions</Text>

              {/* Delivery Addresses */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push('/addresses')}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: colors.primaryLight }]}>
                  <MapPin color={colors.primary} size={18} />
                </View>
                <View style={styles.menuDetails}>
                  <Text style={styles.menuTitle}>Saved Delivery Addresses</Text>
                  <Text style={styles.menuSubtitle}>
                    {addresses.length} {addresses.length === 1 ? 'address' : 'addresses'} saved
                  </Text>
                </View>
                <ChevronRight color={colors.textMuted} size={18} />
              </TouchableOpacity>

              {/* Cart Quick Review */}
              {itemCount > 0 && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => router.push('/(tabs)/cart')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <ShoppingBag color={colors.warning} size={18} />
                  </View>
                  <View style={styles.menuDetails}>
                    <Text style={styles.menuTitle}>View Cart</Text>
                    <Text style={styles.menuSubtitle}>
                      {itemCount} {itemCount === 1 ? 'item' : 'items'} in your cart
                    </Text>
                  </View>
                  <ChevronRight color={colors.textMuted} size={18} />
                </TouchableOpacity>
              )}
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
              <LogOut color={colors.danger} size={18} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.guestContainer}>
            <View style={styles.guestIconCircle}>
              <User color={colors.primary} size={44} />
            </View>

            <Text style={styles.guestTitle}>Welcome to FreshKart</Text>
            <Text style={styles.guestSubtitle}>
              Sign in with your mobile number to manage delivery addresses, track live orders, and check out securely with Cash on Delivery.
            </Text>

            {/* Guest Cart Banner if items exist */}
            {itemCount > 0 && (
              <View style={styles.guestCartNotice}>
                <ShoppingBag color={colors.primaryDark} size={16} />
                <Text style={styles.guestCartNoticeText}>
                  You have <Text style={styles.bold}>{itemCount} items</Text> saved in your cart. They will remain intact after login.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: '/(tabs)/profile' } })}
              activeOpacity={0.8}
            >
              <LogIn color={colors.textInverse} size={18} />
              <Text style={styles.loginBtnText}>Sign In / Register with Mobile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* App Info Footer */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>FreshKart Quick Commerce v1.0.0</Text>
          <Text style={styles.appInfoSub}>Cash on Delivery Delivery Engine</Text>
        </View>
      </ScrollView>

      {/* Edit Full Name Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <Text style={styles.editModalTitle}>Update Your Name</Text>
            <Text style={styles.editModalSub}>Enter your real name as recipient for delivery orders.</Text>

            <TextInput
              style={styles.modalInput}
              value={fullNameInput}
              onChangeText={setFullNameInput}
              placeholder="Full Name"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={savingName}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, savingName && styles.modalSaveDisabled]}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator color={colors.textInverse} size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Name</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
  },
  profilePhone: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDetails: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FDECEC',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FACCCC',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.danger,
  },
  guestContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  guestIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  guestSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  guestCartNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    padding: 10,
    borderRadius: 10,
    marginTop: 16,
    width: '100%',
  },
  guestCartNoticeText: {
    fontSize: 12,
    color: colors.primaryDark,
    flex: 1,
  },
  bold: {
    fontWeight: '800',
  },
  loginBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 20,
    width: '100%',
  },
  loginBtnText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '800',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 10,
    gap: 2,
  },
  appInfoText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  appInfoSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  editModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  editModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  editModalSub: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  modalSaveDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
});
