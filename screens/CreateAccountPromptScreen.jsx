import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { setPasswordFromGuest, sendGuestAccountOtp } from '../utils/auth';

const COLORS = {
  navy: '#1B3A8C',
  navyDark: '#0D1F3C',
  navyLight: '#2C4FA8',
  white: '#FFFFFF',
  offWhite: '#F4F7FB',
  lightGray: '#E8EEF5',
  gray: '#8A9BB0',
  bodyText: '#4A5568',
  border: '#D1DBE8',
  green: '#22C55E',
  greenLight: '#DCFCE7',
  red: '#E63946',
  redLight: '#FDECEC',
  amber: '#D97706',
  amberLight: '#FEF3C7',
};

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 45;

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

function IconPop({ delay = 0, children }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }),
    ]).start();
  }, []);
  return <Animated.View style={{ transform: [{ scale: anim }] }}>{children}</Animated.View>;
}

/** Gentle pulsing ring behind the header icon — draws the eye, feels alive. */
function PulsingRing({ color }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        {
          borderColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
        },
      ]}
    />
  );
}

/** Single wide OTP input — matches VerifyOtpScreen's style, with focus/error states and a shake on error. */
function OtpInput({ value, onChangeText, error, inputRef }) {
  const [focused, setFocused] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const prevError = useRef(false);

  useEffect(() => {
    if (error && !prevError.current) {
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]).start();
    }
    prevError.current = !!error;
  }, [error]);

  return (
    <Animated.View
      style={{
        transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }],
      }}
    >
      <TextInput
        ref={inputRef}
        style={[
          styles.otpInput,
          focused && styles.otpInputFocused,
          !!value && styles.otpInputFilled,
          error && styles.otpInputError,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder="000000"
        placeholderTextColor={COLORS.gray}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        textAlign="center"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={COLORS.navy}
      />
    </Animated.View>
  );
}

function PasswordField({ label, value, onChangeText, error, delay, placeholder }) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <FadeInUp delay={delay}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldWrap, focused && styles.fieldWrapFocused, error && styles.fieldWrapError]}>
        <Ionicons
          name="lock-closed-outline"
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
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <TouchableOpacity onPress={() => setVisible((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.gray} />
        </TouchableOpacity>
      </View>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </FadeInUp>
  );
}

