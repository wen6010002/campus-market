// 纯客户端 UI 状态（Zustand）：Toast 列表、Stepper 步骤、Modal 开关等。
import { create } from 'zustand';

export type ToastType = 'ok' | 'warn' | 'info';

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

interface UIState {
  toasts: ToastItem[];
  toast: (msg: string, type?: ToastType) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useUI = create<UIState>((set) => ({
  toasts: [],
  toast: (msg, type = 'info') => {
    const item = { id: ++seq, msg, type };
    set((s) => ({ toasts: [...s.toasts, item] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== item.id) })), 2400);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** 非组件环境（如 apiFetch 回调）直接触发 toast */
export function toast(msg: string, type: ToastType = 'info') {
  useUI.getState().toast(msg, type);
}
