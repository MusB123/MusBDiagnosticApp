import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

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

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Lightweight session-token generator (Google bills autocomplete+details as
// one session when a token is shared across the request sequence).
function generateSessionToken() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function extractPostalCode(components = []) {
  const match = components.find((c) => c.types.includes('postal_code'));
  return match?.long_name || '';
}

export default function AddressBar({ value, onChange }) {
  const [showModal, setShowModal] = useState(false);
  const [manualAddress, setManualAddress] = useState(value || '');
  const [loading, setLoading] = useState(false);
  const [manualZip, setManualZip] = useState('');
  const [zipError, setZipError] = useState('');

  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const sessionTokenRef = useRef(generateSessionToken());
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  // Keep internal draft in sync if the parent's value changes externally
  // (e.g. on remount, or if address is set from another screen/source)
  useEffect(() => {
    setManualAddress(value || '');
  }, [value]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Debounced autocomplete search — fires ~350ms after typing stops, and
  // cancels any in-flight request from a previous keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!manualAddress || manualAddress.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setSearchError('');
      return;
    }

    if (!PLACES_API_KEY) {
      setSearchError('Autocomplete unavailable — missing API key.');
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(manualAddress.trim());
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [manualAddress]);

  const fetchSuggestions = async (input) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearchLoading(true);
    setSearchError('');
    try {
      const params = new URLSearchParams({
        input,
        key: PLACES_API_KEY,
        types: 'address',
        sessiontoken: sessionTokenRef.current,
      });

      const res = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await res.json();

      if (data.status === 'OK') {
        setSuggestions(data.predictions || []);
      } else if (data.status === 'ZERO_RESULTS') {
        setSuggestions([]);
      } else {
        // REQUEST_DENIED (bad/restricted key), INVALID_REQUEST, OVER_QUERY_LIMIT, etc.
        setSuggestions([]);
        setSearchError(data.error_message || `Autocomplete error: ${data.status}`);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setSearchError('Could not reach address search. Check your connection.');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSuggestion = async (prediction) => {
    setSearchLoading(true);
    setSearchError('');
    try {
      const params = new URLSearchParams({
        place_id: prediction.place_id,
        key: PLACES_API_KEY,
        sessiontoken: sessionTokenRef.current,
        fields: 'formatted_address,geometry,address_components',
      });

      const res = await fetch(`${DETAILS_URL}?${params.toString()}`);
      const data = await res.json();

      if (data.status !== 'OK') {
        throw new Error(data.error_message || `Details error: ${data.status}`);
      }

      const result = data.result;
      const postal = extractPostalCode(result.address_components);
      const address = result.formatted_address || prediction.description;

      setManualAddress(address);
      setManualZip(postal);
      setZipError('');
      setSuggestions([]);

      // Fresh session token for the next independent search sequence.
      sessionTokenRef.current = generateSessionToken();

      onChange({
        address,
        latitude: result.geometry?.location?.lat ?? null,
        longitude: result.geometry?.location?.lng ?? null,
        useGps: false,
        zipCode: postal,
      });
      setShowModal(false);
    } catch (err) {
      setSearchError(err.message || 'Could not load address details.');
    } finally {
      setSearchLoading(false);
    }
  };

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
        setSuggestions([]);

        onChange({
          address,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          useGps: true,
          zipCode: postal,
        });
        setShowModal(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get your location. Please enter manually.');
    }
    setLoading(false);
  };

  const handleSaveManual = () => {
    if (!manualAddress.trim()) {
      Alert.alert('Enter Address', 'Please enter a valid address.');
      return;
    }
    if (!manualZip.trim()) {
      setZipError('Zip / PIN code is required');
      return;
    }
    onChange({
      address: manualAddress.trim(),
      latitude: null,
      longitude: null,
      useGps: false,
      zipCode: manualZip.trim(),
    });
    setSuggestions([]);
    setShowModal(false);
  };

  return (
    <>
      {/* Address Bar - tap to open modal */}
      <TouchableOpacity
        style={styles.addressBar}
        onPress={() => setShowModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="location" size={16} color={COLORS.navyDark} />
        <Text style={styles.addressText} numberOfLines={1}>
          {value || 'Set your address'}
        </Text>
        <Ionicons name="create-outline" size={16} color={COLORS.navyDark} />
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.modalSheet,
                // Cap the sheet height so it can never grow past the screen
                // and push the input off the top when the keyboard is open.
                { maxHeight: SCREEN_HEIGHT * (keyboardVisible ? 0.9 : 0.85) },
              ]}
            >
              <View style={styles.modalHandle} />

              <ScrollView
                ref={scrollRef}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
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
                     <Ionicons name="navigate" size={24} color={COLORS.navyDark} />
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
                  <Text style={styles.dividerText}>or search an address</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Manual / Autocomplete Entry */}
                <Text style={styles.inputLabel}>Enter address</Text>
                <View style={styles.inputWithIconWrap}>
                  <TextInput
                    style={styles.input}
                    value={manualAddress}
                    onChangeText={setManualAddress}
                    placeholder="Start typing an address…"
                    placeholderTextColor={COLORS.gray}
                    onFocus={() => {
                      // Make sure the input is scrolled into view once the
                      // keyboard (and any suggestions) appear.
                      requestAnimationFrame(() => {
                        scrollRef.current?.scrollTo({ y: 0, animated: true });
                      });
                    }}
                  />
                  {searchLoading && (
                    <ActivityIndicator
                      color={COLORS.navy}
                      size="small"
                      style={styles.inputSpinner}
                    />
                  )}
                </View>

                {/* Suggestions dropdown */}
                {suggestions.length > 0 && (
                  <View style={styles.suggestionsBox}>
                    {suggestions.map((item) => (
                      <TouchableOpacity
                        key={item.place_id}
                        style={styles.suggestionRow}
                        onPress={() => handleSelectSuggestion(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="location-outline" size={16} color={COLORS.gray} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestionMain} numberOfLines={1}>
                            {item.structured_formatting?.main_text || item.description}
                          </Text>
                          {item.structured_formatting?.secondary_text ? (
                            <Text style={styles.suggestionSecondary} numberOfLines={1}>
                              {item.structured_formatting.secondary_text}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {searchError ? <Text style={styles.errorText}>⚠ {searchError}</Text> : null}

                {/* Hide the zip field while suggestions are open so the list
                    isn't competing for space with unrelated inputs. */}
                {suggestions.length === 0 && (
                  <>
                    <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                      Zip / PIN code <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        zipError ? styles.inputError : null,
                        { marginBottom: zipError ? 6 : 20 },
                      ]}
                      value={manualZip}
                      onChangeText={(t) => { setManualZip(t); if (zipError) setZipError(''); }}
                      placeholder="e.g. 12345"
                      placeholderTextColor={COLORS.gray}
                      keyboardType="number-pad"
                      maxLength={10}
                    />
                    {zipError ? <Text style={styles.errorText}>⚠ {zipError}</Text> : null}
                  </>
                )}

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
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
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
  addressText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.navyDark,
    fontWeight: '500',
  },

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
    paddingBottom: 24,
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
  required: {
    color: COLORS.error,
    fontSize: 13,
  },
  inputWithIconWrap: { position: 'relative', justifyContent: 'center' },
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
  inputSpinner: { position: 'absolute', right: 14 },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: '#FFF0F1',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginBottom: 14,
    fontWeight: '500',
  },

  // Suggestions dropdown
  suggestionsBox: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    marginTop: -8,
    marginBottom: 14,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
    maxHeight: 260,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  suggestionMain: { fontSize: 14, fontWeight: '600', color: COLORS.navyDark },
  suggestionSecondary: { fontSize: 12, color: COLORS.gray, marginTop: 1 },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
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
