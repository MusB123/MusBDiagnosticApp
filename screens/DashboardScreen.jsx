import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { PHLEB_ENDPOINTS } from '../config/api';
import { getActiveSession, authGet } from '../utils/auth';

const PRIMARY = '#18377D';
const GREEN   = '#22C55E';
const ORANGE  = '#F97316';

export default function DashboardScreen({ route, navigation }) {
  const { fullName = 'User' } = route.params || {};

  const initials = fullName
    .split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const tokenRef = useRef(null);
  const pollRef  = useRef(null);

  useEffect(() => {
    getActiveSession().then(s => {
      if (s?.token) {
        tokenRef.current = s.token;
        fetchRequests();
        pollRef.current = setInterval(fetchRequests, 10000); // every 10s
      }
    });
    return () => clearInterval(pollRef.current);
  }, []);

  const fetchRequests = async () => {
    try {
      const data = await authGet(PHLEB_ENDPOINTS.dashboard);
  
      setRequests(data.broadcasts || []);
    } catch {
      // fail silently, keep last known data
    } finally {
      setLoading(false);
    }
  };

  const handleGoOnline = () => navigation.navigate('PatientMap',        { fullName });
  const handleHistory  = () => navigation.navigate('JobHistory', { fullName });
  const handleEarnings = () => navigation.navigate('Earnings',   { fullName });
  const handleProfile  = () => navigation.navigate('Profile',    { fullName });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{fullName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.statusText}>Offline</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.bellButton}>
            <Ionicons name="notifications-outline" size={24} color="#111827" />
            {requests.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{requests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Go Online Card */}
        <TouchableOpacity style={styles.onlineCard} activeOpacity={0.9} onPress={handleGoOnline}>
          <View style={styles.powerCircle}>
            <Feather name="power" size={38} color="#FFFFFF" />
          </View>
          <Text style={styles.onlineTitle}>Tap to go online</Text>
          <Text style={styles.onlineSub}>Your location will be shared with patients</Text>
        </TouchableOpacity>

        {/* Nearby Requests Section */}
        <Text style={styles.sectionTitle}>NEARBY REQUESTS</Text>
        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginVertical: 20 }} />
        ) : requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No pending requests nearby right now.</Text>
          </View>
        ) : (
          requests.map((req) => (
            <TouchableOpacity
              key={req.id}
              style={styles.requestItemCard}
              activeOpacity={0.85}
              onPress={handleGoOnline}
            >
              <View style={styles.requestItemIcon}>
                <Ionicons name="medkit-outline" size={20} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestItemTitle}>{req.testName || 'Clinical Test'}</Text>
                <Text style={styles.requestItemSub}>
                  {req.address || 'Address unknown'}
                  {req.time ? ` · ${req.time}` : ''}
                </Text>
              </View>
              <View style={styles.requestItemDot} />
            </TouchableOpacity>
          ))
        )}

        {/* Summary */}
        <Text style={styles.sectionTitle}>TODAY'S SUMMARY</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Jobs done</Text>
            <Text style={styles.summaryValue}>0</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Earned today</Text>
            <Text style={[styles.summaryValue, { color: GREEN }]}>$0</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>Go online to start accepting requests from patients nearby.</Text>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={22} color={PRIMARY} />
          <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={handleHistory}>
          <Ionicons name="time-outline" size={22} color="#9CA3AF" />
          <Text style={styles.navLabel}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={handleEarnings}>
          <Ionicons name="bar-chart-outline" size={22} color="#9CA3AF" />
          <Text style={styles.navLabel}>Earnings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={handleProfile}>
          <Ionicons name="person-outline" size={22} color="#9CA3AF" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8FC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E8ECF7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: PRIMARY, fontSize: 17, fontWeight: '700' },
  name: { fontSize: 17, fontWeight: '700', color: '#111827' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { color: '#6B7280', fontSize: 13 },
  bellButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  badge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  onlineCard: { backgroundColor: PRIMARY, marginHorizontal: 20, borderRadius: 24, paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center', shadowColor: PRIMARY, shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  powerCircle: { width: 92, height: 92, borderRadius: 46, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  onlineTitle: { marginTop: 20, fontSize: 21, fontWeight: '700', color: '#FFFFFF' },
  onlineSub: { marginTop: 8, textAlign: 'center', color: 'rgba(255,255,255,0.8)', lineHeight: 20, fontSize: 13 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', letterSpacing: 0.5, marginTop: 28, marginHorizontal: 20, marginBottom: 12 },

  emptyCard: { marginHorizontal: 20, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 13 },

  requestItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, marginHorizontal: 20, marginBottom: 10, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  requestItemIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  requestItemTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  requestItemSub: { fontSize: 12.5, color: '#6B7280', marginTop: 2 },
  requestItemDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, gap: 12 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  summaryLabel: { fontSize: 13, color: '#6B7280' },
  summaryValue: { marginTop: 8, fontSize: 26, fontWeight: '700', color: PRIMARY },
  infoCard: { backgroundColor: '#FFF7E6', marginHorizontal: 20, marginTop: 20, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18, borderWidth: 1, borderColor: '#FDE68A' },
  infoText: { color: '#92400E', lineHeight: 20, fontSize: 14 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingVertical: 10 },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  navLabelActive: { color: PRIMARY, fontWeight: '700' },
});
