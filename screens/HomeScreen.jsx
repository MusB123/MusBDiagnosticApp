import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  TextInput,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AddressBar from '../components/AddressBar';
import { setBookingDraft } from '../utils/bookingDraft';
import { fetchPatientDashboard, getStoredPatientUser, rateAppointment } from '../utils/auth';

const COLORS = {
  navy: '#1B3A8C',
  navyDark: '#0D1F3C',
  navyLight: '#2C4FA8',
  white: '#FFFFFF',
  offWhite: '#F4F7FB',
  lightGray: '#E8EEF5',
  gray: '#8A9BB0',
  bodyText: '#4A5568',
  border: '#D1DBE8',
  green: '#22C55E',
  greenLight: '#DCFCE7',
  orange: '#F59E0B',
  orangeLight: '#FEF3C7',
  purple: '#7C3AED',
  purpleLight: '#EDE9FE',
  star: '#FBBF24',
  unreadDot: '#EF4444',
};

const SERVICES = [
  {
    id: '1',
    icon: '🏠',
    accent: COLORS.purple,
    iconBg: COLORS.purpleLight,
    title: 'Mobile phlebotomy',
    subtitle: 'We come to you.',
    badge: 'Popular',
    selected: true,
  },
  {
    id: '3',
    icon: '🏥',
    accent: COLORS.orange,
    iconBg: COLORS.orangeLight,
    title: 'In-center visit',
    subtitle: 'Visit a lab near you',
    badge: null,
    selected: false,
  },
];

// Statuses that are actively "in motion" get a live pulsing dot on the appointment card
const LIVE_STATUSES = ['assigned', 'in_progress', 'enroute', 'arrived', 'collected'];

const STATUS_COLORS = {
  assigned: COLORS.orange,
  in_progress: COLORS.orange,
  enroute: COLORS.orange,
  arrived: COLORS.orange,
  collected: COLORS.green,
  completed: COLORS.green,
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
};

function BellIcon({ hasUnread }) {
  return (
    <View style={bellStyles.wrap}>
      <View style={bellStyles.knob} />
      <View style={bellStyles.dome} />
      <View style={bellStyles.base} />
      <View style={bellStyles.clapper} />
      {hasUnread && <View style={bellStyles.badge} />}
    </View>
  );
}

const bellStyles = StyleSheet.create({
  wrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  knob: { position: 'absolute', top: 0, width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.white },
  dome: {
    position: 'absolute', top: 3, width: 16, height: 13,
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
    borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
    backgroundColor: COLORS.white,
  },
  base: { position: 'absolute', top: 15, width: 20, height: 3, borderRadius: 1.5, backgroundColor: COLORS.white },
  clapper: { position: 'absolute', bottom: 0, width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.white },
  badge: {
    position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.unreadDot, borderWidth: 1.5, borderColor: COLORS.navy,
  },
});

/** Wraps a TouchableOpacity with a springy press-scale animation. */
function AnimatedPressable({ style, onPress, children, scaleTo = 0.96, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
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
        style={style}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Fades + slides a section up into place. */
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
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Icon that pops in with a little overshoot — used inside service card icon circles. */
function IconPop({ delay = 0, children }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale: anim }] }}>
      {children}
    </Animated.View>
  );
}

/** Small pulsing dot to show a "live" appointment status. */
function PulseDot({ color }) {
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
    <View style={styles.pulseDotWrap}>
      <Animated.View
        style={[
          styles.pulseDotRing,
          {
            borderColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
          },
        ]}
      />
      <View style={[styles.pulseDotCore, { backgroundColor: color }]} />
    </View>
  );
}

/** Badge (e.g. "Popular") that gently breathes to draw the eye. */
function BreathingBadge({ children, style, textStyle }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        { transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] },
      ]}
    >
      <Text style={textStyle}>{children}</Text>
    </Animated.View>
  );
}

