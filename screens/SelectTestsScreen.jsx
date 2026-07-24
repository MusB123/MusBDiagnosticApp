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
import { fetchAvailableTests, fetchOffers } from '../utils/auth';

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

// Rotating accent palette so offer cards read as distinct, colorful bundles
// rather than a flat repeated list.
const OFFER_PALETTE = [
  { accent: '#7C3AED', accentBg: '#EDE9FE', chipBg: '#EDE9FE', chipFg: '#6D28D9' },
  { accent: '#0D9488', accentBg: '#CCFBF1', chipBg: '#CCFBF1', chipFg: '#0F766E' },
  { accent: '#DC2626', accentBg: '#FEE2E2', chipBg: '#FEE2E2', chipFg: '#B91C1C' },
  { accent: '#D97706', accentBg: '#FEF3C7', chipBg: '#FEF3C7', chipFg: '#B45309' },
  { accent: '#2563EB', accentBg: '#DBEAFE', chipBg: '#DBEAFE', chipFg: '#1D4ED8' },
];
function getOfferPalette(i) {
  return OFFER_PALETTE[i % OFFER_PALETTE.length];
}

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

// Computes milliseconds remaining until an offer's expires_at timestamp.
// Returns null if the offer has no expires_at (treated as "never expires").
function getMsLeft(expiresAt) {
  if (!expiresAt) return null;
  const expiryTime = new Date(expiresAt).getTime();
  if (isNaN(expiryTime)) return null;
  return expiryTime - Date.now();
}

