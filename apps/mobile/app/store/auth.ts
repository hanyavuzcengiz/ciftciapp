import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  phoneNumber: string | null;
  userId: string | null;
  profileComplete: boolean;
};

type AuthActions = {
  setTokens: (access: string, refresh: string) => void;
  setPhone: (phone: string) => void;
  setUserId: (id: string) => void;
  setProfileComplete: (v: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      phoneNumber: null,
      userId: null,
      profileComplete: false,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setPhone: (phoneNumber) => set({ phoneNumber }),
      setUserId: (userId) => set({ userId }),
      setProfileComplete: (profileComplete) => set({ profileComplete }),
      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          phoneNumber: null,
          userId: null,
          profileComplete: false
        })
    }),
    {
      name: "agromarket-auth",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        phoneNumber: s.phoneNumber,
        userId: s.userId,
        profileComplete: s.profileComplete
      })
    }
  )
);
