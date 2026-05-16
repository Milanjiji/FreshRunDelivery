import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Image,
  Alert,
  Linking,
} from 'react-native';
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
  EyeOff
} from 'lucide-react-native';
import { Fonts } from '../theme/typography';
import { Colors } from '../theme/colors';

const ProfileScreen: React.FC<ProfileScreenProps> = ({ userData, onBack, onLogout }) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [aadharExpanded, setAadharExpanded] = useState(false);

  const fullName = userData?.fullName || userData?.full_name || 'Partner';
  const initials = fullName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const phone = userData?.phone
    ? userData.phone.startsWith('+')
      ? userData.phone
      : `+91 ${userData.phone}`
    : '—';

  const approvalStatus = userData?.approvalStatus || 'approved';

  const infoRows = [
    { label: 'Full Name', value: fullName, icon: <User size={18} color={Colors.primary} /> },
    { label: 'Phone Number', value: phone, icon: <Phone size={18} color={Colors.primary} /> },
    { label: 'Email Address', value: userData?.email || '—', icon: <Mail size={18} color={Colors.primary} /> },
    { label: 'Aadhar Number', value: userData?.aadharNumber || '—', icon: <CreditCard size={18} color={Colors.primary} /> },
  ];

  const quickLinks = [
    { id: 'q1', icon: <Package size={22} color={Colors.textSecondary} />, label: 'My\nDeliveries' },
    { id: 'q2', icon: <Star size={22} color={Colors.textSecondary} />, label: 'Ratings' },
    { id: 'q3', icon: <Wallet size={22} color={Colors.textSecondary} />, label: 'Earnings' },
    { id: 'q4', icon: <LifeBuoy size={22} color={Colors.textSecondary} />, label: 'Support' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── HEADER ──────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ChevronLeft size={24} color={Colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
          <MoreHorizontal size={22} color={Colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
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
                  Alert.alert('Logout', 'Are you sure you want to logout?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Logout', style: 'destructive', onPress: onLogout },
                  ]);
                }}
              >
                <Text style={[styles.menuOptionText, { color: Colors.error }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── HERO AVATAR SECTION ─────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.heroName}>{fullName}</Text>
          <Text style={styles.heroPhone}>{phone}</Text>

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
            <TouchableOpacity key={item.id} style={styles.quickLinkCard}>
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
            { icon: <History size={20} color={Colors.textSecondary} />, label: 'Delivery History' },
            { icon: <BarChart3 size={20} color={Colors.textSecondary} />, label: 'Earnings Report' },
            { icon: <Bell size={20} color={Colors.textSecondary} />, label: 'Notifications' },
            { icon: <ShieldCheck size={20} color={Colors.textSecondary} />, label: 'Privacy Policy' },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, i === arr.length - 1 && styles.menuItemLast]}
            >
              <View style={styles.menuItemLeft}>
                <View style={{ marginRight: 14 }}>{item.icon}</View>
                <Text style={styles.menuItemLabel}>{item.label}</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── LOGOUT ──────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() =>
            Alert.alert('Logout', 'Are you sure you want to logout?', [
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
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  scrollContent: { paddingBottom: 40 },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: Colors.primary,
    padding: 3,
    marginBottom: 14,
  },
  avatar: {
    flex: 1,
    borderRadius: 45,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 30, fontFamily: Fonts.bold, color: Colors.white },
  heroName: { fontSize: 26, fontFamily: Fonts.black, color: Colors.text, marginBottom: 4 },
  heroPhone: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: 12 },

  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusApproved: { backgroundColor: '#e8f5e9' },
  statusPending: { backgroundColor: '#FFF8E1' },
  statusRejected: { backgroundColor: '#FFEBEE' },
  statusBadgeText: { fontSize: 13, fontFamily: Fonts.semiBold },
  statusApprovedText: { color: Colors.primaryDark },
  statusPendingText: { color: '#F57F17' },
  statusRejectedText: { color: '#C62828' },

  // Quick links
  quickLinksRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickLinkCard: {
    backgroundColor: Colors.surface,
    width: '23%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickLinkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickLinkLabel: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 13,
  },

  // Section label
  sectionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionLabelText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.textLight,
    letterSpacing: 1,
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
    marginHorizontal: 16,
    borderRadius: 20,
    paddingHorizontal: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  infoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  infoTextBlock: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textLight, marginBottom: 2 },
  infoValue: { fontSize: 15, fontFamily: Fonts.semiBold, color: Colors.text },
  infoDivider: { height: 1, backgroundColor: Colors.divider, marginLeft: 52 },

  // Aadhar image
  aadharImageCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    marginHorizontal: 16,
    borderRadius: 20,
    paddingHorizontal: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuItemLabel: { fontSize: 15, fontFamily: Fonts.medium, color: Colors.text },
  menuChevron: { fontSize: 22, color: Colors.textLight },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  menuDropdown: {
    backgroundColor: '#2D2D2D',
    width: 150,
    borderRadius: 14,
    paddingVertical: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuOption: { paddingVertical: 12, paddingHorizontal: 16 },
  menuOptionText: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.white },
  menuDivider: { height: 1, backgroundColor: '#444', marginHorizontal: 10 },
});

export default ProfileScreen;
