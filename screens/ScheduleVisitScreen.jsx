import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ScrollView, Animated, Easing, ActivityIndicator, LayoutAnimation, Platform, UIManager, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchPricing } from '../utils/auth';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const COLORS = {
  navy: '#1B3A8C', navyDark: '#0D1F3C', white: '#FFFFFF',
  offWhite: '#F4F7FB', lightGray: '#E8EEF5', gray: '#8A9BB0',
  bodyText: '#4A5568', border: '#D1DBE8',
  green: '#22C55E', greenLight: '#DCFCE7', greenDark: '#15803D', greenBorder: '#86EFAC',
  amber: '#D97706', amberLight: '#FEF3C7', amberBorder: '#FCD34D',
  red: '#E11D48', redLight: '#FFE4E6', redBorder: '#FDA4AF',
  purple: '#7C3AED', purpleLight: '#EDE9FE',
  teal: '#0D9488', tealLight: '#CCFBF1',
};

const CARD_WIDTH = 250;
const CARD_GAP = 12;
const DATE_ROW_H_PADDING = 20;

const generateDates = () => {
  const dates = [];
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (let i = 0; i <= 13; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push({
      id: i.toString(),
      day: date.getDate(),
      month: monthNames[date.getMonth()],
      weekday: dayNames[date.getDay()],
      isoDate: date.toISOString().split('T')[0],
      isToday: i === 0,
    });
  }
  return dates;
};

const TIME_WINDOWS = {
  morning:   { label: 'Morning',        range: '6:00 AM – 12:00 PM', icon: 'partly-sunny-outline', color: COLORS.amber,  bg: COLORS.amberLight,  border: COLORS.amberBorder,  startHour: 6,  endHour: 12 },
  afternoon: { label: 'Afternoon',      range: '12:01 – 6:00 PM',    icon: 'sunny-outline',         color: COLORS.teal,   bg: COLORS.tealLight,   border: '#99F6E4',            startHour: 12, endHour: 18 },
  evening:   { label: 'Evening/Night',  range: '6:01 PM – 12:00 AM', icon: 'moon-outline',           color: COLORS.purple, bg: COLORS.purpleLight, border: '#DDD6FE',            startHour: 18, endHour: 24 },
  lateNight: { label: 'Late Night',     range: '12:01 – 6:00 AM',    icon: 'cloudy-night-outline',   color: COLORS.navy,   bg: '#E0E7FF',           border: '#C7D2FE',            startHour: 0,  endHour: 6 },
};

const SCHEDULE_TYPES = [
  {
    key: 'flexible',
    badge: 'BEST VALUE',
    badgeColor: COLORS.green, badgeBg: COLORS.greenLight, badgeBorder: COLORS.greenBorder,
    title: 'Flexible',
    subtitle: 'Any 3-hour window. Cheapest — we optimize the exact time.',
  },
  {
    key: 'fixed',
    badge: 'POPULAR',
    badgeColor: COLORS.amber, badgeBg: COLORS.amberLight, badgeBorder: COLORS.amberBorder,
    title: 'Fixed time',
    subtitle: 'Locks a specific 1-hour slot. Costs a bit more than flexible.',
  },
  {
    key: 'urgent',
    badge: 'SOONEST',
    badgeColor: COLORS.red, badgeBg: COLORS.redLight, badgeBorder: COLORS.redBorder,
    title: 'Urgent',
    subtitle: 'Arrival within 2–4 hours from now. Highest priority pricing.',
  },
];

function buildFixedSlots(window) {
  const slots = [];
  for (let h = window.startHour; h < window.endHour; h++) {
    const start = h % 24;
    const end = (h + 1) % 24;
    const fmt = (h24) => {
      const period = h24 < 12 ? 'AM' : 'PM';
      let h12 = h24 % 12;
      if (h12 === 0) h12 = 12;
      return `${h12} ${period}`;
    };
    slots.push({ index: slots.length, startHour: start, label: `${fmt(start)} – ${fmt(end)}` });
  }
  return slots;
}

