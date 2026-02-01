import { useState } from 'react';
import { Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { publicApi } from '@/lib/api';

interface CrossRefResult {
  original: { manufacturer: string; partNumber: string };
  wagoEquivalent: {
    partNumber: string;
    description: string;
    compatibilityScore: number;
    notes?: string;
    minQty?: number;
    packageQty?: number;
  } | null;
}

const BomCrossReference = () => {
  const [manufacturer, setManufacturer] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    found: boolean;
    original?: { manufacturer: string; partNumber: string };
    wagoEquivalents?: Array<{
      partNumber: string;
      description: string;
      category: string;
      compatibilityScore: number;
      notes?: string;
      thumbnailUrl?: string;
    }>;
    message?: string;
  } | null>(null);

  const handleSingleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = manufacturer.trim();
    const p = partNumber.trim();
    if (!m || !p) {
      toast.error('Enter manufacturer and part number');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data } = await publicApi.crossReference(m, p);
      const res = data as typeof result;
      setResult(res);
      if (res?.found && (res.wagoEquivalents?.length ?? 0) > 0) {
        toast.success('Match found');
      } else if (res?.found === false) {
        toast('No WAGO equivalent found', { icon: 'ℹ️' });
      }
    } catch (error) {
      toast.error('Lookup failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">BOM Cross-Reference</h1>
      <p className="text-gray-600 mb-6">
        Find WAGO equivalents for competitor parts. Enter manufacturer and part number. Sign in for bulk BOM upload.
      </p>

      <form onSubmit={handleSingleLookup} className="card p-6 mb-8">
        <h2 className="font-semibold text-gray-900 mb-4">Single Part Lookup</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
            <input
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="e.g. Phoenix Contact"
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Part Number</label>
            <input
              type="text"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="e.g. 2703125"
              className="input w-full"
              required
            />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          {loading ? 'Looking up...' : 'Find WAGO Equivalent'}
        </button>
      </form>

      {result && (
        <div className="card p-6">
          {result.found && result.wagoEquivalents && result.wagoEquivalents.length > 0 ? (
            <>
              <h3 className="font-semibold text-gray-900 mb-2">
                WAGO equivalents for {result.original?.manufacturer} {result.original?.partNumber}
              </h3>
              <div className="space-y-4">
                {result.wagoEquivalents.map((w, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                    <div className="font-medium text-green-700">{w.partNumber}</div>
                    <div className="text-sm text-gray-600">{w.description}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Category: {w.category} • Match: {Math.round((w.compatibilityScore || 0) * 100)}%
                    </div>
                    {w.notes && <div className="text-sm text-gray-600 mt-1">{w.notes}</div>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-600">{result.message || 'No WAGO equivalent found for this part.'}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default BomCrossReference;
