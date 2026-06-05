import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  Package, 
  MapPin, 
  Calendar, 
  Clock, 
  IndianRupee,
  CheckCircle2,
  XCircle,
  Truck
} from 'lucide-react-native';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';
import { API_BASE_URL } from '../config/api';

interface MyDeliveriesScreenProps {
  userToken: string;
  onBack: () => void;
}

const MyDeliveriesScreen: React.FC<MyDeliveriesScreenProps> = ({ userToken, onBack }) => {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeliveries = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/partner?history=true`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        // Filter for completed or cancelled orders for history, or just show all claimed orders
        setDeliveries(data.orders);
      }
    } catch (error) {
      console.error('Fetch deliveries error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeliveries();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderDeliveryItem = ({ item }: { item: any }) => {
    const fee = parseFloat(item.delivery_fee) || 0;
    const rainySurge = parseFloat(item.rainy_surge_fee) || 0;
    const lateNight = parseFloat(item.late_night_fee) || 0;
    const tip = parseFloat(item.delivery_tip) || 0;
    const earnings = fee + rainySurge + lateNight + tip;
    const isCompleted = item.is_completed;
    const isCancelled = item.status === 'cancelled' || item.status === 'declined';

    return (
      <View style={styles.deliveryCard}>
        <View style={styles.cardHeader}>
          <View style={styles.orderIdGroup}>
            <Package size={16} color={Colors.textLight} />
            <Text style={styles.orderIdText}>Order #{item.id.toString().slice(-6).toUpperCase()}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            isCompleted ? styles.statusCompleted : isCancelled ? styles.statusCancelled : styles.statusActive
          ]}>
            <Text style={[
              styles.statusText,
              isCompleted ? styles.statusTextCompleted : isCancelled ? styles.statusTextCancelled : styles.statusTextActive
            ]}>
              {item.status.toUpperCase().replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Calendar size={14} color={Colors.textLight} />
              <Text style={styles.infoText}>{formatDate(item.created_at)}</Text>
            </View>
            <View style={[styles.infoItem, { marginLeft: 15 }]}>
              <Clock size={14} color={Colors.textLight} />
              <Text style={styles.infoText}>{formatTime(item.created_at)}</Text>
            </View>
          </View>

          <View style={styles.locationContainer}>
            <View style={styles.locationRow}>
              <View style={[styles.dot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.locationText} numberOfLines={1}>{item.store_name}</Text>
            </View>
            <View style={styles.line} />
            <View style={styles.locationRow}>
              <MapPin size={14} color={Colors.error} />
              <Text style={styles.locationText} numberOfLines={1}>
                {item.delivery_address?.line1 || 'Customer Location'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.earningLabelGroup}>
            <IndianRupee size={16} color={Colors.primary} strokeWidth={3} />
            <Text style={styles.earningLabel}>YOUR EARNING</Text>
          </View>
          <Text style={styles.earningValue}>₹{earnings.toFixed(0)}</Text>
        </View>
        
        {earnings > 0 && (
          <View style={styles.earningBreakdown}>
            <Text style={styles.breakdownText}>Fee: ₹{fee.toFixed(0)}</Text>
            {rainySurge > 0 && <Text style={styles.breakdownText}> • Rainy: ₹{rainySurge.toFixed(0)}</Text>}
            {lateNight > 0 && <Text style={styles.breakdownText}> • Late: ₹{lateNight.toFixed(0)}</Text>}
            {tip > 0 && <Text style={styles.breakdownText}> • Tip: ₹{tip.toFixed(0)}</Text>}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ChevronLeft size={24} color="#333" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Deliveries</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : deliveries.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconWrap}>
            <Truck size={48} color="#ccc" />
          </View>
          <Text style={styles.emptyTitle}>No Deliveries Yet</Text>
          <Text style={styles.emptySubtitle}>Completed orders will appear here.</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={deliveries}
          renderItem={renderDeliveryItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#333',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  listContent: {
    padding: 15,
    paddingBottom: 30,
  },
  deliveryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    marginBottom: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  orderIdGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderIdText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: { backgroundColor: '#e8f5e9' },
  statusCancelled: { backgroundColor: '#FFEBEE' },
  statusActive: { backgroundColor: '#E3F2FD' },
  statusText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
  },
  statusTextCompleted: { color: Colors.primaryDark },
  statusTextCancelled: { color: '#C62828' },
  statusTextActive: { color: '#1565C0' },

  cardBody: {
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textLight,
  },
  locationContainer: {
    paddingLeft: 5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  line: {
    width: 1,
    height: 15,
    backgroundColor: '#ddd',
    marginLeft: 3.5,
    marginVertical: 2,
  },
  locationText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#444',
    flex: 1,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f8f9fa',
  },
  earningLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  earningLabel: {
    fontSize: 11,
    fontFamily: Fonts.black,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  earningValue: {
    fontSize: 20,
    fontFamily: Fonts.black,
    color: Colors.primary,
  },
  earningBreakdown: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  breakdownText: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: '#999',
  },

  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#888',
    textAlign: 'center',
    marginBottom: 25,
  },
  refreshBtn: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
});

export default MyDeliveriesScreen;
