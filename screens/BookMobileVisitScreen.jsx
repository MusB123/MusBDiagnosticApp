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
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getBookingDraft, setBookingDraft } from '../utils/bookingDraft';
import { fetchPricing, getStoredPatientToken } from '../utils/auth';

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

const TIME_SLOTS = {
  morning: { label: 'Morning', icon: 'partly-sunny-outline', color: COLORS.amber },
  afternoon: { label: 'Afternoon', icon: 'sunny-outline', color: COLORS.teal },
  evening: { label: 'Evening', icon: 'moon-outline', color: COLORS.purple },
  lateNight: { label: 'Late Night', icon: 'cloudy-night-outline', color: COLORS.navy },
};

function getSlotFromTime(hour, minute, period) {
  let hour24 = hour % 12;
  if (period === 'PM') hour24 += 12;
  if (hour24 >= 6 && hour24 < 12) return 'morning';
  if (hour24 >= 12 && hour24 < 18) return 'afternoon';
  if (hour24 >= 18 && hour24 < 24) return 'evening';
  return 'lateNight';
}

/** Wraps a TouchableOpacity with a springy press-scale animation. */
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

/** Colorful animated call-to-action card for "Pick a day & time" — shimmering icon ring + pulse glow + bounce-in. */
function ScheduleCTA({ onPress, delay }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const iconSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(entrance, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 }),
    ]).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    glowLoop.start();

    const spinLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconSpin, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(iconSpin, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(1800),
      ])
    );
    spinLoop.start();

    return () => { glowLoop.stop(); spinLoop.stop(); };
  }, []);

  const rotate = iconSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-12deg'] });

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
        ],
      }}
    >
      <AnimatedPressable style={styles.scheduleCTA} scaleTo={0.97} onPress={onPress}>
        <View style={styles.scheduleCTAIconWrap}>
          <Animated.View
            style={[
              styles.scheduleCTAGlow,
              {
                opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }),
                transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
              },
            ]}
          />
          <Animated.View style={[styles.scheduleCTAIconRing, { transform: [{ rotate }] }]}>
            <Ionicons name="calendar" size={24} color={COLORS.white} />
          </Animated.View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.scheduleCTATitle}>Pick a day & time</Text>
          <Text style={styles.scheduleCTASub}>Flexible, fixed, or urgent scheduling</Text>
          <View style={styles.scheduleCTATagsRow}>
            <View style={[styles.scheduleCTATag, { backgroundColor: COLORS.greenLight }]}>
              <View style={[styles.scheduleCTADot, { backgroundColor: COLORS.green }]} />
              <Text style={[styles.scheduleCTATagText, { color: '#15803D' }]}>Flexible</Text>
            </View>
            <View style={[styles.scheduleCTATag, { backgroundColor: COLORS.amberLight }]}>
              <View style={[styles.scheduleCTADot, { backgroundColor: COLORS.amber }]} />
              <Text style={[styles.scheduleCTATagText, { color: '#92400E' }]}>Fixed</Text>
            </View>
            <View style={[styles.scheduleCTATag, { backgroundColor: '#FFE4E6' }]}>
              <View style={[styles.scheduleCTADot, { backgroundColor: '#E11D48' }]} />
              <Text style={[styles.scheduleCTATagText, { color: '#9F1239' }]}>Urgent</Text>
            </View>
          </View>
        </View>

        <View style={styles.scheduleCTAArrowWrap}>
          <Ionicons name="chevron-forward" size={18} color={COLORS.navy} />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const SLOT_TYPE_STYLES = {
  flexible: { color: COLORS.green, bg: '#DCFCE7', border: '#86EFAC', icon: 'leaf-outline', label: 'Flexible' },
  fixed:    { color: COLORS.amber, bg: '#FEF3C7', border: '#FCD34D', icon: 'time-outline', label: 'Fixed time' },
  urgent:   { color: '#E11D48',    bg: '#FFE4E6', border: '#FDA4AF', icon: 'flash-outline', label: 'Urgent' },
};

