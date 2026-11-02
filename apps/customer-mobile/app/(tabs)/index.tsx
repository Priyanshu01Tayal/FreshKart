import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap, MapPin, Search } from 'lucide-react-native';
import { colors } from '../../src/theme/colors';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Hyperlocal Header */}
      <View style={styles.header}>
        <View style={styles.locationContainer}>
          <View style={styles.etaBadge}>
            <Zap color={colors.primary} size={14} />
            <Text style={styles.etaText}>10-15 MINS</Text>
          </View>
          <View style={styles.addressRow}>
            <MapPin color={colors.primaryDark} size={16} />
            <Text style={styles.addressText} numberOfLines={1}>
              Deliver to: Koramangala 4th Block, Bengaluru
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Search Bar Placeholder */}
        <View style={styles.searchBar}>
          <Search color={colors.textMuted} size={18} />
          <Text style={styles.searchPlaceholder}>Search "milk", "onion", "paneer"...</Text>
        </View>

        {/* Phase 3 Step 1 Ready Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>FreshKart Quick Commerce</Text>
          <Text style={styles.bannerSubtitle}>
            Fresh groceries and daily essentials delivered to your doorstep in minutes.
          </Text>
          <View style={styles.codPill}>
            <Text style={styles.codText}>💵 Cash on Delivery Available</Text>
          </View>
        </View>
      </ScrollView>
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
  locationContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  etaText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  content: {
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchPlaceholder: {
    fontSize: 13,
    color: colors.textMuted,
  },
  banner: {
    marginTop: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.primaryLightHover,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  codPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 10,
  },
  codText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
});
