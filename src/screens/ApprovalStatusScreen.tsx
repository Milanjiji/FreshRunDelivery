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
  ChevronLeft
} from 'lucide-react-native';
import { PageTitle, PageSubtitle } from '../components/Typography';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';
import { storage } from '../utils/storage';

import { API_BASE_URL } from '../config/api';

const BACKEND_URL = API_BASE_URL;
const POLL_INTERVAL_MS = 10000; // 10 seconds

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
        setLastChecked(new Date());

        if (newStatus !== currentStatus || newProfileComplete !== isProfileComplete) {
          setCurrentStatus(newStatus);
          setIsProfileComplete(newProfileComplete);
          const existingData = storage.getObject<any>('userData') || {};
          storage.setItem('userData', { ...existingData, approvalStatus: newStatus, isProfileComplete: newProfileComplete });

          if (newStatus === 'approved') {
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
  }, [currentStatus, isProfileComplete, onApproved]);

  useEffect(() => {
    checkApprovalStatus();
    intervalRef.current = setInterval(checkApprovalStatus, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkApprovalStatus]);

  const stages = [
    {
      title: 'Registration Submitted',
      description: isProfileComplete 
        ? 'Your documents have been received.' 
        : 'Please complete your registration.',
      completed: isProfileComplete,
      active: !isProfileComplete,
    },
    {
      title: 'Admin Verification',
      description: 'Our team is reviewing your Aadhar details.',
      completed: currentStatus === 'approved',
      active: isProfileComplete && currentStatus === 'pending',
    },
    {
      title: 'Final Approval',
      description: 'Start delivering and earning!',
      completed: currentStatus === 'approved',
      active: false,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onLogout}>
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2.5} />
          </TouchableOpacity>
          <PageTitle style={styles.title}>Application Status</PageTitle>
          <PageSubtitle style={styles.subtitle}>
            {currentStatus === 'pending'
              ? "We're reviewing your application."
              : currentStatus === 'rejected'
              ? 'Application was not approved.'
              : 'Welcome to the team!'}
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
                : 'Live Tracking Active'}
            </Text>
          </View>
        </View>

        {!isProfileComplete && currentStatus === 'pending' && (
          <View style={styles.incompleteBox}>
            <View style={styles.incompleteHeader}>
              <AlertCircle size={20} color={Colors.primary} />
              <Text style={styles.incompleteTitle}>Action Required</Text>
            </View>
            <Text style={styles.incompleteDescription}>
              Your registration is incomplete. Please provide your details and documents to proceed with the approval process.
            </Text>
            <TouchableOpacity 
              style={styles.completeBtn} 
              onPress={onCompleteProfile}
            >
              <Text style={styles.completeBtnText}>Complete Registration</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.stagesContainer}>
          {stages.map((stage, index) => (
            <View key={index} style={styles.stageRow}>
              <View style={styles.indicatorContainer}>
                <View
                  style={[
                    styles.circle,
                    stage.completed
                      ? styles.completedCircle
                      : stage.active
                      ? styles.activeCircle
                      : styles.inactiveCircle,
                  ]}
                >
                  {stage.completed ? (
                    <CheckCircle2 size={24} color="#fff" />
                  ) : stage.active ? (
                    <Clock size={20} color={Colors.primary} strokeWidth={2.5} />
                  ) : (
                    <Text style={styles.stageNumber}>{index + 1}</Text>
                  )}
                </View>
                {index < stages.length - 1 && (
                  <View
                    style={[
                      styles.line,
                      stage.completed ? styles.completedLine : styles.inactiveLine,
                    ]}
                  />
                )}
              </View>
              <View style={styles.stageTextContainer}>
                <Text
                  style={[
                    styles.stageTitle,
                    stage.completed || stage.active ? styles.activeText : styles.inactiveText,
                  ]}
                >
                  {stage.title}
                </Text>
                <Text style={styles.stageDescription}>{stage.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {currentStatus === 'rejected' && (
          <View style={styles.rejectedContainer}>
            <AlertCircle size={20} color={Colors.error} style={{ marginBottom: 8 }} />
            <Text style={styles.rejectedText}>
              Please contact support if you believe this is a mistake.
            </Text>
          </View>
        )}

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
    marginBottom: 40,
  },
  backBtn: {
    marginBottom: 20,
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
  },
  stageRow: {
    flexDirection: 'row',
    marginBottom: 30,
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
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  activeCircle: {
    backgroundColor: Colors.white,
    borderColor: Colors.primary,
  },
  inactiveCircle: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
  },
  stageNumber: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.border,
  },
  line: {
    width: 2,
    height: 40,
    marginTop: 5,
  },
  completedLine: {
    backgroundColor: Colors.primary,
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
    marginBottom: 4,
  },
  activeText: {
    color: Colors.text,
  },
  inactiveText: {
    color: Colors.textLight,
  },
  stageDescription: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  incompleteBox: {
    backgroundColor: '#F0F7FF',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#D0E7FF',
  },
  incompleteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  incompleteTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginLeft: 8,
  },
  incompleteDescription: {
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
  rejectedContainer: {
    padding: 20,
    backgroundColor: '#FFF0F0',
    borderRadius: 15,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFDEDE',
  },
  rejectedText: {
    color: Colors.error,
    fontSize: 14,
    fontFamily: Fonts.medium,
    textAlign: 'center',
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
