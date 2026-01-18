import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null, // access token
      refreshToken: null,
      isAuthed: false,

      // payload: { user, token, refreshToken }
      setAuth: ({ user, token, refreshToken }) =>
        set({
          user: user ?? null,
          token: token ?? null,
          refreshToken: refreshToken ?? null,
          isAuthed: !!token,
        }),

      setUser: (user) =>
        set((state) => ({
          ...state,
          user,
        })),

      logout: () =>
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthed: false,
        }),
    }),
    {
      name: "p2p-auth",
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        refreshToken: s.refreshToken,
        isAuthed: s.isAuthed,
      }),
    }
  )
);
