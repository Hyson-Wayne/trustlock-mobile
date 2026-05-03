import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, Send } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated, // ← added for toast
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from '../../lib/supabase';

// 👉 REPLACE WITH YOUR COMPUTER'S LOCAL IP
const API_URL = 'http://192.168.43.78:3000/api/mobile/escrows/create';

export default function CreateTransactionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // --- FORM STATES ---
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  // --- UI STATES ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMomoModal, setShowMomoModal] = useState(false);
  const [momoStatus, setMomoStatus] = useState<'WAITING' | 'SUCCESS'>('WAITING');

  // --- CUSTOM PREMIUM TOAST STATE ---
  const [toast, setToast] = useState<{show: boolean; message: string; type: 'success' | 'error'}>({
    show: false,
    message: '',
    type: 'success'
  });
  const toastAnim = React.useRef(new Animated.Value(-150)).current;

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    Animated.spring(toastAnim, {
      toValue: 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true
    }).start();

    setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: -150,
        duration: 400,
        useNativeDriver: true
      }).start(() => {
        setToast(prev => ({ ...prev, show: false }));
      });
    }, 4000);
  };

  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.initialRole === 'seller' || params.initialRole === 'buyer') {
      setRole(params.initialRole as 'buyer' | 'seller');
    }
  }, [params.initialRole]);

  // --- TELECOM DETECTION ---
  const getNetwork = (num: string) => {
    if (num.length < 2) return null;
    const prefix = num.substring(0, 2);
    const prefix3 = num.substring(0, 3);
    if (['67', '68'].includes(prefix) || ['650','651','652','653','654'].includes(prefix3)) return 'MTN';
    if (['69'].includes(prefix) ||['655','656','657','658','659'].includes(prefix3)) return 'ORANGE';
    return null;
  };

  const network = getNetwork(phone);

  // --- FORMATTERS ---
  const formatNumber = (val: string) => {
    const cleaned = val.replace(/\D/g, '');
    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleAmountChange = (text: string) => {
    setAmount(formatNumber(text));
  };

  const numericAmount = parseInt(amount.replace(/,/g, '')) || 0;
  const FLAT_FEE = 500;
  const totalToLock = numericAmount + FLAT_FEE;

  // --- SUBMISSION LOGIC ---
  const handleSubmit = async () => {
    if (phone.length !== 9 || !description.trim() || numericAmount <= 0) {
      triggerToast("Please fill all fields correctly.", 'error');
      return;
    }

    if (role === 'buyer') {
      setMomoStatus('WAITING');
      setShowMomoModal(true);
      
      setTimeout(() => {
        executeDatabaseTransaction();
      }, 4000);
    } else {
      setIsSubmitting(true);
      executeDatabaseTransaction();
    }
  };

  const executeDatabaseTransaction = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const payload = {
        role,
        counterpartyPhone: phone,
        description: description.trim(),
        amount: numericAmount,
        paymentMethod: network?.toLowerCase() || 'mtn'
      };

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      // Inside executeDatabaseTransaction function, replace the success blocks:

      if (json.success) {
        if (role === 'buyer') {
          setMomoStatus('SUCCESS');
          setTimeout(() => {
            setShowMomoModal(false);
            triggerToast("Funds locked securely! Track progress on your home screen.", 'success');
            router.push('/home');
          }, 1500);
        } else {
          triggerToast("Payment request sent! We'll notify you when the buyer locks the funds.", 'success');
          router.push('/home');
        }
      }else {
        triggerToast(json.error || "Failed to create transaction.", 'error');
        setShowMomoModal(false);
      }
    } catch (e) {
      triggerToast("Network error. Please check your connection.", 'error');
      setShowMomoModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        
        {/* --- MOMO CONFIRMATION MODAL --- */}
        <Modal visible={showMomoModal} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.momoModal}>
              
              {momoStatus === 'WAITING' ? (
                <>
                  <View style={styles.spinnerContainer}>
                    <Svg width="80" height="80" viewBox="0 0 100 100" style={styles.spinnerSvg}>
                      <Circle cx="50" cy="50" r="46" stroke="#DBEAFE" strokeWidth="4" fill="none" />
                      <Circle cx="50" cy="50" r="46" stroke="#2563EB" strokeWidth="4" strokeDasharray="290" strokeDashoffset="200" strokeLinecap="round" fill="none" />
                    </Svg>
                    <View style={[styles.networkLogo, { backgroundColor: network === 'ORANGE' ? '#F97316' : '#FFCC00' }]}>
                      <Text style={[styles.networkLogoText, { color: network === 'ORANGE' ? '#FFF' : '#000' }]}>{network === 'ORANGE' ? 'OM' : 'MTN'}</Text>
                    </View>
                  </View>

                  <Text style={styles.modalTitle}>Confirm Payment</Text>
                  <Text style={styles.modalDesc}>
                    Please check your phone. We have sent a prompt to <Text style={{fontWeight: '800', color: '#0F172A'}}>+237 {phone.substring(0,3)} {phone.substring(3,6)} {phone.substring(6)}</Text>. Enter your MoMo PIN to lock the funds.
                  </Text>

                  <View style={styles.ussdBox}>
                    <Text style={styles.ussdTitle}>Didn't receive the prompt? Dial:</Text>
                    <Text style={styles.ussdCode}>{network === 'ORANGE' ? '#150*50#' : '*126#'}</Text>
                  </View>

                  <TouchableOpacity onPress={() => setShowMomoModal(false)} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel Transaction</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.successState}>
                  <View style={styles.successIconBox}><CheckCircle2 color="#10B981" size={40} /></View>
                  <Text style={styles.modalTitle}>Payment Locked!</Text>
                  <Text style={styles.modalDesc}>Your funds have been securely moved to the TrustLock vault.</Text>
                </View>
              )}
              
              <View style={styles.modalHandle} />
            </View>
          </View>
        </Modal>

        {/* --- HEADER --- */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color="#0F172A" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Transaction</Text>
          <View style={{width: 44}} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          {/* TOGGLE ROLE */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity onPress={() => setRole('buyer')} style={[styles.toggleBtn, role === 'buyer' && styles.toggleBtnActive]}>
              <Text style={[styles.toggleText, role === 'buyer' && styles.toggleTextActive]}>I am Buying</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRole('seller')} style={[styles.toggleBtn, role === 'seller' && styles.toggleBtnActive]}>
              <Text style={[styles.toggleText, role === 'seller' && styles.toggleTextActive]}>I am Selling</Text>
            </TouchableOpacity>
          </View>

          {/* PHONE INPUT */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{role === 'buyer' ? "Seller's" : "Buyer's"} Mobile Number</Text>
            <View style={[styles.inputWrapper, phone.length === 9 && styles.inputWrapperActive]}>
              <Text style={styles.flag}>🇨🇲</Text>
              <Text style={styles.prefix}>+237</Text>
              <View style={styles.divider} />
              <TextInput 
                value={phone}
                onChangeText={(text) => setPhone(text.replace(/\D/g, '').substring(0, 9))}
                keyboardType="numeric"
                placeholder="6XX XXX XXX"
                placeholderTextColor="#CBD5E1"
                style={styles.inputPhone}
              />
              {network === 'MTN' && <View style={styles.badgeMtn}><Text style={styles.badgeMtnText}>MTN</Text></View>}
              {network === 'ORANGE' && <View style={styles.badgeOrange}><Text style={styles.badgeOrangeText}>OM</Text></View>}
            </View>
          </View>

          {/* DESCRIPTION INPUT */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Item Description</Text>
            <View style={styles.inputWrapper}>
              <TextInput 
                value={description}
                onChangeText={setDescription}
                placeholder={role === 'buyer' ? "e.g. Used iPhone 13 Pro" : "e.g. Freelance UI Design Project"}
                placeholderTextColor="#CBD5E1"
                style={styles.inputText}
              />
            </View>
          </View>

          {/* AMOUNT INPUT */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Agreed Price</Text>
            <View style={styles.inputWrapper}>
              <TextInput 
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#CBD5E1"
                style={styles.inputAmount}
              />
              <Text style={styles.currencySuffix}>XAF</Text>
            </View>
          </View>

          {/* DYNAMIC SUMMARY CARD */}
          {(numericAmount > 0 || description.trim().length > 0) && (
            <View style={role === 'buyer' ? styles.summaryCardBuyer : styles.summaryCardSeller}>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Item</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{description || "..."}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Price</Text>
                <Text style={styles.summaryValue}>{amount || "0"} XAF</Text>
              </View>
              
              <View style={[styles.summaryRow, { borderBottomWidth: 1, borderBottomColor: role === 'buyer' ? '#DBEAFE' : '#A7F3D0', paddingBottom: 16, marginBottom: 16 }]}>
                <Text style={styles.summaryLabel}>TrustLock Fee</Text>
                <View style={{alignItems: 'flex-end'}}>
                  {role === 'seller' && <Text style={{fontSize: 9, color: '#059669', fontWeight: '700'}}>Paid by Buyer</Text>}
                  <Text style={styles.summaryValue}>{role === 'buyer' ? '500 XAF' : '(500)'}</Text>
                </View>
              </View>

              <View style={styles.summaryTotalRow}>
                <Text style={role === 'buyer' ? styles.summaryTotalLabelBuyer : styles.summaryTotalLabelSeller}>
                  {role === 'buyer' ? 'Total to Lock' : 'You Will Receive'}
                </Text>
                <Text style={role === 'buyer' ? styles.summaryTotalValueBuyer : styles.summaryTotalValueSeller}>
                  {role === 'buyer' ? formatNumber(totalToLock.toString()) : (amount || "0")} <Text style={{fontSize: 12}}>XAF</Text>
                </Text>
              </View>

            </View>
          )}
        </ScrollView>

        {/* BOTTOM ACTION BUTTON */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TouchableOpacity 
            activeOpacity={0.8} 
            disabled={isSubmitting || phone.length !== 9 || !description || numericAmount <= 0}
            onPress={handleSubmit}
            style={[
              styles.actionBtn, 
              role === 'buyer' ? styles.actionBtnBuyer : styles.actionBtnSeller,
              (isSubmitting || phone.length !== 9 || !description || numericAmount <= 0) && styles.actionBtnDisabled
            ]}
          >
            {isSubmitting ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Text style={styles.actionBtnText}>{role === 'buyer' ? 'Lock Funds' : 'Send Payment Request'}</Text>
                {role === 'buyer' ? <Lock color="#FFF" size={18} /> : <Send color="#FFF" size={18} />}
              </>
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ==========================================
// STYLESHEET
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 8 : 16, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },

  scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },

  // Toggle
  toggleContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 4, borderRadius: 16, marginBottom: 32 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  toggleText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  toggleTextActive: { color: '#2563EB' },

  // Inputs
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 16, height: 60, paddingHorizontal: 16 },
  inputWrapperActive: { borderColor: '#F59E0B' },
  flag: { fontSize: 18 },
  prefix: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginLeft: 8 },
  divider: { width: 1, height: 24, backgroundColor: '#E2E8F0', marginHorizontal: 12 },
  inputPhone: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0F172A', letterSpacing: 2 },
  inputText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0F172A' },
  inputAmount: { flex: 1, fontSize: 20, fontWeight: '800', color: '#2563EB' },
  currencySuffix: { fontSize: 14, fontWeight: '800', color: '#94A3B8' },

  // Network Badges
  badgeMtn: { backgroundColor: '#FFCC00', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeMtnText: { color: '#000000', fontSize: 11, fontWeight: '900' },
  badgeOrange: { backgroundColor: '#F97316', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeOrangeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },

  // Summary Cards
  summaryCardBuyer: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#BFDBFE', borderStyle: 'dashed', borderRadius: 20, padding: 20, marginTop: 8 },
  summaryCardSeller: { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 20, padding: 20, marginTop: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryLabel: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  summaryValue: { fontSize: 13, fontWeight: '800', color: '#0F172A', maxWidth: '60%', textAlign: 'right' },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryTotalLabelBuyer: { fontSize: 15, fontWeight: '900', color: '#0F172A' },
  summaryTotalValueBuyer: { fontSize: 24, fontWeight: '900', color: '#2563EB' },
  summaryTotalLabelSeller: { fontSize: 15, fontWeight: '900', color: '#065F46' },
  summaryTotalValueSeller: { fontSize: 24, fontWeight: '900', color: '#065F46' },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#FAFAFA',
  },
  actionBtn: { height: 60, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.15, shadowRadius: 20, elevation: 5 },
  actionBtnBuyer: { backgroundColor: '#2563EB' },
  actionBtnSeller: { backgroundColor: '#2563EB' },
  actionBtnDisabled: { backgroundColor: '#E2E8F0', shadowOpacity: 0 },
  actionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // MoMo Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  momoModal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: -10}, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  
  spinnerContainer: { position: 'relative', width: 80, height: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  spinnerSvg: { position: 'absolute', transform:[{ rotate: '-90deg' }] },
  networkLogo: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  networkLogoText: { fontSize: 12, fontWeight: '900' },

  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  modalDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 16 },

  ussdBox: { backgroundColor: '#F8FAFC', width: '100%', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#F1F5F9' },
  ussdTitle: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 },
  ussdCode: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: 2 },

  cancelBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  cancelBtnText: { color: '#0F172A', fontSize: 14, fontWeight: '700' },

  successState: { alignItems: 'center', paddingVertical: 40 },
  successIconBox: { width: 80, height: 80, backgroundColor: '#D1FAE5', borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },

  modalHandle: { width: 48, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, position: 'absolute', bottom: 12 },

  // 🍞 Premium Toast Styles
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 35,
    left: 20,
    right: 20,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    lineHeight: 20,
    letterSpacing: 0.2
  },
});