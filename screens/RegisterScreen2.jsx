import React, { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ---- Document config (single source of truth) ----
// ⚠ Keys map directly to the Django submit_application fields
// (dlFront, dlBack, certificate, insuranceDoc). Don't rename these keys
// without also updating Step 3's applyPhleb() call.
const INITIAL_DOCUMENTS = {
  dlFront: {
    key: 'dlFront',
    title: "Driver's licence — front",
    subtitle: 'Clear photo, all corners visible',
    required: true,
    status: 'pending', // 'pending' | 'done'
    fileName: null,
    base64: null,
  },
  dlBack: {
    key: 'dlBack',
    title: "Driver's licence — back",
    subtitle: 'Clear photo, all corners visible',
    required: true,
    status: 'pending',
    fileName: null,
    base64: null,
  },
  certificate: {
    key: 'certificate',
    title: 'Phlebotomy certificate',
    subtitle: 'State issued · expiry must be visible',
    required: true,
    status: 'pending',
    fileName: null,
    base64: null,
  },
  insuranceDoc: {
    key: 'insuranceDoc',
    title: 'Liability insurance',
    subtitle: 'Minimum $1M coverage required',
    required: true,
    status: 'pending',
    fileName: null,
    base64: null,
  },
};

export default function RegisterStep2({ navigation, route }) {
  // Everything collected on Step 1 (fullName, dob, address, phone, email)
  // just rides along in route.params and gets forwarded to Step 3 below —
  // this screen doesn't need to read individual fields out of it.
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);

  // Holds a picked/cropped file waiting for user confirmation before it's
  // actually saved into `documents`. Shape: { key, fileName, base64, uri, isPdf }
  const [pendingUpload, setPendingUpload] = useState(null);

  const requiredKeys = Object.values(documents).filter((d) => d.required);
  const completedRequired = requiredKeys.filter((d) => d.status === 'done').length;
  const progress = requiredKeys.length
    ? completedRequired / requiredKeys.length
    : 0;

  const setDocStatus = (key, updates) => {
    setDocuments((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }));
  };

  const shortName = (uri = '') => {
    const clean = uri.split('?')[0];
    const parts = clean.split('/');
    return parts[parts.length - 1] || 'document';
  }; 

  // Resize + compress before we ever touch base64 — keeps documents well
