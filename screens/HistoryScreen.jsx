import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchPatientHistory } from '../utils/auth';

const COLORS = {
  navy: '#1B3A8C',
  navyDark: '#0D1F3C',
  white: '#FFFFFF',
  offWhite: '#F4F7FB',
  lightGray: '#E8EEF5',
  gray: '#8A9BB0',
  border: '#D1DBE8',
  green: '#22C55E',
  greenLight: '#DCFCE7',
  red: '#EF4444',
  redLight: '#FEE2E2',
  orange: '#F59E0B',
  orangeLight: '#FEF3C7',
};

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: COLORS.green, bg: COLORS.greenLight },
  cancelled: { label: 'Cancelled', color: COLORS.red,   bg: COLORS.redLight },
  declined:  { label: 'Declined',  color: COLORS.orange, bg: COLORS.orangeLight },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] ?? {
    label: status ?? 'Unknown',
    color: COLORS.gray,
    bg: COLORS.lightGray,
  };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function AppointmentCard({ item }) {
  return (
    <View style={styles.card}>
      <View style={styles.dateBox}>
        <Text style={styles.month}>{item.month ?? '???'}</Text>
        <Text style={styles.day}>{item.day ?? '--'}</Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.testName} numberOfLines={1}>
          {item.test_name ?? item.test ?? 'Clinical Test'}
        </Text>
        <Text style={styles.meta}>
          {item.preferred_time ?? item.time ?? 'TBD'}
          {item.assigned_phlebotomist_name
            ? `  ·  ${item.assigned_phlebotomist_name}`
            : ''}
        </Text>
        {item.address ? (
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
        ) : null}
      </View>

      <StatusBadge status={item.status} />
    </View>
  );
}

export default function HistoryScreen({ navigation }) {
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    let alive = true;
    fetchPatientHistory()
      .then(data => { if (alive) setHistory(data); })
      .catch(err => {
        if (!alive) return;
        setError(
          err.message === 'NETWORK_ERROR'  ? "Can't reach the server." :
          err.message === 'NOT_LOGGED_IN'  ? 'Please log in again.'    :
          err.message
        );
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.offWhite} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>History</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.navy} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>⚠ {error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoading(true);
              setError('');
              fetchPatientHistory()
                .then(setHistory)
                .catch(e => setError(e.message))
                .finally(() => setLoading(false));
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🗂️</Text>
          <Text style={styles.emptyTitle}>No past appointments</Text>
          <Text style={styles.emptySubtitle}>Your completed visits will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => String(item.id ?? item._id ?? Math.random())}
          renderItem={({ item }) => <AppointmentCard item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center' },
  backArrow:   { fontSize: 22, color: COLORS.navyDark, fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.navyDark },

  list: { padding: 16, gap: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  dateBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: { fontSize: 10, fontWeight: '700', color: COLORS.navy, textTransform: 'uppercase' },
  day:   { fontSize: 16, fontWeight: '800', color: COLORS.navyDark },

  cardBody:  { flex: 1 },
  testName:  { fontSize: 14, fontWeight: '700', color: COLORS.navyDark, marginBottom: 2 },
  meta:      { fontSize: 12, color: COLORS.gray, marginBottom: 2 },
  address:   { fontSize: 11, color: COLORS.gray },

  badge:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  errorText:    { color: COLORS.red, fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryBtn:     { backgroundColor: COLORS.navy, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText:    { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  emptyIcon:     { fontSize: 48, marginBottom: 12 },
  emptyTitle:    { fontSize: 16, fontWeight: '800', color: COLORS.navyDark, marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: COLORS.gray, textAlign: 'center' },
});