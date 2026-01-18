// Didit Identity Verification Provider
// Handles IDV session creation, status checking, and webhooks

import { userStateManager } from '../../state/UserStateManager.js';

export interface DiditSessionResult {
  sessionId: string;
  verificationUrl: string;
}

export interface DiditDecision {
  status: string;
  session_id: string;
  vendor_data?: string;
  decision?: {
    document?: {
      first_name?: string;
      last_name?: string;
      date_of_birth?: string;
      document_type?: string;
      country?: string;
    };
  };
}

export class DiditProvider {
  private apiKey = process.env.DIDIT_API_KEY!;
  private workflowId = process.env.DIDIT_WORKFLOW_ID!;
  private baseUrl = process.env.DIDIT_BASE_URL || 'https://verification.didit.me';

  /**
   * Create a new IDV session for a user
   */
  async createSession(userId: string, callbackUrl?: string): Promise<DiditSessionResult> {
    const response = await fetch(`${this.baseUrl}/v3/session/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({
        workflow_id: this.workflowId,
        callback: callbackUrl || `${process.env.FRONTEND_URL}/idv-callback`,
        vendor_data: userId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Didit session creation failed: ${response.status} - ${error}`);
    }

    const data = await response.json() as { session_id: string; url: string };

    // Update user state
    userStateManager.update(userId, {
      idvStatus: 'pending',
      idvSessionId: data.session_id,
    });

    console.log(`[Didit] Created session ${data.session_id} for user ${userId}`);

    return {
      sessionId: data.session_id,
      verificationUrl: data.url,
    };
  }

  /**
   * Get the result of an IDV session
   */
  async getSessionResult(sessionId: string): Promise<DiditDecision> {
    const response = await fetch(
      `${this.baseUrl}/v2/session/${sessionId}/decision/`,
      {
        headers: { 'X-Api-Key': this.apiKey },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Didit get decision failed: ${response.status} - ${error}`);
    }

    return response.json() as Promise<DiditDecision>;
  }

  /**
   * Handle webhook from Didit
   */
  handleWebhook(payload: DiditDecision): void {
    const { session_id, status, decision, vendor_data: userId } = payload;

    console.log(`[Didit] Webhook received: session=${session_id}, status=${status}, userId=${userId}`);

    if (!userId) {
      console.error('[Didit] Webhook missing vendor_data (userId)');
      return;
    }

    const mappedStatus = status === 'Approved' ? 'verified'
                       : status === 'Declined' ? 'failed'
                       : 'pending';

    userStateManager.update(userId, {
      idvStatus: mappedStatus,
      idvResult: decision?.document ? {
        fullName: [decision.document.first_name, decision.document.last_name]
          .filter(Boolean)
          .join(' '),
        dateOfBirth: decision.document.date_of_birth,
        documentType: decision.document.document_type,
        documentCountry: decision.document.country,
      } : undefined,
    });

    console.log(`[Didit] Updated user ${userId} IDV status to ${mappedStatus}`);
  }

  /**
   * Check if a session is complete and get the user's verified name
   */
  async getVerifiedName(userId: string): Promise<string | undefined> {
    const state = userStateManager.get(userId);

    if (state.idvStatus === 'verified' && state.idvResult?.fullName) {
      return state.idvResult.fullName;
    }

    // If we have a session ID but no result yet, try to fetch it
    if (state.idvSessionId && state.idvStatus === 'pending') {
      try {
        const result = await this.getSessionResult(state.idvSessionId);
        this.handleWebhook({ ...result, vendor_data: userId });
        return userStateManager.get(userId).idvResult?.fullName;
      } catch (err) {
        console.error(`[Didit] Error fetching session result:`, err);
      }
    }

    return undefined;
  }
}

export const diditProvider = new DiditProvider();
