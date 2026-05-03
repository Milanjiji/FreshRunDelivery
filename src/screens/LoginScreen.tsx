import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Image,
} from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import axios from 'axios';
import { storage } from '../utils/storage';

// Replace with your actual backend URL
const BACKEND_URL = "https://freshrun-backend.onrender.com";

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: any) => void;
  role: 'customer' | 'delivery';
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, role }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [confirm, setConfirm] =
    useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);

  // STEP 1: Send OTP
  const signInWithPhoneNumber = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    const formattedNumber = `+91${phoneNumber}`;
    setLoading(true);
    try {
      const confirmation = await auth().signInWithPhoneNumber(formattedNumber);
      setConfirm(confirmation);
      console.log('OTP Sent to:', formattedNumber);
    } catch (error: any) {
      console.error('Send OTP Error:', error);
      Alert.alert('Login Failed', error.message || 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP and Call Backend
  const confirmCode = async () => {
    if (!code || code.length < 6) {
      Alert.alert('Error', 'Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    try {
      if (!confirm) return;
      
      // Verify OTP with Firebase
      const credential = await confirm.confirm(code);
      
      if (credential?.user) {
        // Get ID Token
        const idToken = await credential.user.getIdToken();
        console.log('Firebase verified. Exchanging for JWT...');

        console.log("Sending token to backend:", idToken);
        console.log("Backend URL:", BACKEND_URL);

        // Call Backend
        const response = await axios.post(`${BACKEND_URL}/auth/login`, {
          idToken,
          role,
        });

        if (response.data.success) {
          const { token, user } = response.data;
          
          // Store JWT
          storage.setItem('userToken', token);
          storage.setItem('userData', user);
          
          onLoginSuccess(token, user);
        } else {
          throw new Error(response.data.error || 'Backend authentication failed');
        }
      }
    } catch (error: any) {
      console.error('Verification Error:', error);
      Alert.alert('Verification Failed', error.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <View style={styles.content}>
          <View style={styles.topContainer}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {!confirm ? "Enter your phone\nnumber" : "Verify OTP"}
              </Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>
                {!confirm ? "Phone Number" : "Enter Code"}
              </Text>
              
              <View style={styles.inputWrapper}>
                {!confirm && (
                  <View style={styles.countryPicker}>
                    <Text style={styles.flag}>🇮🇳</Text>
                    <Text style={styles.countryCode}>(+91)</Text>
                    <Text style={styles.dropdownIcon}>⌵</Text>
                  </View>
                )}
                
                <TextInput
                  style={styles.textInput}
                  placeholder={!confirm ? "9876543210" : "123456"}
                  value={!confirm ? phoneNumber : code}
                  onChangeText={!confirm ? setPhoneNumber : setCode}
                  keyboardType={!confirm ? "phone-pad" : "number-pad"}
                  maxLength={!confirm ? 10 : 6}
                  placeholderTextColor="#ccc"
                />
              </View>
            </View>
          </View>

          <View style={styles.bottomContainer}>
            <TouchableOpacity 
              style={styles.mainButton} 
              onPress={!confirm ? signInWithPhoneNumber : confirmCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {!confirm ? "Log in" : "Verify & Login"}
                </Text>
              )}
            </TouchableOpacity>

            {!confirm ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Create Account</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setConfirm(null)} style={styles.backButton}>
                <Text style={styles.backText}>Change Phone Number</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 80,
    paddingBottom: 30,
    justifyContent: 'space-between',
  },
  topContainer: {
    flex: 1,
  },
  header: {
    marginBottom: 40,
  },
  headerTitle: {
    fontSize: 36,
    fontFamily: 'Inter-Bold',
    color: '#1a1a1a',
    lineHeight: 44,
  },
  inputSection: {
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 65,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    paddingRight: 10,
    marginRight: 10,
    height: '60%',
  },
  flag: {
    fontSize: 20,
    marginRight: 8,
  },
  countryCode: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1a1a1a',
    marginRight: 5,
  },
  dropdownIcon: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    color: '#1a1a1a',
    padding: 0,
  },
  bottomContainer: {
    marginTop: 20,
  },
  mainButton: {
    backgroundColor: '#60c547',
    height: 60,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 25,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#666',
  },
  linkText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#3b5998',
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
});

export default LoginScreen;
