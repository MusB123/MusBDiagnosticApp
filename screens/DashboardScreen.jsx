import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { PHLEB_ENDPOINTS } from '../config/api';
import { getActiveSession, authGet, getStoredPhlebUser } from '../utils/auth';

const PRIMARY   = '#18377D';
const PRIMARY_D = '#0F2557';
const PRIMARY_L = '#2C4FA8';
const GREEN     = '#22C55E';
const GREEN_BG  = '#DCFCE7';
const ORANGE    = '#F97316';
const ORANGE_BG = '#FFF7ED';
const RED       = '#EF4444';
const GRAY      = '#9CA3AF';
const BODY_GRAY = '#6B7280';
const BORDER    = '#EEF1F7';
const BG        = '#F6F8FC';

// Max distance (miles) from the office for a request to show on the dashboard.
const NEARBY_RADIUS_MILES = 50;

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
};

// Maps an active job's backend status to a short, human label for the card.
const getActiveJobStatusLabel = (status) => {
  const s = (status || '').toLowerCase();
  if (s === 'arrived') return 'Arrived — verify PIN with patient';
  if (s === 'in_progress' || s === 'collected') return 'Collection in progress';
  return 'Accepted — head to patient';
};

// Same date-matching idea as JobHistoryScreen's withinFilter, but scoped to
// "today" specifically, since that's what this dashboard card shows.
function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/* ────────────────────────────────────────────────────────────
   Shared animation primitives (same pattern as HomeScreen)
──────────────────────────────────────────────────────────── */

function FadeInUp({ delay = 0, distance = 16, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 480,
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

/** Pulsing ring around the power button — draws the eye to "tap to go online". */
function PulseRing() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        {
          opacity: pulse.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.55, 0.15, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
        },
      ]}
    />
  );
}

/** Slow ambient breathing scale for the whole power circle. */
function Breathe({ children }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }] }}>
      {children}
    </Animated.View>
  );
}

/** Small live-status dot with pulsing halo, used on request cards. */
function LiveDot({ color = ORANGE }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={styles.liveDotWrap}>
      <Animated.View
        style={[
          styles.liveDotRing,
          {
            borderColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
          },
        ]}
      />
      <View style={[styles.liveDotCore, { backgroundColor: color }]} />
    </View>
  );
}

/** Counts a number up from 0 to `value` — used for the summary stats. */
function CountUp({ value, prefix = '', style, duration = 700 }) {
  const [display, setDisplay] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v * value)));
    Animated.timing(anim, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value]);

  return <Text style={style}>{prefix}{display}</Text>;
}

/* ────────────────────────────────────────────────────────────
   Main screen
──────────────────────────────────────────────────────────── */

