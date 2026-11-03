import { useEffect, useState } from 'react';

const PHONE = '(max-width: 767.98px)';

/** True below Bootstrap's `md` breakpoint. Safe where `matchMedia` is missing (SSR, jsdom) — reports "not a phone". */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}
