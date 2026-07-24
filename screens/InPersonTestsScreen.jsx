import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { getStoredPatientUser, bookAppointment, uploadDocument } from '../utils/auth';
import { CATALOG_ENDPOINTS } from '../config/api';

const { height: SCREEN_H } = Dimensions.get('window');

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
  amber: '#D97706',
  amberLight: '#FEF3C7',
  amberBorder: '#FCD34D',
  amberText: '#92400E',
  error: '#E63946',
  teal: '#0D9488',
  tealLight: '#CCFBF1',
  purple: '#7C3AED',
  purpleLight: '#EDE9FE',
  pink: '#DB2777',
  pinkLight: '#FCE7F3',
  sky: '#0284C7',
  skyLight: '#E0F2FE',
  orange: '#EA580C',
};

// Fallback list — used ONLY if the backend labs fetch fails, so the screen
// never leaves the patient with an empty center list. Mirrors the Django
// SEED_LABS in bookings/views.py (manage_labs).
const FALLBACK_CENTERS = [
  {
    id: 'fallback-1',
    name: 'MusB Diagnostics - New Port Richey',
    address: '6331 State Road, New Port Richey, FL 34653',
    latitude: 28.21778,
    longitude: -82.70957,
    phone: '',
  },
  {
    id: 'fallback-2',
    name: 'Quest Diagnostics - New Port Richey',
    address: '5435 Grand Blvd, New Port Richey, FL 34652',
    latitude: 28.2435,
    longitude: -82.7201,
    phone: '(727) 848-1322',
  },
  {
    id: 'fallback-3',
    name: 'Labcorp - New Port Richey',
    address: '5323 Trouble Creek Rd, New Port Richey, FL 34652',
    latitude: 28.2255,
    longitude: -82.7155,
    phone: '(727) 841-8622',
  },
  {
    id: 'fallback-4',
    name: 'BayCare Laboratories - Trinity',
    address: '2040 Trinity Oaks Blvd, Trinity, FL 34655',
    latitude: 28.192,
    longitude: -82.668,
    phone: '(727) 372-2300',
  },
  {
    id: 'fallback-5',
    name: 'Quest Diagnostics - Port Richey',
    address: '9330 US Highway 19, Port Richey, FL 34668',
    latitude: 28.2915,
    longitude: -82.721,
    phone: '(727) 847-1234',
  },
  {
    id: 'fallback-6',
    name: 'Tampa General Hospital Urgent Care & Lab',
    address: '8807 Little Rd, New Port Richey, FL 34654',
    latitude: 28.2805,
    longitude: -82.669,
    phone: '(727) 868-2456',
  },
  {
    id: 'fallback-7',
    name: 'AdventHealth Lab - West Florida',
    address: '4433 Rowan Rd, New Port Richey, FL 34653',
    latitude: 28.2312,
    longitude: -82.6845,
    phone: '(727) 376-7890',
  },
];

// "What to bring" checklist — shown as an animated, professional reminder
// card so patients arrive prepared.
const BRING_ITEMS = [
  {
    id: 'id',
    icon: 'card-outline',
    title: 'Photo ID',
    desc: 'A government-issued ID for identity verification.',
    color: COLORS.sky,
    bg: COLORS.skyLight,
  },
  {
    id: 'insurance',
    icon: 'shield-checkmark-outline',
    title: 'Insurance card',
    desc: 'Please carry your insurance card, if applicable.',
    color: COLORS.teal,
    bg: COLORS.tealLight,
  },
  {
    id: 'order',
    icon: 'document-text-outline',
    title: "Doctor's order",
    desc: 'Bring your lab requisition or physician order, if you have one.',
    color: COLORS.purple,
    bg: COLORS.purpleLight,
  },
  {
    id: 'fasting',
    icon: 'time-outline',
    title: 'Check fasting requirements',
    desc: 'Some tests require fasting — confirm with your provider beforehand.',
    color: COLORS.amber,
    bg: COLORS.amberLight,
  },
];

// Rotating accent colors applied to each center's icon ring, purely for a
// livelier, more colorful list.
const CENTER_ACCENTS = [
  { color: COLORS.navy, bg: '#EAF0FB' },
  { color: COLORS.teal, bg: COLORS.tealLight },
  { color: COLORS.purple, bg: COLORS.purpleLight },
  { color: COLORS.pink, bg: COLORS.pinkLight },
  { color: COLORS.sky, bg: COLORS.skyLight },
  { color: COLORS.orange, bg: COLORS.amberLight },
  { color: COLORS.green, bg: COLORS.greenLight },
];

// Normalize a lab record coming back from the backend (transform_doc output).
function normalizeLab(raw) {
  return {
    id: raw.id || raw._id || String(raw.name || Math.random()),
    name: raw.name || 'Unnamed center',
    address: raw.address || '',
    phone: raw.phone || '',
    latitude: raw.latitude,
    longitude: raw.longitude,
    distanceMiles: raw.distance_miles,
    icon: 'business',
  };
}

// ── Animation helpers ────────────────────────────────────────────────────

/** Springy press-scale wrapper. */
function AnimatedPressable({ style, onPress, disabled, children, scaleTo = 0.96, ...rest }) {
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

/** Fades + slides a section up into place. */
function FadeInUp({ delay = 0, distance = 16, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 460,
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

/** Icon that pops in with a slight overshoot. */
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

/** Doctor's-order selectable card — icon ring, accent bar, checkmark badge, press animation. */
function OrderOptionCard({ icon, accent, accentBg, title, subtitle, selected, onPress, delay, disabled }) {
  const check = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(check, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      speed: 24,
      bounciness: 10,
    }).start();
  }, [selected]);

  return (
    <FadeInUp delay={delay} style={{ flex: 1 }}>
      <AnimatedPressable
        style={[orderStyles.orderCard, selected && orderStyles.orderCardSelected, disabled && orderStyles.orderCardDisabled]}
        onPress={onPress}
        scaleTo={0.96}
        disabled={disabled}
      >
        <View style={[orderStyles.orderAccentBar, { backgroundColor: accent }]} />
        <View style={[orderStyles.orderIconRing, { backgroundColor: accentBg }]}>
          <Ionicons name={icon} size={22} color={accent} />
        </View>
        <Text style={[orderStyles.orderCardTitle, selected && { color: COLORS.navyDark }]}>{title}</Text>
        <Text style={orderStyles.orderCardSubtitle}>{subtitle}</Text>

        <Animated.View
          style={[
            orderStyles.orderCheckBadge,
            {
              opacity: check,
              transform: [{ scale: check }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={20} color={COLORS.navy} />
        </Animated.View>
      </AnimatedPressable>
    </FadeInUp>
  );
}

/** A single "what to bring" row — icon pops in, whole row fades/slides up. */
function BringItemRow({ item, index }) {
  return (
    <FadeInUp delay={220 + index * 70} distance={10}>
      <View style={bringStyles.row}>
        <IconPop delay={260 + index * 70}>
          <View style={[bringStyles.iconRing, { backgroundColor: item.bg }]}>
            <Ionicons name={item.icon} size={19} color={item.color} />
          </View>
        </IconPop>
        <View style={{ flex: 1 }}>
          <Text style={bringStyles.itemTitle}>{item.title}</Text>
          <Text style={bringStyles.itemDesc}>{item.desc}</Text>
        </View>
      </View>
    </FadeInUp>
  );
}

/** Professional, colored, animated "please remember to bring" card. */
function BringChecklistCard({ delay = 0 }) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <FadeInUp delay={delay}>
      <View style={bringStyles.card}>
        <Animated.View
          style={[
            bringStyles.glowDot,
            {
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] }),
              transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) }],
            },
          ]}
        />
        <View style={bringStyles.headerRow}>
          <View style={bringStyles.headerIconRing}>
            <Ionicons name="checkmark-done-circle" size={20} color={COLORS.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={bringStyles.headerTitle}>Please remember to bring</Text>
            <Text style={bringStyles.headerSub}>A quick checklist for a smooth visit</Text>
          </View>
        </View>

        <View style={bringStyles.itemsWrap}>
          {BRING_ITEMS.map((item, i) => (
            <BringItemRow key={item.id} item={item} index={i} />
          ))}
        </View>
      </View>
    </FadeInUp>
  );
}

