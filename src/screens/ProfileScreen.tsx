import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Image,
  Linking,
} from 'react-native';
import { Alertt } from '../components/Alertt';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  MoreHorizontal, 
  User, 
  Phone, 
  Mail, 
  CreditCard, 
  Package, 
  Star, 
  Wallet, 
  LifeBuoy, 
  History, 
  BarChart3, 
  Bell, 
  ShieldCheck, 
  LogOut,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  FileText,
  Truck
} from 'lucide-react-native';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';
import { API_BASE_URL } from '../config/api';
import { storage } from '../utils/storage';

const PRIVACY_POLICY_URL = 'https://freshrun-admin.vercel.app/privacy';

const ProfileScreen: React.FC<ProfileScreenProps> = ({ userData, onBack, onLogout, onInfoPress, onMyDeliveriesPress }) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [aadharExpanded, setAadharExpanded] = useState(false);

  const handleDeleteAccount = () => {
    setMenuVisible(false);
    Alertt.alert(
      'Delete Account',
      'Are you absolutely sure you want to delete your account? This action cannot be undone and all your data will be permanently erased.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const token = storage.getString('userToken');
              const response = await fetch(`${API_BASE_URL}/user/account`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ role: 'delivery' }),
              });
              const data = await response.json();
              if (data.success) {
                onLogout();
              } else {
                Alertt.alert('Error', data.error || 'Failed to delete account');
              }
            } catch (error) {
              console.error('Delete account error:', error);
              Alertt.alert('Error', 'Something went wrong. Please try again later.');
            }
          }
        }
      ]
    );
  };

  const fullName = userData?.fullName || userData?.full_name || 'Partner';
  
  const phone = userData?.phone
    ? userData.phone.startsWith('+')
      ? userData.phone
      : `+91 ${userData.phone}`
    : '—';

  const approvalStatus = userData?.approvalStatus || 'approved';

  const infoRows = [
    { id: '1', label: 'Full Name', value: fullName, icon: <User size={20} color="#333" /> },
    { id: '2', label: 'Phone Number', value: phone, icon: <Phone size={20} color="#333" /> },
    { id: '3', label: 'Email Address', value: userData?.email || '—', icon: <Mail size={20} color="#333" /> },
    { id: '4', label: 'Aadhar Number', value: userData?.aadharNumber || '—', icon: <CreditCard size={20} color="#333" /> },
  ];

  const quickLinks = [
    { id: 'q1', icon: <Package size={24} color="#333" />, label: 'My\nDeliveries', onPress: onMyDeliveriesPress },
    { id: 'q2', icon: <Star size={24} color="#333" />, label: 'Ratings' },
    { id: 'q3', icon: <Wallet size={24} color="#333" />, label: 'Earnings' },
    { id: 'q4', icon: <LifeBuoy size={24} color="#333" />, label: 'Support' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── HEADER ──────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ChevronLeft size={24} color="#333" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.helpButton}>
            <Text style={styles.helpText}>Help</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
            <MoreHorizontal size={22} color="#333" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── DROPDOWN MENU ──────────────────────────────────── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.menuDropdown}>
              <TouchableOpacity style={styles.menuOption}>
                <Text style={styles.menuOptionText}>Edit Profile</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => {
                  setMenuVisible(false);
                  Alertt.alert('Logout', 'Are you sure you want to logout?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Logout', style: 'destructive', onPress: onLogout },
                  ]);
                }}
              >
                <Text style={styles.menuOptionText}>Logout</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity
                style={styles.menuOption}
                onPress={handleDeleteAccount}
              >
                <Text style={[styles.menuOptionText, { color: Colors.error }]}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── HERO SECTION ─────────────────────────── */}
        <View style={styles.heroSection}>
          <Text style={styles.heroName}>{fullName}</Text>
          <Text style={styles.heroDetailText}>{phone}</Text>
          <Text style={styles.heroDetailText}>{userData?.email || 'email@example.com'}</Text>

          {/* Approval Status Badge */}
          <View style={[
            styles.statusBadge,
            approvalStatus === 'approved' ? styles.statusApproved :
            approvalStatus === 'pending' ? styles.statusPending :
            styles.statusRejected
          ]}>
            <Text style={[
              styles.statusBadgeText,
              approvalStatus === 'approved' ? styles.statusApprovedText :
              approvalStatus === 'pending' ? styles.statusPendingText :
              styles.statusRejectedText
            ]}>
              {approvalStatus === 'approved' ? '✓ Active Partner' :
               approvalStatus === 'pending' ? '⏳ Pending Approval' :
               '✗ Not Approved'}
            </Text>
          </View>
        </View>

        {/* ── QUICK LINKS ─────────────────────────────────── */}
        <View style={styles.quickLinksRow}>
          {quickLinks.map(item => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.quickLinkCard}
              onPress={(item as any).onPress}
            >
              <View style={styles.quickLinkIconWrap}>
                {item.icon}
              </View>
              <Text style={styles.quickLinkLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── PARTNER INFO CARD ───────────────────────────── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>PARTNER DETAILS</Text>
        </View>

        <View style={styles.infoCard}>
          {infoRows.map((row, i) => (
            <View key={row.label}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  {row.icon}
                </View>
                <View style={styles.infoTextBlock}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {row.label === 'Aadhar Number' && row.value !== '—'
                      ? `XXXX XXXX ${row.value.slice(-4)}`
                      : row.value}
                  </Text>
                </View>
              </View>
              {i < infoRows.length - 1 && <View style={styles.infoDivider} />}
            </View>
          ))}
        </View>

        {/* ── AADHAR CARD IMAGE ───────────────────────────── */}
        {userData?.aadharImage && (
          <>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionLabelText}>AADHAR CARD</Text>
              <TouchableOpacity 
                style={styles.expandToggle}
                onPress={() => setAadharExpanded(!aadharExpanded)}
              >
                {aadharExpanded ? (
                  <EyeOff size={16} color={Colors.primary} style={{ marginRight: 4 }} />
                ) : (
                  <Eye size={16} color={Colors.primary} style={{ marginRight: 4 }} />
                )}
                <Text style={styles.sectionAction}>{aadharExpanded ? 'Hide' : 'View'}</Text>
              </TouchableOpacity>
            </View>

            {aadharExpanded && (
              <View style={styles.aadharImageCard}>
                <Image
                  source={{ uri: userData.aadharImage }}
                  style={styles.aadharImage}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  style={styles.openFullBtn}
                  onPress={() => Linking.openURL(userData.aadharImage)}
                >
                  <ExternalLink size={14} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.openFullBtnText}>Open Full Size</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ── MENU ITEMS ──────────────────────────────────── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>ACCOUNT</Text>
        </View>

        <View style={styles.menuCard}>
          {[
            { id: 'about', icon: <Info size={20} color="#333" />, label: 'About FreshRun' },
            { id: 'privacy', icon: <ShieldCheck size={20} color="#333" />, label: 'Privacy Policy' },
            { id: 'terms', icon: <FileText size={20} color="#333" />, label: 'Terms & Conditions' },
            { id: 'refund', icon: <History size={20} color="#333" />, label: 'Refund Policy' },
            { id: 'shipping', icon: <Truck size={20} color="#333" />, label: 'Shipping Policy' },
            { id: 'contact', icon: <Mail size={20} color="#333" />, label: 'Contact Us' },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, i === arr.length - 1 && styles.menuItemLast]}
              onPress={() => onInfoPress(item.id as any)}
            >
              <View style={styles.menuItemLeft}>
                <View style={{ marginRight: 15 }}>{item.icon}</View>
                <Text style={styles.menuItemLabel}>{item.label}</Text>
              </View>
              <ChevronLeft size={18} color="#999" style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── LOGOUT ──────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() =>
            Alertt.alert('Logout', 'Are you sure you want to logout?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: onLogout },
            ])
          }
        >
          <LogOut size={20} color={Colors.error} style={{ marginRight: 10 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>FreshRun Delivery Partner v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

interface ProfileScreenProps {
  userData: any;
  onBack: () => void;
  onLogout: () => void;
  onInfoPress: (type: 'about' | 'privacy' | 'terms' | 'refund' | 'shipping' | 'contact') => void;
  onMyDeliveriesPress?: () => void;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 5,
  },
  helpButton: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  helpText: {
    color: Colors.secondary,
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  menuBtn: {
    padding: 5,
  },

  scrollContent: { paddingBottom: 40 },

  // Hero
  heroSection: {
    paddingHorizontal: 25,
    paddingVertical: 20,
  },
  heroName: {
    fontSize: 28,
    fontFamily: Fonts.black,
    fontWeight: '900',
    color: '#1a1a1a',
    marginBottom: 5,
  },
  heroDetailText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#666',
    marginTop: 2,
  },

  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 12,
  },
  statusApproved: { backgroundColor: '#e8f5e9' },
  statusPending: { backgroundColor: '#FFF8E1' },
  statusRejected: { backgroundColor: '#FFEBEE' },
  statusBadgeText: { fontSize: 12, fontFamily: Fonts.semiBold },
  statusApprovedText: { color: Colors.primaryDark },
  statusPendingText: { color: '#F57F17' },
  statusRejectedText: { color: '#C62828' },

  // Quick links
  quickLinksRow: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickLinkCard: {
    backgroundColor: Colors.surface,
    width: '23%',
    paddingVertical: 15,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  quickLinkIconWrap: {
    marginBottom: 8,
  },
  quickLinkLabel: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    textAlign: 'center',
    color: '#444',
    lineHeight: 14,
  },

  // Section label
  sectionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 10,
  },
  sectionLabelText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#1a1a1a',
    letterSpacing: 0.5,
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionAction: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },

  // Info card
  infoCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 15,
    borderRadius: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  infoIconWrap: {
    marginRight: 15,
  },
  infoTextBlock: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textLight, marginBottom: 2 },
  infoValue: { fontSize: 15, fontFamily: Fonts.semiBold, color: '#333' },
  infoDivider: { height: 1, backgroundColor: '#f0f0f0' },

  // Aadhar image
  aadharImageCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 15,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  aadharImage: { width: '100%', height: 200 },
  openFullBtn: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  openFullBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },

  // Menu card
  menuCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 15,
    borderRadius: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuItemLabel: { fontSize: 15, fontFamily: Fonts.medium, color: '#333' },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  logoutText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.error },

  versionText: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textLight,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 50,
    paddingRight: 15,
  },
  menuDropdown: {
    backgroundColor: '#2d2d2d',
    width: 140,
    borderRadius: 12,
    paddingVertical: 4,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  menuOption: { paddingVertical: 10, paddingHorizontal: 15 },
  menuOptionText: { fontSize: 14, fontFamily: Fonts.medium, color: '#fff' },
  menuDivider: { height: 1, backgroundColor: '#444', marginHorizontal: 8 },
});

export default ProfileScreen;
