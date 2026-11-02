-- ============================================================================
-- FreshKart Seed Data: Store Settings, Categories & Sample Grocery Items
-- Version: 1.1
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Singleton Store Settings (Koramangala, Bengaluru Hub)
-- ----------------------------------------------------------------------------
INSERT INTO public.store_settings (
    store_name,
    store_address,
    latitude,
    longitude,
    delivery_radius_km,
    is_store_open,
    is_delivery_available,
    min_order_value,
    standard_delivery_fee,
    free_delivery_threshold,
    contact_phone
) VALUES (
    'FreshKart Central Hub - Koramangala',
    '124, 80 Feet Road, 4th Block, Koramangala, Bengaluru, Karnataka 560034',
    12.9345330,
    77.6265790,
    5.00,
    true,
    true,
    99.00,
    25.00,
    299.00,
    '+919876543210'
)
ON CONFLICT (singleton_guard) DO UPDATE SET
    store_name = EXCLUDED.store_name,
    store_address = EXCLUDED.store_address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    delivery_radius_km = EXCLUDED.delivery_radius_km,
    is_store_open = EXCLUDED.is_store_open,
    is_delivery_available = EXCLUDED.is_delivery_available,
    min_order_value = EXCLUDED.min_order_value,
    standard_delivery_fee = EXCLUDED.standard_delivery_fee,
    free_delivery_threshold = EXCLUDED.free_delivery_threshold,
    contact_phone = EXCLUDED.contact_phone;

