import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { colors } from '../theme/colors';

interface LoadingSkeletonProps {
  message?: string;
}

export function LoadingSkeleton({ message = 'Loading fresh produce...' }: LoadingSkeletonProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message && <Text style={styles.text}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});

