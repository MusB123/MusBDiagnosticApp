import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { PHLEB_ENDPOINTS } from '../config/api';

const PHLEB_TOKEN_KEY = 'musb_phleb_token';
const PRIMARY = '#18377D';
const GREEN = '#1B7A4D';
const SUPPORT_EMAIL = 'info@musbdiagnostics.com';
const RESEND_COOLDOWN_SECONDS = 120; // 2 minutes

const TOP_PADDING = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

export default function VerifyArrivalScreen({ route, navigation }) {
  const { job } = route.params || {};
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0); // seconds remaining before resend is allowed again

  const cooldownInterval = useRef(null);

  useEffect(() => {
    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    cooldownInterval.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownInterval.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleVerify = async () => {
    if (pin.trim().length < 4) {
      setError('Enter the 4-digit code from the patient');
      return;
    }
    setError('');
    setVerifying(true);
    try {
      const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
      const res = await fetch(PHLEB_ENDPOINTS.verifyPin(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Invalid code. Please try again.');
        setVerifying(false);
        return;
      }
      navigation.replace('CollectComplete', { job });
    } catch (err) {
      setError('Could not verify. Check your connection.');
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
      const res = await fetch(PHLEB_ENDPOINTS.triggerArrival(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        Alert.alert('Could not resend code', data?.error || 'Please try again.');
      } else {
        Alert.alert('Code sent', 'A new code has been sent to the patient.');
        startCooldown();
      }
    } catch (err) {
      Alert.alert('Error', 'Could not resend the code. Check your connection.');
    } finally {
      setResending(false);
    }
  };

  const handleContactSupport = async () => {
    const subject = encodeURIComponent('Issue Verifying Patient Arrival');
    const body = encodeURIComponent(
      `Hi MusB Support,\n\nI'm having trouble verifying patient arrival for job ID: ${job?.id || 'N/A'}\n\nPlease assist.\n`
    );
    const mailUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    try {
      const supported = await Linking.canOpenURL(mailUrl);
      if (supported) {
        await Linking.openURL(mailUrl);
      } else {
        Alert.alert('Contact Support', `No email app found. You can reach us at ${SUPPORT_EMAIL}`);
      }
    } catch (err) {
      Alert.alert('Contact Support', `Please email us directly at ${SUPPORT_EMAIL}`);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('TripInProgress', { job });
    }
  };

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Verify Code</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.instructions}>
          Ask the patient for the 4-digit code sent to their email, then enter it below to start the collection.
        </Text>

        <TextInput
          style={[styles.input, error && styles.inputError]}
          value={pin}
          onChangeText={(t) => { setPin(t.replace(/\D/g, '')); if (error) setError(''); }}
          placeholder="0000"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={4}
          textAlign="center"
        />
        {error ? <Text style={styles.errorText}>⚠ {error}</Text> : null}

        <TouchableOpacity
          style={[styles.verifyBtn, verifying && { opacity: 0.7 }]}
          onPress={handleVerify}
          disabled={verifying}
          activeOpacity={0.85}
        >
          {verifying
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.verifyBtnText}>Verify & Continue</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendBtn}
          onPress={handleResend}
          activeOpacity={0.7}
          disabled={resending || cooldown > 0}
        >
          <Text style={[styles.resendText, (resending || cooldown > 0) && styles.resendTextDisabled]}>
            {resending
              ? 'Resending...'
              : cooldown > 0
                ? `Resend code in ${cooldown}s`
                : "Didn't get a code? Resend"}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.supportBtn}
          onPress={handleContactSupport}
          activeOpacity={0.7}
        >
          <Ionicons name="help-circle-outline" size={16} color="#8A9BB0" />
          <Text style={styles.supportText}>Need help? Contact Support</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F6F8FC' },
  header: {
    backgroundColor: PRIMARY,
    paddingTop: TOP_PADDING,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  body: { padding: 24 },
  instructions: { fontSize: 14, color: '#4A5568', lineHeight: 20, marginBottom: 24, textAlign: 'center' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1DBE8',
    borderRadius: 14,
    paddingVertical: 18,
    fontSize: 28,
    letterSpacing: 12,
    color: '#0D1F3C',
    fontWeight: '800',
  },
  inputError: { borderColor: '#E63946', backgroundColor: '#FFF0F1' },
  errorText: { color: '#E63946', fontSize: 13, marginTop: 8, textAlign: 'center', fontWeight: '500' },
  verifyBtn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 24,
  },
  verifyBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  resendBtn: { alignItems: 'center', marginTop: 18 },
  resendText: { fontSize: 13.5, color: PRIMARY, fontWeight: '600' },
  resendTextDisabled: { color: '#9CA3AF' },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 24,
    marginBottom: 18,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  supportText: { fontSize: 13, color: '#8A9BB0', fontWeight: '500' },
});