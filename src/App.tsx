import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Boxes, PanelRightOpen, SlidersHorizontal, Trash2, X } from "lucide-react";
import { AdminDashboard } from "./components/AdminDashboard";
import { AgentChatView } from "./components/AgentChatView";
import { AppNavigation, type AppView } from "./components/AppNavigation";
import { AssetLibrary } from "./components/AssetLibrary";
import { RightPanel, type RightPanelTab } from "./components/RightPanel";
import { SandboxEditor, type SandboxEditorHandle } from "./components/SandboxEditor";
import { TopBar } from "./components/TopBar";
import { toSandboxAsset } from "./data/assets";
import { getEnvironmentLabel } from "./data/environment";
import { createInitialScene } from "./data/initialScene";
import type {
  SandboxAsset,
  SandboxEnvironment,
  SandboxEvent,
  SandboxEventDraft,
  SandboxLayoutPreferences,
  SandboxObject,
} from "./types";
import { BOARD_HEIGHT, BOARD_WIDTH, analyzeScene, buildSnapshot, clamp } from "./utils/analysis";
import { downloadSnapshot } from "./utils/download";
import { createSandboxEvent } from "./utils/events";
import { createSandboxObject } from "./utils/objectFactory";
import {
  loadAgentConversations,
  loadLlmProviders,
  loadManagedAssets,
  loadPsychAgents,
  loadSandboxLayoutPreferences,
  loadSandboxEnvironment,
  loadScene,
  resetManagedAssets,
  saveAgentConversations,
  saveLlmProviders,
  saveManagedAssets,
  savePsychAgents,
  saveSandboxLayoutPreferences,
  saveSandboxEnvironment,
  saveScene,
} from "./utils/storage";

interface SceneState {
  objects: SandboxObject[];
  events: SandboxEvent[];
}

