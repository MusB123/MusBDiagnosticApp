import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Image,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
// ⚠ Assumes expo-image-picker is installed (npx expo install expo-image-picker).
import * as ImagePicker from 'expo-image-picker';
import { PHLEB_ENDPOINTS, CATALOG_ENDPOINTS, UPLOAD_ENDPOINTS } from '../config/api';

const PRIMARY      = '#18377D';
const PRIMARY_DARK = '#0F2557';
const PRIMARY_LIGHT = '#3B5BA9';
const GREEN        = '#1B7A4D';
const GREEN_LIGHT  = '#22C55E';
const AMBER        = '#D97706';
const AMBER_DARK   = '#92400E';
const RED          = '#DC2626';
const RED_DARK     = '#B91C1C';
const BLUE_SOFT    = '#2563EB';
const BG           = '#F6F8FC';
const CARD_BORDER  = '#EEF1F7';
const PHLEB_TOKEN_KEY = 'musb_phleb_token';

const TOP_PADDING = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

// Fallback seed labs — used ONLY if the backend fetch fails, so the picker
// never leaves the phlebotomist stuck with an empty list in the field.
const FALLBACK_LABS = [
  {
    id: 'fallback-1',
    name: 'Quest Diagnostics - New Port Richey',
    address: '5435 Grand Blvd, New Port Richey, FL 34652',
  },
  {
    id: 'fallback-2',
    name: 'Labcorp - New Port Richey',
    address: '5323 Trouble Creek Rd, New Port Richey, FL 34652',
  },
  {
    id: 'fallback-3',
    name: 'BayCare Laboratories - Trinity',
    address: '2040 Trinity Oaks Blvd, Trinity, FL 34655',
  },
];

function normalizeLab(raw) {
  return {
    id: raw.id || raw._id || String(raw.name || Math.random()),
    name: raw.name || 'Unnamed lab',
    address: raw.address || '',
    distanceMiles: raw.distance_miles,
  };
}

/** Springy press-scale wrapper — used for every tappable card/button on this screen. */
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

/** Fades + slides a section up into place. */
function FadeInUp({ delay = 0, distance = 14, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 460, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
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

/** Gentle looping pulse used for small attention dots / icons. */
function PulseDot({ color = AMBER, size = 6 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });
  return (
    <Animated.View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity, transform: [{ scale }] }}
    />
  );
}

/** Small colorful pill used to tag a section — e.g. "SELF-PAID TESTS REQUIRED" / "INSURANCE". */
function TagBadge({ label, icon, colors }) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tagBadge}>
      <Ionicons name={icon} size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
      <Text style={styles.tagBadgeText}>{label}</Text>
    </LinearGradient>
  );
}

