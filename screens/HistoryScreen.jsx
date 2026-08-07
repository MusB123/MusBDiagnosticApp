import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, StatusBar, Modal, Pressable,
  Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { fetchPatientHistory } from '../utils/auth';

const COLORS = {
  navy: '#1B3A8C',
  navyDark: '#0D1F3C',
  white: '#FFFFFF',
  offWhite: '#F4F7FB',
  lightGray: '#E8EEF5',
  gray: '#8A9BB0',
  bodyText: '#4A5568',
  border: '#D1DBE8',
  green: '#22C55E',
  greenLight: '#DCFCE7',
  red: '#EF4444',
  redLight: '#FEE2E2',
  orange: '#F59E0B',
  orangeLight: '#FEF3C7',
  overlay: 'rgba(13, 31, 60, 0.55)',
  skeleton: '#E4EAF3',
  skeletonHi: '#F2F5FA',
};

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: COLORS.green, bg: COLORS.greenLight, icon: 'checkmark-circle' },
  cancelled: { label: 'Cancelled', color: COLORS.red, bg: COLORS.redLight, icon: 'close-circle' },
  declined: { label: 'Declined', color: COLORS.orange, bg: COLORS.orangeLight, icon: 'alert-circle' },
};

// ── Shared animation primitives (same language as the rest of the app) ──

function AnimatedPressable({ style, onPress, children, scaleTo = 0.97, disabled, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={style}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function FadeInUp({ delay = 0, distance = 14, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 420, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function IconPop({ delay = 0, children }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }),
    ]).start();
  }, []);
  return <Animated.View style={{ transform: [{ scale: anim }] }}>{children}</Animated.View>;
}

// ── Skeleton shimmer ──

function Shimmer({ style }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return <Animated.View style={[style, { opacity, backgroundColor: COLORS.skeleton }]} />;
}

function SkeletonCard({ delay = 0 }) {
  return (
    <FadeInUp delay={delay} distance={8}>
      <View style={styles.card}>
        <Shimmer style={styles.skeletonDateBox} />
        <View style={{ flex: 1, gap: 8 }}>
          <Shimmer style={{ height: 14, width: '70%', borderRadius: 6 }} />
          <Shimmer style={{ height: 11, width: '45%', borderRadius: 6 }} />
          <Shimmer style={{ height: 10, width: '55%', borderRadius: 6 }} />
        </View>
        <Shimmer style={{ width: 68, height: 22, borderRadius: 8 }} />
      </View>
    </FadeInUp>
  );
}

function SkeletonList() {
  return (
    <View style={styles.list}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <SkeletonCard key={i} delay={i * 60} />
      ))}
    </View>
  );
}

// ── Status badge ──

function StatusBadge({ status, animate = true }) {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] ?? {
    label: status ?? 'Unknown',
    color: COLORS.gray,
    bg: COLORS.lightGray,
    icon: 'ellipse',
  };
  const pop = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (!animate) return;
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 12, delay: 120 }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.badge,
        { backgroundColor: cfg.bg, transform: [{ scale: pop }] },
      ]}
    >
      <Ionicons name={cfg.icon} size={11} color={cfg.color} style={{ marginRight: 4 }} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </Animated.View>
  );
}

function formatMoney(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (Number.isNaN(num)) return null;
  return `$${num.toFixed(2)}`;
}

function getVisitTypeLabel(item) {
  const raw = (item.visit_type ?? '').toString().toLowerCase();
  if (raw === 'walkin' || raw === 'onsite' || raw.includes('walk')) return 'Walk-in (In-Center)';
  if (raw === 'mobile' || raw === 'home' || raw.includes('mobile')) return 'Mobile Phlebotomy';
  return item.visit_type || 'N/A';
}

// ── Appointment card ──

