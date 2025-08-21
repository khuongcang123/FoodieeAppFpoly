// components/ui/IconSymbol.tsx
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconSymbolName = keyof typeof MAPPING;

/**
 * Mapping SF Symbols to Material Icons
 */
const MAPPING = {
  'house.fill': 'home',
  'shippingbox.fill': 'inventory',
  'chart.bar.fill': 'bar-chart',
  'list.bullet.rectangle.fill': 'list',
  'line.3.horizontal': 'menu',
  'person.fill': 'person',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  // Thêm các icon mới tại đây
  'inventory': 'inventory',
  'revenue': 'bar-chart',
  'menu': 'menu',
  'profile': 'person',
} as const;

/**
 * Icon component with enhanced styling
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  // Kiểm tra nếu tên icon không tồn tại trong mapping
  if (!MAPPING[name]) {
    console.warn(`Icon "${name}" is not mapped to any Material Icon. Using "error" as fallback.`);
  }

  const materialIconName = MAPPING[name] || 'error';
  
  return (
    <MaterialIcons 
      name={materialIconName} 
      size={size} 
      color={color} 
      style={[
        style,
        weight === 'bold' ? { fontWeight: '700' } : {},
        weight === 'heavy' ? { fontWeight: '900' } : {},
      ]}
    />
  );
}