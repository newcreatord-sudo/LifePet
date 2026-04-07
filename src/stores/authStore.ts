import { create } from "zustand";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getFirebase, getFirebaseConfigError } from "@/lib/firebase";
import { ensureDemoSeed } from "@/lib/demoSeed";
import { isDemoModeEnabled, setDemoModeEnabled } from "@/lib/runtimeMode";
import { ensureUserProfile } from "@/data/users";

export type AuthUser = {
  uid: string;
  email?: string | null;
  isDemo?: boolean;
};

type AuthState = {
  user: AuthUser | null;
  ready: boolean;
  configError: string | null;
  demo: boolean;
  start: () => () => void;
  enterDemo: () => void;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  ready: false,
  configError: getFirebaseConfigError(),
  demo: false,
  start: () => {
    if (get().ready) return () => {};

    if (isDemoModeEnabled()) {
      const demoUser: AuthUser = { uid: "demo", email: "demo@lifepet.local", isDemo: true };
      ensureDemoSeed(demoUser.uid);
      set({ ready: true, user: demoUser, configError: null, demo: true });
      return () => {};
    }

    const configError = getFirebaseConfigError();
    if (configError) {
      set({ ready: true, user: null, configError, demo: false });
      return () => {};
    }
    const { auth } = getFirebase();
    const unsub = onAuthStateChanged(auth, (user) =>
      {
        if (user) {
          void ensureUserProfile(user.uid, user.email);
        }
        set({
          user: user ? { uid: user.uid, email: user.email } : null,
          ready: true,
          configError: null,
          demo: false,
        });
      }
    );
    return unsub;
  },
  enterDemo: () => {
    setDemoModeEnabled(true);
    const demoUser: AuthUser = { uid: "demo", email: "demo@lifepet.local", isDemo: true };
    ensureDemoSeed(demoUser.uid);
    set({ ready: true, user: demoUser, configError: null, demo: true });
  },
  logout: async () => {
    if (get().demo) {
      setDemoModeEnabled(false);
      set({ user: null, ready: true, configError: getFirebaseConfigError(), demo: false });
      return;
    }
    const configError = getFirebaseConfigError();
    if (configError) {
      set({ user: null, ready: true, configError, demo: false });
      return;
    }
    await signOut(getFirebase().auth);
    set({ user: null, ready: true, configError: null, demo: false });
  },
}));
