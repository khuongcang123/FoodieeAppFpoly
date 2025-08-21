// app/(drawer)/_layout.tsx
import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { DrawerContent } from '../../components/DrawerContent';


export default function DrawerLayout() {
  const colorScheme = useColorScheme();
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        screenOptions={{
          headerShown: false,
          drawerActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          drawerInactiveTintColor: Colors[colorScheme ?? 'light'].text,
          drawerStyle: {
            backgroundColor: Colors[colorScheme ?? 'light'].background,
            width: '80%',
          },
        }}
        drawerContent={DrawerContent}
      >
        {/* Các màn hình trong Drawer */}
        <Drawer.Screen
          name="(tabs)" // Đây là nhóm tabs của bạn
          options={{
            title: 'Trang chính',
          }}
        />
        <Drawer.Screen
          name="settings"
          options={{
            title: 'Cài đặt',
          }}
        />
        <Drawer.Screen
          name="profile"
          options={{
            title: 'Hồ sơ',
          }}
        />
      </Drawer>
    </GestureHandlerRootView>
  );
}