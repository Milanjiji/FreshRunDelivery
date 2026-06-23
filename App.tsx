import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  AppState,
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

// Helpers for token validation and injection
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decodeTokenPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    let output = '';
    
    for (let bc = 0, bs = 0, rbuffer, idx = 0; idx < base64.length; idx++) {
      const char = base64.charAt(idx);
      const pos = CHARS.indexOf(char);
      if (pos === -1) continue;
      bs = bc % 4 ? bs * 64 + pos : pos;
      if (bc++ % 4) {
        rbuffer = (bs >> ((-2 * bc) & 6));
        output += String.fromCharCode(255 & rbuffer);
      }
    }
    
    return JSON.parse(output);
  } catch (e) {
    return null;
  }
}

function isTokenExpired(token: string) {
  const payload = decodeTokenPayload(token);
  if (!payload || !payload.exp) return true;
  
  const expTimeMs = payload.exp * 1000;
  return Date.now() >= (expTimeMs - 10000);
}

function injectAuthHeader(headers: any, token: string) {
  if (!headers) {
    return { 'Authorization': `Bearer ${token}` };
  }
  if (headers instanceof Headers) {
    headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }
  if (Array.isArray(headers)) {
    const newHeaders = [...headers];
    const authIdx = newHeaders.findIndex(([k]) => k.toLowerCase() === 'authorization');
    if (authIdx > -1) {
      newHeaders[authIdx] = ['Authorization', `Bearer ${token}`];
    } else {
      newHeaders.push(['Authorization', `Bearer ${token}`]);
    }
    return newHeaders;
  }
  return {
    ...headers,
    'Authorization': `Bearer ${token}`
  };
}

// Intercept global fetch to automatically inject a fresh Firebase ID token.
// We check if the token is expired before calling the API, force-refreshing if needed.
const originalFetch = (globalThis as any).fetch;
(globalThis as any).fetch = async (input: any, init?: any) => {
  if (typeof input === 'string' && input.startsWith(API_BASE_URL)) {
    console.log('[AuthTrace][Fetch] Intercepted fetch call to backend API:', input);
    try {
      const currentUser = auth().currentUser;
      if (currentUser) {
        let token = storage.getString('userToken') || '';

        // If the token is missing or expired, fetch a fresh one before the call
        if (!token || isTokenExpired(token)) {
          console.log('[AuthTrace][Fetch] Token expired or missing. Refreshing before API call...');
          try {
            token = await currentUser.getIdToken(true);
            if (token) {
              storage.setItem('userToken', token);
            }
          } catch (refreshErr) {
            console.error('[AuthTrace][Fetch] Failed to force-refresh token:', refreshErr);
          }
        }

        // If it's valid, fetch cached token using false (handles other SDK-side updates)
        if (token && !isTokenExpired(token)) {
          try {
            token = await currentUser.getIdToken(false);
          } catch (e) {
            // fallback to local storage token
          }
        }

        if (token) {
          init = init || {};
          init.headers = injectAuthHeader(init.headers, token);
        }
      }
    } catch (error) {
      console.error('[AuthTrace][Fetch] Error in proactive token check:', error);
    }
  }
  return originalFetch(input, init);
};

