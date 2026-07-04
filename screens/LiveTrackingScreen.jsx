import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';

const COLORS = {
  navy: '#1B3A8C',
  navyDark: '#0D1F3C',
  white: '#FFFFFF',
  gray: '#8A9BB0',
  green: '#16A34A',
  lightGreen: '#DCFCE7',
};

export default function LiveTrackingScreen({ navigation }) {
  const [status] = useState('En route');

  const patientLocation = {
    latitude: 49.2827,
    longitude: -123.1207,
  };

  const phlebotomistLocation = {
    latitude: 49.2887,
    longitude: -123.1250,
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 49.285,
          longitude: -123.122,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        <Marker
          coordinate={patientLocation}
          title="Patient"
          pinColor="red"
        />

        <Marker
          coordinate={phlebotomistLocation}
          title="Phlebotomist"
          pinColor="green"
        />

        <Polyline
          coordinates={[
            phlebotomistLocation,
            patientLocation,
          ]}
          strokeWidth={4}
          strokeColor="#1B3A8C"
        />
      </MapView>

      <View style={styles.bottomCard}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>JR</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              Jose Rodriguez
            </Text>

            <Text style={styles.rating}>
              ⭐ 4.9
            </Text>
          </View>

          <TouchableOpacity style={styles.iconBtn}>
            <Text>📞</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn}>
            <Text>💬</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressActive} />
          <View style={styles.progressActive} />
          <View style={styles.progressInactive} />
          <View style={styles.progressInactive} />
        </View>

        <View style={styles.labelsRow}>
          <Text style={styles.label}>Booked</Text>
          <Text style={styles.label}>En route</Text>
          <Text style={styles.label}>Arrived</Text>
          <Text style={styles.label}>Done</Text>
        </View>

        <View style={styles.etaCard}>
          <Text style={styles.eta}>
            5 minutes away
          </Text>

          <Text style={styles.etaSub}>
            Jose is heading to your location
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  map: {
    flex: 1,
  },

  bottomCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    marginTop: -20,
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DDE7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: COLORS.navy,
    fontWeight: '800',
  },

  name: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.navyDark,
  },

  rating: {
    color: COLORS.gray,
    marginTop: 4,
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1DBE8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },

  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },

  progressActive: {
    flex: 1,
    height: 5,
    backgroundColor: COLORS.navy,
    borderRadius: 10,
  },

  progressInactive: {
    flex: 1,
    height: 5,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
  },

  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  label: {
    fontSize: 12,
    color: COLORS.gray,
  },

  etaCard: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },

  eta: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.green,
  },

  etaSub: {
    marginTop: 4,
    color: COLORS.green,
    fontWeight: '600',
  },
});