// components/AdminDashboard.tsx
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AttendanceCalendar from './AttendanceCalendar';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface AttendanceSummary {
  name: string;
  present: number;
  absent: number;
  late: number;
}

interface DailyAttendance {
  staff_name: string;
  date: string;
  check_in_time: string;
  status: string;
}

const AdminDashboard: React.FC<{ supabase: ReturnType<typeof createClient> }> = ({ supabase }) => {
  const [todayStats, setTodayStats] = useState({ present: 0, absent: 0, late: 0 });
  const [summary, setSummary] = useState<AttendanceSummary[]>([]);
  const [dailyData, setDailyData] = useState<DailyAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [view, setView] = useState<'summary' | 'daily' | 'calendar'>('summary');

  useEffect(() => {
    const fetchData = async () => {
      const user = supabase.auth.user();
      if (!user) return;
      setLoading(true);

      // Get branchId for the current user
      const { data: staffData } = await supabase
        .from('profiles')
        .select('branch_id')
        .eq('id', user.id)
        .single();

      const branchId = staffData?.branch_id;
      if (!branchId) {
        setLoading(false);
        return;
      }

      // Today's stats
      const today = new Date().toISOString().split('T')[0];
      const { data: todayData } = await supabase.rpc('get_daily_attendance_summary', { target_date: today, branch_id: branchId });

      // Monthly summary
      const { data: summaryData } = await supabase.rpc('get_monthly_attendance_summary', { target_month: selectedMonth.toISOString(), branch_id: branchId });

      // Daily log
      const { data: dailyLog } = await supabase
        .from('attendance')
        .select('staff(name), date, check_in_time')
        .eq('date', today)
        .order('check_in_time');

      setTodayStats(todayData || { present: 0, absent: 0, late: 0 });
      setSummary(summaryData || []);
      setDailyData(
        dailyLog?.map((r: any) => ({
          staff_name: r.staff.name,
          date: r.date,
          check_in_time: new Date(r.check_in_time).toLocaleTimeString(),
          status: 'present',
        })) || []
      );
      setLoading(false);
    };

    fetchData();
  }, [supabase, selectedMonth]);

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('Monthly Attendance Report', 14, 16);
    doc.autoTable({
      head: [['Name', 'Present', 'Late', 'Absent']],
      body: summary.map(s => [s.name, s.present, s.late, s.absent]),
      startY: 20,
    });
    doc.save(`attendance-report-${FormData(selectedMonth, 'MMM-yyyy')}.pdf`);
  };

  if (loading) return <div className="p-4">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 mb-6">
        <button
          onClick={() => setView('summary')}
          className={`px-4 py-2 rounded ${view === 'summary' ? 'bg-orange-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          Summary
        </button>
        <button
          onClick={() => setView('daily')}
          className={`px-4 py-2 rounded ${view === 'daily' ? 'bg-orange-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          Daily Log
        </button>
        <button
          onClick={() => setView('calendar')}
          className={`px-4 py-2 rounded ${view === 'calendar' ? 'bg-orange-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          Calendar
        </button>
        <input
          type="month"
          value={FormData(selectedMonth, 'yyyy-MM')}
          onChange={(e) => setSelectedMonth(new Date(e.target.value))}
          className="ml-auto p-2 border rounded dark:bg-gray-700"
        />
      </div>

      {view === 'summary' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Attendance Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded text-center">
              <div className="text-2xl font-bold text-green-600">{todayStats.present}</div>
              <div className="text-sm">Present</div>
            </div>
            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded text-center">
              <div className="text-2xl font-bold text-yellow-600">{todayStats.late}</div>
              <div className="text-sm">Late</div>
            </div>
            <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded text-center">
              <div className="text-2xl font-bold text-red-600">{todayStats.absent}</div>
              <div className="text-sm">Absent</div>
            </div>
          </div>
          <button
            onClick={exportToPDF}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Export to PDF
          </button>
        </div>
      )}

      {view === 'daily' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Today's Attendance Log</h2>
          <table className="min-w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-900">
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Time</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {dailyData.map((r, i) => (
                <tr key={i} className="border-t dark:border-gray-700">
                  <td className="p-2">{r.staff_name}</td>
                  <td className="p-2">{r.check_in_time}</td>
                  <td className="p-2"><span className="text-green-600">Present</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'calendar' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Staff Calendar View</h2>
          <AttendanceCalendar supabase={supabase} staffId="STAFF_ID_HERE" month={selectedMonth} />
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;