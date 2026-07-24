import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, ActivityIndicator,
  Animated, Easing, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { getStoredPatientUser, bookAppointment, uploadDocument, fetchWalkinFeePreview, markAppointmentPaid } from '../utils/auth';
import * as FileSystem from 'expo-file-system/legacy';

const BACKEND_URL = 'https://musb-diagnostic-website.onrender.com';

const COLORS = {
  navy: '#1B3A8C', navyDark: '#0D1F3C', white: '#FFFFFF',
  offWhite: '#F4F7FB', lightGray: '#E8EEF5', gray: '#8A9BB0',
  bodyText: '#4A5568', border: '#D1DBE8', green: '#22C55E', greenLight: '#DCFCE7',
  blue: '#2563EB', blueLight: '#DBEAFE',
  purple: '#7C3AED', purpleLight: '#EDE9FE',
  teal: '#0D9488', tealLight: '#CCFBF1',
  slate: '#64748B', slateLight: '#F1F5F9',
};

/** Springy press-scale wrapper, shared across the screen. */
function AnimatedPressable({ style, onPress, disabled, children, scaleTo = 0.97, ...rest }) {
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
function FadeInUp({ delay = 0, distance = 14, children, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 420, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
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

/** Icon badge that gently pulses — draws the eye to the total. */
function PulsingIconBadge({ children, style, color }) {
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
          { backgroundColor: color },
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
          },
        ]}
      />
      {children}
    </View>
  );
}

/** A single line-item row in the order summary — icon ring pops in, row fades/slides up. */
function SummaryRow({ icon, iconColor, iconBg, label, value, delay }) {
  return (
    <FadeInUp delay={delay} distance={8}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryRowLeft}>
          <View style={[styles.summaryIconRing, { backgroundColor: iconBg }]}>
            <IconPop delay={delay + 60}>
              <Ionicons name={icon} size={16} color={iconColor} />
            </IconPop>
          </View>
          <Text style={styles.summaryLabel} numberOfLines={1}>{label}</Text>
        </View>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </FadeInUp>
  );
}

/** Animated checkmark — draws a scaling ring + a springy check icon. */
function AnimatedCheckmark() {
  const ringScale = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(ringScale, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 12 }),
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 16 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.successRing, { transform: [{ scale: ringScale }] }]}>
      <Animated.View style={{ transform: [{ scale: checkScale }] }}>
        <Ionicons name="checkmark" size={44} color={COLORS.white} />
      </Animated.View>
    </Animated.View>
  );
}

