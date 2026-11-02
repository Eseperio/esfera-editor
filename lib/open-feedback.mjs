/** Synchronize open-dialog feedback with the visible empty-document state. */
export function setOpenFeedback(
  inspectorStatus,
  emptyStatus,
  message,
  isError = false,
) {
  inspectorStatus.textContent = message;
  emptyStatus.textContent = message;
  emptyStatus.classList.toggle("error", isError);
}
