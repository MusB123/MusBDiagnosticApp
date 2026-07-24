import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { PHLEB_ENDPOINTS } from '../config/api';
import { authGet, getStoredPhlebUser } from '../utils/auth';

/* ────────────────────────────────────────────────────────────
   NOTE ON BACKEND WIRING
   Job history: comes from PHLEB_ENDPOINTS.phlebJobs(phlebId) —
   GET /api/phlebotomists/<id>/jobs/ (views.phlebotomist_jobs). This is a
   real, working endpoint. It needs the phlebotomist's own ID in the URL,
   which we pull from getStoredPhlebUser() below (same pattern used on
   NewRequestScreen / DashboardScreen).

   Payout: THERE IS NO BACKEND ENDPOINT FOR THIS YET. A `payouts` Mongo
   collection exists and gets written to when a dispatch job completes
   (dispatch.py complete_dispatch_job), but nothing reads it back for a
   given phlebotomist. Until a real endpoint exists, this screen simply
   skips the payout card instead of pointing at a URL that doesn't exist.
   To wire it up later: add a Django view that sums this phlebotomist's
   `payout_status: 'pending'` records from the payouts collection, add a
   URL for it, then set PAYOUT_ENDPOINT below to that URL.

   Expected shape per job item from phlebJobs (see normalizeJob):
     { id, patient_name, address, tests, earning, status, date }
   status: 'completed' | 'assigned' | 'pending'
     (there is no 'expired' status from this endpoint currently)
──────────────────────────────────────────────────────────── */

// Set this once a real payout endpoint exists, e.g. `${PHLEB_ENDPOINTS.dashboard}payout/`
// or a dedicated PHLEB_ENDPOINTS.payout. Left null so the app doesn't call a dead URL.
const PAYOUT_ENDPOINT = null;

const PRIMARY   = '#18377D';
const GREEN     = '#22C55E';
const RED       = '#EF4444';
const AMBER     = '#F59E0B';
const GRAY      = '#9CA3AF';
const BORDER    = '#EEF1F7';
const BG        = '#F6F8FC';

const FILTERS = ['This week', 'Last week', 'This month', 'All time'];

/* ────────────────────────────────────────────────────────────
   Animation primitives (consistent with DashboardScreen)
──────────────────────────────────────────────────────────── */

