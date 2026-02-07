import toast from "react-hot-toast";

const defaultDuration = 3000;

export const toastStyles = {
  fontSize: 15,
  fontWeight: 500,
  letterSpacing: -0.15,
  minWidth: 150,
  overflow: "hidden",
};

/** Show an error toast. Use for API failures, gateway errors, etc. */
export function addToastError(message: string): void {
  console.error(message);
  toast.error(message, { duration: defaultDuration, style: toastStyles });
}
