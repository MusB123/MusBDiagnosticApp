import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchPatientProfile, updatePatientProfile, logoutPatient } from '../utils/auth';

const COLORS = {
  navy: '#1B3A8C',
  navyDark: '#0D1F3C',
  white: '#FFFFFF',
  offWhite: '#F4F7FB',
  lightGray: '#E8EEF5',
  gray: '#8A9BB0',
  bodyText: '#4A5568',
  border: '#D1DBE8',
  error: '#E63946',
  green: '#22C55E',
};

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export default function ProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [email, setEmail] = useState(''); // read-only
  const [form, setForm] = useState({
    name: '',
    phone: '',
    dob: '',
    gender: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const profile = await fetchPatientProfile();
        if (!isMounted) return;
        setEmail(profile.email || '');
        setForm({
          name: profile.name || '',
          phone: profile.phone || '',
          dob: profile.dob || '',
          gender: profile.gender || '',
          address: profile.address || '',
          emergency_contact_name: profile.emergency_contact_name || '',
          emergency_contact_phone: profile.emergency_contact_phone || '',
        });
      } catch (err) {
        if (isMounted) {
          setLoadError(
            err.message === 'NETWORK_ERROR'
              ? "Can't reach the server. Check your connection."
              : err.message
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePatientProfile(form);
      setEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err) {
      Alert.alert('Could not save', err.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logoutPatient();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.navy} />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Text style={{ color: COLORS.error, textAlign: 'center', paddingHorizontal: 24 }}>
          ⚠ {loadError}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => (editing ? handleSave() : setEditing(true))} disabled={saving}>
          <Text style={styles.headerAction}>
            {saving ? 'Saving...' : editing ? 'Save' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(form.name || 'P').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.avatarName}>{form.name || 'Patient'}</Text>
          <Text style={styles.avatarEmail}>{email}</Text>
        </View>

        {/* Personal Info */}
        <Text style={styles.sectionLabel}>PERSONAL INFO</Text>
        <Field label="Full name" value={form.name} editable={editing} onChangeText={(t) => updateField('name', t)} />
        <Field label="Phone" value={form.phone} editable={editing} onChangeText={(t) => updateField('phone', t)} keyboardType="phone-pad" />
        <Field label="Date of birth" value={form.dob} editable={editing} onChangeText={(t) => updateField('dob', t)} placeholder="MM/DD/YYYY" />

        {/* Gender selector */}
        <Text style={styles.fieldLabel}>Gender</Text>
        {editing ? (
          <View style={styles.genderRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.genderChip, form.gender === g && styles.genderChipActive]}
                onPress={() => updateField('gender', g)}
              >
                <Text style={[styles.genderChipText, form.gender === g && styles.genderChipTextActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.staticField}>
            <Text style={styles.staticFieldText}>{form.gender || '—'}</Text>
          </View>
        )}

        <Field label="Address" value={form.address} editable={editing} onChangeText={(t) => updateField('address', t)} multiline />

        {/* Emergency Contact */}
        <Text style={styles.sectionLabel}>EMERGENCY CONTACT</Text>
        <Field label="Contact name" value={form.emergency_contact_name} editable={editing} onChangeText={(t) => updateField('emergency_contact_name', t)} />
        <Field label="Contact phone" value={form.emergency_contact_phone} editable={editing} onChangeText={(t) => updateField('emergency_contact_phone', t)} keyboardType="phone-pad" />

        {editing && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)} disabled={saving}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {!editing && (
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Log out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, editable, onChangeText, placeholder, keyboardType, multiline }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {editable ? (
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || `Enter ${label.toLowerCase()}`}
          placeholderTextColor={COLORS.gray}
          keyboardType={keyboardType || 'default'}
          multiline={multiline}
        />
      ) : (
        <View style={styles.staticField}>
          <Text style={styles.staticFieldText}>{value || '—'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  centered: { justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.navyDark },
  headerAction: { fontSize: 15, fontWeight: '700', color: COLORS.navy },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: { color: COLORS.white, fontWeight: '800', fontSize: 24 },
  avatarName: { fontSize: 18, fontWeight: '800', color: COLORS.navyDark },
  avatarEmail: { fontSize: 13, color: COLORS.gray, marginTop: 2 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray,
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 13,
    color: COLORS.bodyText,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.navyDark,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  staticField: {
    backgroundColor: COLORS.offWhite,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  staticFieldText: { fontSize: 15, color: COLORS.navyDark },

  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  genderChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  genderChipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  genderChipText: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
  genderChipTextActive: { color: COLORS.white },

  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.gray },

  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  logoutBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.error },
});