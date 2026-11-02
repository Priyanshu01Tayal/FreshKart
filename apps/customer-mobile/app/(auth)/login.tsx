import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, Shield, ArrowRight } from 'lucide-react-native';
import { colors } from '../../src/theme/colors';

export default function LoginModal() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {step === 'phone' ? 'Enter Mobile Number' : 'Enter 6-Digit OTP'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? 'We will send a one-time verification code via SMS.'
              : `Code sent to +91 ${phoneNumber}. Enter it below.`}
          </Text>
        </View>

        {step === 'phone' ? (
          <View style={styles.inputContainer}>
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>+91</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="98765 43210"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="••••••"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={otpCode}
              onChangeText={setOtpCode}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, (!phoneNumber || (step === 'otp' && !otpCode)) && styles.disabledBtn]}
          onPress={() => {
            if (step === 'phone') setStep('otp');
          }}
          disabled={!phoneNumber}
        >
          <Text style={styles.submitBtnText}>
            {step === 'phone' ? 'Continue with OTP' : 'Verify & Continue'}
          </Text>
          <ArrowRight color={colors.textInverse} size={16} />
        </TouchableOpacity>

        <View style={styles.securityNote}>
          <Shield color={colors.primary} size={14} />
          <Text style={styles.securityText}>
            Secured via Supabase Auth. All signups default to role 'customer'.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prefixBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  prefixText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  otpInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 22,
    fontWeight: '800',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  securityText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});

