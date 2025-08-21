import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView
} from 'react-native';
import { getDatabase, ref, onValue } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import moment from 'moment';
import 'moment/locale/vi';

moment.locale('vi');

export default function RevenueScreen() {
  const [orders, setOrders] = useState([]);
  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [weeklyRevenue, setWeeklyRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [orderTypeRatio, setOrderTypeRatio] = useState({ takeaway: 0, dinein: 0 });
  const [branchCode, setBranchCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState('today');

  const db = getDatabase();

  // Tải dữ liệu chi nhánh
  useEffect(() => {
    const loadBranchData = async () => {
      const branchData = await AsyncStorage.getItem('selectedBranch');
      if (branchData) {
        const branchObj = JSON.parse(branchData);
        setBranchCode(branchObj.code);
        loadOrders(branchObj.code);
      }
    };
    loadBranchData();
  }, []);

  // Tải dữ liệu đơn hàng từ đúng đường dẫn trong JSON
  const loadOrders = (currentBranchCode) => {
  const ordersRef = ref(db, `users/dg0nQI4hyqXbo7oLhj5xbuPc9Pd2/branches/${currentBranchCode}/orders`);
  
  onValue(ordersRef, (snapshot) => {
    if (snapshot.exists()) {
      const ordersData = snapshot.val();
      const ordersArray = Object.keys(ordersData).map(key => ({
        id: key,
        ...ordersData[key]
      }));
      
      // Lọc đơn hàng đã thanh toán (sửa điều kiện)
      const paidOrders = ordersArray.filter(order => 
        order.status === 'đã thanh toán' || order.status === 'completed'
      );
      
      setOrders(paidOrders);
      calculateRevenue(paidOrders);
      calculateTopProducts(paidOrders);
      calculateOrderTypeRatio(paidOrders);
      setLoading(false);
    } else {
      setOrders([]);
      setLoading(false);
    }
  });
};

  // Tính toán doanh thu
  const calculateRevenue = (ordersList) => {
  const today = moment().startOf('day');
  const weekStart = moment().startOf('week');
  const weekEnd = moment().endOf('week');
  const monthStart = moment().startOf('month');
  
  // Tính doanh thu ngày
  const dailyRev = ordersList
    .filter(order => {
      if (!order.createdAt) return false;
      const orderDate = moment(order.createdAt);
      return orderDate.isSameOrAfter(today);
    })
    .reduce((sum, order) => sum + (parseInt(order.total) || 0), 0);
  
  setDailyRevenue(dailyRev);
  
  // Tính doanh thu tuần
  const weeklyRev = ordersList
    .filter(order => {
      if (!order.createdAt) return false;
      const orderDate = moment(order.createdAt);
      return orderDate.isSameOrAfter(weekStart) && orderDate.isSameOrBefore(weekEnd);
    })
    .reduce((sum, order) => sum + (parseInt(order.total) || 0), 0);
  
  setWeeklyRevenue(weeklyRev);
  
  // Tính doanh thu tháng
  const monthlyRev = ordersList
    .filter(order => {
      if (!order.createdAt) return false;
      const orderDate = moment(order.createdAt);
      return orderDate.isSameOrAfter(monthStart);
    })
    .reduce((sum, order) => sum + (parseInt(order.total) || 0), 0);
  
  setMonthlyRevenue(monthlyRev);
};

  // Tính toán top sản phẩm
  const calculateTopProducts = (ordersList) => {
    const currentMonth = moment().format('YYYY-MM');
    const monthlyOrders = ordersList.filter(order => 
      order.createdAt && order.createdAt.includes(currentMonth)
    );
    
    const productCounts = {};
    
    monthlyOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          if (item.productId) {
            if (!productCounts[item.productId]) {
              productCounts[item.productId] = {
                name: item.name || 'Sản phẩm không tên',
                count: 0,
                revenue: 0,
                image: item.image || null
              };
            }
            productCounts[item.productId].count += parseInt(item.quantity) || 1;
            productCounts[item.productId].revenue += (parseInt(item.price) || 0) * (parseInt(item.quantity) || 1);
          }
        });
      }
    });
    
    // Chuyển đổi thành mảng và sắp xếp
    const productsArray = Object.keys(productCounts).map(productId => ({
      id: productId,
      ...productCounts[productId]
    }));
    
    productsArray.sort((a, b) => b.count - a.count);
    
    // Lấy top 3
    setTopProducts(productsArray.slice(0, 3));
  };

  // Tính tỷ lệ loại đơn hàng
  const calculateOrderTypeRatio = (ordersList) => {
    const today = moment().format('YYYY-MM-DD');
    const todayOrders = ordersList.filter(order => 
      order.createdAt && order.createdAt.includes(today)
    );
    
    const typeCounts = { takeaway: 0, dinein: 0 };
    
    todayOrders.forEach(order => {
      if (order.type === 'takeaway') {
        typeCounts.takeaway += 1;
      } else if (order.type === 'dine-in') {
        typeCounts.dinein += 1;
      }
    });
    
    const totalOrders = todayOrders.length;
    if (totalOrders > 0) {
      setOrderTypeRatio({
        takeaway: Math.round((typeCounts.takeaway / totalOrders) * 100),
        dinein: Math.round((typeCounts.dinein / totalOrders) * 100)
      });
    } else {
      setOrderTypeRatio({ takeaway: 0, dinein: 0 });
    }
  };

  // Render item top sản phẩm
  const renderTopProduct = ({ item, index }) => (
    <View style={styles.productItem}>
      <View style={[styles.productRank, index === 0 ? styles.top1 : index === 1 ? styles.top2 : styles.top3]}>
        <Text style={styles.rankText}>#{index + 1}</Text>
      </View>
      
      {item.image ? (
        <Image 
          source={{ uri: item.image }} 
          style={styles.productImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Icon name="fastfood" size={24} color="#94a3b8" />
        </View>
      )}
      
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.productStats}>
          {item.count} đơn • {item.revenue.toLocaleString()}đ
        </Text>
      </View>
    </View>
  );

  // Render doanh thu theo thời gian
  const renderRevenueCard = (title, value, period, icon) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <Icon name={icon} size={24} color="#3b82f6" />
        <Text style={styles.statLabel}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value.toLocaleString()}đ</Text>
      <Text style={styles.statSubtitle}>
        {period === 'today' ? moment().format('dddd, DD/MM/YYYY') : 
         period === 'week' ? `Tuần ${moment().week()} (${moment().startOf('week').format('DD/MM')} - ${moment().endOf('week').format('DD/MM')})` : 
         `Tháng ${moment().format('MM/YYYY')}`}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4361ee" />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Quản lý Doanh thu</Text>
          <View style={styles.timeFilter}>
            <TouchableOpacity 
              style={[styles.timeButton, timePeriod === 'today' && styles.activeTimeButton]}
              onPress={() => setTimePeriod('today')}
            >
              <Text style={[styles.timeButtonText, timePeriod === 'today' && styles.activeTimeButtonText]}>Hôm nay</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.timeButton, timePeriod === 'week' && styles.activeTimeButton]}
              onPress={() => setTimePeriod('week')}
            >
              <Text style={[styles.timeButtonText, timePeriod === 'week' && styles.activeTimeButtonText]}>Tuần</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.timeButton, timePeriod === 'month' && styles.activeTimeButton]}
              onPress={() => setTimePeriod('month')}
            >
              <Text style={[styles.timeButtonText, timePeriod === 'month' && styles.activeTimeButtonText]}>Tháng</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Doanh thu chính */}
          <View style={styles.mainRevenueCard}>
            <Text style={styles.mainRevenueLabel}>
              {timePeriod === 'today' ? 'DOANH THU HÔM NAY' : 
              timePeriod === 'week' ? 'DOANH THU TUẦN' : 'DOANH THU THÁNG'}
            </Text>
            <Text style={styles.mainRevenueValue}>
              {timePeriod === 'today' ? dailyRevenue.toLocaleString() : 
              timePeriod === 'week' ? weeklyRevenue.toLocaleString() : monthlyRevenue.toLocaleString()}đ
            </Text>
            <View style={styles.revenueComparison}>
              <Icon name="trending-up" size={20} color="#16a34a" />
              <Text style={styles.comparisonText}>
                {timePeriod === 'today' ? 'So với hôm qua: +12%' : 
                timePeriod === 'week' ? 'So với tuần trước: +8%' : 'So với tháng trước: +15%'}
              </Text>
            </View>
          </View>

          {/* Thống kê doanh thu theo thời gian */}
          <View style={styles.statsRow}>
            {renderRevenueCard('Hôm nay', dailyRevenue, 'today', 'today')}
            {renderRevenueCard('Tuần này', weeklyRevenue, 'week', 'calendar-view-week')}
          </View>
          
          <View style={styles.statsRow}>
            {renderRevenueCard('Tháng này', monthlyRevenue, 'month', 'calendar-month')}
            
            <View style={styles.statCard}>
              <View style={styles.statHeader}>
                <Icon name="receipt" size={24} color="#ef4444" />
                <Text style={styles.statLabel}>Tổng đơn hàng</Text>
              </View>
              <Text style={styles.statValue}>{orders.length}</Text>
              <Text style={styles.statSubtitle}>
                {moment().format('DD/MM/YYYY')}
              </Text>
            </View>
          </View>

          {/* Tỷ lệ đơn hàng */}
          <View style={styles.ratioContainer}>
            <Text style={styles.sectionTitle}>Tỷ lệ loại đơn hàng</Text>
            <View style={styles.ratioRow}>
              <View style={[styles.ratioCard, {backgroundColor: '#dbeafe'}]}>
                <Icon name="restaurant" size={30} color="#3b82f6" />
                <Text style={styles.ratioLabel}>Tại bàn</Text>
                <Text style={styles.ratioValue}>{orderTypeRatio.dinein}%</Text>
                <Text style={styles.ratioCount}>
                  {orders.filter(o => o.type === 'dine-in').length} đơn
                </Text>
              </View>
              
              <View style={[styles.ratioCard, {backgroundColor: '#fee2e2'}]}>
                <Icon name="takeout-dining" size={30} color="#ef4444" />
                <Text style={styles.ratioLabel}>Mang về</Text>
                <Text style={styles.ratioValue}>{orderTypeRatio.takeaway}%</Text>
                <Text style={styles.ratioCount}>
                  {orders.filter(o => o.type === 'takeaway').length} đơn
                </Text>
              </View>
            </View>
          </View>

          {/* Top sản phẩm */}
          <View style={styles.topProductsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top 3 món bán chạy tháng</Text>
              <Text style={styles.sectionSubtitle}>
                {moment().format('MM/YYYY')}
              </Text>
            </View>
            
            {topProducts.length > 0 ? (
              <FlatList
                data={topProducts}
                renderItem={renderTopProduct}
                keyExtractor={item => item.id}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Icon name="emoji-food-beverage" size={50} color="#cbd5e1" />
                <Text style={styles.emptyText}>Chưa có dữ liệu bán hàng</Text>
              </View>
            )}
          </View>

          {/* Thống kê đơn hàng gần đây */}
          <View style={styles.recentOrders}>
            <Text style={styles.sectionTitle}>Đơn hàng gần đây</Text>
            {orders.slice(0, 3).map((order, index) => (
              <View key={index} style={styles.orderItem}>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderId}>#{order.id.substring(0, 6)}</Text>
                  <Text style={styles.orderTable}>{order.tableName || 'Không có bàn'}</Text>
                </View>
                <Text style={styles.orderTime}>
                  {moment(order.createdAt).format('HH:mm DD/MM')}
                </Text>
                <Text style={styles.orderAmount}>
                  {parseInt(order.total).toLocaleString()}đ
                </Text>
              </View>
            ))}
          </View>
          
          {/* Thêm padding bottom để tránh bị che bởi tab bar */}
          <View style={styles.bottomPadding} />
        </ScrollView>
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingTop: 40, // Thêm padding top để tránh bị che
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 16,
  },
  timeFilter: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  timeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 5,
    backgroundColor: '#f1f5f9',
  },
  activeTimeButton: {
    backgroundColor: '#3b82f6',
  },
  timeButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  activeTimeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 80, // Tăng padding bottom để tránh bị che bởi tab bar
  },
  mainRevenueCard: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  mainRevenueLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  mainRevenueValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
  },
  revenueComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  comparisonText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '48%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  ratioContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  ratioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratioCard: {
    alignItems: 'center',
    width: '48%',
    padding: 16,
    borderRadius: 12,
  },
  ratioLabel: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 8,
  },
  ratioValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 4,
  },
  ratioCount: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  topProductsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  productRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  top1: {
    backgroundColor: '#ffd700',
  },
  top2: {
    backgroundColor: '#c0c0c0',
  },
  top3: {
    backgroundColor: '#cd7f32',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  imagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  productStats: {
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 10,
    fontSize: 16,
  },
  recentOrders: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  orderTable: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  orderTime: {
    fontSize: 14,
    color: '#64748b',
    marginHorizontal: 10,
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
  },
  bottomPadding: {
    height: 20, // Thêm padding ở cuối để đảm bảo nội dung không bị che
  },
});