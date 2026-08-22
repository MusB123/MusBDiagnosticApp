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
//import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

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

const BackArrowIcon = ({ color = '#0A1F5C', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M15 19L8 12L15 5"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
);

// ── Theme — matched to the Splash screen's navy-blue palette ──
// (keys kept the same as before so every usage below still works; only the
// hex values changed, so this is a drop-in re-theme rather than a rewrite.)
const COLORS = {
  navy: '#0A1F5C',        // Splash brand blue — focus borders, links, accents
  navyDark: '#0A1F5C',    // brand navy — buttons, headings (same as Splash bg)
  navyLight: '#3E5CA3',
  white: '#FFFFFF',
  offWhite: '#F2F4FA',    // soft blue-tinted off-white background
  lightGray: '#DDE3F0',
  gray: '#8992A8',
  bodyText: '#2B3350',
  border: 'rgba(10,31,92,0.16)',
  inputBg: '#FFFFFF',
  error: '#C0392B',
  errorBorder: '#C0392B',
  success: '#16A34A',     // same green family as Splash's accreditation dot
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

/** Small bounce-pop used on the eye icon whenever visibility is toggled. */
function usePopOnChange(dep) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    scale.setValue(0.6);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 14 }).start();
  }, [dep]);
  return scale;
}

// Sizing for the logo mark — every layer is positioned with explicit
// top/left math (not flex auto-centering) so the glow, pulses, and card are
// guaranteed to sit perfectly concentric, on every platform.
const RING_SIZE = 122;
const GLOW_SIZE = 104;
const CARD_SIZE = 92;
const centerOffset = (outer, inner) => (outer - inner) / 2;

/**
 * Compact, medical-feeling logo mark: a soft ambient glow, two staggered
 * sonar/heartbeat-monitor pulse rings expanding outward from the card, and
 * the logo card gently bobbing in the middle. Reads like a vitals monitor
 * "ping" rather than a generic spinning ring — fits the diagnostics/
 * phlebotomy theme.
 */
function LogoCard() {
  const pop = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 10 }).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    const makePulse = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    const pulseLoop1 = makePulse(pulse1, 0);
    const pulseLoop2 = makePulse(pulse2, 1000);

    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    glowLoop.start();
    pulseLoop1.start();
    pulseLoop2.start();
    bobLoop.start();
    return () => { glowLoop.stop(); pulseLoop1.stop(); pulseLoop2.stop(); bobLoop.stop(); };
  }, []);

  const bobTranslate = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  const pulseStyle = (anim) => ({
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
  });

  return (
    <View style={styles.logoWrap}>
      {/* soft ambient glow, centered behind everything */}
      <Animated.View
        style={[
          styles.logoGlow,
          {
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.22] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
          },
        ]}
      />

      {/* sonar-style pulse rings — like a heartbeat monitor ping */}
      <Animated.View style={[styles.pulseRing, pulseStyle(pulse1)]} />
      <Animated.View style={[styles.pulseRing, pulseStyle(pulse2)]} />

      <Animated.View
        style={[
          styles.logoCard,
          {
            opacity: pop,
            transform: [{ scale: pop }, { translateY: bobTranslate }],
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

/**
 * Thin ECG/heartbeat trace with a glowing dot that travels left-to-right
 * along the spike, looping continuously. Purely decorative — sits above
 * the logo to reinforce the vitals-monitor feel without being loud.
 */
function HeartbeatLine() {
  const dot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(dot, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateX = dot.interpolate({ inputRange: [0, 1], outputRange: [-140, 140] });
  const opacity = dot.interpolate({ inputRange: [0, 0.05, 0.95, 1], outputRange: [0, 1, 1, 0] });

  return (
    <View style={styles.ecgWrap}>
      <Svg width="100%" height={36} viewBox="0 0 280 36">
        <Path
          d="M0 18 L95 18 L108 4 L120 32 L132 18 L280 18"
          stroke={COLORS.navy}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.18}
        />
      </Svg>
      <Animated.View style={[styles.ecgDot, { opacity, transform: [{ translateX }] }]} />
    </View>
  );
}

/** Error text that pops/shakes in instead of just appearing. */
function ErrorText({ children }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 18 }),
    ]).start();
  }, [children]);
  return (
    <Animated.Text
      style={[
        styles.errorText,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }],
        },
      ]}
    >
      ⚠ {children}
    </Animated.Text>
  );
}

