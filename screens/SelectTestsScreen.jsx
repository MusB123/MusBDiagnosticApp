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
  Modal,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

// Backend rich-text fields (description, preparation) sometimes come back
// as HTML from a WYSIWYG editor (e.g. `<p class="isSelectedEnd">...</p>`).
// RN's <Text> doesn't parse HTML, so we strip tags/decode entities here,
// once, at normalization time — not at render time.
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

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
function TestRow({ test, isSelected, onToggle, onViewDetails, delay }) {
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
            <View style={styles.testNameRow}>
              <Text style={[styles.testName, isSelected && styles.testNameSelected]} numberOfLines={1}>
                {test.name}
              </Text>
            </View>
            {!!test.desc && (
              <Text style={styles.testDesc} numberOfLines={2} ellipsizeMode="tail">
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

            {test.doctorOrderRequired && (
              <View style={styles.doctorOrderBadge}>
                <Feather name="file-text" size={10} color="#7C3AED" />
                <Text style={styles.doctorOrderBadgeText}>Doctor's order required</Text>
              </View>
            )}

             <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onViewDetails();
              }}
              hitSlop={8}
              style={styles.detailsLinkBtn}
            >
              <View style={styles.detailsLinkIconWrap}>
                <Feather name="info" size={11} color={COLORS.navy} />
              </View>
              <Text style={styles.detailsLinkText}>View details</Text>
              <Feather name="chevron-right" size={12} color={COLORS.navy} />
            </Pressable>
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

/** Bottom-sheet modal showing full test details, including preparation instructions. */
function TestDetailsModal({ test, visible, onClose, isSelected, onToggle }) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!test) return null;
  const iconColors = getIconColors(test.iconName);
  const hasDiscount = test.discountPrice != null;
  const hasPrep = !!test.preparation && test.preparation.trim().toLowerCase() !== 'refer to package details';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        {/* Backdrop tap-to-close now lives on its own layer behind the sheet,
            instead of wrapping the scrollable content in a view that captures
            the touch responder. That capture was fighting the ScrollView for
            gesture ownership, which is what made scrolling feel sticky. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          style={[
            styles.modalSheet,
            {
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [400, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={[styles.iconWrap, { backgroundColor: iconColors.bg }]}>
                <Feather name={getFeatherIcon(test.iconName)} size={20} color={iconColors.fg} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.modalTitle}>{test.name}</Text>
                <Text style={styles.modalCategory}>{test.category}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={styles.modalCloseBtn}>
                <Feather name="x" size={18} color={COLORS.bodyText} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: 12, flexGrow: 1 }}
              showsVerticalScrollIndicator={true}
              bounces={Platform.OS === 'ios'}
              overScrollMode="never"
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              scrollsToTop={false}
              removeClippedSubviews={false}
            >
              {!!test.desc && (
                <Text style={styles.modalDesc}>{test.desc}</Text>
              )}

              <View style={styles.modalMetaGrid}>
                {!!test.sampleType && (
                  <View style={styles.modalMetaItem}>
                    <Feather name="droplet" size={14} color={COLORS.navy} />
                    <View>
                      <Text style={styles.modalMetaLabel}>Sample type</Text>
                      <Text style={styles.modalMetaValue}>{test.sampleType}</Text>
                    </View>
                  </View>
                )}
                {!!test.turnaround && (
                  <View style={styles.modalMetaItem}>
                    <Feather name="clock" size={14} color={COLORS.navy} />
                    <View>
                      <Text style={styles.modalMetaLabel}>Turnaround</Text>
                      <Text style={styles.modalMetaValue}>{test.turnaround}</Text>
                    </View>
                  </View>
                )}
              </View>

              {test.fastingRequired && (
                <View style={[styles.fastingBadge, { alignSelf: 'flex-start', marginTop: 4 }]}>
                  <Feather name="clock" size={10} color="#B45309" />
                  <Text style={styles.fastingBadgeText}>Fasting required before this test</Text>
                </View>
              )}

              {test.doctorOrderRequired && (
                <View style={[styles.doctorOrderBadge, { alignSelf: 'flex-start', marginTop: 4 }]}>
                  <Feather name="file-text" size={10} color="#7C3AED" />
                  <Text style={styles.doctorOrderBadgeText}>Requires a doctor's order</Text>
                </View>
              )}

              {hasPrep && (
                <View style={styles.modalPrepBox}>
                  <View style={styles.modalPrepHeaderRow}>
                    <Feather name="clipboard" size={13} color="#B45309" />
                    <Text style={styles.modalPrepHeader}>Preparation instructions</Text>
                  </View>
                  <Text style={styles.modalPrepText}>{test.preparation}</Text>
                </View>
              )}

              {!test.hidePrice && (
                <View style={styles.modalPriceRow}>
                  {hasDiscount ? (
                    <>
                      <Text style={styles.modalStrikePrice}>${test.price.toFixed(0)}</Text>
                      <Text style={styles.modalPrice}>${test.discountPrice.toFixed(0)}</Text>
                    </>
                  ) : (
                    <Text style={styles.modalPrice}>${test.price.toFixed(0)}</Text>
                  )}
                </View>
              )}
            </ScrollView>

            <AnimatedPressable
              style={[styles.modalConfirmBtn, isSelected && styles.modalConfirmBtnSelected]}
              onPress={() => {
                onToggle();
                onClose();
              }}
            >
              <Feather
                name={isSelected ? 'check' : 'plus'}
                size={16}
                color={COLORS.white}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.modalConfirmBtnText}>
                {isSelected ? 'Selected — tap to remove' : 'Add to selection'}
              </Text>
            </AnimatedPressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Modern gradient offer card — floating badge, gradient icon header, pulsing urgency chip. */
function OfferCard({ offer, palette, isApplied, hasFasting, delay, onSelect, hidePrice }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(isApplied ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(glow, { toValue: isApplied ? 1 : 0, useNativeDriver: false, speed: 18, bounciness: 8 }).start();
  }, [isApplied]);

  // Gentle breathing pulse on the "time left" chip so urgency reads as alive,
  // not a static label. Only runs while the offer actually has a countdown.
  useEffect(() => {
    if (!offer.time_left) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [offer.time_left]);

  const animatePress = (toValue) => {
    Animated.spring(scale, { toValue, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  };

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.border, palette.accent],
  });
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] });

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
          {/* Gradient header wash — replaces the old flat 5px accent bar */}
          <LinearGradient
            colors={[palette.accent, palette.accentBg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.offerGradientHeader}
          >
            <View style={styles.offerHeaderRow}>
              <View style={styles.offerIconCircle}>
                <Feather name="gift" size={16} color={palette.accent} />
              </View>
              {!hidePrice && savingsPct > 0 && (
                <View style={styles.floatingBadge}>
                  <Text style={styles.floatingBadgeText}>SAVE {savingsPct}%</Text>
                </View>
              )}
            </View>
            {!!offer.offer_type && (
              <Text style={styles.offerTypeOnGradient}>{offer.offer_type.toUpperCase()}</Text>
            )}
          </LinearGradient>

          <View style={styles.offerCardBody}>
            <Text style={styles.offerCardTitle} numberOfLines={2}>{offer.title}</Text>

            {!!offer.time_left && (
              <Animated.View style={[styles.offerTimeLeftPill, { transform: [{ scale: pulse }] }]}>
                <View style={styles.offerTimeDot} />
                <Text style={styles.offerTimeLeft}>{offer.time_left}</Text>
              </Animated.View>
            )}

            {!hidePrice && (
              <View style={styles.offerPriceRow}>
                <Text style={styles.offerStrike}>${parseFloat(offer.original_price).toFixed(0)}</Text>
                <Text style={[styles.offerDiscounted, { color: palette.accent }]}>
                  ${parseFloat(offer.discounted_price).toFixed(0)}
                </Text>
              </View>
            )}

            <View style={styles.offerIncludesWrap}>
              <Text style={styles.offerIncludesLabel}>INCLUDES</Text>
              <Text style={styles.offerIncludes} numberOfLines={2}>
                {(offer.includes || []).join('  ·  ')}
              </Text>
            </View>

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

  // Currently-open test details modal (null = closed).
  const [detailsTest, setDetailsTest] = useState(null);

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
            desc: stripHtml(t.description || ''),
            preparation: stripHtml(t.preparation || ''),
            price,
            discountPrice: hasDiscount ? discountPrice : null,
            hidePrice,
            category: t.category_name || 'General Wellness',
            iconName: t.icon_name || '',
            sampleType: t.sample_type || '',
            turnaround: t.turnaround || '',
            fastingRequired: !!t.fasting_required,
            doctorOrderRequired: !!t.doctor_order_required,
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
        console.log('RAW OFFERS FROM API:', JSON.stringify(data, null, 2));
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
  const matchedMap = new Map(); // t.id -> test, de-dupes automatically

  // Pass 1: try id-based matching (works IF backend ids line up)
  if (Array.isArray(offer.included_test_ids)) {
    offer.included_test_ids.forEach((id) => {
      const t = tests.find((t) => t.id === String(id));
      if (t) matchedMap.set(t.id, t);
    });
  }

  // Pass 2: title-based matching for anything not already matched.
  // This is the fallback that actually has to carry the weight here,
  // since we can't control how included_test_ids gets populated upstream.
  const includes = offer.includes || [];
  includes.forEach((includedTitle) => {
    const normIncluded = normalizeTitle(includedTitle);
    if (!normIncluded) return;

    // Already matched by id? skip.
    const already = [...matchedMap.values()].some(
      (t) => normalizeTitle(t.name) === normIncluded
    );
    if (already) return;

    // Exact normalized match first
    let match = tests.find((t) => normalizeTitle(t.name) === normIncluded);

    // Then word-overlap match (handles "CBC" vs "Complete Blood Count (CBC)",
    // "Lipid Panel" vs "Lipid Panel - Cholesterol", etc.)
    if (!match) {
      const includedWords = normIncluded.match(/.{1,}/g) ? includedTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2) : [];

      match = tests.find((t) => {
        const testWords = t.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 2);
        if (testWords.length === 0 || includedWords.length === 0) return false;
        const overlap = testWords.filter((w) => includedWords.includes(w)).length;
        // Require most of the shorter name's meaningful words to overlap
        const minLen = Math.min(testWords.length, includedWords.length);
        return overlap >= Math.max(1, Math.ceil(minLen * 0.6));
      });
    }

    // Last resort: loose substring match (your original fallback)
    if (!match) {
      match =
        tests.find((t) => normalizeTitle(t.name).includes(normIncluded)) ||
        tests.find((t) => normIncluded.includes(normalizeTitle(t.name)));
    }

    if (match) matchedMap.set(match.id, match);
  });

  return [...matchedMap.values()];
}

