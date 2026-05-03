import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication'; // 👉 NATIVE BIOMETRICS
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    AlertTriangle,
    ArrowDownLeft,
    ArrowUp,
    CheckCircle2,
    Plus,
    Receipt,
    Wifi,
    X
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
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
import { supabase } from '../../lib/supabase';

// 👉 REPLACE WITH YOUR COMPUTER'S LOCAL IP
const DASHBOARD_URL = 'http://192.168.43.78:3000/api/mobile/dashboard'; 
const WITHDRAW_URL = 'http://192.168.43.78:3000/api/mobile/wallet/withdraw'; 

export default function WalletScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const[dashData, setDashData] = useState<any>(null);

  // --- WITHDRAWAL STATE ---
  const[isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // --- TOAST NOTIFICATION ---
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error'}>({show: false, message: '', type: 'success'});
  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  const fetchDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.replace('/auth'); return; }
      
      const response = await fetch(DASHBOARD_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      });
      const json = await response.json();
      if (json.success) setDashData(json.data);
    } catch (error) {
      console.error("Wallet Fetch Error:", error);
    } finally {
      setIsLoading(false); setIsRefreshing(false);
    }
  };

  useFocusEffect(React.useCallback(() => { fetchDashboardData(); },[]));
  const onRefresh = () => { setIsRefreshing(true); fetchDashboardData(); };

  // --- FORMATTERS ---
  const formatNumber = (val: string) => {
    const cleaned = val.replace(/\D/g, '');
    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleAmountChange = (text: string) => {
    setWithdrawAmount(formatNumber(text));
  };

  // --- BIOMETRICS & WITHDRAWAL ENGINE ---
  const handleWithdrawal = async () => {
    const numAmount = parseInt(withdrawAmount.replace(/,/g, '')) || 0;
    const currentBalance = dashData?.walletBalance || 0;

    if (numAmount <= 0) return triggerToast("Enter a valid amount.", "error");
    if (numAmount > currentBalance) return triggerToast("Insufficient funds.", "error");

    // 1. TRIGGER HARDWARE BIOMETRICS (Face ID / Fingerprint / Device Passcode)
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (hasHardware && isEnrolled) {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: `Authenticate to withdraw ${withdrawAmount} XAF`,
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (!authResult.success) {
        return; // User canceled or failed biometrics
      }
    }

    // 2. EXECUTE API CALL
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(WITHDRAW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ amount: numAmount, destination: 'MTN MoMo (Primary)' })
      });
      
      const json = await res.json();

      if (json.success) {
        triggerToast("Withdrawal processed successfully!");
        setIsWithdrawModalOpen(false);
        setWithdrawAmount("");
        await fetchDashboardData(); // Refresh UI Balance instantly
      } else {
        triggerToast(json.error || "Withdrawal failed.", "error");
      }
    } catch (e) {
      triggerToast("Network error.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

  const unreadNotifsCount = dashData?.unreadNotifs || 0;
  const balance = dashData?.walletBalance || 0;
  const hasFunds = balance > 0;

  // Parse Logs for Wallet view (Only Payouts, Refunds, and Withdrawals)
  const walletLogs = (dashData?.logs ||[]).filter((log: any) => 
    log.action === 'PAYOUT_RECEIVED' || 
    log.action === 'REFUND_RECEIVED' || 
    log.action === 'WITHDRAWAL'
  );

  const userPhone = dashData?.user?.phoneNumber || "6XXXXXXXX";
  const maskedPhone = `+237 ${userPhone.substring(0,3)} ••• ${userPhone.substring(userPhone.length - 3)}`;
  
  // Telecom Detector
  const prefix = userPhone.substring(0, 2);
  const prefix3 = userPhone.substring(0, 3);
  let network = 'MTN';
  if (['69'].includes(prefix) ||['655','656','657','658','659'].includes(prefix3)) network = 'OM';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* TOAST NOTIFICATION */}
      {toast.show && (
        <View style={[styles.toastContainer, { backgroundColor: toast.type === 'success' ? '#0F172A' : '#EF4444' }]}>
          {toast.type === 'success' ? <CheckCircle2 color="#10B981" size={20} /> : <AlertTriangle color="#FFFFFF" size={20} />}
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      {/* WITHDRAWAL BOTTOM SHEET MODAL */}
      <Modal visible={isWithdrawModalOpen} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBackdropTouch} onPress={() => !isProcessing && setIsWithdrawModalOpen(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.bottomSheet}>
              
              <View style={styles.sheetHandle} />
              
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Withdraw Funds</Text>
                <TouchableOpacity onPress={() => setIsWithdrawModalOpen(false)} style={styles.closeBtn}>
                  <X color="#64748B" size={18} />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>ENTER AMOUNT (XAF)</Text>
                <TextInput 
                  style={styles.amountInput}
                  value={withdrawAmount}
                  onChangeText={handleAmountChange}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  autoFocus
                />
                <Text style={styles.availableText}>Available: {balance.toLocaleString()} XAF</Text>
              </View>

              <View style={styles.dashedDivider} />

              <Text style={styles.transferLabel}>Transfer to</Text>
              <View style={styles.linkedAccountCardActive}>
                <View style={[styles.networkBadge, { backgroundColor: network === 'OM' ? '#F97316' : '#FFCC00' }]}>
                  <Text style={[styles.networkBadgeText, { color: network === 'OM' ? '#FFF' : '#000' }]}>{network}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.accountName}>{network === 'OM' ? 'Orange Money' : 'MTN MoMo'} (Primary)</Text>
                  <Text style={styles.accountPhone}>{maskedPhone}</Text>
                </View>
                <CheckCircle2 color="#2563EB" size={24} fill="#2563EB" />
              </View>

              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleWithdrawal}
                disabled={isProcessing || !withdrawAmount}
                style={[styles.confirmBtn, (!withdrawAmount || isProcessing) && styles.confirmBtnDisabled]}
              >
                {isProcessing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmBtnText}>Confirm Withdrawal</Text>}
              </TouchableOpacity>

            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
        
        {/* WALLET CARD (Dynamic Gradient/Disabled State) */}
        {hasFunds ? (
          <LinearGradient colors={['#1E3A8A', '#312E81']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mainWalletCard}>
            <View style={styles.walletCardHeader}>
              <Text style={styles.walletCardLabel}>AVAILABLE BALANCE</Text>
              <Wifi color="#93C5FD" size={20} style={{ transform:[{ rotate: '90deg' }] }} />
            </View>
            <View style={styles.walletBalanceRow}>
              <Text style={styles.walletAmount}>{balance.toLocaleString()}</Text>
              <Text style={styles.walletCurrency}>XAF</Text>
            </View>
            <TouchableOpacity style={styles.withdrawBtnWhite} activeOpacity={0.9} onPress={() => setIsWithdrawModalOpen(true)}>
              <ArrowUp color="#2563EB" size={16} strokeWidth={3} />
              <Text style={styles.withdrawBtnTextBlue}>Withdraw</Text>
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          <View style={styles.mainWalletCardDisabled}>
            <View style={styles.walletCardHeader}>
              <Text style={styles.walletCardLabelDisabled}>AVAILABLE BALANCE</Text>
              <Wifi color="#94A3B8" size={20} style={{ transform:[{ rotate: '90deg' }] }} />
            </View>
            <View style={styles.walletBalanceRow}>
              <Text style={styles.walletAmountDisabled}>0</Text>
              <Text style={styles.walletCurrencyDisabled}>XAF</Text>
            </View>
            <View style={styles.withdrawBtnGhost}>
              <ArrowUp color="#94A3B8" size={16} strokeWidth={3} />
              <Text style={styles.withdrawBtnTextGhost}>Withdraw</Text>
            </View>
          </View>
        )}

        {/* LINKED ACCOUNTS */}
        <Text style={styles.sectionTitle}>Linked Accounts</Text>
        <View style={styles.linkedAccountCard}>
          <View style={[styles.networkBadge, { backgroundColor: network === 'OM' ? '#F97316' : '#FFCC00' }]}>
            <Text style={[styles.networkBadgeText, { color: network === 'OM' ? '#FFF' : '#000' }]}>{network}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountName}>{dashData?.user?.fullName || "User"}</Text>
            <Text style={styles.accountPhone}>{maskedPhone}</Text>
          </View>
          <View style={styles.primaryPill}>
            <Text style={styles.primaryPillText}>PRIMARY</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.addAccountBtn}>
          <Plus color="#64748B" size={16} strokeWidth={3} />
          <Text style={styles.addAccountText}>Link Backup Number</Text>
        </TouchableOpacity>

        {/* RECENT ACTIVITY */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {walletLogs.length > 0 && <Text style={styles.viewAllText}>View All</Text>}
        </View>

        {walletLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Receipt color="#CBD5E1" size={40} />
            <Text style={styles.emptyTitle}>No wallet activity yet</Text>
            <Text style={styles.emptyDesc}>Funds released to you from escrows will appear here.</Text>
          </View>
        ) : (
          <View style={styles.logsContainer}>
            {walletLogs.map((log: any, index: number) => {
              const isDebit = log.action === 'WITHDRAWAL';
              const isLast = index === walletLogs.length - 1;
              let meta: any = {};
              try { meta = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : (log.metadata || {}); } catch(e) {}

              let title = isDebit ? `Withdraw to ${network}` : "Payout from Escrow";
              let amtStr = meta.amount ? Number(meta.amount).toLocaleString() : "0";

              // Safely format time to "Today, 10:42 AM" format
              const logDate = new Date(log.createdAt);
              const today = new Date();
              let timeString = logDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              let datePrefix = logDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              if (logDate.toDateString() === today.toDateString()) datePrefix = 'Today';
              
              return (
                <View key={log.id} style={[styles.logRow, !isLast && styles.logRowBorder]}>
                  <View style={[styles.logIconBox, { backgroundColor: isDebit ? '#F1F5F9' : '#D1FAE5' }]}>
                    {isDebit ? <ArrowUp color="#334155" size={18} /> : <ArrowDownLeft color="#10B981" size={18} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logTitle}>{title}</Text>
                    <Text style={styles.logTime}>{datePrefix}, {timeString}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.logAmount, { color: isDebit ? '#0F172A' : '#10B981' }]}>
                      {isDebit ? '-' : '+'}{amtStr}
                    </Text>
                    <Text style={styles.logStatus}>Success</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  
  // Toast
  toastContainer: { position: 'absolute', left: 24, right: 24, zIndex: 999, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10, gap: 12 },
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },

  listContent: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 140 : 120 },

  // Main Wallet Card (Blue)
  mainWalletCard: { borderRadius: 28, padding: 24, marginBottom: 32, shadowColor: '#1E3A8A', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  walletCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  walletCardLabel: { color: '#DBEAFE', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  walletBalanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 24 },
  walletAmount: { fontSize: 48, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
  walletCurrency: { fontSize: 16, fontWeight: '700', color: '#93C5FD' },
  withdrawBtnWhite: { backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  withdrawBtnTextBlue: { color: '#2563EB', fontSize: 15, fontWeight: '800' },

  // Main Wallet Card (Disabled/Gray)
  mainWalletCardDisabled: { backgroundColor: '#64748B', borderRadius: 28, padding: 24, marginBottom: 32 },
  walletCardLabelDisabled: { color: '#E2E8F0', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  walletAmountDisabled: { fontSize: 48, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
  walletCurrencyDisabled: { fontSize: 16, fontWeight: '700', color: '#CBD5E1' },
  withdrawBtnGhost: { backgroundColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 },
  withdrawBtnTextGhost: { color: '#94A3B8', fontSize: 15, fontWeight: '800' },

  // Linked Accounts
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 16 },
  linkedAccountCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  networkBadge: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  networkBadgeText: { fontSize: 14, fontWeight: '900' },
  accountName: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
  accountPhone: { fontSize: 12, fontWeight: '600', color: '#64748B', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 1 },
  primaryPill: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  primaryPillText: { color: '#2563EB', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  addAccountBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16, marginBottom: 32 },
  addAccountText: { color: '#64748B', fontSize: 14, fontWeight: '700' },

  // Recent Activity
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  viewAllText: { color: '#2563EB', fontSize: 14, fontWeight: '700' },
  emptyState: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', borderStyle: 'dashed' },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },

  // Logs List
  logsContainer: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 8, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  logRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 },
  logRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  logIconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  logTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  logTime: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  logAmount: { fontSize: 16, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 4 },
  logStatus: { fontSize: 12, fontWeight: '700', color: '#64748B' },

  // WITHDRAWAL MODAL
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  modalBackdropTouch: { flex: 1, justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, shadowColor: '#000', shadowOffset: {width: 0, height: -10}, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  sheetHandle: { width: 48, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  closeBtn: { width: 36, height: 36, backgroundColor: '#F8FAFC', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  
  inputContainer: { alignItems: 'center', marginBottom: 32 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 8 },
  amountInput: { fontSize: 48, fontWeight: '900', color: '#0F172A', textAlign: 'center', letterSpacing: -1, width: '100%', padding: 0 },
  availableText: { fontSize: 13, fontWeight: '800', color: '#10B981', marginTop: 8 },

  dashedDivider: { height: 1, width: '100%', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 1, marginBottom: 24 },

  transferLabel: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  linkedAccountCardActive: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1.5, borderColor: '#2563EB', marginBottom: 32 },

  confirmBtn: { backgroundColor: '#2563EB', paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#2563EB', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  confirmBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0 },
  confirmBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }
});