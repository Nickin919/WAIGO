import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Search, UserPlus, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { quoteApi, catalogApi, customerApi, partApi, assignmentsApi, priceContractApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_MAX_DISCOUNT, effectiveRole } from '@/lib/quoteConstants';

interface LineItem {
  partId: string;
  productSeries: string;
  productPartNumber: string;
  productPrice: number;
  productDescription: string;
  minQty: number | null;
  distributorDiscount: number;
  quantity: number;
  discountPct: number;
  marginPct: number;
  marginSelected?: boolean;
  discountSelected?: boolean;
}

interface Customer {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

interface Part {
  id: string;
  partNumber: string;
  series?: string | null;
  description: string;
  englishDescription?: string | null;
  basePrice?: number | null;
  minQty?: number;
  distributorDiscount?: number;
}

/** Price contract item for applying special pricing when adding products */
interface PriceContractItemRow {
  id: string;
  partId: string | null;
  seriesOrGroup: string | null;
  costPrice: number;
  suggestedSellPrice: number | null;
  discountPercent: number | null;
  minQuantity: number;
}

const QuoteForm = () => {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isEdit = !!quoteId && quoteId !== 'new';

  const [catalogId, setCatalogId] = useState('');
  const [catalogs, setCatalogs] = useState<{ id: string; name: string }[]>([]);
  const [priceContractId, setPriceContractId] = useState('');
  const [priceContracts, setPriceContracts] = useState<{ id: string; name: string }[]>([]);
  const [contractDetails, setContractDetails] = useState<{ items: PriceContractItemRow[] } | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<Part[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [quickAddPartNumber, setQuickAddPartNumber] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  const [bulkInput, setBulkInput] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [notFoundParts, setNotFoundParts] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const marginSelectAllRef = useRef<HTMLInputElement>(null);
  const discountSelectAllRef = useRef<HTMLInputElement>(null);

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [bulkMarginValue, setBulkMarginValue] = useState('');
  const [bulkDiscountValue, setBulkDiscountValue] = useState('');

  const maxDiscount = ROLE_MAX_DISCOUNT[effectiveRole(user?.role || 'BASIC')] ?? 10;
  const allMarginSelected = items.length > 0 && items.every((i) => i.marginSelected);
  const allDiscountSelected = items.length > 0 && items.every((i) => i.discountSelected);
  const someMarginSelected = items.some((i) => i.marginSelected);
  const someDiscountSelected = items.some((i) => i.discountSelected);
  const isDistributorOrHigher = ['ADMIN', 'RSM', 'DISTRIBUTOR', 'DISTRIBUTOR_REP'].includes(effectiveRole(user?.role || ''));

  // Load assigned catalogs and price contracts (for proposal wizard); fallback to all catalogs if no assignments
  useEffect(() => {
    assignmentsApi.getMyAssignments()
      .then((res) => {
        const data = res.data as { catalogs?: { id: string; name: string; isPrimary?: boolean }[]; primaryCatalogId?: string | null; priceContracts?: { id: string; name: string }[] };
        const assignedCatalogs = data.catalogs || [];
        const assignedContracts = data.priceContracts || [];
        setPriceContracts(assignedContracts);
        if (assignedCatalogs.length > 0) {
          setCatalogs(assignedCatalogs.map((c) => ({ id: c.id, name: c.name || 'Unnamed' })));
          const primary = data.primaryCatalogId ?? assignedCatalogs.find((c) => c.isPrimary)?.id ?? assignedCatalogs[0]?.id;
          if (primary && !catalogId) setCatalogId(primary);
        } else {
          catalogApi.getAll().then((r) => {
            const list = Array.isArray(r.data) ? r.data : [];
            setCatalogs(list.map((c: any) => ({ id: c.id, name: c.name || 'Unnamed' })));
            if (list.length > 0 && !catalogId) {
              const userCat = user?.catalogId;
              const match = userCat && list.some((c: any) => c.id === userCat);
              setCatalogId(match ? userCat! : list[0].id);
            }
          }).catch(() => {});
        }
      })
      .catch(() => {
        catalogApi.getAll().then((res) => {
          const list = Array.isArray(res.data) ? res.data : [];
          setCatalogs(list.map((c: any) => ({ id: c.id, name: c.name || 'Unnamed' })));
          if (list.length > 0 && !catalogId) {
            const userCat = user?.catalogId;
            const match = userCat && list.some((c: any) => c.id === userCat);
            setCatalogId(match ? userCat! : list[0].id);
          }
        }).catch(() => {});
      });
  }, [user?.catalogId]);

  // When a price contract is selected, load its items for applying pricing
  useEffect(() => {
    if (!priceContractId) {
      setContractDetails(null);
      return;
    }
    priceContractApi.getById(priceContractId).then((res) => {
      const contract = res.data as { items?: { id: string; partId: string | null; seriesOrGroup: string | null; costPrice: number; suggestedSellPrice: number | null; discountPercent: number | null; minQuantity: number }[] };
      const items = (contract.items || []).map((i) => ({
        id: i.id,
        partId: i.partId ?? null,
        seriesOrGroup: i.seriesOrGroup ?? null,
        costPrice: i.costPrice,
        suggestedSellPrice: i.suggestedSellPrice ?? null,
        discountPercent: i.discountPercent ?? null,
        minQuantity: i.minQuantity ?? 1,
      }));
      setContractDetails({ items });
    }).catch(() => setContractDetails(null));
  }, [priceContractId]);

  useEffect(() => {
    if (isEdit && quoteId) {
      quoteApi.getById(quoteId).then((res) => {
        const q = res.data as any;
        setCatalogId(q.catalogId || '');
        setPriceContractId(q.priceContractId || '');
        setCustomerId(q.customerId || null);
        setCustomerName(q.customerName || '');
        setNotes(q.notes || q.note || '');
        setItems((q.items || []).map((i: any) => ({
          partId: i.partId,
          productSeries: i.snapshotSeries || i.part?.series || '',
          productPartNumber: i.snapshotPartNumber || i.partNumber,
          productPrice: i.snapshotPrice ?? i.costPrice ?? 0,
          productDescription: i.snapshotDescription || i.description,
          minQty: i.snapshotMinQty ?? i.minQty,
          distributorDiscount: i.snapshotDistributorDiscount ?? 0,
          quantity: i.quantity || 1,
          discountPct: i.discountPct ?? 0,
          marginPct: i.marginPct ?? 0,
          marginSelected: false,
          discountSelected: false,
        })));
      }).catch(() => toast.error('Failed to load quote')).finally(() => setLoading(false));
    }
  }, [isEdit, quoteId]);

  useEffect(() => {
    if (showCustomerPicker && customerSearch.trim()) {
      customerApi.getAll({ search: customerSearch }).then((res) => {
        setCustomers(Array.isArray(res.data) ? res.data : []);
      }).catch(() => setCustomers([]));
    } else {
      customerApi.getAll().then((res) => {
        setCustomers(Array.isArray(res.data) ? res.data : []);
      }).catch(() => setCustomers([]));
    }
  }, [showCustomerPicker, customerSearch]);

  useEffect(() => {
    const el = marginSelectAllRef.current;
    if (el) el.indeterminate = someMarginSelected && !allMarginSelected;
  }, [someMarginSelected, allMarginSelected]);
  useEffect(() => {
    const el = discountSelectAllRef.current;
    if (el) el.indeterminate = someDiscountSelected && !allDiscountSelected;
  }, [someDiscountSelected, allDiscountSelected]);

  useEffect(() => {
    if (showProductPicker && catalogId && productSearch.trim().length >= 2) {
      partApi.getByCatalog(catalogId, { search: productSearch, limit: 10 }).then((res) => {
        const data = res.data as any;
        setProducts(data?.parts || []);
      }).catch(() => setProducts([]));
    } else {
      setProducts([]);
    }
  }, [showProductPicker, catalogId, productSearch]);

  const calculateSellPrice = (item: LineItem) => {
    const cost = item.productPrice * (1 - item.discountPct / 100);
    return cost * (1 + (item.marginPct || 0) / 100);
  };
  const calculateLineTotal = (item: LineItem) => item.quantity * calculateSellPrice(item);
  const calculateTotal = () => items.reduce((sum, i) => sum + calculateLineTotal(i), 0);

  /** Find contract item for a part: by partId or by seriesOrGroup matching part.series/partNumber */
  const findContractItem = (part: Part): PriceContractItemRow | null => {
    if (!contractDetails?.items?.length) return null;
    const byPart = contractDetails.items.find((i) => i.partId === part.id);
    if (byPart) return byPart;
    const series = (part.series || part.partNumber || '').toUpperCase();
    const bySeries = contractDetails.items.find(
      (i) => i.seriesOrGroup && series.includes((i.seriesOrGroup as string).toUpperCase())
    );
    if (bySeries) return bySeries;
    const byPartNumber = contractDetails.items.find(
      (i) => i.seriesOrGroup && (part.partNumber || '').toUpperCase() === (i.seriesOrGroup as string).toUpperCase()
    );
    return byPartNumber ?? null;
  };

  const addProduct = (part: Part) => {
    const contractItem = findContractItem(part);
    const quantity = 1;
    let listPrice = part.basePrice ?? 0;
    let defaultDisc = 0;
    let marginPct = 0;
    // Only use contract/catalog pricing when a price contract is selected
    if (priceContractId && contractItem && quantity >= contractItem.minQuantity) {
      listPrice = contractItem.costPrice;
      defaultDisc = contractItem.discountPercent ?? part.distributorDiscount ?? 0;
      const costAfterDisc = listPrice * (1 - defaultDisc / 100);
      if (contractItem.suggestedSellPrice != null && costAfterDisc > 0) {
        marginPct = (contractItem.suggestedSellPrice / costAfterDisc - 1) * 100;
      }
    }
    // When no price contract: sell price defaults to list price (0% discount, 0% margin)
    const existing = items.find((i) => i.partId === part.id);
    if (existing) {
      setItems(items.map((i) =>
        i.partId === part.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setItems([
        ...items,
        {
          partId: part.id,
          productSeries: part.series || part.partNumber,
          productPartNumber: part.partNumber,
          productPrice: listPrice,
          productDescription: part.englishDescription || part.description || '',
          minQty: part.minQty ?? null,
          distributorDiscount: defaultDisc,
          quantity: 1,
          discountPct: defaultDisc,
          marginPct,
          marginSelected: false,
          discountSelected: false,
        },
      ]);
    }
    setShowProductPicker(false);
    setProductSearch('');
  };

  const parseBulkInput = (text: string): string[] => {
    return text.split(/[,\n\r\t]+/).map((s) => s.trim()).filter(Boolean);
  };

  /** Quick-add single part by part number (Enter or Add) */
  const handleQuickAddPart = async () => {
    const pn = quickAddPartNumber.trim();
    if (!pn || !catalogId) {
      if (!catalogId) toast.error('Select a catalog first');
      else toast.error('Enter a part number');
      return;
    }
    setQuickAddLoading(true);
    try {
      const res = await partApi.lookupBulk(catalogId, [pn]);
      const data = res.data as { found: Part[]; notFound: string[] };
      if (data.found?.length > 0) {
        addProduct(data.found[0]);
        setQuickAddPartNumber('');
        toast.success(`Added ${data.found[0].partNumber}`);
      } else {
        toast.error(`Part "${pn}" not found`);
      }
    } catch {
      toast.error('Lookup failed');
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleBulkImport = () => {
    const parts = parseBulkInput(bulkInput);
    if (parts.length === 0 || !catalogId) {
      toast.error('Enter part numbers and select a catalog');
      return;
    }
    if (bulkImporting) return;
    setBulkImporting(true);
    partApi.lookupBulk(catalogId, parts).then((res) => {
      const data = res.data as { found: Part[]; notFound: string[] };
      const partCounts = new Map<string, number>();
      parts.forEach((p) => partCounts.set(p.toUpperCase(), (partCounts.get(p.toUpperCase()) || 0) + 1));

      setItems((prev) => {
        const next = [...prev];
        for (const part of data.found) {
          const key = part.partNumber.toUpperCase();
          const count = partCounts.get(key) || 1;
          const contractItem = findContractItem(part);
          let listPrice = part.basePrice ?? 0;
          let defaultDisc = 0;
          let marginPct = 0;
          // Only use contract/catalog pricing when a price contract is selected
          if (priceContractId && contractItem && count >= contractItem.minQuantity) {
            listPrice = contractItem.costPrice;
            defaultDisc = contractItem.discountPercent ?? part.distributorDiscount ?? 0;
            const costAfterDisc = listPrice * (1 - defaultDisc / 100);
            if (contractItem.suggestedSellPrice != null && costAfterDisc > 0) {
              marginPct = (contractItem.suggestedSellPrice / costAfterDisc - 1) * 100;
            }
          }
          // When no price contract: sell price defaults to list price (0% discount, 0% margin)
          const idx = next.findIndex((i) => i.partId === part.id);
          if (idx >= 0) {
            next[idx].quantity += count;
          } else {
            next.push({
              partId: part.id,
              productSeries: part.series || part.partNumber,
              productPartNumber: part.partNumber,
              productPrice: listPrice,
              productDescription: part.englishDescription || part.description || '',
              minQty: part.minQty ?? null,
              distributorDiscount: defaultDisc,
              quantity: count,
              discountPct: defaultDisc,
              marginPct,
              marginSelected: false,
              discountSelected: false,
            });
          }
        }
        return next;
      });
      setNotFoundParts(data.notFound || []);
      setBulkInput('');
      toast.success(`Added ${data.found.length} products`);
      if ((data.notFound || []).length > 0) {
        toast.error(`${data.notFound.length} part(s) not found`);
      }
    }).catch(() => toast.error('Bulk lookup failed')).finally(() => setBulkImporting(false));
  };

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) readCsvFile(f);
  };

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) readCsvFile(f);
    e.target.value = '';
  };

  const readCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string) || '';
      const lines = text.split(/\r?\n/);
      const parts: string[] = [];
      for (const line of lines) {
        const cells = line.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
        if (cells[0]) parts.push(cells[0]);
      }
      if (parts.length > 0) {
        setBulkInput((prev) => (prev ? `${prev}\n${parts.join('\n')}` : parts.join('\n')));
        toast.success(`Loaded ${parts.length} part numbers from file`);
      }
    };
    reader.readAsText(file);
  };

  const selectCustomer = (c: Customer) => {
    setCustomerId(c.id);
    setCustomerName(c.company ? `${c.name} (${c.company})` : c.name);
    setShowCustomerPicker(false);
  };

  const createCustomer = () => {
    if (!newCustomer.name.trim()) {
      toast.error('Customer name required');
      return;
    }
    if (creatingCustomer) return;
    setCreatingCustomer(true);
    customerApi
      .create(newCustomer)
      .then((res) => {
        const c = res.data as Customer;
        setCustomerId(c.id);
        setCustomerName(c.company ? `${c.name} (${c.company})` : c.name);
        setShowNewCustomer(false);
        setNewCustomer({ name: '', company: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '' });
        toast.success('Customer created');
      })
      .catch(() => toast.error('Failed to create customer'))
      .finally(() => setCreatingCustomer(false));
  };

  const updateItem = (index: number, updates: Partial<LineItem>) => {
    setItems(items.map((i, idx) => (idx === index ? { ...i, ...updates } : i)));
  };

  const toggleMarginSelectAll = () => {
    const next = !allMarginSelected;
    setItems(items.map((i) => ({ ...i, marginSelected: next })));
  };
  const toggleDiscountSelectAll = () => {
    const next = !allDiscountSelected;
    setItems(items.map((i) => ({ ...i, discountSelected: next })));
  };
  const toggleMarginSelected = (index: number) => {
    updateItem(index, { marginSelected: !items[index].marginSelected });
  };
  const toggleDiscountSelected = (index: number) => {
    updateItem(index, { discountSelected: !items[index].discountSelected });
  };
  const applyBulkMargin = (value: number) => {
    setItems(items.map((i) => (i.marginSelected ? { ...i, marginPct: value } : i)));
  };
  const applyBulkDiscount = (value: number) => {
    const clamped = Math.min(value, maxDiscount);
    setItems(items.map((i) => (i.discountSelected ? { ...i, discountPct: clamped } : i)));
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogId) {
      toast.error('Select a catalog');
      return;
    }
    if (items.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    const invalid = items.find((i) => i.discountPct > maxDiscount);
    if (invalid) {
      toast.error(`Discount cannot exceed ${maxDiscount}% for your role`);
      return;
    }

    setSaving(true);
    const payload = {
      catalogId,
      priceContractId: priceContractId || undefined,
      customerId: customerId || undefined,
      customerName: customerName || '',
      notes,
      items: items.map((i) => ({
        partId: i.partId,
        quantity: i.quantity,
        discountPct: i.discountPct,
        marginPct: i.marginPct,
      })),
    };

    try {
      if (isEdit && quoteId) {
        await quoteApi.update(quoteId, payload);
        toast.success('Quote updated');
        navigate(`/quotes/${quoteId}`);
      } else {
        const res = await quoteApi.create(payload);
        const created = res.data as { id: string };
        toast.success('Quote created');
        navigate(`/quotes/${created.id}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save quote');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/quotes')} className="text-green-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Quote' : 'New Quote'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Catalog */}
        {catalogs.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Catalog</label>
            <select value={catalogId} onChange={(e) => setCatalogId(e.target.value)} className="input max-w-md">
              {catalogs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Price contract (optional special pricing) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Price contract</label>
          <select
            value={priceContractId}
            onChange={(e) => setPriceContractId(e.target.value)}
            className="input max-w-md"
          >
            <option value="">Standard pricing</option>
            {priceContracts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {priceContractId && (
            <p className="text-xs text-gray-500 mt-1">Products added will use contract cost and suggested sell when eligible.</p>
          )}
        </div>

        {/* Customer */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="block text-sm font-medium text-gray-700">Customer</label>
            <Link to="/customers" className="text-sm text-green-600 hover:underline">Manage my customers</Link>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={customerName || customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  if (!showCustomerPicker) setShowCustomerPicker(true);
                }}
                onFocus={() => setShowCustomerPicker(true)}
                placeholder="Select or type customer name"
                className="input w-full"
              />
              {customerName && (
                <button type="button" onClick={() => { setCustomerId(null); setCustomerName(''); }} className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              )}
              {showCustomerPicker && (
                <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  <button type="button" onClick={() => { setShowCustomerPicker(false); setShowNewCustomer(true); }} className="w-full px-4 py-2 text-left text-green-600 hover:bg-gray-50 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" /> New Customer
                  </button>
                  {customers.map((c) => (
                    <button key={c.id} type="button" onClick={() => selectCustomer(c)} className="w-full px-4 py-2 text-left hover:bg-gray-50">
                      {c.company ? `${c.name} (${c.company})` : c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* New Customer Modal */}
        {showNewCustomer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold mb-4">New Customer</h3>
              <div className="space-y-3">
                <input type="text" placeholder="Name *" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} className="input" />
                <input type="text" placeholder="Company" value={newCustomer.company} onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })} className="input" />
                <input type="email" placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} className="input" />
                <input type="text" placeholder="Phone" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="input" />
                <input type="text" placeholder="Address" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} className="input" />
              </div>
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setShowNewCustomer(false)} disabled={creatingCustomer} className="btn bg-gray-200">Cancel</button>
                <button type="button" onClick={createCustomer} disabled={creatingCustomer} className="btn btn-primary">
                  {creatingCustomer ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} placeholder="Optional notes" />
        </div>

        {/* Line Items */}
        <div>
          <h2 className="text-lg font-bold mb-4">Line Items</h2>

          {/* Quick-add: type part number, Enter or Add */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={quickAddPartNumber}
                onChange={(e) => setQuickAddPartNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickAddPart())}
                placeholder="Type part number and press Enter to add"
                className="input w-full pl-10"
                disabled={!catalogId || quickAddLoading}
              />
            </div>
            <button
              type="button"
              onClick={handleQuickAddPart}
              disabled={!quickAddPartNumber.trim() || !catalogId || quickAddLoading}
              className="btn btn-primary flex items-center gap-2 shrink-0"
            >
              {quickAddLoading ? (
                <span className="animate-pulse">Adding...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Add
                </>
              )}
            </button>
            <button type="button" onClick={() => setShowBulkImport(!showBulkImport)} className="btn bg-gray-200 flex items-center gap-2 shrink-0" title="Bulk import">
              <Upload className="w-4 h-4" /> Bulk
            </button>
            <button type="button" onClick={() => setShowProductPicker(!showProductPicker)} className="btn bg-gray-200 flex items-center gap-2 shrink-0" title="Browse & search">
              <Search className="w-4 h-4" /> Browse
            </button>
          </div>

          {/* Bulk Import */}
          {showBulkImport && (
            <div
              onDrop={handleCsvDrop}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 mb-4 cursor-pointer ${dragActive ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
            >
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvSelect} className="hidden" />
              <p className="text-sm text-gray-600 mb-2">Drop CSV here or click to browse. Paste part numbers below:</p>
              <textarea value={bulkInput} onChange={(e) => setBulkInput(e.target.value)} placeholder="Part numbers (comma or newline separated)" className="input h-24 w-full" />
              <button type="button" onClick={handleBulkImport} disabled={bulkImporting} className="btn btn-primary mt-2">
                {bulkImporting ? 'Importing...' : 'Import'}
              </button>
              {notFoundParts.length > 0 && <p className="text-amber-600 text-sm mt-2">Not found: {notFoundParts.join(', ')}</p>}
            </div>
          )}

          {/* Product Picker */}
          {showProductPicker && (
            <div className="border rounded-lg p-4 mb-4 bg-gray-50">
              <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search part number or description..." className="input mb-2 w-full" />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {products.map((p) => (
                  <button key={p.id} type="button" onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 hover:bg-white rounded flex justify-between">
                    <span>{p.partNumber} - {(p.englishDescription || p.description || '').slice(0, 50)}...</span>
                    <span className="text-green-600 font-medium">{formatCurrency(p.basePrice ?? 0)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Product</th>
                  <th className="px-4 py-2 text-right">List Price</th>
                  <th className="px-4 py-2 text-center">Min Qty</th>
                  {isDistributorOrHigher && (
                    <th className="px-4 py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <input type="checkbox" checked={allDiscountSelected} ref={discountSelectAllRef} onChange={toggleDiscountSelectAll} className="rounded border-gray-300" title="Select all" />
                        <input type="number" min={0} max={maxDiscount} step={0.5} value={bulkDiscountValue} onChange={(e) => { const v = e.target.value; setBulkDiscountValue(v); const n = parseFloat(v); if (!isNaN(n)) applyBulkDiscount(n); }} placeholder="Apply %" className="input py-1 w-16 text-right" title="Apply to selected" />
                      </div>
                      <div className="text-xs font-normal text-gray-500 mt-0.5">Disc %</div>
                    </th>
                  )}
                  {isDistributorOrHigher && (
                    <th className="px-4 py-2">
                      <div className="flex items-center gap-2 justify-end">
                        <input type="checkbox" checked={allMarginSelected} ref={marginSelectAllRef} onChange={toggleMarginSelectAll} className="rounded border-gray-300" title="Select all" />
                        <input type="number" min={0} step={0.5} value={bulkMarginValue} onChange={(e) => { const v = e.target.value; setBulkMarginValue(v); const n = parseFloat(v); if (!isNaN(n)) applyBulkMargin(n); }} placeholder="Apply %" className="input py-1 w-16 text-right" title="Apply to selected" />
                      </div>
                      <div className="text-xs font-normal text-gray-500 mt-0.5">Margin %</div>
                    </th>
                  )}
                  <th className="px-4 py-2 text-right">Sell</th>
                  <th className="px-4 py-2 text-center">Qty</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className={`border-t ${(item.marginSelected || item.discountSelected) ? 'bg-green-50/50' : ''}`}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{item.productPartNumber}</div>
                      <div className="text-gray-500 truncate max-w-xs">{item.productDescription.slice(0, 40)}...</div>
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(item.productPrice)}</td>
                    <td className="px-4 py-2 text-center">{item.minQty ?? '—'}</td>
                    {isDistributorOrHigher && (
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 justify-end">
                          <input type="checkbox" checked={!!item.discountSelected} onChange={() => toggleDiscountSelected(idx)} className="rounded border-gray-300" />
                          <input type="number" min={0} max={maxDiscount} step={0.5} value={item.discountPct} onChange={(e) => updateItem(idx, { discountPct: parseFloat(e.target.value) || 0 })} className="input py-1 w-16 text-right" />
                        </div>
                      </td>
                    )}
                    {isDistributorOrHigher && (
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 justify-end">
                          <input type="checkbox" checked={!!item.marginSelected} onChange={() => toggleMarginSelected(idx)} className="rounded border-gray-300" />
                          <input type="number" min={0} step={0.5} value={item.marginPct} onChange={(e) => updateItem(idx, { marginPct: parseFloat(e.target.value) || 0 })} className="input py-1 w-16 text-right" />
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(calculateSellPrice(item))}</td>
                    <td className="px-4 py-2">
                      <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value, 10) || 1 })} className="input py-1 w-16 text-center" />
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(calculateLineTotal(item))}</td>
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {items.length > 0 && (
            <div className="mt-4 flex justify-end">
              <span className="text-lg font-bold">Total: {formatCurrency(calculateTotal())}</span>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-2">Max discount for your role: {maxDiscount}%</p>
        </div>

        <div className="flex gap-4">
          <button type="button" onClick={() => navigate('/quotes')} className="btn bg-gray-200">Cancel</button>
          <button type="submit" disabled={saving || items.length === 0} className="btn btn-primary">
            {saving ? 'Saving...' : isEdit ? 'Update Quote' : 'Create Quote'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuoteForm;
