import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { PHLEB_ENDPOINTS, CATALOG_ENDPOINTS } from '../config/api';

const PRIMARY      = '#18377D';
const PRIMARY_DARK = '#0F2557';
const PRIMARY_LIGHT = '#3B5BA9';
const GREEN        = '#1B7A4D';
const GREEN_LIGHT  = '#22C55E';
const AMBER        = '#D97706';
const RED          = '#DC2626';
const BG           = '#F6F8FC';
const CARD_BORDER  = '#EEF1F7';
const PHLEB_TOKEN_KEY = 'musb_phleb_token';

// Matches the 13-item "Required Specimen Collection Checklist" shown on the
// web portal (musblabs.com/portal/phlebotomist/dashboard). Hardcoded here to
// mirror web exactly — swap this for a backend-fetched template later.
const INITIAL_CHECKLIST = [
  { id: 'identity_verified', label: 'Patient identity verified via photo ID', done: false },
  { id: 'dob_confirmed', label: 'Date of birth confirmed with patient', done: false },
  { id: 'order_reviewed', label: 'Doctor order / lab requisition reviewed', done: false },
  { id: 'tube_matched', label: 'Collection tube type matched to test protocol', done: false },
  { id: 'consent_signed', label: 'Informed consent signed/obtained', done: false },
  { id: 'patient_positioned', label: 'Patient positioned safely for draw', done: false },
  { id: 'site_sanitized', label: 'Access site selected & sanitized', done: false },
  { id: 'venipuncture_clean', label: 'Venipuncture performed cleanly', done: false },
  { id: 'draw_order_correct', label: 'Correct order of draw followed', done: false },
  { id: 'tube_labeled', label: 'Tube labeled with patient name at bedside', done: false },
  { id: 'tube_inverted', label: 'Tube inverted properly for additives', done: false },
  { id: 'bleeding_stopped', label: 'Bleeding stopped & site dressed', done: false },
  { id: 'patient_stable', label: 'Patient confirmed stable & comfortable', done: false },
];

// Matches the "Storage Condition" selector on web. `key` is what gets sent
// to the backend (submit_specimen_checklist expects Ambient/Refrigerated/Frozen).
const STORAGE_OPTIONS = [
  { key: 'Ambient', label: 'Ambient', sub: 'Standard room temp', icon: 'thermometer-outline' },
  { key: 'Refrigerated', label: 'Refrigerated', sub: '2–8°C', icon: 'snow-outline' },
  { key: 'Frozen', label: 'Frozen', sub: '-20°C', icon: 'snow' },
];

// Fallback seed labs — used ONLY if the backend fetch fails, so the picker
// never leaves the phlebotomist stuck with an empty list in the field.
// Mirrors the Django SEED_LABS in bookings/views.py (manage_labs).
const FALLBACK_LABS = [
  {
    id: 'fallback-1',
    name: 'Quest Diagnostics - New Port Richey',
    address: '5435 Grand Blvd, New Port Richey, FL 34652',
    phone: '(727) 848-1322',
    latitude: 28.2435,
    longitude: -82.7201,
  },
  {
    id: 'fallback-2',
    name: 'Labcorp - New Port Richey',
    address: '5323 Trouble Creek Rd, New Port Richey, FL 34652',
    phone: '(727) 841-8622',
    latitude: 28.2255,
    longitude: -82.7155,
  },
  {
    id: 'fallback-3',
    name: 'BayCare Laboratories - Trinity',
    address: '2040 Trinity Oaks Blvd, Trinity, FL 34655',
    phone: '(727) 372-2300',
    latitude: 28.192,
    longitude: -82.668,
  },
  {
    id: 'fallback-4',
    name: 'Quest Diagnostics - Port Richey',
    address: '9330 US Highway 19, Port Richey, FL 34668',
    phone: '(727) 847-1234',
    latitude: 28.2915,
    longitude: -82.721,
  },
  {
    id: 'fallback-5',
    name: 'Tampa General Hospital Urgent Care & Lab',
    address: '8807 Little Rd, New Port Richey, FL 34654',
    phone: '(727) 868-2456',
    latitude: 28.2805,
    longitude: -82.669,
  },
  {
    id: 'fallback-6',
    name: 'AdventHealth Lab - West Florida',
    address: '4433 Rowan Rd, New Port Richey, FL 34653',
    phone: '(727) 376-7890',
    latitude: 28.2312,
    longitude: -82.6845,
  },
];

/** Springy press-scale wrapper. */
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

