import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, get, child } from 'firebase/database';
import { auth } from '../lib/firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';

export function DrawerContent(props: any) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [employeeInfo, setEmployeeInfo] = useState<any>(null);
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const closeDrawer = () => props.navigation.closeDrawer();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/login');
      } else {
        loadUserData(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadUserData = async (uid: string) => {
    try {
      setLoading(true);
      setError('');

      const db = getDatabase();
      const dbRef = ref(db);

      // Lấy thông tin user
      const userSnap = await get(child(dbRef, `users/${uid}/info_user`));
      if (userSnap.exists()) {
        setUserInfo(userSnap.val());
      }

      // Tìm tất cả các chủ cửa hàng có trong hệ thống
      const usersSnap = await get(child(dbRef, 'users'));
      if (!usersSnap.exists()) {
        throw new Error('Không tìm thấy dữ liệu người dùng');
      }

      const usersData = usersSnap.val();
      let employeeFound = false;

      // Duyệt qua tất cả người dùng để tìm nhân viên
      for (const ownerUid in usersData) {
        if (usersData[ownerUid].employees) {
          const employeesData = usersData[ownerUid].employees;

          for (const employeeId in employeesData) {
            const employee = employeesData[employeeId];

            if (employee.email === auth.currentUser?.email) {
              setEmployeeInfo(employee);
              employeeFound = true;

              if (employee.branchCode && usersData[ownerUid].branches) {
                const branchData = usersData[ownerUid].branches[employee.branchCode];
                if (branchData) {
                  setBranchInfo(branchData);
                }
              }
              break;
            }
          }
          if (employeeFound) break;
        }
      }

      if (!employeeFound) {
        throw new Error('Không tìm thấy thông tin nhân viên');
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Đã xảy ra lỗi khi tải dữ liệu');
      }
    } finally {
      setLoading(false);
    }
  };

  const navigateToAccount = () => {
    closeDrawer();
    router.push('/account');
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.clear();
      await signOut(auth);
      setTimeout(() => {
        router.replace('/login');
      }, 300);
    } catch (error) {
      Alert.alert('Lỗi đăng xuất', error instanceof Error ? error.message : 'Đã xảy ra lỗi');
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top + 20 }]}>
        <ActivityIndicator size="large" color="#1a2a6c" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top + 20 }]}>
        <MaterialIcons name="error-outline" size={48} color="#ff6b6b" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadUserData(auth.currentUser?.uid || '')}
        >
          <Text style={styles.retryText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#1a2a6c', '#2a5298']}
      style={styles.drawer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ paddingTop: insets.top + 20 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={closeDrawer} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Menu Ứng dụng</Text>
        </View>

        <TouchableOpacity style={styles.userSection} onPress={navigateToAccount} activeOpacity={0.8}>
          <Image
            source={{ uri: userInfo?.avatarUrl || employeeInfo?.avatarUrl || 'https://via.placeholder.com/60' }}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {employeeInfo?.name || userInfo?.name || 'Chưa rõ tên'}
            </Text>
            <Text style={styles.userRole}>
              {employeeInfo?.position === 'manager' ? 'Quản lý cửa hàng' :
                userInfo?.role ? userInfo.role : 'Nhân viên'}
            </Text>
            <Text style={styles.editText}>
              Nhấn để chỉnh sửa tài khoản
            </Text>
          </View>
        </TouchableOpacity>

        <DrawerItem
          label="Trang chính"
          onPress={() => {
            closeDrawer();
            router.push('/');
          }}
          icon={({ color }) => <MaterialIcons name="home" size={24} color={color} />}
          labelStyle={styles.drawerItemText}
          style={styles.drawerItem}
        />

        {/* Menu: dùng icon store */}
        <DrawerItem
          label="Menu"
          onPress={() => {
            closeDrawer();
            router.push('/inventory');
          }}
          icon={({ color }) => <MaterialIcons name="store" size={24} color={color} />}
          labelStyle={styles.drawerItemText}
          style={styles.drawerItem}
        />

        <DrawerItem
          label="Doanh thu"
          onPress={() => {
            closeDrawer();
            router.push('/revenue');
          }}
          icon={({ color }) => <MaterialIcons name="bar-chart" size={24} color={color} />}
          labelStyle={styles.drawerItemText}
          style={styles.drawerItem}
        />

        {/* Kho hàng: dùng icon inventory */}
        <DrawerItem
          label="Kho hàng"
          onPress={() => {
            closeDrawer();
            router.push('/khohang');
          }}
          icon={({ color }) => <MaterialIcons name="inventory" size={24} color={color} />}
          labelStyle={styles.drawerItemText}
          style={styles.drawerItem}
        />

        {branchInfo && (
          <View style={styles.storeInfo}>
            <Text style={styles.storeTitle}>
              {branchInfo?.name || 'Tên chi nhánh'}
            </Text>
            <Text style={styles.storeAddress}>
              {branchInfo?.address_detail || 'Địa chỉ chưa có'}
            </Text>
            <Text style={styles.storePhone}>
              {userInfo?.phone ? `Điện thoại: ${userInfo.phone}` : 'Điện thoại: 0123 456 789'}
            </Text>
          </View>
        )}

        <DrawerItem
          label="Đăng xuất"
          onPress={handleLogout}
          icon={({ color }) => <MaterialIcons name="logout" size={24} color={color} />}
          labelStyle={styles.drawerItemText}
          style={styles.drawerItem}
        />
      </DrawerContentScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  drawer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    marginBottom: 20,
  },
  closeButton: { alignSelf: 'flex-end', padding: 8 },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#fff',
    textAlign: 'center',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    marginHorizontal: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#fff',
  },
  userRole: {
    fontSize: 14,
    marginBottom: 4,
    color: 'rgba(255,255,255,0.8)',
  },
  editText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.6)',
  },
  drawerItem: {
    marginVertical: 4,
    borderRadius: 8,
    paddingLeft: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  drawerItemText: {
    color: '#fff',
    fontSize: 16,
  },
  storeInfo: {
    marginTop: 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 20,
  },
  storeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#fff',
  },
  storeAddress: {
    fontSize: 14,
    marginBottom: 3,
    color: 'rgba(255,255,255,0.8)',
  },
  storePhone: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
});