/** Animated strength meter — three segments that light up and re-color as the password gets stronger. */
function PasswordStrengthMeter({ password }) {
  const score = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/[0-9]/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password)) s++;
    return s;
  })();

  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    anims.forEach((a, i) => {
      Animated.timing(a, {
        toValue: i < score ? 1 : 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [score]);

  if (!password) return null;

  const meterColor = score <= 1 ? COLORS.red : score === 2 ? COLORS.amber : COLORS.green;
  const meterLabel = score <= 1 ? 'Weak' : score === 2 ? 'Good' : 'Strong';

  return (
    <View style={styles.strengthWrap}>
      <View style={styles.strengthBars}>
        {anims.map((a, i) => (
          <View key={i} style={styles.strengthTrack}>
            <Animated.View
              style={[
                styles.strengthFill,
                {
                  backgroundColor: meterColor,
                  width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: meterColor }]}>{meterLabel}</Text>
    </View>
  );
}

function validatePassword(pw) {
  if (!pw || pw.length < 8 || pw.length > 20) return 'Password must be between 8 and 20 characters.';
  if (!/[A-Z]/.test(pw)) return 'Add at least one uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Add at least one lowercase letter.';
  if (!/[0-9]/.test(pw)) return 'Add at least one number.';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) return 'Add at least one special character.';
  return null;
}

export default function CreateAccountPromptScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const appointmentId = route?.params?.appointmentId || null;

  const [otpCode, setOtpCode] = useState('');
  const otpInputRef = useRef(null);

  const [sendingOtp, setSendingOtp] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const goToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'PatientHome', params: { appointmentId } }],
    });
  };

  const requestOtp = useCallback(async (isResend = false) => {
    setSendingOtp(true);
    setErrors((e) => ({ ...e, otp: '' }));
    try {
      await sendGuestAccountOtp();
      setOtpSent(true);
      setResendCooldown(RESEND_COOLDOWN);
      if (isResend) {
        setOtpCode('');
        otpInputRef.current?.focus();
      }
    } catch (err) {
      setErrors((e) => ({ ...e, otp: err.message || 'Could not send verification code. Please try again.' }));
    } finally {
      setSendingOtp(false);
    }
  }, []);

  useEffect(() => {
    requestOtp(false);
  }, [requestOtp]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleOtpChange = (text) => {
    setOtpCode(text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH));
    setErrors((e) => ({ ...e, otp: '' }));
  };

  const handleCreateAccount = async () => {
    const nextErrors = {};

    if (otpCode.length !== OTP_LENGTH) {
      nextErrors.otp = 'Enter the 6-digit code we emailed you.';
    }
    const pwError = validatePassword(password);
    if (pwError) nextErrors.password = pwError;
    if (password !== confirmPassword) nextErrors.confirm = 'Passwords do not match.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await setPasswordFromGuest(password, otpCode);
      Alert.alert('Account created!', 'You can now log in anytime with this password.', [
        { text: 'Continue', onPress: goToHome },
      ]);
    } catch (err) {
      setErrors({ otp: err.message || 'Could not create your account. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={40}
        keyboardOpeningTime={0}
      >
        <FadeInUp delay={0}>
          <View style={styles.iconRingWrap}>
            <PulsingRing color={COLORS.green} />
            <LinearGradient
              colors={[COLORS.green, '#16A34A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconRing}
            >
              <IconPop delay={120}>
                <Ionicons name="checkmark-done" size={26} color={COLORS.white} />
              </IconPop>
            </LinearGradient>
          </View>
          <Text style={styles.title}>Booking confirmed!</Text>
          <Text style={styles.subtitle}>
            Create an account to track your appointment, view reports, and manage future bookings.
          </Text>
        </FadeInUp>

        {/* ── Email verification ── */}
        <FadeInUp delay={90} style={{ marginTop: 28 }}>
          <View style={styles.stepHeaderRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Verify your email</Text>
          </View>
          <Text style={styles.stepHint}>
            {sendingOtp && !otpSent
              ? 'Sending a verification code to your email…'
              : 'Enter the 6-digit code we just emailed you.'}
          </Text>

          <OtpInput
            value={otpCode}
            onChangeText={handleOtpChange}
            error={!!errors.otp}
            inputRef={otpInputRef}
          />
          {!!errors.otp && <Text style={styles.fieldError}>{errors.otp}</Text>}

          <View style={styles.resendRow}>
            {resendCooldown > 0 ? (
              <Text style={styles.resendHint}>Resend code in {resendCooldown}s</Text>
            ) : (
              <TouchableOpacity onPress={() => requestOtp(true)} disabled={sendingOtp}>
                <Text style={styles.resendLink}>
                  {sendingOtp ? 'Sending…' : "Didn't get it? Resend code"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </FadeInUp>

        {/* ── Password ── */}
        <FadeInUp delay={140} style={{ marginTop: 28 }}>
          <View style={styles.stepHeaderRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <Text style={styles.stepTitle}>Choose a password</Text>
          </View>
        </FadeInUp>

        <View style={{ marginTop: 14, gap: 16 }}>
          <PasswordField
            label="Password"
            value={password}
            onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })); }}
            placeholder="8-20 characters"
            error={errors.password}
            delay={170}
          />
          {!!password && <PasswordStrengthMeter password={password} />}

          <PasswordField
            label="Confirm password"
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirm: '' })); }}
            placeholder="Re-enter password"
            error={errors.confirm}
            delay={210}
          />
        </View>

        <FadeInUp delay={250} style={{ marginTop: 14 }}>
          <View style={styles.hintBox}>
            <Ionicons name="information-circle-outline" size={15} color={COLORS.gray} style={{ marginRight: 8, marginTop: 1 }} />
            <Text style={styles.hintText}>
              Use 8-20 characters with an uppercase letter, a lowercase letter, a number, and a special character.
            </Text>
          </View>
        </FadeInUp>
      </KeyboardAwareScrollView>

      <View style={styles.footer}>
        <AnimatedPressable
          style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
          onPress={handleCreateAccount}
          disabled={submitting}
          scaleTo={0.97}
        >
          {submitting
            ? <ActivityIndicator color={COLORS.white} size="small" />
            : <Text style={styles.primaryBtnText}>Create account</Text>}
        </AnimatedPressable>

        <TouchableOpacity onPress={goToHome} disabled={submitting} style={{ marginTop: 14 }}>
          <Text style={styles.laterText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 32, paddingBottom: 40 },

  iconRingWrap: {
    width: 60, height: 60,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  pulseRing: {
    position: 'absolute',
    width: 60, height: 60, borderRadius: 18, borderWidth: 2,
  },
  iconRing: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.navyDark, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.gray, lineHeight: 20 },

  stepHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  stepTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navyDark },
  stepHint: { fontSize: 12.5, color: COLORS.gray, marginBottom: 16, lineHeight: 18 },

  otpInput: {
    backgroundColor: COLORS.offWhite,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 16,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 10,
    color: COLORS.navyDark,
  },
  otpInputFocused: { borderColor: COLORS.navy, backgroundColor: COLORS.white },
  otpInputFilled: { borderColor: COLORS.navy, backgroundColor: '#F0F4FF' },
  otpInputError: { borderColor: COLORS.red, backgroundColor: COLORS.redLight },

  resendRow: { marginTop: 12, alignItems: 'center' },
  resendHint: { fontSize: 12.5, color: COLORS.gray, fontWeight: '600' },
  resendLink: { fontSize: 12.5, color: COLORS.navy, fontWeight: '800' },

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

  strengthWrap: { marginTop: -4 },
  strengthBars: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  strengthTrack: {
    flex: 1, height: 5, borderRadius: 3,
    backgroundColor: COLORS.lightGray, overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: 3 },
  strengthLabel: { fontSize: 11.5, fontWeight: '800' },

  hintBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.offWhite,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hintText: { flex: 1, fontSize: 12, color: COLORS.gray, lineHeight: 18 },

  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  primaryBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.75 },
  primaryBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  laterText: { textAlign: 'center', fontSize: 14, color: COLORS.gray, fontWeight: '600' },
});