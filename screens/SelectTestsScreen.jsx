import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Animated,
  StyleSheet,
  StatusBar,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
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

// Distinct color per icon type so tests read at a glance (bg = light tint, fg = solid)
const ICON_COLOR_MAP = {
  Droplet: { fg: '#2563EB', bg: '#DBEAFE' },
  HeartPulse: { fg: '#DC2626', bg: '#FEE2E2' },
  Activity: { fg: '#F97316', bg: '#FFEDD5' },
  Bone: { fg: '#7C3AED', bg: '#EDE9FE' },
  FileWarning: { fg: '#D97706', bg: '#FEF3C7' },
  Truck: { fg: '#0D9488', bg: '#CCFBF1' },
  default: { fg: '#64748B', bg: '#F1F5F9' },
};

function getFeatherIcon(iconName) {
  return ICON_MAP[iconName] || 'file-text';
}
function getIconColors(iconName) {
  return ICON_COLOR_MAP[iconName] || ICON_COLOR_MAP.default;
}

/** Springy press-scale wrapper, shared across the screen. */
function AnimatedPressable({ style, onPress, disabled, children, scaleTo = 0.96, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
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
      toValue: 1,
      duration: 420,
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
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
          ],
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

/** Category pill with an animated sliding/scaling active state. */
function CategoryTab({ label, active, onPress }) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: active ? 1 : 0, useNativeDriver: false, speed: 22, bounciness: 6 }).start();
  }, [active]);

  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: [COLORS.white, COLORS.navy] });
  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.navy] });
  const textColor = anim.interpolate({ inputRange: [0, 1], outputRange: [COLORS.bodyText, COLORS.white] });

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={[styles.categoryPill, { backgroundColor: bg, borderColor }]}>
        <Animated.Text style={[styles.categoryPillText, { color: textColor }]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/** Search bar that lifts its border color when focused. */
function SearchBar({ value, onChangeText }) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [focused]);

  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.navy] });
  const iconColor = focused ? COLORS.navy : COLORS.gray;

  return (
    <Animated.View style={[styles.searchWrap, { borderColor }]}>
      <Feather name="search" size={16} color={iconColor} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search tests..."
        placeholderTextColor={COLORS.gray}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <View style={styles.clearBtn}>
            <Feather name="x" size={12} color={COLORS.gray} />
          </View>
        </Pressable>
      )}
    </Animated.View>
  );
}

