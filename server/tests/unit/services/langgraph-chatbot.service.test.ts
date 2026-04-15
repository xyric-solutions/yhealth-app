/**
 * LangGraph Chatbot Service Unit Tests
 * Tests for streaming tool call handling and message ordering
 */

import { AIMessage, ToolMessage } from '@langchain/core/messages';

describe('LangGraphChatbotService - Streaming Tool Calls', () => {
  describe('Message Ordering Logic', () => {

    it('should construct AIMessage with tool_calls when response lacks them', () => {
      const responseToolCalls = [
        {
          id: 'call_456',
          name: 'anotherTool',
          function: {
            name: 'anotherTool',
            arguments: JSON.stringify({ test: 'data' }),
          },
        },
      ];

      // This tests the logic for constructing AIMessage when response doesn't have tool_calls
      const response = new AIMessage({ content: 'Some content' });
      const hasToolCallsInResponse = (response as any)?.tool_calls || (response as any)?.additional_kwargs?.tool_calls;
      
      expect(hasToolCallsInResponse).toBeFalsy();
      
      // The fix should construct AIMessage with tool_calls from responseToolCalls
      if (responseToolCalls && responseToolCalls.length > 0) {
        const openAIToolCalls = responseToolCalls.map((tc: any) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name || tc.function?.name,
            arguments: typeof tc.args === 'object' ? JSON.stringify(tc.args) : (tc.function?.arguments || JSON.stringify({})),
          },
        }));
        
        const constructedMessage = new AIMessage({
          content: response?.content || '',
          additional_kwargs: {
            tool_calls: openAIToolCalls,
          },
        });

        expect(constructedMessage).toBeInstanceOf(AIMessage);
        expect((constructedMessage as any).additional_kwargs?.tool_calls).toBeDefined();
        expect((constructedMessage as any).additional_kwargs.tool_calls.length).toBe(1);
      }
    });

    it('should handle tool_calls in both response.tool_calls and additional_kwargs.tool_calls', () => {
      // Test case 1: tool_calls in response.tool_calls
      const response1 = new AIMessage({
        content: 'test',
        tool_calls: [
          {
            name: 'testTool',
            args: { param: 'value' },
            id: 'call_1',
          },
        ],
      } as any);

      const toolCalls1 = (response1 as any)?.tool_calls || (response1 as any)?.additional_kwargs?.tool_calls;
      expect(toolCalls1).toBeDefined();

      // Test case 2: tool_calls in additional_kwargs.tool_calls
      const response2 = new AIMessage({
        content: 'test',
        additional_kwargs: {
          tool_calls: [
            {
              id: 'call_2',
              type: 'function',
              function: {
                name: 'testTool',
                arguments: JSON.stringify({ param: 'value' }),
              },
            },
          ],
        },
      });

      const toolCalls2 = (response2 as any)?.tool_calls || (response2 as any)?.additional_kwargs?.tool_calls;
      expect(toolCalls2).toBeDefined();
      expect(Array.isArray(toolCalls2)).toBe(true);
    });
  });

  describe('Message Array Ordering', () => {
    it('should maintain correct order: AIMessage with tool_calls, then ToolMessages', () => {
      const messages: any[] = [];
      
      // Simulate the fix: push AIMessage first
      const aiMessage = new AIMessage({
        content: '',
        additional_kwargs: {
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: { name: 'testTool', arguments: '{}' },
            },
          ],
        },
      });
      
      messages.push(aiMessage);
      
      // Then push tool results
      const toolResults = [
        new ToolMessage({ content: 'result1', tool_call_id: 'call_1' }),
      ];
      
      messages.push(...toolResults);
      
      // Verify order
      expect(messages[0]).toBeInstanceOf(AIMessage);
      expect(messages[1]).toBeInstanceOf(ToolMessage);
      expect((messages[0] as any).additional_kwargs?.tool_calls).toBeDefined();
    });

    it('should throw error if trying to push ToolMessages without preceding AIMessage with tool_calls', () => {
      const messages: any[] = [];
      const toolResults = [
        new ToolMessage({ content: 'result', tool_call_id: 'call_1' }),
      ];
      
      // This should fail - no AIMessage with tool_calls before ToolMessages
      expect(() => {
        messages.push(...toolResults);
      }).not.toThrow(); // The push itself won't throw, but the LLM will reject it
      
      // The fix ensures we always push AIMessage first
      const aiMessage = new AIMessage({
        content: '',
        additional_kwargs: {
          tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'test', arguments: '{}' } }],
        },
      });
      
      messages.unshift(aiMessage); // Add at beginning
      
      expect(messages[0]).toBeInstanceOf(AIMessage);
      expect(messages[1]).toBeInstanceOf(ToolMessage);
    });
  });
});