export default function DashboardScreen({ route, navigation }) {
  const [fullName, setFullName] = useState(route.params?.fullName || 'User');

  const initials = fullName
    .split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [jobsDone, setJobsDone] = useState(0);
  const [earnedToday, setEarnedToday] = useState('$0.00');
  // The phlebotomist's current in-progress job (accepted/arrived/collecting),
  // if any — lets them resume the flow from wherever they left it.
  const [activeJob, setActiveJob] = useState(null);
  const tokenRef = useRef(null);
  const pollRef  = useRef(null);
  const phlebIdRef = useRef(null);

  useEffect(() => {
    getActiveSession().then(s => {
      if (s?.token) {
        tokenRef.current = s.token;
        fetchDashboard();
        fetchNearbyRequests();
        fetchTodaysStats();
        pollRef.current = setInterval(() => {
          fetchDashboard();
          fetchNearbyRequests();
          fetchTodaysStats();
        }, 10000); // every 10s
      }
    });

    // Pull the logged-in specialist's real name (from email/password login)
    // so the greeting shows something better than the route param default.
    getStoredPhlebUser().then((user) => {
      const storedName = user?.full_name || user?.fullName || user?.name;
      if (storedName) setFullName(storedName);
      const phlebId = user?.id || user?.user_id;
      if (phlebId) phlebIdRef.current = phlebId;
    });

    return () => clearInterval(pollRef.current);
  }, []);

  // Jobs done + today's earnings, computed the same way JobHistoryScreen does:
  // pull the raw job list from GET /api/phlebotomists/<id>/jobs/
  // (PHLEB_ENDPOINTS.phlebJobs) and sum it client-side. The dashboard metrics
  // endpoint's jobs_done / earnings_today fields aren't reliably populated,
  // so this keeps the numbers here consistent with the History screen.
  const fetchTodaysStats = async () => {
    try {
      let phlebId = phlebIdRef.current;
      if (!phlebId) {
        const user = await getStoredPhlebUser();
        phlebId = user?.id || user?.user_id;
        if (phlebId) phlebIdRef.current = phlebId;
      }
      if (!phlebId) return;

      const data = await authGet(PHLEB_ENDPOINTS.phlebJobs(phlebId));
      const list = data?.jobs || data || [];

      const completedToday = list.filter((j) => {
        const status = j.status || 'completed';
        const dateStr = j.date_iso || j.created_at || j.date;
        return status === 'completed' && isToday(dateStr);
      });

      const total = completedToday.reduce(
        (sum, j) => sum + (Number(j.earning ?? j.earned ?? j.amount_earned) || 0),
        0
      );

      setJobsDone(completedToday.length);
      setEarnedToday(`$${total.toFixed(2)}`);
    } catch {
      // fail silently, keep last known data
    }
  };

  // Dashboard metrics endpoint — still used for the active job card and as
  // a fallback name source. jobs_done / earnings_today from here are
  // intentionally NOT used anymore (see fetchTodaysStats above).
  const fetchDashboard = async () => {
    try {
      const data = await authGet(PHLEB_ENDPOINTS.dashboard);
      // Dashboard also carries the specialist's name — prefer it if present.
      const nameFromDashboard = data.full_name || data.fullName || data.name;
      if (nameFromDashboard) setFullName(nameFromDashboard);

      const activeCase = data?.active_case;
      if (activeCase && activeCase.id) {
        setActiveJob(activeCase);
      } else {
        setActiveJob(null);
      }
    } catch {
      // fail silently, keep last known data
    }
  };

  // Requests within NEARBY_RADIUS_MILES of the office, same source MapScreen uses.
  const fetchNearbyRequests = async () => {
    try {
      const data = await authGet(PHLEB_ENDPOINTS.dispatch.officeNearbyRequests);
      const withinRadius = (data.requests || []).filter(
        (r) => r.distance_miles == null || r.distance_miles <= NEARBY_RADIUS_MILES
      );
      setRequests(withinRadius);
    } catch {
      // fail silently, keep last known data
    } finally {
      setLoading(false);
    }
  };

  const handleGoOnline = () => navigation.navigate('PatientMap', { fullName });
  const handleHistory  = () => navigation.navigate('PhlebHistory', { fullName });
  const handleProfile  = () => navigation.navigate('PhlebProfile',    { fullName });

  // Resume the active job at the right screen for its current status:
  //   assigned              -> JobAccepted (patient details, navigate, "I've arrived")
  //   arrived / collected /
  //   in_progress           -> VerifyArrival (enter the PIN / continue collection)
  const handleResumeActiveJob = () => {
    if (!activeJob) return;
    const status = (activeJob.status || '').toLowerCase();
    if (status === 'arrived' || status === 'collected' || status === 'in_progress') {
      navigation.navigate('VerifyArrival', { job: activeJob });
    } else {
      navigation.navigate('JobAccepted', { job: activeJob });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ── Header ── */}
        <FadeInUp delay={0} distance={-10} style={styles.header}>
          <AnimatedPressable style={styles.avatar} onPress={handleProfile} scaleTo={0.9}>
            <Text style={styles.avatarText}>{initials}</Text>
          </AnimatedPressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.name}>{fullName}</Text>
          </View>
        </FadeInUp>

        {/* ── Active Job Card (resume in-progress job) ── */}
        {activeJob && (
          <FadeInUp delay={40}>
            <AnimatedPressable
              style={styles.activeJobCardTouchable}
              scaleTo={0.97}
              onPress={handleResumeActiveJob}
            >
              <View style={styles.activeJobCard}>
                <View style={styles.activeJobIconWrap}>
                  <Ionicons name="briefcase" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.activeJobTitleRow}>
                    <Text style={styles.activeJobTitle}>Active job in progress</Text>
                    <LiveDot color={GREEN} />
                  </View>
                  <Text style={styles.activeJobPatient} numberOfLines={1}>
                    {activeJob.patient_name || activeJob.full_name || 'Patient'}
                  </Text>
                  <Text style={styles.activeJobSub} numberOfLines={1}>
                    {getActiveJobStatusLabel(activeJob.status)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </View>
            </AnimatedPressable>
          </FadeInUp>
        )}

        {/* ── Go Online Card ── */}
        <FadeInUp delay={90}>
          <AnimatedPressable style={styles.onlineCardTouchable} activeOpacity={0.92} onPress={handleGoOnline} scaleTo={0.98}>
            <View style={styles.onlineCard}>
              <View style={styles.onlineGlowTop} />
              <View style={styles.onlineGlowBottom} />

              <View style={styles.powerCircleWrap}>
                <PulseRing />
                <Breathe>
                  <View style={styles.powerCircle}>
                    <Feather name="power" size={36} color="#FFFFFF" />
                  </View>
                </Breathe>
              </View>

              <Text style={styles.onlineTitle}>Tap to go online</Text>
              <Text style={styles.onlineSub}>Your location will be shared with patients nearby</Text>

              <View style={styles.onlineCta}>
                <Text style={styles.onlineCtaText}>Go online</Text>
                <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
              </View>
            </View>
          </AnimatedPressable>
        </FadeInUp>

        {/* ── Nearby Requests Section (within 50 miles of office) ── */}
        <FadeInUp delay={160}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>NEARBY REQUESTS</Text>
            {requests.length > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{requests.length}</Text>
              </View>
            )}
          </View>
        </FadeInUp>

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginVertical: 24 }} />
        ) : requests.length === 0 ? (
          <FadeInUp delay={210}>
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="radio-outline" size={22} color={GRAY} />
              </View>
              <Text style={styles.emptyText}>No requests within {NEARBY_RADIUS_MILES} miles right now.</Text>
            </View>
          </FadeInUp>
        ) : (
          requests.map((req, index) => (
            <FadeInUp key={req.id} delay={210 + index * 60}>
              <AnimatedPressable
                style={styles.requestItemCard}
                scaleTo={0.97}
                onPress={handleGoOnline}
              >
                <View style={styles.requestItemIcon}>
                  <Ionicons name="medkit-outline" size={20} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestItemTitle}>{req.test_name || req.testName || 'Clinical Test'}</Text>
                  <Text style={styles.requestItemSub}>
                    {req.address || 'Address unknown'}
                    {req.distance_miles != null ? ` · ${req.distance_miles} mi` : ''}
                    {req.preferred_time ? ` · ${req.preferred_time}` : ''}
                  </Text>
                </View>
                <LiveDot color={ORANGE} />
              </AnimatedPressable>
            </FadeInUp>
          ))
        )}

        {/* ── Today's Summary (compact, two stats side by side) ── */}
        <FadeInUp delay={280}>
          <Text style={styles.sectionTitle}>TODAY'S SUMMARY</Text>
        </FadeInUp>

        <FadeInUp delay={320}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIconWrap, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="checkmark-done" size={16} color={PRIMARY} />
              </View>
              <Text style={styles.summaryLabel}>Jobs done</Text>
              <CountUp value={jobsDone} style={styles.summaryValue} />
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.summaryIconWrap, { backgroundColor: GREEN_BG }]}>
                <Ionicons name="cash-outline" size={16} color={GREEN} />
              </View>
              <Text style={styles.summaryLabel}>Today's earning</Text>
              <Text style={[styles.summaryValue, { color: GREEN }]}>{earnedToday}</Text>
            </View>
          </View>
        </FadeInUp>

        {/* ── Info Card ── */}
        <FadeInUp delay={380}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color={ORANGE} style={{ marginRight: 8 }} />
            <Text style={styles.infoText}>Go online to start accepting requests from patients nearby.</Text>
          </View>
        </FadeInUp>
      </ScrollView>

      {/* ── Bottom Navigation ── */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={22} color={PRIMARY} />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={handleHistory}>
          <Ionicons name="time-outline" size={22} color={GRAY} />
          <Text style={styles.navLabel}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={handleProfile}>
          <Ionicons name="person-outline" size={22} color={GRAY} />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  avatar: {
    width: 52, height: 52, borderRadius: 18, backgroundColor: '#E8ECF7',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
    borderWidth: 1.5, borderColor: '#D6DEF2',
  },
  avatarText: { color: PRIMARY, fontSize: 17, fontWeight: '800' },
  greeting: { fontSize: 13, color: BODY_GRAY, fontWeight: '500' },
  name: { fontSize: 19, fontWeight: '800', color: '#111827', marginTop: 2 },

  // ── Active Job card ──
  activeJobCardTouchable: { marginHorizontal: 20, marginBottom: 16 },
  activeJobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_D,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    shadowColor: PRIMARY_D,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  activeJobIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  activeJobTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeJobTitle: { fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.3 },
  activeJobPatient: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginTop: 3 },
  activeJobSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.82)', marginTop: 2 },

  // ── Go Online card ──
  onlineCardTouchable: { marginHorizontal: 20 },
  onlineCard: {
    backgroundColor: PRIMARY,
    borderRadius: 26,
    paddingVertical: 34,
    paddingHorizontal: 24,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  onlineGlowTop: {
    position: 'absolute', top: -60, right: -40, width: 160, height: 160, borderRadius: 80,
    backgroundColor: PRIMARY_L, opacity: 0.35,
  },
  onlineGlowBottom: {
    position: 'absolute', bottom: -70, left: -50, width: 180, height: 180, borderRadius: 90,
    backgroundColor: PRIMARY_D, opacity: 0.4,
  },
  powerCircleWrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  pulseRing: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  powerCircle: {
    width: 92, height: 92, borderRadius: 46,
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center', alignItems: 'center',
  },
  onlineTitle: { marginTop: 18, fontSize: 21, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  onlineSub: { marginTop: 8, textAlign: 'center', color: 'rgba(255,255,255,0.82)', lineHeight: 20, fontSize: 13, paddingHorizontal: 8 },
  onlineCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10, marginTop: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  onlineCtaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 28, marginHorizontal: 20, marginBottom: 12,
  },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: BODY_GRAY, letterSpacing: 0.8, marginTop: 28, marginHorizontal: 20, marginBottom: 12 },
  countPill: { backgroundColor: ORANGE_BG, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  countPillText: { color: ORANGE, fontWeight: '800', fontSize: 12 },

  emptyCard: {
    marginHorizontal: 20, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 22,
    alignItems: 'center', borderWidth: 1, borderColor: BORDER,
  },
  emptyIconWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: '#F3F4F8',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  emptyText: { color: GRAY, fontSize: 13, fontWeight: '500' },

  requestItemCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16,
    marginHorizontal: 20, marginBottom: 10, padding: 14,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  requestItemIcon: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: ORANGE_BG,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  requestItemTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  requestItemSub: { fontSize: 12.5, color: BODY_GRAY, marginTop: 2 },

  liveDotWrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  liveDotRing: { position: 'absolute', width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  liveDotCore: { width: 8, height: 8, borderRadius: 4 },

  // ── Compact side-by-side summary cards ──
  summaryRow: {
    flexDirection: 'row', marginHorizontal: 20, gap: 10,
  },
  summaryCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14,
    alignItems: 'flex-start', borderWidth: 1, borderColor: BORDER,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  summaryIconWrap: {
    width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  summaryLabel: { fontSize: 11.5, color: BODY_GRAY, fontWeight: '500' },
  summaryValue: { marginTop: 4, fontSize: 20, fontWeight: '800', color: PRIMARY },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: ORANGE_BG, marginHorizontal: 20, marginTop: 20, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 18, borderWidth: 1, borderColor: '#FDE1B8',
  },
  infoText: { flex: 1, color: '#92400E', lineHeight: 20, fontSize: 13.5, fontWeight: '500' },

  bottomNav: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB',
    paddingVertical: 10, position: 'absolute', left: 0, right: 0, bottom: 0,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 11, color: GRAY, fontWeight: '500' },
  navLabelActive: { color: PRIMARY, fontWeight: '700' },
});