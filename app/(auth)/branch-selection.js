import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { DrawerLayoutAndroid } from 'react-native';
import { useRouter } from 'expo-router';
import { getDatabase, ref, child, get } from 'firebase/database';
import { getAuth, signOut, onAuthStateChanged } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function BranchSelection() {
  const router = useRouter();
  const [drawer, setDrawer] = useState(null);
  const [userInfo, setUserInfo] = useState({});
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const db = getDatabase();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) {
        router.replace('/login');
      } else {
        loadUserData(user.uid);
      }
    });

    return unsubscribe;
  }, []);

  const loadUserData = async (uid) => {
    try {
      setLoading(true);
      setError('');

      const currentUser = auth.currentUser;
      if (!currentUser?.email) throw new Error('Không tìm thấy thông tin người dùng');

      const email = currentUser.email.toLowerCase();
      
      // CẬP NHẬT: Truy vấn tất cả employees dưới users
      const usersRef = ref(db, 'users');
      const usersSnapshot = await get(usersRef);
      
      if (!usersSnapshot.exists()) throw new Error('Không tìm thấy dữ liệu người dùng');

      let employeeData = null;
      let employeePath = '';

      // Duyệt qua tất cả user keys để tìm nhân viên
      usersSnapshot.forEach(userKeySnapshot => {
        const userKey = userKeySnapshot.key;
        const employeesRef = ref(db, `users/${userKey}/employees`);
        
        // Kiểm tra từng nút employees trong user
        userKeySnapshot.child('employees').forEach(employeeSnapshot => {
          const data = employeeSnapshot.val();
          if (data.email?.toLowerCase() === email) {
            employeeData = {
              id: employeeSnapshot.key,
              ...data
            };
            employeePath = `users/${userKey}/employees/${employeeSnapshot.key}`;
          }
        });
      });

      if (!employeeData) throw new Error('Không tìm thấy nhân viên phù hợp');

      // CẬP NHẬT: Sử dụng avatarUrl từ dữ liệu mới
      const { role, branchCode, name, position, avatarUrl } = employeeData;

      setUserInfo({
        name: name || 'Không tên',
        position: position || 'Nhân viên',
        photoUrl: avatarUrl || null,
        branchCode: branchCode || '',
      });

      // Load chi nhánh
      if (role === 'manager') {
        await loadAllBranches();
      } else if (branchCode) {
        await findBranchByCode(branchCode);
      } else {
        throw new Error('Tài khoản chưa được phân bổ chi nhánh');
      }

    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
      setError(err.message || 'Đã xảy ra lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const findBranchByCode = async (branchCode) => {
    try {
      // CẬP NHẬT: Truy vấn tất cả branches dưới users
      const usersRef = ref(db, 'users');
      const usersSnapshot = await get(usersRef);
      
      if (!usersSnapshot.exists()) {
        setError('Không tìm thấy chi nhánh nào');
        setBranches([]);
        return;
      }

      let foundBranch = null;
      
      // Duyệt qua tất cả user keys để tìm chi nhánh
      usersSnapshot.forEach(userKeySnapshot => {
        const userKey = userKeySnapshot.key;
        const branchesRef = ref(db, `users/${userKey}/branches`);
        
        // Kiểm tra từng chi nhánh trong user
        userKeySnapshot.child('branches').forEach(branchSnapshot => {
          const branchData = branchSnapshot.val();
          if (branchData.code?.toLowerCase() === branchCode.toLowerCase()) {
            foundBranch = {
              id: branchSnapshot.key,
              ...branchData
            };
          }
        });
      });

      if (foundBranch) {
        setBranches([foundBranch]);
      } else {
        setError(`Không tìm thấy chi nhánh có mã: ${branchCode}`);
        setBranches([]);
      }
    } catch (error) {
      console.error('Lỗi tìm chi nhánh:', error);
      setError('Không thể tìm thông tin chi nhánh');
    }
  };

  const loadAllBranches = async () => {
    try {
      // CẬP NHẬT: Truy vấn tất cả branches dưới users
      const usersRef = ref(db, 'users');
      const usersSnapshot = await get(usersRef);
      
      if (!usersSnapshot.exists()) {
        setError('Không tìm thấy chi nhánh nào');
        return;
      }

      const branchesList = [];
      
      // Duyệt qua tất cả user keys để thu thập chi nhánh
      usersSnapshot.forEach(userKeySnapshot => {
        const branchesRef = ref(db, `users/${userKeySnapshot.key}/branches`);
        
        // Thêm tất cả chi nhánh từ user này
        userKeySnapshot.child('branches').forEach(branchSnapshot => {
          const branchData = branchSnapshot.val();
          if (branchData && branchData.name) {
            branchesList.push({
              id: branchSnapshot.key,
              ...branchData
            });
          }
        });
      });

      setBranches(branchesList);
      
      if (branchesList.length === 0) {
        setError('Không tìm thấy chi nhánh nào');
      }
    } catch (error) {
      console.error('Lỗi tải chi nhánh:', error);
      setError('Không thể tải danh sách chi nhánh');
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userEmail');
      await AsyncStorage.removeItem('userPassword');
      await signOut(auth);
      router.replace('/login');
    } catch (error) {
      console.error('Lỗi đăng xuất:', error);
      Alert.alert('Lỗi', 'Đã xảy ra lỗi khi đăng xuất');
    }
  };

  const handleSelectBranch = async (branch) => {
    setSelectedBranch(branch);
    try {
      await AsyncStorage.setItem('selectedBranch', JSON.stringify(branch));
      setTimeout(() => {
        router.replace('/(drawer)/(tabs)');
      }, 100);
    } catch (error) {
      console.error('Lỗi lưu chi nhánh:', error);
      Alert.alert('Lỗi', 'Không thể lưu thông tin chi nhánh');
    }
  };

  const renderDrawer = () => (
    <LinearGradient 
      colors={['#1a2a6c', '#2a5298']} 
      style={styles.drawer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.drawerHeader}>
        {userInfo.photoUrl ? (
          <Image source={{ uri: userInfo.photoUrl }} style={styles.avatarLarge} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <MaterialIcons name="person" size={40} color="#fff" />
          </View>
        )}
        <Text style={styles.username}>{userInfo.name || 'Không tên'}</Text>
        <Text style={styles.position}>{userInfo.position || ''}</Text>
      </View>
      
      <View style={styles.drawerBody}>
        <TouchableOpacity style={styles.drawerItem} onPress={handleLogout}>
          <MaterialIcons name="logout" size={24} color="#fff" />
          <Text style={styles.drawerItemText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.drawerFooter}>
        <Text style={styles.footerText}>Foodiee Manager</Text>
        <Text style={styles.footerText}>Version 1.0.0</Text>
      </View>
    </LinearGradient>
  );

  const renderBranchItem = ({ item }) => {
    const isActive = item.status?.toLowerCase() === 'active';
    const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A';
    
    return (
      <TouchableOpacity
        onPress={() => isActive && handleSelectBranch(item)}
        style={[
          styles.branchCard, 
          selectedBranch?.id === item.id && styles.selected,
        ]}
      >
        <View style={styles.branchHeader}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.branchImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="restaurant" size={40} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.branchInfo}>
          <Text style={styles.branchName}>{item.name}</Text>
          
          <View style={styles.detailRow}>
            <MaterialIcons name="fingerprint" size={18} color="#1a2a6c" />
            <Text style={styles.detailLabel}>Mã:</Text>
            <Text style={styles.detailValue}>{item.code || 'N/A'}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <MaterialIcons name="location-on" size={18} color="#1a2a6c" />
            <Text style={styles.detailLabel}>Địa chỉ:</Text>
            <Text style={styles.detailValue}>{item.address_detail || 'Chưa có địa chỉ'}</Text>
          </View>
          
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, isActive ? styles.activeStatus : styles.inactiveStatus]}>
              <Text style={[styles.statusText, isActive ? styles.activeText : styles.inactiveText]}>
                {isActive ? 'Hoạt động' : 'Không hoạt động'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a2a6c" />
          <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => loadUserData(auth.currentUser?.uid)}
          >
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    if (branches.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={48} color="#999" />
          <Text style={styles.emptyText}>Không có chi nhánh nào</Text>
        </View>
      );
    }
    
    return (
      <FlatList
        data={branches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={renderBranchItem}
      />
    );
  };

  return (
    <DrawerLayoutAndroid
      ref={ref => setDrawer(ref)}
      drawerWidth={300}
      drawerPosition="left"
      renderNavigationView={renderDrawer}
    >
      <LinearGradient colors={['#f8f9ff', '#eef2ff']} style={{ flex: 1 }}>
        <LinearGradient 
          colors={['#1a2a6c', '#2a5298']} 
          style={styles.topBar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity onPress={() => drawer?.openDrawer()}>
            <MaterialIcons name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userInfo.name || 'Tên'}</Text>
            <Text style={styles.userPosition}>{userInfo.position || 'Chức vụ'}</Text>
          </View>
        </LinearGradient>

        <View style={styles.headerContainer}>
          <Text style={styles.title}>Chọn chi nhánh</Text>
        </View>

        {renderContent()}
      </LinearGradient>
    </DrawerLayoutAndroid>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 70,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  userInfo: {
    marginLeft: 15,
  },
  userName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userPosition: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  headerContainer: {
    padding: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a2a6c',
    textAlign: 'center',
  },
  branchCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eaeaea',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  selected: {
    borderColor: '#4361ee',
    borderWidth: 2,
    transform: [{ scale: 1.01 }],
  },
  branchHeader: {
    width: '100%',
    backgroundColor: '#f8f9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  branchImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a2a6c',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  branchName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a2a6c',
    textAlign: 'center',
  },
  branchInfo: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  detailLabel: {
    width: 80,
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
    marginLeft: 8,
  },
  detailValue: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  statusContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: 'center',
  },
  activeStatus: {
    backgroundColor: '#e6f7ee',
  },
  inactiveStatus: {
    backgroundColor: '#fdecea',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  activeText: {
    color: '#27ae60',
  },
  inactiveText: {
    color: '#e74c3c',
  },
  drawer: {
    flex: 1,
  },
  drawerHeader: {
    padding: 30,
    paddingTop: 50,
    alignItems: 'center',
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 15,
    color: '#fff',
  },
  position: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 5,
    color: 'rgba(255,255,255,0.8)',
  },
  drawerBody: {
    padding: 20,
    paddingTop: 30,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  drawerItemText: {
    fontSize: 18,
    marginLeft: 20,
    color: '#fff',
    fontWeight: '500',
  },
  drawerFooter: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginVertical: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#1a2a6c',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#1a2a6c',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
});