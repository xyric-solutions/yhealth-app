import { render, screen, fireEvent } from "@testing-library/react";
import { TourTooltip } from "../TourTooltip";
import type { TourStepConfig } from "../types";

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ children, className, style, ...rest }: any) => (
      <div className={className} style={style} {...rest}>
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

function makeDOMRect(x: number, y: number, w: number, h: number): DOMRect {
  return {
    x,
    y,
    width: w,
    height: h,
    top: y,
    left: x,
    right: x + w,
    bottom: y + h,
    toJSON: () => {},
  } as DOMRect;
}

const mockStep: TourStepConfig = {
  id: "health-dashboard",
  type: "spotlight",
  title: "Your Health Dashboard",
  description: "Track heart rate, sleep quality, and more.",
  targetSelector: '[data-tour="health-dashboard"]',
  tooltipPosition: "bottom",
  icon: "Activity",
  accentColor: "from-cyan-500 to-blue-500",
};

const defaultProps = {
  step: mockStep,
  targetRect: makeDOMRect(400, 100, 200, 50),
  onNext: jest.fn(),
  onPrev: jest.fn(),
  onSkip: jest.fn(),
  currentStep: 1,
  totalSteps: 8,
  userName: "Alex",
  visible: true,
  reducedMotion: false,
  isMobile: false,
};

describe("TourTooltip", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { value: 1440, writable: true });
    Object.defineProperty(window, "innerHeight", { value: 900, writable: true });
  });

  it("renders nothing when not visible", () => {
    const { container } = render(
      <TourTooltip {...defaultProps} visible={false} />
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders the tooltip with step title and description", () => {
    render(<TourTooltip {...defaultProps} />);

    expect(screen.getByText("Your Health Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Track heart rate, sleep quality, and more.")).toBeInTheDocument();
  });

  it("displays step counter", () => {
    render(<TourTooltip {...defaultProps} currentStep={1} totalSteps={8} />);

    expect(screen.getByText("2 / 8")).toBeInTheDocument();
  });

  it("calls onNext when Next button is clicked", () => {
    const onNext = jest.fn();
    render(<TourTooltip {...defaultProps} onNext={onNext} />);

    fireEvent.click(screen.getByText("Next"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onPrev when Back button is clicked", () => {
    const onPrev = jest.fn();
    render(<TourTooltip {...defaultProps} onPrev={onPrev} currentStep={2} />);

    fireEvent.click(screen.getByText("Back"));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it("does not show Back button on first step", () => {
    render(<TourTooltip {...defaultProps} currentStep={0} />);

    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  it("shows Back button on non-first steps", () => {
    render(<TourTooltip {...defaultProps} currentStep={3} />);

    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  it("calls onSkip when skip (X) button is clicked", () => {
    const onSkip = jest.fn();
    render(<TourTooltip {...defaultProps} onSkip={onSkip} />);

    fireEvent.click(screen.getByLabelText("Skip tour"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("shows 'Finish' as CTA on last step", () => {
    render(
      <TourTooltip
        {...defaultProps}
        currentStep={7}
        totalSteps={8}
      />
    );

    expect(screen.getByText("Finish")).toBeInTheDocument();
  });

  it("uses custom ctaPrimary from step config", () => {
    render(
      <TourTooltip
        {...defaultProps}
        step={{ ...mockStep, ctaPrimary: "Continue" }}
      />
    );

    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("interpolates {firstName} in title", () => {
    render(
      <TourTooltip
        {...defaultProps}
        step={{ ...mockStep, title: "Welcome, {firstName}!" }}
        userName="Jordan"
      />
    );

    expect(screen.getByText("Welcome, Jordan!")).toBeInTheDocument();
  });

  it("renders progress bar", () => {
    render(<TourTooltip {...defaultProps} />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("has navigation group with correct ARIA label", () => {
    render(<TourTooltip {...defaultProps} />);

    expect(screen.getByRole("group", { name: "Tour navigation" })).toBeInTheDocument();
  });

  it("renders as bottom sheet on mobile", () => {
    const { container } = render(
      <TourTooltip {...defaultProps} isMobile={true} />
    );

    // Mobile renders with bottom-0 fixed positioning
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toContain("bottom-0");
  });

  it("renders with desktop positioning when not mobile", () => {
    render(
      <TourTooltip {...defaultProps} isMobile={false} />
    );

    // Desktop renders with role="alertdialog"
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("renders the step icon when provided", () => {
    render(<TourTooltip {...defaultProps} />);

    // The icon renders within an icon container
    const iconContainer = document.querySelector('[class*="bg-gradient-to-br"]');
    expect(iconContainer).toBeInTheDocument();
  });

  it("next button has correct aria-label for mid-tour step", () => {
    render(<TourTooltip {...defaultProps} currentStep={3} totalSteps={8} />);

    expect(screen.getByLabelText("Go to next step")).toBeInTheDocument();
  });

  it("next button has correct aria-label for last step", () => {
    render(<TourTooltip {...defaultProps} currentStep={7} totalSteps={8} />);

    expect(screen.getByLabelText("Finish tour")).toBeInTheDocument();
  });

  it("back button has correct aria-label", () => {
    render(<TourTooltip {...defaultProps} currentStep={3} />);

    expect(screen.getByLabelText("Go to previous step")).toBeInTheDocument();
  });

  it("centers tooltip when targetRect is null", () => {
    const { container } = render(
      <TourTooltip {...defaultProps} targetRect={null} />
    );

    const tooltip = container.querySelector("[role='alertdialog']") as HTMLElement;
    expect(tooltip?.style.transform).toBe("translate(-50%, -50%)");
  });
});
