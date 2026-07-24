import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
  Alert,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

import {
  login,
  loginWithGoogle,
  requestPasswordResetOtp,
  confirmPasswordReset,
} from '../utils/auth';

const EyeIcon = ({ color = '#8A9BB0', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
      stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    />
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const EyeOffIcon = ({ color = '#8A9BB0', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M17.94 17.94A10.07 10.07 0 0112 20C5 20 1 12 1 12A18.45 18.45 0 015.06 6.06M9.9 4.24A9.12 9.12 0 0112 4C19 4 23 12 23 12A18.5 18.5 0 0120.28 16.5M14.12 14.12A3 3 0 119.88 9.88"
      stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    />
    <Line x1="1" y1="1" x2="23" y2="23" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
  </Svg>
);

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
  inputBg: '#FFFFFF',
  error: '#E63946',
  errorBorder: '#E63946',
  success: '#22C55E',
};

// ── Reusable animated primitives ────────────────────────────────────────────
function FadeInUp({ delay = 0, distance = 18, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 520,
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

function AnimatedPressable({ style, onPress, children, scaleTo = 0.96, disabled, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={style}
        disabled={disabled}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Logo card that pops in with a soft overshoot + gentle floating glow ring. */
function LogoCard() {
  const pop = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 12 }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={styles.logoWrap}>
      <Animated.View
        style={[
          styles.logoGlow,
          {
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.logoCard,
          {
            opacity: pop,
            transform: [{ scale: pop }],
          },
        ]}
      >
        <Image
          source={require('../assets/logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

/** Text input wrapper that animates its border color / elevation on focus. */
function AnimatedField({ children, error }) {
  const focusAnim = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);

  const animateTo = (v) => {
    Animated.timing(focusAnim, { toValue: v, duration: 180, useNativeDriver: false }).start();
  };

  const borderColor = error
    ? COLORS.errorBorder
    : focusAnim.interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.navy] });

  return React.cloneElement(children, {
    wrapStyle: [
      styles.fieldBox,
      { borderColor },
      error && { backgroundColor: '#FFF5F5' },
    ],
    onWrapFocus: () => { setFocused(true); animateTo(1); },
    onWrapBlur: () => { setFocused(false); animateTo(0); },
  });
}

export default function LoginScreen({ navigation }) {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors]         = useState({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);

  const emailBorder = useRef(new Animated.Value(0)).current;
  const passwordBorder = useRef(new Animated.Value(0)).current;


  const focusIn = (anim) => Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  const focusOut = (anim) => Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: false }).start();

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim())               newErrors.email    = 'Email is required';
    else if (!emailRegex.test(email)) newErrors.email   = 'Enter a valid email address';
    if (!password.trim())            newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const routeAfterLogin = (role) => {
    if (role === 'phlebotomist') {
      navigation.reset({ index: 0, routes: [{ name: 'PhlebDashboard' }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'PatientHome' }] });
    }
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await login(email, password);
      routeAfterLogin(data.role);
    } catch (err) {
      if (err.message === 'NETWORK_ERROR') {
        setErrors({ password: "Can't reach the server. Check your connection." });
      } else if (err.message === 'BAD_RESPONSE') {
        setErrors({ password: 'Unexpected server response. Try again.' });
      } else {
        setErrors({ password: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Redirect URI:', AuthSession.makeRedirectUri(
      Platform.OS === 'ios'
        ? { scheme: 'com.googleusercontent.apps.419738471832-ll0vcr4ing5mqja61808thjetfvs14br' }
        : {}
    ));
  }, []);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '419738471832-nsodach0uujc8anp8p76i3nfeei9f8c4.apps.googleusercontent.com',
    androidClientId: '419738471832-8bmiolhcc8tpbo12gi8vlktvd27mpu9a.apps.googleusercontent.com',
    iosClientId: '419738471832-ll0vcr4ing5mqja61808thjetfvs14br.apps.googleusercontent.com',
    redirectUri: `com.googleusercontent.apps.419738471832-8bmiolhcc8tpbo12gi8vlktvd27mpu9a:/oauth2redirect`,
  });
  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (!response) return;

      if (response.type === 'error') {
        console.log('Google auth error:', response.error);
        Alert.alert('Google sign-in failed', response.error?.message || 'Please try again.');
        return;
      }
      if (response.type !== 'success') {
        console.log('Google auth response type:', response.type);
        return;
      }

      setGoogleLoading(true);
      try {
        const { authentication } = response;
        if (!authentication?.accessToken) {
          throw new Error('No access token returned from Google.');
        }
        const userInfoRes = await fetch('https://www.googleapis.com/userinfo/v2/me', {
          headers: { Authorization: `Bearer ${authentication.accessToken}` },
        });
        if (!userInfoRes.ok) {
          throw new Error(`Failed to fetch Google profile (${userInfoRes.status})`);
        }
        const userInfo = await userInfoRes.json();

        const data = await loginWithGoogle({
          idToken: authentication.idToken,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          role: 'patient',
        });
        routeAfterLogin(data.role);
      } catch (err) {
        console.log('Google sign-in error:', err);
        Alert.alert('Google sign-in failed', err.message || 'Please try again.');
      } finally {
        setGoogleLoading(false);
      }
    };
    handleGoogleResponse();
  }, [response]);

  const handleGooglePress = () => {
    if (!request) return;
    promptAsync();
  };

  const emailBorderColor = errors.email
    ? COLORS.errorBorder
    : emailBorder.interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.navy] });

  const passwordBorderColor = errors.password
    ? COLORS.errorBorder
    : passwordBorder.interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.navy] });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.offWhite} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Logo + heading ── */}
          <View style={styles.headerArea}>
            <LogoCard />
            <FadeInUp delay={120}>
              <Text style={styles.headerTitle}>Welcome back</Text>
              <Text style={styles.headerSub}>Sign in to continue to MusB Diagnostics</Text>
            </FadeInUp>
          </View>

          {/* ── Form card ── */}
          <FadeInUp delay={200} style={styles.formCard}>
            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>
                Email <Text style={styles.required}>*</Text>
              </Text>
              <Animated.View
                style={[
                  styles.inputBoxWrap,
                  { borderColor: emailBorderColor },
                  errors.email && styles.inputErrorBg,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (errors.email) setErrors({ ...errors, email: '' });
                  }}
                  onFocus={() => focusIn(emailBorder)}
                  onBlur={() => focusOut(emailBorder)}
                  placeholder="your@email.com"
                  placeholderTextColor={COLORS.gray}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Animated.View>
              {errors.email ? <Text style={styles.errorText}>⚠ {errors.email}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>
                Password <Text style={styles.required}>*</Text>
              </Text>
              <Animated.View
                style={[
                  styles.passwordWrap,
                  { borderColor: passwordBorderColor },
                  errors.password && styles.inputErrorBg,
                ]}
              >
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (errors.password) setErrors({ ...errors, password: '' });
                  }}
                  onFocus={() => focusIn(passwordBorder)}
                  onBlur={() => focusOut(passwordBorder)}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.gray}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  activeOpacity={0.6}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword
                    ? <EyeOffIcon color={COLORS.gray} size={20} />
                    : <EyeIcon    color={COLORS.gray} size={20} />}
                </TouchableOpacity>
              </Animated.View>
              {errors.password ? <Text style={styles.errorText}>⚠ {errors.password}</Text> : null}
            </View>

            {/* Remember + forgot */}
            <View style={styles.optRow}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setForgotVisible(true)}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign in button */}
            <AnimatedPressable
              style={[styles.signInBtn, loading && { opacity: 0.7 }]}
              onPress={handleSignIn}
              disabled={loading}
              scaleTo={0.97}
            >
              {loading
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.signInBtnText}>Sign in</Text>}
            </AnimatedPressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
            <AnimatedPressable
              style={[styles.socialBtn, googleLoading && { opacity: 0.6 }]}
              onPress={handleGooglePress}
              disabled={!request || googleLoading}
              scaleTo={0.97}
            >
              {googleLoading
                ? <ActivityIndicator color={COLORS.navyDark} size="small" />
                : (
                  <>
                    <Text style={styles.googleG}>G</Text>
                    <Text style={styles.socialBtnText}>Continue with Google</Text>
                  </>
                )}
            </AnimatedPressable>

            {/* Apple */}
            <AnimatedPressable style={[styles.socialBtn, { marginTop: 12 }]} scaleTo={0.97}>
              <Text style={styles.appleIcon}></Text>
              <Text style={styles.socialBtnText}>Continue with Apple</Text>
            </AnimatedPressable>
          </FadeInUp>

          {/* Sign up */}
          <FadeInUp delay={280} style={styles.signupRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('PatientCreateAccount')}
              activeOpacity={0.7}
            >
              <Text style={styles.signupLink}>Sign up</Text>
            </TouchableOpacity>
          </FadeInUp>

          {/* Back to splash */}
          <FadeInUp delay={320}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.navigate('Splash')}
              activeOpacity={0.7}
            >
              <Text style={styles.backBtnText}>← Back to home</Text>
            </TouchableOpacity>
          </FadeInUp>
        </ScrollView>
      </KeyboardAvoidingView>

      <ForgotPasswordModal visible={forgotVisible} onClose={() => setForgotVisible(false)} />
    </SafeAreaView>
  );
}

