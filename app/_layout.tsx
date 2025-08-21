// app/_layout.tsx
import { Slot, useRouter, usePathname } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';

export default function AppLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[Auth] Đang ở:', pathname);
      if (!user) {
        console.log('[Auth] Không có user');

        if (pathname !== '/login') {
          console.log('[Auth] Chuyển hướng đến /login');
          router.replace('/login');
        }
      } else {
        console.log('[Auth] Đã đăng nhập:', user.email);

        if (pathname === '/login') {
          console.log('[Auth] Chuyển hướng đến /branch-selection');
          router.replace('/(auth)/branch-selection');
        }
      }

      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, [pathname]);

  if (!authChecked) return null;

  return <Slot />;
}
