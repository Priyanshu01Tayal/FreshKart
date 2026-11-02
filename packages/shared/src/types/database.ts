export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'customer' | 'delivery_partner' | 'admin';

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type CodStatus =
  | 'PENDING_COLLECTION'
  | 'HELD_BY_PARTNER'
  | 'SETTLED_WITH_ADMIN';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          phone_number: string | null;
          full_name: string;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          phone_number?: string | null;
          full_name?: string;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone_number?: string | null;
          full_name?: string;
          role?: UserRole;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      store_settings: {
        Row: {
          id: string;
          singleton_guard: boolean;
          store_name: string;
          store_address: string;
          latitude: number;
          longitude: number;
          delivery_radius_km: number;
          is_store_open: boolean;
          is_delivery_available: boolean;
          min_order_value: number;
          standard_delivery_fee: number;
          free_delivery_threshold: number;
          contact_phone: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          singleton_guard?: boolean;
          store_name?: string;
          store_address: string;
          latitude: number;
          longitude: number;
          delivery_radius_km?: number;
          is_store_open?: boolean;
          is_delivery_available?: boolean;
          min_order_value?: number;
          standard_delivery_fee?: number;
          free_delivery_threshold?: number;
          contact_phone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          singleton_guard?: boolean;
          store_name?: string;
          store_address?: string;
          latitude?: number;
          longitude?: number;
          delivery_radius_km?: number;
          is_store_open?: boolean;
          is_delivery_available?: boolean;
          min_order_value?: number;
          standard_delivery_fee?: number;
          free_delivery_threshold?: number;
          contact_phone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          image_url: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          image_url?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          description: string | null;
          unit: string;
          price: number;
          discount_price: number | null;
          image_url: string | null;
          stock_quantity: number;
          low_stock_threshold: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          description?: string | null;
          unit?: string;
          price: number;
          discount_price?: number | null;
          image_url?: string | null;
          stock_quantity?: number;
          low_stock_threshold?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          description?: string | null;
          unit?: string;
          price?: number;
          discount_price?: number | null;
          image_url?: string | null;
          stock_quantity?: number;
          low_stock_threshold?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          recipient_name: string;
          phone: string;
          address_line1: string;
          address_line2: string | null;
          landmark: string | null;
          latitude: number;
          longitude: number;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string;
          recipient_name: string;
          phone: string;
          address_line1: string;
          address_line2?: string | null;
          landmark?: string | null;
          latitude: number;
          longitude: number;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string;
          recipient_name?: string;
          phone?: string;
          address_line1?: string;
          address_line2?: string | null;
          landmark?: string | null;
          latitude?: number;
          longitude?: number;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string;
          delivery_partner_id: string | null;
          status: OrderStatus;
          payment_method: 'COD';
          cod_status: CodStatus;
          subtotal: number;
          delivery_fee: number;
          total_amount: number;
          cod_collected_amount: number | null;
          cod_collected_at: string | null;
          cash_settlement_id: string | null;
          delivery_address: Json;
          customer_notes: string | null;
          cancellation_reason: string | null;
          cancelled_by: UserRole | null;
          placed_at: string;
          confirmed_at: string | null;
          packed_at: string | null;
          dispatched_at: string | null;
          delivered_at: string | null;
          cancelled_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          customer_id: string;
          delivery_partner_id?: string | null;
          status?: OrderStatus;
          payment_method?: 'COD';
          cod_status?: CodStatus;
          subtotal: number;
          delivery_fee?: number;
          total_amount: number;
          cod_collected_amount?: number | null;
          cod_collected_at?: string | null;
          cash_settlement_id?: string | null;
          delivery_address: Json;
          customer_notes?: string | null;
          cancellation_reason?: string | null;
          cancelled_by?: UserRole | null;
          placed_at?: string;
          confirmed_at?: string | null;
          packed_at?: string | null;
          dispatched_at?: string | null;
          delivered_at?: string | null;
          cancelled_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          customer_id?: string;
          delivery_partner_id?: string | null;
          status?: OrderStatus;
          payment_method?: 'COD';
          cod_status?: CodStatus;
          subtotal?: number;
          delivery_fee?: number;
          total_amount?: number;
          cod_collected_amount?: number | null;
          cod_collected_at?: string | null;
          cash_settlement_id?: string | null;
          delivery_address?: Json;
          customer_notes?: string | null;
          cancellation_reason?: string | null;
          cancelled_by?: UserRole | null;
          placed_at?: string;
          confirmed_at?: string | null;
          packed_at?: string | null;
          dispatched_at?: string | null;
          delivered_at?: string | null;
          cancelled_at?: string | null;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          unit: string;
          unit_price: number;
          quantity: number;
          total_price: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          product_name: string;
          unit: string;
          unit_price: number;
          quantity: number;
          total_price: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          product_name?: string;
          unit?: string;
          unit_price?: number;
          quantity?: number;
          total_price?: number;
        };
      };
      order_status_logs: {
        Row: {
          id: string;
          order_id: string;
          previous_status: OrderStatus | null;
          new_status: OrderStatus;
          changed_by: string | null;
          remarks: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          previous_status?: OrderStatus | null;
          new_status: OrderStatus;
          changed_by?: string | null;
          remarks?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          previous_status?: OrderStatus | null;
          new_status?: OrderStatus;
          changed_by?: string | null;
          remarks?: string | null;
          created_at?: string;
        };
      };
      cash_settlements: {
        Row: {
          id: string;
          settlement_reference: string;
          delivery_partner_id: string;
          admin_id: string;
          total_orders_settled: number;
          expected_cash_amount: number;
          actual_cash_received: number;
          discrepancy_amount: number;
          discrepancy_notes: string | null;
          settled_at: string;
        };
        Insert: {
          id?: string;
          settlement_reference: string;
          delivery_partner_id: string;
          admin_id: string;
          total_orders_settled: number;
          expected_cash_amount: number;
          actual_cash_received: number;
          discrepancy_amount?: number;
          discrepancy_notes?: string | null;
          settled_at?: string;
        };
        Update: {
          id?: string;
          settlement_reference?: string;
          delivery_partner_id?: string;
          admin_id?: string;
          total_orders_settled?: number;
          expected_cash_amount?: number;
          actual_cash_received?: number;
          discrepancy_amount?: number;
          discrepancy_notes?: string | null;
          settled_at?: string;
        };
      };
    };
    Functions: {
      place_order: {
        Args: {
          p_address_id: string;
          p_items: { product_id: string; quantity: number }[];
          p_customer_notes?: string | null;
        };
        Returns: {
          success: boolean;
          order_id: string;
          order_number: string;
          subtotal: number;
          delivery_fee: number;
          total_amount: number;
          placed_at: string;
        };
      };
      admin_update_user_role: {
        Args: {
          p_target_user_id: string;
          p_new_role: UserRole;
        };
        Returns: void;
      };
      settle_delivery_partner_cash: {
        Args: {
          p_delivery_partner_id: string;
          p_actual_cash_received: number;
          p_notes?: string | null;
        };
        Returns: {
          success: boolean;
          settlement_id: string;
          settlement_reference: string;
          delivery_partner_id: string;
          total_orders_settled: number;
          expected_cash_amount: number;
          actual_cash_received: number;
          discrepancy_amount: number;
          settled_at: string;
        };
      };
      is_admin: {
        Args: { user_id?: string };
        Returns: boolean;
      };
      is_delivery_partner: {
        Args: { user_id?: string };
        Returns: boolean;
      };
    };
  };
}
