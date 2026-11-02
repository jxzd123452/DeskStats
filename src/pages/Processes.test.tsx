import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Dialog } from "../components/ui";
import { DeskProvider } from "../state";
import { ProcessesPage } from "./Processes";

afterEach(() => cleanup());

describe("ProcessesPage", () => {
  it("filters the demo process list", () => {
    render(
      <DeskProvider>
        <ProcessesPage />
      </DeskProvider>,
    );
    expect(screen.getByText("Cursor")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search name, PID, or user"), { target: { value: "discord" } });
    expect(screen.getByText("Discord")).toBeInTheDocument();
    expect(screen.queryByText("Cursor")).not.toBeInTheDocument();
  });
});

describe("Dialog", () => {
  it("asks for confirmation before ending a process", () => {
    let confirmed = false;
    render(
      <Dialog
        open
        title="End process?"
        body="End chrome (PID 4)?"
        cancelLabel="Cancel"
        confirmLabel="End process"
        onCancel={() => {}}
        onConfirm={() => {
          confirmed = true;
        }}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("chrome");
    fireEvent.click(screen.getByRole("button", { name: "End process" }));
    expect(confirmed).toBe(true);
  });
});
