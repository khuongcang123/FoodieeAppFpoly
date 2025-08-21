import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert
} from 'react-native';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import { Picker } from "@react-native-picker/picker";

export default function WarehouseScreen() {
  type WarehouseStatus = 'available' | 'low' | 'out';
  const [warehouseItems, setWarehouseItems] = useState<Array<{ id: string; status: WarehouseStatus; [key: string]: any }>>([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState('');
  const [userId, setUserId] = useState('dg0nQI4hyqXbo7oLhj5xbuPc9Pd2');
  const [editingItem, setEditingItem] = useState<{ id: string; [key: string]: any } | null>(null);
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('available');
  const db = getDatabase();

  // Tải dữ liệu chi nhánh và kho hàng
  useEffect(() => {
    const loadWarehouseData = async () => {
      try {
        const branchData = await AsyncStorage.getItem('selectedBranch');
        
        if (branchData) {
          const branchObj = JSON.parse(branchData);
          setBranchId(branchObj.id);
          loadWarehouseItems(branchObj.id);
        } else {
          setLoading(false);
          Toast.show({
            type: 'error',
            text1: 'Lỗi dữ liệu',
            text2: 'Không tìm thấy thông tin chi nhánh'
          });
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu chi nhánh:", error);
        Toast.show({
          type: 'error',
          text1: 'Lỗi tải dữ liệu',
          text2: 'Không thể tải thông tin chi nhánh'
        });
        setLoading(false);
      }
    };
    
    loadWarehouseData();
  }, []);

  // Tải dữ liệu kho hàng từ Firebase
  const loadWarehouseItems = (currentBranchId: any) => {
    try {
      const warehouseRef = ref(db, `users/${userId}/branches/${currentBranchId}/warehouse`);
      
      onValue(warehouseRef, (snapshot) => {
        if (snapshot.exists()) {
          const warehouseData = snapshot.val();
          const itemsArray = Object.keys(warehouseData).map(key => ({
            id: key,
            ...warehouseData[key],
            status: (warehouseData[key].status as WarehouseStatus) || 'available'
          }));
          setWarehouseItems(itemsArray);
        } else {
          setWarehouseItems([]);
        }
        setLoading(false);
      }, (error) => {
        console.error("Lỗi khi tải dữ liệu kho hàng:", error);
        Toast.show({
          type: 'error',
          text1: 'Lỗi tải dữ liệu',
          text2: 'Không thể tải thông tin kho hàng'
        });
        setLoading(false);
      });
    } catch (error) {
      console.error("Lỗi khi thiết lập listener kho hàng:", error);
      setLoading(false);
    }
  };

  // Mở modal chỉnh sửa
  const openEditModal = (item: { id: string; [key: string]: any }) => {
    setEditingItem(item);
    setQuantity(item.quantity.toString());
    setStatus(item.status || 'available');
  };

  // Đóng modal
  const closeEditModal = () => {
    setEditingItem(null);
    setQuantity('');
    setStatus('available');
  };

  // Cập nhật dữ liệu lên Firebase
  const updateItem = async () => {
    if (!editingItem || !quantity) return;

    try {
      const updates: Record<string, any> = {};
      updates[`users/${userId}/branches/${branchId}/warehouse/${editingItem.id}/quantity`] = parseInt(quantity);
      updates[`users/${userId}/branches/${branchId}/warehouse/${editingItem.id}/status`] = status;

      await update(ref(db), updates);
      
      Toast.show({
        type: 'success',
        text1: 'Thành công',
        text2: 'Cập nhật thông tin hàng hóa thành công'
      });
      
      closeEditModal();
    } catch (error) {
      console.error("Lỗi khi cập nhật dữ liệu:", error);
      Toast.show({
        type: 'error',
        text1: 'Lỗi cập nhật',
        text2: 'Không thể cập nhật thông tin hàng hóa'
      });
    }
  };
  // Định nghĩa kiểu cho trạng thái kho hàng
  // type WarehouseStatus = 'available' | 'low' | 'out';

  // Render mỗi item trong kho hàng
  const renderWarehouseItem = ({ item }: { item: { id: string; status: WarehouseStatus; [key: string]: any } }) => {
    const statusText: Record<WarehouseStatus, string> = {
      'available': 'Còn hàng',
      'low': 'Sắp hết',
      'out': 'Hết hàng'
    };
    
    const statusColor: Record<WarehouseStatus, string> = {
      'available': '#dcfce7',
      'low': '#fef9c3',
      'out': '#fee2e2'
    };
    
    const statusTextColor: Record<WarehouseStatus, string> = {
      'available': '#166534',
      'low': '#854d0e',
      'out': '#991b1b'
    };

    return (
      <TouchableOpacity 
        style={styles.itemContainer}
        onPress={() => openEditModal(item)}
      >
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{item.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor[item.status] }]}>
            <Text style={[styles.statusText, { color: statusTextColor[item.status] }]}>
              {statusText[item.status]}
            </Text>
          </View>
        </View>
        
        <View style={styles.itemDetails}>
          <View style={styles.detailRow}>
            <Icon name="inventory" size={18} color="#64748b" />
            <Text style={styles.detailText}>Mã: {item.code}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Icon name="category" size={18} color="#64748b" />
            <Text style={styles.detailText}>Loại: {item.type === 'ingredient' ? 'Nguyên liệu' : 'Thành phẩm'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Icon name="scale" size={18} color="#64748b" />
            <Text style={styles.detailText}>
              Số lượng: {item.quantity} {item.unit}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4361ee" />
        <Text style={styles.loadingText}>Đang tải dữ liệu kho hàng...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kho hàng</Text>
        <Text style={styles.subtitle}>Chi nhánh: {branchId}</Text>
      </View>

      {warehouseItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="inventory" size={60} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Kho hàng trống</Text>
          <Text style={styles.emptySubtitle}>Chưa có sản phẩm trong kho hàng của chi nhánh này</Text>
        </View>
      ) : (
        <FlatList
          data={warehouseItems}
          renderItem={renderWarehouseItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
      
      {/* Modal chỉnh sửa */}
      <Modal
        visible={!!editingItem}
        transparent={true}
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chỉnh sửa hàng hóa</Text>
            
            {editingItem && (
              <>
                <Text style={styles.itemNameModal}>{editingItem.name}</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Số lượng</Text>
                  <TextInput
                    style={styles.input}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    placeholder="Nhập số lượng"
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Trạng thái</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={status}
                      style={styles.picker}
                      onValueChange={(itemValue: React.SetStateAction<string>) => setStatus(itemValue)}
                    >
                      <Picker.Item label="Còn hàng" value="available" />
                      <Picker.Item label="Sắp hết" value="low" />
                      <Picker.Item label="Hết hàng" value="out" />
                    </Picker>
                  </View>
                </View>
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.button, styles.cancelButton]}
                    onPress={closeEditModal}
                  >
                    <Text style={styles.buttonText}>Hủy</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.button, styles.saveButton]}
                    onPress={updateItem}
                  >
                    <Text style={styles.buttonText}>Lưu thay đổi</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
      
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 35,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748b',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  listContainer: {
    padding: 16,
  },
  itemContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#334155',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 300,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  itemNameModal: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#ef4444',
  },
  saveButton: {
    backgroundColor: '#10b981',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});