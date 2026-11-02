import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Upload,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  DollarSign
} from 'lucide-react';
import type { Database } from '@freshkart/shared';
import { uploadProductImage, validateProductImage } from '../services/storageService';

type Product = Database['public']['Tables']['products']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

interface ProductsProps {
  products: Product[];
  categories: Category[];
  onCreateProduct: (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onUpdateProduct: (productId: string, updates: Partial<Product>) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  isLoading: boolean;
}

export const Products: React.FC<ProductsProps> = ({
  products,
  categories,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    description: '',
    unit: '1 pc',
    price: '',
    discount_price: '',
    stock_quantity: '20',
    low_stock_threshold: '5',
    image_url: '',
    is_active: true,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || p.category_id === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const openCreateModal = () => {
    setModalMode('create');
    setEditingProduct(null);
    setFormData({
      name: '',
      category_id: categories[0]?.id || '',
      description: '',
      unit: '1 pc',
      price: '',
      discount_price: '',
      stock_quantity: '25',
      low_stock_threshold: '5',
      image_url: '',
      is_active: true,
    });
    setImageFile(null);
    setImagePreview(null);
    setFormError(null);
  };

  const openEditModal = (p: Product) => {
    setModalMode('edit');
    setEditingProduct(p);
    setFormData({
      name: p.name,
      category_id: p.category_id,
      description: p.description || '',
      unit: p.unit,
      price: String(p.price),
      discount_price: p.discount_price ? String(p.discount_price) : '',
      stock_quantity: String(p.stock_quantity),
      low_stock_threshold: String(p.low_stock_threshold),
      image_url: p.image_url || '',
      is_active: p.is_active,
    });
    setImageFile(null);
    setImagePreview(p.image_url || null);
    setFormError(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size & type
    const err = validateProductImage(file);
    if (err) {
      setFormError(err);
      setImageFile(null);
      return;
    }

    setFormError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Basic Validation
    if (!formData.name.trim()) {
      setFormError('Product name is required.');
      return;
    }
    if (!formData.category_id) {
      setFormError('Please select a category.');
      return;
    }
    const priceNum = parseFloat(formData.price);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Please enter a valid price.');
      return;
    }

    let discNum: number | null = null;
    if (formData.discount_price.trim()) {
      discNum = parseFloat(formData.discount_price);
      if (isNaN(discNum) || discNum < 0 || discNum > priceNum) {
        setFormError('Discount price must be between 0 and the standard price.');
        return;
      }
    }

    const stockNum = parseInt(formData.stock_quantity, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      setFormError('Stock quantity must be zero or a positive integer.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalImageUrl = formData.image_url;

      // Handle image upload if a new file was chosen
      if (imageFile) {
        const uploadResult = await uploadProductImage(imageFile);
        if (uploadResult.error) {
          setFormError(uploadResult.error);
          setIsSubmitting(false);
          return;
        }
        if (uploadResult.url) {
          finalImageUrl = uploadResult.url;
        }
      }

      const payload = {
        name: formData.name.trim(),
        category_id: formData.category_id,
        description: formData.description.trim() || null,
        unit: formData.unit.trim() || '1 pc',
        price: priceNum,
        discount_price: discNum,
        stock_quantity: stockNum,
        low_stock_threshold: parseInt(formData.low_stock_threshold, 10) || 5,
        image_url: finalImageUrl || null,
        is_active: formData.is_active,
      };

      if (modalMode === 'create') {
        await onCreateProduct(payload);
      } else if (modalMode === 'edit' && editingProduct) {
        await onUpdateProduct(editingProduct.id, payload);
      }

      setModalMode(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save product';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStock = async (p: Product, delta: number) => {
    const newStock = Math.max(0, p.stock_quantity + delta);
    await onUpdateProduct(p.id, { stock_quantity: newStock });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17251C]">Product Catalog</h1>
          <p className="text-sm text-gray-500">
            Manage grocery catalog items, pricing, units, and images.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 rounded-xl bg-[#168447] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#105C35] transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 h-4 w-4 mt-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products by name..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-xs text-[#17251C] outline-none focus:border-[#168447]"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-[#17251C] outline-none focus:border-[#168447]"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#168447] border-t-transparent" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          No products found matching your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E0EFE4] bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-gray-400 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Price / Discount</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((p) => {
                  const cat = categories.find((c) => c.id === p.category_id);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100'}
                            alt={p.name}
                            className="h-10 w-10 rounded-lg object-cover border border-gray-100"
                          />
                          <div>
                            <p className="font-semibold text-[#17251C]">{p.name}</p>
                            <p className="text-[11px] text-gray-400 line-clamp-1">{p.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{cat?.name || 'Uncategorized'}</td>
                      <td className="py-3 px-4 font-medium text-gray-700">{p.unit}</td>
                      <td className="py-3 px-4">
                        {p.discount_price ? (
                          <div>
                            <span className="font-bold text-[#168447]">₹{Number(p.discount_price).toFixed(2)}</span>
                            <span className="ml-1.5 text-[11px] text-gray-400 line-through">
                              ₹{Number(p.price).toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold text-[#17251C]">₹{Number(p.price).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleQuickStock(p, -1)}
                            className="h-5 w-5 rounded bg-gray-100 font-bold hover:bg-gray-200"
                            title="Decrease stock"
                          >
                            -
                          </button>
                          <span
                            className={`min-w-8 text-center font-bold ${
                              p.stock_quantity === 0
                                ? 'text-red-600'
                                : p.stock_quantity <= p.low_stock_threshold
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {p.stock_quantity}
                          </span>
                          <button
                            onClick={() => handleQuickStock(p, 1)}
                            className="h-5 w-5 rounded bg-gray-100 font-bold hover:bg-gray-200"
                            title="Increase stock"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            p.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {p.is_active ? 'Active' : 'Hidden'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-gray-400 hover:text-[#168447] transition"
                            title="Edit Product"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onDeleteProduct(p.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 transition"
                            title="Delete / Deactivate Product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Product */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-[#17251C]">
              {modalMode === 'create' ? 'Add New Product' : 'Edit Product'}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Configure grocery product pricing, image, unit and stock parameters.
            </p>

            {formError && (
              <div className="mt-4 flex items-start space-x-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              {/* Product Name */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Amul Taaza Homogenised Milk"
                  required
                  className="w-full rounded-xl border border-gray-200 p-2 text-xs outline-none focus:border-[#168447]"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Category *</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 p-2 text-xs outline-none focus:border-[#168447]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Unit / Size *</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g. 500g, 1 L, 1 kg, Pack of 6"
                    required
                    className="w-full rounded-xl border border-gray-200 p-2 text-xs outline-none focus:border-[#168447]"
                  />
                </div>
              </div>

              {/* Price & Discount Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Standard MRP (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="45.00"
                    required
                    className="w-full rounded-xl border border-gray-200 p-2 text-xs outline-none focus:border-[#168447]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Discount Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discount_price}
                    onChange={(e) => setFormData({ ...formData, discount_price: e.target.value })}
                    placeholder="Optional (e.g. 39.00)"
                    className="w-full rounded-xl border border-gray-200 p-2 text-xs outline-none focus:border-[#168447]"
                  />
                </div>
              </div>

              {/* Stock Quantity & Threshold */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    required
                    className="w-full rounded-xl border border-gray-200 p-2 text-xs outline-none focus:border-[#168447]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Low Stock Warning Threshold</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 p-2 text-xs outline-none focus:border-[#168447]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="Fresh product details, nutritional highlights..."
                  className="w-full rounded-xl border border-gray-200 p-2 text-xs outline-none focus:border-[#168447]"
                />
              </div>

              {/* Image Upload with 2MB validation */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Product Image (JPEG, PNG, WebP — Max 2 MB)
                </label>
                <div className="flex items-center space-x-3">
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-14 w-14 rounded-xl object-cover border border-gray-200"
                    />
                  )}
                  <label className="flex flex-1 cursor-pointer items-center justify-center space-x-2 rounded-xl border border-dashed border-gray-300 p-3 hover:border-[#168447] hover:bg-[#EAF7EE]/30 transition">
                    <Upload className="h-4 w-4 text-gray-400" />
                    <span className="text-xs text-gray-600">
                      {imageFile ? imageFile.name : 'Choose image file'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-[#168447] focus:ring-[#168447]"
                />
                <label htmlFor="isActiveToggle" className="font-semibold text-gray-700">
                  Visible to Customers in Catalog
                </label>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#168447] px-5 py-2 font-semibold text-white hover:bg-[#105C35] disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