function App() {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register' | 'complete_profile'>('login');
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const authResolved = React.useRef(false);
  const [appSettings, setAppSettings] = useState<any>(null);
  const socketRef = useRef<any>(null);

  // Debounced versions of userToken and userData.id.
  // Firebase fires onIdTokenChanged TWICE on cold-start (once from local cache,
  // once after server validation). Without debouncing, every effect that depends
  // on [userToken, userData?.id] runs twice: FCM setup and HomeScreen socket/fetching.
  // We debounce by 350 ms – that's long enough for both fires to settle, but
  // short enough that the user never notices.
  const [stableToken, setStableToken] = useState<string | null>(null);
  const [stableUserId, setStableUserId] = useState<string | null>(null);
  const debounceTokenTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep stableToken / stableUserId in sync with userToken / userData, debounced.
  useEffect(() => {
    if (debounceTokenTimer.current) clearTimeout(debounceTokenTimer.current);
    debounceTokenTimer.current = setTimeout(() => {
      setStableToken(userToken);
      setStableUserId(userData?.id ?? null);
    }, 350);
    return () => {
      if (debounceTokenTimer.current) clearTimeout(debounceTokenTimer.current);
    };
  }, [userToken, userData?.id]);

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

  // Proactive token refresh when app transitions back to the foreground (active state)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[AuthTrace][Foreground] App moved to foreground - proactively refreshing session...');
        try {
          const currentUser = auth().currentUser;
          if (currentUser) {
            const freshToken = await currentUser.getIdToken(true);
            if (freshToken) {
              setUserToken(freshToken);
              storage.setItem('userToken', freshToken);
              console.log('[AuthTrace][Foreground] Session successfully renewed proactively on foreground.');
            }
          }
        } catch (err) {
          console.warn('[AuthTrace][Foreground] Proactive session refresh failed:', err);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Firebase Auth & Token Refresh Logic
  // IMPORTANT: setLoading(false) is called here – AFTER Firebase first resolves
  // the auth state – so we never briefly show the login screen on app open.
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (!authResolved.current) {
        authResolved.current = true;
        setLoading(false);
      }
    }, 5000);

    const unsubscribe = auth().onIdTokenChanged(async (user) => {
      console.log('[AuthTrace][Startup] onIdTokenChanged triggered. User present:', !!user);
      if (user) {
        try {
          const idToken = await user.getIdToken();
          console.log('[AuthTrace][Startup] New ID Token acquired from Firebase SDK');
          
          setUserToken(idToken);
          storage.setItem('userToken', idToken);
          
          // Load local user data if it exists
          const currentData = storage.getObject<any>('userData');
          if (currentData) {
            setUserData(currentData);
          }
        } catch (e) {
          console.error('[AuthTrace][Startup] Error getting ID token from Firebase SDK:', e);
          const cachedToken = storage.getString('userToken');
          if (cachedToken) {
            console.log('[AuthTrace][Startup] Startup recovery: successfully restored session from MMKV cache due to network failure.');
            setUserToken(cachedToken);
            const currentData = storage.getObject<any>('userData');
            if (currentData) {
              setUserData(currentData);
            }
          } else {
            console.log('[AuthTrace][Startup] Startup recovery failed: no cached token. Routing to Login.');
            setUserToken(null);
            setCurrentScreen('login');
          }
        }
      } else {
        console.log('[AuthTrace][Startup] User is signed out on Firebase SDK');
        setUserToken(null);
        setUserData(null);
        storage.removeItem('userToken');
        storage.removeItem('userData');
        setCurrentScreen('login');
      }

      // Hide the splash/loading screen only after the first auth resolution.
      if (!authResolved.current) {
        authResolved.current = true;
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  // FCM Setup
  // Uses stableToken/stableUserId (debounced) so this only runs once even when
  // Firebase fires onIdTokenChanged twice in quick succession on app open.
  useEffect(() => {
    if (stableToken && stableUserId && userData?.approvalStatus === 'approved') {
      const initFCM = async () => {
        try {
          const hasPermission = await requestNotificationPermission();
          if (hasPermission) {
            await createNotificationChannels();
            const token = await messaging().getToken();
            console.log('[FCM] Token:', token);
            await registerFCMToken(stableUserId, token);
            
            // Listen for token refresh
            const unsubscribeTokenRefresh = messaging().onTokenRefresh(async newToken => {
              await registerFCMToken(stableUserId, newToken);
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
  }, [stableToken, stableUserId, userData?.approvalStatus]);




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
      <HomeScreen userData={userData} userToken={stableToken} onLogout={handleLogout} />
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