/** Row shown in place of the old always-expanded center list. Tapping it
 *  opens the CenterSelectModal so the picker feels like a deliberate,
 *  focused choice rather than a long scroll of cards. */
function CenterPickerRow({ center, loading, error, onPress, accentIndex = 0 }) {
  const accent = CENTER_ACCENTS[accentIndex % CENTER_ACCENTS.length];
  return (
    <AnimatedPressable style={centerModalStyles.pickerRow} onPress={onPress} scaleTo={0.98} disabled={loading}>
      <View style={[centerModalStyles.pickerIconRing, { backgroundColor: accent.bg }]}>
        <Ionicons name="business" size={20} color={accent.color} />
      </View>
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color={COLORS.navy} />
            <Text style={centerModalStyles.pickerLoadingText}>Finding nearby centers…</Text>
          </View>
        ) : center ? (
          <>
            <Text style={centerModalStyles.pickerName} numberOfLines={1}>{center.name}</Text>
            <Text style={centerModalStyles.pickerMeta} numberOfLines={1}>{center.address}</Text>
          </>
        ) : (
          <Text style={centerModalStyles.pickerPlaceholder}>Tap to choose a lab center</Text>
        )}
        {error ? <Text style={centerModalStyles.pickerError}>Showing default centers</Text> : null}
      </View>
      <View style={centerModalStyles.pickerChangeBtn}>
        <Text style={centerModalStyles.pickerChangeText}>{center ? 'Change' : 'Select'}</Text>
        <Ionicons name="chevron-forward" size={14} color={COLORS.navy} />
      </View>
    </AnimatedPressable>
  );
}

