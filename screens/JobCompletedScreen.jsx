import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const PRIMARY       = '#18377D';
const PRIMARY_DARK  = '#0F2557';
const PRIMARY_LIGHT = '#3B5BA9';
const GREEN         = '#1B7A4D';
const GREEN_LIGHT   = '#22C55E';
const GREEN_BG      = '#DCFCE7';
const AMBER         = '#D97706';
const AMBER_BG      = '#FEF3C7';
const BLUE          = '#2563EB';
const BLUE_BG       = '#DBEAFE';
const PINK          = '#DB2777';
const PINK_BG       = '#FCE7F3';
const PURPLE        = '#7C3AED';
const PURPLE_BG     = '#EDE9FE';
const BG            = '#F6F8FC';
const CARD_BORDER   = '#EEF1F7';
const BODY_GRAY     = '#6B7280';

const TOP_PADDING = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

/* ────────────────────────────────────────────────────────────
   Shared animation primitives
──────────────────────────────────────────────────────────── */

function AnimatedPressable({ style, onPress, children, scaleTo = 0.97, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
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
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Row entrance: pops in with a slight scale + slide from the side, staggered by index. */
function FadeInSide({ delay = 0, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay,
      useNativeDriver: true,
      speed: 14,
      bounciness: 8,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Small twinkling dot — used to scatter a few colorful sparkles around the success badge. */
function Sparkle({ color, size = 8, top, left, right, bottom, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 650, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 650, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.delay(900),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top, left, right, bottom,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color,
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.15] }) }],
      }}
    />
  );
}

/** Checkmark badge: bouncy pop-in + soft expanding ring + scattered color sparkles. */
function SuccessBadge() {
  const pop = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 14 }).start();
    const loop = Animated.loop(
      Animated.timing(ring, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={styles.badgeWrap}>
      <Sparkle color={AMBER} size={9} top={4} left={6} delay={0} />
      <Sparkle color={BLUE} size={7} top={14} right={2} delay={220} />
      <Sparkle color={PINK} size={7} bottom={10} left={0} delay={440} />
      <Sparkle color={GREEN_LIGHT} size={9} bottom={2} right={10} delay={660} />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.badgeRing,
          {
            opacity: ring.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.5, 0.15, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
          },
        ]}
      />
      <Animated.View style={[styles.badgeCircleOuter, { transform: [{ scale: pop }], opacity: pop }]}>
        <LinearGradient
          colors={[GREEN_LIGHT, GREEN]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.badgeCircle}
        >
          <Ionicons name="checkmark" size={40} color="#FFFFFF" />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

/** Counts a number up from 0 to `value` on mount — used for the payout hero figure. */
function CountUpMoney({ value, style }) {
  const [display, setDisplay] = React.useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (value == null) return;
    const id = anim.addListener(({ value: v }) => setDisplay(v * value));
    Animated.timing(anim, { toValue: 1, duration: 900, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value]);
  if (value == null) return <Text style={style}>—</Text>;
  return <Text style={style}>${display.toFixed(2)}</Text>;
}

/**
 * One colorful tile in the summary — its own tinted background, a bold
 * gradient icon circle, and a colored left accent bar. Each tile pops in
 * with a slight stagger so the whole summary cascades into view.
 */
function InfoTile({ label, value, icon, color, bg, gradient, delay = 0 }) {
  return (
    <FadeInSide delay={delay} style={[styles.tile, { backgroundColor: bg, borderColor: color + '22' }]}>
      <View style={[styles.tileAccent, { backgroundColor: color }]} />
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tileIconWrap}
      >
        <Ionicons name={icon} size={16} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.tileTextWrap}>
        <Text style={[styles.tileLabel, { color }]}>{label}</Text>
        <Text style={styles.tileValue}>{value || '—'}</Text>
      </View>
    </FadeInSide>
  );
}

