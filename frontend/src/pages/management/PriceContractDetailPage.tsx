import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle, RefreshCw, Trash2, Pencil, Download, FileArchive } from 'lucide-react';
import toast from 'react-hot-toast';
import { priceContractApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { effectiveRole } from '@/lib/quoteConstants';

interface ContractItem {
  id: string;
  partId: string | null;
  partNumber: string | null;
  categoryId: string | null;
  seriesOrGroup: string | null;
  costPrice: number;
  suggestedSellPrice: number | null;
  discountPercent: number | null;
  moq: string | null;
  minQuantity: number;
  part?: { id: string; partNumber: string; series: string | null; description: string; basePrice: number | null } | null;
  category?: { id: string; name: string } | null;
}

interface Contract {
  id: string;
  name: string;
  description: string | null;
  quoteNumber: string | null;
  validFrom: string | null;
  validTo: string | null;
  items: ContractItem[];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function pctOff(listPrice: number, contractPrice: number): number | null {
  if (listPrice <= 0) return null;
  return Math.round((1 - contractPrice / listPrice) * 1000) / 10;
}

const PriceContractDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const role = user?.role ? effectiveRole(user.role) : null;
  const canRename = role === 'ADMIN' || role === 'RSM';

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, { partNumber: string; costPrice: string; moq?: string; suggestedSellPrice?: string }>>({});
  const [recheckingId, setRecheckingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [editingQuoteNumber, setEditingQuoteNumber] = useState(false);
  const [quoteNumberValue, setQuoteNumberValue] = useState('');
  const [savingQuoteNumber, setSavingQuoteNumber] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoqValue, setBulkMoqValue] = useState('');
  const [bulkMarginPercent, setBulkMarginPercent] = useState('');
  const [bulkSuggestedSell, setBulkSuggestedSell] = useState('');
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const productRows = contract?.items.filter((i) => i.partNumber || i.partId) ?? [];
  const allProductIds = productRows.map((i) => i.id);
  const isAllSelected = allProductIds.length > 0 && allProductIds.every((pid) => selectedIds.has(pid));
  const toggleSelectAll = () => {
    if (isAllSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allProductIds));
  };
  const refreshContract = useCallback(() => {
    if (!id) return;
    priceContractApi.getById(id).then((res) => setContract(res.data as Contract)).catch(() => toast.error('Failed to refresh'));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    priceContractApi
      .getById(id)
      .then((res) => {
        // #region agent log
        const c = res.data as Contract;
        const sample = (c.items || []).slice(0, 5).map(i => ({ id: i.id, partNumber: i.partNumber, partId: i.partId, seriesOrGroup: i.seriesOrGroup, moq: i.moq, isProductRow: !!(i.partNumber || i.partId) }));
        fetch('http://127.0.0.1:7242/ingest/3b168631-beca-4109-b9fb-808d8bac595c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9628a6'},body:JSON.stringify({sessionId:'9628a6',location:'PriceContractDetailPage.tsx:useEffect',message:'contract loaded',data:{contractId:c.id,itemCount:c.items?.length,quoteNumber:c.quoteNumber,validFrom:c.validFrom,validTo:c.validTo,sampleItems:sample,productRowCount:(c.items||[]).filter(i=>!!(i.partNumber||i.partId)).length},timestamp:Date.now(),hypothesisId:'A,B'})}).catch(()=>{});
        // #endregion
        setContract(c);
      })
      .catch(() => toast.error('Failed to load contract'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRecheck = async (item: ContractItem) => {
    if (!id) return;
    const partNumber = edits[item.id]?.partNumber ?? item.partNumber ?? item.part?.partNumber ?? '';
    const costPriceStr = edits[item.id]?.costPrice ?? String(item.costPrice);
    const costPrice = parseFloat(costPriceStr);
    if (!partNumber.trim()) {
      toast.error('Enter a part number to recheck');
      return;
    }
    if (isNaN(costPrice) || costPrice < 0) {
      toast.error('Enter a valid cost price');
      return;
    }
    setRecheckingId(item.id);
    try {
      const res = await priceContractApi.updateItem(id, item.id, { partNumber: partNumber.trim(), costPrice });
      const updated = res.data as ContractItem;
      setContract((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) => (i.id === item.id ? updated : i)),
            }
          : null
      );
      setEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      toast.success(updated.part ? 'Part found in catalog' : 'Part not found in catalog');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Recheck failed');
    } finally {
      setRecheckingId(null);
    }
  };

  const handleRemove = async (item: ContractItem) => {
    if (!id) return;
    if (!window.confirm('Remove this item from the pricing contract?')) return;
    setRemovingId(item.id);
    try {
      await priceContractApi.removeItem(id, item.id);
      setContract((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== item.id) } : null
      );
      toast.success('Item removed');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove item');
    } finally {
      setRemovingId(null);
    }
  };

  const startRename = () => {
    setRenameValue(contract?.name ?? '');
    setEditingName(true);
  };

  const cancelRename = () => {
    setEditingName(false);
    setRenameValue('');
  };

  const saveRename = async () => {
    if (!id || !contract) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    setSavingName(true);
    try {
      await priceContractApi.update(id, { name });
      setContract((prev) => (prev ? { ...prev, name } : null));
      setEditingName(false);
      setRenameValue('');
      toast.success('Contract renamed');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to rename');
    } finally {
      setSavingName(false);
    }
  };

  const startEditQuoteNumber = () => {
    setQuoteNumberValue(contract?.quoteNumber ?? '');
    setEditingQuoteNumber(true);
  };
  const saveQuoteNumber = async () => {
    if (!id || !contract) return;
    setSavingQuoteNumber(true);
    try {
      await priceContractApi.update(id, { quoteNumber: quoteNumberValue.trim() || undefined });
      setContract((prev) => (prev ? { ...prev, quoteNumber: quoteNumberValue.trim() || null } : null));
      setEditingQuoteNumber(false);
      setQuoteNumberValue('');
      toast.success('Quote number updated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update quote number');
    } finally {
      setSavingQuoteNumber(false);
    }
  };

  const handleBulkMoq = async () => {
    if (!id || selectedIds.size === 0 || !bulkMoqValue.trim()) {
      toast.error('Select at least one item and enter an MOQ');
      return;
    }
    setApplyingBulk(true);
    try {
      await priceContractApi.bulkMoq(id, { itemIds: Array.from(selectedIds), moq: bulkMoqValue.trim() });
      refreshContract();
      toast.success('MOQ applied');
      setBulkMoqValue('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to apply MOQ');
    } finally {
      setApplyingBulk(false);
    }
  };

  const handleBulkSellPrice = async () => {
    if (!id || selectedIds.size === 0) {
      toast.error('Select at least one item');
      return;
    }
    const margin = bulkMarginPercent.trim() ? parseFloat(bulkMarginPercent) : NaN;
    const fixed = bulkSuggestedSell.trim() ? parseFloat(bulkSuggestedSell) : NaN;
    if (Number.isNaN(margin) && Number.isNaN(fixed)) {
      toast.error('Enter margin % or suggested sell price');
      return;
    }
    setApplyingBulk(true);
    try {
      await priceContractApi.bulkSellPrice(id, {
        itemIds: Array.from(selectedIds),
        ...(Number.isNaN(margin) ? {} : { marginPercent: margin }),
        ...(Number.isNaN(fixed) ? {} : { suggestedSellPrice: fixed }),
      });
      refreshContract();
      toast.success('Suggested sell applied');
      setBulkMarginPercent('');
      setBulkSuggestedSell('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to apply');
    } finally {
      setApplyingBulk(false);
    }
  };

  const saveItemMoq = async (item: ContractItem, value: string) => {
    if (!id) return;
    setSavingItemId(item.id);
    try {
      const res = await priceContractApi.updateItem(id, item.id, { moq: value.trim() || undefined });
      setContract((prev) =>
        prev ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? (res.data as ContractItem) : i)) } : null
      );
      setEdits((prev) => {
        const next = { ...prev };
        if (next[item.id]) {
          delete next[item.id].moq;
          if (Object.keys(next[item.id]).length === 0) delete next[item.id];
        }
        return next;
      });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save MOQ');
    } finally {
      setSavingItemId(null);
    }
  };

  const saveItemSuggestedSell = async (item: ContractItem, value: string) => {
    if (!id) return;
    const num = value.trim() === '' ? null : parseFloat(value);
    if (value.trim() !== '' && Number.isNaN(num!)) return;
    setSavingItemId(item.id);
    try {
      const res = await priceContractApi.updateItem(id, item.id, { suggestedSellPrice: num ?? undefined });
      setContract((prev) =>
        prev ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? (res.data as ContractItem) : i)) } : null
      );
      setEdits((prev) => {
        const next = { ...prev };
        if (next[item.id]) {
          delete next[item.id].suggestedSellPrice;
          if (Object.keys(next[item.id]).length === 0) delete next[item.id];
        }
        return next;
      });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSavingItemId(null);
    }
  };

  const handleDownloadCsv = () => {
    if (!id) return;
    setDownloadingCsv(true);
    priceContractApi
      .downloadCsv(id)
      .then((res) => {
        const url = URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `price-contract-${contract?.name.replace(/\s+/g, '-') ?? id}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Download started');
      })
      .catch(() => toast.error('Download failed'))
      .finally(() => setDownloadingCsv(false));
  };

  const handleDownloadQuoteFamily = () => {
    if (!id) return;
    setDownloadingZip(true);
    priceContractApi
      .downloadQuoteFamily(id)
      .then((res) => {
        const url = URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `quote-family-${contract?.quoteNumber ?? id}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Download started');
      })
      .catch((e: any) => toast.error(e.response?.data?.error || 'Download failed'))
      .finally(() => setDownloadingZip(false));
  };

  if (loading || !contract) {
    return (
      <div className="p-6">
        {loading && <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />}
        {!loading && !contract && (
          <div className="text-center py-12 text-gray-600">
            <p>Contract not found.</p>
            <Link to="/pricing-contracts" className="text-green-600 hover:underline mt-2 inline-block">
              Back to Pricing Contracts
            </Link>
          </div>
        )}
      </div>
    );
  }

  const displayPartNumber = (item: ContractItem) => {
    if (!item.partId && !item.partNumber && item.seriesOrGroup) {
      const cat = item.category?.name ? ` (Category: ${item.category.name})` : '';
      const pct = item.discountPercent != null ? `${item.discountPercent}% off` : '';
      return `Series ${item.seriesOrGroup}${pct ? `: ${pct}` : ''}${cat}`;
    }
    return item.partNumber ?? (item.part ? item.part.partNumber : null) ?? item.seriesOrGroup ?? '—';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/pricing-contracts" className="text-green-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-5 h-5" /> Back to Pricing Contracts
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {editingName ? (
            <>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                placeholder="Contract name"
                className="input text-2xl font-bold max-w-md"
                autoFocus
              />
              <button onClick={saveRename} disabled={savingName} className="btn btn-primary">
                {savingName ? 'Saving…' : 'Save'}
              </button>
              <button onClick={cancelRename} disabled={savingName} className="btn bg-gray-200">
                Cancel
              </button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{contract.name}</h1>
              {canRename && (
                <button
                  type="button"
                  onClick={startRename}
                  className="text-green-600 hover:text-green-800 hover:underline flex items-center gap-1 text-sm font-normal"
                  title="Rename contract"
                >
                  <Pencil className="w-4 h-5" /> Rename
                </button>
              )}
            </>
          )}
        </div>
        {contract.description && <p className="text-gray-600 mt-1">{contract.description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-gray-500">Quote #:</span>{' '}
            {editingQuoteNumber ? (
              <span className="inline-flex items-center gap-2">
                <input
                  type="text"
                  value={quoteNumberValue}
                  onChange={(e) => setQuoteNumberValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveQuoteNumber()}
                  className="input py-1 w-32"
                  autoFocus
                />
                <button onClick={saveQuoteNumber} disabled={savingQuoteNumber} className="btn btn-primary text-xs py-1">
                  Save
                </button>
                <button onClick={() => { setEditingQuoteNumber(false); setQuoteNumberValue(''); }} className="btn bg-gray-200 text-xs py-1">
                  Cancel
                </button>
              </span>
            ) : (
              <>
                {contract.quoteNumber ? <span className="font-mono">{contract.quoteNumber}</span> : '—'}
                {canRename && (
                  <button type="button" onClick={startEditQuoteNumber} className="ml-1 text-green-600 hover:underline">
                    Edit
                  </button>
                )}
              </>
            )}
          </div>
          <div>
            <span className="text-gray-500">Date:</span>{' '}
            {contract.validFrom ? new Date(contract.validFrom).toLocaleDateString() : '—'}
          </div>
          <div>
            <span className="text-gray-500">Expires:</span>{' '}
            {contract.validTo ? (
              new Date(contract.validTo) < new Date() ? (
                <span className="text-red-600 font-medium">{new Date(contract.validTo).toLocaleDateString()} (expired)</span>
              ) : (
                new Date(contract.validTo).toLocaleDateString()
              )
            ) : (
              '—'
            )}
          </div>
          {canRename && (
            <div className="flex gap-2">
              <button onClick={handleDownloadCsv} disabled={downloadingCsv} className="btn bg-gray-100 text-sm py-1.5 flex items-center gap-1">
                <Download className="w-4 h-4" /> {downloadingCsv ? '…' : 'Download CSV'}
              </button>
              {contract.quoteNumber && (
                <button onClick={handleDownloadQuoteFamily} disabled={downloadingZip} className="btn bg-gray-100 text-sm py-1.5 flex items-center gap-1">
                  <FileArchive className="w-4 h-4" /> {downloadingZip ? '…' : 'Quote family ZIP'}
                </button>
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mt-3">
          <strong>Tip:</strong> Use the ☐ checkboxes (between MOQ and Suggested Sell) to select items, then enter a value in the column header and click <strong>Apply</strong> to set MOQ or Suggested Sell in bulk.
        </p>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Part Number / Series</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Cost (Contract)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">
                  <div className="flex flex-col gap-1">
                    <span>MOQ</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="e.g. 1"
                        value={bulkMoqValue}
                        onChange={(e) => setBulkMoqValue(e.target.value)}
                        className="input py-1 w-14 text-right text-xs"
                      />
                      <button onClick={handleBulkMoq} disabled={applyingBulk || selectedIds.size === 0} className="btn btn-primary text-xs py-0.5">
                        Apply
                      </button>
                    </div>
                  </div>
                </th>
                <th className="px-2 py-3 text-center font-medium text-gray-500 w-10" title="Select items to bulk-apply MOQ or Suggested Sell">
                  {productRows.length > 0 && (
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="rounded"
                      title="Select / deselect all"
                    />
                  )}
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">
                  <div className="flex flex-col gap-1">
                    <span>Suggested Sell</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      <input
                        type="text"
                        placeholder="Margin %"
                        value={bulkMarginPercent}
                        onChange={(e) => setBulkMarginPercent(e.target.value)}
                        className="input py-1 w-20 text-right text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Fixed Price"
                        value={bulkSuggestedSell}
                        onChange={(e) => setBulkSuggestedSell(e.target.value)}
                        className="input py-1 w-24 text-right text-xs"
                      />
                      <button onClick={handleBulkSellPrice} disabled={applyingBulk || selectedIds.size === 0} className="btn btn-primary text-xs py-0.5">
                        Apply
                      </button>
                    </div>
                  </div>
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">List Price</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">% Off List</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Discount %</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contract.items.map((item) => {
                const isSeriesDiscount = !item.partNumber && !item.partId && item.seriesOrGroup;
                const verified = !!item.partId;
                const listPrice = item.part?.basePrice ?? null;
                const pct = listPrice != null ? pctOff(listPrice, item.costPrice) : null;
                const partNumEdit = edits[item.id]?.partNumber ?? displayPartNumber(item);
                const costEdit = edits[item.id]?.costPrice ?? String(item.costPrice);
                const unverifiedProduct = !verified && !isSeriesDiscount;

                const isProductRow = !!(item.partNumber || item.partId);
                const moqDisplay = item.moq ?? String(item.minQuantity);
                const moqEdit = edits[item.id]?.moq ?? moqDisplay;
                const suggestedEdit = edits[item.id]?.suggestedSellPrice ?? (item.suggestedSellPrice != null ? item.suggestedSellPrice.toFixed(2) : '');

                return (
                  <tr
                    key={item.id}
                    className={unverifiedProduct ? 'bg-amber-50/80' : ''}
                  >
                    <td className="px-4 py-2">
                      {verified || isSeriesDiscount ? (
                        <span className="font-mono">{displayPartNumber(item)}</span>
                      ) : (
                        <input
                          type="text"
                          value={partNumEdit}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], partNumber: e.target.value, costPrice: costEdit },
                            }))
                          }
                          placeholder="Part number"
                          className="input py-1 w-40 font-mono text-sm"
                        />
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {verified ? (
                        formatCurrency(item.costPrice)
                      ) : isSeriesDiscount ? (
                        '—'
                      ) : (
                        <input
                          type="number"
                          step={0.01}
                          min={0}
                          value={costEdit}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [item.id]: { partNumber: partNumEdit, costPrice: e.target.value },
                            }))
                          }
                          className="input py-1 w-24 text-right"
                        />
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isProductRow ? (
                        savingItemId === item.id ? (
                          <span className="text-gray-400">Saving…</span>
                        ) : (
                          <input
                            type="text"
                            value={moqEdit}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: { ...prev[item.id], partNumber: partNumEdit, costPrice: costEdit, moq: e.target.value } }))}
                            onBlur={() => {
                              const v = edits[item.id]?.moq ?? moqDisplay;
                              if (v !== moqDisplay) saveItemMoq(item, v);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const v = edits[item.id]?.moq ?? moqDisplay;
                                if (v !== moqDisplay) saveItemMoq(item, v);
                              }
                            }}
                            className="input py-1 w-14 text-right text-xs"
                          />
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {isProductRow ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }}
                          className="rounded"
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isProductRow ? (
                        savingItemId === item.id ? (
                          <span className="text-gray-400">Saving…</span>
                        ) : (
                          <input
                            type="text"
                            value={suggestedEdit}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [item.id]: { ...prev[item.id], partNumber: partNumEdit, costPrice: costEdit, suggestedSellPrice: e.target.value } }))}
                            onBlur={() => {
                              const v = edits[item.id]?.suggestedSellPrice ?? (item.suggestedSellPrice != null ? item.suggestedSellPrice.toFixed(2) : '');
                              const prevStr = item.suggestedSellPrice != null ? item.suggestedSellPrice.toFixed(2) : '';
                              if (v !== prevStr) saveItemSuggestedSell(item, v);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const v = edits[item.id]?.suggestedSellPrice ?? (item.suggestedSellPrice != null ? item.suggestedSellPrice.toFixed(2) : '');
                                const prevStr = item.suggestedSellPrice != null ? item.suggestedSellPrice.toFixed(2) : '';
                                if (v !== prevStr) saveItemSuggestedSell(item, v);
                              }
                            }}
                            placeholder="—"
                            className="input py-1 w-24 text-right text-xs"
                          />
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {listPrice != null ? formatCurrency(listPrice) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {pct != null ? <span className="font-medium text-green-700">{pct}%</span> : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {item.discountPercent != null ? <span className="font-medium">{item.discountPercent}%</span> : '—'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {verified ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <CheckCircle className="w-4 h-4" /> In catalog
                        </span>
                      ) : isSeriesDiscount ? (
                        <span className="text-gray-500">Series discount</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="w-4 h-4" /> Not in catalog
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {unverifiedProduct && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRecheck(item)}
                            disabled={recheckingId === item.id}
                            className="btn btn-primary text-sm py-1 flex items-center gap-1"
                          >
                            <RefreshCw className={`w-4 h-4 ${recheckingId === item.id ? 'animate-spin' : ''}`} />
                            {recheckingId === item.id ? 'Checking…' : 'Recheck'}
                          </button>
                          <button
                            onClick={() => handleRemove(item)}
                            disabled={removingId === item.id}
                            className="btn bg-red-100 text-red-700 hover:bg-red-200 text-sm py-1 flex items-center gap-1"
                            title="Remove from contract"
                          >
                            <Trash2 className="w-4 h-4" />
                            {removingId === item.id ? 'Removing…' : 'Remove'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {contract.items.length === 0 && (
          <div className="p-8 text-center text-gray-500">No items. Upload a PDF to add items.</div>
        )}
      </div>
    </div>
  );
};

export default PriceContractDetailPage;
