import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Share,
  Dimensions,
  useWindowDimensions
} from 'react-native';
import { getDatabase, ref, onChildAdded, off, get } from 'firebase/database';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

// ID cụ thể của tài khoản manager (Foodlee)
const MANAGER_ID = 'dg0nQI4hyqXbo7oLhj5xbuPc9Pd2';

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

export default function ReceiptScreen() {
  const router = useRouter();
  const { 
    orderId,
    method, 
    total, 
    discount, 
    storeName = 'Foodiee',
    clientName,
    clientPhone,
    branchName,
    createdAt
  } = useLocalSearchParams();
  
  const windowDimensions = useWindowDimensions();
  const screenWidth = windowDimensions.width;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const viewShotRef = useRef<any>(null);
  const hiddenViewShotRef = useRef<any>(null);
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  const [isExporting, setIsExporting] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);

  const [bankInfo, setBankInfo] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    qrImage: '',
  });
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState('Chưa xác nhận');
  const [showTransactionAlert, setShowTransactionAlert] = useState(false);
  const [latestTransaction, setLatestTransaction] = useState<any>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  
  const [receiptOpenTime] = useState<Date>(new Date());
  const receiptOpenTimestampRef = useRef(receiptOpenTime.getTime());

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const fetchOrderDetails = async () => {
      try {
        const db = getDatabase();
        const orderRef = ref(db, `users/${MANAGER_ID}/branches/CN001/orders/${orderId}`);
        const snapshot = await get(orderRef);
        
        if (snapshot.exists()) {
          setOrderDetails(snapshot.val());
        }
      } catch (error) {
        console.error('Error fetching order details:', error);
      }
    };

    const fetchBankInfo = async () => {
      try {
        const db = getDatabase();
        const paymentRef = ref(db, `users/${MANAGER_ID}/info_user`);
        const snapshot = await get(paymentRef);
        
        if (snapshot.exists()) {
          const paymentData = snapshot.val();
          setBankInfo({
            accountName: paymentData.accountHolder || '',
            accountNumber: paymentData.bankAccount || '',
            bankName: paymentData.bankName || 'Foodiee',
            qrImage: paymentData.qrUrl || ''
          });
        }
      } catch (error) {
        console.log('Lỗi khi lấy thông tin thanh toán:', error);
      } finally {
        setLoading(false);
      }
    };

    const setupTransactionListener = () => {
      const db = getDatabase();
      // CẬP NHẬT ĐƯỜNG DẪN MỚI
      const transactionsRef = ref(db, `users/${MANAGER_ID}/smsbank`);
      
      onChildAdded(transactionsRef, (snapshot) => {
        const newTransaction = snapshot.val();
        console.log('Nhận giao dịch mới:', newTransaction);
        
        // Sử dụng trường timestamp từ dữ liệu mới
        if (newTransaction && newTransaction.timestamp > receiptOpenTimestampRef.current) {
          setLatestTransaction(newTransaction);
          setShowTransactionAlert(true);
          
          setTimeout(() => {
            setShowTransactionAlert(false);
          }, 10000);
        }
      });
      
      return () => {
        off(transactionsRef);
      };
    };

    fetchOrderDetails();
    fetchBankInfo();
    const cleanup = setupTransactionListener();
    
    return cleanup;
  }, [orderId]);

  const totalNumber = parseInt(total as string, 10) || 0;
  const discountNumber = parseInt(discount as string, 10) || 0;
  const finalAmount = Math.max(totalNumber - discountNumber, 0);

  const handleCloseAlert = () => {
    setShowTransactionAlert(false);
  };

  const handleConfirmPayment = () => {
    setShowTransactionAlert(false);
    setPaymentStatus('Đã nhận tiền');
    Alert.alert(
      'Xác nhận thành công',
      `Đã xác nhận nhận ${latestTransaction?.amount} VND từ Sacombank`,
      [{ text: 'OK' }]
    );
  };

  const formatReceiptTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    const seconds = dateObj.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatReceiptDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Hàm tạo toàn bộ nội dung hóa đơn (dùng cho cả hiển thị và xuất)
  const renderReceiptContent = (isForExport = false) => (
    <Animated.View
      style={[
        styles.receiptCard, 
        isForExport ? { 
          width: screenWidth - 40,
          opacity: 1,
          transform: [{ translateY: 0 }]
        } : { 
          opacity: fadeAnim, 
          transform: [{ translateY: slideAnim }] 
        }
      ]}
      onLayout={!isForExport ? (event) => {
        const { height } = event.nativeEvent.layout;
        setContentHeight(height + 100);
      } : undefined}
    >
      {/* Store Info */}
      <View style={styles.storeInfo}>
        <Text style={styles.storeName}>{storeName}</Text>
        <Text style={styles.storeSubtitle}>HÓA ĐƠN BÁN HÀNG</Text>
      </View>

      {/* Order Info */}
      <View style={styles.orderInfoSection}>
        <View style={styles.row}>
          <Text style={styles.label}>Mã hóa đơn:</Text>
          <Text style={styles.value}>{orderId}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Ngày:</Text>
          <Text style={styles.value}>{formatReceiptDate(createdAt as string || new Date())}</Text>
        </View>
        
        <View style={styles.row}>
          <Text style={styles.label}>Thời gian:</Text>
          <Text style={styles.value}>{formatReceiptTime(createdAt as string || new Date())}</Text>
        </View>

        {clientName && (
          <View style={styles.row}>
            <Text style={styles.label}>Khách hàng:</Text>
            <Text style={styles.value}>{clientName}</Text>
          </View>
        )}

        {clientPhone && (
          <View style={styles.row}>
            <Text style={styles.label}>Điện thoại:</Text>
            <Text style={styles.value}>{clientPhone}</Text>
          </View>
        )}

        {branchName && (
          <View style={styles.row}>
            <Text style={styles.label}>Chi nhánh:</Text>
            <Text style={styles.value}>{branchName}</Text>
          </View>
        )}

        {orderDetails?.tableName && (
          <View style={styles.row}>
            <Text style={styles.label}>Bàn:</Text>
            <Text style={styles.value}>{orderDetails.tableName}</Text>
          </View>
        )}

        <View style={styles.divider} />
      </View>

      {/* Order Items */}
      <View style={styles.itemsSection}>
        <Text style={styles.sectionTitle}>CHI TIẾT ĐƠN HÀNG</Text>
        
        {orderDetails?.items?.map((item: any, index: number) => (
          <View key={index} style={styles.itemRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>
              {item.quantity} x {item.price.toLocaleString()}đ
            </Text>
          </View>
        ))}
        
        <View style={styles.divider} />
      </View>

      {/* Payment Summary */}
      <View style={styles.paymentSummary}>
        <View style={styles.row}>
          <Text style={styles.label}>Tổng tiền:</Text>
          <Text style={styles.value}>{totalNumber.toLocaleString()}đ</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Giảm giá:</Text>
          <Text style={[styles.value, styles.discountValue]}>
            -{discountNumber.toLocaleString()}đ
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={[styles.label, styles.totalLabel]}>Tổng thanh toán:</Text>
          <Text style={[styles.value, styles.totalValue]}>
            {finalAmount.toLocaleString()}đ
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Phương thức:</Text>
          <Text style={styles.value}>
            {method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
          </Text>
        </View>
      </View>

      {/* Bank Info */}
      {method === 'bank' && (
        <Animated.View style={[styles.bankSection, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>THÔNG TIN CHUYỂN KHOẢN</Text>

          <View style={styles.bankDetails}>
            <View style={styles.row}>
              <Text style={styles.bankLabel}>Ngân hàng:</Text>
              <Text style={styles.bankValue}>
                {bankInfo.bankName || 'Chưa cập nhật'}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.bankLabel}>Số tài khoản:</Text>
              <Text style={styles.bankValue}>
                {bankInfo.accountNumber || 'Chưa cập nhật'}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.bankLabel}>Tên tài khoản:</Text>
              <Text style={styles.bankValue}>
                {bankInfo.accountName || 'Chưa cập nhật'}
              </Text>
            </View>

            {bankInfo.qrImage ? (
              <>
                <Text style={styles.qrTitle}>Quét mã QR để thanh toán</Text>
                <Image
                  source={{ uri: bankInfo.qrImage }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </>
            ) : (
              <Text style={styles.missingQR}>
                {bankInfo.bankName 
                  ? "Thiếu mã QR thanh toán" 
                  : "Chủ cửa hàng chưa cài đặt thông tin ngân hàng"}
              </Text>
            )}
            
            {/* Payment Status */}
            <View style={styles.paymentStatusContainer}>
              <Text style={styles.paymentStatusLabel}>Trạng thái thanh toán:</Text>
              <Text 
                style={[
                  styles.paymentStatusValue,
                  paymentStatus === 'Đã nhận tiền' ? styles.successStatus : styles.pendingStatus
                ]}
              >
                {paymentStatus}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Thank you message */}
      <View style={styles.thankYou}>
        <Text style={styles.thankYouText}>CẢM ƠN QUÝ KHÁCH!</Text>
        <Text style={styles.thankYouSubtext}>Hẹn gặp lại bạn lần sau</Text>
      </View>
    </Animated.View>
  );

  // Hàm xuất hóa đơn dưới dạng hình ảnh
  const exportReceipt = async () => {
    if (!hiddenViewShotRef.current) return;
    
    setIsExporting(true);
    
    try {
      const uri = await hiddenViewShotRef.current.capture();
      
      if (Platform.OS !== 'web') {
        if (!permissionResponse || permissionResponse.status !== 'granted') {
          await requestPermission();
        }
        
        const asset = await MediaLibrary.createAssetAsync(uri);
        await MediaLibrary.createAlbumAsync('Foodlee', asset, false);
      }
      
      await shareReceipt(uri);
      
      Alert.alert(
        'Xuất hóa đơn thành công',
        'Hóa đơn đã được lưu và sẵn sàng để chia sẻ',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Lỗi khi xuất hóa đơn:', error);
      Alert.alert(
        'Lỗi',
        'Xuất hóa đơn thất bại. Vui lòng thử lại.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsExporting(false);
    }
  };

  const shareReceipt = async (uri: string) => {
    try {
      if (Platform.OS === 'web') {
        const base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const dataUrl = `data:image/png;base64,${base64Data}`;
        
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `foodlee_receipt_${orderId || Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            dialogTitle: `Hóa đơn Foodlee #${orderId}`,
            mimeType: 'image/png',
            UTI: 'image/png',
          });
        } else {
          Alert.alert(
            'Thông báo',
            'Ảnh hóa đơn đã được lưu vào thư viện. Bạn có thể chia sẻ từ đó.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Lỗi khi chia sẻ hóa đơn:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Đang tải thông tin hóa đơn...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/(drawer)/(tabs)/inventory')}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HÓA ĐƠN #{orderId}</Text>
      </View>

      {/* ScrollView cho nội dung hiển thị */}
      <ScrollView contentContainerStyle={styles.content}>
        {renderReceiptContent()}
      </ScrollView>

      {/* View ẩn để chụp toàn bộ nội dung hóa đơn */}
      <View style={{ position: 'absolute', left: -10000 }}>
        <ViewShot 
          ref={hiddenViewShotRef} 
          options={{ 
            format: 'png', 
            quality: 0.9,
            width: screenWidth - 40,
            height: contentHeight
          }}
        >
          <View style={{ width: screenWidth - 40, minHeight: contentHeight }}>
            {renderReceiptContent(true)}
          </View>
        </ViewShot>
      </View>

      {/* Footer Buttons */}
      <View style={styles.footerButtons}>
        <TouchableOpacity
          style={[styles.footerButton, styles.doneButton]}
          onPress={() => router.replace('/(drawer)/(tabs)/inventory')}
        >
          <Text style={styles.doneText}>HOÀN TẤT</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.footerButton, styles.exportButton]}
          onPress={exportReceipt}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.exportText}>XUẤT HÓA ĐƠN</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Transaction Alert Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showTransactionAlert}
        onRequestClose={handleCloseAlert}
      >
        <View style={styles.alertContainer}>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>THÔNG BÁO THANH TOÁN</Text>
            
            {latestTransaction && (
              <>
                <Text style={styles.alertText}>
                  Mã hóa đơn: <Text style={styles.alertHighlight}>#{orderId}</Text>
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
                onPress={handleCloseAlert}
              >
                <Text style={styles.cancelButtonText}>ĐÓNG</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.alertButton, styles.confirmButton]}
                onPress={handleConfirmPayment}
              >
                <Text style={styles.confirmButtonText}>XÁC NHẬN THANH TOÁN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    padding: 16,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  receiptCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  storeInfo: {
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 15,
  },
  storeName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 5,
  },
  storeSubtitle: {
    fontSize: 16,
    color: '#64748b',
    letterSpacing: 1,
  },
  orderInfoSection: {
    marginBottom: 15,
  },
  itemsSection: {
    marginBottom: 15,
  },
  paymentSummary: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  itemName: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
    flex: 2,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    textAlign: 'right',
  },
  label: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  discountValue: {
    color: '#10b981',
    fontWeight: '700',
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ef4444',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 12,
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    borderRadius: 8,
    letterSpacing: 1,
  },
  bankSection: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 20,
    marginTop: 10,
  },
  bankDetails: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
  },
  bankLabel: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  bankValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  qrTitle: {
    textAlign: 'center',
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 15,
    marginBottom: 10,
    fontSize: 16,
  },
  qrImage: {
    width: 180,
    height: 180,
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  missingQR: {
    textAlign: 'center',
    color: '#ef4444',
    marginVertical: 16,
    fontWeight: '500',
  },
  paymentStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  paymentStatusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  paymentStatusValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  successStatus: {
    color: '#10b981',
  },
  pendingStatus: {
    color: '#ef4444',
  },
  thankYou: {
    marginTop: 20,
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#bbf7d0',
  },
  thankYouText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10b981',
    marginTop: 10,
  },
  thankYouSubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 5,
    textAlign: 'center',
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 10,
  },
  footerButton: {
    flex: 1,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    marginHorizontal: 5,
  },
  doneButton: {
    backgroundColor: '#3b82f6',
  },
  exportButton: {
    backgroundColor: '#10b981',
  },
  doneText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
  },
  exportText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
  },
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
    marginLeft: 5,
  },
  positiveAmount: {
    color: '#10b981',
  },
  negativeAmount: {
    color: '#ef4444',
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