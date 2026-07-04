import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import { getStoredPatientUser, bookAppointment, fetchPricing } from '../utils/auth';

const BACKEND_URL = 'https://musb-diagnostic-website.onrender.com';

const COLORS = {
  navy: '#1B3A8C', navyDark: '#0D1F3C', white: '#FFFFFF',
  offWhite: '#F4F7FB', lightGray: '#E8EEF5', gray: '#8A9BB0',
  bodyText: '#4A5568', border: '#D1DBE8', green: '#22C55E',
};

export default function CheckoutScreen({ navigation, route }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading]               = useState(false);
  const [pricingLoading, setPricingLoading] = useState(true);

  // ── Pricing state (fetched from backend) ──────────────────────────────────
  const [baseVisitPrice, setBaseVisitPrice] = useState(null);
  const [perMileRate, setPerMileRate]       = useState(null);

  // ── Route params (all safely coerced) ────────────────────────────────────
  const labTestsTotal = Number(route?.params?.labTestsTotal) || 0;
  const labTestsNames = route?.params?.labTestsNames  || '';
  const address       = route?.params?.address        || '';
  const zipCode        = route?.params?.zipCode        || '';
  const visitType     = route?.params?.visitType      || 'mobile';
  const preferredTime = route?.params?.preferredTime  || 'Now';
  const preferredDate = route?.params?.preferredDate  || new Date().toISOString().split('T')[0];
  const [distanceMilesResolved, setDistanceMilesResolved] = useState(0);
  const [patientUser, setPatientUser] = useState(null);

  // ── Derived totals (safe — no toFixed on null) ────────────────────────────
  const [dynamicFeesTotal, setDynamicFeesTotal] = useState(0);
  const [dynamicFeesBreakdown, setDynamicFeesBreakdown] = useState({});

  const distanceCharge   = perMileRate    != null ? +(distanceMilesResolved * perMileRate).toFixed(2)  : 0;
  const mobileVisitTotal = baseVisitPrice != null ? +(baseVisitPrice + distanceCharge + dynamicFeesTotal).toFixed(2) : null;
  const grandTotal       = mobileVisitTotal != null ? +(mobileVisitTotal + labTestsTotal).toFixed(2) : null;

  // ── Fetch pricing on mount (mobile visits only — in-person has no base fee) ─
  useEffect(() => {
    if (visitType !== 'mobile') {
      // In-person (or any non-mobile) visit: no base fee, no distance charge
      setBaseVisitPrice(0);
      setPerMileRate(0);
      setDistanceMilesResolved(0);
      setPricingLoading(false);
      return;
    }

    (async () => {
      try {
        const pricing = await fetchPricing({
          address,
          bookingDate: preferredDate,
          bookingTime: preferredTime,
        });

        setBaseVisitPrice(Number(pricing.baseFee));
        setPerMileRate(Number(pricing.mileageRate));
        setDistanceMilesResolved(Number(pricing.distanceMiles) || 0);
        setDynamicFeesTotal(Number(pricing.dynamicFees?.total) || 0);
        setDynamicFeesBreakdown(pricing.dynamicFees || {});
      } catch (err) {
        Alert.alert(
          'Pricing unavailable',
          err.message || 'Could not load pricing info. Please try again.',
          [{ text: 'Go Back', onPress: () => navigation.goBack() }]
        );
      } finally {
        setPricingLoading(false);
      }
    })();
  }, [visitType]);

  useEffect(() => {
    getStoredPatientUser().then(setPatientUser);
  }, []);

  const patientEmail = patientUser?.email || route?.params?.email || '';

  // ── Pay handler ───────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (grandTotal == null) return;
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/payments/create-payment-intent/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: grandTotal.toFixed(2),
          currency: 'usd',
          email: patientEmail,
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
        if (paymentError.code !== 'Canceled') {
          Alert.alert('Payment Failed', paymentError.message);
        }
      } else {
        try {
          const bookingResult = await bookAppointment({
            test_name: labTestsTotal > 0 ? labTestsNames : 'Mobile Phlebotomy Visit',
            test_price: labTestsTotal > 0 ? labTestsTotal : mobileVisitTotal,
            full_name: patientUser?.name || '',
            email: patientUser?.email || patientEmail,
            phone: patientUser?.phone || '',
            address,
            zipCode,
            visit_type: visitType,
            preferred_date: preferredDate,
            preferred_time: preferredTime,
            payment_method: 'Card',
          });

          Alert.alert(
            '✅ Payment Successful!',
            `$${grandTotal.toFixed(2)} paid successfully.\nYour appointment is confirmed!`,
            [{ text: 'OK', onPress: () => navigation.navigate('PatientHome', {
              appointmentId: bookingResult.appointment_id,
            }) }]
          );
        } catch (bookingErr) {
          Alert.alert(
            'Payment received, booking issue',
            `Your payment was successful, but we couldn't save your appointment details (${bookingErr.message}). Please contact support.`,
            [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
          );
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please check your connection and try again.');
    }
    setLoading(false);
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (pricingLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.navy} />
        <Text style={{ marginTop: 12, color: COLORS.gray }}>Loading pricing…</Text>
      </SafeAreaView>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Checkout</Text>
          <Text style={styles.headerSub}>Confirm your order</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Order Summary ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order summary</Text>

          {/* Mobile Phlebotomy fee — base fee set by super admin */}
          {visitType === 'mobile' && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLeft}>
                <Text style={styles.summaryIcon}>🏠</Text>
                <Text style={styles.summaryLabel}>Mobile Phlebotomy fee</Text>
              </View>
              <Text style={styles.summaryValue}>
                ${baseVisitPrice != null ? baseVisitPrice.toFixed(0) : '—'}
              </Text>
            </View>
          )}

          {/* Distance fee — calculated from address */}
          {visitType === 'mobile' && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLeft}>
                <Text style={styles.summaryIcon}>📍</Text>
                <Text style={styles.summaryLabel}>Distance fee</Text>
              </View>
              <Text style={styles.summaryValue}>${distanceCharge.toFixed(0)}</Text>
            </View>
          )}

          {/* Dynamic surcharges (same-day, urgent, weekend, holiday) */}
          {visitType === 'mobile' && dynamicFeesBreakdown.same_day_fee > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLeft}>
                <Text style={styles.summaryIcon}>⏱️</Text>
                <Text style={styles.summaryLabel}>Same-day booking fee</Text>
              </View>
              <Text style={styles.summaryValue}>${dynamicFeesBreakdown.same_day_fee.toFixed(0)}</Text>
            </View>
          )}
          {visitType === 'mobile' && dynamicFeesBreakdown.urgent_fee > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLeft}>
                <Text style={styles.summaryIcon}>⚡</Text>
                <Text style={styles.summaryLabel}>Urgent booking fee</Text>
              </View>
              <Text style={styles.summaryValue}>${dynamicFeesBreakdown.urgent_fee.toFixed(0)}</Text>
            </View>
          )}
          {visitType === 'mobile' && dynamicFeesBreakdown.weekend_fee > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLeft}>
                <Text style={styles.summaryIcon}>📅</Text>
                <Text style={styles.summaryLabel}>Weekend fee</Text>
              </View>
              <Text style={styles.summaryValue}>${dynamicFeesBreakdown.weekend_fee.toFixed(0)}</Text>
            </View>
          )}
          {visitType === 'mobile' && dynamicFeesBreakdown.holiday_fee > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryRowLeft}>
                <Text style={styles.summaryIcon}>🎉</Text>
                <Text style={styles.summaryLabel}>Holiday fee</Text>
              </View>
              <Text style={styles.summaryValue}>${dynamicFeesBreakdown.holiday_fee.toFixed(0)}</Text>
            </View>
          )}

          {/* Lab Tests — itemized, one row per test */}
          {labTestsTotal > 0 && (
            <>
              <Text style={styles.summarySectionLabel}>Lab Tests</Text>
              {route?.params?.selectedTests?.length > 0 ? (
                route.params.selectedTests.map((test, i) => (
                  <View key={test.id ?? i} style={styles.summaryRow}>
                    <View style={styles.summaryRowLeft}>
                      <Text style={styles.summaryIcon}>🧪</Text>
                      <Text style={styles.summaryLabel}>{test.name}</Text>
                    </View>
                    <Text style={styles.summaryValue}>${test.price.toFixed(0)}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.summaryRow}>
                  <View style={styles.summaryRowLeft}>
                    <Text style={styles.summaryIcon}>🧪</Text>
                    <Text style={styles.summaryLabel}>{labTestsNames}</Text>
                  </View>
                  <Text style={styles.summaryValue}>${labTestsTotal.toFixed(0)}</Text>
                </View>
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

        {/* ── Payment Method ── */}
        <View style={styles.paymentCard}>
          <View style={styles.paymentHeader}>
            <Text style={styles.paymentTitle}>Payment Method</Text>
            <Text style={styles.paymentChange}>Change</Text>
          </View>
          <View style={styles.paymentMethodRow}>
            <View style={styles.cardIcon}>
              <Text style={styles.cardIconText}>💳</Text>
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodTitle}>Card / Apple Pay / Google Pay</Text>
              <Text style={styles.paymentMethodSub}>Secure payment powered by Stripe</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>
        </View>

        {/* ── Stripe Banner ── */}
        <View style={styles.stripeBanner}>
          <Text style={styles.stripeIcon}>🔒</Text>
          <Text style={styles.stripeText}>
            Secured by Stripe · SSL Encrypted · PCI Compliant.
            Your card details are never stored on our servers.
          </Text>
        </View>
      </ScrollView>

      {/* ── Footer / Pay Button ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payBtn, (loading || grandTotal == null) && styles.payBtnLoading]}
          activeOpacity={0.85}
          onPress={handlePay}
          disabled={loading || grandTotal == null}
        >
          {loading
            ? <ActivityIndicator color={COLORS.white} size="small" />
            : <Text style={styles.payBtnText}>
                {/* ✅ Safe — never calls toFixed on null */}
                {grandTotal != null ? `Pay $${grandTotal.toFixed(2)}` : 'Loading…'}
              </Text>
          }
        </TouchableOpacity>
        <Text style={styles.footerNote}>By paying you agree to our Terms & Privacy Policy</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 18, color: COLORS.navyDark, fontWeight: '700' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.navyDark },
  headerSub: { fontSize: 13, color: COLORS.gray, marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 20 },
  summaryCard: {
    backgroundColor: COLORS.offWhite, borderRadius: 16, padding: 18,
    marginBottom: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: COLORS.navyDark, marginBottom: 16 },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  summaryRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 12 },
  summaryIcon: { fontSize: 18 },
  summaryLabel: { fontSize: 13, color: COLORS.bodyText, flex: 1, flexWrap: 'wrap' },
  summaryValue: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark },
  summaryDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  summarySectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.navyDark,
    marginTop: 4,
    marginBottom: 10,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, fontWeight: '800', color: COLORS.navyDark },
  totalSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  totalAmount: { fontSize: 28, fontWeight: '900', color: COLORS.navy },
  paymentCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 18,
    marginBottom: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  paymentHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  paymentTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark },
  paymentChange: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  paymentMethodRow: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#EEF3FF', alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  cardIconText: { fontSize: 22 },
  paymentMethodInfo: { flex: 1 },
  paymentMethodTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navyDark },
  paymentMethodSub: { fontSize: 12, color: COLORS.gray, marginTop: 3 },
  arrow: { fontSize: 26, color: COLORS.gray, fontWeight: '300' },
  stripeBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  stripeIcon: { fontSize: 20, marginRight: 10 },
  stripeText: { flex: 1, fontSize: 12, color: COLORS.gray, lineHeight: 18 },
  footer: {
    padding: 20, borderTopWidth: 1,
    borderTopColor: COLORS.lightGray, backgroundColor: COLORS.white,
  },
  payBtn: {
    backgroundColor: COLORS.navy, borderRadius: 14,
    paddingVertical: 17, alignItems: 'center', marginBottom: 10,
  },
  payBtnLoading: { opacity: 0.7 },
  payBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  footerNote: { textAlign: 'center', fontSize: 11, color: COLORS.gray },
});
