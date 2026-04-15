/**
 * RAG Chat Service
 * Client-side service for the AI Health Coach with vector-based retrieval
 */

import { api } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export interface RAGChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sequenceNumber: number;
  createdAt: string;
}

export interface RAGConversation {
  id: string;
  userId: string;
  title: string | null;
  sessionType: string;
  status: string;
  messageCount: number;
  topics: string[];
  createdAt: string;
  lastMessageAt?: string;
  lastMessagePreview?: string | null;
  lastMessageRole?: string | null;
}

export interface ActionCommand {
  type: 'navigate' | 'update' | 'create' | 'delete' | 'open_modal' | 'music_control';
  target: string; // page/tab name or data type
  params?: Record<string, unknown>;
  sequence?: number; // for ordering multiple actions
}

export interface ChatResponse {
  message: string;
  conversationId: string;
  messageId: string;
  actions?: ActionCommand[]; // Array of actions to execute on frontend
  toolCalls?: Array<{ tool: string; result: string }>; // Tools called by the AI during response
  context?: {
    retrievedDocs: number;
    historyUsed: number;
  };
}

export interface ConversationWithMessages {
  conversation: RAGConversation;
  messages: RAGChatMessage[];
}

export interface SearchResult {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  similarity: number;
  sequenceNumber: number;
  createdAt: string;
}

export interface KnowledgeSearchResult {
  id: string;
  category: string;
  subcategory: string | null;
  title: string;
  content: string;
  tags: string[];
  similarity: number;
  trustScore: number;
}

export type SessionType = 
  | 'quick_checkin'
  | 'coaching_session'
  | 'emergency_support'
  | 'goal_review'
  | 'health_coach'
  | 'nutrition'
  | 'fitness'
  | 'wellness';
export type ProfileSection = 'goals' | 'conditions' | 'preferences' | 'history' | 'metrics';

// ============================================================================
// RAG Chat Service
// ============================================================================

class RAGChatService {
  private readonly baseUrl = '/rag-chat';

  /**
   * Send a message and get AI response with RAG context
   */
  async sendMessage(params: {
    message: string;
    conversationId?: string;
  }): Promise<ChatResponse> {
    const response = await api.post<ChatResponse>(`${this.baseUrl}/message`, {
      message: params.message,
      conversationId: params.conversationId,
    });
    if (!response.success || !response.data) {
      throw new Error('Failed to send message');
    }
    return response.data;
  }

  /**
   * Create a new conversation
   */
  async createConversation(params?: {
    title?: string;
    sessionType?: SessionType;
  }): Promise<{ conversationId: string }> {
    const response = await api.post<{ conversationId: string }>(
      `${this.baseUrl}/conversations`,
      params || {}
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to create conversation');
    }
    return response.data;
  }

  /**
   * Get a specific conversation with messages
   */
  async getConversation(
    conversationId: string,
    limit?: number
  ): Promise<ConversationWithMessages> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await api.get<ConversationWithMessages>(
      `${this.baseUrl}/conversations/${conversationId}${params}`
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to get conversation');
    }
    return response.data;
  }

  /**
   * Get user's conversation list
   */
  async getConversations(params?: {
    limit?: number;
    status?: string;
  }): Promise<{ conversations: RAGConversation[] }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    else searchParams.set('status', 'active');

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await api.get<{ conversations: RAGConversation[] }>(
      `${this.baseUrl}/conversations${query}`
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to get conversations');
    }
    return response.data;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/conversations/${conversationId}`);
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string): Promise<void> {
    await api.patch(`${this.baseUrl}/conversations/${conversationId}/archive`);
  }

  /**
   * Generate title for a conversation
   */
  async generateTitle(conversationId: string): Promise<{ title: string }> {
    const response = await api.post<{ title: string }>(
      `${this.baseUrl}/conversations/${conversationId}/title`
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to generate title');
    }
    return response.data;
  }

  /**
   * Generate summary for a conversation
   */
  async generateSummary(conversationId: string): Promise<{ summary: string }> {
    const response = await api.post<{ summary: string }>(
      `${this.baseUrl}/conversations/${conversationId}/summary`
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to generate summary');
    }
    return response.data;
  }

  /**
   * Search conversation history
   */
  async searchHistory(
    query: string,
    limit?: number
  ): Promise<{ results: SearchResult[] }> {
    const params = new URLSearchParams({ q: query });
    if (limit) params.set('limit', limit.toString());

    const response = await api.get<{ results: SearchResult[] }>(
      `${this.baseUrl}/search?${params.toString()}`
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to search history');
    }
    return response.data;
  }

  /**
   * Update user health profile for RAG context
   */
  async updateHealthProfile(params: {
    section: ProfileSection;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>(
      `${this.baseUrl}/profile`,
      params
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to update health profile');
    }
    return response.data;
  }

  /**
   * Search knowledge base
   */
  async searchKnowledge(params: {
    query: string;
    category?: string;
    limit?: number;
  }): Promise<{ results: KnowledgeSearchResult[] }> {
    const searchParams = new URLSearchParams({ q: params.query });
    if (params.category) searchParams.set('category', params.category);
    if (params.limit) searchParams.set('limit', params.limit.toString());

    const response = await api.get<{ results: KnowledgeSearchResult[] }>(
      `${this.baseUrl}/knowledge/search?${searchParams.toString()}`
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to search knowledge');
    }
    return response.data;
  }

  /**
   * Get personalized greeting from backend
   */
  async getGreeting(callPurpose?: string, language?: string, sessionType?: string): Promise<{ greeting: string }> {
    try {
      const params = new URLSearchParams();
      if (callPurpose) {
        params.append('callPurpose', callPurpose);
      }
      if (language) {
        // Extract base language code (e.g., "ur" from "ur-PK")
        const baseLang = language.split("-")[0];
        params.append('language', baseLang);
      }
      if (sessionType) {
        params.append('sessionType', sessionType);
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get<{ greeting: string }>(
        `${this.baseUrl}/greeting${query}`
      );
      if (!response.success || !response.data) {
        throw new Error('Failed to get greeting');
      }
      return response.data;
    } catch (error) {
      // Fallback to simple greeting on error
      console.error('[RAGChatService] Error fetching greeting:', error);
      throw error; // Let caller handle fallback
    }
  }
}

// Export singleton instance
export const ragChatService = new RAGChatService();
export default ragChatService;
