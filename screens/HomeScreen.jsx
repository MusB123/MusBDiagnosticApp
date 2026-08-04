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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AddressBar from '../components/AddressBar';
import * as Location from 'expo-location';
import { setBookingDraft, getBookingDraft } from '../utils/bookingDraft';
import { fetchPatientDashboard, getStoredPatientUser, rateAppointment, fetchOffers } from '../utils/auth';

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
  starEmpty: '#D9DEE8',
  unreadDot: '#EF4444',
  gold: '#D4AF37',
  goldLight: '#F5E7B8',
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

// Classy, on-brand offer card themes — alternates between a solid navy card
// (gold accents) and a crisp white card (navy accents) instead of loud
// mismatched gradients, so offers feel premium and match the app's palette.
const OFFER_THEMES = [
  { dark: true },
  { dark: false },
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

// Friendlier, self-explanatory labels + icons for the per-category star rows
// in the rating modal, so patients understand what each row is asking.
const CATEGORY_LABELS = {
  comfort: 'Comfort during the draw',
  friendliness: 'Friendliness',
  communication: 'Communication',
  punctuality: 'Punctuality',
  cleanliness: 'Cleanliness & safety',
};
const CATEGORY_ICONS = {
  comfort: 'heart-outline',
  friendliness: 'happy-outline',
  communication: 'chatbubbles-outline',
  punctuality: 'time-outline',
  cleanliness: 'sparkles-outline',
};
const OVERALL_RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
 
let hasAskedLocationThisSession = false;

function isInPersonVisit(appt) {
  const vt = (appt.visit_type || appt.visitType || '').toLowerCase();
  return vt === 'in_person' || vt === 'walkin' || vt === 'walk_in' || vt === 'onsite';
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

function AnimatedPressable({ style, onPress, children, scaleTo = 0.96, disabled, ...rest }) {
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
        style={style}
        disabled={disabled}
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


function AnimatedStar({ filled, size = 32, onPress, color = COLORS.star, emptyColor = COLORS.starEmpty }) {
  const scale = useRef(new Animated.Value(1)).current;
  const wasFilled = useRef(filled);

  useEffect(() => {
    if (filled && !wasFilled.current) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 50, bounciness: 14 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 8 }),
      ]).start();
    }
    wasFilled.current = filled;
  }, [filled]);

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.78, useNativeDriver: true, speed: 50, bounciness: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 26, bounciness: 9 }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      activeOpacity={1}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={filled ? 'star' : 'star-outline'} size={size} color={filled ? color : emptyColor} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function formatTimeLeft(value) {
  if (!value) return null;

  const date = new Date(value);
  if (isNaN(date.getTime())) {
   
    return /^\d+\s*\w+$/.test(value) ? value : null;
  }

  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return null;

  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) {
    const mins = Math.round(diffMs / (1000 * 60));
    return `${mins}m`;
  }
  if (diffHours < 24) {
    return `${Math.round(diffHours)}h`;
  }
  const days = Math.round(diffHours / 24);
  return `${days}d`;
}


