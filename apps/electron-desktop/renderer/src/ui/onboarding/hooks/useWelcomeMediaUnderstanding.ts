import React from "react";
import type { AsyncRunner, ConfigSnapshot, GatewayRpcLike, SkillId } from "./types";

type UseWelcomeMediaUnderstandingInput = {
  gw: GatewayRpcLike;
  loadConfig: () => Promise<ConfigSnapshot>;
  setStatus: (value: string | null) => void;
  run: AsyncRunner;
  markSkillConnected: (skillId: SkillId) => void;
  goSkills: () => void;
};

export function useWelcomeMediaUnderstanding({
  gw,
  loadConfig,
  setStatus,
  run,
  markSkillConnected,
  goSkills,
}: UseWelcomeMediaUnderstandingInput) {
  const onMediaUnderstandingSubmit = React.useCallback(
    async (settings: { image: boolean; audio: boolean; video: boolean }) => {
      setStatus("Saving media understanding settings…");
      await run(async () => {
        const snap = await loadConfig();
        const baseHash =
          typeof snap.hash === "string" && snap.hash.trim() ? snap.hash.trim() : null;
        if (!baseHash) {
          throw new Error("Config base hash missing. Reload and try again.");
        }
        await gw.request("config.patch", {
          baseHash,
          raw: JSON.stringify(
            {
              tools: {
                media: {
                  image: { enabled: settings.image },
                  audio: { enabled: settings.audio },
                  video: { enabled: settings.video },
                },
              },
            },
            null,
            2
          ),
          note: "Welcome: configure media understanding",
        });
        markSkillConnected("media-understanding");
        setStatus("Media understanding enabled.");
        goSkills();
      });
    },
    [run, goSkills, gw, loadConfig, markSkillConnected, setStatus]
  );

  return { onMediaUnderstandingSubmit };
}
