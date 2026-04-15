/**
 * Action Handler Service
 * Parses and executes action commands from AI responses
 */

import { ActionCommand } from './rag-chat.service';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { navigateToPage } from '../utils/navigation.helper';

export interface ActionExecutionResult {
  success: boolean;
  action: ActionCommand;
  message?: string;
  error?: string;
}

/**
 * Parse actions from AI response
 * Actions may be embedded in the response as HTML comments or JSON
 */
export function parseActionsFromResponse(response: string): ActionCommand[] {
  const actions: ActionCommand[] = [];
  
  // Try to parse actions from HTML comments: <!--ACTION:{"type":"navigate","target":"workouts"}-->
  const actionCommentRegex = /<!--ACTION:(.*?)-->/g;
  let match;
  
  while ((match = actionCommentRegex.exec(response)) !== null) {
    try {
      const action = JSON.parse(match[1]);
      if (isValidAction(action)) {
        actions.push(action);
      }
    } catch (error) {
      console.warn('[ActionHandler] Failed to parse action from comment:', error);
    }
  }
  
  // Try to parse actions from JSON blocks: <action>{"type":"navigate","target":"workouts"}</action>
  const actionTagRegex = /<action>([\s\S]*?)<\/action>/g;
  while ((match = actionTagRegex.exec(response)) !== null) {
    try {
      const action = JSON.parse(match[1]);
      if (isValidAction(action)) {
        actions.push(action);
      }
    } catch (error) {
      console.warn('[ActionHandler] Failed to parse action from tag:', error);
    }
  }
  
  return actions;
}

/**
 * Validate action command structure
 */
function isValidAction(action: unknown): action is ActionCommand {
  if (!action || typeof action !== 'object') return false;
  const obj = action as Record<string, unknown>;
  return (
    typeof obj.type === 'string' &&
    ['navigate', 'update', 'create', 'delete', 'open_modal', 'music_control'].includes(obj.type) &&
    typeof obj.target === 'string'
  );
}

/**
 * Execute a single action command
 */
export async function executeAction(
  action: ActionCommand,
  router: AppRouterInstance,
  onNavigate?: (tabId: string) => void,
  onUpdate?: (target: string, params?: Record<string, unknown>) => Promise<boolean>,
  onCreate?: (target: string, params?: Record<string, unknown>) => Promise<boolean>,
  onDelete?: (target: string, params?: Record<string, unknown>) => Promise<boolean>,
  onOpenModal?: (target: string, params?: Record<string, unknown>) => Promise<boolean>
): Promise<ActionExecutionResult> {
  try {
    switch (action.type) {
      case 'navigate':
        const navigated = navigateToPage(router, action.target);
        if (onNavigate) {
          onNavigate(action.target);
        }
        return {
          success: navigated,
          action,
          message: navigated ? `Navigated to ${action.target}` : `Could not find page: ${action.target}`,
        };
      
      case 'update':
        if (onUpdate) {
          const updated = await onUpdate(action.target, action.params);
          return {
            success: updated,
            action,
            message: updated ? `Updated ${action.target}` : `Failed to update ${action.target}`,
          };
        }
        return {
          success: false,
          action,
          error: 'Update handler not provided',
        };
      
      case 'create':
        if (onCreate) {
          const created = await onCreate(action.target, action.params);
          return {
            success: created,
            action,
            message: created ? `Created ${action.target}` : `Failed to create ${action.target}`,
          };
        }
        return {
          success: false,
          action,
          error: 'Create handler not provided',
        };
      
      case 'delete':
        if (onDelete) {
          const deleted = await onDelete(action.target, action.params);
          return {
            success: deleted,
            action,
            message: deleted ? `Deleted ${action.target}` : `Failed to delete ${action.target}`,
          };
        }
        return {
          success: false,
          action,
          error: 'Delete handler not provided',
        };
      
      case 'open_modal':
        if (onOpenModal) {
          const opened = await onOpenModal(action.target, action.params);
          return {
            success: opened,
            action,
            message: opened ? `Opened ${action.target} modal` : `Failed to open ${action.target} modal`,
          };
        }
        return {
          success: false,
          action,
          error: 'Modal handler not provided',
        };
      
      case 'music_control':
        window.dispatchEvent(new CustomEvent('music:command', { detail: action.params }));
        return {
          success: true,
          action,
          message: `Music: ${(action.params as Record<string, unknown>)?.command || 'control'}`,
        };

      default:
        return {
          success: false,
          action,
          error: `Unknown action type: ${(action as ActionCommand).type}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      action,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute multiple actions in sequence
 */
export async function executeActions(
  actions: ActionCommand[],
  router: AppRouterInstance,
  handlers?: {
    onNavigate?: (tabId: string) => void;
    onUpdate?: (target: string, params?: Record<string, unknown>) => Promise<boolean>;
    onCreate?: (target: string, params?: Record<string, unknown>) => Promise<boolean>;
    onDelete?: (target: string, params?: Record<string, unknown>) => Promise<boolean>;
    onOpenModal?: (target: string, params?: Record<string, unknown>) => Promise<boolean>;
  }
): Promise<ActionExecutionResult[]> {
  // Sort by sequence if provided
  const sortedActions = [...actions].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  
  const results: ActionExecutionResult[] = [];
  
  for (const action of sortedActions) {
    const result = await executeAction(
      action,
      router,
      handlers?.onNavigate,
      handlers?.onUpdate,
      handlers?.onCreate,
      handlers?.onDelete,
      handlers?.onOpenModal
    );
    results.push(result);
    
    // Add small delay between actions
    if (sortedActions.indexOf(action) < sortedActions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

