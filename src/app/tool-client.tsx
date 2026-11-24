'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ToolShell, useTool, ImportExport } from '@itsjust/core';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { toolConfig, templateBaseVersion, Canvas, Toolbar, Sidebar, summaryText } from '@/tool';
import { hashExtractorTool, exportEntries, scanText } from '@/tool/tool-definition';
import type { HashExtractorState } from '@/tool/types';

export default function ToolClient() {
  const ToolShellCompat = ToolShell as unknown as ComponentType<Record<string, unknown>> & {
    Toolbar?: ComponentType<{ children?: ReactNode }>;
    Body?: ComponentType<{ children?: ReactNode }>;
    Sidebar?: ComponentType<{ children?: ReactNode }>;
    Canvas?: ComponentType<{ children?: ReactNode }>;
    StatusBar?: ComponentType<{ children?: ReactNode }>;
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const tool = useTool<HashExtractorState>(hashExtractorTool, canvasRef);
  const setToolData = tool.state.setData;
  const showToast = tool.toast;
  const [isSharing, setIsSharing] = useState(false);
  const hasLoadedSharedState = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth > 768 && toolConfig.features.sidebar
  );

  const title = toolConfig.name;
  const state = tool.state.data;

  const visibleEntries = useCallback((s: HashExtractorState) => {
    const f = s.filter.toLowerCase();
    return s.entries.filter(
      (e) =>
        !f ||
        e.hash.toLowerCase().includes(f) ||
        e.label.toLowerCase().includes(f) ||
        e.algorithm.toLowerCase().includes(f)
    );
  }, []);

  useEffect(() => {
    if (hasLoadedSharedState.current) return;
    hasLoadedSharedState.current = true;
    const params = new URLSearchParams(window.location.search);
    const encodedState = params.get('state');
    if (!encodedState) return;
    try {
      const serialized = decompressFromEncodedURIComponent(encodedState);
      if (!serialized) throw new Error('Invalid shared URL');
      const parsed: unknown = JSON.parse(serialized);
      const deserialized = hashExtractorTool.deserialize(parsed);
      if (!deserialized.success) throw new Error(deserialized.error);
      setToolData(deserialized.data);
      showToast('Loaded state from shared URL', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shared URL';
      showToast(message, 'error');
    }
  }, [setToolData, showToast]);

  const handleScan = useCallback(() => {
    setToolData((prev) => {
      const next = scanText(prev, prev.sourceText);
      const count = next.entries.length;
      return {
        ...next,
        history: [
          {
            text: `Scanned ${prev.sourceText.length} chars, found ${count} hashes`,
            createdAt: new Date().toISOString(),
          },
          ...prev.history,
        ].slice(0, 20),
      };
    });
    showToast('Scan complete', 'success');
  }, [setToolData, showToast]);

  const handleReset = useCallback(() => {
    setToolData((prev) => ({ ...prev, sourceText: '', entries: [] }));
  }, [setToolData]);

  const handleCopyResult = useCallback(async () => {
    try {
      const payload = exportEntries(visibleEntries(state), state.exportFormat);
      await navigator.clipboard.writeText(payload);
      showToast('Filtered list copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to copy filtered list';
      showToast(message, 'error');
    }
  }, [showToast, state, visibleEntries]);

  const handleDownload = useCallback(() => {
    const payload = exportEntries(visibleEntries(state), state.exportFormat);
    const ext =
      state.exportFormat === 'json' ? 'json' : state.exportFormat === 'csv' ? 'csv' : 'txt';
    const mime =
      state.exportFormat === 'json'
        ? 'application/json'
        : state.exportFormat === 'csv'
          ? 'text/csv'
          : 'text/plain';
    const blob = new Blob([payload], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hash-extractor-export.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export downloaded', 'success');
  }, [showToast, state, visibleEntries]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const serialized = hashExtractorTool.serialize(state);
      const encodedState = compressToEncodedURIComponent(serialized);
      if (!encodedState) throw new Error('Failed to encode state for URL');
      const url = new URL(window.location.href);
      url.searchParams.set('state', encodedState);
      url.searchParams.set('tool', toolConfig.id);
      window.history.replaceState(null, '', url.toString());

      const shareUrl = url.toString();
      if (navigator.share) {
        try {
          await navigator.share({ title, url: shareUrl });
          showToast('Shared URL ready', 'success');
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share URL copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share URL';
      showToast(message, 'error');
    } finally {
      setIsSharing(false);
    }
  }, [showToast, state, title]);

  const toolbarContent = (
    <>
      <Toolbar
        state={state}
        onChange={(next) => setToolData(() => next)}
        onClear={() => setToolData(() => ({ ...state, entries: [], sourceText: '' }))}
        onCopy={() => void handleCopyResult()}
      />
      <ImportExport
        formats={tool.supportedFormats}
        onExport={tool.handleExport}
        onImport={tool.importFromFile}
        isImporting={tool.isImporting}
        onShare={handleShare}
        isSharing={isSharing}
      />
      <button
        type="button"
        onClick={handleDownload}
        data-testid="btn-download-export"
        className="rounded-md bg-emerald-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
      >
        Download filtered export
      </button>
    </>
  );

  const sidebarContent = <Sidebar state={state} onChange={(next) => setToolData(() => next)} />;

  const canvasContent = (
    <div ref={canvasRef}>
      <Canvas
        state={state}
        onChange={(next) => setToolData(() => next)}
        onScan={handleScan}
        onReset={handleReset}
        onSaveHistory={() => undefined}
      />
    </div>
  );

  const statusBarContent = (
    <>
      <span
        className={`status-slot status-slot-state ${tool.state.isDirty ? 'status-unsaved' : 'status-saved'}`}
      >
        {tool.state.isDirty ? (
          <>
            <span className="status-saving-dot" />
            Unsaved
          </>
        ) : tool.state.lastSaved ? (
          <>Saved {tool.state.lastSaved}</>
        ) : (
          'Ready'
        )}
      </span>
      <span className="status-slot status-slot-mode">{state.entries.length} detected</span>
      <span className="status-slot status-slot-summary">{summaryText(state)}</span>
      <span className="status-slot status-slot-history">{state.history.length} saved</span>
      <span className="status-slot status-slot-tool-version">Tool v{toolConfig.version}</span>
      <span className="status-slot status-slot-template-version">
        Template v{templateBaseVersion}
      </span>
    </>
  );

  const hasLegacySections = Boolean(
    ToolShellCompat.Toolbar &&
    ToolShellCompat.Body &&
    ToolShellCompat.Sidebar &&
    ToolShellCompat.Canvas &&
    ToolShellCompat.StatusBar
  );

  return (
    <ToolShellCompat
      config={toolConfig}
      sidebarOpen={sidebarOpen}
      onSidebarChange={setSidebarOpen}
      toolbar={toolbarContent}
      sidebar={sidebarContent}
      canvas={canvasContent}
      statusBar={statusBarContent}
    >
      {hasLegacySections
        ? (() => {
            const ToolbarSection = ToolShellCompat.Toolbar as ComponentType<{
              children?: ReactNode;
            }>;
            const BodySection = ToolShellCompat.Body as ComponentType<{ children?: ReactNode }>;
            const SidebarSection = ToolShellCompat.Sidebar as ComponentType<{
              children?: ReactNode;
            }>;
            const CanvasSection = ToolShellCompat.Canvas as ComponentType<{ children?: ReactNode }>;
            const StatusBarSection = ToolShellCompat.StatusBar as ComponentType<{
              children?: ReactNode;
            }>;
            return (
              <>
                <ToolbarSection>{toolbarContent}</ToolbarSection>
                <BodySection>
                  <SidebarSection>{sidebarContent}</SidebarSection>
                  <CanvasSection>{canvasContent}</CanvasSection>
                </BodySection>
                <StatusBarSection>{statusBarContent}</StatusBarSection>
              </>
            );
          })()
        : null}
    </ToolShellCompat>
  );
}