// ── Feature flag: Google/Apple sign-in are now enabled ──
const SHOW_SOCIAL_LOGIN = false ;

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
  const eyeScale = usePopOnChange(showPassword);

  // ── Keyboard-safe scrolling ──
  const scrollRef = useRef(null);
  const emailFieldRef = useRef(null);
  const passwordFieldRef = useRef(null);
  const currentScrollY = useRef(0);

  const scrollFieldIntoView = (fieldRef, extraOffset = 0) => {
    setTimeout(() => {
      if (!fieldRef.current || !scrollRef.current) return;
      fieldRef.current.measure((fx, fy, fw, fh, fPageX, fPageY) => {
        scrollRef.current?.measure?.((sx, sy, sw, sh, sPageX, sPageY) => {
          const targetY = currentScrollY.current + (fPageY - sPageY) - 24 - extraOffset;
          scrollRef.current?.scrollTo({ y: Math.max(targetY, 0), animated: true });
        });
      });
    }, 50);
  };

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

 // useEffect(() => {
  //  GoogleSignin.configure({
   //   webClientId: '419738471832-nsodach0uujc8anp8p76i3nfeei9f8c4.apps.googleusercontent.com',
  //  });
// }, []);

  const handleGooglePress = async () => {
   // setGoogleLoading(true);
    //try {
      //await GoogleSignin.hasPlayServices();
      //const result = await GoogleSignin.signIn();
      //const { idToken, user } = result.data ?? result;
      //const data = await loginWithGoogle({
        //idToken,
        //email: user.email,
        //name: user.name,
        //picture: user.photo,
      //});
      //routeAfterLogin(data.role);
    //} catch (err) {
      //if (err.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Google sign-in failed', err.message || 'Please try again.');
      //}
    //} finally {
    //  setGoogleLoading(false);
    //}
    Alert.alert('Coming soon', 'Google sign-in will be available soon.'); //remove after comming
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

      {/* Fixed top back button — always reachable, doesn't scroll away */}
      <FadeInUp distance={-8} style={styles.topHeader}>
        <AnimatedPressable
          style={styles.backCircle}
          onPress={() => navigation.navigate('Splash')}
          scaleTo={0.9}
        >
          <BackArrowIcon color={COLORS.navyDark} size={19} />
        </AnimatedPressable>
      </FadeInUp>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScroll={(e) => { currentScrollY.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
        >
          {/* ── Logo + heading ── */}
          <View style={styles.headerArea}>
            <HeartbeatLine />
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
              <View ref={emailFieldRef} collapsable={false}>
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
                    onFocus={() => { focusIn(emailBorder); scrollFieldIntoView(emailFieldRef); }}
                    onBlur={() => focusOut(emailBorder)}
                    placeholder="your@email.com"
                    placeholderTextColor={COLORS.gray}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                </Animated.View>
              </View>
              {errors.email ? <ErrorText>{errors.email}</ErrorText> : null}
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>
                Password <Text style={styles.required}>*</Text>
              </Text>
              <View ref={passwordFieldRef} collapsable={false}>
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
                    onFocus={() => { focusIn(passwordBorder); scrollFieldIntoView(passwordFieldRef, 140); }}
                    onBlur={() => focusOut(passwordBorder)}
                    placeholder="Enter your password"
                    placeholderTextColor={COLORS.gray}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleSignIn}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    activeOpacity={0.6}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Animated.View style={{ transform: [{ scale: eyeScale }] }}>
                      {showPassword
                        ? <EyeOffIcon color={COLORS.gray} size={20} />
                        : <EyeIcon    color={COLORS.gray} size={20} />}
                    </Animated.View>
                  </TouchableOpacity>
                </Animated.View>
              </View>
              {errors.password ? <ErrorText>{errors.password}</ErrorText> : null}
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

            {/* ── Google / Apple sign-in ── */}
            {SHOW_SOCIAL_LOGIN && (
              <>
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
                  disabled={googleLoading}
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
              </>
            )}
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
          <FadeInUp delay={320} style={{ alignItems: 'center' }}>
            <AnimatedPressable
              style={styles.backBtn}
              onPress={() => navigation.navigate('Splash')}
              scaleTo={0.95}
            >
              <BackArrowIcon color={COLORS.bodyText} size={15} />
              <Text style={styles.backBtnText}>Back to home</Text>
            </AnimatedPressable>
          </FadeInUp>

          {/* Spacer so the last fields have room to scroll clear of the keyboard */}
          <View style={{ height: 160 }} />
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={fpStyles.overlay}
          keyboardShouldPersistTaps="handled"
        >
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
                    <Text style={[fpStyles.roleBtnText, role === 'phlebotomist' && fpStyles.roleBtnTextActive]}>Phlebotomist</Text>
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

                {!!error && <ErrorText>{error}</ErrorText>}

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

                {!!error && <ErrorText>{error}</ErrorText>}

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
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Forgot-password modal styles ────────────────────────────────────────────
const fpStyles = StyleSheet.create({
  overlay: {
    flexGrow: 1,
    backgroundColor: 'rgba(10,31,92,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    elevation: 10,
    shadowColor: '#0A1F5C',
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
  roleBtnActive: { backgroundColor: COLORS.navyDark, borderColor: COLORS.navyDark },
  roleBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.bodyText },
  roleBtnTextActive: { color: '#FFFFFF' },
  input: {
    backgroundColor: COLORS.inputBg, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: COLORS.bodyText,
  },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 16,
  },
  passwordInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: COLORS.bodyText },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 8, fontWeight: '500' },
  infoText: { color: COLORS.success, fontSize: 12, marginBottom: 14, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: COLORS.navyDark, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 18,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  linkText: { fontSize: 13, color: COLORS.navyDark, fontWeight: '700' },
});

