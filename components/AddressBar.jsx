import React, { useState,useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';

const COLORS = {
  navy: '#1B3A8C',
  navyDark: '#0D1F3C',
  white: '#FFFFFF',
  offWhite: '#F4F7FB',
  lightGray: '#E8EEF5',
  gray: '#8A9BB0',
  border: '#D1DBE8',
  green: '#22C55E',
  error: '#E63946',
};

export default function AddressBar({ value, onChange }) {
  const [showModal, setShowModal] = useState(false);
  const [manualAddress, setManualAddress] = useState(value || '');
  const [loading, setLoading] = useState(false);
  const [manualZip, setManualZip] = useState('');

  // Keep internal draft in sync if the parent's value changes externally
  // (e.g. on remount, or if address is set from another screen/source)
  useEffect(() => {
    setManualAddress(value || '');
  }, [value]);

  const handleCurrentLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Please allow location access to use this feature.',
        );
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (geocode.length > 0) {
        const place = geocode[0];

        const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
        const cityRegion = [place.district, place.city, place.region].filter(Boolean).join(', ');
        const postal = place.postalCode || '';
        const country = place.country || '';

        const address = [street, cityRegion, postal, country]
          .filter(Boolean)
          .join(', ');

        setManualAddress(address);

        onChange({
          address,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          useGps: true,
          zipCode:postal,
        });
        setShowModal(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get your location. Please enter manually.');
    }
    setLoading(false);
  };

  const handleSaveManual = () => {
    if (manualAddress.trim()) {
      onChange({
      address: manualAddress.trim(),
      latitude: null,
      longitude: null,
      useGps: false,
      zipCode: manualZip.trim(),
    });
      setShowModal(false);
    } else {
      Alert.alert('Enter Address', 'Please enter a valid address.');
    }
  };

  return (
    <>
      {/* Address Bar - tap to open modal */}
      <TouchableOpacity
        style={styles.addressBar}
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.locationIcon}>📍</Text>
        <Text style={styles.addressText} numberOfLines={1}>
          {value || 'Set your address'}
        </Text>
        <Text style={styles.chevron}>✏️</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Set your address</Text>

            {/* Current Location Button */}
            <TouchableOpacity
              style={styles.currentLocationBtn}
              onPress={handleCurrentLocation}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.navy} size="small" />
              ) : (
                <Text style={styles.currentLocationIcon}>🎯</Text>
              )}
              <View>
                <Text style={styles.currentLocationTitle}>
                  Use current location
                </Text>
                <Text style={styles.currentLocationSub}>
                  Auto-detect via GPS
                </Text>
              </View>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or enter manually</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Manual Entry */}
            <Text style={styles.inputLabel}>Enter address</Text>
            <TextInput
              style={styles.input}
              value={manualAddress}
              onChangeText={setManualAddress}
              placeholder="e.g. 123 Main St, Vancouver, BC"
              placeholderTextColor={COLORS.gray}
              multiline
              numberOfLines={2}
              autoFocus
            />
            <Text style={styles.inputLabel}>Zip / PIN code</Text>
            <TextInput
              style={[styles.input, { marginBottom: 20 }]}
              value={manualZip}
              onChangeText={setManualZip}
              placeholder="e.g. 801503"
              placeholderTextColor={COLORS.gray}
              keyboardType="number-pad"
            />     

            {/* Note about Google Places */}
            <View style={styles.noteBanner}>
              <Text style={styles.noteIcon}>ℹ️</Text>
              <Text style={styles.noteText}>
                Address autocomplete coming soon
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveManual}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>Save address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Address Bar
  addressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  locationIcon: { fontSize: 15 },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.navyDark,
    fontWeight: '500',
  },
  chevron: { fontSize: 14 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.lightGray,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.navyDark,
    marginBottom: 20,
    textAlign: 'center',
  },

  // Current Location
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF0FB',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#C7D4F5',
  },
  currentLocationIcon: { fontSize: 26 },
  currentLocationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navy,
    marginBottom: 2,
  },
  currentLocationSub: { fontSize: 12, color: COLORS.gray },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.lightGray },
  dividerText: { fontSize: 12, color: COLORS.gray, fontWeight: '500' },

  // Manual Input
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.navyDark,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.navyDark,
    marginBottom: 14,
    lineHeight: 22,
  },

  // Note Banner
  noteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 20,
  },
  noteIcon: { fontSize: 14 },
  noteText: { fontSize: 12, color: COLORS.gray, fontWeight: '500' },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.gray },
  saveBtn: {
    flex: 2,
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
