import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Animated,
  Easing,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import RenderHtml from 'react-native-render-html';
import { fetchCmsDocuments } from '../utils/auth';

const NAVY = '#0A1F5C';
const BRAND = '#00A0E4';
const BODY_TEXT = '#3A4258';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ------------------------------------------------------------------ */
/*  Animated building blocks                                           */
/* ------------------------------------------------------------------ */

function FadeInUp({ children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

function AnimatedPressable({ onPress, disabled, style, children }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={disabled}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={style}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

/* Big section header (Privacy Policy / Terms of Service) with icon + gradient underline */
function BigSectionHeader({ icon, title, meta }) {
  return (
    <FadeInUp>
      <View style={styles.bigHeaderWrap}>
        <LinearGradient
          colors={[NAVY, BRAND]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bigHeaderIconWrap}
        >
          <Ionicons name={icon} size={26} color="#FFFFFF" />
        </LinearGradient>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.bigHeaderTitle}>{title}</Text>
          <LinearGradient
            colors={[BRAND, 'rgba(0,160,228,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bigHeaderUnderline}
          />
        </View>
      </View>
      {meta ? <Text style={styles.metaText}>{meta}</Text> : null}
    </FadeInUp>
  );
}

/* Decorative divider that separates Privacy Policy from Terms of Service */
function SectionDivider({ label, icon }) {
  return (
    <FadeInUp style={styles.dividerWrap}>
      <View style={styles.dividerLineRow}>
        <LinearGradient
          colors={['rgba(10,31,92,0)', NAVY]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.dividerLine}
        />
        <View style={styles.dividerBadge}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>
        <LinearGradient
          colors={[NAVY, 'rgba(10,31,92,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.dividerLine}
        />
      </View>
      <Text style={styles.dividerLabel}>{label}</Text>
    </FadeInUp>
  );
}

/* Wraps CMS HTML content in a soft rounded card, rendered with RenderHtml */
function CmsContentCard({ html, delay = 0 }) {
  const htmlSource = { html: html || '<p>No content available.</p>' };

  return (
    <FadeInUp delay={delay}>
      <View style={styles.contentCard}>
        <RenderHtml
          contentWidth={SCREEN_WIDTH - 18 * 2 - 20 * 2}
          source={htmlSource}
          tagsStyles={htmlTagStyles}
          enableExperimentalMarginCollapsing
        />
      </View>
    </FadeInUp>
  );
}

const htmlTagStyles = {
  body: { color: BODY_TEXT, fontSize: 13.5, lineHeight: 21 },
  p: { color: BODY_TEXT, fontSize: 13.5, lineHeight: 21, marginBottom: 10 },
  h1: { color: NAVY, fontSize: 19, fontWeight: '800', marginTop: 4, marginBottom: 10 },
  h2: { color: NAVY, fontSize: 16.5, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  h3: { color: NAVY, fontSize: 14.5, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  ul: { marginBottom: 10 },
  li: { color: BODY_TEXT, fontSize: 13.5, lineHeight: 20, marginBottom: 6 },
  a: { color: BRAND, fontWeight: '600', textDecorationLine: 'underline' },
  strong: { fontWeight: '800', color: NAVY },
  b: { fontWeight: '800', color: NAVY },
};

/* ------------------------------------------------------------------ */
/*  Screen                                                             */
/* ------------------------------------------------------------------ */

export default function TermsScreen({ navigation }) {
  const [readAgreed, setReadAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [docs, setDocs] = useState({ privacy_policy: null, terms_of_service: null });
  const checkScale = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchCmsDocuments(['privacy_policy', 'terms_of_service']);
      setDocs(result);
      if (!result.privacy_policy && !result.terms_of_service) {
        setError('Legal documents are currently unavailable. Please try again shortly.');
      }
    } catch (err) {
      setError(
        err.message === 'NETWORK_ERROR'
          ? "Can't reach the server. Check your connection."
          : 'Could not load the Terms & Privacy Policy. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleBack = () => {
    navigation.navigate('RoleSelect', { agreedTerms: readAgreed });
  };

  const toggleCheck = () => {
    Animated.sequence([
      Animated.spring(checkScale, { toValue: 0.75, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
    ]).start();
    setReadAgreed((prev) => !prev);
  };

  const progressScale = scrollY.interpolate({
    inputRange: [0, 4000],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const formatMeta = (doc) => {
    if (!doc?.updated_at) return '';
    try {
      const d = new Date(doc.updated_at);
      const formatted = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      return `Last Updated: ${formatted}`;
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <LinearGradient colors={[NAVY, BRAND]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('RoleSelect')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Privacy Policy</Text>
        <View style={{ width: 60 }} />
      </LinearGradient>

      {/* Scroll progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFillWrap, { transform: [{ scaleX: progressScale }] }]}>
          <LinearGradient
            colors={[BRAND, '#6C5CE7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.progressFill}
          />
        </Animated.View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={NAVY} />
          <Text style={styles.loadingText}>Loading legal documents…</Text>
        </View>
      ) : error && !docs.privacy_policy && !docs.terms_of_service ? (
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={40} color="#94A3B8" />
          <Text style={styles.errorText}>{error}</Text>
          <AnimatedPressable onPress={loadDocuments} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <Animated.ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
        >
          {error ? (
            <FadeInUp>
              <View style={styles.warnBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#B45309" />
                <Text style={styles.warnBannerText}>{error}</Text>
              </View>
            </FadeInUp>
          ) : null}

          {/* ===================== PRIVACY POLICY ===================== */}
          {docs.privacy_policy && (
            <>
              <BigSectionHeader
                icon="shield-checkmark-outline"
                title={docs.privacy_policy.title || 'Privacy Policy'}
                meta={formatMeta(docs.privacy_policy)}
              />
              <CmsContentCard html={docs.privacy_policy.content} delay={60} />
            </>
          )}

          {docs.privacy_policy && docs.terms_of_service && (
            <SectionDivider label="Terms of Service Begins" icon="document-text" />
          )}

          {/* ===================== TERMS OF SERVICE ===================== */}
          {docs.terms_of_service && (
            <>
              <BigSectionHeader
                icon="document-text-outline"
                title={docs.terms_of_service.title || 'Terms of Service'}
                meta={formatMeta(docs.terms_of_service)}
              />
              <CmsContentCard html={docs.terms_of_service.content} delay={60} />
            </>
          )}

          <View style={{ height: 28 }} />

          <FadeInUp>
            <View style={[styles.contentCard, { borderLeftWidth: 4, borderLeftColor: BRAND }]}>
              <View style={styles.accreditationRow}>
                <LinearGradient colors={[BRAND, '#0077A8']} style={styles.badge}>
                  <Ionicons name="ribbon-outline" size={16} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.accreditationTitle}>Accreditation</Text>
              </View>
              <Text style={styles.body}>
                MusB Diagnostics operates under CLIA-COLA accreditation standards to ensure the quality and
                reliability of laboratory testing services provided through this platform.
              </Text>
            </View>
          </FadeInUp>
        </Animated.ScrollView>
      )}

      <View style={styles.footer}>
        <View style={styles.checkRow}>
          <AnimatedPressable onPress={toggleCheck} disabled={loading}>
            <Animated.View
              style={[
                styles.checkbox,
                readAgreed && styles.checkboxChecked,
                { transform: [{ scale: checkScale }] },
              ]}
            >
              {readAgreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </Animated.View>
          </AnimatedPressable>
          <Text style={styles.checkText}>I have read and understood the Terms & Privacy Policy</Text>
        </View>

        <AnimatedPressable
          onPress={handleBack}
          disabled={!readAgreed || loading}
          style={{ borderRadius: 14 }}
        >
          <LinearGradient
            colors={readAgreed && !loading ? [NAVY, BRAND] : ['#C7CEE3', '#C7CEE3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmBtn}
          >
            <Text style={styles.confirmBtnText}>
              {readAgreed ? 'Accept & Continue' : 'Please check the box above'}
            </Text>
            {readAgreed && <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />}
          </LinearGradient>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 16,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
  backText: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', marginLeft: 2 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  progressTrack: { height: 3, backgroundColor: '#E4E9F5', overflow: 'hidden' },
  progressFillWrap: { flex: 1, width: '200%', marginLeft: '-100%' },
  progressFill: { height: 3, width: '100%' },

  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingText: { marginTop: 14, fontSize: 13.5, color: '#6B7590' },
  errorText: { marginTop: 14, fontSize: 13.5, color: '#6B7590', textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 18,
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 },

  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  warnBannerText: { flex: 1, fontSize: 12.5, color: '#92400E', lineHeight: 18 },

  scroll: { flex: 1 },
  scrollContent: { padding: 18, paddingBottom: 40 },

  bigHeaderWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  bigHeaderIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NAVY,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bigHeaderTitle: { fontSize: 20, fontWeight: '800', color: NAVY },
  bigHeaderUnderline: { height: 4, borderRadius: 2, marginTop: 6, width: '70%' },

  metaText: {
    fontSize: 12,
    color: '#6B7590',
    fontStyle: 'italic',
    marginTop: 10,
    marginBottom: 10,
    lineHeight: 18,
  },

  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#1B2A57',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  accreditationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  badge: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  accreditationTitle: { fontSize: 14.5, fontWeight: '700', color: NAVY, marginLeft: 10 },
  body: { fontSize: 13.5, lineHeight: 21, color: BODY_TEXT },

  dividerWrap: { alignItems: 'center', marginVertical: 36 },
  dividerLineRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  dividerLine: { flex: 1, height: 2, borderRadius: 1 },
  dividerBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    shadowColor: NAVY,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dividerLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#EEF1F8', backgroundColor: '#FFFFFF' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: NAVY,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: NAVY, borderColor: NAVY },
  checkText: { fontSize: 13, color: '#333', flexShrink: 1 },

  confirmBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});