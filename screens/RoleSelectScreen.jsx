// screens/RoleSelectScreen.jsx
// Role picker shown after "Create account" on the Splash screen.
// Patient -> short registration. Phlebotomist -> multi-step registration
// (document upload, account details, etc.)
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RoleSelectScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F8FC" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inner}>
        {/* Title block */}
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>GET STARTED</Text>
          <Text style={styles.title}>How will you{'\n'}use MusB?</Text>
          <Text style={styles.subtitle}>
            Choose an option below — you can always switch later.
          </Text>
        </View>

        {/* Patient card */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PatientCreateAccount')}
        >
          <View style={[styles.iconCircle, styles.iconCirclePatient]}>
            <Text style={styles.iconGlyph}>🩸</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>I'm a Patient</Text>
            <Text style={styles.cardDesc}>
              Book lab tests and mobile blood draws at your doorstep
            </Text>
          </View>
          <View style={styles.arrowCircle}>
            <Text style={styles.arrow}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Phlebotomist card */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Register')}
        >
          <View style={[styles.iconCircle, styles.iconCirclePhleb]}>
            <Text style={styles.iconGlyph}>🧪</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>I'm a Phlebotomist</Text>
            <Text style={styles.cardDesc}>
              Accept jobs nearby and get paid for sample collection
            </Text>
          </View>
          <View style={styles.arrowCircle}>
            <Text style={styles.arrow}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Existing account */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={styles.footerLink}> Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const NAVY = '#0A1F5C';
const NAVY_DEEP = '#112472';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8FC',
  },

  // ── Header ──
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  backArrow: {
    fontSize: 26,
    color: NAVY_DEEP,
    fontWeight: '600',
    marginTop: -2,
  },

  // ── Body ──
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    justifyContent: 'center',
  },

  titleBlock: {
    marginBottom: 36,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C8BA8',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: NAVY_DEEP,
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#8A97AF',
    lineHeight: 20,
  },

  // ── Cards ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#EDF1F7',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconCirclePatient: {
    backgroundColor: '#EAF0FF',
  },
  iconCirclePhleb: {
    backgroundColor: '#EAFBF2',
  },
  iconGlyph: {
    fontSize: 24,
  },
  cardText: {
    flex: 1,
    paddingRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: NAVY_DEEP,
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 12.5,
    color: '#93A0B8',
    lineHeight: 17,
  },
  arrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F6F8FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: 18,
    color: NAVY_DEEP,
    fontWeight: '700',
    marginTop: -1,
  },

  // ── Footer ──
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 13.5,
    color: '#8A97AF',
  },
  footerLink: {
    fontSize: 13.5,
    color: NAVY_DEEP,
    fontWeight: '700',
  },
});
