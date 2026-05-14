import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { storage } from './src/utils/storage';
import LoginScreen from './src/screens/LoginScreen';
import RegistrationScreen from './src/screens/RegistrationScreen';
import ApprovalStatusScreen from './src/screens/ApprovalStatusScreen';
import SplashScreen from './src/screens/SplashScreen';

function App() {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login');
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Check login state on start
  useEffect(() => {
    const checkLogin = () => {
      try {
        const token = storage.getString('userToken');
        const data = storage.getObject<any>('userData');
        if (token) {
          setUserToken(token);
          setUserData(data);
        }
      } catch (e) {
        console.error('Failed to load login state', e);
      } finally {
        setLoading(false);
      }
    };

    checkLogin();
  }, []);

  const handleLoginSuccess = (token: string, user: any) => {
    // If the partner is pending approval, show the popup and the status screen
    if (user.role === 'delivery' && user.approvalStatus === 'pending') {
      Alert.alert(
        'Approval Pending',
        'Your application is currently being reviewed by our team. Please wait for approval.',
        [{ text: 'OK' }]
      );
    }
    
    setUserToken(token);
    setUserData(user);
    storage.setItem('userToken', token);
    storage.setItem('userData', user);
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

  // Determine what to show if logged in
  const renderLoggedInContent = () => {
    if (userData?.role === 'delivery' && (userData?.approvalStatus === 'pending' || userData?.approvalStatus === 'rejected')) {
      return (
        <ApprovalStatusScreen 
          status={userData.approvalStatus} 
          onLogout={handleLogout} 
        />
      );
    }

    return (
      <View style={styles.homeContainer}>
        <Text style={styles.welcomeText}>FreshRun Delivery</Text>
        <Text style={styles.infoText}>Partner Name: {userData?.fullName}</Text>
        <Text style={styles.infoText}>Phone: {userData?.phone}</Text>
        <Text style={styles.infoText}>Status: {userData?.approvalStatus}</Text>
        
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 20,
    color: '#333',
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  logoutButton: {
    marginTop: 40,
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default App;
