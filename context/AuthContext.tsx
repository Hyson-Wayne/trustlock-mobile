import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

type AuthProviderProps = {
  children: React.ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  let isMounted = true;

  const init = async () => {
    try {
      console.log("🔵 Getting session...");

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.log("❌ SESSION ERROR:", error.message);
      }

      if (isMounted) {
        console.log("✅ SESSION:", data.session);

        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      }
    } catch (err) {
      console.log("❌ CRASH:", err);
    } finally {
      if (isMounted) {
        console.log("🟢 DONE LOADING");
        setLoading(false); // ✅ ALWAYS runs
      }
    }
  };

  init();

  const { data: listener } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      console.log("🔄 AUTH CHANGE:", session);

      if (!isMounted) return;

      setSession(session ?? null);
      setUser(session?.user ?? null);
    }
  );

  return () => {
    isMounted = false;
    listener.subscription.unsubscribe();
  };
}, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      signOut,
    }),
    [user, session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);