// ── Forgot Password modal ───────────────────────────────────────────────────
function ForgotPasswordModal({ visible, onClose }) {
  const [role, setRole] = useState('patient');
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const cardAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      cardAnim.setValue(0);
      Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }).start();
    }
  }, [visible]);

  const reset = () => {
    setStep(1); setEmail(''); setCode(''); setNewPassword('');
    setError(''); setInfo(''); setLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleRequestCode = async () => {
    setError('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setError('Enter a valid email address'); return; }
    setLoading(true);
    try {
      const data = await requestPasswordResetOtp(email.trim().toLowerCase(), role);
      setInfo(data.message || 'Code sent — check your email.');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Could not send code. Try again.');
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    setError('');
    if (!code.trim()) { setError('Enter the 6-digit code from your email'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await confirmPasswordReset({
        email: email.trim().toLowerCase(), code: code.trim(), newPassword, role,
      });
      Alert.alert('Password reset', 'You can now sign in with your new password.');
      handleClose();
    } catch (err) {
      setError(err.message || 'Could not reset password. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <View style={fpStyles.overlay}>
        <Animated.View
          style={[
            fpStyles.card,
            {
              opacity: cardAnim,
              transform: [{ scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
            },
          ]}
        >
          <View style={fpStyles.headerRow}>
            <Text style={fpStyles.title}>Reset your password</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={fpStyles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {step === 1 && (
            <>
              <Text style={fpStyles.label}>I am a</Text>
              <View style={fpStyles.roleRow}>
                <TouchableOpacity
                  style={[fpStyles.roleBtn, role === 'patient' && fpStyles.roleBtnActive]}
                  onPress={() => setRole('patient')}
                >
                  <Text style={[fpStyles.roleBtnText, role === 'patient' && fpStyles.roleBtnTextActive]}>Patient</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[fpStyles.roleBtn, role === 'phlebotomist' && fpStyles.roleBtnActive]}
                  onPress={() => setRole('phlebotomist')}
                >
                  <Text style={[fpStyles.roleBtnText, role === 'phlebotomist' && fpStyles.roleBtnTextActive]}>Specialist</Text>
                </TouchableOpacity>
              </View>

              <Text style={[fpStyles.label, { marginTop: 16 }]}>Email</Text>
              <TextInput
                style={fpStyles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={COLORS.gray}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {!!error && <Text style={fpStyles.errorText}>⚠ {error}</Text>}

              <AnimatedPressable
                style={[fpStyles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleRequestCode}
                disabled={loading}
                scaleTo={0.97}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={fpStyles.primaryBtnText}>Send reset code</Text>}
              </AnimatedPressable>
            </>
          )}

          {step === 2 && (
            <>
              {!!info && <Text style={fpStyles.infoText}>{info}</Text>}

              <Text style={fpStyles.label}>6-digit code</Text>
              <TextInput
                style={fpStyles.input}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={COLORS.gray}
                keyboardType="number-pad"
                maxLength={6}
              />

              <Text style={[fpStyles.label, { marginTop: 16 }]}>New password</Text>
              <View style={fpStyles.passwordWrap}>
                <TextInput
                  style={fpStyles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter a new password"
                  placeholderTextColor={COLORS.gray}
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  {showPwd ? <EyeOffIcon color={COLORS.gray} size={18} /> : <EyeIcon color={COLORS.gray} size={18} />}
                </TouchableOpacity>
              </View>

              {!!error && <Text style={fpStyles.errorText}>⚠ {error}</Text>}

              <AnimatedPressable
                style={[fpStyles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleResetPassword}
                disabled={loading}
                scaleTo={0.97}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={fpStyles.primaryBtnText}>Reset password</Text>}
              </AnimatedPressable>

              <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setStep(1)}>
                <Text style={fpStyles.linkText}>← Use a different email</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Forgot-password modal styles ────────────────────────────────────────────
const fpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13,31,60,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    elevation: 10,
    shadowColor: '#0D1F3C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.navyDark },
  closeX: { fontSize: 18, color: COLORS.gray },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.bodyText, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  roleBtnActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  roleBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.bodyText },
  roleBtnTextActive: { color: '#FFFFFF' },
  input: {
    backgroundColor: COLORS.inputBg, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: COLORS.navyDark,
  },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 16,
  },
  passwordInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: COLORS.navyDark },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 8, fontWeight: '500' },
  infoText: { color: COLORS.success, fontSize: 12, marginBottom: 14, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: COLORS.navyDark, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 18,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  linkText: { fontSize: 13, color: COLORS.navy, fontWeight: '700' },
});

// ── Main styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 40 },

  headerArea: { alignItems: 'center', marginBottom: 28, marginTop: 8 },

  logoWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 18, width: 132, height: 132 },
  logoGlow: {
    position: 'absolute', width: 146, height: 146, borderRadius: 73,
    backgroundColor: COLORS.navy,
  },
  logoCard: {
    width: 122, height: 122, borderRadius: 32,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    elevation: 8,
    shadowColor: '#0D1F3C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  logoImage: { width: 115, height: 115 },

  headerTitle: { fontSize: 24, fontWeight: '900', color: COLORS.navyDark, textAlign: 'center' },
  headerSub: { fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 6 },

  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    elevation: 4,
    shadowColor: '#0D1F3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },

  fieldWrap: { marginBottom: 18 },
  label: { fontSize: 13, color: COLORS.bodyText, marginBottom: 8, fontWeight: '600' },
  required: { color: COLORS.error, fontSize: 13 },

  inputBoxWrap: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderRadius: 14,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.navyDark,
  },
  inputErrorBg: { backgroundColor: '#FFF0F1' },

  errorText: { color: COLORS.error, fontSize: 12, marginTop: 6, fontWeight: '500' },

  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  passwordInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: COLORS.navyDark },
  eyeBtn: { padding: 6, borderRadius: 6 },

  optRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  checkmark: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  rememberText: { fontSize: 13, color: COLORS.bodyText },
  forgotText: { fontSize: 13, color: COLORS.error, fontWeight: '600' },

  signInBtn: {
    backgroundColor: COLORS.navyDark,
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: COLORS.navyDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  signInBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.lightGray },
  dividerText: { fontSize: 11, color: COLORS.gray, fontWeight: '700', letterSpacing: 0.5 },

  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.lightGray,
    borderRadius: 16,
    paddingVertical: 14,
    gap: 10,
  },
  googleG: { fontSize: 15, fontWeight: '800', color: '#4285F4' },
  appleIcon: { fontSize: 16, color: COLORS.navyDark },
  socialBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.navyDark },

  signupRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 28,
  },
  signupText: { fontSize: 13, color: COLORS.gray },
  signupLink: { fontSize: 13, color: COLORS.navy, fontWeight: '700' },

  backBtn: { alignItems: 'center', marginTop: 16 },
  backBtnText: { fontSize: 13, color: COLORS.gray, fontWeight: '500' },
});