function AppointmentCard({ item, onPress, delay }) {
  return (
    <FadeInUp delay={delay} distance={10}>
      <AnimatedPressable style={styles.card} onPress={() => onPress(item)} scaleTo={0.98}>
        <View style={styles.dateBox}>
          <IconPop delay={delay + 80}>
            <Text style={styles.month}>{item.month ?? '???'}</Text>
            <Text style={styles.day}>{item.day ?? '--'}</Text>
          </IconPop>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.testName} numberOfLines={1}>
            {item.test_name ?? item.test ?? 'Clinical Test'}
          </Text>
          <View style={styles.metaRow}>
            <Feather name="clock" size={11} color={COLORS.gray} />
            <Text style={styles.meta} numberOfLines={1}>
              {item.preferred_time ?? item.time ?? 'TBD'}
              {item.assigned_phlebotomist_name ? `  ·  ${item.assigned_phlebotomist_name}` : ''}
            </Text>
          </View>
          {item.address ? (
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={11} color={COLORS.gray} />
              <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardRight}>
          <StatusBadge status={item.status} />
          <Feather name="chevron-right" size={16} color={COLORS.gray} style={{ marginTop: 8 }} />
        </View>
      </AnimatedPressable>
    </FadeInUp>
  );
}

// ── Detail row ──

function DetailRow({ label, value, delay = 0 }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <FadeInUp delay={delay} distance={6}>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </FadeInUp>
  );
}

// ── Detail modal ──

