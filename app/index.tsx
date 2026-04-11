import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

// ─── Timing ──────────────────────────────────────────────────────────────────
const STAGGER_MS = 370;   // delay between each line starting
const LINE_MS    = 500;   // fade-in duration per line
const HOLD_MS    = 650;   // pause after all lines appear
const EXIT_MS    = 350;   // final fade-out duration

// ─── Content ─────────────────────────────────────────────────────────────────
const LINES = ['НАЙТИ', 'НОВЫЕ', 'ХОББИ', 'ТЕПЕРЬ ЛЕГКО'];
const NUM_STRIPES = 8;

export default function IntroScreen() {
  const router = useRouter();

  const lineAnims   = useRef(LINES.map(() => new Animated.Value(0))).current;
  const spinnerAnim = useRef(new Animated.Value(0)).current;
  const screenAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // On web: if the user opened a deep link (e.g. /reset-password?token=…),
    // skip the intro and navigate straight to that path so the browser URL is
    // honoured and nothing is cancelled.
    if (typeof window !== 'undefined') {
      const { pathname, search } = window.location;
      if (pathname && pathname !== '/' && pathname !== '/index.html') {
        router.replace((pathname + search) as any);
        return;
      }
    }

    Animated.sequence([
      // Lines appear one by one
      Animated.stagger(
        STAGGER_MS,
        lineAnims.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: LINE_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ),
      // Spinner fades in
      Animated.timing(spinnerAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      // Hold
      Animated.delay(HOLD_MS),
      // Whole screen fades out → navigate
      Animated.timing(screenAnim, {
        toValue: 0,
        duration: EXIT_MS,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.replace('/(tabs)/events');
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenAnim }]}>
      {/* ─── Vertical stripe background ─────────────────────────────── */}
      <View style={styles.stripes} pointerEvents="none">
        {Array.from({ length: NUM_STRIPES }, (_, i) => (
          <View key={i} style={[styles.stripe, i % 2 === 1 && styles.stripeAlt]} />
        ))}
      </View>

      {/* ─── Animated text ──────────────────────────────────────────── */}
      <View style={styles.textBlock}>
        {LINES.map((word, i) => (
          <Animated.Text
            key={word}
            style={[
              styles.line,
              {
                opacity: lineAnims[i],
                transform: [
                  {
                    translateY: lineAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {word}
          </Animated.Text>
        ))}

        {/* Spinner appears after all lines */}
        <Animated.View style={[styles.spinnerWrap, { opacity: spinnerAnim }]}>
          <ActivityIndicator color="#181818" size="small" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Striped background
  stripes: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  stripe: {
    flex: 1,
  },
  stripeAlt: {
    backgroundColor: 'rgba(0,0,0,0.07)',
  },

  // Text block — vertically centred, left-aligned
  textBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  line: {
    fontFamily: 'Inter-Regular',
    fontSize: 52,
    lineHeight: 60,
    letterSpacing: -2,
    color: '#181818',
    textTransform: 'uppercase',
  },
  spinnerWrap: {
    marginTop: 28,
    alignSelf: 'flex-start',
  },
});
