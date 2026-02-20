import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertTriangle, RefreshCw, Trash2, Pencil } from 'lucide-react';
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
  minQuantity: number;
  part?: { id: string; partNumber: string; series: string | null; description: string; basePrice: number | null } | null;
  category?: { id: string; name: string } | null;
}

interface Contract {
  id: string;
  name: string;
  description: string | null;
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
  const [edits, setEdits] = useState<Record<string, { partNumber: string; costPrice: string }>>({});
  const [recheckingId, setRecheckingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!id) return;
    priceContractApi
      .getById(id)
      .then((res) => setContract(res.data as Contract))
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
        <p className="text-sm text-gray-500 mt-2">
          Verify each item against the master catalog. Items not found can be edited and rechecked.
        </p>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Part Number / Series</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Cost (Contract)</th>
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
