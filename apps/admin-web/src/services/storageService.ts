import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { STORAGE_LIMITS } from '@freshkart/shared';

export interface ImageUploadResult {
  url: string | null;
  error: string | null;
}

export const validateProductImage = (file: File): string | null => {
  // 1. File size check (2MB)
  if (file.size > STORAGE_LIMITS.PRODUCT_IMAGE_MAX_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    return `File size (${sizeInMb} MB) exceeds maximum allowed limit of 2 MB.`;
  }

  // 2. MIME type check
  const allowedMimes: readonly string[] = STORAGE_LIMITS.ALLOWED_IMAGE_MIME_TYPES;
  if (!allowedMimes.includes(file.type)) {
    return `Invalid image format (${file.type || 'unknown'}). Please upload a JPEG, PNG, or WebP image.`;
  }

  return null;
};

export const uploadProductImage = async (file: File): Promise<ImageUploadResult> => {
  // Validate first
  const validationError = validateProductImage(file);
  if (validationError) {
    return { url: null, error: validationError };
  }

  if (!isSupabaseConfigured) {
    // Return a local Object URL for immediate preview in offline dev mode
    const localUrl = URL.createObjectURL(file);
    return { url: localUrl, error: null };
  }

  try {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const cleanFileName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.[^/.]+$/, '');
    const filePath = `products/${Date.now()}_${cleanFileName}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { url: null, error: uploadError.message };
    }

    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);

    return { url: data.publicUrl, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected image upload failure';
    return { url: null, error: message };
  }
};