-- ----------------------------------------------------------------------------
-- 2. Grocery Categories
-- ----------------------------------------------------------------------------
INSERT INTO public.categories (id, name, slug, image_url, sort_order, is_active)
VALUES
    ('c1000000-0000-0000-0000-000000000001', 'Fresh Vegetables', 'fresh-vegetables', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300', 1, true),
    ('c1000000-0000-0000-0000-000000000002', 'Fresh Fruits', 'fresh-fruits', 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=300', 2, true),
    ('c1000000-0000-0000-0000-000000000003', 'Dairy & Breakfast', 'dairy-breakfast', 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=300', 3, true),
    ('c1000000-0000-0000-0000-000000000004', 'Bakery & Bread', 'bakery-bread', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300', 4, true),
    ('c1000000-0000-0000-0000-000000000005', 'Snacks & Munchies', 'snacks-munchies', 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300', 5, true),
    ('c1000000-0000-0000-0000-000000000006', 'Cold Drinks & Juices', 'cold-drinks-juices', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=300', 6, true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    image_url = EXCLUDED.image_url,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ----------------------------------------------------------------------------
-- 3. Sample Grocery Products (Stock, Units, Real Prices)
-- ----------------------------------------------------------------------------
INSERT INTO public.products (category_id, name, description, unit, price, discount_price, image_url, stock_quantity, low_stock_threshold, is_active)
VALUES
    -- Vegetables
    ('c1000000-0000-0000-0000-000000000001', 'Fresh Hybrid Tomatoes', 'Farm-fresh, vine-ripened red hybrid tomatoes, perfect for everyday curries and salads.', '500g', 24.00, 19.00, 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500', 60, 10, true),
    ('c1000000-0000-0000-0000-000000000001', 'Fresh Pink Onions', 'Crisp, pungent onions sourced directly from certified farms.', '1 kg', 38.00, 32.00, 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500', 100, 15, true),
    ('c1000000-0000-0000-0000-000000000001', 'New Crop Potatoes (Aloo)', 'Versatile cooking potatoes with clean skin, ideal for boiling and frying.', '1 kg', 35.00, 28.00, 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500', 80, 15, true),
    ('c1000000-0000-0000-0000-000000000001', 'Fresh Coriander (Dhaniya)', 'Fragrant and fresh green coriander leaves.', '100g', 15.00, 10.00, 'https://images.unsplash.com/photo-1599818804368-2b814e591746?w=500', 30, 5, true),
    ('c1000000-0000-0000-0000-000000000001', 'Spicy Green Chillies', 'Fiery green chillies to add an authentic kick to your meals.', '200g', 25.00, 20.00, 'https://images.unsplash.com/photo-1525607551316-4a8e16d1f9ba?w=500', 40, 5, true),

    -- Fruits
    ('c1000000-0000-0000-0000-000000000002', 'Robusta Bananas', 'Naturally ripened, sweet and potassium-rich yellow bananas.', '1 kg (5-6 pcs)', 48.00, 42.00, 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500', 50, 10, true),
    ('c1000000-0000-0000-0000-000000000002', 'Royal Gala Crisp Apples', 'Juicy and sweet apples, directly selected for premium quality.', '4 pcs (~500g)', 140.00, 119.00, 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500', 25, 5, true),
    ('c1000000-0000-0000-0000-000000000002', 'Nagpur Sweet Oranges', 'Citrusy, refreshing seasonal oranges packed with Vitamin C.', '1 kg', 95.00, 79.00, 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=500', 35, 5, true),

    -- Dairy & Breakfast
    ('c1000000-0000-0000-0000-000000000003', 'Amul Taaza Toned Milk', 'Pasteurised, fresh toned milk with 3.0% fat and 8.5% SNF.', '1 L', 54.00, 52.00, 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500', 50, 10, true),
    ('c1000000-0000-0000-0000-000000000003', 'Amul Salted Butter', 'Rich, creamy butter made from pure milk fat.', '100g', 58.00, 56.00, 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=500', 40, 8, true),
    ('c1000000-0000-0000-0000-000000000003', 'Farm Fresh White Eggs', 'Nutritious farm fresh protein-rich table eggs.', 'Pack of 6', 55.00, 48.00, 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500', 60, 10, true),
    ('c1000000-0000-0000-0000-000000000003', 'Milky Mist Paneer', 'Soft, fresh and delicious block of paneer for rich curries.', '200g', 95.00, 85.00, 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500', 20, 5, true),

    -- Bakery & Bread
    ('c1000000-0000-0000-0000-000000000004', 'English Oven 100% Whole Wheat Bread', 'Soft and healthy whole wheat sliced sandwich bread.', '400g', 50.00, 45.00, 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500', 30, 5, true),
    ('c1000000-0000-0000-0000-000000000004', 'Modern Classic White Bread', 'Soft, fluffy family-pack white sandwich bread.', '400g', 38.00, 35.00, 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=500', 30, 5, true),

    -- Snacks & Munchies
    ('c1000000-0000-0000-0000-000000000005', 'Lay''s India''s Magic Masala Chips', 'Classic ridged potato chips coated in hot spicy Indian masala.', '50g', 20.00, 20.00, 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500', 80, 10, true),
    ('c1000000-0000-0000-0000-000000000005', 'Kurkure Masala Munch', 'Crispy, crunchy corn puffs spiced with authentic chili and spices.', '90g', 20.00, 20.00, 'https://images.unsplash.com/photo-1621447504864-d8686e12698c?w=500', 70, 10, true),
    ('c1000000-0000-0000-0000-000000000005', 'Haldiram''s Bhujia Sev', 'Crispy moth bean and chickpea noodles seasoned with spices.', '200g', 65.00, 58.00, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500', 45, 8, true),

    -- Beverages
    ('c1000000-0000-0000-0000-000000000006', 'Coca-Cola Original Carbonated Drink', 'Chilled, sparkling, refreshing cola taste.', '750 ml', 45.00, 40.00, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500', 50, 10, true),
    ('c1000000-0000-0000-0000-000000000006', 'Real Fruit Power Mixed Fruit Juice', 'Rich blend of delicious tropical fruits, high in natural goodness.', '1 L', 130.00, 109.00, 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=500', 25, 5, true),
    ('c1000000-0000-0000-0000-000000000006', 'Kinley Packaged Drinking Water', 'Purified drinking water with added minerals.', '1 L', 20.00, 20.00, 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500', 100, 20, true);