export default function HomeScreen({ navigation, route }) {
  const [locationData, setLocationData] = useState({
    address: '',
    latitude: null,
    longitude: null,
    useGps: false,
  });
  const [firstName, setFirstName] = useState(route?.params?.firstName || 'there');
  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [hasUnreadNotifs] = useState(true);

  // ── Rating modal state ─────────────────────────────────────────────────
  const [ratingAppt, setRatingAppt] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const modalAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (ratingAppt) {
      modalAnim.setValue(0);
      Animated.spring(modalAnim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }).start();
    }
  }, [ratingAppt]);

  const initials = firstName.slice(0, 2).toUpperCase();

  const loadDashboardData = async (isMountedRef) => {
    try {
      const storedUser = await getStoredPatientUser();
      if (isMountedRef.current && storedUser?.name) {
        setFirstName(storedUser.name.split(' ')[0]);
      }
      const data = await fetchPatientDashboard();
      if (isMountedRef.current) setDashboard(data);
    } catch (err) {
      if (isMountedRef.current) {
        setDashboardError(
          err.message === 'NETWORK_ERROR'
            ? "Can't reach the server."
            : err.message === 'NOT_LOGGED_IN'
            ? 'Please log in again.'
            : err.message
        );
      }
    } finally {
      if (isMountedRef.current) setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    const isMountedRef = { current: true };
    loadDashboardData(isMountedRef);
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Contact handlers ───────────────────────────────────────────────────
  const handleCallPhleb = (phone) => {
    if (!phone) {
      Alert.alert('No phone number', 'This specialist has no phone number on file.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleMessagePhleb = (phone) => {
    if (!phone) {
      Alert.alert('No phone number', 'This specialist has no phone number on file.');
      return;
    }
    Linking.openURL(`sms:${phone}`);
  };

  // ── Rating handlers ────────────────────────────────────────────────────
  const handleSubmitRating = async () => {
    if (!ratingAppt) return;
    setSubmittingRating(true);
    try {
      await rateAppointment(ratingAppt.id, ratingValue, ratingComment);
      Alert.alert('Thank you!', 'Your rating has been submitted.');
      setRatingAppt(null);
      setRatingComment('');
      setRatingValue(5);
      const data = await fetchPatientDashboard();
      setDashboard(data);
    } catch (err) {
      Alert.alert('Could not submit rating', err.message || 'Please try again.');
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Curved Navy Header ── */}
        <FadeInUp delay={0} distance={-14} style={styles.headerCurve}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>{firstName}</Text>
            </View>
            <View style={styles.topBarRight}>
              <AnimatedPressable
                style={styles.bellBtn}
                onPress={() => navigation.navigate('PatientNotifications')}
                scaleTo={0.88}
              >
                <BellIcon hasUnread={hasUnreadNotifs} />
              </AnimatedPressable>

              <AnimatedPressable
                style={styles.avatar}
                onPress={() => navigation.navigate('PatientProfile')}
                scaleTo={0.88}
              >
                <Text style={styles.avatarText}>{initials}</Text>
              </AnimatedPressable>
            </View>
          </View>
        </FadeInUp>

        {/* ── Location Bar ── */}
        <FadeInUp delay={90} style={styles.locationBarWrap}>
          <View style={styles.locationCard}>
            <AddressBar
              value={locationData.address}
              onChange={setLocationData}
            />
          </View>
        </FadeInUp>

        {/* ── What do you need ── */}
        <FadeInUp delay={160}>
          <Text style={styles.sectionTitle}>What do you need today?</Text>
        </FadeInUp>

        {SERVICES.map((service, index) => (
          <FadeInUp key={service.id} delay={200 + index * 80}>
            <AnimatedPressable
              style={[styles.serviceCard, service.selected && styles.serviceCardSelected]}
              scaleTo={0.97}
              onPress={() => {
                if (service.id === '1') {
                  setBookingDraft(locationData);
                  navigation.push('BookMobileVisit');
                } else if (service.id === '2') {
                  navigation.push('SelectTests');
                } else {
                  navigation.push('InPersonTests');
                }
              }}
            >
              <View style={[styles.serviceAccentBar, { backgroundColor: service.accent }]} />

              <View style={[styles.serviceIconRing, { borderColor: service.iconBg }]}>
                <View style={[styles.serviceIconWrap, { backgroundColor: service.iconBg }]}>
                  <IconPop delay={280 + index * 80}>
                    <Text style={styles.serviceIcon}>{service.icon}</Text>
                  </IconPop>
                </View>
              </View>

              <View style={styles.serviceText}>
                <Text style={[styles.serviceTitle, service.selected && styles.serviceTitleSelected]}>
                  {service.title}
                </Text>
                <Text style={styles.serviceSubtitle}>{service.subtitle}</Text>
              </View>

              {service.badge && (
                <BreathingBadge style={styles.badge} textStyle={styles.badgeText}>
                  {service.badge}
                </BreathingBadge>
              )}

              <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
            </AnimatedPressable>
          </FadeInUp>
        ))}

        {/* ── Upcoming Appointments ── */}
        {loadingDashboard ? (
          <View style={styles.dashboardLoading}>
            <ActivityIndicator color={COLORS.navy} />
          </View>
        ) : dashboardError ? (
          <FadeInUp delay={0}>
            <Text style={styles.dashboardError}>⚠ {dashboardError}</Text>
          </FadeInUp>
        ) : dashboard?.upcoming?.length > 0 ? (
          <FadeInUp delay={340}>
            <Text style={styles.sectionLabel}>UPCOMING APPOINTMENTS</Text>
            {dashboard.upcoming.slice(0, 3).map((appt, index) => {
              const status = (appt.status || '').toLowerCase();
              const isLive = LIVE_STATUSES.includes(status);
              const isCompleted = status === 'completed';
              const statusColor = STATUS_COLORS[status] || COLORS.gray;

              return (
                <FadeInUp key={appt.id} delay={index * 70}>
                  <View style={styles.apptCard}>
                    <View style={[styles.apptAccentBar, { backgroundColor: statusColor }]} />

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={styles.apptDateBox}>
                        <Text style={styles.apptMonth}>{appt.month}</Text>
                        <Text style={styles.apptDay}>{appt.day}</Text>
                      </View>
                      <View style={styles.apptInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.apptTest}>{appt.test}</Text>
                          {isLive && <PulseDot color={statusColor} />}
                        </View>
                        <Text style={styles.apptMeta}>{appt.time} · {appt.phlebotomist}</Text>
                      </View>
                    </View>

                    {isLive && !!appt.phlebotomist_phone && (
                      <View style={styles.phlebContactRow}>
                        <AnimatedPressable
                          style={styles.phlebContactBtn}
                          scaleTo={0.94}
                          onPress={() => handleCallPhleb(appt.phlebotomist_phone)}
                        >
                          <Ionicons name="call" size={16} color={COLORS.navy} />
                          <Text style={styles.phlebContactText}>Call</Text>
                        </AnimatedPressable>
                        <AnimatedPressable
                          style={styles.phlebContactBtn}
                          scaleTo={0.94}
                          onPress={() => handleMessagePhleb(appt.phlebotomist_phone)}
                        >
                          <Ionicons name="chatbubble" size={16} color={COLORS.navy} />
                          <Text style={styles.phlebContactText}>Message</Text>
                        </AnimatedPressable>
                      </View>
                    )}

                    {isCompleted && !appt.patient_rated && (
                      <AnimatedPressable
                        style={styles.rateBtn}
                        scaleTo={0.96}
                        onPress={() => setRatingAppt(appt)}
                      >
                        <Ionicons name="star" size={16} color="#FFFFFF" />
                        <Text style={styles.rateBtnText}>Rate this visit</Text>
                      </AnimatedPressable>
                    )}
                  </View>
                </FadeInUp>
              );
            })}
          </FadeInUp>
        ) : null}

      </ScrollView>

      {/* ── Rating modal ── */}
      {ratingAppt && (
        <View style={styles.ratingOverlay}>
          <Animated.View
            style={[
              styles.ratingCard,
              {
                opacity: modalAnim,
                transform: [
                  { scale: modalAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                ],
              },
            ]}
          >
            <Text style={styles.ratingTitle}>Rate your visit</Text>
            <Text style={styles.ratingSub}>{ratingAppt.test} · {ratingAppt.phlebotomist}</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setRatingValue(n)}>
                  <Ionicons
                    name={n <= ratingValue ? 'star' : 'star-outline'}
                    size={32}
                    color={COLORS.star}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.ratingInput}
              placeholder="Leave a comment (optional)"
              placeholderTextColor={COLORS.gray}
              value={ratingComment}
              onChangeText={setRatingComment}
              multiline
            />

            <View style={styles.ratingButtonRow}>
              <TouchableOpacity
                style={styles.ratingCancelBtn}
                onPress={() => setRatingAppt(null)}
                disabled={submittingRating}
              >
                <Text style={styles.ratingCancelText}>Cancel</Text>
              </TouchableOpacity>
              <AnimatedPressable
                style={styles.ratingSubmitBtn}
                scaleTo={0.95}
                onPress={handleSubmitRating}
              >
                {submittingRating
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={styles.ratingSubmitText}>Submit</Text>}
              </AnimatedPressable>
            </View>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.navy },
  scroll: { flex: 1, backgroundColor: COLORS.offWhite },
  scrollContent: { paddingBottom: 32 },

  headerCurve: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  userName: { fontSize: 22, fontWeight: '900', color: COLORS.white, marginTop: 2 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  bellBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: COLORS.navyLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },

  locationBarWrap: { paddingHorizontal: 20, marginTop: -22, marginBottom: 24 },
  locationCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    elevation: 6,
    shadowColor: '#0D1F3C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark, marginBottom: 14, paddingHorizontal: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: COLORS.gray, letterSpacing: 1, marginTop: 20, marginBottom: 10, paddingHorizontal: 20 },

  // ── Service cards ──
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 14,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  serviceCardSelected: { borderColor: COLORS.navy, borderWidth: 2 },
  serviceAccentBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
  },
  serviceIconRing: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIcon: { fontSize: 22 },
  serviceText: { flex: 1 },
  serviceTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navyDark, marginBottom: 3 },
  serviceTitleSelected: { color: COLORS.navy },
  serviceSubtitle: { fontSize: 12, color: COLORS.gray },
  badge: { backgroundColor: COLORS.purpleLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700', color: COLORS.purple },

  dashboardLoading: { paddingVertical: 20, alignItems: 'center' },
  dashboardError: { color: '#E63946', fontSize: 13, marginBottom: 16, textAlign: 'center', paddingHorizontal: 20 },

  // ── Appointment cards ──
  apptCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    paddingLeft: 18,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  apptAccentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  apptDateBox: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center', justifyContent: 'center',
  },
  apptMonth: { fontSize: 11, fontWeight: '700', color: COLORS.navy, textTransform: 'uppercase' },
  apptDay: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark },
  apptInfo: { flex: 1, marginLeft: 14 },
  apptTest: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark, marginBottom: 2 },
  apptMeta: { fontSize: 12, color: COLORS.gray },

  pulseDotWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  pulseDotRing: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  pulseDotCore: { width: 7, height: 7, borderRadius: 3.5 },

  phlebContactRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  phlebContactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  phlebContactText: { fontSize: 13, fontWeight: '700', color: COLORS.navy },

  rateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.orange, borderRadius: 10, paddingVertical: 10, marginTop: 12,
  },
  rateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  ratingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,31,60,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  ratingCard: { width: '100%', backgroundColor: COLORS.white, borderRadius: 20, padding: 22 },
  ratingTitle: { fontSize: 17, fontWeight: '900', color: COLORS.navyDark, textAlign: 'center' },
  ratingSub: { fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 4, marginBottom: 18 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 18 },
  ratingInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12,
    fontSize: 14, color: COLORS.navyDark, minHeight: 70, textAlignVertical: 'top', marginBottom: 18,
  },
  ratingButtonRow: { flexDirection: 'row', gap: 10 },
  ratingCancelBtn: { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  ratingCancelText: { color: COLORS.gray, fontWeight: '700' },
  ratingSubmitBtn: { flex: 1, backgroundColor: COLORS.navy, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  ratingSubmitText: { color: '#FFFFFF', fontWeight: '700' },
});