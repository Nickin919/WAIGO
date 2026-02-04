import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2, UserCircle, Download, Upload, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { customerApi } from '@/lib/api';

const CSV_SAMPLE = `Name,Company,Email,Phone,Address,City,State,Zip Code
Acme Corp,Acme Inc,contact@acme.com,555-0100,123 Main St,Chicago,IL,60601
Beta Industries,Beta LLC,jane@beta.com,555-0200,456 Oak Ave,Detroit,MI,48201`;

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

const EMPTY_CUSTOMER: Customer = {
  id: '',
  name: '',
  company: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
};

const ManageCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_CUSTOMER);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadCustomers = async (searchTerm?: string) => {
    try {
      const { data } = await customerApi.getAll(searchTerm?.trim() ? { search: searchTerm.trim() } : undefined);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load customers', error);
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

  const handleDownloadSample = () => {
    const blob = new Blob([CSV_SAMPLE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-import-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Sample CSV downloaded');
  };

  const parseCsvRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(current.replace(/^["']|["']$/g, '').trim());
        current = '';
      } else {
        current += c;
      }
    }
    result.push(current.replace(/^["']|["']$/g, '').trim());
    return result;
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string) || '';
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error('CSV must have a header row and at least one data row');
        setUploading(false);
        return;
      }
      const header = parseCsvRow(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
      const nameIdx = header.indexOf('name');
      if (nameIdx < 0) {
        toast.error('CSV must have a "Name" column');
        setUploading(false);
        return;
      }
      const col = (key: string) => {
        const i = header.indexOf(key);
        return i >= 0 ? i : -1;
      };
      const zipCol = col('zipcode') >= 0 ? col('zipcode') : header.findIndex((h) => h.includes('zip'));
      const idx = {
        name: nameIdx,
        company: col('company'),
        email: col('email'),
        phone: col('phone'),
        address: col('address'),
        city: col('city'),
        state: col('state'),
        zipcode: zipCol,
      };
      const rows: Array<{ name: string; company?: string; email?: string; phone?: string; address?: string; city?: string; state?: string; zipCode?: string }> = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = parseCsvRow(lines[i]);
        const name = cells[idx.name]?.trim() || '';
        if (!name) continue;
        rows.push({
          name,
          company: idx.company >= 0 && cells[idx.company] ? cells[idx.company].trim() : undefined,
          email: idx.email >= 0 && cells[idx.email] ? cells[idx.email].trim() : undefined,
          phone: idx.phone >= 0 && cells[idx.phone] ? cells[idx.phone].trim() : undefined,
          address: idx.address >= 0 && cells[idx.address] ? cells[idx.address].trim() : undefined,
          city: idx.city >= 0 && cells[idx.city] ? cells[idx.city].trim() : undefined,
          state: idx.state >= 0 && cells[idx.state] ? cells[idx.state].trim() : undefined,
          zipCode: idx.zipcode >= 0 && cells[idx.zipcode] ? cells[idx.zipcode].trim() : undefined,
        });
      }
      if (rows.length === 0) {
        toast.error('No valid rows (Name is required)');
        setUploading(false);
        return;
      }
      customerApi
        .bulkCreate(rows)
        .then((res) => {
          const created = res.data?.created ?? 0;
          const errors = res.data?.errors ?? [];
          loadCustomers();
          if (created > 0) toast.success(`${created} customer(s) added`);
          if (errors.length > 0) toast.error(`${errors.length} row(s) failed: ${errors.map((e: { row: number; error: string }) => `Row ${e.row}: ${e.error}`).join('; ')}`);
        })
        .catch((err: { response?: { data?: { error?: string } } }) => toast.error(err.response?.data?.error || 'Upload failed'))
        .finally(() => setUploading(false));
    };
    reader.readAsText(file);
  };

  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    setEditForm({
      id: c.id,
      name: c.name,
      company: c.company ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
      city: c.city ?? '',
      state: c.state ?? '',
      zipCode: c.zipCode ?? '',
    });
  };

  const closeEdit = () => {
    setEditCustomer(null);
    setEditForm(EMPTY_CUSTOMER);
  };

  const handleSaveEdit = async () => {
    if (!editCustomer?.id) return;
    const name = editForm.name?.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const updated = await customerApi.update(editCustomer.id, {
        name,
        company: editForm.company || undefined,
        email: editForm.email || undefined,
        phone: editForm.phone || undefined,
        address: editForm.address || undefined,
        city: editForm.city || undefined,
        state: editForm.state || undefined,
        zipCode: editForm.zipCode || undefined,
      });
      setCustomers((prev) => prev.map((c) => (c.id === editCustomer.id ? (updated.data as Customer) : c)));
      toast.success('Customer updated');
      closeEdit();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
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
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[40vh]">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <Link to="/quotes" className="text-green-600 hover:underline flex items-center gap-1 text-sm mb-1">
            <ArrowLeft className="w-4 h-4" /> Back to Quotes
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Manage my customers</h1>
          <p className="text-gray-600 text-sm mt-1">
            Add, edit, or remove customers. Only customers you created are shown. Deleting unlinks them from quotes; the name on the quote is kept.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleDownloadSample} className="btn bg-gray-100 hover:bg-gray-200 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download CSV sample
          </button>
          <label className="btn btn-primary flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload CSV'}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              disabled={uploading}
              onChange={handleCsvUpload}
            />
          </label>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
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
            Add customers via CSV upload above, or create a quote and add a new customer there.
          </p>
          <Link to="/quotes/new" className="btn btn-primary">
            Create a Quote
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Company</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">City</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">State</th>
                  <th className="w-28 px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.company || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.city || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.state || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="text-green-600 hover:underline flex items-center gap-1"
                        >
                          <Pencil className="w-4 h-4" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="text-red-600 hover:underline flex items-center gap-1 disabled:opacity-60"
                        >
                          {deletingId === c.id ? (
                            <span className="inline-block w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit customer</h3>
              <button type="button" onClick={closeEdit} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="input w-full"
                  placeholder="Customer name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={editForm.company ?? ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, company: e.target.value }))}
                  className="input w-full"
                  placeholder="Company"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email ?? ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  className="input w-full"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editForm.phone ?? ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  className="input w-full"
                  placeholder="Phone"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editForm.address ?? ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                  className="input w-full"
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={editForm.city ?? ''}
                    onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={editForm.state ?? ''}
                    onChange={(e) => setEditForm((p) => ({ ...p, state: e.target.value }))}
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                <input
                  type="text"
                  value={editForm.zipCode ?? ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, zipCode: e.target.value }))}
                  className="input w-full"
                />
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex gap-2 justify-end">
              <button type="button" onClick={closeEdit} className="btn bg-gray-200">
                Cancel
              </button>
              <button type="button" onClick={handleSaveEdit} disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageCustomers;
