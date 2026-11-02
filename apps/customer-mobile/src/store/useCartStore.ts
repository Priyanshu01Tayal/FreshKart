import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@freshkart/shared';

type Product = Database['public']['Tables']['products']['Row'];

export interface CartItem {
  product_id: string;
  name: string;
  unit: string;
  price: number;
  discount_price: number | null;
  effective_price: number;
  quantity: number;
  image_url: string | null;
  stock_quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => { success: boolean; message?: string };
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => { success: boolean; message?: string };
  clearCart: () => void;
  getSubtotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1) => {
        const { items } = get();
        const existing = items.find((i) => i.product_id === product.id);
        const currentQty = existing ? existing.quantity : 0;
        const newQty = currentQty + quantity;

        // Inventory safety check
        if (newQty > product.stock_quantity) {
          return {
            success: false,
            message: `Only ${product.stock_quantity} units available in stock.`,
          };
        }

        const effectivePrice =
          product.discount_price !== null && product.discount_price >= 0
            ? Number(product.discount_price)
            : Number(product.price);

        if (existing) {
          set({
            items: items.map((i) =>
              i.product_id === product.id ? { ...i, quantity: newQty } : i
            ),
          });
        } else {
          const newItem: CartItem = {
            product_id: product.id,
            name: product.name,
            unit: product.unit,
            price: Number(product.price),
            discount_price: product.discount_price !== null ? Number(product.discount_price) : null,
            effective_price: effectivePrice,
            quantity: newQty,
            image_url: product.image_url,
            stock_quantity: product.stock_quantity,
          };
          set({ items: [...items, newItem] });
        }

        return { success: true };
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.product_id !== productId) });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return { success: true };
        }

        const { items } = get();
        const item = items.find((i) => i.product_id === productId);
        if (!item) return { success: false, message: 'Item not found in cart' };

        if (quantity > item.stock_quantity) {
          return {
            success: false,
            message: `Cannot exceed available inventory of ${item.stock_quantity} units.`,
          };
        }

        set({
          items: items.map((i) =>
            i.product_id === productId ? { ...i, quantity } : i
          ),
        });

        return { success: true };
      },

      clearCart: () => {
        set({ items: [] });
      },

      getSubtotal: () => {
        return get().items.reduce(
          (sum, item) => sum + item.effective_price * item.quantity,
          0
        );
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: 'freshkart-customer-cart',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