export default function DropOffVerificationScreen({ route, navigation }) {
  const { job, patient } = route?.params || {};
  const isSelfPaid = job?.is_self_paid ?? job?.isSelfPaid ?? false;

  const [labs, setLabs] = useState([]);
  const [labsLoading, setLabsLoading] = useState(true);
  const [labsError, setLabsError] = useState(false);

  const [selectedLabId, setSelectedLabId] = useState('');
  const [otherSelected, setOtherSelected] = useState(false);
  const [otherForm, setOtherForm] = useState({
    labName: '', address: '', city: '', state: '', zip: '',
  });

  const [photo, setPhoto] = useState(null); // { uri, base64 }
  const [confirming, setConfirming] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  // Whole-screen entrance — header eases down + fades in on mount.
  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  const fetchLabs = async () => {
    setLabsLoading(true);
    setLabsError(false);
    try {
      const addr = patient?.address && patient.address !== 'Address not provided'
        ? `?address=${encodeURIComponent(patient.address)}`
        : '';
      const res = await fetch(`${CATALOG_ENDPOINTS.labs}${addr}`, { method: 'GET' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load labs');

      const list = Array.isArray(data) ? data : (Array.isArray(data?.labs) ? data.labs : []);
      const normalized = list.map(normalizeLab);

      console.log("Labs from API:", JSON.stringify(normalized, null, 2));
      setLabs(normalized.length ? normalized : FALLBACK_LABS);
    } catch (err) {
      setLabsError(true);
      setLabs(FALLBACK_LABS);
    } finally {
      setLabsLoading(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, []);

  const selectedLab = labs.find((l) => l.id === selectedLabId);
  const otherFormValid =
    otherForm.labName.trim() &&
    otherForm.address.trim() &&
    otherForm.city.trim() &&
    otherForm.state.trim() &&
    /^\d{5}$/.test(otherForm.zip);

  const canConfirm =
    !!photo &&
    (selectedLabId || (otherSelected && otherFormValid));

  const selectLab = (id) => {
    setSelectedLabId(id);
    setOtherSelected(false);
  };

  const selectOther = () => {
    setOtherSelected(true);
    setSelectedLabId('');
  };

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to attach a drop-off photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
    });
    console.log('picker result:', JSON.stringify({
      canceled: result.canceled,
      hasAsset: !!result.assets?.[0],
      base64Length: result.assets?.[0]?.base64?.length,
    }));
    if (!result.canceled && result.assets?.[0]) {
      setPhoto({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  };

  const uploadPhoto = async () => {
    console.log('uploadPhoto: base64 length =', photo?.base64?.length);
    if (!photo?.base64) {
      console.log('uploadPhoto: skipping upload, no base64!');
      return null;
    }
    const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
    const res = await fetch(UPLOAD_ENDPOINTS.document, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        base64: `data:image/jpeg;base64,${photo.base64}`,
        kind: 'documents',
        filename: 'dropoff-photo.jpg',
      }),
  }  );
    const rawText = await res.text();
    console.log('upload status:', res.status, 'body:', rawText);
    const data = JSON.parse(rawText);
    if (!res.ok) throw new Error(data?.error || 'Photo upload failed.');
    return data.key || data.url || null;
  };

  const handleConfirmDropoff = async () => {
    if (!selectedLabId && !(otherSelected && otherFormValid)) {
      Alert.alert('Select a lab', 'Please choose a designated lab or fill in the other-lab details.');
      return;
    }
    if (!photo) {
      Alert.alert('Photo required', 'Please attach a photo confirming the drop-off.');
      return;
    }
    if (!job?.id || confirming) return;
    setConfirming(true);

    try {
      const photoKey = await uploadPhoto();
      const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);

      const dropTimestamp = new Date().toISOString();

      const dropPayload = selectedLabId
        ? {
            status: 'dropped',
            drop_location_type: 'lab',
            drop_location_lab_id: selectedLabId,
            drop_location_lab_name: selectedLab?.name || '',
            drop_location_address: selectedLab?.address || '',
            drop_photo_key: photoKey,
            drop_timestamp: dropTimestamp,
            test_name: job?.test_name || job?.testName || '',
            test_id: job?.test_id || job?.id,
          }
        : {
            status: 'dropped',
            drop_location_type: 'other',
            drop_location_lab_name: otherForm.labName.trim(),
            drop_location_address:
              `${otherForm.address.trim()}, ${otherForm.city.trim()}, ${otherForm.state.trim()} ${otherForm.zip.trim()}`,
            drop_photo_key: photoKey,
            drop_timestamp: dropTimestamp,
            test_name: job?.test_name || job?.testName || '',
            test_id: job?.test_id || job?.id,
          };
          // ===== ADD THESE LINES =====
      console.log("========== DROP OFF ==========");
      console.log("Selected Lab:", selectedLab);
      console.log("Selected Lab ID:", selectedLabId);
      console.log("Payload:", JSON.stringify(dropPayload, null, 2));
// ===========================

      const dropRes = await fetch(PHLEB_ENDPOINTS.testStatus(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dropPayload),
      });
      const dropData = await dropRes.json().catch(() => ({}));
      if (!dropRes.ok) {
        throw new Error(dropData?.error || 'Could not confirm drop-off.');
      }

      const completeRes = await fetch(PHLEB_ENDPOINTS.testStatus(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!completeRes.ok) {
        const completeData = await completeRes.json().catch(() => ({}));
        throw new Error(completeData?.error || 'Could not finalize job status.');
      }

      Alert.alert(
        'Drop-off confirmed',
        'This job has been marked complete.',
        [
          {
            text: 'OK',
            onPress: () =>
              navigation.navigate('JobCompleted', {
                job: {
                  ...job,
                  status: 'completed',
                  drop_location_lab_name: selectedLab?.name || otherForm.labName,
                  drop_location_address: selectedLab?.address ||
                    `${otherForm.address}, ${otherForm.city}, ${otherForm.state} ${otherForm.zip}`,
                  drop_timestamp: dropTimestamp,
               },
                patient,
              }),
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportReason.trim()) {
      Alert.alert('Reason required', 'Please describe the drop-off issue.');
      return;
    }
    if (!job?.id) return;
    setReporting(true);
    try {
      const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
      const res = await fetch(PHLEB_ENDPOINTS.testStatus(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'issue', specimen_notes: `Drop-off issue: ${reportReason.trim()}` }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        Alert.alert('Could not report issue', data?.error || 'Please try again.');
      } else {
        setReportModalVisible(false);
        setReportReason('');
        Alert.alert('Reported', 'The office has been notified about this drop-off issue.', [
          { text: 'OK', onPress: () => navigation.navigate('PhlebDashboard') },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not submit. Check your connection.');
    } finally {
      setReporting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_DARK} />

      {/* Header */}
      <Animated.View
        style={{
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }],
        }}
      >
        <LinearGradient
          colors={[PRIMARY_DARK, PRIMARY, PRIMARY_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerGlow} />
          <View style={styles.headerGlowSecondary} />
          <AnimatedPressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            scaleTo={0.85}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </AnimatedPressable>
          <View style={styles.headerIconWrap}>
            <Ionicons name="flask-outline" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.headerTitle}>Drop-off Verification</Text>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isSelfPaid && (
          <FadeInUp delay={20}>
            <LinearGradient
              colors={['#FFFBEB', '#FEF3C7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.selfPaidBanner}
            >
              <View style={styles.selfPaidIconWrap}>
                <Ionicons name="cash" size={16} color="#FFFFFF" />
              </View>
              <Text style={styles.selfPaidBannerText}>
                This is a self-paid test. If you drop the samples at our specified labs, you may
                receive additional income. The extra payment is determined by the admin.
              </Text>
            </LinearGradient>
          </FadeInUp>
        )}

        <FadeInUp delay={60}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionLabel}>Select drop-off lab</Text>
            <TagBadge
              label="SELF-PAID TESTS REQUIRED"
              icon="star"
              colors={[AMBER, '#B45309']}
            />
          </View>
          <Text style={styles.sectionSubLabel}>
            Drop specimens at one of these designated locations to stay eligible for the self-pay bonus.
          </Text>
        </FadeInUp>

        {labsError && (
          <FadeInUp delay={80}>
            <AnimatedPressable onPress={fetchLabs} style={styles.retryPill} scaleTo={0.96}>
              <Ionicons name="refresh" size={12} color={RED} />
              <Text style={styles.retryPillText}>Couldn't load live labs — tap to retry</Text>
            </AnimatedPressable>
          </FadeInUp>
        )}

        {labsLoading ? (
          <FadeInUp delay={90}>
            <View style={[styles.labCard, { justifyContent: 'center', alignItems: 'center' }]}>
              <ActivityIndicator color={PRIMARY} size="small" />
              <Text style={{ color: '#9CA3AF', marginTop: 8, fontSize: 12.5 }}>Loading labs…</Text>
            </View>
          </FadeInUp>
        ) : (
          labs.map((lab, idx) => {
            const selected = selectedLabId === lab.id;
            return (
              <FadeInUp key={lab.id} delay={90 + idx * 55}>
                <AnimatedPressable
                  style={[styles.labCard, selected && styles.labCardSelected]}
                  scaleTo={0.98}
                  onPress={() => selectLab(lab.id)}
                >
                  <LinearGradient
                    colors={selected ? [PRIMARY, PRIMARY_LIGHT] : ['#EEF2FF', '#E0E7FF']}
                    style={styles.labIconWrap}
                  >
                    <Ionicons name="flask-outline" size={18} color={selected ? '#FFFFFF' : PRIMARY} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labName}>{lab.name}</Text>
                    <Text style={styles.labAddress} numberOfLines={1}>{lab.address}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={GREEN_LIGHT} />}
                </AnimatedPressable>
              </FadeInUp>
            );
          })
        )}

        {/* Other lab option */}
        <FadeInUp delay={90 + labs.length * 55 + 40}>
          <AnimatedPressable
            style={[styles.labCard, otherSelected && styles.labCardSelectedBlue]}
            scaleTo={0.98}
            onPress={selectOther}
          >
            <LinearGradient
              colors={otherSelected ? [BLUE_SOFT, '#1D4ED8'] : ['#EFF6FF', '#DBEAFE']}
              style={styles.labIconWrap}
            >
              <Ionicons name="add-circle-outline" size={18} color={otherSelected ? '#FFFFFF' : BLUE_SOFT} />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <View style={styles.otherLabTitleRow}>
                <Text style={styles.labName}>Other lab</Text>
                <TagBadge label="INSURANCE" icon="shield-checkmark" colors={[BLUE_SOFT, '#1D4ED8']} />
              </View>
              <Text style={styles.labAddress}>
                {isSelfPaid
                  ? 'Not one of our designated labs — the self-pay bonus may not apply'
                  : 'For insurance-billed tests, drop off at any accredited lab'}
              </Text>
            </View>
            {otherSelected && <Ionicons name="checkmark-circle" size={20} color={GREEN_LIGHT} />}
          </AnimatedPressable>
        </FadeInUp>

        {otherSelected && (
          <FadeInUp delay={20} distance={10}>
            <View style={styles.otherForm}>
              <Text style={styles.inputLabel}>Lab name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. City Medical Lab"
                placeholderTextColor="#9CA3AF"
                value={otherForm.labName}
                onChangeText={(t) => setOtherForm((p) => ({ ...p, labName: t }))}
              />
              <Text style={styles.inputLabel}>Lab address</Text>
              <TextInput
                style={styles.input}
                placeholder="Street address"
                placeholderTextColor="#9CA3AF"
                value={otherForm.address}
                onChangeText={(t) => setOtherForm((p) => ({ ...p, address: t }))}
              />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="City"
                    placeholderTextColor="#9CA3AF"
                    value={otherForm.city}
                    onChangeText={(t) => setOtherForm((p) => ({ ...p, city: t }))}
                  />
                </View>
                <View style={{ width: 90 }}>
                  <Text style={styles.inputLabel}>State</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ST"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="characters"
                    maxLength={2}
                    value={otherForm.state}
                    onChangeText={(t) => setOtherForm((p) => ({ ...p, state: t.toUpperCase() }))}
                  />
                </View>
              </View>
              <Text style={styles.inputLabel}>Zip code</Text>
              <TextInput
                style={styles.input}
                placeholder="12345"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={5}
                value={otherForm.zip}
                onChangeText={(t) => setOtherForm((p) => ({ ...p, zip: t.replace(/\D/g, '') }))}
              />
            </View>
          </FadeInUp>
        )}

        <FadeInUp delay={90 + labs.length * 55 + 120}>
          <Text style={[styles.sectionLabel, { marginTop: 24, marginBottom: 10 }]}>Drop-off photo</Text>
          <AnimatedPressable style={styles.photoBox} scaleTo={0.98} onPress={handlePickPhoto}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
            ) : (
              <LinearGradient colors={['#FFFFFF', '#F3F6FC']} style={styles.photoPlaceholder}>
                <View style={styles.photoIconWrap}>
                  <Ionicons name="camera" size={22} color="#FFFFFF" />
                </View>
                <Text style={styles.photoPlaceholderText}>Upload drop-off photo</Text>
              </LinearGradient>
            )}
          </AnimatedPressable>
          {photo && (
            <TouchableOpacity onPress={handlePickPhoto} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
              <Text style={{ color: PRIMARY, fontSize: 12.5, fontWeight: '700' }}>Change photo</Text>
            </TouchableOpacity>
          )}
        </FadeInUp>

        <View style={{ height: 12 }} />
      </ScrollView>

      <FadeInUp delay={0} distance={20} style={styles.bottomBar}>
        {!canConfirm && (
          <View style={styles.incompleteNotice}>
            <PulseDot color={AMBER} size={7} />
            <Text style={styles.incompleteNoticeText}>
              {!photo ? 'Photo required to confirm' : 'Select a lab to continue'}
            </Text>
          </View>
        )}
        <AnimatedPressable scaleTo={0.97} onPress={handleConfirmDropoff} disabled={!canConfirm || confirming}>
          <LinearGradient
            colors={(!canConfirm || confirming) ? ['#B0B7C3', '#9CA3AF'] : [GREEN_LIGHT, GREEN]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.confirmBtn}
          >
            {confirming ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.confirmBtnText}>Confirm Drop-off</Text>
              </>
            )}
          </LinearGradient>
        </AnimatedPressable>

        <AnimatedPressable
          style={styles.reportBtn}
          scaleTo={0.97}
          onPress={() => setReportModalVisible(true)}
        >
          <Ionicons name="alert-circle-outline" size={15} color={RED} style={{ marginRight: 6 }} />
          <Text style={styles.reportBtnText}>Report Drop-off Issue</Text>
        </AnimatedPressable>
      </FadeInUp>

      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.reportOverlay}
        >
          <View style={styles.reportCard}>
            <View style={styles.reportIconWrap}>
              <Ionicons name="alert-circle" size={22} color={RED} />
            </View>
            <Text style={styles.sectionLabel}>Report drop-off issue</Text>
            <Text style={styles.reportSub}>
              Let us know what's preventing you from completing the drop-off.
            </Text>
            <TextInput
              style={styles.reportInput}
              placeholder="e.g. Lab closed, refused to accept sample"
              placeholderTextColor="#9CA3AF"
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              autoFocus
            />
            <View style={styles.row2}>
              <TouchableOpacity
                style={styles.reasonCancelBtn}
                onPress={() => { setReportModalVisible(false); setReportReason(''); }}
                disabled={reporting}
              >
                <Text style={{ color: '#374151', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reasonSendBtnWrap}
                onPress={handleSubmitReport}
                disabled={reporting}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[RED, RED_DARK]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.reasonSendBtn}
                >
                  {reporting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Submit</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: BG },

  header: {
    paddingTop: TOP_PADDING,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: -50, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: PRIMARY_LIGHT, opacity: 0.35,
  },
  headerGlowSecondary: {
    position: 'absolute',
    bottom: -60, left: -30,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: '#FFFFFF', opacity: 0.06,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  headerIconWrap: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },

  scrollContent: { padding: 20, paddingBottom: 40 },

  selfPaidBanner: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 22,
    alignItems: 'center',
  },
  selfPaidIconWrap: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: AMBER,
    alignItems: 'center', justifyContent: 'center',
  },
  selfPaidBannerText: {
    flex: 1,
    fontSize: 12.5,
    color: AMBER_DARK,
    lineHeight: 18,
    fontWeight: '600',
  },

  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionLabel: { fontSize: 14, fontWeight: '800', color: '#111827' },
  sectionSubLabel: { fontSize: 12.5, color: '#6B7280', marginBottom: 14 },

  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },

  retryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF2F2', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10,
  },
  retryPillText: { fontSize: 11.5, fontWeight: '700', color: RED },

  labCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 14, borderWidth: 1.5, borderColor: CARD_BORDER,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  labCardSelected: { borderColor: PRIMARY, backgroundColor: '#EEF2FF' },
  labCardSelectedBlue: { borderColor: BLUE_SOFT, backgroundColor: '#EFF6FF' },
  labIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  labName: { fontSize: 14.5, fontWeight: '800', color: '#111827' },
  labAddress: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  otherLabTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  otherForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    padding: 14,
    marginTop: 4,
    marginBottom: 10,
  },
  inputLabel: { fontSize: 12.5, fontWeight: '700', color: '#4A5568', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  row2: { flexDirection: 'row', gap: 10 },

  photoBox: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  photoPlaceholder: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  photoPlaceholderText: { fontSize: 13, color: PRIMARY, fontWeight: '700' },
  photoPreview: { width: '100%', height: 180 },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  incompleteNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 2,
  },
  incompleteNoticeText: { fontSize: 12, fontWeight: '700', color: AMBER },

  confirmBtn: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GREEN,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15.5 },

  reportBtn: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  reportBtnText: { color: RED, fontWeight: '700', fontSize: 14 },

  reportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  reportCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },
  reportIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  reportSub: { fontSize: 13, color: '#6B7280', marginBottom: 14 },
  reportInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 12, minHeight: 80, textAlignVertical: 'top',
    fontSize: 14, color: '#111827', marginBottom: 16,
  },
  reasonCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB',
  },
  reasonSendBtnWrap: { flex: 1.4, borderRadius: 12, overflow: 'hidden' },
  reasonSendBtn: { paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
});
