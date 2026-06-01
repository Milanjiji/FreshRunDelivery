import React, { useState } from 'react';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { ChevronLeft } from 'lucide-react-native';
import { Fonts } from '../theme/typography';

interface DebugMapScreenProps {
  onBack: () => void;
}

const CALICUT_COORDINATE = {
  latitude: 11.2588,
  longitude: 75.7804,
};

type MapStatus = 'waiting' | 'ready' | 'loaded';

const DebugMapScreen: React.FC<DebugMapScreenProps> = ({ onBack }) => {
  const [mapKey, setMapKey] = useState(0);
  const [mapStatus, setMapStatus] = useState<MapStatus>('waiting');
  const [markerCoordinate, setMarkerCoordinate] = useState(CALICUT_COORDINATE);

  const retryMap = () => {
    setMapStatus('waiting');
    setMarkerCoordinate(CALICUT_COORDINATE);
    setMapKey(currentKey => currentKey + 1);
  };

  const statusMessage = {
    waiting: 'Waiting for the native map view...',
    ready: 'Native map is ready. Waiting for Google map tiles...',
    loaded: 'Google map tiles loaded. The delivery app map integration is working.',
  }[mapStatus];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ChevronLeft size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Delivery Maps Debug</Text>
        <TouchableOpacity onPress={retryMap} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusPanel}>
        <View style={[styles.statusDot, mapStatus === 'loaded' && styles.statusDotLoaded]} />
        <View style={styles.statusTextContainer}>
          <Text style={styles.statusTitle}>{mapStatus.toUpperCase()}</Text>
          <Text style={styles.statusMessage}>{statusMessage}</Text>
        </View>
      </View>

      <MapView
        key={mapKey}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        onMapReady={() => setMapStatus('ready')}
        onMapLoaded={() => setMapStatus('loaded')}
        onPress={event => setMarkerCoordinate(event.nativeEvent.coordinate)}
        initialRegion={{
          ...CALICUT_COORDINATE,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        <Marker
          coordinate={markerCoordinate}
          title="Delivery app test marker"
          description="Tap anywhere on the map to move this marker."
        />
      </MapView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Platform: {Platform.OS}
          {'\n'}Wait for LOADED, confirm roads appear, then tap the map and confirm the marker moves.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    padding: 5,
    marginRight: 10,
  },
  title: {
    flex: 1,
    color: '#333',
    fontFamily: Fonts.bold,
    fontSize: 18,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retryText: {
    color: '#0052FF',
    fontFamily: Fonts.bold,
    fontSize: 14,
  },
  statusPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F7FA',
  },
  statusDot: {
    width: 10,
    height: 10,
    marginRight: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
  },
  statusDotLoaded: {
    backgroundColor: '#16A34A',
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    color: '#333',
    fontFamily: Fonts.bold,
    fontSize: 12,
  },
  statusMessage: {
    color: '#666',
    fontFamily: Fonts.regular,
    fontSize: 12,
    marginTop: 2,
  },
  map: {
    flex: 1,
  },
  footer: {
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  footerText: {
    color: '#666',
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 18,
  },
});

export default DebugMapScreen;
