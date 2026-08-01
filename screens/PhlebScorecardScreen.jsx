import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Animated, Easing,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PHLEB_ENDPOINTS } from '../config/api';
import { authGet } from '../utils/auth';

const PRIMARY   = '#18377D';
const PRIMARY_D = '#0F2557';
const GREEN     = '#1B7A4D';
const GREEN_BG  = '#DCFCE7';
const ORANGE    = '#D97706';
const ORANGE_BG = '#FFF7ED';
const RED       = '#DC2626';
const RED_BG    = '#FEF2F2';
const GRAY      = '#9CA3AF';
const BODY_GRAY = '#6B7280';
const BORDER    = '#EEF1F7';
const BG        = '#F6F8FC';
const SKELETON_BASE = '#E7EBF3';
const SKELETON_HI   = '#F4F6FB';

const CATEGORY_LABELS = {
  technical: 'Technical execution',
  safety: 'Safety & hygiene',
  comfort: 'Comfort & bedside manner',
  communication: 'Communication & consent',
  punctuality: 'Punctuality',
  professionalism: 'Professionalism & identity',
  respect: 'Respect for home & privacy',
};

const CATEGORY_ORDER = ['technical', 'safety', 'comfort', 'communication', 'punctuality', 'professionalism', 'respect'];

const METRIC_LABELS = {
  first_stick_success: 'First-stick success',
  sample_rejection_rate: 'Sample rejection rate',
  on_time_dropoff: 'On-time drop-off',      
};

// Lower-is-better metrics — status thresholds are inverted for these.
const LOWER_IS_BETTER = new Set(['sample_rejection_rate', 'late_arrivals']);

function getCategoryColor(score) {
  const n = Number(score);
  if (isNaN(n)) return GRAY;
  if (n >= 4.5) return GREEN;
  if (n >= 4.0) return ORANGE;
  return RED;
}

function parsePercent(value) {
  const n = parseFloat(String(value).replace('%', ''));
  return isNaN(n) ? null : n;
}

function getMetricStatus(key, rawValue) {
  const n = parsePercent(rawValue);
  if (n === null) return { color: GRAY, label: '—' };
  const lowerBetter = LOWER_IS_BETTER.has(key);
  const good = lowerBetter ? n <= 3 : n >= 90;
  return good
    ? { color: GREEN, label: 'On target' }
    : { color: ORANGE, label: 'Watch' };
}

