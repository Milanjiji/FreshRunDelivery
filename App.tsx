import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { storage } from './src/utils/storage';
import LoginScreen from './src/screens/LoginScreen';
import SplashScreen from './src/screens/SplashScreen';

function App() {
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
    setUserToken(token);
    setUserData(user);
  };

  const handleLogout = () => {
    storage.removeItem('userToken');
    storage.removeItem('userData');
    setUserToken(null);
    setUserData(null);
  };

  if (loading) {
    return <SplashScreen />;
  }

  // Choose which screen to show
  return (
    <SafeAreaView style={styles.container}>
      {!userToken ? (
        <LoginScreen onLoginSuccess={handleLoginSuccess} role="delivery" />
      ) : (
        <View style={styles.homeContainer}>
          <Text style={styles.welcomeText}>FreshRun Delivery</Text>
          <Text style={styles.infoText}>Partner Phone: {userData?.phone}</Text>
          <Text style={styles.infoText}>Role: {userData?.role}</Text>
          
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
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