/** Colorful animated summary card shown once a schedule has been picked. */
function ScheduleFilledCard({ schedule, onPress }) {
  const entrance = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entrance, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 10 }).start();
    Animated.sequence([
      Animated.delay(180),
      Animated.spring(check, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 16 }),
    ]).start();
  }, [schedule.scheduledDate, schedule.slotType, schedule.slotIndex]);

  const tierKey = schedule.slotType === 'urgent' ? 'urgent' : schedule.slotType === 'fixed' ? 'fixed' : 'flexible';
  const tier = SLOT_TYPE_STYLES[tierKey];

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
      }}
    >
      <AnimatedPressable style={styles.scheduleFilledCard} scaleTo={0.98} onPress={onPress}>
        <View style={[styles.scheduleFilledAccentBar, { backgroundColor: tier.color }]} />

        <View style={[styles.scheduleFilledIconRing, { backgroundColor: tier.bg, borderColor: tier.border }]}>
          <Ionicons name={tier.icon} size={22} color={tier.color} />
          <Animated.View
            style={[
              styles.scheduleFilledCheckBadge,
              {
                opacity: check,
                transform: [{ scale: check }],
                backgroundColor: tier.color,
              },
            ]}
          >
            <Ionicons name="checkmark" size={11} color={COLORS.white} />
          </Animated.View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.scheduleFilledTierRow}>
            <View style={[styles.scheduleFilledTierPill, { backgroundColor: tier.bg, borderColor: tier.border }]}>
              <Text style={[styles.scheduleFilledTierText, { color: tier.color }]}>{tier.label}</Text>
            </View>
          </View>
          <Text style={styles.scheduleFilledDate}>{schedule.scheduledDateLabel}</Text>
          <Text style={styles.scheduleFilledTime}>{schedule.scheduledTimeLabel}</Text>
          {schedule.totalPatientFee != null && (
            <View style={styles.scheduleFilledPriceRow}>
              <Ionicons name="pricetag" size={11} color={COLORS.navy} />
              <Text style={styles.scheduleFilledPrice}>${schedule.totalPatientFee.toFixed(0)} visit fee</Text>
            </View>
          )}
        </View>

        <View style={styles.scheduleChangeBtn}>
          <Text style={styles.scheduleChangeText}>Change</Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
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
        style={[styles.orderCard, selected && styles.orderCardSelected, disabled && styles.orderCardDisabled]}
        onPress={onPress}
        scaleTo={0.96}
        disabled={disabled}
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

