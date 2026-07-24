import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PHLEB_ENDPOINTS } from '../config/api';
import * as SecureStore from 'expo-secure-store';

const PHLEB_TOKEN_KEY = 'musb_phleb_token';
const PRIMARY = '#18377D';
const GREEN = '#1B7A4D';
const RED = '#C0392B';
const TIMER_SECONDS = 300; // 5 minutes

// The screen name registered in the navigator for the phlebotomist dashboard.
// Centralized here so the timer-expiry and manual-back paths can never drift
// apart again (previously one used 'Dashboard', the other 'PhlebDashboard').
const DASHBOARD_ROUTE = 'PhlebDashboard';

// Splits a raw preferred_date string into FULL weekday + FULL month/date parts.
// e.g. "Saturday" / "25 July" instead of "Sat" / "25 Jul".
function splitDayDate(dateStr) {
  if (!dateStr) return { day: '-', date: '-' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { day: '-', date: dateStr };
  const day = d.toLocaleDateString('en-US', { weekday: 'long' });
  const date = `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'long' })}`;
  return { day, date };
}

export default function NewRequestScreen({ route, navigation }) {
  // Default to {} so a missing/undefined params object (e.g. this screen
  // opened without a request being passed) doesn't crash on job.preferredDate
  // below — it just renders with placeholder dashes instead.
  const { request: job = {} } = route.params || {};

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
      navigation.navigate(DASHBOARD_ROUTE);
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
    navigation.navigate(DASHBOARD_ROUTE);
  };

  const handleDecline = async () => {
    if (submitting) return;
    setSubmitting(true);
    clearInterval(intervalRef.current);
    try {
      const token = await SecureStore.getItemAsync(PHLEB_TOKEN_KEY);
      const res = await fetch(PHLEB_ENDPOINTS.declineBroadcast(job.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'Not available' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.warn('handleDecline: server rejected decline', res.status, data);
      }
    } catch (err) {
      // navigate back regardless — decline is best-effort
      console.warn('handleDecline failed:', err);
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Could not accept', data?.error || 'This job may no longer be available.');
        setSubmitting(false);
        navigation.goBack();
        return;
      }

      // Pull the freshly-assigned job by "who's active right now" instead of
      // searching a list and matching IDs — avoids ID-mismatch bugs and
      // returns full patient_phone / patient_lat / patient_lng / address.
      const activeRes = await fetch(PHLEB_ENDPOINTS.dispatch.activeJob, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const activeData = await activeRes.json().catch(() => null);
      if (!activeRes.ok) {
        console.warn('handleAccept: activeJob fetch failed', activeRes.status, activeData);
      }
      const fullJob = activeRes.ok && activeData?.has_active ? activeData.job : null;

      navigation.navigate('JobAccepted', { job: fullJob || job });
    } catch (err) {
      console.warn('handleAccept failed:', err);
      Alert.alert('Error', 'Could not accept the job. Please check your connection.');
      setSubmitting(false);
    }
  };

  const isUrgent = secondsLeft <= 30;
  const { day, date } = splitDayDate(job.preferredDate);

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

      {/* Scrollable body so Accept/Decline never get pushed off-screen */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>
          REQUEST DETAILS (BEFORE ACCEPTANCE)
        </Text>

        {/* Estimated payout box */}
        <View style={styles.payoutCard}>
          <Text style={styles.payoutLabel}>Estimated payout</Text>
          <Text style={styles.payoutValue}>
            {job.estimatedPayout != null
              ? `$${Number(job.estimatedPayout).toFixed(2)}`
              : '—'}
          </Text>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color={PRIMARY} />
            <Text style={styles.locationText}>{job.location || 'Location pending'}</Text>
            <View style={styles.distancePill}>
              <Text style={styles.distancePillText}>{job.distanceMiles || '—'}</Text>
            </View>
          </View>

          <View style={styles.detailsDivider} />

          <DetailRow label="Distance from you" value={job.distanceFromYou} />
          <DetailRow label="Collection day" value={day} />
          <DetailRow label="Collection date" value={date} />
          <DetailRow label="Collection time" value={job.preferredTime} />
          <DetailRow
            label="Collection type"
            value={job.collectionType}
          />
          <DetailRow
            label="Payment type"
            value={job.isSelfPaid ? 'Self-paid' : 'Insurance'}
            last
          />
        </View>

        {job.isSelfPaid && (
          <View style={styles.selfPaidNotice}>
            <Ionicons name="cash-outline" size={16} color="#92400E" style={{ marginRight: 8 }} />
            <Text style={styles.selfPaidNoticeText}>
              This is a self-paid test. If you drop the samples at the specified location, you may receive additional income. The extra payment is determined by the admin.
            </Text>
          </View>
        )}

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
      </ScrollView>
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
  },

  bodyContent: {
    paddingTop: 22,
    paddingBottom: 36,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  payoutCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
  },

  payoutLabel: {
    fontSize: 12.5,
    color: '#166534',
    fontWeight: '600',
  },

  payoutValue: {
    fontSize: 24,
    fontWeight: '800',
    color: GREEN,
    marginTop: 2,
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
    marginBottom: 14,
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
    width: 130,
    fontSize: 13.5,
    color: '#6B7280',
  },

  detailValue: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: PRIMARY,
    textAlign: 'right',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
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

  selfPaidNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF7E6',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  selfPaidNoticeText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },
});
