import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, 
  TouchableOpacity, Alert, Image, Animated,
  ActivityIndicator, Modal
} from 'react-native';
import { getDatabase, ref, get, update, runTransaction, onChildAdded, off } from 'firebase/database';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Hàm chuyển đổi datetime string sang timestamp
const parseDateTime = (datetimeStr: string): number => {
  try {
    const [datePart, timePart] = datetimeStr.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    const dateObj = new Date(year, month - 1, day, hour, minute);
    
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date:', datetimeStr);
      return 0;
    }
    
    return dateObj.getTime();
  } catch (error) {
    console.error('Lỗi khi phân tích thời gian:', error, datetimeStr);
    return 0;
  }
};

export default function PaymentScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [userPaymentInfo, setUserPaymentInfo] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | null>(null);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(300))[0];
  const [latestTransaction, setLatestTransaction] = useState<any>(null);
  const [showTransactionAlert, setShowTransactionAlert] = useState(false);
  const receiptOpenTimestampRef = useRef(new Date().getTime());

  useEffect(() => {
    if (orderId) fetchOrderAndUser();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [orderId]);

  useEffect(() => {
    if (paymentMethod) {
      slideAnim.setValue(300);
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [paymentMethod]);

  // Thêm useEffect để lắng nghe giao dịch chuyển khoản
  useEffect(() => {
    const setupTransactionListener = () => {
      const db = getDatabase();
      const transactionsRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/smsbank`);
      
      const handleNewTransaction = (snapshot: any) => {
        const newTransaction = snapshot.val();
        console.log('Nhận giao dịch mới:', newTransaction);
        
        // Kiểm tra xem giao dịch có thời gian sau khi mở màn hình không
        const transactionTime = parseDateTime(newTransaction.datetime);
        if (transactionTime > receiptOpenTimestampRef.current) {
          setLatestTransaction(newTransaction);
          setShowTransactionAlert(true);
        }
      };
      
      onChildAdded(transactionsRef, handleNewTransaction);
      
      return () => {
        off(transactionsRef, 'child_added', handleNewTransaction);
      };
    };

    const cleanup = setupTransactionListener();
    return cleanup;
  }, [orderId]);

  const handleConfirmPaymentFromTransaction = () => {
    setShowTransactionAlert(false);
    setPaymentMethod('bank');
    Alert.alert(
      'Xác nhận thành công',
      `Đã nhận ${latestTransaction?.amount} VND từ ${latestTransaction?.bankName}`,
      [{ text: 'OK', onPress: handlePayment }]
    );
  };

  const fetchOrderAndUser = async () => {
    try {
      const db = getDatabase();
      const orderRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/CN001/orders/${orderId}`);
      const orderSnap = await get(orderRef);
      
      if (orderSnap.exists()) {
        const orderData = orderSnap.val();
        setOrder(orderData);
        
        if (orderData.customerPhone) {
          const clientsRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/CN001/clients`);
          const clientsSnap = await get(clientsRef);
          
          if (clientsSnap.exists()) {
            const clients = clientsSnap.val();
            const clientKey = Object.keys(clients).find(
              key => clients[key].phone === orderData.customerPhone
            );
            
            if (clientKey) {
              setClientInfo(clients[clientKey]);
            }
          }
        }
      }
      
      // Lấy thông tin chủ cửa hàng từ node info_user
      const ownerRef = ref(db, 'users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/info_user');
      const ownerSnap = await get(ownerRef);
      
      if (ownerSnap.exists()) {
        const ownerData = ownerSnap.val();
        setUserPaymentInfo({
          storeName: ownerData.restaurantName || 'Foodiee',
          bankName: ownerData.bankName || 'Chưa cập nhật',
          bankAccount: ownerData.bankAccount || 'Chưa cập nhật',
          accountHolder: ownerData.accountHolder || 'Chưa cập nhật',
          qrUrl: ownerData.qrUrl || null
        });
      } else {
        // Fallback nếu không tìm thấy thông tin
        setUserPaymentInfo({
          storeName: 'Foodiee',
          bankName: 'Chưa cập nhật',
          bankAccount: 'Chưa cập nhật',
          accountHolder: 'Chưa cập nhật',
          qrUrl: null
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin đơn hàng');
    }
  };

  const applyVoucher = async () => {
    if (!voucherCode.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập mã giảm giá');
      return;
    }

    setIsApplyingVoucher(true);
    
    try {
      const db = getDatabase();
      const vouchersRef = ref(db, 'users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/vouchers');
      const voucherSnap = await get(vouchersRef);
      
      if (!voucherSnap.exists()) {
        return Alert.alert('Lỗi', 'Không tìm thấy mã giảm giá');
      }

      const vouchers = voucherSnap.val();
      const voucherKey = Object.keys(vouchers).find(
        key => vouchers[key].code === voucherCode
      );
      
      if (!voucherKey) {
        return Alert.alert('Lỗi', 'Mã giảm giá không hợp lệ');
      }

      const voucher = vouchers[voucherKey];
      const now = new Date();
      const startDate = new Date(voucher.startDate);
      const endDate = new Date(voucher.endDate);

      // Check voucher validity
      if (voucher.status !== 'active') {
        return Alert.alert('Lỗi', 'Mã giảm giá không còn hiệu lực');
      }

      if (now < startDate) {
        return Alert.alert('Lỗi', 'Mã giảm giá chưa có hiệu lực');
      }

      if (now > endDate) {
        return Alert.alert('Lỗi', 'Mã giảm giá đã hết hạn');
      }

      if (voucher.used >= voucher.total) {
        return Alert.alert('Lỗi', 'Mã giảm giá đã hết số lượng');
      }

      // Check if order meets minimum order requirement
      if (order.total < voucher.minOrder) {
        return Alert.alert('Lỗi', `Đơn hàng phải có giá trị tối thiểu ${voucher.minOrder.toLocaleString()}đ`);
      }

      // Check if voucher applies to any items in the order
      let applicableItems = order.items;
      if (voucher.products && voucher.products.length > 0) {
        applicableItems = order.items.filter((item: any) => 
          voucher.products.includes(item.productId)
        );
        
        if (applicableItems.length === 0) {
          return Alert.alert('Lỗi', 'Mã giảm giá không áp dụng cho sản phẩm trong đơn hàng');
        }
      }

      // Calculate discount based on applicable items
      let calculatedDiscount = 0;
      const applicableTotal = applicableItems.reduce(
        (sum: number, item: any) => sum + (item.price * item.quantity), 0
      );

      if (voucher.discountType === 'amount') {
        calculatedDiscount = Math.min(voucher.discountValue, applicableTotal);
        if (voucher.maxDiscount > 0) {
          calculatedDiscount = Math.min(calculatedDiscount, voucher.maxDiscount);
        }
      } else if (voucher.discountType === 'percent') {
        calculatedDiscount = Math.floor((applicableTotal * voucher.discountValue) / 100);
        if (voucher.maxDiscount > 0) {
          calculatedDiscount = Math.min(calculatedDiscount, voucher.maxDiscount);
        }
      }

      // Check per user limit
      if (voucher.perUserLimit > 0) {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          const userVouchersRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/userVouchers/${userId}/${voucherKey}`);
          const userVoucherSnap = await get(userVouchersRef);
          
          if (userVoucherSnap.exists()) {
            const userVoucher = userVoucherSnap.val();
            if (userVoucher.used >= voucher.perUserLimit) {
              return Alert.alert('Lỗi', 'Bạn đã sử dụng hết số lần áp dụng mã giảm giá này');
            }
          }
        }
      }

      setDiscount(calculatedDiscount);
      setAppliedVoucher({ ...voucher, id: voucherKey });
      Alert.alert('Thành công', 'Mã giảm giá đã được áp dụng');
    } catch (error) {
      console.error('Error applying voucher:', error);
      Alert.alert('Lỗi', 'Không thể áp dụng mã giảm giá');
    } finally {
      setIsApplyingVoucher(false);
    }
  };

  const updateVoucherUsage = async () => {
    if (!appliedVoucher) return;

    try {
      const db = getDatabase();
      const voucherRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/vouchers/${appliedVoucher.id}`);

      // Update voucher usage count
      await runTransaction(voucherRef, (currentData) => {
        if (currentData) {
          currentData.used = (currentData.used || 0) + 1;
          if (currentData.used >= currentData.total) {
            currentData.status = 'inactive';
          }
        }
        return currentData;
      });

      // Update per user usage if limit exists
      if (appliedVoucher.perUserLimit > 0) {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          const userVoucherRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/userVouchers/${userId}/${appliedVoucher.id}`);
          
          await runTransaction(userVoucherRef, (currentData) => {
            const newData = currentData || { used: 0 };
            newData.used = (newData.used || 0) + 1;
            return newData;
          });
        }
      }
    } catch (error) {
      console.error('Error updating voucher usage:', error);
    }
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      Alert.alert('Thông báo', 'Vui lòng chọn phương thức thanh toán');
      return;
    }
    
    try {
      const db = getDatabase();
      const orderRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/CN001/orders/${orderId}`);
      
      // Cập nhật trạng thái đơn hàng thành "đã thanh toán"
      await update(orderRef, { 
        status: 'đã thanh toán',
        paymentMethod,
        updatedAt: new Date().toISOString(),
        discount: discount,
        voucherCode: appliedVoucher?.code || null
      });

      // Cập nhật trạng thái bàn nếu là đơn tại chỗ
      if (order?.tableId) {
        const tableRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/CN001/local/tables/${order.tableId}`);
        await update(tableRef, {
          status: 'empty',
          currentOrder: null
        });
      }

      // Cập nhật voucher nếu áp dụng
      if (appliedVoucher) {
        await updateVoucherUsage();
      }

      // Hiển thị thông báo thành công
      Alert.alert(
        'Thành công', 
        'Đơn hàng đã được thanh toán thành công',
        [
          { 
            text: 'OK', 
            onPress: () => router.push({
              pathname: '/receipt',
              params: {
                orderId: orderId as string,
                method: paymentMethod,
                total: order.total.toString(),
                discount: discount.toString(),
                clientName: order.customerName || clientInfo?.name || '',
                clientPhone: order.customerPhone || clientInfo?.phone || '',
                storeName: userPaymentInfo?.storeName || 'Foodiee',
                branchName: order.branchName || 'Chi nhánh Đà Nẵng',
                createdAt: order.createdAt || new Date().toISOString(),
                voucherCode: appliedVoucher?.code || ''
              }
            })
          }
        ]
      );
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Lỗi', 'Không thể hoàn tất thanh toán');
    }
  };

  const total = order?.total || 0;
  const finalAmount = Math.max(total - discount, 0);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Thanh toán đơn hàng</Text>
        </View>

        {order ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Thông tin đơn hàng</Text>
              
              <View style={styles.orderInfo}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mã đơn hàng:</Text>
                  <Text style={styles.infoValue}>{orderId}</Text>
                </View>
                
                {(order.customerName || clientInfo?.name) && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Khách hàng:</Text>
                    <Text style={styles.infoValue}>{order.customerName || clientInfo?.name}</Text>
                  </View>
                )}
                
                {(order.customerPhone || clientInfo?.phone) && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Số điện thoại:</Text>
                    <Text style={styles.infoValue}>{order.customerPhone || clientInfo?.phone}</Text>
                  </View>
                )}
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nhà hàng:</Text>
                  <Text style={styles.infoValue}>{userPaymentInfo?.storeName || 'Foodiee'}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Chi nhánh:</Text>
                  <Text style={styles.infoValue}>{order.branchName || 'Chi nhánh Đà Nẵng'}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Thời gian:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(order.createdAt || new Date()).toLocaleString()}
                  </Text>
                </View>
                
                {order.tableName && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Bàn:</Text>
                    <Text style={styles.infoValue}>{order.tableName}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Chi tiết đơn hàng</Text>
              
              {order.items?.map((item: any, idx: number) => (
                <View key={idx} style={styles.itemRow}>
                  <Text style={styles.itemName}>• {item.name}</Text>
                  <Text style={styles.itemPrice}>{item.quantity} x {item.price.toLocaleString()}đ</Text>
                </View>
              ))}
              
              <View style={styles.divider} />
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tạm tính:</Text>
                <Text style={styles.summaryValue}>{total.toLocaleString()}đ</Text>
              </View>
              
              {discount > 0 && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Giảm giá:</Text>
                    <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                      -{discount.toLocaleString()}đ
                    </Text>
                  </View>
                  {appliedVoucher && (
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { fontSize: 12, color: '#64748b' }]}>
                        (Áp dụng mã: {appliedVoucher.code})
                      </Text>
                    </View>
                  )}
                </>
              )}
              
              <View style={[styles.summaryRow, { marginTop: 10 }]}>
                <Text style={[styles.summaryLabel, { fontWeight: '700' }]}>Tổng cộng:</Text>
                <Text style={[styles.summaryValue, { fontWeight: '700', fontSize: 18, color: '#ef4444' }]}>
                  {finalAmount.toLocaleString()}đ
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Mã giảm giá</Text>
              
              <View style={styles.voucherContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mã giảm giá..."
                  placeholderTextColor="#94a3b8"
                  value={voucherCode}
                  onChangeText={setVoucherCode}
                />
                <TouchableOpacity 
                  style={[styles.applyButton, isApplyingVoucher && styles.disabledButton]}
                  onPress={applyVoucher}
                  disabled={isApplyingVoucher}
                >
                  {isApplyingVoucher ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.applyButtonText}>Áp dụng</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
              
              <View style={styles.paymentMethods}>
                <TouchableOpacity 
                  style={[
                    styles.methodButton, 
                    paymentMethod === 'cash' && styles.selectedMethod
                  ]}
                  onPress={() => setPaymentMethod('cash')}
                >
                  <Ionicons 
                    name="cash-outline" 
                    size={24} 
                    color={paymentMethod === 'cash' ? '#3b82f6' : '#64748b'} 
                  />
                  <Text style={styles.methodText}>Tiền mặt</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.methodButton, 
                    paymentMethod === 'bank' && styles.selectedMethod
                  ]}
                  onPress={() => setPaymentMethod('bank')}
                >
                  <Ionicons 
                    name="card-outline" 
                    size={24} 
                    color={paymentMethod === 'bank' ? '#3b82f6' : '#64748b'} 
                  />
                  <Text style={styles.methodText}>Chuyển khoản</Text>
                </TouchableOpacity>
              </View>
              
              {paymentMethod === 'bank' && (
                <Animated.View style={[styles.bankDetails, { transform: [{ translateY: slideAnim }] }]}>
                  <Text style={styles.bankTitle}>Thông tin chuyển khoản</Text>
                  
                  <View style={styles.bankInfo}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Ngân hàng:</Text>
                      <Text style={styles.infoValue}>
                        {userPaymentInfo?.bankName || 'Chưa cập nhật'}
                      </Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Số tài khoản:</Text>
                      <Text style={styles.infoValue}>
                        {userPaymentInfo?.bankAccount || 'Chưa cập nhật'}
                      </Text>
                    </View>
                    
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Tên tài khoản:</Text>
                      <Text style={styles.infoValue}>
                        {userPaymentInfo?.accountHolder || 'Chưa cập nhật'}
                      </Text>
                    </View>
                  </View>
                  
                  {userPaymentInfo?.qrUrl ? (
                    <>
                      <Text style={styles.qrTitle}>Mã QR thanh toán</Text>
                      <Image 
                        source={{ uri: userPaymentInfo.qrUrl }} 
                        style={styles.qrImage} 
                        resizeMode="contain"
                      />
                    </>
                  ) : (
                    <Text style={styles.qrMissing}>Không có mã QR</Text>
                  )}
                </Animated.View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Đang tải thông tin đơn hàng...</Text>
          </View>
        )}
      </ScrollView>
      
      {order && (
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']}
          style={styles.footer}
        >
          <TouchableOpacity 
            style={styles.payButton} 
            onPress={handlePayment}
            disabled={!paymentMethod}
          >
            <Text style={styles.payButtonText}>
              XÁC NHẬN THANH TOÁN - {finalAmount.toLocaleString()}đ
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      )}

      {/* Transaction Alert Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showTransactionAlert}
        onRequestClose={() => setShowTransactionAlert(false)}
      >
        <View style={styles.alertContainer}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>THÔNG BÁO CHUYỂN KHOẢN</Text>
            
            {latestTransaction && (
              <>
                <Text style={styles.alertText}>
                  Ngân hàng: <Text style={styles.alertHighlight}>{latestTransaction.bankName}</Text>
                </Text>
                
                <Text style={styles.alertText}>
                  Số tiền: <Text style={styles.alertAmount}>{latestTransaction.amount} VND</Text>
                </Text>
                
                <Text style={styles.alertText}>
                  Nội dung: {latestTransaction.message}
                </Text>
                
                <Text style={styles.alertText}>
                  Thời gian: {latestTransaction.datetime}
                </Text>
              </>
            )}
            
            <View style={styles.alertButtons}>
              <TouchableOpacity 
                style={[styles.alertButton, styles.cancelButton]}
                onPress={() => setShowTransactionAlert(false)}
              >
                <Text style={styles.cancelButtonText}>ĐÓNG</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.alertButton, styles.confirmButton]}
                onPress={handleConfirmPaymentFromTransaction}
              >
                <Text style={styles.confirmButtonText}>XÁC NHẬN THANH TOÁN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1e293b',
  },
  orderInfo: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontWeight: '600',
    color: '#1e293b',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 4,
  },
  itemName: {
    flex: 1,
    color: '#334155',
    fontWeight: '500',
  },
  itemPrice: {
    fontWeight: '600',
    color: '#1e293b',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    color: '#64748b',
  },
  summaryValue: {
    fontWeight: '600',
    color: '#1e293b',
  },
  voucherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  applyButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: '#94a3b8',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  paymentMethods: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 5,
  },
  selectedMethod: {
    borderColor: '#3b82f6',
    backgroundColor: '#dbeafe',
  },
  methodText: {
    marginLeft: 8,
    fontWeight: '600',
    color: '#1e293b',
  },
  bankDetails: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
  bankTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
    color: '#1e293b',
  },
  bankInfo: {
    marginBottom: 16,
  },
  qrTitle: {
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 12,
    textAlign: 'center',
    color: '#1e293b',
  },
  qrImage: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qrMissing: {
    textAlign: 'center',
    color: '#ef4444',
    marginVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#64748b',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 30,
  },
  payButton: {
    backgroundColor: '#3b82f6',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 3,
  },
  payButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  
  // Styles for transaction alert
  alertContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  alertContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3b82f6',
    textAlign: 'center',
    marginBottom: 15,
  },
  alertText: {
    fontSize: 16,
    marginVertical: 5,
    color: '#1e293b',
  },
  alertHighlight: {
    fontWeight: '700',
    color: '#3b82f6',
  },
  alertAmount: {
    fontWeight: '700',
    color: '#10b981',
  },
  alertButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  alertButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  cancelButtonText: {
    color: '#64748b',
    fontWeight: '600',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
});