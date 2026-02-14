import React from "react";

import { disableSkill, type SkillId } from "./useSkillsStatus";

type GatewayRpc = {
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>;
};

type ConfigSnapshotLike = {
  path?: string;
  exists?: boolean;
  valid?: boolean;
  hash?: string;
  config?: unknown;
};

/** Manages opening/closing skill modals and connect/disable actions. */
export function useSkillModal(props: {
  gw: GatewayRpc;
  markConnected: (id: SkillId) => void;
  markDisabled: (id: SkillId) => void;
  refresh: () => Promise<void>;
  loadConfig: () => Promise<ConfigSnapshotLike>;
  onError: (value: string | null) => void;
}) {
  const [activeModal, setActiveModal] = React.useState<SkillId | null>(null);

  const openModal = React.useCallback((skillId: SkillId) => {
    setActiveModal(skillId);
  }, []);

  const closeModal = React.useCallback(() => {
    setActiveModal(null);
  }, []);

  /** Called by modal content after a successful connection. */
  const handleConnected = React.useCallback(
    (skillId: SkillId) => {
      props.markConnected(skillId);
      void props.refresh();
      setActiveModal(null);
    },
    [props.markConnected, props.refresh]
  );

  /** Called by modal content after disabling a skill. */
  const handleDisabled = React.useCallback(
    async (skillId: SkillId) => {
      props.onError(null);
      try {
        await disableSkill(props.gw, props.loadConfig, skillId);
        props.markDisabled(skillId);
        void props.refresh();
        setActiveModal(null);
      } catch (err) {
        props.onError(String(err));
      }
    },
    [props.gw, props.loadConfig, props.markDisabled, props.onError, props.refresh]
  );

  return {
    activeModal,
    openModal,
    closeModal,
    handleConnected,
    handleDisabled,
  };
}
