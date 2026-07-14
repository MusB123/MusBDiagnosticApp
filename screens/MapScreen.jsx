import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, StatusBar, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { PHLEB_ENDPOINTS } from '../config/api';

const PRIMARY = '#18377D';
const GREEN   = '#1B7A4D';
const PHLEB_TOKEN_KEY = 'musb_phleb_token';
const PHLEB_USER_KEY  = 'musb_phleb_user';

const TOP_PADDING =
  Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

// How often we poll dispatch/pending/ for a queued job offer while online.
const PENDING_POLL_MS  = 5000;
// How often we push GPS to dispatch/location/ while online.
const LOCATION_PUSH_MS = 30000;

async function getToken() {
  return SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
}

export default function MapScreen({ route, navigation }) {
  const { fullName = 'User', autoOnline = false } = route.params || {};
  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ');
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();

  const [myCoords, setMyCoords]       = useState(null);
  const [pendingJob, setPendingJob]   = useState(null); // { queue_id, appointment_id, ... }
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [jobsToday, setJobsToday]     = useState(0);
  const [earnedToday, setEarnedToday] = useState('$0.00');
  const [goingOnline, setGoingOnline] = useState(false);
  const [respondingTo, setRespondingTo] = useState(null); // 'accept' | 'reject' | null
  const [officeRequests, setOfficeRequests] = useState([]);
  const MUSB_OFFICE = { latitude: 28.21778, longitude: -82.70957 };
  const OFFICE_RADIUS_METERS = 50 * 1609.34; // ~80,467 m
  const officePollRef = useRef(null);
  const pollInterval    = useRef(null);
  const locInterval     = useRef(null);
  const countdownTimer  = useRef(null);
  const tokenRef        = useRef(null);
  const pendingJobRef    = useRef(null); // mirror of pendingJob for use inside intervals

  useEffect(() => {
    pendingJobRef.current = pendingJob;
  }, [pendingJob]);

  // ── Load token + lightweight metrics on mount ───────────────────
  useEffect(() => {
    (async () => {
      const token = await getToken();
      tokenRef.current = token;
      fetchMetrics();
      checkActiveJob();
      fetchOfficeRequests();
      // Coming from Dashboard's "Tap to go online" — skip the extra tap
      // here and go straight online so the map shows requests immediately.
      if (autoOnline) {
        goOnline();
      }
    })();
    officePollRef.current = setInterval(fetchOfficeRequests, 30000);
    return () => { 
      stopAll();
      clearInterval(officePollRef.current);
    }; 
   }, []);

  const authHeader = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenRef.current}`,
  });

  // Pull jobsToday / earnedToday only — this endpoint also returns a legacy
  // "broadcasts" field from the older system, which we intentionally ignore
  // since all job offers now flow through dispatch/pending/.
  const fetchMetrics = async () => {
    try {
      const res  = await fetch(PHLEB_ENDPOINTS.dashboard, { headers: authHeader() });
      const data = await res.json();
      setJobsToday(data?.metrics?.completed_collections ?? 0);
      setEarnedToday(data?.metrics?.earnings_today ?? '$0.00');
    } catch {}
  };

  const fetchOfficeRequests = async () => {
   try {
    const res = await fetch(PHLEB_ENDPOINTS.dispatch.officeNearbyRequests, { headers: authHeader() });
    const data = await res.json();
    setOfficeRequests(data.requests || []);
   } catch {}
 };

  // If the phlebotomist already has an in-progress assigned job, send them
  // straight to it instead of re-showing the online toggle.
  const checkActiveJob = async () => {
    try {
      const token = tokenRef.current || (await getToken());
      const res  = await fetch(PHLEB_ENDPOINTS.dispatch.activeJob, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.has_active && data.job) {
        navigation.navigate('JobAccepted', {
          job: data.job,
          appointmentId: data.job.appointment_id,
          fullName,
        });
      }
    } catch {}
  };

  // ── Go online ───────────────────────────────────────────────────
  const goOnline = async () => {
    setGoingOnline(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        setGoingOnline(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setMyCoords({ latitude, longitude });

      const res = await fetch(PHLEB_ENDPOINTS.dispatch.duty, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ on_duty: true, lat: latitude, lng: longitude }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Error', err?.error || 'Could not go online.');
        setMyCoords(null);
        setGoingOnline(false);
        return;
      }

      startLocationUpdates();
      startPolling();
    } catch {
      Alert.alert('Error', 'Could not go online. Try again.');
    } finally {
      setGoingOnline(false);
    }
  };

  // ── Go offline ──────────────────────────────────────────────────
  const goOffline = async () => {
    stopAll();
    try {
      await fetch(PHLEB_ENDPOINTS.dispatch.duty, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ on_duty: false }),
      });
    } catch {}
    setMyCoords(null);
    setPendingJob(null);
  };

  // Back button now also takes the phlebotomist offline before leaving —
  // this replaces the separate "Go offline" button that used to sit in the
  // top bar, so there's a single, obvious way back instead of two buttons
  // doing overlapping things.
  const handleBack = async () => {
    if (myCoords) {
      await goOffline();
    }
    navigation.goBack();
  };

  // ── Push GPS every 30s while online ──────────────────────────────
  const startLocationUpdates = () => {
    locInterval.current = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = loc.coords;
        setMyCoords({ latitude, longitude });

        await fetch(PHLEB_ENDPOINTS.dispatch.location, {
          method: 'POST',
          headers: authHeader(),
          body: JSON.stringify({ lat: latitude, lng: longitude }),
        });
      } catch {}
    }, LOCATION_PUSH_MS);
  };

  // ── Poll dispatch/pending/ for a queued job offer ────────────────
  const startPolling = () => {
    pollInterval.current = setInterval(async () => {
      // Don't poll while a job is already being shown / responded to.
      if (pendingJobRef.current) return;
      try {
        const res  = await fetch(PHLEB_ENDPOINTS.dispatch.pending, { headers: authHeader() });
        const data = await res.json();

        if (data?.has_pending && data.job) {
          setPendingJob(data.job);
          startCountdown(data.job.timeout_seconds, data.job.elapsed_seconds);
        }
      } catch {}
    }, PENDING_POLL_MS);
  };

  // ── Local countdown so the UI shows urgency, mirrors server timeout ──
  const startCountdown = (timeoutSeconds = 60, elapsedSeconds = 0) => {
    clearInterval(countdownTimer.current);
    let remaining = Math.max(0, timeoutSeconds - elapsedSeconds);
    setSecondsLeft(remaining);
    countdownTimer.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(countdownTimer.current);
        // Offer expired locally — server will have advanced the queue too.
        setPendingJob(null);
        setSecondsLeft(null);
      }
    }, 1000);
  };

  const stopAll = () => {
    clearInterval(pollInterval.current);
    clearInterval(locInterval.current);
    clearInterval(countdownTimer.current);
  };

  // ── Accept job ──────────────────────────────────────────────────
  const acceptJob = async () => {
    if (!pendingJob?.queue_id || respondingTo) return;
    setRespondingTo('accept');
    try {
      const res = await fetch(PHLEB_ENDPOINTS.dispatch.respond, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ queue_id: pendingJob.queue_id, action: 'accept' }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Job no longer available', data?.error || 'Could not accept job.');
        setPendingJob(null);
        clearInterval(countdownTimer.current);
        setRespondingTo(null);
        return;
      }
      stopAll();
      navigation.navigate('JobAccepted', {
        job: pendingJob,
        appointmentId: pendingJob.appointment_id,
        fullName,
      });
    } catch {
      Alert.alert('Error', 'Could not accept. Try again.');
    } finally {
      setRespondingTo(null);
    }
  };

  // ── Decline job ─────────────────────────────────────────────────
  const declineJob = async () => {
    if (!pendingJob?.queue_id || respondingTo) return;
    setRespondingTo('reject');
    try {
      await fetch(PHLEB_ENDPOINTS.dispatch.respond, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ queue_id: pendingJob.queue_id, action: 'reject' }),
      });
    } catch {
      // even on network error, clear locally — server will eventually time it out
    } finally {
      clearInterval(countdownTimer.current);
      setSecondsLeft(null);
      setPendingJob(null);
      setRespondingTo(null);
      // polling interval is still running and will pick up the next offer
    }
  };

  // Navigates to the dedicated request-detail screen, where the
  // phlebotomist makes the actual Accept / Decline decision. The map's
  // request card itself is just a summary + entry point now, not the
  // place where accept/decline happens — avoids the "is this tappable or
  // just informational" confusion the card-only design had before.
  const handleViewRequest = (req) => {
    navigation.navigate('NewRequest', {
      request: {
        id: req.id,
        location: req.address,
        distanceMiles: `${req.distance_miles} mi`,
        distanceFromYou: `${req.distance_miles} miles`,
        estimatedDrive: '—',
        neighbourhood: req.address,
        collectionType: req.test_name || 'Clinical Test',
        preferredTime: req.preferred_time,
        preferredDate: req.preferred_date,
      },
      fullName,
    });
  };

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          ...MUSB_OFFICE,
          latitudeDelta: 1.6,
          longitudeDelta: 1.6,
        }}
        
        showsUserLocation={false}
        showsCompass={false}
      >
        {myCoords && (
          <>
            <Circle
              center={myCoords}
              radius={1200}
              strokeColor="rgba(27,122,77,0.15)"
              fillColor="rgba(27,122,77,0.07)"
              strokeWidth={1}
            />
            <Marker coordinate={myCoords} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.myMarkerWrapper}>
                <View style={styles.myMarkerRing} />
                <View style={styles.myMarker}>
                  <Text style={styles.myMarkerText}>{initials || 'M'}</Text>
                </View>
              </View>
            </Marker>
          </>
        )}
        {/* Office marker + 50-mile coverage circle */}
       <Circle
         center={MUSB_OFFICE}
         radius={OFFICE_RADIUS_METERS}
         strokeColor="rgba(217,119,6,0.4)"
         fillColor="rgba(217,119,6,0.06)"
         strokeWidth={1.5}
       />
       <Marker coordinate={MUSB_OFFICE} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={styles.officeCenterMarker}>
         <Text style={styles.officeCenterMarkerText}>🏢</Text>
        </View>
       </Marker>

        {/* Only the currently-offered job has known coordinates
            (dispatch/pending/ includes patient_lat/patient_lng;
            dispatch/nearby-requests/ does not). */}
        {officeRequests.map((req) => (
         <Marker
          key={req.id}
          coordinate={{
            latitude: req.lat,
            longitude: req.lng,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          title={req.patient_name}
          description={`${req.distance_miles} mi from office · ${req.preferred_time || 'ASAP'}`}
         >
          <View style={styles.officeMarker}>
           <Text style={styles.officeMarkerText}>
            {req.distance_miles}
           </Text>
          </View>
         </Marker>
        ))}
      </MapView>

      {/* ── Top bar ── */}
      <View style={[styles.topBar, { paddingTop: TOP_PADDING }]}>
        <View style={styles.topBarInner}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.topLeft}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{initials || 'MW'}</Text>
            </View>
            <View>
              <Text style={styles.headerName}>{fullName}</Text>
              <View style={styles.onlineRow}>
                <View style={[styles.onlineDot, { backgroundColor: myCoords ? '#86EFAC' : '#EF4444' }]} />
                <Text style={styles.onlineLabel}>
                  {myCoords ? 'Online · visible to patients' : 'Offline'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ── Bottom sheet ── */}
      <View style={styles.bottomSheet}>

        {/* Go online button — only shown if autoOnline didn't already
            kick in (e.g. someone lands here directly, or the auto
            attempt failed and they need to retry manually). */}
        {!myCoords && (
          <TouchableOpacity style={styles.goOnlineBtn} onPress={goOnline} disabled={goingOnline}>
            {goingOnline
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.goOnlineBtnText}>Go Online</Text>
            }
          </TouchableOpacity>
        )}

        {/* Pending job card */}
        {myCoords && pendingJob && (
          <View style={styles.jobCard}>
            <Text style={styles.jobCardTitle}>
              🔔 New Job Request!{secondsLeft != null ? `  (${secondsLeft}s)` : ''}
            </Text>
            <Text style={styles.jobCardSub}>{pendingJob.patient_address}</Text>
            <Text style={styles.jobCardMeta}>
              {(pendingJob.lab_tests || []).join(', ') || 'Clinical Draw'}
              {pendingJob.distance_miles != null ? `  ·  ${pendingJob.distance_miles} mi` : ''}
            </Text>
            <Text style={styles.jobCardTime}>
              🕐 {pendingJob.preferred_time || 'ASAP'} {pendingJob.preferred_date || ''}
            </Text>
            <View style={styles.jobCardActions}>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={declineJob}
                disabled={!!respondingTo}
              >
                {respondingTo === 'reject'
                  ? <ActivityIndicator color="#374151" size="small" />
                  : <Text style={styles.rejectBtnText}>Decline</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={acceptJob}
                disabled={!!respondingTo}
              >
                {respondingTo === 'accept'
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.acceptBtnText}>Accept</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Waiting card / nearby office requests list */}
        {myCoords && !pendingJob && (
         <>
           {officeRequests.length === 0 ? (
            <View style={styles.requestCard}>
             <View style={styles.requestCardLeft}>
              <Text style={styles.requestCardTitle}>Waiting for requests…</Text>
               <Text style={styles.requestCardSub}>
                 You're online and visible to patients nearby
               </Text>
            </View>
          <View style={[styles.requestDot, { backgroundColor: GREEN }]} />
        </View>
      ) : (
        <>
          <Text style={styles.nearbySectionTitle}>
           {officeRequests.length} REQUEST{officeRequests.length > 1 ? 'S' : ''} NEARBY
          </Text>
          <ScrollView style={styles.nearbyList} showsVerticalScrollIndicator={false}>
            {officeRequests.map((req) => (
              <View key={req.id} style={styles.nearbyCard}>
                <View style={styles.nearbyCardIcon}>
                 <Text style={styles.nearbyCardIconText}>📍</Text>
                </View>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.nearbyCardTitle}>{req.test_name || 'Clinical Test'}</Text>
                  <Text style={styles.nearbyCardSub} numberOfLines={1}>
                    {req.address || 'Address unknown'}
                  </Text>
                  <Text style={styles.nearbyCardMeta}>
                     {req.distance_miles} mi from office
                     {req.preferred_time ? ` · ${req.preferred_time}` : ''}
                  </Text>
                </View>
                {/* Explicit action button instead of the whole card being
                    silently tappable — this is what was confusing before. */}
                <TouchableOpacity
                  style={styles.viewRequestBtn}
                  activeOpacity={0.85}
                  onPress={() => handleViewRequest(req)}
                >
                  <Text style={styles.viewRequestBtnText}>View Request</Text>
                  <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
             ))}
            </ScrollView>
          </>
        )}
      </>
    )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#E8F0E9' },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 12 },
  topBarInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: GREEN, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, elevation: 6, gap: 10 },
  backButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  topLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  headerAvatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  headerName: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11.5 },

  myMarkerWrapper: { alignItems: 'center', justifyContent: 'center', width: 60, height: 60 },
  myMarkerRing: { position: 'absolute', width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: 'rgba(27,122,77,0.35)', backgroundColor: 'rgba(27,122,77,0.1)' },
  myMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#FFFFFF', elevation: 4 },
  myMarkerText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  patientMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', elevation: 3 },
  patientMarkerText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },

  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24, elevation: 12 },

  statsRow: { flexDirection: 'row', backgroundColor: '#F6F8FC', borderRadius: 16, padding: 16, marginBottom: 14 },
  statCard: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 12 },
  statLabel: { fontSize: 12.5, color: '#6B7280' },
  statValue: { fontSize: 26, fontWeight: '700', color: PRIMARY, marginTop: 4 },

  goOnlineBtn: { backgroundColor: GREEN, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  goOnlineBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  requestCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  requestCardLeft: { flex: 1 },
  requestCardTitle: { fontSize: 14.5, fontWeight: '700', color: '#111827' },
  requestCardSub: { fontSize: 12.5, color: '#6B7280', marginTop: 3 },
  requestDot: { width: 10, height: 10, borderRadius: 5 },

  jobCard: { backgroundColor: '#FFF7ED', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#FED7AA' },
  jobCardTitle: { fontSize: 16, fontWeight: '800', color: '#C2410C', marginBottom: 4 },
  jobCardSub: { fontSize: 13.5, color: '#374151', marginBottom: 2 },
  jobCardMeta: { fontSize: 12.5, color: '#6B7280', marginBottom: 2 },
  jobCardTime: { fontSize: 12.5, color: '#6B7280', fontWeight: '600', marginBottom: 12 },
  jobCardActions: { flexDirection: 'row', gap: 10 },
  rejectBtn: { flex: 1, borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  rejectBtnText: { fontWeight: '700', color: '#374151' },
  acceptBtn: { flex: 1, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  acceptBtnText: { fontWeight: '700', color: '#fff' },
  officeMarker: {
  width: 34, height: 34, borderRadius: 17,
  backgroundColor: '#F59E0B',
  alignItems: 'center', justifyContent: 'center',
  borderWidth: 2, borderColor: '#FFFFFF', elevation: 3,
},
officeMarkerText: { color: '#FFFFFF', fontWeight: '800', fontSize: 10 },
officeCenterMarker: {
  width: 40, height: 40, borderRadius: 20,
  backgroundColor: PRIMARY,
  alignItems: 'center', justifyContent: 'center',
  borderWidth: 2.5, borderColor: '#FFFFFF', elevation: 4,
},
officeCenterMarkerText: { fontSize: 18 },
nearbySectionTitle: {
  fontSize: 12,
  fontWeight: '700',
  color: '#6B7280',
  letterSpacing: 0.5,
  marginBottom: 10,
},
nearbyList: {
  maxHeight: 260,
},
nearbyCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#F6F8FC',
  borderRadius: 14,
  padding: 12,
  marginBottom: 10,
},
nearbyCardIcon: {
  width: 38, height: 38, borderRadius: 19,
  backgroundColor: '#FFF7ED',
  alignItems: 'center', justifyContent: 'center',
  marginRight: 12,
},
nearbyCardIconText: { fontSize: 16 },
nearbyCardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
nearbyCardSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
nearbyCardMeta: { fontSize: 11.5, color: '#F59E0B', fontWeight: '600', marginTop: 3 },
viewRequestBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  backgroundColor: PRIMARY,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 9,
},
viewRequestBtnText: {
  color: '#FFFFFF',
  fontWeight: '700',
  fontSize: 11.5,
},
});