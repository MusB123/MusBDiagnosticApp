import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestOtp } from '../utils/auth';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  navy: '#1B3A8C',
  navyDark: '#0D1F3C',
  white: '#FFFFFF',
  offWhite: '#F4F7FB',
  lightGray: '#E8EEF5',
  gray: '#8A9BB0',
  bodyText: '#4A5568',
  border: '#D1DBE8',
  inputBg: '#FFFFFF',
  error: '#E63946',
  errorBorder: '#E63946',
};

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

export default function CreateAccountScreen({ navigation }) {

  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dob: '',
    phone: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const filteredCountries = COUNTRY_CODES.filter(
  item =>
    item.country.toLowerCase().includes(countrySearch.toLowerCase()) ||
    item.code.includes(countrySearch)
  );

  const handleDOB = (text) => {
    const clean = text.replace(/\D/g, '');
    let formatted = clean;
    if (clean.length >= 3 && clean.length <= 4) {
      formatted = clean.slice(0, 2) + ' / ' + clean.slice(2);
    } else if (clean.length > 4) {
      formatted = clean.slice(0, 2) + ' / ' + clean.slice(2, 4) + ' / ' + clean.slice(4, 8);
    }
    setForm({ ...form, dob: formatted });
    if (errors.dob) setErrors({ ...errors, dob: '' });
  };

  const handlePhone = (text) => {
    const clean = text.replace(/\D/g, '');
    setForm({ ...form, phone: clean });
    if (errors.phone) setErrors({ ...errors, phone: '' });
  };

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const dobClean = form.dob.replace(/\D/g, '');

    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!form.dob.trim() || dobClean.length < 8) newErrors.dob = 'Enter a valid date of birth';
    if (!form.phone.trim() || form.phone.length < 7) newErrors.phone = 'Enter a valid phone number';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(form.email)) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!form.password.trim() || form.password.length < 10) {
      newErrors.password = 'Password must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await requestOtp(form.email.trim().toLowerCase(), `${countryCode.code}${form.phone}`);
      navigation.navigate('PatientVerifyOtp', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: `${countryCode.code}${form.phone}`,
      });
    } catch (err) {
      const msg = err.message === 'NETWORK_ERROR'
        ? "Can't reach the server. Check your connection."
        : err.message === 'BAD_RESPONSE'
        ? 'Unexpected server response. Try again.'
        : err.message;
      setErrors({ email: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>MusB</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Create account</Text>
            <Text style={styles.headerStep}>Step 1 of 2</Text>
          </View>
          <View style={styles.progressDots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* First Name - required */}
          <InputField
            label="First name"
            required
            value={form.firstName}
            onChangeText={(t) => { setForm({ ...form, firstName: t }); if (errors.firstName) setErrors({ ...errors, firstName: '' }); }}
            placeholder="First name"
            error={errors.firstName}
          /> 

          {/*Middle name*/}
          <InputField
            label="Middle name"
            value={form.middleName}
            onChangeText={(t) => setForm({ ...form, middleName: t })}
            placeholder="Middle name (optional)"
          />

          {/* Last Name */}
          <InputField
            label="Last name"
            required
            value={form.lastName}
            onChangeText={(t) => {setForm({ ...form, lastName: t }); if (errors.lastName) setErrors({ ...errors, lastName: '' }); }}
            placeholder="Last name"
            error={errors.lastName}
          />

          {/* Date of Birth - required */}
          <InputField
            label="Date of birth"
            required
            value={form.dob}
            onChangeText={handleDOB}
            placeholder="MM / DD / YYYY"
            keyboardType="numeric"
            maxLength={14}
            error={errors.dob}
          />

          {/* Phone - required with country picker */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>
              Phone number <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.phoneRow, errors.phone ? styles.phoneRowError : null]}>
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
                onChangeText={handlePhone}
                placeholder="Enter phone number"
                placeholderTextColor={COLORS.gray}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
            {errors.phone ? <Text style={styles.errorText}>⚠ {errors.phone}</Text> : null}
          </View>

          {/* Email - required */}
          <InputField
            label="Email"
            required
            value={form.email}
            onChangeText={(t) => { setForm({ ...form, email: t }); if (errors.email) setErrors({ ...errors, email: '' }); }}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          {/* Password - required */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>
              Password <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.passwordRow, errors.password ? styles.inputError : null]}>
              <TextInput
                style={styles.passwordInput}
                value={form.password}
                onChangeText={(t) => { setForm({ ...form, password: t }); if (errors.password) setErrors({ ...errors, password: '' }); }}
                placeholder="At least 10 characters"
                placeholderTextColor={COLORS.gray}
                autoCapitalize="none"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={COLORS.gray}
                />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>⚠ {errors.password}</Text> : null}
          </View>

        <TouchableOpacity
            style={[styles.continueBtn, loading && { opacity: 0.6 }]}
            activeOpacity={0.85}
            onPress={handleContinue}
            disabled={loading}
          >
            <Text style={styles.continueBtnText}>{loading ? 'Sending code...' : 'Continue →'}</Text>
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
              placeholderTextColor={COLORS.gray}
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
                  <Text style={[
                    styles.modalItemCode,
                    item.code === countryCode.code && styles.modalItemCodeActive,
                  ]}>
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

