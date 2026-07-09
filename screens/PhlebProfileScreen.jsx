import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActionSheetIOS,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { PHLEB_ENDPOINTS } from '../config/api';
import { authGet, authPut, uploadDocument } from '../utils/auth';

const PRIMARY   = '#18377D';
const PRIMARY_D = '#0F2557';
const PRIMARY_L = '#2C4FA8';
const GREEN     = '#22C55E';
const AMBER     = '#F59E0B';
const RED       = '#EF4444';
const GRAY      = '#9CA3AF';
const BG        = '#F6F8FC';
const CARD_BG   = '#FFFFFF';

// ─── Document definitions ────────────────────────────────────────────────────
// IDs must exactly match the keys stored in Mongo under phlebotomist.docs
// (see submit_application / update_profile on the backend). Using any other
// id means the doc will upload to S3 fine but never show as "Uploaded" here.
const DOC_DEFS = [
  {
    id: 'dl_front',
    title: 'Driving License — Front',
    subtitle: 'Government-issued photo ID (front side)',
    icon: 'card-account-details-outline',
    iconBg: '#EEF2FF',
    iconColor: PRIMARY,
  },
  {
    id: 'dl_back',
    title: 'Driving License — Back',
    subtitle: 'Government-issued photo ID (back side)',
    icon: 'card-account-details-outline',
    iconBg: '#EEF2FF',
    iconColor: PRIMARY,
  },
  {
    id: 'certificate',
    title: 'Phlebotomy Certificate',
    subtitle: 'Certification of competency',
    icon: 'shield-check-outline',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
  },
  {
    id: 'insurance',
    title: 'Liability Insurance',
    subtitle: 'Professional indemnity document',
    icon: 'file-document-outline',
    iconBg: '#FEF3C7',
    iconColor: AMBER,
  },
  {
    id: 'w9',
    title: 'W9 Form',
    subtitle: 'Tax form for payout verification',
    icon: 'bank-outline',
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
  },
];