function FadeInUp({ delay = 0, distance = 16, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 440,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
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

function AnimatedPressable({ style, onPress, children, scaleTo = 0.96, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} style={style} {...rest}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function CountUp({ value, prefix = '', decimals = 0, style, duration = 700 }) {
  const [display, setDisplay] = useState('0');
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setDisplay((v * value).toFixed(decimals)));
    Animated.timing(anim, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value]);
  return <Text style={style}>{prefix}{display}</Text>;
}

/** Gentle shimmer used for skeleton loading cards. */
function Shimmer({ style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={[style, { opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }]}
    />
  );
}

/* ────────────────────────────────────────────────────────────
   Presentational pieces
──────────────────────────────────────────────────────────── */

function StatusBadge({ status }) {
  const map = {
    completed: { label: 'Completed', color: GREEN, bg: '#DCFCE7' },
    expired: { label: 'Expired', color: RED, bg: '#FEE2E2' },
    pending: { label: 'Pending', color: AMBER, bg: '#FEF3C7' },
    assigned: { label: 'In Progress', color: PRIMARY, bg: '#EEF2FF' },
  };
  const s = map[status] || map.completed;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function JobCard({ item, onPress }) {
  const isExpired = item.status === 'expired';

  return (
    <AnimatedPressable
      style={[styles.card, isExpired && styles.cardExpired]}
      scaleTo={0.97}
      onPress={() => onPress && onPress(item)}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardIconWrap}>
          {isExpired ? (
            <Ionicons name="close" size={14} color={RED} />
          ) : (
            <Ionicons name="checkmark" size={14} color={GREEN} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, isExpired && { color: '#6B7280' }]}>
            {item.name}
          </Text>
          <Text style={styles.cardMeta}>
            {item.location} · {item.date}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <StatusBadge status={item.status} />
          {!isExpired && (
            <View style={styles.chevronBtn}>
              <Ionicons name="chevron-forward" size={16} color={PRIMARY} />
            </View>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardBottom}>
        <View style={styles.testsRow}>
          <Feather
            name={isExpired ? 'alert-circle' : 'activity'}
            size={13}
            color={isExpired ? RED : '#9CA3AF'}
          />
          <Text
            style={[styles.cardTests, isExpired && { color: '#EF4444' }]}
            numberOfLines={1}
          >
            {item.tests}
          </Text>
        </View>

        {item.earned != null && (
          <View style={styles.earnedRow}>
            <Text style={styles.earnedLabel}>Earned</Text>
            <Text style={styles.earnedAmount}>${Number(item.earned).toFixed(2)}</Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Shimmer style={styles.skelIcon} />
        <View style={{ flex: 1, gap: 6 }}>
          <Shimmer style={styles.skelLineWide} />
          <Shimmer style={styles.skelLineNarrow} />
        </View>
        <Shimmer style={styles.skelBadge} />
      </View>
      <View style={styles.divider} />
      <Shimmer style={styles.skelLineWide} />
    </View>
  );
}

/* ────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────── */

// Maps a raw job from GET /api/phlebotomists/<id>/jobs/ (views.phlebotomist_jobs)
// into the shape this screen renders. That endpoint returns:
//   id, date, patient_name, patient_phone, address, tests, status,
//   duration, earning, test_price, payment_method, has_order, has_insurance, ...
function normalizeJob(raw) {
  return {
    id: String(raw.id ?? raw.job_id ?? Math.random()),
    name: raw.patient_name || raw.name || 'Unassigned',
    location: raw.location || raw.address || 'Unknown location',
    date: raw.date || raw.formatted_date || '',
    tests: raw.tests || raw.test_names || (raw.status === 'expired' ? 'No response, escalated to admin' : '—'),
    // phlebJobs returns the payout amount as `earning`, not `earned`/`amount_earned`.
    earned: raw.earning ?? raw.earned ?? raw.amount_earned ?? null,
    status: raw.status || 'completed',
    // phlebJobs' `date` field is already a sliced 'YYYY-MM-DD' string — still
    // parseable by `new Date(...)`, so it works fine as the filter date too.
    rawDate: raw.completed_at || raw.date_iso || raw.created_at || raw.date || null,
  };
}

function withinFilter(job, filter) {
  if (filter === 'All time' || !job.rawDate) return true;
  const jobDate = new Date(job.rawDate);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOfWeek = now.getDay();
  const startOfThisWeek = new Date(startOfDay(now));
  startOfThisWeek.setDate(startOfThisWeek.getDate() - dayOfWeek);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (filter === 'This week') return jobDate >= startOfThisWeek;
  if (filter === 'Last week') return jobDate >= startOfLastWeek && jobDate < startOfThisWeek;
  if (filter === 'This month') return jobDate >= startOfThisMonth;
  return true;
}

/* ────────────────────────────────────────────────────────────
   Main screen
──────────────────────────────────────────────────────────── */

export default function JobHistoryScreen({ navigation }) {
  const [activeFilter, setActiveFilter] = useState('This week');
  const [jobs, setJobs] = useState([]);
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');
    try {
      const phlebUser = await getStoredPhlebUser();
      const phlebId = phlebUser?.id || phlebUser?.user_id;

      if (!phlebId) {
        setError('Could not identify your account. Please log in again.');
        setJobs([]);
        setPending(null);
        return;
      }

      const calls = [authGet(PHLEB_ENDPOINTS.phlebJobs(phlebId))];
      // Only call the payout endpoint once one actually exists on the backend.
      if (PAYOUT_ENDPOINT) calls.push(authGet(PAYOUT_ENDPOINT));

      const [historyRes, payoutRes] = await Promise.allSettled(calls);

      if (historyRes.status === 'fulfilled') {
        const list = historyRes.value?.jobs || historyRes.value || [];
        setJobs(list.map(normalizeJob));
      } else {
        setError('Could not load job history.');
      }

      if (payoutRes && payoutRes.status === 'fulfilled' && payoutRes.value) {
        const p = payoutRes.value;
        setPending({
          amount: p.amount != null ? `$${Number(p.amount).toFixed(2)}` : '$0.00',
          date: p.date || p.expected_date || '—',
          account: p.account || p.payout_account || '—',
        });
      } else {
        setPending(null);
      }
    } catch (err) {
      setError(
        err.message === 'NETWORK_ERROR' ? "Can't reach the server." : 'Something went wrong loading your history.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredJobs = jobs.filter((j) => withinFilter(j, activeFilter));
  const completed = filteredJobs.filter((j) => j.status === 'completed');
  const expired = filteredJobs.filter((j) => j.status === 'expired');
  const totalEarned = completed.reduce((sum, j) => sum + (Number(j.earned) || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <FadeInUp delay={0} distance={-10} style={styles.header}>
        <AnimatedPressable
          style={styles.backBtn}
          scaleTo={0.88}
          onPress={() => navigation && navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={PRIMARY} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Visit History</Text>
        <AnimatedPressable style={styles.filterIconBtn} scaleTo={0.88} onPress={() => loadData(true)}>
          <Feather name="refresh-cw" size={17} color={PRIMARY} />
        </AnimatedPressable>
      </FadeInUp>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={PRIMARY} colors={[PRIMARY]} />
        }
      >
        {/* Filter Pills */}
        <FadeInUp delay={70}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
          >
            {FILTERS.map((f) => (
              <AnimatedPressable
                key={f}
                style={[styles.pill, activeFilter === f && styles.pillActive]}
                scaleTo={0.93}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[styles.pillText, activeFilter === f && styles.pillTextActive]}>
                  {f}
                </Text>
              </AnimatedPressable>
            ))}
          </ScrollView>
        </FadeInUp>

        {/* Stats Row */}
        <FadeInUp delay={120}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons name="briefcase-outline" size={20} color={PRIMARY} />
              <CountUp value={completed.length} style={styles.statValue} />
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={[styles.statCard, styles.statCardMiddle]}>
              <Ionicons name="cash-outline" size={20} color={GREEN} />
              <CountUp value={totalEarned} prefix="$" decimals={2} style={[styles.statValue, { color: GREEN }]} />
              <Text style={styles.statLabel}>Earned</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time-outline" size={20} color={AMBER} />
              <CountUp value={expired.length} style={[styles.statValue, { color: AMBER }]} />
              <Text style={styles.statLabel}>Expired</Text>
            </View>
          </View>
        </FadeInUp>

        {/* Section label */}
        <FadeInUp delay={160}>
          <Text style={styles.sectionTitle}>
            {loading ? 'LOADING…' : `${filteredJobs.length} · JOB HISTORY`}
          </Text>
        </FadeInUp>

        {error ? (
          <FadeInUp delay={0}>
            <View style={styles.errorCard}>
              <Ionicons name="warning-outline" size={16} color={RED} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </FadeInUp>
        ) : null}

        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filteredJobs.length === 0 ? (
          <FadeInUp delay={200}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="document-text-outline" size={22} color={GRAY} />
              </View>
              <Text style={styles.emptyText}>No visits for this period.</Text>
            </View>
          </FadeInUp>
        ) : (
          filteredJobs.map((job, index) => (
            <FadeInUp key={job.id} delay={200 + index * 50}>
              <JobCard item={job} onPress={(j) => navigation && navigation.navigate('JobDetail', { job: j })} />
            </FadeInUp>
          ))
        )}

        {/* Pending Payout Card — only renders once a real payout endpoint exists */}
        {pending && (
          <FadeInUp delay={200 + filteredJobs.length * 50 + 60}>
            <View style={styles.pendingCard}>
              <View style={styles.pendingTopRow}>
                <View style={styles.pendingIconWrap}>
                  <Ionicons name="wallet-outline" size={16} color={AMBER} />
                </View>
                <Text style={styles.pendingTitle}>Pending Payout</Text>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>Processing</Text>
                </View>
              </View>

              <Text style={styles.pendingAmount}>{pending.amount}</Text>

              <View style={styles.pendingDivider} />

              <View style={styles.pendingDetailsRow}>
                <View style={styles.pendingDetail}>
                  <Ionicons name="calendar-outline" size={13} color="#B45309" />
                  <Text style={styles.pendingDetailText}>{pending.date}</Text>
                </View>
                <View style={styles.pendingDot} />
                <View style={styles.pendingDetail}>
                  <Ionicons name="card-outline" size={13} color="#B45309" />
                  <Text style={styles.pendingDetailText}>{pending.account}</Text>
                </View>
              </View>

              <AnimatedPressable style={styles.pendingBtn} scaleTo={0.96}>
                <Text style={styles.pendingBtnText}>View payout details</Text>
                <Ionicons name="arrow-forward" size={14} color={AMBER} />
              </AnimatedPressable>
            </View>
          </FadeInUp>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation && navigation.navigate('PhlebDashboard')}
        >
          <Ionicons name="home-outline" size={22} color={GRAY} />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="time" size={22} color={PRIMARY} />
          <Text style={[styles.navLabel, styles.navLabelActive]}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation && navigation.navigate('PhlebProfile')}
        >
          <Ionicons name="person-outline" size={22} color={GRAY} />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, backgroundColor: BG,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#111827' },
  filterIconBtn: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },

  pillsRow: { paddingHorizontal: 20, paddingBottom: 4, gap: 8, flexDirection: 'row' },
  pill: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB',
  },
  pillActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  pillText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  pillTextActive: { color: '#FFFFFF', fontWeight: '700' },

  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, marginBottom: 4, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 16,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  statCardMiddle: { borderWidth: 1.5, borderColor: '#D1FAE5' },
  statValue: { fontSize: 20, fontWeight: '800', color: PRIMARY, marginTop: 2 },
  statLabel: { fontSize: 11, color: GRAY, fontWeight: '500' },

  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: GRAY, letterSpacing: 0.8,
    marginTop: 24, marginBottom: 10, marginHorizontal: 20,
  },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', marginHorizontal: 20, marginBottom: 10,
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { color: '#B91C1C', fontSize: 12.5, fontWeight: '500', flex: 1 },

  card: {
    backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, borderRadius: 20,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardExpired: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FEE2E2' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIconWrap: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', marginTop: 1,
  },
  cardName: { fontSize: 15, fontWeight: '700', color: '#111827', lineHeight: 20 },
  cardMeta: { fontSize: 12, color: GRAY, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  chevronBtn: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center',
  },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  testsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, marginRight: 8 },
  cardTests: { fontSize: 12, color: '#6B7280', flex: 1 },
  earnedRow: { alignItems: 'flex-end' },
  earnedLabel: { fontSize: 10, color: GRAY, fontWeight: '500' },
  earnedAmount: { fontSize: 16, fontWeight: '700', color: PRIMARY, marginTop: 1 },

  skelIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB' },
  skelLineWide: { height: 12, borderRadius: 6, backgroundColor: '#E5E7EB', width: '70%' },
  skelLineNarrow: { height: 10, borderRadius: 5, backgroundColor: '#E5E7EB', width: '40%' },
  skelBadge: { width: 64, height: 20, borderRadius: 10, backgroundColor: '#E5E7EB' },

  emptyCard: {
    marginHorizontal: 20, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 22,
    alignItems: 'center', borderWidth: 1, borderColor: BORDER,
  },
  emptyIconWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: '#F3F4F8',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  emptyText: { color: GRAY, fontSize: 13, fontWeight: '500' },

  pendingCard: {
    backgroundColor: '#FFFBEB', borderWidth: 1.5, borderColor: '#FDE68A',
    marginHorizontal: 20, marginTop: 10, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 18,
  },
  pendingTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingIconWrap: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#FEF3C7',
    justifyContent: 'center', alignItems: 'center',
  },
  pendingTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', flex: 1 },
  pendingBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  pendingBadgeText: { fontSize: 10, fontWeight: '700', color: AMBER, letterSpacing: 0.3 },
  pendingAmount: { fontSize: 34, fontWeight: '800', color: '#92400E', marginTop: 12, marginBottom: 14, letterSpacing: -0.5 },
  pendingDivider: { height: 1, backgroundColor: '#FDE68A', marginBottom: 12 },
  pendingDetailsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  pendingDetail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pendingDetailText: { fontSize: 12, color: '#B45309', fontWeight: '500' },
  pendingDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#FCD34D' },
  pendingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#FDE68A',
  },
  pendingBtnText: { fontSize: 13, fontWeight: '700', color: AMBER },

  bottomNav: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB',
    paddingVertical: 10, position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 11, color: GRAY, fontWeight: '500' },
  navLabelActive: { color: PRIMARY, fontWeight: '700' },
});
