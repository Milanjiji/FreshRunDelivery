import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Alertt } from '../components/Alertt';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import axios from 'axios';
import api from '../utils/api';
import { storage } from '../utils/storage';
import { PageTitle, PageSubtitle } from '../components/Typography';
import { PrimaryButton } from '../components/Button';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';

import { API_BASE_URL } from '../config/api';

const BACKEND_URL = API_BASE_URL;
const OTP_REQUEST_TIMEOUT_MS = 30000;
const BACKEND_REQUEST_TIMEOUT_MS = 15000;

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: any) => void;
  role: 'customer' | 'delivery';
  onNavigateToRegister: () => void;
}

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};



const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, role, onNavigateToRegister }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const signInWithPhoneNumber = async () => {
    try {
      const sanitizedPhone = phoneNumber.replace(/\D/g, '');
      if (!sanitizedPhone || sanitizedPhone.length < 10) {
        Alertt.alert('Error', 'Please enter a valid 10-digit phone number');
        return;
      }

      setLoading(true);

      // --- Pre-OTP Check (Case 1 & 2) ---
      try {
        const checkRes = await api.get(`/auth/check-partner/${sanitizedPhone}`, {
          timeout: BACKEND_REQUEST_TIMEOUT_MS
        });

        if (checkRes.data.success) {
          if (!checkRes.data.exists) {
            setLoading(false);
            Alertt.alert(
              'Not Registered',
              'You are not registered as a partner. Please register first.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Register Now', onPress: onNavigateToRegister }
              ]
            );
            return;
          }

          if (checkRes.data.approvalStatus === 'pending') {
            setLoading(false);
            Alertt.alert(
              'Waiting for Approval',
              'Your account is currently waiting for admin approval. Please check back later.'
            );
            return;
          }

          if (checkRes.data.approvalStatus === 'rejected') {
            setLoading(false);
            Alertt.alert(
              'Account Rejected',
              'Your registration was unfortunately rejected. Please contact support for more details.'
            );
            return;
          }
        }
      } catch (err) {
        console.warn('Pre-OTP check failed, proceeding with fallback:', err);
      }

      const formattedNumber = `+91${sanitizedPhone}`;
      console.log('Sending OTP via backend to:', formattedNumber);
      await withTimeout(
        api.post('/auth/send-otp', { phoneNumber: formattedNumber }),
        OTP_REQUEST_TIMEOUT_MS,
        'OTP request timed out. Please try again.',
      );

      setConfirm(true);
    } catch (error: any) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || error.message || 'Could not send OTP'
        : error.message || 'Could not send OTP';
      Alertt.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async () => {
    if (!code || code.length < 6) {
      Alertt.alert('Error', 'Please enter a 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const sanitizedPhone = phoneNumber.replace(/\D/g, '');
      const formattedNumber = `+91${sanitizedPhone}`;
      
      console.log('Verifying code via backend:', code);
      const response = await withTimeout(
        api.post('/auth/verify-otp', {
          phoneNumber: formattedNumber,
          code,
          role,
        }),
        BACKEND_REQUEST_TIMEOUT_MS,
        'Timed out verifying OTP. Please try again.',
      );

      if (response.data.success) {
        const { customToken, user } = response.data;
        console.log('OTP verified. Signing in with custom token...');

        // Sign in to Firebase with the custom token
        const userCredential = await auth().signInWithCustomToken(customToken);
        const firebaseUser = userCredential.user;

        // Get standard ID Token
        const idToken = await withTimeout(
          firebaseUser.getIdToken(),
          BACKEND_REQUEST_TIMEOUT_MS,
          'Timed out while fetching the Firebase token. Please try again.',
        );

        console.log('Firebase session ready. Storing token...');
        storage.setItem('userToken', idToken);
        storage.setItem('userData', user);
        onLoginSuccess(idToken, user);
      } else {
        throw new Error(response.data.error || 'Verification failed');
      }
    } catch (error: any) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || error.message || 'Invalid OTP'
        : error.message || 'Invalid OTP';
      Alertt.alert('Verification Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topContainer}>
            <View style={styles.header}>
              <PageTitle>Welcome Back!</PageTitle>
              <PageSubtitle>Sign in to your delivery partner account.</PageSubtitle>
            </View>

            <View style={styles.inputSection}>
              {!confirm ? (
                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <View style={styles.countryPicker}>
                      <Text style={styles.flag}>🇮🇳</Text>
                      <Text style={styles.countryCode}>(+91)</Text>
                    </View>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter phone number"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      maxLength={10}
                      placeholderTextColor={Colors.textLight}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter OTP Code"
                      value={code}
                      onChangeText={setCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholderTextColor={Colors.textLight}
                    />
                  </View>
                  <TouchableOpacity style={styles.resendBtn} onPress={() => setConfirm(false)}>
                    <Text style={styles.resendText}>Change Phone Number?</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <PrimaryButton 
              title={!confirm ? "Sign in" : "Verify OTP"}
              onPress={!confirm ? signInWithPhoneNumber : confirmCode}
              loading={loading}
            />
          </View>

          <View style={styles.imageContainer}>
            <Image 
              source={require('../assets/logo.png')} 
              style={styles.loginImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New to FreshRush? </Text>
            <TouchableOpacity onPress={onNavigateToRegister}>
              <Text style={styles.linkText}>Become a Partner</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 40,
  },
  topContainer: {
    marginBottom: 20,
  },
  header: {
    marginBottom: 40,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 60,
    backgroundColor: Colors.white,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  flag: {
    fontSize: 18,
    marginRight: 5,
  },
  countryCode: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  resendBtn: {
    alignItems: 'flex-end',
    marginTop: 10,
  },
  resendText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  linkText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  imageContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  loginImage: {
    width: '100%',
    height: '100%',
  },
});

export default LoginScreen;
