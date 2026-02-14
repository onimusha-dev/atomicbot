import React from "react";

/** Lightweight modal overlay with a centered card. */
export function Modal(props: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  header?: string;
  "aria-label"?: string;
}) {
  // Close on Escape key
  React.useEffect(() => {
    if (!props.open) {return;}
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {props.onClose();}
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [props.open, props.onClose]);

  if (!props.open) {return null;}

  return (
    <div
      className="UiModalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label={props["aria-label"]}
      onClick={(e) => {
        // Close when clicking the backdrop (not the card itself)
        if (e.target === e.currentTarget) {props.onClose();}
      }}
    >
      <div className="UiModalCard">
        <div className="UiModalHeader">
          {props.header ? <div className="UiSectionTitle">{props.header}</div> : ""}
          <button className="UiModalClose" type="button" aria-label="Close" onClick={props.onClose}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={12}
              height={12}
              fill="none"
              viewBox="0 0 12 12"
            >
              <path
                fill="#fff"
                fill-opacity=".4"
                d="M1.47.24a.86.86 0 0 0-1.2 1.21L4.8 6 .26 10.53a.86.86 0 1 0 1.21 1.2L6.01 7.2l4.54 4.54a.86.86 0 0 0 1.2-1.21L7.23 5.99l4.54-4.54a.86.86 0 0 0-1.21-1.2L6 4.77z"
              />
            </svg>
          </button>
        </div>
        <div className="UiModalContent scrollable">{props.children}</div>
      </div>
    </div>
  );
}
