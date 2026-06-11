import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Linking,
  Dimensions,
  PermissionsAndroid,
  Platform,
  Animated,
  PanResponder,
  Modal,
  TextInput,
} from 'react-native';
import { Alertt } from '../components/Alertt';
import { SafeAreaView } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import io from 'socket.io-client';
import {
  ChevronLeft,
  MapPin,
  Phone,
  ShoppingBag,
  Truck,
  CheckCircle,
  IndianRupee
} from 'lucide-react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';

import { API_BASE_URL } from '../config/api';
import LocationDisclosureModal from '../components/LocationDisclosureModal';

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
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [issueModalVisible, setIssueModalVisible] = useState(false);
  const [selectedIssueType, setSelectedIssueType] = useState<'damaged_item' | 'customer_rejected' | 'customer_refused_other'>('customer_rejected');
  const [issueComment, setIssueComment] = useState('');

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
      onPanResponderMove: (_evt, gestureState) => {
        const newHeight = lastSheetHeight.current - gestureState.dy;
        // Limit height between 20% and 85% of screen
        if (newHeight > SCREEN_HEIGHT * 0.2 && newHeight < SCREEN_HEIGHT * 0.85) {
          sheetHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_evt, _gestureState) => {
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

  const [showDisclosure, setShowDisclosure] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

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
        message: 'FreshRush needs your location while this screen is open to update the customer during delivery.',
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
      // 1. Check if we already have permission
      let hasPermission = false;
      if (Platform.OS === 'android') {
        hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
      } else {
        hasPermission = true;
      }

      if (!hasPermission && !permissionGranted) {
        setShowDisclosure(true);
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
          distanceFilter: 20,
          interval: 15000,
          fastestInterval: 10000,
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
  }, [directionsOrigin, localCompleted, localStatus, order.id, permissionGranted]);

  const handleDisclosureAccept = async () => {
    setShowDisclosure(false);
    const granted = await requestLocationPermission();
    if (granted) {
      setPermissionGranted(true);
    } else {
      setTrackingError('Location permission is required for navigation and sharing live updates.');
    }
  };

  const handleDisclosureDecline = () => {
    setShowDisclosure(false);
    setTrackingError('Location permission is required for navigation and sharing live updates.');
  };

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
    if (orderData?.stores && orderData.stores.length > 0) {
      orderData.stores.forEach((s: any) => {
        const sLat = parseCoordinate(s.latitude);
        const sLng = parseCoordinate(s.longitude);
        if (sLat !== null && sLng !== null) {
          coords.push({ latitude: sLat, longitude: sLng });
        }
      });
    } else if (storeLat !== null && storeLng !== null) {
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
  }, [currentLocation, mapReady, storeLat, storeLng, userLat, userLng, orderData?.stores]);

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
        Alertt.alert('✅ Success', 'You have claimed this delivery pickup!', [
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
        Alertt.alert('Error', result.error || 'Failed to claim the order.');
      }
    } catch (error) {
      console.error('[DirectionsScreen] Opt-in error:', error);
      Alertt.alert('Error', 'Unable to reach server. Please try again.');
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
        Alertt.alert('🚚 Dispatched', 'Order marked as picked up. Drive safely!', [
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
        Alertt.alert('Error', result.error || 'Failed to update order.');
      }
    } catch (error) {
      console.error('[DirectionsScreen] Pick-up error:', error);
      Alertt.alert('Error', 'Unable to reach server. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // 2b. Mark specific store as Picked Up
  const handlePickUpStore = async (storeId: string, storeName: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/orders/${order.id}/pickup-store`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ store_id: storeId }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        Alertt.alert('Store Picked Up', `Items from "${storeName}" marked as picked up.`, [
          {
            text: 'OK',
            onPress: () => {
              fetchOrderDetails();
              onRefresh();
            }
          }
        ]);
      } else {
        Alertt.alert('Error', result.error || 'Failed to update store pickup.');
      }
    } catch (error) {
      console.error('[DirectionsScreen] Store pick-up error:', error);
      Alertt.alert('Error', 'Unable to reach server. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Mark as Delivered (Opens PIN input modal)
  const handleMarkDelivered = () => {
    setPinModalVisible(true);
  };

  // 3b. Verify PIN and complete delivery
  const submitDeliveryPin = async () => {
    if (!enteredPin || enteredPin.length !== 6) {
      Alertt.alert('Error', 'Please enter a valid 6-digit PIN.');
      return;
    }

    setPinModalVisible(false);
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
          delivery_pin: enteredPin,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setEnteredPin('');
        Alertt.alert('🎉 Delivered', 'Great job! Order completed successfully.', [
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
        Alertt.alert('Verification Failed', result.error || 'Failed to complete order.');
      }
    } catch (error) {
      console.error('[DirectionsScreen] Delivery error:', error);
      Alertt.alert('Error', 'Unable to reach server. Please try again.');
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
      Alertt.alert('Unavailable', 'Customer phone number is not available.');
    }
  };

  // Raise Active Issue (damaged item or customer rejection on site)
  const handleRaiseActiveIssue = async () => {
    if (!issueComment.trim()) {
      Alertt.alert('Comment Required', 'Please provide a short description of the issue.');
      return;
    }

    setIssueModalVisible(false);
    setActionLoading(true);
    try {
      const payload = {
        driver_issue_status: selectedIssueType,
        driver_issue_description: issueComment.trim(),
        return_to_store_status: 'pending'
      };

      const response = await fetch(`${BACKEND_URL}/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        Alertt.alert('⚠️ Issue Raised', 'Please return the items back to the store. The navigation route has been updated.', [
          {
            text: 'OK',
            onPress: () => {
              setIssueComment('');
              fetchOrderDetails();
              onRefresh();
            },
          },
        ]);
      } else {
        Alertt.alert('Error', result.error || 'Failed to report issue.');
      }
    } catch (error) {
      console.error('[DirectionsScreen] Raise issue error:', error);
      Alertt.alert('Error', 'Unable to update order issue details.');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Return to Store
  const handleConfirmReturn = async () => {
    Alertt.alert(
      'Confirm Return',
      'Confirm that you have returned the items to the merchant at the store.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Return',
          onPress: async () => {
            setActionLoading(true);
            try {
              const payload = {
                return_to_store_status: 'returned',
                status: 'cancelled',
                is_completed: true
              };

              const response = await fetch(`${BACKEND_URL}/orders/${order.id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${userToken}`,
                },
                body: JSON.stringify(payload),
              });

              const result = await response.json();
              if (response.ok && result.success) {
                Alertt.alert('Success', 'Return completed. You can now accept other orders.', [
                  {
                    text: 'OK',
                    onPress: () => {
                      fetchOrderDetails();
                      onRefresh();
                      onBack();
                    },
                  },
                ]);
              } else {
                Alertt.alert('Error', result.error || 'Failed to complete return.');
              }
            } catch (error) {
              console.error('[DirectionsScreen] Return confirmation error:', error);
              Alertt.alert('Error', 'Unable to reach server. Please try again.');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  // Status mapping display (title shown in bottom panel)
  const getStatusDisplay = () => {
    if (orderData.driver_issue_status) {
      if (orderData.return_to_store_status === 'returned') {
        return 'Returned to Store';
      }
      return 'Returning to Store';
    }
    if (localCompleted || localStatus === 'delivered') return 'Order Delivered';
    if (localStatus === 'out_for_delivery') return 'Out for Delivery';
    if (orderData?.is_packed || localStatus === 'packed') return 'Order Packed';
    return 'Order Confirmed';
  };

  // Sub-description beneath the title
  const getStatusDescription = () => {
    if (orderData.driver_issue_status) {
      if (orderData.return_to_store_status === 'returned') {
        return 'Incorrect/rejected items have been returned to the merchant.';
      }
      return `Issue raised: ${orderData.driver_issue_description || 'Return route active'}. Return incorrect items to the store.`;
    }
    if (localCompleted || localStatus === 'delivered') return 'The order has been successfully delivered to the customer.';
    if (localStatus === 'out_for_delivery') return 'Order is out for delivery. Head to the customer address.';
    if (orderData?.is_packed || localStatus === 'packed') return 'Order is packed and ready. Proceed to the store for pickup.';
    return 'Order confirmed by store and is currently being processed.';
  };



  const allStoresPickedUp = orderData?.stores && orderData.stores.length > 0
    ? orderData.stores.every((s: any) => (orderData.picked_up_stores || []).includes(s.id))
    : true;

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

            {orderData?.stores && orderData.stores.length > 0 ? (
              orderData.stores.map((s: any) => {
                const sLat = parseCoordinate(s.latitude);
                const sLng = parseCoordinate(s.longitude);
                if (sLat === null || sLng === null) return null;
                const isPicked = (orderData.picked_up_stores || []).includes(s.id);
                return (
                  <Marker
                    key={s.id}
                    coordinate={{ latitude: sLat, longitude: sLng }}
                    title={`Pickup Store: ${s.name}`}
                    description={s.address_line}
                    pinColor={isPicked ? '#aaa' : Colors.secondary}
                  />
                );
              })
            ) : (
              storeLat !== null && storeLng !== null && (
                <Marker
                  coordinate={{ latitude: storeLat, longitude: storeLng }}
                  title="Pickup Store"
                  description={orderData?.store_name}
                  pinColor={Colors.secondary}
                />
              )
            )}

            {userLat !== null && userLng !== null && (
              <Marker
                coordinate={{ latitude: userLat, longitude: userLng }}
                title="Delivery Point"
                description={orderData?.user_name}
                pinColor={Colors.primary}
              />
            )}

            {directionsOrigin && (
              <MapViewDirections
                key={`${localStatus}-${localGivenToDelivery}-${orderData.driver_issue_status}-${orderData.picked_up_stores?.length || 0}`}
                origin={directionsOrigin}
                destination={
                  (orderData.driver_issue_status && orderData.return_to_store_status !== 'returned' && storeLat !== null && storeLng !== null)
                    ? { latitude: storeLat, longitude: storeLng }
                    : (userLat !== null && userLng !== null)
                      ? { latitude: userLat, longitude: userLng }
                      : (storeLat !== null && storeLng !== null ? { latitude: storeLat, longitude: storeLng } : directionsOrigin)
                }
                waypoints={
                  (!localGivenToDelivery && !orderData.driver_issue_status)
                    ? (orderData?.stores && orderData.stores.length > 0
                        ? orderData.stores
                            .filter((s: any) => !(orderData.picked_up_stores || []).includes(s.id))
                            .map((s: any) => ({ latitude: parseFloat(s.latitude), longitude: parseFloat(s.longitude) }))
                        : (storeLat !== null && storeLng !== null ? [{ latitude: storeLat, longitude: storeLng }] : [])
                      )
                    : []
                }
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={4}
                strokeColor={orderData.driver_issue_status ? Colors.error : Colors.primary}
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
            <Text style={styles.sectionTitle}>Pickup Points</Text>
            {orderData.stores && orderData.stores.length > 0 ? (
              orderData.stores.map((s: any, idx: number) => {
                const isPicked = (orderData.picked_up_stores || []).includes(s.id);
                return (
                  <View key={s.id || idx} style={[styles.card, { marginBottom: 10 }]}>
                    <View style={[styles.cardIconCircle, isPicked && { backgroundColor: '#e2f2e6' }]}>
                      <ShoppingBag size={20} color={isPicked ? Colors.success : Colors.primary} />
                    </View>
                    <View style={styles.cardDetails}>
                      <Text style={styles.cardMainText}>{s.name || 'FreshRush Partner Store'}</Text>
                      <View style={styles.addressRow}>
                        <MapPin size={12} color={Colors.textSecondary} style={{ marginRight: 4, marginTop: 2 }} />
                        <Text style={styles.cardSubText}>{s.address_line || 'Store location address line'}</Text>
                      </View>
                    </View>
                    {localOpted && !localGivenToDelivery && (
                      isPicked ? (
                        <View style={[styles.phoneBtn, { backgroundColor: '#e2f2e6', borderWidth: 1, borderColor: Colors.success }]}>
                          <Icon name="checkmark" size={18} color={Colors.success} />
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.phoneBtn, { backgroundColor: Colors.secondary }]}
                          onPress={() => handlePickUpStore(s.id, s.name)}
                        >
                          <Icon name="checkmark-done" size={18} color="#fff" />
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                );
              })
            ) : (
              <View style={styles.card}>
                <View style={styles.cardIconCircle}>
                  <ShoppingBag size={20} color={Colors.primary} />
                </View>
                <View style={styles.cardDetails}>
                  <Text style={styles.cardMainText}>{orderData.store_name || 'FreshRush Partner Store'}</Text>
                  <View style={styles.addressRow}>
                    <MapPin size={12} color={Colors.textSecondary} style={{ marginRight: 4, marginTop: 2 }} />
                    <Text style={styles.cardSubText}>{orderData.store_address || 'Store location address line'}</Text>
                  </View>
                </View>
              </View>
            )}
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

          <View style={styles.earningContainer}>
            <Text style={styles.sectionTitle}>Potential Earning</Text>
            <View style={styles.earningCard}>
              <View style={styles.earningMainRow}>
                 <IndianRupee size={22} color={Colors.primary} strokeWidth={3} />
                 <Text style={styles.earningTotalText}>
                   {((parseFloat(orderData.delivery_fee) || 0) + 
                     (parseFloat(orderData.rainy_surge_fee) || 0) + 
                     (parseFloat(orderData.late_night_fee) || 0) + 
                     (parseFloat(orderData.extra_store_charge) || 0) + 
                     (parseFloat(orderData.delivery_tip) || 0)).toFixed(0)}
                 </Text>
              </View>
              <View style={styles.earningBreakdown}>
                 <Text style={styles.breakdownItem}>Fee: ₹{(parseFloat(orderData.delivery_fee) || 0).toFixed(0)}</Text>
                 {parseFloat(orderData.rainy_surge_fee) > 0 && <Text style={styles.breakdownItem}>Rainy: ₹{(parseFloat(orderData.rainy_surge_fee) || 0).toFixed(0)}</Text>}
                 {parseFloat(orderData.late_night_fee) > 0 && <Text style={styles.breakdownItem}>Late: ₹{(parseFloat(orderData.late_night_fee) || 0).toFixed(0)}</Text>}
                 {parseFloat(orderData.extra_store_charge) > 0 && <Text style={styles.breakdownItem}>Extra Store: ₹{(parseFloat(orderData.extra_store_charge) || 0).toFixed(0)}</Text>}
                 {parseFloat(orderData.delivery_tip) > 0 && <Text style={styles.breakdownItem}>Tip: ₹{(parseFloat(orderData.delivery_tip) || 0).toFixed(0)}</Text>}
              </View>
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
            <TouchableOpacity 
              style={[
                styles.mainActionBtn, 
                { backgroundColor: allStoresPickedUp ? Colors.secondary : '#cccccc' }
              ]} 
              onPress={handleMarkPickedUp}
              disabled={!allStoresPickedUp}
            >
              <Truck size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.mainActionBtnText}>
                {allStoresPickedUp ? 'Mark as Picked Up' : 'Pick up all stores first'}
              </Text>
            </TouchableOpacity>
          ) : (orderData.driver_issue_status && orderData.return_to_store_status !== 'returned') ? (
            <TouchableOpacity 
              style={[styles.mainActionBtn, { backgroundColor: Colors.secondary }]} 
              onPress={handleConfirmReturn}
            >
              <Icon name="storefront-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.mainActionBtnText}>Confirm Return to Store</Text>
            </TouchableOpacity>
          ) : !localCompleted ? (
            <View style={{ gap: 10 }}>
              <TouchableOpacity 
                style={[styles.mainActionBtn, { backgroundColor: Colors.success }]} 
                onPress={handleMarkDelivered}
              >
                <CheckCircle size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.mainActionBtnText}>Mark as Delivered</Text>
              </TouchableOpacity>
              
              {localGivenToDelivery && (
                <TouchableOpacity 
                  style={[styles.mainActionBtn, { backgroundColor: Colors.error }]} 
                  onPress={() => setIssueModalVisible(true)}
                >
                  <Icon name="alert-circle-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.mainActionBtnText}>Raise Active Issue</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.completedBadge}>
              <Text style={styles.completedBadgeText}>Completed</Text>
            </View>
          )}
        </View>
      </Animated.View>

      <LocationDisclosureModal
        visible={showDisclosure}
        onAccept={handleDisclosureAccept}
        onDecline={handleDisclosureDecline}
      />

      <Modal
        visible={pinModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setPinModalVisible(false);
          setEnteredPin('');
        }}
      >
        <View style={styles.pinModalOverlay}>
          <View style={styles.pinModalContent}>
            <Text style={styles.pinModalTitle}>Enter Delivery PIN</Text>
            <Text style={styles.pinModalMessage}>
              Ask the customer for the 6-digit verification PIN to complete this delivery.
            </Text>
            
            <View style={styles.pinInputWrapper}>
              <TextInput
                style={styles.pinTextInput}
                placeholder="0 0 0 0 0 0"
                value={enteredPin}
                onChangeText={setEnteredPin}
                keyboardType="number-pad"
                maxLength={6}
                placeholderTextColor={Colors.textLight}
              />
            </View>

            <View style={styles.pinModalButtons}>
              <TouchableOpacity 
                style={[styles.pinModalButton, styles.pinModalCancelButton]} 
                onPress={() => {
                  setPinModalVisible(false);
                  setEnteredPin('');
                }}
              >
                <Text style={styles.pinModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.pinModalButton, styles.pinModalSubmitButton]} 
                onPress={submitDeliveryPin}
              >
                <Text style={styles.pinModalSubmitText}>Verify PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={issueModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setIssueModalVisible(false);
          setIssueComment('');
        }}
      >
        <View style={styles.pinModalOverlay}>
          <View style={styles.pinModalContent}>
            <Text style={styles.pinModalTitle}>Report Delivery Issue</Text>
            <Text style={styles.pinModalMessage}>
              Select the type of issue you encountered on site.
            </Text>

            <View style={styles.issueTypeWrapper}>
              {(['customer_rejected', 'damaged_item', 'customer_refused_other'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.issueTypeBtn,
                    selectedIssueType === type && styles.issueTypeBtnActive
                  ]}
                  onPress={() => setSelectedIssueType(type)}
                >
                  <Text style={[
                    styles.issueTypeBtnText,
                    selectedIssueType === type && styles.issueTypeBtnTextActive
                  ]}>
                    {type === 'customer_rejected' && 'Incorrect items (Customer rejected)'}
                    {type === 'damaged_item' && 'Damaged packaging/item'}
                    {type === 'customer_refused_other' && 'Refused delivery (Other reason)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.issueTextInput}
              placeholder="Describe the issue in detail..."
              value={issueComment}
              onChangeText={setIssueComment}
              multiline
              placeholderTextColor={Colors.textLight}
            />

            <View style={styles.pinModalButtons}>
              <TouchableOpacity 
                style={[styles.pinModalButton, styles.pinModalCancelButton]} 
                onPress={() => {
                  setIssueModalVisible(false);
                  setIssueComment('');
                }}
              >
                <Text style={styles.pinModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.pinModalButton, styles.pinModalSubmitButton, { backgroundColor: Colors.error }]} 
                onPress={handleRaiseActiveIssue}
              >
                <Text style={styles.pinModalSubmitText}>Submit Issue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  earningContainer: {
    marginBottom: 15,
  },
  earningCard: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  earningTotalText: {
    fontSize: 28,
    fontFamily: Fonts.black,
    color: Colors.primary,
  },
  earningBreakdown: {
    alignItems: 'flex-end',
  },
  breakdownItem: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
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
  pinModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinModalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  pinModalTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 8,
  },
  pinModalMessage: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  pinInputWrapper: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 52,
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pinTextInput: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 4,
  },
  pinModalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  pinModalButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  pinModalCancelButton: {
    backgroundColor: '#f5f5f5',
  },
  pinModalCancelText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  pinModalSubmitButton: {
    backgroundColor: Colors.primary,
  },
  pinModalSubmitText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  issueTypeWrapper: {
    width: '100%',
    gap: 8,
    marginBottom: 15,
  },
  issueTypeBtn: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  issueTypeBtnActive: {
    borderColor: Colors.error,
    backgroundColor: '#FFF5F5',
  },
  issueTypeBtnText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  issueTypeBtnTextActive: {
    color: Colors.error,
    fontFamily: Fonts.bold,
  },
  issueTextInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    height: 80,
    backgroundColor: '#f9f9f9',
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.regular,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
});

export default DirectionsScreen;