/** Checkbox circle that pops + fills when toggled done. */
function CheckCircle({ done }) {
  const scale = useRef(new Animated.Value(done ? 1 : 0)).current;
  const fill = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: done ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 14 }),
      Animated.timing(fill, { toValue: done ? 1 : 0, duration: 180, useNativeDriver: false }),
    ]).start();
  }, [done]);

  const bg = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', PRIMARY],
  });
  const border = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['#D1D5DB', PRIMARY],
  });

  return (
    <Animated.View style={[styles.checkCircle, { backgroundColor: bg, borderColor: border }]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
      </Animated.View>
    </Animated.View>
  );
}

/** Animated progress bar showing checklist completion. */
function ProgressBar({ progress }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: progress >= 1 ? GREEN_LIGHT : PRIMARY_LIGHT,
          },
        ]}
      />
    </View>
  );
}

/** Row-level highlight fade when a checklist item is toggled done. */
function ChecklistRow({ item, index, onToggle }) {
  const highlight = useRef(new Animated.Value(0)).current;
  const prevDone = useRef(item.done);

  useEffect(() => {
    if (item.done && !prevDone.current) {
      highlight.setValue(1);
      Animated.timing(highlight, { toValue: 0, duration: 700, useNativeDriver: false }).start();
    }
    prevDone.current = item.done;
  }, [item.done]);

  const rowBg = highlight.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(27,122,77,0)', 'rgba(27,122,77,0.08)'],
  });

  return (
    <Animated.View style={[styles.checklistRow, { backgroundColor: rowBg }]}>
      <TouchableOpacity style={styles.checklistRowTouchable} activeOpacity={0.7} onPress={onToggle}>
        <CheckCircle done={item.done} />
        <Text style={[styles.checklistLabel, item.done && styles.checklistLabelDone]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Normalize a lab record coming back from the backend (transform_doc output)
// into the shape this screen uses. Handles either `id` or `_id`.
function normalizeLab(raw) {
  return {
    id: raw.id || raw._id || String(raw.name || Math.random()),
    name: raw.name || 'Unnamed lab',
    address: raw.address || '',
    phone: raw.phone || '',
    latitude: raw.latitude,
    longitude: raw.longitude,
    distanceMiles: raw.distance_miles,
  };
}

export default function CollectCompleteScreen({ route, navigation }) {
  const { job, patient: paramPatient, order: paramOrder } = route?.params || {};

  const patient = paramPatient || {
    name: job?.patient_name || job?.patientName || 'Patient',
    address: job?.address || job?.patient_address || job?.location || 'Address not provided',
  };

  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [submitting, setSubmitting] = useState(false);
  const [storageCondition, setStorageCondition] = useState('Ambient');
  const [showStoragePicker, setShowStoragePicker] = useState(false);
  const [labId, setLabId] = useState('');
  const [showLabPicker, setShowLabPicker] = useState(false);

  // ── Labs from backend ────────────────────────────────────────────────
  const [labs, setLabs] = useState([]);
  const [labsLoading, setLabsLoading] = useState(true);
  const [labsError, setLabsError] = useState(false);

  const fetchLabs = async () => {
    setLabsLoading(true);
    setLabsError(false);
    try {
      // Sort by proximity to the patient's address when we have one.
      const addr = patient?.address && patient.address !== 'Address not provided'
        ? `?address=${encodeURIComponent(patient.address)}`
        : '';
      const res = await fetch(`${CATALOG_ENDPOINTS.labs}${addr}`, { method: 'GET' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load labs');

      const list = Array.isArray(data) ? data : (Array.isArray(data?.labs) ? data.labs : []);
      const normalized = list.map(normalizeLab);
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

  const doneCount = checklist.filter((i) => i.done).length;
  const progress = checklist.length ? doneCount / checklist.length : 0;

  const toggleItem = (id) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const allChecked = checklist.every((item) => item.done);
  const canComplete = allChecked && !!labId;
  const selectedLab = labs.find((l) => l.id === labId);

  const handleMarkComplete = async () => {
    if (!allChecked) {
      Alert.alert(
        'Collection incomplete',
        'Please complete the checklist before marking collection complete.'
      );
      return;
    }
    if (!labId) {
      Alert.alert('Lab required', 'Please select the lab this specimen will be sent to.');
      return;
    }
    if (submitting || !job?.id) return;
    setSubmitting(true);

    try {
      const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);

      // 1. Submit the specimen checklist — moves status to 'collected'.
      const checklistPayload = {};
      checklist.forEach((item) => { checklistPayload[item.id] = item.done; });

      const checklistRes = await fetch(PHLEB_ENDPOINTS.testChecklist(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          checklist: checklistPayload,
          storage_condition: storageCondition,
          lab_id: labId,
          lab_name: selectedLab?.name || '',
        }),
      });
      const checklistData = await checklistRes.json();
      if (!checklistRes.ok) {
        throw new Error(checklistData?.error || 'Could not submit checklist.');
      }

      // 2. Mark the job fully completed.
      const statusRes = await fetch(PHLEB_ENDPOINTS.testStatus(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!statusRes.ok) {
        const statusData = await statusRes.json().catch(() => ({}));
        throw new Error(statusData?.error || 'Could not finalize job status.');
      }

      Alert.alert('Collection complete', 'This collection has been marked complete.', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('PhlebDashboard'),
        },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
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
      <View style={styles.header}>
        <View style={styles.headerGlow} />
        <View style={styles.headerTopRow}>
          <AnimatedPressable
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            scaleTo={0.85}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </AnimatedPressable>
        </View>

        <View style={styles.headerTextWrap}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="location" size={16} color="#FFFFFF" />
          </View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.headerTitle}>Arrived at location</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {patient.address}{patient.name ? ` — ${patient.name}` : ''}
            </Text>
          </View>
        </View>

        {/* Completion progress summary */}
        <View style={styles.headerProgressRow}>
          <ProgressBar progress={progress} />
          <Text style={styles.headerProgressText}>{doneCount}/{checklist.length}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Collection checklist */}
        <FadeInUp delay={0}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionLabel}>Required Specimen Collection Checklist</Text>
            <View style={[styles.countPill, allChecked && styles.countPillDone]}>
              <Text style={[styles.countPillText, allChecked && styles.countPillTextDone]}>
                {doneCount}/{checklist.length}
              </Text>
            </View>
          </View>
          <Text style={styles.sectionSubLabel}>
            All {checklist.length} checks must be verified before proceeding to 'Collected' status.
          </Text>
          <View style={styles.card}>
            {checklist.map((item, idx) => (
              <ChecklistRow
                key={item.id}
                item={item}
                index={idx}
                onToggle={() => toggleItem(item.id)}
              />
            ))}
          </View>
        </FadeInUp>

        {/* Storage condition */}
        <FadeInUp delay={70}>
          <Text style={[styles.sectionLabel, { marginTop: 24, marginBottom: 12 }]}>Storage condition</Text>
          <AnimatedPressable
            style={styles.storageDropdown}
            scaleTo={0.98}
            onPress={() => setShowStoragePicker(true)}
          >
            <View style={styles.storageDropdownIconWrap}>
              <Ionicons
                name={STORAGE_OPTIONS.find((o) => o.key === storageCondition)?.icon || 'thermometer-outline'}
                size={18}
                color={PRIMARY}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.storageDropdownLabel}>
                {STORAGE_OPTIONS.find((o) => o.key === storageCondition)?.label || 'Select storage condition'}
              </Text>
              <Text style={styles.storageDropdownSub}>
                {STORAGE_OPTIONS.find((o) => o.key === storageCondition)?.sub || ''}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
          </AnimatedPressable>
        </FadeInUp>

        {/* Lab name */}
        <FadeInUp delay={120}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Lab name</Text>
            {labsError && (
              <TouchableOpacity onPress={fetchLabs} style={styles.retryPill}>
                <Ionicons name="refresh" size={12} color={RED} />
                <Text style={styles.retryPillText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ marginTop: 12 }}>
            {labsLoading ? (
              <View style={[styles.storageDropdown, { justifyContent: 'center' }]}>
                <ActivityIndicator color={PRIMARY} size="small" />
                <Text style={[styles.storageDropdownSub, { marginLeft: 10 }]}>Loading labs…</Text>
              </View>
            ) : (
              <AnimatedPressable
                style={styles.storageDropdown}
                scaleTo={0.98}
                onPress={() => setShowLabPicker(true)}
              >
                <View style={styles.storageDropdownIconWrap}>
                  <Ionicons name="flask-outline" size={18} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.storageDropdownLabel} numberOfLines={1}>
                    {selectedLab?.name || 'Select lab'}
                  </Text>
                  {selectedLab ? (
                    <Text style={styles.storageDropdownSub} numberOfLines={1}>
                      {selectedLab.address}
                      {typeof selectedLab.distanceMiles === 'number' ? ` · ${selectedLab.distanceMiles} mi` : ''}
                    </Text>
                  ) : labsError ? (
                    <Text style={[styles.storageDropdownSub, { color: RED }]}>
                      Couldn't load live labs — showing defaults
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
              </AnimatedPressable>
            )}
          </View>
        </FadeInUp>

        <View style={{ height: 12 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <FadeInUp delay={0} distance={20} style={styles.bottomBar}>
        {!canComplete && (
          <View style={styles.incompleteNotice}>
            <Ionicons name="alert-circle-outline" size={14} color={AMBER} />
            <Text style={styles.incompleteNoticeText}>
              {!allChecked
                ? `${checklist.length - doneCount} item${checklist.length - doneCount === 1 ? '' : 's'} remaining`
                : 'Select a lab to continue'}
            </Text>
          </View>
        )}
        <AnimatedPressable
          style={[styles.completeButton, (!canComplete || submitting) && styles.completeButtonDisabled]}
          scaleTo={0.97}
          onPress={handleMarkComplete}
          disabled={!canComplete || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name={canComplete ? 'checkmark-circle' : 'lock-closed-outline'}
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.completeButtonText}>Mark collection complete</Text>
            </>
          )}
        </AnimatedPressable>
      </FadeInUp>

      {/* Storage condition picker */}
      <Modal
        visible={showStoragePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStoragePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStoragePicker(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Storage condition</Text>
            {STORAGE_OPTIONS.map((opt) => {
              const selected = storageCondition === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.modalOptionRow, selected && styles.modalOptionRowSelected]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setStorageCondition(opt.key);
                    setShowStoragePicker(false);
                  }}
                >
                  <View style={[styles.modalOptionIconWrap, selected && styles.modalOptionIconWrapSelected]}>
                    <Ionicons name={opt.icon} size={18} color={selected ? '#FFFFFF' : PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalOptionLabel}>{opt.label}</Text>
                    <Text style={styles.modalOptionSub}>{opt.sub}</Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={GREEN_LIGHT} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Lab picker */}
      <Modal
        visible={showLabPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLabPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLabPicker(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.modalTitle}>Select lab</Text>
              <TouchableOpacity onPress={fetchLabs} style={styles.retryPill}>
                <Ionicons name="refresh" size={12} color={PRIMARY} />
                <Text style={[styles.retryPillText, { color: PRIMARY }]}>Refresh</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {labs.map((opt) => {
                const selected = labId === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.modalOptionRow, selected && styles.modalOptionRowSelected]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setLabId(opt.id);
                      setShowLabPicker(false);
                    }}
                  >
                    <View style={[styles.modalOptionIconWrap, selected && styles.modalOptionIconWrapSelected]}>
                      <Ionicons name="flask-outline" size={18} color={selected ? '#FFFFFF' : PRIMARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalOptionLabel}>{opt.name}</Text>
                      <Text style={styles.modalOptionSub} numberOfLines={1}>
                        {opt.address}
                        {typeof opt.distanceMiles === 'number' ? ` · ${opt.distanceMiles} mi` : ''}
                      </Text>
                    </View>
                    {selected && <Ionicons name="checkmark-circle" size={20} color={GREEN_LIGHT} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const TOP_PADDING =
  Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: BG,
  },

  header: {
    backgroundColor: PRIMARY,
    paddingTop: TOP_PADDING,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: 'hidden',
  },

  headerGlow: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: PRIMARY_LIGHT,
    opacity: 0.35,
  },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },

  headerSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12.5,
    marginTop: 2,
  },

  headerProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },

  headerProgressText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    minWidth: 34,
    textAlign: 'right',
  },

  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
  },

  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    flexShrink: 1,
    marginRight: 10,
  },

  sectionSubLabel: {
    fontSize: 12.5,
    color: '#6B7280',
    marginBottom: 14,
  },

  countPill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },

  countPillDone: {
    backgroundColor: '#DCFCE7',
  },

  countPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: PRIMARY,
  },

  countPillTextDone: {
    color: GREEN,
  },

  retryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  retryPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: RED,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 6,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: 'hidden',
  },

  checklistRow: {
    borderRadius: 12,
  },

  checklistRowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 12,
  },

  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checklistLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 19,
  },

  checklistLabelDone: {
    color: '#6B7280',
    textDecorationLine: 'line-through',
    textDecorationColor: '#9CA3AF',
  },

  storageDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  storageDropdownIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  storageDropdownLabel: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#111827',
  },

  storageDropdownSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },

  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },

  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
    paddingHorizontal: 4,
  },

  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 6,
  },

  modalOptionRowSelected: {
    backgroundColor: '#EEF2FF',
  },

  modalOptionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F4FA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOptionIconWrapSelected: {
    backgroundColor: PRIMARY,
  },

  modalOptionLabel: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#111827',
  },

  modalOptionSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

  incompleteNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },

  incompleteNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: AMBER,
  },

  completeButton: {
    flexDirection: 'row',
    backgroundColor: GREEN,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GREEN,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  completeButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },

  completeButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15.5,
  },
});
