export function generateTextStream(
  params: { theme: string },
  callbacks: {
    onMessage: (data: { text: string }) => void;
    onClose: () => void;
    onError: (err: unknown) => void;
  },
) {
  const { theme } = params;
  if (!theme) {
    callbacks.onError(new Error("Theme is empty"));
    return;
  }

  // Assuming backend runs on 8080 (Vite proxy can be used, but let's use direct URL for now if needed.
  // Actually, we should just use /api/optimize so that Vite proxy can proxy it or fallback to localhost:8080.
  // Assuming there is a vite proxy for /api)
  const eventSource = new EventSource(
    `http://${window.location.hostname}:8080/api/optimize?prompt=${encodeURIComponent(theme)}`,
  );

  eventSource.onmessage = (event) => {
    if (event.data === "[DONE]") {
      eventSource.close();
      callbacks.onClose();
      return;
    }
    callbacks.onMessage({ text: event.data });
  };

  eventSource.onerror = (event) => {
    // EventSource will try to reconnect automatically on error, but we want to close it since it's a one-off completion.
    // If we receive an error, it usually means the connection closed or the server sent an error.
    console.error("SSE Error:", event);
    eventSource.close();
    callbacks.onError(event);
  };
}
