import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { fetchPricing } from '../utils/auth';
import { getBookingDraft, setBookingDraft } from '../utils/bookingDraft';

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
  pathA: '#4F46E5',
  pathABg: '#EDE9FE',
  red: '#E63946',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  amberBorder: '#FCD34D',
  purple: '#7C3AED',
  purpleLight: '#EDE9FE',
  teal: '#0D9488',
  tealLight: '#CCFBF1',
};

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
const ITEM_HEIGHT = 44;

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

/** Icon that pops in with a little overshoot. */
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

/** Icon badge that gently, continuously pulses — used on the scheduled summary card. */
function PulsingIconBadge({ children, style }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={style}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
          },
        ]}
      />
      {children}
    </View>
  );
}

/** Doctor's-order selectable card — icon ring, accent bar, checkmark badge, press animation. */
function OrderOptionCard({ icon, accent, accentBg, title, subtitle, selected, onPress, delay }) {
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
        style={[styles.orderCard, selected && styles.orderCardSelected]}
        onPress={onPress}
        scaleTo={0.96}
      >
        <View style={[styles.orderAccentBar, { backgroundColor: accent }]} />
        <View style={[styles.orderIconRing, { backgroundColor: accentBg }]}>
          <Ionicons name={icon} size={22} color={accent} />
        </View>
        <Text style={[styles.orderCardTitle, selected && { color: COLORS.navyDark }]}>{title}</Text>
        <Text style={styles.orderCardSubtitle}>{subtitle}</Text>

        <Animated.View
          style={[
            styles.orderCheckBadge,
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

/** A single date pill that springs up slightly when selected. */
function DateCard({ date, isSelected, onPress }) {
  const lift = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(lift, {
      toValue: isSelected ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  }, [isSelected]);

  return (
    <AnimatedPressable onPress={onPress} scaleTo={0.94}>
      <Animated.View
        style={[
          styles.dateCard,
          isSelected && styles.dateCardSelected,
          {
            transform: [
              { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
            ],
          },
        ]}
      >
        <Text style={[styles.dateWeekday, isSelected && styles.dateTextSelected]}>{date.weekday}</Text>
        <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>{date.day}</Text>
        <Text style={[styles.dateMonth, isSelected && styles.dateTextSelected]}>{date.month}</Text>
      </Animated.View>
    </AnimatedPressable>
  );
}

/** A single time-picker item that springs into a highlighted pill when selected. */
function TimePickerItem({ item, isSelected, onSelect }) {
  const highlight = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(highlight, {
      toValue: isSelected ? 1 : 0,
      useNativeDriver: false,
      speed: 22,
      bounciness: 6,
    }).start();
  }, [isSelected]);

  const bg = highlight.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(232,238,245,0)', COLORS.lightGray],
  });

  return (
    <TouchableOpacity onPress={() => onSelect(item)} activeOpacity={0.7}>
      <Animated.View style={[styles.pickerItem, { backgroundColor: bg }]}>
        <Text style={[styles.pickerText, isSelected && styles.pickerTextSelected]}>
          {item}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function ScrollPicker({ data, selected, onSelect }) {
  return (
    <ScrollView
      style={styles.pickerScroll}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      nestedScrollEnabled={true}
    >
      <View style={{ height: ITEM_HEIGHT }} />
      {data.map((item) => (
        <TimePickerItem
          key={item}
          item={item}
          isSelected={item === selected}
          onSelect={onSelect}
        />
      ))}
      <View style={{ height: ITEM_HEIGHT }} />
    </ScrollView>
  );
}

export default function BookMobileVisitScreen({ navigation, route }) {
  // Read-only — address is set on HomeScreen only, never edited here
  const bookingDraft = getBookingDraft();

  const address = bookingDraft.address;
  const latitude = bookingDraft.latitude;
  const longitude = bookingDraft.longitude;
  const useGps = bookingDraft.useGps;
  const zipCode = bookingDraft.zipCode;

  const dates = generateDates();
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState('AM');

  const [doctorOrder, setDoctorOrder] = useState(bookingDraft.doctorOrder || 'self');
  const [prescriptionFile, setPrescriptionFile] = useState(bookingDraft.prescriptionFile || null);

  const [selectedTests, setSelectedTests] = useState(bookingDraft.selectedTestsData || []);
  const [testsTotal, setTestsTotal] = useState(bookingDraft.testsTotal || 0);

  // Pick up tests returned from SelectTests
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const params = route?.params;
      if (params?.selectedTestsData) {
        setSelectedTests(params.selectedTestsData);
        setTestsTotal(params.testsTotal ?? 0);
        setBookingDraft({
          selectedTestsData: params.selectedTestsData,
          testsTotal: params.testsTotal ?? 0,
        });
      }
    });
    return unsubscribe;
  }, [navigation, route]);

  const formattedTime = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
  const formattedDateLabel = `${selectedDate.month} ${selectedDate.day} (${selectedDate.weekday})`;

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/png', 'image/jpeg'],
        copyToCacheDirectory: true,
      });
      if (result.canceled === false && result.assets?.length > 0) {
        setPrescriptionFile(result.assets[0]);
        setBookingDraft({ prescriptionFile: result.assets[0] });
      } else if (result.type === 'success') {
        setPrescriptionFile(result);
        setBookingDraft({ prescriptionFile: result });
      }
    } catch (err) {
      console.warn('Document pick error:', err);
    }
  };

  const handleSelectDoctorOrder = (value) => {
    setDoctorOrder(value);
    setBookingDraft({ doctorOrder: value });
    if (value === 'order') {
      setSelectedTests([]);
      setTestsTotal(0);
      setBookingDraft({ selectedTestsData: [], testsTotal: 0 });
    }
    if (value === 'self') {
      setPrescriptionFile(null);
      setBookingDraft({ prescriptionFile: null });
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
        <Text style={styles.headerTitle}>Book mobile visit</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Visit Address (read-only — set on Home screen) */}
        <FadeInUp delay={0}>
          <Text style={styles.sectionLabel}>Visit address</Text>
          <View style={styles.addressCard}>
            <View style={styles.addressIconRing}>
              <IconPop delay={80}>
                <Ionicons name="location" size={20} color={COLORS.navy} />
              </IconPop>
            </View>
            <Text style={styles.addressDisplayText} numberOfLines={2}>
              {address || 'No address set'}
            </Text>
          </View>
        </FadeInUp>

        {/* Doctor's Order */}
        <FadeInUp delay={60}>
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
            delay={90}
          />
          <OrderOptionCard
            icon="document-text-outline"
            accent={COLORS.purple}
            accentBg={COLORS.purpleLight}
            title="Doctor's order"
            subtitle="I have a request"
            selected={doctorOrder === 'order'}
            onPress={() => handleSelectDoctorOrder('order')}
            delay={130}
          />
        </View>

        {/* Upload box — only when doctor's order selected */}
        {doctorOrder === 'order' && (
          <FadeInUp delay={0}>
            <AnimatedPressable
              style={[styles.uploadBox, prescriptionFile && styles.uploadBoxDone]}
              onPress={handlePickDocument}
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
                  <Text style={styles.uploadTitle}>Click to Upload or Drag File</Text>
                  <Text style={styles.uploadSub}>PDF, PNG, JPG up to 10MB</Text>
                </>
              )}
            </AnimatedPressable>
          </FadeInUp>
        )}

        {/* Lab Tests Section */}
        <FadeInUp delay={180}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>Lab tests</Text>
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalBadgeText}>
                {doctorOrder === 'order' ? 'Optional' : 'optional'}
              </Text>
            </View>
          </View>

          {doctorOrder === 'order' && (
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerIcon}>ℹ️</Text>
              <Text style={styles.infoBannerText}>
                Your doctor's order already specifies the tests. You can
                still add extra tests below if needed — or skip this step.
              </Text>
            </View>
          )}

          <View style={styles.labCard}>
            <View style={styles.labCardHeader}>
              <View style={styles.labIconRing}>
                <View style={styles.labIconWrap}>
                  <IconPop delay={220}>
                    <Ionicons name="flask" size={22} color={COLORS.purple} />
                  </IconPop>
                </View>
              </View>
              <View style={styles.labHeaderText}>
                <Text style={styles.labTitle}>
                  {doctorOrder === 'order' ? 'Add extra tests (optional)' : 'Do you want to buy a discounted lab test?'}
                </Text>
                <Text style={styles.labSub}>
                  {doctorOrder === 'order'
                    ? 'Your doctor order covers the main tests'
                    : 'Choose from our full test catalogue'}
                </Text>
              </View>
              {selectedTests.length > 0 && (
                <View style={styles.testCountBadge}>
                  <Text style={styles.testCountText}>{selectedTests.length} selected</Text>
                </View>
              )}
            </View>

            {selectedTests.length > 0 && (
              <>
                <View style={styles.labDivider} />
                <View style={styles.labBody}>
                  {selectedTests.map((test, i) => (
                    <FadeInUp key={test.id ?? i} delay={i * 50} distance={8}>
                      <View style={styles.testPill}>
                        <View style={styles.testPillLeft}>
                          <View style={styles.testDot} />
                          <Text style={styles.testPillName} numberOfLines={1}>
                            {test.name}
                          </Text>
                        </View>
                        <Text style={styles.testPillPrice}>${test.price.toFixed(0)}</Text>
                      </View>
                    </FadeInUp>
                  ))}
                  <View style={styles.testsTotalRow}>
                    <Text style={styles.testsTotalLabel}>Tests subtotal</Text>
                    <Text style={styles.testsTotalValue}>${testsTotal.toFixed(0)}</Text>
                  </View>
                </View>
              </>
            )}

            <AnimatedPressable
              style={[
                styles.selectTestsBtn,
                doctorOrder === 'order' && selectedTests.length === 0 && styles.selectTestsBtnOptional,
              ]}
              scaleTo={0.97}
              onPress={() =>
                navigation.push('SelectTests', {
                  returnTo: 'BookMobileVisit',
                  initialSelectedIds: selectedTests.map((t) => t.id),
                })
              }
            >
              <Text style={[
                styles.selectTestsBtnText,
                doctorOrder === 'order' && selectedTests.length === 0 && styles.selectTestsBtnOptionalText,
              ]}>
                {selectedTests.length > 0
                  ? '＋ Add or change tests'
                  : doctorOrder === 'order'
                  ? '＋ Add extra tests (optional)'
                  : '＋ Browse and select tests'}
              </Text>
            </AnimatedPressable>

            {doctorOrder === 'order' && selectedTests.length === 0 && (
              <Text style={styles.skipHint}>
                You can proceed without selecting extra tests.
              </Text>
            )}
          </View>
        </FadeInUp>

        {/* Date Picker */}
        <FadeInUp delay={220}>
          <Text style={styles.sectionLabel}>Select date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateRow}
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

        {/* Time Picker */}
        <FadeInUp delay={260}>
          <Text style={styles.sectionLabel}>Select arrival time</Text>
          <View style={styles.timePickerCard}>
            <View style={styles.pickerRow}>
              <ScrollPicker data={HOURS} selected={selectedHour} onSelect={setSelectedHour} />
              <Text style={styles.colon}>:</Text>
              <ScrollPicker data={MINUTES} selected={selectedMinute} onSelect={setSelectedMinute} />
              <ScrollPicker data={PERIODS} selected={selectedPeriod} onSelect={setSelectedPeriod} />
            </View>
          </View>
        </FadeInUp>

        {/* Mobile visit note */}
        <FadeInUp delay={300}>
          <View style={styles.mobileNote}>
            <Ionicons name="medkit-outline" size={18} color={COLORS.navyDark} style={{ marginRight: 10 }} />
            <Text style={styles.mobileNoteText}>
              A licensed phlebotomist will be assigned automatically after booking.
            </Text>
          </View>
        </FadeInUp>

        {/* Summary */}
        <FadeInUp delay={340}>
          <View style={styles.summaryBox}>
            <PulsingIconBadge style={styles.summaryIconBadge}>
              <Ionicons name="calendar" size={22} color={COLORS.white} />
            </PulsingIconBadge>
            <Text style={styles.summaryLabel}>Scheduled for</Text>
            <Text style={styles.summaryDate}>{formattedDateLabel}</Text>
            <Text style={styles.summaryTime}>{formattedTime}</Text>
          </View>
        </FadeInUp>
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.footer}>
        <AnimatedPressable
          style={styles.confirmBtn}
          scaleTo={0.97}
          onPress={async () => {
           try {
            const preview = await fetchPricing({
             address,
             zipCode,
             bookingDate: selectedDate.isoDate,
             bookingTime: formattedTime,
            });

            navigation.navigate('Checkout', {
              labTestsTotal: testsTotal,
              labTestsNames: selectedTests.map((t) => t.name).join(', '),
              selectedTests,
              address,
              zipCode,
              visitType: 'mobile',
              preferredDate: selectedDate.isoDate,
              preferredTime: formattedTime,
              baseFee: Number(preview.baseFee) || 0,
              mileageRate: Number(preview.mileageRate) || 0,
              distanceMiles: Number(preview.distanceMiles) || 0,
              dynamicFeesTotal: Number(preview.dynamicFees?.total) || 0,
              doctorOrder,
              prescriptionFile,
            });
           } catch (err) {
             console.error(err);
              Alert.alert(
               'Pricing unavailable',
              err.message || 'Could not calculate pricing. Please try again.'
           );
          }
       }}
      >
         <Text style={styles.confirmBtnText}>
           Confirm booking{testsTotal > 0 ? ` · $${testsTotal.toFixed(0)} tests` : ''}
         </Text>
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
    marginBottom: 10,
    marginTop: 20,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 20,
    gap: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 14,
    lineHeight: 18,
    marginTop: -6,
  },

  // ── Visit address card ──
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  addressIconRing: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#EAF0FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressDisplayText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.navyDark,
    fontWeight: '600',
    lineHeight: 20,
  },

  optionalBadge: {
    backgroundColor: COLORS.amberLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
  },
  optionalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.amber,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.amberLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    gap: 8,
  },
  infoBannerIcon: { fontSize: 14, marginTop: 1 },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
  },
  skipHint: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    paddingBottom: 12,
    paddingHorizontal: 14,
    marginTop: -4,
  },

  // ── Doctor's order option cards ──
  orderRow: { flexDirection: 'row', gap: 12 },
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
  labCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
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
  selectTestsBtn: {
    backgroundColor: COLORS.navy,
    margin: 12,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  selectTestsBtnOptional: {
    backgroundColor: COLORS.offWhite,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  selectTestsBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  selectTestsBtnOptionalText: { color: COLORS.navy, fontSize: 14, fontWeight: '800' },
  dateRow: { gap: 10, paddingRight: 4, paddingTop: 6 },
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
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT * 3,
    gap: 4,
  },
  pickerScroll: { flex: 1, height: ITEM_HEIGHT * 3 },
  pickerItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  pickerText: { fontSize: 17, color: COLORS.gray, fontWeight: '500' },
  pickerTextSelected: { fontSize: 19, color: COLORS.navyDark, fontWeight: '900' },
  colon: { fontSize: 20, fontWeight: '900', color: COLORS.navyDark },
  mobileNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EBF0FB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7D4F5',
    marginTop: 20,
  },
  mobileNoteText: {flex:1, fontSize: 13,fontWeight:'600', color: COLORS.bodyText, lineHeight: 20 },
  summaryBox: {
    backgroundColor: '#EBF0FB',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#C7D4F5',
    alignItems: 'center',
    marginTop: 12,
  },
  summaryIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pulseRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.navy,
  },
  summaryLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '700', marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' },
  summaryDate: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.navyDark,
    marginBottom: 2,
  },
  summaryTime: { fontSize: 20, fontWeight: '900', color: COLORS.navy },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  confirmBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  confirmBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});