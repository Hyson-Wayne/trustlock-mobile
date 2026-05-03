import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2, Clock,
    Paperclip,
    Scale,
    Send,
    Shield, X
} from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
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
import { supabase } from '../../lib/supabase';

const { height } = Dimensions.get('window');

// 👉 REPLACE WITH YOUR COMPUTER'S LOCAL IP
const API_URL = 'http://192.168.43.78:3000/api/mobile/disputes';

export default function DisputesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("Action Required");

  // --- CHAT MODAL STATES ---
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [viewImageModal, setViewImageModal] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // --- FETCH ENGINE ---
  const fetchDisputes = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { router.replace('/auth'); return; }

      const response = await fetch(API_URL, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      });
      const json = await response.json();
      if (json.success) {
        setDisputes(json.disputes || []);
        // Refresh open chat if it's currently open
        if (selectedDispute) {
          const updatedDeal = json.disputes.find((d: any) => d.id === selectedDispute.id);
          if (updatedDeal) setSelectedDispute(updatedDeal);
        }
      }
    } catch (error) {
      console.error("Disputes Fetch Error:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchDisputes(); }, []));
  const onRefresh = () => { setIsRefreshing(true); fetchDisputes(); };

  // --- CHAT ACTIONS ---
  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachment) || !selectedDispute) return;
    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          disputeId: selectedDispute.id,
          text: newMessage,
          attachmentBase64: attachment
        })
      });
      const json = await res.json();
      if (json.success) {
        setNewMessage("");
        setAttachment(null);
        await fetchDisputes();
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    } catch (e) {
      alert("Failed to send message.");
    }
    setIsSending(false);
  };

  const handleResolveSeller = async () => {
    if (!window.confirm("Are you sure you want to accept the return and refund the buyer? This cannot be undone.")) return;
    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ disputeId: selectedDispute.id, actionType: 'RESOLVE' })
      });
      const json = await res.json();
      if (json.success) {
        alert("Refund issued successfully.");
        setSelectedDispute(null);
        await fetchDisputes();
      }
    } catch (e) {
      alert("Network Error.");
    }
    setIsSending(false);
  };

  // --- FORMATTERS ---
  const filteredDisputes = disputes.filter(d => activeTab === "All Cases" ? true : d.status === "ACTION_REQUIRED" || d.status === "ADMIN_REVIEW");
  const actionReqCount = disputes.filter(d => d.status === "ACTION_REQUIRED").length;

  if (isLoading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* FULLSCREEN IMAGE VIEWER */}
      {viewImageModal && (
        <Modal visible transparent animationType="fade">
          <View style={styles.fullscreenOverlay}>
            <TouchableOpacity style={styles.closeImageBtn} onPress={() => setViewImageModal(null)}>
              <X color="#FFF" size={24} />
            </TouchableOpacity>
            <View style={styles.imageViewerBox} />
            {/* In a real app, render actual base64 image here. Leaving as placeholder box for design */}
          </View>
        </Modal>
      )}

      {/* =======================================================
          CHAT MODAL (iMessage / WhatsApp Style)
          ======================================================= */}
      <Modal visible={!!selectedDispute} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.chatModalContainer}>
          <View style={[styles.chatSheet, { paddingBottom: insets.bottom }]}>
            {selectedDispute && (() => {
              const currentUserId = selectedDispute.openedById; // Used to identify 'Me'
              const isBuyer = selectedDispute.escrow.buyerId === currentUserId;
              const cpName = isBuyer ? selectedDispute.escrow.seller.fullName : selectedDispute.escrow.buyer.fullName;

              return (
                <View style={{ flex: 1, width: '100%' }}>
                  <View style={styles.chatHeader}>
                    <View>
                      <Text style={styles.chatHeaderTitle}>{selectedDispute.escrow.description}</Text>
                      <Text style={styles.chatHeaderSub}>Case #ESC-{selectedDispute.escrowId.substring(0, 6).toUpperCase()} • Paying {cpName.split(' ')[0]}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedDispute(null)} style={styles.closeBtn}>
                      <X color="#64748B" size={20} />
                    </TouchableOpacity>
                  </View>

                  {/* Banner */}
                  {selectedDispute.status !== "RESOLVED" && (
                    <View style={styles.frozenBanner}>
                      <AlertTriangle color="#EF4444" size={16} />
                      <Text style={styles.frozenBannerText}>Funds are frozen pending mediation.</Text>
                    </View>
                  )}

                  {/* Chat Bubbles */}
                  <ScrollView
                    ref={scrollViewRef}
                    style={styles.chatScroll}
                    contentContainerStyle={styles.chatContent}
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                  >
                    {selectedDispute.messages.map((msg: any, index: number) => {
                      const isMe = msg.senderId === currentUserId;
                      const isAdmin = msg.isAdmin || msg.senderId === null;
                      const senderName = isAdmin ? "TrustLock Admin" : (isMe ? "You" : msg.sender?.fullName?.split(' ')[0] || "User");

                      // ADMIN MESSAGE (Gold & Centered)
                      if (isAdmin) {
                        return (
                          <View key={msg.id} style={styles.adminMsgBox}>
                            <View style={styles.adminMsgHeader}>
                              <Shield color="#D97706" size={14} />
                              <Text style={styles.adminMsgTitle}>{senderName}</Text>
                            </View>
                            <Text style={styles.adminMsgText}>{msg.text}</Text>
                            <Text style={styles.adminTime}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                          </View>
                        );
                      }

                      // USER MESSAGES (Blue Right / Gray Left)
                      return (
                        <View key={msg.id} style={[styles.msgRow, isMe ? styles.msgRight : styles.msgLeft]}>
                          <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
                            {!isMe && <Text style={styles.msgSenderName}>{senderName}</Text>}
                            <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextThem]}>{msg.text}</Text>

                            {/* Attachment Placeholder */}
                            {msg.attachment && (
                              <TouchableOpacity onPress={() => setViewImageModal(msg.attachment)} style={styles.imgAttachmentBox}>
                                <Text style={{ color: isMe ? '#DBEAFE' : '#94A3B8', fontSize: 10, fontWeight: 'bold' }}>View Image Attachment</Text>
                              </TouchableOpacity>
                            )}

                            <Text style={[styles.msgTime, isMe ? styles.msgTimeMe : styles.msgTimeThem]}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>

                  {/* Action Footer (Composer or Resolved State) */}
                  <View style={styles.chatFooter}>
                    {selectedDispute.status === "RESOLVED" ? (
                      <View style={styles.resolvedBox}>
                        <CheckCircle2 color="#10B981" size={24} />
                        <Text style={styles.resolvedText}>This case has been officially closed.</Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.composerRow}>
                          <TouchableOpacity style={styles.attachBtn} onPress={() => alert('Camera roll opened!')}>
                            <Paperclip color="#64748B" size={20} />
                          </TouchableOpacity>
                          <TextInput
                            value={newMessage}
                            onChangeText={setNewMessage}
                            placeholder="Type your response..."
                            style={styles.composerInput}
                            multiline
                          />
                          <TouchableOpacity
                            style={[styles.sendBtn, (!newMessage.trim() && !attachment) && { opacity: 0.5 }]}
                            onPress={handleSendMessage}
                            disabled={isSending || (!newMessage.trim() && !attachment)}
                          >
                            {isSending ? <ActivityIndicator size="small" color="#FFF" /> : <Send color="#FFF" size={18} />}
                          </TouchableOpacity>
                        </View>

                        {/* Seller specific quick resolution button */}
                        {!isBuyer && selectedDispute.status === "ACTION_REQUIRED" && (
                          <TouchableOpacity style={styles.sellerResolveBtn} onPress={handleResolveSeller}>
                            <Text style={styles.sellerResolveText}>Accept Return & Refund Buyer</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                </View>
              );
            })()}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =======================================================
          MAIN DISPUTE LIST SCREEN
          ======================================================= */}
      <View style={[styles.headerArea, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color="#0F172A" size={24} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Resolution Center</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.tabsRow}>
          <TouchableOpacity onPress={() => setActiveTab("Action Required")} style={[styles.tab, activeTab === "Action Required" && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === "Action Required" && styles.tabTextActive]}>Action Req.</Text>
            {actionReqCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{actionReqCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab("All Cases")} style={[styles.tab, activeTab === "All Cases" && styles.tabActive]}>
            <Text style={[styles.tabText, activeTab === "All Cases" && styles.tabTextActive]}>All Cases</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 60 }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
      >
        {filteredDisputes.length === 0 ? (
          <View style={styles.emptyState}>
            <Scale color="#CBD5E1" size={48} />
            <Text style={styles.emptyTitle}>Queue is Clear</Text>
            <Text style={styles.emptyDesc}>You have no active disputes requiring attention.</Text>
          </View>
        ) : (
          filteredDisputes.map(dispute => {
            const isResolved = dispute.status === "RESOLVED";
            const isActionReq = dispute.status === "ACTION_REQUIRED";
            const lastMsg = dispute.messages[dispute.messages.length - 1]?.text || dispute.reason;

            return (
              <TouchableOpacity
                key={dispute.id}
                activeOpacity={0.8}
                onPress={() => setSelectedDispute(dispute)}
                style={[styles.dealCard, isActionReq && styles.dealCardRed, isResolved && styles.dealCardResolved]}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.idBadge}>#ESC-{dispute.escrowId.substring(0, 6).toUpperCase()}</Text>
                  <View style={[styles.statusPill, isResolved ? styles.pillGray : isActionReq ? styles.pillRed : styles.pillOrange]}>
                    {isResolved ? <CheckCircle2 color="#64748B" size={12} /> : isActionReq ? <AlertTriangle color="#EF4444" size={12} /> : <Clock color="#D97706" size={12} />}
                    <Text style={[styles.statusPillText, isResolved ? styles.textGray : isActionReq ? styles.textRed : styles.textOrange]}>
                      {isResolved ? 'RESOLVED' : isActionReq ? 'ACTION REQ.' : 'ADMIN REVIEW'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.dealTitle} numberOfLines={1}>{dispute.escrow.description}</Text>
                <Text style={styles.lastMessage} numberOfLines={2}>{lastMsg}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.dealAmount}>{dispute.escrow.amount.toLocaleString()} XAF</Text>
                  <Text style={styles.viewChat}>View Chat</Text>
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

  headerArea: { backgroundColor: '#FFFFFF', paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  pageTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },

  tabsRow: { flexDirection: 'row', gap: 16 },
  tab: { paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabActive: { borderBottomColor: '#2563EB' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#2563EB', fontWeight: '800' },
  tabBadge: { backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  tabBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

  listContent: { padding: 24, gap: 16 },

  emptyState: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', borderStyle: 'dashed', marginTop: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },

  dealCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  dealCardRed: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  dealCardResolved: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  idBadge: { fontSize: 11, fontWeight: '800', color: '#64748B', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  pillRed: { backgroundColor: '#FEE2E2' },
  pillOrange: { backgroundColor: '#FEF3C7' },
  pillGray: { backgroundColor: '#F1F5F9' },
  statusPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  textRed: { color: '#EF4444' },
  textOrange: { color: '#D97706' },
  textGray: { color: '#64748B' },
  dealTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  lastMessage: { fontSize: 14, color: '#64748B', lineHeight: 22, marginBottom: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  dealAmount: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  viewChat: { fontSize: 13, fontWeight: '800', color: '#2563EB' },

  // CHAT MODAL
  chatModalContainer: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  chatSheet: { backgroundColor: '#F8FAFC', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: height * 0.9, overflow: 'hidden' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  chatHeaderTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  chatHeaderSub: { fontSize: 12, fontWeight: '600', color: '#64748B', marginTop: 2 },
  closeBtn: { width: 36, height: 36, backgroundColor: '#F1F5F9', borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  frozenBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FECACA' },
  frozenBannerText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },

  chatScroll: { flex: 1 },
  chatContent: { padding: 20, gap: 16 },

  adminMsgBox: { backgroundColor: '#FFFBEB', alignSelf: 'center', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#FDE68A', maxWidth: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginVertical: 8 },
  adminMsgHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, justifyContent: 'center' },
  adminMsgTitle: { fontSize: 12, fontWeight: '900', color: '#D97706', textTransform: 'uppercase', letterSpacing: 0.5 },
  adminMsgText: { fontSize: 14, color: '#92400E', textAlign: 'center', lineHeight: 22, fontWeight: '500' },
  adminTime: { fontSize: 10, color: '#D97706', textAlign: 'center', marginTop: 8, opacity: 0.7, fontWeight: 'bold' },

  msgRow: { flexDirection: 'row', marginBottom: 4 },
  msgRight: { justifyContent: 'flex-end' },
  msgLeft: { justifyContent: 'flex-start' },
  msgBubble: { maxWidth: '80%', padding: 16, borderRadius: 24 },
  msgBubbleMe: { backgroundColor: '#2563EB', borderBottomRightRadius: 6 },
  msgBubbleThem: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderBottomLeftRadius: 6 },
  msgSenderName: { fontSize: 12, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgTextMe: { color: '#FFFFFF' },
  msgTextThem: { color: '#334155' },
  msgTime: { fontSize: 10, marginTop: 8, fontWeight: '600' },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  msgTimeThem: { color: '#94A3B8', textAlign: 'right' },

  imgAttachmentBox: { width: 120, height: 80, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 12, marginTop: 8, justifyContent: 'center', alignItems: 'center' },

  chatFooter: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 20, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  attachBtn: { width: 44, height: 44, backgroundColor: '#F8FAFC', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  composerInput: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, minHeight: 44, maxHeight: 100, fontSize: 15, color: '#0F172A', borderWidth: 1, borderColor: '#F1F5F9' },
  sendBtn: { width: 44, height: 44, backgroundColor: '#2563EB', borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },

  sellerResolveBtn: { marginTop: 16, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#FECACA', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  sellerResolveText: { color: '#EF4444', fontSize: 14, fontWeight: '800' },

  resolvedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ECFDF5', padding: 16, borderRadius: 16 },
  resolvedText: { color: '#065F46', fontSize: 14, fontWeight: '700' },

  fullscreenOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  closeImageBtn: { position: 'absolute', top: 60, right: 24, zIndex: 100 },
  imageViewerBox: { width: '90%', height: '60%', backgroundColor: '#1E293B', borderRadius: 20, borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed' },
});