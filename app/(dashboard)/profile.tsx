import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    AlertTriangle,
    ArrowRight,
    BadgeCheck, Camera, CheckCircle2,
    ChevronRight,
    Clock,
    Fingerprint,
    HelpCircle,
    Lock,
    LogOut,
    Mail,
    Maximize2,
    MessageCircle,
    Search,
    Shield,
    ShieldCheck,
    Smartphone, Trash2, UploadCloud,
    User,
    X
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    LayoutAnimation,
    Linking,
    Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity,
    UIManager,
    View
} from 'react-native';
import { supabase } from '../../lib/supabase';

// 👉 REPLACE WITH YOUR COMPUTER'S LOCAL IP
const DASHBOARD_URL = 'http://192.168.43.78:3000/api/mobile/dashboard'; 
const PROFILE_URL = 'http://192.168.43.78:3000/api/mobile/settings/profile'; 
const KYC_URL = 'http://192.168.43.78:3000/api/mobile/settings/kyc'; 

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ProfileScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const[dashData, setDashData] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const[isUploadingKyc, setIsUploadingKyc] = useState(false);

  const [formData, setFormData] = useState({ fullName: "", avatar: null as string | null });
  const [kycFiles, setKycFiles] = useState({ front: null as string | null, back: null as string | null, selfie: null as string | null });
  
  // --- MODALS ---
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isRemoveAvatarModalOpen, setIsRemoveAvatarModalOpen] = useState(false);
  const[viewImageModal, setViewImageModal] = useState<string | null>(null);
  const[isLoggingOut, setIsLoggingOut] = useState(false);


  // --- HELP & SUPPORT ACCORDION STATE ---
  const [expandedArticle, setExpandedArticle] = useState<number | null>(null);

  const HELP_ARTICLES =[
    {
      q: "How long do disputes take ?",
      a: "Most disputes are reviewed by our Douala-based mediation team within 24-48 hours. Both parties must submit evidence (photos, chat logs) via the Resolution Center. Complex cases involving high-value items may take up to 3-5 business days."
    },
    {
      q: "My MoMo withdrawal failed ?",
      a: "Withdrawals to MTN MoMo or Orange Money are usually instant. If a withdrawal fails, it is typically due to temporary telecom network downtime. Your funds remain 100% safe in your TrustLock wallet, and you can securely retry the withdrawal after 15-30 minutes."
    },
    {
      q: "Why the 500 XAF flat fee ?",
      a: "TrustLock charges a transparent, flat fee of exactly 500 XAF per escrow transaction, regardless of the transaction size (whether it's 10,000 XAF or 1,000,000 XAF). This covers the secure banking vault and automated MoMo routing. Zero hidden percentages."
    },
    {
      q: "How to spot fake SMS payment alerts ?",
      a: "TrustLock will NEVER ask you to release an item based purely on an SMS. Scammers often send fake mobile money alerts. ALWAYS log into your TrustLock app and verify that the deal status explicitly says 'FUNDS LOCKED' before delivering any item."
    },
    {
      q: "Upgrading to a Level 2 Verified Account",
      a: "Tier 1 allows transactions up to 500,000 XAF per month. To unlock Tier 2 (up to 5,000,000 XAF), navigate to the Verification tab and upload a clear photo of your National ID (Front & Back) along with a live selfie. Approvals usually take under 24 hours."
    }
  ];

  const toggleArticle = (index: number) => {
    // Triggers a smooth native slide animation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedArticle(expandedArticle === index ? null : index);
  };

  // --- TOAST NOTIFICATION ---
  const[toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error'}>({show: false, message: '', type: 'success'});
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
      if (json.success && json.data) {
        setDashData(json.data);
        setFormData({
          fullName: json.data.user.fullName || "",
          avatar: json.data.user.avatar || null
        });
      }
    } catch (error) {
      console.error("Profile Fetch Error:", error);
    } finally {
      setIsLoading(false); setIsRefreshing(false);
    }
  };

  useFocusEffect(React.useCallback(() => { fetchDashboardData(); },[]));
  const onRefresh = () => { setIsRefreshing(true); fetchDashboardData(); };

  // --- ACTIONS ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.replace('/auth');
  };

  const pickImage = async (target: 'avatar' | 'front' | 'back' | 'selfie') => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: target === 'avatar' || target === 'selfie' ? [1, 1] :[16, 9],
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64String = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (target === 'avatar') {
        setFormData(prev => ({ ...prev, avatar: base64String }));
      } else {
        setKycFiles(prev => ({ ...prev, [target]: base64String }));
      }
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(PROFILE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ fullName: formData.fullName, avatarBase64: formData.avatar })
      });
      const json = await res.json();
      if (json.success) {
        triggerToast("Profile updated successfully!");
        fetchDashboardData();
      } else triggerToast(json.error || "Update failed.", "error");
    } catch (e) {
      triggerToast("Network error.", "error");
    }
    setIsSaving(false);
  };

  const confirmRemoveAvatar = () => {
    setFormData(prev => ({ ...prev, avatar: null }));
    setIsRemoveAvatarModalOpen(false);
    triggerToast("Avatar removed. Tap Save Changes to apply.", "success");
  };

  const handleSubmitKyc = async () => {
    if (!kycFiles.front || !kycFiles.back || !kycFiles.selfie) return;
    setIsUploadingKyc(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(KYC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(kycFiles)
      });
      const json = await res.json();
      if (json.success) {
        triggerToast("Documents submitted for review!");
        fetchDashboardData();
      } else triggerToast(json.error || "Submission failed.", "error");
    } catch (e) {
      triggerToast("Network error.", "error");
    }
    setIsUploadingKyc(false);
  };

  if (isLoading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2563EB" /></View>;

  const user = dashData?.user;
  const kycStatus = user?.kycStatus || 'TIER_1';
  const kycLevel = user?.kycLevel || 1;
  const isTier2 = kycStatus === 'TIER_2' || kycLevel >= 2;

  const displayFullName = formData.fullName || user?.fullName || "User";
  const userInitials = displayFullName.charAt(0).toUpperCase();

  let pendingDocs: any = null;
  if (kycStatus === 'PENDING' && user?.kycDocument) {
    try { pendingDocs = JSON.parse(user.kycDocument); } catch (e) {}
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

      {/* FULLSCREEN IMAGE VIEWER */}
      {viewImageModal && (
        <Modal visible transparent animationType="fade">
          <View style={styles.fullscreenOverlay}>
            <TouchableOpacity style={styles.closeImageBtn} onPress={() => setViewImageModal(null)}>
              <X color="#FFF" size={24} />
            </TouchableOpacity>
            <Image source={{ uri: viewImageModal }} style={styles.fullscreenImage} />
          </View>
        </Modal>
      )}

      {/* SECURE LOGOUT MODAL */}
      <Modal visible={isLogoutModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.logoutIconBubble}>
              <LogOut color="#EF4444" size={32} />
            </View>
            <Text style={styles.modalTitle}>Securely log out?</Text>
            <Text style={styles.modalDesc}>Your session will be closed. You will need your phone to receive a new SMS code the next time you log in.</Text>
            
            <TouchableOpacity onPress={handleLogout} disabled={isLoggingOut} style={styles.btnDanger}>
              {isLoggingOut ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnDangerText}>Yes, Log Out</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsLogoutModalOpen(false)} disabled={isLoggingOut} style={styles.btnCancel}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* REMOVE AVATAR CONFIRMATION MODAL */}
      <Modal visible={isRemoveAvatarModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.logoutIconBubble}>
              <Trash2 color="#EF4444" size={32} />
            </View>
            <Text style={styles.modalTitle}>Remove Photo?</Text>
            <Text style={styles.modalDesc}>This will delete your current avatar and revert to your initials. This action cannot be undone.</Text>
            
            <TouchableOpacity onPress={confirmRemoveAvatar} style={styles.btnDanger}>
              <Text style={styles.btnDangerText}>Yes, Remove Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsRemoveAvatarModalOpen(false)} style={styles.btnCancel}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* HEADER */}
      <View style={styles.headerArea}>
        <Text style={styles.pageTitle}>Settings</Text>
        <TouchableOpacity style={styles.headerLogoutBtn} onPress={() => setIsLogoutModalOpen(true)}>
          <LogOut color="#EF4444" size={20} />
        </TouchableOpacity>
      </View>

      {/* PREMIUM TABS */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'security', label: 'Security', icon: Shield },
            { id: 'kyc', label: 'Verification', icon: BadgeCheck },
            { id: 'help', label: 'Help', icon: HelpCircle }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity 
                key={tab.id} 
                onPress={() => setActiveTab(tab.id)} 
                activeOpacity={0.8}
                style={[styles.tabPill, isActive ? styles.tabPillActive : styles.tabPillInactive]}
              >
                <Icon color={isActive ? "#FFFFFF" : "#64748B"} size={16} strokeWidth={isActive ? 2.5 : 2} />
                <Text style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextInactive]}>{tab.label}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#2563EB" />}>
        
        {/* =======================================================
            TAB: PROFILE
            ======================================================= */}
        {activeTab === 'profile' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Personal Information</Text>
              <Text style={styles.cardDesc}>Update your basic profile details and avatar.</Text>
            </View>

            {/* NATIVE AVATAR UPLOAD & PREVIEW */}
            <View style={styles.avatarSection}>
              <TouchableOpacity 
                style={styles.avatarBox} 
                activeOpacity={0.8}
                onPress={() => formData.avatar ? setViewImageModal(formData.avatar) : pickImage('avatar')}
              >
                {formData.avatar ? (
                  <>
                    <Image source={{ uri: formData.avatar }} style={styles.avatarImage} />
                    <View style={styles.avatarEnlargeOverlay}><Maximize2 color="#FFF" size={24} /></View>
                  </>
                ) : (
                  <LinearGradient colors={['#0EA5E9', '#10B981']} style={styles.avatarImage}>
                    <Text style={styles.avatarInitialText}>{userInitials}</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
              
              <View style={styles.avatarActions}>
                <TouchableOpacity style={styles.avatarUploadBtn} onPress={() => pickImage('avatar')}>
                  <Camera color="#0F172A" size={16} />
                  <Text style={styles.avatarUploadText}>Change Photo</Text>
                </TouchableOpacity>
                {formData.avatar && (
                  <TouchableOpacity style={styles.avatarRemoveBtn} onPress={() => setIsRemoveAvatarModalOpen(true)}>
                    <Trash2 color="#EF4444" size={16} />
                  </TouchableOpacity>
                )}
                <Text style={styles.helperTextSmall}>Tap image to view full screen.</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Form Fields */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <User color="#94A3B8" size={20} />
                <TextInput 
                  value={formData.fullName} onChangeText={(txt) => setFormData({...formData, fullName: txt})}
                  placeholder="Enter your full name" style={styles.input}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.verifiedBadge}><CheckCircle2 color="#10B981" size={12} /><Text style={styles.verifiedText}>Verified</Text></View>
              </View>
              <View style={[styles.inputWrapper, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                <Smartphone color="#94A3B8" size={20} />
                <Text style={styles.disabledInput}>+237 {user?.phoneNumber}</Text>
              </View>
            </View>

            <TouchableOpacity 
              activeOpacity={0.8} 
              disabled={isSaving || !formData.fullName.trim()}
              onPress={handleSaveProfile} 
              style={[styles.saveBtn, (!formData.fullName.trim() || isSaving) && styles.saveBtnDisabled]}
            >
              {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* =======================================================
            TAB: SECURITY
            ======================================================= */}
        {activeTab === 'security' && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Authentication Methods</Text>
                <Text style={styles.cardDesc}>Manage how you access your account.</Text>
              </View>
              
              <View style={styles.securityRow}>
                <View style={styles.securityIconBox}><Smartphone color="#2563EB" size={20} /></View>
                <View style={styles.securityTextCol}>
                  <Text style={styles.securityTitle}>Passwordless SMS</Text>
                  <Text style={styles.securityDesc}>Log in securely using an OTP sent to your phone.</Text>
                </View>
                <View style={styles.activePill}><Text style={styles.activePillText}>Active</Text></View>
              </View>

              <View style={styles.divider} />

              <View style={styles.securityRow}>
                <View style={[styles.securityIconBox, {backgroundColor: '#F1F5F9'}]}><Fingerprint color="#64748B" size={20} /></View>
                <View style={styles.securityTextCol}>
                  <Text style={styles.securityTitle}>Biometric Auth</Text>
                  <Text style={styles.securityDesc}>Require Face ID or Touch ID for transferring funds.</Text>
                </View>
                <View style={styles.toggleSwitch}><View style={styles.toggleKnob}/></View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}><Text style={styles.cardTitle}>Withdrawal PIN</Text></View>
              <View style={styles.securityRow}>
                <View style={styles.securityTextCol}>
                  <Text style={styles.securityTitle}>Require PIN for Payouts</Text>
                  <Text style={styles.securityDesc}>Set a 4-digit PIN to secure your wallet transfers.</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.blackBtn}>
                <Lock color="#FFF" size={16} /><Text style={styles.blackBtnText}>Setup Secure PIN</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* =======================================================
            TAB: KYC & VERIFICATION
            ======================================================= */}
        {activeTab === 'kyc' && (
          <>
            <LinearGradient colors={['#0F172A', '#1E3A8A']} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.tierBanner}>
              <Text style={styles.tierBannerSub}>VERIFICATION STATUS</Text>
              <View style={styles.tierTitleRow}>
                <Text style={styles.tierBannerTitle}>{kycStatus === 'PENDING' ? 'Tier 1' : isTier2 ? 'Tier 2' : 'Tier 1'} Verified</Text>
                <BadgeCheck color="#34D399" size={24} />
              </View>
              <Text style={styles.tierBannerDesc}>
                {isTier2 ? "Your identity is fully verified. You can transact up to 5,000,000 XAF per month." : "You can currently transact up to 500,000 XAF per month. Upgrade to Tier 2 to increase limits."}
              </Text>
              
              <View style={styles.limitBox}>
                <Text style={styles.limitBoxSub}>MONTHLY LIMIT</Text>
                <Text style={styles.limitBoxVal}>{isTier2 ? '5M' : '500k'} <Text style={{fontSize: 14, color: '#93C5FD'}}>XAF</Text></Text>
              </View>
            </LinearGradient>

            {isTier2 ? (
              <View style={styles.successStateCard}>
                <View style={styles.successIconBubble}><ShieldCheck color="#10B981" size={40} /></View>
                <Text style={styles.successStateTitle}>Maximum Verification Reached</Text>
                <Text style={styles.successStateDesc}>Congratulations! Your identity has been fully verified by our compliance team. You have unlocked all features.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Identity Verification (Tier 2)</Text>
                  <Text style={styles.cardDesc}>Provide clear photos of your ID and a selfie.</Text>
                </View>

                {kycStatus === 'PENDING' ? (
                  <View style={styles.pendingBox}>
                    <Clock color="#F59E0B" size={32} />
                    <Text style={styles.pendingTitle}>Documents Under Review</Text>
                    <Text style={styles.pendingDesc}>Our compliance team is securely reviewing your documents. This usually takes less than 24 hours.</Text>
                    
                    {/* Embedded preview of pending docs */}
                    {pendingDocs && (
                      <View style={styles.pendingDocsGrid}>
                        <TouchableOpacity onPress={() => setViewImageModal(pendingDocs.front)} style={styles.pendingDocImgWrapper}>
                          <Image source={{uri: pendingDocs.front}} style={styles.pendingDocImg}/>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setViewImageModal(pendingDocs.back)} style={styles.pendingDocImgWrapper}>
                          <Image source={{uri: pendingDocs.back}} style={styles.pendingDocImg}/>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.uploadGrid}>
                    <View style={styles.uploadItem}>
                      <Text style={styles.uploadLabel}>1. ID Front</Text>
                      <TouchableOpacity onPress={() => kycFiles.front ? setViewImageModal(kycFiles.front) : pickImage('front')} style={[styles.uploadBox, kycFiles.front && styles.uploadBoxSuccess]}>
                        {kycFiles.front ? <Image source={{ uri: kycFiles.front }} style={styles.uploadedImg} /> : <Camera color="#94A3B8" size={24} />}
                        {kycFiles.front && <View style={styles.uploadCheck}><CheckCircle2 color="#10B981" size={16} fill="#FFF"/></View>}
                      </TouchableOpacity>
                      {kycFiles.front && <TouchableOpacity onPress={() => pickImage('front')}><Text style={styles.reuploadText}>Retake Image</Text></TouchableOpacity>}
                    </View>

                    <View style={styles.uploadItem}>
                      <Text style={styles.uploadLabel}>2. ID Back</Text>
                      <TouchableOpacity onPress={() => kycFiles.back ? setViewImageModal(kycFiles.back) : pickImage('back')} style={[styles.uploadBox, kycFiles.back && styles.uploadBoxSuccess]}>
                        {kycFiles.back ? <Image source={{ uri: kycFiles.back }} style={styles.uploadedImg} /> : <Camera color="#94A3B8" size={24} />}
                        {kycFiles.back && <View style={styles.uploadCheck}><CheckCircle2 color="#10B981" size={16} fill="#FFF"/></View>}
                      </TouchableOpacity>
                      {kycFiles.back && <TouchableOpacity onPress={() => pickImage('back')}><Text style={styles.reuploadText}>Retake Image</Text></TouchableOpacity>}
                    </View>

                    <View style={styles.uploadItem}>
                      <Text style={styles.uploadLabel}>3. Clear Selfie</Text>
                      <TouchableOpacity onPress={() => kycFiles.selfie ? setViewImageModal(kycFiles.selfie) : pickImage('selfie')} style={[styles.uploadBox, kycFiles.selfie && styles.uploadBoxSuccess]}>
                        {kycFiles.selfie ? <Image source={{ uri: kycFiles.selfie }} style={styles.uploadedImg} /> : <User color="#94A3B8" size={24} />}
                        {kycFiles.selfie && <View style={styles.uploadCheck}><CheckCircle2 color="#10B981" size={16} fill="#FFF"/></View>}
                      </TouchableOpacity>
                      {kycFiles.selfie && <TouchableOpacity onPress={() => pickImage('selfie')}><Text style={styles.reuploadText}>Retake Selfie</Text></TouchableOpacity>}
                    </View>

                    <TouchableOpacity 
                      disabled={isUploadingKyc || !kycFiles.front || !kycFiles.back || !kycFiles.selfie}
                      onPress={handleSubmitKyc}
                      style={[styles.blackBtn, {marginTop: 16}, (!kycFiles.front || !kycFiles.back || !kycFiles.selfie) && styles.saveBtnDisabled]}
                    >
                      {isUploadingKyc ? <ActivityIndicator color="#FFF" /> : <><UploadCloud color="#FFF" size={18} /><Text style={styles.blackBtnText}>Submit Documents</Text></>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* =======================================================
            TAB: HELP & SUPPORT
            ======================================================= */}
        {activeTab === 'help' && (
          <View style={styles.helpContainer}>
            
            {/* Search Bar */}
            <View style={styles.helpSearchBox}>
              <Search color="#94A3B8" size={20} />
              <TextInput 
                placeholder="Search for answers..." 
                placeholderTextColor="#94A3B8"
                style={styles.helpSearchInput}
              />
            </View>

            {/* Horizontal Contact Carousel */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.helpCarousel}
              snapToAlignment="center"
              decelerationRate="fast"
              snapToInterval={Dimensions.get('window').width - 48} // Snaps perfectly to the next card
            >
              {/* WhatsApp Card */}
              <LinearGradient colors={['#10B981', '#059669']} style={styles.contactCard}>
                <View style={styles.contactCardHeader}>
                  <View style={styles.contactIconBg}>
                    <MessageCircle color="#059669" size={24} />
                  </View>
                  <Text style={styles.contactCardTitle}>Chat with us</Text>
                </View>
                <Text style={styles.contactCardDesc}>
                  Our Douala-based support team is online 24/7 to help you with active transactions and disputes.
                </Text>
                <TouchableOpacity 
                  style={styles.contactBtn} 
                  activeOpacity={0.8}
                  onPress={() => Linking.openURL('https://wa.me/237679638540')}
                >
                  <Text style={styles.contactBtnTextWhatsApp}>Start Chat</Text>
                  <ArrowRight color="#059669" size={16} strokeWidth={3} />
                </TouchableOpacity>
              </LinearGradient>

              {/* Email Support Card */}
              <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.contactCard}>
                <View style={styles.contactCardHeader}>
                  <View style={styles.contactIconBg}>
                    <Mail color="#1D4ED8" size={24} />
                  </View>
                  <Text style={styles.contactCardTitle}>Email Support</Text>
                </View>
                <Text style={styles.contactCardDesc}>
                  Prefer to send a detailed message? Drop us an email and our support team will reply within 24 hours.
                </Text>
                <TouchableOpacity 
                  style={styles.contactBtn} 
                  activeOpacity={0.8}
                  onPress={() => Linking.openURL('mailto:nditafonhysonn@gmail.com')}
                >
                  <Text style={styles.contactBtnTextEmail}>Send Email</Text>
                  <ArrowRight color="#1D4ED8" size={16} strokeWidth={3} />
                </TouchableOpacity>
              </LinearGradient>
            </ScrollView>

            {/* Popular Articles */}
            <Text style={styles.articlesTitle}>Popular Articles</Text>
            <View style={styles.articlesList}>
              {HELP_ARTICLES.map((article, i) => {
                const isExpanded = expandedArticle === i;
                return (
                  <TouchableOpacity 
                    key={i} 
                    style={[styles.articleCard, isExpanded && styles.articleCardExpanded]} 
                    activeOpacity={0.8}
                    onPress={() => toggleArticle(i)}
                  >
                    <View style={styles.articleHeader}>
                      <Text style={[styles.articleText, isExpanded && { color: '#2563EB' }]}>{article.q}</Text>
                      {isExpanded ? (
                        <View style={styles.articleIconActive}><ChevronRight color="#2563EB" size={16} strokeWidth={3} style={{transform: [{rotate: '90deg'}]}} /></View>
                      ) : (
                        <ChevronRight color="#CBD5E1" size={20} strokeWidth={2.5} />
                      )}
                    </View>
                    
                    {isExpanded && (
                      <View style={styles.articleAnswerBox}>
                        <Text style={styles.articleAnswerText}>{article.a}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  
  toastContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 55 : 35, left: 24, right: 24, zIndex: 999, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10, gap: 12 },
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },

  // Header
  headerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 16 },
  pageTitle: { fontSize: 32, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  headerLogoutBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },

  // Fancy Tabs
  tabsWrapper: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tabsScroll: { paddingHorizontal: 20, gap: 12, paddingBottom: 16 },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1 },
  tabPillActive: { backgroundColor: '#2563EB', borderColor: '#2563EB', shadowColor: '#2563EB', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  tabPillInactive: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  tabText: { fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },
  tabTextInactive: { color: '#64748B' },

  listContent: { padding: 24, paddingBottom: Platform.OS === 'ios' ? 140 : 120, gap: 24 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  cardHeader: { marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#64748B' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 24 },

  // Profile Avatar
  avatarSection: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  avatarBox: { position: 'relative', width: 88, height: 88, borderRadius: 44, overflow: 'hidden', shadowColor: '#000', shadowOffset: {width: 0, height: 5}, shadowOpacity: 0.1, shadowRadius: 10 },
  avatarImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarEnlargeOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', opacity: 0 },
  avatarInitialText: { fontSize: 36, fontWeight: '900', color: '#FFFFFF' },
  avatarActions: { flex: 1, alignItems: 'flex-start' },
  avatarUploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginBottom: 8 },
  avatarUploadText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  avatarRemoveBtn: { position: 'absolute', right: 0, top: 0, padding: 10, backgroundColor: '#FEF2F2', borderRadius: 12 },
  helperTextSmall: { fontSize: 11, color: '#94A3B8', marginTop: 4 },

  inputGroup: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 16, height: 56, paddingHorizontal: 16, gap: 12 },
  input: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0F172A' },
  disabledInput: { flex: 1, fontSize: 15, fontWeight: '700', color: '#64748B', letterSpacing: 1 },
  helperText: { fontSize: 11, color: '#94A3B8', marginTop: 8 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  verifiedText: { fontSize: 10, fontWeight: '800', color: '#10B981', textTransform: 'uppercase' },

  saveBtn: { backgroundColor: '#2563EB', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { backgroundColor: '#94A3B8' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // Security
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  securityIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  securityTextCol: { flex: 1 },
  securityTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  securityDesc: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  activePill: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#A7F3D0' },
  activePillText: { color: '#10B981', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  toggleSwitch: { width: 48, height: 28, backgroundColor: '#2563EB', borderRadius: 14, justifyContent: 'center', paddingHorizontal: 2 },
  toggleKnob: { width: 24, height: 24, backgroundColor: '#FFFFFF', borderRadius: 12, alignSelf: 'flex-end', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5 },
  
  blackBtn: { backgroundColor: '#0F172A', height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 24 },
  blackBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  // KYC
  tierBanner: { borderRadius: 28, padding: 32, shadowColor: '#1E3A8A', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  tierBannerSub: { color: '#93C5FD', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  tierTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  tierBannerTitle: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  tierBannerDesc: { color: '#BFDBFE', fontSize: 13, lineHeight: 20, marginBottom: 24 },
  limitBox: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 16, alignSelf: 'flex-start' },
  limitBoxSub: { color: '#93C5FD', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  limitBoxVal: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  successStateCard: { backgroundColor: '#ECFDF5', borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#A7F3D0' },
  successIconBubble: { width: 80, height: 80, backgroundColor: '#D1FAE5', borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 4, borderColor: '#FFFFFF', shadowColor: '#10B981', shadowOpacity: 0.2, shadowRadius: 10 },
  successStateTitle: { fontSize: 18, fontWeight: '900', color: '#065F46', marginBottom: 8, textAlign: 'center' },
  successStateDesc: { fontSize: 13, color: '#047857', textAlign: 'center', lineHeight: 22 },

  pendingBox: { backgroundColor: '#FFFBEB', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#FDE68A' },
  pendingTitle: { fontSize: 16, fontWeight: '800', color: '#B45309', marginTop: 12, marginBottom: 8 },
  pendingDesc: { fontSize: 13, color: '#D97706', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  pendingDocsGrid: { flexDirection: 'row', gap: 12, width: '100%', justifyContent: 'center' },
  pendingDocImgWrapper: { width: 80, height: 50, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#FDE68A' },
  pendingDocImg: { width: '100%', height: '100%', resizeMode: 'cover' },

  uploadGrid: { gap: 16 },
  uploadItem: { gap: 8 },
  uploadLabel: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  uploadBox: { width: '100%', height: 160, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  uploadBoxSuccess: { borderColor: '#10B981', borderStyle: 'solid' },
  uploadedImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  uploadCheck: { position: 'absolute', top: 12, right: 12, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  reuploadText: { fontSize: 11, fontWeight: '700', color: '#2563EB', textAlign: 'right' },

  // Help & Support
  helpContainer: { gap: 24, paddingBottom: 24 },
  
  helpSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 16, height: 56, paddingHorizontal: 16, gap: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.02, shadowRadius: 8, elevation: 2 },
  helpSearchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0F172A' },
  
  helpCarousel: { gap: 16, paddingRight: 48 }, // paddingRight allows the last card to scroll fully
  contactCard: { width: Dimensions.get('window').width - 72, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.2, shadowRadius: 15, elevation: 8, justifyContent: 'space-between' },
  contactCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  contactIconBg: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 5 },
  contactCardTitle: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  contactCardDesc: { fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 22, marginBottom: 24, fontWeight: '500' },
  
  contactBtn: { backgroundColor: '#FFFFFF', alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 5 },
  contactBtnTextWhatsApp: { color: '#059669', fontSize: 15, fontWeight: '900' },
  contactBtnTextEmail: { color: '#1D4ED8', fontSize: 15, fontWeight: '900' },
  
  articlesTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginTop: 8 },
  articlesList: { gap: 12 },
  articleCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  articleCardExpanded: { borderColor: '#DBEAFE', backgroundColor: '#F8FAFC', shadowOpacity: 0 },
  articleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  articleText: { fontSize: 14, fontWeight: '800', color: '#0F172A', flex: 1, paddingRight: 16, lineHeight: 20 },
  articleIconActive: { width: 28, height: 28, backgroundColor: '#DBEAFE', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  articleAnswerBox: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  articleAnswerText: { fontSize: 14, color: '#475569', lineHeight: 24, fontWeight: '500' },


  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFFFFF', width: '100%', borderRadius: 32, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 20}, shadowOpacity: 0.2, shadowRadius: 30, elevation: 15 },
  logoutIconBubble: { width: 72, height: 72, backgroundColor: '#FEF2F2', borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 4, borderColor: '#FFFFFF', shadowColor: '#EF4444', shadowOpacity: 0.1, shadowRadius: 10 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  modalDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btnDanger: { width: '100%', backgroundColor: '#EF4444', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12 },
  btnDangerText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  btnCancel: { width: '100%', backgroundColor: '#F8FAFC', paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  btnCancelText: { color: '#64748B', fontSize: 16, fontWeight: '800' },


  fullscreenOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  closeImageBtn: { position: 'absolute', top: 60, right: 24, zIndex: 100, width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  fullscreenImage: { width: '100%', height: '80%', resizeMode: 'contain' }
});