import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import { launchImageLibrary } from 'react-native-image-picker';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/typography';
import { API_BASE_URL } from '../config/api';
import { Alertt } from '../components/Alertt';

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dubgo0vue/image/upload';
const UPLOAD_PRESET = 'freshrun_preset';

interface HelpScreenProps {
  userToken: string;
  preAttachedOrder?: any;
  onBack: () => void;
  onViewTicketDetails: (ticketId: string) => void;
}

const FAQ_ITEMS = [
  {
    q: 'How do I withdraw my earnings?',
    a: 'You can request a payout from your Profile page under the Earnings section. Once initiated, the amount will be transferred to your registered bank account or UPI ID within 24 hours.',
  },
  {
    q: 'What should I do in case of a vehicle breakdown or accident?',
    a: 'Your safety is our top priority. Please contact our support hotline immediately using the "Call Us" button. If you are delivering an order, do not worry; our team will assign it to another partner.',
  },
  {
    q: 'The store is closed or refusing to hand over the order. What to do?',
    a: 'If a store is closed or refuses to hand over the order, please raise a support ticket under the "Order Issue" category and attach a photo of the store front. We will verify it and compensate you for the attempt.',
  },
  {
    q: 'Customer is unreachable or not at the location. What to do?',
    a: 'Please wait at the delivery location for at least 10 minutes and attempt to call the customer 3 times. If they are still unreachable, log a ticket under "Order Issue" or call support before leaving.',
  },
  {
    q: 'Why did I not receive my rainy weather surge fee?',
    a: 'Surges and bonuses are automatically added to your earnings once the order status is marked as completed. If it is still missing after completion, please raise a support ticket under "Earnings & Wallet" with the order details.',
  },
];

