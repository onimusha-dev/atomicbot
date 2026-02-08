import React from "react";

import { Modal } from "../kit";
import {
  useConnectorsStatus,
  disableConnector,
  type ConnectorId,
  type ConnectorStatus,
} from "./useConnectorsStatus";
import { TelegramModalContent, SlackConnectorModalContent } from "./connector-modals";

import telegramImage from '../../../../assets/messangers/Telegram.svg'
import slackImage from '../../../../assets/set-up-skills/Slack.svg'
import discordImage from '../../../../assets/messangers/Discord.svg'
import signalImage from '../../../../assets/messangers/Signal.svg'
import whatsappImage from '../../../../assets/messangers/WhatsApp.svg'
import imessageImage from '../../../../assets/messangers/iMessage.svg'
import matrixImage from '../../../../assets/messangers/Matrix.svg'
import msteamsImage from '../../../../assets/messangers/Microsoft-Teams.svg'

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

type ConnectorDefinition = {
  id: ConnectorId;
  name: string;
  description: string;
  iconText: string;
  iconVariant: string;
  image?: string;
};

const CONNECTORS: ConnectorDefinition[] = [
  {
    id: "telegram",
    name: "Telegram",
    description: "Connect a Telegram bot to receive and send messages",
    iconText: "✈",
    iconVariant: "telegram",
    image: telegramImage
  },
  {
    id: "slack",
    name: "Slack",
    description: "Connect a Slack workspace via Socket Mode",
    iconText: "S",
    iconVariant: "slack",
    image: slackImage
  },
  {
    id: "discord",
    name: "Discord",
    description: "Connect a Discord bot to interact with your server",
    iconText: "🎮",
    iconVariant: "discord",
    image: discordImage
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Connect WhatsApp Web via QR code pairing",
    iconText: "💬",
    iconVariant: "whatsapp",
    image: whatsappImage
  },
  {
    id: "signal",
    name: "Signal",
    description: "Connect Signal via signal-cli for private messaging",
    iconText: "🔒",
    iconVariant: "signal",
    image: signalImage
  },
  {
    id: "imessage",
    name: "iMessage",
    description: "Connect iMessage on macOS for native messaging",
    iconText: "💭",
    iconVariant: "imessage",
    image: imessageImage
  },
  {
    id: "matrix",
    name: "Matrix",
    description: "Connect to a Matrix homeserver for decentralized messaging",
    iconText: "[m]",
    iconVariant: "matrix",
    image: matrixImage
  },
  {
    id: "msteams",
    name: "Microsoft Teams",
    description: "Connect Microsoft Teams for enterprise messaging",
    iconText: "T",
    iconVariant: "msteams",
    image: msteamsImage
  },
];

// ---------- ConnectorCta ----------

function ConnectorCta({
  status,
  onConnect,
  onSettings,
}: {
  status: ConnectorStatus;
  onConnect?: () => void;
  onSettings?: () => void;
}) {
  if (status === "connected") {
    return (
      <button
        type="button"
        className="UiSkillStatus UiSkillStatus--connected UiSkillStatus--clickable"
        aria-label="Connected — click to configure"
        onClick={onSettings}
      >
        ✓ Connected
      </button>
    );
  }
  if (status === "disabled") {
    return (
      <button
        type="button"
        className="UiSkillStatus UiSkillStatus--disabled UiSkillStatus--clickable"
        aria-label="Disabled — click to configure"
        onClick={onSettings}
      >
        Disabled
      </button>
    );
  }
  if (status === "coming-soon") {
    return (
      <span className="UiSkillStatus UiSkillStatus--soon" aria-label="Coming soon">
        Coming Soon
      </span>
    );
  }
  return (
    <button
      className="UiSkillConnectButton"
      type="button"
      disabled={!onConnect}
      title={onConnect ? "Connect" : "Not available yet"}
      onClick={onConnect}
    >
      Connect
    </button>
  );
}

// ---------- Main tab component ----------

export function ConnectorsTab(props: {
  gw: GatewayRpc;
  configSnap: ConfigSnapshotLike | null;
  reload: () => Promise<void>;
  onError: (value: string | null) => void;
}) {
  const { statuses, markConnected, markDisabled, refresh, loadConfig } = useConnectorsStatus({
    gw: props.gw,
    configSnap: props.configSnap,
    reload: props.reload,
  });

  const [activeModal, setActiveModal] = React.useState<ConnectorId | null>(null);

  const openModal = React.useCallback((id: ConnectorId) => {
    setActiveModal(id);
  }, []);

  const closeModal = React.useCallback(() => {
    setActiveModal(null);
  }, []);

  const handleConnected = React.useCallback(
    (id: ConnectorId) => {
      markConnected(id);
      void refresh();
      setActiveModal(null);
    },
    [markConnected, refresh]
  );

  const handleDisabled = React.useCallback(
    async (id: ConnectorId) => {
      props.onError(null);
      try {
        await disableConnector(props.gw, loadConfig, id);
        markDisabled(id);
        void refresh();
        setActiveModal(null);
      } catch (err) {
        props.onError(String(err));
      }
    },
    [loadConfig, markDisabled, props, refresh]
  );

  const tileClass = (status: ConnectorStatus) => {
    if (status === "connected") return "UiSkillCard UiSkillCard--connected";
    if (status === "disabled") return "UiSkillCard UiSkillCard--disabled";
    return "UiSkillCard";
  };

  return (
    <div className="UiSettingsContentInner">
      <div className="UiSettingsTabTitle">Messengers</div>

      <div className="UiSkillsScroll" style={{ maxHeight: "none" }}>
        <div className="UiSkillsGrid">
          {CONNECTORS.map((connector) => {
            const status = statuses[connector.id];
            const isInteractive = status !== "coming-soon";
            return (
              <div
                key={connector.id}
                className={tileClass(status)}
                role="group"
                aria-label={connector.name}
              >
                <div className="UiSkillTopRow">
                  <span
                    className={`UiSkillIcon`}
                    aria-hidden="true"
                  >
                    {connector.image ? <img src={connector.image} alt="" /> : connector.iconText}
                  </span>
                  <div className="UiSkillTopRight">
                    <ConnectorCta
                      status={status}
                      onConnect={isInteractive ? () => openModal(connector.id) : undefined}
                      onSettings={isInteractive ? () => openModal(connector.id) : undefined}
                    />
                  </div>
                </div>
                <div className="UiSkillName">{connector.name}</div>
                <div className="UiSkillDescription">{connector.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Connector configuration modals (only TG + Slack are configurable) ── */}
      <Modal open={activeModal === "telegram"} onClose={closeModal} aria-label="Telegram settings">
        <TelegramModalContent
          gw={props.gw}
          loadConfig={loadConfig}
          isConnected={statuses.telegram === "connected"}
          onConnected={() => handleConnected("telegram")}
          onDisabled={() => void handleDisabled("telegram")}
        />
      </Modal>

      <Modal open={activeModal === "slack"} onClose={closeModal} aria-label="Slack settings">
        <SlackConnectorModalContent
          gw={props.gw}
          loadConfig={loadConfig}
          isConnected={statuses.slack === "connected"}
          onConnected={() => handleConnected("slack")}
          onDisabled={() => void handleDisabled("slack")}
        />
      </Modal>
    </div>
  );
}
