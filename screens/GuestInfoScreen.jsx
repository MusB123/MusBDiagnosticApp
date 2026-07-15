import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Animated,
  Easing,
  Platform,
  Alert,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { guestCheckout } from '../utils/auth';

const COLORS = {
  navy: '#1B3A8C',
  navyDark: '#0D1F3C',
  white: '#FFFFFF',
  offWhite: '#F4F7FB',
  lightGray: '#E8EEF5',
  gray: '#8A9BB0',
  bodyText: '#4A5568',
  border: '#D1DBE8',
  red: '#E63946',
  redLight: '#FDECEC',
};

/** Springy press-scale wrapper, shared across the app. */
function AnimatedPressable({ style, onPress, disabled, children, scaleTo = 0.97, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={style}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Fades + slides a section up into place. */
function FadeInUp({ delay = 0, distance = 16, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 460,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accepts numbers with optional +, spaces, dashes, parens — requires at least 10 digits.
function isValidPhone(value) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10;
}

function FormField({ icon, label, value, onChangeText, placeholder, keyboardType, error, autoCapitalize, delay }) {
  const [focused, setFocused] = useState(false);
  return (
    <FadeInUp delay={delay}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.fieldWrap,
          focused && styles.fieldWrapFocused,
          error && styles.fieldWrapError,
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={error ? COLORS.red : focused ? COLORS.navy : COLORS.gray}
          style={{ marginRight: 10 }}
        />
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.gray}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'none'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </FadeInUp>
  );
}

export default function GuestInfoScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  // Full name is now captured as three separate required fields (First,
  // Middle, Last) and recombined into a single `fullName` string when
  // submitting / navigating onward, so every other screen that expects
  // `fullName` (CheckoutScreen, InPersonTestsScreen, bookAppointment, etc.)
  // keeps working unchanged.
  const initialNameParts = (route?.params?.fullName || '').split(' ').filter(Boolean);
  const [firstName, setFirstName] = useState(route?.params?.firstName || initialNameParts[0] || '');
  const [middleName, setMiddleName] = useState(
    route?.params?.middleName || (initialNameParts.length > 2 ? initialNameParts.slice(1, -1).join(' ') : '')
  );
  const [lastName, setLastName] = useState(
    route?.params?.lastName || (initialNameParts.length > 1 ? initialNameParts[initialNameParts.length - 1] : '')
  );
  const [phone, setPhone] = useState(route?.params?.phone || '');
  const [email, setEmail] = useState(route?.params?.email || '');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next = {};
    if (!firstName.trim()) next.firstName = 'Please enter your first name';
    if (!middleName.trim()) next.middleName = 'Please enter your middle name';
    if (!lastName.trim()) next.lastName = 'Please enter your last name';
    if (!phone.trim()) next.phone = 'Please enter a phone number';
    else if (!isValidPhone(phone)) next.phone = 'Enter a valid phone number';
    if (!email.trim()) next.email = 'Please enter an email address';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleContinue = async () => {
    if (!validate()) return;

    const combinedFullName = `${firstName.trim()} ${middleName.trim()} ${lastName.trim()}`
      .replace(/\s+/g, ' ')
      .trim();

    setSubmitting(true);
    try {
      await guestCheckout({
        name: combinedFullName,
        email: email.trim(),
        phone: phone.trim(),
      });

      const { isGuest, returnTo, ...rest } = route?.params || {};
      navigation.navigate(returnTo || 'Checkout', {
        ...rest,
        fullName: combinedFullName,
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        isGuest: true,
      });
    } catch (err) {
      Alert.alert('Could not continue', err.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={styles.header}>
        <AnimatedPressable style={styles.backBtn} onPress={() => navigation.goBack()} scaleTo={0.85}>
          <Ionicons name="arrow-back" size={20} color={COLORS.navyDark} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Your details</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={30}
        keyboardOpeningTime={0}
      >
        <FadeInUp delay={0}>
          <View style={styles.introIconRing}>
            <Ionicons name="person-circle-outline" size={28} color={COLORS.navy} />
          </View>
          <Text style={styles.introTitle}>Just a few details</Text>
          <Text style={styles.introSub}>
            We need this to confirm your appointment and send updates — no account required.
          </Text>
        </FadeInUp>

        <View style={{ marginTop: 24, gap: 16 }}>
          <FormField
            icon="person-outline"
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Jane"
            autoCapitalize="words"
            error={errors.firstName}
            delay={60}
          />
          <FormField
            icon="person-outline"
            label="Middle name"
            value={middleName}
            onChangeText={setMiddleName}
            placeholder="Marie"
            autoCapitalize="words"
            error={errors.middleName}
            delay={90}
          />
          <FormField
            icon="person-outline"
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Doe"
            autoCapitalize="words"
            error={errors.lastName}
            delay={120}
          />
          <FormField
            icon="call-outline"
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="(555) 123-4567"
            keyboardType="phone-pad"
            error={errors.phone}
            delay={150}
          />
          <FormField
            icon="mail-outline"
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="jane@example.com"
            keyboardType="email-address"
            error={errors.email}
            delay={180}
          />
        </View>

        <FadeInUp delay={220}>
          <View style={styles.guestNote}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.gray} style={{ marginRight: 8 }} />
            <Text style={styles.guestNoteText}>
              Booking as a guest. You can create an account after your visit to track appointments and view reports.
            </Text>
          </View>
        </FadeInUp>
      </KeyboardAwareScrollView>

      <View style={styles.footer}>
        <AnimatedPressable
          style={[styles.continueBtn, submitting && { opacity: 0.75 }]}
          onPress={handleContinue}
          disabled={submitting}
          scaleTo={0.97}
        >
          {submitting
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Text style={styles.continueBtnText}>Continue to checkout</Text>}
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 120 },

  introIconRing: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EAF0FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  introTitle: { fontSize: 20, fontWeight: '900', color: COLORS.navyDark, marginBottom: 6 },
  introSub: { fontSize: 13, color: COLORS.gray, lineHeight: 19 },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.bodyText, marginBottom: 8 },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 4,
  },
  fieldWrapFocused: { borderColor: COLORS.navy, backgroundColor: COLORS.white },
  fieldWrapError: { borderColor: COLORS.red, backgroundColor: COLORS.redLight },
  fieldInput: { flex: 1, fontSize: 15, color: COLORS.navyDark, fontWeight: '600' },
  fieldError: { fontSize: 12, color: COLORS.red, marginTop: 6, marginLeft: 2 },

  guestNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.offWhite,
    borderRadius: 12,
    padding: 12,
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  guestNoteText: { flex: 1, fontSize: 12, color: COLORS.gray, lineHeight: 18 },

  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  continueBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  continueBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});
