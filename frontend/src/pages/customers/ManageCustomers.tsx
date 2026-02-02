import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2, UserCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { customerApi } from '@/lib/api';

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

const ManageCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCustomers = async (searchTerm?: string) => {
    try {
      const { data } = await customerApi.getAll(searchTerm?.trim() ? { search: searchTerm.trim() } : undefined);
      setCustomers(data);
    } catch (error) {
      console.error('Failed to load customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSearch = () => {
    setLoading(true);
    loadCustomers(search);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this customer? Quotes using this customer will keep the name but lose the link.')) return;
    setDeletingId(id);
    try {
      await customerApi.delete(id);
      toast.success('Customer removed');
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete customer');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-12 h-12 border-4 border-wago-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container-custom py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/quotes" className="text-green-600 hover:underline flex items-center gap-1">
            <ArrowLeft className="w-5 h-5" /> Back to Quotes
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Manage Customers</h1>
        </div>
      </div>

      <p className="text-gray-600 mb-6">
        Remove duplicate or unused customers. Only customers you created are shown. Deleting unlinks them from quotes; quote names are kept.
      </p>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by name, company, or email..."
          className="input flex-1 max-w-md"
        />
        <button type="button" onClick={handleSearch} className="btn btn-primary">
          Search
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="card p-12 text-center">
          <UserCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No customers found</h3>
          <p className="text-gray-600 mb-4">
            Customers are created when you add a new customer on a quote. Create quotes to build your list.
          </p>
          <Link to="/quotes/new" className="btn btn-primary">
            Create a Quote
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Company</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Email</th>
                  <th className="w-24 px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.company || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="btn bg-red-50 text-red-600 hover:bg-red-100 text-sm disabled:opacity-60 inline-flex items-center gap-1"
                      >
                        {deletingId === c.id ? (
                          <span className="inline-block w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        {deletingId === c.id ? 'Removing...' : 'Remove'}
                      </button>
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

export default ManageCustomers;
