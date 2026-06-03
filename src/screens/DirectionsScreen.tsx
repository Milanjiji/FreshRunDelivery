import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  PermissionsAndroid,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import io from 'socket.io-client';
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

import { API_BASE_URL } from '../config/api';

const BACKEND_URL = API_BASE_URL;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const GOOGLE_MAPS_APIKEY = 'AIzaSyC1s78p6_QNfF7eoMbKnMcu5wLqOdLyN9g';

const parseCoordinate = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsedValue = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

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
  const mapRef = useRef<MapView>(null);
  const socketRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [resolvedOrder, setResolvedOrder] = useState<any>(order);

  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [directionsOrigin, setDirectionsOrigin] = useState<{ latitude: number; longitude: number } | null>(null);
  const lastDirectionsUpdate = useRef<number>(0);

  // DRAGGABLE BOTTOM SHEET LOGIC
  // Initially map is 70% (30% for sheet). We use a fixed height for the sheet.
  const INITIAL_SHEET_HEIGHT = SCREEN_HEIGHT * 0.3;
  const sheetHeight = useRef(new Animated.Value(INITIAL_SHEET_HEIGHT)).current;
  const lastSheetHeight = useRef(INITIAL_SHEET_HEIGHT);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const newHeight = lastSheetHeight.current - gestureState.dy;
        // Limit height between 20% and 85% of screen
        if (newHeight > SCREEN_HEIGHT * 0.2 && newHeight < SCREEN_HEIGHT * 0.85) {
          sheetHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Sync raw value for next interaction
        lastSheetHeight.current = (sheetHeight as any)._value;
      },
    })
  ).current;

  // Maintain local states to update UI dynamically without closing the screen
  const [localStatus, setLocalStatus] = useState<string>(order?.status || 'pending');
  const [localOpted, setLocalOpted] = useState<boolean>(order?.delivery_boy_opted || false);
  const [localGivenToDelivery, setLocalGivenToDelivery] = useState<boolean>(
    order?.is_given_to_delivery_boy || false
  );
  const [localCompleted, setLocalCompleted] = useState<boolean>(order?.is_completed || false);
  const orderData = resolvedOrder || order;

  // Socket Connection for real-time location sharing
  useEffect(() => {
    socketRef.current = io(BACKEND_URL);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const alreadyGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    if (alreadyGranted) {
      return true;
    }

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Delivery Location Permission',
        message: 'FreshRun needs your location while this screen is open to update the customer during delivery.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  // Track and emit location while the active delivery screen remains open.
  useEffect(() => {
    let watchId: number | null = null;
    let cancelled = false;

    const startTracking = async () => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setTrackingError('Location permission is required for navigation and sharing live updates.');
        return;
      }

      setTrackingError(null);
      
      Geolocation.getCurrentPosition(
        (position) => {
          if (!cancelled) {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setCurrentLocation(coords);
            setDirectionsOrigin(coords); 
            lastDirectionsUpdate.current = Date.now();
          }
        },
        (error) => console.warn('Initial location error:', error),
        { enableHighAccuracy: true }
      );

      const emitLocation = (position: any) => {
        if (cancelled) return;

        const newCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setCurrentLocation(newCoords);

        const now = Date.now();
        const timePassed = now - lastDirectionsUpdate.current;
        
        if (!directionsOrigin || timePassed > 120000) { 
           setDirectionsOrigin(newCoords);
           lastDirectionsUpdate.current = now;
        }

        if (socketRef.current && order.id && localStatus === 'out_for_delivery' && !localCompleted) {
          socketRef.current.emit('update_delivery_location', {
            orderId: order.id,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      };

      watchId = Geolocation.watchPosition(
        emitLocation,
        (error) => {
          console.warn('Location tracking error:', error);
          setTrackingError(error.message || 'Unable to share live delivery location.');
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 10000,
          fastestInterval: 5000,
        }
      );
    };

    startTracking();

    return () => {
      cancelled = true;
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, [localCompleted, localStatus, order.id, requestLocationPermission]);

  const fetchOrderDetails = useCallback(async () => {
    if (!order?.id || !userToken) return;

    try {
      const response = await fetch(`${BACKEND_URL}/orders/${order.id}`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      const result = await response.json();
      if (response.ok && result.success && result.order) {
        setResolvedOrder(result.order);
        // Sync local states with server truth if needed
        if (result.order.status) setLocalStatus(result.order.status);
        if (result.order.is_given_to_delivery_boy !== undefined) 
          setLocalGivenToDelivery(result.order.is_given_to_delivery_boy);
        if (result.order.is_completed !== undefined)
          setLocalCompleted(result.order.is_completed);
      }
    } catch (error) {
      console.warn('[DirectionsScreen] Failed to refresh order details:', error);
    }
  }, [order?.id, userToken]);

  useEffect(() => {
    fetchOrderDetails();
    
    // Periodically refresh order details while on this screen
    const interval = setInterval(fetchOrderDetails, 10000);
    return () => clearInterval(interval);
  }, [fetchOrderDetails]);

  // Parse Coordinates
  const storeLat = parseCoordinate(orderData?.store_lat);
  const storeLng = parseCoordinate(orderData?.store_lng);
  const userLat = parseCoordinate(
    orderData?.delivery_address?.latitude ??
    orderData?.delivery_address?.lat ??
    orderData?.user_lat
  );
  const userLng = parseCoordinate(
    orderData?.delivery_address?.longitude ??
    orderData?.delivery_address?.lng ??
    orderData?.user_lng
  );

  const fitMapToMarkers = useCallback(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    const coords = [];
    if (currentLocation) {
       coords.push(currentLocation);
    }
    
    // Always fit the Store and Customer in the view so the whole path is visible
    if (storeLat !== null && storeLng !== null) {
        coords.push({ latitude: storeLat, longitude: storeLng });
    }
    if (userLat !== null && userLng !== null) {
        coords.push({ latitude: userLat, longitude: userLng });
    }

    if (coords.length >= 2) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 60, bottom: 100, left: 60 },
        animated: true,
      });
    }
  }, [currentLocation, mapReady, storeLat, storeLng, userLat, userLng]);

  useEffect(() => {
    fitMapToMarkers();
  }, [fitMapToMarkers]);

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
              setDirectionsOrigin(currentLocation);
              lastDirectionsUpdate.current = Date.now();
              fetchOrderDetails();
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
              if (currentLocation) {
                setDirectionsOrigin(currentLocation);
              }
              lastDirectionsUpdate.current = Date.now();
              fetchOrderDetails();
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
              fetchOrderDetails();
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
    const phone = orderData?.user_phone;
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
    if (orderData?.is_packed || localStatus === 'packed') return 'Order Packed';
    return 'Order Confirmed';
  };

  // Sub-description beneath the title
  const getStatusDescription = () => {
    if (localCompleted || localStatus === 'delivered') return 'The order has been successfully delivered to the customer.';
    if (localStatus === 'out_for_delivery') return 'Order is out for delivery. Head to the customer address.';
    if (orderData?.is_packed || localStatus === 'packed') return 'Order is packed and ready. Proceed to the store for pickup.';
    return 'Order confirmed by store and is currently being processed.';
  };

  const boxesCount =
    orderData?.items?.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0) || 1;
  const weightVal = (boxesCount * 0.8).toFixed(1) + 'kgs';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      {/* ── MAP VIEW (Dynamic height) ── */}
      <Animated.View style={[styles.mapContainer, { height: Animated.subtract(SCREEN_HEIGHT, sheetHeight) }]}>
        {storeLat !== null && storeLng !== null ? (
          <MapView
            ref={mapRef}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            style={styles.map}
            onMapReady={() => setMapReady(true)}
            initialRegion={{
              latitude: storeLat || 0,
              longitude: storeLng || 0,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {currentLocation && (
              <Marker
                coordinate={currentLocation}
                title="Your Location"
              >
                 <View style={styles.driverMarker}>
                    <Truck size={18} color="#fff" />
                 </View>
              </Marker>
            )}

            <Marker
              coordinate={{ latitude: storeLat, longitude: storeLng }}
              title="Pickup Store"
              description={orderData?.store_name}
              pinColor={Colors.secondary}
            />

            {userLat !== null && userLng !== null && (
              <Marker
                coordinate={{ latitude: userLat, longitude: userLng }}
                title="Delivery Point"
                description={orderData?.user_name}
                pinColor={Colors.primary}
              />
            )}

            {directionsOrigin && userLat !== null && userLng !== null && (
              <MapViewDirections
                key={`${localStatus}-${localGivenToDelivery}`}
                origin={directionsOrigin}
                destination={{ latitude: userLat, longitude: userLng }}
                waypoints={
                   (!localGivenToDelivery && storeLat !== null && storeLng !== null) 
                    ? [{ latitude: storeLat, longitude: storeLng }] 
                    : []
                }
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={4}
                strokeColor={Colors.primary}
                optimizeWaypoints={!localGivenToDelivery}
                onReady={result => {
                  console.log(`[Directions] Dist: ${result.distance}km, Dur: ${result.duration}min`);
                }}
                onError={(errorMessage) => {
                  console.log('MapViewDirections Error:', errorMessage);
                }}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.mapErrorContainer}>
            <MapPin size={28} color={Colors.textSecondary} />
            <Text style={styles.mapErrorText}>Pickup coordinates are missing for this order.</Text>
          </View>
        )}

        {trackingError && (
          <View style={styles.trackingErrorBanner}>
            <Text style={styles.trackingErrorText}>{trackingError}</Text>
          </View>
        )}
        
        <SafeAreaView style={styles.headerOverlay} pointerEvents="box-none">
          <TouchableOpacity style={styles.backBtnCircle} onPress={onBack}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>

      {/* ── DRAGGABLE DETAILS PANEL ── */}
      <Animated.View style={[styles.detailsContainer, { height: sheetHeight }]}>
        <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
           <View style={styles.dragHandle} />
        </View>

        <ScrollView
          style={styles.detailsScroll}
          contentContainerStyle={styles.detailsContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.statusTitle}>{getStatusDisplay()}</Text>
          <Text style={styles.statusDesc}>{getStatusDescription()}</Text>

          <View style={styles.stagesRow}>
            <View style={styles.stageItem}>
              <View style={[styles.stageDot, styles.stageDotActive]} />
              <Text style={styles.stageTextActive}>Confirmed</Text>
            </View>
            <View style={[styles.stageLine, (orderData?.is_packed || localStatus === 'packed' || localStatus === 'out_for_delivery' || localCompleted) && styles.stageDotActive]} />

            <View style={styles.stageItem}>
              <View
                style={[
                  styles.stageDot,
                  (orderData?.is_packed || localStatus === 'packed' || localStatus === 'out_for_delivery' || localCompleted) &&
                    styles.stageDotActive,
                ]}
              />
              <Text
                style={
                  orderData?.is_packed || localStatus === 'packed' || localStatus === 'out_for_delivery' || localCompleted
                    ? styles.stageTextActive
                    : styles.stageText
                }
              >
                Packed
              </Text>
            </View>
            <View style={[styles.stageLine, (localStatus === 'out_for_delivery' || localCompleted) && styles.stageDotActive]} />

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

            <View style={styles.stageItem}>
              <View style={[styles.stageDot, localCompleted && styles.stageDotActive]} />
              <Text style={localCompleted ? styles.stageTextActive : styles.stageText}>Delivered</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pickup Point</Text>
            <View style={styles.card}>
              <View style={styles.cardIconCircle}>
                <ShoppingBag size={20} color={Colors.primary} />
              </View>
              <View style={styles.cardDetails}>
                <Text style={styles.cardMainText}>{orderData.store_name || 'FreshRun Partner Store'}</Text>
                <View style={styles.addressRow}>
                  <MapPin size={12} color={Colors.textSecondary} style={{ marginRight: 4, marginTop: 2 }} />
                  <Text style={styles.cardSubText}>{orderData.store_address || 'Store location address line'}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Destination</Text>
            <View style={styles.card}>
              <View style={[styles.cardIconCircle, { backgroundColor: Colors.secondaryLight }]}>
                <MapPin size={20} color={Colors.secondary} />
              </View>
              <View style={styles.cardDetails}>
                <Text style={styles.cardMainText}>{orderData.user_name || 'Guest Customer'}</Text>
                <View style={styles.addressRow}>
                  <MapPin size={12} color={Colors.textSecondary} style={{ marginRight: 4, marginTop: 2 }} />
                  <Text style={styles.cardSubText}>
                    {orderData.delivery_address?.line1 || 'Address details not fully defined'}
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
              <Text style={styles.metaValue}>{orderData.items?.length || 0} unique</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items Checklist</Text>
            <View style={styles.itemsCard}>
              {orderData.items?.map((item: any, idx: number) => (
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
                <Text style={styles.totalValueText}>₹{parseFloat(orderData.total_amount || 0).toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </ScrollView>

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
      </Animated.View>
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
    top: 30, 
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
    flex: 1,
    backgroundColor: '#e5e5e5',
    position: 'relative',
    width: '100%',
  },
  map: {
    flex: 1,
  },
  driverMarker: {
    backgroundColor: Colors.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 5,
  },
  mapErrorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef1f4',
    paddingHorizontal: 30,
  },
  mapErrorText: {
    color: Colors.textSecondary,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  trackingErrorBanner: {
    position: 'absolute',
    bottom: 12,
    left: 15,
    right: 15,
    backgroundColor: '#FFF1F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trackingErrorText: {
    color: '#B42318',
    fontFamily: Fonts.medium,
    fontSize: 12,
    textAlign: 'center',
  },
  detailsContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  dragHandleContainer: {
    width: '100%',
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
  },
  detailsScroll: {
    flex: 1,
  },
  detailsContent: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 30,
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
    paddingBottom: 20,
    backgroundColor: '#ffffff',
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
