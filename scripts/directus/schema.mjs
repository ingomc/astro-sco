function textField(
  name,
  required = false,
  width = "full",
  interfaceType = "input",
  options = {},
) {
  const { note, hidden = false } = options;

  const meta = {
    interface: interfaceType,
    required,
    width,
  };

  if (note) {
    meta.note = note;
  }

  if (hidden) {
    meta.hidden = true;
  }

  return {
    name,
    type: "text",
    meta,
    schema: {
      is_nullable: !required,
    },
  };
}

function stringField(
  name,
  required = false,
  width = "half",
  maxLength = 255,
  options = {},
) {
  const {
    note,
    hidden = false,
    defaultValue,
    interfaceType = "input",
    options: interfaceOptions,
    isUnique = false,
  } = options;

  const meta = {
    interface: interfaceType,
    required,
    width,
  };

  if (note) {
    meta.note = note;
  }

  if (interfaceOptions) {
    meta.options = interfaceOptions;
  }

  if (hidden) {
    meta.hidden = true;
  }

  const schema = {
    is_nullable: !required,
    max_length: maxLength,
  };

  if (defaultValue !== undefined) {
    schema.default_value = defaultValue;
  }

  if (isUnique) {
    schema.is_unique = true;
  }

  return {
    name,
    type: "string",
    meta,
    schema,
  };
}

function boolField(name, required = false, defaultValue = false) {
  return {
    name,
    type: "boolean",
    meta: {
      interface: "boolean",
      required,
      width: "half",
    },
    schema: {
      is_nullable: !required,
      default_value: defaultValue,
    },
  };
}

function integerField(name, required = false, width = "half", options = {}) {
  const { note, hidden = false, defaultValue } = options;

  const meta = {
    interface: "input",
    required,
    width,
  };

  if (note) {
    meta.note = note;
  }

  if (hidden) {
    meta.hidden = true;
  }

  const schema = {
    is_nullable: !required,
  };

  if (defaultValue !== undefined) {
    schema.default_value = defaultValue;
  }

  return {
    name,
    type: "integer",
    meta,
    schema,
  };
}

function jsonField(name, required = false, width = "full", options = {}) {
  const { note, hidden = false } = options;

  const meta = {
    interface: "input-code",
    required,
    width,
    options: {
      language: "json",
    },
  };

  if (note) {
    meta.note = note;
  }

  if (hidden) {
    meta.hidden = true;
  }

  return {
    name,
    type: "json",
    meta,
    schema: {
      is_nullable: !required,
    },
  };
}

function dateTimeField(name, required = false) {
  return {
    name,
    type: "timestamp",
    meta: {
      interface: "datetime",
      required,
      width: "half",
    },
    schema: {
      is_nullable: !required,
    },
  };
}

function fileImageField(name, required = false, width = "half", options = {}) {
  const { note, hidden = false } = options;

  const meta = {
    interface: "file-image",
    required,
    width,
  };

  if (note) {
    meta.note = note;
  }

  if (hidden) {
    meta.hidden = true;
  }

  return {
    name,
    type: "uuid",
    meta,
    schema: {
      is_nullable: !required,
    },
  };
}

const commonContentFields = [
  {
    name: "slug",
    type: "string",
    meta: {
      interface: "input",
      required: true,
      width: "half",
      note: "Route slug from content path.",
    },
    schema: {
      is_nullable: false,
      is_unique: true,
      max_length: 255,
    },
  },
  textField("body", false, "full", "input-rich-text-html", {
    note: "Primary editor field for CMS content.",
  }),
  stringField("content_format", true, "half", 32, {
    defaultValue: "html",
    hidden: true,
    note: "Technical format marker (html, markdown, mdx).",
  }),
  stringField("source_path", false, "full", 500, {
    hidden: true,
    note: "Legacy migration metadata.",
  }),
];

