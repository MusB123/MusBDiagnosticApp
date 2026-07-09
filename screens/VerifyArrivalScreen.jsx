import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { PHLEB_ENDPOINTS } from '../config/api';

const PHLEB_TOKEN_KEY = 'musb_phleb_token';
const PRIMARY = '#18377D';
const GREEN = '#1B7A4D';

const TOP_PADDING = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

export default function VerifyArrivalScreen({ route, navigation }) {
  const { job } = route.params || {};
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Verify patient identity</Text>
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
});
