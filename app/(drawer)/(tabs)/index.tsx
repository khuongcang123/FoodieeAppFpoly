import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  Image,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, ref, onValue, update, get, push, set, remove } from 'firebase/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

// Table status types
type TableStatus = 'empty' | 'in-use' | 'reserved' | 'disabled';

export default function BranchScreen() {
  const [userUid, setUserUid] = useState<string>("");
  const insets = useSafeAreaInsets();
  const [branch, setBranch] = useState<any>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();

  // Modal states
  const [reservationModalVisible, setReservationModalVisible] = useState(false);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [takeawayModalVisible, setTakeawayModalVisible] = useState(false);
  const [preOrderModalVisible, setPreOrderModalVisible] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway' | null>(null);
  
  // Customer states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  
  // Reservation states
  const [reservationNote, setReservationNote] = useState('');
  const [reservationTime, setReservationTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Order states
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<{[key: string]: number}>({});
  const [preOrderCart, setPreOrderCart] = useState<{[key: string]: number}>({});
  const [orderLoading, setOrderLoading] = useState(false);
  
  // Search and pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 10;
  
  // Zone filter
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [zoneNames, setZoneNames] = useState<{id: string, name: string}[]>([]);
  
  const db = getDatabase();

  // Lấy UID từ AsyncStorage
  useEffect(() => {
    const loadUid = async () => {
      try {
        const uid = await AsyncStorage.getItem("userUid");
        if (uid) {
          setUserUid(uid);
        } else {
          console.warn("Chưa tìm thấy UID trong AsyncStorage");
        }
      } catch (error) {
        console.error("Lỗi khi lấy UID:", error);
      }
    };
    loadUid();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadBranchData = async () => {
        const branchData = await AsyncStorage.getItem('selectedBranch');
        const role = await AsyncStorage.getItem('userRole');
        if (role) setUserRole(role);

        if (branchData) {
          const branchObj = JSON.parse(branchData);
          setBranch(branchObj);
          loadZonesAndTables(branchObj.code);
        }
      };
      loadBranchData();

      // Set up interval to check reservation times
      const interval = setInterval(checkReservationTimes, 60000); // Check every minute
      
      return () => {
        clearInterval(interval);
      };
    }, [])
  );

  const checkReservationTimes = async () => {
    if (!branch.code) return;
    
    try {
      const now = new Date();
      const branchRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/${branch.code}/local/tables`);
      const snapshot = await get(branchRef);
      
      if (snapshot.exists()) {
        const tablesData: Record<string, any> = snapshot.val();
        
        const updates: Record<string, any> = {};
        let shouldUpdate = false;
        
        Object.entries(tablesData).forEach(([tableId, table]) => {
          if (table.status === 'reserved' && table.reservation) {
            const reservationTime = new Date(table.reservation.reservationTime);
            // Add 15 minutes grace period
            const expirationTime = new Date(reservationTime.getTime() + 15 * 60000);
            
            if (now > expirationTime) {
              updates[`${tableId}/status`] = 'empty';
              updates[`${tableId}/reservation`] = null;
              shouldUpdate = true;
            }
          }
        });
        
        if (shouldUpdate) {
          await update(branchRef, updates);
          loadZonesAndTables(branch.code);
        }
      }
    } catch (error) {
      console.error("Error checking reservation times:", error);
    }
  };

  const loadZonesAndTables = async (branchCode: string) => {
    try {
      const branchRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/${branchCode}/local`);
      
      onValue(branchRef, (snapshot) => {
        if (snapshot.exists()) {
          const branchLocalData = snapshot.val();
          
          // Load zones (khu vực)
          const zonesData = branchLocalData.zones 
            ? Object.entries(branchLocalData.zones).map(([key, value]) => ({
                id: key,
                ...(value as any)
              })) 
            : [];
          
          // Set zone names for filter
          const zoneOptions = zonesData.map(zone => ({ id: zone.id, name: zone.name }));
          setZoneNames([{ id: 'all', name: 'Tất cả khu vực' }, ...zoneOptions]);
          
          // Load tables
          const tablesData = branchLocalData.tables 
            ? Object.entries(branchLocalData.tables).map(([key, value]) => ({
                id: key,
                ...(value as any)
              })) 
            : [];
          
          // Assign tables to zones
          const zonesWithTables = zonesData.map(zone => ({
            ...zone,
            tables: tablesData.filter(table => table.zoneId === zone.id)
          }));
          
          setZones(zonesWithTables);
        }
        setLoading(false);
      });
    } catch (error) {
      console.error("Error loading branch data:", error);
      setLoading(false);
    }
  };

  const filteredZones = zoneFilter === 'all' 
    ? zones 
    : zones.filter(zone => zone.id === zoneFilter);

  const handleTablePress = (table: any) => {
    setSelectedTable(table);
    setModalVisible(true);
  };

  const updateTableStatus = async (status: TableStatus) => {
  if (!selectedTable || !branch.code) return;

  // Kiểm tra nếu trạng thái mới giống trạng thái hiện tại
  if (selectedTable.status === status) {
    Alert.alert('Thông báo', `Bàn đã ở trạng thái "${getStatusText(status)}" rồi.`);
    return;
  }

  // Không cho phép đổi từ 'in-use' sang 'reserved' hoặc 'disabled'
  if (
    selectedTable.status === 'in-use' &&
    (status === 'reserved' || status === 'disabled')
  ) {
    Alert.alert('Không thể đổi trạng thái', 'Bàn đang sử dụng, không thể đặt trước hoặc vô hiệu hóa.');
    return;
  }

  // Nếu bàn đang dùng và chọn chuyển sang 'empty' thì chuyển sang màn hình payment
  if (selectedTable.status === 'in-use' && status === 'empty') {
    const orderId = selectedTable.currentOrder;
    if (!orderId) {
      Alert.alert('Lỗi', 'Không tìm thấy mã đơn hàng đang hoạt động cho bàn này.');
      return;
    }

    router.push({
      pathname: '/payment',
      params: {
        orderId,
        tableId: selectedTable.id,
        zoneId: selectedTable.zoneId,
        branchCode: branch.code,
        orderPath: `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/${branch.code}/orders/${orderId}`
      },
    });

    setModalVisible(false);
    return;
  }

  // Nếu chọn đặt trước
  if (status === 'reserved') {
    setModalVisible(false);
    setReservationModalVisible(true);
    return;
  }

  // Nếu chọn đang dùng
  if (status === 'in-use') {
    setModalVisible(false);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerInfo(null);
    setIsNewCustomer(true);
    setOrderType('dine-in');
    setCustomerModalVisible(true);
    return;
  }

  // Cập nhật trạng thái thông thường
  try {
    const tableRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/${branch.code}/local/tables/${selectedTable.id}`);
    await update(tableRef, { status });

    updateLocalTableStatus(status);
    setModalVisible(false);
  } catch (error) {
    console.error("Error updating table status:", error);
    Alert.alert('Lỗi', 'Có lỗi xảy ra khi cập nhật trạng thái bàn');
  }
};

// Hàm hỗ trợ để lấy tên trạng thái bằng tiếng Việt
const getStatusText = (status: TableStatus) => {
  switch (status) {
    case 'empty': return 'Trống';
    case 'in-use': return 'Đang dùng';
    case 'reserved': return 'Đã đặt';
    case 'disabled': return 'Vô hiệu';
    default: return status;
  }
};

  const updateLocalTableStatus = (newStatus: string) => {
    const updatedZones = zones.map(zone => {
      if (zone.id === selectedTable.zoneId) {
        const updatedTables = zone.tables.map((t: any) =>
          t.id === selectedTable.id ? { ...t, status: newStatus } : t
        );
        return { ...zone, tables: updatedTables };
      }
      return zone;
    });
    setZones(updatedZones);
  };

  const confirmReservation = async () => {
    if (!customerName || !customerPhone) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin khách hàng');
      return;
    }

    try {
      const tableRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/${branch.code}/local/tables/${selectedTable.id}`);
      
      const reservationData = {
        customerName,
        customerPhone,
        reservationTime: reservationTime.toISOString(),
        createdAt: new Date().toISOString(),
        note: reservationNote,
        preOrder: Object.keys(preOrderCart).length > 0 ? preOrderCart : null
      };
      
      await update(tableRef, { 
        status: 'reserved',
        reservation: reservationData
      });

      // Update local state
      updateLocalTableStatus('reserved');
      
      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setReservationNote('');
      setReservationTime(new Date());
      setReservationModalVisible(false);
      setPreOrderCart({});
      
      Alert.alert('Thành công', 'Đặt bàn thành công!');
    } catch (error) {
      console.error("Error confirming reservation:", error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi đặt bàn');
    }
  };

  const loadProducts = async () => {
  try {
    setOrderLoading(true);
    const productsRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/menu`);
    const snapshot = await get(productsRef);
    
    if (snapshot.exists()) {
      const menuData = snapshot.val();
      const productsData = Object.entries(menuData).map(([key, value]) => ({
        id: key,
        ...(value as any),
        // Sửa: sử dụng basePrice thay vì originalPrice
        basePrice: (value as any).basePrice || 0,
        salePrice: (value as any).salePrice || 0
      }));
      
      // Lọc sản phẩm: chỉ hiển thị sản phẩm áp dụng cho chi nhánh hiện tại
      const filteredProducts = productsData.filter(product => 
        product.branches?.includes(branch.code)
      );
      
      // Đánh dấu sản phẩm hết hàng tại chi nhánh này
      const productsWithStockStatus = filteredProducts.map(product => ({
        ...product,
        // Kiểm tra trạng thái hết hàng tại chi nhánh hiện tại
        isOutOfStock: product.branchStock?.[branch.code] === false
      }));
      
      productsWithStockStatus.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(productsWithStockStatus);
    } else {
      setProducts([]);
    }
    setOrderLoading(false);
  } catch (error) {
    console.error("Lỗi khi tải menu:", error);
    setOrderLoading(false);
    Alert.alert('Lỗi', 'Có lỗi xảy ra khi tải menu');
  }
};

// Sửa hàm calculateTotal để sử dụng basePrice
const calculateTotal = (cartItems: {[key: string]: number}) => {
  let total = 0;
  Object.keys(cartItems).forEach(productId => {
    const product = products.find(p => p.id === productId);
    if (product) {
      // Sửa: sử dụng basePrice thay vì originalPrice
      const price = (product.salePrice > 0 ? product.salePrice : product.basePrice) || 0;
      total += price * cartItems[productId];
    }
  });
  return total;
};

  // Hàm kiểm tra thông tin khách hàng
  const checkCustomerInfo = async (phone: string) => {
    try {
      const clientRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/client`);
      const snapshot = await get(clientRef);

      if (snapshot.exists()) {
        const client = snapshot.val();
        const clientKeys = Object.keys(client);
        
        // Tìm khách hàng theo số điện thoại
        const existingClientKey = clientKeys.find(key => 
          client[key].phone === phone
        );

        if (existingClientKey) {
          const clientData = client[existingClientKey];
          setCustomerInfo(clientData);
          setIsNewCustomer(false);
          setCustomerName(clientData.name);
          return clientData;
        }
      }

      // Reset nếu không tìm thấy
      setCustomerInfo(null);
      setIsNewCustomer(true);
      return null;
    } catch (error) {
      console.error("Lỗi khi kiểm tra thông tin khách hàng:", error);
      return null;
    }
  };

  // Hàm lưu thông tin khách hàng
  const saveCustomerInfo = async () => {
    if (!customerPhone || !customerName) return;

    try {
      const clientRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/client`);
      const newClient = {
        name: customerName,
        phone: customerPhone,
        totalOrders: 1,
        lastOrder: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      const snapshot = await get(clientRef);
      let clientId = null;

      if (snapshot.exists()) {
        const client = snapshot.val();
        const existingClientKey = Object.keys(client).find(
          key => client[key].phone === customerPhone
        );

        if (existingClientKey) {
          clientId = existingClientKey;
          // Cập nhật số đơn hàng
          newClient.totalOrders = (client[existingClientKey].totalOrders || 0) + 1;
        }
      }

      if (clientId) {
        await update(ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/client/${clientId}`), newClient);
      } else {
        await push(clientRef, newClient);
      }

      return newClient;
    } catch (error) {
      console.error("Lỗi khi lưu thông tin khách hàng:", error);
      return null;
    }
  };

  const confirmOrder = async () => {
    // Kiểm tra tất cả sản phẩm trong giỏ hàng
    for (const productId of Object.keys(cart)) {
      const product = products.find(p => p.id === productId);
      if (product?.isOutOfStock) {
        Alert.alert(
          'Hết hàng', 
          `Sản phẩm "${product.name}" đã hết hàng. Vui lòng loại bỏ sản phẩm này trước khi đặt hàng.`
        );
        return;
      }
    }

    if (Object.keys(cart).length === 0) {
      Alert.alert('Lỗi', 'Vui lòng chọn ít nhất một món');
      return;
    }

    try {
      setOrderLoading(true);

      // Lưu thông tin khách hàng
      const client = await saveCustomerInfo();
      if (!client && isNewCustomer) {
        Alert.alert('Lỗi', 'Không thể lưu thông tin khách hàng');
        return;
      }

  // Tạo reference đến nhánh orders của chi nhánh
  const ordersRef = ref(
    db, 
    `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/${branch.code}/orders`
  );
  
  // Tạo reference mới cho đơn hàng
  const newOrderRef = push(ordersRef);

  const orderItems = Object.keys(cart).map(productId => {
    const product = products.find(p => p.id === productId);
    return {
      productId,
      name: product?.name,
      // Sửa: sử dụng basePrice thay vì originalPrice
      price: (product?.salePrice > 0 ? product.salePrice : product?.basePrice) || 0,
      quantity: cart[productId],
      image: product?.images?.[0] || null
    };
  });

  const totalAmount = calculateTotal(cart);
  
  const newOrder = {
    branchId: branch.id,
    branchName: branch.name,
    tableId: selectedTable.id,
    tableName: selectedTable.name,
    items: orderItems,
    total: totalAmount,
    status: 'active',
    type: 'dine-in',
    customerName,
    customerPhone,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Lưu đơn hàng vào nhánh orders của chi nhánh
  await set(newOrderRef, newOrder);

  // Cập nhật trạng thái bàn
  const tableRef = ref(
    db, 
    `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/${branch.code}/local/tables/${selectedTable.id}`
  );
  
  await update(tableRef, {
    status: 'in-use',
    currentOrder: newOrderRef.key
  });

      // Cập nhật local state
      setSelectedTable({
        ...selectedTable,
        status: 'in-use',
        currentOrder: newOrderRef.key
      });
      
      updateLocalTableStatus('in-use');
      setCart({});
      setOrderModalVisible(false);
      setOrderLoading(false);

      Alert.alert('Thành công', 'Đặt món thành công!');
    } catch (error) {
      console.error("Lỗi khi tạo đơn hàng:", error);
      setOrderLoading(false);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi tạo đơn hàng');
    }
  };

  const handleTakeAwayPress = () => {
    setCart({});
    setCustomerName('');
    setCustomerPhone('');
    setCustomerInfo(null);
    setIsNewCustomer(true);
    setOrderType('takeaway');
    setCustomerModalVisible(true);
  };

  const confirmTakeawayOrder = async () => {
    // Kiểm tra tất cả sản phẩm trong giỏ hàng
    for (const productId of Object.keys(cart)) {
      const product = products.find(p => p.id === productId);
      if (product?.isOutOfStock) {
        Alert.alert(
          'Hết hàng', 
          `Sản phẩm "${product.name}" đã hết hàng. Vui lòng loại bỏ sản phẩm này trước khi đặt hàng.`
        );
        return;
      }
    }

    if (Object.keys(cart).length === 0) {
      Alert.alert('Lỗi', 'Vui lòng chọn ít nhất một món');
      return;
    }

    try {
      setOrderLoading(true);
      
      // Lưu thông tin khách hàng
      const client = await saveCustomerInfo();
      if (!client && isNewCustomer) {
        Alert.alert('Lỗi', 'Không thể lưu thông tin khách hàng');
        return;
      }
      
  const ordersRef = ref(
    db, 
    `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/${branch.code}/orders`
  );
  
  const newOrderRef = push(ordersRef);
  const orderItems = Object.keys(cart).map(productId => {
    const product = products.find(p => p.id === productId);
    return {
      productId,
      name: product?.name,
      // Sửa: sử dụng basePrice thay vì originalPrice
      price: (product?.salePrice > 0 ? product.salePrice : product?.basePrice) || 0,
      quantity: cart[productId],
      image: product?.images?.[0] || null
    };
  });

      const totalAmount = calculateTotal(cart);
      
      const newOrder = {
        branchId: branch.id,
        branchName: branch.name,
        items: orderItems,
        total: totalAmount,
        status: 'active',
        type: 'takeaway',
        customerName,
        customerPhone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await set(newOrderRef, newOrder);
      
      setCart({});
      setTakeawayModalVisible(false);
      setOrderLoading(false);
      
      Alert.alert('Thành công', 'Đặt món mang về thành công!');
    } catch (error) {
      console.error("Lỗi khi tạo đơn hàng:", error);
      setOrderLoading(false);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi đặt món mang về');
    }
  };

  const openPreOrderMenu = () => {
    setModalVisible(false);
    loadProducts();
    setPreOrderModalVisible(true);
  };

  const savePreOrder = () => {
    setPreOrderModalVisible(false);
    setReservationModalVisible(true);
  };

  // Hàm xử lý kiểm tra khách hàng khi số điện thoại thay đổi
  const handlePhoneChange = async (phone: string) => {
    setCustomerPhone(phone);
    if (phone.length >= 10) {
      const client = await checkCustomerInfo(phone);
      if (client) {
        setIsNewCustomer(false);
      } else {
        setIsNewCustomer(true);
      }
    }
  };

  const proceedToOrder = async () => {
    if (!customerPhone) {
      Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại khách hàng');
      return;
    }

    // Nếu là khách mới và chưa nhập tên
    if (isNewCustomer && !customerName) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên khách hàng cho khách hàng mới');
      return;
    }

    // Đóng modal khách hàng
    setCustomerModalVisible(false);
    
    // Mở modal đặt món tương ứng
    if (orderType === 'dine-in') {
      loadProducts();
      setOrderModalVisible(true);
    } else if (orderType === 'takeaway') {
      loadProducts();
      setTakeawayModalVisible(true);
    }
  };

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  const renderProductItem = ({ item }: { item: any }, cartType: 'order' | 'preorder') => (
    <View style={[styles.productItem, item.isOutOfStock && styles.outOfStockItem]}>
      {item.images?.[0] ? (
        <Image 
          source={{ uri: item.images[0] }} 
          style={[styles.productImage, item.isOutOfStock && styles.outOfStockImage]} 
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.productImage, styles.imagePlaceholder]}>
          <Ionicons name="fast-food" size={24} color="#94a3b8" />
        </View>
      )}
      
      <View style={styles.productInfo}>
      <Text 
        style={[styles.productName, item.isOutOfStock && styles.outOfStockText]} 
        numberOfLines={1}
      >
        {item.name}
      </Text>
      {item.isOutOfStock && (
        <Text style={styles.outOfStockLabel}>Hết hàng</Text>
      )}
      <Text 
        style={[styles.productDescription, item.isOutOfStock && styles.outOfStockText]} 
        numberOfLines={2}
      >
        {item.description || 'Không có mô tả'}
      </Text>
      <Text style={[styles.productPrice, item.isOutOfStock && styles.outOfStockText]}>
        {item.salePrice > 0 ? (
          <>
            <Text style={styles.salePrice}>
              {(item.salePrice || 0).toLocaleString()}đ
            </Text>
            <Text style={styles.originalPrice}>  
              {/* Sửa: hiển thị basePrice thay vì originalPrice */}
              {(item.basePrice || 0).toLocaleString()}đ
            </Text>
          </>
        ) : (
          // Sửa: hiển thị basePrice thay vì originalPrice
          <Text>{(item.basePrice || 0).toLocaleString()}đ</Text>
        )}
      </Text>
    </View>
      
      <View style={styles.quantityControl}>
        <TouchableOpacity 
          style={[styles.quantityButton, 
            cartType === 'order' ? 
              (cart[item.id] ? null : styles.disabledButton) :
              (preOrderCart[item.id] ? null : styles.disabledButton),
            item.isOutOfStock && styles.disabledButton
          ]}
          disabled={
            cartType === 'order' ? 
              (!cart[item.id] || item.isOutOfStock) : 
              (!preOrderCart[item.id] || item.isOutOfStock)
          }
          onPress={() => removeFromCart(item.id, cartType)}
        >
          <Text style={styles.quantityButtonText}>-</Text>
        </TouchableOpacity>
        
        <Text style={[styles.quantityText, item.isOutOfStock && styles.outOfStockText]}>
          {cartType === 'order' ? (cart[item.id] || 0) : (preOrderCart[item.id] || 0)}
        </Text>
        
        <TouchableOpacity 
          style={[styles.quantityButton, item.isOutOfStock && styles.disabledButton]}
          disabled={item.isOutOfStock}
          onPress={() => addToCart(item.id, cartType)}
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (filteredProducts.length === 0) return null;
    if (totalPages <= 1) return null;
    
    return (
      <View style={styles.paginationContainer}>
        <TouchableOpacity 
          style={styles.paginationButton}
          disabled={currentPage === 1}
          onPress={() => setCurrentPage(currentPage - 1)}
        >
          <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? "#94a3b8" : "#4361ee"} />
        </TouchableOpacity>
        
        <Text style={styles.paginationText}>
          Trang {currentPage}/{totalPages}
        </Text>
        
        <TouchableOpacity 
          style={styles.paginationButton}
          disabled={currentPage === totalPages}
          onPress={() => setCurrentPage(currentPage + 1)}
        >
          <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? "#94a3b8" : "#4361ee"} />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4361ee" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#f0f4ff', '#e6f0ff']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.welcomeText}>{branch.name}</Text>
          <Text style={styles.branchText}>Mã: {branch.code}</Text>
        </View>

        {/* Zone Filter */}
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Lọc khu vực:</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={zoneFilter}
              style={styles.zonePicker}
              dropdownIconColor="#64748b"
              onValueChange={(itemValue) => setZoneFilter(itemValue)}
            >
              {zoneNames.map(zone => (
                <Picker.Item 
                  key={zone.id} 
                  label={zone.name} 
                  value={zone.id} 
                  style={styles.pickerItem}
                />
              ))}
            </Picker>
          </View>
        </View>

        {/* Zones and tables */}
        {filteredZones.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="restaurant" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>Chưa có khu vực nào</Text>
          </View>
        ) : (
          filteredZones.map(zone => (
            <View key={zone.id} style={styles.areaSection}>
              <View style={styles.areaHeader}>
                <Text style={styles.areaName}>{zone.name}</Text>
                <Text style={styles.areaCode}>{zone.code}</Text>
              </View>
              
              {zone.tables.length === 0 ? (
                <Text style={styles.emptyTableText}>Chưa có bàn nào trong khu vực</Text>
              ) : (
                <View style={styles.tablesGrid}>
                  {zone.tables.map((table: any) => (
                    <TouchableOpacity
                      key={table.id}
                      style={[
                        styles.tableItem, 
                        { 
                          backgroundColor: 
                            table.status === 'empty' ? '#dcfce7' :
                            table.status === 'in-use' ? '#fee2e2' :
                            table.status === 'reserved' ? '#ffedd5' :
                            '#f1f5f9',
                          borderColor:
                            table.status === 'empty' ? '#86efac' :
                            table.status === 'in-use' ? '#fca5a5' :
                            table.status === 'reserved' ? '#fdba74' :
                            '#cbd5e1'
                        }
                      ]}
                      onPress={() => handleTablePress(table)}
                    >
                      <Text style={styles.tableName}>{table.name}</Text>
                      <View style={styles.tableStatusBadge}>
                        <Text style={[
                          styles.tableStatus,
                          { 
                            color:
                              table.status === 'empty' ? '#166534' :
                              table.status === 'in-use' ? '#b91c1c' :
                              table.status === 'reserved' ? '#9a3412' :
                              '#475569'
                          }
                        ]}>
                          {table.status === 'empty' ? 'Trống' : 
                          table.status === 'in-use' ? 'Đang dùng' : 
                          table.status === 'reserved' ? 'Đã đặt' : 
                          'Vô hiệu'}
                        </Text>
                      </View>
                      <Text style={styles.tableCapacity}>{table.capacity} chỗ</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Nút "Mua mang về" nổi */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={handleTakeAwayPress}
      >
        <Ionicons name="fast-food" size={24} color="white" />
        <Text style={styles.fabText}>Mang về</Text>
      </TouchableOpacity>

      {/* Customer Info Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={customerModalVisible}
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setCustomerModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.customerModalContent}>
              <Text style={styles.modalTitle}>
                {orderType === 'dine-in' ? 'Thông tin khách hàng' : 'Đặt món mang về'}
              </Text>
              
              <View style={styles.customerInfoContainer}>
                {!isNewCustomer && customerInfo ? (
                  <>
                    <Text style={styles.customerInfoText}>
                      Khách hàng thân thiết: {customerInfo.name}
                    </Text>
                    <Text style={styles.customerInfoText}>
                      Số lần đã mua: {customerInfo.totalOrders || 1}
                    </Text>
                    <Text style={styles.customerInfoText}>
                      Điện thoại: {customerInfo.phone}
                    </Text>
                  </>
                ) : isNewCustomer ? (
                  <Text style={styles.customerInfoText}>Khách hàng mới</Text>
                ) : null}
              </View>
              
              <View style={styles.inputContainer}>
                <Ionicons name="call" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Số điện thoại *"
                  placeholderTextColor="#94a3b8"
                  value={customerPhone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                />
              </View>
              
              {isNewCustomer && (
                <View style={styles.inputContainer}>
                  <Ionicons name="person" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Tên khách hàng *"
                    placeholderTextColor="#94a3b8"
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                </View>
              )}
              
              <Pressable
                style={styles.confirmButton}
                onPress={proceedToOrder}
              >
                <Text style={styles.confirmButtonText}>Tiếp tục</Text>
              </Pressable>
              
              <Pressable
                style={[styles.confirmButton, { backgroundColor: '#94a3b8', marginTop: 10 }]}
                onPress={() => setCustomerModalVisible(false)}
              >
                <Text style={styles.confirmButtonText}>Hủy</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Table Status Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Đổi trạng thái bàn</Text>
              <Text style={styles.tableInfo}>Bàn: {selectedTable?.name}</Text>
              
              <Pressable
                style={styles.statusOption}
                onPress={() => updateTableStatus('empty')}
              >
                <Text style={styles.statusText}>Trống</Text>
              </Pressable>
              
              <Pressable
                style={styles.statusOption}
                onPress={() => updateTableStatus('in-use')}
              >
                <Text style={styles.statusText}>Đang dùng</Text>
              </Pressable>
              
              <Pressable
                style={styles.statusOption}
                onPress={() => updateTableStatus('reserved')}
              >
                <Text style={styles.statusText}>Đã đặt</Text>
              </Pressable>
              
              <Pressable
                style={styles.statusOption}
                onPress={() => updateTableStatus('disabled')}
              >
                <Text style={styles.statusText}>Vô hiệu</Text>
              </Pressable>
              
              {/* Nút món đặt trước chỉ hiển thị khi bàn đã đặt */}
              {selectedTable?.status === 'reserved' && (
                <Pressable
                  style={[styles.statusOption, { backgroundColor: '#dbeafe' }]}
                  onPress={openPreOrderMenu}
                >
                  <Text style={[styles.statusText, { color: '#2563eb' }]}>Món đặt trước</Text>
                </Pressable>
              )}
              
              <Pressable
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Reservation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reservationModalVisible}
        onRequestClose={() => setReservationModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setReservationModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.reservationModalContent}>
              <Text style={styles.modalTitle}>Đặt bàn</Text>
              <Text style={styles.tableInfo}>Bàn: {selectedTable?.name}</Text>
              
              <View style={styles.inputContainer}>
                <Ionicons name="person" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Tên khách hàng"
                  placeholderTextColor="#94a3b8"
                  value={customerName}
                  onChangeText={setCustomerName}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Ionicons name="call" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Số điện thoại"
                  placeholderTextColor="#94a3b8"
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Ionicons name="time" size={20} color="#64748b" style={styles.inputIcon} />
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.datePickerText}>
                    {reservationTime.toLocaleString('vi-VN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="time-outline" size={24} color="#4361ee" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputContainer}>
                <Ionicons name="pencil" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ghi chú (tùy chọn)"
                  placeholderTextColor="#94a3b8"
                  value={reservationNote}
                  onChangeText={setReservationNote}
                  multiline
                />
              </View>
              
              {showDatePicker && (
                <DateTimePicker
                  value={reservationTime}
                  mode="datetime"
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    
                    if (event.type === 'set' && selectedDate) {
                      setReservationTime(selectedDate);
                    }
                  }}
                  minimumDate={new Date()}
                />
              )}
              
              <Pressable
                style={styles.confirmButton}
                onPress={confirmReservation}
              >
                <Text style={styles.confirmButtonText}>Xác nhận đặt bàn</Text>
              </Pressable>
              
              {Object.keys(preOrderCart).length > 0 && (
                <View style={styles.preOrderSummary}>
                  <Text style={styles.preOrderTitle}>Món đã đặt trước:</Text>
                  {Object.entries(preOrderCart).map(([productId, quantity]) => {
                    const product = products.find(p => p.id === productId);
                    return product ? (
                      <View key={productId} style={styles.preOrderItem}>
                        <Text style={styles.preOrderName}>{product.name}</Text>
                        <Text style={styles.preOrderQuantity}>x{quantity}</Text>
                      </View>
                    ) : null;
                  })}
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Order Modal (At Table) */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={orderModalVisible}
        onRequestClose={() => setOrderModalVisible(false)}
      >
        <View style={styles.orderModalContainer}>
          <View style={styles.orderModalHeader}>
            <Pressable 
              style={styles.backButton}
              onPress={() => setOrderModalVisible(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#334155" />
            </Pressable>
            <Text style={styles.orderModalTitle}>Đặt món - Bàn {selectedTable?.name}</Text>
          </View>
          
          {orderLoading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color="#4361ee" />
              <Text style={styles.loadingText}>Đang tải menu...</Text>
            </View>
          ) : (
            <>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm món..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              
              <FlatList
                data={products}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => renderProductItem({ item }, 'order')}
                contentContainerStyle={styles.productList}
                ListEmptyComponent={
                  <View style={styles.emptyProductContainer}>
                    <Ionicons name="fast-food" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyProductText}>Chưa có món nào trong menu</Text>
                  </View>
                }
              />
              
              {Object.keys(cart).length > 0 && (
                <View style={styles.cartSummary}>
                  <View style={styles.totalContainer}>
                    <Text style={styles.totalLabel}>Tổng cộng:</Text>
                    <Text style={styles.totalAmount}>{calculateTotal(cart).toLocaleString()}đ</Text>
                  </View>
                  
                  <Pressable
                    style={styles.confirmOrderButton}
                    onPress={confirmOrder}
                    disabled={orderLoading}
                  >
                    {orderLoading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.confirmOrderButtonText}>Xác nhận đặt món</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>

      {/* Pre-Order Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={preOrderModalVisible}
        onRequestClose={() => setPreOrderModalVisible(false)}
      >
        <View style={styles.orderModalContainer}>
          <View style={styles.orderModalHeader}>
            <Pressable 
              style={styles.backButton}
              onPress={() => setPreOrderModalVisible(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#334155" />
            </Pressable>
            <Text style={styles.orderModalTitle}>Món đặt trước - Bàn {selectedTable?.name}</Text>
          </View>
          
          {orderLoading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color="#4361ee" />
              <Text style={styles.loadingText}>Đang tải menu...</Text>
            </View>
          ) : (
            <>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm món..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              
              <FlatList
                data={products}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => renderProductItem({ item }, 'preorder')}
                contentContainerStyle={styles.productList}
                ListEmptyComponent={
                  <View style={styles.emptyProductContainer}>
                    <Ionicons name="fast-food" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyProductText}>Chưa có món nào trong menu</Text>
                  </View>
                }
              />
              
              {Object.keys(preOrderCart).length > 0 && (
                <View style={styles.cartSummary}>
                  <Pressable
                    style={styles.confirmOrderButton}
                    onPress={savePreOrder}
                  >
                    <Text style={styles.confirmOrderButtonText}>Lưu món đặt trước</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>

      {/* Takeaway Order Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={takeawayModalVisible}
        onRequestClose={() => setTakeawayModalVisible(false)}
      >
        <View style={styles.orderModalContainer}>
          <View style={styles.orderModalHeader}>
            <Pressable 
              style={styles.backButton}
              onPress={() => setTakeawayModalVisible(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#334155" />
            </Pressable>
            <Text style={styles.orderModalTitle}>Đặt món mang về</Text>
          </View>
          
          {orderLoading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator size="large" color="#4361ee" />
              <Text style={styles.loadingText}>Đang tải menu...</Text>
            </View>
          ) : (
            <>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm món..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              
              <FlatList
                data={products}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => renderProductItem({ item }, 'order')}
                contentContainerStyle={styles.productList}
                ListEmptyComponent={
                  <View style={styles.emptyProductContainer}>
                    <Ionicons name="fast-food" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyProductText}>Chưa có món nào trong menu</Text>
                  </View>
                }
              />
              
              {Object.keys(cart).length > 0 && (
                <View style={styles.cartSummary}>
                  <View style={styles.totalContainer}>
                    <Text style={styles.totalLabel}>Tổng cộng:</Text>
                    <Text style={styles.totalAmount}>{calculateTotal(cart).toLocaleString()}đ</Text>
                  </View>
                  
                  <Pressable
                    style={styles.confirmOrderButton}
                    onPress={confirmTakeawayOrder}
                    disabled={orderLoading}
                  >
                    {orderLoading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.confirmOrderButtonText}>Xác nhận đặt món</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f1f5f9',
  },
  timeButton: {
    padding: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
  },
  scrollContainer: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  branchText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 16,
    color: '#475569',
    marginRight: 12,
  },
  pickerContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    overflow: 'hidden',
  },
  zonePicker: {
    height: 50,
    width: '100%',
    color: '#334155',
  },
  areaSection: {
    marginBottom: 32,
  },
  areaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  areaName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginRight: 12,
  },
  areaCode: {
    fontSize: 16,
    color: '#64748b',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  tableItem: {
    width: 110,
    height: 130,
    borderRadius: 12,
    margin: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tableName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 4,
  },
  tableStatusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginVertical: 4,
  },
  tableStatus: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  tableCapacity: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 16,
  },
  emptyTableText: {
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1e293b',
    textAlign: 'center',
  },
  tableInfo: {
    fontSize: 16,
    marginBottom: 24,
    color: '#475569',
    textAlign: 'center',
  },
  statusOption: {
    width: '100%',
    padding: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#334155',
  },
  cancelButton: {
    marginTop: 8,
    padding: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
  },
  reservationModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#334155',
  },
  datePickerButton: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  datePickerText: {
    fontSize: 16,
    color: '#334155',
  },
  confirmButton: {
    backgroundColor: '#4361ee',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  preOrderSummary: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  preOrderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#334155',
  },
  preOrderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  preOrderName: {
    fontSize: 14,
    color: '#475569',
  },
  preOrderQuantity: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  orderModalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  orderModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  orderModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1,
    textAlign: 'center',
    marginRight: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 12,
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#334155',
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748b',
  },
  productList: {
    padding: 16,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  // Style cho sản phẩm hết hàng
  outOfStockItem: {
    opacity: 0.6,
  },
  outOfStockImage: {
    opacity: 0.5,
  },
  outOfStockText: {
    color: '#94a3b8',
  },
  outOfStockLabel: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
    marginBottom: 4,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  salePrice: {
    color: '#dc2626',
  },
  originalPrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    padding: 4,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
  },
  disabledButton: {
    opacity: 0.5,
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
  },
  quantityText: {
    marginHorizontal: 8,
    fontSize: 16,
    minWidth: 24,
    textAlign: 'center',
    color: '#1e293b',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  paginationButton: {
    padding: 8,
    marginHorizontal: 8,
  },
  paginationText: {
    fontSize: 16,
    color: '#475569',
    marginHorizontal: 8,
  },
  emptyProductContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyProductText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 16,
    textAlign: 'center',
  },
  cartSummary: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  confirmOrderButton: {
    backgroundColor: '#4361ee',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmOrderButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: '#4361ee',
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  fabText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  pickerItem: {
    fontSize: 16,
    color: '#334155',
  },
  customerModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  customerInfoContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  customerInfoText: {
    fontSize: 16,
    color: '#0369a1',
    marginBottom: 8,
  },
  checkButton: {
    backgroundColor: '#e2e8f0',
    padding: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
});

function removeFromCart(id: any, cartType: string): void {
  throw new Error('Function not implemented.');
}
function addToCart(id: any, cartType: string): void {
  throw new Error('Function not implemented.');
}