export const TARGET_SCHEMA = [
  {
    name: "veranstaltungen",
    meta: {
      icon: "event",
      note: "Migrated from Astro content collection veranstaltungen.",
    },
    fields: [
      ...commonContentFields,
      stringField("title", true, "full"),
      textField("description", true, "full"),
      dateTimeField("pub_date", true),
      dateTimeField("event_date", true),
      stringField("location", false, "half"),
      stringField("hero_image", false, "half", 500, {
        hidden: true,
        note: "Legacy hero image path. Prefer hero_image_file.",
      }),
      fileImageField("hero_image_file", false, "half", {
        note: "Upload/select hero image in Directus files.",
      }),
      stringField("hero_image_alt", false, "half", 255),
      stringField("cta", false, "half"),
      boolField("featured", false, false),
      boolField("hidden", false, false),
      {
        name: "tags",
        type: "json",
        meta: {
          interface: "tags",
          required: false,
          width: "full",
        },
        schema: {
          is_nullable: true,
        },
      },
      jsonField("map_locations", false, "full", {
        note: "Optional map markers for this report.",
      }),
      integerField("map_zoom", false, "half", {
        note: "Map zoom level.",
        defaultValue: 15,
      }),
      stringField("map_height", false, "half", 32, {
        note: "Map container height (for example 450px).",
      }),
      jsonField("gallery_images", false, "full", {
        note: "Optional gallery images [{src, alt}] for this report.",
      }),
      integerField("gallery_columns", false, "half", {
        note: "Gallery columns (2, 3, or 4).",
        defaultValue: 3,
      }),
    ],
  },
  {
    name: "berichte",
    meta: {
      icon: "article",
      note: "Migrated from Astro content collection berichte.",
    },
    fields: [
      ...commonContentFields,
      stringField("title", true, "full"),
      textField("description", false, "full"),
      dateTimeField("pub_date", true),
      dateTimeField("event_date", true),
      stringField("location", false, "half"),
      stringField("hero_image", false, "half", 500, {
        hidden: true,
        note: "Legacy hero image path. Prefer hero_image_file.",
      }),
      fileImageField("hero_image_file", false, "half", {
        note: "Upload/select hero image in Directus files.",
      }),
      stringField("hero_image_alt", false, "half", 255),
      boolField("hidden", false, false),
      {
        name: "tags",
        type: "json",
        meta: {
          interface: "tags",
          required: false,
          width: "full",
        },
        schema: {
          is_nullable: true,
        },
      },
    ],
  },
  {
    name: "mitglieder",
    meta: {
      icon: "groups",
      note: "Migrated from Astro content collection mitglieder.",
    },
    fields: [
      ...commonContentFields,
      stringField("name", true, "full"),
      stringField("position", false, "half"),
      boolField("stammtisch", false, false),
      boolField("dart", false, false),
      stringField("email", false, "half"),
      stringField("authorimage", false, "half", 500),
    ],
  },
  {
    name: "start",
    meta: {
      icon: "home",
      note: "Migrated from Astro content collection start.",
    },
    fields: [
      ...commonContentFields,
      stringField("title", true, "full"),
      {
        name: "order",
        type: "integer",
        meta: {
          interface: "input",
          required: true,
          width: "half",
        },
        schema: {
          is_nullable: false,
        },
      },
    ],
  },
  {
    name: "sportheim",
    meta: {
      icon: "restaurant",
      note: "Migrated from Astro content collection sportheim.",
    },
    fields: [
      ...commonContentFields,
      stringField("title", true, "full"),
      {
        name: "order",
        type: "integer",
        meta: {
          interface: "input",
          required: false,
          width: "half",
        },
        schema: {
          is_nullable: true,
        },
      },
      stringField("legacy_id", false, "half", 255),
    ],
  },
  {
    name: "settings",
    meta: {
      icon: "settings",
      note: "Migrated from Astro data collection settings.",
      singleton: true,
    },
    fields: [
      stringField("site_title", true, "full"),
      textField("site_description", false, "full"),
      fileImageField("default_og_image", false, "half"),
      {
        name: "posts_front_limit",
        type: "integer",
        meta: {
          interface: "input",
          required: true,
          width: "half",
        },
        schema: {
          is_nullable: false,
        },
      },
      stringField("posts_author", true, "half"),
      stringField("posts_thumb", true, "half", 500),
      stringField("phone", false, "half"),
      stringField("email", false, "half"),
      stringField("address_street", false, "half"),
      stringField("address_city", false, "half"),
      {
        name: "payment_methods",
        type: "json",
        meta: {
          interface: "list",
          required: false,
          width: "half",
          note: "Accepted payment methods.",
          options: {
            template: "{{name}}",
            fields: [
              {
                field: "name",
                name: "Zahlungsart",
                type: "string",
                meta: {
                  interface: "input",
                  width: "full",
                  required: true,
                  options: {
                    placeholder: "Bargeld",
                  },
                },
              },
            ],
          },
        },
        schema: {
          is_nullable: true,
        },
      },
      {
        name: "opening_hours",
        type: "json",
        meta: {
          interface: "list",
          required: false,
          width: "full",
          note: "Opening hours shown on the homepage.",
          options: {
            template: "{{hour}}",
            fields: [
              {
                field: "hour",
                name: "Öffnungszeit / Info",
                type: "string",
                meta: {
                  interface: "input",
                  width: "full",
                  required: true,
                  options: {
                    placeholder: "jeden Sonntag ab 18:30 Uhr",
                  },
                },
              },
            ],
          },
        },
        schema: {
          is_nullable: true,
        },
      },
      {
        name: "regular_events",
        type: "json",
        meta: {
          interface: "list",
          required: false,
          width: "full",
          note: "Regular meetings shown on the events page.",
          options: {
            template: "{{time}} - {{label}}",
            fields: [
              {
                field: "time",
                name: "Tag / Uhrzeit",
                type: "string",
                meta: {
                  interface: "input",
                  width: "half",
                  required: true,
                  options: {
                    placeholder: "So: ab 18:00 Uhr",
                  },
                },
              },
              {
                field: "label",
                name: "Termin / Name",
                type: "string",
                meta: {
                  interface: "input",
                  width: "half",
                  required: true,
                  options: {
                    placeholder: "Steel-Darts",
                  },
                },
              },
            ],
          },
        },
        schema: {
          is_nullable: true,
        },
      },
      boolField("use_winter_mode", false, false),
      boolField("use_winter_stage", false, false),
      fileImageField("logo_normal", false, "half"),
      fileImageField("logo_winter", false, "half"),
    ],
  },
  {
    name: "drink_categories",
    meta: {
      icon: "local_bar",
      note: "Drinks categories (e.g. Bier, Alkoholfreie Getränke, Wein und Spirituosen)",
      sort_field: "sort",
      display_template: "{{name}}",
    },
    fields: [
      {
        name: "sort",
        type: "integer",
        meta: {
          interface: "input",
          hidden: true,
        },
        schema: {},
      },
      stringField("name", true, "full"),
      stringField("icon", false, "half", 255, {
        interfaceType: "select-dropdown",
        options: {
          choices: [
            { text: "Bier (beer)", value: "beer" },
            { text: "Flasche (bottle)", value: "bottle" },
            { text: "Glas (glass)", value: "glass" },
          ],
        },
      }),
      {
        name: "drinks",
        type: "alias",
        meta: {
          interface: "list-o2m",
          special: ["o2m"],
          display: "related-values",
          display_options: {
            template: "{{name}}",
          },
        },
        schema: null,
      },
    ],
  },
  {
    name: "drinks",
    meta: {
      icon: "liquor",
      note: "Individual drinks with sizes and prices",
      sort_field: "sort",
    },
    fields: [
      {
        name: "sort",
        type: "integer",
        meta: {
          interface: "input",
          hidden: true,
        },
        schema: {},
      },
      stringField("name", true, "full"),
      {
        name: "category",
        type: "integer",
        meta: {
          interface: "select-dropdown-m2o",
          special: ["m2o"],
          required: true,
          width: "half",
          options: {
            template: "{{name}}",
          },
          display: "related-values",
          display_options: {
            template: "{{name}}",
          },
        },
        schema: {},
      },
      {
        name: "prices",
        type: "json",
        meta: {
          interface: "list",
          required: true,
          width: "full",
          options: {
            template: "{{size}} {{unit}} - {{price}} €",
            fields: [
              {
                field: "size",
                name: "Größe (Wert)",
                type: "string",
                meta: {
                  interface: "input",
                  width: "one-third",
                  required: true,
                  options: {
                    placeholder: "0,5",
                  },
                },
              },
              {
                field: "unit",
                name: "Einheit",
                type: "string",
                meta: {
                  interface: "select-dropdown",
                  width: "one-third",
                  required: true,
                  options: {
                    choices: [
                      { text: "l", value: "l" },
                      { text: "cl", value: "cl" },
                      { text: "ml", value: "ml" },
                    ],
                  },
                },
              },
              {
                field: "price",
                name: "Preis (in €)",
                type: "string",
                meta: {
                  interface: "input",
                  width: "one-third",
                  required: true,
                  options: {
                    placeholder: "3,00",
                  },
                },
              },
            ],
          },
        },
        schema: {
          is_nullable: false,
        },
      },
    ],
  },
  {
    name: "food_orderings",
    meta: {
      icon: "restaurant_menu",
      note: "Eventbezogene Essensvorbestellungen. Die öffentliche Bestellung wird ausschließlich über die geschützte Food-Preorder-Erweiterung angenommen.",
      display_template: "{{title}}",
    },
    fields: [
      stringField("title", true, "full", 255, {
        note: "Interne Bezeichnung, z. B. Kerwa 2026 – Essensvorbestellung.",
      }),
      {
        name: "event",
        type: "integer",
        meta: {
          interface: "select-dropdown-m2o",
          special: ["m2o"],
          required: true,
          width: "half",
          options: { template: "{{title}}" },
          display: "related-values",
          display_options: { template: "{{title}}" },
        },
        schema: { is_nullable: false, is_unique: true },
      },
      boolField("active", false, false),
      dateTimeField("order_deadline", true),
      textField("collection_note", false, "full", "input-multiline", {
        note: "Optionaler Hinweis zur Abholung oder Bezahlung vor Ort.",
      }),
      {
        name: "food_dishes",
        type: "alias",
        meta: {
          interface: "list-o2m",
          special: ["o2m"],
          display: "related-values",
          display_options: { template: "{{name}}" },
        },
        schema: null,
      },
      {
        name: "reservations",
        type: "alias",
        meta: {
          interface: "list-o2m",
          special: ["o2m"],
          display: "related-values",
          display_options: {
            template: "{{reservation_number}} – {{customer_name}}",
          },
        },
        schema: null,
      },
    ],
  },
  {
    name: "food_dishes",
    meta: {
      icon: "lunch_dining",
      note: "Gerichte mit Kontingent für eine bestimmte Event-Vorbestellung.",
      sort_field: "sort",
      display_template: "{{name}}",
    },
    fields: [
      {
        name: "sort",
        type: "integer",
        meta: { interface: "input", hidden: true },
        schema: {},
      },
      {
        name: "ordering",
        type: "integer",
        meta: {
          interface: "select-dropdown-m2o",
          special: ["m2o"],
          required: true,
          width: "half",
          options: { template: "{{title}}" },
          display: "related-values",
          display_options: { template: "{{title}}" },
        },
        schema: { is_nullable: false },
      },
      boolField("active", false, true),
      stringField("name", true, "full", 255),
      textField("description", false, "full", "input-multiline"),
      textField("allergens", false, "full", "input-multiline", {
        note: "Allergenhinweise, die vor der Reservierung angezeigt werden.",
      }),
      integerField("price_cents", true, "half", {
        note: "Preis in Cent, z. B. 850 für 8,50 €.",
      }),
      integerField("capacity", true, "half", {
        note: "Maximal bestätigbare Anzahl dieses Gerichts.",
      }),
    ],
  },
  {
    name: "food_reservations",
    meta: {
      icon: "receipt_long",
      note: "Personenbezogene Reservierungen. Niemals für die öffentliche Directus-API freigeben.",
      display_template: "{{reservation_number}} – {{customer_name}}",
    },
    fields: [
      {
        name: "ordering",
        type: "integer",
        meta: {
          interface: "select-dropdown-m2o",
          special: ["m2o"],
          required: true,
          width: "half",
          options: { template: "{{title}}" },
          display: "related-values",
          display_options: { template: "{{title}}" },
        },
        schema: { is_nullable: false },
      },
      stringField("reservation_number", true, "half", 32, {
        interfaceType: "input",
        isUnique: true,
      }),
      stringField("status", true, "half", 32, {
        defaultValue: "pending_confirmation",
        interfaceType: "select-dropdown",
        options: {
          choices: [
            { text: "Bestätigung ausstehend", value: "pending_confirmation" },
            { text: "Bestätigt", value: "confirmed" },
            { text: "Storniert", value: "cancelled" },
          ],
        },
      }),
      stringField("customer_name", true, "half", 120),
      stringField("customer_email", true, "half", 255),
      stringField("confirmation_token_hash", false, "full", 128, {
        hidden: true,
      }),
      stringField("management_token_hash", false, "full", 128, {
        hidden: true,
      }),
      dateTimeField("date_created", true),
      dateTimeField("date_updated", true),
      dateTimeField("confirmed_at", false),
      dateTimeField("cancelled_at", false),
      dateTimeField("anonymized_at", false),
      {
        name: "reservation_lines",
        type: "alias",
        meta: {
          interface: "list-o2m",
          special: ["o2m"],
          display: "related-values",
          display_options: { template: "{{quantity}} × {{dish_name}}" },
        },
        schema: null,
      },
    ],
  },
  {
    name: "food_reservation_lines",
    meta: {
      icon: "format_list_numbered",
      note: "Flache Bestellpositionen für den CSV-Export. Nach der Veranstaltung werden Kundendaten anonymisiert.",
      display_template: "{{reservation_number}} – {{quantity}} × {{dish_name}}",
    },
    fields: [
      {
        name: "reservation",
        type: "integer",
        meta: {
          interface: "select-dropdown-m2o",
          special: ["m2o"],
          required: true,
          width: "half",
          options: { template: "{{reservation_number}} – {{customer_name}}" },
          display: "related-values",
          display_options: {
            template: "{{reservation_number}} – {{customer_name}}",
          },
        },
        schema: { is_nullable: false },
      },
      {
        name: "ordering",
        type: "integer",
        meta: {
          interface: "select-dropdown-m2o",
          special: ["m2o"],
          required: true,
          width: "half",
          options: { template: "{{title}}" },
          display: "related-values",
          display_options: { template: "{{title}}" },
        },
        schema: { is_nullable: false },
      },
      {
        name: "dish",
        type: "integer",
        meta: {
          interface: "select-dropdown-m2o",
          special: ["m2o"],
          required: false,
          width: "half",
          options: { template: "{{name}}" },
          display: "related-values",
          display_options: { template: "{{name}}" },
        },
        schema: { is_nullable: true },
      },
      stringField("reservation_number", true, "half", 32),
      stringField("status", true, "half", 32),
      stringField("customer_name", true, "half", 120),
      stringField("customer_email", true, "half", 255),
      stringField("dish_name", true, "half", 255),
      integerField("unit_price_cents", true, "half"),
      integerField("quantity", true, "half"),
      dateTimeField("date_created", true),
    ],
  },
];

