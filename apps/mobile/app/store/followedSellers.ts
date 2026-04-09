import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type FollowedState = {
  ids: string[];
  toggle: (sellerKey: string) => void;
  isFollowing: (sellerKey: string) => boolean;
};

export const useFollowedSellersStore = create<FollowedState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (sellerKey) => {
        const k = sellerKey.trim();
        if (!k) return;
        set((s) => ({
          ids: s.ids.includes(k) ? s.ids.filter((x) => x !== k) : [...s.ids, k]
        }));
      },
      isFollowing: (sellerKey) => get().ids.includes(sellerKey.trim())
    }),
    {
      name: "pastoral-followed-sellers",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ ids: s.ids })
    }
  )
);
