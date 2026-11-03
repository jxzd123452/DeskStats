import { Shell } from "./components/Shell";
import { Dialog, Toast } from "./components/ui";
import { CpuPage, DiskPage, GpuPage, MemoryPage, NetworkPage } from "./pages/Details";
import { Overview } from "./pages/Overview";
import { ProcessesPage } from "./pages/Processes";
import { SettingsPage } from "./pages/Settings";
import { DesktopScene } from "./pages/DesktopScene";
import { WidgetWindow } from "./pages/WidgetWindow";
import { useDesk } from "./state";

export function App() {
  const desk = useDesk();
  if (desk.role.type === "scene") return <DesktopScene />;
  if (desk.role.type === "widget") return <WidgetWindow kind={desk.role.kind} />;
  return (
    <>
      <Shell
        page={desk.page}
        paused={desk.paused}
        theme={desk.theme}
        t={desk.t}
        onNavigate={desk.setPage}
        onTheme={desk.toggleTheme}
        onSettings={() => desk.setPage("settings")}
      >
        {desk.page === "overview" ? <Overview /> : null}
        {desk.page === "cpu" ? <CpuPage /> : null}
        {desk.page === "memory" ? <MemoryPage /> : null}
        {desk.page === "gpu" ? <GpuPage /> : null}
        {desk.page === "disk" ? <DiskPage /> : null}
        {desk.page === "network" ? <NetworkPage /> : null}
        {desk.page === "processes" ? <ProcessesPage /> : null}
        {desk.page === "settings" ? <SettingsPage /> : null}
      </Shell>
      <Dialog
        open={desk.confirm != null}
        title={desk.t("endProcess")}
        body={
          desk.confirm
            ? desk.t("endProcessBody", { name: desk.confirm.name, pid: desk.confirm.pid })
            : ""
        }
        cancelLabel={desk.t("cancel")}
        confirmLabel={desk.t("confirmEnd")}
        onCancel={desk.cancelKill}
        onConfirm={desk.confirmKill}
      />
      <Toast text={desk.toast} />
    </>
  );
}
