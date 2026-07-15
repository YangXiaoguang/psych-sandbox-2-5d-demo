import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Boxes, PanelRightOpen, SlidersHorizontal, Trash2, X } from "lucide-react";
import type { AdminGovernanceData } from "./admin/types";
import { AdminDashboard } from "./components/AdminDashboard";
import { AuthScreen } from "./components/AuthScreen";
import { AiCompanionPanel } from "./components/AiCompanionPanel";
import { AgentChatView } from "./components/AgentChatView";
import { AppNavigation, type AppView } from "./components/AppNavigation";
import { AssetLibrary } from "./components/AssetLibrary";
import { PersonalCenter } from "./components/PersonalCenter";
import { RightPanel, type RightPanelTab } from "./components/RightPanel";
import { SandboxEditor, type SandboxEditorHandle } from "./components/SandboxEditor";
import { TopBar } from "./components/TopBar";
import { toSandboxAsset } from "./data/assets";
import { getEnvironmentLabel } from "./data/environment";
import { createInitialScene } from "./data/initialScene";
import type {
  LlmProviderConfig,
  SandboxAnalysis,
  SandboxAsset,
  SandboxCameraState,
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
import { DEFAULT_SANDBOX_CAMERA, normalizeSandboxCamera } from "./utils/projection";
import {
  loadLlmProviders,
  loadManagedAssets,
  loadPsychAgents,
  loadScene,
  resetManagedAssets,
  saveLlmProviders,
  saveManagedAssets,
  savePsychAgents,
} from "./utils/storage";
import {
  buildPersonalContextPacket,
  createLocalPersonalUser,
  getActiveProfile,
  switchActivePersonalUser,
} from "./personal/localMemoryStore";
import { getSystemRepositoryAdapter, loadRepositoryMode, saveRepositoryMode } from "./platform/repositoryAdapterRegistry";
import type { RepositoryMode, SystemArchitectureReport } from "./platform/repositoryTypes";
import type { CreatePersonalUserInput, SandtraySessionArchive } from "./personal/types";
import {
  clearLocalAuthSession,
  createGuestAuthSession,
  createLocalPasswordResetPreview,
  isLocalAuthEmailAvailable,
  loadLocalAuthSession,
  loginLocalAuthIdentity,
  registerLocalAuthIdentity,
} from "./auth/localAuth";
import type { LocalAuthSession } from "./auth/types";

interface SceneState {
  objects: SandboxObject[];
  events: SandboxEvent[];
}

const SANDBOX_CAMERA_STORAGE_KEY = "psych-sandbox:stage-camera-v15";

export function App(): JSX.Element {
  const [repositoryMode, setRepositoryMode] = useState<RepositoryMode>(() => loadRepositoryMode());
  const repositoryAdapter = useMemo(() => getSystemRepositoryAdapter(repositoryMode), [repositoryMode]);
  const [initialPersonalData] = useState(() => repositoryAdapter.personal.load());
  const [initialAuthSession] = useState<LocalAuthSession | null>(() => loadLocalAuthSession());
  const [personalData, setPersonalData] = useState(initialPersonalData);
  const [initialScene] = useState<SceneState>(
    () => repositoryAdapter.workspace.loadScene(initialPersonalData.activeUserId) ?? loadScene() ?? createInitialScene(),
  );
  const [objects, setObjects] = useState<SandboxObject[]>(initialScene.objects);
  const [events, setEvents] = useState<SandboxEvent[]>(initialScene.events);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(false);
  const [environment, setEnvironment] = useState(() => repositoryAdapter.workspace.loadEnvironment(initialPersonalData.activeUserId));
  const [sandboxCamera, setSandboxCamera] = useState<SandboxCameraState>(() => loadSandboxCamera());
  const [layoutPreferences, setLayoutPreferences] = useState(() => repositoryAdapter.workspace.loadLayout(initialPersonalData.activeUserId));
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("scene");
  const [activeView, setActiveView] = useState<AppView>(() => (initialAuthSession ? "sandbox" : "auth"));
  const [authSession, setAuthSession] = useState<LocalAuthSession | null>(initialAuthSession);
  const [managedAssets, setManagedAssets] = useState(() => loadManagedAssets());
  const [llmProviders, setLlmProviders] = useState(() => loadLlmProviders());
  const [agents, setAgents] = useState(() => loadPsychAgents());
  const [adminGovernance, setAdminGovernance] = useState<AdminGovernanceData>(() => repositoryAdapter.admin.load(initialPersonalData));
  const [conversations, setConversations] = useState(() => repositoryAdapter.workspace.loadAgentConversations(initialPersonalData.activeUserId));
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const editorRef = useRef<SandboxEditorHandle | null>(null);
  const activeUserId = personalData.activeUserId;

  const analysis = useMemo(() => analyzeScene(objects), [objects]);
  const visibleAssets = useMemo(
    () =>
      managedAssets
        .filter((asset) => asset.enabled && !asset.deletedAt)
        .map((asset) => toSandboxAsset(asset)),
    [managedAssets],
  );
  const draggingAsset = useMemo(
    () => visibleAssets.find((asset) => asset.assetId === draggingAssetId) ?? null,
    [draggingAssetId, visibleAssets],
  );
  const selectedObject = useMemo(
    () => objects.find((object) => object.id === selectedId) ?? null,
    [objects, selectedId],
  );
  const sandboxFocusMode = activeView === "sandbox" && layoutPreferences.focusMode;
  const rightPanelCollapsed = layoutPreferences.rightPanelCollapsed;
  const activeProfile = useMemo(() => getActiveProfile(personalData), [personalData]);
  const personalContextPacket = useMemo(
    () => buildPersonalContextPacket(personalData, activeUserId),
    [activeUserId, personalData],
  );
  const personalMemoryContext = personalContextPacket.promptLines;
  const repositoryReport = useMemo<SystemArchitectureReport>(
    () => repositoryAdapter.buildReport(personalData, adminGovernance, { managedAssets, llmProviders, agents }),
    [adminGovernance, agents, llmProviders, managedAssets, personalData, repositoryAdapter],
  );

  useEffect(() => {
    if (!authSession && activeView !== "auth") {
      setActiveView("auth");
    }
  }, [activeView, authSession]);

  useEffect(() => {
    repositoryAdapter.workspace.saveScene(activeUserId, { objects, events });
  }, [activeUserId, events, objects, repositoryAdapter]);

  useEffect(() => {
    repositoryAdapter.workspace.saveEnvironment(activeUserId, environment);
  }, [activeUserId, environment, repositoryAdapter]);

  useEffect(() => {
    saveSandboxCamera(sandboxCamera);
  }, [sandboxCamera]);

  useEffect(() => {
    repositoryAdapter.workspace.saveLayout(activeUserId, layoutPreferences);
  }, [activeUserId, layoutPreferences, repositoryAdapter]);

  useEffect(() => {
    repositoryAdapter.personal.save(personalData);
  }, [personalData, repositoryAdapter]);

  useEffect(() => {
    setAdminGovernance((current) => repositoryAdapter.admin.normalize(current, personalData));
  }, [personalData, repositoryAdapter]);

  useEffect(() => {
    repositoryAdapter.admin.save(adminGovernance);
  }, [adminGovernance, repositoryAdapter]);

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
        setLayoutPreferences((current) => {
          if (current.aiDrawerOpen) {
            return { ...current, aiDrawerOpen: false };
          }
          if (current.assetDrawerOpen) {
            return { ...current, assetDrawerOpen: false };
          }
          return { ...current, focusMode: false, assetDrawerOpen: false, aiDrawerOpen: false };
        });
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        setLayoutPreferences((current) => ({
          ...current,
          focusMode: !current.focusMode,
          assetDrawerOpen: false,
          aiDrawerOpen: false,
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
          aiDrawerOpen: false,
        }));
      }

      if (event.key.toLowerCase() === "g") {
        event.preventDefault();
        setShowGuides((current) => !current);
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        setSandboxCamera(DEFAULT_SANDBOX_CAMERA);
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
    repositoryAdapter.workspace.saveAgentConversations(activeUserId, conversations);
  }, [activeUserId, conversations, repositoryAdapter]);

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

  const handleCameraChange = useCallback((patch: Partial<SandboxCameraState>) => {
    setSandboxCamera((current) => normalizeSandboxCamera({ ...current, ...patch }));
  }, []);

  const handleCameraReset = useCallback(() => {
    setSandboxCamera(DEFAULT_SANDBOX_CAMERA);
  }, []);

  const patchLayoutPreferences = useCallback((patch: Partial<SandboxLayoutPreferences>) => {
    setLayoutPreferences((current) => ({ ...current, ...patch }));
  }, []);

  const handleToggleFocusMode = useCallback(() => {
    setLayoutPreferences((current) => ({
      ...current,
      focusMode: !current.focusMode,
      assetDrawerOpen: false,
      aiDrawerOpen: false,
    }));
  }, []);

  const handleToggleRightPanel = useCallback(() => {
    setLayoutPreferences((current) => ({
      ...current,
      rightPanelCollapsed: !current.rightPanelCollapsed,
    }));
  }, []);

  const handleOpenAiCompanion = useCallback(() => {
    if (sandboxFocusMode) {
      setLayoutPreferences((current) => ({
        ...current,
        aiDrawerOpen: !current.aiDrawerOpen,
        assetDrawerOpen: false,
      }));
      return;
    }

    setRightPanelTab("ai");
    setLayoutPreferences((current) => ({ ...current, rightPanelCollapsed: false }));
  }, [sandboxFocusMode]);

  const handleRepositoryModeChange = useCallback((mode: RepositoryMode) => {
    saveRepositoryMode(mode);
    setRepositoryMode(mode);
  }, []);

  const loadRuntimeStateForUser = useCallback((userId: string) => {
    const nextScene = repositoryAdapter.workspace.loadScene(userId) ?? createInitialScene();
    setObjects(nextScene.objects);
    setEvents(nextScene.events);
    setConversations(repositoryAdapter.workspace.loadAgentConversations(userId));
    setEnvironment(repositoryAdapter.workspace.loadEnvironment(userId));
    setLayoutPreferences({
      ...repositoryAdapter.workspace.loadLayout(userId),
      focusMode: false,
      assetDrawerOpen: false,
      aiDrawerOpen: false,
    });
    setSelectedId(null);
    setShowGuides(false);
    setRightPanelTab("scene");
  }, [repositoryAdapter]);

  const persistRuntimeStateForUser = useCallback(
    (userId: string) => {
      repositoryAdapter.workspace.saveScene(userId, { objects, events });
      repositoryAdapter.workspace.saveAgentConversations(userId, conversations);
      repositoryAdapter.workspace.saveEnvironment(userId, environment);
      repositoryAdapter.workspace.saveLayout(userId, layoutPreferences);
    },
    [conversations, environment, events, layoutPreferences, objects, repositoryAdapter],
  );

  const handleSwitchPersonalUser = useCallback(
    (userId: string) => {
      if (userId === activeUserId) {
        return;
      }

      persistRuntimeStateForUser(activeUserId);
      setPersonalData((current) => switchActivePersonalUser(current, userId));
      loadRuntimeStateForUser(userId);
      setActiveView("personal");
    },
    [activeUserId, loadRuntimeStateForUser, persistRuntimeStateForUser],
  );

  const handleCreatePersonalUser = useCallback(
    (input: CreatePersonalUserInput) => {
      persistRuntimeStateForUser(activeUserId);
      const { data, userId } = createLocalPersonalUser(personalData, input);
      setPersonalData(data);
      loadRuntimeStateForUser(userId);
      setActiveView("personal");
    },
    [activeUserId, loadRuntimeStateForUser, persistRuntimeStateForUser, personalData],
  );

  const handleLogin = useCallback(
    async (input: { email: string; password: string }) => {
      const session = await loginLocalAuthIdentity(input);
      if (!personalData.accounts.some((account) => account.userId === session.userId)) {
        clearLocalAuthSession();
        throw new Error("该登录身份没有匹配的个人档案，请使用导入档案或重新注册。");
      }

      persistRuntimeStateForUser(activeUserId);
      setAuthSession(session);
      setPersonalData((current) => switchActivePersonalUser(current, session.userId));
      loadRuntimeStateForUser(session.userId);
      setActiveView("sandbox");
    },
    [activeUserId, loadRuntimeStateForUser, persistRuntimeStateForUser, personalData.accounts],
  );

  const handleRegister = useCallback(
    async (input: {
      displayName: string;
      email: string;
      password: string;
      ageGroup: CreatePersonalUserInput["ageGroup"];
      role: CreatePersonalUserInput["role"];
    }) => {
      if (!isLocalAuthEmailAvailable(input.email)) {
        throw new Error("该邮箱已经注册，请直接登录。");
      }

      persistRuntimeStateForUser(activeUserId);
      const { data, userId } = createLocalPersonalUser(personalData, {
        displayName: input.displayName,
        ageGroup: input.ageGroup,
        role: input.role,
      });
      const session = await registerLocalAuthIdentity({
        ...input,
        userId,
      });
      setAuthSession(session);
      setPersonalData(data);
      loadRuntimeStateForUser(userId);
      setActiveView("sandbox");
    },
    [activeUserId, loadRuntimeStateForUser, persistRuntimeStateForUser, personalData],
  );

  const handleContinueAsGuest = useCallback(() => {
    const session = createGuestAuthSession({
      userId: activeUserId,
      displayName: activeProfile.displayName,
    });
    setAuthSession(session);
    setActiveView("sandbox");
  }, [activeProfile.displayName, activeUserId]);

  const handleLogout = useCallback(() => {
    persistRuntimeStateForUser(activeUserId);
    clearLocalAuthSession();
    setAuthSession(null);
    setLayoutPreferences((current) => ({
      ...current,
      focusMode: false,
      assetDrawerOpen: false,
      aiDrawerOpen: false,
    }));
    setActiveView("auth");
  }, [activeUserId, persistRuntimeStateForUser]);

  const handleRestoreSandtraySession = useCallback((session: SandtraySessionArchive) => {
    const restoreEvent = createSandboxEvent({
      type: "seed",
      label: `恢复历史作品: ${session.title}`,
      payload: {
        archivedAt: session.archivedAt,
        objectCount: session.featureSummary.objectCount,
        sessionId: session.sessionId,
      },
    });

    setObjects(session.snapshot.objects);
    setEvents([...session.snapshot.events, restoreEvent].slice(-320));
    setEnvironment(session.snapshot.environment);
    setSelectedId(null);
    setShowGuides(true);
    setRightPanelTab("scene");
    setLayoutPreferences((current) => ({
      ...current,
      focusMode: false,
      assetDrawerOpen: false,
      aiDrawerOpen: false,
    }));
    setActiveView("sandbox");
  }, []);

  return (
    <div
      className={classNames(
        "product-shell",
        `weather-${environment.weather}`,
        `light-${environment.light}`,
        environment.light === "night" && "night-mode",
        sandboxFocusMode && "focus-mode",
        activeView === "auth" && "auth-mode",
      )}
    >
      {!sandboxFocusMode && activeView !== "auth" ? (
        <AppNavigation
          activeView={activeView}
          onViewChange={setActiveView}
          activeUserName={activeProfile.displayName}
          authSession={authSession}
          onLogout={handleLogout}
        />
      ) : null}

      {activeView === "auth" ? (
        <AuthScreen
          defaultDisplayName={activeProfile.displayName}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onRecover={createLocalPasswordResetPreview}
          onContinueAsGuest={handleContinueAsGuest}
        />
      ) : null}

      {activeView === "sandbox" ? (
        <div
          className={classNames(
            "app-shell",
            rightPanelCollapsed && !sandboxFocusMode && "right-panel-collapsed",
            sandboxFocusMode && "focus-mode",
            sandboxFocusMode && layoutPreferences.assetDrawerOpen && "asset-drawer-open",
            sandboxFocusMode && layoutPreferences.aiDrawerOpen && "ai-drawer-open",
          )}
        >
          {sandboxFocusMode ? (
            <>
              <button
                className="focus-floating-button focus-asset-toggle"
                type="button"
                onClick={() =>
                  patchLayoutPreferences({
                    assetDrawerOpen: !layoutPreferences.assetDrawerOpen,
                    aiDrawerOpen: false,
                  })
                }
                aria-label={layoutPreferences.assetDrawerOpen ? "关闭全屏沙具库" : "打开全屏沙具库"}
              >
                {layoutPreferences.assetDrawerOpen ? <X size={18} /> : <Boxes size={18} />}
                <span>{layoutPreferences.assetDrawerOpen ? "关闭沙具库" : "沙具库"}</span>
              </button>
              <button
                className="focus-floating-button focus-panel-toggle"
                type="button"
                onClick={() => patchLayoutPreferences({ focusMode: false, rightPanelCollapsed: false, aiDrawerOpen: false })}
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
                    <AssetLibrary
                      assets={visibleAssets}
                      onAddAsset={addAssetToScene}
                      onBeginDragAsset={(asset) => setDraggingAssetId(asset.assetId)}
                      onEndDragAsset={() => setDraggingAssetId(null)}
                    />
                  </div>
                </>
              ) : null}
              {layoutPreferences.aiDrawerOpen ? (
                <FocusAiCompanionDrawer
                  objects={objects}
                  selectedObject={selectedObject}
                  events={events}
                  analysis={analysis}
                  llmProviders={llmProviders}
                  personalMemoryContext={personalMemoryContext}
                  onClose={() => patchLayoutPreferences({ aiDrawerOpen: false })}
                />
              ) : null}
            </>
          ) : (
            <AssetLibrary
              assets={visibleAssets}
              onAddAsset={addAssetToScene}
              onBeginDragAsset={(asset) => setDraggingAssetId(asset.assetId)}
              onEndDragAsset={() => setDraggingAssetId(null)}
            />
          )}

          <section className="workspace-column" aria-label="沙盘编辑区">
            <TopBar
              objectCount={objects.length}
              environment={environment}
              camera={sandboxCamera}
              focusMode={sandboxFocusMode}
              rightPanelCollapsed={rightPanelCollapsed}
              showRightPanelToggle={!sandboxFocusMode}
              showGuides={showGuides}
              onEnvironmentChange={handleEnvironmentChange}
              onCameraChange={handleCameraChange}
              onCameraReset={handleCameraReset}
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
              draggingAsset={draggingAsset}
              environment={environment}
              camera={sandboxCamera}
              showGuides={showGuides}
              onSelectObject={handleSelectObject}
              onPatchObject={patchObject}
              onDropAsset={handleDropAsset}
              onDeleteSelected={handleDeleteSelected}
              onRecordEvent={recordEvent}
              onCameraChange={handleCameraChange}
              aiCompanionActive={sandboxFocusMode ? layoutPreferences.aiDrawerOpen : rightPanelTab === "ai"}
              onOpenAiCompanion={handleOpenAiCompanion}
            />
          </section>

          {sandboxFocusMode ? (
            !layoutPreferences.aiDrawerOpen ? (
              <FocusSelectionCard
                selectedObject={selectedObject}
                onPatchSelected={handlePatchSelected}
                onDeleteSelected={handleDeleteSelected}
              />
            ) : null
          ) : (
            <RightPanel
              objects={objects}
              selectedObject={selectedObject}
              events={events}
              analysis={analysis}
              llmProviders={llmProviders}
              personalMemoryContext={personalMemoryContext}
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
          personalMemoryContext={personalMemoryContext}
          onConversationsChange={setConversations}
        />
      ) : null}

      {activeView === "admin" ? (
        <AdminDashboard
          personalData={personalData}
          adminGovernance={adminGovernance}
          repositoryReport={repositoryReport}
          repositoryMode={repositoryMode}
          managedAssets={managedAssets}
          llmProviders={llmProviders}
          agents={agents}
          onPersonalDataChange={setPersonalData}
          onAdminGovernanceChange={setAdminGovernance}
          onRepositoryModeChange={handleRepositoryModeChange}
          onManagedAssetsChange={setManagedAssets}
          onLlmProvidersChange={setLlmProviders}
          onAgentsChange={setAgents}
          onResetAssets={() => setManagedAssets(resetManagedAssets())}
        />
      ) : null}

      {activeView === "personal" ? (
        <PersonalCenter
          personalData={personalData}
          objects={objects}
          events={events}
          conversations={conversations}
          analysis={analysis}
          environment={environment}
          onPersonalDataChange={setPersonalData}
          onCreateUser={handleCreatePersonalUser}
          onSwitchUser={handleSwitchPersonalUser}
          onRestoreSandtraySession={handleRestoreSandtraySession}
        />
      ) : null}
    </div>
  );
}