/** Full-screen success overlay shown after a successful payment. */
function SuccessOverlay({ visible, amount, onContinue }) {
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(overlayAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8, delay: 80 }).start();
    } else {
      overlayAnim.setValue(0);
      cardAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={[styles.overlayBg, { opacity: overlayAnim }]}>
        <Animated.View
          style={[
            styles.successCard,
            {
              opacity: cardAnim,
              transform: [
                { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                { translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              ],
            },
          ]}
        >
          <AnimatedCheckmark />
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successAmount}>${amount}</Text>
          <Text style={styles.successSub}>Your appointment is confirmed</Text>

          <View style={{ width: '100%' }}>
            <AnimatedPressable style={styles.successBtn} onPress={onContinue} scaleTo={0.97}>
              <Text style={styles.successBtnText}>View appointment</Text>
            </AnimatedPressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export default function CheckoutScreen({ navigation, route }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState({ amount: '0', appointmentId: null });

  // ── Route params (all safely coerced) ────────────────────────────────────
  const labTestsTotal = Number(route?.params?.labTestsTotal) || 0;
  const labTestsNames = route?.params?.labTestsNames  || '';
  const address       = route?.params?.address        || '';
  const zipCode        = route?.params?.zipCode        || '';
  const visitType     = route?.params?.visitType      || 'mobile';
  const preferredTime = route?.params?.preferredTime  || 'Now';
  const quotedBookingTime = route?.params?.quotedBookingTime || preferredTime;
  const preferredDate = route?.params?.preferredDate  || new Date().toISOString().split('T')[0];
  const [patientUser, setPatientUser] = useState(null);
  const selectedLabId = route?.params?.selectedLabId || '';
  const selectedLabName = route?.params?.selectedLabName || '';
  const doctorOrder = route?.params?.doctorOrder || 'self'; 
  const appliedOffer = route?.params?.appliedOffer || null;
  const extraTestsData = route?.params?.extraTestsData || [];
  const prescriptionFile = route?.params?.prescriptionFile || null;
  const insurance = route?.params?.insurance || 'none';
  const insuranceFrontFile = route?.params?.insuranceFront || null;
  const insuranceBackFile = route?.params?.insuranceBack || null;
  const appointmentId = route?.params?.appointmentId || null;
  const selectedTests = route?.params?.selectedTests || [];

  // ── Pricing (flat-fee model — computed on BookMobileVisitScreen via
  // calculate_area_fee / calculate_marketplace_patient_fee) ──────────────
  const baseFee            = visitType === 'mobile' ? Number(route?.params?.baseFee) || 0 : 0;
  const distanceFee        = visitType === 'mobile' ? Number(route?.params?.distanceFee) || 0 : 0;
  const driversReserveFee  = visitType === 'mobile' ? Number(route?.params?.driversReserveFee) || 0 : 0;
  const surchargesTotal    = visitType === 'mobile' ? Number(route?.params?.surchargesTotal) || 0 : 0;
  const serviceFee         = visitType === 'mobile' ? Number(route?.params?.serviceFee) || 0 : 0;
  const slotType           = route?.params?.slotType || 'flexible';
  const slotIndex          = route?.params?.slotIndex ?? null;
  const timeSlotLabel      = route?.params?.timeSlotLabel || '';

  // Trust the backend's own computed total — avoids drift if settings change
  // between screens. Only fall back to summing parts if it's missing.
  const backendTotal = Number(route?.params?.totalPatientFee);
  const mobileVisitTotal = visitType === 'mobile'
    ? (Number.isFinite(backendTotal) && backendTotal > 0
        ? backendTotal
        : +(baseFee + distanceFee + driversReserveFee + surchargesTotal).toFixed(2))
    : 0;
  const grandTotal = +(mobileVisitTotal + labTestsTotal).toFixed(2);

  // Sent back to book_appointment so its ±$0.50 quote-drift check passes
  // instead of bouncing with a 409 at the worst possible moment (post-payment).
  const quotedTotalFee = mobileVisitTotal;

  const patientEmail = patientUser?.email || route?.params?.email || '';
  // NOTE: patientUser loads asynchronously (SecureStore read). If "Pay" is
  // tapped before it resolves, patientUser is still null — so name/phone
  // must fall back to whatever was passed in via route params (e.g. from
  // the booking form) instead of silently going out blank. This is what
  // lets the phlebotomist's JobAcceptedScreen reliably show the patient's
  // real name and phone number.
  const patientFullName = patientUser?.name || route?.params?.fullName || route?.params?.full_name || '';
  const patientPhone = patientUser?.phone || route?.params?.phone || '';

  useEffect(() => {
    (async () => {
      const user = await getStoredPatientUser();
      if (user) setPatientUser(user);
    })();
  }, []);

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
      if (insuranceFrontFile?.uri) {
        const { key } = await uploadDocument({
          uri: insuranceFrontFile.uri,
          filename: insuranceFrontFile.name || 'insurance-front',
          kind: 'patient-docs',
        });
        front = { key, name: insuranceFrontFile.name || 'Insurance Front' };
      }
    } catch (err) {
      console.warn('Could not upload insurance front:', err);
    }

    try {
      if (insuranceBackFile?.uri) {
        const { key } = await uploadDocument({
          uri: insuranceBackFile.uri,
          filename: insuranceBackFile.name || 'insurance-back',
          kind: 'patient-docs',
        });
        back = { key, name: insuranceBackFile.name || 'Insurance Back' };
      }
    } catch (err) {
      console.warn('Could not upload insurance back:', err);
    }

    return { front, back };
  };

  const allTestIds = appliedOffer
  ? [...(appliedOffer.testIds || []), ...extraTestsData.map((t) => t.id)]
  : selectedTests.map((t) => t.id);

  // ── Pay handler ───────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (grandTotal == null) return;
    setLoading(true);

    try {
      let currentAppointmentId = appointmentId;

    // ── Step 1: Create/validate the booking BEFORE charging the card ──
    // This is the key fix. Previously we charged via Stripe first, then
    // called bookAppointment(), and if the backend recomputed a different
    // price by then (slot-type/time-of-day pricing can shift over the
    // 30-60+ seconds it takes to fill out the Stripe sheet), the user's
    // card had already been charged with nowhere clean to land. Now we
    // let the backend validate/lock the price first, while there's still
    // zero money on the line, and only proceed to Stripe if it accepts
    // the quoted price.
      if (!currentAppointmentId) {
        const doctorOrderDoc = await uploadPrescriptionDoc();
        const { front: insuranceFrontDoc, back: insuranceBackDoc } = await uploadInsuranceDocs();

        let bookingResult;
        try {
          bookingResult = await bookAppointment({
            test_name: labTestsTotal > 0 ? labTestsNames : 'Mobile Phlebotomy Visit',
            test_price: labTestsTotal > 0 ? labTestsTotal : 0,
            test_ids: allTestIds.length > 0 ? allTestIds.join(',') : undefined,
            full_name: patientFullName,
            email: patientEmail,
            phone: patientPhone,
            address,
            zipCode,
            visit_type: visitType,
            preferred_date: preferredDate,
            preferred_time: preferredTime,
            pricing_time: quotedBookingTime,
            payment_method: 'Card',
            selected_lab_id: selectedLabId || undefined,     
            selected_lab_name: selectedLabName || undefined, 
            doctor_order_base64: doctorOrderDoc?.key || null,
            doctor_order_name: doctorOrderDoc?.name || null,
            insurance_front_base64: insuranceFrontDoc?.key || null,
            insurance_front_name: insuranceFrontDoc?.name || null,
            insurance_back_base64: insuranceBackDoc?.key || null,
            insurance_back_name: insuranceBackDoc?.name || null,
            slot_type: slotType,
            slot_index: slotIndex,
            quoted_total_fee: quotedTotalFee,
            status: 'pending_payment',
          });
          console.log("===== BOOKING PAYLOAD =====");
        } catch (bookErr) {
          console.log("===== BOOKING ERROR =====");
          console.log("bookErr:", JSON.stringify(bookErr, null, 2));
          console.log("message:", bookErr?.message);
          console.log("status:", bookErr?.status);
          console.log("data:", bookErr?.data);
        // Price drifted, area no longer serviceable, slot taken, etc. —
        // caught here, BEFORE Stripe is ever shown. No money moved.
          Alert.alert(
            "Booking Error",
            JSON.stringify(bookErr?.data || bookErr, null, 2)
          );
          setLoading(false);
          return;
        }

        currentAppointmentId = bookingResult.appointment_id;
      }

    // ── Step 2: Create the payment intent for the CONFIRMED price ──
      const response = await fetch(`${BACKEND_URL}/api/payments/create-payment-intent/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: grandTotal.toFixed(2),
          currency: 'usd',
          email: patientEmail,
          appointment_id: currentAppointmentId,
        }),
      });

      const data = await response.json();
      if (!data.client_secret) {
        Alert.alert('Error', 'Could not initialize payment. Please try again.');
        setLoading(false);
        return;
      }

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'MusB Diagnostics',
        paymentIntentClientSecret: data.client_secret,
        defaultBillingDetails: { email: patientEmail },
        allowsDelayedPaymentMethods: false,
        style: 'automatic',
      });

      if (initError) {
        Alert.alert('Payment Error', initError.message);
        setLoading(false);
        return;
      }

      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
      // Booking exists but is still 'pending_payment' — user can retry
      // paying for the same locked-price appointment without re-booking.
        if (paymentError.code !== 'Canceled') {
          Alert.alert('Payment Failed', paymentError.message);
        }
        setLoading(false);
        return;
      }

    // ── Step 3: Mark the already-confirmed booking as paid ──
      try {
        await markAppointmentPaid(currentAppointmentId);
        setSuccessData({
          amount: grandTotal.toFixed(2),
          appointmentId: currentAppointmentId,
        });
        setShowSuccess(true);
      } catch (markErr) {
      // Payment succeeded and the booking already exists at the right
      // price — this is just a status-flag update failing, not a pricing
      // or double-charge risk. Safe to tell the user they're confirmed.
        Alert.alert(
          'Payment received',
          'Your payment was successful and your appointment is booked. If anything looks off in your confirmation, please contact support.',
          [{ text: 'OK', onPress: () => navigation.navigate('PatientHome', { appointmentId: currentAppointmentId }) }]
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please check your connection and try again.');
    }
    setLoading(false);
  };

  const handleSuccessContinue = () => {
    setShowSuccess(false);
    if (route?.params?.isGuest) {
      navigation.navigate('CreateAccountPrompt', { appointmentId: successData.appointmentId });
    } else {
      navigation.navigate('PatientHome', { appointmentId: successData.appointmentId });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable style={styles.backBtn} onPress={() => navigation.goBack()} scaleTo={0.85}>
          <Ionicons name="arrow-back" size={20} color={COLORS.navyDark} />
        </AnimatedPressable>
        <View>
          <Text style={styles.headerTitle}>Checkout</Text>
          <Text style={styles.headerSub}>Confirm your order</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Order Summary (main focus) ── */}
        <FadeInUp delay={0}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryTitleRow}>
              <View style={styles.summaryTitleIconRing}>
                <Ionicons name="receipt-outline" size={16} color={COLORS.navy} />
              </View>
              <Text style={styles.summaryTitle}>Order summary</Text>
            </View>

            {/* Mobile Phlebotomy fee — single combined line (base + distance + reserve + surcharges) */}
            {visitType === 'mobile' && (
              <>
                {timeSlotLabel ? (
                  <FadeInUp delay={20} distance={6}>
                    <View style={styles.slotTypeBanner}>
                      <Ionicons name="time-outline" size={12} color={COLORS.navy} />
                      <Text style={styles.slotTypeBannerText}>
                        {slotType === 'urgent' ? 'Urgent' : slotType === 'fixed' ? 'Fixed time' : 'Flexible'} · {timeSlotLabel}
                      </Text>
                    </View>
                  </FadeInUp>
                ) : null}

                <SummaryRow
                  icon="home"
                  iconColor={COLORS.blue}
                  iconBg={COLORS.blueLight}
                  label="Mobile Phlebotomy fee"
                  value={`$${mobileVisitTotal.toFixed(0)}`}
                  delay={40}
                />
              </>
            )}

            {/* Lab Tests — itemized, one row per test */}
            {labTestsTotal > 0 && (
              <>
                <FadeInUp delay={110} distance={6}>
                  <Text style={styles.summarySectionLabel}>Lab Tests</Text>
                </FadeInUp>
                {appliedOffer ? (
                  <>
                    <SummaryRow
                      icon="pricetag"
                      iconColor={COLORS.navy}
                      iconBg={COLORS.blueLight}
                      label={`${appliedOffer.title} (${appliedOffer.testIds?.length ?? appliedOffer.matchedCount} tests)`}
                      value={`$${appliedOffer.price.toFixed(0)}`}
                      delay={130}
                    />
                    {extraTestsData.map((test, i) => (
                      <SummaryRow
                        key={test.id ?? i}
                        icon="flask"
                        iconColor={COLORS.purple}
                        iconBg={COLORS.purpleLight}
                        label={test.name}
                        value={`$${(test.discountPrice ?? test.price).toFixed(0)}`}
                        delay={150 + i * 40}
                      />
                    ))}
                  </>
                ) : route?.params?.selectedTests?.length > 0 ? (
                  route.params.selectedTests.map((test, i) => {
                    const hasDiscount = test.discountPrice != null && test.discountPrice < test.price;
                    const displayPrice = hasDiscount ? test.discountPrice : test.price;
                    return (
                      <SummaryRow
                        key={test.id ?? i}
                        icon="flask"
                        iconColor={COLORS.purple}
                        iconBg={COLORS.purpleLight}
                        label={test.name}
                        value={`$${displayPrice.toFixed(0)}`}
                        delay={130 + i * 40}
                      />
                    );
                  })
                ) : (
                  <SummaryRow
                    icon="flask"
                    iconColor={COLORS.purple}
                    iconBg={COLORS.purpleLight}
                    label={labTestsNames}
                    value={`$${labTestsTotal.toFixed(0)}`}
                    delay={130}
                  />
                )}
              </>
            )}

            <View style={styles.summaryDivider} />

            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>Total due today</Text>
                <Text style={styles.totalSub}>All fees included</Text>
              </View>
              <Text style={styles.totalAmount}>
                {grandTotal != null ? `$${grandTotal.toFixed(0)}` : '—'}
              </Text>
            </View>
          </View>
        </FadeInUp>

        {/* ── Payment Method ── */}
        <FadeInUp delay={140}>
          <AnimatedPressable style={styles.paymentCard} scaleTo={0.99} onPress={() => {}}>
            <View style={styles.paymentHeader}>
              <Text style={styles.paymentTitle}>Payment Method</Text>
              <View style={styles.paymentChangeBadge}>
                <Text style={styles.paymentChange}>Change</Text>
              </View>
            </View>
            <View style={styles.paymentMethodRow}>
              <View style={styles.cardIcon}>
                <IconPop delay={200}>
                  <Ionicons name="card" size={22} color={COLORS.navy} />
                </IconPop>
              </View>
              <View style={styles.paymentMethodInfo}>
                <Text style={styles.paymentMethodTitle}>Card / Apple Pay / Google Pay</Text>
                <Text style={styles.paymentMethodSub}>Secure payment powered by Stripe</Text>
              </View>
              <Feather name="chevron-right" size={20} color={COLORS.gray} />
            </View>
          </AnimatedPressable>
        </FadeInUp>

        {/* ── Stripe Banner ── */}
        <FadeInUp delay={180}>
          <View style={styles.stripeBanner}>
            <View style={styles.stripeIconRing}>
              <Ionicons name="shield-checkmark" size={18} color={COLORS.teal} />
            </View>
            <Text style={styles.stripeText}>
              Secured by Stripe · SSL Encrypted · PCI Compliant.
              Your card details are never stored on our servers.
            </Text>
          </View>
        </FadeInUp>
      </ScrollView>

      {/* ── Footer / Pay Button ── */}
      <View style={styles.footer}>
        <AnimatedPressable
          style={[styles.payBtn, (loading || grandTotal == null) && styles.payBtnLoading]}
          onPress={handlePay}
          disabled={loading || grandTotal == null}
          scaleTo={0.97}
        >
          {loading
            ? <ActivityIndicator color={COLORS.white} size="small" />
            : (
              <View style={styles.payBtnContent}>
                <Ionicons name="lock-closed" size={16} color={COLORS.white} style={{ marginRight: 8 }} />
                <Text style={styles.payBtnText}>
                  {grandTotal != null ? `Pay $${grandTotal.toFixed(2)}` : 'Loading…'}
                </Text>
              </View>
            )
          }
        </AnimatedPressable>
        <Text style={styles.footerNote}>By paying you agree to our Terms & Privacy Policy</Text>
      </View>

      <SuccessOverlay
        visible={showSuccess}
        amount={successData.amount}
        onContinue={handleSuccessContinue}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.navyDark, textAlign: 'center' },
  headerSub: { fontSize: 12, color: COLORS.gray, marginTop: 1, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 20 },

  summaryCard: {
    backgroundColor: COLORS.offWhite, borderRadius: 18, padding: 18,
    marginBottom: 20, borderWidth: 1.5, borderColor: COLORS.border,
    shadowColor: '#0D1F3C', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  summaryTitleIconRing: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: '#EAF0FB', alignItems: 'center', justifyContent: 'center',
  },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navyDark },
  slotTypeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EAF0FB', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12, alignSelf: 'flex-start',
  },
  slotTypeBannerText: { fontSize: 11, fontWeight: '700', color: COLORS.navy },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  summaryRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 12 },
  summaryIconRing: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryLabel: { fontSize: 13, color: COLORS.bodyText, flex: 1, flexWrap: 'wrap' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark },
  summaryDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  summarySectionLabel: {
    fontSize: 13, fontWeight: '800', color: COLORS.navyDark,
    marginTop: 4, marginBottom: 10,
  },
  feeGroupHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
  },
  summaryIconRing2: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: COLORS.blueLight, alignItems: 'center', justifyContent: 'center',
  },
  feeGroupTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.navyDark },
  feeGroupTotal: { fontSize: 15, fontWeight: '900', color: COLORS.navy },
  feeBreakdownBox: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 42,
    marginBottom: 16,
  },
  feeBreakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7,
  },
  feeBreakdownLabel: { fontSize: 12, color: COLORS.gray },
  feeBreakdownValue: { fontSize: 12, fontWeight: '700', color: COLORS.bodyText },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, fontWeight: '800', color: COLORS.navyDark },
  totalSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  totalAmount: { fontSize: 28, fontWeight: '900', color: COLORS.navy },

  paymentCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 18,
    marginBottom: 20, borderWidth: 1.5, borderColor: COLORS.border,
  },
  paymentHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  paymentTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark },
  paymentChangeBadge: {
    backgroundColor: '#EAF0FB', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  paymentChange: { fontSize: 12, fontWeight: '700', color: COLORS.navy },
  paymentMethodRow: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#EEF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  paymentMethodInfo: { flex: 1 },
  paymentMethodTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navyDark },
  paymentMethodSub: { fontSize: 12, color: COLORS.gray, marginTop: 3 },

  stripeBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E2E8F0', gap: 12,
  },
  stripeIconRing: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: COLORS.tealLight, alignItems: 'center', justifyContent: 'center',
  },
  stripeText: { flex: 1, fontSize: 12, color: COLORS.gray, lineHeight: 18 },

  footer: {
    padding: 20, borderTopWidth: 1,
    borderTopColor: COLORS.lightGray, backgroundColor: COLORS.white,
  },
  payBtn: {
    backgroundColor: COLORS.navy, borderRadius: 14,
    paddingVertical: 17, alignItems: 'center', marginBottom: 10,
  },
  payBtnContent: { flexDirection: 'row', alignItems: 'center' },
  payBtnLoading: { opacity: 0.75 },
  payBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  footerNote: { textAlign: 'center', fontSize: 11, color: COLORS.gray },

  // ── Success overlay ──
  overlayBg: {
    flex: 1,
    backgroundColor: 'rgba(13,31,60,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  successCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  successRing: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: COLORS.green,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  pulseRing: {
    position: 'absolute',
    width: 44, height: 44, borderRadius: 14,
  },
  successTitle: { fontSize: 19, fontWeight: '900', color: COLORS.navyDark, marginBottom: 6 },
  successAmount: { fontSize: 34, fontWeight: '900', color: COLORS.navy, marginBottom: 4 },
  successSub: { fontSize: 13, color: COLORS.gray, marginBottom: 26 },
  successBtn: {
    width: '100%',
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  successBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});