import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
  StatusBar,
  Linking,
} from 'react-native';
import { Alertt } from '../components/Alertt';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ChevronLeft, Trash2, ChevronRight, Landmark, CreditCard, User } from 'lucide-react-native';
import axios from 'axios';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { launchImageLibrary } from 'react-native-image-picker';
import { storage } from '../utils/storage';
import { PageTitle, PageSubtitle } from '../components/Typography';
import { PrimaryButton } from '../components/Button';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';

import { API_BASE_URL } from '../config/api';

const PRIVACY_POLICY_URL = 'https://freshrun-admin.vercel.app/privacy';
const BACKEND_URL = API_BASE_URL;
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dubgo0vue/image/upload";
const UPLOAD_PRESET = "freshrun_preset";

interface RegistrationScreenProps {
  onBack: () => void;
  onRegisterSuccess: (token: string, user: any) => void;
  isUpdate?: boolean;
}

const RegistrationScreen: React.FC<RegistrationScreenProps> = ({ onBack, onRegisterSuccess, isUpdate = false }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // --- Step 1: Personal Details ---
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const currentUser = auth().currentUser;
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.phoneNumber?.replace('+91', '') || '');
  const [aadharNumber, setAadharNumber] = useState('');
  const [aadharImage, setAadharImage] = useState<string | null>(null);

  // --- Step 2: UPI Details ---
  const [upiId, setUpiId] = useState('');
  const [upiQrImage, setUpiQrImage] = useState<string | null>(null);
  const [qrUploading, setQrUploading] = useState(false);

  // --- Step 3: OTP Verification ---
  const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [otpCode, setOtpCode] = useState('');

  const handleSelectImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
    });
    if (result.assets && result.assets[0].uri) {
      uploadToCloudinary(result.assets[0]);
    }
  };

  const uploadToCloudinary = async (asset: any) => {
    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'upload.jpg',
      } as any);
      data.append('upload_preset', UPLOAD_PRESET);

      console.log('Uploading image to Cloudinary:', CLOUDINARY_URL);
      const response = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: data,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Cloudinary status: ${response.status} - ${errText}`);
      }

      const resData = await response.json();

      if (resData.secure_url) {
        setAadharImage(resData.secure_url);
      }
    } catch (error: any) {
      console.error('[CloudinaryUpload] error:', error.message || error);
      Alertt.alert('Upload Failed', 'Could not upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectQrImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
    });
    if (result.assets && result.assets[0].uri) {
      uploadQrToCloudinary(result.assets[0]);
    }
  };

  const uploadQrToCloudinary = async (asset: any) => {
    setQrUploading(true);
    try {
      const data = new FormData();
      data.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'upload.jpg',
      } as any);
      data.append('upload_preset', UPLOAD_PRESET);

      console.log('Uploading QR code to Cloudinary:', CLOUDINARY_URL);
      const response = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: data,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Cloudinary status: ${response.status} - ${errText}`);
      }

      const resData = await response.json();

      if (resData.secure_url) {
        setUpiQrImage(resData.secure_url);
      }
    } catch (error: any) {
      console.error('[CloudinaryUpload QR] error:', error.message || error);
      Alertt.alert('Upload Failed', 'Could not upload image. Please try again.');
    } finally {
      setQrUploading(false);
    }
  };

  const handleNextStep1 = async () => {
    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !aadharNumber.trim() || !aadharImage) {
      Alertt.alert('Error', 'Please fill in all fields and upload your Aadhar Card');
      return;
    }
    if (phoneNumber.length !== 10) {
      Alertt.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }
    if (aadharNumber.length !== 12) {
      Alertt.alert('Error', 'Aadhar Number must be 12 digits');
      return;
    }

    const sanitizedPhone = phoneNumber.replace(/\D/g, '');
    setLoading(true);
    try {
      if (!isUpdate) {
        const checkRes = await axios.get(`${BACKEND_URL}/auth/check-partner/${sanitizedPhone}`);
        if (checkRes.data.success && checkRes.data.exists) {
          setLoading(false);
          Alertt.alert(
            'Account Exists',
            'You already have a delivery partner account with this phone number. Please log in instead.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Go to Login', onPress: onBack }
            ]
          );
          return;
        }
      }


      setStep(2);
    } catch (error: any) {
      console.error('Step 1 Verification Error:', error);
      Alertt.alert('Error', 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep2 = async () => {
    if (!upiId.trim() || !upiQrImage) {
      Alertt.alert('Error', 'Please enter your UPI ID and upload your UPI QR Code image');
      return;
    }
    if (!upiId.includes('@')) {
      Alertt.alert('Error', 'Please enter a valid UPI ID (e.g. name@okaxis)');
      return;
    }

    if (isUpdate && currentUser) {
      setLoading(true);
      try {
        console.log('Skipping OTP as user is already authenticated (isUpdate mode)');
        const idToken = await currentUser.getIdToken();
        await completeRegistrationFlow(idToken);
      } catch (error: any) {
        console.error('Update Profile Direct Error:', error);
        Alertt.alert('Update Failed', error.message || 'Action failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    const sanitizedPhone = phoneNumber.replace(/\D/g, '');
    const formattedPhone = `+91${sanitizedPhone}`;
    setLoading(true);
    try {
      console.log('Sending OTP for registration:', formattedPhone);
      const confirmation = await auth().signInWithPhoneNumber(formattedPhone);
      setConfirm(confirmation);
      setStep(3);
    } catch (error: any) {
      console.error('Send OTP Error:', error);
      Alertt.alert('Error', error.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const completeRegistrationFlow = async (idToken: string) => {
    const payload = {
      idToken,
      fullName,
      email,
      aadharNumber,
      aadharImage,
    };

    const response = await axios.post(`${BACKEND_URL}/auth/register`, payload);
    if (response.data.success) {
      const { user } = response.data;
      
      console.log('User registered on backend. Initiating UPI onboarding payload...');
      const onboardPayload = {
        role: 'delivery',
        upiId,
        upiQrImage,
        name: fullName,
        email,
        phone: phoneNumber
      };

      const onboardResponse = await axios.post(
        `${BACKEND_URL}/payments/onboard`,
        onboardPayload,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );

      if (onboardResponse.data.success) {
        storage.setItem('userToken', idToken);
        storage.setItem('userData', { ...user, razorpay_kyc_status: 'created' });
        onRegisterSuccess(idToken, { ...user, razorpay_kyc_status: 'created' });
      } else {
        throw new Error(onboardResponse.data.error || 'UPI onboarding setup failed.');
      }
    } else {
      throw new Error(response.data.error || 'Registration failed');
    }
  };

  const confirmRegistrationCode = async () => {
    if (!otpCode || otpCode.length < 6) {
      Alertt.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      if (!confirm) return;
      
      console.log('Verifying registration code...');
      const credential = await confirm.confirm(otpCode);
      
      if (credential?.user) {
        const idToken = await credential.user.getIdToken();
        console.log('Firebase verified. Proceeding to submit registration...');
        await completeRegistrationFlow(idToken);
      }
    } catch (error: any) {
      console.error('Registration Verification Error:', error);
      const message = error?.response?.data?.error || error.message || 'Verification failed';
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
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {step === 1 ? (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <ChevronLeft size={24} color={Colors.primary} strokeWidth={2.5} />
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => setStep(step - 1)} style={styles.backButton}>
              <ChevronLeft size={24} color={Colors.primary} strokeWidth={2.5} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}

          {/* Stepper Progress */}
          <View style={styles.stepperContainer}>
            <Text style={styles.stepperText}>Step {step} of 3</Text>
            <View style={styles.stepperBarBg}>
              <View style={[styles.stepperBarFill, { width: `${(step / 3) * 100}%` }]} />
            </View>
          </View>

          <View style={styles.header}>
            <PageTitle>{isUpdate ? 'Complete Profile' : 'Join the Team'}</PageTitle>
            <PageSubtitle>
              {step === 1 
                ? 'Provide your personal details for registration.' 
                : step === 2 
                ? 'Add bank details to receive split payouts.'
                : 'Confirm your phone number to complete onboarding.'}
            </PageSubtitle>
          </View>

          {step === 1 && (
            <View style={styles.inputSection}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your full name"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.phoneInputWrapper}>
                  <Text style={styles.countryCode}>+91</Text>
                  <TextInput
                    style={[styles.phoneInput, isUpdate && { color: Colors.textLight }]}
                    placeholder="Enter phone number"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholderTextColor={Colors.textLight}
                    editable={!isUpdate}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Aadhar Number</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="12-digit Aadhar Number"
                  value={aadharNumber}
                  onChangeText={setAadharNumber}
                  keyboardType="number-pad"
                  maxLength={12}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Aadhar Card Photo</Text>
                {aadharImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: aadharImage }} style={styles.imagePreview} />
                    <TouchableOpacity 
                      style={styles.removeImageBtn}
                      onPress={() => setAadharImage(null)}
                    >
                      <Trash2 size={16} color="#fff" />
                      <Text style={styles.removeImageText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.uploadButton} 
                    onPress={handleSelectImage}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <>
                        <Camera size={28} color={Colors.textLight} style={{ marginBottom: 8 }} />
                        <Text style={styles.uploadText}>Upload Aadhar Image</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity 
                style={[styles.nextButton, loading && styles.disabledButton]} 
                onPress={handleNextStep1}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>Next: Bank Onboarding</Text>
                    <ChevronRight size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.inputSection}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>UPI ID</Text>
                <View style={styles.inputWrapper}>
                  <User size={20} color={Colors.textLight} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter UPI ID (e.g. name@okicici)"
                    value={upiId}
                    onChangeText={setUpiId}
                    autoCapitalize="none"
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>UPI QR Code Image</Text>
                {upiQrImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: upiQrImage }} style={styles.imagePreview} />
                    <TouchableOpacity 
                      style={styles.removeImageBtn} 
                      onPress={() => setUpiQrImage(null)}
                    >
                      <Trash2 size={16} color="#fff" />
                      <Text style={styles.removeImageText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.uploadButton} 
                    onPress={handleSelectQrImage}
                    disabled={qrUploading}
                  >
                    {qrUploading ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <>
                        <Camera size={24} color={Colors.primary} style={{ marginBottom: 8 }} />
                        <Text style={styles.uploadText}>Upload UPI QR Code Image</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity 
                style={[styles.nextButton, loading && styles.disabledButton]} 
                onPress={handleNextStep2}
                disabled={loading || qrUploading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>{isUpdate ? "Complete Registration" : "Next: Verify Phone"}</Text>
                    <ChevronRight size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.otpContainer}>
              <Text style={styles.otpLabel}>Verify your Phone Number</Text>
              <Text style={styles.otpSubtitle}>Enter the 6-digit code sent to +91 {phoneNumber}</Text>
              
              <View style={styles.otpInputWrapper}>
                <TextInput
                  style={styles.otpInput}
                  placeholder="000000"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholderTextColor={Colors.textLight}
                />
              </View>

              <PrimaryButton 
                title={loading ? "Verifying..." : "Complete Registration"}
                onPress={confirmRegistrationCode}
                loading={loading}
              />

              <TouchableOpacity 
                style={styles.resendBtn} 
                onPress={() => setStep(2)}
                disabled={loading}
              >
                <Text style={styles.resendText}>Edit details?</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>By joining, you agree to our </Text>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
              <Text style={styles.linkText}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.footerText}> & </Text>
            <TouchableOpacity>
              <Text style={styles.linkText}>Terms</Text>
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
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginLeft: -5,
  },
  backText: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.primary,
    marginLeft: 4,
  },
  stepperContainer: {
    marginBottom: 20,
  },
  stepperText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  stepperBarBg: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  stepperBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  header: {
    marginBottom: 30,
  },
  inputSection: {
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 56,
    backgroundColor: Colors.white,
  },
  inputIcon: {
    marginRight: 12,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 56,
    backgroundColor: Colors.white,
  },
  countryCode: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.text,
    marginRight: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingRight: 10,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  uploadButton: {
    height: 120,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  uploadText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.textLight,
  },
  imagePreviewContainer: {
    width: '100%',
    height: 200,
    borderRadius: 15,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginLeft: 6,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 6,
  },
  disabledButton: {
    opacity: 0.7,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  footer: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textLight,
  },
  linkText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  otpContainer: {
    marginBottom: 30,
  },
  otpLabel: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  otpSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginBottom: 30,
    textAlign: 'center',
  },
  otpInputWrapper: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    height: 60,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  otpInput: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.text,
    letterSpacing: 8,
    textAlign: 'center',
    width: '100%',
  },
  resendBtn: {
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.primary,
  },
});

export default RegistrationScreen;
