import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    AlertTriangle, ArrowLeft, Box, CheckCircle2, Clock, Download, Lock, X
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Dimensions,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

const { width } = Dimensions.get('window');

// 👉 REPLACE WITH YOUR COMPUTER'S LOCAL IP
const API_URL = 'http://192.168.43.78:3000/api/mobile/dashboard'; 
const ACTION_URL = 'http://192.168.43.78:3000/api/mobile/action'; 

export default function EscrowDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deal, setDeal] = useState<any>(null);
  const[logs, setLogs] = useState<any[]>([]);

  // --- NATIVE CONFIRMATION MODAL ---
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; type: 'fund' | 'deliver' | 'release' | 'dispute' | null; isProcessing: boolean;
  }>({ isOpen: false, type: null, isProcessing: false });
  const [disputeReason, setDisputeReason] = useState("");

  // --- TOAST NOTIFICATION ---
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error'}>({show: false, message: '', type: 'success'});
  
  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  // --- FETCH DATA ---
  const fetchDealDetails = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.replace('/auth'); return; }

      const response = await fetch(API_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      });
      const json = await response.json();
      
      if (json.success) {
        // Find this specific deal
        const foundDeal = json.data.escrows.find((e: any) => e.id === id);
        setDeal({ ...foundDeal, currentUserId: json.data.user.id });
        
        // Filter logs specifically for this escrow
        const dealLogs = json.data.logs.filter((log: any) => {
          let meta: any = {};
          try { meta = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : (log.metadata || {}); } catch(e){}
          return meta.escrowId === foundDeal?.shortId || meta.escrowId === foundDeal?.id;
        });
        setLogs(dealLogs);
      }
    } catch (error) {
      console.error("Deal Fetch Error:", error);
    } finally {
      setIsLoading(false); setIsRefreshing(false);
    }
  };

  useEffect(() => { fetchDealDetails(); }, [id]);
  const onRefresh = () => { setIsRefreshing(true); fetchDealDetails(); };

  // --- ACTION HANDLER ---
  const handleConfirmedAction = async () => {
    if (confirmModal.type === 'dispute' && !disputeReason.trim()) {
      triggerToast("Please provide a reason for the dispute.", "error"); return;
    }
    setConfirmModal(prev => ({ ...prev, isProcessing: true }));
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(ACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ escrowId: deal.id, actionType: confirmModal.type, reason: disputeReason })
      });
      const json = await res.json();

      if (json.success) {
        let msg = "Action completed successfully.";
        if (confirmModal.type === 'fund') msg = "Escrow funded securely!";
        if (confirmModal.type === 'deliver') msg = "Delivery confirmed!";
        if (confirmModal.type === 'release') msg = "Funds released successfully!";
        if (confirmModal.type === 'dispute') msg = "Dispute opened and funds frozen.";
        
        triggerToast(msg, 'success');
        await fetchDealDetails();
        setConfirmModal({ isOpen: false, type: null, isProcessing: false });
      } else {
        triggerToast(json.error || "Failed to process transaction.", 'error');
        setConfirmModal(prev => ({ ...prev, isProcessing: false }));
      }
    } catch (e) {
      triggerToast("Network error. Please check your connection.", 'error');
      setConfirmModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // --- UI PARSERS ---
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (isLoading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;
  
  if (!deal) return (
    <View style={styles.emptyContainer}>
      <Box color="#94A3B8" size={48} />
      <Text style={styles.emptyTitle}>Transaction Not Found</Text>
      <Text style={styles.emptyDesc}>This deal may have been deleted or you do not have permission to view it.</Text>
      <TouchableOpacity style={styles.backBtnFallback} onPress={() => router.back()}>
        <Text style={styles.backBtnFallbackText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  // State Machine Booleans
  const isBuyer = deal.buyerId === deal.currentUserId;
  const status = deal.status;
  
  const isDraft = status === "DRAFT";
  const isFunded = status === "FUNDS_LOCKED" || status === "DELIVERED" || status === "COMPLETED";
  const isDelivered = status === "DELIVERED" || status === "COMPLETED";
  const isReleased = status === "COMPLETED";
  const isDisputed = status === "DISPUTED";
  const isRefunded = status === "REFUNDED";

  // Counterparty Data
  const cp = isBuyer ? deal.seller : deal.buyer;
  const cpName = cp?.fullName || "Guest User";
  const cpInitial = cpName.charAt(0).toUpperCase();
  const cpPhone = cp?.phoneNumber || deal.counterpartyPhone || "N/A";

  // Build the Timeline Array dynamically
  const timelineNodes =[];
  timelineNodes.push({ id: 1, title: 'Created', time: formatTime(deal.createdAt), isCompleted: true, isActionReq: false, icon: null });
  
  if (isDraft) {
    timelineNodes.push({ id: 2, title: isBuyer ? 'Action Required' : 'Awaiting Funds', subText: isBuyer ? 'Please fund the escrow to secure your transaction.' : 'Waiting for buyer to fund the escrow.', isCompleted: false, isActionReq: isBuyer, icon: isBuyer ? AlertTriangle : Clock });
  } else {
    timelineNodes.push({ id: 2, title: 'Funded', time: formatTime(deal.updatedAt), isCompleted: true, isActionReq: false, icon: null });
  }

  if (status === 'FUNDS_LOCKED') {
    timelineNodes.push({ id: 3, title: !isBuyer ? 'Action Required' : 'Awaiting Delivery', subText: !isBuyer ? 'Buyer locked the funds. Please deliver the item.' : 'Waiting for seller to deliver the item.', isCompleted: false, isActionReq: !isBuyer, icon: !isBuyer ? Box : Clock });
  } else if (isDelivered || isReleased) {
    timelineNodes.push({ id: 3, title: 'Seller Delivered', time: formatTime(deal.updatedAt), isCompleted: true, isActionReq: false, icon: null });
  }

  if (status === 'DELIVERED') {
    timelineNodes.push({ id: 4, title: isBuyer ? 'Action Required' : 'Awaiting Approval', subText: isBuyer ? 'Seller claims item is delivered. Please inspect and release funds.' : 'Waiting for buyer to release funds.', isCompleted: false, isActionReq: isBuyer, icon: isBuyer ? AlertTriangle : Clock });
  } else if (isReleased) {
    timelineNodes.push({ id: 4, title: 'Funds Released', time: formatTime(deal.updatedAt), isCompleted: true, isActionReq: false, icon: null });
  } else if (isRefunded) {
    timelineNodes.push({ id: 4, title: 'Refunded', time: formatTime(deal.updatedAt), isCompleted: true, isActionReq: false, icon: null });
  }

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

      {/* ACTION CONFIRMATION MODAL */}
      <Modal visible={confirmModal.isOpen} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBackdropTouch} onPress={() => !confirmModal.isProcessing && setConfirmModal({isOpen: false, type: null, isProcessing: false})}>
            <TouchableOpacity activeOpacity={1} style={styles.actionModalCard}>
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
                
                <Text style={styles.modalDescTitle}>{deal.description}</Text>
                
                {confirmModal.type === 'dispute' ? (
                  <View style={{width: '100%', marginTop: 12}}>
                    <Text style={{fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 8}}>Reason for dispute:</Text>
                    <TextInput 
                      style={styles.modalInput}
                      placeholder="E.g. Item arrived damaged..."
                      placeholderTextColor="#94A3B8"
                      value={disputeReason}
                      onChangeText={setDisputeReason}
                      multiline
                      maxLength={150}
                    />
                    <Text style={{fontSize: 11, fontWeight: '600', color: '#EF4444', marginTop: 8, textAlign: 'center'}}>Funds will be frozen instantly upon submission.</Text>
                  </View>
                ) : (
                  <Text style={styles.modalDescText}>
                    {confirmModal.type === 'fund' && `Authorize a MoMo push to securely lock ${deal.amount.toLocaleString()} XAF.`}
                    {confirmModal.type === 'deliver' && "You confirm that you have physically shipped or delivered this item/service."}
                    {confirmModal.type === 'release' && `Permanently release ${deal.amount.toLocaleString()} XAF to the seller. This cannot be undone.`}
                  </Text>
                )}
              </View>

              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleConfirmedAction} 
                disabled={confirmModal.isProcessing || (confirmModal.type === 'dispute' && !disputeReason)} 
                style={[styles.modalActionBtn, { backgroundColor: confirmModal.type === 'dispute' ? '#EF4444' : confirmModal.type === 'fund' ? '#2563EB' : confirmModal.type === 'deliver' ? '#0F172A' : '#10B981' }]}
              >
                {confirmModal.isProcessing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalActionBtnText}>{confirmModal.type === 'dispute' ? 'Freeze & Report Issue' : 'Confirm Action'}</Text>}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#0F172A" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deal Details</Text>
        <View style={{width: 44}} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 160 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
        
        {/* FROZEN BANNER */}
        {isDisputed && (
          <View style={styles.frozenBanner}>
            <AlertTriangle color="#EF4444" size={20} />
            <Text style={styles.frozenBannerText}>Funds Frozen: Under Mediation</Text>
          </View>
        )}

        {/* MAIN INFO CARD */}
        <View style={[styles.mainCard, isDisputed && styles.mainCardDisputed]}>
          <View style={styles.mainCardHeader}>
            <View style={styles.idBadge}><Text style={styles.idBadgeText}>#ESC-{deal.id.substring(0,6).toUpperCase()}</Text></View>
            <View style={[styles.roleBadge, { backgroundColor: isBuyer ? '#EFF6FF' : '#FDF2F8' }]}>
              <Text style={[styles.roleBadgeText, { color: isBuyer ? '#2563EB' : '#DB2777' }]}>
                You are {isBuyer ? 'Buyer' : 'Seller'}
              </Text>
            </View>
          </View>

          <Text style={styles.itemDescription}>{deal.description}</Text>
          
          <View style={styles.amountRow}>
            <Text style={styles.amountText}>{deal.amount.toLocaleString()} <Text style={{fontSize: 16, color: '#64748B'}}>XAF</Text></Text>
          </View>

          <View style={styles.dashedDivider} />

          {/* COUNTERPARTY MINI-PROFILE */}
          <View style={styles.counterpartyRow}>
            <Text style={styles.counterpartyLabel}>{isBuyer ? 'Paying to:' : 'Requested from:'}</Text>
            <View style={styles.counterpartyProfile}>
              <View style={styles.cpAvatar}><Text style={styles.cpAvatarText}>{cpInitial}</Text></View>
              <View>
                <Text style={styles.cpName}>{cpName}</Text>
                <Text style={styles.cpPhone}>+237 {cpPhone}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* VERTICAL TIMELINE */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>Transaction Status</Text>
          
          <View style={styles.timelineWrapper}>
            {timelineNodes.map((node, index) => {
              const isLast = index === timelineNodes.length - 1;
              const NodeIcon = node.isCompleted ? CheckCircle2 : node.icon;
              const iconColor = node.isCompleted ? '#10B981' : node.isActionReq ? '#EF4444' : '#94A3B8';
              const bgColor = node.isCompleted ? '#ECFDF5' : node.isActionReq ? '#FEF2F2' : '#F1F5F9';

              return (
                <View key={node.id} style={styles.timelineRow}>
                  {/* Left Column: Icons & Lines */}
                  <View style={styles.timelineIconCol}>
                    <View style={[styles.timelineNode, { backgroundColor: bgColor }]}>
                      {NodeIcon && <NodeIcon color={iconColor} size={16} strokeWidth={3} />}
                    </View>
                    {!isLast && <View style={[styles.timelineLine, { backgroundColor: node.isCompleted ? '#10B981' : '#E2E8F0' }]} />}
                  </View>

                  {/* Right Column: Text */}
                  <View style={styles.timelineTextCol}>
                    <Text style={[styles.timelineTitle, { color: node.isActionReq ? '#EF4444' : '#0F172A' }]}>{node.title}</Text>
                    {node.time && <Text style={styles.timelineTime}>{node.time}</Text>}
                    {node.subText && <Text style={styles.timelineSubText}>{node.subText}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ACTIVITY LOG (AUDIT TRAIL) */}
        {logs.length > 0 && (
          <View style={styles.logsSection}>
            <Text style={styles.sectionTitle}>Audit Log</Text>
            <View style={styles.logsCard}>
              {logs.map((log: any, index: number) => {
                const isLast = index === logs.length - 1;
                const isAlert = log.action.includes('DISPUTE');
                const isSuccess = log.action.includes('RELEASED') || log.action.includes('DELIVERED') || log.action.includes('FUNDED');
                
                return (
                  <View key={log.id} style={[styles.logRow, !isLast && styles.logRowBorder]}>
                    <View style={[styles.logIconBox, { backgroundColor: isAlert ? '#FEE2E2' : isSuccess ? '#D1FAE5' : '#DBEAFE' }]}>
                      {isAlert ? <AlertTriangle color="#EF4444" size={14} /> : isSuccess ? <CheckCircle2 color="#10B981" size={14} /> : <Clock color="#2563EB" size={14} />}
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={styles.logActionText}>{log.action.replace(/_/g, " ")}</Text>
                      <Text style={styles.logTimeText}>{formatTime(log.createdAt)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* =======================================================
          STICKY BOTTOM ACTION BAR (SAFE AREA AWARE)
          ======================================================= */}
      {status !== "REFUNDED" && status !== "DISPUTED" && (
        <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + 20 }]}>
          
          {/* 👉 DOWNLOAD RECEIPT BUTTON FOR COMPLETED DEALS */}
          {status === 'COMPLETED' && (
            <TouchableOpacity activeOpacity={0.9} style={[styles.actionBtn, { backgroundColor: '#0F172A' }]} onPress={() => triggerToast("Downloading encrypted receipt...", "success")}>
              <Download color="#FFF" size={20} />
              <Text style={styles.actionBtnText}>Download Receipt</Text>
            </TouchableOpacity>
          )}

          {isBuyer && isDraft && (
            <TouchableOpacity activeOpacity={0.9} style={[styles.actionBtn, { backgroundColor: '#2563EB' }]} onPress={() => { setConfirmModal({ isOpen: true, type: 'fund', isProcessing: false }); }}>
              <Lock color="#FFF" size={20} /><Text style={styles.actionBtnText}>Lock Funds via MoMo</Text>
            </TouchableOpacity>
          )}
          
          {!isBuyer && status === 'FUNDS_LOCKED' && (
            <TouchableOpacity activeOpacity={0.9} style={[styles.actionBtn, { backgroundColor: '#0F172A' }]} onPress={() => { setConfirmModal({ isOpen: true, type: 'deliver', isProcessing: false }); }}>
              <Box color="#FFF" size={20} /><Text style={styles.actionBtnText}>Confirm Delivery</Text>
            </TouchableOpacity>
          )}

          {isBuyer && status === 'DELIVERED' && (
            <View style={{ gap: 12 }}>
              <TouchableOpacity activeOpacity={0.9} style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => { setConfirmModal({ isOpen: true, type: 'release', isProcessing: false }); }}>
                <CheckCircle2 color="#FFF" size={20} /><Text style={styles.actionBtnText}>Approve & Release Funds</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} style={styles.disputeBtn} onPress={() => { setConfirmModal({ isOpen: true, type: 'dispute', isProcessing: false }); }}>
                <AlertTriangle color="#EF4444" size={18} /><Text style={styles.disputeBtnText}>Report an Issue</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Waiting States */}
          {!isBuyer && isDraft && <View style={styles.waitingBox}><Text style={styles.waitingText}>Waiting for Buyer to fund escrow...</Text></View>}
          {isBuyer && status === 'FUNDS_LOCKED' && <View style={styles.waitingBox}><Text style={styles.waitingText}>Waiting for Seller to deliver...</Text></View>}
          {!isBuyer && status === 'DELIVERED' && <View style={styles.waitingBox}><Text style={styles.waitingText}>Waiting for Buyer to release funds...</Text></View>}
        </View>
      )}
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  backBtnFallback: { backgroundColor: '#0F172A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backBtnFallbackText: { color: '#FFFFFF', fontWeight: '800' },

  // Toast
  toastContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 55 : 35, left: 24, right: 24, zIndex: 999, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10, gap: 12 },
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },

  scrollContent: { padding: 24 },
  // paddingBottom is dynamic via inline style, not here

  frozenBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#FECACA', marginBottom: 24 },
  frozenBannerText: { color: '#B91C1C', fontWeight: '800', fontSize: 13 },

  // Main Card
  mainCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, marginBottom: 32 },
  mainCardDisputed: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  mainCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  idBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  idBadgeText: { fontSize: 11, fontWeight: '800', color: '#64748B', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleBadgeText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemDescription: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginBottom: 8, letterSpacing: -0.5 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
  amountText: { fontSize: 32, fontWeight: '900', color: '#2563EB', letterSpacing: -1 },
  dashedDivider: { height: 1, width: '100%', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 1, marginBottom: 20 },
  counterpartyRow: { flexDirection: 'column', gap: 8 },
  counterpartyLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  counterpartyProfile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cpAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  cpAvatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cpName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  cpPhone: { fontSize: 12, fontWeight: '600', color: '#64748B', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 },

  // Timeline
  timelineSection: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 16 },
  timelineWrapper: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
  timelineRow: { flexDirection: 'row', minHeight: 64 },
  timelineIconCol: { alignItems: 'center', width: 32, marginRight: 16 },
  timelineNode: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  timelineLine: { width: 2, flex: 1, marginVertical: 4 },
  timelineTextCol: { flex: 1, paddingBottom: 24, paddingTop: 6 },
  timelineTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  timelineTime: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  timelineSubText: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18, fontWeight: '500' },

  // Audit Logs
  logsSection: { marginBottom: 24 },
  logsCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  logRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  logIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  logActionText: { fontSize: 13, fontWeight: '800', color: '#0F172A', textTransform: 'capitalize' },
  logTimeText: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 2 },

  // Sticky Footer (safe area applied inline)
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 24,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 10,
  },
  actionBtn: { height: 60, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  actionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disputeBtn: { height: 50, borderRadius: 16, borderWidth: 1.5, borderColor: '#FECACA', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  disputeBtnText: { color: '#EF4444', fontSize: 14, fontWeight: '800' },
  waitingBox: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  waitingText: { fontSize: 13, fontWeight: '700', color: '#64748B' },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)' },
  modalBackdropTouch: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  actionModalCard: { backgroundColor: '#FFFFFF', width: '100%', borderRadius: 32, padding: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 20}, shadowOpacity: 0.2, shadowRadius: 30, elevation: 15 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  modalCloseBtn: { width: 36, height: 36, backgroundColor: '#F1F5F9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalBody: { backgroundColor: '#F8FAFC', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#F1F5F9' },
  modalIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalDescTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  modalDescText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  modalInput: { width: '100%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, height: 100, textAlignVertical: 'top', fontSize: 14, color: '#0F172A' },
  modalActionBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  modalActionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }
});