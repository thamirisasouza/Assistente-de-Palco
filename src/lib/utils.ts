import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const isNegative = seconds < 0;
  const absSeconds = Math.abs(seconds);
  const m = Math.floor(absSeconds / 60);
  const s = Math.floor(absSeconds % 60);
  const sign = isNegative ? '-' : '';
  return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatTimeHours(seconds: number): string {
  const isNegative = seconds < 0;
  const absSeconds = Math.abs(seconds);
  const h = Math.floor(absSeconds / 3600);
  const m = Math.floor((absSeconds % 3600) / 60);
  const s = Math.floor(absSeconds % 60);
  const sign = isNegative ? '-' : '';
  if (h > 0) {
    return `${sign}${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function addMinutesToTime(timeString: string, minsToAdd: number): string {
  try {
    const [hStr, mStr] = timeString.split(':');
    let h = parseInt(hStr, 10);
    let m = parseInt(mStr, 10);
    
    if (isNaN(h) || isNaN(m)) return timeString;
    
    m += minsToAdd;
    h += Math.floor(m / 60);
    m = m % 60;
    h = h % 24;
    
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  } catch (e) {
    return timeString;
  }
}
