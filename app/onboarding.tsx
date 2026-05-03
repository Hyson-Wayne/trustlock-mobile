import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, Check, Handshake, Lock, Shield } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SLIDES = [
    {
        id: '1',
        title: 'Never get\nscammed again.',
        description: 'Buy and sell safely. We hold your money securely until the transaction is fully complete.',
    },
    {
        id: '2',
        title: 'Lock funds via\nMoMo.',
        description: 'No credit cards required. Pay directly from your MTN or Orange Money account into our secure vault.',
    },
    {
        id: '3',
        title: 'Approve and\nrelease funds.',
        description: 'We hold the money safely. Funds are only released to the seller when you physically receive the item.',
    }
];

export default function OnboardingScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    // --- HARDWARE SCROLL & ANIMATION ENGINE ---
    const scrollX = useRef(new Animated.Value(0)).current;
    const floatAnim1 = useRef(new Animated.Value(0)).current;
    const floatAnim2 = useRef(new Animated.Value(0)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef(new Animated.Value(1)).current;
    const buttonFadeAnim = useRef(new Animated.Value(0)).current;

    // Haptic feedback when page changes (latest touch feature)
    useEffect(() => {
        if (currentStep !== 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, [currentStep]);

    useEffect(() => {
        // Smooth Floating Physics
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim1, { toValue: -8, duration: 2500, useNativeDriver: true }),
                Animated.timing(floatAnim1, { toValue: 0, duration: 2500, useNativeDriver: true })
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim2, { toValue: 8, duration: 3000, useNativeDriver: true }),
                Animated.timing(floatAnim2, { toValue: 0, duration: 3000, useNativeDriver: true })
            ])
        ).start();

        // 15-second smooth rotation
        Animated.loop(
            Animated.timing(spinAnim, { toValue: 1, duration: 15000, useNativeDriver: true })
        ).start();
    }, []);

    // Animate the Blue Progress Ring on step change
    useEffect(() => {
        Animated.spring(progressAnim, {
            toValue: currentStep + 1,
            friction: 8,
            tension: 40,
            useNativeDriver: false,
        }).start();

        // Fade in the final button smoothly
        if (currentStep === 2) {
            Animated.timing(buttonFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        } else {
            Animated.timing(buttonFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        }
    }, [currentStep]);

    // --- EVENT HANDLERS ---
    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems[0]) setCurrentStep(viewableItems[0].index);
    }).current;

    const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < SLIDES.length - 1) {
        flatListRef.current?.scrollToIndex({ index: currentStep + 1, animated: true });
    } else {
        // Mark onboarding as completed
        await SecureStore.setItemAsync('hasOnboarded', 'true');
        router.push('/auth');
    }
    };

    const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await SecureStore.setItemAsync('hasOnboarded', 'true');
    router.push('/auth');
    };

    // --- SVG MATH ---
    const radius = 32;
    const strokeWidth = 4;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = progressAnim.interpolate({
        inputRange: [1, 2, 3],
        outputRange: [
            circumference - (circumference * 0.333),
            circumference - (circumference * 0.666),
            0
        ]
    });

    const spinInterpolate = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar style="dark" />

            {/* --- SKIP BUTTON - PERFECTLY POSITIONED TOP RIGHT --- */}
            {currentStep < 2 && (
                <TouchableOpacity 
                    onPress={handleSkip} 
                    style={[
                        styles.skipButton, 
                        { top: insets.top + 12, right: 24 }
                    ]} 
                    activeOpacity={0.7}
                >
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            )}

            {/* --- NATIVE SWIPE CAROUSEL WITH PARALLAX --- */}
            <Animated.FlatList
                ref={flatListRef}
                data={SLIDES}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                style={styles.flatList}
                renderItem={({ item, index }) => {
                    // --- PARALLAX INTERPOLATION MATH ---
                    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

                    const imageScale = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.8, 1, 0.8],
                        extrapolate: 'clamp',
                    });

                    const imageOpacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0, 1, 0],
                        extrapolate: 'clamp',
                    });

                    return (
                        <View style={[styles.slide, { width }]}>
                            {/* GRAPHICS SECTION (Takes up exactly the top portion) */}
                            <Animated.View style={[styles.graphicContainer, { opacity: imageOpacity, transform: [{ scale: imageScale }] }]}>
                                {/* SLIDE 1 */}
                                {index === 0 && (
                                    <View style={styles.graphicCenter}>
                                        <View style={styles.absoluteCenter}>
                                            <Svg height="300" width="300">
                                                <Defs>
                                                    <RadialGradient id="blueGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                                                        <Stop offset="0%" stopColor="#2563EB" stopOpacity="0.15" />
                                                        <Stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                                                    </RadialGradient>
                                                </Defs>
                                                <Circle cx="150" cy="150" r="150" fill="url(#blueGlow)" />
                                            </Svg>
                                        </View>

                                        <View style={styles.iconBox}>
                                            <Lock color="#2563EB" size={56} strokeWidth={2} />
                                        </View>

                                        <Animated.View style={[styles.badgeSafe, { transform: [{ translateY: floatAnim1 }] }]}>
                                            <Check color="#10B981" size={16} strokeWidth={4} />
                                            <Text style={styles.badgeSafeText}>100% Safe</Text>
                                        </Animated.View>

                                        <Animated.View style={[styles.badgeWarning, { transform: [{ translateY: floatAnim2 }] }]}>
                                            <Text style={styles.badgeWarningText}>!</Text>
                                        </Animated.View>
                                    </View>
                                )}

                                {/* SLIDE 2 */}
                                {index === 1 && (
                                    <View style={styles.graphicCenter}>
                                        <View style={styles.phoneMockup}>
                                            {/* Premium Dynamic Island */}
                                            <View style={styles.phoneNotch} />
                                            <View style={styles.phoneScreen}>
                                                <View style={styles.phoneScreenIcon} />
                                                <View style={styles.phoneScreenButton} />
                                            </View>
                                        </View>

                                        <Animated.View style={[styles.badgeMtn, { transform: [{ translateY: floatAnim1 }] }]}>
                                            <Text style={styles.badgeMtnText}>MTN MoMo</Text>
                                        </Animated.View>

                                        <Animated.View style={[styles.badgeOrange, { transform: [{ translateY: floatAnim2 }] }]}>
                                            <Text style={styles.badgeOrangeText}>Orange Money</Text>
                                        </Animated.View>
                                    </View>
                                )}

                                {/* SLIDE 3 */}
                                {index === 2 && (
                                    <View style={styles.graphicCenter}>
                                        <View style={styles.absoluteCenter}>
                                            <Svg height="300" width="300">
                                                <Defs>
                                                    <RadialGradient id="greenGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                                                        <Stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                                                        <Stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                                                    </RadialGradient>
                                                </Defs>
                                                <Circle cx="150" cy="150" r="150" fill="url(#greenGlow)" />
                                            </Svg>
                                        </View>

                                        <Animated.View style={[styles.dashedRingContainer, { transform: [{ rotate: spinInterpolate }] }]}>
                                            <Svg width="180" height="180">
                                                <Circle cx="90" cy="90" r="88" stroke="#10B981" strokeWidth="2.5" strokeDasharray="8 8" fill="none" />
                                            </Svg>
                                        </Animated.View>

                                        <View style={styles.solidCircle}>
                                            <Handshake color="#FFFFFF" size={48} strokeWidth={2} />
                                        </View>
                                    </View>
                                )}
                            </Animated.View>

                            {/* TEXT SECTION (Fixed height container ensures no jumping or overlapping) */}
                            <View style={styles.textWrapper}>
                                <Text style={styles.title}>{item.title}</Text>
                                <Text style={styles.description}>{item.description}</Text>
                            </View>
                        </View>
                    );
                }}
            />

            {/* --- BOTTOM CONTROLS (Adjusted to avoid system navigation overlap) --- */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                {/* State 1 & 2 Layout: Dots Left, Button Right */}
                <View style={[styles.footerSplit, { opacity: currentStep < 2 ? 1 : 0, position: currentStep < 2 ? 'relative' : 'absolute', zIndex: currentStep < 2 ? 10 : -1 }]}>
                    <View style={styles.pagination}>
                        {SLIDES.map((_, i) => (
                            <View key={i} style={[styles.dot, currentStep === i ? styles.dotActive : styles.dotInactive]} />
                        ))}
                    </View>

                    <TouchableOpacity activeOpacity={0.8} onPress={handleNext} style={styles.progressButton}>
                        <Svg width={76} height={76} style={{ transform: [{ rotate: '-90deg' }], position: 'absolute' }}>
                            <Circle cx="38" cy="38" r={radius} stroke="#F1F5F9" strokeWidth="4" fill="none" />
                            <AnimatedCircle
                                cx="38" cy="38" r={radius}
                                stroke="#2563EB" strokeWidth="4" fill="none"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                            />
                        </Svg>
                        <View style={styles.arrowCircle}>
                            <ArrowRight color="#FFFFFF" size={24} strokeWidth={2.5} />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* State 3 Layout: Dots Center, Big Button Full Width */}
                <Animated.View style={[styles.footerCenter, {
                    opacity: buttonFadeAnim,
                    transform: [{ translateY: buttonFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                    position: currentStep === 2 ? 'relative' : 'absolute',
                    zIndex: currentStep === 2 ? 10 : -1
                }]}>
                    <View style={[styles.pagination, { marginBottom: 32 }]}>
                        {SLIDES.map((_, i) => (
                            <View key={i} style={[styles.dot, currentStep === i ? styles.dotActive : styles.dotInactive]} />
                        ))}
                    </View>

                    <TouchableOpacity activeOpacity={0.9} onPress={handleNext} style={styles.getStartedButton}>
                        <Text style={styles.getStartedText}>Get Started</Text>
                        <Shield color="#0B1120" size={20} fill="#FFFFFF" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </SafeAreaView>
    );
}

