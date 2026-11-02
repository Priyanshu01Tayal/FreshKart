import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Plus, Minus, Package } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useCartStore } from '../store/useCartStore';
import type { Database } from '@freshkart/shared';

type Product = Database['public']['Tables']['products']['Row'];

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [imageError, setImageError] = useState(false);

  // Directly observe cart item quantity for this specific product
  const cartQuantity = useCartStore((state) => state.getItemQuantity(product.id));
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  const isOutOfStock = product.stock_quantity <= 0;
  const hasDiscount =
    product.discount_price !== null &&
    product.discount_price >= 0 &&
    product.discount_price < product.price;

  const sellingPrice = hasDiscount && product.discount_price !== null
    ? Number(product.discount_price)
    : Number(product.price);

  const discountPercent = hasDiscount && product.discount_price !== null
    ? Math.round(((product.price - product.discount_price) / product.price) * 100)
    : 0;

  const handleAdd = () => {
    if (isOutOfStock) {
      Alert.alert('Out of Stock', 'This product is currently out of stock.');
      return;
    }

    const res = addItem(product, 1);
    if (!res.success && res.message) {
      Alert.alert('Limit Reached', res.message);
    }
  };

  const handleIncrement = () => {
    if (cartQuantity >= product.stock_quantity) {
      Alert.alert('Stock Limit', `Only ${product.stock_quantity} units available.`);
      return;
    }
    const res = updateQuantity(product.id, cartQuantity + 1);
    if (!res.success && res.message) {
      Alert.alert('Limit Reached', res.message);
    }
  };

  const handleDecrement = () => {
    updateQuantity(product.id, cartQuantity - 1);
  };

  return (
    <View style={styles.card}>
      {/* Discount Badge */}
      {hasDiscount && (
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>{discountPercent}% OFF</Text>
        </View>
      )}

      {/* Out of Stock Ribbon */}
      {isOutOfStock && (
        <View style={styles.outOfStockBadge}>
          <Text style={styles.outOfStockText}>OUT OF STOCK</Text>
        </View>
      )}

      {/* Product Image / Placeholder */}
      <View style={styles.imageContainer}>
        {product.image_url && !imageError ? (
          <Image
            source={{ uri: product.image_url }}
            style={[styles.image, isOutOfStock && styles.fadedImage]}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={[styles.placeholderImage, isOutOfStock && styles.fadedImage]}>
            <Package color={colors.textMuted} size={40} />
          </View>
        )}
      </View>

      {/* Product Details */}
      <View style={styles.detailsContainer}>
        <Text style={styles.unitText} numberOfLines={1}>
          {product.unit}
        </Text>
        <Text style={styles.nameText} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Pricing & Cart Action Row */}
        <View style={styles.actionRow}>
          <View style={styles.priceContainer}>
            <Text style={styles.sellingPrice}>₹{sellingPrice.toFixed(0)}</Text>
            {hasDiscount && (
              <Text style={styles.mrpPrice}>₹{Number(product.price).toFixed(0)}</Text>
            )}
          </View>

          {/* Cart Stepper / Add Button */}
          {cartQuantity === 0 ? (
            <TouchableOpacity
              style={[styles.addBtn, isOutOfStock && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={isOutOfStock}
              activeOpacity={0.8}
            >
              <Text style={[styles.addBtnText, isOutOfStock && styles.addBtnTextDisabled]}>
                ADD
              </Text>
              {!isOutOfStock && <Plus color={colors.primary} size={14} />}
            </TouchableOpacity>
          ) : (
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={handleDecrement}
                activeOpacity={0.7}
              >
                <Minus color={colors.textInverse} size={14} />
              </TouchableOpacity>
              <Text style={styles.stepperCount}>{cartQuantity}</Text>
              <TouchableOpacity
                style={[
                  styles.stepperBtn,
                  cartQuantity >= product.stock_quantity && styles.stepperBtnDisabled,
                ]}
                onPress={handleIncrement}
                disabled={cartQuantity >= product.stock_quantity}
                activeOpacity={0.7}
              >
                <Plus color={colors.textInverse} size={14} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.primaryDark,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  discountBadgeText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '800',
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.danger,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  outOfStockText: {
    color: colors.textInverse,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  imageContainer: {
    height: 110,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  fadedImage: {
    opacity: 0.35,
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  unitText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  nameText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 17,
    minHeight: 34,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  sellingPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  mrpPrice: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnDisabled: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
  },
  addBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  addBtnTextDisabled: {
    color: colors.textMuted,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 6,
  },
  stepperBtn: {
    padding: 3,
  },
  stepperBtnDisabled: {
    opacity: 0.5,
  },
  stepperCount: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 16,
    textAlign: 'center',
  },
});