function FadeInUp({ delay = 0, distance = 14, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 440, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[style, {
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/** Animated horizontal bar for category scores. */
function ScoreBar({ score, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;
  const pct = Math.max(0, Math.min(1, Number(score) / 5));
  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct, duration: 900, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [score]);
  return (
    <View style={styles.barTrack}>
      <Animated.View
        style={[
          styles.barFill,
          {
            backgroundColor: getCategoryColor(score),
            width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

/** Animated bar for the rating distribution (5★ … 1★). */
function DistributionBar({ count, max, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;
  const pct = max > 0 ? count / max : 0;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct, duration: 800, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [count, max]);
  return (
    <View style={styles.distTrack}>
      <Animated.View
        style={[
          styles.distFill,
          { width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

/**
 * Base shimmering block. Pulses opacity on a loop via useNativeDriver so it's
 * cheap to run several of these at once on the loading screen.
 */
function Skeleton({ width, height, borderRadius = 8, style }) {
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1, duration: 700,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.4, duration: 700,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width, height, borderRadius,
          backgroundColor: SKELETON_BASE,
          opacity: anim,
        },
        style,
      ]}
    />
  );
}

/** Full-screen skeleton mirroring the loaded scorecard layout. */
function ScorecardSkeleton() {
  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      {/* Header */}
      <View style={styles.backBtn}>
        <Ionicons name="arrow-back" size={20} color={BORDER} />
      </View>
      <Skeleton width={160} height={22} borderRadius={6} style={{ marginBottom: 16 }} />

      {/* Note banner */}
      <View style={[styles.noteBanner, { backgroundColor: '#F4F6FB', borderColor: BORDER }]}>
        <Skeleton width={16} height={16} borderRadius={8} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="100%" height={11} />
          <Skeleton width="70%" height={11} />
        </View>
      </View>

      {/* Stat cards */}
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Skeleton width={90} height={10} style={{ marginBottom: 10 }} />
          <Skeleton width={70} height={24} style={{ marginBottom: 8 }} />
          <Skeleton width={60} height={11} />
        </View>
        <View style={styles.statCard}>
          <Skeleton width={80} height={10} style={{ marginBottom: 10 }} />
          <Skeleton width={70} height={24} style={{ marginBottom: 8 }} />
          <Skeleton width={90} height={11} />
        </View>
      </View>

      {/* Trend card */}
      <View style={styles.trendCard}>
        <Skeleton width={20} height={20} borderRadius={10} />
        <View style={{ flex: 1, marginLeft: 10, gap: 6 }}>
          <Skeleton width={120} height={10} />
          <Skeleton width={60} height={16} />
          <Skeleton width={140} height={11} />
        </View>
      </View>

      {/* Category scores */}
      <View style={styles.sectionHeaderRow}>
        <Skeleton width={15} height={15} borderRadius={4} />
        <Skeleton width={150} height={13} />
      </View>
      <View style={styles.card}>
        {CATEGORY_ORDER.map((key, idx, arr) => (
          <View key={key} style={[styles.categoryRow, idx === arr.length - 1 && { marginBottom: 0 }]}>
            <View style={styles.categoryTopRow}>
              <Skeleton width={140} height={12} />
              <Skeleton width={24} height={12} />
            </View>
            <Skeleton width="100%" height={8} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Quality metrics */}
      <View style={styles.sectionHeaderRow}>
        <Skeleton width={15} height={15} borderRadius={4} />
        <Skeleton width={110} height={13} />
      </View>
      <View style={styles.metricsGrid}>
        {Object.keys(METRIC_LABELS).map((key) => (
          <View key={key} style={styles.metricCard}>
            <Skeleton width={90} height={10} style={{ marginBottom: 8 }} />
            <Skeleton width={50} height={20} style={{ marginBottom: 8 }} />
            <Skeleton width={70} height={10} />
          </View>
        ))}
      </View>

      {/* Rating distribution */}
      <View style={styles.sectionHeaderRow}>
        <Skeleton width={15} height={15} borderRadius={4} />
        <Skeleton width={140} height={13} />
      </View>
      <View style={styles.card}>
        {[5, 4, 3, 2, 1].map((star) => (
          <View key={star} style={styles.distRow}>
            <Skeleton width={28} height={12} />
            <Skeleton width="100%" height={8} borderRadius={4} style={{ flex: 1 }} />
            <Skeleton width={18} height={12} />
          </View>
        ))}
      </View>

      {/* Coaching focus */}
      <View style={styles.sectionHeaderRow}>
        <Skeleton width={15} height={15} borderRadius={4} />
        <Skeleton width={180} height={13} />
      </View>
      <View style={styles.card}>
        <Skeleton width="100%" height={12} style={{ marginBottom: 8 }} />
        <Skeleton width="90%" height={12} style={{ marginBottom: 8 }} />
        <Skeleton width="60%" height={12} />
      </View>
    </ScrollView>
  );
}

export default function PhlebScorecardScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchScorecard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await authGet(PHLEB_ENDPOINTS.scorecard);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err?.data?.error || 'Could not load your scorecard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchScorecard(); }, [fetchScorecard]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScorecardSkeleton />
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerFill}>
          <Ionicons name="alert-circle-outline" size={36} color={GRAY} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchScorecard()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const composite = Number(data?.composite_score ?? 0);
  const isReward = (data?.reward_tier || '').toLowerCase().includes('reward');
  const trendStr = data?.trend || '0';
  const trendVal = parseFloat(trendStr);
  const trendUp = trendVal >= 0;
  const previousScore = !isNaN(trendVal) ? (composite - trendVal).toFixed(2) : null;

  const categoryScores = data?.category_scores || {};
  const qualityMetrics = data?.quality_metrics || {};
  const distribution = data?.rating_distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const maxDistCount = Math.max(1, ...Object.values(distribution).map(Number));

  // Fall back to an auto-generated coaching sentence if the backend hasn't
  // set one — derived purely from the phlebotomist's own category scores.
  let coachingText = data?.coaching_focus;
  if (!coachingText) {
    const entries = CATEGORY_ORDER
      .filter((k) => categoryScores[k] != null)
      .map((k) => ({ key: k, label: CATEGORY_LABELS[k], score: Number(categoryScores[k]) }));
    if (entries.length) {
      const strongest = entries.reduce((a, b) => (b.score > a.score ? b : a));
      const weakest = entries.reduce((a, b) => (b.score < a.score ? b : a));
      if (weakest.score < 4.0) {
        coachingText = `Your strongest area is ${strongest.label} (${strongest.score.toFixed(1)}). The one area below target is ${weakest.label} (${weakest.score.toFixed(1)}). Small, consistent improvements here will have the biggest impact on your composite score.`;
      } else {
        coachingText = `Great work overall — your strongest area is ${strongest.label} (${strongest.score.toFixed(1)}). Keep an eye on ${weakest.label} (${weakest.score.toFixed(1)}) to stay consistent across the board.`;
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchScorecard(true)} tintColor={PRIMARY} />
        }
      >
        {/* Header */}
        <FadeInUp delay={0}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={20} color={PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Your scorecard</Text>
        </FadeInUp>

        {/* Privacy note banner */}
        <FadeInUp delay={40}>
          <View style={styles.noteBanner}>
            <Ionicons name="shield-checkmark" size={16} color={PRIMARY} style={{ marginTop: 1 }} />
            <Text style={styles.noteText}>
              <Text style={{ fontWeight: '800' }}>Your view. </Text>
              These are your aggregate numbers only — no patient names, no individual reviews, no written comments. Just where you stand and where to improve.
            </Text>
          </View>
        </FadeInUp>

        {/* Top stat cards */}
        <FadeInUp delay={90}>
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>COMPOSITE SCORE</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.statValueBig}>{composite.toFixed(2)}</Text>
                <Text style={styles.statValueOutOf}>/5.00</Text>
              </View>
              {isReward && (
                <View style={styles.rewardPill}>
                  <View style={styles.rewardDot} />
                  <Text style={styles.rewardPillText}>Reward tier</Text>
                </View>
              )}
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>DRAWS RATED</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.statValueBig}>{data?.draws_rated ?? 0}</Text>
                <Text style={styles.statValueOutOf}> of {data?.total_draws ?? 0}</Text>
              </View>
              <Text style={styles.statSubtext}>{data?.response_rate || '—'} response rate</Text>
            </View>
          </View>
        </FadeInUp>

        <FadeInUp delay={120}>
          <View style={styles.trendCard}>
            <Ionicons
              name={trendUp ? 'trending-up' : 'trending-down'}
              size={20}
              color={trendUp ? GREEN : RED}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.statLabel}>TREND VS LAST WINDOW</Text>
              <Text style={[styles.trendValue, { color: trendUp ? GREEN : RED }]}>
                {trendUp ? '▲' : '▼'} {Math.abs(trendVal || 0).toFixed(2)}
              </Text>
              <Text style={styles.statSubtext}>
                {trendUp ? 'Improving' : 'Declining'}
                {previousScore ? ` — up from ${previousScore}` : ''}
              </Text>
            </View>
          </View>
        </FadeInUp>

        {/* Category scores */}
        <FadeInUp delay={170}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="star" size={15} color={PRIMARY} />
            <Text style={styles.sectionTitle}>Your category scores</Text>
          </View>
          <View style={styles.card}>
            {CATEGORY_ORDER.filter((k) => categoryScores[k] != null).map((key, idx, arr) => {
              const score = Number(categoryScores[key]);
              return (
                <View key={key} style={[styles.categoryRow, idx === arr.length - 1 && { marginBottom: 0 }]}>
                  <View style={styles.categoryTopRow}>
                    <Text style={styles.categoryLabel}>{CATEGORY_LABELS[key] || key}</Text>
                    <Text style={[styles.categoryScore, { color: getCategoryColor(score) }]}>
                      {score.toFixed(1)}
                    </Text>
                  </View>
                  <ScoreBar score={score} delay={200 + idx * 60} />
                </View>
              );
            })}
          </View>
        </FadeInUp>

        {/* Quality metrics */}
        <FadeInUp delay={230}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="analytics-outline" size={15} color={PRIMARY} />
            <Text style={styles.sectionTitle}>Quality metrics</Text>
            <Text style={styles.sectionSubtitle}>from the lab</Text>
          </View>
          <View style={styles.metricsGrid}>
            {Object.keys(METRIC_LABELS).map((key) => {
              const rawValue = qualityMetrics[key] ?? 'N/A';
              const status = getMetricStatus(key, rawValue);
              return (
                <View key={key} style={styles.metricCard}>
                  <Text style={styles.metricLabel}>{METRIC_LABELS[key]}</Text>
                  <Text style={styles.metricValue}>{rawValue}</Text>
                  <View style={styles.metricStatusRow}>
                    <View style={[styles.metricDot, { backgroundColor: status.color }]} />
                    <Text style={[styles.metricStatusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </FadeInUp>

        {/* Rating distribution */}
        <FadeInUp delay={280}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="bar-chart-outline" size={15} color={PRIMARY} />
            <Text style={styles.sectionTitle}>Rating distribution</Text>
          </View>
          <View style={styles.card}>
            {[5, 4, 3, 2, 1].map((star, idx) => {
              const count = Number(distribution[star] || 0);
              return (
                <View key={star} style={styles.distRow}>
                  <Text style={styles.distStarLabel}>{star} ★</Text>
                  <DistributionBar count={count} max={maxDistCount} delay={300 + idx * 60} />
                  <Text style={styles.distCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </FadeInUp>

        {/* Coaching focus */}
        {!!coachingText && (
          <FadeInUp delay={330}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="trending-up-outline" size={15} color={PRIMARY} />
              <Text style={styles.sectionTitle}>Coaching focus this window</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.coachingText}>{coachingText}</Text>
            </View>
          </FadeInUp>
        )}

        {/* Privacy footer */}
        <FadeInUp delay={380}>
          <View style={styles.privacyFooter}>
            <Ionicons name="lock-closed" size={15} color={GREEN} style={{ marginTop: 1 }} />
            <Text style={styles.privacyFooterText}>
              <Text style={{ fontWeight: '800' }}>What you can't see here, by design. </Text>
              Patient names, individual ratings, written comments, and any personal information are never shown to you. You only see your aggregate scores and where to improve. Safety or conduct concerns are handled privately by a supervisor.
            </Text>
          </View>
        </FadeInUp>
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

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation && navigation.navigate('PhlebHistory')}
        >
          <Ionicons name="time-outline" size={22} color={GRAY} />
          <Text style={styles.navLabel}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="star" size={22} color={PRIMARY} />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Ratings</Text>
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
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 30 },
  errorText: { color: BODY_GRAY, fontSize: 14, textAlign: 'center' },
  retryBtn: { backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 6 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },

  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  screenTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 16 },

  noteBanner: {
    flexDirection: 'row', gap: 10, backgroundColor: '#EEF2FF',
    borderRadius: 14, padding: 14, marginBottom: 18,
    borderWidth: 1, borderColor: '#DCE3FA',
  },
  noteText: { flex: 1, fontSize: 12.5, color: '#334155', lineHeight: 18 },

  statRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#0F2557', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  statLabel: { fontSize: 10.5, fontWeight: '800', color: BODY_GRAY, letterSpacing: 0.5 },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  statValueBig: { fontSize: 26, fontWeight: '800', color: PRIMARY_D },
  statValueOutOf: { fontSize: 13, color: GRAY, marginLeft: 3, marginBottom: 3 },
  statSubtext: { fontSize: 11.5, color: BODY_GRAY, marginTop: 4 },

  rewardPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: GREEN_BG, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  rewardDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  rewardPillText: { fontSize: 11, fontWeight: '700', color: GREEN },

  trendCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 14, marginBottom: 22,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#0F2557', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  trendValue: { fontSize: 18, fontWeight: '800', marginTop: 3 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#111827', flex: 1 },
  sectionSubtitle: { fontSize: 11, color: GRAY },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 22,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#0F2557', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },

  categoryRow: { marginBottom: 16 },
  categoryTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  categoryLabel: { fontSize: 13.5, fontWeight: '700', color: '#111827' },
  categoryScore: { fontSize: 13.5, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#EEF1F7', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  metricCard: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 13,
    borderWidth: 1, borderColor: BORDER,
  },
  metricLabel: { fontSize: 11.5, color: BODY_GRAY, fontWeight: '600' },
  metricValue: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 4 },
  metricStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  metricDot: { width: 6, height: 6, borderRadius: 3 },
  metricStatusText: { fontSize: 11, fontWeight: '700' },

  distRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  distStarLabel: { width: 34, fontSize: 12.5, fontWeight: '700', color: '#111827' },
  distTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#EEF1F7', overflow: 'hidden' },
  distFill: { height: '100%', borderRadius: 4, backgroundColor: '#F5B041' },
  distCount: { width: 24, textAlign: 'right', fontSize: 12, fontWeight: '700', color: BODY_GRAY },

  coachingText: { fontSize: 13.5, color: '#334155', lineHeight: 21 },

  privacyFooter: {
    flexDirection: 'row', gap: 10, backgroundColor: GREEN_BG,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#BBF7D0',
  },
  privacyFooterText: { flex: 1, fontSize: 12, color: '#166534', lineHeight: 18 },
  bottomNav: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB',
    paddingVertical: 10, position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 11, color: GRAY, fontWeight: '500' },
  navLabelActive: { color: PRIMARY, fontWeight: '700' },
});
