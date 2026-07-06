import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AddressBar from '../components/AddressBar';
import { setBookingDraft } from '../utils/bookingDraft';
import { fetchPatientDashboard, getStoredPatientUser, rateAppointment } from '../utils/auth';

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
  orange: '#F59E0B',
  purple: '#7C3AED',
  purpleLight: '#EDE9FE',
  greenLight: '#DCFCE7',
  star: '#FBBF24',
  unreadDot: '#EF4444',
};

const SERVICES = [
  {
    id: '1',
    icon: '🏠',
    iconBg: COLORS.purpleLight,
    title: 'Mobile phlebotomy',
    subtitle: 'We come to you.',
    badge: 'Popular',
    selected: true,
  },
  {
    id: '3',
    icon: '🏥',
    iconBg: '#FEF3C7',
    title: 'In-center visit',
    subtitle: 'Visit a lab near you',
    badge: null,
    selected: false,
  },
];

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
  knob: { position: 'absolute', top: 0, width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.navyDark },
  dome: {
    position: 'absolute', top: 3, width: 16, height: 13,
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
    borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
    backgroundColor: COLORS.navyDark,
  },
  base: { position: 'absolute', top: 15, width: 20, height: 3, borderRadius: 1.5, backgroundColor: COLORS.navyDark },
  clapper: { position: 'absolute', bottom: 0, width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.navyDark },
  badge: {
    position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.unreadDot, borderWidth: 1.5, borderColor: COLORS.white,
  },
});

