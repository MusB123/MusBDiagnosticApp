import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  navy: '#1B3A8C',
  navyDark: '#0D1F3C',
  white: '#FFFFFF',
  offWhite: '#F4F7FB',
  lightGray: '#E8EEF5',
  gray: '#8A9BB0',
  bodyText: '#4A5568',
  border: '#D1DBE8',
  red: '#E63946',
};

// ── Generate next 14 days ──────────────────────────────────────────────────
const generateDates = () => {
  const dates = [];
  const today = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 1; i <= 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push({
      id: i.toString(),
      day: date.getDate(),
      month: monthNames[date.getMonth()],
      weekday: dayNames[date.getDay()],
      fullDate: date.toDateString(),
    });
  }
  return dates;
};

// ── Generate hours / minutes / periods ────────────────────────────────────
const HOURS = Array.from( 
    {length: 24 },
    (_, i) => String(i).padStart(2, '0')
);
const MINUTES = ['00', '15', '30', '45']; 
const ITEM_HEIGHT = 52;

export default function ScheduleScreen({ navigation, route }) {
  const dates = generateDates();
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');

  const formattedTime = `${selectedHour}:${selectedMinute}`;
  const formattedDate = `${selectedDate.month} ${selectedDate.day}, ${selectedDate.fullDate.split(' ')[3]}`;

  const handleBookAppointment = () => {
    Alert.alert(
      '✅ Appointment Scheduled!',
      `Your appointment is booked for\n${formattedDate} at ${formattedTime}.\n\nThe doctor will be notified shortly.`,
      [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
    );
  };

  const ScrollPicker = ({ data, selected, onSelect }) => (
    <ScrollView
      style={styles.pickerScroll}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Appointment Schedule</Text>
          <Text style={styles.headerSub}>Select your preferred date and convenient arrival window.</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Two Column Layout ── */}
        <View style={styles.twoCol}>

          {/* ── LEFT: Date Picker ── */}
          <View style={styles.leftCol}>
            <Text style={styles.colLabel}>
              SELECT DATE <Text style={styles.required}>*</Text>
            </Text>
            {dates.map((date) => {
              const isSelected = selectedDate.id === date.id;
              return (
                <TouchableOpacity
                  key={date.id}
                  style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                  onPress={() => setSelectedDate(date)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateText, isSelected && styles.dateTextSelected]}>
                    {date.month} {date.day}
                  </Text>
                  <Text style={[styles.weekdayText, isSelected && styles.weekdayTextSelected]}>
                    {date.weekday}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── RIGHT: Time Picker ── */}
          <View style={styles.rightCol}>
            <Text style={styles.colLabel}>
              SELECT ARRIVAL TIME <Text style={styles.required}>*</Text>
            </Text>

            <View style={styles.timePickerCard}>
              {/* Highlight bar */}
              <View style={styles.highlightBar} />

              {/* Picker columns */}
              <View style={styles.pickerRow}>
                {/* Hours */}
                <ScrollPicker
                  data={HOURS}
                  selected={selectedHour}
                  onSelect={setSelectedHour}
                />
                <Text style={styles.colon}>:</Text>
                {/* Minutes */}
                <ScrollPicker
                  data={MINUTES}
                  selected={selectedMinute}
                  onSelect={setSelectedMinute}
                />
              </View>

              {/* Selected time badge */}
              <View style={styles.selectedTimeBadge}>
                <Text style={styles.selectedTimeText}>Selected Time: {formattedTime}</Text>
              </View>
            </View>

            {/* Selected date + time summary */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>📅 Scheduled for</Text>
              <Text style={styles.summaryDate}>{formattedDate}</Text>
              <Text style={styles.summaryTime}>{formattedTime}</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* Book Appointment Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.bookBtn}
          activeOpacity={0.85}
          onPress={handleBookAppointment}
        >
          <Text style={styles.bookBtnText}>📅   Book Appointment</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>
          Doctor will be notified after booking
        </Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    marginTop: 2,
  },
  backBtnText: { fontSize: 18, color: COLORS.navyDark, fontWeight: '700' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.navyDark, marginBottom: 4 },
  headerSub: { fontSize: 12, color: COLORS.gray, lineHeight: 18 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 20 },

  // Two column
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  leftCol: { flex: 1 },
  rightCol: { flex: 1 },

  colLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.navyDark,
    letterSpacing: 1,
    marginBottom: 10,
  },
  required: { color: COLORS.red },

  // Date cards
  dateCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  dateCardSelected: {
    borderColor: COLORS.navy,
    backgroundColor: '#F0F4FF',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.navyDark,
  },
  dateTextSelected: { color: COLORS.navy },
  weekdayText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
  weekdayTextSelected: { color: COLORS.navy },

  // Time picker card
  timePickerCard: {
    backgroundColor: COLORS.offWhite,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  highlightBar: {
    position: 'absolute',
    top: '38%',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT * 3,
    gap: 4,
  },
  pickerScroll: {
    flex: 1,
    height: ITEM_HEIGHT * 3,
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  pickerItemSelected: {},
  pickerText: {
    fontSize: 20,
    color: COLORS.gray,
    fontWeight: '500',
  },
  pickerTextSelected: {
    fontSize: 24,
    color: COLORS.navyDark,
    fontWeight: '900',
  },
  colon: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.navyDark,
    marginBottom: 4,
  },


  // Selected time badge
  selectedTimeBadge: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.navyDark,
  },

  // Summary box
  summaryBox: {
    backgroundColor: '#EBF0FB',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7D4F5',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryDate: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.navyDark,
    marginBottom: 2,
  },
  summaryTime: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.navy,
  },

  // Footer
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  bookBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 8,
  },
  bookBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.gray,
  },
});
