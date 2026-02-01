import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import axios from 'axios';

interface PriceChange {
  id: string;
  oldPrice: number;
  newPrice: number;
  changedAt: string;
  importBatch: string | null;
  changedBy: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

const PriceHistory = () => {
  const { partNumber } = useParams<{ partNumber: string }>();
  const [history, setHistory] = useState<PriceChange[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      if (!partNumber) return;

      try {
        // TODO: Get catalogId from context or query
        const catalogId = 'demo-catalog';
        const { data } = await axios.get(
          `/api/admin/products/${partNumber}/price-history?catalogId=${catalogId}`
        );
        setHistory(data.history);
        setCurrentPrice(data.currentPrice);
      } catch (error) {
        console.error('Failed to load price history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [partNumber]);

  const getPriceChangeIcon = (oldPrice: number, newPrice: number) => {
    if (newPrice > oldPrice) return <TrendingUp className="w-5 h-5 text-red-600" />;
    if (newPrice < oldPrice) return <TrendingDown className="w-5 h-5 text-green-600" />;
    return <Minus className="w-5 h-5 text-gray-400" />;
  };

  const getPriceChangeBadge = (oldPrice: number, newPrice: number) => {
    const change = newPrice - oldPrice;
    const percent = ((change / oldPrice) * 100).toFixed(1);
    
    if (change > 0) {
      return <span className="text-red-600 font-medium">+${change.toFixed(2)} (+{percent}%)</span>;
    } else if (change < 0) {
      return <span className="text-green-600 font-medium">${change.toFixed(2)} ({percent}%)</span>;
    }
    return <span className="text-gray-500">No change</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <button
        onClick={() => window.history.back()}
        className="flex items-center text-green-600 hover:underline mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Price History: {partNumber}
        </h1>
        <div className="flex items-center space-x-4">
          <span className="text-gray-600">Current Price:</span>
          <span className="text-2xl font-bold text-green-600">
            ${currentPrice?.toFixed(2)}
          </span>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-600">No price history found for this product</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Old Price</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">New Price</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Change</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Changed By</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Import Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.map((change) => (
                  <tr key={change.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(change.changedAt).toLocaleDateString()} at{' '}
                      {new Date(change.changedAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      ${change.oldPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      ${change.newPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        {getPriceChangeIcon(change.oldPrice, change.newPrice)}
                        {getPriceChangeBadge(change.oldPrice, change.newPrice)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {change.changedBy.firstName} {change.changedBy.lastName}
                      <br />
                      <span className="text-xs text-gray-500">{change.changedBy.email}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {change.importBatch ? (
                        <code className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {change.importBatch.replace('import_', '')}
                        </code>
                      ) : (
                        <span className="text-gray-400">Manual</span>
                      )}
                    </td>
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

export default PriceHistory;