function buildOfferLineItems(offer, tests) {
  const includes = offer.includes || [];
  const usedIds = new Set();

  return includes.map((includedTitle, idx) => {
    const norm = normalizeTitle(includedTitle);
    const real =
      tests.find((t) => normalizeTitle(t.name) === norm && !usedIds.has(t.id)) ||
      tests.find((t) => normalizeTitle(t.name).includes(norm) && !usedIds.has(t.id)) ||
      tests.find((t) => norm.includes(normalizeTitle(t.name)) && !usedIds.has(t.id));

    if (real) {
      usedIds.add(real.id);
      return real;
    }

    // No catalog match — show it anyway as a display-only bundle item.
    return {
      id: `offer_item_${offer.id}_${idx}`,
      name: includedTitle,
      price: null,
      discountPrice: null,
      hidePrice: true,
      isBundleItem: true,
      doctorOrderRequired: false,
    };
  });
}


const handleSelectOffer = (offer) => {
  if (appliedOffer?.id === offer.id) {
    handleConfirm();
    return;
  }

  const includes = offer.includes || [];
  const lineItems = buildOfferLineItems(offer, allTests);
  const realMatchedCount = lineItems.filter((t) => !t.isBundleItem).length;

  setSelectedTests(lineItems.map((t) => t.id));
  setAppliedOffer({
    id: offer.id,
    title: offer.title,
    price: offer.hidePrice ? 0 : (parseFloat(offer.discounted_price) || 0),
    hidePrice: !!offer.hidePrice,
    matchedCount: realMatchedCount,
    totalCount: includes.length,
    testIds: lineItems.map((t) => t.id),
    bundleItems: lineItems, 
  });
  setViewMode('tests');
};

  const clearOffer = () => {
    setAppliedOffer(null);
    setSelectedTests([]);
  };

  const toggleTest = (id) => {
    if (appliedOffer) {
      const isPartOfOffer = (appliedOffer.testIds || []).includes(id);
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

  const selectedTestsData = appliedOffer
  ? [
      ...(appliedOffer.bundleItems || []),
      ...allTests.filter(
        (t) => selectedTests.includes(t.id) && !(appliedOffer.testIds || []).includes(t.id)
      ),
    ]
  : allTests.filter((t) => selectedTests.includes(t.id));
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
      // No returnTo means we landed here directly (e.g. from Home's offer
      // card), not mid-way through an existing BookMobileVisit flow. Route
      // through scheduling first — going straight to Checkout skips date/
      // time/address selection entirely.
      navigation.navigate('BookMobileVisit', {
        isGuest: route?.params?.isGuest === true,
        selectedTestsData,
        testsTotal,
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
    .map((o) => ({
      ...o,
      msLeft: o.is_unlimited ? null : getMsLeft(o.end_date),
      hidePrice: hasInsurance || !!o.hide_price,
    }))
    .filter((o) => o.msLeft === null || o.msLeft > 0)
    .map((o) => ({
      ...o,
      time_left: o.msLeft !== null ? formatTimeLeft(o.msLeft) : null,
    }));

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
                onViewDetails={() => setDetailsTest(test)}
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

      {/* Test details modal */}
      <TestDetailsModal
        test={detailsTest}
        visible={!!detailsTest}
        onClose={() => setDetailsTest(null)}
        isSelected={detailsTest ? selectedTests.includes(detailsTest.id) : false}
        onToggle={() => detailsTest && toggleTest(detailsTest.id)}
      />
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

  // ── Offer card (modern gradient header, floating badge, pulsing chip) ──
  offerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  offerGradientHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  offerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBadge: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  floatingBadgeText: { fontSize: 10.5, fontWeight: '900', color: COLORS.navyDark, letterSpacing: 0.3 },
  offerTypeOnGradient: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
    marginTop: 10,
    opacity: 0.9,
  },
  offerCardBody: { padding: 16, paddingTop: 14, gap: 4 },
  offerCardTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: COLORS.navyDark,
    letterSpacing: 0.1,
    lineHeight: 21,
    marginBottom: 8,
  },
  offerTimeLeftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 6,
  },
  offerTimeDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.error,
  },
  offerTimeLeft: { fontSize: 11.5, color: COLORS.error, fontWeight: '700' },
  offerPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  offerStrike: { fontSize: 13.5, color: COLORS.gray, textDecorationLine: 'line-through', fontWeight: '600' },
  offerDiscounted: { fontSize: 21, fontWeight: '900', letterSpacing: 0.2 },
  offerIncludesWrap: { marginTop: 8, marginBottom: 4 },
  offerIncludesLabel: { fontSize: 10.5, fontWeight: '800', color: COLORS.gray, letterSpacing: 0.5, marginBottom: 3 },
  offerIncludes: { fontSize: 12.5, color: COLORS.bodyText, lineHeight: 18 },
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
  testInfo: { flex: 1, paddingRight: 8, minWidth: 0, },
  testNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  testName: { fontSize: 14.5, fontWeight: '700', color: COLORS.navyDark, letterSpacing: 0.1, flexShrink: 1 },
  testNameSelected: { color: COLORS.navy },
  detailsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  detailsLinkIconWrap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsLinkText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.navy,
    letterSpacing: 0.1,
  },
  testDesc: { fontSize: 12, color: COLORS.bodyText, lineHeight: 18, marginBottom: 3, flexWrap: 'wrap', },
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
  doctorOrderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  doctorOrderBadgeText: { fontSize: 10.5, fontWeight: '700', color: '#7C3AED' },
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

  // ── Test details modal ───────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13,31,60,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: Math.round(Dimensions.get('window').height * 0.85),
    flexShrink: 1,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.navyDark },
  modalCategory: { fontSize: 12.5, color: COLORS.gray, fontWeight: '600', marginTop: 2 },
  modalCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.offWhite,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { flexGrow: 1, flexShrink: 1, minHeight: 100 },
  modalDesc: { fontSize: 13.5, color: COLORS.bodyText, lineHeight: 20, marginBottom: 14 },
  modalMetaGrid: { gap: 12, marginBottom: 4 },
  modalMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalMetaLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  modalMetaValue: { fontSize: 13.5, color: COLORS.navyDark, fontWeight: '700', marginTop: 1 },
  modalPrepBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  modalPrepHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  modalPrepHeader: { fontSize: 11.5, fontWeight: '800', color: '#B45309', textTransform: 'uppercase', letterSpacing: 0.3 },
  modalPrepText: { fontSize: 12.5, color: '#92400E', lineHeight: 19 },
  modalPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 16 },
  modalStrikePrice: { fontSize: 14, color: COLORS.gray, textDecorationLine: 'line-through', fontWeight: '600' },
  modalPrice: { fontSize: 24, fontWeight: '900', color: COLORS.navy },
  modalConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 16,
  },
  modalConfirmBtnSelected: { backgroundColor: COLORS.green },
  modalConfirmBtnText: { color: COLORS.white, fontSize: 14.5, fontWeight: '800', letterSpacing: 0.2 },

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