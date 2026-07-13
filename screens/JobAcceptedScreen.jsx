// src/screens/JobAcceptedScreen.jsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { PHLEB_ENDPOINTS } from '../config/api';

const PRIMARY = '#18377D';
const GREEN = '#1B7A4D';

export default function JobAcceptedScreen({ route, navigation }) {
  const { job } = route.params || {};
   console.log('JOB OBJECT:', JSON.stringify(job, null, 2));

  const [opening, setOpening] = useState(false);

  const patientName = job?.patientName || job?.patient_name || 'Patient';
  const patientPhone = job?.patientPhone || job?.patient_phone || '';
  const address = job?.address || job?.patient_address || job?.location || 'Address not provided';
  const testName = job?.testName || job?.test_name || job?.tests
    || (Array.isArray(job?.lab_tests) ? job.lab_tests.join(', ') : null)
    || 'Clinical Test';
  const testPrice = job?.testPrice || job?.test_price;
  const earning = job?.earning ?? job?.earned ?? job?.amount_earned;
  const preferredDate = job?.preferredDate || job?.preferred_date || '';
  const preferredTime = job?.time || job?.preferred_time || 'ASAP';
  const visitType = job?.visitType || job?.visit_type || 'home';
  const paymentMethod = job?.paymentMethod || job?.payment_method || 'N/A';
  const isStat = !!(job?.isStat || job?.is_stat);

  // Documents arrive as { url } (signed S3 link) from the backend; legacy
  // records may still carry { base64 }. Support both, plus flat *_url/*_base64.
  const doctorOrder = job?.documents?.doctorOrder
    || (job?.doctor_order_url
        ? { url: job.doctor_order_url, name: job.doctor_order_name || 'Doctor Order' }
        : job?.doctor_order_base64
          ? { base64: job.doctor_order_base64, name: job.doctor_order_name || 'Doctor Order' }
          : null);

  const insuranceFront = job?.documents?.insuranceFront
    || (job?.insurance_front_url
        ? { url: job.insurance_front_url, name: job.insurance_front_name || 'Insurance Front' }
        : job?.insurance_front_base64
          ? { base64: job.insurance_front_base64, name: job.insurance_front_name || 'Insurance Front' }
          : null);

  const insuranceBack = job?.documents?.insuranceBack
    || (job?.insurance_back_url
        ? { url: job.insurance_back_url, name: job.insurance_back_name || 'Insurance Back' }
        : job?.insurance_back_base64
          ? { base64: job.insurance_back_base64, name: job.insurance_back_name || 'Insurance Back' }
          : null);

  const initials = patientName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('') || 'PT';

  const handleCall = () => {
    if (!patientPhone) {
      Alert.alert('No phone number', 'This patient has no phone number on file.');
      return;
    }
    Linking.openURL(`tel:${patientPhone}`);
  };

  const handleMessage = () => {
    if (!patientPhone) {
      Alert.alert('No phone number', 'This patient has no phone number on file.');
      return;
    }
    Linking.openURL(`sms:${patientPhone}`);
  };

  const handleNavigate = () => {
    const query = encodeURIComponent(address);
    const url =
      Platform.OS === 'ios' ? `maps://?q=${query}` : `geo:0,0?q=${query}`;
    Linking.openURL(url);
  };

  const [markingArrived, setMarkingArrived] = useState(false);

  const handleStartCollection = async () => {
    if (markingArrived) return;
    setMarkingArrived(true);
    try {
      const token = await SecureStore.getItemAsync('musb_phleb_token');
      await fetch(PHLEB_ENDPOINTS.testStatus(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'arrived' }),
      });
    } catch (err) {
      // Non-fatal — proceed anyway so the phlebotomist isn't blocked
      console.warn('Could not mark arrived:', err);
    } finally {
      setMarkingArrived(false);
      navigation.navigate('VerifyArrival', { job });
    }
  };

  // Prefer a signed S3 URL (open directly). Fall back to legacy base64, which
  // must be written to disk first — Linking.openURL can't render raw base64.
  const openDoc = async (doc, label) => {
    if (!doc?.url && !doc?.base64) {
      Alert.alert(
        `${label} not available`,
        'The patient has not uploaded this document yet.'
      );
      return;
    }
    if (doc.url) {
      try {
        await Linking.openURL(doc.url);
      } catch {
        Alert.alert('Error', 'Could not open this document.');
      }
      return;
    }
    setOpening(true);
    try {
      const isPdf = (doc.name || '').toLowerCase().endsWith('.pdf');
      const ext = isPdf ? 'pdf' : 'jpg';
      const fileUri = `${FileSystem.cacheDirectory}${label.replace(/\s/g, '_')}.${ext}`;

      // Strip a data URI prefix if present (e.g. "data:image/jpeg;base64,")
      const raw = doc.base64.includes(',') ? doc.base64.split(',')[1] : doc.base64;

      await FileSystem.writeAsStringAsync(fileUri, raw, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Saved', `File saved to ${fileUri}`);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open this document.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('PhlebDashboard')}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Request accepted</Text>
        {isStat && (
          <View style={styles.statPill}>
            <Text style={styles.statText}>STAT</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient Information */}
        <Text style={styles.sectionLabel}>PATIENT INFORMATION</Text>
        <View style={styles.card}>
          <View style={styles.patientRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.patientMeta}>
              <Text style={styles.patientName}>{patientName}</Text>
              <Text style={styles.patientSub}>{visitType} visit</Text>
            </View>
            <View style={styles.contactButtons}>
              <TouchableOpacity style={styles.iconButton} onPress={handleCall} activeOpacity={0.8}>
                <Ionicons name="call-outline" size={18} color={PRIMARY} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={handleMessage} activeOpacity={0.8}>
                <Ionicons name="chatbubble-outline" size={18} color={PRIMARY} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <InfoRow label="Phone" value={patientPhone || '—'} />
          <InfoRow label="Date" value={preferredDate || job?.date || 'Today'} />
          <InfoRow label="Address" value={address} />
          <InfoRow label="Payment method" value={paymentMethod} last />
        </View>

        {/* Order */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>ORDER</Text>
        <View style={styles.card}>
          <InfoRow label="Test" value={testName} />
          <InfoRow
            label="Your earning"
            value={earning != null ? `$${Number(earning).toFixed(2)}` : 'N/A'}
            last
          />
        </View>

        {/* Documents */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>DOCUMENTS</Text>
        <View style={styles.card}>
          <DocRow
            icon="document-text-outline"
            label="Doctor's order"
            available={!!doctorOrder}
            onPress={() => openDoc(doctorOrder, 'Doctor Order')}
            disabled={opening}
          />
          <DocRow
            icon="card-outline"
            label="Insurance (front)"
            available={!!insuranceFront}
            onPress={() => openDoc(insuranceFront, 'Insurance Front')}
            disabled={opening}
          />
          <DocRow
            icon="card-outline"
            label="Insurance (back)"
            available={!!insuranceBack}
            onPress={() => openDoc(insuranceBack, 'Insurance Back')}
            disabled={opening}
            last
          />
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.navigateButton}
            activeOpacity={0.9}
            onPress={handleNavigate}
          >
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
            <Text style={styles.navigateText}>Navigate now</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.startCollectionButton}
          activeOpacity={0.9}
          onPress={handleStartCollection}
          disabled={markingArrived}
        >
          <Ionicons name="clipboard-outline" size={18} color="#FFFFFF" />
          <Text style={styles.startCollectionText}>
             {markingArrived ? 'Notifying patient...' : "I've Arrived — Start Collection"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <View style={[styles.infoRow, last && { marginBottom: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function DocRow({ icon, label, available, onPress, disabled, last }) {
  return (
    <TouchableOpacity
      style={[styles.docRow, last && { marginBottom: 0 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.docIconWrap}>
        <Ionicons name={icon} size={18} color={PRIMARY} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.docLabel}>{label}</Text>
        <Text style={styles.docStatus}>
          {available ? 'Tap to view' : 'Not uploaded'}
        </Text>
      </View>
      {available && <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />}
    </TouchableOpacity>
  );
}

const TOP_PADDING =
  Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F6F8FC' },
  header: {
    backgroundColor: GREEN,
    paddingTop: TOP_PADDING,
    paddingBottom: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', flex: 1 },
  statPill: {
    backgroundColor: '#F87171',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 36 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.6,
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
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FDE68A', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#92400E' },
  patientMeta: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  patientSub: { fontSize: 13, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' },
  contactButtons: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1.5,
    borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 10, gap: 8,
  },
  infoLabel: { fontSize: 13.5, color: '#6B7280', flexShrink: 0 },
  infoValue: { fontSize: 13.5, fontWeight: '700', color: '#111827', textAlign: 'right', flexShrink: 1 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  docIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
  },
  docLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  docStatus: { fontSize: 12.5, color: '#6B7280', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  navigateButton: {
    flex: 1, flexDirection: 'row', gap: 8, backgroundColor: GREEN,
    paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  navigateText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  startCollectionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, paddingVertical: 16, borderRadius: 14, marginTop: 14,
    shadowColor: PRIMARY, shadowOpacity: 0.25, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  startCollectionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
