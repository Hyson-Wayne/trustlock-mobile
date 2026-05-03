import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  ChevronRight,
  Clock,
  History,
  Lock,
  Package,
  Scale,
  ShoppingCart,
  Store,
  Wallet,
  X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

const API_URL = 'http://192.168.43.78:3000/api/mobile/dashboard';
const ACTION_URL = 'http://192.168.43.78:3000/api/mobile/action';
const NOTIFICATIONS_URL = 'http://192.168.43.78:3000/api/mobile/notifications';

export default function MobileHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashData, setDashData] = useState<any>(null);

  // UI States
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedDeal, setSelectedDeal] = useState<any>(null);

  // Notification Center
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const unreadNotifsCount = dashData?.unreadNotifs || 0;

  // Native Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; id: string; type: 'fund' | 'deliver' | 'release' | 'dispute' | null;
    amount: number; description: string; isProcessing: boolean;
  }>({ isOpen: false, id: "", type: null, amount: 0, description: "", isProcessing: false });
  
  const [disputeReason, setDisputeReason] = useState("");

  // --- CUSTOM PREMIUM TOAST STATE ---
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error'}>({show: false, message: '', type: 'success'});
  const toastAnim = React.useRef(new Animated.Value(-150)).current;

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    Animated.spring(toastAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(toastAnim, { toValue: -150, duration: 400, useNativeDriver: true }).start(() => {
        setToast(prev => ({ ...prev, show: false }));
      });
    }, 4000);
  };

  // ======================== DATA FETCHING ========================
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
      console.error("Dashboard Fetch Error:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(NOTIFICATIONS_URL, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        setNotifications(json.data);
        setUnreadCount(json.data.filter((n: any) => !n.read).length);
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Notifications fetch error:", error);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`${NOTIFICATIONS_URL}/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Mark read error:", error);
    }
  };

  useEffect(() => { 
    fetchDashboardData(); 
    fetchNotifications();
  }, []);

  const onRefresh = () => { 
    setIsRefreshing(true); 
    fetchDashboardData();
    fetchNotifications();
  };

  // ======================== HELPERS ========================
  const formatK = (num: number) => {
    if (!num) return '0';
    if (num >= 1000) return (num / 1000).toFixed(num % 1000 !== 0 ? 1 : 0) + 'k';
    return num.toString();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatLogTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Smart UI Parser for Cards (no step text anymore)
  const getDealUIState = (deal: any) => {
    const isBuyer = deal.buyerId === dashData?.user?.id;
    const cpName = isBuyer ? (deal.seller?.fullName?.split(' ')[0] || "User") : (deal.buyer?.fullName?.split(' ')[0] || "User");
    const status = deal.status;

    let state = { 
      text: 'PENDING', isActionReq: false, icon: Package, 
      color: '#D97706', bg: '#FEF3C7', subtext: `Request from: ${cpName}`,
    };

    if (status === "COMPLETED") {
      state = { ...state, text: 'COMPLETED', icon: CheckCircle2, color: '#10B981', bg: '#D1FAE5' };
    } else if (status === "DISPUTED") {
      state = { ...state, text: 'FROZEN', icon: AlertTriangle, color: '#EF4444', bg: '#FEE2E2' };
    } else if (isBuyer) {
      state.subtext = `Paying to: ${cpName}`;
      if (status === 'DRAFT') {
        state = { ...state, text: 'ACTION REQ.', isActionReq: true, icon: AlertTriangle, color: '#EF4444', bg: '#FEE2E2' };
      } else if (status === 'FUNDS_LOCKED') {
        // No step
      } else if (status === 'DELIVERED') {
        state = { ...state, text: 'ACTION REQ.', isActionReq: true, icon: AlertTriangle, color: '#EF4444', bg: '#FEE2E2' };
      }
    } else { // SELLER
      state.subtext = `Request from: ${cpName}`;
      if (status === 'FUNDS_LOCKED') {
        state = { ...state, text: 'ACTION REQ.', isActionReq: true, icon: AlertTriangle, color: '#EF4444', bg: '#FEE2E2' };
      } else if (status === 'DELIVERED') {
        // No step
      }
    }
    return state;
  };

  // Action Handlers
  const promptAction = (id: string, type: 'fund' | 'deliver' | 'release' | 'dispute', amount: number, description: string) => {
    setSelectedDeal(null);
    setTimeout(() => {
      setDisputeReason("");
      setConfirmModal({ isOpen: true, id, type, amount, description, isProcessing: false });
    }, 300);
  };

  const handleConfirmedAction = async () => {
    if (confirmModal.type === 'dispute' && !disputeReason.trim()) {
      alert("Please provide a reason for the dispute."); return;
    }
    setConfirmModal(prev => ({ ...prev, isProcessing: true }));
    const { data: { session } } = await supabase.auth.getSession();
    
    try {
      const res = await fetch(ACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ 
          escrowId: confirmModal.id, 
          actionType: confirmModal.type,
          reason: disputeReason 
        })
      });
      const json = await res.json();

      if (json.success) {
        let msg = "Action completed successfully.";
        if (confirmModal.type === 'fund') msg = "Escrow funded securely!";
        if (confirmModal.type === 'deliver') msg = "Delivery confirmed!";
        if (confirmModal.type === 'release') msg = "Funds released successfully!";
        if (confirmModal.type === 'dispute') msg = "Dispute opened and funds frozen.";
        
        triggerToast(msg, 'success');
        await fetchDashboardData();
        await fetchNotifications();
        setConfirmModal({ isOpen: false, id: "", type: null, amount: 0, description: "", isProcessing: false });
      } else {
        triggerToast(json.error || "Failed to process transaction.", 'error');
        setConfirmModal(prev => ({ ...prev, isProcessing: false }));
      }
    } catch (e) {
      triggerToast("Network error. Please check your connection.", 'error');
      setConfirmModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const firstName = dashData?.user?.fullName?.split(' ')[0] || "User";
  const userInitials = firstName.charAt(0).toUpperCase();
  const completedCount = dashData?.escrows?.filter((e: any) => e.status === 'COMPLETED').length || 0;

  const activeEscrows = dashData?.escrows?.filter((e: any) => e.status !== 'COMPLETED' && e.status !== 'REFUNDED') || [];
  const disputedCount = dashData?.escrows?.filter((e: any) => e.status === 'DISPUTED').length || 0;
  const pendingActionCount = activeEscrows.filter((e: any) => getDealUIState(e).isActionReq).length;

  const filteredEscrows = activeEscrows.filter((e: any) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Action Req.') return getDealUIState(e).isActionReq;
    if (activeFilter === 'Pending') return !getDealUIState(e).isActionReq;
    return true;
  });

  const bottomBarBottom = Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : Math.max(insets.bottom, 24);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* =======================================================
          PREMIUM FLOATING TOAST NOTIFICATION
          ======================================================= */}
      {toast.show && (
        <Animated.View style={[
          styles.toastContainer, 
          { 
            transform: [{ translateY: toastAnim }], 
            backgroundColor: toast.type === 'success' ? '#0F172A' : '#EF4444',
            shadowColor: toast.type === 'success' ? '#0F172A' : '#EF4444' 
          }
        ]}>
          {toast.type === 'success' ? (
            <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: 6, borderRadius: 12 }}>
              <CheckCircle2 color="#10B981" size={24} />
            </View>
          ) : (
            <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: 6, borderRadius: 12 }}>
              <AlertTriangle color="#FFFFFF" size={24} />
            </View>
          )}
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}

      {/* ==================== BOTTOM SHEET (DEAL DETAILS) ==================== */}
      <Modal visible={!!selectedDeal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setSelectedDeal(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            {selectedDeal && (() => {
              const isBuyer = selectedDeal.buyerId === dashData?.user?.id;
              const status = selectedDeal.status;
              
              // --- FULL LIFECYCLE TIMELINE ENGINE ---
              const isDraft = status === 'DRAFT';
              const isLocked = status === 'FUNDS_LOCKED';
              const isDelivered = status === 'DELIVERED';
              const isCompleted = status === 'COMPLETED';
              const isDisputed = status === 'DISPUTED';
              const isRefunded = status === 'REFUNDED';

              const step2Done = !isDraft; 
              const step3Done = isDelivered || isCompleted; 
              const step4Done = isCompleted || isRefunded;

              const nodes =[
                { 
                  id: 1, 
                  title: 'Created', 
                  time: formatLogTime(selectedDeal.createdAt), 
                  isCompleted: true, 
                  isActionReq: false, 
                  isFuture: false, 
                  icon: CheckCircle2 
                },
                { 
                  id: 2, 
                  title: step2Done ? 'Funded' : (isBuyer ? 'Action Required: Fund' : 'Awaiting Funds'), 
                  subText: step2Done ? undefined : (isBuyer ? 'Please fund the escrow to secure your transaction.' : 'Waiting for buyer to fund the escrow.'), 
                  time: step2Done ? formatLogTime(selectedDeal.updatedAt) : undefined, 
                  isCompleted: step2Done, 
                  isActionReq: isDraft && isBuyer, 
                  isFuture: false, 
                  icon: step2Done ? CheckCircle2 : (isDraft && isBuyer ? AlertTriangle : Clock) 
                },
                { 
                  id: 3, 
                  title: step3Done ? 'Seller Delivered' : (isLocked ? (!isBuyer ? 'Action Required: Deliver' : 'Awaiting Delivery') : 'Delivery Phase'), 
                  subText: step3Done ? undefined : (isLocked ? (!isBuyer ? 'Buyer locked the funds. Please deliver the item.' : 'Waiting for seller to deliver the item.') : undefined), 
                  time: step3Done ? formatLogTime(selectedDeal.updatedAt) : undefined, 
                  isCompleted: step3Done, 
                  isActionReq: isLocked && !isBuyer && !isDisputed, 
                  isFuture: isDraft, 
                  icon: step3Done ? CheckCircle2 : (isLocked && !isBuyer && !isDisputed ? Box : Clock) 
                },
                { 
                  id: 4, 
                  title: step4Done ? (isCompleted ? 'Funds Released' : 'Funds Refunded') : (isDelivered ? (isBuyer ? 'Action Required: Approve' : 'Awaiting Approval') : 'Release Funds'), 
                  subText: step4Done ? undefined : (isDelivered ? (isBuyer ? 'Seller claims item is delivered. Please inspect and release funds.' : 'Waiting for buyer to release funds.') : undefined), 
                  time: step4Done ? formatLogTime(selectedDeal.updatedAt) : undefined, 
                  isCompleted: step4Done, 
                  isActionReq: isDelivered && isBuyer && !isDisputed, 
                  isFuture: isDraft || isLocked, 
                  icon: step4Done ? CheckCircle2 : (isDelivered && isBuyer && !isDisputed ? AlertTriangle : Lock) 
                }
              ];

              // Inject a 5th Urgent Node if the transaction is disputed
              if (isDisputed) {
                nodes.push({
                  id: 5,
                  title: 'Disputed & Frozen',
                  subText: 'This transaction is under official mediation. Funds are frozen until resolved.',
                  time: formatLogTime(selectedDeal.updatedAt),
                  isCompleted: false,
                  isActionReq: true,
                  isFuture: false,
                  icon: AlertTriangle
                });
              }

              return (
                <View style={{ width: '100%' }}>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetIdBadge}>#ESC-{selectedDeal.id.substring(0,8).toUpperCase()}</Text>
                    <Text style={styles.sheetTitle}>{selectedDeal.description}</Text>
                    <Text style={styles.sheetAmount}>{selectedDeal.amount.toLocaleString()} XAF</Text>
                  </View>

                  {/* Vertical Timeline */}
                  <View style={styles.timelineContainer}>
                    {nodes.map((node, i) => {
                      const isLast = i === nodes.length - 1;
                      const NodeIcon = node.icon;
                      
                      // Premium Color Engine
                      const iconColor = node.isCompleted ? '#10B981' : node.isActionReq ? '#EF4444' : (node.isFuture ? '#CBD5E1' : '#94A3B8');
                      const bgColor = node.isCompleted ? '#ECFDF5' : node.isActionReq ? '#FEF2F2' : (node.isFuture ? '#F8FAFC' : '#F1F5F9');
                      const textColor = node.isCompleted ? '#0F172A' : node.isActionReq ? '#EF4444' : (node.isFuture ? '#94A3B8' : '#334155');
                      const lineColor = node.isCompleted ? '#10B981' : '#E2E8F0';

                      return (
                        <View key={node.id} style={styles.timelineRow}>
                          <View style={styles.timelineIconCol}>
                            <View style={[styles.timelineNodeBox, { backgroundColor: bgColor }]}>
                              {NodeIcon && <NodeIcon color={iconColor} size={18} strokeWidth={3} />}
                            </View>
                            {!isLast && <View style={[styles.timelineLine, { backgroundColor: lineColor }]} />}
                          </View>
                          
                          <View style={styles.timelineTextCol}>
                            <Text style={[styles.timelineTitle, { color: textColor }]}>{node.title}</Text>
                            {node.time && <Text style={styles.timelineTime}>{node.time}</Text>}
                            {node.subText && <Text style={[styles.timelineSubText, node.isFuture && { color: '#94A3B8' }]}>{node.subText}</Text>}
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.sheetActions}>
                    {isBuyer && status === 'DRAFT' && (
                      <TouchableOpacity style={styles.primaryBtnBlue} onPress={() => promptAction(selectedDeal.id, 'fund', selectedDeal.amount, selectedDeal.description)}>
                        <Lock color="#FFF" size={20} /><Text style={styles.primaryBtnText}>Fund Escrow to Vault</Text>
                      </TouchableOpacity>
                    )}
                    {!isBuyer && status === 'FUNDS_LOCKED' && (
                      <TouchableOpacity style={styles.primaryBtnBlack} onPress={() => promptAction(selectedDeal.id, 'deliver', selectedDeal.amount, selectedDeal.description)}>
                        <Box color="#FFF" size={20} /><Text style={styles.primaryBtnText}>Confirm Delivery</Text>
                      </TouchableOpacity>
                    )}
                    {isBuyer && status === 'DELIVERED' && (
                      <>
                        <TouchableOpacity style={styles.primaryBtnBlue} onPress={() => promptAction(selectedDeal.id, 'release', selectedDeal.amount, selectedDeal.description)}>
                          <Lock color="#FFF" size={20} /><Text style={styles.primaryBtnText}>Release Funds to Seller</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryBtnRed} onPress={() => promptAction(selectedDeal.id, 'dispute', selectedDeal.amount, selectedDeal.description)}>
                          <AlertTriangle color="#EF4444" size={20} /><Text style={styles.secondaryBtnTextRed}>Report an Issue</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ==================== CONFIRMATION MODAL ==================== */}
      <Modal visible={confirmModal.isOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.actionModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {confirmModal.type === 'fund' && "Authorize Payment"}
                {confirmModal.type === 'deliver' && "Confirm Delivery"}
                {confirmModal.type === 'release' && "Release Funds"}
                {confirmModal.type === 'dispute' && "File a Dispute"}
              </Text>
              <TouchableOpacity onPress={() => setConfirmModal(prev => ({...prev, isOpen: false}))} disabled={confirmModal.isProcessing} style={styles.modalCloseBtn}>
                <X color="#64748B" size={20} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              <View style={[styles.modalIconBox, { backgroundColor: confirmModal.type === 'dispute' ? '#FEE2E2' : confirmModal.type === 'fund' ? '#DBEAFE' : confirmModal.type === 'deliver' ? '#FFEDD5' : '#D1FAE5' }]}>
                {confirmModal.type === 'fund' && <Lock color="#2563EB" size={28} />}
                {confirmModal.type === 'deliver' && <Box color="#F97316" size={28} />}
                {confirmModal.type === 'release' && <CheckCircle2 color="#10B981" size={28} />}
                {confirmModal.type === 'dispute' && <AlertTriangle color="#EF4444" size={28} />}
              </View>
              <Text style={styles.modalDescTitle}>{confirmModal.description}</Text>
              
              {confirmModal.type === 'dispute' ? (
                <View style={{width: '100%', marginTop: 12}}>
                  <Text style={{fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 8}}>Reason for dispute:</Text>
                  <Text style={{fontSize: 12, fontWeight: '500', color: '#EF4444', marginBottom: 8, textAlign: 'center'}}>Funds will be frozen instantly upon submission.</Text>
                  <TextInput 
                    style={styles.modalInput}
                    placeholder="E.g. The item arrived damaged..."
                    placeholderTextColor="#94A3B8"
                    value={disputeReason}
                    onChangeText={setDisputeReason}
                    multiline
                    maxLength={150}
                  />
                </View>
              ) : (
                <Text style={styles.modalDescText}>
                  {confirmModal.type === 'fund' && `Authorize a MoMo push to securely lock ${confirmModal.amount.toLocaleString()} XAF.`}
                  {confirmModal.type === 'deliver' && "You confirm that you have physically shipped or delivered this item/service."}
                  {confirmModal.type === 'release' && `Permanently release ${confirmModal.amount.toLocaleString()} XAF to the seller. This cannot be undone.`}
                </Text>
              )}
            </View>

            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={handleConfirmedAction} 
              disabled={confirmModal.isProcessing || (confirmModal.type === 'dispute' && !disputeReason.trim())} 
              style={[styles.modalActionBtn, { backgroundColor: confirmModal.type === 'dispute' ? '#EF4444' : confirmModal.type === 'fund' ? '#2563EB' : confirmModal.type === 'deliver' ? '#0F172A' : '#10B981' }]}
            >
              {confirmModal.isProcessing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalActionBtnText}>{confirmModal.type === 'dispute' ? 'Freeze & Open Case' : 'Confirm Action'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================== MAIN SCROLLVIEW ==================== */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
        <LinearGradient colors={['#1E3A8A', '#312E81']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <Text style={styles.walletTitle}>WALLET BALANCE</Text>
            <View style={styles.walletIconBox}><Wallet color="#FFFFFF" size={18} /></View>
          </View>
          <View style={styles.balanceContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={styles.balanceAmount}>{formatK(dashData?.walletBalance)}</Text>
              <Text style={styles.balanceCurrency}>XAF</Text>
            </View>
            {dashData?.walletBalance > 0 && (
              <TouchableOpacity style={styles.withdrawShortcut} onPress={() => router.push('/wallet')} activeOpacity={0.8}>
                <Text style={styles.withdrawText}>Withdraw</Text>
                <ArrowRight color="#FFFFFF" size={14} strokeWidth={3} />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* --- DYNAMIC DISPUTE ALERT BANNER --- */}
        {disputedCount > 0 && (
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={() => router.push('/disputes')}
            style={styles.disputeAlertBanner}
          >
            <View style={styles.disputeAlertIcon}>
              <AlertTriangle color="#EF4444" size={20} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.disputeAlertTitle}>Action Required</Text>
              <Text style={styles.disputeAlertDesc}>You have {disputedCount} active dispute{disputedCount > 1 ? 's' : ''} requiring mediation.</Text>
            </View>
            <ChevronRight color="#EF4444" size={20} />
          </TouchableOpacity>
        )}

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricTitle}>LOCKED</Text>
            <Text style={styles.metricValueBlue}>{formatK(dashData?.lockedValue)} <Text style={styles.metricSub}>XAF</Text></Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricTitle}>COMPLETED</Text>
            <Text style={styles.metricValueGreen}>{completedCount} <Text style={styles.metricSub}>Deals</Text></Text>
          </View>
        </View>

        {/* QUICK ACTIONS */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickActionItem} onPress={() => router.push({ pathname: '/create', params: { initialRole: 'buyer' } })}>
            <View style={[styles.qaIconBox, { backgroundColor: '#EFF6FF' }]}><ShoppingCart color="#2563EB" size={24} /></View>
            <Text style={styles.qaText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionItem} onPress={() => router.push({ pathname: '/create', params: { initialRole: 'seller' } })}>
            <View style={[styles.qaIconBox, { backgroundColor: '#FDF2F8' }]}><Store color="#DB2777" size={24} /></View>
            <Text style={styles.qaText}>Sell</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionItem} onPress={() => router.push('/escrows')}>
            <View style={[styles.qaIconBox, { backgroundColor: '#ECFDF5' }]}><History color="#10B981" size={24} /></View>
            <Text style={styles.qaText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionItem} onPress={() => router.push('/disputes')}>
            <View style={[
              styles.qaIconBox, 
              { 
                backgroundColor: disputedCount > 0 ? '#FEF2F2' : '#FFFBEB',
                borderColor: disputedCount > 0 ? '#FECACA' : '#F8FAFC'
              }
            ]}>
              <Scale color={disputedCount > 0 ? '#EF4444' : '#F59E0B'} size={24} />
              
              {/* Glowing Red Number Badge */}
              {disputedCount > 0 && (
                <View style={styles.qaBadge}>
                  <Text style={styles.qaBadgeText}>{disputedCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.qaText}>Disputes</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionEmoji}>⚡</Text>
            <Text style={styles.sectionTitle}>Active Deals</Text>
            {activeEscrows.length > 0 && (
              <View style={styles.countBadge}><Text style={styles.countText}>{activeEscrows.length}</Text></View>
            )}
          </View>
          <TouchableOpacity style={styles.viewAllBtn} onPress={() => router.push('/escrows')} activeOpacity={0.7}>
            <Text style={styles.viewAllText}>View all</Text>
            <ArrowRight color="#2563EB" size={16} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {activeEscrows.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {['All', 'Action Req.', 'Pending'].map(tab => (
              <TouchableOpacity key={tab} onPress={() => setActiveFilter(tab)} style={[styles.filterPill, activeFilter === tab ? styles.filterPillActive : styles.filterPillInactive]}>
                <Text style={[styles.filterText, activeFilter === tab ? styles.filterTextActive : styles.filterTextInactive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ACTIVE DEALS LIST - NO STEP BADGE, NEW GLASS VIEW DETAILS BUTTON */}
        {activeEscrows.length === 0 ? (
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push({ pathname: '/create' })} style={styles.emptyState}>
            <View style={styles.emptyIconBox}><Package color="#CBD5E1" size={36} /></View>
            <Text style={styles.emptyTitle}>No Active Transactions</Text>
            <Text style={styles.emptyDesc}>Tap the <Text style={{ fontWeight: '900', color: '#0F172A' }}>+</Text> button below to buy or sell safely.</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.dealsList}>
            {filteredEscrows.map((deal: any) => {
              const ui = getDealUIState(deal);
              const Icon = ui.icon;

              return (
                <TouchableOpacity 
                  key={deal.id} 
                  activeOpacity={0.8} 
                  style={[styles.dealCard, ui.isActionReq && styles.dealCardRed]} 
                  onPress={() => setSelectedDeal(deal)}
                >
                  <View style={styles.dealCardHeader}>
                    <View style={styles.dealCardInfo}>
                      <Text style={styles.dealTitle} numberOfLines={1}>{deal.description}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <Text style={styles.dealSubtext} numberOfLines={1}>{ui.subtext}</Text>
                      </View>
                    </View>
                    <Text style={styles.dealAmount}>{formatK(deal.amount)} XAF</Text>
                  </View>

                  <View style={styles.dealBottomRow}>
                    <View style={[styles.statusPill, { backgroundColor: ui.bg }]}>
                      <Icon color={ui.color} size={12} strokeWidth={3} />
                      <Text style={[styles.statusPillText, { color: ui.color }]}>{ui.text}</Text>
                    </View>
                    
                    {/* Glassmorphism "View Details" button */}
                    <View style={styles.glassDetailsButton}>
                      <Text style={styles.glassDetailsText}>View Details</Text>
                      <ArrowRight color="#2563EB" size={14} strokeWidth={3} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  scrollContent: { paddingHorizontal: 24 },

  // Wallet Card
  walletCard: { borderRadius: 24, padding: 24, marginTop: 10, shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10, overflow: 'hidden' },
  walletHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  walletTitle: { color: '#93C5FD', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  walletIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  balanceContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceAmount: { fontSize: 44, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
  balanceCurrency: { fontSize: 16, fontWeight: '700', color: '#93C5FD' },
  withdrawShortcut: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  withdrawText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  // Metrics Row
  metricsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 1 },
  metricTitle: { fontSize: 11, color: '#0F172A', fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  metricValueBlue: { fontSize: 24, fontWeight: '900', color: '#2563EB' },
  metricValueGreen: { fontSize: 24, fontWeight: '900', color: '#10B981' },
  metricSub: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },

  // Quick Actions
  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  quickActionItem: { alignItems: 'center', gap: 8 },
  qaIconBox: { width: 64, height: 64, backgroundColor: '#FFFFFF', borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#F8FAFC' },
  qaText: { fontSize: 13, fontWeight: '800', color: '#0F172A' },

  // Section Header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 36, marginBottom: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  countBadge: { backgroundColor: '#0F172A', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 14, fontWeight: '800', color: '#2563EB' },

  filterScroll: { gap: 8, marginBottom: 16 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterPillInactive: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  filterText: { fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  filterTextInactive: { color: '#64748B' },

  // Deals List
  dealsList: { gap: 12 },
  dealCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  dealCardRed: { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' },
  dealCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  dealCardInfo: { flex: 1, paddingRight: 16 },
  dealTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  dealSubtext: { fontSize: 13, color: '#64748B', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  dealAmount: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  dealBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  // New Glassmorphism "View Details" button
  glassDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',  // light blue glass
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backdropFilter: Platform.OS === 'ios' ? 'blur(4px)' : undefined,
  },
  glassDetailsText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },

  emptyState: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', borderStyle: 'dashed', marginTop: 8 },
  emptyIconBox: { width: 64, height: 64, backgroundColor: '#F8FAFC', borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', fontWeight: '500', lineHeight: 22 },

  // Bottom Sheet
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20, minHeight: '60%' },
  sheetHandle: { width: 48, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetHeader: { alignItems: 'center', marginBottom: 32 },
  sheetIdBadge: { backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, fontSize: 10, fontWeight: '800', color: '#94A3B8', marginBottom: 12 },
  sheetTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 8 },
  sheetAmount: { fontSize: 28, fontWeight: '900', color: '#2563EB', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  timelineContainer: { paddingLeft: 16, marginBottom: 32 },
  timelineRow: { flexDirection: 'row', minHeight: 64 },
  timelineIconCol: { alignItems: 'center', width: 32, marginRight: 16 },
  timelineNodeBox: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  timelineLine: { width: 2, flex: 1, marginVertical: 4 },
  timelineTextCol: { flex: 1, paddingBottom: 24 },
  timelineTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  timelineTime: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  timelineSubText: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },

  sheetActions: { gap: 12, marginTop: 'auto' },
  primaryBtnBlue: { backgroundColor: '#2563EB', paddingVertical: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  primaryBtnBlack: { backgroundColor: '#0F172A', paddingVertical: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryBtnRed: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#FECACA', paddingVertical: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  secondaryBtnTextRed: { color: '#EF4444', fontSize: 16, fontWeight: '800' },

  // Confirmation Modal
  actionModalCard: { backgroundColor: '#FFFFFF', width: '100%', borderRadius: 32, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 15 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  modalCloseBtn: { width: 36, height: 36, backgroundColor: '#F1F5F9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalBody: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#F1F5F9' },
  modalIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalDescTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  modalDescText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  modalInput: { width: '100%', marginTop: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, height: 100, textAlignVertical: 'top', fontSize: 14, color: '#0F172A' },
  modalActionBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  modalActionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // --- Dynamic Dispute Alert Banner ---
  disputeAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    gap: 12,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  disputeAlertIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disputeAlertTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#991B1B',
    marginBottom: 2,
  },
  disputeAlertDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
  },

  // --- Quick Action Red Badge ---
  qaBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingHorizontal: 4,
    shadowColor: '#EF4444',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  qaBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900'
  },

  toastContainer: {
    position: 'absolute', top: Platform.OS === 'ios' ? 55 : 35, left: 20, right: 20, zIndex: 999, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15, gap: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  toastText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', flex: 1, lineHeight: 20, letterSpacing: 0.2 },
});