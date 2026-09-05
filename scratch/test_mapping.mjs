function toStringOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function toJsonValue(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.map(item => toStringOrUndefined(item)).filter(item => item !== undefined);
  }
  return [];
}

function toPaymentMethodsArray(value) {
  const parsed = toJsonValue(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((item) => {
      if (item && typeof item === "object") {
        return toStringOrUndefined(item.name);
      }
      return toStringOrUndefined(item);
    })
    .filter((item) => item !== undefined);
}

async function run() {
  const res = await fetch("https://cms.dart.ingomc.de/items/settings", {
    headers: {
      Authorization: "Bearer XAYyBfQzhTYd79m8lw69gM97qLZtUWvh"
    }
  });
  const json = await res.json();
  const data = json.data;
  console.log("Directus raw payment_methods:", JSON.stringify(data.payment_methods));
  console.log("Mapped payment_methods:", toPaymentMethodsArray(data.payment_methods));
}

run().catch(console.error);
