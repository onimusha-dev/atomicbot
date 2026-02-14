import React from "react";
import toast from "react-hot-toast";

import { getDesktopApiOrNull } from "@ipc/desktopApi";
import { toastStyles } from "@shared/toast";

export type CustomSkillMeta = {
  name: string;
  description: string;
  emoji: string;
  dirName: string;
};

/** Manages loading, installing, and removing custom (user-uploaded) skills. */
export function useCustomSkills(onError: (value: string | null) => void) {
  const [customSkills, setCustomSkills] = React.useState<CustomSkillMeta[]>([]);
  const [showUploadModal, setShowUploadModal] = React.useState(false);

  // Load custom skills on mount.
  React.useEffect(() => {
    const api = getDesktopApiOrNull();
    if (!api?.listCustomSkills) {
      return;
    }
    void api.listCustomSkills().then((res) => {
      if (res.ok && res.skills) {
        setCustomSkills(res.skills);
      }
    });
  }, []);

  const handleCustomSkillInstalled = React.useCallback((skill: CustomSkillMeta) => {
    setCustomSkills((prev) => {
      const exists = prev.some((s) => s.dirName === skill.dirName);
      if (exists) {
        return prev.map((s) => (s.dirName === skill.dirName ? skill : s));
      }
      return [...prev, skill];
    });
    setShowUploadModal(false);
    toast.success(
      () => (
        <div>
          <div style={{ fontWeight: 600 }}>Upload success!</div>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Your skill is connected</div>
        </div>
      ),
      {
        duration: 3000,
        position: "bottom-right",
        style: {
          ...toastStyles,
          background: "rgba(34, 120, 60, 0.95)",
          color: "#fff",
          border: "1px solid rgba(72, 187, 100, 0.4)",
        },
        iconTheme: { primary: "#48bb64", secondary: "#fff" },
      }
    );
  }, []);

  const handleRemoveCustomSkill = React.useCallback(
    async (dirName: string, name: string) => {
      const confirmed = window.confirm(
        `Remove skill "${name}"?\n\nThis will delete the skill files.`
      );
      if (!confirmed) {
        return;
      }

      const api = getDesktopApiOrNull();
      if (!api?.removeCustomSkill) {
        return;
      }

      const res = await api.removeCustomSkill(dirName);
      if (res.ok) {
        setCustomSkills((prev) => prev.filter((s) => s.dirName !== dirName));
      } else {
        onError(res.error || "Failed to remove skill");
      }
    },
    [onError]
  );

  return {
    customSkills,
    showUploadModal,
    setShowUploadModal,
    handleCustomSkillInstalled,
    handleRemoveCustomSkill,
  };
}