function AppointmentDetailModal({ visible, item, onClose }) {
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, speed: 15, bounciness: 8, delay: 60 }).start();
    } else {
      overlayAnim.setValue(0);
      cardAnim.setValue(0);
    }
  }, [visible]);

  if (!item) return null;

  const testPrice = formatMoney(item.test_price ?? item.testTotal);
  const visitTypeLabel = getVisitTypeLabel(item);
  const total = formatMoney(item.totalPatientFee ?? item.total_patient_fee);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalOverlay, { opacity: overlayAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.modalCard,
            {
              opacity: cardAnim,
              transform: [
                { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                { translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <View style={styles.modalIconRing}>
                <Ionicons name="document-text" size={18} color={COLORS.navy} />
              </View>
              <Text style={styles.modalTitle}>Appointment Details</Text>
            </View>
            <AnimatedPressable onPress={onClose} style={styles.closeBtn} scaleTo={0.85}>
              <Feather name="x" size={16} color={COLORS.gray} />
            </AnimatedPressable>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.sectionLabel}>Patient</Text>
            <DetailRow label="Name" value={item.full_name ?? item.patient_name} delay={20} />
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.sectionLabel}>Test</Text>
            <DetailRow label="Test Name" value={item.test_name ?? item.test} delay={40} />
            <DetailRow label="Test Price" value={testPrice ?? 'Billed to insurance'} delay={60} />
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.sectionLabel}>Visit Type</Text>
            <DetailRow label="Type" value={visitTypeLabel} delay={80} />
          </View>

          {total ? (
            <FadeInUp delay={100} distance={6}>
              <View style={styles.totalRow}>
                <View style={styles.totalIconRing}>
                  <Ionicons name="wallet" size={14} color={COLORS.green} />
                </View>
                <Text style={styles.totalLabel}>Total Paid</Text>
                <Text style={styles.totalValue}>{total}</Text>
              </View>
            </FadeInUp>
          ) : null}

          <FadeInUp delay={120} distance={6}>
            <View style={styles.modalFooterRow}>
              <StatusBadge status={item.status} animate={false} />
            </View>
          </FadeInUp>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Empty / error states ──

function EmptyState() {
  return (
    <FadeInUp delay={0} style={styles.center}>
      <IconPop delay={100}>
        <View style={styles.emptyIconRing}>
          <Ionicons name="file-tray-outline" size={30} color={COLORS.navy} />
        </View>
      </IconPop>
      <Text style={styles.emptyTitle}>No past appointments</Text>
      <Text style={styles.emptySubtitle}>Your completed visits will appear here.</Text>
    </FadeInUp>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <FadeInUp delay={0} style={styles.center}>
      <IconPop delay={80}>
        <View style={styles.errorIconRing}>
          <Feather name="alert-triangle" size={26} color={COLORS.red} />
        </View>
      </IconPop>
      <Text style={styles.errorText}>{error}</Text>
      <AnimatedPressable style={styles.retryBtn} onPress={onRetry} scaleTo={0.95}>
        <Feather name="refresh-cw" size={14} color={COLORS.white} style={{ marginRight: 6 }} />
        <Text style={styles.retryText}>Retry</Text>
      </AnimatedPressable>
    </FadeInUp>
  );
}

// ── Screen ──

export default function HistoryScreen({ navigation }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    fetchPatientHistory()
      .then(setHistory)
      .catch((err) => {
        setError(
          err.message === 'NETWORK_ERROR' ? "Can't reach the server." :
          err.message === 'NOT_LOGGED_IN' ? 'Please log in again.' :
          err.message
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let alive = true;
    fetchPatientHistory()
      .then((data) => { if (alive) setHistory(data); })
      .catch((err) => {
        if (!alive) return;
        setError(
          err.message === 'NETWORK_ERROR' ? "Can't reach the server." :
          err.message === 'NOT_LOGGED_IN' ? 'Please log in again.' :
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
      <FadeInUp delay={0} distance={0}>
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} style={styles.backBtn} scaleTo={0.85}>
            <Ionicons name="arrow-back" size={20} color={COLORS.navyDark} />
          </AnimatedPressable>
          <Text style={styles.headerTitle}>History</Text>
          <View style={{ width: 38 }} />
        </View>
      </FadeInUp>

      {loading ? (
        <SkeletonList />
      ) : error ? (
        <ErrorState error={error} onRetry={load} />
      ) : history.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => String(item.id ?? item._id ?? Math.random())}
          renderItem={({ item, index }) => (
            <AppointmentCard item={item} onPress={setSelected} delay={Math.min(index, 8) * 50} />
          )}
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
  safe: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.navyDark, letterSpacing: 0.2 },

  list: { padding: 16, gap: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.lightGray,
    gap: 12,
    elevation: 2,
    shadowColor: COLORS.navyDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  skeletonDateBox: {
    width: 48, height: 48, borderRadius: 14,
  },
  dateBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EAF0FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: { fontSize: 10, fontWeight: '800', color: COLORS.navy, textTransform: 'uppercase', textAlign: 'center' },
  day: { fontSize: 17, fontWeight: '900', color: COLORS.navyDark, textAlign: 'center' },

  cardBody: { flex: 1, gap: 3 },
  testName: { fontSize: 14.5, fontWeight: '800', color: COLORS.navyDark },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 12, color: COLORS.gray, flexShrink: 1 },
  address: { fontSize: 11, color: COLORS.gray, flexShrink: 1 },

  cardRight: { alignItems: 'flex-end' },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },

  errorText: { color: COLORS.red, fontSize: 14, fontWeight: '600', marginBottom: 16, marginTop: 12, textAlign: 'center' },
  errorIconRing: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.redLight, alignItems: 'center', justifyContent: 'center',
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.navy, borderRadius: 12,
    paddingHorizontal: 22, paddingVertical: 12,
  },
  retryText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },

  emptyIconRing: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#EAF0FB', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark, marginBottom: 6 },
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
    borderRadius: 24,
    padding: 22,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalIconRing: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#EAF0FB', alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 15.5, fontWeight: '800', color: COLORS.navyDark },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center', justifyContent: 'center',
  },

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
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalIconRing: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: COLORS.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  totalLabel: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.navyDark },
  totalValue: { fontSize: 19, fontWeight: '900', color: COLORS.green },

  modalFooterRow: { marginTop: 14, alignItems: 'flex-start' },
});