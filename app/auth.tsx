import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  Lock,
  ShieldCheck,
  User,
  Zap,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type AuthStep = 'SIGNUP' | 'LOGIN' | 'OTP' | 'BIOMETRICS';

export default function AuthScreen() {
  const router = useRouter();

  // State
  const [step, setStep] = useState<AuthStep>('LOGIN');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [name, setName] = useState('');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [phoneFormatted, setPhoneFormatted] = useState('');
  const [carrier, setCarrier] = useState<'mtn' | 'orange' | null>(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(0);
  const otpRefs = useRef<Array<TextInput | null>>([]);

  // Biometrics
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
    })();
  }, []);

  useEffect(() => {
    if (step === 'OTP' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, timeLeft]);

  // Helper functions
  const detectCarrier = (raw: string) => {
    if (raw.length < 2) return null;
    const p2 = raw.substring(0, 2);
    const p3 = raw.substring(0, 3);
    if (p2 === '69' || (p2 === '65' && parseInt(p3[2] || '0') >= 5)) return 'orange';
    if (p2 === '67' || p2 === '68' || (p2 === '65' && parseInt(p3[2] || '9') <= 4)) return 'mtn';
    return null;
  };

  const formatPhone = (raw: string) => {
    const val = raw.replace(/\D/g, '').substring(0, 9);
    if (val.length > 6) return `${val.slice(0, 3)} ${val.slice(3, 6)} ${val.slice(6)}`;
    if (val.length > 3) return `${val.slice(0, 3)} ${val.slice(3)}`;
    return val;
  };

  const handlePhoneChange = (text: string) => {
    const raw = text.replace(/\D/g, '').substring(0, 9);
    setPhoneRaw(raw);
    setPhoneFormatted(formatPhone(raw));
    setCarrier(detectCarrier(raw));
    setError('');
  };

  // Send OTP
  const sendOTP = async () => {
    if (phoneRaw.length !== 9) {
      setError('Enter a valid 9-digit phone number');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (step === 'SIGNUP' && name.trim().length < 3) {
      setError('Please enter your full name');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const fullPhone = `+237${phoneRaw}`;
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });

      if (error) {
        setError(error.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        setStep('OTP');
        setTimeLeft(60);
        setOtp(['', '', '', '', '', '']);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to send code.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP
  const verifyOTP = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const fullPhone = `+237${phoneRaw}`;

      const { error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: code,
        type: 'sms',
      });

      if (error) {
        setError(error.message);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
        return;
      }

      // Only save name when this was a signup flow
      if (step === 'SIGNUP' && name.trim().length > 0) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: { full_name: name.trim() },
        });

        if (updateError) {
          setError(updateError.message);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError('Session error. Please try again.');
        return;
      }

      // Sync user to backend without overwriting name on login
      await fetch('http://192.168.43.78:3000/api/auth/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          phone: fullPhone,
          name: step === 'SIGNUP' ? name.trim() : undefined,
        }),
      });

      if (biometricAvailable && !biometricsEnabled) {
        setStep('BIOMETRICS');
      } else {
        router.replace('/home');
      }
    } catch (err: any) {
      setError(err?.message || 'Verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Biometrics login
  const handleBiometricLogin = async () => {
    if (!biometricAvailable) {
      setError('Biometrics not available on this device');
      return;
    }

    setIsLoading(true);

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Log in with your biometrics',
        fallbackLabel: 'Use passcode',
      });

      if (result.success) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          router.replace('/home');
        } else {
          setError('Session expired. Please log in with code.');
        }
      } else {
        setError('Authentication failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Biometric login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Enable biometrics
  const enableBiometrics = async () => {
    setIsLoading(true);

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometrics for future logins',
        fallbackLabel: 'Skip',
      });

      if (result.success) {
        setBiometricsEnabled(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      router.replace('/home');
    } catch (err: any) {
      setError(err?.message || 'Could not enable biometrics.');
      router.replace('/home');
    } finally {
      setIsLoading(false);
    }
  };

  const skipBiometrics = () => {
    router.replace('/home');
  };

  // Resend OTP
  const resendOTP = async () => {
    if (timeLeft > 0) return;

    setTimeLeft(60);
    setError('');

    try {
      const fullPhone = `+237${phoneRaw}`;
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
      if (error) setError(error.message);
    } catch (err: any) {
      setError(err?.message || 'Unable to resend code.');
    }
  };

  // OTP handlers
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(0, 1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (index: number, e: any) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const switchToLogin = () => {
    setStep('LOGIN');
    setError('');
    setName('');
    setPhoneRaw('');
    setPhoneFormatted('');
    setCarrier(null);
  };

  const switchToSignup = () => {
    setStep('SIGNUP');
    setError('');
    setName('');
    setPhoneRaw('');
    setPhoneFormatted('');
    setCarrier(null);
  };

  const goBackFromOtp = () => {
    setStep(step === 'SIGNUP' ? 'SIGNUP' : 'LOGIN');
    setError('');
    setOtp(['', '', '', '', '', '']);
  };

  const isSubmitDisabled =
    phoneRaw.length !== 9 || (step === 'SIGNUP' && name.trim().length < 3) || isLoading;

  const isOtpDisabled = otp.join('').length !== 6 || isLoading;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            {(step === 'SIGNUP' || step === 'LOGIN') && (
              <>
                <View style={styles.logoContainer}>
                  <View style={styles.logoIconWrapper}>
                    <ShieldCheck color="#10B981" size={20} />
                  </View>
                  <Text style={styles.logoText}>TrustLock</Text>
                </View>

                <Text style={styles.title}>
                  {step === 'SIGNUP' ? 'Create an account' : 'Log in to your account'}
                </Text>
                <Text style={styles.subtitle}>
                  {step === 'SIGNUP'
                    ? 'Sign up securely using your Full Name and Mobile Money number.'
                    : 'Enter your Mobile Money number to continue.'}
                </Text>

                {step === 'SIGNUP' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <View style={styles.inputWrapper}>
                      <User color="#94A3B8" size={20} style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. Fabrice T."
                        placeholderTextColor="#94A3B8"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  {step === 'SIGNUP' && <Text style={styles.label}>Mobile Money Number</Text>}
                  <View style={styles.inputWrapper}>
                    <View style={styles.countryCode}>
                      <Text style={styles.flag}>🇨🇲</Text>
                      <Text style={styles.countryCodeText}>+237</Text>
                    </View>
                    <View style={styles.divider} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="6XX XXX XXX"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      value={phoneFormatted}
                      onChangeText={handlePhoneChange}
                      maxLength={11}
                    />
                    {carrier && (
                      <View style={styles.carrierBadge}>
                        <Text
                          style={[
                            styles.carrierText,
                            carrier === 'mtn' ? styles.mtnText : styles.orangeText,
                          ]}
                        >
                          {carrier === 'mtn' ? 'MTN' : 'ORANGE'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.primaryButton, isSubmitDisabled && styles.primaryButtonDisabled]}
                  onPress={sendOTP}
                  disabled={isSubmitDisabled}
                >
                  {isLoading ? (
                    <ActivityIndicator color={isSubmitDisabled ? '#64748B' : '#FFF'} />
                  ) : (
                    <>
                      <Text style={[styles.buttonText, isSubmitDisabled && styles.buttonTextDisabled]}>
                        Send Secure Code
                      </Text>
                      <ArrowRight color={isSubmitDisabled ? '#64748B' : '#FFF'} size={20} />
                    </>
                  )}
                </TouchableOpacity>

                {step === 'LOGIN' && biometricAvailable && (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleBiometricLogin}
                    disabled={isLoading}
                  >
                    <Fingerprint color="#FFF" size={20} />
                    <Text style={styles.buttonText}>Use Biometrics</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.switchContainer}>
                  <Text style={styles.switchText}>
                    {step === 'SIGNUP' ? 'Already have an account? ' : 'New to TrustLock? '}
                  </Text>
                  <TouchableOpacity
                    onPress={step === 'SIGNUP' ? switchToLogin : switchToSignup}
                  >
                    <Text style={styles.switchLink}>
                      {step === 'SIGNUP' ? 'Log In' : 'Create Account'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 'OTP' && (
              <>
                <TouchableOpacity onPress={goBackFromOtp} style={styles.backButton}>
                  <ArrowLeft color="#475569" size={20} />
                  <Text style={styles.backText}>Change Number</Text>
                </TouchableOpacity>

                <Text style={styles.title}>Verify Phone</Text>
                <Text style={styles.subtitle}>
                  We sent a 6-digit security code via SMS to{'\n'}
                  <Text style={styles.boldNumber}>+237 {phoneFormatted}</Text>
                </Text>

                <View style={styles.otpContainer}>
                  {otp.map((digit, idx) => (
                    <TextInput
                      key={idx}
                      ref={(ref) => {
                        otpRefs.current[idx] = ref;
                      }}
                      style={[styles.otpBox, digit && styles.otpBoxFilled]}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(idx, text)}
                      onKeyPress={(e) => handleOtpKeyPress(idx, e)}
                      selectionColor="#2563EB"
                    />
                  ))}
                </View>

                {error ? <Text style={styles.errorTextCenter}>{error}</Text> : null}

                <View style={styles.resendContainer}>
                  <Text style={styles.resendText}>Didn't receive the code? </Text>
                  {timeLeft > 0 ? (
                    <Text style={styles.timerText}>00:{timeLeft.toString().padStart(2, '0')}</Text>
                  ) : (
                    <TouchableOpacity onPress={resendOTP}>
                      <Text style={styles.resendLink}>Resend Code</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, isOtpDisabled && styles.primaryButtonDisabled]}
                  onPress={verifyOTP}
                  disabled={isOtpDisabled}
                >
                  {isLoading ? (
                    <ActivityIndicator color={isOtpDisabled ? '#64748B' : '#FFF'} />
                  ) : (
                    <>
                      <CheckCircle2 color={isOtpDisabled ? '#64748B' : '#FFF'} size={20} />
                      <Text style={[styles.buttonText, isOtpDisabled && styles.buttonTextDisabled]}>
                        Verify & Continue
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {step === 'BIOMETRICS' && (
              <View style={styles.bioContainer}>
                <View style={styles.bioIconContainer}>
                  <Fingerprint color="#2563EB" size={56} strokeWidth={1.5} />
                  <View style={styles.bioLockBadge}>
                    <Lock color="#FFF" size={16} strokeWidth={2.5} />
                  </View>
                  <View style={styles.bioZapBadge}>
                    <Zap color="#FFF" size={16} strokeWidth={2.5} fill="#FFF" />
                  </View>
                </View>

                <Text style={styles.bioTitle}>Enable Biometrics</Text>
                <Text style={styles.bioSubtitle}>
                  Use Face ID or Touch ID to log in faster and authorize Escrow payouts securely without waiting for an SMS.
                </Text>

                <TouchableOpacity
                  style={[styles.primaryButton, { width: '100%' }]}
                  onPress={enableBiometrics}
                  disabled={isLoading}
                >
                  {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Enable Biometrics</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipButton} onPress={skipBiometrics}>
                  <Text style={styles.skipText}>Skip for now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  formContainer: {
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 10,
  },
  logoIconWrapper: {
    backgroundColor: '#D1FAE5',
    padding: 8,
    borderRadius: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0B1120',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0B1120',
    marginBottom: 8,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 32,
    lineHeight: 22,
  },
  boldNumber: {
    fontWeight: '700',
    color: '#0B1120',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    height: 56,
  },
  inputIcon: {
    marginLeft: 16,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#0B1120',
    paddingHorizontal: 16,
    height: '100%',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 12,
  },
  flag: {
    fontSize: 18,
    marginRight: 6,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0B1120',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  carrierBadge: {
    marginRight: 8,
  },
  carrierText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    overflow: 'hidden',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  mtnText: {
    color: '#000000',
    backgroundColor: '#FFCC00',
  },
  orangeText: {
    color: '#FFFFFF',
    backgroundColor: '#F97316',
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: '#2563EB',
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#475569',
  },
  switchContainer: {
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    color: '#64748B',
    fontSize: 15,
  },
  switchLink: {
    color: '#2563EB',
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 32,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 28,
  },
  otpBox: {
    flex: 1,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: '#0B1120',
  },
  otpBoxFilled: {
    borderColor: '#2563EB',
    backgroundColor: '#EEF2FF',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -8,
    marginBottom: 16,
    marginLeft: 4,
  },
  errorTextCenter: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  resendText: {
    fontSize: 14,
    color: '#64748B',
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0B1120',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  bioContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  bioIconContainer: {
    width: 110,
    height: 110,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  bioLockBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#2563EB',
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioZapBadge: {
    position: 'absolute',
    bottom: -8,
    left: -8,
    backgroundColor: '#2563EB',
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0B1120',
    marginBottom: 12,
    textAlign: 'center',
  },
  bioSubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  skipButton: {
    marginTop: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
});