export default function HomeScreen({ navigation, route }) {
  const [activeTab, setActiveTab] = useState('Home');
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
  const [ratingAppt, setRatingAppt] = useState(null); // appointment being rated, or null
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

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

  const tabs = [
    { name: 'Home', icon: 'home' },
    { name: 'History', icon: 'time' },
    { name: 'Results', icon: 'document-text' },
    { name: 'Profile', icon: 'person' },
  ];

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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.offWhite} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Bar ── */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{firstName}</Text>
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => navigation.navigate('PatientNotifications')}
              activeOpacity={0.75}
            >
              <BellIcon hasUnread={hasUnreadNotifs} />
            </TouchableOpacity>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
        </View>

        {/* ── Location Bar ── */}
        <View style={styles.locationBarWrap}>
          <AddressBar
            value={locationData.address}
            onChange={setLocationData}
          />
        </View>

        {/* ── What do you need ── */}
        <Text style={styles.sectionTitle}>What do you need today?</Text>

        {SERVICES.map((service) => (
          <TouchableOpacity
            key={service.id}
            style={[styles.serviceCard, service.selected && styles.serviceCardSelected]}
            activeOpacity={0.85}
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
            <View style={[styles.serviceIconWrap, { backgroundColor: service.iconBg }]}>
              <Text style={styles.serviceIcon}>{service.icon}</Text>
            </View>
            <View style={styles.serviceText}>
              <Text style={[styles.serviceTitle, service.selected && styles.serviceTitleSelected]}>
                {service.title}
              </Text>
              <Text style={styles.serviceSubtitle}>{service.subtitle}</Text>
            </View>
            {service.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{service.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* ── Upcoming Appointments ── */}
        {loadingDashboard ? (
          <View style={styles.dashboardLoading}>
            <ActivityIndicator color={COLORS.navy} />
          </View>
        ) : dashboardError ? (
          <Text style={styles.dashboardError}>⚠ {dashboardError}</Text>
        ) : dashboard?.upcoming?.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>UPCOMING APPOINTMENTS</Text>
            {dashboard.upcoming.slice(0, 3).map((appt) => {
              const status = (appt.status || '').toLowerCase();
              const isAssignedOrLater = [
                'assigned', 'in_progress', 'enroute', 'arrived', 'collected',
              ].includes(status);
              const isCompleted = status === 'completed';

              return (
                <View key={appt.id} style={styles.apptCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.apptDateBox}>
                      <Text style={styles.apptMonth}>{appt.month}</Text>
                      <Text style={styles.apptDay}>{appt.day}</Text>
                    </View>
                    <View style={styles.apptInfo}>
                      <Text style={styles.apptTest}>{appt.test}</Text>
                      <Text style={styles.apptMeta}>{appt.time} · {appt.phlebotomist}</Text>
                    </View>
                  </View>

                  {isAssignedOrLater && !!appt.phlebotomist_phone && (
                    <View style={styles.phlebContactRow}>
                      <TouchableOpacity
                        style={styles.phlebContactBtn}
                        onPress={() => handleCallPhleb(appt.phlebotomist_phone)}
                      >
                        <Ionicons name="call" size={16} color={COLORS.navy} />
                        <Text style={styles.phlebContactText}>Call</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.phlebContactBtn}
                        onPress={() => handleMessagePhleb(appt.phlebotomist_phone)}
                      >
                        <Ionicons name="chatbubble" size={16} color={COLORS.navy} />
                        <Text style={styles.phlebContactText}>Message</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {isCompleted && !appt.patient_rated && (
                    <TouchableOpacity
                      style={styles.rateBtn}
                      onPress={() => setRatingAppt(appt)}
                    >
                      <Ionicons name="star" size={16} color="#FFFFFF" />
                      <Text style={styles.rateBtnText}>Rate this visit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        ) : null}

      </ScrollView>

      {/* ── Bottom Tab Bar ── */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => {
                if (tab.name === 'History') {
                  navigation.navigate('PatientHistory');
                } else if (tab.name === 'Profile') {
                  navigation.navigate('PatientProfile');
                } else {
                  setActiveTab(tab.name);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? tab.icon : `${tab.icon}-outline`}
                size={22}
                color={isActive ? COLORS.navyDark : COLORS.gray}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.name}
              </Text>
              {isActive && <View style={styles.tabActiveDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Rating modal ── */}
      {ratingAppt && (
        <View style={styles.ratingOverlay}>
          <View style={styles.ratingCard}>
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
              <TouchableOpacity
                style={styles.ratingSubmitBtn}
                onPress={handleSubmitRating}
                disabled={submittingRating}
              >
                {submittingRating
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={styles.ratingSubmitText}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: { fontSize: 13, color: COLORS.gray, fontWeight: '500' },
  userName: { fontSize: 22, fontWeight: '900', color: COLORS.navyDark },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },

  locationBarWrap: { marginBottom: 24 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark, marginBottom: 14 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },

  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  serviceCardSelected: { borderColor: COLORS.navy, borderWidth: 2 },
  serviceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIcon: { fontSize: 24 },
  serviceText: { flex: 1 },
  serviceTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navyDark, marginBottom: 3 },
  serviceTitleSelected: { color: COLORS.navy },
  serviceSubtitle: { fontSize: 12, color: COLORS.gray },
  badge: {
    backgroundColor: COLORS.purpleLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: COLORS.purple },

  dashboardLoading: { paddingVertical: 20, alignItems: 'center' },
  dashboardError: { color: '#E63946', fontSize: 13, marginBottom: 16, textAlign: 'center' },

  apptCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  apptDateBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apptMonth: { fontSize: 11, fontWeight: '700', color: COLORS.navy, textTransform: 'uppercase' },
  apptDay: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark },
  apptInfo: { flex: 1, marginLeft: 14 },
  apptTest: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark, marginBottom: 2 },
  apptMeta: { fontSize: 12, color: COLORS.gray },

  phlebContactRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  phlebContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  phlebContactText: { fontSize: 13, fontWeight: '700', color: COLORS.navy },

  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.orange,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  rateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingVertical: 8,
    paddingBottom: 12,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '500' },
  tabLabelActive: { color: COLORS.navy, fontWeight: '800' },
  tabActiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.navy,
    marginTop: 2,
  },

  ratingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,31,60,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ratingCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 22,
  },
  ratingTitle: { fontSize: 17, fontWeight: '900', color: COLORS.navyDark, textAlign: 'center' },
  ratingSub: { fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 4, marginBottom: 18 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 18 },
  ratingInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.navyDark,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 18,
  },
  ratingButtonRow: { flexDirection: 'row', gap: 10 },
  ratingCancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ratingCancelText: { color: COLORS.gray, fontWeight: '700' },
  ratingSubmitBtn: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ratingSubmitText: { color: '#FFFFFF', fontWeight: '700' },
});