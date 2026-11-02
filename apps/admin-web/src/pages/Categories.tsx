import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Layers, AlertCircle } from 'lucide-react';
import type { Database } from '@freshkart/shared';

type Category = Database['public']['Tables']['categories']['Row'];
type Product = Database['public']['Tables']['products']['Row'];

interface CategoriesProps {
  categories: Category[];
  products: Product[];
  onCreateCategory: (cat: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onUpdateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  isLoading: boolean;
}

export const Categories: React.FC<CategoriesProps> = ({
  categories,
  products,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  isLoading,
}) => {
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    image_url: '',
    sort_order: 1,
    is_active: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      image_url: '',
      sort_order: categories.length + 1,
      is_active: true,
    });
    setError(null);
  };

  const openEditModal = (cat: Category) => {
    setModalMode('edit');
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      image_url: cat.image_url || '',
      sort_order: cat.sort_order,
      is_active: cat.is_active,
    });
    setError(null);
  };

  const handleNameChange = (name: string) => {
    const autoSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setFormData((prev) => ({
      ...prev,
      name,
      slug: modalMode === 'create' ? autoSlug : prev.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.slug.trim()) {
      setError('Category name and slug are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (modalMode === 'create') {
        await onCreateCategory({
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          image_url: formData.image_url.trim() || null,
          sort_order: Number(formData.sort_order),
          is_active: formData.is_active,
        });
      } else if (modalMode === 'edit' && editingCategory) {
        await onUpdateCategory(editingCategory.id, {
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          image_url: formData.image_url.trim() || null,
          sort_order: Number(formData.sort_order),
          is_active: formData.is_active,
        });
      }
      setModalMode(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save category';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17251C]">Category Hierarchy</h1>
          <p className="text-sm text-gray-500">
            Organize departments, banners, and visual grouping for the customer mobile app.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 rounded-xl bg-[#168447] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#105C35] transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add Category</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#168447] border-t-transparent" />
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-400">
          No categories found. Create your first category above.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((cat) => {
              const productCount = products.filter((p) => p.category_id === cat.id).length;
              return (
                <div
                  key={cat.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#E0EFE4] bg-white p-5 shadow-xs hover:shadow-sm transition"
                >
                  <div className="flex items-start space-x-3">
                    <img
                      src={cat.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200'}
                      alt={cat.name}
                      className="h-14 w-14 rounded-xl object-cover border border-gray-100 shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#17251C]">{cat.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            cat.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {cat.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">/{cat.slug}</p>
                      <p className="mt-2 text-xs font-semibold text-[#168447]">
                        {productCount} Products cataloged
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
                    <span>Display Order: #{cat.sort_order}</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditModal(cat)}
                        className="p-1 text-gray-400 hover:text-[#168447] transition"
                        title="Edit category"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDeleteCategory(cat.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition"
                        title="Delete category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#17251C]">
              {modalMode === 'create' ? 'Add Category' : 'Edit Category'}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Department metadata and display order.
            </p>

            {error && (
              <div className="mt-4 flex items-start space-x-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Dairy & Breakfast"
                  required
                  className="w-full rounded-xl border border-gray-200 p-2 text-xs outline-none focus:border-[#168447]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">URL Slug *</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="dairy-breakfast"
                  required
                  className="w-full rounded-xl border border-gray-200 p-2 text-xs font-mono outline-none focus:border-[#168447]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Image URL</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-gray-200 p-2 text-xs outline-none focus:border-[#168447]"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Sort Order Index</label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value, 10) || 1 })}
                  className="w-full rounded-xl border border-gray-200 p-2 text-xs outline-none focus:border-[#168447]"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="catActive"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-[#168447] focus:ring-[#168447]"
                />
                <label htmlFor="catActive" className="font-semibold text-gray-700">
                  Visible to Customers
                </label>
              </div>

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
                  {isSubmitting ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