/** Springy press wrapper. */
function AnimatedPressable({ style, onPress, children, scaleTo = 0.96, disabled, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => { if (!disabled) Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 6 }).start(); };
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} disabled={disabled} style={style} {...rest}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function FadeInUp({ delay = 0, distance = 14, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

function DateCard({ date, isSelected, onPress }) {
  const lift = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const fill = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(lift, { toValue: isSelected ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 10 }),
      Animated.timing(fill, { toValue: isSelected ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [isSelected]);

  const bgColor = fill.interpolate({ inputRange: [0, 1], outputRange: [COLORS.white, COLORS.green] });
  const borderColor = fill.interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.green] });

  return (
    <AnimatedPressable onPress={onPress} scaleTo={0.94}>
      <Animated.View style={{ transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }}>
        <Animated.View style={[
          styles.dateCard,
          { backgroundColor: bgColor, borderColor },
          isSelected && styles.dateCardSelectedShadow,
        ]}>
          {date.isToday && !isSelected && (
            <View style={styles.todayPill}><Text style={styles.todayPillText}>TODAY</Text></View>
          )}
          {date.isToday && isSelected && (
            <Text style={styles.todayPillTextInline}>TODAY</Text>
          )}
          <Text style={[styles.dateWeekday, isSelected && styles.dateTextSelected]}>{date.weekday}</Text>
          <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>{date.day}</Text>
          <Text style={[styles.dateMonth, isSelected && styles.dateTextSelected]}>{date.month}</Text>
        </Animated.View>
      </Animated.View>
    </AnimatedPressable>
  );
}

/** Progress track under the date strip, follows horizontal scroll position (plain state, no Animated.Value). */
function DateScrollTrack({ scrollFraction, trackWidth }) {
  const thumbWidth = Math.max(trackWidth * 0.3, 40);
  const maxTranslate = Math.max(trackWidth - thumbWidth, 0);
  const translateX = scrollFraction * maxTranslate;
  return (
    <View style={[styles.scrollTrack, { width: trackWidth }]}>
      <View style={[styles.scrollThumb, { width: thumbWidth, transform: [{ translateX }] }]} />
    </View>
  );
}

function TimeWindowCard({ win, isSelected, onPress, delay }) {
  const fill = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: isSelected ? 1 : 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [isSelected]);

  const bgColor = fill.interpolate({ inputRange: [0, 1], outputRange: [COLORS.white, COLORS.greenLight] });
  const borderColor = fill.interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.green] });

  return (
    <FadeInUp delay={delay} style={{ flex: 1, minWidth: '47%' }}>
      <AnimatedPressable onPress={onPress} scaleTo={0.97}>
        <Animated.View style={[styles.windowCard, { backgroundColor: bgColor, borderColor }]}>
          <View style={styles.windowTopRow}>
            <View style={[styles.windowIconRing, { backgroundColor: win.bg }]}>
              <Ionicons name={win.icon} size={16} color={win.color} />
            </View>
            <Text style={styles.windowLabel}>{win.label}</Text>
            {isSelected && (
              <View style={styles.windowCheck}>
                <Ionicons name="checkmark" size={11} color={COLORS.white} />
              </View>
            )}
          </View>
          <Text style={styles.windowRange}>{win.range}</Text>
        </Animated.View>
      </AnimatedPressable>
    </FadeInUp>
  );
}

