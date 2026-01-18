// In-memory user state manager for tracking bank link, IDV, and sanctions status

export interface UserState {
  userId: string;

  // Bank Link (TrueLayer)
  bankStatus: 'none' | 'pending' | 'connected' | 'expired';
  bankSessionState?: string;  // For OAuth state parameter
  bankAccessToken?: string;
  bankRefreshToken?: string;
  bankTokenExpiresAt?: Date;

  // IDV (Didit)
  idvStatus: 'none' | 'pending' | 'verified' | 'failed';
  idvSessionId?: string;
  idvResult?: {
    fullName?: string;
    dateOfBirth?: string;
    documentType?: string;
    documentCountry?: string;
  };

  // Sanctions
  sanctionsChecked: boolean;
  sanctionsClear?: boolean;

  updatedAt: Date;
}

class UserStateManager {
  private state = new Map<string, UserState>();

  get(userId: string): UserState {
    if (!this.state.has(userId)) {
      this.state.set(userId, {
        userId,
        bankStatus: 'none',
        idvStatus: 'none',
        sanctionsChecked: false,
        updatedAt: new Date(),
      });
    }
    return this.state.get(userId)!;
  }

  update(userId: string, updates: Partial<UserState>): UserState {
    const current = this.get(userId);
    const updated = { ...current, ...updates, updatedAt: new Date() };
    this.state.set(userId, updated);
    return updated;
  }

  // Find user by OAuth state (for callback)
  findByBankSessionState(state: string): UserState | undefined {
    for (const [, userState] of this.state) {
      if (userState.bankSessionState === state) {
        return userState;
      }
    }
    return undefined;
  }

  // Find user by IDV session
  findByIdvSession(sessionId: string): UserState | undefined {
    for (const [, userState] of this.state) {
      if (userState.idvSessionId === sessionId) {
        return userState;
      }
    }
    return undefined;
  }

  // Get all users (for debugging)
  getAll(): UserState[] {
    return Array.from(this.state.values());
  }

  // Clear a user's state (for testing)
  clear(userId: string): void {
    this.state.delete(userId);
  }
}

export const userStateManager = new UserStateManager();
