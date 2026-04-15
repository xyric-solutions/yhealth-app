/**
 * VoiceAssistantTab Component Tests
 * Tests for layout, state management, and basic functionality
 */

import { render, screen, waitFor } from '@testing-library/react';
import { VoiceAssistantTab } from '@/app/(pages)/dashboard/components/tabs/VoiceAssistantTab';
import { useAuth } from '@/app/context/AuthContext';
import { useVoiceAssistant } from '@/app/context/VoiceAssistantContext';

// Mock dependencies
jest.mock('@/app/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/app/context/VoiceAssistantContext', () => ({
  useVoiceAssistant: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button {...props}>{children}</button>
    ),
    p: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <p {...props}>{children}</p>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

jest.mock('@/components/common/language-selector', () => ({
  LanguageSelector: ({ selectedLanguage }: { selectedLanguage: string }) => (
    <div data-testid="language-selector">{selectedLanguage}</div>
  ),
}));

jest.mock('@/components/common/radial-network', () => ({
  RadialNetwork: () => <div data-testid="radial-network" />,
}));

jest.mock('@/components/common/glowing-orb-waves', () => ({
  GlowingOrbWaves: () => <div data-testid="glowing-orb-waves" />,
}));

// Mock Web Speech API
global.window.SpeechRecognition = class {
  continuous = true;
  interimResults = true;
  lang = 'en-US';
  onstart: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  start = jest.fn();
  stop = jest.fn();
  abort = jest.fn();
} as any;

(global.window as any).webkitSpeechRecognition = global.window.SpeechRecognition;

global.window.speechSynthesis = {
  getVoices: jest.fn().mockReturnValue([
    { name: 'Test Voice', lang: 'en-US', localService: true },
  ]),
  speak: jest.fn(),
  cancel: jest.fn(),
  onvoiceschanged: null,
} as any;

describe('VoiceAssistantTab', () => {
  const mockUser = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
  };

  const mockGetInitials = jest.fn().mockReturnValue('TU');

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      getInitials: mockGetInitials,
    });

    (useVoiceAssistant as jest.Mock).mockReturnValue({
      setUserMood: jest.fn(),
      selectedLanguage: 'en-US',
      setSelectedLanguage: jest.fn(),
    });
  });

  it('should render the component', () => {
    render(<VoiceAssistantTab />);
    expect(screen.getByText(/Welcome|Tap to talk/i)).toBeInTheDocument();
  });

  it('should display user name in welcome message when user is logged in', () => {
    render(<VoiceAssistantTab />);
    expect(screen.getByText(/Test|Welcome/i)).toBeInTheDocument();
  });

  it('should render language selector', () => {
    render(<VoiceAssistantTab />);
    expect(screen.getByTestId('language-selector')).toBeInTheDocument();
  });

  it('should render radial network component', () => {
    render(<VoiceAssistantTab />);
    expect(screen.getByTestId('radial-network')).toBeInTheDocument();
  });

  it('should render glowing orb waves component', () => {
    render(<VoiceAssistantTab />);
    expect(screen.getByTestId('glowing-orb-waves')).toBeInTheDocument();
  });

  it('should handle speech recognition not supported', () => {
    // Mock SpeechRecognition as undefined
    const originalSR = global.window.SpeechRecognition;
    delete (global.window as any).SpeechRecognition;
    delete (global.window as any).webkitSpeechRecognition;

    render(<VoiceAssistantTab />);
    
    // Should show error message or fallback UI
    expect(screen.getByText(/Voice Not Supported|not supported/i)).toBeInTheDocument();

    // Restore
    global.window.SpeechRecognition = originalSR;
    (global.window as any).webkitSpeechRecognition = originalSR;
  });

  it('should render connection status indicator', () => {
    render(<VoiceAssistantTab />);
    // Connection status should be visible in header
    expect(screen.getByText(/Connected|Connecting|Offline/i)).toBeInTheDocument();
  });

  it('should have proper layout structure', () => {
    const { container } = render(<VoiceAssistantTab />);
    
    // Check for main container classes
    const mainContainer = container.querySelector('.fixed.inset-0');
    expect(mainContainer).toBeInTheDocument();
    
    // Check for flex layout
    expect(mainContainer?.classList.contains('flex')).toBe(true);
    expect(mainContainer?.classList.contains('flex-col')).toBe(true);
  });

  it('should render TTS toggle button', () => {
    render(<VoiceAssistantTab />);
    // TTS toggle should be in header
    const buttons = screen.getAllByRole('button');
    const ttsButton = buttons.find(btn => 
      btn.getAttribute('aria-label')?.includes('voice') || 
      btn.getAttribute('aria-label')?.includes('Disable') ||
      btn.getAttribute('aria-label')?.includes('Enable')
    );
    expect(ttsButton).toBeDefined();
  });
});

