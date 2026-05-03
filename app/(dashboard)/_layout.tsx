import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { Bell, ShoppingCart, Store, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

// 👉 REPLACE WITH YOUR COMPUTER'S LOCAL IP
const API_URL = 'http://192.168.43.78:3000/api/mobile/dashboard';

// Active / inactive Lottie assets
const TAB_ICONS = {
  home: {
    active: require('../../assets/lottie/Home_active.json'),
    inactive: require('../../assets/lottie/Home_inactive.json'),
  },
  escrows: {
    active: require('../../assets/lottie/Layers_active.json'),
    inactive: require('../../assets/lottie/Layers_inactive.json'),
  },
  wallet: {
    active: require('../../assets/lottie/Wallet_active.json'),
    inactive: require('../../assets/lottie/Wallet_inactive.json'),
  },
  add: require('../../assets/lottie/Add.json'),
};

// =======================================================
// 1. GLOBAL PERSISTENT HEADER (Notification Bell & Titles)
// =======================================================
function GlobalHeader({ route }: any) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadHeaderData = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch(API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const json = await response.json();
        if (json.success && json.data) {
          setUser(json.data.user);
          setUnreadCount(json.data.unreadNotifs || 0);
        }
      } catch (e) {
        console.error('Header Data Fetch Error:', e);
      }
    };
    loadHeaderData();
  }, [route.name]);

  const currentRouteName = route.name;
  const showHeader = ['home', 'escrows', 'wallet'].includes(currentRouteName);

  if (!showHeader) return null;

  const firstName = user?.fullName?.split(' ')[0] || 'User';
  const userInitials = firstName.charAt(0).toUpperCase();
  const avatarUrl = user?.avatar || null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View style={[styles.globalHeader, { paddingTop: Math.max(insets.top, 10) }]}>
      {/* DYNAMIC LEFT SIDE */}
      {currentRouteName === 'home' ? (
        <View style={styles.headerLeft}>
          {avatarUrl ? (
            <LinearGradient
              colors={['#0EA5E9', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradientBorder}>
                <Image source={{ uri: avatarUrl }} style={styles.headerAvatarImg} />
            </LinearGradient>
          ) : (
            <LinearGradient colors={['#0EA5E9', '#10B981']} style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{userInitials}</Text>
            </LinearGradient>
          )}
          <View>
            <Text style={styles.headerName}>Hi, {firstName} 👋</Text>
            <Text style={styles.headerGreeting}>{getGreeting()}</Text>
          </View>
        </View>
      ) : (
        <Text style={styles.headerTitle}>
          {currentRouteName === 'escrows' ? 'Deals' : 'Wallet'}
        </Text>
      )}

      {/* PERSISTENT GLOBAL BELL */}
      <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications')} activeOpacity={0.7}>
        <Bell color="#64748B" size={22} />
        {unreadCount > 0 && (
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )} 
      </TouchableOpacity>
    </View>
  );
}

// =======================================================
// 2. LOTTIE TAB ICON COMPONENT (kept from original)
// =======================================================
type TabLottieIconProps = {
  activeSource: any;
  inactiveSource: any;
  focused: boolean;
  size?: number;
  iconKey: string;
};

function TabLottieIcon({
  activeSource,
  inactiveSource,
  focused,
  size = 24,
  iconKey,
}: TabLottieIconProps) {
  const animationRef = useRef<LottieView>(null);

  return (
    <LottieView
      key={`${iconKey}-${focused ? 'active' : 'inactive'}`}
      ref={animationRef}
      source={focused ? activeSource : inactiveSource}
      autoPlay={focused}
      loop={focused}
      progress={focused ? undefined : 1}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}

// =======================================================
// 3. BOUNCY TAB ITEM (kept from original)
// =======================================================
type BouncyTabItemProps = {
  onPress: () => void;
  children: React.ReactNode;
};

function BouncyTabItem({ onPress, children }: BouncyTabItemProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 25,
      bounciness: 8,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 10,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={styles.tabItem}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </TouchableOpacity>
  );
}