const InputField = ({ label, value, onChangeText, placeholder, keyboardType, maxLength, autoCapitalize, error, required,secureTextEntry }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.label}>
      {label} {required && <Text style={styles.required}>*</Text>}
    </Text>
    <TextInput
      style={[styles.input, error ? styles.inputError : null]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.gray}
      keyboardType={keyboardType || 'default'}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize || 'words'}
      secureTextEntry={secureTextEntry}
    />
    {error ? <Text style={styles.errorText}>⚠ {error}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    gap: 12,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navyDark,
  },
  headerStep: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 1,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.lightGray,
  },
  dotActive: {
    backgroundColor: COLORS.navy,
  },

  // Form
  scroll: { flex: 1 },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  fieldWrap: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    color: COLORS.bodyText,
    marginBottom: 8,
    fontWeight: '500',
  },
  required: {
    color: COLORS.error,
    fontSize: 13,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.navyDark,
  },
  inputError: {
    borderColor: COLORS.errorBorder,
    backgroundColor: '#FFF0F1',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },

  // Phone row
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  phoneRowError: {
    borderColor: COLORS.errorBorder,
    backgroundColor: '#FFF0F1',
  },
  countryCodeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: COLORS.offWhite,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navyDark,
  },
  phoneDivider: {
    width: 1.5,
    height: 24,
    backgroundColor: COLORS.border,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.navyDark,
  },
  passwordRow: {
   flexDirection: 'row',
   alignItems: 'center',
   backgroundColor: COLORS.inputBg,
   borderWidth: 1.5,
   borderColor: COLORS.border,
   borderRadius: 12,
   paddingHorizontal: 16,
 },
  passwordInput: {
   flex: 1,
   paddingVertical: 14,
   fontSize: 16,
   color: COLORS.navyDark,
 },
  eyeIcon: {
   padding: 6,
   marginLeft: 6,
 },

  // Button
  continueBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 12,
  },
  continueBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
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
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.lightGray,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navyDark,
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
    borderBottomColor: COLORS.lightGray,
  },
  modalItemActive: {
    backgroundColor: '#EBF0FB',
  },
  modalItemCountry: {
    fontSize: 15,
    color: COLORS.navyDark,
    fontWeight: '500',
  },
  modalItemCode: {
    fontSize: 15,
    color: COLORS.gray,
    fontWeight: '600',
  },
  modalItemCodeActive: {
    color: COLORS.navy,
    fontWeight: '800',
  },
  searchInput: {
  borderWidth: 1.5,
  borderColor: COLORS.border,
  borderRadius: 12,
  marginHorizontal: 20,
  marginBottom: 12,
  paddingHorizontal: 14,
  height: 50,
  fontSize: 15,
  color: COLORS.navyDark,
  backgroundColor: COLORS.white,
},
});
