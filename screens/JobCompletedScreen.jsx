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

const PRIMARY      = '#18377D';
const PRIMARY_DARK = '#0F2557';
const PRIMARY_LIGHT = '#3B5BA9';
const GREEN        = '#1B7A4D';
const GREEN_LIGHT  = '#22C55E';
const GREEN_BG     = '#DCFCE7';
const BG           = '#F6F8FC';
const CARD_BORDER  = '#EEF1F7';
const BODY_GRAY    = '#6B7280';

const TOP_PADDING = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 54;

/** Springy press-scale wrapper — same primitive used across the app. */
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
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Checkmark badge: pops in with a bouncy spring + a soft expanding ring pulse. */
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
      <Animated.View
        style={[
          styles.badgeCircleOuter,
          { transform: [{ scale: pop }], opacity: pop },
        ]}
      >
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

/** One label/value row inside an info card. */
function InfoRow({ label, value, valueColor, icon, isLast }) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <View style={styles.infoRowLabelWrap}>
        {icon && <Ionicons name={icon} size={15} color={BODY_GRAY} style={{ marginRight: 8 }} />}
        <Text style={styles.infoRowLabel}>{label}</Text>
      </View>
      <Text style={[styles.infoRowValue, valueColor && { color: valueColor }]} numberOfLines={1}>
        {value || '—'}
      </Text>
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
  const payoutDisplay = totalPayout != null ? `$${Number(totalPayout).toFixed(2)}` : '—';
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
          <Text style={styles.successTitle}>Job Completed</Text>
          <Text style={styles.successSub}>Chain of custody verified end-to-end.</Text>
        </FadeInUp>

        <FadeInUp delay={140}>
          <View style={styles.card}>
            <InfoRow label="Patient" value={patientName} icon="person-outline" />
            <InfoRow label="Collection" value={collectionDisplay} icon="calendar-outline" />
            <InfoRow
              label="Collection status"
              value="Completed"
              valueColor={GREEN_LIGHT}
              icon="checkmark-circle-outline"
            />
            <InfoRow label="Drop-off location" value={dropLocation} icon="flask-outline" />
            <InfoRow label="Drop-off time" value={dropTimeDisplay} icon="time-outline" isLast />
          </View>
        </FadeInUp>

        <FadeInUp delay={220}>
          <LinearGradient
            colors={['#FFFFFF', '#F3F6FC']}
            style={styles.payoutCard}
          >
            <View style={styles.payoutRow}>
              <Text style={styles.payoutLabel}>Total payout</Text>
              <Text style={styles.payoutValue}>{payoutDisplay}</Text>
            </View>

            {(collectionFeeDisplay || testCommissionDisplay) && (
              <View style={styles.payoutBreakdown}>
                {collectionFeeDisplay && (
                  <View style={styles.payoutBreakdownRow}>
                    <Text style={styles.payoutBreakdownLabel}>Collection fee</Text>
                    <Text style={styles.payoutBreakdownValue}>{collectionFeeDisplay}</Text>
                  </View>
                )}
                {testCommissionDisplay && (
                  <View style={styles.payoutBreakdownRow}>
                    <Text style={styles.payoutBreakdownLabel}>Test commission</Text>
                    <Text style={styles.payoutBreakdownValue}>{testCommissionDisplay}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.payoutDivider} />
            <View style={styles.payoutRow}>
              <Text style={styles.payoutLabel}>Payment status</Text>
              <View style={styles.paymentPill}>
                <View style={styles.paymentDot} />
                <Text style={styles.paymentPillText}>{paymentStatus}</Text>
              </View>
            </View>
          </LinearGradient>
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
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: -50, right: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: PRIMARY_LIGHT, opacity: 0.35,
  },
  headerGlowSecondary: {
    position: 'absolute',
    bottom: -60, left: -30,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: '#FFFFFF', opacity: 0.06,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },

  scrollContent: { padding: 20, paddingBottom: 40 },

  badgeWrap: {
    width: 100, height: 100,
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
  successTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginTop: 6 },
  successSub: { fontSize: 13, color: BODY_GRAY, marginTop: 6, textAlign: 'center' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    paddingHorizontal: 16,
    marginTop: 26,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F9',
  },
  infoRowLabelWrap: { flexDirection: 'row', alignItems: 'center' },
  infoRowLabel: { fontSize: 13, color: BODY_GRAY, fontWeight: '600' },
  infoRowValue: { fontSize: 14, color: '#111827', fontWeight: '800', maxWidth: '55%', textAlign: 'right' },

  payoutCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    padding: 18,
    marginTop: 16,
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payoutBreakdown: {
    marginTop: 10,
    gap: 6,
  },
  payoutBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 4,
  },
  payoutBreakdownLabel: { fontSize: 12.5, color: BODY_GRAY, fontWeight: '500' },
  payoutBreakdownValue: { fontSize: 13, color: '#374151', fontWeight: '700' },
  payoutLabel: { fontSize: 13.5, color: BODY_GRAY, fontWeight: '600' },
  payoutValue: { fontSize: 24, fontWeight: '800', color: GREEN },
  payoutDivider: { height: 1, backgroundColor: '#EEF1F7', marginVertical: 14 },
  paymentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GREEN_BG,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  paymentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  paymentPillText: { fontSize: 12.5, fontWeight: '800', color: GREEN },

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
