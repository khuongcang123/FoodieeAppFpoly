// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// Import icon từ MaterialIcons
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const tintColor = Colors[colorScheme ?? 'light'].tint;
  const inactiveColor = "#94a3b8";

  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: false,
        tabBarActiveTintColor: tintColor,
        tabBarInactiveTintColor: inactiveColor,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          position: 'absolute',
          height: Platform.select({
            ios: 88,
            android: 72,
            default: 80,
          }),
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: Platform.select({
            ios: 30,
            android: 8,
            default: 10,
          }),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
          letterSpacing: 0.2,
        },
        tabBarIconStyle: {
          marginTop: 4,
        }
      }}>

      {/* Trang chủ */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="home"
              size={focused ? 30 : 26}
              color={color}
            />
          ),
        }}
      />

      {/* Kho hàng */}
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Kho hàng',
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="store" // icon kho hàng
              size={focused ? 30 : 26}
              color={color}
            />
          ),
        }}
      />

      {/* Doanh thu */}
      <Tabs.Screen
        name="revenue"
        options={{
          title: 'Doanh thu',
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="bar-chart" // biểu đồ doanh thu
              size={focused ? 30 : 26}
              color={color}
            />
          ),
        }}
      />

      {/* Menu */}
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="menu-book" // icon menu món ăn
              size={focused ? 30 : 26}
              color={color}
            />
          ),
        }}
      />

      {/* Khohang (nếu bạn muốn tách riêng thêm màn hình) */}
      <Tabs.Screen
        name="khohang"
        options={{
          title: 'Kho hàng chi tiết',
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="inventory" // khác với "store" để phân biệt
              size={focused ? 30 : 26}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconContainer: {
    backgroundColor: 'rgba(67, 97, 238, 0.15)',
    padding: 8,
    borderRadius: 24,
  },
});
