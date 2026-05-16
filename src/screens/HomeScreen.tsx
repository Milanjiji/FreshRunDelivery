import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Platform,
  Image,
} from 'react-native';
import { 
  Bell, 
  Search, 
  Package, 
  Truck, 
  ChevronRight, 
  User, 
  MapPin, 
  Clock,
  TrendingUp,
  Map as MapIcon,
  ChevronDown
} from 'lucide-react-native';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';
import ProfileScreen from './ProfileScreen';

// ─── DUMMY DATA ─────────────────────────────────────────────────────────────
const DUMMY_PICKUPS = [
  {
    id: '873264-0001',
    location: 'FreshRun Warehouse (SS4638)',
    address: '14, Industrial Estate, Kozhikode',
    boxes: 38,
    weight: '95kgs',
    time: '10:30 AM',
    status: 'pending',
  },
  {
    id: '873264-0002',
    location: 'Green Farms Hub (MK2201)',
    address: '7, Market Road, Calicut',
    boxes: 12,
    weight: '34kgs',
    time: '11:15 AM',
    status: 'pending',
  },
  {
    id: '873264-0003',
    location: 'Coastal Suppliers (CB9910)',
    address: '23, Beach Road, Beypore',
    boxes: 5,
    weight: '18kgs',
    time: '1:00 PM',
    status: 'pending',
  },
];

const DUMMY_DELIVERIES = [
  {
    id: 'DEL-4421',
    customer: 'Rahul Menon',
    address: '42/B, Mavoor Road, Kozhikode - 673004',
    boxes: 2,
    weight: '6kgs',
    time: '12:00 PM',
    status: 'pending',
  },
  {
    id: 'DEL-4422',
    customer: 'Priya Nair',
    address: '8, Westhill Bypass, Kozhikode - 673005',
    boxes: 1,
    weight: '3kgs',
    time: '2:30 PM',
    status: 'pending',
  },
  {
    id: 'DEL-4423',
    customer: 'Arjun Dev',
    address: '101, Medical College Road, Kozhikode',
    boxes: 4,
    weight: '12kgs',
    time: '4:00 PM',
    status: 'pending',
  },
  {
    id: 'DEL-4424',
    customer: 'Sneha Krishnan',
    address: '55, Palayam, Kozhikode - 673001',
    boxes: 1,
    weight: '2kgs',
    time: '5:15 PM',
    status: 'pending',
  },
  {
    id: 'DEL-4425',
    customer: 'Anil Kumar',
    address: '30, Nadakkavu, Kozhikode',
    boxes: 3,
    weight: '9kgs',
    time: '6:00 PM',
    status: 'pending',
  },
];

interface HomeScreenProps {
  userData: any;
  onLogout: () => void;
}

type TabType = 'pickups' | 'deliveries';

// ─── COMPONENT ──────────────────────────────────────────────────────────────
const HomeScreen: React.FC<HomeScreenProps> = ({ userData, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('pickups');
  const [searchText, setSearchText] = useState('');
  const [showProfile, setShowProfile] = useState(false);

  if (showProfile) {
    return (
      <ProfileScreen
        userData={userData}
        onBack={() => setShowProfile(false)}
        onLogout={onLogout}
      />
    );
  }

  const partnerName = userData?.fullName || userData?.full_name || 'Partner';
  const firstName = partnerName.split(' ')[0];

  const filteredPickups = DUMMY_PICKUPS.filter(
    p =>
      searchText === '' ||
      p.id.toLowerCase().includes(searchText.toLowerCase()) ||
      p.location.toLowerCase().includes(searchText.toLowerCase()),
  );

  const filteredDeliveries = DUMMY_DELIVERIES.filter(
    d =>
      searchText === '' ||
      d.id.toLowerCase().includes(searchText.toLowerCase()) ||
      d.customer.toLowerCase().includes(searchText.toLowerCase()),
  );

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
            <TouchableOpacity style={styles.profileCircle} onPress={() => setShowProfile(true)}>
              <User size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
          <TouchableOpacity
            style={[styles.cubicCard, { backgroundColor: Colors.primary }]}
            activeOpacity={0.8}
            onPress={() => setActiveTab('deliveries')}
          >
            <View style={styles.cubicIconWrapLight}>
              <Truck size={22} color="#fff" strokeWidth={2.5} />
            </View>
            <Text style={styles.cubicLabelLight}>Today</Text>
            <Text style={styles.cubicValueLight}>{DUMMY_DELIVERIES.length}</Text>
            <Text style={styles.cubicStatusLight}>Orders Active</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cubicCard}
            activeOpacity={0.8}
          >
            <View style={styles.cubicIconWrapPrimary}>
              <TrendingUp size={22} color={Colors.primary} strokeWidth={2.5} />
            </View>
            <Text style={styles.cubicLabelDark}>Total</Text>
            <Text style={styles.cubicValueDark}>1,248</Text>
            <Text style={styles.cubicStatusDark}>All Time</Text>
          </TouchableOpacity>
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
          
          {(activeTab === 'pickups' ? filteredPickups : filteredDeliveries).map((item: any) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.taskCard}
              activeOpacity={0.9}
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
                  <Text style={styles.idText}>{item.id}</Text>
                </View>
                <View style={styles.timeGroup}>
                  <Clock size={12} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={styles.timeText}>{item.time}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.taskBody}>
                <View style={styles.locationInfo}>
                  <Text style={styles.label}>
                    {activeTab === 'pickups' ? 'Pickup Location' : 'Customer Name'}
                  </Text>
                  <Text style={styles.value} numberOfLines={1}>
                    {activeTab === 'pickups' ? item.location : item.customer}
                  </Text>
                  <View style={styles.addressRow}>
                    <MapPin size={12} color={Colors.textLight} style={{ marginRight: 4, marginTop: 2 }} />
                    <Text style={styles.addressText} numberOfLines={2}>{item.address}</Text>
                  </View>
                </View>

                <View style={styles.metaInfo}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Boxes</Text>
                    <Text style={styles.metaValue}>{item.boxes}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Wt</Text>
                    <Text style={styles.metaValue}>{item.weight}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Details</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn}>
                  <MapIcon size={16} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryBtnText}>Get Directions</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}

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
    padding: 15,
    justifyContent: 'space-between',
    gap: 12,
  },
  cubicCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 15,
    padding: 16,
    aspectRatio: 1.1,
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cubicIconWrapPrimary: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cubicLabelLight: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  cubicLabelDark: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  cubicValueLight: {
    fontSize: 22,
    fontFamily: Fonts.black,
    color: Colors.white,
  },
  cubicValueDark: {
    fontSize: 22,
    fontFamily: Fonts.black,
    color: Colors.text,
  },
  cubicStatusLight: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  cubicStatusDark: {
    fontSize: 9,
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
  metaInfo: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 10,
  },
  metaItem: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: Colors.textLight,
  },
  metaValue: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.text,
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
