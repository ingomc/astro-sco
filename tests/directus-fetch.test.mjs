import assert from "node:assert/strict";
import test from "node:test";
import { fetchDirectusWithRetry } from "../src/lib/directus-fetch.mjs";

function mockWait(t) {
  const delays = [];
  t.mock.method(globalThis, "setTimeout", (resolve, delay) => {
    delays.push(delay);
    resolve();
  });
  return delays;
}

test("CMS restart recovers from 502/503/504 and preserves authenticated request", async (t) => {
  const delays = mockWait(t);
  const options = { method: "GET", headers: { Authorization: "Bearer test" } };
  const statuses = [502, 503, 504, 200];
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url, actualOptions) => {
    assert.equal(url, "https://cms.example.test/items/settings");
    assert.equal(actualOptions, options);
    return new Response(
      JSON.stringify({ data: { title: "Current CMS data" } }),
      {
        status: statuses[calls++],
      },
    );
  });
  const response = await fetchDirectusWithRetry(
    "https://cms.example.test/items/settings",
    options,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.title, "Current CMS data");
  assert.equal(calls, 4);
  assert.deepEqual(delays, [1000, 2000, 4000]);
});

test("persistent gateway failure retains final response for the build error", async (t) => {
  const delays = mockWait(t);
  let calls = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(`Bad Gateway ${++calls}`, { status: 502 }),
  );
  const response = await fetchDirectusWithRetry(
    "https://cms.example.test/items/settings",
  );
  assert.equal(response.status, 502);
  assert.equal(await response.text(), "Bad Gateway 4");
  assert.equal(calls, 4);
  assert.equal(delays.length, 3);
});

test("authentication, missing routes and other permanent HTTP errors are not retried", async (t) => {
  const delays = mockWait(t);
  for (const status of [401, 403, 404, 429, 500]) {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls++;
      return new Response("Error", { status });
    });
    assert.equal(
      (await fetchDirectusWithRetry("https://cms.example.test/items/settings"))
        .status,
      status,
    );
    assert.equal(calls, 1);
  }
  assert.deepEqual(delays, []);
});

test("network interruption is retried; persistent network errors still reject", async (t) => {
  const delays = mockWait(t);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    if (++calls === 1) throw new TypeError("fetch failed");
    return new Response("Recovered");
  });
  assert.equal(
    await (await fetchDirectusWithRetry("https://cms.example.test")).text(),
    "Recovered",
  );
  assert.equal(calls, 2);
  const error = new TypeError("fetch failed");
  t.mock.method(globalThis, "fetch", async () => {
    throw error;
  });
  await assert.rejects(
    fetchDirectusWithRetry("https://cms.example.test"),
    (actual) => actual === error,
  );
  assert.deepEqual(delays, [1000, 1000, 2000, 4000]);
});

test("explicit cancellation is propagated immediately", async (t) => {
  const delays = mockWait(t);
  const error = new DOMException("Cancelled", "AbortError");
  t.mock.method(globalThis, "fetch", async () => {
    throw error;
  });
  await assert.rejects(
    fetchDirectusWithRetry("https://cms.example.test"),
    (actual) => actual === error,
  );
  assert.deepEqual(delays, []);
});
