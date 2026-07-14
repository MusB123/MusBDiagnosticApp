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
  pink: '#EC4899',
  pinkLight: '#FCE7F3',
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

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
};

const LIVE_STATUSES = ['accepted', 'assigned', 'in_progress', 'enroute', 'arrived', 'collected'];

const STATUS_COLORS = {
  accepted: COLORS.orange,
  assigned: COLORS.orange,
  in_progress: COLORS.orange,
  enroute: COLORS.orange,
  arrived: COLORS.orange,
  collected: COLORS.green,
  completed: COLORS.green,
};

const STATUS_HEADINGS = {
  pending: 'Sample to be collected',
  accepted: 'Sample to be collected',
  assigned: 'Sample to be collected',
  in_progress: 'Phlebotomist on the way',
  enroute: 'Phlebotomist on the way',
  arrived: 'Phlebotomist has arrived',
  collected: 'Sample collected',
  completed: 'Visit completed',
};

function isInPersonVisit(appt) {
  return (appt.visit_type || appt.visitType || '').toLowerCase() === 'in_person';
}
function isPaid(appt) {
  return (appt.payment_status || '').toLowerCase() === 'paid' || (appt.payment_method || '').toLowerCase() === 'card';
}

function getApptHeading(appt) {
  const status = (appt.status || '').toLowerCase();
  if (isInPersonVisit(appt)) {
    return status === 'completed' ? 'Visit completed' : 'Walk-in — pay at center';
  }
  return STATUS_HEADINGS[status] || 'Appointment details';
}

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
  const [isGuest, setIsGuest] = useState(false);
  useEffect(() => {
    (async () => {
      const storedUser = await getStoredPatientUser();
      setIsGuest(!!storedUser?.isGuest);
    })();
  }, []);

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

  const [selectedAppt, setSelectedAppt] = useState(null);
  const detailAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (selectedAppt) {
      detailAnim.setValue(0);
      Animated.spring(detailAnim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
    }
  }, [selectedAppt]);

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
        if (err.message === 'NOT_LOGGED_IN' && route?.params?.isGuest) {
          setDashboard({ upcoming: [], past: [] });
          setDashboardError('');
        } else {
          setDashboardError(
           err.message === 'NETWORK_ERROR'
            ? "Can't reach the server."
            : err.message === 'NOT_LOGGED_IN'
            ? 'Please log in again.'
            : err.message
        );
       }
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

  const closeApptDetail = () => setSelectedAppt(null);

  const openRatingFromDetail = (appt) => {
    setSelectedAppt(null);
    setRatingAppt(appt);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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

        <FadeInUp delay={90} style={styles.locationBarWrap}>
          <View style={styles.locationCard}>
            <AddressBar
              value={locationData.address}
              onChange={setLocationData}
            />
          </View>
        </FadeInUp>

        <FadeInUp delay={160}>
          <Text style={styles.sectionTitle}>What do you need today?</Text>
        </FadeInUp>

        {SERVICES.map((service, index) => (
          <FadeInUp key={service.id} delay={200 + index * 80}>
            <AnimatedPressable
              style={[styles.serviceCard, service.selected && styles.serviceCardSelected]}
              scaleTo={0.97}
              onPress={() => {
                const isGuest = route?.params?.isGuest === true;
                if (service.id === '1') {
                  setBookingDraft(locationData);
                  navigation.push('BookMobileVisit', { isGuest });
                } else if (service.id === '2') {
                  navigation.push('SelectTests', { isGuest });
                } else {
                  navigation.push('InPersonTests', { isGuest });
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
                  <AnimatedPressable
                    style={styles.apptCard}
                    scaleTo={0.98}
                    onPress={() => setSelectedAppt(appt)}
                  >
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
                        <Text style={styles.apptMeta}>
                          {isInPersonVisit(appt)
                            ? 'Walk-in — pay at center'
                            : `${appt.time} · ${appt.phlebotomist || 'Awaiting assignment'}`}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
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
                  </AnimatedPressable>
                </FadeInUp>
              );
            })}
          </FadeInUp>
        ) : null}

      </ScrollView>

      {selectedAppt && (() => {
        const appt = selectedAppt;
        const status = (appt.status || '').toLowerCase();
        const isLive = LIVE_STATUSES.includes(status);
        const isCompleted = status === 'completed';
        const heading = STATUS_HEADINGS[status] || 'Appointment details';
        const whenText = [appt.month && appt.day ? `${appt.day} ${appt.month}` : appt.date, appt.time]
          .filter(Boolean)
          .join(', ');

        return (
          <View style={styles.detailOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeApptDetail} />
            <Animated.View
              style={[
                styles.detailSheet,
                {
                  opacity: detailAnim,
                  transform: [
                    { translateY: detailAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                  ],
                },
              ]}
            >
              <View style={styles.detailHandle} />

              <View style={styles.detailHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailHeading}>{heading}</Text>
                  <Text style={styles.detailSub}>{whenText || 'Time to be confirmed'}</Text>
                </View>
                <TouchableOpacity onPress={closeApptDetail} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={COLORS.gray} />
                </TouchableOpacity>
              </View>

              {!isInPersonVisit(appt) && !isLive && status !== 'completed' && (
                <View style={styles.detailInfoBanner}>
                  <View style={styles.detailInfoIcon}>
                    <Ionicons name="person" size={16} color={COLORS.white} />
                  </View>
                  <Text style={styles.detailInfoText}>
                    We'll share phlebotomist details <Text style={styles.detailInfoBold}>as soon as a phlebotomist accepts your request</Text>.
                  </Text>
                </View>
              )}
              {isInPersonVisit(appt) && status !== 'completed' && (
                <View style={[styles.detailInfoBanner, { backgroundColor: COLORS.orangeLight }]}>
                  <View style={[styles.detailInfoIcon, { backgroundColor: COLORS.orange }]}>
                    <Ionicons name="storefront" size={16} color={COLORS.white} />
                  </View>
                  <Text style={styles.detailInfoText}>
                    This is a walk-in visit. <Text style={styles.detailInfoBold}>No phlebotomist will be dispatched</Text> — please pay and complete your test at the center.
                  </Text>
                </View>
              )}

              {isInPersonVisit(appt) && status !== 'completed' && !isPaid(appt) && (appt.payment_method || '').toLowerCase() !== 'card' && (
                <AnimatedPressable
                  style={styles.payInAppBtn}
                  scaleTo={0.96}
                  onPress={() => {
                    setSelectedAppt(null);
                    navigation.navigate('Checkout', {
                      mobileVisitTotal: 0,
                      labTestsTotal: Number(appt.test_price) || 0,
                      labTestsNames: appt.test || '',
                      address: appt.address || '',
                      visitType: 'in_person',
                      preferredDate: appt.preferred_date || appt.date || '',
                      preferredTime: 'Walk-in',
                      appointmentId: appt.id,
                    });
                  }}
                >
                  <Ionicons name="card" size={16} color="#FFFFFF" />
                  <Text style={styles.payInAppBtnText}>Pay in app instead</Text>
                </AnimatedPressable>
              )}

              {isLive && !!appt.phlebotomist_phone && (
                <View style={styles.phlebContactRow}>
                  <AnimatedPressable
                    style={[styles.phlebContactBtn, styles.phlebContactBtnWide]}
                    scaleTo={0.96}
                    onPress={() => handleCallPhleb(appt.phlebotomist_phone)}
                  >
                    <Ionicons name="call" size={16} color={COLORS.navy} />
                    <Text style={styles.phlebContactText}>Call</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    style={[styles.phlebContactBtn, styles.phlebContactBtnWide]}
                    scaleTo={0.96}
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
                  onPress={() => openRatingFromDetail(appt)}
                >
                  <Ionicons name="star" size={16} color="#FFFFFF" />
                  <Text style={styles.rateBtnText}>Rate this visit</Text>
                </AnimatedPressable>
              )}

              <View style={styles.detailDivider} />

              <View style={styles.detailInfoItem}>
                <View style={[styles.detailIconWrap, { backgroundColor: COLORS.pinkLight }]}>
                  <Ionicons name="water" size={18} color={COLORS.pink} />
                </View>
                <View style={styles.detailItemTextWrap}>
                  <Text style={styles.detailItemLabel}>Test</Text>
                  <Text style={styles.detailItemValue}>{appt.test}</Text>
                </View>
              </View>

              <View style={styles.detailInfoItem}>
                <View style={[styles.detailIconWrap, { backgroundColor: COLORS.purpleLight }]}>
                  <Ionicons name="person" size={18} color={COLORS.purple} />
                </View>
                <View style={styles.detailItemTextWrap}>
                  <Text style={styles.detailItemLabel}>Patient</Text>
                  <Text style={styles.detailItemValue}>{appt.patient_name || firstName}</Text>
                </View>
              </View>

              <View style={styles.detailInfoItem}>
                <View style={[styles.detailIconWrap, { backgroundColor: COLORS.greenLight }]}>
                  <Ionicons name="cash-outline" size={18} color={COLORS.green} />
                </View>
                <View style={styles.detailItemTextWrap}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.detailItemLabel}>Amount</Text>
                    {isInPersonVisit(appt) && (
                      <View style={[styles.payStatusBadge, isPaid(appt) ? styles.payStatusPaid : styles.payStatusUnpaid]}>
                        <Text style={[styles.payStatusText, isPaid(appt) ? styles.payStatusTextPaid : styles.payStatusTextUnpaid]}>
                          {isPaid(appt) ? 'Paid' : 'Unpaid'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.detailItemValue}>
                    {(() => {
                      if (isInPersonVisit(appt)) {
                        const fee = Number(appt.test_price) || Number(appt.total_patient_fee) || 0;
                        return fee > 0 ? `$${fee.toFixed(2)}` : 'Not available';
                      }
                      const base = Number(appt.baseFee) || 0;
                      const mileage = Number(appt.mileageFee) || 0;
                      const testCost = Number(appt.test_price) || 0;
                      const computedTotal = base + mileage + testCost;
                      const fee = computedTotal > 0
                        ? computedTotal
                        : (appt.total_patient_fee ?? appt.totalPatientFee ?? appt.test_price);
                      if (!fee) return 'Not available';
                      return `$${Number(fee).toFixed(2)}`;
                    })()}
                  </Text>
                </View>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailPrepRow}>
                <Ionicons name="time-outline" size={18} color={COLORS.purple} />
                <Text style={styles.detailPrepText}>
                  {appt.prep_note || 'No special preparation required'}
                </Text>
              </View>
            </Animated.View>
          </View>
        );
      })()}

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

  phlebContactRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 4 },
  phlebContactBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.navy, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  phlebContactBtnWide: { flex: 1, justifyContent: 'center' },
  phlebContactText: { fontSize: 14, fontWeight: '700', color: COLORS.navy },

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

  detailOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(13,31,60,0.5)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  detailHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.lightGray,
    alignSelf: 'center', marginBottom: 14,
  },
  detailHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16,
  },
  detailHeading: { fontSize: 17, fontWeight: '800', color: COLORS.navyDark },
  detailSub: { fontSize: 13, color: COLORS.green, fontWeight: '600', marginTop: 2 },

  detailInfoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.greenLight, borderRadius: 14, padding: 12, marginBottom: 16,
  },
  detailInfoIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center',
  },
  detailInfoText: { flex: 1, fontSize: 13, color: COLORS.bodyText },
  detailInfoBold: { fontWeight: '800', color: COLORS.navyDark },

  detailDivider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 14 },

  detailInfoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  detailIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  detailItemTextWrap: { flex: 1 },
  detailItemLabel: { fontSize: 12, color: COLORS.gray },
  detailItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.navyDark,
    marginTop: 1,
    flexWrap: 'wrap',
  },

  detailPrepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailPrepText: { fontSize: 13, color: COLORS.purple, fontWeight: '600', flex: 1 },
  payInAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
  },
  payInAppBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  payStatusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  payStatusPaid: { backgroundColor: COLORS.greenLight },
  payStatusUnpaid: { backgroundColor: COLORS.orangeLight },
  payStatusText: { fontSize: 10, fontWeight: '800' },
  payStatusTextPaid: { color: '#15803D' },
  payStatusTextUnpaid: { color: '#92400E' },
});