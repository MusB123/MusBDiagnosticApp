import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { PHLEB_ENDPOINTS } from '../config/api';
import * as SecureStore from 'expo-secure-store';
import { getStoredPhlebUser } from '../utils/auth';

const PHLEB_TOKEN_KEY = 'musb_phleb_token';
const PRIMARY = '#18377D';
const GREEN = '#1B7A4D';
const RED = '#C0392B';
const TIMER_SECONDS = 300; // 2 minutes

export default function NewRequestScreen({ route, navigation }) {
  const { request } = route.params || {};

  // Fallback mock data so the screen still renders if no params are passed
  const job = request || {
    id: 'JOB-1042',
    location: 'Hyde Park, Tampa',
    distanceMiles: '2.4 mi',
    distanceFromYou: '2.4 miles',
    estimatedDrive: '~9 min',
    neighbourhood: 'Hyde Park',
    collectionType: 'Blood draw',
  };
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);
  const progress = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef(null);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: TIMER_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, []);

  // Separate effect: react to the timer hitting zero, outside the render/update cycle.
  // Timer expiry should NOT decline the job — it just leaves the phlebotomist's
  // screen and returns them to the Dashboard, where the pending request still shows.
  useEffect(() => {
    if (secondsLeft === 0) {
      clearInterval(intervalRef.current);
      navigation.navigate('Dashboard');
    }
  }, [secondsLeft]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Manual back button — just leave this screen and go to the Dashboard.
  // This is NOT a decline: no API call, the request stays active/pending
  // and keeps showing up on the Dashboard.
  const handleGoBack = () => {
    if (submitting) return;
    clearInterval(intervalRef.current);
    navigation.navigate('PhlebDashboard');
  };

  const handleDecline = async () => {
  if (submitting) return;
  setSubmitting(true);
  clearInterval(intervalRef.current);
  try {
    const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
    await fetch(PHLEB_ENDPOINTS.declineBroadcast(job.id), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: 'Not available' }),
    });
  } catch {
    // navigate back regardless — decline is best-effort
  } finally {
    setSubmitting(false);
    navigation.goBack();
   }
  };

  const handleAccept = async () => {
  if (submitting) return;
  setSubmitting(true);
  clearInterval(intervalRef.current);
  try {
    const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
    const res = await fetch(PHLEB_ENDPOINTS.acceptBroadcast(job.id), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      Alert.alert('Could not accept', data?.error || 'This job may no longer be available.');
      setSubmitting(false);
      navigation.goBack();
      return;
    } 
     const phlebUser = await getStoredPhlebUser();
    let fullJob = null;
    if (phlebUser?.id) {
      const jobsRes = await fetch(PHLEB_ENDPOINTS.phlebJobs(phlebUser.id), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const jobsData = await jobsRes.json();
      console.log('PHLEB JOBS RESPONSE:', JSON.stringify(jobsData, null, 2));
      const jobsList = Array.isArray(jobsData) ? jobsData : jobsData?.jobs || [];
      fullJob = jobsList.find((j) => String(j.id) === String(job.id)) || jobsList[0];
    }
    const detailRes = await fetch(PHLEB_ENDPOINTS.testChecklist(job.id), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const detailData = await detailRes.json();
    console.log('TEST CHECKLIST RESPONSE:', JSON.stringify(detailData, null, 2));

    navigation.navigate('JobAccepted', { job: fullJob || job });
  } catch (err) {
    Alert.alert('Error', 'Could not accept the job. Please check your connection.');
    setSubmitting(false);
  }
 };

  const isUrgent = secondsLeft <= 30;

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* Top banner with timer */}
      <View style={styles.timerBanner}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.8}
          onPress={handleGoBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.timerLabel}>New collection request</Text>
        <Text style={styles.timerSubLabel}>Respond within</Text>

        <Text style={[styles.timerValue, isUrgent && styles.timerValueUrgent]}>
          {formatTime(secondsLeft)}
        </Text>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: isUrgent ? '#F87171' : '#FBBF24',
              },
            ]}
          />
        </View>
      </View>

      {/* Details */}
      <View style={styles.body}>
        <Text style={styles.sectionTitle}>
          REQUEST DETAILS (BEFORE ACCEPTANCE)
        </Text>

        <View style={styles.detailsCard}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color={PRIMARY} />
            <Text style={styles.locationText}>{job.location}</Text>
            <View style={styles.distancePill}>
              <Text style={styles.distancePillText}>{job.distanceMiles}</Text>
            </View>
          </View>

          <View style={styles.detailsDivider} />

          <DetailRow label="Distance from you" value={job.distanceFromYou} />
          <DetailRow label="Estimated drive" value={job.estimatedDrive} />
          <DetailRow label="Neighbourhood" value={job.neighbourhood} />
          <DetailRow label="Collection type" value={job.collectionType} last />
        </View>

        {/* Privacy notice */}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>
            Patient contact & full address revealed after you accept.
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.declineButton}
            activeOpacity={0.85}
            onPress={handleDecline}
            disabled={submitting}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptButton}
            activeOpacity={0.9}
            onPress={handleAccept}
            disabled={submitting}
          >
            <Text style={styles.acceptText}>Accept request</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>
          If not responded, request passes to next nearest phlebotomist
        </Text>
      </View>
    </View>
  );
}

function DetailRow({ label, value, last }) {
  return (
    <View style={[styles.detailRow, last && { marginBottom: 0 }]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '-'}</Text>
    </View>
  );
}

const TOP_PADDING =
  Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 50;

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#F6F8FC',
  },

  timerBanner: {
    backgroundColor: PRIMARY,
    paddingTop: TOP_PADDING,
    paddingBottom: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  backButton: {
    position: 'absolute',
    top: TOP_PADDING,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  timerLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 4,
  },

  timerSubLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
  },

  timerValue: {
    color: '#FBBF24',
    fontSize: 44,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 1,
  },

  timerValueUrgent: {
    color: '#F87171',
  },

  progressTrack: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  locationText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  distancePill: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  distancePillText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '700',
  },

  detailsDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 10,
  },

  detailLabel: {
    width:120,
    fontSize: 13.5,
    color: '#6B7280',
  },

  detailValue: {
    flex:1,
    fontSize: 13.5,
    fontWeight: '700',
    color: PRIMARY,
    textAlign: 'right'
  },

  noticeCard: {
    backgroundColor: '#FFF7E6',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },

  noticeText: {
    color: '#92400E',
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },

  declineButton: {
    flex: 1,
    backgroundColor: RED,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },

  declineText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  acceptButton: {
    flex: 1.6,
    backgroundColor: GREEN,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },

  acceptText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  footerNote: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 14,
    lineHeight: 17,
  },
});