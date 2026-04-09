import { create } from "zustand";

const MAX_ENTRIES = 40;

export type DemoLogEntry = {
  id: string;
  at: string;
  label: string;
  detail?: string;
};

type DemoLogState = {
  entries: DemoLogEntry[];
  append: (label: string, detail?: string) => void;
  clear: () => void;
};

export const useDemoLogStore = create<DemoLogState>((set) => ({
  entries: [],
  append: (label, detail) =>
    set((s) => {
      const entry: DemoLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        at: new Date().toISOString(),
        label,
        detail
      };
      return { entries: [entry, ...s.entries].slice(0, MAX_ENTRIES) };
    }),
  clear: () => set({ entries: [] })
}));

/** Yerel test / mock aksiyonları; sunucuya gitmez. */
export function appendDemoLog(label: string, detail?: string): void {
  useDemoLogStore.getState().append(label, detail);
}
