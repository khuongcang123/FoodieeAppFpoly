import React, { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  Image,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  SafeAreaView,
  Platform
} from 'react-native';
import { getDatabase, ref, onValue } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import moment from 'moment';

export default function InventoryScreen() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState('');
  const [userId, setUserId] = useState('dg0nQI4hyqXbo7oLhj5xbuPc9Pd2');
  const [searchText, setSearchText] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [outOfStockItems, setOutOfStockItems] = useState({});
  const db = getDatabase();

  useEffect(() => {
    const loadBranchData = async () => {
      try {
        const branchData = await AsyncStorage.getItem('selectedBranch');
        
        if (branchData) {
          const branchObj = JSON.parse(branchData);
          setBranchId(branchObj.id);
          loadData(branchObj.id);
          loadOutOfStockStatus(branchObj.id);
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
    
    loadBranchData();
  }, []);

  const loadOutOfStockStatus = async (branchId) => {
    try {
      const savedData = await AsyncStorage.getItem(`outOfStock_${branchId}`);
      if (savedData) {
        const { date, items } = JSON.parse(savedData);
        const today = moment().format('YYYY-MM-DD');
        if (date === today) {
          setOutOfStockItems(items);
        } else {
          await AsyncStorage.removeItem(`outOfStock_${branchId}`);
          setOutOfStockItems({});
        }
      }
    } catch (error) {
      console.error("Lỗi khi tải trạng thái hết hàng:", error);
    }
  };

  const saveOutOfStockStatus = async (branchId, items) => {
    try {
      const today = moment().format('YYYY-MM-DD');
      const data = JSON.stringify({ date: today, items });
      await AsyncStorage.setItem(`outOfStock_${branchId}`, data);
    } catch (error) {
      console.error("Lỗi khi lưu trạng thái hết hàng:", error);
    }
  };

  const loadData = (currentBranchId) => {
    try {
      const categoriesRef = ref(db, `users/${userId}/category`);
      onValue(categoriesRef, (snapshot) => {
        if (snapshot.exists()) {
          const categoriesData = snapshot.val();
          const categoriesArray = Object.keys(categoriesData).map(key => ({
            id: key,
            ...categoriesData[key]
          }));
          setCategories(categoriesArray);
        }
      });

      const productsRef = ref(db, `users/${userId}/menu`);
      onValue(productsRef, (snapshot) => {
        if (snapshot.exists()) {
          const productsData = snapshot.val();
          const productsArray = Object.keys(productsData).map(key => ({
            id: key,
            ...productsData[key]
          }));
          
          const filteredProducts = productsArray.filter(product => 
            product.branches?.includes(currentBranchId)
          );
          
          setProducts(filteredProducts);
          setLoading(false);
        } else {
          setProducts([]);
          setLoading(false);
        }
      });
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu:", error);
      Toast.show({
        type: 'error',
        text1: 'Lỗi tải dữ liệu',
        text2: 'Không thể tải dữ liệu từ máy chủ'
      });
      setLoading(false);
    }
  };

  const { sortedCategories, groupedProducts } = useMemo(() => {
    const sortedCats = [...categories].sort((a, b) => a.order - b.order);
    
    const grouped = {};
    products.forEach(product => {
      if (product.categoryId) {
        const category = categories.find(c => c.id === product.categoryId);
        if (category) {
          if (!grouped[category.id]) grouped[category.id] = [];
          grouped[category.id].push(product);
        }
      }
    });
    
    return { sortedCategories: sortedCats, groupedProducts: grouped };
  }, [categories, products]);

  const filteredData = useMemo(() => {
    if (!searchText.trim()) return { categories: sortedCategories, grouped: groupedProducts };

    const searchTerm = searchText.toLowerCase();
    const filteredGroups = {};
    const visibleCategories = new Set();

    sortedCategories.forEach(category => {
      const catProducts = groupedProducts[category.id] || [];
      const filteredProducts = catProducts.filter(product => 
        product.name.toLowerCase().includes(searchTerm) || 
        category.name.toLowerCase().includes(searchTerm)
      );

      if (filteredProducts.length > 0) {
        filteredGroups[category.id] = filteredProducts;
        visibleCategories.add(category);
      }
    });

    return { 
      categories: Array.from(visibleCategories), 
      grouped: filteredGroups 
    };
  }, [searchText, sortedCategories, groupedProducts]);

  const handleProductPress = (product) => {
    setSelectedProduct(product);
    setModalVisible(true);
  };

  const updateProductStatus = async (status) => {
    if (!selectedProduct || !branchId) return;
    
    setUpdatingStatus(true);
    try {
      const updatedItems = { ...outOfStockItems };
      
      if (status) {
        delete updatedItems[selectedProduct.id];
      } else {
        updatedItems[selectedProduct.id] = true;
      }
      
      setOutOfStockItems(updatedItems);
      await saveOutOfStockStatus(branchId, updatedItems);
      
      Toast.show({
        type: 'success',
        text1: status ? 'Sản phẩm có hàng' : 'Đã báo hết hàng',
        text2: `Trạng thái "${selectedProduct.name}" đã được cập nhật`
      });
      
      setModalVisible(false);
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái:", error);
      Toast.show({
        type: 'error',
        text1: 'Lỗi cập nhật',
        text2: 'Không thể cập nhật trạng thái sản phẩm'
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const renderProduct = ({ item }) => {
    const isOutOfStock = outOfStockItems[item.id] === true;
    const displayPrice = item.salePrice > 0 && item.salePrice < item.basePrice 
      ? item.salePrice 
      : item.basePrice;
    
    return (
      <TouchableOpacity 
        style={[styles.productItem, isOutOfStock && styles.outOfStockItem]}
        onPress={() => handleProductPress(item)}
        activeOpacity={0.8}
      >
        {item.images?.[0] ? (
          <Image 
            source={{ uri: item.images[0] }} 
            style={[styles.productImage, isOutOfStock && styles.outOfStockImage]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, isOutOfStock && styles.outOfStockImage]}>
            <Icon name="image" size={24} color="#94a3b8" />
          </View>
        )}
        
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <Text 
              style={[styles.productName, isOutOfStock && styles.outOfStockText]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={styles.statusContainer}>
              {isOutOfStock ? (
                <View style={styles.outOfStockBadge}>
                  <Text style={styles.outOfStockBadgeText}>Hết hàng</Text>
                </View>
              ) : (
                <View style={styles.inStockBadge}>
                  <Text style={styles.inStockBadgeText}>Còn hàng</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.priceContainer}>
  {item.salePrice > 0 && item.salePrice < item.basePrice ? (
    <>
      <Text style={styles.salePrice}>{item.salePrice.toLocaleString()}đ</Text>
      <Text style={styles.originalPrice}>{item.basePrice.toLocaleString()}đ</Text>
    </>
  ) : (
    <Text style={styles.salePrice}>{item.basePrice.toLocaleString()}đ</Text>
  )}
</View>

          
          {item.description && (
            <Text 
              style={[styles.productDescription, isOutOfStock && styles.outOfStockText]} 
              numberOfLines={2}
            >
              {item.description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategory = ({ item }) => {
    const productsInCategory = filteredData.grouped[item.id] || [];

    return (
      <View style={styles.categoryContainer} key={item.id}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{item.name}</Text>
          <Text style={styles.productCount}>{productsInCategory.length} sản phẩm</Text>
        </View>
        
        {productsInCategory.length > 0 ? (
          <FlatList
            data={productsInCategory}
            renderItem={renderProduct}
            keyExtractor={product => product.id}
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.emptyText}>Chưa có sản phẩm trong danh mục</Text>
        )}
      </View>
    );
  };

  const renderProductModal = () => {
    if (!selectedProduct) return null;
    
    const isOutOfStock = outOfStockItems[selectedProduct.id] === true;
    const category = categories.find(c => c.id === selectedProduct.categoryId);
    const displayPrice = selectedProduct.salePrice > 0 && selectedProduct.salePrice < selectedProduct.basePrice 
      ? selectedProduct.salePrice 
      : selectedProduct.basePrice;
    
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Pressable 
              style={styles.modalCloseButton}
              onPress={() => setModalVisible(false)}
            >
              <Icon name="close" size={24} color="#64748b" />
            </Pressable>
            
            {selectedProduct.images?.[0] ? (
              <Image 
                source={{ uri: selectedProduct.images[0] }} 
                style={styles.modalImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.modalImagePlaceholder}>
                <Icon name="image" size={48} color="#cbd5e1" />
              </View>
            )}
            
            <Text style={styles.modalTitle}>{selectedProduct.name}</Text>
            
            <View style={styles.modalPriceContainer}>
  {selectedProduct.salePrice > 0 && selectedProduct.salePrice < selectedProduct.basePrice ? (
    <>
      <Text style={styles.modalSalePrice}>{selectedProduct.salePrice.toLocaleString()}đ</Text>
      <Text style={styles.modalOriginalPrice}>{selectedProduct.basePrice.toLocaleString()}đ</Text>
    </>
  ) : (
    <Text style={styles.modalSalePrice}>{selectedProduct.basePrice.toLocaleString()}đ</Text>
  )}
</View>

            
            {selectedProduct.description && (
              <Text style={styles.modalDescription}>{selectedProduct.description}</Text>
            )}
            
            <View style={styles.modalInfoContainer}>
              <View style={styles.infoRow}>
                <Icon name="category" size={20} color="#64748b" />
                <Text style={styles.infoText}>
                  Danh mục: {category?.name || 'Không xác định'}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Icon name="store" size={20} color="#64748b" />
                <Text style={styles.infoText}>
                  Chi nhánh: {branchId}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Icon name="inventory" size={20} color="#64748b" />
                <Text style={styles.infoText}>
                  Trạng thái: 
                  <Text style={isOutOfStock ? styles.outOfStockStatus : styles.inStockStatus}>
                    {isOutOfStock ? ' Hết hàng' : ' Còn hàng'}
                  </Text>
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={[
                styles.statusButton,
                isOutOfStock ? styles.inStockButton : styles.outOfStockButton
              ]}
              onPress={() => updateProductStatus(isOutOfStock)}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.statusButtonText}>
                  {isOutOfStock ? 'Có hàng trở lại' : 'Báo hết hàng'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Thanh tìm kiếm */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={24} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm sản phẩm, danh mục..."
            placeholderTextColor="#94a3b8"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={() => setSearchText('')}
            >
              <Icon name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        {/* Danh sách sản phẩm */}
        {filteredData.categories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="search-off" size={60} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Không tìm thấy sản phẩm</Text>
            <Text style={styles.emptySubtitle}>Hãy thử từ khóa khác hoặc kiểm tra lại</Text>
          </View>
        ) : (
          <FlatList
            data={filteredData.categories}
            renderItem={renderCategory}
            keyExtractor={category => category.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
        
        {/* Modal chi tiết sản phẩm */}
        {renderProductModal()}
        
        {/* Toast thông báo */}
        <Toast />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 35,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80, // Thêm padding bottom để không bị che bởi tab bar
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  listContainer: {
    paddingBottom: 24,
  },
  categoryContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  productCount: {
    fontSize: 14,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  productItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  outOfStockItem: {
    opacity: 0.7,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusContainer: {
    marginLeft: 8,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  outOfStockImage: {
    opacity: 0.6,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    flex: 1,
  },
  outOfStockText: {
    color: '#94a3b8',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  salePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
    marginRight: 8,
  },
  originalPrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  productDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  outOfStockBadge: {
    backgroundColor: '#fecaca',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  outOfStockBadgeText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  inStockBadge: {
    backgroundColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  inStockBadgeText: {
    fontSize: 12,
    color: '#15803d',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 12,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxHeight: '90%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
  },
  modalImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  modalImagePlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalSalePrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#dc2626',
    marginRight: 10,
  },
  modalOriginalPrice: {
    fontSize: 18,
    textDecorationLine: 'line-through',
    color: '#94a3b8',
  },
  modalDescription: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  modalInfoContainer: {
    width: '100%',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
  },
  infoText: {
    fontSize: 16,
    color: '#475569',
    marginLeft: 10,
  },
  inStockStatus: {
    color: '#15803d',
    fontWeight: '600',
  },
  outOfStockStatus: {
    color: '#dc2626',
    fontWeight: '600',
  },
  statusButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  outOfStockButton: {
    backgroundColor: '#dc2626',
  },
  inStockButton: {
    backgroundColor: '#16a34a',
  },
  statusButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});