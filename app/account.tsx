import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  TextInput, 
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons, Ionicons, AntDesign, FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, ref, update, get, set, push, onValue, off } from 'firebase/database';
import { getAuth, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as Location from 'expo-location';
import moment from 'moment';
import 'moment/locale/vi';

// Màu sắc cố định
const COLORS = {
  white: '#FFFFFF',
  black: '#333333',
  gray: '#888888',
  lightGray: '#F0F0F0',
  blue: '#4361ee',
  lightBlue: '#e6f0ff',
  red: '#e74c3c',
  green: '#2ecc71',
  border: '#E0E0E0',
  yellow: '#f1c40f',
  purple: '#9b59b6',
  teal: '#1abc9c',
  darkBlue: '#2c3e50',
  orange: '#e67e22',
};

export default function AccountScreen() {
  const router = useRouter();
  
  const [employeeInfo, setEmployeeInfo] = useState<any>(null);
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<'none' | 'checked-in' | 'checked-out'>('none');
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(moment().format('YYYY-MM'));
  const [workSummary, setWorkSummary] = useState({ fullDays: 0, halfDays: 0 });
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    photoUrl: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser || !currentUser.email) {
          Alert.alert('Lỗi', 'Không xác định được người dùng');
          return;
        }

        const db = getDatabase();
        
        // Tìm chủ cửa hàng có email trùng với người dùng
        const usersRef = ref(db, 'users');
        const usersSnap = await get(usersRef);
        
        let ownerUserId = null;
        let employeeData = null;
        let branchData = null;
        
        if (usersSnap.exists()) {
          const users = usersSnap.val();
          
          // Tìm user có email trùng với email đăng nhập
          for (const userId in users) {
            const userData = users[userId];
            
            // Kiểm tra nếu là chủ cửa hàng
            if (userData.info_user?.email === currentUser.email) {
              ownerUserId = userId;
              setEmployeeInfo({
                ...userData.info_user,
                position: 'owner'
              });
              setFormData({
                name: userData.info_user?.name || '',
                email: userData.info_user?.email || '',
                phone: userData.info_user?.phone || '',
                photoUrl: userData.info_user?.avatarUrl || '',
              });
              break;
            }
            
            // Kiểm tra nhân viên
            if (userData.employees) {
              for (const empId in userData.employees) {
                const employee = userData.employees[empId];
                if (employee.email === currentUser.email) {
                  ownerUserId = userId;
                  employeeData = { ...employee, id: empId };
                  setEmployeeInfo(employeeData);
                  setFormData({
                    name: employeeData.name || '',
                    email: employeeData.email || '',
                    phone: employeeData.phone || '',
                    photoUrl: employeeData.avatarUrl || '',
                  });
                  
                  // Lấy thông tin chi nhánh nếu có
                  if (employeeData.branchCode && userData.branches?.[employeeData.branchCode]) {
                    branchData = userData.branches[employeeData.branchCode];
                    setBranchInfo(branchData);
                  }
                  break;
                }
              }
            }
          }
        }

        if (!ownerUserId) {
          Alert.alert('Lỗi', 'Không tìm thấy thông tin tài khoản');
          setLoading(false);
          return;
        }

        // Kiểm tra trạng thái điểm danh hôm nay (chỉ cho nhân viên)
        if (employeeData) {
          const today = moment().format('YYYY-MM-DD');
          const attendanceRef = ref(db, `users/${ownerUserId}/employees/${employeeData.id}/attendance/${today}`);
          const attendanceSnap = await get(attendanceRef);
          
          if (attendanceSnap.exists()) {
            const data = attendanceSnap.val();
            if (data.checkIn && data.checkOut) {
              setAttendanceStatus('checked-out');
            } else if (data.checkIn) {
              setAttendanceStatus('checked-in');
            }
          } else {
            setAttendanceStatus('none');
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Lỗi khi lấy dữ liệu:', error);
        Alert.alert('Lỗi', 'Không thể tải thông tin tài khoản');
        setLoading(false);
      }
    };

    fetchData();
    
    // Yêu cầu quyền truy cập vị trí
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('Quyền truy cập vị trí bị từ chối');
        return;
      }

      // Lấy vị trí hiện tại
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location.coords);
    })();
  }, []);

  // Hàm kiểm tra khoảng cách đến nhà hàng
  const checkLocationProximity = (coords: Location.LocationObjectCoords) => {
    if (!branchInfo || !branchInfo.latitude || !branchInfo.longitude) {
      setLocationStatus('Không có thông tin vị trí chi nhánh');
      return;
    }
    
    const branchLat = parseFloat(branchInfo.latitude);
    const branchLng = parseFloat(branchInfo.longitude);
    
    const distance = calculateDistance(
      coords.latitude,
      coords.longitude,
      branchLat,
      branchLng
    );
    
  };

  // Tính khoảng cách giữa 2 điểm (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Bán kính Trái đất (km)
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c * 1000; // Chuyển sang mét
    return distance;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI/180);
  };

  // Xử lý điểm danh
  const handleAttendance = async (type: 'in' | 'out') => {
    setIsChecking(true);
    setErrorMessage(null);
    
    try {
      // Kiểm tra quyền truy cập vị trí
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMessage('Bạn cần cấp quyền truy cập vị trí để điểm danh');
        setIsChecking(false);
        return;
      }

      // Lấy vị trí hiện tại
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      }).catch(error => {
        console.error('Lỗi khi lấy vị trí:', error);
        throw new Error('Không thể lấy vị trí hiện tại');
      });

      setCurrentLocation(location.coords);
      checkLocationProximity(location.coords);
      
      // Kiểm tra thông tin chi nhánh
      if (!branchInfo || !branchInfo.latitude || !branchInfo.longitude) {
        setErrorMessage('Chi nhánh chưa được cấu hình đúng - Vui lòng báo quản lý');
        setIsChecking(false);
        return;
      }
      
      const branchLat = parseFloat(branchInfo.latitude);
      const branchLng = parseFloat(branchInfo.longitude);
      
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        branchLat,
        branchLng
      );
      
      if (distance > 20) {
        setErrorMessage(`Bạn đang cách nhà hàng ${distance.toFixed(0)}m. Vui lòng đến gần hơn để điểm danh.`);
        setIsChecking(false);
        return;
      }
      
      // Lấy ID nhân viên và chủ cửa hàng
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        setErrorMessage('Không xác định được người dùng');
        setIsChecking(false);
        return;
      }
      
      const db = getDatabase();
      const usersRef = ref(db, 'users');
      const usersSnap = await get(usersRef);
      
      let ownerUserId = null;
      let employeeId = null;
      
      if (usersSnap.exists()) {
        const users = usersSnap.val();
        for (const userId in users) {
          const userData = users[userId];
          
          // Tìm chủ cửa hàng
          if (userData.info_user?.email === currentUser.email) {
            ownerUserId = userId;
            break;
          }
          
          // Tìm nhân viên
          if (userData.employees) {
            for (const empId in userData.employees) {
              if (userData.employees[empId].email === currentUser.email) {
                ownerUserId = userId;
                employeeId = empId;
                break;
              }
            }
          }
        }
      }
      
      if (!ownerUserId || !employeeId) {
        setErrorMessage('Không tìm thấy thông tin nhân viên');
        setIsChecking(false);
        return;
      }
      
      // Lưu điểm danh vào Firebase
      const today = moment().format('YYYY-MM-DD');
      const attendanceRef = ref(db, `users/${ownerUserId}/employees/${employeeId}/attendance/${today}`);
      
      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: new Date().getTime(),
      };
      
      if (type === 'in') {
        // Tạo bản ghi check-in
        await update(attendanceRef, {
          checkIn: {
            timestamp: moment().toISOString(),
            location: locationData
          }
        });
      } else {
        // Tạo bản ghi check-out
        await update(attendanceRef, {
          checkOut: {
            timestamp: moment().toISOString(),
            location: locationData
          }
        });
      }
      
      setAttendanceStatus(type === 'in' ? 'checked-in' : 'checked-out');
      Alert.alert('Thành công', `Điểm danh ${type === 'in' ? 'vào' : 'ra'} thành công!`);
      
    } catch (error: any) {
      console.error('Lỗi điểm danh:', error);
      setErrorMessage(error.message || 'Đã xảy ra lỗi khi điểm danh. Vui lòng thử lại.');
    } finally {
      setIsChecking(false);
    }
  };

  // Xem lịch sử điểm danh
  const viewAttendanceHistory = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        Alert.alert('Lỗi', 'Không xác định được người dùng');
        return;
      }
      
      const db = getDatabase();
      const usersRef = ref(db, 'users');
      const usersSnap = await get(usersRef);
      
      let ownerUserId = null;
      let employeeId = null;
      
      if (usersSnap.exists()) {
        const users = usersSnap.val();
        for (const userId in users) {
          const userData = users[userId];
          
          if (userData.info_user?.email === currentUser.email) {
            ownerUserId = userId;
            break;
          }
          
          if (userData.employees) {
            for (const empId in userData.employees) {
              if (userData.employees[empId].email === currentUser.email) {
                ownerUserId = userId;
                employeeId = empId;
                break;
              }
            }
          }
        }
      }
      
      if (!ownerUserId || !employeeId) {
        Alert.alert('Lỗi', 'Không tìm thấy thông tin nhân viên');
        return;
      }
      
      // Lấy dữ liệu lịch sử điểm danh
      const historyRef = ref(db, `users/${ownerUserId}/employees/${employeeId}/attendance`);
      const historySnap = await get(historyRef);
      
      let historyData: any[] = [];
      let fullDays = 0;
      let halfDays = 0;
      
      if (historySnap.exists()) {
        const data = historySnap.val();
        
        // Chuyển đổi thành mảng
        for (const date in data) {
          const record = data[date];
          historyData.push({
            date,
            checkIn: record.checkIn?.timestamp,
            checkOut: record.checkOut?.timestamp,
            locationIn: record.checkIn?.location,
            locationOut: record.checkOut?.location
          });
          
          // Tính số ngày công
          if (record.checkIn && record.checkOut) {
            fullDays++;
          } else if (record.checkIn || record.checkOut) {
            halfDays++;
          }
        }
        
        // Sắp xếp theo ngày giảm dần
        historyData.sort((a, b) => moment(b.date).diff(moment(a.date)));
      }
      
      setAttendanceHistory(historyData);
      setWorkSummary({ fullDays, halfDays });
      setShowHistoryModal(true);
    } catch (error) {
      console.error('Lỗi khi lấy lịch sử:', error);
      Alert.alert('Lỗi', 'Không thể tải lịch sử điểm danh');
    }
  };

  // Lọc theo tháng
  const filteredHistory = attendanceHistory.filter(item => {
    return moment(item.date).format('YYYY-MM') === selectedMonth;
  });

  // Xác định trạng thái điểm danh
  const getAttendanceStatus = (record: any) => {
    if (!record.checkIn && !record.checkOut) return 'Không điểm danh';
    if (record.checkIn && !record.checkOut) return 'Chỉ điểm danh vào';
    if (!record.checkIn && record.checkOut) return 'Chỉ điểm danh ra';
    
    // Cả hai đều có
    return 'Hoàn thành';
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleSave = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      Alert.alert('Lỗi', 'Không xác định được người dùng');
      return;
    }

    setSaving(true);
    try {
      const db = getDatabase();
      const usersRef = ref(db, 'users');
      const usersSnap = await get(usersRef);
      
      let ownerUserId = null;
      let employeeId = null;
      
      if (usersSnap.exists()) {
        const users = usersSnap.val();
        for (const userId in users) {
          const userData = users[userId];
          
          // Tìm chủ cửa hàng
          if (userData.info_user?.email === currentUser.email) {
            ownerUserId = userId;
            break;
          }
          
          // Tìm nhân viên
          if (userData.employees) {
            for (const empId in userData.employees) {
              if (userData.employees[empId].email === currentUser.email) {
                ownerUserId = userId;
                employeeId = empId;
                break;
              }
            }
          }
        }
      }
      
      if (!ownerUserId) {
        Alert.alert('Lỗi', 'Không tìm thấy tài khoản');
        return;
      }
      
      const updates: any = {};
      if (formData.name !== employeeInfo.name) updates.name = formData.name;
      if (formData.phone !== employeeInfo.phone) updates.phone = formData.phone;
      if (formData.photoUrl !== employeeInfo.photoUrl) updates.photoUrl = formData.photoUrl;
      
      // Cập nhật thông tin
      if (employeeId) {
        // Nhân viên
        const employeeRef = ref(db, `users/${ownerUserId}/employees/${employeeId}`);
        await update(employeeRef, updates);
        
        setEmployeeInfo({
          ...employeeInfo,
          ...updates
        });
      } else {
        // Chủ cửa hàng
        const infoUserRef = ref(db, `users/${ownerUserId}/info_user`);
        await update(infoUserRef, {
          name: formData.name,
          phone: formData.phone,
          avatarUrl: formData.photoUrl
        });
        
        setEmployeeInfo({
          ...employeeInfo,
          name: formData.name,
          phone: formData.phone,
          avatarUrl: formData.photoUrl
        });
      }
      
      await AsyncStorage.setItem('userName', formData.name);
      
      setIsEditing(false);
      Alert.alert('Thành công', 'Thông tin đã được cập nhật');
    } catch (error) {
      console.error('Lỗi khi cập nhật:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật thông tin');
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        
        setSaving(true);
        const response = await fetch(uri);
        const blob = await response.blob();
        
        const storage = getStorage();
        const fileName = `profile_${Date.now()}`;
        const fileRef = storageRef(storage, `profile_images/${fileName}`);
        
        await uploadBytes(fileRef, blob);
        const downloadURL = await getDownloadURL(fileRef);
        
        setFormData({
          ...formData,
          photoUrl: downloadURL
        });
        
        setSaving(false);
      }
    } catch (error) {
      console.error('Lỗi khi chọn ảnh:', error);
      setSaving(false);
    }
  };

  // Xử lý đổi mật khẩu
  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu mới và xác nhận mật khẩu không khớp');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    setChangingPassword(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user || !user.email) {
        Alert.alert('Lỗi', 'Không xác định được người dùng');
        return;
      }

      // Xác thực lại người dùng với mật khẩu hiện tại
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Cập nhật mật khẩu mới
      await updatePassword(user, passwordData.newPassword);

      Alert.alert('Thành công', 'Mật khẩu đã được thay đổi thành công');
      setShowChangePasswordModal(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      console.error('Lỗi khi đổi mật khẩu:', error);
      
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Lỗi', 'Mật khẩu hiện tại không đúng');
      } else if (error.code === 'auth/requires-recent-login') {
        Alert.alert('Lỗi', 'Vui lòng đăng nhập lại để thực hiện thao tác này');
      } else {
        Alert.alert('Lỗi', 'Đã xảy ra lỗi khi đổi mật khẩu: ' + error.message);
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userEmail');
      await AsyncStorage.removeItem('userPassword');
      const auth = getAuth();
      await signOut(auth);
      router.replace('/login');
    } catch (error) {
      Alert.alert('Lỗi đăng xuất', 'Đã xảy ra lỗi khi đăng xuất');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.blue} />
        <Text style={styles.loadingText}>Đang tải thông tin...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Tài khoản của tôi</Text>
        {!isEditing ? (
          <TouchableOpacity onPress={handleEditToggle} style={styles.editButton}>
            <MaterialIcons name="edit" size={24} color={COLORS.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>Lưu</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Avatar section */}
      <View style={styles.avatarContainer}>
        <TouchableOpacity 
          onPress={isEditing ? handlePickImage : undefined}
          disabled={!isEditing}
        >
          <View style={styles.avatarWrapper}>
            <Image 
              source={{ uri: formData.photoUrl || 'https://via.placeholder.com/150' }} 
              style={styles.avatar}
            />
            {isEditing && (
              <View style={styles.cameraIcon}>
                <MaterialIcons name="camera-alt" size={20} color={COLORS.white} />
              </View>
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.positionText}>
          {employeeInfo?.position === 'manager' 
            ? 'Quản lý cửa hàng' 
            : employeeInfo?.position === 'owner'
              ? 'Chủ cửa hàng'
              : 'Nhân viên'}
        </Text>
      </View>

      {/* Form fields */}
      <View style={styles.card}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Họ và tên</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
              placeholder="Nhập họ tên"
              placeholderTextColor={COLORS.gray}
            />
          ) : (
            <Text style={styles.value}>{employeeInfo?.name || 'Chưa cập nhật'}</Text>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.formGroup}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{employeeInfo?.email || 'Chưa cập nhật'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.formGroup}>
          <Text style={styles.label}>Số điện thoại</Text>
          {isEditing ? (
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => handleInputChange('phone', text)}
              placeholder="Nhập số điện thoại"
              placeholderTextColor={COLORS.gray}
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.value}>{employeeInfo?.phone || 'Chưa cập nhật'}</Text>
          )}
        </View>
      </View>

      {/* Nút đổi mật khẩu */}
      <TouchableOpacity 
        style={styles.changePasswordButton}
        onPress={() => setShowChangePasswordModal(true)}
      >
        <Ionicons name="key" size={20} color={COLORS.white} />
        <Text style={styles.changePasswordButtonText}>Đổi mật khẩu</Text>
      </TouchableOpacity>

      {/* Chi nhánh làm việc */}
      {branchInfo && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Chi nhánh làm việc</Text>
          <View style={styles.branchInfo}>
            <Ionicons name="business" size={20} color={COLORS.purple} style={styles.branchIcon} />
            <Text style={styles.branchName}>{branchInfo.name}</Text>
          </View>
          <View style={styles.branchInfo}>
            <Ionicons name="location" size={20} color={COLORS.purple} style={styles.branchIcon} />
            <Text style={styles.branchAddress}>{branchInfo.address_detail}</Text>
          </View>
          {branchInfo.latitude && branchInfo.longitude && (
            <View style={styles.locationInfo}>
              <Ionicons name="map" size={16} color={COLORS.gray} />
              <Text style={styles.locationText}>
                {parseFloat(branchInfo.latitude).toFixed(6)}, {parseFloat(branchInfo.longitude).toFixed(6)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Chỉ hiển thị phần điểm danh cho nhân viên */}
      {employeeInfo?.position !== 'owner' && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Điểm danh</Text>

          {locationStatus && (
            <View style={[
              styles.locationStatus,
              locationStatus.includes('cách') ? styles.locationError : styles.locationSuccess
            ]}>
              <Ionicons 
                name="location" 
                size={20} 
                color={locationStatus.includes('cách') ? COLORS.red : COLORS.green} 
              />
              <Text style={styles.locationStatusText}>
                {locationStatus}
              </Text>
            </View>
          )}

          {/* Hiển thị thông báo lỗi */}
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Ionicons name="warning" size={20} color={COLORS.red} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Hiển thị đang xử lý */}
          {isChecking && (
            <View style={styles.checkingContainer}>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.checkingText}>Đang xử lý điểm danh...</Text>
            </View>
          )}

          {/* Nút điểm danh */}
          <View style={styles.attendanceButtonContainer}>
            <TouchableOpacity 
              style={[styles.attendanceButton, styles.checkInButton]}
              onPress={() => handleAttendance('in')}
              disabled={isChecking || attendanceStatus === 'checked-in'}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="log-in" size={20} color={COLORS.white} />
                  <Text style={styles.attendanceButtonText}>ĐIỂM DANH VÀO</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.attendanceButton, styles.checkOutButton]}
              onPress={() => handleAttendance('out')}
              disabled={isChecking || attendanceStatus === 'checked-out' || attendanceStatus === 'none'}
            >
              {isChecking ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="log-out" size={20} color={COLORS.white} />
                  <Text style={styles.attendanceButtonText}>ĐIỂM DANH RA</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Nút xem lịch sử */}
          <TouchableOpacity 
            style={styles.historyButton}
            onPress={viewAttendanceHistory}
          >
            <FontAwesome name="history" size={18} color={COLORS.white} />
            <Text style={styles.historyButtonText}>Xem lịch sử điểm danh</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Logout button */}
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Ionicons name="log-out" size={20} color={COLORS.white} />
        <Text style={styles.logoutButtonText}>Đăng xuất</Text>
      </TouchableOpacity>

      {/* Modal lịch sử điểm danh */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
              <AntDesign name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Lịch sử điểm danh</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Bộ lọc tháng */}
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>Chọn tháng:</Text>
            <View style={styles.monthPicker}>
              <TouchableOpacity 
                onPress={() => setSelectedMonth(moment(selectedMonth).subtract(1, 'month').format('YYYY-MM'))}
              >
                <AntDesign name="left" size={20} color={COLORS.blue} />
              </TouchableOpacity>
              <Text style={styles.selectedMonth}>
                {moment(selectedMonth).format('MM/YYYY')}
              </Text>
              <TouchableOpacity 
                onPress={() => setSelectedMonth(moment(selectedMonth).add(1, 'month').format('YYYY-MM'))}
                disabled={selectedMonth === moment().format('YYYY-MM')}
              >
                <AntDesign 
                  name="right" 
                  size={20} 
                  color={selectedMonth === moment().format('YYYY-MM') ? COLORS.gray : COLORS.blue} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Thống kê */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{workSummary.fullDays}</Text>
              <Text style={styles.summaryLabel}>Ngày đủ</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{workSummary.halfDays}</Text>
              <Text style={styles.summaryLabel}>Ngày thiếu</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{workSummary.fullDays + (workSummary.halfDays * 0.5)}</Text>
              <Text style={styles.summaryLabel}>Tổng ngày</Text>
            </View>
          </View>

          {/* Danh sách lịch sử */}
          <FlatList
            data={filteredHistory}
            keyExtractor={(item) => item.date}
            renderItem={({ item }) => (
              <View style={styles.historyItem}>
                <Text style={styles.historyDate}>{moment(item.date).format('DD/MM/YYYY')}</Text>
                
                <View style={styles.historyDetail}>
                  {item.checkIn ? (
                    <View style={styles.timeContainer}>
                      <Ionicons name="log-in" size={16} color={COLORS.green} />
                      <Text style={styles.timeText}>
                        Vào: {moment(item.checkIn).format('HH:mm')}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.missingText}>Không điểm danh vào</Text>
                  )}
                  
                  {item.checkOut ? (
                    <View style={styles.timeContainer}>
                      <Ionicons name="log-out" size={16} color={COLORS.orange} />
                      <Text style={styles.timeText}>
                        Ra: {moment(item.checkOut).format('HH:mm')}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.missingText}>Không điểm danh ra</Text>
                  )}
                </View>
                
                <Text style={[
                  styles.statusText,
                  getAttendanceStatus(item) === 'Hoàn thành' ? styles.completedStatus : 
                  getAttendanceStatus(item) === 'Không điểm danh' ? styles.missingStatus : 
                  styles.partialStatus
                ]}>
                  {getAttendanceStatus(item)}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle" size={40} color={COLORS.gray} />
                <Text style={styles.emptyText}>Không có dữ liệu điểm danh</Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Modal đổi mật khẩu */}
      <Modal
        visible={showChangePasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <View style={styles.passwordModalContainer}>
          <View style={styles.passwordModalContent}>
            <View style={styles.passwordModalHeader}>
              <Text style={styles.passwordModalTitle}>Đổi mật khẩu</Text>
              <TouchableOpacity onPress={() => setShowChangePasswordModal(false)}>
                <AntDesign name="close" size={24} color={COLORS.black} />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordForm}>
              <View style={styles.passwordInputGroup}>
                <Text style={styles.passwordLabel}>Mật khẩu hiện tại</Text>
                <TextInput
                  style={styles.passwordInput}
                  value={passwordData.currentPassword}
                  onChangeText={(text) => setPasswordData({...passwordData, currentPassword: text})}
                  placeholder="Nhập mật khẩu hiện tại"
                  secureTextEntry={true}
                  placeholderTextColor={COLORS.gray}
                />
              </View>

              <View style={styles.passwordInputGroup}>
                <Text style={styles.passwordLabel}>Mật khẩu mới</Text>
                <TextInput
                  style={styles.passwordInput}
                  value={passwordData.newPassword}
                  onChangeText={(text) => setPasswordData({...passwordData, newPassword: text})}
                  placeholder="Nhập mật khẩu mới"
                  secureTextEntry={true}
                  placeholderTextColor={COLORS.gray}
                />
              </View>

              <View style={styles.passwordInputGroup}>
                <Text style={styles.passwordLabel}>Xác nhận mật khẩu</Text>
                <TextInput
                  style={styles.passwordInput}
                  value={passwordData.confirmPassword}
                  onChangeText={(text) => setPasswordData({...passwordData, confirmPassword: text})}
                  placeholder="Xác nhận mật khẩu mới"
                  secureTextEntry={true}
                  placeholderTextColor={COLORS.gray}
                />
              </View>

              <TouchableOpacity 
                style={[styles.submitPasswordButton, changingPassword && styles.submitPasswordButtonDisabled]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.submitPasswordButtonText}>Đổi mật khẩu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.darkBlue,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.darkBlue,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.darkBlue,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingTop: 50,
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
    flex: 1,
    textAlign: 'center',
    marginRight: 24,
  },
  editButton: {
    padding: 5,
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 30,
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: COLORS.teal,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: COLORS.blue,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionText: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.white,
    marginTop: 15,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  card: {
    backgroundColor: '#2d3748',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 5,
  },
  value: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '500',
  },
  input: {
    fontSize: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#4a5568',
    color: COLORS.white,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#4a5568',
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#4a5568',
  },
  branchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  branchIcon: {
    marginRight: 10,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  branchAddress: {
    fontSize: 14,
    color: COLORS.gray,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  locationText: {
    fontSize: 12,
    color: COLORS.gray,
    marginLeft: 5,
  },
  changePasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.orange,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  changePasswordButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e53e3e',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 20,
    shadowColor: '#e53e3e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  logoutButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  locationSuccess: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
  },
  locationError: {
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
  },
  locationStatusText: {
    fontSize: 14,
    marginLeft: 8,
    color: COLORS.white,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: {
    color: COLORS.red,
    marginLeft: 8,
    fontSize: 14,
  },
  checkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  checkingText: {
    color: COLORS.white,
    marginLeft: 8,
    fontSize: 14,
  },
  attendanceButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  attendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
  },
  checkInButton: {
    backgroundColor: COLORS.teal,
  },
  checkOutButton: {
    backgroundColor: COLORS.purple,
  },
  attendanceButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.orange,
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
  },
  historyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.darkBlue,
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#4a5568',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#2d3748',
    margin: 15,
    borderRadius: 10,
  },
  filterLabel: {
    color: COLORS.white,
    fontSize: 16,
  },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedMonth: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 15,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    marginHorizontal: 15,
    backgroundColor: '#2d3748',
    borderRadius: 10,
    marginBottom: 15,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  summaryLabel: {
    color: COLORS.gray,
    fontSize: 14,
    marginTop: 5,
  },
  historyItem: {
    backgroundColor: '#2d3748',
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyDate: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
    width: '25%',
  },
  historyDetail: {
    flex: 1,
    marginLeft: 15,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  timeText: {
    color: COLORS.white,
    marginLeft: 5,
  },
  statusText: {
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 15,
    fontSize: 12,
  },
  completedStatus: {
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    color: COLORS.green,
  },
  partialStatus: {
    backgroundColor: 'rgba(241, 196, 15, 0.2)',
    color: COLORS.yellow,
  },
  missingStatus: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    color: COLORS.red,
  },
  missingText: {
    color: COLORS.red,
    fontStyle: 'italic',
    marginBottom: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: COLORS.gray,
    marginTop: 15,
    fontSize: 16,
  },
  // Password modal styles
  passwordModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  passwordModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  passwordModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  passwordModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  passwordForm: {
    marginBottom: 10,
  },
  passwordInputGroup: {
    marginBottom: 15,
  },
  passwordLabel: {
    fontSize: 14,
    color: COLORS.black,
    marginBottom: 5,
  },
  passwordInput: {
    fontSize: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.lightGray,
    color: COLORS.black,
    fontWeight: '500',
  },
  submitPasswordButton: {
    backgroundColor: COLORS.blue,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitPasswordButtonDisabled: {
    backgroundColor: COLORS.gray,
  },
  submitPasswordButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});