import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Alert,
} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { storage } from './src/utils/storage';
import LoginScreen from './src/screens/LoginScreen';
import RegistrationScreen from './src/screens/RegistrationScreen';
import ApprovalStatusScreen from './src/screens/ApprovalStatusScreen';
import HomeScreen from './src/screens/HomeScreen';
import SplashScreen from './src/screens/SplashScreen';
import { 
  requestNotificationPermission, 
  createNotificationChannels, 
  registerFCMToken, 
  setupFCMListeners 
} from './src/utils/notifications';


import { API_BASE_URL } from './src/config/api';

const BACKEND_URL = API_BASE_URL;

function App() {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login');
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // FCM Setup
  useEffect(() => {
    if (userToken && userData?.id && userData?.approvalStatus === 'approved') {
      const initFCM = async () => {
        try {
          const hasPermission = await requestNotificationPermission();
          if (hasPermission) {
            await createNotificationChannels();
            const token = await messaging().getToken();
            await registerFCMToken(userData.id, token);
            
            // Listen for token refresh
            const unsubscribeTokenRefresh = messaging().onTokenRefresh(async newToken => {
              await registerFCMToken(userData.id, newToken);
            });

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
      console.log('[App] Initializing session...');
      try {
        const token = storage.getString('userToken');
        const data = storage.getObject<any>('userData');

        if (token && data) {
          console.log('[App] Found valid cached session. Logging in immediately...');
          setUserToken(token);
          setUserData(data);

          try {
            console.log('[App] Refreshing user data in background...');
            const response = await fetch(`${BACKEND_URL}/user/profile`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.user) {
                const freshUser = { ...data, ...result.user };
                storage.setItem('userData', freshUser);
                setUserData(freshUser);
                console.log('[App] Background refresh complete. Status:', result.user.approvalStatus);
              }
            } else if (response.status === 401 || response.status === 403) {
              console.log('[App] Session expired on server. Logging out.');
              handleLogout();
            }
          } catch (fetchErr) {
            console.log('[App] Background refresh failed (likely offline). Keeping cached session.', fetchErr);
          }
        } else {
          console.log('[App] No cached session found.');
        }
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
      Alert.alert(
        '⏳ Approval Pending',
        'Your application is currently being reviewed. You\'ll be notified as soon as you\'re approved!',
        [{ text: 'OK' }]
      );
    }
    setUserToken(token);
    setUserData(user);
    storage.setItem('userToken', token);
    storage.setItem('userData', user);
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
    storage.removeItem('userToken');
    storage.removeItem('userData');
    setUserToken(null);
    setUserData(null);
    setCurrentScreen('login');
  };

  if (loading) {
    return <SplashScreen />;
  }

  const renderLoggedInContent = () => {
    const isPending = userData?.role === 'delivery' &&
      (userData?.approvalStatus === 'pending' || userData?.approvalStatus === 'rejected');

    if (isPending) {
      return (
        <ApprovalStatusScreen
          status={userData.approvalStatus}
          onApproved={handleApproved}
          onLogout={handleLogout}
        />
      );
    }

    return (
      <HomeScreen userData={userData} userToken={userToken} onLogout={handleLogout} />
    );

  };

  return (
    <SafeAreaView style={styles.container}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
