import { render, screen, fireEvent } from "@testing-library/react";
import { ProductTour } from "../ProductTour";
import { TOUR_STEPS } from "../tour-steps";
import type { ProductTourContextValue } from "../types";

// ── Mocks ──

// Re-establish matchMedia mock (resetMocks: true in jest.config clears jest.setup)
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// Mock React portals to render inline
jest.mock("react-dom", () => ({
  ...jest.requireActual("react-dom"),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createPortal: (node: any) => node,
}));

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ children, className, style, onClick, ...rest }: any) => (
      <div className={className} style={style} onClick={onClick} {...rest}>
        {children}
      </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p: ({ children, className, ...rest }: any) => (
      <p className={className} {...rest}>{children}</p>
    ),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock canvas-confetti
jest.mock("canvas-confetti", () => jest.fn());

// Mock tour context
const mockContextValue: ProductTourContextValue = {
  isActive: true,
  currentStep: 0,
  hasCompletedTour: false,
  hasSkippedTour: false,
  isTransitioning: false,
  steps: TOUR_STEPS,
  totalSteps: TOUR_STEPS.length,
  startTour: jest.fn(),
  nextStep: jest.fn(),
  prevStep: jest.fn(),
  skipTour: jest.fn(),
  completeTour: jest.fn(),
  resetTour: jest.fn(),
  goToStep: jest.fn(),
};

jest.mock("@/app/context/ProductTourContext", () => ({
  useProductTourContext: () => mockContextValue,
}));

// Mock auth context
jest.mock("@/app/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "1",
      firstName: "Alex",
      lastName: "Smith",
      email: "alex@test.com",
      role: "user",
    },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

describe("ProductTour", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextValue.isActive = true;
    mockContextValue.currentStep = 0;
    mockContextValue.isTransitioning = false;
    mockContextValue.steps = TOUR_STEPS;
    mockContextValue.totalSteps = TOUR_STEPS.length;
  });

  // ── Rendering ──

  it("renders nothing when tour is not active", () => {
    mockContextValue.isActive = false;

    const { container } = render(<ProductTour />);
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog when tour is active", () => {
    render(<ProductTour />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Product tour");
  });

  // ── Welcome step (step 0) ──

  it("renders welcome modal on step 0", () => {
    mockContextValue.currentStep = 0;
    render(<ProductTour />);

    expect(screen.getByText("Welcome to Balencia, Alex!")).toBeInTheDocument();
    expect(screen.getByText("Start Tour")).toBeInTheDocument();
    expect(screen.getByText("Skip for now")).toBeInTheDocument();
  });

  it("calls nextStep when Start Tour is clicked on welcome", () => {
    mockContextValue.currentStep = 0;
    render(<ProductTour />);

    fireEvent.click(screen.getByText("Start Tour"));
    expect(mockContextValue.nextStep).toHaveBeenCalled();
  });

  it("calls skipTour when Skip is clicked on welcome", () => {
    mockContextValue.currentStep = 0;
    render(<ProductTour />);

    fireEvent.click(screen.getByText("Skip for now"));
    expect(mockContextValue.skipTour).toHaveBeenCalled();
  });

  // ── Tooltip step (spotlight steps) ──

  it("renders tooltip for spotlight steps", () => {
    mockContextValue.currentStep = 1; // health-dashboard step
    render(<ProductTour />);

    expect(screen.getByText("Your Health Dashboard")).toBeInTheDocument();
  });

  // ── Completion step (last step) ──

  it("renders completion modal on last step", () => {
    mockContextValue.currentStep = TOUR_STEPS.length - 1; // completion step
    render(<ProductTour />);

    expect(screen.getByText("You're All Set, Alex!")).toBeInTheDocument();
    expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
  });

  it("calls completeTour when Go to Dashboard is clicked on completion", () => {
    mockContextValue.currentStep = TOUR_STEPS.length - 1;
    render(<ProductTour />);

    fireEvent.click(screen.getByText("Go to Dashboard"));
    expect(mockContextValue.completeTour).toHaveBeenCalled();
  });

  // ── Keyboard navigation ──

  it("calls skipTour on Escape key", () => {
    render(<ProductTour />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockContextValue.skipTour).toHaveBeenCalled();
  });

  it("calls nextStep on ArrowRight key", () => {
    mockContextValue.currentStep = 1;
    render(<ProductTour />);

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(mockContextValue.nextStep).toHaveBeenCalled();
  });

  it("calls prevStep on ArrowLeft key when not on first step", () => {
    mockContextValue.currentStep = 3;
    render(<ProductTour />);

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(mockContextValue.prevStep).toHaveBeenCalled();
  });

  it("does not call prevStep on ArrowLeft when on step 0", () => {
    mockContextValue.currentStep = 0;
    render(<ProductTour />);

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(mockContextValue.prevStep).not.toHaveBeenCalled();
  });

  // ── Screen reader announcements ──

  it("renders screen reader announcement region", () => {
    mockContextValue.currentStep = 0;
    render(<ProductTour />);

    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  // ── Body scroll lock ──

  it("locks body scroll when active", () => {
    render(<ProductTour />);

    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body scroll when not active", () => {
    mockContextValue.isActive = false;
    render(<ProductTour />);

    expect(document.body.style.overflow).toBe("");
  });

  // ── Ambient background ──

  it("renders ambient background during tour", () => {
    render(<ProductTour />);

    // The TourAmbientBackground is rendered inside the dialog
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  // ── userName fallback ──

  it("uses 'there' when user.firstName is not available", () => {
    // Override auth mock temporarily via direct mutation
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const authMock = require("@/app/context/AuthContext");
    const originalUseAuth = authMock.useAuth;
    authMock.useAuth = () => ({
      user: { id: "1", firstName: null, email: "test@test.com", role: "user" },
      isLoading: false,
      isAuthenticated: true,
    });

    mockContextValue.currentStep = 0;
    render(<ProductTour />);

    expect(screen.getByText("Welcome to Balencia, there!")).toBeInTheDocument();

    // Restore
    authMock.useAuth = originalUseAuth;
  });
});
