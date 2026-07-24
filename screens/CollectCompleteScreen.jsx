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
  TextInput,
  Linking,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { PHLEB_ENDPOINTS } from '../config/api';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { uploadDocument } from '../utils/auth';

const PRIMARY      = '#18377D';
const PRIMARY_DARK = '#0F2557';
const PRIMARY_LIGHT = '#3B5BA9';
const GREEN        = '#1B7A4D';
const GREEN_LIGHT  = '#22C55E';
const AMBER        = '#D97706';
const AMBER_LIGHT  = '#FBBF24';
const RED          = '#DC2626';
const RED_DARK     = '#B91C1C';
const BLUE_SOFT    = '#2563EB';
const BG           = '#F6F8FC';
const CARD_BORDER  = '#EEF1F7';
const PHLEB_TOKEN_KEY = 'musb_phleb_token';
const SUPPORT_EMAIL = 'info@musbdiagnostics.com';

// Matches the 13-item "Required Specimen Collection Checklist" shown on the
// web portal (musblabs.com/portal/phlebotomist/dashboard). Hardcoded here to
// mirror web exactly — swap this for a backend-fetched template later.
// Matches web's 5-header / 13-sub-item structure. Sub-item `id`s are
// unchanged so submit_specimen_checklist's payload shape stays identical.
const CHECKLIST_GROUPS = [
  {
    id: 'identification',
    label: 'Patient Identification & Verification',
    items: [
      { id: 'identity_verified', label: 'Patient identity verified via photo ID' },
      { id: 'dob_confirmed', label: 'Date of birth confirmed with patient' },
    ],
  },
  {
    id: 'order_consent',
    label: 'Order & Consent Review',
    items: [
      { id: 'order_reviewed', label: "Doctor order / lab requisition reviewed" },
      { id: 'tube_matched', label: 'Collection tube type matched to test protocol' },
      { id: 'consent_signed', label: 'Informed consent signed/obtained' },
    ],
  },
  {
    id: 'site_prep',
    label: 'Site Preparation',
    items: [
      { id: 'patient_positioned', label: 'Patient positioned safely for draw' },
      { id: 'site_sanitized', label: 'Access site selected & sanitized' },
    ],
  },
  {
    id: 'collection',
    label: 'Collection Procedure',
    items: [
      { id: 'venipuncture_clean', label: 'Venipuncture performed cleanly' },
      { id: 'draw_order_correct', label: 'Correct order of draw followed' },
      { id: 'tube_labeled', label: 'Tube labeled with patient name at bedside' },
      { id: 'tube_inverted', label: 'Tube inverted properly for additives' },
    ],
  },
  {
    id: 'post_collection',
    label: 'Post-Collection & Patient Safety',
    items: [
      { id: 'bleeding_stopped', label: 'Bleeding stopped & site dressed' },
      { id: 'patient_stable', label: 'Patient confirmed stable & comfortable' },
    ],
  },
];

// Flat list is what drives `checklist` state, doneCount, and the payload —
// unchanged from before, just built from the groups above.
const INITIAL_CHECKLIST = CHECKLIST_GROUPS.flatMap((g) =>
  g.items.map((item) => ({ ...item, groupId: g.id, done: false }))
);

// Matches the "Storage Condition" selector on web. `key` is what gets sent
// to the backend (submit_specimen_checklist expects Ambient/Refrigerated/Frozen).
const STORAGE_OPTIONS = [
  { key: 'Ambient', label: 'Ambient', sub: 'Standard room temp', icon: 'thermometer-outline' },
  { key: 'Refrigerated', label: 'Refrigerated', sub: '2–8°C', icon: 'snow-outline' },
  { key: 'Frozen', label: 'Frozen', sub: '-20°C', icon: 'snow' },
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
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, opacity, transform: [{ scale }],
      }}
    />
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
            backgroundColor: progress >= 1 ? GREEN_LIGHT : '#FFFFFF',
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

/** Colorful action card used for "Unable to Collect" / "Contact Support". */
function ActionCard({ icon, iconColor, gradientColors, title, subtitle, onPress, delay }) {
  return (
    <FadeInUp delay={delay} distance={16} style={{ flex: 1 }}>
      <AnimatedPressable style={styles.actionCard} scaleTo={0.95} onPress={onPress}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionIconWrap}
        >
          <Ionicons name={icon} size={19} color={iconColor} />
        </LinearGradient>
        <Text style={styles.actionCardTitle}>{title}</Text>
        <Text style={styles.actionCardSub}>{subtitle}</Text>
      </AnimatedPressable>
    </FadeInUp>
  );
}

