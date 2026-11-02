import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Layers, AlertTriangle, PackageSearch } from 'lucide-react-native';
import { colors } from '../../src/theme/colors';
import { useCategories, Category } from '../../src/hooks/useCategories';
import { useProducts } from '../../src/hooks/useProducts';
import { ProductCard } from '../../src/components/ProductCard';
import { LoadingSkeleton } from '../../src/components/LoadingSkeleton';
import { EmptyState } from '../../src/components/EmptyState';

export default function CategoriesScreen() {
  const { categories, loading: catLoading, error: catError, refetch: refetchCategories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const {
    products,
    loading: prodLoading,
    error: prodError,
    refetch: refetchProducts,
    setCategoryId,
  } = useProducts();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchCategories(), refetchProducts()]);
    setRefreshing(false);
  };

  const handleSelectCategory = (cat: Category | null) => {
    setSelectedCategory(cat);
    setCategoryId(cat ? cat.id : null);
  };

  const isLoading = (catLoading || prodLoading) && !refreshing;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Categories Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Layers color={colors.primary} size={20} />
          <Text style={styles.title}>All Categories</Text>
        </View>
        <Text style={styles.subtitle}>Browse fresh farm produce, dairy, bakery & essentials</Text>
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
        {/* Horizontal Category Selector */}
        <View style={styles.categoryNavSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryGridContainer}
          >
            <TouchableOpacity
              style={[
                styles.categoryCard,
                selectedCategory === null && styles.categoryCardSelected,
              ]}
              onPress={() => handleSelectCategory(null)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.categoryIconCircle,
                  selectedCategory === null && styles.categoryIconCircleActive,
                ]}
              >
                <Layers
                  color={selectedCategory === null ? colors.textInverse : colors.primary}
                  size={20}
                />
              </View>
              <Text
                style={[
                  styles.categoryName,
                  selectedCategory === null && styles.categoryNameActive,
                ]}
                numberOfLines={1}
              >
                All
              </Text>
            </TouchableOpacity>

            {categories.map((cat) => {
              const isSelected = selectedCategory?.id === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                  onPress={() => handleSelectCategory(isSelected ? null : cat)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.categoryIconCircle,
                      isSelected && styles.categoryIconCircleActive,
                    ]}
                  >
                    {cat.image_url ? (
                      <Image
                        source={{ uri: cat.image_url }}
                        style={styles.categoryImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Layers
                        color={isSelected ? colors.textInverse : colors.primary}
                        size={20}
                      />
                    )}
                  </View>
                  <Text
                    style={[styles.categoryName, isSelected && styles.categoryNameActive]}
                    numberOfLines={1}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Selected Category Heading */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCategory ? selectedCategory.name : 'All Products'}
          </Text>
          {!isLoading && products.length > 0 && (
            <Text style={styles.itemCount}>{products.length} items</Text>
          )}
        </View>

        {/* Product List Content */}
        {isLoading ? (
          <LoadingSkeleton message="Loading catalog..." />
        ) : catError || prodError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Error loading categories"
            description={catError || prodError || 'An error occurred'}
            actionLabel="Retry"
            onAction={onRefresh}
          />
        ) : products.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No products available"
            description={
              selectedCategory
                ? `No active items available under ${selectedCategory.name} at this time.`
                : 'No products are currently in stock.'
            }
            actionLabel={selectedCategory ? 'Show All Products' : undefined}
            onAction={selectedCategory ? () => handleSelectCategory(null) : undefined}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  categoryNavSection: {
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12,
  },
  categoryGridContainer: {
    paddingHorizontal: 14,
    gap: 12,
    alignItems: 'center',
  },
  categoryCard: {
    alignItems: 'center',
    width: 76,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  categoryCardSelected: {
    backgroundColor: colors.primaryLight,
  },
  categoryIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    overflow: 'hidden',
  },
  categoryIconCircleActive: {
    backgroundColor: colors.primary,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  categoryNameActive: {
    color: colors.primaryDark,
    fontWeight: '800',
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
  itemCount: {
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
