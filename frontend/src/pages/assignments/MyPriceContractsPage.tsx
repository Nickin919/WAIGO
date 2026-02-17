import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { priceContractApi } from '@/lib/api';

interface ContractItem {
  id: string;
  partId: string | null;
  partNumber: string | null;
  seriesOrGroup: string | null;
  costPrice: number;
  suggestedSellPrice: number | null;
  discountPercent: number | null;
  minQuantity: number;
  part?: { partNumber: string; series: string | null; description: string; basePrice: number | null } | null;
}

interface Contract {
  id: string;
  name: string;
  description: string | null;
  validFrom: string | null;
  validTo: string | null;
  items: ContractItem[];
}

const MyPriceContractsPage = () => {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const [contractDetails, setContractDetails] = useState<Record<string, Contract>>({});

  useEffect(() => {
    priceContractApi.list().then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      setContracts(list.map((c: any) => ({ ...c, items: c.items || [] })));
      if (list.length > 0 && !expandedId) setExpandedId(list[0].id);
    }).catch(() => {
      toast.error('Failed to load price contracts');
      setContracts([]);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (expandedId && !contractDetails[expandedId]) {
      priceContractApi.getById(expandedId).then((res) => {
        const c = res.data as Contract;
        setContractDetails((prev) => ({ ...prev, [expandedId]: c }));
        setContracts((prev) => prev.map((x) => (x.id === expandedId ? { ...x, items: c.items || [] } : x)));
      }).catch(() => toast.error('Failed to load contract details'));
    }
  }, [expandedId]);

  const handleSaveContract = (contractId: string) => {
    const contract = contractDetails[contractId] || contracts.find((c) => c.id === contractId);
    if (!contract?.items?.length) return;
    const items = contract.items.map((item) => ({
      id: item.id,
      suggestedSellPrice: edits[item.id] !== undefined ? edits[item.id] : item.suggestedSellPrice,
    }));
    setSaving(contractId);
    priceContractApi.updateMyContractItems(contractId, items).then((res) => {
      const updated = res.data as Contract;
      setContractDetails((prev) => ({ ...prev, [contractId]: updated }));
      setContracts((prev) => prev.map((c) => (c.id === contractId ? { ...c, items: updated.items || [] } : c)));
      setEdits((prev) => {
        const next = { ...prev };
        contract.items.forEach((i) => delete next[i.id]);
        return next;
      });
      toast.success('Saved');
    }).catch((err: any) => toast.error(err.response?.data?.error || 'Failed to save')).finally(() => setSaving(null));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-green-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <h1 className="text-2xl font-bold">My Price Contracts</h1>
      </div>

      {contracts.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-600">
          <p>You have no price contracts assigned.</p>
          <p className="text-sm mt-2">Contact your distributor or RSM to get pricing contracts assigned.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => {
            const detail = contractDetails[contract.id] || contract;
            const items = detail.items || [];
            return (
            <div key={contract.id} className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedId((id) => (id === contract.id ? null : contract.id))}
                className="w-full flex items-center gap-2 px-4 py-3 text-left font-medium hover:bg-gray-50"
              >
                {expandedId === contract.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                {contract.name}
                {contract.description && <span className="text-sm font-normal text-gray-500"> – {contract.description}</span>}
              </button>
              {expandedId === contract.id && (
                <div className="border-t px-4 py-4">
                  <p className="text-sm text-gray-600 mb-4">You can edit only the Suggested Sell Price column. Other fields are set by your administrator.</p>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Product / Series</th>
                        <th className="px-4 py-2 text-right">Cost Price</th>
                        <th className="px-4 py-2 text-right">List Price</th>
                        <th className="px-4 py-2 text-right">% Off List</th>
                        <th className="px-4 py-2 text-right">Discount %</th>
                        <th className="px-4 py-2 text-center">Min Qty</th>
                        <th className="px-4 py-2 text-right">Suggested Sell Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const listPrice = item.part?.basePrice ?? null;
                        const pctOff = listPrice != null && listPrice > 0 ? Math.round((1 - item.costPrice / listPrice) * 1000) / 10 : null;
                        return (
                        <tr key={item.id} className="border-t">
                          <td className="px-4 py-2">
                            {item.partNumber ?? (item.part ? `${item.part.partNumber} ${item.part.series ? `(${item.part.series})` : ''}` : null) ?? item.seriesOrGroup ?? '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600">{formatCurrency(item.costPrice)}</td>
                          <td className="px-4 py-2 text-right text-gray-600">{listPrice != null ? formatCurrency(listPrice) : '—'}</td>
                          <td className="px-4 py-2 text-right text-gray-600">{pctOff != null ? <span className="text-green-700 font-medium">{pctOff}%</span> : '—'}</td>
                          <td className="px-4 py-2 text-right text-gray-600">{item.discountPercent != null ? `${item.discountPercent}%` : '—'}</td>
                          <td className="px-4 py-2 text-center text-gray-600">{item.minQuantity}</td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step={0.01}
                              min={0}
                              value={edits[item.id] !== undefined ? edits[item.id] ?? '' : item.suggestedSellPrice ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEdits((prev) => ({ ...prev, [item.id]: v === '' ? null : parseFloat(v) || 0 }));
                              }}
                              className="input py-1 w-24 text-right"
                            />
                          </td>
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => handleSaveContract(contract.id)}
                      disabled={saving === contract.id}
                      className="btn btn-primary"
                    >
                      {saving === contract.id ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default MyPriceContractsPage;
