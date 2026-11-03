import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, Shield, ArrowRight, CheckCircle2, RotateCw, AlertCircle } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { useAuthStore, isValidIndianPhone } from '../../src/store/useAuthStore';

export default function LoginModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = params.returnTo || '/(tabs)/profile';

  const sendOtp = useAuthStore((state) => state.sendOtp);
  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [localError, setLocalError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // 60-second cooldown timer for resending OTP
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [cooldown]);

  const handleSendOtp = async () => {
    setLocalError(null);
    clearError();

    const clean = phoneNumber.trim().replace(/\D/g, '');
    if (!isValidIndianPhone(clean)) {
      setLocalError('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    const res = await sendOtp(clean);
    if (res.success) {
      setStep('otp');
      setCooldown(60);
      setOtpCode('');
    } else {
      setLocalError(res.message || 'Failed to send OTP.');
    }
  };

  const handleVerifyOtp = async () => {
    setLocalError(null);
    clearError();

    const cleanToken = otpCode.trim();
    if (cleanToken.length !== 6) {
      setLocalError('Please enter the full 6-digit OTP code.');
      return;
    }

    const res = await verifyOtp(phoneNumber, cleanToken);
    if (res.success) {
      // Return to original intended destination
      if (returnTo.startsWith('/(tabs)')) {
        router.replace(returnTo as any);
      } else {
        router.replace(returnTo as any);
      }
    } else {
      setLocalError(res.message || 'Verification failed.');
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    await handleSendOtp();
  };

  const errorMessage = localError || authError;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconCircle}>
            <Phone color={colors.primary} size={32} />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>
              {step === 'phone' ? 'Verify Mobile Number' : 'Enter 6-Digit OTP'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'phone'
                ? 'We will send a one-time verification code via SMS to verify your account.'
                : `Enter the 6-digit code sent to +91 ${phoneNumber}.`}
            </Text>
          </View>

          {/* Error Banner */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <AlertCircle color={colors.danger} size={16} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {step === 'phone' ? (
            <View style={styles.inputContainer}>
              <View style={styles.prefixBox}>
                <Text style={styles.prefixText}>+91</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter 10-digit mobile number"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                value={phoneNumber}
                onChangeText={(text) => {
                  setPhoneNumber(text.replace(/\D/g, ''));
                  if (errorMessage) {
                    setLocalError(null);
                    clearError();
                  }
                }}
                autoFocus
              />
            </View>
          ) : (
            <View style={styles.otpSection}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={(text) => {
                    setOtpCode(text.replace(/\D/g, ''));
                    if (errorMessage) {
                      setLocalError(null);
                      clearError();
                    }
                  }}
                  autoFocus
                />
              </View>

              {/* Resend Cooldown Row */}
              <View style={styles.resendRow}>
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={cooldown > 0 || isLoading}
                  style={styles.resendBtn}
                >
                  <RotateCw
                    color={cooldown > 0 ? colors.textMuted : colors.primary}
                    size={14}
                  />
                  <Text
                    style={[
                      styles.resendText,
                      cooldown > 0 && styles.resendTextDisabled,
                    ]}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setStep('phone');
                    setOtpCode('');
                    setLocalError(null);
                    clearError();
                  }}
                >
                  <Text style={styles.changePhoneText}>Change Number</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitBtn,
              (isLoading ||
                (step === 'phone' && phoneNumber.length < 10) ||
                (step === 'otp' && otpCode.length < 6)) &&
                styles.disabledBtn,
            ]}
            onPress={step === 'phone' ? handleSendOtp : handleVerifyOtp}
            disabled={
              isLoading ||
              (step === 'phone' && phoneNumber.length < 10) ||
              (step === 'otp' && otpCode.length < 6)
            }
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>
                  {step === 'phone' ? 'Get Verification Code' : 'Verify & Continue'}
                </Text>
                <ArrowRight color={colors.textInverse} size={16} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.securityNote}>
            <Shield color={colors.primary} size={14} />
            <Text style={styles.securityText}>
              Official Supabase Auth OTP. Public registration is locked to role 'customer'.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FACCCC',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  prefixBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  prefixText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  otpSection: {
    gap: 12,
  },
  otpInput: {
    textAlign: 'center',
    letterSpacing: 10,
    fontSize: 24,
    fontWeight: '800',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  resendTextDisabled: {
    color: colors.textMuted,
  },
  changePhoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 10,
  },
  disabledBtn: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  submitBtnText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  securityText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
