import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Layers as LayersIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator, Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

// 👉 REPLACE WITH YOUR COMPUTER'S LOCAL IP
const API_URL = 'http://192.168.43.78:3000/api/mobile/dashboard'; 

export default function DealsScreen() {
  const router = useRouter();
  const[isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashData, setDashData] = useState<any>(null);
  
  // --- UI STATES ---
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState('All');

  // --- FETCH DATA ---
  const fetchDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.replace('/auth'); return; }
      
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      });
      const json = await response.json();
      if (json.success) setDashData(json.data);
    } catch (error) {
      console.error("Deals Fetch Error:", error);
    } finally {
      setIsLoading(false); setIsRefreshing(false);
    }
  };

  // Reload data every time the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchDashboardData();
    },[])
  );

  const onRefresh = () => { setIsRefreshing(true); fetchDashboardData(); };

  // --- FORMATTERS ---
  const formatK = (num: number) => {
    if (!num) return '0';
    if (num >= 1000) return (num / 1000).toFixed(num % 1000 !== 0 ? 1 : 0) + 'k';
    return num.toString();
  };

  const formatDealDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // --- SMART UI PARSER FOR CARDS ---
  const getDealUIState = (deal: any) => {
    const isBuyer = deal.buyerId === dashData?.user?.id;
    const status = deal.status;

    // Default to ACTIVE (Waiting on Counterparty)
    let state = { filterTab: 'Active', badgeText: 'AWAITING UPDATE', color: '#D97706', bg: '#FFFBEB', icon: Clock, glow: '#FEF3C7' };

    if (status === "COMPLETED") {
      state = { filterTab: 'Completed', badgeText: 'SUCCESS', color: '#10B981', bg: '#D1FAE5', icon: CheckCircle2, glow: '#ECFDF5' };
    } else if (status === "REFUNDED") {
      state = { filterTab: 'Completed', badgeText: 'REFUNDED', color: '#64748B', bg: '#E2E8F0', icon: CheckCheck, glow: '#F1F5F9' };
    } else if (status === "DISPUTED") {
      state = { filterTab: 'Disputed', badgeText: 'DISPUTED', color: '#EF4444', bg: '#FEE2E2', icon: AlertTriangle, glow: '#FEF2F2' };
    } else if (isBuyer) {
      if (status === 'DRAFT') {
        state = { filterTab: 'Active', badgeText: 'ACTION REQ.', color: '#EF4444', bg: '#FEE2E2', icon: AlertTriangle, glow: '#FEF2F2' };
      } else if (status === 'FUNDS_LOCKED') {
        state = { filterTab: 'Active', badgeText: 'AWAITING DELIVERY', color: '#D97706', bg: '#FFFBEB', icon: Clock, glow: '#FEF3C7' };
      } else if (status === 'DELIVERED') {
        state = { filterTab: 'Active', badgeText: 'ACTION REQ.', color: '#EF4444', bg: '#FEE2E2', icon: AlertTriangle, glow: '#FEF2F2' };
      }
    } else { // SELLER
      if (status === 'DRAFT') {
        state = { filterTab: 'Active', badgeText: 'AWAITING FUNDS', color: '#D97706', bg: '#FFFBEB', icon: Clock, glow: '#FEF3C7' };
      } else if (status === 'FUNDS_LOCKED') {
        state = { filterTab: 'Active', badgeText: 'ACTION REQ.', color: '#EF4444', bg: '#FEE2E2', icon: AlertTriangle, glow: '#FEF2F2' };
      } else if (status === 'DELIVERED') {
        state = { filterTab: 'Active', badgeText: 'AWAITING APPROVAL', color: '#D97706', bg: '#FFFBEB', icon: Clock, glow: '#FEF3C7' };
      }
    }
    return state;
  };

  if (isLoading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

  const allEscrows = dashData?.escrows ||[];
  const unreadNotifsCount = dashData?.unreadNotifs || 0;

  // Enhance Escrows with UI state
  const processedDeals = allEscrows.map((deal: any) => ({
    ...deal,
    ui: getDealUIState(deal),
    isBuyer: deal.buyerId === dashData?.user?.id
  }));

  // Filtering Logic
  const filteredDeals = processedDeals.filter((deal: any) => {
    const matchesSearch = deal.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeFilter === "All") return matchesSearch;
    return deal.ui.filterTab === activeFilter && matchesSearch;
  });

  // Dynamic Pill Counts
  const counts = {
    all: processedDeals.length,
    active: processedDeals.filter((d: any) => d.ui.filterTab === 'Active').length,
    disputed: processedDeals.filter((d: any) => d.ui.filterTab === 'Disputed').length,
    completed: processedDeals.filter((d: any) => d.ui.filterTab === 'Completed').length,
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* =======================================================
          MAIN SCROLLABLE CONTENT (CARDS)
          ======================================================= */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
        {filteredDeals.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <LayersIcon color="#94A3B8" size={40} />
            </View>
            <Text style={styles.emptyTitle}>No transaction history</Text>
            <Text style={styles.emptyDesc}>
              Your active and completed escrows will appear here. Tap the <Text style={{fontWeight: '800', color: '#0F172A'}}>+</Text> button below to start a secure deal.
            </Text>
          </View>
        ) : (
          filteredDeals.map((deal: any) => {
            const ui = deal.ui;
            const Icon = ui.icon;
            const isRefunded = deal.status === "REFUNDED";

            return (
              <TouchableOpacity 
                key={deal.id} 
                activeOpacity={0.8} 
                style={[styles.dealCard, { borderColor: ui.glow }]}
                onPress={() => router.push(`/escrows/${deal.id}`)}
              >
                
                {/* Top Row: ID & Date */}
                <View style={styles.cardTopRow}>
                  <View style={styles.idBadge}>
                    <Text style={styles.idBadgeText}>#ESC-{deal.id.substring(0,4).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.dateText}>{formatDealDate(deal.createdAt)}</Text>
                </View>

                {/* Middle Row: Details & Amount */}
                <View style={styles.cardMidRow}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.dealTitle} numberOfLines={1}>{deal.description}</Text>
                    <Text style={[styles.roleText, { color: deal.isBuyer ? '#2563EB' : '#DB2777' }]}>
                      You are {deal.isBuyer ? 'Buyer' : 'Seller'}
                    </Text>
                  </View>
                  
                  {/* Amount with conditional Strikethrough for Refunded */}
                  <Text style={[
                    styles.dealAmount, 
                    isRefunded && { textDecorationLine: 'line-through', color: '#94A3B8' }
                  ]}>
                    {formatK(deal.amount)}
                  </Text>
                </View>

                {/* Dashed Divider */}
                <View style={styles.dashedDivider} />

                {/* Bottom Row: Status Pill & Chevron */}
                <View style={styles.cardBottomRow}>
                  <View style={[styles.statusPill, { backgroundColor: ui.bg }]}>
                    <Icon color={ui.color} size={14} strokeWidth={3} />
                    <Text style={[styles.statusPillText, { color: ui.color }]}>{ui.badgeText}</Text>
                  </View>
                  <ChevronRight color="#CBD5E1" size={20} strokeWidth={2.5} />
                </View>

              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  
  // SEARCH BAR
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, paddingHorizontal: 16, height: 52, marginBottom: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '500', color: '#0F172A' },

  // FILTER PILLS
  filterScroll: { gap: 10, paddingBottom: 16 },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1 },
  filterPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A', shadowColor: '#0F172A', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  filterPillInactive: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  filterText: { fontSize: 14, fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  filterTextInactive: { color: '#64748B' },
  filterBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  filterBadgeActive: { backgroundColor: '#2563EB' },     // default blue for All/Active/Completed
  filterBadgeActiveRed: { backgroundColor: '#EF4444' }, // red for Disputed active
  filterBadgeInactive: { backgroundColor: '#F1F5F9' },
  filterBadgeText: { fontSize: 12, fontWeight: '800' },
  filterBadgeTextActive: { color: '#FFFFFF' },
  filterBadgeTextInactive: { color: '#94A3B8' },

  // LIST CONTENT
  listContent: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 140 : 120, paddingTop: 8 },

  // DEAL CARDS
  dealCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1.5, marginBottom: 16, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  idBadge: { backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  idBadgeText: { fontSize: 11, fontWeight: '700', color: '#64748B', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  dateText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  
  cardMidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardInfo: { flex: 1, paddingRight: 16 },
  dealTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  roleText: { fontSize: 13, fontWeight: '700' },
  dealAmount: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },

  dashedDivider: { height: 1, width: '100%', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 1, marginBottom: 16 },

  cardBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  statusPillText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  // EMPTY STATE
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 24, backgroundColor: '#FFFFFF' },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 12 },
  emptyDesc: { fontSize: 15, color: '#64748B', textAlign: 'center', fontWeight: '500', lineHeight: 24, paddingHorizontal: 20 },
});