/** One scheduling-type card (Flexible / Fixed / Urgent) — fetches & shows its own price, expands to reveal slots. */
function ScheduleTypeCard({ type, isExpanded, isSelected, price, loadingPrice, onToggle, onPickSlot, selectedSlotIndex, fixedSlots, delay }) {
  const chevronAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const borderAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(chevronAnim, { toValue: isExpanded ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [isExpanded]);
  useEffect(() => {
    Animated.timing(borderAnim, { toValue: isSelected ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [isSelected]);

  const borderColor = borderAnim.interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.navy] });
  const borderWidth = borderAnim.interpolate({ inputRange: [0, 1], outputRange: [1.5, 2] });

  return (
    <FadeInUp delay={delay} style={{ width: CARD_WIDTH, marginRight: CARD_GAP }}>
      <Animated.View style={[styles.typeCard, { borderColor, borderWidth }]}>
        {isSelected && (
          <View style={styles.typeSelectedTick}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.navy} />
          </View>
        )}
        <View style={[styles.typeBadge, { backgroundColor: type.badgeBg, borderColor: type.badgeBorder }]}>
          <Text style={[styles.typeBadgeText, { color: type.badgeColor }]}>{type.badge}</Text>
        </View>
        <Text style={styles.typeTitle}>{type.title}</Text>
        <Text style={styles.typeSubtitle}>{type.subtitle}</Text>

        <View style={styles.typePriceRow}>
          <Text style={styles.typePriceFrom}>from</Text>
          {loadingPrice ? (
            <ActivityIndicator size="small" color={COLORS.navy} style={{ marginLeft: 6 }} />
          ) : (
            <Text style={styles.typePriceValue}>${price != null ? price.toFixed(0) : '—'}</Text>
          )}
          <Text style={styles.typePriceUnit}>{type.key === 'urgent' ? '/ visit' : '/ slot'}</Text>
        </View>

        <AnimatedPressable style={styles.typeToggleBtn} onPress={onToggle} scaleTo={0.98}>
          <Text style={styles.typeToggleText}>{isExpanded ? 'Hide times' : 'See times'}</Text>
          <Animated.View style={{ transform: [{ rotate: chevronAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <Ionicons name="chevron-down" size={16} color={COLORS.navy} />
          </Animated.View>
        </AnimatedPressable>

        {isExpanded && (
          <FadeInUp delay={0} distance={8}>
            <View style={styles.slotGrid}>
              {type.key === 'fixed' ? (
                fixedSlots.map((slot) => (
                  <AnimatedPressable
                    key={slot.index}
                    style={[styles.slotChip, selectedSlotIndex === slot.index && isSelected && styles.slotChipSelected]}
                    onPress={() => onPickSlot(slot.index)}
                    scaleTo={0.95}
                  >
                    <Text style={[styles.slotChipTime, selectedSlotIndex === slot.index && isSelected && styles.slotChipTimeSelected]}>
                      {slot.label}
                    </Text>
                    <Text style={[styles.slotChipPrice, selectedSlotIndex === slot.index && isSelected && styles.slotChipPriceSelected]}>
                      ${price != null ? price.toFixed(0) : '—'}
                    </Text>
                  </AnimatedPressable>
                ))
              ) : (
                <AnimatedPressable
                  style={[styles.slotChip, { flexBasis: '100%' }, isSelected && styles.slotChipSelected]}
                  onPress={() => onPickSlot(null)}
                  scaleTo={0.97}
                >
                  <Text style={[styles.slotChipTime, isSelected && styles.slotChipTimeSelected]}>
                    {type.key === 'urgent' ? 'Arrive within 2–4 hours' : 'Any 3-hour window in this slot'}
                  </Text>
                  <Text style={[styles.slotChipPrice, isSelected && styles.slotChipPriceSelected]}>
                    ${price != null ? price.toFixed(0) : '—'}
                  </Text>
                </AnimatedPressable>
              )}
            </View>
          </FadeInUp>
        )}
      </Animated.View>
    </FadeInUp>
  );
}

export default function ScheduleVisitScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { address, zipCode, testTotal = 0, returnTo = 'BookMobileVisit' } = route?.params || {};

  const dates = useMemo(() => generateDates(), []);
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedWindowKey, setSelectedWindowKey] = useState('morning');

  const [expandedType, setExpandedType] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);

  const [prices, setPrices] = useState({ flexible: null, fixed: null, urgent: null });
  const [loadingType, setLoadingType] = useState(null);
  const priceCache = useRef({});

  const [dateScrollFraction, setDateScrollFraction] = useState(0);
  const trackWidth = SCREEN_WIDTH - DATE_ROW_H_PADDING * 2;
  const dateContentWidth = dates.length * (68 + 10);
  const maxDateScroll = Math.max(dateContentWidth - trackWidth, 1);

  const handleDateScroll = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    setDateScrollFraction(Math.min(Math.max(x / maxDateScroll, 0), 1));
  };

  const selectedWindow = TIME_WINDOWS[selectedWindowKey];
  const fixedSlots = useMemo(() => buildFixedSlots(selectedWindow), [selectedWindowKey]);

  const toClockLabel = (hour24) => {
    const period = hour24 < 12 ? 'AM' : 'PM';
    let h12 = hour24 % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:00 ${period}`;
  };

  const loadPrice = async (typeKey) => {
    const slotPart = typeKey === 'fixed' ? (selectedSlotIndex ?? 'any') : 'na';
    const cacheKey = `${selectedDate.isoDate}|${selectedWindowKey}|${typeKey}|${slotPart}`;
    if (priceCache.current[cacheKey] != null) {
      setPrices((p) => ({ ...p, [typeKey]: priceCache.current[cacheKey] }));
      return;
    }
    setLoadingType(typeKey);
    try {
      const bookingTime = toClockLabel(selectedWindow.startHour);
      const res = await fetchPricing({
        address, zipCode,
        bookingDate: selectedDate.isoDate,
        bookingTime,
        slotType: typeKey,
        testTotal,
        slotIndex: typeKey === 'fixed' ? selectedSlotIndex : null,
      });
      console.log('[pricing]', typeKey, res.totalPatientFee ?? res);
      const total = res.serviceable === false ? null : Number(res.totalPatientFee) || 0;
      priceCache.current[cacheKey] = total;
      setPrices((p) => ({ ...p, [typeKey]: total }));
    } catch (err) {
      console.error(`[ScheduleVisitScreen] pricing fetch failed for ${typeKey}:`, err);
      setPrices((p) => ({ ...p, [typeKey]: null }));
    } finally {
      setLoadingType(null);
    }
  };

  useEffect(() => {
    setPrices({ flexible: null, fixed: null, urgent: null });
    priceCache.current = {};
    ['flexible', 'fixed', 'urgent'].forEach(loadPrice);
  }, [selectedDate.id, selectedWindowKey]);

  useEffect(() => {
    if (selectedSlotIndex == null) return;
    loadPrice('fixed');
  }, [selectedSlotIndex]);

  const handleToggleType = (typeKey) => {
    setExpandedType((prev) => (prev === typeKey ? null : typeKey));
  };

  const handlePickSlot = (typeKey, slotIndex) => {
    setSelectedType(typeKey);
    setSelectedSlotIndex(slotIndex);
  };

  const canConfirm = selectedType != null && (selectedType !== 'fixed' || selectedSlotIndex != null);

  const handleConfirm = () => {
    let preferredTime;
    if (selectedType === 'fixed') {
      const slot = fixedSlots[selectedSlotIndex];
      preferredTime = slot.label;
    } else if (selectedType === 'urgent') {
      preferredTime = 'ASAP (2–4 hrs)';
    } else {
      preferredTime = `${selectedWindow.label} (${selectedWindow.range})`;
    }

    navigation.navigate(returnTo, {
      scheduledDate: selectedDate.isoDate,
      scheduledDateLabel: `${selectedDate.month} ${selectedDate.day} (${selectedDate.weekday})`,
      scheduledTimeLabel: preferredTime,
      preferredTime,
      slotType: selectedType,
      slotIndex: selectedType === 'fixed' ? selectedSlotIndex : null,
      timeWindow: selectedWindowKey,
      totalPatientFee: prices[selectedType],
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <AnimatedPressable style={styles.backBtn} onPress={() => navigation.goBack()} scaleTo={0.85}>
          <Ionicons name="arrow-back" size={20} color={COLORS.navyDark} />
        </AnimatedPressable>
        <View>
          <Text style={styles.headerTitle}>Book an appointment</Text>
          <Text style={styles.headerSub}>Choose when — and how — you want your slot.</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Step 1: Day & date */}
        <FadeInUp delay={0}>
          <View style={[styles.stepHeaderRow, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
              <Text style={styles.stepTitle}>Day & date</Text>
            </View>
            <Text style={styles.stepHeaderRight}>{selectedDate.month} {selectedDate.day} ({selectedDate.weekday})</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateRow}
            onScroll={handleDateScroll}
            scrollEventThrottle={16}
          >
            {dates.map((date) => (
              <DateCard key={date.id} date={date} isSelected={selectedDate.id === date.id} onPress={() => setSelectedDate(date)} />
            ))}
          </ScrollView>

          <DateScrollTrack scrollFraction={dateScrollFraction} trackWidth={trackWidth} />
        </FadeInUp>

        {/* Step 2: Time of day */}
        <FadeInUp delay={60}>
          <View style={[styles.stepHeaderRow, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
              <Text style={styles.stepTitle}>Time of day</Text>
            </View>
            <Text style={styles.stepHeaderRight}>{selectedWindow.range}</Text>
          </View>
        </FadeInUp>
        <View style={styles.windowGrid}>
          {Object.entries(TIME_WINDOWS).map(([key, win], i) => (
            <TimeWindowCard key={key} win={win} isSelected={selectedWindowKey === key} onPress={() => setSelectedWindowKey(key)} delay={90 + i * 30} />
          ))}
        </View>

        {/* Step 3: Scheduling type */}
        <FadeInUp delay={180}>
          <View style={styles.stepHeaderRow}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
            <Text style={styles.stepTitle}>How do you want to schedule?</Text>
            <Text style={styles.stepHeaderTag}>Lowest price first</Text>
          </View>
        </FadeInUp>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          decelerationRate="fast"
          contentContainerStyle={styles.typeScrollContent}
        >
          {SCHEDULE_TYPES.map((type, i) => (
            <ScheduleTypeCard
              key={type.key}
              type={type}
              delay={210 + i * 40}
              isExpanded={expandedType === type.key}
              isSelected={selectedType === type.key}
              price={prices[type.key]}
              loadingPrice={loadingType === type.key}
              onToggle={() => handleToggleType(type.key)}
              onPickSlot={(idx) => handlePickSlot(type.key, idx)}
              selectedSlotIndex={selectedSlotIndex}
              fixedSlots={fixedSlots}
            />
          ))}
        </ScrollView>
        <Text style={styles.swipeHint}>‹ swipe to compare all three ›</Text>

        <FadeInUp delay={360}>
          <View style={styles.priceRuleBanner}>
            <View style={[styles.priceRuleDot, { backgroundColor: COLORS.green }]} />
            <Text style={styles.priceRuleText}>Flexible = lowest</Text>
            <View style={[styles.priceRuleDot, { backgroundColor: COLORS.amber }]} />
            <Text style={styles.priceRuleText}>Fixed = mid</Text>
            <View style={[styles.priceRuleDot, { backgroundColor: COLORS.red }]} />
            <Text style={styles.priceRuleText}>Urgent = highest</Text>
          </View>
        </FadeInUp>
      </ScrollView>

      <View style={styles.footer}>
        {!canConfirm && <Text style={styles.footerHint}>Select a time slot to continue</Text>}
        <AnimatedPressable
          style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm}
          scaleTo={0.97}
        >
          <Text style={styles.confirmBtnText}>
            {canConfirm && prices[selectedType] != null
              ? `Confirm booking · $${prices[selectedType].toFixed(0)}`
              : 'Confirm booking'}
          </Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 16, fontWeight: '900', color: COLORS.navyDark },
  headerSub: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 20 },

  stepHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 12 },
  stepBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.navyDark, alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '900' },
  stepTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navyDark },
  stepHeaderRight: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  stepHeaderTag: { marginLeft: 'auto', fontSize: 11, color: COLORS.gray, fontWeight: '600' },

  dateRow: { gap: 10, paddingRight: 4, paddingTop: 4 },
  dateCard: { width: 68, alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: COLORS.border },
  dateCardSelectedShadow: { elevation: 4, shadowColor: COLORS.green, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6 },
  todayPill: { position: 'absolute', top: -8, backgroundColor: COLORS.navy, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  todayPillText: { color: COLORS.white, fontSize: 8, fontWeight: '900' },
  todayPillTextInline: { color: COLORS.white, fontSize: 8.5, fontWeight: '900', marginBottom: 4, letterSpacing: 0.3, opacity: 0.9 },
  dateWeekday: { fontSize: 10, color: COLORS.gray, fontWeight: '700', marginTop: 6, marginBottom: 4 },
  dateDay: { fontSize: 18, color: COLORS.navyDark, fontWeight: '900' },
  dateMonth: { fontSize: 11, color: COLORS.gray, fontWeight: '600', marginTop: 2 },
  dateTextSelected: { color: COLORS.white },

  scrollTrack: { height: 3, backgroundColor: COLORS.lightGray, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  scrollThumb: { height: 3, backgroundColor: COLORS.navy, borderRadius: 2 },

  windowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  windowCard: { minWidth: '47%', flex: 1, borderRadius: 14, padding: 12, borderWidth: 1.5 },
  windowTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  windowIconRing: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  windowLabel: { fontSize: 13, fontWeight: '800', color: COLORS.navyDark, flexShrink: 1 },
  windowRange: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  windowCheck: { marginLeft: 'auto', width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },

  typeScrollContent: { paddingRight: 20, paddingTop: 2 },
  typeCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, position: 'relative' },
  typeSelectedTick: { position: 'absolute', top: 12, right: 12 },
  typeBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, marginBottom: 10 },
  typeBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  typeTitle: { fontSize: 16, fontWeight: '900', color: COLORS.navyDark, marginBottom: 4 },
  typeSubtitle: { fontSize: 12, color: COLORS.gray, lineHeight: 17, marginBottom: 12 },
  typePriceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  typePriceFrom: { fontSize: 12, color: COLORS.gray, marginRight: 4 },
  typePriceValue: { fontSize: 20, fontWeight: '900', color: COLORS.green },
  typePriceUnit: { fontSize: 12, color: COLORS.gray, marginLeft: 4 },
  typeToggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 12 },
  typeToggleText: { fontSize: 13, fontWeight: '800', color: COLORS.navyDark },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  slotChip: { flexBasis: '47%', flexGrow: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10, backgroundColor: COLORS.offWhite },
  slotChipSelected: { borderColor: COLORS.navy, backgroundColor: '#EAF0FB' },
  slotChipTime: { fontSize: 12, fontWeight: '700', color: COLORS.bodyText },
  slotChipTimeSelected: { color: COLORS.navyDark },
  slotChipPrice: { fontSize: 13, fontWeight: '900', color: COLORS.navy, marginTop: 4 },
  slotChipPriceSelected: { color: COLORS.navy },

  swipeHint: { textAlign: 'center', fontSize: 11, color: COLORS.gray, fontWeight: '600', marginTop: 6, marginBottom: 4 },

  priceRuleBanner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, backgroundColor: COLORS.offWhite, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginTop: 8 },
  priceRuleDot: { width: 8, height: 8, borderRadius: 4 },
  priceRuleText: { fontSize: 11, color: COLORS.bodyText, fontWeight: '600', marginRight: 8 },

  footer: { padding: 20, borderTopWidth: 1, borderTopColor: COLORS.lightGray, backgroundColor: COLORS.white },
  footerHint: { textAlign: 'center', fontSize: 12, color: COLORS.gray, marginBottom: 10 },
  confirmBtn: { backgroundColor: COLORS.navy, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: COLORS.lightGray },
  confirmBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});
