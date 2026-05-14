import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { PageTitle, PageSubtitle } from '../components/Typography';
import { Fonts } from '../theme/typography';

interface ApprovalStatusScreenProps {
  status: 'pending' | 'approved' | 'rejected';
  onLogout: () => void;
}

const ApprovalStatusScreen: React.FC<ApprovalStatusScreenProps> = ({ status, onLogout }) => {
  const stages = [
    { title: 'Registration Submitted', description: 'Your documents have been received.', completed: true },
    { title: 'Admin Verification', description: 'Our team is reviewing your Aadhar details.', completed: status === 'approved', active: status === 'pending' },
    { title: 'Final Approval', description: 'Start delivering and earning!', completed: status === 'approved', active: false },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <PageTitle>Application Status</PageTitle>
          <PageSubtitle>
            {status === 'pending' 
              ? "We're reviewing your application." 
              : status === 'rejected' 
              ? "Application was not approved." 
              : "Welcome to the team!"}
          </PageSubtitle>
        </View>

        <View style={styles.stagesContainer}>
          {stages.map((stage, index) => (
            <View key={index} style={styles.stageRow}>
              <View style={styles.indicatorContainer}>
                <View style={[
                  styles.circle, 
                  stage.completed ? styles.completedCircle : stage.active ? styles.activeCircle : styles.inactiveCircle
                ]}>
                  {stage.completed ? (
                    <Text style={styles.checkMark}>✓</Text>
                  ) : (
                    <Text style={[styles.stageNumber, stage.active && styles.activeNumber]}>{index + 1}</Text>
                  )}
                </View>
                {index < stages.length - 1 && (
                  <View style={[styles.line, stage.completed ? styles.completedLine : styles.inactiveLine]} />
                )}
              </View>
              <View style={styles.stageTextContainer}>
                <Text style={[styles.stageTitle, (stage.completed || stage.active) ? styles.activeText : styles.inactiveText]}>
                  {stage.title}
                </Text>
                <Text style={styles.stageDescription}>{stage.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {status === 'rejected' && (
          <View style={styles.rejectedContainer}>
            <Text style={styles.rejectedText}>
              Please contact support if you believe this is a mistake.
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
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
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  completedCircle: {
    backgroundColor: '#60c547',
    borderColor: '#60c547',
  },
  activeCircle: {
    backgroundColor: '#fff',
    borderColor: '#60c547',
  },
  inactiveCircle: {
    backgroundColor: '#fff',
    borderColor: '#E5E5E5',
  },
  checkMark: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  stageNumber: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#E5E5E5',
  },
  activeNumber: {
    color: '#60c547',
  },
  line: {
    width: 2,
    height: 40,
    marginTop: 5,
  },
  completedLine: {
    backgroundColor: '#60c547',
  },
  inactiveLine: {
    backgroundColor: '#E5E5E5',
  },
  stageTextContainer: {
    flex: 1,
    paddingTop: 5,
  },
  stageTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  activeText: {
    color: '#333',
  },
  inactiveText: {
    color: '#999',
  },
  stageDescription: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#999',
  },
  rejectedContainer: {
    padding: 15,
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    marginBottom: 20,
  },
  rejectedText: {
    color: '#D00',
    fontSize: 14,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  footer: {
    paddingBottom: 40,
  },
  logoutBtn: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtnText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#666',
  },
});

export default ApprovalStatusScreen;
