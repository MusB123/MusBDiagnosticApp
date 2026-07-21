import React, { useState, useCallback, useRef } from 'react';
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
  Modal,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
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

// Distinct accent per document type so the row reads as three clear choices
// instead of three identical gray boxes.
const DOC_META = {
  insurance: {
    label: 'Insurance card',
    icon: 'shield-checkmark-outline',
    doneIcon: 'checkmark-circle',
    accent: '#2563EB',
    accentBg: '#EAF1FE',
  },
  photoId: {
    label: 'Photo ID',
    icon: 'card-outline',
    doneIcon: 'checkmark-circle',
    accent: '#7C3AED',
    accentBg: '#F3EEFE',
  },
  prescription: {
    label: 'Prescription',
    icon: 'document-text-outline',
    doneIcon: 'checkmark-circle',
    accent: '#059669',
    accentBg: '#E8F8F1',
  },
};

// Small self-contained animated card: scales down on press-in and springs
// back on press-out/release, so tapping any upload tile feels responsive.
function UploadCard({ docType, doc, onPress }) {
  const meta = DOC_META[docType];
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  const subLabel = doc.busy ? 'Uploading…' : doc.key ? 'Uploaded' : 'Tap to upload';

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={doc.busy}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={onPress}
        style={[
          styles.uploadCard,
          { borderColor: doc.key ? meta.accent : COLORS.border },
          doc.key && { backgroundColor: meta.accentBg, borderStyle: 'solid' },
        ]}
      >
        <View
          style={[
            styles.uploadIconWrap,
            { backgroundColor: doc.key ? meta.accent : meta.accentBg },
          ]}
        >
          {doc.busy ? (
            <ActivityIndicator color={doc.key ? COLORS.white : meta.accent} size="small" />
          ) : (
            <Ionicons
              name={doc.key ? meta.doneIcon : meta.icon}
              size={22}
              color={doc.key ? COLORS.white : meta.accent}
            />
          )}
        </View>
        <Text style={styles.uploadLabel}>{meta.label}</Text>
        <Text style={[styles.uploadSub, doc.key && { color: meta.accent, fontWeight: '700' }]} numberOfLines={1}>
          {subLabel}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HealthProfileScreen({ navigation, route }) {
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [memberId, setMemberId] = useState('');
  // Each doc: { key: string|null, busy: bool, fileName: string|null }
  const [insurance, setInsurance] = useState({ key: null, busy: false, fileName: null });
  const [prescription, setPrescription] = useState({ key: null, busy: false, fileName: null });
  const [photoId, setPhotoId] = useState({ key: null, busy: false, fileName: null });
  const [saving, setSaving] = useState(false);

  // Holds a picked/cropped file waiting for user confirmation before it's
  // actually uploaded. Shape: { docType: 'insurance'|'photoId', fileName, base64, uri, isPdf }
  const [pendingUpload, setPendingUpload] = useState(null);
  const [uploadingModal, setUploadingModal] = useState(false);

  const shortName = (uri = '') => {
    const clean = uri.split('?')[0];
    const parts = clean.split('/');
    return parts[parts.length - 1] || 'document';
  };

  // Resize + compress before touching base64
  const compressImage = async (uri) => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return result; // { uri, base64, width, height }
  };

  // ---------- Pickers: stage the file in `pendingUpload` only ----------
  // Wrapped in useCallback so these don't get recreated (and re-bound to
  // TouchableOpacity) on every keystroke in the text inputs above — that
  // reference churn was what caused the upload cards / buttons to "flicker".

  const handleCamera = useCallback(async (docType) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera access needed',
        'Please enable camera permissions in your device settings to take a photo.'
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      base64: false,
    });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      try {
        const compressed = await compressImage(asset.uri);
        setPendingUpload({
          docType,
          fileName: asset.fileName || shortName(asset.uri),
          base64: compressed.base64,
          uri: compressed.uri,
          isPdf: false,
        });
      } catch (err) {
        console.log(err);
        Alert.alert('Could not process photo', 'Please try taking the photo again.');
      }
    }
  }, []);

  const pickImage = useCallback(async (docType) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to upload documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: false,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    try {
      const compressed = await compressImage(asset.uri);
      setPendingUpload({
        docType,
        fileName: asset.fileName || shortName(asset.uri),
        base64: compressed.base64,
        uri: compressed.uri,
        isPdf: false,
      });
    } catch (err) {
      console.log(err);
      Alert.alert('Could not process photo', 'Please try picking the photo again.');
    }
  }, []);

  const pickPdf = useCallback(async (docType) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64',
      });

      setPendingUpload({
        docType,
        fileName: asset.name,
        base64,
        uri: asset.uri,
        isPdf: true,
      });
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'Could not open PDF.');
    }
  }, []);

  const handleFilePicker = useCallback((docType) => {
    Alert.alert('Select Document', 'Choose the type of file', [
      { text: 'Image', onPress: () => pickImage(docType) },
      { text: 'PDF', onPress: () => pickPdf(docType) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pickImage, pickPdf]);

  const handleUploadPress = useCallback((docType, title) => {
    // Read latest busy state at call-time via functional updates instead of
    // depending on `insurance`/`photoId` in the closure — keeps this handler
    // stable across renders instead of being rebuilt on every keystroke.
    setInsurance((cur) => {
      if (docType === 'insurance' && cur.busy) return cur;
      return cur;
    });
    Alert.alert(
      title,
      'Choose how you would like to add this document',
      [
        { text: 'Choose File', onPress: () => handleFilePicker(docType) },
        { text: 'Take Photo', onPress: () => handleCamera(docType) },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  }, [handleFilePicker, handleCamera]);

  // ---------- Confirmation modal actions ----------

  const confirmUpload = useCallback(async () => {
    if (!pendingUpload || uploadingModal) return;
    const { docType, fileName, uri, base64 } = pendingUpload;
    setUploadingModal(true);

    const setDoc = docType === 'insurance' ? setInsurance
      : docType === 'photoId' ? setPhotoId
      : setPrescription;
    setDoc((cur) => ({ ...cur, busy: true }));

    try {
      const { key } = await uploadDocument({
        uri,
        base64,
        kind: 'patient-docs',
        filename: fileName,
      });
      setDoc({ key, busy: false, fileName });
      setPendingUpload(null);
    } catch (err) {
      setDoc((cur) => ({ ...cur, busy: false }));
      Alert.alert('Upload failed', err.message === 'NETWORK_ERROR'
        ? 'Network error. Please check your connection and try again.'
        : (err.message || 'Could not upload the document.'));
    } finally {
      setUploadingModal(false);
    }
  }, [pendingUpload, uploadingModal]);

  const cancelUpload = useCallback(() => {
    if (uploadingModal) return;
    setPendingUpload(null);
  }, [uploadingModal]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updatePatientProfile({
        insurance_provider: insuranceProvider,
        insurance_member_id: memberId,
        insurance_doc: insurance.key,
        photo_id: photoId.key,
        prescription_doc: prescription.key,
      });
    } catch (err) {
      if (err.message !== 'NOT_LOGGED_IN') {
        Alert.alert('Heads up', 'We could not save your health profile right now. You can add it later from Profile settings.');
      }
    } finally {
      setSaving(false);
      navigation.navigate('PatientHome', { firstName: route.params?.firstName });
    }
  }, [insuranceProvider, memberId, insurance.key, photoId.key, prescription.key, navigation, route.params?.firstName]);

  const handleSkip = useCallback(() => {
    navigation.navigate('PatientHome', { firstName: route.params?.firstName });
  }, [navigation, route.params?.firstName]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header — logo anchored to the left corner and sized up so the
            brand reads clearly, back button now sits after it */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.navyDark} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Health profile</Text>
            <Text style={styles.headerStep}>Step 2 of 2</Text>
          </View>
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
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeIcon}>ⓘ</Text>
            <Text style={styles.noticeText}>
              This step is optional — you can skip and add later in Profile settings.
            </Text>
          </View>

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

          <Text style={styles.sectionLabel}>
            Documents <Text style={styles.optionalTag}>(optional)</Text>
          </Text>

          <View style={styles.uploadRow}>
            <UploadCard
              docType="insurance"
              doc={insurance}
              onPress={() => handleUploadPress('insurance', 'Insurance card')}
            />
            <UploadCard
              docType="photoId"
              doc={photoId}
              onPress={() => handleUploadPress('photoId', 'Photo ID')}
            />
            <UploadCard
              docType="prescription"
              doc={prescription}
              onPress={() => handleUploadPress('prescription', 'Prescription')}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (saving || insurance.busy || photoId.busy || prescription.busy) && styles.saveBtnDisabled]}
            activeOpacity={0.85}
            disabled={saving || insurance.busy || photoId.busy || prescription.busy}
            onPress={handleSave}
          >
            {saving
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.saveBtnText}>Save &amp; finish</Text>}
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip for now →</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Confirmation modal — shown after a photo/PDF is picked, before upload */}
      <Modal
        visible={!!pendingUpload}
        transparent
        animationType="fade"
        onRequestClose={cancelUpload}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm document</Text>

            {pendingUpload?.isPdf ? (
              <View style={styles.pdfPreviewBox}>
                <Text style={styles.pdfPreviewText}>📄 {pendingUpload?.fileName}</Text>
              </View>
            ) : (
              <Image
                source={{ uri: pendingUpload?.uri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            )}

            <Text style={styles.modalFileName} numberOfLines={1}>
              {pendingUpload?.fileName}
            </Text>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={cancelUpload} disabled={uploadingModal}>
                <Text style={styles.modalCancelText}>Retake / Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalUploadBtn} onPress={confirmUpload} disabled={uploadingModal}>
                {uploadingModal
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.modalUploadText}>Upload</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    gap: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.offWhite, borderWidth: 1, borderColor: COLORS.lightGray,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  headerText: { flex: 1, marginLeft: 6 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark },
  headerStep: { fontSize: 12, color: COLORS.gray, marginTop: 1 },
  progressDots: { flexDirection: 'row', gap: 6 },
  dot: { width: 28, height: 6, borderRadius: 3, backgroundColor: COLORS.lightGray },
  dotActive: { backgroundColor: COLORS.navy },
  dotDone: { backgroundColor: COLORS.navy, opacity: 0.4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  noticeBanner: {
    flexDirection: 'row', backgroundColor: COLORS.yellowBg, borderWidth: 1,
    borderColor: COLORS.yellowBorder, borderRadius: 12, padding: 14, marginBottom: 24,
    alignItems: 'flex-start', gap: 10,
  },
  noticeIcon: { fontSize: 16, color: COLORS.yellowBorder, marginTop: 1 },
  noticeText: { flex: 1, fontSize: 13, color: COLORS.yellowText, fontWeight: '600', lineHeight: 20 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: COLORS.navyDark, marginBottom: 14 },
  optionalTag: { fontWeight: '400', color: COLORS.gray, fontSize: 13 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, color: COLORS.bodyText, marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.navyDark,
  },
  uploadRow: { flexDirection: 'row', gap: 14, marginBottom: 28 },
  uploadCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    gap: 6,
    shadowColor: COLORS.navyDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  uploadIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  uploadLabel: { fontSize: 13, fontWeight: '700', color: COLORS.navyDark },
  uploadSub: { fontSize: 12, color: COLORS.gray },
  saveBtn: { backgroundColor: COLORS.navy, borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginBottom: 16 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  skipText: { textAlign: 'center', fontSize: 14, color: COLORS.navy, fontWeight: '600' },

  // ---- Upload confirmation modal ----
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(13, 33, 86, 0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: { width: '100%', backgroundColor: COLORS.white, borderRadius: 20, padding: 18 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navyDark, marginBottom: 12, textAlign: 'center' },
  previewImage: { width: '100%', height: 220, borderRadius: 12, backgroundColor: COLORS.offWhite },
  pdfPreviewBox: {
    width: '100%', height: 120, borderRadius: 12,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
  },
  pdfPreviewText: { fontSize: 14, color: COLORS.navyDark, fontWeight: '600' },
  modalFileName: { marginTop: 10, fontSize: 12.5, color: COLORS.gray, textAlign: 'center' },
  modalButtonRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 24, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center',
  },
  modalCancelText: { color: COLORS.gray, fontWeight: '700', fontSize: 13.5 },
  modalUploadBtn: { flex: 1, paddingVertical: 13, borderRadius: 24, backgroundColor: COLORS.navy, alignItems: 'center' },
  modalUploadText: { color: COLORS.white, fontWeight: '700', fontSize: 13.5 },
});