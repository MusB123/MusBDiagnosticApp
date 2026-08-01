// src/screens/JobAcceptedScreen.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Linking,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { PHLEB_ENDPOINTS } from '../config/api';

// ---------------------------------------------------------------------------
// Unified color system — the whole screen (header, CTAs, accents) reads off
// one green family instead of mixing in the navy brand color. Navy is kept
// only as a quiet neutral-ish accent on small chips, never on primary actions.
// ---------------------------------------------------------------------------
const GREEN        = '#1B7A4D';
const GREEN_DEEP    = '#0F5C38';
const GREEN_DEEPER  = '#0A4A2D';
const GREEN_SOFT    = '#EAF7EF';
const GREEN_BORDER  = '#CBEBD8';
const NAVY_MUTED    = '#3A4A6B';
const INK           = '#111827';
const BODY          = '#6B7280';
const BORDER        = '#E9EDF2';
const BG            = '#F6F8FC';

// ---------------------------------------------------------------------------
// Tube swatch colors — matched by keyword against whatever tube name string
// the backend sends (e.g. "Lavender / EDTA"), just for the little color chip.
// ---------------------------------------------------------------------------
const TUBE_COLOR_KEYWORDS = [
  ['lavender', '#B39DDB'],
  ['gold', '#E8B84B'],
  ['sst', '#E8B84B'],
  ['light blue', '#4F8EF7'],
  ['citrate', '#4F8EF7'],
  ['red', '#E5484D'],
  ['green', '#3FB27F'],
  ['heparin', '#3FB27F'],
  ['gray', '#9CA3AF'],
  ['grey', '#9CA3AF'],
  ['yellow', '#F5D547'],
  ['royal blue', '#274690'],
  ['black', '#374151'],
];

function resolveTubeColor(name) {
  const n = String(name || '').toLowerCase();
  for (const [keyword, color] of TUBE_COLOR_KEYWORDS) {
    if (n.includes(keyword)) return color;
  }
  return '#9CA3AF';
}

// Reads the tube names straight from the backend (job.required_tubes /
// job.requiredTubes — the tube_types your lab_tests catalog carries per
// test, already merged by the API). Just names, deduped, no quantity math.
function getRequiredTubes(job) {
  const backendTubes = job?.required_tubes || job?.requiredTubes || job?.tubes || [];
  const names = (Array.isArray(backendTubes) ? backendTubes : [])
    .map((t) => (typeof t === 'string' ? t : t?.name))
    .filter(Boolean);

  const unique = [...new Set(names)];
  return unique.map((name) => ({ name, color: resolveTubeColor(name) }));
}

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------

/** Staggered fade + slide-up entrance for sections. */
function FadeInUp({ delay = 0, distance = 16, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 480, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[style, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/** Subtle scale-down-on-press wrapper so CTAs feel tactile, not flat. */
function AnimatedPressable({ onPress, disabled, style, children, scaleTo = 0.97 }) {
  const anim = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(anim, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const pressOut = () => Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale: anim }] }, style]}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={{ width: '100%' }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Gentle looping pulse used behind the STAT pill to draw the eye without being loud. */
function usePulse(active) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);
  return anim;
}

