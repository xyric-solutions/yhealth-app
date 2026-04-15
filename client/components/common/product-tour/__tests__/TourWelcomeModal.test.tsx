import { render, screen, fireEvent } from "@testing-library/react";
import { TourWelcomeModal } from "../TourWelcomeModal";
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

const mockStep: TourStepConfig = {
  id: "welcome",
  type: "fullscreen",
  title: "Welcome to Balencia, {firstName}!",
  description: "Your AI-powered health companion is ready.",
  icon: "Sparkles",
  accentColor: "from-emerald-500 to-cyan-500",
  ctaPrimary: "Start Tour",
  ctaSecondary: "Skip for now",
};

describe("TourWelcomeModal", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(
      <TourWelcomeModal
        step={mockStep}
        onStart={jest.fn()}
        onSkip={jest.fn()}
        visible={false}
      />
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders the welcome modal when visible", () => {
    render(
      <TourWelcomeModal
        step={mockStep}
        onStart={jest.fn()}
        onSkip={jest.fn()}
        visible={true}
        userName="Alex"
      />
    );

    expect(screen.getByText("Welcome to Balencia, Alex!")).toBeInTheDocument();
  });

  it("interpolates {firstName} in title and description", () => {
    render(
      <TourWelcomeModal
        step={{
          ...mockStep,
          title: "Hello, {firstName}!",
          description: "{firstName}, let me show you around.",
        }}
        onStart={jest.fn()}
        onSkip={jest.fn()}
        visible={true}
        userName="Jordan"
      />
    );

    expect(screen.getByText("Hello, Jordan!")).toBeInTheDocument();
    expect(screen.getByText("Jordan, let me show you around.")).toBeInTheDocument();
  });

  it("defaults userName to 'there' when not provided", () => {
    render(
      <TourWelcomeModal
        step={mockStep}
        onStart={jest.fn()}
        onSkip={jest.fn()}
        visible={true}
      />
    );

    expect(screen.getByText("Welcome to Balencia, there!")).toBeInTheDocument();
  });

  it("renders start and skip buttons with correct text", () => {
    render(
      <TourWelcomeModal
        step={mockStep}
        onStart={jest.fn()}
        onSkip={jest.fn()}
        visible={true}
      />
    );

    expect(screen.getByText("Start Tour")).toBeInTheDocument();
    expect(screen.getByText("Skip for now")).toBeInTheDocument();
  });

  it("calls onStart when start button is clicked", () => {
    const onStart = jest.fn();
    render(
      <TourWelcomeModal
        step={mockStep}
        onStart={onStart}
        onSkip={jest.fn()}
        visible={true}
      />
    );

    fireEvent.click(screen.getByText("Start Tour"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("calls onSkip when skip button is clicked", () => {
    const onSkip = jest.fn();
    render(
      <TourWelcomeModal
        step={mockStep}
        onStart={jest.fn()}
        onSkip={onSkip}
        visible={true}
      />
    );

    fireEvent.click(screen.getByText("Skip for now"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("has correct ARIA attributes", () => {
    render(
      <TourWelcomeModal
        step={mockStep}
        onStart={jest.fn()}
        onSkip={jest.fn()}
        visible={true}
      />
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "tour-welcome-title");
    expect(dialog).toHaveAttribute("aria-describedby", "tour-welcome-description");
  });

  it("uses custom CTA text from step config", () => {
    render(
      <TourWelcomeModal
        step={{
          ...mockStep,
          ctaPrimary: "Let's Go!",
          ctaSecondary: "Maybe Later",
        }}
        onStart={jest.fn()}
        onSkip={jest.fn()}
        visible={true}
      />
    );

    expect(screen.getByText("Let's Go!")).toBeInTheDocument();
    expect(screen.getByText("Maybe Later")).toBeInTheDocument();
  });

  it("uses default CTA text when not provided in step", () => {
    render(
      <TourWelcomeModal
        step={{
          ...mockStep,
          ctaPrimary: undefined,
          ctaSecondary: undefined,
        }}
        onStart={jest.fn()}
        onSkip={jest.fn()}
        visible={true}
      />
    );

    expect(screen.getByText("Start Tour")).toBeInTheDocument();
    expect(screen.getByText("Skip for now")).toBeInTheDocument();
  });
});
