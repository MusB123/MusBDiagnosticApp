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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { PHLEB_ENDPOINTS } from '../config/api';
import { authGet, authPatch, uploadDocument } from '../utils/auth';

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
const DOC_DEFS = [
  {
    id: 'driving_license',
    title: 'Driving License',
    subtitle: 'Government-issued photo ID',
    icon: 'card-account-details-outline',
    iconBg: '#EEF2FF',
    iconColor: PRIMARY,
  },
  {
    id: 'phlebotomy_cert',
    title: 'Phlebotomy Certificate',
    subtitle: 'Certification of competency',
    icon: 'shield-check-outline',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
  },
  {
    id: 'liability_insurance',
    title: 'Liability Insurance',
    subtitle: 'Professional indemnity document',
    icon: 'file-document-outline',
    iconBg: '#FEF3C7',
    iconColor: AMBER,
  },
  {
    id: 'bank_statement',
    title: 'Bank Statement',
    subtitle: 'Recent statement for payout verification',
    icon: 'bank-outline',
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
  },
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

  // { doc_id: { name, uri, type, key, uploading } }
  const [docs, setDocs] = useState({});

  // ── Load profile from backend on mount ────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await authGet(PHLEB_ENDPOINTS.profile);
        if (!isMounted || !data) return;

        if (data.full_name || data.fullName) setFullName(data.full_name || data.fullName);
        if (data.email) setEmail(data.email);
        if (data.phone) setPhone(data.phone);
        if (data.specialist_id) setSpecialistId(data.specialist_id);

        // If the backend returns known document keys/urls, reflect them as uploaded
        if (data.documents && typeof data.documents === 'object') {
          const restored = {};
          DOC_DEFS.forEach((def) => {
            const entry = data.documents[def.id];
            if (entry) {
              restored[def.id] = {
                name: entry.filename || entry.name || `${def.title}.pdf`,
                key: entry.key || entry.url,
              };
            }
          });
          setDocs((prev) => ({ ...restored, ...prev }));
        }
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

  // ── Upload a picked file to the backend ────────────────────────────────
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
      setDocs((prev) => ({
        ...prev,
        [docId]: { name, uri, type: mimeType, key: result?.key, uploading: false },
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

  // ── Show action sheet ─────────────────────────────────────────────────────
  const handleDocPress = (def) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: def.title,
          message: 'Choose upload method',
          options: ['Choose from Gallery', 'Take a Photo', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (idx) => {
          if (idx === 0) pickFromGallery(def.id);
          if (idx === 1) pickFromCamera(def.id);
        }
      );
    } else {
      Alert.alert(
        def.title,
        'Choose upload method\n(Supported: PDF, JPG, JPEG, PNG)',
        [
          { text: 'Choose from Gallery', onPress: () => pickFromGallery(def.id) },
          { text: 'Take a Photo',        onPress: () => pickFromCamera(def.id)  },
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );
    }
  };

  // ── Save profile to backend ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }
    setSaving(true);
    try {
      await authPatch(PHLEB_ENDPOINTS.profile, {
        full_name: fullName,
        email,
        phone,
      });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Save failed', 'Could not update your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Remove a doc ──────────────────────────────────────────────────────────
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
        contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
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
              onChangeText={setEmail}
              placeholder="Enter your email"
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
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
            Tap a document to upload · Supported: PDF, JPG, JPEG, PNG
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

          <Text style={styles.removeHint}>Long-press an uploaded document to remove it</Text>
        </FadeInUp>
      </ScrollView>

      {/* ── Bottom Nav ── */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation?.navigate('PhlebDashboard', { fullName })}
        >
          <Ionicons name="home-outline" size={22} color={GRAY} />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation?.navigate('PhlebHistory', { fullName })}
        >
          <Ionicons name="time-outline" size={22} color={GRAY} />
          <Text style={styles.navLabel}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation?.navigate('Earnings', { fullName })}
        >
          <Ionicons name="bar-chart-outline" size={22} color={GRAY} />
          <Text style={styles.navLabel}>Earnings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person" size={22} color={PRIMARY} />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Profile</Text>
        </TouchableOpacity>
      </View>
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

  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    paddingVertical: 10,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 11, color: GRAY, fontWeight: '500' },
  navLabelActive: { color: PRIMARY, fontWeight: '700' },
});