export default function BookMobileVisitScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const bookingDraft = getBookingDraft();

  const address = bookingDraft.address;
  const zipCode = bookingDraft.zipCode;

 
  const [doctorOrder, setDoctorOrder] = useState(bookingDraft.doctorOrder || 'self');
  const [prescriptionFile, setPrescriptionFile] = useState(bookingDraft.prescriptionFile || null);
  const [insurance, setInsurance] = useState(bookingDraft.insurance || 'none');
  const [insuranceFront, setInsuranceFront] = useState(bookingDraft.insuranceFront || null);
  const [insuranceBack, setInsuranceBack] = useState(bookingDraft.insuranceBack || null);

  const [selectedTests, setSelectedTests] = useState(bookingDraft.selectedTestsData || []);
  const [testsTotal, setTestsTotal] = useState(bookingDraft.testsTotal || 0);
  const [appliedOffer, setAppliedOffer] = useState(bookingDraft.appliedOffer || null);
  const [extraTestsData, setExtraTestsData] = useState(bookingDraft.extraTestsData || []);
  const [schedule, setSchedule] = useState(bookingDraft.schedule || null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const params = route?.params;
      if (params?.selectedTestsData) {
        setSelectedTests(params.selectedTestsData);
        setTestsTotal(params.testsTotal ?? 0);
        setAppliedOffer(params.appliedOffer ?? null);
        setExtraTestsData(params.extraTestsData ?? []);
        setBookingDraft({
          selectedTestsData: params.selectedTestsData,
          testsTotal: params.testsTotal ?? 0,
          appliedOffer: params.appliedOffer ?? null,
          extraTestsData: params.extraTestsData ?? [],
        });
      }
      if (params?.scheduledDate) {
        const newSchedule = {
          scheduledDate: params.scheduledDate,
          scheduledDateLabel: params.scheduledDateLabel,
          scheduledTimeLabel: params.scheduledTimeLabel,
          preferredTime: params.preferredTime,
          quotedBookingTime: params.quotedBookingTime,
          slotType: params.slotType,
          slotIndex: params.slotIndex,
          timeWindow: params.timeWindow,
          totalPatientFee: params.totalPatientFee,
        };
        setSchedule(newSchedule);
        setBookingDraft({ schedule: newSchedule });
      }
      });
      return unsubscribe;
    }, [navigation, route]);


  // ── Generic upload flow: Choose File (Image/PDF) or Take Photo ──
  // Mirrors the flow used on RegisterStep2, adapted for this screen's
  // three upload slots (prescription, insurance front, insurance back).

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const handleCameraFor = async (setter, draftKey) => {
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
        const file = {
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          uri: asset.uri,
          mimeType: 'image/jpeg',
        };
        setter(file);
        setBookingDraft({ [draftKey]: file });
      }
    } catch (err) {
      console.warn('Camera error:', err);
    }
  };

  const handleGalleryImageFor = async (setter, draftKey) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const file = {
        name: asset.fileName || `image_${Date.now()}.jpg`,
        uri: asset.uri,
        mimeType: 'image/jpeg',
      };
      setter(file);
      setBookingDraft({ [draftKey]: file });
    } catch (err) {
      console.warn('Image pick error:', err);
    }
  };

  const handlePdfFor = async (setter, draftKey) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      if (result.assets?.length > 0) {
        const asset = result.assets[0];
        setter(asset);
        setBookingDraft({ [draftKey]: asset });
      } else if (result.type === 'success') {
        setter(result);
        setBookingDraft({ [draftKey]: result });
      }
    } catch (err) {
      console.warn('PDF pick error:', err);
    }
  };

  const showFileTypeChoice = (setter, draftKey) => {
    Alert.alert('Select Document', 'Choose the type of file', [
      { text: 'Image', onPress: () => handleGalleryImageFor(setter, draftKey) },
      { text: 'PDF', onPress: () => handlePdfFor(setter, draftKey) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const showUploadOptions = (title, setter, draftKey) => {
    Alert.alert(title, 'Choose how you would like to add this document', [
      { text: 'Choose File', onPress: () => showFileTypeChoice(setter, draftKey) },
      { text: 'Take Photo', onPress: () => handleCameraFor(setter, draftKey) },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
      setInsurance('none');
      setInsuranceFront(null);
      setInsuranceBack(null);
      setBookingDraft({
        prescriptionFile: null,
        insurance: 'none',
        insuranceFront: null,
        insuranceBack: null,
      });
    }
  };

  const handleSelectInsurance = (value) => {
    setInsurance(value);
    setBookingDraft({ insurance: value });
    if (value === 'none') {
      setInsuranceFront(null);
      setInsuranceBack(null);
      setBookingDraft({ insuranceFront: null, insuranceBack: null });
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
            <AnimatedPressable
              style={styles.addressChangeBtn}
              scaleTo={0.92}
              onPress={() => navigation.navigate('PatientHome')}
            >
              <Text style={styles.addressChangeText}>Change</Text>
            </AnimatedPressable>
          </View>
          <Text style={styles.addressHint}>
            Set on the Home screen — tap "Change" to update it there.
          </Text>
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
              onPress={() => showUploadOptions("Doctor's order", setPrescriptionFile, 'prescriptionFile')}
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

        {/* Insurance — only shown once a doctor's order is selected (self-referred patients skip insurance) */}
        {doctorOrder === 'order' && (
          <>
            <FadeInUp delay={160}>
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
                delay={190}
              />
              <OrderOptionCard
                icon="card-outline"
                accent={COLORS.pathA}
                accentBg={COLORS.pathABg}
                title="I have insurance"
                subtitle="Add my card"
                selected={insurance === 'have'}
                onPress={() => handleSelectInsurance('have')}
                delay={230}
              />
            </View>

            {insurance === 'have' && (
              <FadeInUp delay={0}>
                <View style={{ gap: 12, marginTop: 14 }}>
                  <AnimatedPressable
                    style={[styles.uploadBox, insuranceFront && styles.uploadBoxDone]}
                    onPress={() => showUploadOptions('Insurance card — front', setInsuranceFront, 'insuranceFront')}
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
                    onPress={() => showUploadOptions('Insurance card — back', setInsuranceBack, 'insuranceBack')}
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
                  {appliedOffer ? (
                    <>
                      <View style={styles.testPill}>
                        <View style={styles.testPillLeft}>
                          <Ionicons name="pricetag" size={14} color={COLORS.navy} style={{ marginRight: 2 }} />
                          <Text style={styles.testPillName} numberOfLines={1}>
                            {appliedOffer.title} ({appliedOffer.testIds?.length ?? appliedOffer.matchedCount} tests)
                          </Text>
                        </View>
                        <Text style={[styles.testPillPrice, { color: COLORS.green }]}>
                          ${appliedOffer.price.toFixed(0)}
                        </Text>
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
                    selectedTests.map((test, i) => {
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
                  hasInsurance: insurance === 'have',
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

        {/* Schedule */}
        <FadeInUp delay={220}>
          <Text style={styles.sectionLabel}>Schedule</Text>
          {schedule ? (
            <ScheduleFilledCard
              schedule={schedule}
              onPress={() => navigation.navigate('ScheduleVisit', {
                address, zipCode, testTotal: testsTotal, returnTo: 'BookMobileVisit',
              })}
            />
          ) : (
            <ScheduleCTA
              delay={0}
              onPress={() => navigation.navigate('ScheduleVisit', {
                address, zipCode, testTotal: testsTotal, returnTo: 'BookMobileVisit',
              })}
            />
          )}
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
            {schedule ? (
              <>
                <Text style={styles.summaryDate}>{schedule.scheduledDateLabel}</Text>
                <Text style={styles.summaryTime}>{schedule.scheduledTimeLabel}</Text>
                {schedule.totalPatientFee != null && (
                  <View style={[styles.summarySlotPill, { backgroundColor: COLORS.greenLight, borderWidth: 1, borderColor: '#86EFAC' }]}>
                    <Ionicons name="pricetag" size={12} color="#15803D" style={{ marginRight: 4 }} />
                    <Text style={[styles.summarySlotText, { color: '#15803D' }]}>${schedule.totalPatientFee.toFixed(0)} visit fee</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.summaryDate}>Not scheduled yet</Text>
            )}
          </View>
        </FadeInUp>
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.footer}>
        <AnimatedPressable
          style={styles.confirmBtn}
          scaleTo={0.97}
          onPress={async () => {
            if (!schedule) {
              Alert.alert('Pick a time', 'Please choose your appointment day and time to continue.');
              return;
            }
            if (insurance === 'have' && doctorOrder === 'order' && !prescriptionFile) {
              Alert.alert("Doctor's order document missing", "Please upload your doctor's order document before continuing.");
              return;
            }

  // Reuse the fee already quoted when the schedule slot was picked instead of
  // re-fetching pricing here. Re-fetching a second time was producing a
  // different number than what's shown on this very button whenever slot-type
  // pricing (time-of-day, surge, etc.) shifted in the seconds/minutes between
  // picking a slot and tapping Confirm. One quote, reused everywhere, until
  // Checkout re-validates it at booking time.
            const totalPatientFee = Number(schedule.totalPatientFee) || 0;

            const checkoutParams = {
              labTestsTotal: testsTotal,
              labTestsNames: selectedTests.map((t) => t.name).join(', '),
              selectedTests, appliedOffer, extraTestsData,
              address, zipCode,
              visitType: 'mobile',
              preferredDate: schedule.scheduledDate,
              preferredTime: schedule.preferredTime,
              quotedBookingTime: schedule.quotedBookingTime,
              baseFee: Number(schedule.baseFee) || 0,
              distanceFee: Number(schedule.distanceFee) || 0,
              driversReserveFee: Number(schedule.driversReserveFee) || 0,
              surchargesTotal: Number(schedule.surchargesTotal) || 0,
              serviceFee: Number(schedule.serviceFee) || 0,
              totalPatientFee,
              quotedTotalFee: totalPatientFee,
              slotType: schedule.slotType,
              slotIndex: schedule.slotIndex,
              timeSlotLabel: schedule.scheduledTimeLabel,
              doctorOrder, prescriptionFile, insurance, insuranceFront, insuranceBack,
            };
            console.log("===== PRICE DEBUG =====");
            console.log("baseFee:", checkoutParams.baseFee);
            console.log("distanceFee:", checkoutParams.distanceFee);
            console.log("driversReserveFee:", checkoutParams.driversReserveFee);
            console.log("surchargesTotal:", checkoutParams.surchargesTotal);
            console.log("serviceFee:", checkoutParams.serviceFee);
            console.log("mobileVisitTotal:", checkoutParams.totalPatientFee);
            console.log("labTestsTotal:", checkoutParams.labTestsTotal);
            console.log("grandTotal:", checkoutParams.labTestsTotal + checkoutParams.totalPatientFee);
            console.log("quotedTotalFee:", checkoutParams.quotedTotalFee);
            const existingToken = await getStoredPatientToken();
            navigation.navigate(existingToken ? 'Checkout' : 'GuestInfo', checkoutParams);
          }}
        >
          <Text style={styles.confirmBtnText}>
            Continue to checkout
            {schedule?.totalPatientFee != null ? ` · $${(testsTotal + schedule.totalPatientFee).toFixed(0)}` : testsTotal > 0 ? ` · $${testsTotal.toFixed(0)} tests` : ''}
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
    justifyContent: 'space-between',
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
  addressChangeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.offWhite,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressChangeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.navy,
  },
  addressHint: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 6,
    marginLeft: 2,
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
  requiredBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  requiredBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.red,
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
  testPillPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  testPillStrikePrice: {
    fontSize: 12,
    color: COLORS.gray,
    textDecorationLine: 'line-through',
  },
  testPillDiscountPrice: { color: COLORS.green },
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
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  slotBadgeText: { fontSize: 11, fontWeight: '800' },
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
  pricingDeferredNote: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8,
  },
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
  summarySlotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  summarySlotText: { fontSize: 12, fontWeight: '800', color: COLORS.white },
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

  scheduleChangeBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  scheduleChangeText: { fontSize: 12, fontWeight: '800', color: COLORS.navy },
  scheduleCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E4E9F5',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  scheduleCTAIconWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleCTAGlow: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: COLORS.purple,
    alignSelf: 'center',
  },
  scheduleCTAIconRing: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 1,
  },
  scheduleCTATitle: { fontSize: 15, fontWeight: '900', color: COLORS.navyDark },
  scheduleCTASub: { fontSize: 12, color: COLORS.gray, marginTop: 2, marginBottom: 8 },
  scheduleCTATagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  scheduleCTATag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scheduleCTADot: { width: 6, height: 6, borderRadius: 3 },
  scheduleCTATagText: { fontSize: 10, fontWeight: '800' },
  scheduleCTAArrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#EAF0FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleFilledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E4E9F5',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: COLORS.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  scheduleFilledAccentBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 5,
  },
  scheduleFilledIconRing: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleFilledCheckBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  scheduleFilledTierRow: { flexDirection: 'row', marginBottom: 4 },
  scheduleFilledTierPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  scheduleFilledTierText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  scheduleFilledDate: { fontSize: 14, fontWeight: '800', color: COLORS.navyDark },
  scheduleFilledTime: { fontSize: 13, color: COLORS.bodyText, marginTop: 1 },
  scheduleFilledPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  scheduleFilledPrice: { fontSize: 12, fontWeight: '800', color: COLORS.navy },
});