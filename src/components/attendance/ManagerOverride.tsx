// components/ManagerOverride.tsx
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface StaffMember {
  id: string;
  name: string;
}

interface Props {
  supabase: ReturnType<typeof createClient>;
  managerId: string;
  onSuccess?: () => void;
}

const ManagerOverride: React.FC<Props> = ({ supabase, managerId, onSuccess }) => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStaff = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .neq('id', managerId) // exclude self
        .filter(
          'branch_id',
          'eq',
          (
            await supabase
              .from('profiles')
              .select('branch_id')
              .eq('id', managerId)
              .single<{ branch_id: string }>()
          ).data?.branch_id
        );

      if (error) {
        setError('Failed to load staff list');
      } else {
        setStaffList(data || []);
      }
    };

    fetchStaff();
  }, [supabase, managerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !reason.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.from('attendance').insert([
        {
          staff_id: selectedStaff,
          date: new Date().toISOString().split('T')[0],
          source: 'manual',
          marked_by_manager_id: managerId,
          reason_manual: reason,
        },
      ]);

      if (error) throw error;

      alert('Attendance marked successfully!');
      setSelectedStaff('');
      setReason('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Mark Attendance for Staff</h3>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Select Staff</label>
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            required
          >
            <option value="">-- Choose staff --</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            rows={3}
            placeholder="e.g., Phone battery died"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Mark Attendance'}
        </button>
      </form>
    </div>
  );
};

export default ManagerOverride;