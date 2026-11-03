import { useEffect, useRef } from "react";
import { WidgetFace } from "../components/WidgetFace";
import { isTauri } from "../lib/settings";
import { placementOf, type WidgetKind } from "../lib/widgets";
import { useDesk } from "../state";

export function WidgetWindow({ kind }: { kind: WidgetKind }) {
  const desk = useDesk();
  const placement = placementOf(desk.widgets, kind);
  const seenOpen = useRef(placement.open);

  useEffect(() => {
    if (seenOpen.current && !placement.open && !isTauri()) window.close();
    seenOpen.current = placement.open;
  }, [placement.open]);

  return (
    <WidgetFace
      kind={kind}
      snap={desk.snap}
      history={desk.history}
      accents={desk.accents}
      t={desk.t}
      opacity={placement.opacity}
      mode={placement.mode}
      locked={placement.clickThrough}
      interactive
      onClose={() => desk.toggleWidget(kind, false)}
      onToggleMode={() => desk.patchWidget(kind, { mode: placement.mode === "desktop" ? "top" : "desktop" }, true)}
      onToggleLock={() => desk.patchWidget(kind, { clickThrough: !placement.clickThrough }, true)}
    />
  );
}
