import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { API_BASE_URL } from '../config/api';

/**
 * Request notification permission for Android 13+
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: 'FreshRun Notification Permission',
        message: 'We need permission to send you order updates.',
        buttonPositive: 'Allow',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

/**
 * Create notification channels for Android
 */
export async function createNotificationChannels() {
  await notifee.createChannel({
    id: 'order_updates',
    name: 'Order Updates',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });

  await notifee.createChannel({
    id: 'new_orders',
    name: 'New Available Orders',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
}

/**
 * Register FCM token with the backend
 */
export async function registerFCMToken(userId: string, token: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/drivers/${userId}/fcm-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    
    if (response.ok) {
      console.log('[FCM] Token registered with backend');
    } else {
      console.error('[FCM] Failed to register token:', await response.text());
    }
  } catch (error) {
    console.error('[FCM] Error registering token:', error);
  }
}

/**
 * Setup FCM listeners
 */
export function setupFCMListeners(navigationRef: any) {
  // Handle foreground messages
  const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
    console.log('[FCM] Foreground message:', remoteMessage);
    
    // Display local notification using Notifee
    await notifee.displayNotification({
      title: remoteMessage.notification?.title || 'Order Update',
      body: remoteMessage.notification?.body || '',
      android: {
        channelId: remoteMessage.data?.type === 'new_order' ? 'new_orders' : 'order_updates',
        pressAction: { id: 'default' },
      },
      data: remoteMessage.data,
    });
  });

  // Handle background/quit state notification clicks
  const unsubscribeOnNotificationOpenedApp = messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('[FCM] Notification caused app to open from background:', remoteMessage);
    handleNotificationClick(remoteMessage, navigationRef);
  });

  // Check if app was opened from a quit state via notification
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('[FCM] App opened from quit state via notification:', remoteMessage);
        handleNotificationClick(remoteMessage, navigationRef);
      }
    });

  return () => {
    unsubscribeOnMessage();
    unsubscribeOnNotificationOpenedApp();
  };
}

function handleNotificationClick(remoteMessage: any, navigationRef: any) {
  // Logic to navigate based on notification data
  // Example: if (remoteMessage.data.orderId) { ... }
  console.log('[FCM] Handling click for:', remoteMessage.data);
}
