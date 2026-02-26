import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, FolderTree, Search, ChevronRight, ChevronDown,
  Package, Folder, FolderOpen, X, Trash2, Upload, AlertCircle, Check,
  Loader2, Plus, Minus
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface Product {
  id: string;
  partNumber: string;
  series?: string;
  description: string;
  englishDescription?: string;
  basePrice?: number;
  category: {
    id: string;
    name: string;
  };
}

interface TreeNode {
  id: string;
  name: string;
  type: 'category' | 'product';
  children?: TreeNode[];
  product?: Product;
  categoryName?: string;
}

const ProjectBookCreator = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // Data state
  const [sourceCatalogs, setSourceCatalogs] = useState<Array<{ id: string; name: string; label: string; isMaster?: boolean }>>([]);
  const [sourceCatalogId, setSourceCatalogId] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Search & bulk import
  const [search, setSearch] = useState('');
  const [quickAddPartNumber, setQuickAddPartNumber] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<{
    found: number;
    notFound: string[];
  } | null>(null);

  // Load source catalogs once, then set default source to MASTER (first in list)
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const res = await api.get<{ sourceCatalogs: Array<{ id: string; name: string; label: string; isMaster?: boolean }> }>('/catalog-creator/source-catalogs', { timeout: 15000 });
        if (cancelled) return;
        const list = res.data.sourceCatalogs || [];
        setSourceCatalogs(list);
        setSourceCatalogId((prev) => (list.length > 0 && !prev ? list[0].id : prev));
        if (list.length === 0) setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        const status = e?.response?.status;
        const msg = e?.code === 'ECONNABORTED' ? 'Request timed out. Check that the backend is running and reachable.' : (e?.response?.data?.error || e?.message || 'Failed to load source options');
        setLoadError(msg);
        setLoading(false);
        toast.error(msg);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load products when source catalog or edit id changes
  useEffect(() => {
    if (!sourceCatalogId && !(isEditing && id)) return;
    loadData();
  }, [id, sourceCatalogId]);

  const loadData = async () => {
    if (!sourceCatalogId && !(isEditing && id)) return;
    setLoading(true);
    setLoadError(null);
    try {
      let effectiveSourceId = sourceCatalogId;
      if (isEditing && id) {
        const catalogRes = await api.get(`/catalog-creator/detail/${id}`);
        const catalog = catalogRes.data.catalog;
        setName(catalog.name);
        setDescription(catalog.description || '');
        if (catalog.sourceCatalogId) {
          setSourceCatalogId(catalog.sourceCatalogId);
          effectiveSourceId = catalog.sourceCatalogId;
        }
        const productIds = catalogRes.data.items.products.map((p: Product) => p.id);
        setSelectedProductIds(new Set(productIds));
      }
      if (!effectiveSourceId) {
        const srcRes = await api.get<{ sourceCatalogs: Array<{ id: string }> }>('/catalog-creator/source-catalogs');
        const list = srcRes.data.sourceCatalogs || [];
        if (list.length > 0) {
          effectiveSourceId = list[0].id;
          setSourceCatalogId(effectiveSourceId);
        }
      }
      if (effectiveSourceId) {
        const productsRes = await api.get('/catalog-creator/products-for-catalog', {
          params: { sourceCatalogId: effectiveSourceId },
          timeout: 15000
        });
        setProducts(productsRes.data.products || []);
      }
    } catch (error: any) {
      const msg = error?.code === 'ECONNABORTED' ? 'Request timed out.' : (error?.response?.data?.error || error?.message || 'Failed to load products');
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Build tree from products
  const treeData = useMemo(() => {
    const productsByCategory = new Map<string, Product[]>();
    
    products.forEach(product => {
      const catName = product.category?.name || 'Uncategorized';
      if (!productsByCategory.has(catName)) {
        productsByCategory.set(catName, []);
      }
      productsByCategory.get(catName)!.push(product);
    });

    const tree: TreeNode[] = [];
    productsByCategory.forEach((prods, catName) => {
      tree.push({
        id: `cat_${catName}`,
        name: catName,
        type: 'category',
        children: prods.map(p => ({
          id: p.id,
          name: p.series || p.partNumber,
          type: 'product' as const,
          product: p,
          categoryName: catName
        }))
      });
    });

    tree.sort((a, b) => a.name.localeCompare(b.name));
    return tree;
  }, [products]);

  // Filter tree by search
  const filteredTree = useMemo(() => {
    if (!search.trim()) return treeData;

    const searchLower = search.toLowerCase();
    return treeData
      .map(node => {
        if (node.children) {
          const filteredChildren = node.children.filter(child =>
            child.name.toLowerCase().includes(searchLower) ||
            child.product?.partNumber.toLowerCase().includes(searchLower) ||
            (child.product?.englishDescription ?? child.product?.description)?.toLowerCase().includes(searchLower)
          );

          if (filteredChildren.length > 0) {
            return { ...node, children: filteredChildren };
          }
          
          if (node.name.toLowerCase().includes(searchLower)) {
            return node;
          }
        }
        return null;
      })
      .filter(Boolean) as TreeNode[];
  }, [treeData, search]);

  // Selected products for display
  const selectedProducts = useMemo(() => {
    return products.filter(p => selectedProductIds.has(p.id));
  }, [products, selectedProductIds]);

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Toggle product selection
  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // Toggle category (select/deselect all products)
  const toggleCategory = (node: TreeNode) => {
    if (!node.children) return;

    const childProductIds = node.children
      .filter(c => c.type === 'product')
      .map(c => c.id);

    const allSelected = childProductIds.every(id => selectedProductIds.has(id));

    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        childProductIds.forEach(id => next.delete(id));
      } else {
        childProductIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Quick-add single part by part number
  const handleQuickAddPart = async () => {
    const pn = quickAddPartNumber.trim();
    if (!pn) {
      toast.error('Enter a part number');
      return;
    }
    setQuickAddLoading(true);
    setBulkImportResult(null);
    try {
      const response = await api.post('/catalog-creator/lookup-parts', {
        partNumbers: [pn]
      });
      const { products: foundProducts, notFound } = response.data;
      if (foundProducts?.length > 0) {
        setSelectedProductIds(prev => {
          const next = new Set(prev);
          foundProducts.forEach((p: Product) => next.add(p.id));
          return next;
        });
        setQuickAddPartNumber('');
        toast.success(`Added ${foundProducts[0].partNumber}`);
      } else {
        toast.error(`Part "${pn}" not found`);
      }
    } catch (error) {
      console.error('Quick-add error:', error);
      toast.error('Lookup failed');
    } finally {
      setQuickAddLoading(false);
    }
  };

  // Bulk import handler
  const handleBulkImport = async () => {
    const partNumbers = bulkImportText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (partNumbers.length === 0) {
      toast.error('Please enter at least one part number');
      return;
    }

    setBulkImporting(true);
    setBulkImportResult(null);

    try {
      const response = await api.post('/catalog-creator/lookup-parts', {
        partNumbers
      });

      const { products: foundProducts, notFound } = response.data;

      // Add found products to selection
      setSelectedProductIds(prev => {
        const next = new Set(prev);
        foundProducts.forEach((p: Product) => next.add(p.id));
        return next;
      });

      setBulkImportResult({
        found: foundProducts.length,
        notFound
      });

      toast.success(`Added ${foundProducts.length} products${notFound.length > 0 ? `. ${notFound.length} not found.` : ''}`);
    } catch (error) {
      console.error('Bulk import error:', error);
      toast.error('Bulk import failed');
    } finally {
      setBulkImporting(false);
    }
  };

  // Save catalog
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a project book name');
      return;
    }

    if (selectedProductIds.size === 0) {
      toast.error('Please select at least one product');
      return;
    }

    setSaving(true);

    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        sourceCatalogId: sourceCatalogId || undefined,
        productIds: Array.from(selectedProductIds)
      };

      if (isEditing) {
        await api.patch(`/catalog-creator/update/${id}`, data);
        toast.success('Project book updated successfully!');
      } else {
        await api.post('/catalog-creator/create', data);
        toast.success('Project book created successfully!');
      }

      navigate('/catalog-list');
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.error || 'Failed to save project book');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !loadError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 text-green-600 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <button onClick={() => navigate('/catalog-list')} className="text-green-600 hover:underline flex items-center gap-1 mb-6">
          <ArrowLeft className="w-5 h-5" /> Back to Project Books
        </button>
        <div className="card p-8 border-red-200 bg-red-50">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Unable to load Project Book Creator</h2>
          <p className="text-red-700 mb-4">{loadError}</p>
          <p className="text-sm text-gray-600 mb-4">
            Make sure the backend server is running. If testing locally, run both frontend and backend.
          </p>
          <button
            onClick={() => { setLoadError(null); setLoading(true); window.location.reload(); }}
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Tree node component
  const TreeNodeComponent = ({ node, depth = 0 }: { node: TreeNode; depth?: number }) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isProduct = node.type === 'product';
    const isSelected = isProduct && selectedProductIds.has(node.id);

    if (isProduct) {
      return (
        <div
          className={`flex items-center space-x-2 py-2 px-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
            isSelected ? 'bg-green-50 border border-green-200' : ''
          }`}
          style={{ marginLeft: `${depth * 20}px` }}
          onClick={() => toggleProduct(node.id)}
          data-testid={`tree-product-${node.id}`}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleProduct(node.id)}
            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
            data-testid={`checkbox-product-${node.id}`}
            onClick={(e) => e.stopPropagation()}
          />
          <Package className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm flex-1 truncate">{node.name}</span>
          {node.product && (
            <span className="text-xs text-gray-500">{node.product.partNumber}</span>
          )}
        </div>
      );
    }

    // Category node
    const childProductIds = node.children?.filter(c => c.type === 'product').map(c => c.id) || [];
    const selectedCount = childProductIds.filter(id => selectedProductIds.has(id)).length;
    const allSelected = childProductIds.length > 0 && selectedCount === childProductIds.length;
    const someSelected = selectedCount > 0 && !allSelected;

    return (
      <div key={node.id}>
        <div
          className="flex items-center space-x-2 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <button
            onClick={() => toggleNode(node.id)}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="w-4" />
            )}
          </button>
          <input
            type="checkbox"
            checked={allSelected}
            ref={el => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={() => toggleCategory(node)}
            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
            data-testid={`checkbox-category-${node.id}`}
            onClick={(e) => e.stopPropagation()}
          />
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          )}
          <span className="text-sm font-medium flex-1">{node.name}</span>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-700">
            {selectedCount}/{childProductIds.length}
          </span>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => (
              <TreeNodeComponent key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/catalog-list')}
            className="p-2 hover:bg-gray-100 rounded-lg"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditing ? 'Edit Project Book' : 'Create Project Book'}
            </h1>
            <p className="text-gray-600">
              Select products to include in your custom project book
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim() || selectedProductIds.size === 0}
          className="btn btn-primary flex items-center space-x-2"
          data-testid="button-save-catalog"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Save Project Book</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Project Book Details + Bulk Import */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Book Details */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Book Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Book Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Industrial Controls Project Book"
                  className="input"
                  data-testid="input-catalog-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className="input resize-none"
                  rows={3}
                  data-testid="input-catalog-description"
                />
              </div>
              {sourceCatalogs.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Build from (Master Catalog)
                  </label>
                  <select
                    value={sourceCatalogId}
                    onChange={(e) => setSourceCatalogId(e.target.value)}
                    className="input"
                    data-testid="select-source-catalog"
                  >
                    {sourceCatalogs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Products and descriptions come from the Master Catalog.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Add Part / Bulk Import */}
          <div className="card p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Plus className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Add Products</h3>
            </div>

            {/* Quick-add: type part number, Enter or Add */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={quickAddPartNumber}
                  onChange={(e) => setQuickAddPartNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickAddPart())}
                  placeholder="Type part number and press Enter to add"
                  className="input w-full pl-10 text-sm"
                  disabled={quickAddLoading}
                  data-testid="input-quick-add-part"
                />
              </div>
              <button
                type="button"
                onClick={handleQuickAddPart}
                disabled={!quickAddPartNumber.trim() || quickAddLoading}
                className="btn btn-primary flex items-center gap-2 shrink-0"
                data-testid="button-quick-add"
              >
                {quickAddLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              Or paste multiple part numbers (one per line):
            </p>
            <textarea
              value={bulkImportText}
              onChange={(e) => setBulkImportText(e.target.value)}
              placeholder="Enter part numbers, one per line:&#10;2002-1201&#10;221-412&#10;750-504"
              className="input resize-none font-mono text-sm"
              rows={6}
              data-testid="textarea-bulk-import"
            />
            <button
              onClick={handleBulkImport}
              disabled={bulkImporting || !bulkImportText.trim()}
              className="btn btn-primary w-full mt-3"
              data-testid="button-bulk-import"
            >
              {bulkImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Looking up...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Part Numbers
                </>
              )}
            </button>

            {/* Bulk Import Results */}
            {bulkImportResult && (
              <div className="mt-4 space-y-2">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-green-800">
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Added {bulkImportResult.found} products
                    </span>
                  </div>
                </div>

                {bulkImportResult.notFound.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-start space-x-2 text-red-800">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">
                          {bulkImportResult.notFound.length} not found:
                        </p>
                        <div className="text-xs bg-red-100 p-2 rounded max-h-24 overflow-y-auto">
                          {bulkImportResult.notFound.join(', ')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Product Tree */}
        <div className="lg:col-span-3">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <FolderTree className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Product Tree</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setExpandedNodes(new Set(treeData.map(n => n.id)))}
                  className="btn btn-secondary text-sm"
                  data-testid="button-expand-all"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Expand All
                </button>
                <button
                  onClick={() => setExpandedNodes(new Set())}
                  className="btn btn-secondary text-sm"
                  data-testid="button-collapse-all"
                >
                  <Minus className="w-4 h-4 mr-1" />
                  Collapse All
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="input pl-10"
                data-testid="input-search-products"
              />
            </div>

            {/* Tree */}
            <div className="border border-gray-200 rounded-lg p-4 max-h-[500px] overflow-y-auto">
              {filteredTree.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mb-2" />
                  <p>No products found</p>
                </div>
              ) : (
                filteredTree.map(node => (
                  <TreeNodeComponent key={node.id} node={node} depth={0} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Products Panel */}
      <div className="mt-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Selected Products ({selectedProducts.length})
            </h3>
            {selectedProducts.length > 0 && (
              <button
                onClick={() => setSelectedProductIds(new Set())}
                className="btn btn-secondary text-sm"
                data-testid="button-clear-selection"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear All
              </button>
            )}
          </div>

          {selectedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Package className="w-12 h-12 mb-2" />
              <p>No products selected</p>
              <p className="text-sm">Select from the tree or use bulk import</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedProducts.map(product => (
                <div
                  key={product.id}
                  className="inline-flex items-center space-x-2 bg-green-100 text-green-800 rounded-lg py-2 px-3"
                  data-testid={`selected-product-${product.id}`}
                >
                  <span className="text-sm font-medium">
                    {product.series || product.partNumber}
                  </span>
                  <span className="text-xs text-green-600">
                    ({product.partNumber})
                  </span>
                  <button
                    onClick={() => toggleProduct(product.id)}
                    className="ml-1 hover:bg-green-200 rounded p-0.5"
                    data-testid={`remove-product-${product.id}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectBookCreator;
