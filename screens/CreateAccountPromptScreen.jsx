import React, { useState, useRef, useEffect } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { setPasswordFromGuest } from '../utils/auth';

const COLORS = {
  navy: '#1B3A8C',
  navyDark: '#0D1F3C',
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
};

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

// Mirrors backend validate_signup_data password rule:
// 10-32 chars, 1 upper, 1 lower, 1 digit, 1 special char.
function validatePassword(pw) {
  if (!pw || pw.length < 10 || pw.length > 32) return 'Password must be between 10 and 32 characters.';
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

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const goToHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'PatientHome', params: { appointmentId } }],
    });
  };

  const handleCreateAccount = async () => {
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await setPasswordFromGuest(password);
      Alert.alert('Account created!', 'You can now log in anytime with this password.', [
        { text: 'Continue', onPress: goToHome },
      ]);
    } catch (err) {
      setError(err.message || 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <View style={styles.content}>
          <FadeInUp delay={0}>
            <View style={styles.iconRing}>
              <Ionicons name="checkmark-done" size={30} color={COLORS.green} />
            </View>
            <Text style={styles.title}>Booking confirmed!</Text>
            <Text style={styles.subtitle}>
              Create an account to track your appointment, view reports, and manage future bookings.
            </Text>
          </FadeInUp>

          <FadeInUp delay={80} style={{ marginTop: 28 }}>
            <Text style={styles.fieldLabel}>Choose a password</Text>
            <View style={[styles.fieldWrap, error && styles.fieldWrapError]}>
              <Ionicons name="lock-closed-outline" size={18} color={error ? COLORS.red : COLORS.gray} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.fieldInput}
                value={password}
                onChangeText={(v) => { setPassword(v); setError(''); }}
                placeholder="At least 10 characters"
                placeholderTextColor={COLORS.gray}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword((s) => !s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
          </FadeInUp>

          <FadeInUp delay={120} style={{ marginTop: 16 }}>
            <Text style={styles.fieldLabel}>Confirm password</Text>
            <View style={[styles.fieldWrap, error && styles.fieldWrapError]}>
              <Ionicons name="lock-closed-outline" size={18} color={error ? COLORS.red : COLORS.gray} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.fieldInput}
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setError(''); }}
                placeholder="Re-enter password"
                placeholderTextColor={COLORS.gray}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
            </View>
            {!!error && <Text style={styles.fieldError}>{error}</Text>}
          </FadeInUp>

          <FadeInUp delay={160} style={{ marginTop: 14 }}>
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                Use 10+ characters with an uppercase letter, a lowercase letter, a number, and a special character.
              </Text>
            </View>
          </FadeInUp>
        </View>
      </KeyboardAvoidingView>

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
  content: { flex: 1, padding: 24, paddingTop: 32 },
  iconRing: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: COLORS.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.navyDark, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.gray, lineHeight: 20 },

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
  fieldWrapError: { borderColor: COLORS.red, backgroundColor: COLORS.redLight },
  fieldInput: { flex: 1, fontSize: 15, color: COLORS.navyDark, fontWeight: '600' },
  fieldError: { fontSize: 12, color: COLORS.red, marginTop: 6, marginLeft: 2 },

  hintBox: {
    backgroundColor: COLORS.offWhite,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hintText: { fontSize: 12, color: COLORS.gray, lineHeight: 18 },

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
