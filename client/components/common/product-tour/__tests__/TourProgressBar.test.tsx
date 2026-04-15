import { render, screen } from "@testing-library/react";
import { TourProgressBar } from "../TourProgressBar";

// Mock framer-motion — render children as plain divs
jest.mock("framer-motion", () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ children, className, ...props }: any) => (
      <div className={className} data-testid="progress-dot" {...props}>
        {children}
      </div>
    ),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("TourProgressBar", () => {
  it("renders the correct number of dots", () => {
    render(
      <TourProgressBar currentStep={2} totalSteps={8} />
    );

    const dots = screen.getAllByTestId("progress-dot");
    expect(dots).toHaveLength(8);
  });

  it("marks the active step with active dot style", () => {
    render(
      <TourProgressBar currentStep={3} totalSteps={8} />
    );

    const dots = screen.getAllByTestId("progress-dot");
    // Active dot (index 3) should have the wider gradient class
    expect(dots[3].className).toContain("w-6");
    expect(dots[3].className).toContain("bg-gradient-to-r");
  });

  it("marks inactive dots correctly", () => {
    render(
      <TourProgressBar currentStep={3} totalSteps={8} />
    );

    const dots = screen.getAllByTestId("progress-dot");
    // Dot at index 5 (ahead of current) should be inactive
    expect(dots[5].className).toContain("w-2 h-2 bg-white/30");
  });

  it("has progressbar ARIA role with correct values", () => {
    render(
      <TourProgressBar currentStep={2} totalSteps={8} />
    );

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-valuenow", "3"); // currentStep + 1
    expect(progressbar).toHaveAttribute("aria-valuemin", "1");
    expect(progressbar).toHaveAttribute("aria-valuemax", "8");
    expect(progressbar).toHaveAttribute(
      "aria-label",
      "Tour step 3 of 8"
    );
  });

  it("handles first step correctly", () => {
    render(
      <TourProgressBar currentStep={0} totalSteps={5} />
    );

    const dots = screen.getAllByTestId("progress-dot");
    expect(dots[0].className).toContain("w-6");
    expect(dots[1].className).toContain("w-2 h-2 bg-white/30");
  });

  it("handles last step correctly", () => {
    render(
      <TourProgressBar currentStep={4} totalSteps={5} />
    );

    const dots = screen.getAllByTestId("progress-dot");
    expect(dots[4].className).toContain("w-6");
    // All previous dots are "completed" (same style as inactive in classNames)
    expect(dots[0].className).toContain("w-2 h-2 bg-white/30");
  });

  it("respects reducedMotion prop", () => {
    render(
      <TourProgressBar currentStep={2} totalSteps={5} reducedMotion={true} />
    );

    const dots = screen.getAllByTestId("progress-dot");
    expect(dots).toHaveLength(5);
  });

  it("renders with single step", () => {
    render(
      <TourProgressBar currentStep={0} totalSteps={1} />
    );

    const dots = screen.getAllByTestId("progress-dot");
    expect(dots).toHaveLength(1);
    expect(dots[0].className).toContain("w-6");
  });
});
