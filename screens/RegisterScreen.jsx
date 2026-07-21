import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; // swap for your icon lib if different

const COUNTRY_CODES = [
  { code: '+1', country: '🇺🇸 USA / Canada' },
  { code: '+91', country: '🇮🇳 India' },
  { code: '+44', country: '🇬🇧 UK' },
  { code: '+61', country: '🇦🇺 Australia' },
  { code: '+971', country: '🇦🇪 UAE' },
  { code: '+65', country: '🇸🇬 Singapore' },
  { code: '+81', country: '🇯🇵 Japan' },
  { code: '+49', country: '🇩🇪 Germany' },
  { code: '+33', country: '🇫🇷 France' },
  { code: '+86', country: '🇨🇳 China' },
  { code: '+55', country: '🇧🇷 Brazil' },
  { code: '+27', country: '🇿🇦 South Africa' },
  { code: '+92', country: '🇵🇰 Pakistan' },
  { code: '+880', country: '🇧🇩 Bangladesh' },
  { code: '+94', country: '🇱🇰 Sri Lanka' },
  { code: '+977', country: '🇳🇵 Nepal' },
  { code: '+60', country: '🇲🇾 Malaysia' },
  { code: '+966', country: '🇸🇦 Saudi Arabia' },
  { code: '+20', country: '🇪🇬 Egypt' },
  { code: '+234', country: '🇳🇬 Nigeria' },
  { code: '+254', country: '🇰🇪 Kenya' },
  { code: '+39', country: '🇮🇹 Italy' },
  { code: '+34', country: '🇪🇸 Spain' },
  { code: '+7', country: '🇷🇺 Russia' },
  { code: '+82', country: '🇰🇷 South Korea' },
  { code: '+52', country: '🇲🇽 Mexico' },
  { code: '+31', country: '🇳🇱 Netherlands' },
  { code: '+46', country: '🇸🇪 Sweden' },
  { code: '+41', country: '🇨🇭 Switzerland' },
  { code: '+90', country: '🇹🇷 Turkey' },
];

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

function generateSessionToken() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
// Oldest allowed DOB year = current year - 100, newest = current year (auto-updates every year)
const CURRENT_YEAR = new Date().getFullYear();
const MIN_DOB_YEAR = CURRENT_YEAR - 100;
const MAX_DOB_YEAR = CURRENT_YEAR;

