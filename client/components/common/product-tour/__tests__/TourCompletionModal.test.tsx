import { render, screen, fireEvent } from "@testing-library/react";
import { TourCompletionModal } from "../TourCompletionModal";
import type { TourStepConfig } from "../types";

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ children, className, ...rest }: any) => (
      <div className={className} {...rest}>{children}</div>
    ),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock canvas-confetti
jest.mock("canvas-confetti", () => jest.fn());

const mockStep: TourStepConfig = {
  id: "completion",
  type: "fullscreen",
  title: "You're All Set, {firstName}!",
  description: "Your health journey starts now.",
  icon: "PartyPopper",
  accentColor: "from-emerald-500 via-cyan-500 to-blue-500",
  ctaPrimary: "Go to Dashboard",
};

describe("TourCompletionModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when not visible", () => {
    const { container } = render(
      <TourCompletionModal
        step={mockStep}
        onComplete={jest.fn()}
        visible={false}
      />
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders the completion modal when visible", () => {
    render(
      <TourCompletionModal
        step={mockStep}
        onComplete={jest.fn()}
        visible={true}
        userName="Alex"
      />
    );

    expect(screen.getByText("You're All Set, Alex!")).toBeInTheDocument();
  });

  it("interpolates {firstName} in title", () => {
    render(
      <TourCompletionModal
        step={mockStep}
        onComplete={jest.fn()}
        visible={true}
        userName="Jordan"
      />
    );

    expect(screen.getByText("You're All Set, Jordan!")).toBeInTheDocument();
  });

  it("defaults userName to 'there'", () => {
    render(
      <TourCompletionModal
        step={mockStep}
        onComplete={jest.fn()}
        visible={true}
      />
    );

    expect(screen.getByText("You're All Set, there!")).toBeInTheDocument();
  });

  it("renders the CTA button with correct text", () => {
    render(
      <TourCompletionModal
        step={mockStep}
        onComplete={jest.fn()}
        visible={true}
      />
    );

    expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
  });

  it("calls onComplete when CTA button is clicked", () => {
    const onComplete = jest.fn();
    render(
      <TourCompletionModal
        step={mockStep}
        onComplete={onComplete}
        visible={true}
      />
    );

    fireEvent.click(screen.getByText("Go to Dashboard"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("fires confetti when modal becomes visible", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const confetti = require("canvas-confetti");

    render(
      <TourCompletionModal
        step={mockStep}
        onComplete={jest.fn()}
        visible={true}
      />
    );

    // Main burst should fire
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 100,
        spread: 70,
      })
    );
  });

  it("has correct ARIA attributes", () => {
    render(
      <TourCompletionModal
        step={mockStep}
        onComplete={jest.fn()}
        visible={true}
      />
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "tour-completion-title");
    expect(dialog).toHaveAttribute("aria-describedby", "tour-completion-description");
  });

  it("renders the motivational quote", () => {
    render(
      <TourCompletionModal
        step={mockStep}
        onComplete={jest.fn()}
        visible={true}
      />
    );

    // The quote contains smart quotes
    expect(screen.getByText(/ready.*build your best self/i)).toBeInTheDocument();
  });

  it("renders description text", () => {
    render(
      <TourCompletionModal
        step={mockStep}
        onComplete={jest.fn()}
        visible={true}
      />
    );

    expect(screen.getByText("Your health journey starts now.")).toBeInTheDocument();
  });

  it("uses default CTA text when not provided", () => {
    render(
      <TourCompletionModal
        step={{ ...mockStep, ctaPrimary: undefined }}
        onComplete={jest.fn()}
        visible={true}
      />
    );

    expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
  });
});
