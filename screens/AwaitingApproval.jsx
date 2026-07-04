import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getApplicationStatus, login } from '../utils/auth';

const POLL_INTERVAL_MS = 8000;

export default function AwaitingApproval({ navigation, route }) {
  const {
    fullName = 'User',
    specialistId,
    email,
    password,
  } = route.params || {};

  // 'pending' | 'active' | 'rejected' | 'error'
  const [reviewState, setReviewState] = useState('pending');
  const [errorMessage, setErrorMessage] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const pollRef = useRef(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!specialistId) {
      setReviewState('error');
      setErrorMessage('Missing application ID. Please try registering again.');
      return;
    }

    checkStatus();
    pollRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);

    return () => {
      stoppedRef.current = true;
      clearInterval(pollRef.current);
    };
  }, []);

  const checkStatus = async () => {
    try {
      const data = await getApplicationStatus(specialistId);

      if (stoppedRef.current) return;

      if (data.status === 'active') {
        clearInterval(pollRef.current);
        await handleApproved();
      } else if (data.status === 'rejected') {
        clearInterval(pollRef.current);
        setReviewState('rejected');
      } else {
        setReviewState('pending');
      }
    } catch (err) {
      // Keep polling on transient network errors — only surface it,
      // don't stop the interval, since the backend may just be waking up.
      setErrorMessage(err.message || 'Could not check application status.');
    }
  };

  const handleApproved = async () => {
    setLoggingIn(true);
    try {
      await login(email, password);
      navigation.replace('PhlebDashboard', { fullName });
    } catch (err) {
      // Approved on the backend, but auto-login failed (e.g. network blip).
      // Let them see an approved state and retry rather than getting stuck.
      setReviewState('active');
      setErrorMessage(
        err.message || 'Approved! Could not log you in automatically — please try again.'
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const retryLogin = () => {
    setErrorMessage('');
    handleApproved();
  };

  if (reviewState === 'rejected') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.iconCircle, styles.iconCircleRejected]}>
            <Text style={styles.icon}>✕</Text>
          </View>
          <Text style={styles.title}>Application not approved</Text>
          <Text style={styles.description}>
            Your application didn't pass verification. Please contact support
            for details, or submit a new application with updated documents.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (reviewState === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.iconCircle, styles.iconCircleRejected]}>
            <Text style={styles.icon}>⚠️</Text>
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.description}>{errorMessage}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.iconCircle}>
          {loggingIn ? (
            <ActivityIndicator color="#F0C14B" size="large" />
          ) : (
            <Text style={styles.icon}>
              {reviewState === 'active' ? '✅' : '⏳'}
            </Text>
          )}
        </View>

        <Text style={styles.title}>
          {reviewState === 'active' ? 'Approved!' : 'Under review'}
        </Text>

        <Text style={styles.description}>
          {reviewState === 'active'
            ? 'Your account has been approved. Logging you in…'
            : "MusB Diagnostics admin is verifying your credentials. You'll be notified by email and push notification once approved."}
        </Text>
         
        {__DEV__ && (
          <Text style={{ fontSize: 11, color: '#999', marginBottom: 10 }}>
           DEBUG: specialistId = {String(specialistId)}
          </Text>
        )} 

        {!!errorMessage && (
           <Text style={styles.errorText}>{errorMessage}</Text>
        )}
        


        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.step}>1</Text>
            <Text style={styles.label}>Personal information</Text>
            <View style={styles.doneBadge}>
              <Text style={styles.doneText}>Submitted</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.step}>2</Text>
            <Text style={styles.label}>Licences & certs</Text>
            <View style={styles.doneBadge}>
              <Text style={styles.doneText}>Submitted</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.step}>3</Text>
            <Text style={styles.label}>Banking details</Text>
            <View style={styles.doneBadge}>
              <Text style={styles.doneText}>Submitted</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={reviewState === 'active' ? styles.step : styles.pendingStep}>4</Text>
            <Text style={reviewState === 'active' ? styles.label : styles.pendingLabel}>
              Admin review
            </Text>
            <View style={reviewState === 'active' ? styles.doneBadge : styles.pendingBadge}>
              <Text style={reviewState === 'active' ? styles.doneText : styles.pendingText}>
                {reviewState === 'active' ? 'Approved' : 'Pending'}
              </Text>
            </View>
          </View>
        </View>

        {reviewState === 'pending' && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>
              Estimated review: 1–3 business days
            </Text>
            <Text style={styles.noticeText}>
              This screen updates automatically — no need to refresh.
            </Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFF7E2',
    borderWidth: 3,
    borderColor: '#F0C14B',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  iconCircleRejected: {
    backgroundColor: '#FDECEC',
    borderColor: '#E9505F',
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 25,
    color: '#222',
  },
  description: {
    textAlign: 'center',
    color: '#777',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 30,
  },
  errorText: {
    textAlign: 'center',
    color: '#C0392B',
    fontSize: 13,
    marginTop: -18,
    marginBottom: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  step: {
    backgroundColor: '#0D2156',
    color: '#FFF',
    width: 28,
    height: 28,
    textAlign: 'center',
    lineHeight: 28,
    borderRadius: 14,
    marginRight: 12,
  },
  pendingStep: {
    backgroundColor: '#E5E7EB',
    color: '#666',
    width: 28,
    height: 28,
    textAlign: 'center',
    lineHeight: 28,
    borderRadius: 14,
    marginRight: 12,
  },
  label: {
    flex: 1,
    fontWeight: '600',
  },
  pendingLabel: {
    flex: 1,
    color: '#888',
    fontWeight: '600',
  },
  doneBadge: {
    backgroundColor: '#DDF7E7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  doneText: {
    color: '#1F8F55',
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: '#FFF2CC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pendingText: {
    color: '#C08400',
    fontWeight: '600',
  },
  noticeBox: {
    width: '100%',
    marginTop: 25,
    backgroundColor: '#FFF8E6',
    borderWidth: 1,
    borderColor: '#F2D57A',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#A86B00',
  },
  noticeText: {
    marginTop: 6,
    color: '#A86B00',
  },
});