import { render } from "@testing-library/react";
import { TourOverlay } from "../TourOverlay";

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: ({ children, className, onClick, ...rest }: any) => (
      <div className={className} onClick={onClick} data-testid="overlay" {...rest}>
        {children}
      </div>
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

describe("TourOverlay", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(
      <TourOverlay targetRect={null} visible={false} />
    );

    expect(container.querySelector("[data-testid='overlay']")).toBeNull();
  });

  it("renders SVG overlay when visible without target", () => {
    const { container } = render(
      <TourOverlay targetRect={null} visible={true} />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();

    // Should have the mask defined
    const mask = container.querySelector("mask#tour-spotlight-mask");
    expect(mask).toBeInTheDocument();

    // Should have the white background rect only (no cutout)
    const rects = mask!.querySelectorAll("rect");
    expect(rects).toHaveLength(1); // Only the white background
  });

  it("renders spotlight cutout when targetRect provided", () => {
    const rect = makeDOMRect(100, 200, 300, 150);

    const { container } = render(
      <TourOverlay targetRect={rect} visible={true} />
    );

    const mask = container.querySelector("mask#tour-spotlight-mask");
    const rects = mask!.querySelectorAll("rect");

    // White bg + black cutout
    expect(rects).toHaveLength(2);

    const cutout = rects[1];
    // cutout should have x = 100 - 12 (padding) = 88
    expect(cutout.getAttribute("x")).toBe("88");
    expect(cutout.getAttribute("y")).toBe("188");
    expect(cutout.getAttribute("width")).toBe("324"); // 300 + 24
    expect(cutout.getAttribute("height")).toBe("174"); // 150 + 24
  });

  it("has aria-hidden on overlay", () => {
    const { container } = render(
      <TourOverlay targetRect={null} visible={true} />
    );

    const overlay = container.querySelector("[data-testid='overlay']");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
  });

  it("calls onClick when overlay is clicked", () => {
    const onClick = jest.fn();
    const { container } = render(
      <TourOverlay targetRect={null} visible={true} onClick={onClick} />
    );

    const overlay = container.querySelector("[data-testid='overlay']") as HTMLElement;
    overlay.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies custom padding to cutout", () => {
    const rect = makeDOMRect(100, 100, 200, 100);

    const { container } = render(
      <TourOverlay targetRect={rect} visible={true} padding={20} />
    );

    const mask = container.querySelector("mask#tour-spotlight-mask");
    const cutout = mask!.querySelectorAll("rect")[1];

    expect(cutout.getAttribute("x")).toBe("80"); // 100 - 20
    expect(cutout.getAttribute("y")).toBe("80");
    expect(cutout.getAttribute("width")).toBe("240"); // 200 + 40
    expect(cutout.getAttribute("height")).toBe("140"); // 100 + 40
  });

  it("applies custom borderRadius to cutout", () => {
    const rect = makeDOMRect(100, 100, 200, 100);

    const { container } = render(
      <TourOverlay targetRect={rect} visible={true} borderRadius={30} />
    );

    const mask = container.querySelector("mask#tour-spotlight-mask");
    const cutout = mask!.querySelectorAll("rect")[1];

    expect(cutout.getAttribute("rx")).toBe("30");
    expect(cutout.getAttribute("ry")).toBe("30");
  });
});