/** Full-screen-ish sliding modal that lists every available lab center. */
function CenterSelectModal({ visible, centers, selectedId, onSelect, onClose, onRetry, error }) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={centerModalStyles.backdrop} onPress={onClose} />
      <Animated.View style={[centerModalStyles.sheet, { transform: [{ translateY }] }]}>
        <View style={centerModalStyles.sheetHandle} />
        <View style={centerModalStyles.sheetHeader}>
          <Text style={centerModalStyles.sheetTitle}>Choose a lab center</Text>
          <TouchableOpacity onPress={onClose} style={centerModalStyles.sheetCloseBtn}>
            <Ionicons name="close" size={18} color={COLORS.navyDark} />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={centerModalStyles.errorBanner}>
            <Ionicons name="alert-circle" size={14} color={COLORS.error} />
            <Text style={centerModalStyles.errorBannerText}>Couldn't load live centers — showing defaults.</Text>
            <TouchableOpacity onPress={onRetry}>
              <Text style={centerModalStyles.errorRetry}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {centers.map((c, i) => {
            const isSelected = selectedId === c.id;
            const accent = CENTER_ACCENTS[i % CENTER_ACCENTS.length];
            return (
              <FadeInUp key={c.id} delay={i * 40} distance={8}>
                <AnimatedPressable
                  style={[centerModalStyles.centerCard, isSelected && centerModalStyles.centerCardSelected]}
                  onPress={() => onSelect(c.id)}
                  scaleTo={0.98}
                >
                  <View style={[centerModalStyles.centerIconRing, { backgroundColor: accent.bg }]}>
                    <Ionicons name={c.icon || 'business'} size={20} color={accent.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[centerModalStyles.centerName, isSelected && { color: COLORS.navy }]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={centerModalStyles.centerMeta} numberOfLines={1}>{c.address}</Text>
                    {typeof c.distanceMiles === 'number' && (
                      <Text style={centerModalStyles.centerMeta}>{c.distanceMiles} mi away</Text>
                    )}
                  </View>
                  <View style={[centerModalStyles.radioBtn, isSelected && centerModalStyles.radioBtnSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                  </View>
                </AnimatedPressable>
              </FadeInUp>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}


/** Animated, colorful payment-option modal — replaces the plain Alert.
 *  Two selectable cards (Pay in app / Pay at center), each showing its
 *  own total, with a press-scale + staggered entrance. */
function PaymentOptionModal({ visible, payInAppTotal, payAtCenterTotal, onSelectPayInApp, onSelectPayAtCenter, onClose }) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      backdropAnim.setValue(0);
      cardAnim.setValue(0);
      Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8, delay: 60 }).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[paymentModalStyles.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            paymentModalStyles.card,
            {
              opacity: cardAnim,
              transform: [
                { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                { translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
              ],
            },
          ]}
        >
          <View style={paymentModalStyles.headerIconRing}>
            <Ionicons name="wallet" size={22} color={COLORS.navy} />
          </View>
          <Text style={paymentModalStyles.title}>Choose payment option</Text>
          <Text style={paymentModalStyles.subtitle}>How would you like to pay for your visit?</Text>

          <FadeInUp delay={80} distance={10}>
            <AnimatedPressable
              style={[paymentModalStyles.optionCard, paymentModalStyles.optionCardApp]}
              onPress={onSelectPayInApp}
              scaleTo={0.97}
            >
              <View style={paymentModalStyles.optionAccentBar} />
              <View style={[paymentModalStyles.optionIconRing, { backgroundColor: COLORS.skyLight }]}>
                <Ionicons name="card" size={20} color={COLORS.sky} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={paymentModalStyles.optionTitle}>Pay in app</Text>
                <Text style={paymentModalStyles.optionSub}>Secure card payment · Confirmed instantly</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={paymentModalStyles.optionPrice}>${payInAppTotal.toFixed(0)}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
              </View>
            </AnimatedPressable>
          </FadeInUp>

          <FadeInUp delay={140} distance={10}>
            <AnimatedPressable
              style={[paymentModalStyles.optionCard, paymentModalStyles.optionCardCenter]}
              onPress={onSelectPayAtCenter}
              scaleTo={0.97}
            >
              <View style={[paymentModalStyles.optionAccentBar, { backgroundColor: COLORS.amber }]} />
              <View style={[paymentModalStyles.optionIconRing, { backgroundColor: COLORS.amberLight }]}>
                <Ionicons name="business" size={20} color={COLORS.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={paymentModalStyles.optionTitle}>Pay at center</Text>
                <Text style={paymentModalStyles.optionSub}>Pay when you arrive for your visit</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={paymentModalStyles.optionPrice}>${payAtCenterTotal.toFixed(0)}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
              </View>
            </AnimatedPressable>
          </FadeInUp>

          <Pressable onPress={onClose} style={paymentModalStyles.cancelBtn}>
            <Text style={paymentModalStyles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
/** Beautiful animated "booking confirmed" overlay — replaces the plain
 *  text-only Alert. A ring draws itself in, the checkmark pops with a
 *  spring, and a few soft confetti dots drift and fade. */
function SuccessModal({ visible, centerName, dateLabel, timeLabel, amount, onDone }) {
  const ringProgress = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const cardIn = useRef(new Animated.Value(0)).current;
  const confetti = useRef(BRING_ITEMS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) return;
    ringProgress.setValue(0);
    checkScale.setValue(0);
    cardIn.setValue(0);
    confetti.forEach((v) => v.setValue(0));

    Animated.sequence([
      Animated.timing(cardIn, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ringProgress, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 16 }),
    ]).start();

    Animated.stagger(
      90,
      confetti.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true })
      )
    ).start();
  }, [visible]);

  if (!visible) return null;

  const confettiColors = [COLORS.teal, COLORS.purple, COLORS.pink, COLORS.amber];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone}>
      <View style={successStyles.backdrop}>
        <Animated.View
          style={[
            successStyles.card,
            {
              opacity: cardIn,
              transform: [
                { scale: cardIn.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                { translateY: cardIn.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              ],
            },
          ]}
        >
          <View style={successStyles.ringWrap}>
            {confetti.map((v, i) => {
              const angle = (i / confetti.length) * Math.PI * 2;
              const dist = 58;
              return (
                <Animated.View
                  key={i}
                  style={[
                    successStyles.confettiDot,
                    {
                      backgroundColor: confettiColors[i % confettiColors.length],
                      opacity: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
                      transform: [
                        { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * dist] }) },
                        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * dist] }) },
                        { scale: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0.4] }) },
                      ],
                    },
                  ]}
                />
              );
            })}
            <Animated.View
              style={[
                successStyles.ring,
                {
                  transform: [{ scale: ringProgress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
                  opacity: ringProgress,
                },
              ]}
            >
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <Ionicons name="checkmark" size={44} color={COLORS.white} />
              </Animated.View>
            </Animated.View>
          </View>

          <Text style={successStyles.title}>Appointment booked!</Text>
          <Text style={successStyles.subtitle}>
            Your visit to {centerName} is confirmed for {dateLabel} at {timeLabel}.
          </Text>

          {amount ? (
            <View style={successStyles.payPill}>
              <Ionicons name="cash-outline" size={14} color={COLORS.amberText} />
              <Text style={successStyles.payPillText}>Please pay ${amount} at the center</Text>
            </View>
          ) : null}

          <AnimatedPressable style={successStyles.doneBtn} onPress={onDone} scaleTo={0.97}>
            <Text style={successStyles.doneBtnText}>Thanks!</Text>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function InPersonTestsScreen({ navigation, route }) {
  const [selectedTestsData, setSelectedTestsData] = useState([]);
  const [appliedOffer, setAppliedOffer] = useState(null);
  const [extraTestsData, setExtraTestsData] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [patientUser, setPatientUser] = useState(null);

  // ── Doctor's order & insurance (mirrors BookMobileVisitScreen) ──
  const [doctorOrder, setDoctorOrder] = useState('self');
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [insurance, setInsurance] = useState('none');
  const [insuranceFront, setInsuranceFront] = useState(null);
  const [insuranceBack, setInsuranceBack] = useState(null);

  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentTotals, setPaymentTotals] = useState({ payInApp: 0, payAtCenter: 0 });
  const [pendingGuestInfo, setPendingGuestInfo] = useState(null);

  // ── Guest info (captured after a trip through GuestInfoScreen) ──
  // Booking with no account should work end-to-end: this screen no longer
  // gates on the `isGuest` route param (which isn't always set correctly by
  // the caller) — it gates on whether we actually have a logged-in patient.
  // If not, we send the user to GuestInfo, then remember what they typed
  // here so "Book appointment" / "Pay in app" can use it without asking
  // again or looping back to GuestInfo a second time.
  const [guestInfo, setGuestInfo] = useState(null);

  // ── Centers / labs from backend ──
  const [centers, setCenters] = useState([]);
  const [centersLoading, setCentersLoading] = useState(true);
  const [centersError, setCentersError] = useState(false);
  const [centerModalVisible, setCenterModalVisible] = useState(false);

  // ── Date / time — picked on a separate screen (ScheduleVisitScreen),
  // same pattern as BookMobileVisitScreen. Only Fixed / Urgent tiers show
  // for in-person visits (no visit-fee/flexible tier — see visitType param).
  const [schedule, setSchedule] = useState(null);

  // ── Success overlay state ──
  const [successVisible, setSuccessVisible] = useState(false);
  const [successPayload, setSuccessPayload] = useState(null);

  const fetchCenters = async () => {
    setCentersLoading(true);
    setCentersError(false);
    try {
      const res = await fetch(CATALOG_ENDPOINTS.labs, { method: 'GET' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load centers');

      const list = Array.isArray(data) ? data : (Array.isArray(data?.labs) ? data.labs : []);
      const normalized = list.map(normalizeLab).slice(0, 7); // show up to 7 centers
      const finalList = normalized.length ? normalized : FALLBACK_CENTERS;
      setCenters(finalList);
      setSelectedCenter((prev) => prev || finalList[0]?.id);
    } catch (err) {
      setCentersError(true);
      setCenters(FALLBACK_CENTERS);
      setSelectedCenter((prev) => prev || FALLBACK_CENTERS[0]?.id);
    } finally {
      setCentersLoading(false);
    }
  };

  useEffect(() => {
    fetchCenters();
  }, []);

  // Pick up tests (and any applied offer / extra tests) returned from
  // SelectTestsScreen — mirrors BookMobileVisitScreen's handling so an
  // offer bundle plus extra a-la-carte tests both show correctly here.
  useEffect(() => {
    const params = route?.params;
    if (params?.selectedTestsData) {
      setSelectedTestsData(params.selectedTestsData);
      setAppliedOffer(params.appliedOffer ?? null);
      setExtraTestsData(params.extraTestsData ?? []);
    }
  }, [route?.params?.selectedTestsData, route?.params?.appliedOffer, route?.params?.extraTestsData]);

  // Pick up the date/time returned from ScheduleVisitScreen.
  useEffect(() => {
    const {
      scheduledDate, scheduledDateLabel, scheduledTimeLabel,
      preferredTime, slotType, slotIndex, totalPatientFee,
    } = route?.params || {};
    if (scheduledDate) {
      setSchedule({
        isoDate: scheduledDate,
        dateLabel: scheduledDateLabel,
        timeLabel: scheduledTimeLabel,
        preferredTime,
        slotType,
        slotIndex,
        totalPatientFee: totalPatientFee ?? 0,
      });
    }
  }, [
    route?.params?.scheduledDate,
    route?.params?.scheduledTimeLabel,
    route?.params?.slotType,
    route?.params?.slotIndex,
  ]);

  // Pick up guest details returned from GuestInfoScreen (fullName/phone/email)
  // and immediately open the payment-option prompt — the user just finished
  // filling in their details, so there's no reason to make them tap
  // "Book appointment" a second time.
  useEffect(() => {
    const { fullName, phone, email } = route?.params || {};
    if (fullName || phone || email) {
      const info = { fullName: fullName || '', phone: phone || '', email: email || '' };
      setGuestInfo(info);
      promptPaymentOptions(info);
    }
  }, [route?.params?.fullName, route?.params?.phone, route?.params?.email]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      getStoredPatientUser().then(setPatientUser);
    });
    return unsub;
  }, [navigation]);

  // Offer-aware total: if an offer bundle is applied, its bundled price
  // replaces the sum of the individually-priced tests it covers (extra
  // a-la-carte tests still add on top of that, same as BookMobileVisit).
  const testsTotal = appliedOffer
    ? appliedOffer.price
    : selectedTestsData.reduce(
        (sum, t) => sum + (t.discountPrice != null ? t.discountPrice : (t.price ?? 0)),
        0
      );
  const selectedTestIds = selectedTestsData.map((t) => t.id);
  const center = centers.find((c) => c.id === selectedCenter);
  const centerIndex = centers.findIndex((c) => c.id === selectedCenter);

  // Date/time + scheduling fee, sourced from ScheduleVisitScreen.
  const formattedTime = schedule?.timeLabel || null;
  const formattedDateLabel = schedule?.dateLabel || null;
  const schedulingFee = schedule?.totalPatientFee || 0;
  const grandTotal = testsTotal + schedulingFee;

  const goToSelectTests = () => {
    navigation.navigate('SelectTests', {
      returnTo: 'InPersonTests',
      initialSelectedIds: selectedTestIds,
      hasInsurance: insurance === 'have',
      passthroughSchedule: schedule,
    });
  };

  const goToScheduleVisit = () => {
    navigation.navigate('ScheduleVisit', {
      address: center?.address || '',
      zipCode: '',
      testTotal: testsTotal,
      returnTo: 'InPersonTests',
      visitType: 'in_person', // hides the Flexible tier — no visit-fee concept for in-person
      passthroughSelectedTestsData: selectedTestsData,
      passthroughAppliedOffer: appliedOffer,
      passthroughExtraTestsData: extraTestsData,
    });
  };

  // ── Generic upload flow: Choose File (Image/PDF) or Take Photo ──
  // Mirrors the flow used on BookMobileVisitScreen, adapted for this
  // screen's three upload slots (prescription, insurance front, insurance back).

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const handleCameraFor = async (setter) => {
    const granted = await requestCameraPermission();
    if (!granted) {
      Alert.alert(
        'Camera access needed',
        'Please enable camera permissions in your device settings to take a photo.'
      );
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: true,
        base64: false,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        setter({
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          uri: asset.uri,
          mimeType: 'image/jpeg',
        });
      }
    } catch (err) {
      console.warn('Camera error:', err);
    }
  };

  const handleGalleryImageFor = async (setter) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setter({
        name: asset.fileName || `image_${Date.now()}.jpg`,
        uri: asset.uri,
        mimeType: 'image/jpeg',
      });
    } catch (err) {
      console.warn('Image pick error:', err);
    }
  };

  const handlePdfFor = async (setter) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      if (result.assets?.length > 0) {
        setter(result.assets[0]);
      } else if (result.type === 'success') {
        setter(result);
      }
    } catch (err) {
      console.warn('PDF pick error:', err);
    }
  };

  const showFileTypeChoice = (setter) => {
    Alert.alert('Select Document', 'Choose the type of file', [
      { text: 'Image', onPress: () => handleGalleryImageFor(setter) },
      { text: 'PDF', onPress: () => handlePdfFor(setter) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const showUploadOptions = (title, setter) => {
    Alert.alert(title, 'Choose how you would like to add this document', [
      { text: 'Choose File', onPress: () => showFileTypeChoice(setter) },
      { text: 'Take Photo', onPress: () => handleCameraFor(setter) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSelectDoctorOrder = (value) => {
    setDoctorOrder(value);
    if (value === 'order') {
      // no-op — tests remain independently selectable for in-person visits
    }
    if (value === 'self') {
      setPrescriptionFile(null);
      setInsurance('none');
      setInsuranceFront(null);
      setInsuranceBack(null);
    }
  };

  const handleSelectInsurance = (value) => {
    setInsurance(value);
    if (value === 'none') {
      setInsuranceFront(null);
      setInsuranceBack(null);
    }
  };

  // ── Document upload to S3 (mirrors CheckoutScreen's pattern exactly) ──
  // The "Pay at Center" path calls bookAppointment() directly instead of
  // routing through CheckoutScreen, so it must do this same key-upload +
  // field-naming itself or the doctor's order / insurance card would never
  // reach the backend. build_appointment_docs() (utils/s3_upload.py) accepts
  // an S3 key under the *_base64 field names (it detects the "patient-docs/"
  // prefix and passes it through instead of trying to decode it).
  const uploadPrescriptionDoc = async () => {
    if (doctorOrder !== 'order' || !prescriptionFile?.uri) return null;
    try {
      const { key } = await uploadDocument({
        uri: prescriptionFile.uri,
        filename: prescriptionFile.name || 'doctor-order',
        kind: 'patient-docs',
      });
      return { key, name: prescriptionFile.name || 'Doctor Order' };
    } catch (err) {
      console.warn('Could not upload prescription file:', err);
      return null;
    }
  };

  const uploadInsuranceDocs = async () => {
    if (insurance !== 'have') return { front: null, back: null };
    let front = null;
    let back = null;

    try {
      if (insuranceFront?.uri) {
        const { key } = await uploadDocument({
          uri: insuranceFront.uri,
          filename: insuranceFront.name || 'insurance-front',
          kind: 'patient-docs',
        });
        front = { key, name: insuranceFront.name || 'Insurance Front' };
      }
    } catch (err) {
      console.warn('Could not upload insurance front:', err);
    }

    try {
      if (insuranceBack?.uri) {
        const { key } = await uploadDocument({
          uri: insuranceBack.uri,
          filename: insuranceBack.name || 'insurance-back',
          kind: 'patient-docs',
        });
        back = { key, name: insuranceBack.name || 'Insurance Back' };
      }
    } catch (err) {
      console.warn('Could not upload insurance back:', err);
    }

    return { front, back };
  };

  // Accepts an optional guest object so it can be called right after
  // GuestInfoScreen returns — reading `guestInfo` state at that exact
  // moment would still show the old (empty) value since setState is async.
  const promptPaymentOptions = async (guestOverride) => {
    if (selectedTestsData.length === 0) {
      Alert.alert('No tests selected', 'Please select at least one test before booking.');
      return;
    }
    if (!selectedCenter) {
      setCenterModalVisible(true);
      return;
    }
    if (!schedule) {
      goToScheduleVisit();
      return;
    }

    let payAtCenterTotal = grandTotal;
    try {
      const preview = await fetchWalkinFeePreview({ testTotal: grandTotal, payAtCenter: true });
      payAtCenterTotal = preview.totalPatientFee;
    } catch (e) {
    // fall back silently — booking itself still computes the real total
    }

    setPaymentTotals({ payInApp: grandTotal, payAtCenter: payAtCenterTotal });
    setPendingGuestInfo(guestOverride || null);
    setPaymentModalVisible(true);
  };

  const handleBookAppointment = () => {
    if (selectedTestsData.length === 0) {
      Alert.alert('No tests selected', 'Please select at least one test before booking.');
      return;
    }

    if (!selectedCenter) {
      setCenterModalVisible(true);
      return;
    }

    if (!schedule) {
      goToScheduleVisit();
      return;
    }

    if (doctorOrder === 'order' && !prescriptionFile) {
      Alert.alert("Doctor's order document missing", "Please upload your doctor's order document before continuing.");
      return;
    }

    // No logged-in patient and we haven't collected guest details yet —
    // go get them first. Once GuestInfoScreen sends the user back here with
    // fullName/phone/email params, the effect above stores them in
    // `guestInfo` AND opens the payment prompt automatically, so this
    // check won't fire again.
    if (!patientUser && !guestInfo) {
      navigation.navigate('GuestInfo', {
        returnTo: 'InPersonTests',
        isGuest: true,
      });
      return;
    }

    promptPaymentOptions(guestInfo);
  };

  const payInApp = (guestOverride) => {
    const info = guestOverride || guestInfo;
    navigation.navigate('Checkout', {
      mobileVisitTotal: 0, // no visit fee for in-person
      labTestsTotal: grandTotal,
      labTestsNames: selectedTestsData.map((t) => t.name).join(', '),
      address: center?.address || '',
      visitType: 'walkin',
      preferredDate: schedule.isoDate,
      preferredTime: formattedTime,
      selectedLabId: center?.id || '',
      selectedLabName: center?.name || '',
      fullName: info?.fullName || patientUser?.name || '',
      email: info?.email || patientUser?.email || '',
      phone: info?.phone || patientUser?.phone || '',
      isGuest: !patientUser,
      doctorOrder,
      prescriptionFile,
      insurance,
      insuranceFront,
      insuranceBack,
    });
  };

  const confirmBooking = async (paymentMethod, guestOverride) => {
    const info = guestOverride || guestInfo;
    setSubmitting(true);
    try {
      const doctorOrderDoc = await uploadPrescriptionDoc();
      const { front: insuranceFrontDoc, back: insuranceBackDoc } = await uploadInsuranceDocs();

      const result = await bookAppointment({
        test_name: selectedTestsData.map((t) => t.name).join(', '),
        test_price: grandTotal,
        full_name: info?.fullName || patientUser?.name || '',
        email: info?.email || patientUser?.email || '',
        phone: info?.phone || patientUser?.phone || '',
        address: center?.address || '',
        visit_type: 'walkin',
        preferred_date: schedule.isoDate,
        preferred_time: formattedTime,
        payment_method: paymentMethod === 'pay_at_center' ? 'Pay at Center' : 'Card',
        selected_lab_id: center?.id || '',
        selected_lab_name: center?.name || '',
        labAddress: center?.address || '',
        doctor_order_base64: doctorOrderDoc?.key || null,
        doctor_order_name: doctorOrderDoc?.name || null,
        insurance_front_base64: insuranceFrontDoc?.key || null,
        insurance_front_name: insuranceFrontDoc?.name || null,
        insurance_back_base64: insuranceBackDoc?.key || null,
        insurance_back_name: insuranceBackDoc?.name || null,
      });

      const authoritativeTotal = result?.totalPatientFee ?? grandTotal;

      setSuccessPayload({
        centerName: center?.name || 'the center',
        dateLabel: formattedDateLabel,
        timeLabel: formattedTime,
        amount: paymentMethod === 'pay_at_center' ? authoritativeTotal.toFixed(0) : null,
      });
      setSuccessVisible(true);
    } catch (err) {
      Alert.alert('Booking failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessDone = () => {
    setSuccessVisible(false);
    if (!patientUser && guestInfo) {
      navigation.navigate('CreateAccountPrompt');
    } else {
      navigation.navigate('PatientHome');
    }
  };
  const handleSelectPayInApp = () => {
    setPaymentModalVisible(false);
    payInApp(pendingGuestInfo);
  };

  const handleSelectPayAtCenter = () => {
    setPaymentModalVisible(false);
    confirmBooking('pay_at_center', pendingGuestInfo);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header (accent stripe removed) */}
      <View style={styles.header}>
        <AnimatedPressable style={styles.backBtn} onPress={() => navigation.goBack()} scaleTo={0.85}>
          <Ionicons name="arrow-back" size={20} color={COLORS.navyDark} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>In-center visit</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Doctor's Order */}
        <FadeInUp delay={0}>
          <Text style={styles.sectionLabel}>Doctor's order</Text>
          <Text style={styles.sectionSubtitle}>
            Having a doctor's request order helps us route your tests automatically.
          </Text>
        </FadeInUp>
        <View style={styles.orderRow}>
          <OrderOptionCard
            icon="person-outline"
            accent={COLORS.teal}
            accentBg={COLORS.tealLight}
            title="Self-referred"
            subtitle="No doctor's order"
            selected={doctorOrder === 'self'}
            onPress={() => handleSelectDoctorOrder('self')}
            delay={30}
          />
          <OrderOptionCard
            icon="document-text-outline"
            accent={COLORS.purple}
            accentBg={COLORS.purpleLight}
            title="Doctor's order"
            subtitle="I have a request"
            selected={doctorOrder === 'order'}
            onPress={() => handleSelectDoctorOrder('order')}
            delay={70}
          />
        </View>

        {/* Upload box — only when doctor's order selected */}
        {doctorOrder === 'order' && (
          <FadeInUp delay={0}>
            <AnimatedPressable
              style={[styles.uploadBox, prescriptionFile && styles.uploadBoxDone]}
              onPress={() => showUploadOptions("Doctor's order", setPrescriptionFile)}
              scaleTo={0.98}
            >
              {prescriptionFile ? (
                <>
                  <View style={styles.uploadDoneIconWrap}>
                    <Ionicons name="checkmark" size={24} color={COLORS.white} />
                  </View>
                  <Text style={styles.uploadDoneTitle}>File uploaded</Text>
                  <Text style={styles.uploadDoneText} numberOfLines={1}>
                    {prescriptionFile.name}
                  </Text>
                  <Text style={styles.uploadChangeText}>Tap to change</Text>
                </>
              ) : (
                <>
                  <View style={styles.uploadIconWrap}>
                    <Ionicons name="cloud-upload-outline" size={22} color={COLORS.gray} />
                  </View>
                  <Text style={styles.uploadTitle}>Click to Upload or Take Photo</Text>
                  <Text style={styles.uploadSub}>PDF, PNG, JPG up to 10MB</Text>
                </>
              )}
            </AnimatedPressable>
          </FadeInUp>
        )}

        {/* Insurance — only shown once a doctor's order is selected */}
        {doctorOrder === 'order' && (
          <>
            <FadeInUp delay={100}>
              <Text style={styles.sectionLabel}>Insurance</Text>
              <Text style={styles.sectionSubtitle}>
                Add your insurance card so we can verify coverage before your visit.
              </Text>
            </FadeInUp>
            <View style={styles.orderRow}>
              <OrderOptionCard
                icon="close-circle-outline"
                accent={COLORS.gray}
                accentBg={COLORS.lightGray}
                title="No insurance"
                subtitle="Self-pay"
                selected={insurance === 'none'}
                onPress={() => handleSelectInsurance('none')}
                delay={110}
              />
              <OrderOptionCard
                icon="card-outline"
                accent={COLORS.sky}
                accentBg={COLORS.skyLight}
                title="I have insurance"
                subtitle="Add my card"
                selected={insurance === 'have'}
                onPress={() => handleSelectInsurance('have')}
                delay={150}
              />
            </View>

            {insurance === 'have' && (
              <FadeInUp delay={0}>
                <View style={{ gap: 12, marginTop: 14, marginBottom: 8 }}>
                  <AnimatedPressable
                    style={[styles.uploadBox, insuranceFront && styles.uploadBoxDone]}
                    onPress={() => showUploadOptions('Insurance card — front', setInsuranceFront)}
                    scaleTo={0.98}
                  >
                    {insuranceFront ? (
                      <>
                        <View style={styles.uploadDoneIconWrap}>
                          <Ionicons name="checkmark" size={24} color={COLORS.white} />
                        </View>
                        <Text style={styles.uploadDoneTitle}>Front uploaded</Text>
                        <Text style={styles.uploadDoneText} numberOfLines={1}>
                          {insuranceFront.name}
                        </Text>
                        <Text style={styles.uploadChangeText}>Tap to change</Text>
                      </>
                    ) : (
                      <>
                        <View style={styles.uploadIconWrap}>
                          <Ionicons name="card-outline" size={22} color={COLORS.gray} />
                        </View>
                        <Text style={styles.uploadTitle}>Upload insurance card — front</Text>
                        <Text style={styles.uploadSub}>PDF, PNG, JPG up to 10MB</Text>
                      </>
                    )}
                  </AnimatedPressable>

                  <AnimatedPressable
                    style={[styles.uploadBox, insuranceBack && styles.uploadBoxDone]}
                    onPress={() => showUploadOptions('Insurance card — back', setInsuranceBack)}
                    scaleTo={0.98}
                  >
                    {insuranceBack ? (
                      <>
                        <View style={styles.uploadDoneIconWrap}>
                          <Ionicons name="checkmark" size={24} color={COLORS.white} />
                        </View>
                        <Text style={styles.uploadDoneTitle}>Back uploaded</Text>
                        <Text style={styles.uploadDoneText} numberOfLines={1}>
                          {insuranceBack.name}
                        </Text>
                        <Text style={styles.uploadChangeText}>Tap to change</Text>
                      </>
                    ) : (
                      <>
                        <View style={styles.uploadIconWrap}>
                          <Ionicons name="card-outline" size={22} color={COLORS.gray} />
                        </View>
                        <Text style={styles.uploadTitle}>Upload insurance card — back</Text>
                        <Text style={styles.uploadSub}>PDF, PNG, JPG up to 10MB</Text>
                      </>
                    )}
                  </AnimatedPressable>
                </View>
              </FadeInUp>
            )}
          </>
        )}

        {/* Tests Section — offer-aware lab tests card, same pattern as
            BookMobileVisitScreen (icon header, count badge, offer pill +
            extra tests, discount strikethrough, running total). Prices are
            hidden per-test when the backend marks them hidePrice (insurance
            flow) — same behavior as BookMobileVisitScreen. */}
        <FadeInUp delay={0}>
          <View style={[styles.sectionLabelRow, { marginTop: 20 }]}>
            <Text style={styles.sectionLabel}>Lab tests</Text>
          </View>
        </FadeInUp>

        <FadeInUp delay={40}>
          <View style={styles.labCard}>
            <View style={styles.labCardHeader}>
              <View style={styles.labIconRing}>
                <View style={styles.labIconWrap}>
                  <IconPop delay={80}>
                    <Ionicons name="flask" size={22} color={COLORS.purple} />
                  </IconPop>
                </View>
              </View>
              <View style={styles.labHeaderText}>
                <Text style={styles.labTitle}>
                  {selectedTestsData.length > 0 ? 'Selected tests' : 'Do you want to buy a discounted lab test?'}
                </Text>
                <Text style={styles.labSub}>
                  {selectedTestsData.length > 0 ? 'Review your selection below' : 'Choose from our full test catalogue'}
                </Text>
              </View>
              {selectedTestsData.length > 0 && (
                <View style={styles.testCountBadge}>
                  <Text style={styles.testCountText}>{selectedTestsData.length} selected</Text>
                </View>
              )}
            </View>

            {selectedTestsData.length > 0 && (
              <>
                <View style={styles.labDivider} />
                <View style={styles.labBody}>
                  {appliedOffer ? (
                    <>
                      <View style={styles.testPill}>
                        <View style={styles.testPillLeft}>
                          <Ionicons name="pricetag" size={14} color={COLORS.navy} style={{ marginRight: 2 }} />
                          <Text style={styles.testPillName} numberOfLines={1}>
                            {appliedOffer.title} ({appliedOffer.testIds?.length ?? appliedOffer.matchedCount} tests)
                          </Text>
                        </View>
                        {!appliedOffer.hidePrice && (
                          <Text style={[styles.testPillPrice, { color: COLORS.green }]}>
                            ${appliedOffer.price.toFixed(0)}
                          </Text>
                        )}
                      </View>
                      {extraTestsData.map((test, i) => (
                        <FadeInUp key={test.id ?? i} delay={i * 50} distance={8}>
                          <View style={styles.testPill}>
                            <View style={styles.testPillLeft}>
                              <View style={styles.testDot} />
                              <Text style={styles.testPillName} numberOfLines={1}>
                                {test.name}
                              </Text>
                            </View>
                            {!test.hidePrice && (
                              <Text style={styles.testPillPrice}>
                                ${(test.discountPrice ?? test.price ?? 0).toFixed(0)}
                              </Text>
                            )}
                          </View>
                        </FadeInUp>
                      ))}
                    </>
                  ) : (
                    selectedTestsData.map((test, i) => {
                      const hasDiscount = test.discountPrice != null && test.discountPrice < test.price;
                      return (
                        <FadeInUp key={test.id ?? i} delay={i * 50} distance={8}>
                          <View style={styles.testPill}>
                            <View style={styles.testPillLeft}>
                              <View style={styles.testDot} />
                              <Text style={styles.testPillName} numberOfLines={1}>
                                {test.name}
                              </Text>
                            </View>
                            {test.hidePrice ? null : hasDiscount ? (
                              <View style={styles.testPillPriceRow}>
                                <Text style={styles.testPillStrikePrice}>${test.price.toFixed(0)}</Text>
                                <Text style={[styles.testPillPrice, styles.testPillDiscountPrice]}>
                                  ${test.discountPrice.toFixed(0)}
                                </Text>
                              </View>
                            ) : (
                              <Text style={styles.testPillPrice}>${test.price.toFixed(0)}</Text>
                            )}
                          </View>
                        </FadeInUp>
                      );
                    })
                  )}
                  <View style={styles.testsTotalRow}>
                    <Text style={styles.testsTotalLabel}>
                      {appliedOffer ? 'Offer total' : 'Tests subtotal'}
                    </Text>
                    <Text style={styles.testsTotalValue}>${testsTotal.toFixed(0)}</Text>
                  </View>
                </View>
              </>
            )}

            <AnimatedPressable style={styles.selectTestsBtnFull} scaleTo={0.97} onPress={goToSelectTests}>
              <Text style={styles.selectTestsBtnFullText}>
                {selectedTestsData.length > 0 ? '＋ Add or change tests' : '＋ Browse and select tests'}
              </Text>
            </AnimatedPressable>
          </View>
        </FadeInUp>

        {/* No Visit Fee Banner */}
        <FadeInUp delay={140}>
          <View style={styles.noFeeBanner}>
            <View style={styles.noFeeIconRing}>
              <IconPop delay={200}>
                <Ionicons name="business" size={18} color={COLORS.amber} />
              </IconPop>
            </View>
            <View style={styles.noFeeText}>
              <Text style={styles.noFeeTitle}>In-person — no visit fee</Text>
              <Text style={styles.noFeeDesc}>
                You come to us, so mobile charges do not apply.
              </Text>
            </View>
          </View>
        </FadeInUp>

        {/* What to bring — animated, professional checklist */}
        <BringChecklistCard delay={160} />

        {/* Select Center — a single tappable row that opens a picker
            sheet listing every center, instead of a long inline list. */}
        <FadeInUp delay={180}>
          <Text style={styles.sectionLabel}>Select center</Text>
        </FadeInUp>
        <FadeInUp delay={200}>
          <CenterPickerRow
            center={center}
            loading={centersLoading}
            error={centersError}
            accentIndex={centerIndex >= 0 ? centerIndex : 0}
            onPress={() => setCenterModalVisible(true)}
          />
        </FadeInUp>

        {/* Select date & time — picked on ScheduleVisitScreen (Fixed /
            Urgent tiers only for in-person, via visitType: 'in_person') */}
        <FadeInUp delay={260}>
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Select date & time</Text>
        </FadeInUp>
        <FadeInUp delay={280}>
          <AnimatedPressable style={centerModalStyles.pickerRow} onPress={goToScheduleVisit} scaleTo={0.98}>
            <View style={[centerModalStyles.pickerIconRing, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="calendar" size={20} color={COLORS.navy} />
            </View>
            <View style={{ flex: 1 }}>
              {schedule ? (
                <>
                  <Text style={centerModalStyles.pickerName} numberOfLines={1}>
                    {schedule.dateLabel} · {schedule.timeLabel}
                  </Text>
                  <Text style={centerModalStyles.pickerMeta} numberOfLines={1}>
                    {schedule.slotType === 'urgent' ? 'Urgent' : 'Fixed time'}
                    {schedulingFee > 0 ? ` · +$${schedulingFee.toFixed(0)} scheduling fee` : ''}
                  </Text>
                </>
              ) : (
                <Text style={centerModalStyles.pickerPlaceholder}>Tap to choose date & time</Text>
              )}
            </View>
            <View style={centerModalStyles.pickerChangeBtn}>
              <Text style={centerModalStyles.pickerChangeText}>{schedule ? 'Change' : 'Select'}</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.navy} />
            </View>
          </AnimatedPressable>
        </FadeInUp>

        {/* Schedule summary */}
        {schedule && (
          <FadeInUp delay={340}>
            <View style={styles.scheduleSummary}>
              <View style={styles.scheduleIconRing}>
                <Ionicons name="calendar" size={18} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scheduleLabel}>Scheduled for</Text>
                <Text style={styles.scheduleValue}>{formattedDateLabel} · {formattedTime}</Text>
              </View>
            </View>
          </FadeInUp>
        )}

        {/* Price Summary */}
        <FadeInUp delay={380}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{appliedOffer ? 'Offer total' : 'Tests subtotal'}</Text>
              <Text style={styles.summaryValue}>${testsTotal.toFixed(0)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Visit fee</Text>
              <Text style={styles.summaryFree}>FREE</Text>
            </View>
            {schedulingFee > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Scheduling fee ({schedule?.slotType})</Text>
                <Text style={styles.summaryValue}>${schedulingFee.toFixed(0)}</Text>
              </View>
            )}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${grandTotal.toFixed(0)}</Text>
            </View>
          </View>
        </FadeInUp>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <AnimatedPressable
          style={[styles.bookBtn, (selectedTestsData.length === 0 || submitting) && styles.bookBtnDisabled]}
          scaleTo={0.97}
          disabled={selectedTestsData.length === 0 || submitting}
          onPress={handleBookAppointment}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Text style={styles.bookBtnText}>Book appointment →</Text>
          )}
        </AnimatedPressable>
      </View>

      <CenterSelectModal
        visible={centerModalVisible}
        centers={centers}
        selectedId={selectedCenter}
        error={centersError}
        onRetry={fetchCenters}
        onSelect={(id) => {
          setSelectedCenter(id);
          setCenterModalVisible(false);
        }}
        onClose={() => setCenterModalVisible(false)}
      />

      <PaymentOptionModal
        visible={paymentModalVisible}
        payInAppTotal={paymentTotals.payInApp}
        payAtCenterTotal={paymentTotals.payAtCenter}
        onSelectPayInApp={handleSelectPayInApp}
        onSelectPayAtCenter={handleSelectPayAtCenter}
        onClose={() => setPaymentModalVisible(false)}
      />

      <SuccessModal
        visible={successVisible}
        centerName={successPayload?.centerName}
        dateLabel={successPayload?.dateLabel}
        timeLabel={successPayload?.timeLabel}
        amount={successPayload?.amount}
        onDone={handleSuccessDone}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 20 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.bodyText,
    marginBottom: 12,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 14,
    lineHeight: 18,
    marginTop: -6,
  },

  // ── Doctor's order / insurance upload box (mirrors BookMobileVisitScreen) ──
  orderRow: { flexDirection: 'row', gap: 12 },
  uploadBox: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    gap: 6,
  },
  uploadBoxDone: {
    borderColor: COLORS.green,
    backgroundColor: COLORS.greenLight,
    borderStyle: 'solid',
  },
  uploadIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navyDark },
  uploadSub: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  uploadDoneIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadDoneTitle: { fontSize: 15, fontWeight: '800', color: '#15803D' },
  uploadDoneText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#166534',
    textAlign: 'center',
    maxWidth: 220,
    marginTop: 2,
  },
  uploadChangeText: { fontSize: 12, color: '#16A34A', marginTop: 4 },

  // ── Lab tests card (mirrors BookMobileVisitScreen) ──
  labCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  labCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  labIconRing: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labHeaderText: { flex: 1 },
  labTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navyDark,
    marginBottom: 2,
  },
  labSub: { fontSize: 12, color: COLORS.gray },
  testCountBadge: {
    backgroundColor: COLORS.greenLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  testCountText: { fontSize: 12, fontWeight: '700', color: '#15803D' },
  labDivider: { height: 1, backgroundColor: COLORS.lightGray },
  labBody: { padding: 14, gap: 8 },
  testPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.offWhite,
    borderRadius: 10,
    padding: 10,
  },
  testPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  testDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.navy,
  },
  testPillName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.navyDark,
    flex: 1,
  },
  testPillPrice: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  testPillPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  testPillStrikePrice: {
    fontSize: 12,
    color: COLORS.gray,
    textDecorationLine: 'line-through',
  },
  testPillDiscountPrice: { color: COLORS.green },
  testsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingTop: 10,
    marginTop: 4,
  },
  testsTotalLabel: { fontSize: 13, fontWeight: '700', color: COLORS.bodyText },
  testsTotalValue: { fontSize: 16, fontWeight: '900', color: COLORS.navy },
  selectTestsBtnFull: {
    backgroundColor: COLORS.navy,
    margin: 12,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  selectTestsBtnFullText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },

  noFeeBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.amberLight,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    gap: 12,
    alignItems: 'flex-start',
  },
  noFeeIconRing: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  noFeeText: { flex: 1 },
  noFeeTitle: { fontSize: 14, fontWeight: '800', color: COLORS.amberText, marginBottom: 4 },
  noFeeDesc: { fontSize: 13, color: COLORS.amberText, lineHeight: 19 },

  scheduleSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EBF0FB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7D4F5',
    marginTop: 16,
  },
  scheduleIconRing: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: COLORS.navy, alignItems: 'center', justifyContent: 'center',
  },
  scheduleLabel: {
    fontSize: 11, color: COLORS.gray, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  scheduleValue: { fontSize: 14, fontWeight: '800', color: COLORS.navyDark },

  summaryCard: {
    backgroundColor: COLORS.offWhite,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: COLORS.bodyText },
  summaryValue: { fontSize: 13, fontWeight: '700', color: COLORS.navyDark },
  summaryFree: { fontSize: 13, fontWeight: '800', color: COLORS.green },
  summaryDivider: { height: 1, backgroundColor: COLORS.border, marginBottom: 10 },
  totalLabel: { fontSize: 15, fontWeight: '800', color: COLORS.navyDark },
  totalValue: { fontSize: 15, fontWeight: '900', color: COLORS.navy },

  footer: { padding: 20, borderTopWidth: 1, borderTopColor: COLORS.lightGray, backgroundColor: COLORS.white },
  bookBtn: { backgroundColor: COLORS.navy, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  bookBtnDisabled: { backgroundColor: COLORS.gray },
  bookBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});

