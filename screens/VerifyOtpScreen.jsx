import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { verifyOtpAndCreateAccount, requestOtp } from '../utils/auth';

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

export default function VerifyOtpScreen({ navigation, route }) {
  const { firstName, lastName, email, password } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (code.trim().length < 4) {
      setError('Enter the code sent to your email');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await verifyOtpAndCreateAccount({
        email,
        token: code.trim(),
        name: `${firstName} ${lastName}`.trim(),
        password,
      });
      navigation.navigate('HealthProfile', { firstName });
    } catch (err) {
      setError(
        err.message === 'NETWORK_ERROR'
          ? "Can't reach the server. Check your connection."
          : err.message === 'BAD_RESPONSE'
          ? 'Unexpected server response. Try again.'
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await requestOtp(email);
    } catch (err) {
      setError('Could not resend code. Try again in a moment.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>MusB</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Verify your email</Text>
            <Text style={styles.headerSub}>Code sent to {email}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>6-digit code</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={code}
            onChangeText={(t) => { setCode(t.replace(/\D/g, '')); if (error) setError(''); }}
            placeholder="000000"
            placeholderTextColor={COLORS.gray}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />
          {error ? <Text style={styles.errorText}>⚠ {error}</Text> : null}

          <TouchableOpacity
            style={[styles.verifyBtn, loading && { opacity: 0.6 }]}
            onPress={handleVerify}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.verifyBtnText}>{loading ? 'Verifying...' : 'Verify & Continue'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendBtn}
            onPress={handleResend}
            activeOpacity={0.7}
            disabled={resending}
          >
            <Text style={styles.resendText}>
              {resending ? 'Resending...' : "Didn't get a code? Resend"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
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
  logoText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark },
  headerSub: { fontSize: 12, color: COLORS.gray, marginTop: 1 },
  content: { padding: 24 },
  label: { fontSize: 13, color: COLORS.bodyText, marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 24,
    letterSpacing: 8,
    color: COLORS.navyDark,
  },
  inputError: { borderColor: COLORS.errorBorder, backgroundColor: '#FFF0F1' },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 6, fontWeight: '500' },
  verifyBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 20,
  },
  verifyBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  resendBtn: { alignItems: 'center', marginTop: 16 },
  resendText: { fontSize: 13, color: COLORS.navy, fontWeight: '600' },
});