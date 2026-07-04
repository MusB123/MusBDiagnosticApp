import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { getBookingDraft } from '../utils/bookingDraft';

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
      {data.map((item) => {
        const isSelected = item === selected;
        return (
          <TouchableOpacity
            key={item}
            style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pickerText, isSelected && styles.pickerTextSelected]}>
              {item}
            </Text>
          </TouchableOpacity>
        );
      })}
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

  const [doctorOrder, setDoctorOrder] = useState('self');
  const [prescriptionFile, setPrescriptionFile] = useState(null);

  const [selectedTests, setSelectedTests] = useState([]);
  const [testsTotal, setTestsTotal] = useState(0);

  // Pick up tests returned from SelectTests
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const params = route?.params;
      if (params?.selectedTestsData) {
        setSelectedTests(params.selectedTestsData);
        setTestsTotal(params.testsTotal ?? 0);
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
      } else if (result.type === 'success') {
        setPrescriptionFile(result);
      }
    } catch (err) {
      console.warn('Document pick error:', err);
    }
  };

  const handleSelectDoctorOrder = (value) => {
    setDoctorOrder(value);
    if (value === 'order') {
      setSelectedTests([]);
      setTestsTotal(0);
    }
    if (value === 'self') {
      setPrescriptionFile(null);
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
        <Text style={styles.headerTitle}>Book mobile visit</Text>
        <View style={styles.pathBadge}>
          <Text style={styles.pathBadgeText}>Path A</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Visit Address (read-only — set on Home screen) */}
        <Text style={styles.sectionLabel}>Visit address</Text>
        <View style={styles.addressDisplay}>
          <Text style={styles.addressDisplayIcon}>📍</Text>
          <Text style={styles.addressDisplayText} numberOfLines={2}>
            {address || 'No address set'}
          </Text>
        </View>

        {/* Doctor's Order */}
        <Text style={styles.sectionLabel}>Doctor's order</Text>
        <Text style={styles.sectionSubtitle}>
          Having a doctor's request order helps us route your tests automatically.
        </Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, doctorOrder === 'self' && styles.toggleBtnSelected]}
            onPress={() => handleSelectDoctorOrder('self')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleBtnText, doctorOrder === 'self' && styles.toggleBtnTextSelected]}>
              No, self-referred
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, doctorOrder === 'order' && styles.toggleBtnSelected]}
            onPress={() => handleSelectDoctorOrder('order')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleBtnText, doctorOrder === 'order' && styles.toggleBtnTextSelected]}>
              Yes, I have an order
            </Text>
          </TouchableOpacity>
        </View>

        {/* Upload box — only when doctor's order selected */}
        {doctorOrder === 'order' && (
          <TouchableOpacity
            style={[styles.uploadBox, prescriptionFile && styles.uploadBoxDone]}
            onPress={handlePickDocument}
            activeOpacity={0.8}
          >
            {prescriptionFile ? (
              <>
                <View style={styles.uploadDoneIconWrap}>
                  <Text style={styles.uploadDoneIcon}>✓</Text>
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
                  <Text style={styles.uploadArrowText}>↑</Text>
                </View>
                <Text style={styles.uploadTitle}>Click to Upload or Drag File</Text>
                <Text style={styles.uploadSub}>PDF, PNG, JPG up to 10MB</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Lab Tests Section */}
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
            <View style={styles.labIconWrap}>
              <Text style={styles.labIconEmoji}>🧪</Text>
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
                  <View key={test.id ?? i} style={styles.testPill}>
                    <View style={styles.testPillLeft}>
                      <View style={styles.testDot} />
                      <Text style={styles.testPillName} numberOfLines={1}>
                        {test.name}
                      </Text>
                    </View>
                    <Text style={styles.testPillPrice}>${test.price.toFixed(0)}</Text>
                  </View>
                ))}
                <View style={styles.testsTotalRow}>
                  <Text style={styles.testsTotalLabel}>Tests subtotal</Text>
                  <Text style={styles.testsTotalValue}>${testsTotal.toFixed(0)}</Text>
                </View>
              </View>
            </>
          )}

          <TouchableOpacity
            style={[
              styles.selectTestsBtn,
              doctorOrder === 'order' && styles.selectTestsBtnOptional,
            ]}
            activeOpacity={0.85}
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
          </TouchableOpacity>

          {doctorOrder === 'order' && selectedTests.length === 0 && (
            <Text style={styles.skipHint}>
              You can proceed without selecting extra tests.
            </Text>
          )}
        </View>

        {/* Date Picker */}
        <Text style={styles.sectionLabel}>Select date</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateRow}
        >
          {dates.map((date) => {
            const isSelected = selectedDate.id === date.id;
            return (
              <TouchableOpacity
                key={date.id}
                style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                onPress={() => setSelectedDate(date)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dateWeekday, isSelected && styles.dateTextSelected]}>
                  {date.weekday}
                </Text>
                <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>
                  {date.day}
                </Text>
                <Text style={[styles.dateMonth, isSelected && styles.dateTextSelected]}>
                  {date.month}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time Picker */}
        <Text style={styles.sectionLabel}>Select arrival time</Text>
        <View style={styles.timePickerCard}>
          <View style={styles.pickerRow}>
            <ScrollPicker data={HOURS} selected={selectedHour} onSelect={setSelectedHour} />
            <Text style={styles.colon}>:</Text>
            <ScrollPicker data={MINUTES} selected={selectedMinute} onSelect={setSelectedMinute} />
            <ScrollPicker data={PERIODS} selected={selectedPeriod} onSelect={setSelectedPeriod} />
          </View>
        </View>

        {/* Mobile visit note */}
        <View style={styles.mobileNote}>
          <Text style={styles.mobileNoteText}>
            🧑‍⚕️ A licensed phlebotomist will be assigned automatically after booking.
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>📅 Scheduled for</Text>
          <Text style={styles.summaryDate}>{formattedDateLabel}</Text>
          <Text style={styles.summaryTime}>{formattedTime}</Text>
        </View>
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.confirmBtn}
          activeOpacity={0.85}
          onPress={async () => {
            try {
              const response = await fetch(
                'https://musb-diagnostic-website.onrender.com/api/pricing/preview/',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    address,
                    booking_date: selectedDate.isoDate,
                    booking_time: formattedTime,
                    provider_type: 'INDEPENDENT_PHLEBOTOMIST',
                  }),
                }
              );
              const preview = await response.json();

              navigation.navigate('Checkout', {
                labTestsTotal: testsTotal,
                labTestsNames: selectedTests.map((t) => t.name).join(', '),
                selectedTests,
                address,
                zipCode,
                visitType: 'mobile',
                preferredDate: selectedDate.isoDate,
                preferredTime: formattedTime,
                distanceMiles: Number(preview.distanceMiles || 0),
                doctorOrder,
                prescriptionFile,
              });
            } catch (err) {
              console.error(err);
            }
          }}
        >
          <Text style={styles.confirmBtnText}>
            Confirm booking{testsTotal > 0 ? ` · $${testsTotal.toFixed(0)} tests` : ''}
          </Text>
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
    backgroundColor: COLORS.pathABg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pathBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.pathA },
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
  addressDisplay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.offWhite,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  addressDisplayIcon: { fontSize: 15, marginTop: 1 },
  addressDisplayText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.navyDark,
    fontWeight: '500',
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
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  toggleBtnSelected: {
    borderColor: COLORS.navyDark,
    backgroundColor: COLORS.offWhite,
  },
  toggleBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.gray },
  toggleBtnTextSelected: { color: COLORS.navyDark },
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
  uploadArrowText: {
    fontSize: 22,
    color: COLORS.gray,
    fontWeight: '700',
    lineHeight: 26,
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
  uploadDoneIcon: {
    fontSize: 22,
    color: COLORS.white,
    fontWeight: '900',
    lineHeight: 26,
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
  labIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labIconEmoji: { fontSize: 22 },
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
  dateRow: { gap: 10, paddingRight: 4 },
  dateCard: {
    width: 70,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  dateCardSelected: { borderColor: COLORS.navy, backgroundColor: '#F0F4FF' },
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
  pickerItemSelected: { backgroundColor: COLORS.lightGray },
  pickerText: { fontSize: 17, color: COLORS.gray, fontWeight: '500' },
  pickerTextSelected: { fontSize: 19, color: COLORS.navyDark, fontWeight: '900' },
  colon: { fontSize: 20, fontWeight: '900', color: COLORS.navyDark },
  mobileNote: {
    backgroundColor: '#EBF0FB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7D4F5',
    marginTop: 20,
  },
  mobileNoteText: { fontSize: 13, color: COLORS.bodyText, lineHeight: 20 },
  summaryBox: {
    backgroundColor: '#EBF0FB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7D4F5',
    alignItems: 'center',
    marginTop: 12,
  },
  summaryLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '600', marginBottom: 4 },
  summaryDate: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navyDark,
    marginBottom: 2,
  },
  summaryTime: { fontSize: 18, fontWeight: '900', color: COLORS.navy },
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