function FocusAiCompanionDrawer({
  objects,
  selectedObject,
  events,
  analysis,
  llmProviders,
  personalMemoryContext,
  onClose,
}: {
  objects: SandboxObject[];
  selectedObject: SandboxObject | null;
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
  llmProviders: LlmProviderConfig[];
  personalMemoryContext: string[];
  onClose: () => void;
}): JSX.Element {
  return (
    <aside className="focus-ai-drawer" aria-label="全屏 AI 伙伴对话" data-testid="focus-ai-drawer">
      <header className="focus-ai-drawer-header">
        <div>
          <p className="eyebrow">Live Sandplay Dialogue</p>
          <h2>
            <Bot size={17} />
            AI 伙伴
          </h2>
        </div>
        <button className="small-icon-button" type="button" onClick={onClose} aria-label="关闭全屏 AI 伙伴">
          <X size={17} />
        </button>
      </header>
      <div className="focus-ai-drawer-body">
        <AiCompanionPanel
          objects={objects}
          selectedObject={selectedObject}
          events={events}
          analysis={analysis}
          llmProviders={llmProviders}
          personalMemoryContext={personalMemoryContext}
          variant="focus"
        />
      </div>
    </aside>
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

function loadSandboxCamera(): SandboxCameraState {
  if (typeof window === "undefined") {
    return DEFAULT_SANDBOX_CAMERA;
  }

  try {
    const stored = window.localStorage.getItem(SANDBOX_CAMERA_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SANDBOX_CAMERA;
    }

    const parsed = JSON.parse(stored) as Partial<SandboxCameraState>;
    return normalizeSandboxCamera({
      ...DEFAULT_SANDBOX_CAMERA,
      ...parsed,
    });
  } catch {
    return DEFAULT_SANDBOX_CAMERA;
  }
}

function saveSandboxCamera(camera: SandboxCameraState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SANDBOX_CAMERA_STORAGE_KEY, JSON.stringify(normalizeSandboxCamera(camera)));
}
