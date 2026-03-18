import api from "./apiClient";

function triggerBrowserDownload(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadProtectedFile(url, fallbackFileName) {
  const response = await api.get(url, { responseType: "blob" });
  const disposition = response.headers["content-disposition"] || "";
  const matched = disposition.match(/filename="?([^"]+)"?/i);
  const fileName = matched?.[1] || fallbackFileName;
  triggerBrowserDownload(response.data, fileName);
}