// Formats remaining milliseconds into a short human label, e.g. "2d 4h left".
function formatTimeLeft(ms) {
  if (ms <= 0) return 'Expired';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left · expires today`;
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
          {!!test.desc && (
            <Text
              style={styles.testDesc}
              numberOfLines={0}
            >
             {test.desc}
            </Text>
          )}
          {(test.sampleType || test.turnaround) && (
            <Text style={styles.testMeta} numberOfLines={1}>
              {test.sampleType ? `${test.sampleType} · ` : ''}{test.turnaround}
            </Text>
          )}

          {test.fastingRequired && (
            <View style={styles.fastingBadge}>
              <Feather name="clock" size={10} color="#B45309" />
              <Text style={styles.fastingBadgeText}>Fasting required</Text>
            </View>
          )}
        </View>

          <View style={styles.testRight}>
            {test.hidePrice ? null : (
              hasDiscount ? (
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
              )
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

/** Colorful offer bundle card with an explicit Select/Applied action button. */
function OfferCard({ offer, palette, isApplied, matchWarning, hasFasting, delay, onSelect, hidePrice }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(isApplied ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(glow, { toValue: isApplied ? 1 : 0, useNativeDriver: false, speed: 18, bounciness: 8 }).start();
  }, [isApplied]);

  const animatePress = (toValue) => {
    Animated.spring(scale, { toValue, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  };

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.border, palette.accent],
  });
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.18] });

  const savings = hidePrice ? 0 : (parseFloat(offer.original_price) || 0) - (parseFloat(offer.discounted_price) || 0);
  const savingsPct = hidePrice || !offer.original_price
    ? 0
    : Math.round((savings / parseFloat(offer.original_price)) * 100);

  return (
    <FadeInUp delay={delay} distance={10}>
      <Pressable
        onPress={onSelect}
        onPressIn={() => animatePress(0.98)}
        onPressOut={() => animatePress(1)}
      >
        <Animated.View
          style={[
            styles.offerCard,
            { borderColor, shadowOpacity, shadowColor: palette.accent },
          ]}
        >
          <View style={[styles.offerAccentBar, { backgroundColor: palette.accent }]} />

          <View style={styles.offerCardBody}>
            <View style={styles.offerCardTop}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.offerCardTitle} numberOfLines={2}>{offer.title}</Text>
                {!!offer.offer_type && (
                  <View style={[styles.offerTypeBadge, { backgroundColor: palette.chipBg }]}>
                    <Text style={[styles.offerTypeBadgeText, { color: palette.chipFg }]}>
                      {offer.offer_type.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              {!hidePrice && savingsPct > 0 && (
                <View style={[styles.savingsBadge, { backgroundColor: palette.accent }]}>
                  <Text style={styles.savingsBadgeText}>SAVE {savingsPct}%</Text>
                </View>
              )}
            </View>

            {!!offer.time_left && (
              <View style={styles.offerTimeLeftRow}>
                <Feather name="clock" size={11} color={COLORS.error} />
                <Text style={styles.offerTimeLeft}>{offer.time_left}</Text>
              </View>
            )}

            {!hidePrice && (
              <View style={styles.offerPriceRow}>
                <Text style={styles.offerStrike}>${parseFloat(offer.original_price).toFixed(0)}</Text>
                <Text style={[styles.offerDiscounted, { color: palette.accent }]}>
                  ${parseFloat(offer.discounted_price).toFixed(0)}
                </Text>
              </View>
            )}

            <Text style={styles.offerIncludes} numberOfLines={2}>
              <Text style={styles.offerIncludesLabel}>Includes  </Text>
              {(offer.includes || []).join('  ·  ')}
            </Text>

            {matchWarning && (
              <View style={styles.offerWarningRow}>
                <Feather name="info" size={11} color={COLORS.error} />
                <Text style={styles.offerWarningText}>Some tests in this bundle aren't available.</Text>
              </View>
            )}
            {hasFasting && (
              <View style={styles.fastingBadge}>
                <Feather name="clock" size={10} color="#B45309" />
                <Text style={styles.fastingBadgeText}>Includes fasting test</Text>
              </View>
            )}

            <View
              style={[
                styles.offerSelectBtn,
                isApplied
                  ? styles.offerSelectBtnApplied
                  : { backgroundColor: palette.accent },
              ]}
            >
              {isApplied ? (
                <>
                  <Feather name="check-circle" size={15} color="#15803D" />
                  <Text style={styles.offerSelectBtnAppliedText}>Applied — tap to view</Text>
                </>
              ) : (
                <>
                  <Text style={styles.offerSelectBtnText}>Select &amp; Checkout</Text>
                  <Feather name="arrow-right" size={15} color={COLORS.white} />
                </>
              )}
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
  const hasInsurance = route?.params?.hasInsurance || false;

  const [viewMode, setViewMode] = useState('tests'); // 'tests' | 'offers'
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError, setOffersError] = useState('');
  const [appliedOffer, setAppliedOffer] = useState(null); // { id, title, price } | null

  const [allTests, setAllTests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTests, setSelectedTests] = useState(initialSelectedIds);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Ticking clock used to recompute each offer's remaining time and drop
  // any offer whose expires_at has passed, without needing to refetch.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000); // recheck every minute
    return () => clearInterval(interval);
  }, []);

  // Insurance-billed patients don't use cash-price bundle offers — force
// back to the tests tab if insurance gets selected while on Offers.
  useEffect(() => {
    if (hasInsurance && viewMode === 'offers') {
      setViewMode('tests');
    }
  }, [hasInsurance, viewMode]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoadError('');   // ← ADD THIS LINE — clears any previous error before retrying
      try {
        const tests = await fetchAvailableTests(hasInsurance);
        if (!isMounted) return;
        const normalized = tests.map((t) => {
          const hidePrice = hasInsurance || !!t.hide_price;
          const price = hidePrice ? null : (typeof t.price === 'number' ? t.price : parseFloat(t.price) || 0);
          const rawDiscount = t.discount_price;
          const discountPrice =
            hidePrice || rawDiscount === null || rawDiscount === undefined || rawDiscount === ''
              ? null
              : (typeof rawDiscount === 'number' ? rawDiscount : parseFloat(rawDiscount));
          const hasDiscount = discountPrice !== null && !isNaN(discountPrice) && discountPrice < price;

          return {
            id: String(t.id ?? t._id ?? ''),
            name: t.title || 'Untitled Test',
            desc: t.description || '',
            price,
            discountPrice: hasDiscount ? discountPrice : null,
            hidePrice,
            category: t.category_name || 'General Wellness',
            iconName: t.icon_name || '',
            sampleType: t.sample_type || '',
            turnaround: t.turnaround || '',
            fastingRequired: !!t.fasting_required,
          };
        });
        const uniqueCategories = [...new Set(normalized.map((t) => t.category))];
        setAllTests(normalized);
        setCategories(uniqueCategories);
        setActiveCategory(uniqueCategories[0] || '');
      } catch (err) {
        console.log('LOAD TESTS ERROR:', err.message, err);
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

  useEffect(() => {
    if (hasInsurance) {
      setOffers([]);
      setOffersLoading(false);
      return;
    }
    let isMounted = true;
    async function loadOffers() {
     try {
        const data = await fetchOffers(hasInsurance);
        if (isMounted) setOffers(data || []);
      } catch (err) {
        if (isMounted) setOffersError(err.message || 'Could not load offers.');
      } finally {
        if (isMounted) setOffersLoading(false);
      }
    }
    loadOffers();
    return () => { isMounted = false; };
  }, [hasInsurance]);

  function normalizeTitle(str) {
    return (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  }

  function matchTestsToOffer(offer, tests) {
    if (Array.isArray(offer.included_test_ids) && offer.included_test_ids.length > 0) {
      return offer.included_test_ids
        .map((id) => tests.find((t) => t.id === String(id)))
        .filter(Boolean);
    }
    const includes = offer.includes || [];
    return includes
      .map((includedTitle) => {
        const normIncluded = normalizeTitle(includedTitle);
        return (
          tests.find((t) => normalizeTitle(t.name) === normIncluded) ||
          tests.find(
            (t) =>
              normalizeTitle(t.name).includes(normIncluded) ||
              normIncluded.includes(normalizeTitle(t.name))
          )
        );
      })
      .filter(Boolean);
  }

  const handleSelectOffer = (offer) => {
    // Tapping an already-applied offer jumps straight to checkout instead
    // of re-applying it — this is what makes the card double as a
    // "select & checkout" action rather than just a highlighter.
    if (appliedOffer?.id === offer.id) {
      handleConfirm();
      return;
    }

    const includes = offer.includes || [];
    console.log("Offer includes:", includes);
    const matched = matchTestsToOffer(offer, allTests);

    console.log("Available tests:", allTests.map(t => t.name));
    console.log("Matched:", matched);

    if (matched.length === 0) {
      console.log("No tests matched");
      return;
    }

    setSelectedTests(matched.map((t) => t.id));
    setAppliedOffer({
      id: offer.id,
      title: offer.title,
      price: offer.hidePrice ? 0 : (parseFloat(offer.discounted_price) || 0),
      hidePrice: !!offer.hidePrice,
      matchedCount: matched.length,
      totalCount: includes.length,
      testIds: matched.map((t) => t.id),
    });
    setViewMode('tests'); // switch back so they can see the highlighted selection
  };

  const clearOffer = () => {
    setAppliedOffer(null);
    setSelectedTests([]);
  };

  const toggleTest = (id) => {
    if (appliedOffer) {
      const isPartOfOffer = (appliedOffer.testIds || []) .includes(id);
      if (isPartOfOffer) {
      // Removing one of the bundle's own tests breaks the bundle pricing.
        setAppliedOffer(null);
        setSelectedTests((prev) => prev.filter((t) => t !== id));
        return;
      }
    // Adding/removing a test outside the bundle — keep the offer applied,
    // just add its normal price on top.
    }
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
  const extraTestsData = appliedOffer
    ? selectedTestsData.filter((t) => !(appliedOffer.testIds || []).includes(t.id))
    : [];
  const testsTotal = appliedOffer
    ? appliedOffer.price +
      extraTestsData.reduce(
        (sum, t) => sum + (t.discountPrice != null ? t.discountPrice : (t.price ?? 0)),
       0
      )
    : selectedTestsData.reduce(
        (sum, t) => sum + (t.discountPrice != null ? t.discountPrice : (t.price ?? 0)),
        0
      );

  const handleConfirm = () => {
    if (returnTo) {
      const s = route?.params?.passthroughSchedule || null;
      navigation.navigate(returnTo, {
        selectedTestsData,
        testsTotal,
        appliedOffer,
        extraTestsData,
        ...(s
          ? {
              scheduledDate: s.isoDate,
              scheduledDateLabel: s.dateLabel,
              scheduledTimeLabel: s.timeLabel,
              preferredTime: s.preferredTime,
              slotType: s.slotType,
              slotIndex: s.slotIndex,
              totalPatientFee: s.totalPatientFee,
            }
          : {}),
      });
    } else {
      navigation.navigate('Checkout', {
        labTestsTotal: testsTotal,
        labTestsNames: selectedTestsData.map(t => t.name).join(', '),
        selectedTests: selectedTestsData,
        appliedOffer,
        extraTestsData,
      });
    }
  };

  // Active offers, annotated with live remaining time, and with any offer
  // whose expires_at has passed dropped from the list. This is what makes
  // the countdown actually count down and the offer auto-remove at zero,
  // rather than showing a static "4 days" forever. `now` is bumped every
  // minute above, which forces this to re-run.
  const liveOffers = offers
    .filter((o) => o.is_active)
    .map((o) => ({ ...o, msLeft: getMsLeft(o.expires_at), hidePrice: hasInsurance || !!o.hide_price }))
    .filter((o) => o.msLeft === null || o.msLeft > 0)
    .map((o) => (o.msLeft !== null ? { ...o, time_left: formatTimeLeft(o.msLeft) } : o));

  console.log('liveOffers time_left values:', liveOffers.map(o => ({ title: o.title, time_left: o.time_left })));
  // eslint-disable-next-line no-unused-expressions
  now; // referenced so this block re-evaluates each minute tick

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

      {/* Tests / Offers toggle */}
      <FadeInUp delay={0} style={{ paddingHorizontal: 20, marginTop: 14 }}>
        <View style={styles.viewToggleRow}>
          <Pressable
            style={[styles.viewToggleBtn, viewMode === 'tests' && styles.viewToggleBtnActive]}
            onPress={() => setViewMode('tests')}
          >
            <Text style={[styles.viewToggleText, viewMode === 'tests' && styles.viewToggleTextActive]}>
              Lab Tests
            </Text>
          </Pressable>
          {!hasInsurance && (
            <Pressable
              style={[styles.viewToggleBtn, viewMode === 'offers' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('offers')}
            >
              <Text style={[styles.viewToggleText, viewMode === 'offers' && styles.viewToggleTextActive]}>
                Offers
              </Text>
            </Pressable>
          )}
        </View>
      </FadeInUp>

      {/* Applied offer banner */}
      {appliedOffer && (
        <FadeInUp delay={0} style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <View style={styles.offerBanner}>
            <Ionicons name="pricetag" size={16} color={COLORS.navy} />
            <Text style={styles.offerBannerText} numberOfLines={1}>
              {appliedOffer.title} applied ({appliedOffer.matchedCount}/{appliedOffer.totalCount} tests matched)
            </Text>
            <Pressable onPress={clearOffer} hitSlop={8}>
              <Text style={styles.offerBannerClear}>Remove</Text>
            </Pressable>
          </View>
        </FadeInUp>
      )}

      {/* Search + Categories — only in tests mode */}
      {viewMode === 'tests' && (
        <>
          <FadeInUp delay={0} style={{ paddingHorizontal: 20, marginTop: 14 }}>
            <SearchBar value={search} onChangeText={setSearch} />
          </FadeInUp>

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
        </>
      )}

      {/* Main list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === 'tests' ? (
          loading ? (
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
          ) : (
            filtered.map((test, i) => (
              <TestRow
                key={test.id}
                test={test}
                isSelected={selectedTests.includes(test.id)}
                onToggle={() => toggleTest(test.id)}
                delay={Math.min(i, 8) * 40}
              />
            ))
          )
        ) : offersLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={COLORS.navy} />
          </View>
        ) : offersError ? (
          <FadeInUp delay={0}>
            <View style={styles.errorBox}>
              <Feather name="alert-triangle" size={16} color={COLORS.error} />
              <Text style={styles.errorText}>{offersError}</Text>
            </View>
          </FadeInUp>
        ) : liveOffers.length === 0 ? (
          <View style={{ alignItems: 'center', marginVertical: 32 }}>
            <Feather name="tag" size={22} color={COLORS.gray} />
            <Text style={{ color: COLORS.gray, marginTop: 8 }}>No offers right now.</Text>
          </View>
        ) : (
          liveOffers.map((offer, i) => {
            const includes = offer.includes || [];
            const matched = matchTestsToOffer(offer, allTests);
            const hasFasting = matched.some((t) => t.fastingRequired);
            return (
              <OfferCard
                key={offer.id}
                offer={offer}
                palette={getOfferPalette(i)}
                isApplied={appliedOffer?.id === offer.id}
                matchWarning={matched.length < includes.length}
                hasFasting={hasFasting}
                delay={Math.min(i, 8) * 45}
                onSelect={() => handleSelectOffer(offer)}
                hidePrice={offer.hidePrice}
              />
            );
          })
        )}

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
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.navyDark, letterSpacing: 0.2 },

  viewToggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.offWhite,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  viewToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
  },
  viewToggleBtnActive: { backgroundColor: COLORS.navy },
  viewToggleText: { fontSize: 13, fontWeight: '700', color: COLORS.bodyText, letterSpacing: 0.2 },
  viewToggleTextActive: { color: COLORS.white },

  offerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EBF0FB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C7D4F5',
  },
  offerBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.navyDark },
  offerBannerClear: { fontSize: 12, fontWeight: '800', color: COLORS.error },

  // ── Offer card (colorful, animated, "select & checkout" style) ──────
  offerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  offerAccentBar: { height: 5, width: '100%' },
  offerCardBody: { padding: 16, gap: 4 },
  offerCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  offerCardTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: COLORS.navyDark,
    letterSpacing: 0.1,
    lineHeight: 21,
    marginBottom: 6,
  },
  offerTypeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  offerTypeBadgeText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  savingsBadge: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  savingsBadgeText: { fontSize: 10.5, fontWeight: '900', color: COLORS.white, letterSpacing: 0.3 },
  offerTimeLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, marginBottom: 4 },
  offerTimeLeft: { fontSize: 12, color: COLORS.error, fontWeight: '700' },
  offerPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  offerStrike: { fontSize: 13.5, color: COLORS.gray, textDecorationLine: 'line-through', fontWeight: '600' },
  offerDiscounted: { fontSize: 21, fontWeight: '900', letterSpacing: 0.2 },
  offerIncludes: { fontSize: 12.5, color: COLORS.bodyText, marginTop: 6, lineHeight: 18 },
  offerIncludesLabel: { fontSize: 11, fontWeight: '800', color: COLORS.gray, letterSpacing: 0.4 },
  offerWarningRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  offerWarningText: { fontSize: 11, color: COLORS.error, fontWeight: '600' },
  offerSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 14,
  },
  offerSelectBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  offerSelectBtnApplied: {
    backgroundColor: COLORS.greenLight,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
  },
  offerSelectBtnAppliedText: { color: '#15803D', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },

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
  categoryPillText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },

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
  testInfo: { flex: 1, paddingRight: 8 , minWidth: 0,},
  testName: { fontSize: 14.5, fontWeight: '700', color: COLORS.navyDark, marginBottom: 2, letterSpacing: 0.1 },
  testNameSelected: { color: COLORS.navy },
  testDesc: { fontSize: 12, color: COLORS.bodyText, lineHeight: 18, marginBottom: 3,flexWrap: 'wrap', },
  testMeta: { fontSize: 11.5, color: COLORS.gray, fontWeight: '500' },
  fastingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  fastingBadgeText: { fontSize: 10.5, fontWeight: '700', color: '#B45309' },
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
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  summaryTotal: { fontSize: 23, fontWeight: '900', color: COLORS.navy, letterSpacing: 0.2 },

  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  continueBtn: { backgroundColor: COLORS.navy, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: COLORS.gray },
  continueBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});
