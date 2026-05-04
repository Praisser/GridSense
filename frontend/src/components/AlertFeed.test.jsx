import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AlertFeed from "./AlertFeed";

const alert = {
  meter_id: "M07",
  loss_type: "bypass_theft",
  confidence: 0.81,
  last_anomaly_at: "2024-01-07T23:45:00Z",
  total_kwh_lost: 109.4,
};

describe("AlertFeed", () => {
  it("renders alert cards with field-officer summary details", () => {
    render(
      <AlertFeed
        alerts={[alert]}
        onRefreshAlerts={vi.fn()}
        onSelectMeter={vi.fn()}
        relativeTimeReference={new Date("2024-01-08T01:45:00Z")}
      />,
    );

    expect(screen.getByRole("button", { name: /M07/i })).toBeInTheDocument();
    expect(screen.getByText("Bypass")).toBeInTheDocument();
    expect(screen.getByText("81%")).toBeInTheDocument();
    expect(screen.getByText("109.4 kWh")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
  });

  it("renders empty, loading, and error states", () => {
    const { rerender } = render(
      <AlertFeed alerts={[]} loading onRefreshAlerts={vi.fn()} />,
    );
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );

    rerender(<AlertFeed alerts={[]} onRefreshAlerts={vi.fn()} />);
    expect(screen.getByText("System Baseline Secure")).toBeInTheDocument();

    rerender(
      <AlertFeed
        alerts={[]}
        error="Could not load alerts. Retry?"
        onRefreshAlerts={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load alerts.",
    );
  });
});
