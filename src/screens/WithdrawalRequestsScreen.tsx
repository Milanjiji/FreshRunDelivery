import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ChevronLeft, 
  Wallet, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Calendar, 
  TrendingUp,
  ArrowUpRight
} from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/typography';
import { API_BASE_URL } from '../config/api';
import { Alertt } from '../components/Alertt';

interface WithdrawalRequest {
  id: number;
  amount: number | string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
}

interface WithdrawalRequestsScreenProps {
  userToken: string;
  userData: any;
  onBack: () => void;
  onRefreshProfile: () => void;
}

const WithdrawalRequestsScreen: React.FC<WithdrawalRequestsScreenProps> = ({
  userToken,
  userData,
  onBack,
  onRefreshProfile,
}) => {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');

  // Fetch payout request history
  const fetchRequestHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`${API_BASE_URL}/payouts/my-requests`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('[WithdrawalRequestsScreen] fetchRequestHistory error:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchRequestHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenRequestModal = () => {
    // Check if partner has set up bank account number or UPI ID
    const upiId = userData?.upiId || userData?.upi_id;
    const bankAccount = userData?.bankAccountNumber || userData?.bank_account_number;

    if (!upiId && !bankAccount) {
      Alertt.alert(
        'Payment Details Missing',
        'Please complete your payment onboarding setup (UPI ID or Bank Details) from your Profile page before requesting a withdrawal.'
      );
      return;
    }

    const available = parseFloat(userData?.withdrawableEarnings || userData?.withdrawable_earnings || 0);
    if (available <= 0) {
      Alertt.alert('No Balance Available', 'You do not have any withdrawable earnings available at the moment.');
      return;
    }

    // Pre-fill input with max withdrawable amount
    setAmount(available.toFixed(0));
    setShowModal(true);
  };

  const handleSubmitRequest = async () => {
    const numericAmount = parseFloat(amount);
    const available = parseFloat(userData?.withdrawableEarnings || userData?.withdrawable_earnings || 0);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alertt.alert('Invalid Amount', 'Please enter a valid positive withdrawal amount.');
      return;
    }

    if (numericAmount > available) {
      Alertt.alert(
        'Limit Exceeded',
        `You cannot request more than your available withdrawable balance of ₹${available.toFixed(2)}.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/payouts/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ amount: numericAmount }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        Alertt.alert('Success', 'Your withdrawal request has been submitted to the admin for processing.');
        setShowModal(false);
        // Refresh balance and history logs
        onRefreshProfile();
        fetchRequestHistory();
      } else {
        Alertt.alert('Request Failed', data.error || 'Failed to submit withdrawal request.');
      }
    } catch (error) {
      console.error('[WithdrawalRequestsScreen] submit request error:', error);
      Alertt.alert('Error', 'Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return dateString;
    }
  };

  const availableBalance = parseFloat(userData?.withdrawableEarnings || userData?.withdrawable_earnings || 0);
  const totalEarned = parseFloat(userData?.totalEarnings || userData?.total_earnings || 0);

  const renderHistoryItem = ({ item }: { item: WithdrawalRequest }) => {
    let statusLabel = 'Pending';
    let statusColor = '#F59E0B'; // Amber
    let StatusIcon = Clock;

    if (item.status === 'approved') {
      statusLabel = 'Approved & Paid';
      statusColor = '#10B981'; // Green
      StatusIcon = CheckCircle2;
    } else if (item.status === 'rejected') {
      statusLabel = 'Rejected';
      statusColor = '#EF4444'; // Red
      StatusIcon = XCircle;
    }

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyCardHeader}>
          <View style={styles.amountWrap}>
            <Text style={styles.historyAmount}>₹{parseFloat(String(item.amount)).toFixed(2)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
            <StatusIcon size={12} color={statusColor} style={styles.statusIcon} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.historyCardFooter}>
          <View style={styles.metaRow}>
            <Calendar size={13} color="#9CA3AF" />
            <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
          </View>
          {item.status === 'rejected' && item.rejection_reason && (
            <View style={styles.rejectionBox}>
              <Text style={styles.rejectionLabel}>Reason:</Text>
              <Text style={styles.rejectionReason}>{item.rejection_reason}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ChevronLeft size={24} color="#333" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings & Payouts</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* EARNINGS SUMMARY CARDS */}
        <View style={styles.cardContainer}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <View style={styles.walletIconBg}>
                <Wallet size={20} color="#fff" />
              </View>
              <Text style={styles.balanceLabel}>Available for Payout</Text>
            </View>
            <Text style={styles.balanceValue}>₹{availableBalance.toFixed(2)}</Text>
            
            <TouchableOpacity 
              style={[styles.withdrawBtn, availableBalance <= 0 && styles.withdrawBtnDisabled]}
              onPress={handleOpenRequestModal}
              disabled={availableBalance <= 0}
            >
              <Text style={styles.withdrawBtnText}>Request Withdrawal</Text>
              <ArrowUpRight size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <View style={styles.statIconBg}>
                <TrendingUp size={16} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.statLabel}>Lifetime Earnings</Text>
                <Text style={styles.statValue}>₹{totalEarned.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* DETAILS INFO BOX */}
        <View style={styles.infoBox}>
          <Info size={16} color={Colors.primary} style={styles.infoIcon} />
          <Text style={styles.infoText}>
            Payout requests are reviewed and processed by the admin. Once passed, the funds will be transferred to your registered UPI ID or Bank account.
          </Text>
        </View>

        {/* LOGS HEADER */}
        <Text style={styles.sectionTitle}>Request History</Text>

        {/* HISTORY LIST */}
        {loadingHistory ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Fetching transaction records...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Wallet size={36} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No requests recorded</Text>
            <Text style={styles.emptyStateSub}>Your past payout logs and transfer updates will appear here.</Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            renderItem={renderHistoryItem}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </ScrollView>

      {/* WITHDRAWAL AMOUNT MODAL */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Withdrawal</Text>
            <Text style={styles.modalSub}>
              Enter amount to withdraw (Max available: ₹{availableBalance.toFixed(2)})
            </Text>

            <View style={styles.inputWrapper}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                autoFocus
                placeholder="0"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setShowModal(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.confirmBtn} 
                onPress={handleSubmitRequest}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: '#111827',
  },
  headerRightSpacer: {
    width: 32,
  },
  scrollContainer: {
    padding: 16,
  },
  cardContainer: {
    gap: 16,
    marginBottom: 16,
  },
  balanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  walletIconBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 6,
  },
  balanceLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: '#94A3B8',
  },
  balanceValue: {
    fontFamily: Fonts.black,
    fontSize: 30,
    color: '#fff',
    marginBottom: 16,
  },
  withdrawBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  withdrawBtnDisabled: {
    backgroundColor: '#475569',
    opacity: 0.6,
  },
  withdrawBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: '#fff',
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIconBg: {
    backgroundColor: `${Colors.primary}12`,
    borderRadius: 10,
    padding: 8,
  },
  statLabel: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#6B7280',
  },
  statValue: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    color: '#111827',
  },
  infoBox: {
    backgroundColor: `${Colors.primary}08`,
    borderWidth: 1,
    borderColor: `${Colors.primary}18`,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 24,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 16,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    color: '#111827',
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#374151',
    marginTop: 10,
  },
  emptyStateSub: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  listContainer: {
    gap: 12,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyAmount: {
    fontFamily: Fonts.black,
    fontSize: 15,
    color: '#111827',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusIcon: {
    marginTop: 0.5,
  },
  statusText: {
    fontFamily: Fonts.bold,
    fontSize: 10,
  },
  historyCardFooter: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#6B7280',
  },
  rejectionBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 0.5,
    borderColor: '#FEE2E2',
    borderRadius: 8,
    padding: 8,
    marginTop: 2,
  },
  rejectionLabel: {
    fontFamily: Fonts.bold,
    fontSize: 10,
    color: '#B91C1C',
  },
  rejectionReason: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    color: '#7F1D1D',
    marginTop: 1,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: '#111827',
  },
  modalSub: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginTop: 20,
    height: 50,
  },
  currencyPrefix: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    color: '#111827',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 16,
    color: '#111827',
    padding: 0,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  cancelBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#374151',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  confirmBtnText: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    color: '#fff',
  },
});

export default WithdrawalRequestsScreen;
