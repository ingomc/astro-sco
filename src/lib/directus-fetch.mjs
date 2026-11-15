const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 2000, 4000];

// A CMS restart can briefly interrupt static generation. Keep the final error
// visible if the service does not recover; never substitute stale local content.
export async function fetchDirectusWithRetry(url, options) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (
        !TRANSIENT_STATUSES.has(response.status) ||
        attempt === RETRY_DELAYS_MS.length
      ) {
        return response;
      }
      if (response.body) await response.body.cancel().catch(() => {});
    } catch (error) {
      if (!(error instanceof TypeError) || attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }
    }
    await new Promise((resolve) =>
      setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
    );
  }
}
