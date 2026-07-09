import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  StatusBar,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { PHLEB_ENDPOINTS } from '../config/api';

const PRIMARY = '#18377D';
const GREEN = '#1B7A4D';
const BG = '#F6F8FC';
const PHLEB_TOKEN_KEY = 'musb_phleb_token';

const INITIAL_CHECKLIST = [
  { id: 'verify_id', label: 'Verify patient ID', done: true },
  { id: 'confirm_order', label: 'Confirm physician order', done: true },
  { id: 'cbc_tube', label: 'CBC tube collected', done: true },
  { id: 'cmp_tube', label: 'CMP tube collected', done: true },
  { id: 'hba1c_tube', label: 'HbA1c tube — pending', done: false },
  { id: 'label_seal', label: 'Label & seal specimens', done: false },
];

const TOTAL_BARCODES = 3;

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
      toValue: 1, duration: 420, delay,
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

/** Checkbox circle that pops when toggled done. */
function CheckCircle({ done }) {
  const scale = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: done ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 14,
    }).start();
  }, [done]);

  return (
    <View style={[styles.checkCircle, done && styles.checkCircleDone]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

/** Barcode scan progress bar that animates its fill width. */
function ScanProgressBar({ progress }) {
  const anim = useRef(new Animated.Value(progress)).current;
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
          { width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

export default function CollectCompleteScreen({ route, navigation }) {
  const { job, patient: paramPatient, order: paramOrder } = route?.params || {};

  const patient = paramPatient || {
    name: job?.patient_name || job?.patientName || 'Patient',
    address: job?.address || job?.patient_address || job?.location || 'Address not provided',
  };

  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [notes, setNotes] = useState('');
  const [scannedBarcodes, setScannedBarcodes] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const toggleItem = (id) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const handleScanBarcode = () => {
    if (scannedBarcodes >= TOTAL_BARCODES) {
      Alert.alert('All specimens scanned', 'All specimen barcodes have already been scanned.');
      return;
    }
    // TODO: hook up to actual barcode scanner
    setScannedBarcodes((prev) => Math.min(prev + 1, TOTAL_BARCODES));
  };

  const allChecked = checklist.every((item) => item.done);
  const allScanned = scannedBarcodes >= TOTAL_BARCODES;
  const canComplete = allChecked && allScanned;

  const handleMarkComplete = async () => {
    if (!canComplete) {
      Alert.alert(
        'Collection incomplete',
        'Please complete the checklist and scan all specimen barcodes before marking collection complete.'
      );
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
          storage_condition: 'Ambient',
          collector_name: '',
          notes,
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

  const progress = scannedBarcodes / TOTAL_BARCODES;

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} />

      {/* Header */}
      <View style={styles.header}>
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
          <Ionicons name="location" size={16} color="#FFFFFF" />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.headerTitle}>Arrived at location</Text>
            <Text style={styles.headerSubtitle}>
              {patient.address}{patient.name ? ` — ${patient.name}` : ''}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Collection checklist */}
        <FadeInUp delay={0}>
          <Text style={styles.sectionLabel}>Collection checklist</Text>
          <View style={styles.card}>
            {checklist.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.checklistRow, idx === checklist.length - 1 && { marginBottom: 0 }]}
                activeOpacity={0.7}
                onPress={() => toggleItem(item.id)}
              >
                <CheckCircle done={item.done} />
                <Text style={[styles.checklistLabel, item.done && styles.checklistLabelDone]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FadeInUp>

        {/* Collection notes */}
        <FadeInUp delay={80}>
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Collection notes</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about the collection..."
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
            />
          </View>
        </FadeInUp>

        {/* Scan specimen barcodes */}
        <FadeInUp delay={140}>
          <AnimatedPressable
            style={styles.scanCard}
            scaleTo={0.98}
            onPress={handleScanBarcode}
          >
            <View style={styles.scanTopRow}>
              <View style={styles.scanLabelRow}>
                <Ionicons name="barcode-outline" size={16} color={PRIMARY} />
                <Text style={styles.scanLabel}>Scan specimen barcodes</Text>
              </View>
              <Text style={styles.scanCount}>
                {scannedBarcodes} / {TOTAL_BARCODES}
              </Text>
            </View>
            <ScanProgressBar progress={progress} />
          </AnimatedPressable>
        </FadeInUp>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <AnimatedPressable
          style={[styles.completeButton, (!canComplete || submitting) && styles.completeButtonDisabled]}
          scaleTo={0.97}
          onPress={handleMarkComplete}
          disabled={!canComplete || submitting}
        >
          {submitting
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.completeButtonText}>Mark collection complete</Text>}
        </AnimatedPressable>
      </View>
    </View>
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
    backgroundColor: GREEN,
    paddingTop: TOP_PADDING,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },

  headerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12.5,
    marginTop: 2,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },

  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkCircleDone: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  checklistLabel: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#111827',
  },

  checklistLabelDone: {
    color: '#374151',
  },

  notesInput: {
    fontSize: 13.5,
    color: '#374151',
    lineHeight: 19,
    minHeight: 64,
  },

  scanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  scanTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  scanLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  scanLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
  },

  scanCount: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY,
  },

  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 3,
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

  completeButton: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },

  completeButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },

  completeButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15.5,
  },
});
