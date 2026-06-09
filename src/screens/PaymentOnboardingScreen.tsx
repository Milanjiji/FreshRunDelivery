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
  ActivityIndicator,
  StatusBar,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Landmark, CreditCard, User, Info, Camera, Trash2 } from 'lucide-react-native';
import axios from 'axios';
import { launchImageLibrary } from 'react-native-image-picker';
import { storage } from '../utils/storage';
import { PageTitle, PageSubtitle } from '../components/Typography';
import { PrimaryButton } from '../components/Button';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';
import { Alertt } from '../components/Alertt';
import { API_BASE_URL } from '../config/api';

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dubgo0vue/image/upload";
const UPLOAD_PRESET = "freshrun_preset";

interface PaymentOnboardingScreenProps {
  onBack: () => void;
  onSuccess: () => void;
  userData: any;
}

const PaymentOnboardingScreen: React.FC<PaymentOnboardingScreenProps> = ({ onBack, onSuccess, userData }) => {
  const [upiId, setUpiId] = useState('');
  const [upiQrImage, setUpiQrImage] = useState<string | null>(null);
  const [qrUploading, setQrUploading] = useState(false);
  const [deliveryPreference, setDeliveryPreference] = useState(userData?.delivery_preference === 'cash_only_while_pending');
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async () => {
    if (!upiId.trim() || !upiQrImage) {
      Alertt.alert('Error', 'Please enter your UPI ID and upload your UPI QR Code image.');
      return;
    }

    if (!upiId.includes('@')) {
      Alertt.alert('Error', 'Please enter a valid UPI ID (e.g. name@okaxis)');
      return;
    }

    setLoading(true);
    try {
      const token = storage.getString('userToken');
      const response = await axios.post(`${API_BASE_URL}/payments/onboard`, {
        role: 'delivery',
        upiId,
        upiQrImage,
        name: userData.full_name,
        email: userData.email,
        phone: userData.phone,
        delivery_preference: deliveryPreference ? 'cash_only_while_pending' : 'wait_for_online'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        Alertt.alert('Success', 'UPI payment details submitted successfully!');
        onSuccess();
      }
    } catch (error: any) {
      console.error('Onboarding Error:', error);
      Alertt.alert('Error', error.response?.data?.error || 'Failed to submit details');
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
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ChevronLeft size={24} color={Colors.primary} strokeWidth={2.5} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <PageTitle>Payment Setup</PageTitle>
            <PageSubtitle>
              Connect your bank account to receive payments for online orders.
            </PageSubtitle>
          </View>

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

            <View style={styles.preferenceCard}>
                <View style={styles.preferenceHeader}>
                    <Info size={20} color={Colors.primary} />
                    <Text style={styles.preferenceTitle}>Work Preference</Text>
                </View>
                <Text style={styles.preferenceDescription}>
                    Do you want to start working with Cash on Delivery orders while Razorpay verifies your bank account?
                </Text>
                <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>
                        {deliveryPreference ? 'Start with COD Only' : 'Wait for Online Payments'}
                    </Text>
                    <Switch
                        value={deliveryPreference}
                        onValueChange={setDeliveryPreference}
                        trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                        thumbColor={deliveryPreference ? Colors.primary : '#f4f3f4'}
                    />
                </View>
            </View>
          </View>

          <PrimaryButton 
            title={loading ? "Submitting..." : "Submit Details"}
            onPress={handleSubmit}
            loading={loading}
          />

          <Text style={styles.note}>
            Note: Verification usually takes 1-2 business days. Settlements will only happen to this verified account.
          </Text>
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
    paddingTop: 40,
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
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  preferenceCard: {
    backgroundColor: Colors.background,
    borderRadius: 15,
    padding: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  preferenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  preferenceTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginLeft: 8,
  },
  preferenceDescription: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
  note: {
    marginTop: 20,
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 18,
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
});

export default PaymentOnboardingScreen;