const USA_CODE = COUNTRY_CODES.find((c) => c.code === '+1');

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dob: '',
    address: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState('');
  const sessionTokenRef = useRef(generateSessionToken());
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countryCode, setCountryCode] = useState(USA_CODE);
  const [showPicker, setShowPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const filteredCountries = COUNTRY_CODES.filter(
    (item) =>
      item.country.toLowerCase().includes(countrySearch.toLowerCase()) ||
      item.code.includes(countrySearch)
  );

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  // Auto-formats digits into MM/DD/YYYY as the user types
  const handleDobChange = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    handleChange('dob', formatted);
  };

  // Formats a raw digit string into US-style (555) 123-4567 as the user types.
  // Only applied when the selected country code is +1 (USA/Canada); other
  // countries just get the raw digits since formats vary widely.
  const formatUsPhoneNumber = (digits) => {
    const d = digits.slice(0, 10);
    if (d.length === 0) return '';
    if (d.length < 4) return `(${d}`;
    if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const handlePhoneChange = (value) => {
    const digits = value.replace(/\D/g, '');
    if (countryCode.code === '+1') {
      handleChange('phone', formatUsPhoneNumber(digits));
    } else {
      handleChange('phone', digits);
    }
  };

  // When the user switches country code, re-format (or strip formatting from)
  // whatever digits are currently in the phone field.
  const handleSelectCountryCode = (item) => {
    const digits = form.phone.replace(/\D/g, '');
    setCountryCode(item);
    if (item.code === '+1') {
      handleChange('phone', formatUsPhoneNumber(digits));
    } else {
      handleChange('phone', digits);
    }
    setShowPicker(false);
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!form.address || form.address.trim().length < MIN_QUERY_LENGTH) {
      setAddressSuggestions([]);
      setAddressSearchError('');
      return;
    }
    if (!PLACES_API_KEY) {
      setAddressSearchError('Autocomplete unavailable — missing API key.');
      return;
    }

    debounceRef.current = setTimeout(() => {
      fetchAddressSuggestions(form.address.trim());
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [form.address]);

  const fetchAddressSuggestions = async (input) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAddressSearchLoading(true);
    setAddressSearchError('');
    try {
      const params = new URLSearchParams({
        input,
        key: PLACES_API_KEY,
        types: 'address',
        sessiontoken: sessionTokenRef.current,
      });
      const res = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`, { signal: controller.signal });
      const data = await res.json();

      if (data.status === 'OK') {
        setAddressSuggestions(data.predictions || []);
      } else if (data.status === 'ZERO_RESULTS') {
        setAddressSuggestions([]);
      } else {
        setAddressSuggestions([]);
        setAddressSearchError(data.error_message || `Autocomplete error: ${data.status}`);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setAddressSearchError('Could not reach address search. Check your connection.');
      }
    } finally {
      setAddressSearchLoading(false);
    }
  };

  const handleSelectAddressSuggestion = async (prediction) => {
    setAddressSearchLoading(true);
    setAddressSearchError('');
    try {
      const params = new URLSearchParams({
        place_id: prediction.place_id,
        key: PLACES_API_KEY,
        sessiontoken: sessionTokenRef.current,
        fields: 'formatted_address',
      });
      const res = await fetch(`${DETAILS_URL}?${params.toString()}`);
      const data = await res.json();
      if (data.status !== 'OK') throw new Error(data.error_message || `Details error: ${data.status}`);

      const address = data.result.formatted_address || prediction.description;
      setForm((prev) => ({ ...prev, address }));
      setAddressSuggestions([]);
      sessionTokenRef.current = generateSessionToken();
    } catch (err) {
      setAddressSearchError(err.message || 'Could not load address details.');
    } finally {
      setAddressSearchLoading(false);
    }
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Returns null if valid, or an error message string
  const validateDob = (value) => {
    if (!value.trim()) return null; // DOB is optional on this screen
    const digits = value.replace(/\D/g, '');
    if (digits.length < 8) return 'Please enter a complete date of birth.';

    const month = parseInt(digits.slice(0, 2), 10);
    const day = parseInt(digits.slice(2, 4), 10);
    const year = parseInt(digits.slice(4, 8), 10);
    const dateObj = new Date(year, month - 1, day);
    const isRealDate =
      dateObj.getFullYear() === year &&
      dateObj.getMonth() === month - 1 &&
      dateObj.getDate() === day;

    if (month < 1 || month > 12 || day < 1 || day > 31 || !isRealDate) {
      return 'Please enter a valid date of birth.';
    }
    if (year < MIN_DOB_YEAR || year > MAX_DOB_YEAR || dateObj > new Date()) {
      return 'Please enter a valid date of birth.';
    }
    return null;
  };

  const handleContinue = () => {
    if (!form.firstName.trim()) {
      Alert.alert('First name required', 'Please enter your first name to continue.');
      return;
    }
    if (!form.lastName.trim()) {
      Alert.alert('Last name required', 'Please enter your last name to continue.');
      return;
    }
    const dobError = validateDob(form.dob);
    if (dobError) {
      Alert.alert('Invalid date of birth', dobError);
      return;
    }
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length < 7) {
      Alert.alert('Phone number required', 'Please enter a valid phone number to continue.');
      return;
    }
    if (!form.email.trim()) {
      Alert.alert('Email required', 'Please enter your email address to continue.');
      return;
    }
    if (!isValidEmail(form.email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (!form.password || form.password.length < 6) {
      Alert.alert('Password required', 'Please choose a password of at least 6 characters.');
      return;
    }
    if (!form.confirmPassword) {
      Alert.alert('Confirm password required', 'Please re-enter your password to continue.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert('Passwords don\u2019t match', 'Please re-enter matching passwords.');
      return;
    }
    // Document upload now happens on step 2 (licence, certificate, insurance),
    // which is the only step that actually submits documents to the backend.
    navigation.navigate('RegisterScreen2', {
      firstName: form.firstName,
      middleName: form.middleName,
      lastName: form.lastName,
      dob: form.dob,
      address: form.address,
      phone: `${countryCode.code}${phoneDigits}`,
      email: form.email,
      password: form.password,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F6FA" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color="#0D2156" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View style={styles.headerText}>
              <Text style={styles.stepTitle}>Register — step 1{'\n'}of 3</Text>
              <Text style={styles.stepSubtitle}>Personal information</Text>
            </View>
            <View style={styles.progressDots}>
              <View style={[styles.dot, styles.dotActive]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>
              First name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor="#BBBDC4"
              value={form.firstName}
              onChangeText={(v) => handleChange('firstName', v)}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Middle name</Text>
            <TextInput
              style={styles.input}
              placeholder="Middle name (optional)"
              placeholderTextColor="#BBBDC4"
              value={form.middleName}
              onChangeText={(v) => handleChange('middleName', v)}
              autoCapitalize="words"
            />

            <Text style={styles.label}>
              Last name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor="#BBBDC4"
              value={form.lastName}
              onChangeText={(v) => handleChange('lastName', v)}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Date of birth</Text>
            <TextInput
              style={styles.input}
              placeholder="MM/DD/YYYY"
              placeholderTextColor="#BBBDC4"
              value={form.dob}
              onChangeText={handleDobChange}
              keyboardType="numeric"
              maxLength={10}
            />

            <Text style={styles.label}>Home address</Text>
            <View style={styles.inputWithIconWrap}>
              <TextInput
                style={styles.input}
                placeholder="123 Main St, Tampa, FL"
                placeholderTextColor="#BBBDC4"
                value={form.address}
                onChangeText={(v) => handleChange('address', v)}
              />
              {addressSearchLoading && (
                <ActivityIndicator color="#0D2156" size="small" style={styles.inputSpinner} />
              )}
            </View>
            {addressSuggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                {addressSuggestions.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={styles.suggestionRow}
                    onPress={() => handleSelectAddressSuggestion(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="location-outline" size={16} color="#8A92A6" />
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
            {addressSearchError ? <Text style={{ color: '#E0453D', fontSize: 12, marginTop: 6, fontWeight: '500' }}>⚠ {addressSearchError}</Text> : null}

            <Text style={styles.label}>
              Phone number <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.phoneRow}>
              <TouchableOpacity
                style={styles.countryCodeBtn}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.countryCodeText}>{countryCode.code} ▾</Text>
              </TouchableOpacity>
              <View style={styles.phoneDivider} />
              <TextInput
                style={styles.phoneInput}
                value={form.phone}
                onChangeText={handlePhoneChange}
                placeholder={countryCode.code === '+1' ? '(555) 123-4567' : 'Enter phone number'}
                placeholderTextColor="#BBBDC4"
                keyboardType="phone-pad"
                maxLength={countryCode.code === '+1' ? 14 : 15}
              />
            </View>

            <Text style={styles.label}>
              Email address <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#BBBDC4"
              value={form.email}
              onChangeText={(v) => handleChange('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>
              Create a password <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="At least 6 characters"
                placeholderTextColor="#BBBDC4"
                value={form.password}
                onChangeText={(v) => handleChange('password', v)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#8A92A6"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>
              Confirm password <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Re-enter your password"
                placeholderTextColor="#BBBDC4"
                value={form.confirmPassword}
                onChangeText={(v) => handleChange('confirmPassword', v)}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#8A92A6"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.nextButtonText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Code Picker Modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Country Code</Text>
            <TextInput
              placeholder="Search country or code..."
              placeholderTextColor="#8A92A6"
              value={countrySearch}
              onChangeText={setCountrySearch}
              style={styles.searchInput}
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    item.code === countryCode.code && styles.modalItemActive,
                  ]}
                  onPress={() => handleSelectCountryCode(item)}
                >
                  <Text style={styles.modalItemCountry}>{item.country}</Text>
                  <Text
                    style={[
                      styles.modalItemCode,
                      item.code === countryCode.code && styles.modalItemCodeActive,
                    ]}
                  >
                    {item.code}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    shadowColor: '#0D2156',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
    gap: 12,
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  headerText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D2156',
    lineHeight: 22,
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#8A92A6',
    marginTop: 2,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    paddingTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D4E0',
  },
  dotActive: {
    backgroundColor: '#0D2156',
    width: 20,
    borderRadius: 4,
  },

  form: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: '#5A6275',
    marginBottom: 4,
    marginTop: 10,
    fontWeight: '600',
  },
  required: {
    color: '#E0453D',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0D2156',
    borderWidth: 1,
    borderColor: '#E8EAF0',
    shadowColor: '#0D2156',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },

  // Phone row (country code + number)
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    shadowColor: '#0D2156',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
  },
  countryCodeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#F5F6FA',
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D2156',
  },
  phoneDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E8EAF0',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0D2156',
  },

  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    shadowColor: '#0D2156',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    paddingRight: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0D2156',
  },
  eyeButton: {
    padding: 8,
  },

  nextButton: {
    backgroundColor: '#0D2156',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
    shadowColor: '#0D2156',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // Country picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8EAF0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D2156',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EAF0',
  },
  modalItemActive: {
    backgroundColor: '#EBF0FB',
  },
  modalItemCountry: {
    fontSize: 15,
    color: '#0D2156',
    fontWeight: '500',
  },
  modalItemCode: {
    fontSize: 15,
    color: '#8A92A6',
    fontWeight: '600',
  },
  modalItemCodeActive: {
    color: '#0D2156',
    fontWeight: '800',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E8EAF0',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 15,
    color: '#0D2156',
    backgroundColor: '#FFFFFF',
  },
  inputWithIconWrap: { position: 'relative', justifyContent: 'center' },
inputSpinner: { position: 'absolute', right: 14 },
suggestionsBox: {
  borderWidth: 1,
  borderColor: '#E8EAF0',
  borderRadius: 12,
  marginTop: 6,
  backgroundColor: '#FFFFFF',
  overflow: 'hidden',
  maxHeight: 220,
},
suggestionRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  paddingHorizontal: 14,
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#E8EAF0',
},
suggestionMain: { fontSize: 14, fontWeight: '600', color: '#0D2156' },
suggestionSecondary: { fontSize: 12, color: '#8A92A6', marginTop: 1 },
});