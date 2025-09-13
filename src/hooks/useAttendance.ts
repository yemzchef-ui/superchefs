import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getDistance } from '../utils/distance';

const OFFLINE_KEY = 'pending_attendance';

interface BakeryLocation {
  latitude: number;
  longitude: number;
  radius_meters: number;
}

interface AttendanceData {
  user_id: string;
  location_lat: number;
  location_lng: number;
  device_id: string;
  source: 'app' | 'manual';
  createdAt?: string;
}

interface UseAttendanceProps {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  branchId: string;
}

interface AttendanceResult {
  success: boolean;
  error?: string;
  offline?: boolean;
}

export const useAttendance = ({ supabase, userId, branchId }: UseAttendanceProps) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'offline'>('idle');
  const [attendance, setAttendance] = useState<Date | null>(null);

  const fetchLocation = async (): Promise<BakeryLocation> => {
    //fetch user from profiles
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user?.id) throw new Error("User not authenticated");

    const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('branch_id')
    .eq('user_id', userData.user.id)
    .single();

    if (profileError || !profile) throw new Error ("staff not found");
//fetch branch
    const { data: branch, error:branchError } = await supabase
      .from('branches')
      .select('latitude, longitude, radius_meters')
      .eq('id', branchId)
      .single<BakeryLocation>();

    if (branchError ||  !branch) throw new Error("Branch location not found");
    return {
      latitude: Number(branch.latitude),
      longitude: Number(branch.longitude),
      radius_meters: Number(branch.radius_meters),
    };
  };

  const hasCheckedInToday = async (): Promise<boolean> => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('attendance')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  };

  const markAttendance = async (lat: number, lng: number, deviceId: string = 'web') => {
    try {
      setStatus('loading');

      const bakery = await fetchLocation();
      const distance = getDistance(lat, lng, bakery.latitude, bakery.longitude);

      if (distance > bakery.radius_meters) {
        setStatus('error');
        return { success: false, error: 'Not within bakery location' } as AttendanceResult;
      }

      const alreadyCheckedIn = await hasCheckedInToday();
      if (alreadyCheckedIn) {
        setStatus('error');
        return { success: false, error: 'Already checked in today' } as AttendanceResult;
      }

      const attendanceData: AttendanceData = {
        user_id: userId,
        location_lat: lat,
        location_lng: lng,
        device_id: deviceId,
        source: 'app',
      };

      if (navigator.onLine) {
        const { error } = await supabase.from('attendance').insert([attendanceData]) ;
        if (error) throw error;

        setStatus('success');
        setAttendance(new Date());
        return { success: true } as AttendanceResult;
      } else {
        // Save to localStorage
        const pending: AttendanceData[] = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]');
        pending.push({ ...attendanceData, createdAt: new Date().toISOString() });
        localStorage.setItem(OFFLINE_KEY, JSON.stringify(pending));

        setStatus('offline');

        // Trigger background sync
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready.then(sw => {
            if ('sync' in sw) {
              // @ts-ignore
              sw.sync.register('sync-attendance');
            }
          });
        }

        return { success: true, offline: true } as AttendanceResult;
      }
    } catch (err: any) {
      setStatus('error');
      return { success: false, error: err.message } as AttendanceResult;
    }
  };

  return { status, attendance, markAttendance };
};