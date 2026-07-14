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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getStoredPatientUser, bookAppointment } from '../utils/auth';

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
};

const CENTERS = [
  {
    id: '1',
    name: 'MusB Diagnostics - New Port Richey',
    address: '6331 State Road, New Port Richey, FL 34653',
    lat: 28.21778,
    lng: -82.70957,
    hours: 'Open until 6 PM', // TODO: confirm real hours with the team
    icon: 'business',
  },
];

// ── Date / time helpers ──────────────────────────────────────────────────
const generateDates = () => {
  const dates = [];
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  for (let i = 0; i <= 13; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push({
      id: i.toString(),
      day: date.getDate(),
      month: monthNames[date.getMonth()],
      weekday: dayNames[date.getDay()],
      isoDate: date.toISOString().split('T')[0],
    });
  }
  return dates;
};

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];
const PERIODS = ['AM', 'PM'];

function to24Hour(hour12, period) {
  let h = parseInt(hour12, 10) % 12;
  if (period === 'PM') h += 12;
  return h;
}

// Rounds "now" up to the next valid 15-min slot
function nextValidSlot(date = new Date()) {
  let h24 = date.getHours();
  let m = date.getMinutes();
  const roundedMinute = Math.ceil(m / 15) * 15;
  if (roundedMinute === 60) {
    m = 0;
    h24 = (h24 + 1) % 24;
  } else {
    m = roundedMinute;
  }
  const period = h24 >= 12 ? 'PM' : 'AM';
  let hour12 = h24 % 12;
  if (hour12 === 0) hour12 = 12;
  return {
    hour: String(hour12).padStart(2, '0'),
    minute: String(m).padStart(2, '0'),
    period,
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

/** A single date pill that lifts slightly when selected. */
function DateCard({ date, isSelected, onPress }) {
  const lift = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(lift, { toValue: isSelected ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
  }, [isSelected]);

  return (
    <AnimatedPressable onPress={onPress} scaleTo={0.94}>
      <Animated.View
        style={[
          pickerStyles.dateCard,
          isSelected && pickerStyles.dateCardSelected,
          { transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
        ]}
      >
        <Text style={[pickerStyles.dateWeekday, isSelected && pickerStyles.dateTextSelected]}>{date.weekday}</Text>
        <Text style={[pickerStyles.dateDay, isSelected && pickerStyles.dateTextSelected]}>{date.day}</Text>
        <Text style={[pickerStyles.dateMonth, isSelected && pickerStyles.dateTextSelected]}>{date.month}</Text>
      </Animated.View>
    </AnimatedPressable>
  );
}

/** A single tappable chip — used for hour/minute options. Springs on selection. */
function TimeChip({ label, isSelected, isDisabled, onPress }) {
  const scale = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: isSelected ? 1 : 0, useNativeDriver: false, speed: 22, bounciness: 8 }).start();
  }, [isSelected]);

  const bg = scale.interpolate({ inputRange: [0, 1], outputRange: [COLORS.white, COLORS.navy] });
  const borderColor = scale.interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.navy] });

  return (
    <TouchableOpacity onPress={() => !isDisabled && onPress()} activeOpacity={isDisabled ? 1 : 0.8} disabled={isDisabled}>
      <Animated.View
        style={[
          pickerStyles.chip,
          { backgroundColor: isDisabled ? COLORS.offWhite : bg, borderColor: isDisabled ? COLORS.lightGray : borderColor },
        ]}
      >
        <Text
          style={[
            pickerStyles.chipText,
            isSelected && pickerStyles.chipTextSelected,
            isDisabled && pickerStyles.chipTextDisabled,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

/** Horizontal row of tappable chips — replaces the old vertical wheel picker,
 *  which suffered gesture conflicts when nested inside the screen's own
 *  vertical ScrollView (selected values could scroll out of view and taps
 *  could get swallowed by the parent scroll). */
function ChipRow({ data, selected, onSelect, isDisabled }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={pickerStyles.chipRow}
    >
      {data.map((item) => (
        <TimeChip
          key={item}
          label={item}
          isSelected={item === selected}
          isDisabled={isDisabled ? isDisabled(item) : false}
          onPress={() => onSelect(item)}
        />
      ))}
    </ScrollView>
  );
}

/** Two-button AM/PM toggle — plain, always fully visible, no scroll involved. */
function PeriodToggle({ selected, onSelect, isDisabled }) {
  return (
    <View style={pickerStyles.periodRow}>
      {PERIODS.map((p) => {
        const isSelected = p === selected;
        const disabled = isDisabled ? isDisabled(p) : false;
        return (
          <TouchableOpacity
            key={p}
            onPress={() => !disabled && onSelect(p)}
            activeOpacity={disabled ? 1 : 0.8}
            disabled={disabled}
            style={[
              pickerStyles.periodBtn,
              isSelected && pickerStyles.periodBtnSelected,
              disabled && pickerStyles.periodBtnDisabled,
            ]}
          >
            <Text
              style={[
                pickerStyles.periodText,
                isSelected && pickerStyles.periodTextSelected,
                disabled && pickerStyles.chipTextDisabled,
              ]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function InPersonTestsScreen({ navigation, route }) {
  const [selectedTestsData, setSelectedTestsData] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [patientUser, setPatientUser] = useState(null);
  const isGuest = route?.params?.isGuest === true;

  // ── Date / time state ──
  const dates = generateDates();
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState('AM');

  // Pick up tests returned from SelectTestsScreen
  useEffect(() => {
    if (route?.params?.selectedTestsData) {
      setSelectedTestsData(route.params.selectedTestsData);
    }
  }, [route?.params?.selectedTestsData]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      getStoredPatientUser().then(setPatientUser);
    });
    return unsub;
  }, [navigation]);

  const testsTotal = selectedTestsData.reduce(
    (sum, t) => sum + (t.discountPrice != null ? t.discountPrice : t.price),
    0
  );
  const selectedTestIds = selectedTestsData.map((t) => t.id);
  const center = CENTERS.find((c) => c.id === selectedCenter);

  const formattedTime = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
  const formattedDateLabel = `${selectedDate.month} ${selectedDate.day} (${selectedDate.weekday})`;

  // ── Past-time validation (today only) ──
  const now = new Date();
  const todayIso = now.toISOString().split('T')[0];
  const isToday = selectedDate.isoDate === todayIso;
  const nowHour24 = now.getHours();
  const nowMinute = now.getMinutes();

  const isPeriodDisabled = (period) => isToday && period === 'AM' && nowHour24 >= 12;

  const isHourDisabled = (hour12) => {
    if (!isToday) return false;
    const h24 = to24Hour(hour12, selectedPeriod);
    return h24 < nowHour24;
  };

  const isMinuteDisabled = (minute) => {
    if (!isToday) return false;
    const h24 = to24Hour(selectedHour, selectedPeriod);
    if (h24 !== nowHour24) return false;
    return parseInt(minute, 10) < nowMinute;
  };

  // Auto-bump forward to the next valid slot whenever the selection would
  // otherwise land in the past (date changed to today, or period/hour
  // flipped underneath an already-past selection).
  useEffect(() => {
    if (!isToday) return;
    const h24 = to24Hour(selectedHour, selectedPeriod);
    const selectedTotalMinutes = h24 * 60 + parseInt(selectedMinute, 10);
    const nowTotalMinutes = nowHour24 * 60 + nowMinute;
    if (selectedTotalMinutes < nowTotalMinutes) {
      const next = nextValidSlot(now);
      setSelectedHour(next.hour);
      setSelectedMinute(next.minute);
      setSelectedPeriod(next.period);
    }
  }, [selectedDate.isoDate, selectedPeriod, selectedHour, selectedMinute]);

  const goToSelectTests = () => {
    navigation.navigate('SelectTests', {
      returnTo: 'InPersonTests',
      initialSelectedIds: selectedTestIds,
    });
  };

  const handleBookAppointment = () => {
    if (selectedTestsData.length === 0) {
      Alert.alert('No tests selected', 'Please select at least one test before booking.');
      return;
    }

    if (isGuest && !patientUser) {
      navigation.navigate('GuestInfo', {
        returnTo: 'InPersonTests',
        isGuest: true,
      });
      return;
    }

    Alert.alert(
      'Choose payment option',
      `Total: $${testsTotal.toFixed(0)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay at center', onPress: () => confirmBooking('pay_at_center') },
        { text: 'Pay in app', onPress: payInApp },
      ]
    );
  };

  const payInApp = () => {
    navigation.navigate('Checkout', {
      mobileVisitTotal: 0, // no visit fee for in-person
      labTestsTotal: testsTotal,
      labTestsNames: selectedTestsData.map((t) => t.name).join(', '),
      address: center?.address || '',
      visitType: 'in_person',
      preferredDate: selectedDate.isoDate,
      preferredTime: formattedTime,
    });
  };

  const confirmBooking = async (paymentMethod) => {
    setSubmitting(true);
    try {
      const result = await bookAppointment({
        test_name: selectedTestsData.map((t) => t.name).join(', '),
        test_price: testsTotal,
        full_name: patientUser?.name || '',
        email: patientUser?.email || '',
        phone: patientUser?.phone || '',
        address: center?.address || '',
        visit_type: 'in_person',
        preferred_date: selectedDate.isoDate,
        preferred_time: formattedTime,
        payment_method: paymentMethod === 'pay_at_center' ? 'Pay at Center' : 'Card',
      });

      Alert.alert(
        '✅ Appointment booked!',
        paymentMethod === 'pay_at_center'
          ? `Your visit to ${center?.name} on ${formattedDateLabel} at ${formattedTime} is confirmed. Please pay $${testsTotal.toFixed(0)} at the center.`
          : 'Your appointment is confirmed.',
        [{ text: 'OK', onPress: () => navigation.navigate('PatientHome') }]
      );
    } catch (err) {
      Alert.alert('Booking failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
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
        {/* Tests Section */}
        <FadeInUp delay={0}>
          <Text style={styles.sectionLabel}>Selected tests</Text>
        </FadeInUp>

        {selectedTestsData.length === 0 ? (
          <FadeInUp delay={40}>
            <View style={styles.emptyTestsCard}>
              <View style={styles.emptyIconRing}>
                <Ionicons name="flask-outline" size={20} color={COLORS.gray} />
              </View>
              <Text style={styles.emptyTestsText}>No tests selected yet</Text>
            </View>
          </FadeInUp>
        ) : (
          selectedTestsData.map((test, i) => {
            const hasDiscount = test.discountPrice != null && test.discountPrice < test.price;
            return (
              <FadeInUp key={test.id} delay={40 + i * 40} distance={10}>
                <View style={styles.testCard}>
                  <View style={styles.testIconRing}>
                    <Ionicons name="flask" size={18} color={COLORS.navy} />
                  </View>
                  <View style={styles.testInfo}>
                    <Text style={styles.testName}>{test.name}</Text>
                    {test.desc ? <Text style={styles.testDesc}>{test.desc}</Text> : null}
                  </View>
                  {hasDiscount ? (
                    <View style={styles.testPriceCol}>
                      <Text style={styles.testPriceStrike}>${test.price.toFixed(0)}</Text>
                      <Text style={styles.testPriceDiscount}>${test.discountPrice.toFixed(0)}</Text>
                    </View>
                  ) : (
                    <Text style={styles.testPrice}>${test.price.toFixed(0)}</Text>
                  )}
                </View>
              </FadeInUp>
            );
          })
        )}

        <FadeInUp delay={100}>
          <AnimatedPressable style={styles.selectTestsBtn} onPress={goToSelectTests} scaleTo={0.98}>
            <Ionicons
              name={selectedTestsData.length === 0 ? 'add-circle-outline' : 'create-outline'}
              size={17}
              color={COLORS.navy}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.selectTestsBtnText}>
              {selectedTestsData.length === 0 ? 'Browse discounted lab tests' : 'Edit tests'}
            </Text>
          </AnimatedPressable>
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

        {/* Select Center */}
        <FadeInUp delay={180}>
          <Text style={styles.sectionLabel}>Select center</Text>
        </FadeInUp>

        {CENTERS.map((c, i) => {
          const isSelected = selectedCenter === c.id;
          return (
            <FadeInUp key={c.id} delay={200 + i * 40}>
              <AnimatedPressable
                style={[styles.centerCard, isSelected && styles.centerCardSelected]}
                onPress={() => setSelectedCenter(c.id)}
                scaleTo={0.98}
              >
                <View style={[styles.centerIconRing, isSelected && styles.centerIconRingSelected]}>
                  <Ionicons name={c.icon} size={20} color={isSelected ? COLORS.navy : COLORS.gray} />
                </View>
                <View style={styles.centerInfo}>
                  <Text style={[styles.centerName, isSelected && styles.centerNameSelected]}>
                    {c.name}
                  </Text>
                  <Text style={styles.centerMeta}>{c.address}</Text>
                  <Text style={styles.centerMeta}>{c.hours}</Text>
                </View>
                <View style={[styles.radioBtn, isSelected && styles.radioBtnSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                </View>
              </AnimatedPressable>
            </FadeInUp>
          );
        })}

        {/* Select Date */}
        <FadeInUp delay={260}>
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Select date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={pickerStyles.dateRow}
          >
            {dates.map((date) => (
              <DateCard
                key={date.id}
                date={date}
                isSelected={selectedDate.id === date.id}
                onPress={() => setSelectedDate(date)}
              />
            ))}
          </ScrollView>
        </FadeInUp>

        {/* Select Time */}
        <FadeInUp delay={300}>
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Select arrival time</Text>
          <View style={pickerStyles.timePickerCard}>
            <Text style={pickerStyles.chipRowLabel}>Hour</Text>
            <ChipRow data={HOURS} selected={selectedHour} onSelect={setSelectedHour} isDisabled={isHourDisabled} />

            <Text style={[pickerStyles.chipRowLabel, { marginTop: 14 }]}>Minute</Text>
            <ChipRow data={MINUTES} selected={selectedMinute} onSelect={setSelectedMinute} isDisabled={isMinuteDisabled} />

            <Text style={[pickerStyles.chipRowLabel, { marginTop: 14 }]}>Period</Text>
            <PeriodToggle selected={selectedPeriod} onSelect={setSelectedPeriod} isDisabled={isPeriodDisabled} />
          </View>
        </FadeInUp>

        {/* Schedule summary */}
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

        {/* Price Summary */}
        <FadeInUp delay={380}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tests subtotal</Text>
              <Text style={styles.summaryValue}>${testsTotal.toFixed(0)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Visit fee</Text>
              <Text style={styles.summaryFree}>FREE</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${testsTotal.toFixed(0)}</Text>
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

  emptyTestsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.offWhite,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  emptyIconRing: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  emptyTestsText: { color: COLORS.gray, fontSize: 13, fontWeight: '600' },

  testCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  testIconRing: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: '#EAF0FB', alignItems: 'center', justifyContent: 'center',
  },
  testInfo: { flex: 1 },
  testName: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark, marginBottom: 2 },
  testDesc: { fontSize: 12, color: COLORS.gray },
  testPrice: { fontSize: 14, fontWeight: '800', color: COLORS.navyDark },
  testPriceCol: { alignItems: 'flex-end' },
  testPriceStrike: { fontSize: 12, color: COLORS.gray, textDecorationLine: 'line-through' },
  testPriceDiscount: { fontSize: 14, fontWeight: '800', color: COLORS.green },

  selectTestsBtn: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: '#F5F8FF',
  },
  selectTestsBtnText: { color: COLORS.navy, fontWeight: '800', fontSize: 14 },

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  centerCardSelected: { borderColor: COLORS.navy, backgroundColor: '#F0F4FF' },
  centerIconRing: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
  },
  centerIconRingSelected: { backgroundColor: '#E0E9FA' },
  centerInfo: { flex: 1 },
  centerName: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark, marginBottom: 3 },
  centerNameSelected: { color: COLORS.navy },
  centerMeta: { fontSize: 12, color: COLORS.gray },
  radioBtn: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  radioBtnSelected: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },

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

const pickerStyles = StyleSheet.create({
  dateRow: { gap: 10, paddingRight: 4, paddingTop: 2, paddingBottom: 4 },
  dateCard: {
    width: 70,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  dateCardSelected: {
    borderColor: COLORS.navy,
    backgroundColor: '#F0F4FF',
    elevation: 4,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  dateWeekday: { fontSize: 11, color: COLORS.gray, fontWeight: '600', marginBottom: 4 },
  dateDay: { fontSize: 18, color: COLORS.navyDark, fontWeight: '900' },
  dateMonth: { fontSize: 12, color: COLORS.gray, fontWeight: '600', marginTop: 2 },
  dateTextSelected: { color: COLORS.navy },

  timePickerCard: {
    backgroundColor: COLORS.offWhite,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipRowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipRow: { gap: 8, paddingRight: 4, paddingVertical: 2 },
  chip: {
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 15, color: COLORS.bodyText, fontWeight: '700' },
  chipTextSelected: { color: COLORS.white },
  chipTextDisabled: { color: COLORS.lightGray, textDecorationLine: 'line-through' },

  periodRow: { flexDirection: 'row', gap: 10 },
  periodBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBtnSelected: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  periodBtnDisabled: { backgroundColor: COLORS.offWhite, borderColor: COLORS.lightGray },
  periodText: { fontSize: 15, fontWeight: '800', color: COLORS.bodyText },
  periodTextSelected: { color: COLORS.white },
});