function barcodeBars(seed) {
  let bars = [];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = 0; i < 32; i++) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    bars.push(1 + (hash % 3));
  }
  return bars;
}

function BarcodeVisual({ code }) {
  const bars = useRef(barcodeBars(code)).current;
  return (
    <View style={styles.barcodeVisual}>
      {bars.map((w, i) => (
        <View
          key={i}
          style={{
            width: w,
            height: '100%',
            backgroundColor: i % 2 === 0 ? '#111827' : 'transparent',
            marginRight: 1,
          }}
        />
      ))}
    </View>
  );
}

function TubeBarcodeCard({ tube, index, onScanToggle, onAddPhoto }) {
  return (
    <FadeInUp delay={60 + index * 40} style={styles.tubeCard}>
      <View style={styles.tubeCardRow}>
        <TouchableOpacity
          style={[styles.tubeBarcodeBox, tube.scanned && styles.tubeBarcodeBoxScanned]}
          activeOpacity={0.75}
          onPress={onScanToggle}
        >
          <BarcodeVisual code={tube.barcode} />
          <Text style={styles.tubeBarcodeText}>{tube.barcode}</Text>
          {tube.scanned && (
            <View style={styles.tubeScannedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={GREEN_LIGHT} />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.tubePhotoBox} activeOpacity={0.75} onPress={onAddPhoto}>
          {tube.photoUri ? (
            <Image source={{ uri: tube.photoUri }} style={styles.tubePhotoThumb} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={18} color="#9CA3AF" />
              <Text style={styles.tubePhotoText}>Add photo{'\n'}(optional)</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </FadeInUp>
  );
}

export default function CollectCompleteScreen({ route, navigation }) {
  const { job, patient: paramPatient, order: paramOrder } = route?.params || {};

  const patient = paramPatient || {
    name: job?.patient_name || job?.patientName || 'Patient',
    address: job?.address || job?.patient_address || job?.location || 'Address not provided',
  };

  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Tapping a group's check-circle marks/unmarks every sub-item in that group.
  const toggleGroupAll = (groupId) => {
    setChecklist((prev) => {
      const groupItems = prev.filter((i) => i.groupId === groupId);
      const allDone = groupItems.every((i) => i.done);
      return prev.map((i) => (i.groupId === groupId ? { ...i, done: !allDone } : i));
    });
  };
  const [submitting, setSubmitting] = useState(false);
  const [storageCondition, setStorageCondition] = useState('Ambient');
  const [showStoragePicker, setShowStoragePicker] = useState(false);

  const [unableModalVisible, setUnableModalVisible] = useState(false);
  const [unableReason, setUnableReason] = useState('');
  const [submittingUnable, setSubmittingUnable] = useState(false);

  // --- Tube barcode + photo state ---
  // TODO backend: barcode should come from the order/test payload once
  // the backend exposes it. Stubbed for now.
  const [tubeBarcode] = useState(
    `MB-${472}-LAV-${String(1).padStart(4, '0')}`
  );
  const [tubeScanned, setTubeScanned] = useState(false);
  const [tubePhotoUri, setTubePhotoUri] = useState(null);
  const [tubePhotoS3Key, setTubePhotoS3Key] = useState(null);

  const [pendingTubeUpload, setPendingTubeUpload] = useState(null);
  const [uploadingTubePhoto, setUploadingTubePhoto] = useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const doneCount = checklist.filter((i) => i.done).length;
  const progress = checklist.length ? doneCount / checklist.length : 0;

  const toggleItem = (id) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };
// TODO: replace with real barcode scan (expo-camera / expo-barcode-scanner)
  // once wired to the backend. Tap-to-toggle stub for now.
  const handleScanTube = () => {
    setTubeScanned((prev) => !prev);
  };

  const shortName = (uri = '') => {
    const clean = uri.split('?')[0];
    const parts = clean.split('/');
    return parts[parts.length - 1] || 'photo.jpg';
  };

  const compressImage = async (uri) => {
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1000 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
    );
    const base64 = await FileSystem.readAsStringAsync(resized.uri, { encoding: 'base64' });
    return { uri: resized.uri, base64 };
  };

  const stageTubePhoto = async (source) => {
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission needed',
          `Please allow ${source === 'camera' ? 'camera' : 'photo library'} access to add a photo.`
        );
        return;
      }
      const launch =
        source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await launch({ quality: 0.7, allowsEditing: true, base64: false });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const compressed = await compressImage(asset.uri);
      setPendingTubeUpload({
        fileName: asset.fileName || shortName(asset.uri),
        uri: compressed.uri,
        base64: compressed.base64,
      });
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'Could not process photo. Please try again.');
    }
  };

  const handleAddTubePhoto = () => {
    Alert.alert('Add photo', 'Choose a source', [
      { text: 'Camera', onPress: () => stageTubePhoto('camera') },
      { text: 'Gallery', onPress: () => stageTubePhoto('gallery') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // TODO backend: confirm 'tube-photos' is an accepted `kind`, or swap to
  // a dedicated PHLEB_ENDPOINTS.tubePhoto(job.id) route.
  const confirmTubePhotoUpload = async () => {
    if (!pendingTubeUpload || uploadingTubePhoto) return;
    const { fileName, uri, base64 } = pendingTubeUpload;
    setUploadingTubePhoto(true);
    try {
      const { key: s3key } = await uploadDocument({
        uri,
        base64,
        kind: 'tube-photos',
        filename: fileName,
      });
      setTubePhotoUri(uri);
      setTubePhotoS3Key(s3key);
      setPendingTubeUpload(null);
    } catch (err) {
      Alert.alert(
        'Upload failed',
        err.message === 'NETWORK_ERROR'
          ? 'Network error while uploading. Please try again.'
          : (err.message || 'Could not upload the photo.')
      );
    } finally {
      setUploadingTubePhoto(false);
    }
  };

  const cancelTubePhotoUpload = () => {
    setPendingTubeUpload(null);
  };

  const allChecked = checklist.every((item) => item.done);

  const handleMarkCollected = async () => {
    if (!allChecked) {
      Alert.alert(
        'Collection incomplete',
        'Please complete the checklist before marking the sample collected.'
      );
      return;
    }
    if (submitting || !job?.id) return;
    setSubmitting(true);

    try {
      const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);

      const checklistPayload = {};
      checklist.forEach((item) => { checklistPayload[item.id] = item.done; });

      const res = await fetch(PHLEB_ENDPOINTS.testChecklist(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          checklist: checklistPayload,
          storage_condition: storageCondition,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Could not submit checklist.');
      }

      // Lab/drop-off selection now happens on the next screen.
      navigation.navigate('DropOffVerification', { job, patient });
    } catch (err) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleContactSupport = async () => {
    const subject = encodeURIComponent('Issue During Sample Collection');
    const body = encodeURIComponent(
      `Hi MusB Support,\n\nI need help during a collection for job ID: ${job?.id || 'N/A'}\n\nPlease assist.\n`
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

  const handleSubmitUnableToCollect = async () => {
    if (!unableReason.trim()) {
      Alert.alert('Reason required', 'Please describe why the sample could not be collected.');
      return;
    }
    if (!job?.id) return;
    setSubmittingUnable(true);
    try {
      const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
      const res = await fetch(PHLEB_ENDPOINTS.testStatus(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'issue', specimen_notes: unableReason.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        Alert.alert('Could not report issue', data?.error || 'Please try again.');
      } else {
        setUnableModalVisible(false);
        setUnableReason('');
        Alert.alert('Reported', 'This job has been flagged and the office notified.', [
          { text: 'OK', onPress: () => navigation.navigate('PhlebDashboard') },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not submit. Check your connection.');
    } finally {
      setSubmittingUnable(false);
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
            <View style={styles.headerProgressBadge}>
              <Text style={styles.headerProgressText}>{doneCount}/{checklist.length}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Collection checklist */}
        <FadeInUp delay={40}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionLabel}>Required Specimen Collection Checklist</Text>
            <View style={[styles.countPill, allChecked && styles.countPillDone]}>
              <Text style={[styles.countPillText, allChecked && styles.countPillTextDone]}>
                {doneCount}/{checklist.length}
              </Text>
            </View>
          </View>
          <Text style={styles.sectionSubLabel}>
            Tap a category to expand it. All {checklist.length} checks across {CHECKLIST_GROUPS.length} categories must be verified before proceeding to 'Collected' status.
          </Text>
          {CHECKLIST_GROUPS.map((group) => {
            const groupItems = checklist.filter((i) => i.groupId === group.id);
            const doneInGroup = groupItems.filter((i) => i.done).length;
            const groupDone = doneInGroup === groupItems.length;
            const expanded = !!expandedGroups[group.id];
            return (
              <View key={group.id} style={styles.groupCard}>
                <TouchableOpacity
                  style={styles.groupHeader}
                  activeOpacity={0.7}
                  onPress={() => toggleGroup(group.id)}
                >
                  <TouchableOpacity
                    onPress={() => toggleGroupAll(group.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <CheckCircle done={groupDone} />
                  </TouchableOpacity>
                  <Text style={[styles.groupLabel, groupDone && styles.groupLabelDone]} numberOfLines={2}>
                    {group.label}
                  </Text>
                  <View style={[styles.groupBadge, groupDone && styles.groupBadgeDone]}>
                    <Text style={[styles.groupBadgeText, groupDone && styles.groupBadgeTextDone]}>
                      {doneInGroup}/{groupItems.length}
                    </Text>
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
                {expanded && (
                  <View style={styles.groupBody}>
                    {groupItems.map((item, idx) => (
                      <ChecklistRow
                        key={item.id}
                        item={item}
                        index={idx}
                        onToggle={() => toggleItem(item.id)}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </FadeInUp>

        {/* Storage condition */}
        <FadeInUp delay={110}>
          <Text style={[styles.sectionLabel, { marginTop: 24, marginBottom: 12 }]}>Storage condition</Text>
          <AnimatedPressable
            style={styles.storageDropdown}
            scaleTo={0.98}
            onPress={() => setShowStoragePicker(true)}
          >
            <LinearGradient
              colors={['#EEF2FF', '#E0E7FF']}
              style={styles.storageDropdownIconWrap}
            >
              <Ionicons
                name={STORAGE_OPTIONS.find((o) => o.key === storageCondition)?.icon || 'thermometer-outline'}
                size={18}
                color={PRIMARY}
              />
            </LinearGradient>
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

        {/* Tube barcode scanning */}
        <FadeInUp delay={140}>
          <Text style={[styles.sectionLabel, { marginTop: 24, marginBottom: 4 }]}>
            Tube Barcode Scanning
          </Text>
          <Text style={[styles.sectionSubLabel, { marginBottom: 12 }]}>
            {tubeScanned ? 'Tube scanned and matched to order.' : 'Scan the tube to match it to the order.'}
          </Text>
          <View style={styles.tubeCard}>
            <View style={styles.tubeCardRow}>
              <TouchableOpacity
                style={[styles.tubeBarcodeBox, tubeScanned && styles.tubeBarcodeBoxScanned]}
                activeOpacity={0.75}
                onPress={handleScanTube}
              >
                <BarcodeVisual code={tubeBarcode} />
                <Text style={styles.tubeBarcodeText}>{tubeBarcode}</Text>
                {tubeScanned && (
                  <View style={styles.tubeScannedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={GREEN_LIGHT} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.tubePhotoBox} activeOpacity={0.75} onPress={handleAddTubePhoto}>
                {tubePhotoUri ? (
                  <Image source={{ uri: tubePhotoUri }} style={styles.tubePhotoThumb} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={18} color="#9CA3AF" />
                    <Text style={styles.tubePhotoText}>Add photo{'\n'}(optional)</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </FadeInUp>

        {/* Unable to Collect / Contact Support — redesigned as colorful cards */}
        <FadeInUp delay={170}>
          <Text style={[styles.sectionLabel, { marginTop: 24, marginBottom: 12 }]}>Need help?</Text>
        </FadeInUp>
        <View style={styles.actionCardsRow}>
          <ActionCard
            icon="alert-circle"
            iconColor={RED_DARK}
            gradientColors={['#FEE2E2', '#FCA5A5']}
            title="Unable to Collect"
            subtitle="Report an issue"
            onPress={() => setUnableModalVisible(true)}
            delay={200}
          />
          <ActionCard
            icon="headset"
            iconColor={PRIMARY}
            gradientColors={['#DBEAFE', '#BFDBFE']}
            title="Contact Support"
            subtitle="We're here to help"
            onPress={handleContactSupport}
            delay={260}
          />
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>

      {/* Bottom CTA */}
      <FadeInUp delay={0} distance={20} style={styles.bottomBar}>
        {!allChecked && (
          <View style={styles.incompleteNotice}>
            <PulseDot color={AMBER_LIGHT} size={7} />
            <Text style={styles.incompleteNoticeText}>
              {`${checklist.length - doneCount} item${checklist.length - doneCount === 1 ? '' : 's'} remaining`}
            </Text>
          </View>
        )}
        <AnimatedPressable
          scaleTo={0.97}
          onPress={handleMarkCollected}
          disabled={!allChecked || submitting}
        >
          <LinearGradient
            colors={
              !allChecked || submitting
                ? ['#B0B7C3', '#9CA3AF']
                : [GREEN_LIGHT, GREEN]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.completeButton}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name={allChecked ? 'checkmark-circle' : 'lock-closed-outline'}
                  size={18}
                  color="#FFFFFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.completeButtonText}>Mark sample collected</Text>
              </>
            )}
          </LinearGradient>
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

      {/* Unable to Collect modal */}
      <Modal
        visible={unableModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUnableModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.reasonModalCard}>
            <View style={styles.reasonModalIconWrap}>
              <Ionicons name="alert-circle" size={22} color={RED} />
            </View>
            <Text style={styles.modalTitle}>Unable to collect</Text>
            <Text style={styles.reasonModalSub}>
              Let us know why this collection couldn't be completed. The office will be notified.
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. Patient refused, no vein access, wrong address"
              placeholderTextColor="#9CA3AF"
              value={unableReason}
              onChangeText={setUnableReason}
              multiline
              autoFocus
            />
            <View style={styles.reasonModalActions}>
              <TouchableOpacity
                style={styles.reasonCancelBtn}
                onPress={() => { setUnableModalVisible(false); setUnableReason(''); }}
                disabled={submittingUnable}
              >
                <Text style={styles.reasonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reasonSendBtnWrap}
                onPress={handleSubmitUnableToCollect}
                disabled={submittingUnable}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[RED, RED_DARK]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.reasonSendBtn}
                >
                  {submittingUnable ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.reasonSendText}>Submit</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Tube photo confirmation modal */}
      <Modal
        visible={!!pendingTubeUpload}
        transparent
        animationType="fade"
        onRequestClose={cancelTubePhotoUpload}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tubePhotoModalCard}>
            <Text style={styles.modalTitle}>Confirm tube photo</Text>
            <Image
              source={{ uri: pendingTubeUpload?.uri }}
              style={styles.tubePhotoPreview}
              resizeMode="cover"
            />
            <Text style={styles.tubePhotoModalFileName} numberOfLines={1}>
              {pendingTubeUpload?.fileName}
            </Text>
            <View style={styles.reasonModalActions}>
              <TouchableOpacity
                style={styles.reasonCancelBtn}
                onPress={cancelTubePhotoUpload}
                disabled={uploadingTubePhoto}
              >
                <Text style={styles.reasonCancelText}>Retake / Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reasonSendBtnWrap}
                onPress={confirmTubePhotoUpload}
                disabled={uploadingTubePhoto}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[GREEN_LIGHT, GREEN]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.reasonSendBtn}
                >
                  {uploadingTubePhoto ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.reasonSendText}>Upload</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

  headerGlowSecondary: {
    position: 'absolute',
    bottom: -60,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFFFFF',
    opacity: 0.06,
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

  headerProgressBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 42,
    alignItems: 'center',
  },

  headerProgressText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
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

  actionCardsRow: {
    flexDirection: 'row',
    gap: 12,
  },

  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  actionCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },

  actionCardSub: {
    fontSize: 11.5,
    color: '#9CA3AF',
    marginTop: 2,
    textAlign: 'center',
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
    gap: 8,
    marginBottom: 10,
  },

  incompleteNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: AMBER,
  },

  completeButton: {
    flexDirection: 'row',
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

  completeButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15.5,
  },

  reasonModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignSelf: 'center',
  },

  reasonModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  reasonModalSub: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 14,
  },

  reasonInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#111827',
    marginBottom: 16,
  },

  reasonModalActions: {
    flexDirection: 'row',
    gap: 10,
  },

  reasonCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  reasonCancelText: {
    color: '#374151',
    fontWeight: '700',
  },

  reasonSendBtnWrap: {
    flex: 1.4,
    borderRadius: 12,
    overflow: 'hidden',
  },

  reasonSendBtn: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  reasonSendText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  groupLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  groupLabelDone: {
    color: '#374151',
  },
  groupBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  groupBadgeDone: {
    backgroundColor: '#DCFCE7',
  },
  groupBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: PRIMARY,
  },
  groupBadgeTextDone: {
    color: GREEN,
  },
  groupBody: {
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tubeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  tubeCardRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tubeBarcodeBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tubeBarcodeBoxScanned: {
    borderColor: GREEN_LIGHT,
    backgroundColor: '#F0FDF4',
  },
  barcodeVisual: {
    flexDirection: 'row',
    height: 36,
    marginBottom: 8,
    alignItems: 'center',
  },
  tubeBarcodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.5,
  },
  tubeScannedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  tubePhotoBox: {
    width: 88,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tubePhotoThumb: {
    width: '100%',
    height: '100%',
  },
  tubePhotoText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  tubePhotoModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignSelf: 'center',
  },
  tubePhotoPreview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#F1F4FA',
  },
  tubePhotoModalFileName: {
    marginTop: 10,
    fontSize: 12.5,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 4,
  },
});
