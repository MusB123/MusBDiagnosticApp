// src/screens/TripInProgressScreen.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Linking,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { PHLEB_ENDPOINTS } from '../config/api';

const PRIMARY = '#18377D';
const GREEN = '#1B7A4D';
const PHLEB_TOKEN_KEY = 'musb_phleb_token';

const TOP_PADDING =
  Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

// Live GPS refresh + ETA recompute cadence while en route.
const LOCATION_REFRESH_MS = 20000;

function formatClock(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function parseApptDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const base = new Date(dateStr);
  if (isNaN(base.getTime())) return null;
  if (timeStr) {
    const match = String(timeStr).match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
    if (match) {
      let hour = parseInt(match[1], 10);
      const minute = match[2] ? parseInt(match[2], 10) : 0;
      const ampm = (match[3] || '').toUpperCase();
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      base.setHours(hour, minute, 0, 0);
    }
  }
  return base;
}

export default function TripInProgressScreen({ route, navigation }) {
  const { job, etaTime: initialEtaTime, etaMinutes: initialEtaMinutes } = route.params || {};

  const patientName = job?.patientName || job?.patient_name || 'Patient';

  // Phone: cover every field shape the backend / previous screens might send.
  const patientPhone =
    job?.patientPhone ||
    job?.patient_phone ||
    job?.phone ||
    job?.patient?.phone ||
    '';

  const address =
    job?.address ||
    job?.patient_address ||
    job?.patientAddress ||
    job?.location ||
    'Patient location';

  const distanceLabel = job?.distance_miles != null ? `${job.distance_miles} mi` : (job?.distanceMiles || '—');

  // Coordinates: cover camelCase, snake_case, and nested shapes.
  const patientLat =
    job?.patient_lat ?? job?.patientLat ?? job?.lat ?? job?.patient?.lat ?? null;
  const patientLng =
    job?.patient_lng ?? job?.patientLng ?? job?.lng ?? job?.patient?.lng ?? null;

  const [myCoords, setMyCoords] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [etaTime, setEtaTime] = useState(initialEtaTime || null);
  const [etaMinutes, setEtaMinutes] = useState(initialEtaMinutes || null);
  const [markingArrived, setMarkingArrived] = useState(false);
  const [delayModalVisible, setDelayModalVisible] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [submittingDelay, setSubmittingDelay] = useState(false);
  const [mapError, setMapError] = useState(null);

  const locInterval = useRef(null);
  const mapRef = useRef(null);

  // One-time debug log so field-name mismatches (phone/address/coords) are
  // visible immediately in Metro logs instead of failing silently.
  useEffect(() => {
    console.log('TripInProgressScreen job object:', JSON.stringify(job, null, 2));
  }, []);

  const apptDateTime = parseApptDateTime(job?.preferredDate || job?.preferred_date, job?.preferredTime || job?.preferred_time);
  const isOnTime = apptDateTime && etaMinutes != null
    ? new Date(Date.now() + etaMinutes * 60000) <= new Date(apptDateTime.getTime() + 10 * 60000)
    : true;

  // Sends the phone's live GPS to the backend (same endpoint MapScreen uses
  // while online) so the phlebotomist's stored current_location stays fresh.
  // Without this, ETA math would keep using wherever they were when the trip
  // started instead of where they actually are now.
  const pushMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('pushMyLocation: location permission not granted');
        return null;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setMyCoords({ latitude, longitude });

      const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
      const res = await fetch(PHLEB_ENDPOINTS.dispatch.location, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lat: latitude, lng: longitude }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        console.warn('pushMyLocation: server rejected update', res.status, errBody);
      }
      return { latitude, longitude };
    } catch (err) {
      // non-fatal — this cycle's location push just won't land
      console.warn('pushMyLocation failed:', err);
      return null;
    }
  };

  const fetchRouteAndEta = async () => {
    try {
      const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
      const res = await fetch(PHLEB_ENDPOINTS.dispatch.route(job.id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        console.warn('fetchRouteAndEta: non-OK response', res.status, data);
        setMapError(data?.error || 'Could not load route.');
        return;
      }

      if (data?.geometry?.coordinates) {
        const coords = data.geometry.coordinates.map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng,
        }));
        setRouteCoords(coords);
        setMapError(null);
        if (data.duration_minutes != null) {
          setEtaMinutes(data.duration_minutes);
          const eta = new Date(Date.now() + data.duration_minutes * 60000);
          setEtaTime(formatClock(eta));
        }
        if (data.from) setMyCoords({ latitude: data.from.lat, longitude: data.from.lng });
      } else {
        console.warn('fetchRouteAndEta: unexpected response shape', data);
      }
    } catch (err) {
      // non-fatal — map/ETA just won't refresh this cycle
      console.warn('fetchRouteAndEta failed:', err);
    }
  };

  // One tick = push fresh GPS, THEN recompute route/ETA from that updated
  // location — keeps the backend's stored position and the on-screen ETA
  // in sync the whole time this screen is open.
  const refreshTick = async () => {
    await pushMyLocation();
    await fetchRouteAndEta();
  };

  useEffect(() => {
    refreshTick(); // run once immediately on mount
    locInterval.current = setInterval(refreshTick, LOCATION_REFRESH_MS);
    return () => clearInterval(locInterval.current);
  }, []);

  // Re-center/fit the map whenever we have both my live position and the
  // patient's location — initialRegion only applies once at mount, so
  // without this the map would stay locked on its first-render fallback.
  useEffect(() => {
    if (mapRef.current && myCoords && patientLat != null && patientLng != null) {
      mapRef.current.fitToCoordinates(
        [myCoords, { latitude: patientLat, longitude: patientLng }],
        { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
      );
    } else if (mapRef.current && myCoords && (patientLat == null || patientLng == null)) {
      // No patient coords available — at least center on my own location.
      mapRef.current.animateToRegion(
        { ...myCoords, latitudeDelta: 0.08, longitudeDelta: 0.08 },
        400
      );
    }
  }, [myCoords, patientLat, patientLng]);

  const handleStartNavigation = () => {
    const query = encodeURIComponent(address);
    const url = Platform.OS === 'ios' ? `maps://?daddr=${query}` : `google.navigation:q=${query}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${query}`);
    });
  };

  const handleContactPatient = () => {
    if (!patientPhone) {
      Alert.alert('No phone number', 'This patient has no phone number on file.');
      return;
    }
    Linking.openURL(`tel:${patientPhone}`);
  };

  const handleSubmitDelay = async () => {
    if (!delayReason.trim()) {
      Alert.alert('Reason required', 'Please enter a brief reason for the delay.');
      return;
    }
    setSubmittingDelay(true);
    try {
      const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
      const res = await fetch(PHLEB_ENDPOINTS.testReportDelay(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: delayReason.trim(),
          delay_minutes: etaMinutes ? Math.round(etaMinutes) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Could not notify patient', data?.error || 'Please try again.');
      } else {
        Alert.alert('Patient notified', 'They\u2019ve been sent an update about the delay.');
        setDelayModalVisible(false);
        setDelayReason('');
      }
    } catch (err) {
      console.warn('handleSubmitDelay failed:', err);
      Alert.alert('Error', 'Could not send the delay notice. Check your connection.');
    } finally {
      setSubmittingDelay(false);
    }
  };

  const handleArrived = async () => {
    if (markingArrived) return;
    setMarkingArrived(true);
    try {
      const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
      const res = await fetch(PHLEB_ENDPOINTS.testStatus(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'arrived' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.warn('handleArrived: server rejected status update', res.status, data);
      }
    } catch (err) {
      console.warn('Could not mark arrived:', err);
    } finally {
      setMarkingArrived(false);
      navigation.navigate('VerifyArrival', { job });
    }
  };

  const initialRegion = myCoords
    ? { ...myCoords, latitudeDelta: 0.08, longitudeDelta: 0.08 }
    : patientLat != null && patientLng != null
      ? { latitude: patientLat, longitude: patientLng, latitudeDelta: 0.08, longitudeDelta: 0.08 }
      : { latitude: 28.21778, longitude: -82.70957, latitudeDelta: 0.5, longitudeDelta: 0.5 };

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>On the way to {patientName}</Text>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          showsCompass={false}
        >
          {routeCoords.length > 1 && (
            <Polyline coordinates={routeCoords} strokeColor={GREEN} strokeWidth={4} />
          )}
          {myCoords && (
            <Marker coordinate={myCoords} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.myMarker}>
                <Ionicons name="car" size={16} color="#FFFFFF" />
              </View>
            </Marker>
          )}
          {patientLat != null && patientLng != null && (
            <Marker coordinate={{ latitude: patientLat, longitude: patientLng }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.patientMarker}>
                <Ionicons name="home" size={14} color="#FFFFFF" />
              </View>
            </Marker>
          )}
        </MapView>

        {etaTime && (
          <View style={styles.etaBadge}>
            <Text style={styles.etaBadgeText}>ETA {etaTime}</Text>
          </View>
        )}

        <View style={styles.tripPill}>
          <Ionicons name="navigate-circle-outline" size={16} color={PRIMARY} />
          <Text style={styles.tripPillText}>
            You &rarr; {patientName} &middot; {distanceLabel}
          </Text>
        </View>

        {mapError && (
          <View style={styles.mapErrorPill}>
            <Ionicons name="alert-circle-outline" size={14} color="#B91C1C" />
            <Text style={styles.mapErrorText}>{mapError}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Estimated arrival</Text>
              <Text style={styles.summaryValue}>
                {etaTime ? `${etaTime} \u00b7 ${Math.round(etaMinutes || 0)} min` : 'Calculating\u2026'}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Appointment time</Text>
              <Text style={styles.summaryValue}>{job?.preferredTime || job?.preferred_time || 'ASAP'}</Text>
            </View>
            <View style={[styles.onTimePill, !isOnTime && styles.onTimePillLate]}>
              <View style={[styles.onTimeDot, { backgroundColor: isOnTime ? GREEN : '#DC2626' }]} />
              <Text style={[styles.onTimeText, !isOnTime && styles.onTimeTextLate]}>
                {isOnTime ? 'On time' : 'Running late'}
              </Text>
            </View>
          </View>

          <View style={styles.notifiedCard}>
            <View style={styles.notifiedHeaderRow}>
              <Ionicons name="megaphone-outline" size={15} color="#FBBF24" />
              <Text style={styles.notifiedLabel}>PATIENT NOTIFIED</Text>
            </View>
            <Text style={styles.notifiedText}>
              {patientName} received your ETA: &ldquo;Your MusB phlebotomist is on the way
              {etaTime ? ` \u2014 arriving ~${etaTime}` : ''}.&rdquo;
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={handleStartNavigation}>
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Start Navigation</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85} onPress={handleContactPatient}>
            <Ionicons name="call-outline" size={17} color={PRIMARY} />
            <Text style={styles.secondaryBtnText}>Contact Patient</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.85}
            onPress={() => setDelayModalVisible(true)}
          >
            <Ionicons name="time-outline" size={17} color="#92400E" />
            <Text style={[styles.secondaryBtnText, { color: '#92400E' }]}>Report Delay</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={styles.arrivedBtn}
          activeOpacity={0.9}
          onPress={handleArrived}
          disabled={markingArrived}
        >
          {markingArrived ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.arrivedBtnText}>I Have Arrived</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={delayModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDelayModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Report a delay</Text>
            <Text style={styles.modalSub}>
              Let {patientName} know why you're running behind schedule.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Heavy traffic on the highway"
              placeholderTextColor="#9CA3AF"
              value={delayReason}
              onChangeText={setDelayReason}
              multiline
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setDelayModalVisible(false); setDelayReason(''); }}
                disabled={submittingDelay}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSendBtn}
                onPress={handleSubmitDelay}
                disabled={submittingDelay}
              >
                {submittingDelay ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSendText}>Notify Patient</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F6F8FC' },
  header: {
    backgroundColor: GREEN,
    paddingTop: TOP_PADDING,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', flex: 1 },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  mapWrap: { height: 230, backgroundColor: '#E5E7EB' },
  myMarker: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF', elevation: 3,
  },
  patientMarker: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: GREEN,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF', elevation: 3,
  },
  etaBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  etaBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 },
  tripPill: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8, elevation: 3,
  },
  tripPillText: { fontSize: 12.5, fontWeight: '700', color: '#111827' },
  mapErrorPill: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF2F2', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#FECACA', maxWidth: '60%',
  },
  mapErrorText: { color: '#B91C1C', fontSize: 11, fontWeight: '600', flexShrink: 1 },

  body: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  scrollContent: { paddingBottom: 12 },

  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2, marginBottom: 14,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13.5, color: '#6B7280' },
  summaryValue: { fontSize: 13.5, fontWeight: '700', color: '#111827' },
  summaryDivider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 10 },
  onTimePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: 2,
  },
  onTimePillLate: {},
  onTimeDot: { width: 8, height: 8, borderRadius: 4 },
  onTimeText: { fontSize: 12.5, fontWeight: '700', color: GREEN },
  onTimeTextLate: { color: '#DC2626' },

  notifiedCard: {
    backgroundColor: '#0F2A4A', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16,
  },
  notifiedHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  notifiedLabel: { color: '#FBBF24', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  notifiedText: { color: '#E5EAF5', fontSize: 12.5, lineHeight: 18 },

  primaryBtn: {
    flexDirection: 'row', gap: 8, backgroundColor: GREEN,
    paddingVertical: 15, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  secondaryBtn: {
    flexDirection: 'row', gap: 8, backgroundColor: '#FFFFFF',
    paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  secondaryBtnText: { color: PRIMARY, fontWeight: '700', fontSize: 14.5 },

  arrivedBtn: {
    flexDirection: 'row', gap: 8, backgroundColor: GREEN,
    paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 10, marginBottom: Platform.OS === 'ios' ? 24 : 18,
  },
  arrivedBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15.5 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#6B7280', marginBottom: 14 },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    padding: 12, minHeight: 80, textAlignVertical: 'top',
    fontSize: 14, color: '#111827', marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB',
  },
  modalCancelText: { color: '#374151', fontWeight: '700' },
  modalSendBtn: {
    flex: 1.4, paddingVertical: 13, borderRadius: 12,
    alignItems: 'center', backgroundColor: PRIMARY,
  },
  modalSendText: { color: '#FFFFFF', fontWeight: '700' },
});
