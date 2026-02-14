import React from "react";

import { Modal } from "@shared/kit";
import type { SkillId, SkillStatus } from "./useSkillsStatus";
import {
  AppleNotesModalContent,
  AppleRemindersModalContent,
  GitHubModalContent,
  GoogleWorkspaceModalContent,
  MediaUnderstandingModalContent,
  NotionModalContent,
  ObsidianModalContent,
  SlackModalContent,
  TrelloModalContent,
  WebSearchModalContent,
} from "./modals";
import type { GatewayRpc, ConfigSnapshotLike } from "./skillDefinitions";

export function SkillModals(props: {
  activeModal: SkillId | null;
  onClose: () => void;
  gw: GatewayRpc;
  loadConfig: () => Promise<ConfigSnapshotLike>;
  statuses: Record<SkillId, SkillStatus>;
  onConnected: (id: SkillId) => void;
  onDisabled: (id: SkillId) => Promise<void>;
}) {
  const { activeModal, onClose, gw, loadConfig, statuses, onConnected, onDisabled } = props;

  const MODAL_REGISTRY: Array<{
    id: SkillId;
    header: string;
    label: string;
    render: () => React.ReactNode;
  }> = [
    {
      id: "google-workspace",
      header: "Google Workspace",
      label: "Google Workspace settings",
      render: () => (
        <GoogleWorkspaceModalContent
          isConnected={statuses["google-workspace"] === "connected"}
          onConnected={() => onConnected("google-workspace")}
          onDisabled={() => void onDisabled("google-workspace")}
        />
      ),
    },
    {
      id: "notion",
      header: "Notion",
      label: "Notion settings",
      render: () => (
        <NotionModalContent
          gw={gw}
          loadConfig={loadConfig}
          isConnected={statuses.notion === "connected"}
          onConnected={() => onConnected("notion")}
          onDisabled={() => void onDisabled("notion")}
        />
      ),
    },
    {
      id: "trello",
      header: "Trello",
      label: "Trello settings",
      render: () => (
        <TrelloModalContent
          gw={gw}
          loadConfig={loadConfig}
          isConnected={statuses.trello === "connected"}
          onConnected={() => onConnected("trello")}
          onDisabled={() => void onDisabled("trello")}
        />
      ),
    },
    {
      id: "github",
      header: "GitHub",
      label: "GitHub settings",
      render: () => (
        <GitHubModalContent
          gw={gw}
          loadConfig={loadConfig}
          isConnected={statuses.github === "connected"}
          onConnected={() => onConnected("github")}
          onDisabled={() => void onDisabled("github")}
        />
      ),
    },
    {
      id: "web-search",
      header: "Web Search",
      label: "Web Search settings",
      render: () => (
        <WebSearchModalContent
          gw={gw}
          loadConfig={loadConfig}
          isConnected={statuses["web-search"] === "connected"}
          onConnected={() => onConnected("web-search")}
          onDisabled={() => void onDisabled("web-search")}
        />
      ),
    },
    {
      id: "media-understanding",
      header: "Media Understanding",
      label: "Media Understanding settings",
      render: () => (
        <MediaUnderstandingModalContent
          gw={gw}
          loadConfig={loadConfig}
          isConnected={statuses["media-understanding"] === "connected"}
          onConnected={() => onConnected("media-understanding")}
          onDisabled={() => void onDisabled("media-understanding")}
        />
      ),
    },
    {
      id: "slack",
      header: "Slack",
      label: "Slack settings",
      render: () => (
        <SlackModalContent
          gw={gw}
          loadConfig={loadConfig}
          isConnected={statuses.slack === "connected"}
          onConnected={() => onConnected("slack")}
          onDisabled={() => void onDisabled("slack")}
        />
      ),
    },
    {
      id: "obsidian",
      header: "Obsidian",
      label: "Obsidian settings",
      render: () => (
        <ObsidianModalContent
          gw={gw}
          loadConfig={loadConfig}
          isConnected={statuses.obsidian === "connected"}
          onConnected={() => onConnected("obsidian")}
          onDisabled={() => void onDisabled("obsidian")}
        />
      ),
    },
    {
      id: "apple-notes",
      header: "Apple Notes",
      label: "Apple Notes settings",
      render: () => (
        <AppleNotesModalContent
          gw={gw}
          loadConfig={loadConfig}
          isConnected={statuses["apple-notes"] === "connected"}
          onConnected={() => onConnected("apple-notes")}
          onDisabled={() => void onDisabled("apple-notes")}
        />
      ),
    },
    {
      id: "apple-reminders",
      header: "Apple Reminders",
      label: "Apple Reminders settings",
      render: () => (
        <AppleRemindersModalContent
          gw={gw}
          loadConfig={loadConfig}
          isConnected={statuses["apple-reminders"] === "connected"}
          onConnected={() => onConnected("apple-reminders")}
          onDisabled={() => void onDisabled("apple-reminders")}
        />
      ),
    },
  ];

  return (
    <>
      {MODAL_REGISTRY.map((entry) => (
        <Modal
          key={entry.id}
          open={activeModal === entry.id}
          onClose={onClose}
          aria-label={entry.label}
          header={entry.header}
        >
          {entry.render()}
        </Modal>
      ))}
    </>
  );
}