// ── Main styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.offWhite },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 2,
  },
  backCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.lightGray,
    elevation: 2,
    shadowColor: '#0A1F5C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 12, paddingBottom: 40 },

  headerArea: { alignItems: 'center', marginBottom: 28, marginTop: 8 },

  // ECG / heartbeat trace above the logo
  ecgWrap: {
    width: '100%',
    height: 36,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  ecgDot: {
    position: 'absolute',
    top: 13,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: COLORS.navyDark,
    shadowColor: COLORS.navyDark,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },

  logoWrap: {
    width: RING_SIZE, height: RING_SIZE,
    alignSelf: 'center',
    marginBottom: 16,
  },
  logoGlow: {
    position: 'absolute',
    top: centerOffset(RING_SIZE, GLOW_SIZE), left: centerOffset(RING_SIZE, GLOW_SIZE),
    width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2,
    backgroundColor: COLORS.navyDark,
  },
  // sonar-style pulse rings that expand outward from the card and fade
  pulseRing: {
    position: 'absolute',
    top: centerOffset(RING_SIZE, CARD_SIZE),
    left: centerOffset(RING_SIZE, CARD_SIZE),
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_SIZE / 2,
    borderWidth: 2,
    borderColor: COLORS.navyDark,
    backgroundColor: 'transparent',
  },
  logoCard: {
    position: 'absolute',
    top: centerOffset(RING_SIZE, CARD_SIZE), left: centerOffset(RING_SIZE, CARD_SIZE),
    width: CARD_SIZE, height: CARD_SIZE, borderRadius: 24,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    elevation: 8,
    shadowColor: '#0A1F5C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  logoImage: { width: 76, height: 76 },

  headerTitle: { fontSize: 24, fontWeight: '900', color: '#151B3D', textAlign: 'center' },
  headerSub: { fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 6 },

  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    elevation: 4,
    shadowColor: '#0A1F5C',
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
    color: '#151B3D',
  },
  inputErrorBg: { backgroundColor: '#FDF0EF' },

  errorText: { color: COLORS.error, fontSize: 12, marginTop: 6, fontWeight: '500' },

  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  passwordInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#151B3D' },
  eyeBtn: { padding: 6, borderRadius: 6 },

  optRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.navyDark, borderColor: COLORS.navyDark },
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
  appleIcon: { fontSize: 16, color: '#151B3D' },
  socialBtnText: { fontSize: 14, fontWeight: '600', color: '#151B3D' },

  signupRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 28,
  },
  signupText: { fontSize: 13, color: COLORS.gray },
  signupLink: { fontSize: 13, color: COLORS.navyDark, fontWeight: '700' },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.lightGray,
  },
  backBtnText: { fontSize: 13.5, color: COLORS.bodyText, fontWeight: '700' },
});