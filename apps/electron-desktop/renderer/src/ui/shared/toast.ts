import toast from "react-hot-toast";

const defaultDuration = 3000;

export const toastStyles = {
  fontSize: 15,
  fontWeight: 500,
  letterSpacing: -0.15,
  minWidth: 150,
  overflow: "hidden",
};

function errorToMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message || "Unknown error";
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Show an error toast. Use for API failures, gateway errors, etc. */
export function addToastError(message: unknown): void {
  const stringMessage = errorToMessage(message);
  console.error(message);
  toast.error(stringMessage, { duration: defaultDuration, style: toastStyles });
}