function fileRelation(collection, field) {
  return {
    collection,
    field,
    related_collection: "directus_files",
    schema: {
      on_delete: "SET NULL",
      on_update: "NO ACTION",
    },
    meta: {
      many_collection: collection,
      many_field: field,
      one_collection: "directus_files",
      one_field: null,
      one_deselect_action: "nullify",
      junction_field: null,
      sort_field: null,
    },
  };
}

export const TARGET_RELATIONS = [
  fileRelation("veranstaltungen", "hero_image_file"),
  fileRelation("berichte", "hero_image_file"),
  fileRelation("settings", "default_og_image"),
  fileRelation("settings", "logo_normal"),
  fileRelation("settings", "logo_winter"),
  {
    collection: "drinks",
    field: "category",
    related_collection: "drink_categories",
    schema: {
      on_delete: "SET NULL",
      on_update: "NO ACTION",
    },
    meta: {
      many_collection: "drinks",
      many_field: "category",
      one_collection: "drink_categories",
      one_field: "drinks",
      one_deselect_action: "nullify",
      junction_field: null,
      sort_field: null,
    },
  },
  {
    collection: "food_orderings",
    field: "event",
    related_collection: "veranstaltungen",
    schema: {
      on_delete: "CASCADE",
      on_update: "NO ACTION",
    },
    meta: {
      many_collection: "food_orderings",
      many_field: "event",
      one_collection: "veranstaltungen",
      one_field: null,
      one_deselect_action: "nullify",
      junction_field: null,
      sort_field: null,
    },
  },
  {
    collection: "food_dishes",
    field: "ordering",
    related_collection: "food_orderings",
    schema: {
      on_delete: "CASCADE",
      on_update: "NO ACTION",
    },
    meta: {
      many_collection: "food_dishes",
      many_field: "ordering",
      one_collection: "food_orderings",
      one_field: "food_dishes",
      one_deselect_action: "delete",
      junction_field: null,
      sort_field: "sort",
    },
  },
  {
    collection: "food_reservations",
    field: "ordering",
    related_collection: "food_orderings",
    schema: {
      on_delete: "CASCADE",
      on_update: "NO ACTION",
    },
    meta: {
      many_collection: "food_reservations",
      many_field: "ordering",
      one_collection: "food_orderings",
      one_field: "reservations",
      one_deselect_action: "delete",
      junction_field: null,
      sort_field: null,
    },
  },
  {
    collection: "food_reservation_lines",
    field: "reservation",
    related_collection: "food_reservations",
    schema: {
      on_delete: "CASCADE",
      on_update: "NO ACTION",
    },
    meta: {
      many_collection: "food_reservation_lines",
      many_field: "reservation",
      one_collection: "food_reservations",
      one_field: "reservation_lines",
      one_deselect_action: "delete",
      junction_field: null,
      sort_field: null,
    },
  },
  {
    collection: "food_reservation_lines",
    field: "ordering",
    related_collection: "food_orderings",
    schema: {
      on_delete: "CASCADE",
      on_update: "NO ACTION",
    },
    meta: {
      many_collection: "food_reservation_lines",
      many_field: "ordering",
      one_collection: "food_orderings",
      one_field: null,
      one_deselect_action: "delete",
      junction_field: null,
      sort_field: null,
    },
  },
  {
    collection: "food_reservation_lines",
    field: "dish",
    related_collection: "food_dishes",
    schema: {
      on_delete: "SET NULL",
      on_update: "NO ACTION",
    },
    meta: {
      many_collection: "food_reservation_lines",
      many_field: "dish",
      one_collection: "food_dishes",
      one_field: null,
      one_deselect_action: "nullify",
      junction_field: null,
      sort_field: null,
    },
  },
];
