import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Bell, 
  Search, 
  Package, 
  Truck, 
  User, 
  MapPin, 
  Clock,
  TrendingUp,
  Map as MapIcon,
  ChevronDown,
  Wallet,
  IndianRupee
} from 'lucide-react-native';
import io from 'socket.io-client';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';
import ProfileScreen from './ProfileScreen';
import MyDeliveriesScreen from './MyDeliveriesScreen';
import DirectionsScreen from './DirectionsScreen';
import DebugMapScreen from './DebugMapScreen';
import InfoScreen, { InfoType } from './InfoScreen';

import { API_BASE_URL } from '../config/api';

const BACKEND_URL = API_BASE_URL;

interface HomeScreenProps {
  userData: any;
  userToken: string | null;
  onLogout: () => void;
}

type TabType = 'pickups' | 'deliveries';

// ─── COMPONENT ──────────────────────────────────────────────────────────────
const HomeScreen: React.FC<HomeScreenProps> = ({ userData, userToken, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('pickups');
  const [searchText, setSearchText] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showMyDeliveries, setShowMyDeliveries] = useState(false);
  const [showInfo, setShowInfo] = useState<InfoType | null>(null);
  const [showDebugMap, setShowDebugMap] = useState(false);

  // Dynamic state loaded from the backend APIs
  const [pickups, setPickups] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrderForDirections, setSelectedOrderForDirections] = useState<any | null>(null);

  const [userProfile, setUserProfile] = useState<any>(userData);

  // Sync state if prop changes
  useEffect(() => {
    setUserProfile(userData);
  }, [userData]);

  // Fetch Available Pickups (where delivery_boy_opted = false and is_completed = false)
  const fetchPickups = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/orders/available`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setPickups(result.orders || []);
      } else {
        console.warn('[HomeScreen] Failed to fetch available pickups:', result.error);
      }
    } catch (error) {
      console.error('[HomeScreen] fetchPickups error:', error);
    }
  }, [userToken]);

  // Fetch Partner Deliveries (assigned to current partner, is_completed = false)
  const fetchDeliveries = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/orders/partner`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setDeliveries(result.orders || []);
      } else {
        console.warn('[HomeScreen] Failed to fetch partner deliveries:', result.error);
      }
    } catch (error) {
      console.error('[HomeScreen] fetchDeliveries error:', error);
    }
  }, [userToken]);

  // Fetch latest user profile (for live earnings update)
  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/user/profile`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setUserProfile(result.user);
      }
    } catch (error) {
      console.error('[HomeScreen] fetchUserProfile error:', error);
    }
  }, [userToken]);

  // Refresh mechanism
  const fetchBoth = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchPickups(), fetchDeliveries(), fetchUserProfile()]);
    } catch (error) {
      console.error('[HomeScreen] Refresh error:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [fetchPickups, fetchDeliveries, fetchUserProfile]);

  // Trigger load on mount or token change
  useEffect(() => {
    if (userToken) {
      setLoading(true);
      fetchBoth();
    }
  }, [userToken, fetchBoth]);

  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (userToken) {
      socketRef.current = io(BACKEND_URL);

      socketRef.current.on('connect', () => {
        console.log('[HomeScreen] Socket connected');
        socketRef.current.emit('join_room', 'delivery_partners');
        
        // Join rooms for all active deliveries
        deliveries.forEach(order => {
           socketRef.current.emit('join_room', `order_${order.id}`);
        });
      });

      socketRef.current.on('new_available_order', (newOrder: any) => {
        console.log('[HomeScreen] New available order:', newOrder.id);
        setPickups(prev => [newOrder, ...prev]);
      });

      socketRef.current.on('order_status_changed', (updatedOrder: any) => {
        console.log('[HomeScreen] Order updated:', updatedOrder.id, updatedOrder.status);
        // Refresh everything to ensure UI is in sync
        fetchBoth();
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [userToken, deliveries.length, fetchBoth]);

  // If Directions screen is overlayed
  if (selectedOrderForDirections) {
    return (
      <DirectionsScreen
        order={selectedOrderForDirections}
        userToken={userToken}
        onBack={() => setSelectedOrderForDirections(null)}
        onRefresh={fetchBoth}
      />
    );
  }

  if (showDebugMap) {
    return <DebugMapScreen onBack={() => setShowDebugMap(false)} />;
  }

  if (showMyDeliveries) {
    return (
      <MyDeliveriesScreen
        userToken={userToken || ''}
        onBack={() => setShowMyDeliveries(false)}
      />
    );
  }

  if (showProfile) {
    return (
      <ProfileScreen
        userData={userProfile}
        onBack={() => setShowProfile(false)}
        onLogout={onLogout}
        onInfoPress={(type) => setShowInfo(type)}
        onMyDeliveriesPress={() => {
          setShowProfile(false);
          setShowMyDeliveries(true);
        }}
      />
    );
  }

  if (showInfo) {
    return (
      <InfoScreen 
        type={showInfo}
        onBack={() => setShowInfo(null)}
      />
    );
  }

  const partnerName = userProfile?.fullName || userProfile?.full_name || 'Partner';

  const filteredPickups = pickups.filter(
    p =>
      searchText === '' ||
      (p.id && p.id.toLowerCase().includes(searchText.toLowerCase())) ||
      (p.store_name && p.store_name.toLowerCase().includes(searchText.toLowerCase())) ||
      (p.store_address && p.store_address.toLowerCase().includes(searchText.toLowerCase())),
  );

  const filteredDeliveries = deliveries.filter(
    d =>
      searchText === '' ||
      (d.id && d.id.toLowerCase().includes(searchText.toLowerCase())) ||
      (d.user_name && d.user_name.toLowerCase().includes(searchText.toLowerCase())) ||
      (d.delivery_address?.line1 && d.delivery_address.line1.toLowerCase().includes(searchText.toLowerCase())),
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      {/* ── HEADER (Synchronized with Customer App) ───────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerStatusText}>Ready to Deliver</Text>
            <TouchableOpacity style={styles.nameRow} onPress={() => setShowProfile(true)}>
              <Text style={styles.headerNameText} numberOfLines={1}>
                {partnerName}
              </Text>
              <ChevronDown size={16} color="#fff" style={styles.chevronIcon} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notifCircle}>
              <Bell size={20} color={Colors.text} />
              <View style={styles.notifBadge} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileCircle}
              onPress={() => setShowProfile(true)}
              onLongPress={() => setShowDebugMap(true)}
              delayLongPress={1000}
            >
              <User size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchBoth} colors={[Colors.primary]} />
        }
      >
        {/* ── SEARCH BAR ────────────────────────────────────── */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Search size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by Order ID or Location"
              placeholderTextColor={Colors.textLight}
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
        </View>

        {/* ── CUBIC STATS GRID ──────────────────────────────── */}
        <View style={styles.statsGrid}>
          {/* Today's Earning */}
          <View style={[styles.cubicCard, { backgroundColor: Colors.primary }]}>
            <View style={styles.cubicIconWrapLight}>
              <Clock size={18} color="#fff" strokeWidth={2.5} />
            </View>
            <Text style={styles.cubicLabelLight} numberOfLines={1}>Today</Text>
            <Text style={styles.cubicValueLight} numberOfLines={1}>₹{parseFloat(userProfile?.todayEarnings || 0).toFixed(0)}</Text>
            <Text style={styles.cubicStatusLight} numberOfLines={1}>Today's pay</Text>
          </View>

          {/* Total Earning */}
          <View style={styles.cubicCard}>
            <View style={styles.cubicIconWrapPrimary}>
              <TrendingUp size={18} color={Colors.primary} strokeWidth={2.5} />
            </View>
            <Text style={styles.cubicLabelDark} numberOfLines={1}>Total Earning</Text>
            <Text style={styles.cubicValueDark} numberOfLines={1}>₹{parseFloat(userProfile?.totalEarnings || 0).toFixed(0)}</Text>
            <Text style={styles.cubicStatusDark} numberOfLines={1}>All Time</Text>
          </View>

          {/* To Withdraw */}
          <View style={styles.cubicCard}>
            <View style={styles.cubicIconWrapSecondary}>
              <Wallet size={18} color={Colors.secondary} strokeWidth={2.5} />
            </View>
            <Text style={styles.cubicLabelDark} numberOfLines={1}>To Withdraw</Text>
            <Text style={styles.cubicValueDark} numberOfLines={1}>₹{parseFloat(userProfile?.withdrawableEarnings || 0).toFixed(0)}</Text>
            <Text style={styles.cubicStatusDark} numberOfLines={1}>Available</Text>
          </View>
        </View>

        {/* ── TABS (Synchronized with Customer App Pill Style) ── */}
        <View style={styles.tabSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            <TouchableOpacity
              style={[styles.pillBtn, activeTab === 'pickups' && styles.pillBtnActive]}
              onPress={() => setActiveTab('pickups')}
            >
              <Text style={[styles.pillText, activeTab === 'pickups' && styles.pillTextActive]}>
                Pickups ({filteredPickups.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pillBtn, activeTab === 'deliveries' && styles.pillBtnActive]}
              onPress={() => setActiveTab('deliveries')}
            >
              <Text style={[styles.pillText, activeTab === 'deliveries' && styles.pillTextActive]}>
                Deliveries ({filteredDeliveries.length})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ── TASK LIST ─────────────────────────────────────── */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>
            {activeTab === 'pickups' ? 'Upcoming Pickups' : 'Recent Deliveries'}
          </Text>
          
          {(activeTab === 'pickups' ? filteredPickups : filteredDeliveries).map((item: any) => {
            const shortId = item.id ? item.id.split('-')[0].toUpperCase() : 'N/A';
            const orderTime = item.created_at
              ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'N/A';
            
            const fee = parseFloat(item.delivery_fee) || 0;
            const rainySurge = parseFloat(item.rainy_surge_fee) || 0;
            const lateNight = parseFloat(item.late_night_fee) || 0;
            const tip = parseFloat(item.delivery_tip) || 0;
            const totalEarning = fee + rainySurge + lateNight + tip;

            return (
              <TouchableOpacity 
                key={item.id} 
                style={styles.taskCard}
                activeOpacity={0.9}
                onPress={() => setSelectedOrderForDirections(item)}
              >
                <View style={styles.taskCardHeader}>
                  <View style={styles.idGroup}>
                    <View style={styles.iconCircle}>
                      {activeTab === 'pickups' ? (
                        <Package size={16} color={Colors.primary} />
                      ) : (
                        <Truck size={16} color={Colors.primary} />
                      )}
                    </View>
                    <Text style={styles.idText}>#{shortId}</Text>
                  </View>
                  <View style={styles.timeGroup}>
                    <Clock size={12} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={styles.timeText}>{orderTime}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.taskBody}>
                  <View style={styles.locationInfo}>
                    <Text style={styles.label}>
                      {activeTab === 'pickups' ? 'Pickup Location' : 'Customer Name'}
                    </Text>
                    <Text style={styles.value} numberOfLines={1}>
                      {activeTab === 'pickups' ? (item.store_name || 'FreshRun Store') : (item.user_name || 'Customer')}
                    </Text>
                    <View style={styles.addressRow}>
                      <MapPin size={12} color={Colors.textLight} style={{ marginRight: 4, marginTop: 2 }} />
                      <Text style={styles.addressText} numberOfLines={2}>
                        {activeTab === 'pickups' ? (item.store_address || 'Store Address') : (item.delivery_address?.line1 || 'Customer Address')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.earningContainer}>
                    <Text style={styles.label}>Potential Earning</Text>
                    <View style={styles.earningRow}>
                       <IndianRupee size={16} color={Colors.primary} strokeWidth={3} />
                       <Text style={styles.earningValueText}>{totalEarning.toFixed(0)}</Text>
                    </View>
                    <View style={styles.breakdownList}>
                       <Text style={styles.breakdownItem}>Fee: ₹{fee.toFixed(0)}</Text>
                       {rainySurge > 0 && <Text style={styles.breakdownItem}>Rainy: ₹{rainySurge.toFixed(0)}</Text>}
                       {lateNight > 0 && <Text style={styles.breakdownItem}>Late: ₹{lateNight.toFixed(0)}</Text>}
                       {tip > 0 && <Text style={styles.breakdownItem}>Tip: ₹{tip.toFixed(0)}</Text>}
                    </View>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => setSelectedOrderForDirections(item)}>
                    <Text style={styles.secondaryBtnText}>Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => setSelectedOrderForDirections(item)}>
                    <MapIcon size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.primaryBtnText}>Get Directions</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          {(activeTab === 'pickups' ? filteredPickups : filteredDeliveries).length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No active tasks found in this category.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Header Style from Customer App
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerStatusText: {
    color: Colors.white,
    fontSize: 22,
    fontFamily: Fonts.black,
    lineHeight: 26,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -2,
  },
  headerNameText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: Fonts.bold,
    maxWidth: '85%',
  },
  chevronIcon: {
    marginLeft: 4,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notifCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  notifBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  profileCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: {
    paddingBottom: 40,
  },

  // Search Section
  searchSection: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text,
  },

  // Stats Grid (Cubic Boxes)
  statsGrid: {
    flexDirection: 'row',
    padding: 12,
    justifyContent: 'space-between',
    gap: 8,
  },
  cubicCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    // Customer app shadow style
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cubicIconWrapLight: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  cubicIconWrapPrimary: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  cubicIconWrapSecondary: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  cubicLabelLight: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  cubicLabelDark: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  cubicValueLight: {
    fontSize: 18,
    fontFamily: Fonts.black,
    color: Colors.white,
  },
  cubicValueDark: {
    fontSize: 18,
    fontFamily: Fonts.black,
    color: Colors.text,
  },
  cubicStatusLight: {
    fontSize: 8,
    fontFamily: Fonts.bold,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  cubicStatusDark: {
    fontSize: 8,
    fontFamily: Fonts.bold,
    color: Colors.textLight,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  // Tabs (Pill Style)
  tabSection: {
    marginBottom: 10,
  },
  tabsContainer: {
    paddingHorizontal: 15,
    gap: 8,
  },
  pillBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.white,
  },

  // Task List
  listContainer: {
    paddingHorizontal: 15,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.black,
    color: Colors.text,
    marginBottom: 15,
  },
  taskCard: {
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  idGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  idText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  timeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginBottom: 12,
  },
  taskBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  locationInfo: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: Colors.textLight,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontFamily: Fonts.black,
    color: Colors.text,
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  earningContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 10,
  },
  earningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  earningValueText: {
    fontSize: 22,
    fontFamily: Fonts.black,
    color: Colors.primary,
  },
  breakdownList: {
    alignItems: 'flex-end',
  },
  breakdownItem: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: Colors.textLight,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  primaryBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.textLight,
    textAlign: 'center',
  },
});

export default HomeScreen;