/** Single test card — icon ring, accent bar when selected, spring checkmark, staggered entrance. */
function TestRow({ test, isSelected, onToggle, delay }) {
  const scale = useRef(new Animated.Value(1)).current;
  const check = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  const iconColors = getIconColors(test.iconName);

  useEffect(() => {
    Animated.spring(check, { toValue: isSelected ? 1 : 0, useNativeDriver: true, speed: 24, bounciness: 10 }).start();
  }, [isSelected]);

  const animatePress = (toValue) => {
    Animated.spring(scale, { toValue, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  };

  const hasDiscount = test.discountPrice != null;

  return (
    <FadeInUp delay={delay} distance={10}>
      <Pressable
        onPress={onToggle}
        onPressIn={() => animatePress(0.97)}
        onPressOut={() => animatePress(1)}
      >
        <Animated.View
          style={[
            styles.testRow,
            isSelected && styles.testRowSelected,
            { transform: [{ scale }] },
          ]}
        >
          {isSelected && <View style={[styles.testAccentBar, { backgroundColor: iconColors.fg }]} />}

          <View style={[styles.iconWrap, { backgroundColor: iconColors.bg }]}>
            <Feather name={getFeatherIcon(test.iconName)} size={18} color={iconColors.fg} />
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
            {hasDiscount ? (
              <View style={styles.priceRow}>
                <Text style={styles.strikePrice}>${test.price.toFixed(0)}</Text>
                <Text style={[styles.testPrice, styles.discountedPrice, isSelected && styles.testPriceSelected]}>
                  ${test.discountPrice.toFixed(0)}
                </Text>
              </View>
            ) : (
              <Text style={[styles.testPrice, isSelected && styles.testPriceSelected]}>
                ${test.price.toFixed(0)}
              </Text>
            )}
            <View style={styles.checkCircle}>
              <Animated.View style={{ opacity: check, transform: [{ scale: check }], position: 'absolute' }}>
                <View style={[styles.checkCircleActive]}>
                  <Feather name="check" size={12} color={COLORS.white} />
                </View>
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </FadeInUp>
  );
}

export default function SelectTestsScreen({ navigation, route }) {
  const returnTo = route?.params?.returnTo || null;
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
        const normalized = tests.map((t) => {
          const price = typeof t.price === 'number' ? t.price : parseFloat(t.price) || 0;
          const rawDiscount = t.discount_price;
          const discountPrice =
            rawDiscount === null || rawDiscount === undefined || rawDiscount === ''
              ? null
              : (typeof rawDiscount === 'number' ? rawDiscount : parseFloat(rawDiscount));
          const hasDiscount = discountPrice !== null && !isNaN(discountPrice) && discountPrice < price;

          return {
            id: String(t.id ?? t._id ?? ''),
            name: t.title || 'Untitled Test',
            desc: t.description || '',
            price,
            discountPrice: hasDiscount ? discountPrice : null,
            category: t.category_name || 'General Wellness',
            iconName: t.icon_name || '',
            sampleType: t.sample_type || '',
            turnaround: t.turnaround || '',
          };
        });
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
  const testsTotal = selectedTestsData.reduce(
    (sum, t) => sum + (t.discountPrice != null ? t.discountPrice : t.price),
    0
  );

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
        <AnimatedPressable style={styles.backBtn} onPress={() => navigation.goBack()} scaleTo={0.85}>
          <Ionicons name="arrow-back" size={20} color={COLORS.navyDark} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Select tests</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Search */}
      <FadeInUp delay={0} style={{ paddingHorizontal: 20, marginTop: 14 }}>
        <SearchBar value={search} onChangeText={setSearch} />
      </FadeInUp>

      {/* Categories */}
      <FadeInUp delay={40}>
        <View style={styles.categoryContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {categories.map((cat) => (
              <CategoryTab
                key={cat}
                label={cat}
                active={activeCategory === cat}
                onPress={() => setActiveCategory(cat)}
              />
            ))}
          </ScrollView>
        </View>
      </FadeInUp>

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
          <FadeInUp delay={0}>
            <View style={styles.errorBox}>
              <Feather name="alert-triangle" size={16} color={COLORS.error} />
              <Text style={styles.errorText}>{loadError}</Text>
            </View>
          </FadeInUp>
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: 'center', marginVertical: 32 }}>
            <Feather name="search" size={22} color={COLORS.gray} />
            <Text style={{ color: COLORS.gray, marginTop: 8 }}>No tests found.</Text>
          </View>
        ) : filtered.map((test, i) => (
          <TestRow
            key={test.id}
            test={test}
            isSelected={selectedTests.includes(test.id)}
            onToggle={() => toggleTest(test.id)}
            delay={Math.min(i, 8) * 40}
          />
        ))}

        {/* Total summary card */}
        <FadeInUp delay={60}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryIconBadge}>
              <IconPop delay={100}>
                <Ionicons name="flask" size={20} color={COLORS.white} />
              </IconPop>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>
                {selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''} selected
              </Text>
              <Text style={styles.summaryTotal}>${testsTotal.toFixed(0)}</Text>
            </View>
          </View>
        </FadeInUp>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <AnimatedPressable
          style={[styles.continueBtn, selectedTests.length === 0 && styles.continueBtnDisabled]}
          scaleTo={0.97}
          disabled={selectedTests.length === 0}
          onPress={handleConfirm}
        >
          <Text style={styles.continueBtnText}>
            {returnTo
              ? `Confirm ${selectedTests.length} test${selectedTests.length !== 1 ? 's' : ''} · $${testsTotal.toFixed(0)}`
              : `Continue to booking · $${testsTotal.toFixed(0)}`}
          </Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.navyDark },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1.5,
    gap: 10,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.navyDark },
  clearBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center', justifyContent: 'center',
  },

  categoryContainer: { borderBottomWidth: 1, borderBottomColor: COLORS.lightGray },
  categoryRow: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, gap: 8, flexDirection: 'row' },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  categoryPillText: { fontSize: 13, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 14,
    marginVertical: 12,
  },
  errorText: { color: COLORS.error, fontSize: 13, fontWeight: '600', flex: 1 },

  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.lightGray,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: 'hidden',
    shadowColor: '#0D1F3C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  testRowSelected: {
    borderColor: COLORS.navy,
    backgroundColor: '#F7F9FF',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  testAccentBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  testInfo: { flex: 1, paddingRight: 8 },
  testName: { fontSize: 14.5, fontWeight: '700', color: COLORS.navyDark, marginBottom: 2 },
  testNameSelected: { color: COLORS.navy },
  testMeta: { fontSize: 11.5, color: COLORS.gray },
  testRight: { alignItems: 'flex-end', gap: 8 },
  testPrice: { fontSize: 14, fontWeight: '800', color: COLORS.bodyText },
  testPriceSelected: { color: COLORS.navyDark },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  strikePrice: {
    fontSize: 12,
    color: COLORS.gray,
    textDecorationLine: 'line-through',
  },
  discountedPrice: { color: COLORS.green },
  checkCircle: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  checkCircleActive: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: 'center', justifyContent: 'center',
  },

  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF0FB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#C7D4F5',
    marginTop: 8,
    gap: 14,
  },
  summaryIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  summaryTotal: { fontSize: 22, fontWeight: '900', color: COLORS.navy },

  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  continueBtn: { backgroundColor: COLORS.navy, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: COLORS.gray },
  continueBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});
