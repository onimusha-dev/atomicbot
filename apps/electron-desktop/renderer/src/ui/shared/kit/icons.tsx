/**
 * Shared SVG icon components extracted from individual page files.
 * Centralised here to avoid duplication and make them easy to find.
 */
import React from "react";

/** Two-rectangle copy/duplicate icon (18×18). */
export function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M12 9.675V12.825C12 15.45 10.95 16.5 8.325 16.5H5.175C2.55 16.5 1.5 15.45 1.5 12.825V9.675C1.5 7.05 2.55 6 5.175 6H8.325C10.95 6 12 7.05 12 9.675Z"
        stroke="#8B8B8B"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 5.175V8.325C16.5 10.95 15.45 12 12.825 12H12V9.675C12 7.05 10.95 6 8.325 6H6V5.175C6 2.55 7.05 1.5 9.675 1.5H12.825C15.45 1.5 16.5 2.55 16.5 5.175Z"
        stroke="#8B8B8B"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Single checkmark icon (20×20, viewBox 24). */
export function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M19.1333 7L8.59292 17.6L5 13.9867"
        stroke="#8B8B8B"
        strokeOpacity="1"
        strokeWidth="2.06111"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Microphone icon for voice input button (20x20). */
export function MicrophoneIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 1.25C8.62 1.25 7.5 2.37 7.5 3.75V10C7.5 11.38 8.62 12.5 10 12.5C11.38 12.5 12.5 11.38 12.5 10V3.75C12.5 2.37 11.38 1.25 10 1.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.58 8.12V10C4.58 12.99 7.01 15.42 10 15.42C12.99 15.42 15.42 12.99 15.42 10V8.12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 15.42V18.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Chevron down icon (20×20), e.g. for scroll-to-bottom button. */
export function ArrowDownIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: "rotate(-90deg)" }}
    >
      <path
        d="M11.0265 18.0264L5.00049 12.0005M5.00049 12.0005L10.9407 6.06023M5.00049 12.0005L19.0005 12.0005"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

/** Upward arrow icon used for the send button (20×20). */
export function SendIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 15.5017L10 4.83171M10 4.83171L5.42711 9.4046M10 4.83171L14.5729 9.4046"
        stroke="currentColor"
        strokeWidth="1.5243"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MagnifierIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 32 32"
      fill="none"
    >
      <path
        d="M26.5259 27.9399C26.9164 28.3305 27.5496 28.3305 27.9401 27.9399C28.3306 27.5494 28.3306 26.9163 27.9401 26.5257L26.5259 27.9399ZM22.519 7.43385L23.2261 6.72675L22.519 7.43385ZM21.8118 21.8117C18.0368 25.5868 11.9162 25.5868 8.14112 21.8117L6.7269 23.2259C11.283 27.782 18.6699 27.782 23.2261 23.2259L21.8118 21.8117ZM8.14112 21.8117C4.36605 18.0366 4.36605 11.916 8.14112 8.14096L6.7269 6.72675C2.17079 11.2829 2.17079 18.6698 6.7269 23.2259L8.14112 21.8117ZM8.14112 8.14096C9.95761 6.32447 12.3149 5.38242 14.6957 5.31371L14.638 3.31454C11.7673 3.39739 8.91849 4.53516 6.7269 6.72675L8.14112 8.14096ZM24.6391 14.6955C24.7132 17.264 23.7708 19.8527 21.8118 21.8117L23.2261 23.2259C25.5902 20.8618 26.7276 17.7336 26.6383 14.6378L24.6391 14.6955ZM21.8118 23.2259L26.5259 27.9399L27.9401 26.5257L23.2261 21.8117L21.8118 23.2259ZM14.6957 5.31371C17.0812 5.24487 19.6966 6.02576 21.8118 8.14096L23.2261 6.72675C20.6749 4.17561 17.504 3.23183 14.638 3.31454L14.6957 5.31371ZM21.8118 8.14096C23.7979 10.127 24.5644 12.1061 24.6391 14.6955L26.6383 14.6378C26.5495 11.5631 25.5903 9.09101 23.2261 6.72675L21.8118 8.14096Z"
        fill="currentColor"
      />
    </svg>
  );
}
