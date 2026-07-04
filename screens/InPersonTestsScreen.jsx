import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  pathC: '#D97706',
  pathCBg: '#FEF3C7',
  yellowBg: '#FFFBEB',
  yellowBorder: '#F59E0B',
  yellowText: '#92400E',
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
    icon: '🏥',
  },
];

export default function InPersonTestsScreen({ navigation, route }) {
  const [selectedTestsData, setSelectedTestsData] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [patientUser, setPatientUser] = useState(null);

  // Pick up tests returned from SelectTestsScreen
  useEffect(() => {
    if (route?.params?.selectedTestsData) {
      setSelectedTestsData(route.params.selectedTestsData);
    }
  }, [route?.params?.selectedTestsData]);

  useEffect(() => {
    getStoredPatientUser().then(setPatientUser);
  }, []);

  const testsTotal = selectedTestsData.reduce((sum, t) => sum + t.price, 0);
  const selectedTestIds = selectedTestsData.map((t) => t.id);
  const center = CENTERS.find((c) => c.id === selectedCenter);

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
      preferredDate: new Date().toISOString().split('T')[0],
      preferredTime: 'Walk-in',
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
        preferred_date: new Date().toISOString().split('T')[0],
        preferred_time: 'Walk-in',
        payment_method: paymentMethod === 'pay_at_center' ? 'Pay at Center' : 'Card',
      });

      Alert.alert(
        '✅ Appointment booked!',
        paymentMethod === 'pay_at_center'
          ? `Your visit to ${center?.name} is confirmed. Please pay $${testsTotal.toFixed(0)} at the center.`
          : 'Your appointment is confirmed.',
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>In-center visit</Text>
        <View style={styles.pathBadge}>
          <Text style={styles.pathBadgeText}>Path C</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tests Section */}
        <Text style={styles.sectionLabel}>Selected tests</Text>

        {selectedTestsData.length === 0 ? (
          <View style={styles.emptyTestsCard}>
            <Text style={styles.emptyTestsText}>No tests selected yet</Text>
          </View>
        ) : (
          selectedTestsData.map((test) => (
            <View key={test.id} style={styles.testCard}>
              <View style={styles.testInfo}>
                <Text style={styles.testName}>{test.name}</Text>
                {test.desc ? <Text style={styles.testDesc}>{test.desc}</Text> : null}
              </View>
              <Text style={styles.testPrice}>${test.price.toFixed(0)}</Text>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.selectTestsBtn} onPress={goToSelectTests} activeOpacity={0.8}>
          <Text style={styles.selectTestsBtnText}>
            {selectedTestsData.length === 0 ? '+ Do you want to buy a discounted lab test?' : '✎ Edit tests'}
          </Text>
        </TouchableOpacity>

        {/* No Visit Fee Banner */}
        <View style={styles.noFeeBanner}>
          <Text style={styles.noFeeIcon}>🏛</Text>
          <View style={styles.noFeeText}>
            <Text style={styles.noFeeTitle}>In-person — no visit fee</Text>
            <Text style={styles.noFeeDesc}>
              You come to us, so mobile charges do not apply.
            </Text>
          </View>
        </View>

        {/* Select Center */}
        <Text style={styles.sectionLabel}>Select center</Text>

        {CENTERS.map((c) => {
          const isSelected = selectedCenter === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.centerCard, isSelected && styles.centerCardSelected]}
              onPress={() => setSelectedCenter(c.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.centerIcon, isSelected && styles.centerIconSelected]}>
                <Text style={styles.centerIconText}>{c.icon}</Text>
              </View>
              <View style={styles.centerInfo}>
                <Text style={[styles.centerName, isSelected && styles.centerNameSelected]}>
                  {c.name}
                </Text>
                <Text style={styles.centerMeta}>{c.address}</Text>
                <Text style={styles.centerMeta}>{c.hours}</Text>
              </View>
              <View style={[styles.radioBtn, isSelected && styles.radioBtnSelected]}>
                {isSelected && <Text style={styles.radioBtnCheck}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Price Summary */}
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
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.bookBtn, (selectedTestsData.length === 0 || submitting) && styles.bookBtnDisabled]}
          activeOpacity={0.85}
          disabled={selectedTestsData.length === 0 || submitting}
          onPress={handleBookAppointment}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Text style={styles.bookBtnText}>Book appointment →</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 18, color: COLORS.navyDark, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.navyDark },
  pathBadge: {
    backgroundColor: COLORS.pathCBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pathBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.pathC },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 20 },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.navyDark,
    marginBottom: 12,
  },

  emptyTestsCard: {
    backgroundColor: COLORS.offWhite,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  emptyTestsText: { color: COLORS.gray, fontSize: 13 },

  testCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 12,
  },
  testInfo: { flex: 1 },
  testName: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark, marginBottom: 2 },
  testDesc: { fontSize: 12, color: COLORS.gray },
  testPrice: { fontSize: 14, fontWeight: '800', color: COLORS.navyDark },

  selectTestsBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  selectTestsBtnText: { color: COLORS.navy, fontWeight: '700', fontSize: 14 },

  noFeeBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.yellowBg,
    borderWidth: 1,
    borderColor: COLORS.yellowBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    gap: 12,
    alignItems: 'flex-start',
  },
  noFeeIcon: { fontSize: 20, marginTop: 1 },
  noFeeText: { flex: 1 },
  noFeeTitle: { fontSize: 14, fontWeight: '800', color: COLORS.yellowText, marginBottom: 4 },
  noFeeDesc: { fontSize: 13, color: COLORS.yellowText, lineHeight: 19 },

  centerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    gap: 12,
  },
  centerCardSelected: { borderColor: COLORS.pathC, backgroundColor: COLORS.yellowBg },
  centerIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
  },
  centerIconSelected: { backgroundColor: COLORS.pathCBg },
  centerIconText: { fontSize: 22 },
  centerInfo: { flex: 1 },
  centerName: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark, marginBottom: 3 },
  centerNameSelected: { color: COLORS.pathC },
  centerMeta: { fontSize: 12, color: COLORS.gray },
  radioBtn: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  radioBtnSelected: { backgroundColor: COLORS.pathC, borderColor: COLORS.pathC },
  radioBtnCheck: { color: COLORS.white, fontSize: 13, fontWeight: '800' },

  summaryCard: {
    backgroundColor: COLORS.offWhite,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: COLORS.bodyText },
  summaryValue: { fontSize: 13, fontWeight: '700', color: COLORS.navyDark },
  summaryFree: { fontSize: 13, fontWeight: '800', color: COLORS.pathC },
  summaryDivider: { height: 1, backgroundColor: COLORS.border, marginBottom: 10 },
  totalLabel: { fontSize: 15, fontWeight: '800', color: COLORS.navyDark },
  totalValue: { fontSize: 15, fontWeight: '900', color: COLORS.navy },

  footer: { padding: 20, borderTopWidth: 1, borderTopColor: COLORS.lightGray, backgroundColor: COLORS.white },
  bookBtn: { backgroundColor: COLORS.navy, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  bookBtnDisabled: { backgroundColor: COLORS.gray },
  bookBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});