/** One tile in the payout breakdown grid — icon, label, value, each with breathing room. */
function PayoutTile({ label, value, icon, color, bg }) {
  return (
    <View style={styles.payoutTile}>
      <View style={[styles.payoutTileIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text style={styles.payoutTileLabel}>{label}</Text>
      <Text style={[styles.payoutTileValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function JobCompletedScreen({ route, navigation }) {
  const { job, patient } = route?.params || {};

  const patientName =
    job?.patient_name || patient?.name || job?.full_name || 'Patient';

  const collectionDate =
    job?.collection_date_display ||
    job?.preferred_date ||
    job?.scheduled_at ||
    '';
  const collectionTime = job?.preferred_time || job?.collection_time || '';
  const collectionDisplay = [collectionDate, collectionTime].filter(Boolean).join(' · ') || '—';

  const dropLocation =
    job?.drop_location_lab_name || job?.drop_location_address || 'Drop-off location';

  const dropTimeRaw = job?.drop_timestamp || job?.dropped_at;
  let dropTimeDisplay = '—';
  if (dropTimeRaw) {
    const d = new Date(dropTimeRaw);
    if (!isNaN(d.getTime())) {
      dropTimeDisplay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else {
      dropTimeDisplay = String(dropTimeRaw);
    }
  }

  const totalPayout = job?.earnings?.total ?? job?.total_payout ?? job?.provider_payout ?? null;
  const collectionFee = job?.earnings?.collection_fee ?? job?.provider_collection_pay ?? null;
  const testCommission = job?.earnings?.test_commission ?? job?.provider_test_commission_pay ?? null;
  const collectionFeeDisplay = collectionFee != null ? `$${Number(collectionFee).toFixed(2)}` : null;
  const testCommissionDisplay = testCommission != null && Number(testCommission) > 0
    ? `$${Number(testCommission).toFixed(2)}`
    : null;

  const paymentStatus = job?.payment_status || 'Approved';

  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const handleReturn = () => {
    navigation.navigate('PhlebDashboard');
  };

  return (
    <View style={styles.outer}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_DARK} />

      <Animated.View
        style={{
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }],
        }}
      >
        <LinearGradient
          colors={[PRIMARY_DARK, PRIMARY, PRIMARY_LIGHT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerGlow} />
          <View style={styles.headerGlowSecondary} />
          <View style={styles.headerBadge}>
            <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
            <Text style={styles.headerBadgeText}>VERIFIED</Text>
          </View>
          <Text style={styles.headerTitle}>Job Completed</Text>
        </LinearGradient>
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <FadeInUp delay={40} style={{ alignItems: 'center' }}>
          <SuccessBadge />
          <Text style={styles.successTitle}>Great work!</Text>
          <Text style={styles.successSub}>Chain of custody verified end-to-end.</Text>
        </FadeInUp>

        <FadeInUp delay={140}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="document-text-outline" size={15} color={PRIMARY} />
            <Text style={styles.cardHeaderText}>VISIT SUMMARY</Text>
          </View>

          <View style={styles.tileGroup}>
            <InfoTile
              label="PATIENT"
              value={patientName}
              icon="person-outline"
              color={BLUE}
              bg={BLUE_BG}
              gradient={['#3B82F6', BLUE]}
              delay={180}
            />
            <InfoTile
              label="COLLECTION"
              value={collectionDisplay}
              icon="calendar-outline"
              color={AMBER}
              bg={AMBER_BG}
              gradient={['#F59E0B', AMBER]}
              delay={260}
            />
            <InfoTile
              label="STATUS"
              value="Completed"
              icon="checkmark-circle-outline"
              color={GREEN}
              bg={GREEN_BG}
              gradient={[GREEN_LIGHT, GREEN]}
              delay={340}
            />
            <InfoTile
              label="DROP-OFF LOCATION"
              value={dropLocation}
              icon="flask-outline"
              color={PURPLE}
              bg={PURPLE_BG}
              gradient={['#A78BFA', PURPLE]}
              delay={420}
            />
            <InfoTile
              label="DROP-OFF TIME"
              value={dropTimeDisplay}
              icon="time-outline"
              color={PINK}
              bg={PINK_BG}
              gradient={['#F472B6', PINK]}
              delay={500}
            />
          </View>
        </FadeInUp>

        <FadeInUp delay={580}>
          <LinearGradient
            colors={[GREEN, '#166B45']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.payoutHero}
          >
            <View style={styles.payoutHeroGlow} />
            <Text style={styles.payoutHeroLabel}>TOTAL PAYOUT</Text>
            <CountUpMoney value={totalPayout} style={styles.payoutHeroValue} />

            <View style={styles.paymentPill}>
              <View style={styles.paymentDot} />
              <Text style={styles.paymentPillText}>{paymentStatus}</Text>
            </View>
          </LinearGradient>

          {(collectionFeeDisplay || testCommissionDisplay) && (
            <View style={styles.payoutTileRow}>
              {collectionFeeDisplay && (
                <PayoutTile
                  label="Collection fee"
                  value={collectionFeeDisplay}
                  icon="car-outline"
                  color={BLUE}
                  bg={BLUE_BG}
                />
              )}
              {testCommissionDisplay && (
                <PayoutTile
                  label="Test commission"
                  value={testCommissionDisplay}
                  icon="ribbon-outline"
                  color={AMBER}
                  bg={AMBER_BG}
                />
              )}
            </View>
          )}
        </FadeInUp>

        <View style={{ height: 20 }} />
      </ScrollView>

      <FadeInUp delay={0} distance={20} style={styles.bottomBar}>
        <AnimatedPressable scaleTo={0.97} onPress={handleReturn}>
          <LinearGradient
            colors={[PRIMARY, PRIMARY_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.returnBtn}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.returnBtnText}>Return to Available Jobs</Text>
          </LinearGradient>
        </AnimatedPressable>
      </FadeInUp>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: BG },

  header: {
    paddingTop: TOP_PADDING,
    paddingBottom: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: -50, right: -40,
    width: 170, height: 170, borderRadius: 85,
    backgroundColor: PRIMARY_LIGHT, opacity: 0.35,
  },
  headerGlowSecondary: {
    position: 'absolute',
    bottom: -60, left: -30,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: GREEN_LIGHT, opacity: 0.12,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  headerBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  headerTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },

  scrollContent: { padding: 20, paddingBottom: 40 },

  badgeWrap: {
    width: 110, height: 110,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  badgeRing: {
    position: 'absolute',
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 2.5, borderColor: GREEN_LIGHT,
  },
  badgeCircleOuter: {
    shadowColor: GREEN,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  badgeCircle: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: 21, fontWeight: '800', color: '#111827', marginTop: 8 },
  successSub: { fontSize: 13, color: BODY_GRAY, marginTop: 6, textAlign: 'center' },

  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  cardHeaderText: { fontSize: 11, fontWeight: '800', color: PRIMARY, letterSpacing: 0.6 },

  // ── Colorful summary tiles ──
  tileGroup: { gap: 10 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 13,
    paddingHorizontal: 14,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tileAccent: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
  },
  tileIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tileTextWrap: { flex: 1 },
  tileLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tileValue: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#111827',
  },

  // ── Payout hero card ──
  payoutHero: {
    borderRadius: 20,
    padding: 22,
    marginTop: 22,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: GREEN,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  payoutHeroGlow: {
    position: 'absolute',
    top: -40, right: -30,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: '#FFFFFF', opacity: 0.08,
  },
  payoutHeroLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  payoutHeroValue: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
    marginBottom: 14,
  },

  paymentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  paymentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  paymentPillText: { fontSize: 12.5, fontWeight: '800', color: '#FFFFFF' },

  payoutTileRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  payoutTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  payoutTileIconWrap: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  payoutTileLabel: { fontSize: 11.5, color: BODY_GRAY, fontWeight: '600', marginBottom: 4 },
  payoutTileValue: { fontSize: 16, fontWeight: '800' },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  returnBtn: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  returnBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15.5 },
});