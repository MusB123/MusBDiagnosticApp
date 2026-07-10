import React, { useState, useEffect } from 'react';
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
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle
      cx="12"
      cy="12"
      r="3"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const EyeOffIcon = ({ color = '#8A9BB0', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M17.94 17.94A10.07 10.07 0 0112 20C5 20 1 12 1 12A18.45 18.45 0 015.06 6.06M9.9 4.24A9.12 9.12 0 0112 4C19 4 23 12 23 12A18.5 18.5 0 0120.28 16.5M14.12 14.12A3 3 0 119.88 9.88"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Line
      x1="1"
      y1="1"
      x2="23"
      y2="23"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
  </Svg>
);

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
  success: '#22C55E',
};

// ── Forgot Password modal ──────────────────────────────────────────────────
// Step 1: pick role + enter email → request OTP.
// Step 2: enter the 6-digit code + new password → reset.
function ForgotPasswordModal({ visible, onClose }) {
  const [role, setRole] = useState('patient'); // 'patient' | 'phlebotomist'
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const reset = () => {
    setStep(1);
    setEmail('');
    setCode('');
    setNewPassword('');
    setError('');
    setInfo('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleRequestCode = async () => {
    setError('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const data = await requestPasswordResetOtp(email.trim().toLowerCase(), role);
      setInfo(data.message || 'Code sent — check your email.');
      setStep(2);
    } catch (err) {
      setError(err.message || 'Could not send code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError('');
    if (!code.trim()) {
      setError('Enter the 6-digit code from your email');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
        role,
      });
      Alert.alert('Password reset', 'You can now sign in with your new password.');
      handleClose();
    } catch (err) {
      setError(err.message || 'Could not reset password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={fpStyles.overlay}>
        <View style={fpStyles.card}>
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
                  <Text style={[fpStyles.roleBtnText, role === 'patient' && fpStyles.roleBtnTextActive]}>
                    Patient
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[fpStyles.roleBtn, role === 'phlebotomist' && fpStyles.roleBtnActive]}
                  onPress={() => setRole('phlebotomist')}
                >
                  <Text style={[fpStyles.roleBtnText, role === 'phlebotomist' && fpStyles.roleBtnTextActive]}>
                    Specialist
                  </Text>
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

              <TouchableOpacity
                style={[fpStyles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleRequestCode}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={fpStyles.primaryBtnText}>Send reset code</Text>}
              </TouchableOpacity>
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

              <TouchableOpacity
                style={[fpStyles.primaryBtn, loading && { opacity: 0.7 }]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={fpStyles.primaryBtnText}>Reset password</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={{ marginTop: 12, alignItems: 'center' }} onPress={() => setStep(1)}>
                <Text style={fpStyles.linkText}>← Use a different email</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
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

  // ── Google Sign-In ──────────────────────────────────────────────────────
  // We default new Google sign-ins to the patient role since that's this
  // screen's primary flow. If you want a role picker before Google auth
  // too, reuse the same segmented-control pattern as ForgotPasswordModal.
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '591181560891-jm09fm75b83t82f2daqpiqocfoq2899a.apps.googleusercontent.com',
    androidClientId: '591181560891-jm09fm75b83t82f2daqpiqocfoq2899a.apps.googleusercontent.com',
    iosClientId: '591181560891-jm09fm75b83t82f2daqpiqocfoq2899a.apps.googleusercontent.com',
    redirectUri: AuthSession.makeRedirectUri({ useProxy: true }),
  });

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type !== 'success') return;
      setGoogleLoading(true);
      try {
        const { authentication } = response;
        const userInfoRes = await fetch('https://www.googleapis.com/userinfo/v2/me', {
          headers: { Authorization: `Bearer ${authentication.accessToken}` },
        });
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header — identical structure to CreateAccount ── */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>MusB</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Welcome back</Text>
            <Text style={styles.headerSub}>Sign in to your account</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Email ── */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>
              Email <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              placeholder="your@email.com"
              placeholderTextColor={COLORS.gray}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email ? (
              <Text style={styles.errorText}>⚠ {errors.email}</Text>
            ) : null}
          </View>

          {/* ── Password ── */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>
              Password <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.passwordWrap, errors.password && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
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
                  : <EyeIcon    color={COLORS.gray} size={20} />
                }
              </TouchableOpacity>
            </View>
            {errors.password ? (
              <Text style={styles.errorText}>⚠ {errors.password}</Text>
            ) : null}
          </View>

          {/* ── Remember me + Forgot password ── */}
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

          {/* ── Sign In — same style as Continue button ── */}
          <TouchableOpacity
            style={[styles.signInBtn, loading && {opacity:0.6}]}
            onPress={handleSignIn}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.signInBtnText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
          </TouchableOpacity>

          {/* ── Divider ── */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Google ── */}
          <TouchableOpacity
            style={[styles.socialBtn, googleLoading && { opacity: 0.6 }]}
            activeOpacity={0.85}
            onPress={handleGooglePress}
            disabled={!request || googleLoading}
          >
            {googleLoading
              ? <ActivityIndicator color={COLORS.navyDark} size="small" />
              : (
                <>
                  <Text style={styles.googleG}>G</Text>
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </>
              )}
          </TouchableOpacity>

          {/* ── Apple ── */}
          <TouchableOpacity style={[styles.socialBtn, { marginTop: 12 }]} activeOpacity={0.85}>
            <Text style={styles.appleIcon}></Text>
            <Text style={styles.socialBtnText}>Continue with Apple</Text>
          </TouchableOpacity>

          {/* ── Sign Up link → navigates to CreateAccount ── */}
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('PatientCreateAccount')}
              activeOpacity={0.7}
            >
              <Text style={styles.signupLink}>Sign up</Text>
            </TouchableOpacity>
          </View>

          {/* ── Back to Splash ── */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('Splash')}
            activeOpacity={0.7}
          >
            <Text style={styles.backBtnText}>← Back to home</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <ForgotPasswordModal visible={forgotVisible} onClose={() => setForgotVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Forgot-password modal styles ──────────────────────────────────────────
const fpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13,31,60,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 22,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.navyDark },
  closeX: { fontSize: 18, color: COLORS.gray },
  label: {
    fontSize: 12, fontWeight: '700', color: COLORS.bodyText,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  roleBtnActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  roleBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.bodyText },
  roleBtnTextActive: { color: '#FFFFFF' },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.navyDark,
  },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 16,
  },
  passwordInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: COLORS.navyDark },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 8, fontWeight: '500' },
  infoText: { color: COLORS.success, fontSize: 12, marginBottom: 14, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: COLORS.navyDark, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 18,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  linkText: { fontSize: 13, color: COLORS.navy, fontWeight: '700' },
});