const orderStyles = StyleSheet.create({
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  orderCardSelected: {
    borderColor: COLORS.navy,
    borderWidth: 2,
  },
  orderCardDisabled: {
    opacity: 0.45,
  },
  orderAccentBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
  },
  orderIconRing: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  orderCardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.bodyText, marginBottom: 2 },
  orderCardSubtitle: { fontSize: 12, color: COLORS.gray },
  orderCheckBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
});

const bringStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.navyDark,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  glowDot: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.navy,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerIconRing: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 15.5, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  itemsWrap: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  iconRing: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { fontSize: 13.5, fontWeight: '800', color: COLORS.white, marginBottom: 2 },
  itemDesc: { fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 17 },
});

const centerModalStyles = StyleSheet.create({
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 8,
  },
  pickerIconRing: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerName: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark, marginBottom: 3 },
  pickerMeta: { fontSize: 12, color: COLORS.gray },
  pickerPlaceholder: { fontSize: 13.5, color: COLORS.gray, fontWeight: '600' },
  pickerLoadingText: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
  pickerError: { fontSize: 11, color: COLORS.error, fontWeight: '600', marginTop: 2 },
  pickerChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pickerChangeText: { fontSize: 12.5, fontWeight: '800', color: COLORS.navy },

  backdrop: { flex: 1, backgroundColor: 'rgba(13,31,60,0.5)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SCREEN_H * 0.82,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.lightGray,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 17, fontWeight: '900', color: COLORS.navyDark },
  sheetCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  errorBannerText: { flex: 1, fontSize: 12, color: COLORS.error, fontWeight: '600' },
  errorRetry: { fontSize: 12, color: COLORS.error, fontWeight: '900', textDecorationLine: 'underline' },

  centerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 12,
  },
  centerCardSelected: { borderColor: COLORS.navy, backgroundColor: '#F0F4FF' },
  centerIconRing: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  centerName: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark, marginBottom: 3 },
  centerMeta: { fontSize: 12, color: COLORS.gray },
  radioBtn: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  radioBtnSelected: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
});
const paymentModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13,31,60,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 26,
    paddingTop: 26,
    paddingBottom: 18,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  headerIconRing: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EAF0FB',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.navyDark, textAlign: 'center' },
  subtitle: { fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 4, marginBottom: 20 },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
    gap: 12,
  },
  optionCardApp: {},
  optionCardCenter: {},
  optionAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: COLORS.sky,
  },
  optionIconRing: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navyDark, marginBottom: 2 },
  optionSub: { fontSize: 11.5, color: COLORS.gray },
  optionPrice: { fontSize: 16, fontWeight: '900', color: COLORS.navy, marginBottom: 2 },

  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.gray },
});

const successStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13,31,60,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 28,
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  ringWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  ring: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  confettiDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    top: 44,
    left: 44,
  },
  title: { fontSize: 19, fontWeight: '900', color: COLORS.navyDark, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 13.5, color: COLORS.bodyText, textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  payPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.amberLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  payPillText: { fontSize: 12.5, fontWeight: '800', color: COLORS.amberText },
  doneBtn: {
    width: '100%',
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },
  
});
