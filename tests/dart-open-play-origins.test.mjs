import assert from "node:assert/strict";
import test from "node:test";
import endpoint from "../directus/extensions/directus-extension-dart-open-play/dist/index.js";

function harness(
  allowed = "https://*.ingomc.de,https://www.sc-oberfuellbach.de",
) {
  const routes = {};
  endpoint.handler(
    {
      get: (path, handler) => {
        routes[`GET ${path}`] = handler;
      },
      post: (path, handler) => {
        routes[`POST ${path}`] = handler;
      },
      options: (path, handler) => {
        routes[`OPTIONS ${path}`] = handler;
      },
    },
    {
      env: { DART_OPEN_PLAY_ALLOWED_ORIGINS: allowed },
      database: () => ({
        first: async () => ({ dart_open_play_enabled: true }),
      }),
      logger: { error: () => assert.fail("Unexpected endpoint error") },
    },
  );
  return async (route, origin) => {
    const response = {
      code: 200,
      headers: {},
      set(headers) {
        Object.assign(this.headers, headers);
        return this;
      },
      status(code) {
        this.code = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
      sendStatus(code) {
        this.code = code;
        return this;
      },
    };
    await routes[route](
      { headers: origin ? { origin } : {}, body: {}, ip: origin || route },
      response,
    );
    return response;
  };
}

test("HTTPS-Subdomains dürfen Daten und Preflight laden; Anmeldung erreicht die Eingabeprüfung", async () => {
  const request = harness();
  for (const origin of [
    "https://preview.ingomc.de",
    "https://pr44.preview.ingomc.de",
    "https://www.sc-oberfuellbach.de",
  ]) {
    const get = await request("GET /", origin);
    assert.equal(get.code, 200);
    assert.equal(get.body.open, true);
    assert.equal(get.headers["Access-Control-Allow-Origin"], origin);
    const options = await request("OPTIONS /*", origin);
    assert.equal(options.code, 204);
    assert.equal(options.headers["Access-Control-Allow-Origin"], origin);
    const post = await request("POST /registrations", origin);
    assert.equal(post.code, 400);
    assert.notEqual(post.body.error, "ORIGIN_NOT_ALLOWED");
  }
});

test("Wildcard blockiert fremde Hosts, Domain-Tricks, HTTP, Ports und ungültige Origins", async () => {
  const request = harness();
  for (const origin of [
    "https://ingomc.de",
    "https://evilingomc.de",
    "https://preview.ingomc.de.evil.test",
    "http://preview.ingomc.de",
    "https://preview.ingomc.de:8443",
    "https://user@preview.ingomc.de",
    "https://preview.ingomc.de/path",
    "null",
    "not-a-url",
  ]) {
    for (const route of ["GET /", "OPTIONS /*", "POST /registrations"]) {
      const response = await request(route, origin);
      assert.equal(response.code, 403, `${route}: ${origin}`);
      assert.equal(response.body.error, "ORIGIN_NOT_ALLOWED");
      assert.equal(response.headers["Access-Control-Allow-Origin"], undefined);
    }
  }
});

test("Ohne Origin bleibt Lesen möglich, Anmeldung gesperrt; exakte bestehende Freigaben bleiben gültig", async () => {
  const request = harness("https://www.sc-oberfuellbach.de");
  assert.equal((await request("GET /")).code, 200);
  assert.equal((await request("POST /registrations")).code, 403);
  assert.equal(
    (await request("GET /", "https://www.sc-oberfuellbach.de")).code,
    200,
  );
  assert.equal((await request("GET /", "https://preview.ingomc.de")).code, 403);
});

test("Vercel-Projekt-Wildcard erlaubt Branch- und Deployment-Adressen", async () => {
  const request = harness("https://*-andre-bellmanns-projects.vercel.app");
  for (const origin of [
    "https://astro-sco-git-codex-menu-direct-505ed2-andre-bellmanns-projects.vercel.app",
    "https://astro-p3pw94cb1-andre-bellmanns-projects.vercel.app",
  ]) {
    assert.equal((await request("GET /", origin)).code, 200);
    assert.equal((await request("OPTIONS /*", origin)).code, 204);
    const post = await request("POST /registrations", origin);
    assert.equal(post.code, 400);
    assert.notEqual(post.body.error, "ORIGIN_NOT_ALLOWED");
    assert.equal(post.headers["Access-Control-Allow-Origin"], origin);
  }
  for (const origin of [
    "https://astro-other-projects.vercel.app",
    "https://astro-andre-bellmanns-projects.vercel.app.evil.test",
    "https://astro-andre-bellmanns-projectsevil.vercel.app",
    "https://andre-bellmanns-projects.vercel.app",
    "https://nested.astro-andre-bellmanns-projects.vercel.app",
    "http://astro-andre-bellmanns-projects.vercel.app",
    "https://astro-andre-bellmanns-projects.vercel.app:8443",
    "https://preview.ingomc.de",
  ]) {
    for (const route of ["GET /", "OPTIONS /*", "POST /registrations"]) {
      const response = await request(route, origin);
      assert.equal(response.code, 403, origin);
      assert.equal(response.body.error, "ORIGIN_NOT_ALLOWED");
    }
  }
});
