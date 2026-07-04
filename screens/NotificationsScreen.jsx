import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchPatientDashboard } from '../utils/auth';

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
  orange: '#F59E0B',
  orangeLight: '#FEF3C7',
  red: '#EF4444',
  redLight: '#FEE2E2',
  purple: '#7C3AED',
  purpleLight: '#EDE9FE',
  blue: '#3B82F6',
  blueLight: '#EFF6FF',
  unreadDot: '#3B6FE0',
};

const FILTERS = ['All', 'Appointments', 'Documents'];
const filterMap = { All: null, Appointments: 'appointment', Documents: 'document' };

// ── Derive notifications from dashboard payload ────────────────────────────
function deriveNotifications(dashboard) {
  const notifs = [];

  // Upcoming appointments
  (dashboard.upcoming ?? []).forEach((appt) => {
    const status = (appt.status ?? '').toLowerCase();
    const testName = appt.test_name ?? appt.test ?? 'Clinical Test';
    const date = appt.month && appt.day ? `${appt.month} ${appt.day}` : (appt.preferred_date ?? '');
    const time = appt.preferred_time ?? appt.time ?? 'TBD';
    const phleb = appt.assigned_phlebotomist_name ?? null;

    let title = 'Upcoming Appointment';
    let message = `${testName} on ${date} at ${time}.`;
    let icon = '📅';
    let iconBg = COLORS.blueLight;
    let action = 'View Appointment';

    if (status === 'rejected' || status === 'declined') {
      title = 'Appointment Rejected';
      message = `Your request for ${testName} was not approved.${appt.rejection_reason ? ` Reason: ${appt.rejection_reason}` : ''}`;
      icon = '❌';
      iconBg = COLORS.redLight;
      action = null;
    } else if (status === 'assigned' || status === 'enroute' || status === 'in_progress') {
      title = 'Specialist Assigned';
      message = `${phleb ?? 'A specialist'} has been assigned to your ${testName} visit on ${date}.`;
      icon = '🚗';
      iconBg = COLORS.purpleLight;
      action = 'Track Visit';
    } else if (status === 'arrived') {
      title = 'Specialist Arrived';
      message = `${phleb ?? 'Your specialist'} has arrived for your ${testName} appointment.`;
      icon = '📍';
      iconBg = COLORS.greenLight;
      action = 'View PIN';
    } else if (status === 'pending_approval' || status === 'hub_review') {
      title = 'Appointment Under Review';
      message = `Your ${testName} request is being reviewed by our team.`;
      icon = '⏳';
      iconBg = COLORS.orangeLight;
      action = null;
    } else if (phleb) {
      message = `${testName} on ${date} at ${time}. ${phleb} will assist you.`;
      action = 'View Appointment';
    }

    notifs.push({
      id: `appt-${appt.id ?? appt._id}`,
      type: 'appointment',
      title,
      message,
      icon,
      iconBg,
      action,
      date: date || 'Upcoming',
      time: appt.created_at ? _relativeTime(appt.created_at) : 'Recently',
      read: false,
      raw: appt,
    });
  });

  // Past appointments
  (dashboard.past ?? []).forEach((appt) => {
    const status = (appt.status ?? '').toLowerCase();
    const testName = appt.test_name ?? appt.test ?? 'Clinical Test';
    const date = appt.month && appt.day ? `${appt.month} ${appt.day}` : (appt.preferred_date ?? '');

    notifs.push({
      id: `past-${appt.id ?? appt._id}`,
      type: 'appointment',
      title: status === 'completed' ? 'Visit Completed' : 'Appointment Cancelled',
      message: status === 'completed'
        ? `Your ${testName} visit on ${date} is complete. Results will be available soon.`
        : `Your ${testName} appointment on ${date} was cancelled.`,
      icon: status === 'completed' ? '✅' : '🚫',
      iconBg: status === 'completed' ? COLORS.greenLight : COLORS.redLight,
      action: status === 'completed' ? 'View History' : null,
      date: date || 'Past',
      time: appt.created_at ? _relativeTime(appt.created_at) : 'Recently',
      read: true, // past = already seen
      raw: appt,
    });
  });

  // Documents
  (dashboard.documents ?? []).forEach((doc) => {
    notifs.push({
      id: `doc-${doc.id ?? doc._id}`,
      type: 'document',
      title: 'Document Available',
      message: `${doc.name ?? 'A clinical document'} (${doc.type ?? 'Document'}) is available on ${doc.date ?? ''}.`,
      icon: '📄',
      iconBg: COLORS.blueLight,
      action: 'View Document',
      date: doc.date || 'Recent',
      time: doc.date || 'Recently',
      read: true,
      raw: doc,
    });
  });

  // Sort: unread first, then by id descending (newest first)
  notifs.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return String(b.id).localeCompare(String(a.id));
  });

  return notifs;
}

function _relativeTime(isoString) {
  if (!isoString) return 'Recently';
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return 'Recently';
  }
}

function groupByDate(notifications) {
  const groups = {};
  notifications.forEach((n) => {
    const key = n.date || 'Recent';
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  });
  return groups;
}

// ── Components ─────────────────────────────────────────────────────────────
function BackArrow() {
  return (
    <View style={styles.backArrow}>
      <View style={styles.backArrowLine} />
      <View style={styles.backArrowHead} />
    </View>
  );
}

