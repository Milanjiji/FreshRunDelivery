import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../utils/api';
import { launchImageLibrary } from 'react-native-image-picker';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/typography';
import { API_BASE_URL } from '../config/api';
import { Alertt } from '../components/Alertt';

const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dubgo0vue/image/upload';
const UPLOAD_PRESET = 'freshrun_preset';

interface TicketDetailsScreenProps {
  ticketId: string | number;
  userToken: string;
  onBack: () => void;
}

const TicketDetailsScreen: React.FC<TicketDetailsScreenProps> = ({
  ticketId,
  userToken,
  onBack,
}) => {
  const [ticket, setTicket] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newMessage, setNewMessage] = useState('');
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchTicketDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const fetchTicketDetails = async () => {
    try {
      const res = await api.get(`/support/tickets/${ticketId}`);
      if (res.data.success) {
        setTicket(res.data.ticket);
        setReplies(res.data.replies || []);
      }
    } catch (err) {
      console.log('Error fetching ticket details:', err);
      Alertt.alert('Error', 'Failed to load support ticket details.');
    } finally {
      setLoading(false);
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
        setUploadingImage(true);
        const pickedAsset = result.assets[0];
        const url = await uploadToCloudinary(pickedAsset);
        setReplyImage(url);
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

  const handleSendReply = async () => {
    if (!newMessage.trim() && !replyImage) return;

    setSending(true);
    try {
      const payload = {
        message: newMessage.trim(),
        attachment_url: replyImage,
        sender_type: 'user',
      };

      const res = await api.post(`/support/tickets/${ticketId}/replies`, payload);

      if (res.data.success) {
        setReplies(prev => [...prev, res.data.reply]);
        setNewMessage('');
        setReplyImage(null);
        Keyboard.dismiss();
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (err) {
      console.log('Error sending reply:', err);
      Alertt.alert('Error', 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const handleCallStoreOwner = () => {
    if (ticket?.store_phone) {
      Linking.openURL(`tel:${ticket.store_phone}`);
    } else {
      Alertt.alert('Not Available', 'Store owner phone number is not available.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Ticket not found.</Text>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const renderHeaderInfo = () => (
    <View style={styles.infoCard}>
      <View style={styles.ticketMetaRow}>
        <Text style={styles.categoryLabel}>{ticket.category.toUpperCase()}</Text>
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

      <Text style={styles.ticketSubject}>{ticket.message}</Text>

      {ticket.attachment_url && (
        <View style={styles.attachmentContainer}>
          <Text style={styles.attachmentLabel}>Attached Photo:</Text>
          <Image source={{ uri: ticket.attachment_url }} style={styles.ticketAttachmentImage} resizeMode="cover" />
        </View>
      )}

      {ticket.order_id && (
        <View style={styles.orderContextCard}>
          <Icon name="receipt-outline" size={18} color="#666" />
          <View style={styles.orderContextDetails}>
            <Text style={styles.orderContextStore}>{ticket.store_name || 'Store Details'}</Text>
            <Text style={styles.orderContextMeta}>
              Order ID: #{String(ticket.order_id).split('-')[0].toUpperCase()} • ₹{ticket.total_amount}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.divider} />
      <Text style={styles.timelineHeader}>Conversation History</Text>
    </View>
  );

  const renderReplyItem = ({ item }: { item: any }) => {
    const isAdmin = item.sender_type === 'admin';
    return (
      <View style={[styles.messageBubbleContainer, isAdmin ? styles.adminBubbleContainer : styles.userBubbleContainer]}>
        <View style={[styles.messageBubble, isAdmin ? styles.adminBubble : styles.userBubble]}>
          <Text style={[styles.messageText, isAdmin ? styles.adminMessageText : styles.userMessageText]}>
            {item.message}
          </Text>
          {item.attachment_url && (
            <Image source={{ uri: item.attachment_url }} style={styles.bubbleAttachmentImage} resizeMode="cover" />
          )}
          <Text style={[styles.messageTime, isAdmin ? styles.adminMessageTime : styles.userMessageTime]}>
            {new Date(item.created_at).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} style={styles.backCircleButton}>
          <Icon name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ticket Details</Text>
        {ticket.store_phone ? (
          <TouchableOpacity onPress={handleCallStoreOwner} style={styles.callStoreButton}>
            <Icon name="call-outline" size={18} color={Colors.secondary} />
            <Text style={styles.callStoreText}>Call Store</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={replies}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderReplyItem}
          ListHeaderComponent={renderHeaderInfo}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)}
        />

        {/* Input Bar at the Bottom */}
        <View style={styles.inputContainer}>
          {replyImage && (
            <View style={styles.inputAttachmentWrapper}>
              <Image source={{ uri: replyImage }} style={styles.inputAttachmentPreview} />
              <TouchableOpacity onPress={() => setReplyImage(null)} style={styles.removeInputAttachment}>
                <Icon name="close-circle" size={18} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <TouchableOpacity onPress={handleImagePick} style={styles.attachBtn} disabled={uploadingImage}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Icon name="image-outline" size={22} color="#666" />
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Type your message..."
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              placeholderTextColor="#999"
            />

            <TouchableOpacity
              onPress={handleSendReply}
              style={[styles.sendBtn, (!newMessage.trim() && !replyImage) && styles.sendBtnDisabled]}
              disabled={!newMessage.trim() && !replyImage || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: '#666',
    marginBottom: 20,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontFamily: Fonts.bold,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
    backgroundColor: '#fff',
  },
  backCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef0f2',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.black,
    fontWeight: '900',
    color: '#333',
  },
  callStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
  },
  callStoreText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.secondary,
  },
  listContent: {
    paddingBottom: 20,
  },
  infoCard: {
    padding: 20,
    backgroundColor: '#fff',
  },
  ticketMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  statusBadge: {
    backgroundColor: '#FFF8F4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#E28743',
  },
  ticketSubject: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#1a1a1a',
    lineHeight: 24,
    marginBottom: 15,
  },
  attachmentContainer: {
    marginTop: 10,
    marginBottom: 15,
  },
  attachmentLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  ticketAttachmentImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
  },
  orderContextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#F0F2F5',
    marginTop: 5,
  },
  orderContextDetails: {
    flex: 1,
  },
  orderContextStore: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#333',
  },
  orderContextMeta: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#666',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F2F5',
    marginVertical: 20,
  },
  timelineHeader: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#1a1a1a',
    marginBottom: 15,
  },
  messageBubbleContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginVertical: 6,
    flexDirection: 'row',
  },
  adminBubbleContainer: {
    justifyContent: 'flex-start',
  },
  userBubbleContainer: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  adminBubble: {
    backgroundColor: '#F0F2F5',
    borderTopLeftRadius: 0,
  },
  userBubble: {
    backgroundColor: '#000',
    borderTopRightRadius: 0,
  },
  messageText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    lineHeight: 20,
  },
  adminMessageText: {
    color: '#333',
  },
  userMessageText: {
    color: '#fff',
  },
  bubbleAttachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: '#fff',
  },
  messageTime: {
    fontSize: 9,
    fontFamily: Fonts.medium,
    marginTop: 6,
    textAlign: 'right',
  },
  adminMessageTime: {
    color: '#999',
  },
  userMessageTime: {
    color: '#ccc',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  inputAttachmentWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputAttachmentPreview: {
    width: '100%',
    height: '100%',
  },
  removeInputAttachment: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 18,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#333',
    backgroundColor: '#F9FAFB',
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  sendBtnDisabled: {
    backgroundColor: '#ccc',
  },
});

export default TicketDetailsScreen;
