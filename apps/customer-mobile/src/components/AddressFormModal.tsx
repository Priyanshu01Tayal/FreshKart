import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';
import { colors } from '../theme/colors';
import type { Address, AddressInput } from '../hooks/useAddresses';

interface AddressFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: AddressInput) => Promise<{ success: boolean; message?: string }>;
  initialAddress?: Address | null;
  defaultPhone?: string;
  defaultName?: string;
}

export function AddressFormModal({
  visible,
  onClose,
  onSave,
  initialAddress,
  defaultPhone = '',
  defaultName = '',
}: AddressFormModalProps) {
  const [label, setLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialAddress) {
      setLabel((initialAddress.label as 'Home' | 'Work' | 'Other') || 'Home');
      setRecipientName(initialAddress.recipient_name || '');
      setPhone(initialAddress.phone || '');
      setAddressLine1(initialAddress.address_line1 || '');
      setAddressLine2(initialAddress.address_line2 || '');
      setLandmark(initialAddress.landmark || '');
      setCity(initialAddress.city || '');
      setState(initialAddress.state || '');
      setPincode(initialAddress.pincode || '');
      setIsDefault(Boolean(initialAddress.is_default));
    } else {
      setLabel('Home');
      setRecipientName(defaultName);
      setPhone(defaultPhone.replace(/\D/g, '').slice(-10));
      setAddressLine1('');
      setAddressLine2('');
      setLandmark('');
      setCity('');
      setState('');
      setPincode('');
      setIsDefault(false);
    }
    setErrorMessage(null);
  }, [initialAddress, visible, defaultName, defaultPhone]);

  const handleSubmit = async () => {
    setErrorMessage(null);

    const cleanName = recipientName.trim();
    const cleanPhone = phone.trim().replace(/\D/g, '');
    const cleanLine1 = addressLine1.trim();
    const cleanPincode = pincode.trim().replace(/\D/g, '');

    if (!cleanName) {
      setErrorMessage('Please enter recipient name.');
      return;
    }
    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!cleanLine1) {
      setErrorMessage('Please enter house, flat, or building details.');
      return;
    }
    const cleanCity = city.trim();
    const cleanState = state.trim();
    if (!cleanCity) {
      setErrorMessage('Please enter city / town.');
      return;
    }
    if (!cleanState) {
      setErrorMessage('Please enter state.');
      return;
    }
    if (cleanPincode.length !== 6) {
      setErrorMessage('Please enter a valid 6-digit PIN code.');
      return;
    }

    setSaving(true);
    const result = await onSave({
      label,
      recipient_name: cleanName,
      phone: cleanPhone,
      address_line1: cleanLine1,
      address_line2: addressLine2.trim() || null,
      landmark: landmark.trim() || null,
      city: cleanCity,
      state: cleanState,
      pincode: cleanPincode,
      is_default: isDefault,
    });
    setSaving(false);

    if (result.success) {
      onClose();
    } else {
      setErrorMessage(result.message || 'Failed to save address.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {initialAddress ? 'Edit Address' : 'Add New Address'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X color={colors.text} size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Label / Type Selector */}
            <Text style={styles.sectionLabel}>Save Address As</Text>
            <View style={styles.labelChips}>
              {(['Home', 'Work', 'Other'] as const).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, label === item && styles.chipActive]}
                  onPress={() => setLabel(item)}
                >
                  <Text style={[styles.chipText, label === item && styles.chipTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Error Banner */}
            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Recipient Info */}
            <Text style={styles.inputLabel}>Recipient Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Ramesh Kumar"
              placeholderTextColor={colors.textMuted}
              value={recipientName}
              onChangeText={setRecipientName}
            />

            <Text style={styles.inputLabel}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={setPhone}
            />

            {/* House / Flat */}
            <Text style={styles.inputLabel}>House / Flat / Floor / Building *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Flat 302, Green Glen Apartments"
              placeholderTextColor={colors.textMuted}
              value={addressLine1}
              onChangeText={setAddressLine1}
            />

            {/* Street / Locality */}
            <Text style={styles.inputLabel}>Street / Area / Locality</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 80 Feet Road, 4th Block"
              placeholderTextColor={colors.textMuted}
              value={addressLine2}
              onChangeText={setAddressLine2}
            />

            {/* Landmark */}
            <Text style={styles.inputLabel}>Landmark (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Near Sony Signal or Park"
              placeholderTextColor={colors.textMuted}
              value={landmark}
              onChangeText={setLandmark}
            />

            {/* City, State, PIN */}
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.inputLabel}>City *</Text>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.inputLabel}>PIN Code *</Text>
                <TextInput
                  style={styles.input}
                  value={pincode}
                  onChangeText={setPincode}
                  placeholder="6 digits"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>State *</Text>
            <TextInput
              style={styles.input}
              value={state}
              onChangeText={setState}
              placeholder="State"
              placeholderTextColor={colors.textMuted}
            />

            {/* Default Address Switch */}
            <View style={styles.defaultSwitchRow}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.switchLabel}>Make default address</Text>
                <Text style={styles.switchSublabel}>Automatically select for quick deliveries</Text>
              </View>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={isDefault ? colors.primary : '#f4f3f4'}
              />
            </View>
          </ScrollView>

          {/* Save Button Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSubmit}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <>
                  <Check color={colors.textInverse} size={18} />
                  <Text style={styles.saveBtnText}>
                    {initialAddress ? 'Update Address' : 'Save Address'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelChips: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  chipTextActive: {
    color: colors.textInverse,
  },
  errorBox: {
    backgroundColor: '#FDECEC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  defaultSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  switchLabelContainer: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  switchSublabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },
});