const HelpScreen: React.FC<HelpScreenProps> = ({
  userToken,
  preAttachedOrder,
  onBack,
  onViewTicketDetails,
}) => {
  const [activeTab, setActiveTab] = useState<'faq' | 'tickets'>('faq');
  
  // Submit Ticket Form States
  const [category, setCategory] = useState<'Order Issue' | 'Earnings/Wallet' | 'Account & Profile' | 'General Support'>('General Support');
  const [message, setMessage] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(preAttachedOrder || null);
  const [issueImage, setIssueImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Tickets List States
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Orders Picker Modal States
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

  // FAQ Expanded States
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Load user tickets when tab changes
  useEffect(() => {
    if (activeTab === 'tickets') {
      fetchUserTickets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Load user orders for selector on mount
  useEffect(() => {
    fetchPartnerDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/support/tickets`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.data.success) {
        setTickets(res.data.tickets || []);
      }
    } catch (err) {
      console.log('Error fetching support tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const fetchPartnerDeliveries = async () => {
    setLoadingOrders(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/orders/partner?history=true`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (res.data.success) {
        setOrders(res.data.orders || []);
      }
    } catch (err) {
      console.log('Error fetching partner deliveries:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleImagePick = async () => {
    const options = {
      mediaType: 'photo' as const,
      quality: 0.8 as const,
    };

    try {
      const result = await launchImageLibrary(options);
      if (result.assets && result.assets[0]) {
        const pickedAsset = result.assets[0];
        setUploadingImage(true);
        const url = await uploadToCloudinary(pickedAsset);
        setIssueImage(url);
      }
    } catch (err) {
      console.log('Image pick error:', err);
      Alertt.alert('Upload Failed', 'Failed to select image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadToCloudinary = async (asset: any): Promise<string> => {
    const data = new FormData();
    data.append('file', {
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      name: asset.fileName || 'upload.jpg',
    } as any);
    data.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(CLOUDINARY_URL, {
      method: 'POST',
      body: data,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data',
      },
    });
    const resData = await response.json();
    if (resData.secure_url) {
      return resData.secure_url;
    } else {
      throw new Error('Upload URL not found');
    }
  };

  const handleSubmitTicket = async () => {
    if (!message.trim()) {
      Alertt.alert('Error', 'Please enter a description of your issue.');
      return;
    }

    if (category === 'Order Issue' && !selectedOrder) {
      Alertt.alert('Order Required', 'Please attach the affected delivery order first.');
      return;
    }

    setSubmitting(true);
    try {
      const deviceInfo = 'App v1.0.0 | OS: Native Delivery';
      const payload = {
        order_id: selectedOrder?.id || null,
        category,
        message,
        device_info: deviceInfo,
        attachment_url: issueImage,
        upi_id: null,
        upi_qr_url: null,
      };

      const res = await axios.post(`${API_BASE_URL}/support/tickets`, payload, {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      if (res.data.success) {
        Alertt.alert('Ticket Submitted', 'Our support team has received your ticket and will verify the details soon.');
        // Reset form
        setMessage('');
        setCategory('General Support');
        setSelectedOrder(null);
        setIssueImage(null);
        // Navigate to tickets tab
        setActiveTab('tickets');
      } else {
        Alertt.alert('Submission Failed', res.data.error || 'Failed to submit ticket.');
      }
    } catch (err) {
      console.log('Error submitting ticket:', err);
      Alertt.alert('Error', 'Failed to submit support ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Absolute Back Button */}
      <TouchableOpacity onPress={onBack} style={styles.backCircleButton}>
        <Icon name="chevron-back" size={24} color="#333" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Title Section */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Partner Support</Text>
          <Text style={styles.headerSubtitle}>How can we help you on your run today?</Text>
        </View>

        {/* Action Direct Channels */}
        <View style={styles.channelsRow}>
          <TouchableOpacity onPress={() => Linking.openURL('tel:9088568423')} style={styles.channelCard}>
            <View style={[styles.channelIcon, { backgroundColor: '#EBF3FF' }]}>
              <Icon name="call" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.channelLabel}>Call Support</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => Linking.openURL('https://wa.me/919088568423?text=Hi%20FreshRush%20Partner%20Support')} style={styles.channelCard}>
            <View style={[styles.channelIcon, { backgroundColor: '#E8F8F0' }]}>
              <Icon name="logo-whatsapp" size={22} color="#25D366" />
            </View>
            <Text style={styles.channelLabel}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => Linking.openURL('mailto:support@freshrush.in')} style={styles.channelCard}>
            <View style={[styles.channelIcon, { backgroundColor: '#FFF3EB' }]}>
              <Icon name="mail" size={22} color="#FF8C00" />
            </View>
            <Text style={styles.channelLabel}>Email Us</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Controls */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'faq' && styles.activeTabButton]}
            onPress={() => setActiveTab('faq')}
          >
            <Text style={[styles.tabText, activeTab === 'faq' && styles.activeTabText]}>FAQs & Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'tickets' && styles.activeTabButton]}
            onPress={() => setActiveTab('tickets')}
          >
            <Text style={[styles.tabText, activeTab === 'tickets' && styles.activeTabText]}>My Support Tickets</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Contents */}
        {activeTab === 'faq' ? (
          <View style={styles.faqSection}>
            {/* FAQs List */}
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            {FAQ_ITEMS.map((item, index) => (
              <View key={index} style={styles.faqCard}>
                <TouchableOpacity onPress={() => toggleFaq(index)} style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{item.q}</Text>
                  <Icon name={expandedFaq === index ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
                </TouchableOpacity>
                {expandedFaq === index && (
                  <View style={styles.faqBody}>
                    <Text style={styles.faqAnswer}>{item.a}</Text>
                  </View>
                )}
              </View>
            ))}

            {/* Create Ticket Form */}
            <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Raise a Support Ticket</Text>
            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>Choose Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPicker}>
                {(['Order Issue', 'Earnings/Wallet', 'Account & Profile', 'General Support'] as const).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryBtn, category === cat && styles.categoryBtnActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.categoryBtnText, category === cat && styles.categoryBtnTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Order Attaching Section */}
              <Text style={styles.inputLabel}>Attach Delivery Order</Text>
              {selectedOrder ? (
                <View style={styles.attachedOrderCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachedStoreName} numberOfLines={1}>{selectedOrder.store_name || 'Attached Delivery'}</Text>
                    <Text style={styles.attachedOrderAmount}>₹{selectedOrder.total_amount || 0} • #{String(selectedOrder.id || '').split('-')[0].toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.removeOrderBtn}>
                    <Icon name="close" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setShowOrderModal(true)} style={styles.attachOrderPlaceholder}>
                  <Icon name="add-circle-outline" size={20} color={Colors.primary} />
                  <Text style={styles.attachOrderPlaceholderText}>Select order details to attach</Text>
                </TouchableOpacity>
              )}

              {/* Description Input */}
              <Text style={styles.inputLabel}>Issue Details / Description</Text>
              <TextInput
                style={[styles.textInput, styles.messageInput]}
                placeholder="Describe your issue in detail..."
                value={message}
                onChangeText={setMessage}
                multiline
                placeholderTextColor="#999"
              />

              {/* Issue Screenshot Attachments */}
              <Text style={styles.inputLabel}>Attach Proof / Photos (Optional)</Text>
              {issueImage ? (
                <View style={styles.uploadedContainer}>
                  <Image source={{ uri: issueImage }} style={styles.attachmentPreview} />
                  <TouchableOpacity onPress={() => setIssueImage(null)} style={styles.removeImageBtn}>
                    <Icon name="close-circle" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={handleImagePick} style={styles.uploadImageBtn} disabled={uploadingImage}>
                  {uploadingImage ? <ActivityIndicator size="small" color={Colors.primary} /> : (
                    <>
                      <Icon name="image-outline" size={20} color={Colors.primary} />
                      <Text style={styles.uploadImageText}>Upload photo of store/package/proof</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.submitButton, submitting && { opacity: 0.7 }]}
                onPress={handleSubmitTicket}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitButtonText}>Submit Ticket</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.ticketsSection}>
            {loadingTickets ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
            ) : tickets.length > 0 ? (
              tickets.map((ticket) => (
                <TouchableOpacity
                  key={ticket.id}
                  style={styles.ticketCard}
                  onPress={() => onViewTicketDetails(ticket.id)}
                >
                  <View style={styles.ticketHeader}>
                    <Text style={styles.ticketCategory}>{ticket.category.toUpperCase()}</Text>
                    <View style={[
                      styles.statusBadge,
                      ticket.status === 'resolved' && { backgroundColor: '#E8F8F0' },
                      ticket.status === 'in_progress' && { backgroundColor: '#FFF5EB' }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        ticket.status === 'resolved' && { color: '#25D366' },
                        ticket.status === 'in_progress' && { color: '#FF8C00' }
                      ]}>
                        {ticket.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.ticketMessage} numberOfLines={2}>{ticket.message}</Text>
                  {ticket.store_name && (
                    <Text style={styles.ticketStore}>Store: {ticket.store_name}</Text>
                  )}
                  <Text style={styles.ticketDate}>
                    {new Date(ticket.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Icon name="ticket-outline" size={50} color="#ccc" />
                <Text style={styles.emptyText}>No support requests submitted yet.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Orders Picker Modal */}
      <Modal visible={showOrderModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attach Delivery Order</Text>
              <TouchableOpacity onPress={() => setShowOrderModal(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {loadingOrders ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ padding: 40 }} />
            ) : orders.length > 0 ? (
              <FlatList
                data={orders}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.orderListItem}
                    onPress={() => {
                      setSelectedOrder(item);
                      setShowOrderModal(false);
                    }}
                  >
                    <View style={styles.orderRowInfo}>
                      <Text style={styles.orderStore}>{item.store_name || 'FreshRun Store'}</Text>
                      <Text style={styles.orderMeta}>
                        ₹{item.total_amount} • {new Date(item.created_at).toLocaleDateString('en-IN')} • #{String(item.id).split('-')[0].toUpperCase()}
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size={16} color="#999" />
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No delivery history found.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backCircleButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef0f2',
  },
  scrollContent: {
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  headerSection: {
    paddingHorizontal: 25,
    paddingTop: 85,
    paddingBottom: 10,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Fonts.black,
    fontWeight: '900',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#888',
    marginTop: 5,
  },
  channelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: 20,
  },
  channelCard: {
    width: '30%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F2F5',
  },
  channelIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  channelLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#333',
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#F0F2F5',
    borderRadius: 30,
    padding: 4,
    marginBottom: 25,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 25,
  },
  activeTabButton: {
    backgroundColor: '#000',
  },
  tabText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  faqSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.black,
    fontWeight: '900',
    color: '#333',
    marginBottom: 15,
  },
  faqCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
    paddingVertical: 15,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#333',
    flex: 0.95,
  },
  faqBody: {
    marginTop: 10,
  },
  faqAnswer: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#666',
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F0F2F5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 15,
  },
  categoryPicker: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    paddingRight: 15,
  },
  categoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginRight: 6,
  },
  categoryBtnActive: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  categoryBtnText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#666',
  },
  categoryBtnTextActive: {
    color: '#fff',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 15,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#333',
    backgroundColor: '#fff',
  },
  messageInput: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  attachedOrderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 15,
  },
  attachedStoreName: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#333',
  },
  attachedOrderAmount: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#666',
    marginTop: 2,
  },
  removeOrderBtn: {
    padding: 4,
  },
  attachOrderPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    borderRadius: 12,
    padding: 15,
    justifyContent: 'center',
    backgroundColor: '#F4F7FF',
  },
  attachOrderPlaceholderText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },
  uploadedContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 5,
  },
  attachmentPreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  uploadImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 15,
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  uploadImageText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#666',
  },
  submitButton: {
    height: 54,
    backgroundColor: '#000',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 25,
  },
  submitButtonText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#fff',
  },
  ticketsSection: {
    paddingHorizontal: 20,
  },
  ticketCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F2F5',
    padding: 15,
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketCategory: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#999',
    letterSpacing: 0.5,
  },
  ticketMessage: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#333',
    lineHeight: 20,
  },
  ticketStore: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#666',
    marginTop: 5,
  },
  ticketDate: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: '#bbb',
    marginTop: 8,
  },
  statusBadge: {
    backgroundColor: '#FFF8F4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#E28743',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#999',
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
    paddingBottom: 15,
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: Fonts.black,
    fontWeight: '900',
    color: '#333',
  },
  orderListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#FAFAFA',
  },
  orderRowInfo: {
    gap: 4,
    flex: 1,
    marginRight: 10,
  },
  orderStore: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#333',
  },
  orderMeta: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#888',
  },
});

export default HelpScreen;