export function App(): JSX.Element {
  const [initialScene] = useState<SceneState>(() => loadScene() ?? createInitialScene());
  const [objects, setObjects] = useState<SandboxObject[]>(initialScene.objects);
  const [events, setEvents] = useState<SandboxEvent[]>(initialScene.events);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(false);
  const [environment, setEnvironment] = useState(() => loadSandboxEnvironment());
  const [layoutPreferences, setLayoutPreferences] = useState(() => loadSandboxLayoutPreferences());
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("scene");
  const [activeView, setActiveView] = useState<AppView>("sandbox");
  const [managedAssets, setManagedAssets] = useState(() => loadManagedAssets());
  const [llmProviders, setLlmProviders] = useState(() => loadLlmProviders());
  const [agents, setAgents] = useState(() => loadPsychAgents());
  const [conversations, setConversations] = useState(() => loadAgentConversations());
  const editorRef = useRef<SandboxEditorHandle | null>(null);

  const analysis = useMemo(() => analyzeScene(objects), [objects]);
  const visibleAssets = useMemo(
    () =>
      managedAssets
        .filter((asset) => asset.enabled && !asset.deletedAt)
        .map((asset) => toSandboxAsset(asset)),
    [managedAssets],
  );
  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedId) ?? null,
    [objects, selectedId],
  );
  const sandboxFocusMode = activeView === "sandbox" && layoutPreferences.focusMode;
  const rightPanelCollapsed = layoutPreferences.rightPanelCollapsed;

  useEffect(() => {
    saveScene({ objects, events });
  }, [events, objects]);

  useEffect(() => {
    saveSandboxEnvironment(environment);
  }, [environment]);

  useEffect(() => {
    saveSandboxLayoutPreferences(layoutPreferences);
  }, [layoutPreferences]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }

      if (activeView !== "sandbox") {
        return;
      }

      if (event.key === "Escape" && layoutPreferences.focusMode) {
        event.preventDefault();
        setLayoutPreferences((current) => ({ ...current, focusMode: false, assetDrawerOpen: false }));
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        setLayoutPreferences((current) => ({
          ...current,
          focusMode: !current.focusMode,
          assetDrawerOpen: false,
        }));
      }

      if (event.key.toLowerCase() === "i" && !layoutPreferences.focusMode) {
        event.preventDefault();
        setLayoutPreferences((current) => ({
          ...current,
          rightPanelCollapsed: !current.rightPanelCollapsed,
        }));
      }

      if (event.key.toLowerCase() === "a" && layoutPreferences.focusMode) {
        event.preventDefault();
        setLayoutPreferences((current) => ({
          ...current,
          assetDrawerOpen: !current.assetDrawerOpen,
        }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeView, layoutPreferences.focusMode]);

  useEffect(() => {
    saveManagedAssets(managedAssets);
  }, [managedAssets]);

  useEffect(() => {
    saveLlmProviders(llmProviders);
  }, [llmProviders]);

  useEffect(() => {
    savePsychAgents(agents);
  }, [agents]);

  useEffect(() => {
    saveAgentConversations(conversations);
  }, [conversations]);

  const recordEvent = useCallback((draft: SandboxEventDraft) => {
    const event = createSandboxEvent(draft);
    setEvents((current) => [...current, event].slice(-320));
  }, []);

  const patchObject = useCallback((objectId: string, patch: Partial<SandboxObject>) => {
    setObjects((current) =>
      current.map((object) =>
        object.id === objectId
          ? {
              ...object,
              ...sanitizePatch(patch),
            }
          : object,
      ),
    );
  }, []);

  const addAssetToScene = useCallback(
    (asset: SandboxAsset, position?: { x: number; y: number }) => {
      const index = objects.length;
      const fallbackPosition = {
        x: BOARD_WIDTH / 2 + ((index % 5) - 2) * 34,
        y: BOARD_HEIGHT / 2 + ((Math.floor(index / 5) % 3) - 1) * 30,
      };
      const object = createSandboxObject(asset, position ?? fallbackPosition);
      setObjects((current) => [...current, object]);
      setSelectedId(object.id);
      recordEvent({
        type: "add",
        objectId: object.id,
        assetId: asset.assetId,
        label: `添加沙具: ${asset.name}`,
        payload: {
          position: { x: Math.round(object.x), y: Math.round(object.y) },
          symbolicCandidates: asset.symbolicCandidates,
          riskTag: asset.riskTag,
        },
      });
    },
    [objects.length, recordEvent],
  );

  const handleDropAsset = useCallback(
    (assetId: string, position: { x: number; y: number }) => {
      const asset = visibleAssets.find((item) => item.assetId === assetId);
      if (asset) {
        addAssetToScene(asset, position);
      }
    },
    [addAssetToScene, visibleAssets],
  );

  const handlePatchSelected = useCallback(
    (patch: Partial<SandboxObject>, label: string) => {
      if (!selectedObject) {
        return;
      }

      patchObject(selectedObject.id, patch);
      recordEvent({
        type: "property_change",
        objectId: selectedObject.id,
        assetId: selectedObject.assetId,
        label,
        payload: {
          patch: sanitizePatch(patch),
        },
      });
    },
    [patchObject, recordEvent, selectedObject],
  );

  const handleSelectObject = useCallback((objectId: string | null) => {
    setSelectedId(objectId);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedObject) {
      return;
    }

    setObjects((current) => current.filter((object) => object.id !== selectedObject.id));
    setSelectedId(null);
    recordEvent({
      type: "delete",
      objectId: selectedObject.id,
      assetId: selectedObject.assetId,
      label: `删除沙具: ${selectedObject.name}`,
      payload: {
        x: Math.round(selectedObject.x),
        y: Math.round(selectedObject.y),
      },
    });
  }, [recordEvent, selectedObject]);

  const handleClearScene = useCallback(() => {
    setObjects([]);
    setSelectedId(null);
    recordEvent({
      type: "clear",
      label: "清空当前作品",
      payload: {
        previousObjectCount: objects.length,
      },
    });
  }, [objects.length, recordEvent]);

  const handleExportJson = useCallback(() => {
    const event = createSandboxEvent({
      type: "export",
      label: "导出 JSON 快照",
      payload: {
        objectCount: objects.length,
        eventCount: events.length + 1,
      },
    });
    const nextEvents = [...events, event].slice(-320);
    setEvents(nextEvents);
    downloadSnapshot(buildSnapshot(objects, nextEvents, analysis, environment));
  }, [analysis, environment, events, objects]);

  const handleExportPng = useCallback(() => {
    editorRef.current?.exportPng();
    recordEvent({
      type: "export",
      label: "导出 PNG 截图",
      payload: {
        objectCount: objects.length,
      },
    });
  }, [objects.length, recordEvent]);

  const handleEnvironmentChange = useCallback(
    (patch: Partial<SandboxEnvironment>) => {
      const next = { ...environment, ...patch };
      setEnvironment(next);
      recordEvent({
        type: "property_change",
        label: `调整沙盘环境: ${getEnvironmentLabel(next)}`,
        payload: {
          environment: next,
        },
      });
    },
    [environment, recordEvent],
  );

  const patchLayoutPreferences = useCallback((patch: Partial<SandboxLayoutPreferences>) => {
    setLayoutPreferences((current) => ({ ...current, ...patch }));
  }, []);

  const handleToggleFocusMode = useCallback(() => {
    setLayoutPreferences((current) => ({
      ...current,
      focusMode: !current.focusMode,
      assetDrawerOpen: false,
    }));
  }, []);

  const handleToggleRightPanel = useCallback(() => {
    setLayoutPreferences((current) => ({
      ...current,
      rightPanelCollapsed: !current.rightPanelCollapsed,
    }));
  }, []);

  const handleOpenAiCompanion = useCallback(() => {
    setRightPanelTab("ai");
    setLayoutPreferences((current) => ({ ...current, rightPanelCollapsed: false }));
  }, []);

  return (
    <div className={classNames("product-shell", environment.light === "night" && "night-mode", sandboxFocusMode && "focus-mode")}>
      {!sandboxFocusMode ? <AppNavigation activeView={activeView} onViewChange={setActiveView} /> : null}

      {activeView === "sandbox" ? (
        <div
          className={classNames(
            "app-shell",
            rightPanelCollapsed && !sandboxFocusMode && "right-panel-collapsed",
            sandboxFocusMode && "focus-mode",
            sandboxFocusMode && layoutPreferences.assetDrawerOpen && "asset-drawer-open",
          )}
        >
          {sandboxFocusMode ? (
            <>
              <button
                className="focus-floating-button focus-asset-toggle"
                type="button"
                onClick={() => patchLayoutPreferences({ assetDrawerOpen: !layoutPreferences.assetDrawerOpen })}
                aria-label={layoutPreferences.assetDrawerOpen ? "关闭全屏沙具库" : "打开全屏沙具库"}
              >
                {layoutPreferences.assetDrawerOpen ? <X size={18} /> : <Boxes size={18} />}
                <span>{layoutPreferences.assetDrawerOpen ? "关闭沙具库" : "沙具库"}</span>
              </button>
              <button
                className="focus-floating-button focus-panel-toggle"
                type="button"
                onClick={() => patchLayoutPreferences({ focusMode: false, rightPanelCollapsed: false })}
                aria-label="退出全屏并打开作品面板"
              >
                <PanelRightOpen size={18} />
                <span>作品面板</span>
              </button>
              {layoutPreferences.assetDrawerOpen ? (
                <>
                  <button
                    className="focus-drawer-scrim"
                    type="button"
                    aria-label="关闭沙具库抽屉"
                    onClick={() => patchLayoutPreferences({ assetDrawerOpen: false })}
                  />
                  <div className="focus-asset-drawer">
                    <AssetLibrary assets={visibleAssets} onAddAsset={addAssetToScene} />
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <AssetLibrary assets={visibleAssets} onAddAsset={addAssetToScene} />
          )}

          <section className="workspace-column" aria-label="沙盘编辑区">
            <TopBar
              objectCount={objects.length}
              environment={environment}
              focusMode={sandboxFocusMode}
              rightPanelCollapsed={rightPanelCollapsed}
              showRightPanelToggle={!sandboxFocusMode}
              showGuides={showGuides}
              onEnvironmentChange={handleEnvironmentChange}
              onToggleFocusMode={handleToggleFocusMode}
              onToggleRightPanel={handleToggleRightPanel}
              onToggleGuides={() => setShowGuides((current) => !current)}
              onExportJson={handleExportJson}
              onExportPng={handleExportPng}
              onClearScene={handleClearScene}
            />
            <SandboxEditor
              ref={editorRef}
              objects={objects}
              selectedId={selectedId}
              environment={environment}
              showGuides={showGuides}
              onSelectObject={handleSelectObject}
              onPatchObject={patchObject}
              onDropAsset={handleDropAsset}
              onDeleteSelected={handleDeleteSelected}
              onRecordEvent={recordEvent}
              aiCompanionActive={rightPanelTab === "ai"}
              onOpenAiCompanion={handleOpenAiCompanion}
            />
          </section>

          {sandboxFocusMode ? (
            <FocusSelectionCard
              selectedObject={selectedObject}
              onPatchSelected={handlePatchSelected}
              onDeleteSelected={handleDeleteSelected}
            />
          ) : (
            <RightPanel
              objects={objects}
              selectedObject={selectedObject}
              events={events}
              analysis={analysis}
              llmProviders={llmProviders}
              activeTab={rightPanelTab}
              collapsed={rightPanelCollapsed}
              onTabChange={setRightPanelTab}
              onToggleCollapsed={handleToggleRightPanel}
              onPatchSelected={handlePatchSelected}
              onDeleteSelected={handleDeleteSelected}
            />
          )}
        </div>
      ) : null}

      {activeView === "agentChat" ? (
        <AgentChatView
          agents={agents}
          llmProviders={llmProviders}
          conversations={conversations}
          objects={objects}
          events={events}
          analysis={analysis}
          onConversationsChange={setConversations}
        />
      ) : null}

      {activeView === "admin" ? (
        <AdminDashboard
          managedAssets={managedAssets}
          llmProviders={llmProviders}
          agents={agents}
          onManagedAssetsChange={setManagedAssets}
          onLlmProvidersChange={setLlmProviders}
          onAgentsChange={setAgents}
          onResetAssets={() => setManagedAssets(resetManagedAssets())}
        />
      ) : null}
    </div>
  );
}

function FocusSelectionCard({
  selectedObject,
  onPatchSelected,
  onDeleteSelected,
}: {
  selectedObject: SandboxObject | null;
  onPatchSelected: (patch: Partial<SandboxObject>, label: string) => void;
  onDeleteSelected: () => void;
}): JSX.Element {
  if (!selectedObject) {
    return (
      <aside className="focus-selection-card empty" aria-label="全屏对象快捷属性">
        <SlidersHorizontal size={17} />
        <span>选择一个沙具后，可在这里快速调整旋转、缩放或删除。</span>
      </aside>
    );
  }

  return (
    <aside className="focus-selection-card" aria-label="全屏对象快捷属性">
      <div>
        <p className="eyebrow">Selected Toy</p>
        <h3>{selectedObject.name}</h3>
        <span>
          {Math.round(selectedObject.x)}, {Math.round(selectedObject.y)}
        </span>
      </div>
      <label>
        <span>旋转</span>
        <input
          type="range"
          min={0}
          max={359}
          value={Math.round(selectedObject.rotation)}
          onChange={(event) =>
            onPatchSelected({ rotation: Number(event.target.value) }, `旋转沙具: ${selectedObject.name}`)
          }
        />
        <strong>{Math.round(selectedObject.rotation)}°</strong>
      </label>
      <label>
        <span>缩放</span>
        <input
          type="range"
          min={0.35}
          max={2.4}
          step={0.05}
          value={selectedObject.scale}
          onChange={(event) =>
            onPatchSelected({ scale: Number(event.target.value) }, `缩放沙具: ${selectedObject.name}`)
          }
        />
        <strong>{selectedObject.scale.toFixed(2)}</strong>
      </label>
      <button className="icon-button danger" type="button" onClick={onDeleteSelected}>
        <Trash2 size={16} />
        <span>删除</span>
      </button>
    </aside>
  );
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function sanitizePatch(patch: Partial<SandboxObject>): Partial<SandboxObject> {
  const next = { ...patch };

  if (typeof next.x === "number") {
    next.x = clamp(next.x, 0, BOARD_WIDTH);
  }
  if (typeof next.y === "number") {
    next.y = clamp(next.y, 0, BOARD_HEIGHT);
  }
  if (typeof next.scale === "number") {
    next.scale = clamp(next.scale, 0.35, 2.4);
  }
  if (typeof next.rotation === "number") {
    next.rotation = ((next.rotation % 360) + 360) % 360;
  }

  return next;
}
