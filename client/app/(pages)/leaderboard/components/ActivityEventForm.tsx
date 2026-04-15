'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Check, Loader2, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

type EventType = 'workout' | 'nutrition' | 'wellbeing' | 'participation';
type EventSource = 'manual' | 'whoop' | 'apple_health' | 'camera_session';

interface ActivityEvent {
  type: EventType;
  source: EventSource;
  timestamp: string;
  payload: Record<string, unknown>;
}

interface ActivityEventFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ActivityEventForm({ onSuccess, onCancel }: ActivityEventFormProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([
    {
      type: 'workout',
      source: 'manual',
      timestamp: new Date().toISOString(),
      payload: {},
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const addEvent = () => {
    setEvents([
      ...events,
      {
        type: 'workout',
        source: 'manual',
        timestamp: new Date().toISOString(),
        payload: {},
      },
    ]);
    setExpandedIndex(events.length);
  };

  const removeEvent = (index: number) => {
    setEvents(events.filter((_, i) => i !== index));
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  const updateEvent = (index: number, updates: Partial<ActivityEvent>) => {
    setEvents(events.map((event, i) => (i === index ? { ...event, ...updates } : event)));
  };

  const updatePayload = (index: number, key: string, value: unknown) => {
    setEvents(
      events.map((event, i) =>
        i === index
          ? { ...event, payload: { ...event.payload, [key]: value } }
          : event
      )
    );
  };

  const handleSubmit = async () => {
    if (events.length === 0) {
      toast.error('Please add at least one event');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post('/activity-events', {
        events: events.map((event) => ({
          ...event,
          payload: JSON.stringify(event.payload),
        })),
      });

      if (response.success) {
        toast.success(`Successfully submitted ${events.length} event${events.length > 1 ? 's' : ''}!`);
        setEvents([
          {
            type: 'workout',
            source: 'manual',
            timestamp: new Date().toISOString(),
            payload: {},
          },
        ]);
        setExpandedIndex(0);
        onSuccess?.();
      } else {
        throw new Error(response.error?.message || 'Failed to submit events');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit events');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEventTypeFields = (type: EventType) => {
    switch (type) {
      case 'workout':
        return [
          { key: 'workout_name', label: 'Workout Name', type: 'text' },
          { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
          { key: 'calories_burned', label: 'Calories Burned', type: 'number' },
        ];
      case 'nutrition':
        return [
          { key: 'meal_type', label: 'Meal Type', type: 'text' },
          { key: 'calories', label: 'Calories', type: 'number' },
          { key: 'protein', label: 'Protein (g)', type: 'number' },
          { key: 'carbs', label: 'Carbs (g)', type: 'number' },
          { key: 'fats', label: 'Fats (g)', type: 'number' },
        ];
      case 'wellbeing':
        return [
          { key: 'sleep_hours', label: 'Sleep Hours', type: 'number' },
          { key: 'stress_level', label: 'Stress Level (1-10)', type: 'number' },
          { key: 'mood', label: 'Mood', type: 'text' },
        ];
      case 'participation':
        return [
          { key: 'check_in', label: 'Check-in', type: 'checkbox' },
          { key: 'streak_days', label: 'Streak Days', type: 'number' },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          Submit Activity Events
        </h3>
        <Button
          onClick={addEvent}
          size="sm"
          variant="outline"
          className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Event
        </Button>
      </div>

      <div className="space-y-3">
        {events.map((event, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 rounded-lg border border-white/10 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">Event {index + 1}</span>
                <Select
                  value={event.type}
                  onValueChange={(value) => updateEvent(index, { type: value as EventType })}
                >
                  <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/20">
                    <SelectItem value="workout">Workout</SelectItem>
                    <SelectItem value="nutrition">Nutrition</SelectItem>
                    <SelectItem value="wellbeing">Wellbeing</SelectItem>
                    <SelectItem value="participation">Participation</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={event.source}
                  onValueChange={(value) => updateEvent(index, { source: value as EventSource })}
                >
                  <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/20">
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="whoop">WHOOP</SelectItem>
                    <SelectItem value="apple_health">Apple Health</SelectItem>
                    <SelectItem value="camera_session">Camera Session</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {events.length > 1 && (
                <Button
                  onClick={() => removeEvent(index)}
                  size="icon"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-gray-400 text-sm mb-1 block">Timestamp</Label>
                <Input
                  type="datetime-local"
                  value={new Date(event.timestamp).toISOString().slice(0, 16)}
                  onChange={(e) =>
                    updateEvent(index, { timestamp: new Date(e.target.value).toISOString() })
                  }
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-400 text-sm mb-2 block">Event Details</Label>
                <div className="grid grid-cols-2 gap-3">
                  {getEventTypeFields(event.type).map((field) => (
                    <div key={field.key}>
                      <Label className="text-gray-400 text-xs mb-1">{field.label}</Label>
                      {field.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={!!event.payload[field.key]}
                          onChange={(e) => updatePayload(index, field.key, e.target.checked)}
                          className="ml-2"
                        />
                      ) : (
                        <Input
                          type={field.type}
                          value={String(event.payload[field.key] || '')}
                          onChange={(e) =>
                            updatePayload(
                              index,
                              field.key,
                              field.type === 'number' ? Number(e.target.value) : e.target.value
                            )
                          }
                          className="bg-white/10 border-white/20 text-white"
                          placeholder={field.label}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex gap-2 pt-4 border-t border-white/10">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || events.length === 0}
          className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Submit {events.length} Event{events.length > 1 ? 's' : ''}
            </>
          )}
        </Button>
        {onCancel && (
          <Button onClick={onCancel} variant="outline" className="border-white/20">
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

