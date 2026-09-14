import { create } from "zustand";
import type { ChatMessage } from "@/types/chat";
import {
  clearChat,
  isExpired,
  loadChat,
  saveChat,
  touchActivity,
} from "@/utils/chatPersistence";

interface ChatState {
  messages: ChatMessage[];
  /** Inicializa a store a partir do localStorage (respeitando expiração). */
  hydrate: () => void;
  /** Adiciona uma mensagem e persiste + atualiza atividade. */
  addMessage: (message: ChatMessage) => void;
  /** Reinicia a conversa ("novo chat"): limpa mensagens e storage. */
  resetChat: () => void;
  /** Verifica inatividade > 30min; se expirou, limpa o chat. Chamado por polling/visibilitychange. */
  checkExpiration: () => void;
  /** Marca atividade recente sem alterar mensagens (ex.: usuário digitando). */
  markActivity: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],

  hydrate: () => {
    set({ messages: loadChat() });
  },

  addMessage: (message) => {
    const messages = [...get().messages, message];
    set({ messages });
    saveChat(messages);
  },

  resetChat: () => {
    clearChat();
    set({ messages: [] });
  },

  checkExpiration: () => {
    if (get().messages.length > 0 && isExpired()) {
      get().resetChat();
    }
  },

  markActivity: () => {
    touchActivity();
  },
}));
