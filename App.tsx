import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import messaging from '@react-native-firebase/messaging';
import io from 'socket.io-client';
import Icon from 'react-native-vector-icons/Ionicons';
import { storage } from './src/utils/storage';
import LoadingTransition from './src/components/LoadingTransition';
import { Alertt, CustomAlert } from './src/components/Alertt';
import LoginScreen from './src/screens/LoginScreen';
import RegistrationScreen from './src/screens/RegistrationScreen';
import ApprovalStatusScreen from './src/screens/ApprovalStatusScreen';
import PaymentOnboardingScreen from './src/screens/PaymentOnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import { 
  requestNotificationPermission, 
  createNotificationChannels, 
  registerFCMToken, 
  setupFCMListeners 
} from './src/utils/notifications';


import { API_BASE_URL } from './src/config/api';

const BACKEND_URL = API_BASE_URL;

import auth from '@react-native-firebase/auth';
import appCheck from '@react-native-firebase/app-check';

// Initialize App Check
const rnfbProvider = appCheck().newReactNativeFirebaseAppCheckProvider();
rnfbProvider.configure({
  android: {
    provider: 'playIntegrity',
  },
  apple: {
    provider: 'deviceCheck',
  },
});

appCheck().initializeAppCheck({
  provider: rnfbProvider,
  isTokenAutoRefreshEnabled: true,
});

// Disable browser-based reCAPTCHA by forcing Play Integrity
auth().settings.appVerificationDisabledForTesting = false;

// Intercept global fetch to automatically inject a fresh Firebase ID token
const originalFetch = global.fetch;
global.fetch = async (input, init) => {
  if (typeof input === 'string' && input.startsWith(API_BASE_URL)) {
    try {
      const currentUser = auth().currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken(false);
        if (token) {
          init = init || {};
          let headers = init.headers || {};
          if (headers instanceof Headers) {
            headers.set('Authorization', `Bearer ${token}`);
          } else if (Array.isArray(headers)) {
            const authIdx = headers.findIndex(([k]) => k.toLowerCase() === 'authorization');
            if (authIdx > -1) {
              headers[authIdx] = ['Authorization', `Bearer ${token}`];
            } else {
              headers.push(['Authorization', `Bearer ${token}`]);
            }
          } else {
            headers = {
              ...headers,
              'Authorization': `Bearer ${token}`
            };
          }
          init.headers = headers;
        }
      }
    } catch (error) {
      console.error('[Fetch Interceptor] Error injecting token:', error);
    }
  }
  return originalFetch(input, init);
};

