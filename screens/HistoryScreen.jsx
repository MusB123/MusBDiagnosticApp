import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity, StatusBar, Modal, Pressable,
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
  overlay: 'rgba(13, 31, 60, 0.55)',
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

function formatMoney(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (Number.isNaN(num)) return null;
  return `$${num.toFixed(2)}`;
}

// Backend stores visit_type as 'mobile' / 'home' (mobile phlebotomy) or
// 'walkin' / 'onsite' (in-center). See book_appointment() in patients/views.py.
function getVisitTypeLabel(item) {
  const raw = (item.visit_type ?? '').toString().toLowerCase();
  if (raw === 'walkin' || raw === 'onsite' || raw.includes('walk')) return 'Walk-in (In-Center)';
  if (raw === 'mobile' || raw === 'home' || raw.includes('mobile')) return 'Mobile Phlebotomy';
  return item.visit_type || 'N/A';
}

function AppointmentCard({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.7}>
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
    </TouchableOpacity>
  );
}

function DetailRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function AppointmentDetailModal({ visible, item, onClose }) {
  if (!item) return null;

  const testPrice = formatMoney(item.test_price ?? item.testTotal);
  const visitTypeLabel = getVisitTypeLabel(item);
  const total = formatMoney(item.totalPatientFee ?? item.total_patient_fee);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Appointment Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.sectionLabel}>Patient</Text>
            <DetailRow label="Name" value={item.full_name ?? item.patient_name} />
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.sectionLabel}>Test</Text>
            <DetailRow label="Test Name" value={item.test_name ?? item.test} />
            <DetailRow label="Test Price" value={testPrice ?? 'Billed to insurance'} />
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.sectionLabel}>Visit Type</Text>
            <DetailRow label="Type" value={visitTypeLabel} />
          </View>

          {total ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Paid</Text>
              <Text style={styles.totalValue}>{total}</Text>
            </View>
          ) : null}

          <View style={styles.modalFooterRow}>
            <StatusBadge status={item.status} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function HistoryScreen({ navigation }) {
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState(null);

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
          renderItem={({ item }) => <AppointmentCard item={item} onPress={setSelected} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <AppointmentDetailModal
        visible={!!selected}
        item={selected}
        onClose={() => setSelected(null)}
      />
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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.gray },

  modalSection: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.navy,
    textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.4,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: { fontSize: 13, color: COLORS.gray },
  detailValue: { fontSize: 13, fontWeight: '700', color: COLORS.navyDark, flexShrink: 1, textAlign: 'right' },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: { fontSize: 14, fontWeight: '800', color: COLORS.navyDark },
  totalValue: { fontSize: 18, fontWeight: '800', color: COLORS.green },

  modalFooterRow: { marginTop: 12, alignItems: 'flex-start' },
});