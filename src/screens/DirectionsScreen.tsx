import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  ChevronLeft,
  MapPin,
  Phone,
  ShoppingBag,
  Truck,
  CheckCircle,
} from 'lucide-react-native';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';

const BACKEND_URL = 'https://freshrun-backend.onrender.com';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DirectionsScreenProps {
  order: any;
  userToken: string | null;
  onBack: () => void;
  onRefresh: () => void;
}

const DirectionsScreen: React.FC<DirectionsScreenProps> = ({
  order,
  userToken,
  onBack,
  onRefresh,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Maintain local states to update UI dynamically without closing the screen
  const [localStatus, setLocalStatus] = useState<string>(order?.status || 'pending');
  const [localOpted, setLocalOpted] = useState<boolean>(order?.delivery_boy_opted || false);
  const [localGivenToDelivery, setLocalGivenToDelivery] = useState<boolean>(
    order?.is_given_to_delivery_boy || false
  );
  const [localCompleted, setLocalCompleted] = useState<boolean>(order?.is_completed || false);

  // Parse Coordinates
  const storeLat = parseFloat(order?.store_lat) || 11.2588;
  const storeLng = parseFloat(order?.store_lng) || 75.7804;

  // Try every possible field name the backend might return for customer coords
  const rawUserLat =
    order?.delivery_address?.latitude ||
    order?.delivery_address?.lat ||
    order?.user_lat ||
    order?.latitude ||
    null;
  const rawUserLng =
    order?.delivery_address?.longitude ||
    order?.delivery_address?.lng ||
    order?.user_lng ||
    order?.longitude ||
    null;

  const userLat = rawUserLat ? parseFloat(rawUserLat) : null;
  const userLng = rawUserLng ? parseFloat(rawUserLng) : null;

  useEffect(() => {
    console.log('\n📍 [DELIVERY APP MAP COORDINATES DEBUG] ──────────────────');
    console.log(`   START (Store):    ${storeLat}, ${storeLng}`);
    console.log(`   END (Customer):   ${userLat}, ${userLng}`);
    console.log('   Raw order fields:');
    console.log(`     order.user_lat         = ${order?.user_lat}`);
    console.log(`     order.user_lng         = ${order?.user_lng}`);
    console.log(`     order.latitude         = ${order?.latitude}`);
    console.log(`     order.longitude        = ${order?.longitude}`);
    console.log(`     delivery_address.latitude  = ${order?.delivery_address?.latitude}`);
    console.log(`     delivery_address.longitude = ${order?.delivery_address?.longitude}`);
    console.log(`     address_id             = ${order?.address_id}`);
    console.log('─────────────────────────────────────────────────────────────\n');
  }, [storeLat, storeLng, userLat, userLng]);

  // Leaflet HTML Content
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; }
        html, body, #map { height: 100%; width: 100%; }
        .store-icon {
          background-color: #0066FF;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          display: flex;
          justify-content: center;
          align-items: center;
          color: white;
          font-weight: bold;
          font-family: sans-serif;
        }
        .home-icon {
          background-color: #60c547;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          display: flex;
          justify-content: center;
          align-items: center;
          color: white;
          font-weight: bold;
          font-family: sans-serif;
        }
        .zoom-capsule {
          position: absolute;
          bottom: 45px;
          right: 15px;
          z-index: 1000;
          background-color: white;
          border-radius: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow: hidden;
          border: 1px solid #eef0f2;
        }
        .zoom-btn {
          width: 38px;
          height: 38px;
          background-color: white;
          border: none;
          color: #333;
          font-size: 20px;
          font-weight: bold;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          outline: none;
          -webkit-tap-highlight-color: transparent;
        }
        .zoom-btn:active {
          background-color: #f0f0f0;
        }
        .zoom-divider {
          width: 22px;
          height: 1px;
          background-color: #e2e8f0;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      
      <div class="zoom-capsule">
        <button class="zoom-btn" onclick="zoomIn()">+</button>
        <div class="zoom-divider"></div>
        <button class="zoom-btn" onclick="zoomOut()">-</button>
      </div>

      <script>
        var map;
        function zoomIn() {
          if (map) map.zoomIn();
        }
        function zoomOut() {
          if (map) map.zoomOut();
        }

        document.addEventListener('DOMContentLoaded', () => {
          const storeLoc = [${storeLat}, ${storeLng}];
          ${userLat !== null && userLng !== null
            ? `const userLoc = [${userLat}, ${userLng}];`
            : `const userLoc = null;`
          }
          
          console.log("Leaflet Webview Console - Store Location:", storeLoc);
          console.log("Leaflet Webview Console - Customer Location:", userLoc);

          // Centre the map between the two points initially
          const midLat = userLoc ? (storeLoc[0] + userLoc[0]) / 2 : storeLoc[0];
          const midLng = userLoc ? (storeLoc[1] + userLoc[1]) / 2 : storeLoc[1];
          map = L.map('map', { zoomControl: false }).setView([midLat, midLng], 13);

          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
          }).addTo(map);

          const storeHtml = '<div style="width: 100%; height: 100%;" class="store-icon">S</div>';
          const homeHtml = '<div style="width: 100%; height: 100%;" class="home-icon">H</div>';

          const storeIcon = L.divIcon({ html: storeHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 16] });
          const homeIcon = L.divIcon({ html: homeHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 16] });

          L.marker(storeLoc, { icon: storeIcon }).addTo(map).bindPopup('<b>Store: ${order?.store_name || 'Pickup Store'}</b>');

          if (userLoc) {
            L.marker(userLoc, { icon: homeIcon }).addTo(map).bindPopup('<b>Customer: ${order?.user_name || 'Delivery address'}</b>');

            L.polyline([storeLoc, userLoc], {
              color: '#60c547',
              weight: 4,
              dashArray: '8, 8'
            }).addTo(map);

            // Fit both markers into view with generous padding
            const bounds = L.latLngBounds([storeLoc, userLoc]);
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
          } else {
            // No customer coordinates - just show the store
            map.setView(storeLoc, 14);
          }
        });
      </script>
    </body>
    </html>
  `;

  // ── ACTION HANDLERS ────────────────────────────────────────────────────────

  // 1. Claim Order (Opt in)
  const handleOptIn = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/orders/${order.id}/opt-in`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      const result = await response.json();
      if (response.ok && result.success) {
        Alert.alert('✅ Success', 'You have claimed this delivery pickup!', [
          {
            text: 'OK',
            onPress: () => {
              setLocalOpted(true);
              setLocalStatus('assigned');
              onRefresh();
              onBack();
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to claim the order.');
      }
    } catch (error) {
      console.error('[DirectionsScreen] Opt-in error:', error);
      Alert.alert('Error', 'Unable to reach server. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Mark as Picked Up
  const handleMarkPickedUp = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          status: 'out_for_delivery',
          is_given_to_delivery_boy: true,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        Alert.alert('🚚 Dispatched', 'Order marked as picked up. Drive safely!', [
          {
            text: 'OK',
            onPress: () => {
              setLocalStatus('out_for_delivery');
              setLocalGivenToDelivery(true);
              onRefresh();
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to update order.');
      }
    } catch (error) {
      console.error('[DirectionsScreen] Pick-up error:', error);
      Alert.alert('Error', 'Unable to reach server. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Mark as Delivered
  const handleMarkDelivered = async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          status: 'delivered',
          is_completed: true,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        Alert.alert('🎉 Delivered', 'Great job! Order completed successfully.', [
          {
            text: 'OK',
            onPress: () => {
              setLocalStatus('delivered');
              setLocalCompleted(true);
              onRefresh();
              onBack();
            },
          },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to complete order.');
      }
    } catch (error) {
      console.error('[DirectionsScreen] Delivery error:', error);
      Alert.alert('Error', 'Unable to reach server. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Phone Call helper
  const handleCall = () => {
    const phone = order?.user_phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('Unavailable', 'Customer phone number is not available.');
    }
  };

  // Status mapping display (title shown in bottom panel)
  const getStatusDisplay = () => {
    if (localCompleted || localStatus === 'delivered') return 'Order Delivered';
    if (localStatus === 'out_for_delivery') return 'Out for Delivery';
    if (order?.is_packed || localStatus === 'packed') return 'Order Packed';
    return 'Order Confirmed';
  };

  // Sub-description beneath the title
  const getStatusDescription = () => {
    if (localCompleted || localStatus === 'delivered') return 'The order has been successfully delivered to the customer.';
    if (localStatus === 'out_for_delivery') return 'Order is out for delivery. Head to the customer address.';
    if (order?.is_packed || localStatus === 'packed') return 'Order is packed and ready. Proceed to the store for pickup.';
    return 'Order confirmed by store and is currently being processed.';
  };

  // Dynamic box counting
  const boxesCount =
    order?.items?.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0) || 1;
  const weightVal = (boxesCount * 0.8).toFixed(1) + 'kgs';

  const getFloatingStatusDisplay = () => {
    if (localCompleted || localStatus === 'delivered') return 'Delivered';
    if (localStatus === 'out_for_delivery') return 'Dispatched';
    if (order?.is_packed || localStatus === 'packed') return 'Packed';
    return 'Confirmed';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      {/* ── MAP VIEW (No top header bar, extends under status bar) ────────────────── */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={styles.webview}
          scrollEnabled={true}
          bounces={false}
        />
        
        {/* Header Overlay (Close/Back button) */}
        <SafeAreaView style={styles.headerOverlay} pointerEvents="box-none">
          <TouchableOpacity style={styles.backBtnCircle} onPress={onBack}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* ── DETAILS PANEL (Scrollable Bottom Half) ──────────────────────── */}
      <ScrollView
        style={styles.detailsScroll}
        contentContainerStyle={styles.detailsContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dragHandle} />

        {/* Status Title (matches customer app style) */}
        <Text style={styles.statusTitle}>{getStatusDisplay()}</Text>
        <Text style={styles.statusDesc}>{getStatusDescription()}</Text>

        {/* Tracking Flow Stages */}
        <View style={styles.stagesRow}>
          {/* Stage 1: Confirmed */}
          <View style={styles.stageItem}>
            <View style={[styles.stageDot, styles.stageDotActive]} />
            <Text style={styles.stageTextActive}>Confirmed</Text>
          </View>
          <View style={[styles.stageLine, (order?.is_packed || localStatus === 'packed' || localStatus === 'out_for_delivery' || localCompleted) && styles.stageDotActive]} />

          {/* Stage 2: Packed */}
          <View style={styles.stageItem}>
            <View
              style={[
                styles.stageDot,
                (order?.is_packed || localStatus === 'packed' || localStatus === 'out_for_delivery' || localCompleted) &&
                  styles.stageDotActive,
              ]}
            />
            <Text
              style={
                order?.is_packed || localStatus === 'packed' || localStatus === 'out_for_delivery' || localCompleted
                  ? styles.stageTextActive
                  : styles.stageText
              }
            >
              Packed
            </Text>
          </View>
          <View style={[styles.stageLine, (localStatus === 'out_for_delivery' || localCompleted) && styles.stageDotActive]} />

          {/* Stage 3: Dispatched */}
          <View style={styles.stageItem}>
            <View
              style={[
                styles.stageDot,
                (localStatus === 'out_for_delivery' || localCompleted) && styles.stageDotActive,
              ]}
            />
            <Text
              style={
                localStatus === 'out_for_delivery' || localCompleted
                  ? styles.stageTextActive
                  : styles.stageText
              }
            >
              Dispatched
            </Text>
          </View>
          <View style={[styles.stageLine, localCompleted && styles.stageDotActive]} />

          {/* Stage 4: Delivered */}
          <View style={styles.stageItem}>
            <View style={[styles.stageDot, localCompleted && styles.stageDotActive]} />
            <Text style={localCompleted ? styles.stageTextActive : styles.stageText}>Delivered</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Store Info (Pickup Point) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup Point</Text>
          <View style={styles.card}>
            <View style={styles.cardIconCircle}>
              <ShoppingBag size={20} color={Colors.primary} />
            </View>
            <View style={styles.cardDetails}>
              <Text style={styles.cardMainText}>{order.store_name || 'FreshRun Partner Store'}</Text>
              <View style={styles.addressRow}>
                <MapPin size={12} color={Colors.textSecondary} style={{ marginRight: 4, marginTop: 2 }} />
                <Text style={styles.cardSubText}>{order.store_address || 'Store location address line'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Customer & Delivery Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Destination</Text>
          <View style={styles.card}>
            <View style={[styles.cardIconCircle, { backgroundColor: Colors.secondaryLight }]}>
              <MapPin size={20} color={Colors.secondary} />
            </View>
            <View style={styles.cardDetails}>
              <Text style={styles.cardMainText}>{order.user_name || 'Guest Customer'}</Text>
              <View style={styles.addressRow}>
                <MapPin size={12} color={Colors.textSecondary} style={{ marginRight: 4, marginTop: 2 }} />
                <Text style={styles.cardSubText}>
                  {order.delivery_address?.line1 || 'Address details not fully defined'}
                </Text>
              </View>
            </View>
            {localOpted && (
              <TouchableOpacity style={styles.phoneBtn} onPress={handleCall}>
                <Phone size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Package & Weight info */}
        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Boxes</Text>
            <Text style={styles.metaValue}>{boxesCount}</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Approx Wt</Text>
            <Text style={styles.metaValue}>{weightVal}</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Items Type</Text>
            <Text style={styles.metaValue}>{order.items?.length || 0} unique</Text>
          </View>
        </View>

        {/* Items List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items Checklist</Text>
          <View style={styles.itemsCard}>
            {order.items?.map((item: any, idx: number) => (
              <View key={idx} style={styles.itemRow}>
                <View style={styles.itemQtyWrap}>
                  <Text style={styles.itemQtyText}>{item.quantity || 1}x</Text>
                </View>
                <Text style={styles.itemNameText} numberOfLines={1}>
                  {item.name || 'Product Item'}
                </Text>
                <Text style={styles.itemPriceText}>₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.itemDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabelText}>Bill Total</Text>
              <Text style={styles.totalValueText}>₹{parseFloat(order.total_amount || 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── ACTION FOOTER BUTTON ────────────────────────────────────────── */}
      <View style={styles.footer}>
        {actionLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 10 }} />
        ) : !localOpted ? (
          <TouchableOpacity style={styles.mainActionBtn} onPress={handleOptIn}>
            <Text style={styles.mainActionBtnText}>Accept Pickup</Text>
          </TouchableOpacity>
        ) : !localGivenToDelivery ? (
          <TouchableOpacity style={[styles.mainActionBtn, { backgroundColor: Colors.secondary }]} onPress={handleMarkPickedUp}>
            <Truck size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.mainActionBtnText}>Mark as Picked Up</Text>
          </TouchableOpacity>
        ) : !localCompleted ? (
          <TouchableOpacity style={[styles.mainActionBtn, { backgroundColor: Colors.success }]} onPress={handleMarkDelivered}>
            <CheckCircle size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.mainActionBtnText}>Mark as Delivered</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>Completed</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerOverlay: {
    position: 'absolute',
    top: 30, // Account for translucent status bar
    left: 0,
    right: 0,
    paddingHorizontal: 15,
    paddingTop: 10,
    zIndex: 10,
  },
  backBtnCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  mapContainer: {
    height: SCREEN_HEIGHT * 0.52,
    backgroundColor: '#e5e5e5',
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  detailsScroll: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  detailsContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 15,
  },
  statusTitle: {
    fontSize: 20,
    fontFamily: Fonts.black,
    color: '#333',
    marginBottom: 4,
  },
  statusDesc: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#888',
    lineHeight: 18,
    marginBottom: 16,
  },
  stagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stageItem: {
    alignItems: 'center',
  },
  stageDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    marginBottom: 5,
  },
  stageDotActive: {
    backgroundColor: Colors.primary,
  },
  stageText: {
    fontSize: 9,
    fontFamily: Fonts.medium,
    color: Colors.textLight,
  },
  stageTextActive: {
    fontSize: 9,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  stageLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 4,
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 10,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.secondaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardDetails: {
    flex: 1,
  },
  cardMainText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardSubText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 16,
    flex: 1,
  },
  phoneBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  metaBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metaLabel: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: Colors.textLight,
  },
  metaValue: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginTop: 2,
  },
  itemsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemQtyWrap: {
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 10,
  },
  itemQtyText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },
  itemNameText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  itemPriceText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  itemDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabelText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  totalValueText: {
    fontSize: 17,
    fontFamily: Fonts.black,
    color: Colors.primary,
  },
  footer: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  mainActionBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  mainActionBtnText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  completedBadge: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedBadgeText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textLight,
  },
});

export default DirectionsScreen;
