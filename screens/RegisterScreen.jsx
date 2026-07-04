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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    fullName: '',
    dob: '',
    address: '',
    phone: '',
    email: '',
    confirmPassword: '',
  });

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleContinue = () => {
    if (!form.fullName.trim()) {
      Alert.alert('Full name required', 'Please enter your full legal name to continue.');
      return;
    }
    if (!form.password || form.password.length < 6) {
    Alert.alert('Password required', 'Please choose a password of at least 10 characters.');
    return;
    }
    if (form.password !== form.confirmPassword) {
    Alert.alert('Passwords don\u2019t match', 'Please re-enter matching passwords.');
    return;
    }
    // Document upload now happens on step 2 (licence, certificate, insurance),
    // which is the only step that actually submits documents to the backend.
    navigation.navigate('RegisterScreen2', {
      fullName: form.fullName,
      dob: form.dob,
      address: form.address,
      phone: form.phone,
      email: form.email,
      password: form.password,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F6FA" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
          <Text style={styles.label}>Full legal name</Text>
          <TextInput
            style={styles.input}
            placeholder="Jordan A. Smith"
            placeholderTextColor="#BBBDC4"
            value={form.fullName}
            onChangeText={(v) => handleChange('fullName', v)}
          />

          <Text style={styles.label}>Date of birth</Text>
          <TextInput
            style={styles.input}
            placeholder="MM / DD / YYYY"
            placeholderTextColor="#BBBDC4"
            value={form.dob}
            onChangeText={(v) => handleChange('dob', v)}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Home address</Text>
          <TextInput
            style={styles.input}
            placeholder="123 Main St, Tampa, FL"
            placeholderTextColor="#BBBDC4"
            value={form.address}
            onChangeText={(v) => handleChange('address', v)}
          />

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            placeholder="(555) 555-5555"
            placeholderTextColor="#BBBDC4"
            value={form.phone}
            onChangeText={(v) => handleChange('phone', v)}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#BBBDC4"
            value={form.email}
            onChangeText={(v) => handleChange('email', v)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
          <Text style={styles.label}>Create a password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 6 characters"
            placeholderTextColor="#BBBDC4"
            value={form.password}
            onChangeText={(v) => handleChange('password', v)}
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter your password"
            placeholderTextColor="#BBBDC4"
            value={form.confirmPassword}
            onChangeText={(v) => handleChange('confirmPassword', v)}
            secureTextEntry
            autoCapitalize="none"
          />

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
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
});