// under MongoDB's 16MB BSON limit even with 4 files combined.
  const compressImage = async (uri) => {
   const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }], // cap width, height auto-scales
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
   );
   return result; // { uri, base64, width, height }
  };


  // ---------- Pickers: these only stage the file in `pendingUpload`.  ----------
  // ---------- Nothing is saved into `documents` until the user taps  ----------
  // ---------- "Upload" in the confirmation modal.                    ----------

  const handleCamera = async (key) => {
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
      try{
        const compressed = await compressImage(asset.uri);
        setPendingUpload({
         key,
         fileName: asset.fileName || shortName(asset.uri),
         base64: asset.base64,
         uri: compressed.uri,
        isPdf: false,
      });
    } catch (err) {
      Alert.alert('Could not process photo', 'Please try taking the photo again.');
    }
   }
  };

  const pickImage = async (key) => {
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
        key,
        fileName: asset.fileName || shortName(asset.uri),
        base64: compressed.base64,
        uri: compressed.uri,
        isPdf: false,
      });
      } catch (err) {
         Alert.alert('Could not process photo', 'Please try picking the photo again.');
      }
   }; 


  const pickPdf = async (key) => {
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
        key,
        fileName: asset.name,
        base64,
        uri: asset.uri,
        isPdf: true,
      });
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'Could not open PDF.');
    }
  };

  const handleFilePicker = (key) => {
    Alert.alert('Select Document', 'Choose the type of file', [
      { text: 'Image', onPress: () => pickImage(key) },
      { text: 'PDF', onPress: () => pickPdf(key) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleUploadPress = (doc) => {
    Alert.alert(
      doc.title,
      'Choose how you would like to add this document',
      [
        { text: 'Choose File', onPress: () => handleFilePicker(doc.key) },
        { text: 'Take Photo', onPress: () => handleCamera(doc.key) },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // ---------- Confirmation modal actions ----------

  const confirmUpload = () => {
    if (!pendingUpload) return;
    const { key, fileName, base64 } = pendingUpload;
    setDocStatus(key, { status: 'done', fileName, base64 });
    setPendingUpload(null);
  };

  const cancelUpload = () => {
    setPendingUpload(null);
  };

  // No backend call here anymore — Step 3 collects password + bank/W9 info
  // and submits the whole application (personal info + docs + bank + W9)
  // to applyPhleb() in a single call. This screen just forwards everything
  // it has, plus whatever Step 1 already put in route.params, onward.
  const handleContinue = () => {
    const missing = requiredKeys.filter((d) => d.status !== 'done');
    if (missing.length > 0) {
      Alert.alert(
        'Missing documents',
        `Please upload: ${missing.map((d) => d.title).join(', ')} before continuing.`
      );
      return;
    }

    navigation.navigate('RegisterScreen3', {
      ...route.params,
      dlFront: documents.dlFront.base64,
      dlFrontName: documents.dlFront.fileName,
      dlBack: documents.dlBack.base64,
      dlBackName: documents.dlBack.fileName,
      certificate: documents.certificate.base64,
      certificateName: documents.certificate.fileName,
      insuranceDoc: documents.insuranceDoc.base64,
      insuranceDocName: documents.insuranceDoc.fileName,
    });
  };

  const DocumentCard = ({ doc }) => {
    const isDone = doc.status === 'done';
    const badge = isDone
      ? { bg: '#E6F6EC', text: '#1E9E5A', label: 'Done' }
      : doc.required
      ? { bg: '#FFF3DC', text: '#C9891D', label: 'Pending' }
      : { bg: '#EEF1F6', text: '#727C8E', label: 'Optional' };

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => handleUploadPress(doc)}
      >
        <View style={[styles.iconBox, isDone && { backgroundColor: '#E6F6EC' }]}>
          <Text style={styles.iconText}>{isDone ? '✓' : '📄'}</Text>
        </View>

        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.cardTitle}>{doc.title}</Text>
          <Text
            style={[styles.cardSubtitle, isDone && { color: '#1E9E5A' }]}
            numberOfLines={1}
          >
            {isDone ? doc.fileName : doc.subtitle}
          </Text>
          {isDone && <Text style={styles.changeText}>Tap to replace</Text>}
        </View>

        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>MusB</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.stepTitle}>Register — step 2{'\n'}of 3</Text>
            <Text style={styles.stepSubtitle}>Licences & certifications</Text>
          </View>
          <View style={styles.progressDots}>
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>
        </View>

        <Text style={styles.subtitle}>
          Upload clear photos or PDFs of each document. All four are required.
        </Text>

        {/* Progress */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {completedRequired} of {requiredKeys.length} required documents uploaded
          </Text>
        </View>

        {Object.values(documents).map((doc) => (
          <DocumentCard doc={doc} key={doc.key} />
        ))}

        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Confirmation modal — shown after a photo/PDF is picked & cropped,
          before it's actually saved into `documents`. */}
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
              <TouchableOpacity style={styles.modalCancelBtn} onPress={cancelUpload}>
                <Text style={styles.modalCancelText}>Retake / Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalUploadBtn} onPress={confirmUpload}>
                <Text style={styles.modalUploadText}>Upload</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    marginTop: 4,
    gap: 12,
  },
  logoBox: {
    width: 42,
    height: 42,
    backgroundColor: '#0D2156',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D2156',
    lineHeight: 22,
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#8A92A6',
    marginTop: 2,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    paddingTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D4E0',
  },
  dotActive: {
    backgroundColor: '#0D2156',
    width: 20,
    borderRadius: 4,
  },

  subtitle: {
    color: '#727C8E',
    marginBottom: 20,
    fontSize: 13.5,
    lineHeight: 19,
  },

  progressWrap: {
    marginBottom: 18,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E4E7EE',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E9E5A',
    borderRadius: 4,
  },
  progressLabel: {
    marginTop: 8,
    fontSize: 12.5,
    color: '#727C8E',
    fontWeight: '600',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0D2156',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F4FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 15,
    color: '#1A2236',
  },
  cardSubtitle: {
    color: '#8A92A6',
    fontSize: 12.5,
    marginTop: 2,
  },
  changeText: {
    color: '#A9AFBC',
    fontSize: 11,
    marginTop: 3,
    fontStyle: 'italic',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontWeight: '700',
    fontSize: 11.5,
  },

  button: {
    backgroundColor: '#0D2156',
    marginTop: 26,
    paddingVertical: 17,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D2156',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },

  // ---- Upload confirmation modal ----
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 33, 86, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A2236',
    marginBottom: 12,
    textAlign: 'center',
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#F1F4FA',
  },
  pdfPreviewBox: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#F1F4FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfPreviewText: {
    fontSize: 14,
    color: '#1A2236',
    fontWeight: '600',
  },
  modalFileName: {
    marginTop: 10,
    fontSize: 12.5,
    color: '#8A92A6',
    textAlign: 'center',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#D0D4E0',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#727C8E',
    fontWeight: '700',
    fontSize: 13.5,
  },
  modalUploadBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 24,
    backgroundColor: '#0D2156',
    alignItems: 'center',
  },
  modalUploadText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13.5,
  },
});