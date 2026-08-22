import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ImageBackground,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getActiveSession } from '../utils/auth';

export default function SplashScreen({ navigation }) {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const session = await getActiveSession();
        if (session?.token) {
          navigation.replace(
            session.role === 'phlebotomist' ? 'PhlebDashboard' : 'PatientHome'
          );
          return;
        }
      } catch (e) {}
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <View style={[styles.bg, { backgroundColor: '#0A1F5C', alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800' }}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>

          <View style={styles.logoWrap}>
            <View style={styles.logoBox}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          <Text style={styles.title}>MusB Diagnostics</Text>
          <Text style={styles.tagline}>Lab at your door</Text>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}> CLIA-COLA Accredited</Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.createBtn}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('RoleSelect')}
            >
              <Text style={styles.createBtnText}>Create account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signInBtn}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate('Login')}
            >
              <Text style={styles.signInBtnText}>Sign in</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation?.navigate('PatientHome', { isGuest: true })}
            >
              <Text style={styles.guestText}>Continue as guest ›</Text>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 31, 92, 0.88)' },
  safeArea: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  logoWrap: { marginBottom: 30, alignItems: 'center' },
  logoBox: {
    width: 120, height: 120, borderRadius: 24, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', padding: 10,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 12,
  },
  logoImage: { width: '115%', height: '115%' },

  title: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginBottom: 6, textAlign: 'center', letterSpacing: -0.3 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.62)', marginBottom: 20, textAlign: 'center', letterSpacing: 0.2 },

  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 36 },
  badge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingVertical: 5, paddingHorizontal: 11, gap: 5,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#4ade80' },
  badgeText: { fontSize: 10, color: 'rgba(255,255,255,0.65)' },

  buttons: { width: '100%', alignItems: 'center', gap: 12 },
  createBtn: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  createBtnText: { fontSize: 15, fontWeight: '700', color: '#112472', letterSpacing: 0.1 },
  signInBtn: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)',
  },
  signInBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.1 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.18)' },
  dividerText: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  guestText: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
});