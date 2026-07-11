import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; // swap for your icon lib if different

const COUNTRY_CODES = [
  { code: '+91', country: '🇮🇳 India' },
  { code: '+1', country: '🇺🇸 USA / Canada' },
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

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
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

  const handlePhoneChange = (value) => {
    const digits = value.replace(/\D/g, '');
    handleChange('phone', digits);
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleContinue = () => {
    if (!form.firstName.trim()) {
      Alert.alert('First name required', 'Please enter your first name to continue.');
      return;
    }
    if (!form.lastName.trim()) {
      Alert.alert('Last name required', 'Please enter your last name to continue.');
      return;
    }
    if (!form.phone.trim() || form.phone.length < 7) {
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
      phone: `${countryCode.code}${form.phone}`,
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
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>MusB</Text>
            </View>
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
            <TextInput
              style={styles.input}
              placeholder="123 Main St, Tampa, FL"
              placeholderTextColor="#BBBDC4"
              value={form.address}
              onChangeText={(v) => handleChange('address', v)}
            />

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
                placeholder="Enter phone number"
                placeholderTextColor="#BBBDC4"
                keyboardType="phone-pad"
                maxLength={15}
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
                  onPress={() => {
                    setCountryCode(item);
                    setShowPicker(false);
                  }}
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
  logoBox: {
    width: 44,
    height: 44,
    backgroundColor: '#0D2156',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D2156',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  logoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
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
});