// ==========================================
// STRICT NATIVE STYLESHEET (Pixel Perfect)
// ==========================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF'
    },
    skipButton: {
        position: 'absolute',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        zIndex: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    skipText: {
        color: '#64748B',
        fontWeight: '700',
        fontSize: 14
    },
    flatList: {
        flex: 1,
    },
    slide: {
        flex: 1,
        justifyContent: 'space-between',
    },
    graphicContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    graphicCenter: {
        position: 'relative',
        width: 280,
        height: 280,
        justifyContent: 'center',
        alignItems: 'center'
    },
    absoluteCenter: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // --- Slide 1 Graphics ---
    iconBox: {
        width: 130, height: 130,
        backgroundColor: '#FFFFFF', borderRadius: 36,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#2563EB', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.12, shadowRadius: 30, elevation: 10,
        borderWidth: 1, borderColor: '#F8FAFC'
    },
    badgeSafe: {
        position: 'absolute', bottom: 35, left: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.95)', flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)'
    },
    badgeSafeText: {
        color: '#10B981', fontWeight: '800', marginLeft: 6, fontSize: 14
    },
    badgeWarning: {
        position: 'absolute', top: 30, right: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.95)', width: 44, height: 44, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)'
    },
    badgeWarningText: {
        backgroundColor: '#F59E0B', color: '#FFF', fontWeight: '900',
        width: 24, height: 24, textAlign: 'center', lineHeight: 24, borderRadius: 6, overflow: 'hidden'
    },

    // --- Slide 2 Graphics ---
    phoneMockup: {
        width: 150, height: 260,
        backgroundColor: '#0F172A', borderRadius: 36, borderWidth: 6, borderColor: '#0F172A',
        shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 10
    },
    phoneNotch: {
        position: 'absolute', top: 8, alignSelf: 'center',
        width: 60, height: 18, backgroundColor: '#0F172A',
        borderRadius: 10, zIndex: 10
    },
    phoneScreen: {
        flex: 1, backgroundColor: '#FFFFFF', borderRadius: 28, padding: 16,
        justifyContent: 'flex-end', alignItems: 'center'
    },
    phoneScreenIcon: {
        width: 40, height: 40, backgroundColor: '#DBEAFE', borderRadius: 12,
        position: 'absolute', top: 46
    },
    phoneScreenButton: {
        width: '100%', height: 40, backgroundColor: '#10B981', borderRadius: 12
    },
    badgeMtn: {
        position: 'absolute', top: 50, left: -20,
        backgroundColor: '#FFCC00', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30,
        shadowColor: '#FFCC00', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8
    },
    badgeMtnText: { color: '#000000', fontWeight: '900', fontSize: 13 },
    badgeOrange: {
        position: 'absolute', bottom: 60, right: -25,
        backgroundColor: '#F97316', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30,
        shadowColor: '#F97316', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8
    },
    badgeOrangeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },

    // --- Slide 3 Graphics ---
    dashedRingContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    solidCircle: {
        width: 110, height: 110, backgroundColor: '#10B981', borderRadius: 55,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#10B981', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.3, shadowRadius: 25, elevation: 10
    },

    // --- Text Content (Locked Height to prevent jumping) ---
    textWrapper: {
        paddingHorizontal: 36,
        height: 180,
        justifyContent: 'flex-start',
    },
    title: {
        fontSize: 36,
        fontWeight: '900',
        color: '#0B1120',
        marginBottom: 16,
        lineHeight: 42
    },
    description: {
        fontSize: 16,
        color: '#64748B',
        fontWeight: '500',
        lineHeight: 26,
        paddingRight: 10
    },

    // --- Strict Footer Zone (Adjusted for system navigation) ---
    footer: {
        paddingHorizontal: 36,
        paddingTop: 20,
        backgroundColor: '#FFFFFF',
    },
    footerSplit: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    footerCenter: {
        alignItems: 'center',
        width: '100%'
    },

    pagination: { flexDirection: 'row', alignItems: 'center' },
    dot: { height: 8, borderRadius: 4, marginHorizontal: 4 },
    dotActive: { width: 28, backgroundColor: '#2563EB' },
    dotInactive: { width: 8, backgroundColor: '#E2E8F0' },

    progressButton: { width: 76, height: 76, justifyContent: 'center', alignItems: 'center' },
    arrowCircle: {
        position: 'absolute', width: 56, height: 56, backgroundColor: '#0B1120', borderRadius: 28,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5
    },

    getStartedButton: {
        width: '100%', height: 60, backgroundColor: '#0B1120', borderRadius: 20,
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 8
    },
    getStartedText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' }
});