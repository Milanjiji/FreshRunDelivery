import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/typography';

const { width } = Dimensions.get('window');

interface LocationDisclosureModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const LocationDisclosureModal: React.FC<LocationDisclosureModalProps> = ({
  visible,
  onAccept,
  onDecline,
}) => {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <MapPin size={40} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Live Location Tracking</Text>
          <Text style={styles.message}>
            FreshRun Delivery collects location data to enable real-time order tracking for customers 
            and to calculate delivery payouts, even when the app is closed or not in use during an active delivery.
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
              <Text style={styles.declineText}>No, thanks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
              <Text style={styles.acceptText}>Turn on</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: width * 0.85,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(96, 197, 71, 0.15)', // Light primary color
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.black,
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  declineText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#666',
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  acceptText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
});

export default LocationDisclosureModal;