function App() {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register' | 'complete_profile'>('login');
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [appSettings, setAppSettings] = useState<any>(null);
  const socketRef = useRef<any>(null);

  // Fetch Global App Settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/settings`);
        const data = await res.json();
        if (data.success) setAppSettings(data.data);
      } catch (e) {
        console.warn('Failed to fetch settings in App.tsx');
      }
    };
    fetchSettings();
  }, []);

  // Global Socket for settings updates
  useEffect(() => {
    socketRef.current = io(API_BASE_URL);

    socketRef.current.on('settings_updated', (newSettings: any) => {
      console.log('[Socket] Global settings updated');
      setAppSettings(newSettings);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Firebase Auth & Token Refresh Logic
  useEffect(() => {
    const unsubscribe = auth().onIdTokenChanged(async (user) => {
      console.log('[Auth] ID Token changed or user state changed');
      if (user) {
        try {
          const idToken = await user.getIdToken();
          console.log('[Auth] New ID Token acquired');
          
          setUserToken(idToken);
          storage.setItem('userToken', idToken);
          
          // Load local user data if it exists
          const currentData = storage.getObject<any>('userData');
          if (currentData) {
            setUserData(currentData);
          }
        } catch (e) {
          console.error('[Auth] Error getting ID token:', e);
        }
      } else {
        console.log('[Auth] User is signed out');
        setUserToken(null);
        setUserData(null);
        storage.removeItem('userToken');
        storage.removeItem('userData');
        setCurrentScreen('login');
      }
    });

    return unsubscribe;
  }, []);

  // FCM Setup
  useEffect(() => {
    if (userToken && userData?.id && userData?.approvalStatus === 'approved') {
      const initFCM = async () => {
        try {
          const hasPermission = await requestNotificationPermission();
          if (hasPermission) {
            await createNotificationChannels();
            const token = await messaging().getToken();
            console.log('[FCM] Token:', token);
            await registerFCMToken(userData.id, token);
            
            // Listen for token refresh
            const unsubscribeTokenRefresh = messaging().onTokenRefresh(async newToken => {
              await registerFCMToken(userData.id, newToken);
            });

            console.log('[FCM] Initializing listeners...');
            const cleanupListeners = setupFCMListeners(null); // Pass navigation ref if available

            return () => {
              unsubscribeTokenRefresh();
              cleanupListeners();
            };
          }
        } catch (error) {
          console.error('[FCM] Init error:', error);
        }
      };

      const cleanup = initFCM();
      return () => {
        if (typeof cleanup === 'function') (cleanup as any)();
      };
    }
  }, [userToken, userData?.id, userData?.approvalStatus]);

  useEffect(() => {
    const initApp = async () => {
      console.log('[App] Initializing app...');
      try {
        // NOTE: Manual session check removed.
        // Handled by onIdTokenChanged listener in useEffect above.
      } catch (e) {
        console.error('[App] Critical failure during init:', e);
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);


  const handleLoginSuccess = (token: string, user: any) => {
    if (user.role === 'delivery' && user.approvalStatus === 'pending') {
      Alertt.alert(
        '⏳ Approval Pending',
        'Your application is currently being reviewed. You\'ll be notified as soon as you\'re approved!',
        [{ text: 'OK' }]
      );
    }
    setUserToken(token);
    setUserData(user);
    storage.setItem('userToken', token);
    storage.setItem('userData', user);
    setCurrentScreen('login');
  };

  const handleApproved = () => {
    console.log('[App] Partner approved! Updating state to show home screen.');
    // Update the stored user data to approved so next launch also goes directly to home
    const existing = storage.getObject<any>('userData') || {};
    const updatedUser = { ...existing, approvalStatus: 'approved' };
    storage.setItem('userData', updatedUser);
    setUserData(updatedUser);
  };

  const handleLogout = () => {
    auth().signOut();
    storage.removeItem('userToken');
    storage.removeItem('userData');
    setUserToken(null);
    setUserData(null);
    setCurrentScreen('login');
  };

  const renderLoggedInContent = () => {
    if (currentScreen === 'complete_profile') {
      return (
        <RegistrationScreen
          onBack={() => setCurrentScreen('login')}
          onRegisterSuccess={handleLoginSuccess}
          isUpdate={true}
        />
      );
    }

    const isPending = userData?.role === 'delivery' &&
      (userData?.approvalStatus === 'pending' || userData?.approvalStatus === 'rejected');

    if (isPending) {
      return (
        <ApprovalStatusScreen
          status={userData.approvalStatus}
          userData={userData}
          onApproved={handleApproved}
          onLogout={handleLogout}
          onCompleteProfile={() => setCurrentScreen('complete_profile')}
        />
      );
    }

    return (
      <HomeScreen userData={userData} userToken={userToken} onLogout={handleLogout} />
    );

  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {loading ? (
          <LoadingTransition />
        ) : (
          <>
            {appSettings?.is_rainy_condition && (
              <SafeAreaView edges={['top']} style={styles.rainyBar}>
                <Text style={styles.rainyText}>
                    Rainy weather: <Text style={{ color: '#4A90E2' }}>Extra ₹{appSettings.rainy_condition_fee}</Text> surge is active
                </Text>
              </SafeAreaView>
            )}
            <SafeAreaView style={styles.container} edges={[]}>
              {!userToken ? (
                currentScreen === 'login' ? (
                  <LoginScreen
                    onLoginSuccess={handleLoginSuccess}
                    role="delivery"
                    onNavigateToRegister={() => setCurrentScreen('register')}
                  />
                ) : (
                  <RegistrationScreen
                    onBack={() => setCurrentScreen('login')}
                    onRegisterSuccess={handleLoginSuccess}
                  />
                )
              ) : (
                renderLoggedInContent()
              )}
            </SafeAreaView>
            <CustomAlert />
          </>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  rainyBar: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  rainyText: {
    color: '#333',
    fontSize: 13,
    fontWeight: 'bold',
  },
  homeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  logoutButton: {
    marginTop: 40,
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 12,
    width: '80%',
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default App;

