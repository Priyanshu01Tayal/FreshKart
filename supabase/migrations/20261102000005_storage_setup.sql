-- ============================================================================
-- FreshKart Migration 05: Storage Bucket & Storage Security Policies
-- Version: 1.1
-- Description: Configures the 'product-images' storage bucket with strict 2MB
--              size limits, MIME type validations (JPEG/PNG/WebP), and ensures
--              only verified administrators can upload, update or delete assets.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create Storage Bucket (if not exists)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
) VALUES (
    'product-images',
    'product-images',
    true,
    2097152, -- 2 MB in bytes
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ----------------------------------------------------------------------------
-- 2. Storage Object RLS Policies
-- ----------------------------------------------------------------------------
-- Public read access for customers and guests
CREATE POLICY "Public & guests can view product images"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'product-images');

-- Admin-only upload policy
CREATE POLICY "Admins can upload product images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'product-images'
        AND public.is_admin(auth.uid())
    );

-- Admin-only update policy
CREATE POLICY "Admins can update product images"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'product-images'
        AND public.is_admin(auth.uid())
    )
    WITH CHECK (
        bucket_id = 'product-images'
        AND public.is_admin(auth.uid())
    );

-- Admin-only delete policy
CREATE POLICY "Admins can delete product images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'product-images'
        AND public.is_admin(auth.uid())
    );