// =======================================================
// 4. FLOATING BOTTOM TAB BAR (kept original Lottie version)
// =======================================================
function FloatingTabBar({ state, navigation }: any) {
  const router = useRouter();
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  const insets = useSafeAreaInsets();
  const bottomBarBottom = insets.bottom + 16;

  useEffect(() => {
    const loadLiveUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) return;

        const response = await fetch(API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const json = await response.json();
        if (json.success && json.data?.user) {
          setUser(json.data.user);
        }
      } catch (e) {
        console.error('Navbar User Fetch Error:', e);
      }
    };

    loadLiveUser();
  }, [state.index]);

  const currentRouteName = state.routes[state.index].name;
  const showTabBar = ['home', 'escrows', 'wallet', 'profile'].includes(currentRouteName);

  if (!showTabBar) return null;

  const avatarUrl = user?.avatar || null;
  const userInitials = user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U';

  return (
    <>
      <Modal visible={isFabOpen} transparent animationType="fade">
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <TouchableOpacity
            style={styles.overlayBg}
            activeOpacity={1}
            onPress={() => setIsFabOpen(false)}
          >
            <View style={styles.fabMenuContainer}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.fabMenuCard}
                onPress={() => {
                  setIsFabOpen(false);
                  router.push({ pathname: '/create', params: { initialRole: 'buyer' } });
                }}
              >
                <View style={[styles.fabIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <ShoppingCart color="#2563EB" size={24} />
                </View>
                <View style={styles.fabMenuText}>
                  <Text style={styles.fabMenuTitle}>I am Buying</Text>
                  <Text style={styles.fabMenuDesc}>
                    Deposit funds to be safely locked until you receive your item.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.fabMenuCard}
                onPress={() => {
                  setIsFabOpen(false);
                  router.push({ pathname: '/create', params: { initialRole: 'seller' } });
                }}
              >
                <View style={[styles.fabIconBox, { backgroundColor: '#FDF2F8' }]}>
                  <Store color="#DB2777" size={24} />
                </View>
                <View style={styles.fabMenuText}>
                  <Text style={styles.fabMenuTitle}>I am Selling</Text>
                  <Text style={styles.fabMenuDesc}>
                    Send a secure payment request to a buyer to lock their funds.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.fabCloseWrapper}>
              <TouchableOpacity style={styles.fabCloseBtn} onPress={() => setIsFabOpen(false)}>
                <X color="#0F172A" size={24} strokeWidth={3} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      <View style={[styles.floatingBottomBarContainer, { bottom: bottomBarBottom }]}>
        <View style={styles.floatingBottomBar}>
          <BouncyTabItem onPress={() => navigation.navigate('home')}>
            <View style={styles.tabContent}>
              <TabLottieIcon
                iconKey="home"
                activeSource={TAB_ICONS.home.active}
                inactiveSource={TAB_ICONS.home.inactive}
                focused={currentRouteName === 'home'}
              />
              <Text style={currentRouteName === 'home' ? styles.tabTextActive : styles.tabText}>
                Home
              </Text>
            </View>
          </BouncyTabItem>

          <BouncyTabItem onPress={() => navigation.navigate('escrows')}>
            <View style={styles.tabContent}>
              <TabLottieIcon
                iconKey="escrows"
                activeSource={TAB_ICONS.escrows.active}
                inactiveSource={TAB_ICONS.escrows.inactive}
                focused={currentRouteName === 'escrows'}
              />
              <Text style={currentRouteName === 'escrows' ? styles.tabTextActive : styles.tabText}>
                Deals
              </Text>
            </View>
          </BouncyTabItem>

          <View style={styles.fabSpacer} />

          <BouncyTabItem onPress={() => navigation.navigate('wallet')}>
            <View style={styles.tabContent}>
              <TabLottieIcon
                iconKey="wallet"
                activeSource={TAB_ICONS.wallet.active}
                inactiveSource={TAB_ICONS.wallet.inactive}
                focused={currentRouteName === 'wallet'}
              />
              <Text style={currentRouteName === 'wallet' ? styles.tabTextActive : styles.tabText}>
                Wallet
              </Text>
            </View>
          </BouncyTabItem>

          <BouncyTabItem onPress={() => navigation.navigate('profile')}>
            <View style={styles.tabContent}>
              <LinearGradient
                colors={
                  currentRouteName === 'profile'
                    ? ['#0EA5E9', '#10B981']
                    : ['#CBD5E1', '#CBD5E1']
                }
                style={styles.navAvatarGradientStroke}
              >
                <View style={styles.navAvatarInner}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.navAvatarImage} />
                  ) : (
                    <LinearGradient colors={['#0EA5E9', '#10B981']} style={styles.navAvatarImage}>
                      <Text style={styles.navAvatarText}>{userInitials}</Text>
                    </LinearGradient>
                  )}
                </View>
              </LinearGradient>
              <Text style={currentRouteName === 'profile' ? styles.tabTextActive : styles.tabText}>
                Profile
              </Text>
            </View>
          </BouncyTabItem>
        </View>

        <View style={styles.fabContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.fabButton}
            onPress={() => setIsFabOpen(true)}
          >
            <LottieView
              source={TAB_ICONS.add}
              autoPlay
              loop
              resizeMode="contain"
              style={{ width: 32, height: 32 }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

// =======================================================
// 5. EXPORT TABS WITH CUSTOM HEADER
// =======================================================
export default function DashboardLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        header: (props) => <GlobalHeader {...props} />,
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="escrows" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" options={{ headerShown: false }} />
    </Tabs>
  );
}

// =======================================================
// 6. STYLES (merged from both)
// =======================================================
const styles = StyleSheet.create({
  // Global Header Styles
  globalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  headerGreeting: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  bellBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#FFFFFF', paddingHorizontal: 3 },
  bellBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', lineHeight: 14 },


  // Floating Tab Bar Styles (from original)
  floatingBottomBarContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 50,
  },
  floatingBottomBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  tabTextActive: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  fabSpacer: {
    width: 70,
  },
  navAvatarGradientStroke: {
    width: 24,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navAvatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navAvatarImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navAvatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  avatarGradientBorder: {
    width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', padding: 3,
  },
  fabContainer: {
    position: 'absolute',
    top: -30,
    left: '50%',
    transform: [{ translateX: -35 }],
    zIndex: 100,
  },
  fabButton: {
    width: 70,
    height: 70,
    backgroundColor: '#0B1120',
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0B1120',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 5,
    borderColor: '#FFFFFF',
  },
  overlayBg: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 140,
  },
  fabMenuContainer: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  fabMenuCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  fabIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabMenuText: {
    flex: 1,
  },
  fabMenuTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  fabMenuDesc: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 18,
  },
  fabCloseWrapper: {
    alignItems: 'center',
    marginTop: 24,
  },
  fabCloseBtn: {
    width: 56,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
});