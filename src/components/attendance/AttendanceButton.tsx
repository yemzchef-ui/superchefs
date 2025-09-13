import { useGeolocation } from "@/hooks/useGeolocation";
import { useAttendance } from '@/hooks/useAttendance';
import { createClient } from '@supabase/supabase-js';
import {
  QrCode
} from "lucide-react";

interface AttendanceButtonProps {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  branchId: string;
}

const AttendanceButton: React.FC<AttendanceButtonProps> = ({ supabase, userId, branchId }) => {
  const { location, error: locError, loading: locLoading, getLocation } = useGeolocation();
  const { status, markAttendance } = useAttendance({ supabase, userId, branchId });

  const handleCheckIn = async () => {
    getLocation();
    // Wait for location to be fetched
    setTimeout(async () => {
      if (location) {
        await markAttendance(location.lat, location.lng);
      }
    }, 1000);
  };

  return (
    <button
      onClick={handleCheckIn}
      disabled={status === 'loading' || locLoading}
      className={`py-4 px-4 rounded-lg font-medium text-green-600 items-center justify-center overflow-hidden shadow
        ${status === 'loading' || locLoading
          ? 'bg-gray-300 cursor-not-allowed'
          : 'bg-gray-100 hover:bg-green-50'
        }`}
      style={{ position: 'relative' }}
    >
      <span
        className="absolute inset-7 flex items-center justify-center opacity-20 pointer-events-none"
        aria-hidden="true"
      >
        <QrCode size={120} />
      </span>
      <span className="relative z-10">
        {locLoading
          ? 'Getting location...'
          : status === 'loading'
            ? 'Checking In...'
            : 'Check In'}
      </span>
      {status === 'success' && (
        <p className="text-green-600 mt-2 relative z-10">✅ Attendance marked!</p>
      )}
      {status === 'offline' && (
        <p className="text-yellow-600 mt-2 relative z-10">🕒 Saved. updating later.</p>
      )}
      {status === 'error' && !locError && (
        <p className="text-red-600 mt-2 relative z-10">Location Error !</p>
      )}
      {locError && (
        <p className="text-red-600 mt-2 relative z-10">📍 Error: {locError}</p>
      )}
    </button>
  );
};

export default AttendanceButton;