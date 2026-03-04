declare global {
  interface Window {
    __API_URL__?: string;
  }
}

export function getApiUrl(): string {
  if (typeof window !== "undefined" && window.__API_URL__) {
    return window.__API_URL__;
  }
  return "http://localhost:8787";
}