function OfferCard({ offer, index, onPress }) {
  const anim = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const theme = OFFER_THEMES[index % OFFER_THEMES.length];
  const isDark = theme.dark;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 120),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }),
    ]).start();

    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(shine, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(2200),
      ])
    );
    shineLoop.start();
    return () => shineLoop.stop();
  }, []);

  const pressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  const bg = isDark ? COLORS.navy : COLORS.white;
  const textPrimary = isDark ? COLORS.white : COLORS.navyDark;
  const textMuted = isDark ? 'rgba(255,255,255,0.65)' : COLORS.gray;
  const accent = COLORS.gold;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          { scale },
        ],
        width: 220,
        marginRight: 12,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[
          offerStyles.card,
          { backgroundColor: bg },
          isDark ? offerStyles.cardDarkBorder : offerStyles.cardLightBorder,
        ]}
      >
        {/* Subtle corner accent — quiet, not a loud color blob */}
        <View style={[offerStyles.cornerAccent, { backgroundColor: isDark ? 'rgba(212,175,55,0.10)' : COLORS.offWhite }]} />
        <View style={[offerStyles.accentLine, { backgroundColor: accent }]} />

        <Animated.View
          pointerEvents="none"
          style={[
            offerStyles.shine,
            {
              backgroundColor: isDark ? '#FFFFFF' : COLORS.navy,
              opacity: shine.interpolate({ inputRange: [0, 1], outputRange: [0, isDark ? 0.08 : 0.04] }),
              transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-80, 220] }) }],
            },
          ]}
        />

        <View style={offerStyles.topRow}>
          <View style={[offerStyles.pill, { borderColor: accent }]}>
            <Ionicons name="flash" size={10} color={accent} />
            <Text style={[offerStyles.pillText, { color: accent }]}>{(offer.offer_type || 'OFFER').toUpperCase()}</Text>
          </View>
          {!!formatTimeLeft(offer.time_left) && (
            <Text style={[offerStyles.timeLeft, { color: textMuted }]}>{formatTimeLeft(offer.time_left)} left</Text>
          )}
        </View>

        <Text style={[offerStyles.title, { color: textPrimary }]} numberOfLines={2}>{offer.title}</Text>

        <Text style={[offerStyles.includes, { color: textMuted }]} numberOfLines={1}>
          {(offer.includes || []).join(' · ')}
        </Text>

        <View style={offerStyles.priceRow}>
          <Text style={[offerStyles.strike, { color: textMuted }]}>${parseFloat(offer.original_price).toFixed(0)}</Text>
          <Text style={[offerStyles.price, { color: isDark ? accent : COLORS.navy }]}>${parseFloat(offer.discounted_price).toFixed(0)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [isGuest, setIsGuest] = useState(false);
  useEffect(() => {
    (async () => {
      const storedUser = await getStoredPatientUser();
      setIsGuest(!!storedUser?.isGuest);
    })();
  }, []);

  const [locationData, setLocationDataState] = useState(() => getBookingDraft());

  
  const setLocationData = (data) => {
    setLocationDataState((prev) => {
      const next = typeof data === 'function' ? data(prev) : data;
      setBookingDraft(next);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;

    async function autoFetchAddress() {
      if (locationData?.address) return; // already have one — don't clobber it

      try {
        let status;

        if (hasAskedLocationThisSession) {
          // Already asked once this app session — just read current
          // status, never show the OS dialog again until app reopen.
          ({ status } = await Location.getForegroundPermissionsAsync());
        } else {
          hasAskedLocationThisSession = true;
          ({ status } = await Location.requestForegroundPermissionsAsync());
        }

        if (status !== 'granted') return; // don't pop the OS dialog on Home load

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        const geocode = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (cancelled || geocode.length === 0) return;

        const place = geocode[0];
        const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
        const cityRegion = [place.district, place.city, place.region].filter(Boolean).join(', ');
        const postal = place.postalCode || '';
        const country = place.country || '';
        const address = [street, cityRegion, postal, country].filter(Boolean).join(', ');

        setLocationData({
          address,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          useGps: true,
          zipCode: postal,
        });
      } catch (err) {
        console.warn('Auto address fetch failed:', err);
      }
    }

    autoFetchAddress();
    return () => { cancelled = true; };
  }, []);
  const [firstName, setFirstName] = useState(route?.params?.firstName || 'there');
  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [hasUnreadNotifs] = useState(true);

  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);

  const [ratingAppt, setRatingAppt] = useState(null);
  const [overallRating, setOverallRating] = useState(5);
  const [categoryRatings, setCategoryRatings] = useState({
    comfort: 5,
    friendliness: 5,
    communication: 5,
    punctuality: 5,
    cleanliness: 5,
  });
  const [selectedTags, setSelectedTags] = useState([]);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const autoPromptedRef = useRef(new Set());

  const AVAILABLE_TAGS = [
    'On time', 'Gentle draw', 'Professional', 'Friendly',
    'Clean setup', 'Great communication', 'Quick visit',
  ];

  const setCategoryRating = (key, value) => {
    setCategoryRatings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const resetRatingForm = () => {
    setOverallRating(5);
    setCategoryRatings({ comfort: 5, friendliness: 5, communication: 5, punctuality: 5, cleanliness: 5 });
    setSelectedTags([]);
    setRatingComment('');
  };

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
      if (isMountedRef.current) {
        const combined = [...(data.active || []), ...(data.upcoming || [])];
        combined.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        setDashboard({ ...data, upcoming: combined });
      }
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

  // Auto-prompt for a rating on completed, unrated visits. Completed
  // appointments live in dashboard.past (not dashboard.upcoming), which is
  // preserved as-is by loadDashboardData's {...data, upcoming: combined} spread.
  useEffect(() => {
    if (!dashboard?.past) return;
    const toPrompt = dashboard.past.find(
      (a) =>
        (a.status || '').toLowerCase() === 'completed' &&
        !a.patient_rated &&
        !autoPromptedRef.current.has(a.id)
    );
    if (toPrompt && !ratingAppt) {
      autoPromptedRef.current.add(toPrompt.id);
      setRatingAppt(toPrompt);
    }
  }, [dashboard]);

  useEffect(() => {
    const isMountedRef = { current: true };
    loadDashboardData(isMountedRef);
    return () => { isMountedRef.current = false; };
  }, []);

  // Offers — automatically shows the 2 newest active offers, swapping out
  // stale ones whenever the backend adds something new.
  useEffect(() => {
    let isMounted = true;
    async function loadOffers() {
      try {
        const data = await fetchOffers();
        if (isMounted) {
          const active = (data || []).filter((o) => o.is_active);
          const sorted = [...active].sort(
            (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
          );
          setOffers(sorted.slice(0, 2));
        }
      } catch {
        // offers are a nice-to-have on the home screen — fail silently
      } finally {
        if (isMounted) setOffersLoading(false);
      }
    }
    loadOffers();
    return () => { isMounted = false; };
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
      await rateAppointment(ratingAppt.id, overallRating, ratingComment, {
        categories: { overall: overallRating, ...categoryRatings },
        tags: selectedTags,
      });
      Alert.alert('Thank you!', 'Your rating has been submitted.');
      setRatingAppt(null);
      resetRatingForm();
      const data = await fetchPatientDashboard();
      const combined = [...(data.active || []), ...(data.upcoming || [])];
      combined.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setDashboard({ ...data, upcoming: combined });
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

  const openOffersScreen = () => {
    navigation.push('SelectTests', {
      isGuest: route?.params?.isGuest === true,
      initialViewMode: 'offers',
    });
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

        {/* Offers — sits after the service cards, before upcoming appointments */}
        {!offersLoading && offers.length > 0 && (
          <FadeInUp delay={260}>
            <View style={styles.offersHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="ribbon-outline" size={13} color={COLORS.gold} />
                <Text style={styles.sectionLabel}>EXCLUSIVE OFFERS</Text>
              </View>
              <TouchableOpacity onPress={openOffersScreen} hitSlop={8}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
            >
              {offers.map((offer, i) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  index={i}
                  onPress={openOffersScreen}
                />
              ))}
            </ScrollView>
          </FadeInUp>
        )}

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
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                          <View style={{ flex: 1 }}>
                            {appt.test
                              ?.split(',')
                              .map((t) => t.trim())
                              .filter(Boolean)
                              .map((t, i) => (
                                <Text key={i} style={styles.apptTest}>
                                  {t}
                                </Text>
                              ))}
                            </View>
                          {isLive && <PulseDot color={statusColor} />}
                        </View>
                        <Text style={styles.apptMeta}>
                          {isInPersonVisit(appt)
                            ? 'Walk-in'
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
                    const testTotal = Number(appt.test_price) || 0;
                    const totalFee = Number(appt.total_patient_fee ?? appt.totalPatientFee) || testTotal;
                    const collectionFee = Math.max(totalFee - testTotal, 0);

                    navigation.navigate('Checkout', {
                      mobileVisitTotal: 0,
                      labTestsTotal: testTotal,
                      walkinCollectionFee: collectionFee,
                      totalPatientFee: totalFee,
                      labTestsNames: appt.test || '',
                      address: appt.address || '',
                      visitType: 'walkin',      
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
                  {appt.test
                    ?.split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t, i) => (
                      <Text key={i} style={styles.detailItemValue}>
                        {t}
                      </Text>
                    ))}
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
                        const fee = Number(appt.total_patient_fee) || Number(appt.totalPatientFee) || Number(appt.test_price) || 0;
                        return fee > 0 ? `$${fee.toFixed(2)}` : 'Not available';
                      }

  // Mobile visit total = visit fee (backend-authoritative) + lab test cost.
  // These are stored as two separate fields — total_patient_fee never
  // includes test_price, so it must be added, not treated as the full total.
                      const visitFee = Number(appt.total_patient_fee ?? appt.totalPatientFee ?? 0);
                      const testCost = Number(appt.test_price) || 0;

                      let fee;
                      if (visitFee > 0 || testCost > 0) {
                        fee = visitFee + testCost;
                      } else {
    // Legacy fallback for old records with no stored breakdown.
                        const base = Number(appt.baseFee) || 0;
                        const distance = Number(appt.distanceFee) || 0;
                        const driversReserve = Number(appt.driversReserveFee) || 0;
                        const surcharges = Number(appt.surchargesTotal) || 0;
                        fee = base + distance + driversReserve + surcharges + testCost;
                      }

                      if (!fee) return 'Not available';
                      return `$${fee.toFixed(2)}`;
                    })()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.detailDivider} />

              <View style={[styles.detailPrepRow, appt.fasting_required && styles.detailPrepRowFasting]}>
                <Ionicons
                  name={appt.fasting_required ? 'alert-circle' : 'time-outline'}
                  size={18}
                  color={appt.fasting_required ? '#B45309' : COLORS.purple}
                />
                <Text style={[styles.detailPrepText, appt.fasting_required && styles.detailPrepTextFasting]}>
                  {appt.fasting_required
                    ? 'Fasting required before this test'
                    : (appt.prep_note || 'No special preparation required')}
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
              { paddingBottom: 28 + insets.bottom },
              {
                opacity: modalAnim,
                transform: [
                  { scale: modalAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                ],
              },
            ]}
          >
            <View style={styles.ratingHeaderIconWrap}>
              <Ionicons name="star" size={26} color="#FFFFFF" />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.ratingTitle}>How was your visit?</Text>
              <Text style={styles.ratingSub}>
                {ratingAppt.test ? ratingAppt.test.split(',')[0].trim() : 'Your test'}
                {ratingAppt.phlebotomist ? `  ·  ${ratingAppt.phlebotomist}` : ''}
              </Text>

              <View style={styles.overallBlock}>
                <Text style={styles.ratingCatLabel}>Overall experience</Text>
                <Text style={styles.ratingHint}>Tap a star to rate</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <AnimatedStar
                      key={n}
                      filled={n <= overallRating}
                      size={40}
                      onPress={() => setOverallRating(n)}
                    />
                  ))}
                </View>
                <Text style={styles.overallRatingLabel}>
                  {OVERALL_RATING_LABELS[overallRating]}
                </Text>
              </View>

              <View style={styles.ratingDivider} />

              <Text style={styles.ratingCatLabel}>Rate specific areas</Text>
              {Object.keys(categoryRatings).map((key) => (
                <View key={key} style={styles.catRow}>
                  <View style={styles.catRowLeft}>
                    <View style={styles.catIconWrap}>
                      <Ionicons name={CATEGORY_ICONS[key]} size={16} color={COLORS.navy} />
                    </View>
                    <Text style={styles.catRowLabel}>{CATEGORY_LABELS[key]}</Text>
                  </View>
                  <View style={styles.catStarsRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <AnimatedStar
                        key={n}
                        filled={n <= categoryRatings[key]}
                        size={20}
                        onPress={() => setCategoryRating(key, n)}
                      />
                    ))}
                  </View>
                </View>
              ))}

              <View style={styles.ratingDivider} />

              <Text style={styles.ratingCatLabel}>
                What stood out? <Text style={styles.optionalText}>(optional)</Text>
              </Text>
              <View style={styles.tagsWrap}>
                {AVAILABLE_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, selectedTags.includes(tag) && styles.tagChipSelected]}
                    onPress={() => toggleTag(tag)}
                  >
                    {selectedTags.includes(tag) && (
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.tagChipText, selectedTags.includes(tag) && styles.tagChipTextSelected]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.ratingCatLabel, { marginTop: 16 }]}>
                Anything else? <Text style={styles.optionalText}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.ratingInput}
                placeholder="Tell us more about your experience..."
                placeholderTextColor={COLORS.gray}
                value={ratingComment}
                onChangeText={setRatingComment}
                multiline
              />
            </ScrollView>

            <View style={styles.ratingButtonRow}>
              {!submittingRating && (
                <TouchableOpacity
                  style={styles.ratingCancelBtn}
                  onPress={() => setRatingAppt(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ratingCancelText}>Skip</Text>
                </TouchableOpacity>
              )}
              <AnimatedPressable
                style={[styles.ratingSubmitBtn, submittingRating && styles.ratingSubmitBtnDisabled]}
                scaleTo={0.96}
                onPress={handleSubmitRating}
                disabled={submittingRating}
              >
                <LinearGradient
                  colors={[COLORS.navyLight, COLORS.navy]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ratingSubmitGradient}
                >
                  {submittingRating ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.ratingSubmitText}>Submit rating</Text>
                  )}
                </LinearGradient>
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

  offersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
  },
  seeAllText: { fontSize: 12, fontWeight: '800', color: COLORS.navy, marginTop: 20 },

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
    backgroundColor: 'rgba(13,31,60,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  ratingCard: {
   width: '100%', maxHeight: '90%', backgroundColor: COLORS.white,
   borderRadius: 28, padding: 24, paddingTop: 36, paddingBottom: 28,
   elevation: 12,
   shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
   shadowOpacity: 0.28, shadowRadius: 24,
  },
  ratingHeaderIconWrap: {
    position: 'absolute', top: -28, alignSelf: 'center',
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.orange,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: COLORS.white,
    elevation: 6,
    shadowColor: COLORS.orange, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12,
  },
  ratingTitle: { fontSize: 20, fontWeight: '900', color: COLORS.navyDark, textAlign: 'center', marginTop: 8 },
  ratingSub: { fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 4, marginBottom: 24, fontWeight: '600' },

  overallBlock: { alignItems: 'center', marginBottom: 14, paddingVertical: 8 },
  ratingHint: { fontSize: 12, color: COLORS.gray, marginTop: 4, marginBottom: 16 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
  overallRatingLabel: { fontSize: 15, fontWeight: '900', color: COLORS.orange, marginTop: 12, height: 18, letterSpacing: 0.2 },

  ratingDivider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 22 },

  ratingCatLabel: { fontSize: 14, fontWeight: '800', color: COLORS.navyDark, marginBottom: 10 },
  optionalText: { fontSize: 12, fontWeight: '500', color: COLORS.gray },

  catRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  catRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  catIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  catRowLabel: { fontSize: 13.5, color: COLORS.navyDark, fontWeight: '700', flexShrink: 1 },
  catStarsRow: { flexDirection: 'row', gap: 5 },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4, marginBottom: 4 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 24,
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: COLORS.white,
  },
  tagChipSelected: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  tagChipText: { fontSize: 12, color: COLORS.bodyText, fontWeight: '600' },
  tagChipTextSelected: { color: '#FFFFFF' },

  ratingInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 16, padding: 14,
    fontSize: 14, color: COLORS.navyDark, minHeight: 90, textAlignVertical: 'top',
    marginTop: 8, marginBottom: 4, backgroundColor: COLORS.offWhite,
  },

  ratingButtonRow: { flexDirection: 'row', gap: 12, marginTop: 24,marginBottom: 8},
  ratingCancelBtn: {
    flex: 1,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 18,
    paddingVertical: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.offWhite,
  },
  ratingCancelText: { color: COLORS.gray, fontWeight: '700', fontSize: 13 },
  ratingSubmitBtn: {
    flex: 3,
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  ratingSubmitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
    minHeight: 54,
  },
  ratingSubmitBtnDisabled: { opacity: 0.6 },
  ratingSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  ratingSubmitIconBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

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
  detailPrepRowFasting: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  detailPrepTextFasting: { color: '#B45309', fontWeight: '700' },
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

const offerStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    height: 160,
    flexDirection: 'column',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#0D1F3C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  cardDarkBorder: { borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  cardLightBorder: { borderWidth: 1.5, borderColor: COLORS.border },
  cornerAccent: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -55,
    right: -45,
  },
  accentLine: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
  },
  shine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 50,
    transform: [{ rotate: '20deg' }],
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  pillText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  timeLeft: { fontSize: 10, fontWeight: '700' },
  title: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    lineHeight: 19,
    height: 38, // reserves space for 2 lines so 1-line titles don't shrink the card
  },
  includes: { fontSize: 11, marginBottom: 10, fontWeight: '500' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  strike: { fontSize: 12, textDecorationLine: 'line-through' },
  price: { fontSize: 21, fontWeight: '900' },
});