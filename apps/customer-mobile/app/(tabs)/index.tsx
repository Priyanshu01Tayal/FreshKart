import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, AlertTriangle, PackageSearch } from 'lucide-react-native';
import { colors } from '../../src/theme/colors';
import { useStoreSettings } from '../../src/hooks/useStoreSettings';
import { useCategories } from '../../src/hooks/useCategories';
import { useProducts } from '../../src/hooks/useProducts';
import { StoreHeader } from '../../src/components/StoreHeader';
import { ProductCard } from '../../src/components/ProductCard';
import { LoadingSkeleton } from '../../src/components/LoadingSkeleton';
import { EmptyState } from '../../src/components/EmptyState';

export default function HomeScreen() {
  const { settings, loading: settingsLoading, refetch: refetchSettings } = useStoreSettings();
  const { categories, loading: categoriesLoading, refetch: refetchCategories } = useCategories();
  const {
    products,
    loading: productsLoading,
    error: productsError,
    refetch: refetchProducts,
    categoryId,
    setCategoryId,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
  } = useProducts();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchSettings(), refetchCategories(), refetchProducts()]);
    setRefreshing(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const isLoading = (productsLoading || categoriesLoading) && !refreshing;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Dynamic Store Header */}
        <StoreHeader settings={settings} loading={settingsLoading} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {/* Search Input Bar */}
          <View style={styles.searchBar}>
            <Search color={colors.textSecondary} size={18} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search farm fresh produce, milk, snacks..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X color={colors.textSecondary} size={18} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Chips Carousel */}
          <View style={styles.categorySection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChipsContainer}
            >
              <TouchableOpacity
                style={[styles.categoryChip, categoryId === null && styles.categoryChipActive]}
                onPress={() => setCategoryId(null)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    categoryId === null && styles.categoryChipTextActive,
                  ]}
                >
                  All Items
                </Text>
              </TouchableOpacity>

              {categories.map((cat) => {
                const isActive = categoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    onPress={() => setCategoryId(isActive ? null : cat.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isActive && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* COD Notice Strip */}
          <View style={styles.codBanner}>
            <Text style={styles.codBannerText}>
              💵 Cash on Delivery Only • Inspect at your doorstep before paying
            </Text>
          </View>

          {/* Section Title & Product Count */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {categoryId
                ? categories.find((c) => c.id === categoryId)?.name || 'Products'
                : debouncedSearchQuery.length > 0
                ? `Results for "${debouncedSearchQuery}"`
                : 'Available Products'}
            </Text>
            {!isLoading && products.length > 0 && (
              <Text style={styles.itemCountText}>{products.length} items</Text>
            )}
          </View>

          {/* Products Content State */}
          {isLoading ? (
            <LoadingSkeleton message="Loading fresh inventory..." />
          ) : productsError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Could not load products"
              description={productsError}
              actionLabel="Try Again"
              onAction={refetchProducts}
            />
          ) : products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No products found"
              description={
                debouncedSearchQuery.length > 0
                  ? `We couldn't find any grocery items matching "${debouncedSearchQuery}".`
                  : 'No products are currently available in this category.'
              }
              actionLabel={debouncedSearchQuery.length > 0 ? 'Clear Search' : 'View All Items'}
              onAction={() => {
                if (debouncedSearchQuery.length > 0) {
                  handleClearSearch();
                } else {
                  setCategoryId(null);
                }
              }}
            />
          ) : (
            <View style={styles.productGrid}>
              {products.map((product) => (
                <View key={product.id} style={styles.productCol}>
                  <ProductCard product={product} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  categorySection: {
    marginTop: 4,
    marginBottom: 10,
  },
  categoryChipsContainer: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  categoryChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  categoryChipTextActive: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  codBanner: {
    backgroundColor: colors.primaryLight,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.primaryLightHover,
  },
  codBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  itemCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    gap: 10,
  },
  productCol: {
    width: '48.5%',
  },
});
