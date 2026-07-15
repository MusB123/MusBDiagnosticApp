import React, { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons'; // swap for your icon lib if different
import { applyPhleb, uploadDocument } from '../utils/auth'; // adjust path if your folder structure differs

const W9_FORM_URL = 'https://www.irs.gov/pub/irs-pdf/fw9.pdf';

export default function RegisterStep3({ navigation, route }) {
  // Everything collected across Step 1 (personal info) and Step 2 (licence /
  // certificate / insurance docs) arrives here in route.params. This screen
  // adds password + bank + W9, then submits the whole application once.
  const {
    firstName,
    middleName,
    lastName,
    email,
    phone,
    address,
    dob,
    zipCodes,
    dlFront,
    dlBack,
    certificate,
    insuranceDoc,
    password,
  } = route.params || {};

  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

  const [bankName, setBankName] = useState('');
  const [holderName, setHolderName] = useState(fullName || '');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Bank statement upload — { name, uri, key, busy } | null
  const [bankStatement, setBankStatement] = useState(null);
  const [pendingBankUpload, setPendingBankUpload] = useState(null); // staged file awaiting confirm

  const [w9File, setW9File] = useState(null); // { name, uri, key, busy } | null
  const [downloadingW9, setDownloadingW9] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const shortName = (uri = '') => {
    const clean = uri.split('?')[0];
    const parts = clean.split('/');
    return parts[parts.length - 1] || 'document';
  };

  // ---------- W9: actually download the file to the device ----------
  const handleDownloadW9 = async () => {
    if (downloadingW9) return;
    setDownloadingW9(true);
    try {
      const localUri = FileSystem.cacheDirectory + 'MusB_W9_Form.pdf';
      const { uri } = await FileSystem.downloadAsync(W9_FORM_URL, localUri);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        // Opens the native "Save to Files / Share" sheet so the user can
        // actually save the PDF to their device (Files app, Drive, etc.)
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save W9 form',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(
          'Downloaded',
          `The W9 form was saved to: ${uri}`
        );
      }
    } catch (err) {
      console.log(err);
      Alert.alert('Download failed', 'Could not download the W9 form. Please try again.');
    } finally {
      setDownloadingW9(false);
    }
  };

  // ---------- W9: upload the filled form back ----------
  const handleUploadW9 = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/png', 'image/jpeg'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets ? result.assets[0] : result;
      const name = asset.name || shortName(asset.uri);
      // Upload immediately to S3 and keep the returned storage key.
      setW9File({ name, uri: asset.uri, key: null, busy: true });
      try {
        const { key } = await uploadDocument({
          uri: asset.uri,
          filename: name,
          kind: 'phleb-docs',
        });
        setW9File({ name, uri: asset.uri, key, busy: false });
      } catch (uploadErr) {
        setW9File(null);
        Alert.alert('Upload failed', uploadErr.message === 'NETWORK_ERROR'
          ? 'Network error while uploading the W9. Please try again.'
          : (uploadErr.message || 'Could not upload the W9 form.'));
      }
    } catch (err) {
      Alert.alert('Something went wrong', 'Could not open the file picker. Please try again.');
    }
  };

  // ---------- Bank statement: pick + stage (pdf / gallery / camera) ----------
  const compressImage = async (uri) => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: false }
    );
    return result; // { uri, width, height }
  };

  const pickBankPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setPendingBankUpload({ fileName: asset.name, uri: asset.uri, isPdf: true });
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'Could not open PDF.');
    }
  };

  const pickBankImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const compressed = await compressImage(asset.uri);
      setPendingBankUpload({
        fileName: asset.fileName || shortName(asset.uri),
        uri: compressed.uri,
        isPdf: false,
      });
    } catch (err) {
      console.log(err);
      Alert.alert('Could not open photo library', 'Please try picking the photo again.');
    }
  };

  const captureBankPhoto = async () => {
    try {
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
        const compressed = await compressImage(asset.uri);
        setPendingBankUpload({
          fileName: asset.fileName || shortName(asset.uri),
          uri: compressed.uri,
          isPdf: false,
        });
      }
    } catch (err) {
      console.log(err);
      Alert.alert('Camera error', 'Could not open the camera or process the photo. Please try again.');
    }
  };

  const handleBankStatementPress = () => {
    Alert.alert(
      'Upload bank statement',
      'Choose how you would like to add this document',
      [
        { text: 'Choose PDF', onPress: pickBankPdf },
        { text: 'Choose Image', onPress: pickBankImage },
        { text: 'Take Photo', onPress: captureBankPhoto },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // Actually upload the staged bank statement file to S3
  const confirmBankUpload = async () => {
    if (!pendingBankUpload) return;
    const { fileName, uri } = pendingBankUpload;
    setBankStatement({ name: fileName, uri, key: null, busy: true });
    setPendingBankUpload(null);
    try {
      const { key } = await uploadDocument({
        uri,
        filename: fileName,
        kind: 'phleb-docs',
      });
      setBankStatement({ name: fileName, uri, key, busy: false });
    } catch (err) {
      setBankStatement(null);
      Alert.alert('Upload failed', err.message === 'NETWORK_ERROR'
        ? 'Network error while uploading. Please try again.'
        : (err.message || 'Could not upload the bank statement.'));
    }
  };

  // Auto-confirm as soon as a file is staged (no separate preview modal
  // needed here — mirrors the simpler flow the W9 upload already uses).
  React.useEffect(() => {
    if (pendingBankUpload) {
      confirmBankUpload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBankUpload]);

  const handleFinish = async () => {
    if (!bankName.trim() || !holderName.trim() || !routingNumber.trim() || !accountNumber.trim()) {
      Alert.alert('Missing details', 'Please fill in all bank details to continue.');
      return;
    }
    if (bankStatement?.busy) {
      Alert.alert('Please wait', 'Your bank statement is still uploading.');
      return;
    }
    if (!bankStatement?.key) {
      Alert.alert('Bank statement required', 'Please upload a bank statement to continue.');
      return;
    }
    if (w9File?.busy) {
      Alert.alert('Please wait', 'Your W9 form is still uploading.');
      return;
    }
    if (!w9File?.key) {
      Alert.alert('W9 form required', 'Please upload your completed W9 form to continue.');
      return;
    }

    setSubmitting(true);
    try {
      // Single submission point for the whole application: personal info
      // (Step 1) + licence/certificate/insurance docs (Step 2, base64) +
      // password + the W9 + bank statement (pre-uploaded to S3, sent as keys).
      const data = await applyPhleb({
        fullName,
        email,
        phone,
        address,
        password,
        zipCodes,
        dlFront,
        dlBack,
        certificate,
        insuranceDoc,
        w9: w9File.key,
        bankStatement: bankStatement.key,
        bankName,
        holderName,
        routingNumber,
        accountNumber,
      });

      navigation.replace('AwaitingApproval', {
        specialistId: data.specialist_id,
        status: data.status,
        fullName,
        email,
        password,
      });
    } catch (err) {
      Alert.alert(
        'Submission failed',
        err.message || 'Could not submit your application. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color="#0D2156" />
          </TouchableOpacity>

          {/* Header — same style as Register step 2 */}
          <View style={styles.header}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View style={styles.headerText}>
              <Text style={styles.stepTitle}>Register — step 3{'\n'}of 3</Text>
              <Text style={styles.stepSubtitle}>Payout & account details</Text>
            </View>
            <View style={styles.progressDots}>
              <View style={styles.dot} />
              <View style={styles.dot} />
              <View style={[styles.dot, styles.dotActive]} />
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Your earnings are paid directly to the account below on your payout schedule.
            </Text>
          </View>

          <Text style={styles.label}>Bank name</Text>
          <TextInput
            style={styles.input}
            placeholder="Citi Bank"
            placeholderTextColor="#A9AFBC"
            value={bankName}
            onChangeText={setBankName}
          />

          <Text style={styles.label}>Account holder name</Text>
          <TextInput
            style={styles.input}
            placeholder="Account holder name"
            placeholderTextColor="#A9AFBC"
            value={holderName}
            onChangeText={setHolderName}
          />

          <Text style={styles.label}>Routing number</Text>
          <TextInput
            style={styles.input}
            placeholder="021000021"
            placeholderTextColor="#A9AFBC"
            value={routingNumber}
            onChangeText={setRoutingNumber}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Account number</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••4892"
            placeholderTextColor="#A9AFBC"
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="numeric"
          />

          {/* Bank statement upload */}
          <Text style={styles.label}>Bank statement</Text>
          <TouchableOpacity
            style={styles.uploadCard}
            activeOpacity={0.7}
            onPress={handleBankStatementPress}
            disabled={bankStatement?.busy}
          >
            <View style={[styles.uploadIconBox, bankStatement?.key && { backgroundColor: '#E6F6EC' }]}>
              {bankStatement?.busy
                ? <ActivityIndicator color="#1E9E5A" />
                : <Text style={styles.uploadIconText}>{bankStatement?.key ? '✓' : '🏦'}</Text>}
            </View>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.uploadTitle}>
                {bankStatement ? bankStatement.name : 'Upload bank statement'}
              </Text>
              <Text style={[styles.uploadSubtitle, bankStatement?.key && { color: '#1E9E5A' }]}>
                {bankStatement?.busy
                  ? 'Uploading…'
                  : bankStatement?.key
                    ? 'Uploaded · tap to replace'
                    : 'PDF, photo, or camera — most recent statement'}
              </Text>
            </View>
            {bankStatement?.key && (
              <View style={styles.uploadBadge}>
                <Text style={styles.uploadBadgeText}>Done</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* W9 tax form */}
          <Text style={styles.label}>W9 tax form</Text>
          <View style={styles.w9Card}>
            <View style={styles.w9Row}>
              <View style={styles.w9IconBox}>
                {w9File?.busy
                  ? <ActivityIndicator color="#1E9E5A" />
                  : <Text style={styles.w9IconText}>{w9File?.key ? '✓' : '📄'}</Text>}
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.w9Title}>
                  {w9File ? w9File.name : 'W9 form required'}
                </Text>
                <Text style={[styles.w9Subtitle, w9File?.key && { color: '#1E9E5A' }]}>
                  {w9File?.busy
                    ? 'Uploading…'
                    : w9File?.key
                      ? 'Uploaded · tap to replace'
                      : 'Download, fill it out, then upload below'}
                </Text>
              </View>
              {w9File?.key && (
                <View style={styles.w9Badge}>
                  <Text style={styles.w9BadgeText}>Done</Text>
                </View>
              )}
            </View>

            <View style={styles.w9ButtonRow}>
              <TouchableOpacity
                style={styles.w9SecondaryButton}
                onPress={handleDownloadW9}
                disabled={downloadingW9}
              >
                {downloadingW9 ? (
                  <ActivityIndicator color="#0D2156" />
                ) : (
                  <Text style={styles.w9SecondaryButtonText}>Download W9 form</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.w9PrimaryButton} onPress={handleUploadW9} disabled={w9File?.busy}>
                <Text style={styles.w9PrimaryButtonText}>
                  {w9File?.key ? 'Replace upload' : 'Upload filled form'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.continueButton, submitting && { opacity: 0.7 }]}
            onPress={handleFinish}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.continueText}>Finish Registration</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8EAF0',
    shadowColor: '#0D2156',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    marginTop: 4,
    gap: 12,
  },
  logoImage: {
    width: 42,
    height: 42,
    borderRadius: 10,
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

  infoBox: {
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 6,
  },
  infoText: {
    color: '#35508A',
    fontWeight: '600',
  },

  label: {
    marginBottom: 6,
    marginTop: 14,
    color: '#444C5E',
    fontWeight: '700',
    fontSize: 13.5,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A2236',
    borderWidth: 1,
    borderColor: '#E4E7EE',
  },

  // Bank statement upload card (mirrors Step 2's document cards)
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#0D2156',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  uploadIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F4FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  uploadIconText: {
    fontSize: 18,
  },
  uploadTitle: {
    fontWeight: '700',
    fontSize: 15,
    color: '#1A2236',
  },
  uploadSubtitle: {
    color: '#8A92A6',
    fontSize: 12.5,
    marginTop: 2,
  },
  uploadBadge: {
    backgroundColor: '#E6F6EC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  uploadBadgeText: {
    fontWeight: '700',
    fontSize: 11.5,
    color: '#1E9E5A',
  },

  // W9 card
  w9Card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#0D2156',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  w9Row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  w9IconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F4FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  w9IconText: {
    fontSize: 18,
  },
  w9Title: {
    fontWeight: '700',
    fontSize: 15,
    color: '#1A2236',
  },
  w9Subtitle: {
    color: '#8A92A6',
    fontSize: 12.5,
    marginTop: 2,
  },
  w9Badge: {
    backgroundColor: '#E6F6EC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  w9BadgeText: {
    fontWeight: '700',
    fontSize: 11.5,
    color: '#1E9E5A',
  },
  w9ButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  w9SecondaryButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#0D2156',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  w9SecondaryButtonText: {
    color: '#0D2156',
    fontWeight: '700',
    fontSize: 13,
  },
  w9PrimaryButton: {
    flex: 1,
    backgroundColor: '#0D2156',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  w9PrimaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  continueButton: {
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
  continueText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});