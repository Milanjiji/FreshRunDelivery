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
import { ChevronLeft, Landmark, CreditCard, User, Info } from 'lucide-react-native';
import axios from 'axios';
import { storage } from '../utils/storage';
import { PageTitle, PageSubtitle } from '../components/Typography';
import { PrimaryButton } from '../components/Button';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';
import { Alertt } from '../components/Alertt';
import { API_BASE_URL } from '../config/api';

interface PaymentOnboardingScreenProps {
  onBack: () => void;
  onSuccess: () => void;
  userData: any;
}

const PaymentOnboardingScreen: React.FC<PaymentOnboardingScreenProps> = ({ onBack, onSuccess, userData }) => {
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [deliveryPreference, setDeliveryPreference] = useState(userData?.delivery_preference === 'cash_only_while_pending');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!accountNumber || !ifscCode || !panNumber) {
      Alertt.alert('Error', 'Please fill in all bank and PAN details');
      return;
    }

    if (accountNumber !== confirmAccountNumber) {
      Alertt.alert('Error', 'Account numbers do not match');
      return;
    }

    if (ifscCode.length !== 11) {
      Alertt.alert('Error', 'Invalid IFSC Code');
      return;
    }

    if (panNumber.length !== 10) {
      Alertt.alert('Error', 'Invalid PAN Number');
      return;
    }

    setLoading(true);
    try {
      const token = storage.getString('userToken');
      const response = await axios.post(`${API_BASE_URL}/payments/onboard`, {
        role: 'delivery',
        bankDetails: {
          accountNumber,
          ifscCode,
        },
        pan: panNumber,
        name: userData.full_name,
        email: userData.email,
        phone: userData.phone,
        delivery_preference: deliveryPreference ? 'cash_only_while_pending' : 'wait_for_online'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        Alertt.alert('Success', 'Payment details submitted! Razorpay will now verify your account.');
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
              <Text style={styles.label}>Bank Account Number</Text>
              <View style={styles.inputWrapper}>
                <Landmark size={20} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter account number"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Account Number</Text>
              <View style={styles.inputWrapper}>
                <Landmark size={20} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Re-enter account number"
                  value={confirmAccountNumber}
                  onChangeText={setConfirmAccountNumber}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>IFSC Code</Text>
              <View style={styles.inputWrapper}>
                <CreditCard size={20} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. SBIN0001234"
                  value={ifscCode}
                  onChangeText={text => setIfscCode(text.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={11}
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>PAN Number</Text>
              <View style={styles.inputWrapper}>
                <User size={20} color={Colors.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="10-digit PAN Number"
                  value={panNumber}
                  onChangeText={text => setPanNumber(text.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={10}
                  placeholderTextColor={Colors.textLight}
                />
              </View>
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
});

export default PaymentOnboardingScreen;
