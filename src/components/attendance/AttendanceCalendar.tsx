// components/AttendanceCalendar.tsx
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, getDate, isToday } from 'date-fns';

interface AttendanceRecord {
  date: string;
  status: 'present' | 'late' | 'absent' | 'dayoff';
}

interface Props {
  supabase: ReturnType<typeof createClient>;
  staffId: string;
  month: Date; // The month to display
}

const AttendanceCalendar: React.FC<Props> = ({ supabase, staffId, month }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      const start = startOfMonth(month).toISOString().split('T')[0];
      const end = endOfMonth(month).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('attendance')
        .select('date, check_in_time')
        .eq('staff_id', staffId)
        .gte('date', start)
        .lte('date', end);

      if (error) {
        console.error('Failed to fetch attendance:', error);
        setLoading(false);
        return;
      }

      // Simulate late logic: after 6:10 AM
      const recordsMap = new Map<string, 'present' | 'late'>();

      (data as { date: string; check_in_time: string }[]).forEach((item) => {
        const date = item.date;
        const time = new Date(item.check_in_time).getHours() * 60 + new Date(item.check_in_time).getMinutes();
        recordsMap.set(date, time > 370 ? 'late' : 'present'); // 6:10 AM = 370 mins
      });

      // Fill all days in month
      const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
      const fullRecords = days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const status = (recordsMap.get(dateStr) || 'absent') as 'present' | 'late' | 'absent' | 'dayoff';
        return { date: dateStr, status };
      });

      setRecords(fullRecords);
      setLoading(false);
    };

    fetchAttendance();
  }, [supabase, staffId, month]);

  if (loading) return <div className="p-4">Loading calendar...</div>;

  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <h3 className="text-lg font-semibold p-4 border-b dark:border-gray-700">
        Attendance Calendar - {format(month, 'MMMM yyyy')}
      </h3>
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium bg-gray-100 dark:bg-gray-900">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const record = records.find(r => r.date === format(day, 'yyyy-MM-dd'));
          const status = record?.status || 'absent';
          const dayNum = getDate(day);

          return (
            <div
              key={day.toString()}
              className={`p-2 min-h-12 flex flex-col items-center justify-center text-sm border-b border-r border-gray-200 dark:border-gray-700
                ${isToday(day) ? 'ring-2 ring-orange-500' : ''}
                ${status === 'present' ? 'bg-green-100 dark:bg-green-900/30' :
                  status === 'late' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                  status === 'absent' ? 'bg-red-100 dark:bg-red-900/30' :
                  'bg-gray-50 dark:bg-gray-900'}
              `}
            >
              <span className="font-medium">{dayNum}</span>
              <div
                className={`w-2 h-2 rounded-full mt-1
                  ${status === 'present' ? 'bg-green-500' :
                    status === 'late' ? 'bg-yellow-500' :
                    status === 'absent' ? 'bg-red-500' : 'bg-gray-400'}
                `}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceCalendar;