import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddressBar from '../components/AddressBar';
import { setBookingDraft } from '../utils/bookingDraft';
import { fetchPatientDashboard, getStoredPatientUser } from '../utils/auth';

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
      {/* Bell top knob */}
      <View style={bellStyles.knob} />
      {/* Bell dome */}
      <View style={bellStyles.dome} />
      {/* Bell base bar */}
      <View style={bellStyles.base} />
      {/* Clapper */}
      <View style={bellStyles.clapper} />
      {hasUnread && <View style={bellStyles.badge} />}
    </View>
  );
}

const bellStyles = StyleSheet.create({
  wrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    top: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.navyDark,
  },
  dome: {
    position: 'absolute',
    top: 3,
    width: 16,
    height: 13,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: COLORS.navyDark,
  },
  base: {
    position: 'absolute',
    top: 15,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.navyDark,
  },
  clapper: {
    position: 'absolute',
    bottom: 0,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.navyDark,
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.unreadDot,
    borderWidth: 1.5,
    borderColor: COLORS.white,
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

  const initials = firstName.slice(0, 2).toUpperCase();

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      try {
        const storedUser = await getStoredPatientUser();
        if (isMounted && storedUser?.name) {
          setFirstName(storedUser.name.split(' ')[0]);
        }
        const data = await fetchPatientDashboard();
        if (isMounted) setDashboard(data);
      } catch (err) {
        if (isMounted) {
          setDashboardError(
            err.message === 'NETWORK_ERROR'
              ? "Can't reach the server."
              : err.message === 'NOT_LOGGED_IN'
              ? 'Please log in again.'
              : err.message
          );
        }
      } finally {
        if (isMounted) setLoadingDashboard(false);
      }
    }
    loadDashboard();
    return () => { isMounted = false; };
  }, []);

  const tabs = [
    { name: 'Home', icon: '🏠' },
    { name: 'History', icon: '🕐' },
    { name: 'Results', icon: '📋' },
    { name: 'Profile', icon: '👤' },
  ];

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
            {dashboard.upcoming.slice(0, 3).map((appt) => (
              <View key={appt.id} style={styles.apptCard}>
                <View style={styles.apptDateBox}>
                  <Text style={styles.apptMonth}>{appt.month}</Text>
                  <Text style={styles.apptDay}>{appt.day}</Text>
                </View>
                <View style={styles.apptInfo}>
                  <Text style={styles.apptTest}>{appt.test}</Text>
                  <Text style={styles.apptMeta}>{appt.time} · {appt.phlebotomist}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}

      </ScrollView>

      {/* ── Bottom Tab Bar ── */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
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
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.name && styles.tabLabelActive]}>
              {tab.name}
            </Text>
            {activeTab === tab.name && <View style={styles.tabActiveDot} />}
          </TouchableOpacity>
        ))}
      </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
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
  apptInfo: { flex: 1 },
  apptTest: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark, marginBottom: 2 },
  apptMeta: { fontSize: 12, color: COLORS.gray },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingVertical: 8,
    paddingBottom: 12,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '500' },
  tabLabelActive: { color: COLORS.navy, fontWeight: '800' },
  tabActiveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.navy,
    marginTop: 2,
  },
});