import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { Shield } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { supabase } from '../../lib/supabase';

export default function SplashScreen() {
  const router = useRouter();

  // --- ANIMATIONS ---
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const glowScaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 🎬 START ANIMATIONS
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 9,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScaleAnim, {
            toValue: 1.2,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacityAnim, {
            toValue: 0.5,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowScaleAnim, {
            toValue: 0.9,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacityAnim, {
            toValue: 0.2,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // 🚀 MAIN APP LOGIC (FIXED)
    const init = async () => {
      try {
        const onboarded = await SecureStore.getItemAsync('hasOnboarded');
        const { data: { session } } = await supabase.auth.getSession();

        console.log('🔍 Splash check:', { onboarded, hasSession: !!session });

        setTimeout(() => {
          if (onboarded !== 'true') {
            console.log('➡️ First launch → redirect to /onboarding');
            router.replace('/onboarding');
          } else if (!session) {
            console.log('➡️ Returning user, not logged in → redirect to /auth');
            router.replace('/auth');
          } else {
            console.log('➡️ Logged in → redirect to /home');
            router.replace('/home');
          }
        }, 2500);

      } catch (error) {
        console.log("❌ Splash error:", error);
        router.replace('/onboarding');
      }
    };

    init();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.centerStage}>
        {/* Glow */}
        <Animated.View
          style={{
            position: 'absolute',
            transform: [{ scale: glowScaleAnim }],
            opacity: glowOpacityAnim,
          }}
        >
          <Svg height="300" width="300">
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#10B981" stopOpacity="1" />
                <Stop offset="50%" stopColor="#10B981" stopOpacity="0.4" />
                <Stop offset="100%" stopColor="#10B981" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="150" cy="150" r="150" fill="url(#glow)" />
          </Svg>
        </Animated.View>

        {/* Logo */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
            alignItems: 'center',
          }}
        >
          <View style={styles.squircle}>
            <Shield color="#10B981" fill="#10B981" size={44} />
          </View>
          <Text style={styles.brandName}>TrustLock</Text>
        </Animated.View>
      </View>

      <Animated.View style={{ opacity: fadeAnim, paddingBottom: 50 }}>
        <Text style={styles.versionText}>V 1.0.0 • CAMEROON</Text>
      </Animated.View>
    </View>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#040914',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squircle: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.25)',
    borderWidth: 1.5,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  brandName: {
    color: '#FFF',
    fontSize: 38,
    fontWeight: '800',
  },
  versionText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
});