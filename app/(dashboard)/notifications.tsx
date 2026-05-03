import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  AlertTriangle,
  ArrowLeft, Bell,
  CheckCheck,
  CheckCircle2,
  Shield,
  Wallet
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';

// 👉 REPLACE WITH YOUR COMPUTER'S LOCAL IP
const API_URL = 'http://192.168.43.78:3000/api/mobile/notifications'; 

export default function NotificationsScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const[isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const[activeFilter, setActiveFilter] = useState("All");

  // --- LIVE FETCH ENGINE ---
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    },[])
  );

  const fetchNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.replace('/auth'); return; }

      const response = await fetch(API_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      });
      const json = await response.json();
      if (json.success) setNotifications(json.notifications ||[]);
    } catch (error) {
      console.error("Notif Fetch Error:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => { setIsRefreshing(true); fetchNotifications(); };

  // --- ACTIONS ---
  const handleMarkAllAsRead = async () => {
    setIsMarkingRead(true);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))); // Optimistic UI
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ markAll: true })
      });
    } catch (e) {
      console.error(e);
    }
    setIsMarkingRead(false);
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      const { data: { session } } = await supabase.auth.getSession();
      fetch(API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ notificationId: notif.id })
      }).catch(e => console.error(e));
    }

    if (notif.link) {
      const mobileRoute = notif.link.replace('/dashboard', '');
      router.push(mobileRoute as any);
    }
  };

  // --- FORMATTERS & STYLES ---
  const formatNotifTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getIconStyles = (type: string) => {
    switch(type) {
      case 'wallet': return { Icon: Wallet, color: '#2563EB', bg: '#DBEAFE' };
      case 'security': return { Icon: Shield, color: '#475569', bg: '#F1F5F9' };
      case 'success': return { Icon: CheckCircle2, color: '#10B981', bg: '#D1FAE5' };
      case 'action': return { Icon: AlertTriangle, color: '#EF4444', bg: '#FEE2E2' };
      case 'info': 
      default: return { Icon: Bell, color: '#F59E0B', bg: '#FEF3C7' };
    }
  };

  // --- FILTERING & DATA GROUPING ENGINE ---
  const filteredNotifications = notifications.filter(notif => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Unread") return !notif.isRead;
    if (activeFilter === "Action Required") return notif.type === "action";
    if (activeFilter === "Security") return notif.type === "security";
    return true;
  });

  // Automatically group notifications by exact date
  const groupedNotifications = filteredNotifications.reduce((groups: any, notif: any) => {
    const date = new Date(notif.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (date.toDateString() === today.toDateString()) key = 'TODAY';
    else if (date.toDateString() === yesterday.toDateString()) key = 'YESTERDAY';
    else key = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    
    if (!groups[key]) groups[key] =[];
    groups[key].push(notif);
    return groups;
  }, {});

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* --- HEADER --- */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color="#0F172A" size={24} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleMarkAllAsRead} 
            disabled={unreadCount === 0 || isMarkingRead}
            style={[styles.markAllBtn, unreadCount === 0 && styles.markAllBtnDisabled]}
          >
            {isMarkingRead ? <ActivityIndicator size="small" color="#2563EB" /> : <CheckCheck color={unreadCount === 0 ? "#94A3B8" : "#2563EB"} size={16} />}
            <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllTextDisabled]}>Mark all read</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>Stay on top of your transactions and security.</Text>

        {/* FILTERS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {["All", "Unread", "Action Required", "Security"].map(tab => (
            <TouchableOpacity 
              key={tab} 
              onPress={() => setActiveFilter(tab)}
              style={[styles.filterPill, activeFilter === tab ? styles.filterPillActive : styles.filterPillInactive]}
            >
              <Text style={[styles.filterText, activeFilter === tab ? styles.filterTextActive : styles.filterTextInactive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* --- NOTIFICATIONS GROUPED LIST --- */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
        {Object.keys(groupedNotifications).length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}><Bell color="#CBD5E1" size={32} /></View>
            <Text style={styles.emptyTitle}>You're all caught up!</Text>
            <Text style={styles.emptyDesc}>You have no notifications matching this filter.</Text>
          </View>
        ) : (
          Object.keys(groupedNotifications).map((groupDate) => (
            <View key={groupDate} style={styles.groupContainer}>
              
              {/* GROUP SECTION HEADER */}
              <View style={styles.groupHeaderRow}>
                <Text style={styles.groupHeaderText}>{groupDate}</Text>
                <View style={styles.groupHeaderLine} />
              </View>

              {/* NOTIFICATION CARDS IN THIS GROUP */}
              {groupedNotifications[groupDate].map((notif: any) => {
                const { Icon, color, bg } = getIconStyles(notif.type);
                const isUnread = !notif.isRead;

                return (
                  <TouchableOpacity 
                    key={notif.id} 
                    activeOpacity={0.7}
                    onPress={() => handleNotificationClick(notif)}
                    style={[styles.notifCard, isUnread ? styles.notifCardUnread : styles.notifCardRead]}
                  >
                    {/* Unread Left Border Accent */}
                    {notif.type === 'action' && isUnread && <View style={styles.actionBorder} />}
                    {/* Unread Blue Dot */}
                    {isUnread && <View style={styles.unreadDot} />}

                    <View style={[styles.iconBox, { backgroundColor: bg }]}>
                      <Icon color={color} size={20} />
                    </View>

                    <View style={styles.contentBox}>
                      <View style={styles.cardHeader}>
                        <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]} numberOfLines={1}>
                          {notif.title}
                        </Text>
                        <Text style={styles.timeText}>{formatNotifTime(notif.createdAt)}</Text>
                      </View>
                      <Text style={[styles.cardMessage, isUnread && styles.cardMessageUnread]} numberOfLines={2}>
                        {notif.message}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  
  header: { backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  markAllBtnDisabled: { backgroundColor: '#F8FAFC' },
  markAllText: { fontSize: 12, fontWeight: '800', color: '#2563EB' },
  markAllTextDisabled: { color: '#94A3B8' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  counterBadge: { backgroundColor: '#EF4444', minWidth: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  counterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  subtitle: { fontSize: 14, color: '#64748B', fontWeight: '500', marginBottom: 20 },

  filterScroll: { gap: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterPillInactive: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  filterText: { fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  filterTextInactive: { color: '#64748B' },

  listContent: { padding: 24, paddingBottom: 60 },
  
  // Group Header Styles
  groupContainer: { marginBottom: 24 },
  groupHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  groupHeaderText: { fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 },
  groupHeaderLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  
  // Card Styles
  notifCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, alignItems: 'flex-start', overflow: 'hidden', marginBottom: 12 },
  notifCardUnread: { borderColor: '#DBEAFE', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  notifCardRead: { borderColor: '#F1F5F9', opacity: 0.75 },
  
  actionBorder: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#EF4444' },
  unreadDot: { position: 'absolute', top: 16, right: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },

  iconBox: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  contentBox: { flex: 1, paddingRight: 8 }, 
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#334155', flex: 1, paddingRight: 10 },
  cardTitleUnread: { fontWeight: '800', color: '#0F172A' },
  
  timeText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  cardMessage: { fontSize: 13, color: '#64748B', lineHeight: 20 },
  cardMessageUnread: { color: '#475569', fontWeight: '500' },

  // Empty State
  emptyState: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', borderStyle: 'dashed', marginTop: 24 },
  emptyIconBox: { width: 64, height: 64, backgroundColor: '#F8FAFC', borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', fontWeight: '500', lineHeight: 22 },
});