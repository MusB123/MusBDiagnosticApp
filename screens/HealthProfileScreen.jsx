import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadDocument, updatePatientProfile } from '../utils/auth';

const COLORS = {
  navy: '#1B3A8C',
  navyDark: '#0D1F3C',
  white: '#FFFFFF',
  offWhite: '#F4F7FB',
  lightGray: '#E8EEF5',
  gray: '#8A9BB0',
  bodyText: '#4A5568',
  border: '#D1DBE8',
  yellowBg: '#FFFBEB',
  yellowBorder: '#F59E0B',
  yellowText: '#92400E',
};

export default function HealthProfileScreen({ navigation,route }) {
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [memberId, setMemberId] = useState('');
  // Each doc: { key: string|null, busy: bool } — `key` is the S3 storage key.
  const [insurance, setInsurance] = useState({ key: null, busy: false });
  const [photoId, setPhotoId] = useState({ key: null, busy: false });
  const [saving, setSaving] = useState(false);

  // Pick an image (compressed) → upload to S3 → keep the returned key.
  const pickAndUpload = async (kind, filename, current, setDoc) => {
    if (current.busy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo access to upload documents.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.5,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets ? result.assets[0] : result;
      if (!asset?.base64) {
        Alert.alert('Upload failed', 'Could not read the selected image. Please try again.');
        return;
      }
      setDoc({ key: current.key, busy: true });
      const { key } = await uploadDocument({
        uri: asset.uri,          // enables direct-to-S3 (presigned)
        base64: asset.base64,    // fallback if direct upload unavailable
        kind: 'patient-docs',
        filename,
      });
      setDoc({ key, busy: false });
    } catch (err) {
      setDoc({ key: current.key, busy: false });
      Alert.alert('Upload failed', err.message === 'NETWORK_ERROR'
        ? 'Network error. Please check your connection and try again.'
        : (err.message || 'Could not upload the document.'));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePatientProfile({
        insurance_provider: insuranceProvider,
        insurance_member_id: memberId,
        insurance_doc: insurance.key,   // S3 key or null
        photo_id: photoId.key,          // S3 key or null
      });
    } catch (err) {
      // Optional step — don't block the user, but let them know if it didn't save.
      if (err.message !== 'NOT_LOGGED_IN') {
        Alert.alert('Heads up', 'We could not save your health profile right now. You can add it later from Profile settings.');
      }
    } finally {
      setSaving(false);
      navigation.navigate('PatientHome', { firstName: route.params?.firstName });
    }
  };

  const uploadSubLabel = (doc) =>
    doc.busy ? 'Uploading…' : doc.key ? '✓ Uploaded' : 'Tap to upload';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.navyDark} />
          </TouchableOpacity>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>MusB</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Health profile</Text>
            <Text style={styles.headerStep}>Step 2 of 2</Text>
          </View>
          {/* Progress dots */}
          <View style={styles.progressDots}>
            <View style={[styles.dot, styles.dotDone]} />
            <View style={[styles.dot, styles.dotActive]} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Optional notice */}
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeIcon}>ⓘ</Text>
            <Text style={styles.noticeText}>
              This step is optional — you can skip and add later in Profile settings.
            </Text>
          </View>

          {/* Insurance Details */}
          <Text style={styles.sectionLabel}>
            Insurance details <Text style={styles.optionalTag}>(optional)</Text>
          </Text>

          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Insurance provider</Text>
            <TextInput
              style={styles.input}
              value={insuranceProvider}
              onChangeText={setInsuranceProvider}
              placeholder="e.g. Blue Cross Blue Shield"
              placeholderTextColor={COLORS.gray}
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Member ID</Text>
            <TextInput
              style={styles.input}
              value={memberId}
              onChangeText={setMemberId}
              placeholder="Member ID"
              placeholderTextColor={COLORS.gray}
            />
          </View>

          {/* Documents */}
          <Text style={styles.sectionLabel}>
            Documents <Text style={styles.optionalTag}>(optional)</Text>
          </Text>

          <View style={styles.uploadRow}>
            <TouchableOpacity
              style={[styles.uploadCard, insurance.key && styles.uploadCardDone]}
              activeOpacity={0.8}
              disabled={insurance.busy}
              onPress={() => pickAndUpload('insurance', 'insurance-card.jpg', insurance, setInsurance)}
            >
              {insurance.busy
                ? <ActivityIndicator color={COLORS.navy} style={{ marginBottom: 4, height: 26 }} />
                : <Text style={styles.uploadIcon}>📷</Text>}
              <Text style={styles.uploadLabel}>Insurance card</Text>
              <Text style={styles.uploadSub}>{uploadSubLabel(insurance)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.uploadCard, photoId.key && styles.uploadCardDone]}
              activeOpacity={0.8}
              disabled={photoId.busy}
              onPress={() => pickAndUpload('photo_id', 'photo-id.jpg', photoId, setPhotoId)}
            >
              {photoId.busy
                ? <ActivityIndicator color={COLORS.navy} style={{ marginBottom: 4, height: 26 }} />
                : <Text style={styles.uploadIcon}>🪪</Text>}
              <Text style={styles.uploadLabel}>Photo ID</Text>
              <Text style={styles.uploadSub}>{uploadSubLabel(photoId)}</Text>
            </TouchableOpacity>
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, (saving || insurance.busy || photoId.busy) && { opacity: 0.6 }]}
            activeOpacity={0.85}
            disabled={saving || insurance.busy || photoId.busy}
            onPress={handleSave}
          >
            {saving
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.saveBtnText}>Save &amp; finish</Text>}
          </TouchableOpacity>

          {/* Skip */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('PatientHome',{firstName: route.params?.firstName})}
          >
            <Text style={styles.skipText}>Skip for now →</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.offWhite,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.navyDark,
  },
  headerStep: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 1,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.lightGray,
  },
  dotActive: {
    backgroundColor: COLORS.navy,
  },
  dotDone: {
    backgroundColor: COLORS.navy,
    opacity: 0.4,
  },

  // ── Content ──
  scroll: { flex: 1 },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },

  // ── Notice Banner ──
  noticeBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.yellowBg,
    borderWidth: 1,
    borderColor: COLORS.yellowBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    alignItems: 'flex-start',
    gap: 10,
  },
  noticeIcon: {
    fontSize: 16,
    color: COLORS.yellowBorder,
    marginTop: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.yellowText,
    fontWeight: '600',
    lineHeight: 20,
  },

  // ── Section Labels ──
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navyDark,
    marginBottom: 14,
  },
  optionalTag: {
    fontWeight: '400',
    color: COLORS.gray,
    fontSize: 13,
  },

  // ── Fields ──
  fieldWrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: COLORS.bodyText,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.navyDark,
  },

  // ── Upload Cards ──
  uploadRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 28,
  },
  uploadCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    gap: 6,
  },
  uploadCardDone: {
    borderColor: COLORS.navy,
    backgroundColor: '#EBF0FB',
    borderStyle: 'solid',
  },
  uploadIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  uploadLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.navyDark,
  },
  uploadSub: {
    fontSize: 12,
    color: COLORS.gray,
  },

  // ── Buttons ──
  saveBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 16,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  skipText: {
    textAlign: 'center',
    fontSize: 14,
    color: COLORS.navy,
    fontWeight: '600',
  },
});