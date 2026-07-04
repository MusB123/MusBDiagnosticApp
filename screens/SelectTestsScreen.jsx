import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { fetchAvailableTests } from '../utils/auth';

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
  pathB: '#059669',
  pathBBg: '#DCFCE7',
  error: '#E63946',
};

const ICON_MAP = {
  Droplet: 'droplet',
  HeartPulse: 'activity',
  Activity: 'activity',
  Bone: 'circle',
  FileWarning: 'alert-circle',
  Truck: 'truck',
};

function getFeatherIcon(iconName) {
  return ICON_MAP[iconName] || 'file-text';
}

export default function SelectTestsScreen({ navigation, route }) {
  const returnTo = route?.params?.returnTo || null; // e.g. 'BookMobileVisit' or 'InPersonTests'
  const initialSelectedIds = route?.params?.initialSelectedIds || [];

  const [allTests, setAllTests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTests, setSelectedTests] = useState(initialSelectedIds);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const tests = await fetchAvailableTests();
        if (!isMounted) return;
        const normalized = tests.map((t) => ({
          id: String(t.id ?? t._id ?? ''),
          name: t.title || 'Untitled Test',
          desc: t.description || '',
          price: typeof t.price === 'number' ? t.price : parseFloat(t.price) || 0,
          category: t.category_name || 'General Wellness',
          iconName: t.icon_name || '',
          sampleType: t.sample_type || '',
          turnaround: t.turnaround || '',
        }));
        const uniqueCategories = [...new Set(normalized.map((t) => t.category))];
        setAllTests(normalized);
        setCategories(uniqueCategories);
        setActiveCategory(uniqueCategories[0] || '');
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

  const toggleTest = (id) => {
    setSelectedTests((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const filtered = allTests.filter((t) => {
    const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.desc.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && (search === '' || matchesSearch);
  });

  const selectedTestsData = allTests.filter((t) => selectedTests.includes(t.id));
  const testsTotal = selectedTestsData.reduce((sum, t) => sum + t.price, 0);

  const handleConfirm = () => {
    if (returnTo) {
      navigation.navigate(returnTo, { selectedTestsData, testsTotal });
    } else {
      navigation.navigate('Checkout', {
        labTestsTotal: testsTotal,
        labTestsNames: selectedTestsData.map(t => t.name).join(', '),
      });
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
        <Text style={styles.headerTitle}>Select tests</Text>
        <View style={styles.pathBadge}>
          <Text style={styles.pathBadgeText}>Path B</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tests..."
          placeholderTextColor={COLORS.gray}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryBtn, activeCategory === cat && styles.categoryBtnActive]}
            onPress={() => setActiveCategory(cat)}
            activeOpacity={0.8}
          >
            <Text style={[styles.categoryBtnText, activeCategory === cat && styles.categoryBtnTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tests List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={COLORS.navy} />
          </View>
        ) : loadError ? (
          <Text style={{ color: COLORS.error, textAlign: 'center', marginVertical: 20 }}>
            ⚠ {loadError}
          </Text>
        ) : filtered.length === 0 ? (
          <Text style={{ color: COLORS.gray, textAlign: 'center', marginVertical: 20 }}>
            No tests found.
          </Text>
        ) : filtered.map((test) => {
          const isSelected = selectedTests.includes(test.id);
          return (
            <TouchableOpacity
              key={test.id}
              style={[styles.testRow, isSelected && styles.testRowSelected]}
              onPress={() => toggleTest(test.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.accentBar, isSelected && styles.accentBarActive]} />
              <View style={[styles.iconWrap, isSelected && styles.iconWrapActive]}>
                <Feather
                  name={getFeatherIcon(test.iconName)}
                  size={17}
                  color={isSelected ? COLORS.navy : COLORS.gray}
                />
              </View>
              <View style={styles.testInfo}>
                <Text style={[styles.testName, isSelected && styles.testNameSelected]} numberOfLines={1}>
                  {test.name}
                </Text>
                <Text style={styles.testMeta} numberOfLines={1}>
                  {test.sampleType ? `${test.sampleType} · ` : ''}{test.turnaround || test.desc}
                </Text>
              </View>
              <View style={styles.testRight}>
                <Text style={[styles.testPrice, isSelected && styles.testPriceSelected]}>
                  ${test.price.toFixed(0)}
                </Text>
                <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                  {isSelected && <Feather name="check" size={11} color={COLORS.white} />}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Total card */}
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>
              Tests total ({selectedTests.length} selected)
            </Text>
            <Text style={styles.grandTotalValue}>${testsTotal.toFixed(0)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, selectedTests.length === 0 && styles.continueBtnDisabled]}
          activeOpacity={0.85}
          disabled={selectedTests.length === 0}
          onPress={handleConfirm}
        >
          <Text style={styles.continueBtnText}>
            {returnTo
              ? `Confirm ${selectedTests.length} test${selectedTests.length !== 1 ? 's' : ''} · $${testsTotal.toFixed(0)}`
              : `Continue to booking · $${testsTotal.toFixed(0)}`
            }
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.lightGray, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.offWhite, alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 18, color: COLORS.navyDark, fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.navyDark },
  pathBadge: { backgroundColor: COLORS.pathBBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  pathBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.pathB },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.offWhite, borderRadius: 12,
    marginHorizontal: 20, marginTop: 14,
    paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border, gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.navyDark },

  categoryRow: { paddingHorizontal: 20, paddingVertical: 10, gap: 6, flexDirection: 'row' },
  categoryBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 16, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: COLORS.white,
  },
  categoryBtnActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  categoryBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.gray },
  categoryBtnTextActive: { color: COLORS.white },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },

  testRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.lightGray,
    overflow: 'hidden', paddingVertical: 12, paddingRight: 14,
  },
  testRowSelected: { borderColor: COLORS.navy, backgroundColor: '#FAFBFF' },
  accentBar: { width: 3, height: '100%', backgroundColor: 'transparent' },
  accentBarActive: { backgroundColor: COLORS.navy },
  iconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 12, marginRight: 12,
  },
  iconWrapActive: { backgroundColor: '#EBF0FB' },
  testInfo: { flex: 1, paddingRight: 8 },
  testName: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark, marginBottom: 2 },
  testNameSelected: { color: COLORS.navy },
  testMeta: { fontSize: 11.5, color: COLORS.gray },
  testRight: { alignItems: 'flex-end', gap: 6 },
  testPrice: { fontSize: 14, fontWeight: '800', color: COLORS.bodyText },
  testPriceSelected: { color: COLORS.navyDark },
  checkCircle: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleActive: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },

  totalCard: {
    backgroundColor: COLORS.offWhite, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: COLORS.border,
    marginTop: 8, marginBottom: 8,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  grandTotalLabel: { fontSize: 14, fontWeight: '700', color: COLORS.navyDark },
  grandTotalValue: { fontSize: 18, fontWeight: '900', color: COLORS.navy },

  footer: {
    padding: 20, borderTopWidth: 1,
    borderTopColor: COLORS.lightGray, backgroundColor: COLORS.white,
  },
  continueBtn: { backgroundColor: COLORS.navy, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: COLORS.gray },
  continueBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});