export default function NotificationsScreen({ navigation }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    fetchPatientDashboard()
      .then((data) => setNotifications(deriveNotifications(data)))
      .catch((err) => setError(
        err.message === 'NETWORK_ERROR' ? "Can't reach the server." :
        err.message === 'NOT_LOGGED_IN' ? 'Please log in again.' :
        err.message
      ))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markRead = (id) =>
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const filtered = notifications.filter((n) =>
    filterMap[activeFilter] ? n.type === filterMap[activeFilter] : true
  );
  const unreadCount = notifications.filter((n) => !n.read).length;
  const grouped = groupByDate(filtered);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <BackArrow />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => {
            const isActive = activeFilter === f;
            const count = f === 'All'
              ? unreadCount
              : notifications.filter((n) => !n.read && n.type === filterMap[f]).length;
            return (
              <TouchableOpacity key={f} style={styles.filterTab} onPress={() => setActiveFilter(f)} activeOpacity={0.7}>
                <View style={styles.filterTabInner}>
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{f}</Text>
                  {count > 0 && (
                    <View style={styles.filterBadge}>
                      <Text style={styles.filterBadgeText}>{count}</Text>
                    </View>
                  )}
                </View>
                {isActive && <View style={styles.filterUnderline} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.filterBorder} />
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.navy} />
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>⚠ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.emptySubtitle}>No {activeFilter.toLowerCase()} notifications yet.</Text>
            </View>
          ) : (
            Object.entries(grouped).map(([date, items]) => (
              <View key={date}>
                <Text style={styles.dateLabel}>{date}</Text>
                {items.map((notif) => (
                  <TouchableOpacity
                    key={notif.id}
                    style={[styles.notifCard, !notif.read && styles.notifCardUnread]}
                    onPress={() => markRead(notif.id)}
                    activeOpacity={0.82}
                  >
                    {!notif.read && <View style={styles.unreadBar} />}
                    <View style={styles.notifInner}>
                      <View style={[styles.notifIconWrap, { backgroundColor: notif.iconBg }]}>
                        <Text style={styles.notifIcon}>{notif.icon}</Text>
                      </View>
                      <View style={styles.notifContent}>
                        <View style={styles.notifTopRow}>
                          <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]} numberOfLines={1}>
                            {notif.title}
                          </Text>
                          <Text style={styles.notifTime}>{notif.time}</Text>
                        </View>
                        <Text style={styles.notifMessage} numberOfLines={2}>{notif.message}</Text>
                        {notif.action && (
                          <TouchableOpacity style={styles.notifActionBtn} onPress={() => markRead(notif.id)}>
                            <Text style={styles.notifActionText}>{notif.action} →</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {!notif.read && <View style={styles.unreadDotIndicator} />}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  backArrowLine: {
    position: 'absolute', width: 10, height: 2,
    backgroundColor: COLORS.navyDark, borderRadius: 1,
  },
  backArrowHead: {
    position: 'absolute', left: 0, width: 7, height: 7,
    borderLeftWidth: 2, borderBottomWidth: 2, borderColor: COLORS.navyDark,
    transform: [{ rotate: '45deg' }], borderRadius: 1,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.navyDark },
  unreadBadge: {
    backgroundColor: COLORS.navy, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  unreadBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  markAllText: { fontSize: 12, fontWeight: '600', color: COLORS.navy },

  filterContainer: { position: 'relative' },
  filterRow: { paddingHorizontal: 20, flexDirection: 'row' },
  filterTab: { marginRight: 24, paddingBottom: 10, paddingTop: 12, position: 'relative', alignItems: 'center' },
  filterTabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterText: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  filterTextActive: { color: COLORS.navyDark, fontWeight: '700' },
  filterBadge: {
    backgroundColor: COLORS.unreadDot, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  filterBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  filterUnderline: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2.5, backgroundColor: COLORS.navy, borderRadius: 2,
  },
  filterBorder: { height: 1, backgroundColor: COLORS.lightGray },

  scroll: { flex: 1, backgroundColor: COLORS.offWhite },
  scrollContent: { paddingTop: 8, paddingHorizontal: 16 },
  dateLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.gray,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginTop: 16, marginBottom: 8, marginLeft: 4,
  },

  notifCard: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderRadius: 16, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  notifCardUnread: { borderColor: '#C7D6F8', backgroundColor: '#FAFBFF' },
  unreadBar: { width: 3.5, backgroundColor: COLORS.navy, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  notifInner: { flex: 1, flexDirection: 'row', padding: 14, gap: 12, alignItems: 'flex-start' },
  notifIconWrap: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifIcon: { fontSize: 20 },
  notifContent: { flex: 1 },
  notifTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 8 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: COLORS.bodyText, flex: 1 },
  notifTitleUnread: { fontWeight: '800', color: COLORS.navyDark },
  notifTime: { fontSize: 11, color: COLORS.gray, fontWeight: '500', flexShrink: 0 },
  notifMessage: { fontSize: 13, color: COLORS.gray, lineHeight: 19 },
  notifActionBtn: { marginTop: 8, alignSelf: 'flex-start' },
  notifActionText: { fontSize: 13, fontWeight: '700', color: COLORS.navy },
  unreadDotIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.unreadDot, marginTop: 4, flexShrink: 0 },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingBottom: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12, opacity: 0.3 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.navyDark, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: COLORS.gray },

  loadingText: { marginTop: 12, fontSize: 13, color: COLORS.gray },
  errorText: { color: COLORS.red, fontSize: 14, marginBottom: 16, textAlign: 'center' },
  retryBtn: { backgroundColor: COLORS.navy, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
});