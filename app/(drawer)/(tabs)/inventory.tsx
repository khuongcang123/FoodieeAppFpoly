import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
  FlatList,
  Alert,
  Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { useRouter } from 'expo-router';

// Lấy kích thước màn hình
const { height: screenHeight } = Dimensions.get('window');

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState<any>({});
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderDetailModalVisible, setOrderDetailModalVisible] = useState(false);
  const [updateStatusModalVisible, setUpdateStatusModalVisible] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const router = useRouter();
  
  const db = getDatabase();

  useEffect(() => {
    const loadBranchData = async () => {
      const branchData = await AsyncStorage.getItem('selectedBranch');
      if (branchData) {
        const branchObj = JSON.parse(branchData);
        setBranch(branchObj);
        loadOrders(branchObj.code);
      }
    };
    loadBranchData();
  }, []);

  const loadOrders = (branchCode: string) => {
    try {
      const ordersRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/${branchCode}/orders`);
      
      onValue(ordersRef, (snapshot) => {
        if (snapshot.exists()) {
          const ordersData = snapshot.val();
          // Chuyển đổi object thành mảng
          const ordersArray = Object.entries(ordersData).map(([key, value]) => ({
            id: key,
            ...(value as any),
          }));
          // Sắp xếp theo thời gian tạo (mới nhất trước)
          ordersArray.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setOrders(ordersArray);
        } else {
          setOrders([]);
        }
        setLoading(false);
      });
    } catch (error) {
      console.error("Error loading orders:", error);
      setLoading(false);
    }
  };

  const handleOrderPress = (order: any) => {
    setSelectedOrder(order);
    setOrderDetailModalVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#f59e0b';
      case 'processing': return '#3b82f6';
      case 'serving': return '#8b5cf6';
      case 'completed': return '#10b981';
      case 'paid': return '#10b981';
      case 'cancelled': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Chờ xác nhận';
      case 'processing': return 'Đang chuẩn bị';
      case 'serving': return 'Đang phục vụ';
      case 'completed': return 'Hoàn thành';
      case 'paid': return 'Đã thanh toán';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openUpdateStatusModal = () => {
    setUpdateStatusModalVisible(true);
    setNewStatus('');
  };

  const updateOrderStatus = async () => {
    if (!newStatus || !selectedOrder || !branch.code) return;
    
    try {
      const orderRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/${branch.code}/orders/${selectedOrder.id}`);
      
      await update(orderRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      const updatedOrders = orders.map(order => 
        order.id === selectedOrder.id ? { ...order, status: newStatus } : order
      );
      setOrders(updatedOrders);
      setSelectedOrder({ ...selectedOrder, status: newStatus });
      
      setUpdateStatusModalVisible(false);
      Alert.alert('Thành công', 'Cập nhật trạng thái đơn hàng thành công!');
    } catch (error) {
      console.error("Error updating order status:", error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi cập nhật trạng thái đơn hàng');
    }
  };

  const handlePayment = () => {
    if (!selectedOrder || !branch.code) return;
    
    router.push({
      pathname: '/payment',
      params: {
        orderId: selectedOrder.id,
        branchCode: branch.code,
        orderPath: `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/${branch.code}/orders/${selectedOrder.id}`,
        totalAmount: selectedOrder.total,
        orderType: selectedOrder.type
      }
    });
    
    setOrderDetailModalVisible(false);
  };

  const getAvailableStatusOptions = () => {
    if (!selectedOrder) return [];
    
    const currentStatus = selectedOrder.status;
    
    if (selectedOrder.type === 'dine-in') {
      switch (currentStatus) {
        case 'active': return [
          { value: 'processing', label: 'Đã nhận đơn' },
          { value: 'cancelled', label: 'Hủy đơn' }
        ];
        case 'processing': return [
          { value: 'serving', label: 'Đang phục vụ' },
          { value: 'cancelled', label: 'Hủy đơn' }
        ];
        case 'serving': return [
          { value: 'completed', label: 'Hoàn thành' },
          { value: 'cancelled', label: 'Hủy đơn' }
        ];
        case 'completed': return [
          { value: 'paid', label: 'Đã thanh toán' },
          { value: 'cancelled', label: 'Hủy đơn' }
        ];
        default: return [];
      }
    }
    else {
      switch (currentStatus) {
        case 'active': return [
          { value: 'processing', label: 'Đã nhận đơn' },
          { value: 'cancelled', label: 'Hủy đơn' }
        ];
        case 'processing': return [
          { value: 'completed', label: 'Đã làm xong' },
          { value: 'cancelled', label: 'Hủy đơn' }
        ];
        case 'completed': return [
          { value: 'paid', label: 'Đã thanh toán' },
          { value: 'cancelled', label: 'Hủy đơn' }
        ];
        default: return [];
      }
    }
  };

  const renderStatusOptions = () => {
    const options = getAvailableStatusOptions();
    
    return (
      <View style={styles.statusOptionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.statusOptionButton,
              newStatus === option.value && styles.selectedStatusOption
            ]}
            onPress={() => setNewStatus(option.value)}
          >
            <Text style={styles.statusOptionText}>{option.label}</Text>
          </TouchableOpacity>
        ))}
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
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
      >


        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="receipt" size={48} color="#94a3b8" />
            <Text style={styles.emptyText}>Chưa có đơn hàng nào</Text>
          </View>
        ) : (
          orders.map(order => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderItem}
              onPress={() => handleOrderPress(order)}
            >
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>Đơn #{order.id.substring(0, 6)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                  <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
                </View>
              </View>
              
              <View style={styles.orderInfoRow}>
                <Ionicons name="time-outline" size={16} color="#64748b" />
                <Text style={styles.orderInfoText}>{formatDate(order.createdAt)}</Text>
              </View>
              
              {order.customerName && (
                <View style={styles.orderInfoRow}>
                  <Ionicons name="person-outline" size={16} color="#64748b" />
                  <Text style={styles.orderInfoText}>{order.customerName}</Text>
                </View>
              )}
              
              {order.tableName && (
                <View style={styles.orderInfoRow}>
                  <Ionicons name="restaurant-outline" size={16} color="#64748b" />
                  <Text style={styles.orderInfoText}>Bàn: {order.tableName}</Text>
                </View>
              )}
              
              <View style={styles.orderInfoRow}>
                <Ionicons name="pricetag-outline" size={16} color="#64748b" />
                <Text style={styles.orderTotal}>Tổng: {order.total?.toLocaleString()}đ</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Order Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={orderDetailModalVisible}
        onRequestClose={() => setOrderDetailModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setOrderDetailModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <Pressable 
              style={styles.orderDetailModal}
              onPress={(e) => e.stopPropagation()}
            >
              {selectedOrder && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Chi tiết đơn hàng</Text>
                    <TouchableOpacity
                      style={styles.closeIcon}
                      onPress={() => setOrderDetailModalVisible(false)}
                    >
                      <Ionicons name="close" size={24} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                  
                  <ScrollView 
                    style={styles.modalScrollContent}
                    contentContainerStyle={styles.modalScrollContentContainer}
                  >
                    <View style={styles.orderDetailHeader}>
                      <Text style={styles.orderDetailId}>Đơn #{selectedOrder.id.substring(0, 6)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.status) }]}>
                        <Text style={styles.statusText}>{getStatusText(selectedOrder.status)}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.orderDetailInfo}>
                      <Text style={styles.orderDetailLabel}>Thời gian:</Text>
                      <Text style={styles.orderDetailText}>{formatDate(selectedOrder.createdAt)}</Text>
                    </View>
                    
                    {selectedOrder.customerName && (
                      <View style={styles.orderDetailInfo}>
                        <Text style={styles.orderDetailLabel}>Khách hàng:</Text>
                        <Text style={styles.orderDetailText}>{selectedOrder.customerName}</Text>
                      </View>
                    )}
                    
                    {selectedOrder.customerPhone && (
                      <View style={styles.orderDetailInfo}>
                        <Text style={styles.orderDetailLabel}>Điện thoại:</Text>
                        <Text style={styles.orderDetailText}>{selectedOrder.customerPhone}</Text>
                      </View>
                    )}
                    
                    {selectedOrder.tableName && (
                      <View style={styles.orderDetailInfo}>
                        <Text style={styles.orderDetailLabel}>Bàn:</Text>
                        <Text style={styles.orderDetailText}>{selectedOrder.tableName}</Text>
                      </View>
                    )}
                    
                    <View style={styles.orderDetailInfo}>
                      <Text style={styles.orderDetailLabel}>Loại đơn:</Text>
                      <Text style={styles.orderDetailText}>
                        {selectedOrder.type === 'dine-in' ? 'Tại chỗ' : 'Mang về'}
                      </Text>
                    </View>
                    
                    <Text style={styles.sectionTitle}>Món đã đặt:</Text>
                    <FlatList
                      data={selectedOrder.items}
                      keyExtractor={(item, index) => index.toString()}
                      scrollEnabled={false}
                      renderItem={({ item }) => (
                        <View style={styles.orderItemDetail}>
                          <View style={styles.orderItemInfo}>
                            {item.image ? (
                              <Image 
                                source={{ uri: item.image }} 
                                style={styles.productImageSmall} 
                              />
                            ) : (
                              <View style={[styles.productImageSmall, styles.imagePlaceholder]}>
                                <Ionicons name="fast-food" size={20} color="#94a3b8" />
                              </View>
                            )}
                            <Text style={styles.orderItemName} numberOfLines={1}>{item.name}</Text>
                          </View>
                          <View style={styles.orderItemQuantityRow}>
                            <Text style={styles.orderItemQuantity}>x{item.quantity}</Text>
                            <Text style={styles.orderItemPrice}>{item.price.toLocaleString()}đ</Text>
                          </View>
                        </View>
                      )}
                    />
                    
                    <View style={styles.orderTotalRow}>
                      <Text style={styles.orderTotalLabel}>Tổng cộng:</Text>
                      <Text style={styles.orderTotalAmount}>{selectedOrder.total.toLocaleString()}đ</Text>
                    </View>
                  </ScrollView>
                  
                  <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity
                      style={styles.updateStatusButton}
                      onPress={openUpdateStatusModal}
                    >
                      <Text style={styles.updateStatusButtonText}>Cập nhật trạng thái</Text>
                    </TouchableOpacity>
                    
                    {(selectedOrder.status === 'completed' || selectedOrder.status === 'serving') && (
                      <TouchableOpacity
                        style={styles.paymentButton}
                        onPress={handlePayment}
                      >
                        <Text style={styles.paymentButtonText}>Thanh toán</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={updateStatusModalVisible}
        onRequestClose={() => setUpdateStatusModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setUpdateStatusModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.statusModalContent}>
              <Text style={styles.modalTitle}>Cập nhật trạng thái</Text>
              
              <Text style={styles.currentStatusText}>
                Trạng thái hiện tại: 
                <Text style={{ color: getStatusColor(selectedOrder?.status), fontWeight: 'bold' }}>
                  {' '}{getStatusText(selectedOrder?.status)}
                </Text>
              </Text>
              
              <Text style={styles.selectStatusText}>Chọn trạng thái mới:</Text>
              
              {renderStatusOptions()}
              
              <View style={styles.statusModalButtons}>
                <TouchableOpacity
                  style={[styles.statusModalButton, styles.cancelButton]}
                  onPress={() => setUpdateStatusModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Hủy</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.statusModalButton, styles.confirmButton]}
                  onPress={updateOrderStatus}
                  disabled={!newStatus}
                >
                  <Text style={styles.confirmButtonText}>Cập nhật</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  // Thêm container cho nội dung cuộn
  scrollContentContainer: {
    paddingBottom: 90, // Đảm bảo không bị tab bar che
  },
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  branchText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
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
  orderItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderInfoText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 8,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    height: screenHeight * 0.85,
    maxHeight: '90%',
  },
  orderDetailModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeIcon: {
    padding: 4,
  },
  modalScrollContent: {
    flex: 1,
    padding: 16,
  },
  // Thêm padding bottom cho nội dung modal
  modalScrollContentContainer: {
    paddingBottom: 20,
  },
  orderDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderDetailId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  orderDetailInfo: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  orderDetailLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    width: 100,
  },
  orderDetailText: {
    fontSize: 16,
    color: '#475569',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#1e293b',
  },
  orderItemDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  orderItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productImageSmall: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f1f5f9',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderItemName: {
    fontSize: 16,
    color: '#334155',
    flex: 1,
  },
  orderItemQuantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
    justifyContent: 'space-between',
  },
  orderItemQuantity: {
    fontSize: 16,
    color: '#64748b',
  },
  orderItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  orderTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  orderTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  orderTotalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 10,
  },
  updateStatusButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  updateStatusButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentButton: {
    flex: 1,
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  paymentButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  currentStatusText: {
    fontSize: 16,
    marginBottom: 20,
    color: '#475569',
    textAlign: 'center',
  },
  selectStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1e293b',
    textAlign: 'center',
  },
  statusOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  statusOptionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  selectedStatusOption: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  statusOptionText: {
    fontSize: 16,
    color: '#334155',
  },
  statusModalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  statusModalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});