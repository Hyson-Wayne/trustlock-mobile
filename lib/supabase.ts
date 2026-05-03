import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://fyigdlzvgjdndmolkamy.supabase.co'; // YOUR URL
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5aWdkbHp2Z2pkbmRtb2xrYW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODE4MTcsImV4cCI6MjA4OTk1NzgxN30.JCTj5VU3r2TebhU97XKSNdCnxl4H541EmsGmZgpDqeo'; // YOUR ANON KEY


export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // ✅ THIS FIXES EVERYTHING
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});