// ─── Styles — mirrors CreateAccountScreen token-for-token ─────────────────────
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
  headerSub: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 1,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },

  // Fields
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

  // Password
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
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
  eyeBtn: {
    padding: 6,
    borderRadius: 6,
  },

  // Options row
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  rememberText: {
    fontSize: 13,
    color: COLORS.bodyText,
  },
  forgotText: {
    fontSize: 13,
    color: COLORS.error,
    fontWeight: '600',
  },

  // Primary button — same as continueBtn in CreateAccount
  signInBtn: {
    backgroundColor: COLORS.navyDark,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 20,
  },
  signInBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.lightGray,
  },
  dividerText: {
    fontSize: 13,
    color: COLORS.gray,
  },

  // Social buttons
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.lightGray,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
  },
  googleG: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4285F4',
  },
  appleIcon: {
    fontSize: 16,
    color: COLORS.navyDark,
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.navyDark,
  },

  // Sign up row
  signupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  signupText: {
    fontSize: 13,
    color: COLORS.gray,
  },
  signupLink: {
    fontSize: 13,
    color: COLORS.navy,
    fontWeight: '700',
  },

  // Back to splash
  backBtn: {
    alignItems: 'center',
    marginTop: 16,
  },
  backBtnText: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: '500',
  },
});