import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Search, UserPlus, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { quoteApi, catalogApi, customerApi, partApi, assignmentsApi, priceContractApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { effectiveRole } from '@/lib/quoteConstants';

interface LineItem {
  partId: string;
  productSeries: string;
  productPartNumber: string;
  /** List price from MASTER catalog (display only) */
  productPrice: number;
  productDescription: string;
  minQty: number | null;
  distributorDiscount: number;
  quantity: number;
  discountPct: number;
  marginPct: number;
  marginSelected?: boolean;
  discountSelected?: boolean;
  /** Cost affected by SPA/discount – show bold + * */
  isCostAffected?: boolean;
  /** Sell price from pricing contract – show bold + † (green) */
  isSellAffected?: boolean;
  /** When true, discount % is from price contract and cannot be edited */
  discountLocked?: boolean;
  /** When set, cost is from price contract; sell = costPrice * (1 + margin%/100) */
  costPrice?: number;
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
  const [masterCatalogId, setMasterCatalogId] = useState<string | null>(null);
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
  const [quickAddSuggestions, setQuickAddSuggestions] = useState<Part[]>([]);
  const [showQuickAddSuggestions, setShowQuickAddSuggestions] = useState(false);
  const [quickAddHighlightIndex, setQuickAddHighlightIndex] = useState(-1);
  const quickAddInputRef = useRef<HTMLInputElement>(null);
  const quickAddSuggestionsRef = useRef<HTMLDivElement>(null);

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

  const allMarginSelected = items.length > 0 && items.every((i) => i.marginSelected);
  const allDiscountSelected = items.length > 0 && items.every((i) => i.discountSelected);
  const someMarginSelected = items.some((i) => i.marginSelected);
  const someDiscountSelected = items.some((i) => i.discountSelected);
  const isDistributorOrHigher = ['ADMIN', 'RSM', 'DISTRIBUTOR', 'DISTRIBUTOR_REP'].includes(effectiveRole(user?.role || ''));

  // Load assigned catalogs and price contracts (for proposal wizard); fallback to all catalogs if no assignments
  useEffect(() => {
    assignmentsApi.getMyAssignments()
      .then((res) => {
        const data = res.data as { catalogs?: { id: string; name: string; isPrimary?: boolean; isMaster?: boolean }[]; primaryCatalogId?: string | null; priceContracts?: { id: string; name: string }[] };
        const assignedCatalogs = data.catalogs || [];
        const assignedContracts = data.priceContracts || [];
        setPriceContracts(assignedContracts);
        setCatalogs(assignedCatalogs.map((c) => ({ id: c.id, name: c.name || 'Unnamed' })));
        const master = assignedCatalogs.find((c) => c.isMaster);
        if (master) setMasterCatalogId(master.id);
        const primary = data.primaryCatalogId ?? assignedCatalogs.find((c) => c.isPrimary)?.id ?? assignedCatalogs[0]?.id;
        if (primary && !catalogId) setCatalogId(primary);
      })
      .catch(() => {
        // On error, show only MASTER catalog so we never expose all catalogs to unassigned users
        catalogApi.getAll().then((res) => {
          const list = Array.isArray(res.data) ? res.data : [];
          const masterOnly = list.filter((c: any) => c.isMaster);
          const useList = masterOnly.length > 0 ? masterOnly : list;
          setCatalogs(useList.map((c: any) => ({ id: c.id, name: c.name || 'Unnamed' })));
          const master = useList.find((c: any) => c.isMaster);
          if (master) setMasterCatalogId(master.id);
          if (useList.length > 0 && !catalogId) setCatalogId(useList[0].id);
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
          isCostAffected: Boolean(i.isCostAffected),
          isSellAffected: Boolean(i.isSellAffected),
          discountLocked: Boolean(q.priceContractId && (i.isCostAffected || i.isSellAffected)),
          costPrice: i.costPrice,
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

  // Autocomplete for quick-add part number: debounced search as user types
  useEffect(() => {
    if (!catalogId || !quickAddPartNumber.trim()) {
      setQuickAddSuggestions([]);
      setShowQuickAddSuggestions(false);
      setQuickAddHighlightIndex(-1);
      return;
    }
    const t = setTimeout(() => {
      partApi.getByCatalog(catalogId, { search: quickAddPartNumber.trim(), limit: 10 }).then((res) => {
        const data = res.data as { parts?: Part[] };
        const list = data?.parts || [];
        setQuickAddSuggestions(list);
        setShowQuickAddSuggestions(list.length > 0);
        setQuickAddHighlightIndex(-1);
      }).catch(() => {
        setQuickAddSuggestions([]);
        setShowQuickAddSuggestions(false);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [catalogId, quickAddPartNumber]);

  const calculateSellPrice = (item: LineItem) => {
    const cost = item.costPrice != null ? item.costPrice : item.productPrice * (1 - item.discountPct / 100);
    return cost * (1 + (item.marginPct || 0) / 100);
  };
  const calculateLineTotal = (item: LineItem) => item.quantity * calculateSellPrice(item);
  const calculateTotal = () => items.reduce((sum, i) => sum + calculateLineTotal(i), 0);

  /** Find contract item for a part: by partId or by seriesOrGroup matching part.series/partNumber */
  /** Margin % so that sell price = list price when the given discount % is applied (cost = list * (1 - disc/100), sell = cost * (1 + margin/100) = list). */
  const marginToKeepSellEqualToList = (discountPct: number): number => {
    if (discountPct <= 0) return 0;
    const factor = 1 - discountPct / 100;
    if (factor <= 0) return 0;
    return 100 * (1 / factor - 1);
  };

  /** Match contract item only by exact partId or exact part number (no broad series substring match). */
  const findContractItem = (part: Part): PriceContractItemRow | null => {
    if (!contractDetails?.items?.length) return null;
    const byPart = contractDetails.items.find((i) => i.partId === part.id);
    if (byPart) return byPart;
    const byPartNumber = contractDetails.items.find(
      (i) => i.seriesOrGroup && (part.partNumber || '').toUpperCase() === (i.seriesOrGroup as string).toUpperCase()
    );
    return byPartNumber ?? null;
  };

  /** Resolve list price and min qty from MASTER catalog (by part number); falls back to part when master not found or same catalog */
  const resolveMasterListAndMinQty = async (part: Part): Promise<{ listPrice: number; minQty: number }> => {
    if (!masterCatalogId || catalogId === masterCatalogId) {
      return { listPrice: part.basePrice ?? 0, minQty: part.minQty ?? 1 };
    }
    try {
      const res = await partApi.getByNumber(part.partNumber, masterCatalogId);
      const masterPart = res.data as Part;
      return {
        listPrice: masterPart.basePrice ?? part.basePrice ?? 0,
        minQty: masterPart.minQty ?? part.minQty ?? 1,
      };
    } catch {
      return { listPrice: part.basePrice ?? 0, minQty: part.minQty ?? 1 };
    }
  };

  /** Build a line item from a part (async: resolves MASTER list/min qty, applies contract pricing when applicable) */
  const buildLineItemFromPart = async (part: Part, quantityOverride?: number): Promise<LineItem> => {
    const { listPrice, minQty: masterMinQty } = await resolveMasterListAndMinQty(part);
    const defaultQty = Math.max(quantityOverride ?? Math.max(1, masterMinQty), masterMinQty);
    const contractItem = findContractItem(part);
    const contractApplies = Boolean(priceContractId && contractItem && defaultQty >= contractItem.minQuantity);

    let defaultDisc = 0;
    let marginPct = 0;
    let costPrice: number | undefined;
    let discountLocked = false;

    if (contractApplies) {
      costPrice = contractItem.costPrice;
      defaultDisc = contractItem.discountPercent ?? (listPrice > 0 ? (1 - costPrice / listPrice) * 100 : 0);
      discountLocked = true;
      if (contractItem.suggestedSellPrice != null && costPrice > 0) {
        marginPct = (contractItem.suggestedSellPrice / costPrice - 1) * 100;
      }
    } else {
      defaultDisc = part.distributorDiscount ?? 0;
      marginPct = marginToKeepSellEqualToList(defaultDisc);
    }

    const usedContractPricing = Boolean(contractApplies && contractItem?.suggestedSellPrice != null);
    const costAffected = defaultDisc > 0;
    return {
      partId: part.id,
      productSeries: part.series || part.partNumber,
      productPartNumber: part.partNumber,
      productPrice: listPrice,
      productDescription: part.englishDescription || part.description || '',
      minQty: masterMinQty,
      distributorDiscount: defaultDisc,
      quantity: defaultQty,
      discountPct: defaultDisc,
      marginPct,
      marginSelected: false,
      discountSelected: false,
      isCostAffected: costAffected,
      isSellAffected: usedContractPricing,
      discountLocked,
      costPrice,
    };
  };

  const addProduct = async (part: Part, quantityOverride?: number) => {
    const { listPrice, minQty: masterMinQty } = await resolveMasterListAndMinQty(part);
    const defaultQty = quantityOverride ?? Math.max(1, masterMinQty);
    const contractItem = findContractItem(part);
    const contractApplies = Boolean(priceContractId && contractItem && defaultQty >= contractItem.minQuantity);

    let defaultDisc = 0;
    let marginPct = 0;
    let costPrice: number | undefined;
    let discountLocked = false;

    if (contractApplies) {
      costPrice = contractItem.costPrice;
      defaultDisc = contractItem.discountPercent ?? (listPrice > 0 ? (1 - costPrice / listPrice) * 100 : 0);
      discountLocked = true;
      if (contractItem.suggestedSellPrice != null && costPrice > 0) {
        marginPct = (contractItem.suggestedSellPrice / costPrice - 1) * 100;
      }
    } else {
      defaultDisc = part.distributorDiscount ?? 0;
      marginPct = marginToKeepSellEqualToList(defaultDisc);
    }

    const existing = items.find((i) => i.partId === part.id);
    if (existing) {
      const addQty = quantityOverride ?? Math.max(1, masterMinQty);
      setItems(items.map((i) =>
        i.partId === part.id ? { ...i, quantity: i.quantity + addQty } : i
      ));
    } else {
      const usedContractPricing = Boolean(contractApplies && contractItem?.suggestedSellPrice != null);
      const costAffected = defaultDisc > 0;
      setItems([
        ...items,
        {
          partId: part.id,
          productSeries: part.series || part.partNumber,
          productPartNumber: part.partNumber,
          productPrice: listPrice,
          productDescription: part.englishDescription || part.description || '',
          minQty: masterMinQty,
          distributorDiscount: defaultDisc,
          quantity: defaultQty,
          discountPct: defaultDisc,
          marginPct,
          marginSelected: false,
          discountSelected: false,
          isCostAffected: costAffected,
          isSellAffected: usedContractPricing,
          discountLocked,
          costPrice,
        },
      ]);
    }
    setShowProductPicker(false);
    setProductSearch('');
  };

  const parseBulkInput = (text: string): string[] => {
    return text.split(/[,\n\r\t]+/).map((s) => s.trim()).filter(Boolean);
  };

  /** Select a part from autocomplete and add to quote */
  const selectQuickAddSuggestion = (part: Part) => {
    addProduct(part);
    setQuickAddPartNumber('');
    setQuickAddSuggestions([]);
    setShowQuickAddSuggestions(false);
    setQuickAddHighlightIndex(-1);
    toast.success(`Added ${part.partNumber}`);
  };

  /** Quick-add single part by part number (Enter or Add) */
  const handleQuickAddPart = async () => {
    if (showQuickAddSuggestions && quickAddSuggestions.length > 0 && quickAddHighlightIndex >= 0 && quickAddSuggestions[quickAddHighlightIndex]) {
      selectQuickAddSuggestion(quickAddSuggestions[quickAddHighlightIndex]);
      return;
    }
    if (showQuickAddSuggestions && quickAddSuggestions.length > 0 && quickAddHighlightIndex < 0) {
      selectQuickAddSuggestion(quickAddSuggestions[0]);
      return;
    }
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
        setQuickAddSuggestions([]);
        setShowQuickAddSuggestions(false);
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

  const handleBulkImport = async () => {
    const parts = parseBulkInput(bulkInput);
    if (parts.length === 0 || !catalogId) {
      toast.error('Enter part numbers and select a catalog');
      return;
    }
    if (bulkImporting) return;
    setBulkImporting(true);
    try {
      const res = await partApi.lookupBulk(catalogId, parts);
      const data = res.data as { found: Part[]; notFound: string[] };
      const partCounts = new Map<string, number>();
      parts.forEach((p) => partCounts.set(p.toUpperCase(), (partCounts.get(p.toUpperCase()) || 0) + 1));

      const newLines = await Promise.all(
        data.found.map((part) => {
          const count = partCounts.get(part.partNumber.toUpperCase()) || 1;
          return buildLineItemFromPart(part, count);
        })
      );

      setItems((prev) => {
        const next = [...prev];
        for (const line of newLines) {
          const idx = next.findIndex((i) => i.partId === line.partId);
          if (idx >= 0) {
            next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity };
          } else {
            next.push(line);
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
    } catch {
      toast.error('Bulk lookup failed');
    } finally {
      setBulkImporting(false);
    }
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

  /** CSV rows: part number in col 0, optional quantity in col 1. Uses CSV quantity when provided, else MASTER min qty. */
  const readCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const text = (reader.result as string) || '';
      const lines = text.split(/\r?\n/);
      const rows: { partNumber: string; quantity?: number }[] = [];
      for (const line of lines) {
        const cells = line.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
        const partNumber = cells[0];
        if (!partNumber) continue;
        const qty = cells[1] != null && cells[1] !== '' ? parseInt(cells[1], 10) : undefined;
        rows.push({ partNumber, quantity: qty && !isNaN(qty) && qty >= 1 ? qty : undefined });
      }
      if (rows.length === 0 || !catalogId) {
        if (!catalogId) toast.error('Select a catalog first');
        return;
      }
      setBulkImporting(true);
      try {
        const partNumbers = rows.map((r) => r.partNumber);
        const res = await partApi.lookupBulk(catalogId, partNumbers);
        const data = res.data as { found: Part[]; notFound: string[] };
        const partByNumber = new Map<string, Part>();
        (data.found || []).forEach((p) => partByNumber.set(p.partNumber.toUpperCase(), p));

        const newLines: LineItem[] = [];
        for (const row of rows) {
          const part = partByNumber.get(row.partNumber.toUpperCase());
          if (!part) continue;
          const line = await buildLineItemFromPart(part, row.quantity);
          newLines.push(line);
        }

        setItems((prev) => {
          let next = [...prev];
          for (const line of newLines) {
            const idx = next.findIndex((i) => i.partId === line.partId);
            if (idx >= 0) {
              next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity };
            } else {
              next.push(line);
            }
          }
          return next;
        });
        toast.success(`Added ${newLines.length} products from CSV`);
        if ((data.notFound || []).length > 0) setNotFoundParts(data.notFound || []);
      } catch {
        toast.error('CSV lookup failed');
      } finally {
        setBulkImporting(false);
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
    setItems(items.map((i, idx) => {
      if (idx !== index) return i;
      const next = { ...i, ...updates };
      if ('discountPct' in updates && updates.discountPct != null) next.isCostAffected = updates.discountPct > 0;
      return next;
    }));
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
    setItems(items.map((i) => (i.discountSelected && !i.discountLocked ? { ...i, discountPct: value, isCostAffected: value > 0 } : i)));
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
    // Role-based discount limit removed per product requirement; no validation here.
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
        isCostAffected: i.isCostAffected,
        isSellAffected: i.isSellAffected,
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
    <div className="p-6 max-w-7xl mx-auto">
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

          {/* Quick-add: type part number with autocomplete, Enter or Add */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1" ref={quickAddSuggestionsRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
              <input
                ref={quickAddInputRef}
                type="text"
                value={quickAddPartNumber}
                onChange={(e) => setQuickAddPartNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (showQuickAddSuggestions && quickAddSuggestions.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setQuickAddHighlightIndex((i) => (i < quickAddSuggestions.length - 1 ? i + 1 : i));
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setQuickAddHighlightIndex((i) => (i > 0 ? i - 1 : -1));
                      return;
                    }
                    if (e.key === 'Escape') {
                      setShowQuickAddSuggestions(false);
                      setQuickAddHighlightIndex(-1);
                      return;
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickAddPart();
                      return;
                    }
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAddPart();
                  }
                }}
                onFocus={() => quickAddPartNumber.trim() && quickAddSuggestions.length > 0 && setShowQuickAddSuggestions(true)}
                onBlur={() => setTimeout(() => setShowQuickAddSuggestions(false), 150)}
                placeholder="Type part number (suggestions as you type) or press Enter to add"
                className="input w-full pl-10"
                disabled={!catalogId || quickAddLoading}
              />
              {showQuickAddSuggestions && quickAddSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                  {quickAddSuggestions.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectQuickAddSuggestion(p); }}
                      className={`w-full text-left px-3 py-2 flex justify-between gap-2 ${i === quickAddHighlightIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <span className="font-medium">{p.partNumber}</span>
                      <span className="text-gray-500 truncate">{(p.englishDescription || p.description || '').slice(0, 40)}</span>
                    </button>
                  ))}
                </div>
              )}
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

          {/* Items Table - spacious layout for PC browser */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left min-w-[200px]">Product</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">List Price</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Min Qty</th>
                  {isDistributorOrHigher && (
                    <th className="px-5 py-3 min-w-[140px]">
                      <div className="flex items-center gap-3 justify-end">
                        <input type="checkbox" checked={allDiscountSelected} ref={discountSelectAllRef} onChange={toggleDiscountSelectAll} className="rounded border-gray-300 shrink-0" title="Select all" />
                        <input type="number" min={0} max={100} step={0.5} value={bulkDiscountValue} onChange={(e) => { const v = e.target.value; setBulkDiscountValue(v); const n = parseFloat(v); if (!isNaN(n)) applyBulkDiscount(n); }} placeholder="Apply %" className="input py-2 w-24 text-right text-base" title="Apply to selected" />
                      </div>
                      <div className="text-xs font-normal text-gray-500 mt-1">Disc %</div>
                    </th>
                  )}
                  {isDistributorOrHigher && (
                    <th className="px-5 py-3 min-w-[140px]">
                      <div className="flex items-center gap-3 justify-end">
                        <input type="checkbox" checked={allMarginSelected} ref={marginSelectAllRef} onChange={toggleMarginSelectAll} className="rounded border-gray-300 shrink-0" title="Select all" />
                        <input type="number" min={0} step={0.5} value={bulkMarginValue} onChange={(e) => { const v = e.target.value; setBulkMarginValue(v); const n = parseFloat(v); if (!isNaN(n)) applyBulkMargin(n); }} placeholder="Apply %" className="input py-2 w-24 text-right text-base" title="Apply to selected" />
                      </div>
                      <div className="text-xs font-normal text-gray-500 mt-1">Margin %</div>
                    </th>
                  )}
                  <th className="px-4 py-3 text-right whitespace-nowrap">Sell</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Qty</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                  <th className="w-12 px-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className={`border-t ${(item.marginSelected || item.discountSelected) ? 'bg-green-50/50' : ''} ${item.isSellAffected ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-4 py-3 min-w-[200px]">
                      <div className={`font-medium ${(item.isCostAffected || item.isSellAffected) ? 'font-bold' : ''} ${item.isSellAffected ? 'text-emerald-800' : ''}`}>
                        {item.productPartNumber}
                        {item.isCostAffected && <span className="text-gray-600 ml-0.5">*</span>}
                        {item.isSellAffected && <span className="text-emerald-700 ml-0.5">†</span>}
                      </div>
                      <div className="text-gray-500 truncate max-w-xs">{item.productDescription.slice(0, 40)}...</div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(item.productPrice)}</td>
                    <td className="px-4 py-3 text-center">{item.minQty ?? '—'}</td>
                    {isDistributorOrHigher && (
                      <td className="px-5 py-3 min-w-[140px]">
                        <div className="flex items-center gap-3 justify-end">
                          <input type="checkbox" checked={!!item.discountSelected} onChange={() => toggleDiscountSelected(idx)} disabled={!!item.discountLocked} className="rounded border-gray-300 shrink-0" title={item.discountLocked ? 'Locked by price contract' : undefined} />
                          <input type="number" min={0} max={100} step={0.5} value={item.discountPct} onChange={(e) => updateItem(idx, { discountPct: parseFloat(e.target.value) || 0 })} className="input py-2 w-24 text-right text-base tabular-nums" disabled={!!item.discountLocked} title={item.discountLocked ? 'Locked by price contract' : undefined} readOnly={!!item.discountLocked} />
                        </div>
                      </td>
                    )}
                    {isDistributorOrHigher && (
                      <td className="px-5 py-3 min-w-[140px]">
                        <div className="flex items-center gap-3 justify-end">
                          <input type="checkbox" checked={!!item.marginSelected} onChange={() => toggleMarginSelected(idx)} className="rounded border-gray-300 shrink-0" />
                          <input type="number" min={0} step={0.5} value={item.marginPct} onChange={(e) => updateItem(idx, { marginPct: parseFloat(e.target.value) || 0 })} className="input py-2 w-24 text-right text-base tabular-nums" />
                        </div>
                      </td>
                    )}
                    <td className={`px-4 py-3 text-right whitespace-nowrap ${item.isSellAffected ? 'font-bold text-emerald-800' : 'font-medium'}`}>{formatCurrency(calculateSellPrice(item))}</td>
                    <td className="px-4 py-3">
                      <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value, 10) || 1 })} className="input py-2 min-w-[5rem] w-28 text-center" placeholder="Qty" />
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCurrency(calculateLineTotal(item))}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-5 h-5" /></button>
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

          {(items.some((i) => i.isCostAffected) || items.some((i) => i.isSellAffected)) && (
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-medium text-gray-600">*</span> Cost affected by SPA/discount &nbsp;
              <span className="font-medium text-emerald-700">†</span> Sell price from pricing contract
            </p>
          )}
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