// Bottom nav now only has Home, History, Profile.
const NAV_ITEMS = [
  { key: 'PhlebDashboard', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { key: 'PhlebHistory', label: 'History', icon: 'time-outline', iconActive: 'time' },
  { key: 'Profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

/* ────────────────────────────────────────────────────────────
   Shared animation primitives (same pattern as DashboardScreen)
──────────────────────────────────────────────────────────── */

function FadeInUp({ delay = 0, distance = 16, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 480,
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

function AnimatedPressable({ style, onPress, onLongPress, children, scaleTo = 0.96, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={style}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Small pulsing halo used behind status pills / doc icons on hover of change. */
function Glow({ children }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function DocIcon({ def }) {
  return (
    <View style={[styles.docIconWrap, { backgroundColor: def.iconBg }]}>
      <MaterialCommunityIcons name={def.icon} size={22} color={def.iconColor} />
    </View>
  );
}

function StatusPill({ uploaded, uploading }) {
  if (uploading) {
    return (
      <View style={[styles.statusPill, { backgroundColor: '#EEF2FF' }]}>
        <ActivityIndicator size={10} color={PRIMARY} style={{ marginRight: 4 }} />
        <Text style={[styles.statusPillText, { color: PRIMARY }]}>Uploading</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusPill, uploaded ? styles.pillUploaded : styles.pillMissing]}>
      {uploaded
        ? <Ionicons name="checkmark-circle" size={12} color={GREEN} style={{ marginRight: 4 }} />
        : <Ionicons name="alert-circle" size={12} color={RED} style={{ marginRight: 4 }} />}
      <Text style={[styles.statusPillText, { color: uploaded ? GREEN : RED }]}>
        {uploaded ? 'Uploaded' : 'Missing'}
      </Text>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────
   Modern animated bottom tab bar
   - floating pill container
   - active tab gets a sliding highlight + icon bounce
──────────────────────────────────────────────────────────── */
function BottomTabBar({ activeKey, onNavigate }) {
  const containerWidth = Dimensions.get('window').width - 40; // matches horizontal margin
  const tabWidth = containerWidth / NAV_ITEMS.length;
  const activeIndex = Math.max(0, NAV_ITEMS.findIndex((i) => i.key === activeKey));

  const slideAnim = useRef(new Animated.Value(activeIndex)).current;
  const bounceAnims = useRef(NAV_ITEMS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeIndex,
      useNativeDriver: true,
      speed: 16,
      bounciness: 8,
    }).start();

    Animated.sequence([
      Animated.spring(bounceAnims[activeIndex], { toValue: 1.18, useNativeDriver: true, speed: 30, bounciness: 10 }),
      Animated.spring(bounceAnims[activeIndex], { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start();
  }, [activeIndex]);

  const translateX = slideAnim.interpolate({
    inputRange: NAV_ITEMS.map((_, i) => i),
    outputRange: NAV_ITEMS.map((_, i) => i * tabWidth),
  });

  return (
    <View style={styles.tabBarWrap}>
      <View style={[styles.tabBar, { width: containerWidth }]}>
        <Animated.View
          style={[
            styles.tabHighlight,
            {
              width: tabWidth - 12,
              transform: [{ translateX: Animated.add(translateX, new Animated.Value(6)) }],
            },
          ]}
        />
        {NAV_ITEMS.map((item, idx) => {
          const isActive = idx === activeIndex;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.tabItem}
              activeOpacity={0.8}
              onPress={() => onNavigate(item.key)}
            >
              <Animated.View style={{ transform: [{ scale: bounceAnims[idx] }], alignItems: 'center' }}>
                <Ionicons
                  name={isActive ? item.iconActive : item.icon}
                  size={20}
                  color={isActive ? PRIMARY : GRAY}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {item.label}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation, route }) {
  const { fullName: paramName = '' } = route?.params || {};

  const [fullName, setFullName]     = useState(paramName);
  const [email, setEmail]           = useState('');
  const [phone, setPhone]           = useState('');
  const [specialistId, setSpecialistId] = useState(
    'PHLEB-' + (paramName.split(' ')[0] || 'USER').toUpperCase() + '-01'
  );

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving]         = useState(false);

  // { doc_id: { name, key, uri?, previewUrl?, uploading } }
  const [docs, setDocs] = useState({});

  // ── Load profile from backend on mount ────────────────────────────────
  // NOTE: /api/phleb/profile/ is PUT-only on the backend (update_profile).
  // The actual profile read lives on the dashboard endpoint, under
  // `data.specialist` — same source the web portal uses.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await authGet(PHLEB_ENDPOINTS.dashboard);
        if (!isMounted || !data) return;

        const specialist = data.specialist || {};
        if (specialist.name) setFullName(specialist.name);
        if (specialist.email) setEmail(specialist.email);
        if (specialist.phone) setPhone(specialist.phone);
        if (specialist.id) setSpecialistId(specialist.id);

        // specialist.docs holds raw S3 keys; specialist.docs_urls holds
        // freshly signed, viewable URLs for the same keys.
        const rawDocs = specialist.docs || {};
        const docUrls = specialist.docs_urls || {};
        const restored = {};
        DOC_DEFS.forEach((def) => {
          const value = rawDocs[def.id];
          if (value) {
            restored[def.id] = {
              name: `${def.title}`,
              key: value,
              previewUrl: docUrls[def.id] || null,
            };
          }
        });
        setDocs((prev) => ({ ...restored, ...prev }));
      } catch (e) {
        // fail silently — keep whatever we had from navigation params
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // ── Request permissions ───────────────────────────────────────────────────
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  // ── Upload a picked file to the backend, then persist the resulting key
  //    onto the phlebotomist's profile record ───────────────────────────
  const uploadPickedFile = async (docId, { uri, name, mimeType }) => {
    setDocs((prev) => ({
      ...prev,
      [docId]: { ...(prev[docId] || {}), name, uri, type: mimeType, uploading: true },
    }));
    try {
      const result = await uploadDocument({
        uri,
        kind: docId,
        filename: name,
        contentType: mimeType,
      });
      const key = result?.key;

      if (key) {
        // Without this PUT, the file sits in S3 with nothing pointing to it
        // from Mongo — it would disappear from the profile on next load.
        await authPut(PHLEB_ENDPOINTS.profile, { docs: { [docId]: key } });
      }

      setDocs((prev) => ({
        ...prev,
        [docId]: { name, uri, type: mimeType, key, uploading: false },
      }));
    } catch (e) {
      setDocs((prev) => ({
        ...prev,
        [docId]: { ...(prev[docId] || {}), uploading: false },
      }));
      Alert.alert('Upload failed', 'Could not upload this document. Please try again.');
    }
  };

  // ── Pick from gallery (images OR pdf via DocumentPicker) ──────────────────
  const pickFromGallery = async (docId) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const file = result.assets[0];
        const ext  = (file.name.split('.').pop() || '').toLowerCase();
        const allowed = ['pdf', 'jpg', 'jpeg', 'png'];
        if (!allowed.includes(ext)) {
          Alert.alert('Unsupported file', 'Please choose a PDF, JPG, JPEG, or PNG file.');
          return;
        }
        await uploadPickedFile(docId, { uri: file.uri, name: file.name, mimeType: file.mimeType });
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open file picker.');
    }
  };

  // ── Pick from camera ──────────────────────────────────────────────────────
  const pickFromCamera = async (docId) => {
    const granted = await requestCameraPermission();
    if (!granted) {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      const name  = `photo_${docId}_${Date.now()}.jpg`;
      await uploadPickedFile(docId, { uri: asset.uri, name, mimeType: 'image/jpeg' });
    }
  };

  // ── Preview an already-uploaded document ───────────────────────────────
  const handlePreviewDoc = (doc) => {
    if (doc?.previewUrl) {
      Linking.openURL(doc.previewUrl).catch(() =>
        Alert.alert('Could not open', 'This document link could not be opened.')
      );
    } else if (doc?.uri) {
      // Freshly picked in this session, not yet backed by a signed URL.
      Linking.openURL(doc.uri).catch(() => {});
    } else {
      Alert.alert('Preview unavailable', 'No viewable link for this document yet.');
    }
  };

  // ── Show action sheet ─────────────────────────────────────────────────────
  const handleDocPress = (def) => {
    const existing = docs[def.id];
    const options = existing
      ? ['View Document', 'Replace — Choose from Gallery', 'Replace — Take a Photo', 'Cancel']
      : ['Choose from Gallery', 'Take a Photo', 'Cancel'];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: def.title,
          message: existing ? 'View or replace this document' : 'Choose upload method',
          options,
          cancelButtonIndex: options.length - 1,
        },
        (idx) => {
          if (existing) {
            if (idx === 0) handlePreviewDoc(existing);
            if (idx === 1) pickFromGallery(def.id);
            if (idx === 2) pickFromCamera(def.id);
          } else {
            if (idx === 0) pickFromGallery(def.id);
            if (idx === 1) pickFromCamera(def.id);
          }
        }
      );
    } else {
      const buttons = existing
        ? [
            { text: 'View Document', onPress: () => handlePreviewDoc(existing) },
            { text: 'Replace — Gallery', onPress: () => pickFromGallery(def.id) },
            { text: 'Replace — Camera', onPress: () => pickFromCamera(def.id) },
            { text: 'Cancel', style: 'cancel' },
          ]
        : [
            { text: 'Choose from Gallery', onPress: () => pickFromGallery(def.id) },
            { text: 'Take a Photo',        onPress: () => pickFromCamera(def.id)  },
            { text: 'Cancel', style: 'cancel' },
          ];

      Alert.alert(
        def.title,
        existing ? 'View or replace this document' : 'Choose upload method\n(Supported: PDF, JPG, JPEG, PNG)',
        buttons,
        { cancelable: true }
      );
    }
  };

  // ── Save profile to backend ───────────────────────────────────────────────
  // update_profile is a PUT-only view and only persists name/phone
  // (plus location, company, zip_codes, docs, profile_picture) — email is
  // not editable here, matching the web portal.
  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }
    setSaving(true);
    try {
      await authPut(PHLEB_ENDPOINTS.profile, {
        name: fullName,
        phone,
      });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Save failed', 'Could not update your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Remove a doc (local only — re-upload a blank slot to actually clear
  //    it server-side, since there's no dedicated delete endpoint) ──────────
  const handleRemoveDoc = (docId) => {
    Alert.alert('Remove document', 'Remove this uploaded file?', [
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setDocs((prev) => { const n = { ...prev }; delete n[docId]; return n; }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const initials = fullName
    .split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase() || '?';

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top bar ── */}
      <FadeInUp delay={0} distance={-10} style={styles.topBar}>
        <AnimatedPressable
          style={styles.backBtn}
          scaleTo={0.88}
          onPress={() => navigation?.navigate('PhlebDashboard', { fullName })}
        >
          <Ionicons name="arrow-back" size={20} color={PRIMARY} />
        </AnimatedPressable>
        <Text style={styles.pageTitle}>Profile</Text>
        <View style={{ width: 38 }} />
      </FadeInUp>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 20 }}
      >
        {/* ── Avatar hero ── */}
        <FadeInUp delay={70}>
          <View style={styles.avatarHero}>
            <Glow>
              <View style={styles.avatarCircle}>
                {loadingProfile
                  ? <ActivityIndicator color={PRIMARY} />
                  : <Text style={styles.avatarText}>{initials}</Text>}
              </View>
            </Glow>
            <Text style={styles.heroName}>{fullName || 'Your Name'}</Text>
            <View style={styles.idPill}>
              <Ionicons name="id-card-outline" size={13} color={PRIMARY} />
              <Text style={styles.idPillText}>{specialistId}</Text>
            </View>
          </View>
        </FadeInUp>

        {/* ── Personal Information ── */}
        <FadeInUp delay={130}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle-outline" size={18} color={PRIMARY} />
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
        </FadeInUp>

        <FadeInUp delay={170}>
          <View style={styles.card}>
            <FieldBlock
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              icon="person-outline"
            />
            <View style={styles.fieldDivider} />
            <FieldBlock
              label="Email"
              value={email}
              editable={false}
              icon="mail-outline"
              locked
            />
            <View style={styles.fieldDivider} />
            <FieldBlock
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              icon="call-outline"
              keyboardType="phone-pad"
            />
            <View style={styles.fieldDivider} />
            <FieldBlock
              label="Specialist ID"
              value={specialistId}
              editable={false}
              icon="barcode-outline"
              locked
            />
          </View>
        </FadeInUp>

        <FadeInUp delay={210}>
          <AnimatedPressable
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            scaleTo={0.97}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#FFF" size="small" />
              : (
                <>
                  <Feather name="check" size={16} color="#FFF" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
          </AnimatedPressable>
        </FadeInUp>

        {/* ── Documents ── */}
        <FadeInUp delay={250}>
          <View style={[styles.sectionHeader, { marginTop: 28 }]}>
            <Ionicons name="document-text-outline" size={18} color={PRIMARY} />
            <Text style={styles.sectionTitle}>Documents</Text>
          </View>
          <Text style={styles.docHint}>
            Tap a document to upload or view · Supported: PDF, JPG, JPEG, PNG
          </Text>
        </FadeInUp>

        <View style={styles.card}>
          {DOC_DEFS.map((def, idx) => {
            const doc = docs[def.id];
            const uploaded = !!doc && !doc.uploading;
            return (
              <FadeInUp key={def.id} delay={290 + idx * 60}>
                {idx > 0 && <View style={styles.fieldDivider} />}
                <AnimatedPressable
                  style={styles.docRow}
                  scaleTo={0.98}
                  onPress={() => handleDocPress(def)}
                  onLongPress={() => uploaded && handleRemoveDoc(def.id)}
                >
                  <DocIcon def={def} />

                  <View style={styles.docInfo}>
                    <Text style={styles.docTitle}>{def.title}</Text>
                    {doc
                      ? <Text style={styles.docFileName} numberOfLines={1}>{doc.name}</Text>
                      : <Text style={styles.docSubtitle}>{def.subtitle}</Text>}
                  </View>

                  <View style={styles.docRight}>
                    <StatusPill uploaded={uploaded} uploading={!!doc?.uploading} />
                    <Ionicons
                      name={uploaded ? 'cloud-done-outline' : 'cloud-upload-outline'}
                      size={18}
                      color={uploaded ? GREEN : GRAY}
                      style={{ marginTop: 6 }}
                    />
                  </View>
                </AnimatedPressable>
              </FadeInUp>
            );
          })}
        </View>

        {/* ── Re-upload all ── */}
        <FadeInUp delay={520}>
          <AnimatedPressable
            style={styles.reuploadBtn}
            scaleTo={0.97}
            onPress={() => Alert.alert('Re-upload All', 'Please tap each document individually to upload.')}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={AMBER} />
            <Text style={styles.reuploadText}>Re-upload All Documents</Text>
          </AnimatedPressable>

          <Text style={styles.removeHint}>Long-press an uploaded document to remove it locally · Tap it to view</Text>
        </FadeInUp>
      </ScrollView>

      {/* ── Bottom Nav (Home / History / Profile only) ── */}
      <BottomTabBar
        activeKey="Profile"
        onNavigate={(key) => {
          if (key === 'Profile') return;
          navigation?.navigate(key, { fullName });
        }}
      />
    </SafeAreaView>
  );
}

// ── Field component ──────────────────────────────────────────────────────────
function FieldBlock({ label, value, onChangeText, placeholder, icon, editable = true, locked, keyboardType, autoCapitalize }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, locked && styles.inputRowLocked]}>
        <Ionicons name={icon} size={16} color={locked ? GRAY : PRIMARY} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, !editable && styles.inputDisabled]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#C4CAD4"
          editable={editable}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'words'}
        />
        {locked && <Ionicons name="lock-closed-outline" size={14} color="#C4CAD4" />}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },

  avatarHero: { alignItems: 'center', paddingVertical: 24 },
  avatarCircle: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: '#E8ECF7',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: PRIMARY,
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: PRIMARY },
  heroName: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  idPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  idPillText: { fontSize: 12, fontWeight: '700', color: PRIMARY },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
    marginBottom: 4,
  },
  fieldDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 4 },

  fieldBlock: { paddingVertical: 14 },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: GRAY,
    letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F6F8FC',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  inputRowLocked: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, fontWeight: '500', color: '#111827' },
  inputDisabled: { color: GRAY },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 16, paddingVertical: 16,
    marginTop: 16,
    shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  docHint: { fontSize: 12, color: GRAY, marginBottom: 10, lineHeight: 16 },

  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  docIconWrap: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  docSubtitle: { fontSize: 12, color: GRAY, marginTop: 2 },
  docFileName: { fontSize: 11, color: '#6B7280', marginTop: 2, fontStyle: 'italic' },
  docRight: { alignItems: 'flex-end' },

  statusPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  pillMissing: { backgroundColor: '#FEE2E2' },
  pillUploaded: { backgroundColor: '#DCFCE7' },
  statusPillText: { fontSize: 10, fontWeight: '700' },

  reuploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#FDE68A',
    marginTop: 12,
  },
  reuploadText: { fontSize: 13, fontWeight: '700', color: AMBER },

  removeHint: { textAlign: 'center', fontSize: 11, color: '#C4CAD4', marginTop: 10 },

  // ── Modern floating pill tab bar ──
  tabBarWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 18,
    paddingTop: 6,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: PRIMARY_D,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  tabHighlight: {
    position: 'absolute',
    top: 6,
    left: 0,
    height: 44,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabLabel: { fontSize: 11, color: GRAY, fontWeight: '600', marginTop: 3 },
  tabLabelActive: { color: PRIMARY, fontWeight: '800' },
});