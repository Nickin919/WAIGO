import { useState } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { publicApi } from '@/lib/api';

const ProductFinder = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{
    id: string;
    partNumber: string;
    description: string;
    category: string;
    catalogName: string;
    thumbnailUrl?: string;
  }>>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      toast.error('Enter at least 2 characters to search');
      return;
    }
    setLoading(true);
    try {
      const { data } = await publicApi.searchParts(q, { limit: 50 });
      const res = data as { results?: typeof results; total?: number };
      setResults(res.results || []);
      if ((res.results?.length ?? 0) === 0) {
        toast('No products found', { icon: 'ℹ️' });
      }
    } catch (error) {
      toast.error('Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Product Finder</h1>
      <p className="text-gray-600 mb-6">
        Search for products in public catalogs. Sign in to access full catalogs and save quotes.
      </p>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by part number or description..."
              className="input w-full pl-10"
              minLength={2}
            />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {results.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Part Number</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Catalog</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.partNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{r.description}</td>
                    <td className="px-4 py-3 text-gray-600">{r.category}</td>
                    <td className="px-4 py-3 text-gray-600">{r.catalogName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductFinder;
