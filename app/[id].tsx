import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    AlertTriangle,
    Box,
    CheckCircle2,
    ChevronLeft,
    Circle,
    Lock,
    Package
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

// 👉 REPLACE WITH YOUR LOCAL IPs
const API_URL = 'http://192.168.43.78:3000/api/mobile/dashboard'; 
const ACTION_URL = 'http://192.168.43.78:3000/api/mobile/action';

export default function DealDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isLoading, setIsLoading] = useState(true);
  const [deal, setDeal] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Modal State for Actions
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; type: 'fund' | 'deliver' | 'release' | 'dispute' | null;
    isProcessing: boolean;
  }>({ isOpen: false, type: null, isProcessing: false });
  const [disputeReason, setDisputeReason] = useState("");

  const fetchDeal = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      // In a real app, you'd fetch the specific deal by ID: fetch(`${API_URL}/${id}`)
      // For now, we fetch dashboard data and find the deal
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.success) {
        const foundDeal = json.data.escrows.find((e: any) => e.id === id);
        setDeal(foundDeal);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDeal(); }, [id]);

  const handleAction = async () => {
    if (confirmModal.type === 'dispute' && !disputeReason.trim()) {
      Alert.alert("Required", "Please provide a reason for the dispute.");
      return;
    }

    setConfirmModal(prev => ({ ...prev, isProcessing: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(ACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ escrowId: id, actionType: confirmModal.type, reason: disputeReason })
      });
      
      const json = await res.json();
      if (json.success) {
        Alert.alert("Success", "Action completed successfully.");
        setConfirmModal({ isOpen: false, type: null, isProcessing: false });
        fetchDeal(); // Refresh data
      } else {
        Alert.alert("Error", json.error || "Failed to process.");
        setConfirmModal(prev => ({ ...prev, isProcessing: false }));
      }
    } catch (e) {
      Alert.alert("Error", "Network connection failed.");
      setConfirmModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // --- UI HELPERS ---
  const formatK = (num: number) => num?.toLocaleString() || '0';
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Pending...';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!deal) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{fontSize: 16, fontWeight: '700'}}>Deal not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{marginTop: 20}}>
          <Text style={{color: '#2563EB'}}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isBuyer = deal.buyerId === userId;
  const status = deal.status;

  // --- SMART TIMELINE BUILDER ---
  const buildTimeline = () => {
    const steps = [];

    // 1. Created
    steps.push({
      id: 'created',
      title: 'Created',
      desc: null,
      time: formatDate(deal.createdAt),
      isDone: true,
      isCurrent: false,
      isError: false,
      icon: CheckCircle2,
      color: '#10B981',
      lineColor: status !== 'DRAFT' ? '#10B981' : '#E2E8F0'
    });

    // 2. Funded
    const isFunded = status !== 'DRAFT';
    const isFundingCurrent = status === 'DRAFT' && isBuyer;
    steps.push({
      id: 'funded',
      title: isFunded ? 'Funded' : (isFundingCurrent ? 'Action Required' : 'Awaiting Funds'),
      desc: isFundingCurrent ? 'Please fund this escrow to secure your item.' : null,
      time: isFunded ? (deal.updatedAt ? formatDate(deal.updatedAt) : 'Done') : null,
      isDone: isFunded,
      isCurrent: isFundingCurrent,
      isError: isFundingCurrent,
      icon: isFunded ? CheckCircle2 : (isFundingCurrent ? Box : Circle),
      color: isFunded ? '#10B981' : (isFundingCurrent ? '#EF4444' : '#94A3B8'),
      lineColor: (status === 'DELIVERED' || status === 'COMPLETED') ? '#10B981' : '#E2E8F0'
    });

    // 3. Delivered
    const isDelivered = status === 'DELIVERED' || status === 'COMPLETED';
    const isDeliveryCurrent = status === 'FUNDS_LOCKED' && !isBuyer;
    steps.push({
      id: 'delivered',
      title: isDelivered ? 'Seller Delivered' : (isDeliveryCurrent ? 'Action Required' : 'Awaiting Delivery'),
      desc: isDeliveryCurrent ? 'Please deliver the item/service to the buyer.' : null,
      time: isDelivered ? formatDate(deal.updatedAt) : null,
      isDone: isDelivered,
      isCurrent: isDeliveryCurrent,
      isError: isDeliveryCurrent,
      icon: isDelivered ? CheckCircle2 : (isDeliveryCurrent ? Box : Circle),
      color: isDelivered ? '#10B981' : (isDeliveryCurrent ? '#EF4444' : '#94A3B8'),
      lineColor: status === 'COMPLETED' ? '#10B981' : '#E2E8F0'
    });

    // 4. Released / Completed
    const isReleased = status === 'COMPLETED';
    const isReleaseCurrent = status === 'DELIVERED' && isBuyer;
    
    // Override if Disputed
    if (status === 'DISPUTED') {
      steps.push({
        id: 'disputed',
        title: 'Dispute Opened',
        desc: 'Funds are frozen while the dispute is being reviewed.',
        time: formatDate(deal.updatedAt),
        isDone: false,
        isCurrent: true,
        isError: true,
        icon: AlertTriangle,
        color: '#EF4444',
        lineColor: 'transparent'
      });
    } else {
      steps.push({
        id: 'released',
        title: isReleased ? 'Funds Released' : (isReleaseCurrent ? 'Action Required' : 'Awaiting Release'),
        desc: isReleaseCurrent ? 'Seller claims item is delivered. Please inspect and release fund.' : null,
        time: isReleased ? formatDate(deal.updatedAt) : null,
        isDone: isReleased,
        isCurrent: isReleaseCurrent,
        isError: isReleaseCurrent, // Shows as Red Action state
        icon: isReleased ? CheckCircle2 : (isReleaseCurrent ? Package : Circle),
        color: isReleased ? '#10B981' : (isReleaseCurrent ? '#EF4444' : '#94A3B8'),
        lineColor: 'transparent' // Last item
      });
    }

    return steps;
  };

  const timelineSteps = buildTimeline();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      
      {/* Background Dimmer / Header Area */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color="#0F172A" size={28} />
        </TouchableOpacity>
      </View>

      {/* Main Bottom Sheet Style Card */}
      <View style={styles.sheetContainer}>
        <View style={styles.dragHandle} />
        
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Tag & Titles */}
          <View style={styles.titleSection}>
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>#{deal.id.substring(0, 8).toUpperCase()}</Text>
            </View>
            <Text style={styles.itemTitle}>{deal.description}</Text>
            <Text style={styles.itemPrice}>{formatK(deal.amount)} XAF</Text>
          </View>

          {/* Vertical Timeline */}
          <View style={styles.timelineContainer}>
            {timelineSteps.map((step, index) => {
              const IconComp = step.icon;
              return (
                <View key={step.id} style={styles.stepRow}>
                  <View style={styles.stepIndicatorCol}>
                    <View style={[
                      styles.iconCircle, 
                      { borderColor: step.isCurrent ? step.color : step.isDone ? '#10B981' : '#E2E8F0',
                        backgroundColor: step.isError && step.isCurrent ? '#EF4444' : '#FFFFFF'
                      }
                    ]}>
                      <IconComp 
                        color={step.isError && step.isCurrent ? '#FFFFFF' : step.color} 
                        size={step.isDone ? 20 : 16} 
                        strokeWidth={step.isDone ? 3 : 2.5} 
                      />
                    </View>
                    {/* Connecting Line */}
                    {index !== timelineSteps.length - 1 && (
                      <View style={[styles.stepLine, { backgroundColor: step.lineColor }]} />
                    )}
                  </View>

                  <View style={styles.stepTextCol}>
                    <Text style={[styles.stepTitle, { color: step.isError ? '#EF4444' : '#0F172A' }]}>
                      {step.title}
                    </Text>
                    {step.time && <Text style={styles.stepTime}>{step.time}</Text>}
                    {step.desc && <Text style={styles.stepDesc}>{step.desc}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* BOTTOM ACTION BUTTONS */}
        <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          
          {/* BUYER ACTIONS */}
          {isBuyer && status === 'DRAFT' && (
            <TouchableOpacity 
              style={styles.primaryBtnBlue} 
              onPress={() => setConfirmModal({ isOpen: true, type: 'fund', isProcessing: false })}
            >
              <Lock color="#FFF" size={18} />
              <Text style={styles.primaryBtnText}>Fund Escrow Securely</Text>
            </TouchableOpacity>
          )}

          {isBuyer && status === 'DELIVERED' && (
            <>
              <TouchableOpacity 
                style={styles.primaryBtnBlue}
                onPress={() => setConfirmModal({ isOpen: true, type: 'release', isProcessing: false })}
              >
                <Lock color="#FFF" size={18} />
                <Text style={styles.primaryBtnText}>Release Funds to Seller</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.secondaryBtnRed}
                onPress={() => setConfirmModal({ isOpen: true, type: 'dispute', isProcessing: false })}
              >
                <AlertTriangle color="#EF4444" size={18} />
                <Text style={styles.secondaryBtnTextRed}>Report an Issue</Text>
              </TouchableOpacity>
            </>
          )}

          {/* SELLER ACTIONS */}
          {!isBuyer && status === 'FUNDS_LOCKED' && (
            <TouchableOpacity 
              style={styles.primaryBtnBlue}
              onPress={() => setConfirmModal({ isOpen: true, type: 'deliver', isProcessing: false })}
            >
              <Box color="#FFF" size={18} />
              <Text style={styles.primaryBtnText}>Confirm Item Delivered</Text>
            </TouchableOpacity>
          )}

          {/* SHARED DISPUTE VIEWING (Optional) */}
          {status === 'DISPUTED' && (
            <View style={styles.disputeInfoBox}>
              <Text style={styles.disputeInfoText}>This deal is currently under review by admins. Funds are frozen.</Text>
            </View>
          )}

        </View>
      </View>

      {/* ==========================================
          ACTION CONFIRMATION MODAL
      ========================================== */}
      <Modal visible={confirmModal.isOpen} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <View style={styles.actionModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {confirmModal.type === 'fund' && "Fund Escrow"}
                {confirmModal.type === 'deliver' && "Confirm Delivery"}
                {confirmModal.type === 'release' && "Release Funds"}
                {confirmModal.type === 'dispute' && "Report an Issue"}
              </Text>
            </View>
            
            <Text style={styles.modalDescText}>
              {confirmModal.type === 'fund' && `You are about to lock ${formatK(deal.amount)} XAF safely in escrow.`}
              {confirmModal.type === 'deliver' && "Confirm that you have shipped or handed over the item to the buyer."}
              {confirmModal.type === 'release' && "Are you sure? This will instantly transfer the money to the seller. This cannot be undone."}
              {confirmModal.type === 'dispute' && "Please explain the issue. Funds will be frozen immediately."}
            </Text>

            {confirmModal.type === 'dispute' && (
              <TextInput 
                style={styles.modalInput}
                placeholder="Item is damaged, missing, etc..."
                placeholderTextColor="#94A3B8"
                value={disputeReason}
                onChangeText={setDisputeReason}
                multiline
              />
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setConfirmModal({ isOpen: false, type: null, isProcessing: false })}
                disabled={confirmModal.isProcessing}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalConfirmBtn, confirmModal.type === 'dispute' ? {backgroundColor: '#EF4444'} : {}]}
                onPress={handleAction}
                disabled={confirmModal.isProcessing || (confirmModal.type === 'dispute' && !disputeReason.trim())}
              >
                {confirmModal.isProcessing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {confirmModal.type === 'dispute' ? 'Submit Issue' : 'Confirm'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { height: 60, justifyContent: 'center', paddingHorizontal: 20 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },

  sheetContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 10,
  },
  dragHandle: {
    width: 48,
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 8,
  },

  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },

  // Titles
  titleSection: { alignItems: 'center', marginBottom: 40 },
  tagPill: { backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 12 },
  tagText: { color: '#64748B', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  itemTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 8 },
  itemPrice: { fontSize: 28, fontWeight: '900', color: '#2563EB', letterSpacing: -0.5 },

  // Timeline
  timelineContainer: { paddingLeft: 10 },
  stepRow: { flexDirection: 'row', minHeight: 70 },
  stepIndicatorCol: { width: 40, alignItems: 'center' },
  iconCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', zIndex: 2
  },
  stepLine: { width: 2, flex: 1, marginVertical: -2, zIndex: 1 }, // Connects dots
  stepTextCol: { flex: 1, paddingLeft: 16, paddingBottom: 32, paddingTop: 2 },
  stepTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  stepTime: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  stepDesc: { fontSize: 13, color: '#64748B', marginTop: 6, lineHeight: 18 },

  // Bottom Actions
  bottomActions: { paddingHorizontal: 24, paddingTop: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#F8FAFC', gap: 12 },
  
  primaryBtnBlue: { backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 16 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  
  secondaryBtnRed: { backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: '#EF4444' },
  secondaryBtnTextRed: { color: '#EF4444', fontSize: 16, fontWeight: '800' },

  disputeInfoBox: { backgroundColor: '#FEE2E2', padding: 16, borderRadius: 12, alignItems: 'center' },
  disputeInfoText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 24 },
  actionModalCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24 },
  modalHeader: { marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  modalDescText: { fontSize: 15, color: '#64748B', lineHeight: 22, marginBottom: 20 },
  modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 16, height: 100, textAlignVertical: 'top', marginBottom: 20, color: '#0F172A' },
  modalBtnRow: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modalCancelText: { color: '#64748B', fontWeight: '800', fontSize: 15 },
  modalConfirmBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center' },
  modalConfirmText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});