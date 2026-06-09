import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  LogOut, 
  RefreshCcw,
  ChevronLeft,
  AlertTriangle,
  XCircle
} from 'lucide-react-native';
import { PageTitle, PageSubtitle } from '../components/Typography';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';
import { storage } from '../utils/storage';

import { API_BASE_URL } from '../config/api';

const BACKEND_URL = API_BASE_URL;
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds for fast updates

interface ApprovalStatusScreenProps {
  status: 'pending' | 'approved' | 'rejected';
  userData: any;
  onApproved: () => void;
  onLogout: () => void;
  onCompleteProfile: () => void;
}

const ApprovalStatusScreen: React.FC<ApprovalStatusScreenProps> = ({ 
  status: initialStatus, 
  userData,
  onApproved, 
  onLogout,
  onCompleteProfile
}) => {
  const [currentStatus, setCurrentStatus] = useState<'pending' | 'approved' | 'rejected'>(initialStatus);
  const [razorpayStatus, setRazorpayStatus] = useState<string>(userData?.razorpay_kyc_status || 'created');
  const [razorpayRejectionReason, setRazorpayRejectionReason] = useState<string | null>(userData?.razorpay_rejection_reason || null);
  const [adminRejectionReason, setAdminRejectionReason] = useState<string | null>(userData?.rejection_reason || null);
  const [isProfileComplete, setIsProfileComplete] = useState(userData?.isProfileComplete);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkApprovalStatus = useCallback(async () => {
    const token = storage.getString('userToken');
    if (!token) return;

    setIsChecking(true);
    try {
      const response = await fetch(`${BACKEND_URL}/user/profile`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.success && data.user) {
        const newStatus = data.user.approvalStatus;
        const newProfileComplete = data.user.isProfileComplete;
        const newRazorpayStatus = data.user.razorpay_kyc_status || 'created';
        const newRazorpayRejectionReason = data.user.razorpay_rejection_reason || null;
        const newAdminRejectionReason = data.user.rejection_reason || null;
        
        setLastChecked(new Date());

        // Update states if changed
        if (
          newStatus !== currentStatus || 
          newProfileComplete !== isProfileComplete || 
          newRazorpayStatus !== razorpayStatus ||
          newRazorpayRejectionReason !== razorpayRejectionReason ||
          newAdminRejectionReason !== adminRejectionReason
        ) {
          setCurrentStatus(newStatus);
          setIsProfileComplete(newProfileComplete);
          setRazorpayStatus(newRazorpayStatus);
          setRazorpayRejectionReason(newRazorpayRejectionReason);
          setAdminRejectionReason(newAdminRejectionReason);
          
          const existingData = storage.getObject<any>('userData') || {};
          storage.setItem('userData', { 
            ...existingData, 
            approvalStatus: newStatus, 
            isProfileComplete: newProfileComplete,
            razorpay_kyc_status: newRazorpayStatus,
            razorpay_rejection_reason: newRazorpayRejectionReason,
            rejection_reason: newAdminRejectionReason
          });

          // Enforce: Both Admin must approve AND Razorpay KYC must be approved (activated)
          if (newStatus === 'approved' && newRazorpayStatus === 'activated') {
            if (intervalRef.current) clearInterval(intervalRef.current);
            onApproved();
          }
        }
      }
    } catch (err) {
      console.log('[ApprovalPoll] Network error, will retry:', err);
    } finally {
      setIsChecking(false);
    }
  }, [currentStatus, isProfileComplete, razorpayStatus, razorpayRejectionReason, adminRejectionReason, onApproved]);

  useEffect(() => {
    checkApprovalStatus();
    intervalRef.current = setInterval(checkApprovalStatus, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkApprovalStatus]);

  const hasIssues = currentStatus === 'rejected' || 
                    razorpayStatus === 'needs_clarification' || 
                    razorpayStatus === 'rejected' || 
                    razorpayStatus === 'suspended';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onLogout}>
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2.5} />
          </TouchableOpacity>
          <PageTitle style={styles.title}>Verification Status</PageTitle>
          <PageSubtitle style={styles.subtitle}>
            {currentStatus === 'approved' && razorpayStatus === 'activated'
              ? 'Welcome to the team! All verifications complete.'
              : hasIssues
              ? 'Action Required: Verification details need correction.'
              : "We're reviewing your credentials. Usually takes 1-2 business days."}
          </PageSubtitle>

          <View style={styles.pollingBadge}>
            {isChecking ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 6 }} />
            ) : (
              <RefreshCcw size={12} color={Colors.primary} style={{ marginRight: 6 }} />
            )}
            <Text style={styles.pollingText}>
              {isChecking
                ? 'Checking status...'
                : lastChecked
                ? `Last checked: ${lastChecked.toLocaleTimeString()}`
                : 'Live Status Active'}
            </Text>
          </View>
        </View>

        {/* Action Panel for Rejection or Clarification */}
        {hasIssues && (
          <View style={styles.issueBox}>
            <View style={styles.issueHeader}>
              <AlertTriangle size={20} color={Colors.error} />
              <Text style={styles.issueTitle}>Action Required</Text>
            </View>
            <Text style={styles.issueDescription}>
              Please review the rejection details below and update your registration profile or bank details to resubmit.
            </Text>
            <TouchableOpacity 
              style={styles.completeBtn} 
              onPress={onCompleteProfile}
            >
              <Text style={styles.completeBtnText}>Update Profile & Bank details</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.stagesContainer}>
          {/* Track 1: Admin Approval */}
          <View style={styles.stageRow}>
            <View style={styles.indicatorContainer}>
              <View
                style={[
                  styles.circle,
                  currentStatus === 'approved'
                    ? styles.completedCircle
                    : currentStatus === 'rejected'
                    ? styles.rejectedCircle
                    : styles.activeCircle,
                ]}
              >
                {currentStatus === 'approved' ? (
                  <CheckCircle2 size={24} color="#fff" />
                ) : currentStatus === 'rejected' ? (
                  <XCircle size={24} color="#fff" />
                ) : (
                  <Clock size={20} color={Colors.primary} strokeWidth={2.5} />
                )}
              </View>
              <View style={[styles.line, currentStatus === 'approved' ? styles.completedLine : styles.inactiveLine]} />
            </View>
            <View style={styles.stageTextContainer}>
              <Text style={[styles.stageTitle, currentStatus === 'approved' ? styles.activeText : styles.pendingText]}>
                Admin Verification
              </Text>
              <Text style={styles.stageDescription}>
                {currentStatus === 'approved'
                  ? 'Aadhar card and profile details approved by admin.'
                  : currentStatus === 'rejected'
                  ? `Rejected: ${adminRejectionReason || 'Documents or profile details were invalid.'}`
                  : 'Admin is verifying your Aadhar card and profile details.'}
              </Text>
            </View>
          </View>

          {/* Track 2: Razorpay KYC */}
          <View style={styles.stageRow}>
            <View style={styles.indicatorContainer}>
              <View
                style={[
                  styles.circle,
                  razorpayStatus === 'activated'
                    ? styles.completedCircle
                    : (razorpayStatus === 'needs_clarification' || razorpayStatus === 'rejected' || razorpayStatus === 'suspended')
                    ? styles.rejectedCircle
                    : styles.activeCircle,
                ]}
              >
                {razorpayStatus === 'activated' ? (
                  <CheckCircle2 size={24} color="#fff" />
                ) : (razorpayStatus === 'needs_clarification' || razorpayStatus === 'rejected' || razorpayStatus === 'suspended') ? (
                  <XCircle size={24} color="#fff" />
                ) : (
                  <Clock size={20} color={Colors.primary} strokeWidth={2.5} />
                )}
              </View>
            </View>
            <View style={styles.stageTextContainer}>
              <Text style={[styles.stageTitle, razorpayStatus === 'activated' ? styles.activeText : styles.pendingText]}>
                Razorpay KYC & Settlements
              </Text>
              <Text style={styles.stageDescription}>
                {razorpayStatus === 'activated'
                  ? 'Bank account and PAN details verified successfully.'
                  : razorpayStatus === 'needs_clarification'
                  ? `Clarification Needed: ${razorpayRejectionReason || 'Please check your bank details.'}`
                  : (razorpayStatus === 'rejected' || razorpayStatus === 'suspended')
                  ? `Rejected: ${razorpayRejectionReason || 'Bank or PAN verification failed.'}`
                  : 'Razorpay is verifying your bank account and PAN credentials.'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <LogOut size={20} color={Colors.textSecondary} style={{ marginRight: 10 }} />
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    paddingHorizontal: 25,
  },
  header: {
    marginTop: 20,
    marginBottom: 30,
  },
  backBtn: {
    marginBottom: 15,
    marginLeft: -10,
    padding: 10,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.black,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  pollingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pollingText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  stagesContainer: {
    flex: 1,
    marginTop: 20,
  },
  stageRow: {
    flexDirection: 'row',
    marginBottom: 40,
  },
  indicatorContainer: {
    alignItems: 'center',
    marginRight: 20,
    width: 40,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  completedCircle: {
    backgroundColor: '#10B981', // Emerald green
    borderColor: '#10B981',
  },
  rejectedCircle: {
    backgroundColor: '#EF4444', // Red error
    borderColor: '#EF4444',
  },
  activeCircle: {
    backgroundColor: Colors.white,
    borderColor: Colors.primary,
  },
  line: {
    width: 2,
    height: 70,
    marginTop: 5,
  },
  completedLine: {
    backgroundColor: '#10B981',
  },
  inactiveLine: {
    backgroundColor: Colors.border,
  },
  stageTextContainer: {
    flex: 1,
    paddingTop: 8,
  },
  stageTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    marginBottom: 6,
  },
  activeText: {
    color: '#10B981',
  },
  pendingText: {
    color: Colors.text,
  },
  stageDescription: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  issueBox: {
    backgroundColor: '#FFF5F5',
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  issueTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#EF4444',
    marginLeft: 8,
  },
  issueDescription: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  completeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  footer: {
    paddingBottom: 40,
  },
  logoutBtn: {
    height: 56,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  logoutBtnText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
  },
});

export default ApprovalStatusScreen;