export default function JobAcceptedScreen({ route, navigation }) {
  const { job } = route.params || {};
  const jobId = job?.id || job?.appointment_id || job?.dispatch_booking_id;

  const [opening, setOpening] = useState(false);

  const patientName = job?.patientName || job?.patient_name || 'Patient';
  const patientPhone = job?.patientPhone || job?.patient_phone || '';
  const patientEmail = job?.patientEmail || job?.patient_email || job?.email || '';
  const address = job?.address || job?.patient_address || job?.location || 'Address not provided';
  const rawTestName = job?.testName || job?.test_name || job?.tests
    || (Array.isArray(job?.lab_tests) ? job.lab_tests.join(', ') : null)
    || 'Clinical Test';

  // Normalized array of individual test names — used both for display and
  // for deriving the required tube types below.
  const testsArray = useMemo(() => {
    if (Array.isArray(rawTestName)) {
      return rawTestName.filter(Boolean).map(String);
    }
    return String(rawTestName ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }, [rawTestName]);

  const testName = testsArray.length ? testsArray.join('\n') : 'Clinical Test';

  const requiredTubes = useMemo(() => getRequiredTubes(job), [job]);

  const testPrice = job?.testPrice || job?.test_price;
  const earning = job?.earnings?.total ?? job?.earning ?? job?.earned ?? job?.amount_earned;
  const fastingRequired = !!(job?.fastingRequired || job?.fasting_required);
  const collectionNote = job?.collectionInstructions || job?.collection_instructions
    || job?.prepInstructions || job?.prep_instructions || null;
  const preferredDate = job?.preferredDate || job?.preferred_date || '';
  const preferredTime = job?.time || job?.preferred_time || 'ASAP';
  const visitType = job?.visitType || job?.visit_type || 'home';
  const paymentMethod = job?.paymentMethod || job?.payment_method || 'N/A';
  const isStat = !!(job?.isStat || job?.is_stat);
  const formatDateLong = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const doctorOrder = job?.documents?.doctorOrder
    || (job?.doctor_order_url
        ? { url: job.doctor_order_url, name: job.doctor_order_name || 'Doctor Order' }
        : job?.doctor_order_base64
          ? { base64: job.doctor_order_base64, name: job.doctor_order_name || 'Doctor Order' }
          : null);

  const insuranceFront = job?.documents?.insuranceFront
    || (job?.insurance_front_url
        ? { url: job.insurance_front_url, name: job.insurance_front_name || 'Insurance Front' }
        : job?.insurance_front_base64
          ? { base64: job.insurance_front_base64, name: job.insurance_front_name || 'Insurance Front' }
          : null);

  const insuranceBack = job?.documents?.insuranceBack
    || (job?.insurance_back_url
        ? { url: job.insurance_back_url, name: job.insurance_back_name || 'Insurance Back' }
        : job?.insurance_back_base64
          ? { base64: job.insurance_back_base64, name: job.insurance_back_name || 'Insurance Back' }
          : null);

  const initials = patientName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('') || 'PT';

  const handleCall = () => {
    if (!patientPhone) {
      Alert.alert('No phone number', 'This patient has no phone number on file.');
      return;
    }
    Linking.openURL(`tel:${patientPhone}`);
  };

  const handleMessage = () => {
    if (!patientPhone) {
      Alert.alert('No phone number', 'This patient has no phone number on file.');
      return;
    }
    Linking.openURL(`sms:${patientPhone}`);
  };

  const handleNavigate = () => {
    const query = encodeURIComponent(address);
    const url =
      Platform.OS === 'ios' ? `maps://?q=${query}` : `geo:0,0?q=${query}`;
    Linking.openURL(url);
  };

  const [startingTrip, setStartingTrip] = useState(false);
  const statPulse = usePulse(isStat);

  // Marks the job 'enroute' (backend emails the patient an ETA), then hands
  // off to the trip-in-progress screen — arrival/OTP happens from there now.
  const handleStartTrip = async () => {
    if (startingTrip) return;
    setStartingTrip(true);
    let etaTime = null;
    let etaMinutes = null;
    try {
      const token = await SecureStore.getItemAsync('musb_phleb_token');
      const res = await fetch(PHLEB_ENDPOINTS.testStatus(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'enroute' }),
      });
      const data = await res.json().catch(() => null);
      etaTime = data?.eta_time || null;
      etaMinutes = data?.eta_minutes || null;
    } catch (err) {
      // Non-fatal — proceed anyway so the phlebotomist isn't blocked
      console.warn('Could not mark en route:', err);
    } finally {
      setStartingTrip(false);
      navigation.navigate('TripInProgress', { job : { ...job, id: jobId }, etaTime, etaMinutes });
    }
  };

  const openDoc = async (doc, label) => {
    if (!doc?.url && !doc?.base64) {
      Alert.alert(
        `${label} not available`,
        'The patient has not uploaded this document yet.'
      );
      return;
    }
    if (doc.url) {
      try {
        await Linking.openURL(doc.url);
      } catch {
        Alert.alert('Error', 'Could not open this document.');
      }
      return;
    }
    setOpening(true);
    try {
      const isPdf = (doc.name || '').toLowerCase().endsWith('.pdf');
      const ext = isPdf ? 'pdf' : 'jpg';
      const fileUri = `${FileSystem.cacheDirectory}${label.replace(/\s/g, '_')}.${ext}`;
      const raw = doc.base64.includes(',') ? doc.base64.split(',')[1] : doc.base64;

      await FileSystem.writeAsStringAsync(fileUri, raw, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Saved', `File saved to ${fileUri}`);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open this document.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN_DEEP} />

      <LinearGradient
        colors={[GREEN_DEEP, GREEN]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.navigate('PhlebDashboard')}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCheckWrap}>
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.headerTitle}>Request accepted</Text>
        {isStat && (
          <Animated.View
            style={[
              styles.statPill,
              {
                shadowOpacity: statPulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] }),
                transform: [{ scale: statPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
              },
            ]}
          >
            <Text style={styles.statText}>STAT</Text>
          </Animated.View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient Information */}
        <FadeInUp delay={0}>
          <Text style={styles.sectionLabel}>PATIENT INFORMATION</Text>
          <View style={styles.card}>
            <View style={styles.patientRow}>
              <LinearGradient
                colors={[GREEN, GREEN_DEEP]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{initials}</Text>
              </LinearGradient>
              <View style={styles.patientMeta}>
                <Text style={styles.patientName}>{patientName}</Text>
                <Text style={styles.patientSub}>{visitType} visit</Text>
              </View>
              <View style={styles.contactButtons}>
                <TouchableOpacity style={styles.iconButton} onPress={handleCall} activeOpacity={0.75}>
                  <Ionicons name="call-outline" size={18} color={GREEN_DEEP} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={handleMessage} activeOpacity={0.75}>
                  <Ionicons name="chatbubble-outline" size={18} color={GREEN_DEEP} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <InfoRow label="Phone" value={patientPhone || '—'} />
            <InfoRow label="Email" value={patientEmail || '—'} />
            <InfoRow label="Date" value={formatDateLong(preferredDate || job?.date) || 'Today'} />
            <InfoRow label="Address" value={address} />
            <InfoRow label="Payment method" value={paymentMethod} last />
          </View>
        </FadeInUp>

        {/* Required Tube Types */}
        {requiredTubes.length > 0 && (
          <FadeInUp delay={60}>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>REQUIRED TUBE TYPES</Text>
            <View style={styles.card}>
              {requiredTubes.map((tube, idx) => (
                <TubeRow
                  key={tube.name}
                  name={tube.name}
                  color={tube.color}
                  last={idx === requiredTubes.length - 1}
                />
              ))}
            </View>
          </FadeInUp>
        )}

        {/* Order */}
        <FadeInUp delay={120}>
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>ORDER</Text>
          <View style={styles.card}>
            <InfoRow label="Tests" value={testName} />
            <InfoRow label="Test fee" value={testPrice != null ? `$${Number(testPrice).toFixed(2)}` : 'N/A'} />
            <InfoRow
              label="Your earning"
              value={earning != null ? `$${Number(earning).toFixed(2)}` : 'N/A'}
              valueStyle={{ color: GREEN_DEEP }}
              last
            />
          </View>
        </FadeInUp>

        {/* Documents */}
        <FadeInUp delay={180}>
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>DOCUMENTS</Text>
          <View style={styles.card}>
            <DocRow
              icon="document-text-outline"
              label="Doctor's order"
              available={!!doctorOrder}
              onPress={() => openDoc(doctorOrder, 'Doctor Order')}
              disabled={opening}
            />
            <DocRow
              icon="card-outline"
              label="Insurance (front)"
              available={!!insuranceFront}
              onPress={() => openDoc(insuranceFront, 'Insurance Front')}
              disabled={opening}
            />
            <DocRow
              icon="card-outline"
              label="Insurance (back)"
              available={!!insuranceBack}
              onPress={() => openDoc(insuranceBack, 'Insurance Back')}
              disabled={opening}
              last
            />
          </View>
        </FadeInUp>

        {/* Collection Instructions */}
        {(fastingRequired || collectionNote) && (
          <FadeInUp delay={230}>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>COLLECTION INSTRUCTIONS</Text>
            <View style={styles.card}>
              {fastingRequired && (
                <View style={styles.fastingBanner}>
                  <Ionicons name="alert-circle" size={16} color="#B45309" />
                  <Text style={styles.fastingBannerText}>Patient is fasting — confirm before draw</Text>
                </View>
              )}
              <Text style={styles.collectionText}>
                {collectionNote || 'No special collection notes provided.'}
              </Text>
            </View>
          </FadeInUp>
        )}

        {/* Actions */}
        <FadeInUp delay={280} style={styles.actionRow}>
          <AnimatedPressable onPress={handleNavigate} style={{ flex: 1 }}>
            <View style={styles.navigateButton}>
              <Ionicons name="navigate" size={18} color={GREEN_DEEP} />
              <Text style={styles.navigateText}>Navigate now</Text>
            </View>
          </AnimatedPressable>
        </FadeInUp>

        <FadeInUp delay={320}>
          <AnimatedPressable onPress={handleStartTrip} disabled={startingTrip} style={{ marginTop: 14 }}>
            <LinearGradient
              colors={[GREEN, GREEN_DEEPER]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.startTripButton}
            >
              <Ionicons name="car-outline" size={18} color="#FFFFFF" />
              <Text style={styles.startTripText}>
                {startingTrip ? 'Starting trip...' : 'Start Trip'}
              </Text>
            </LinearGradient>
          </AnimatedPressable>
        </FadeInUp>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, last, valueStyle }) {
  return (
    <View style={[styles.infoRow, last && { marginBottom: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueStyle]}>{value}</Text>
    </View>
  );
}

function DocRow({ icon, label, available, onPress, disabled, last }) {
  return (
    <TouchableOpacity
      style={[styles.docRow, last && { marginBottom: 0 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.docIconWrap}>
        <Ionicons name={icon} size={18} color={GREEN_DEEP} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.docLabel}>{label}</Text>
        <Text style={styles.docStatus}>
          {available ? 'Tap to view' : 'Not uploaded'}
        </Text>
      </View>
      {available && <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />}
    </TouchableOpacity>
  );
}

function TubeRow({ name, color, last }) {
  return (
    <View style={[styles.tubeRow, last && { marginBottom: 0, borderBottomWidth: 0 }]}>
      <View style={[styles.tubeSwatch, { backgroundColor: color }]} />
      <Text style={styles.tubeName}>{name}</Text>
    </View>
  );
}

const TOP_PADDING =
  Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: BG },
  header: {
    paddingTop: TOP_PADDING,
    paddingBottom: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: GREEN_DEEPER,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerCheckWrap: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', flex: 1 },
  statPill: {
    backgroundColor: '#F87171',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: '#B91C1C',
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 36 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: BODY,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#0F2557',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  patientMeta: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: '800', color: INK },
  patientSub: { fontSize: 13, color: BODY, marginTop: 2, textTransform: 'capitalize' },
  contactButtons: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1.5,
    borderColor: GREEN_BORDER, alignItems: 'center', justifyContent: 'center',
    backgroundColor: GREEN_SOFT,
  },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 10, gap: 8,
  },
  infoLabel: { fontSize: 13.5, color: BODY, flexShrink: 0 },
  infoValue: { fontSize: 13.5, fontWeight: '700', color: INK, textAlign: 'right', flexShrink: 1 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  docIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: GREEN_SOFT,
    alignItems: 'center', justifyContent: 'center',
  },
  docLabel: { fontSize: 14, fontWeight: '700', color: INK },
  docStatus: { fontSize: 12.5, color: BODY, marginTop: 2 },
  fastingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  fastingBannerText: { fontSize: 13, fontWeight: '700', color: '#92400E', flex: 1 },
  collectionText: { fontSize: 13.5, color: '#4A5568', lineHeight: 20 },
  tubeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: '#E5E7EB',
  },
  tubeSwatch: {
    width: 22,
    height: 26,
    borderRadius: 5,
  },
  tubeName: { flex: 1, fontSize: 14, fontWeight: '700', color: INK },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  navigateButton: {
    flexDirection: 'row', gap: 8, backgroundColor: GREEN_SOFT,
    paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: GREEN_BORDER,
  },
  navigateText: { color: GREEN_DEEP, fontWeight: '700', fontSize: 15 },
  startTripButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 14,
    shadowColor: GREEN_DEEPER, shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  startTripText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
