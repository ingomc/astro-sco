async function run() {
  console.log("Updating fields in Directus CMS via MCP JSON-RPC...");

  const fieldsData = [
    {
      field: "payment_methods",
      meta: {
        interface: "list",
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
                  placeholder: "Bargeld"
                }
              }
            }
          ]
        }
      }
    },
    {
      field: "opening_hours",
      meta: {
        interface: "list",
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
                  placeholder: "jeden Sonntag ab 18:30 Uhr"
                }
              }
            }
          ]
        }
      }
    },
    {
      field: "regular_events",
      meta: {
        interface: "list",
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
                  placeholder: "So: ab 18:00 Uhr"
                }
              }
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
                  placeholder: "Steel-Darts"
                }
              }
            }
          ]
        }
      }
    }
  ];

  const res = await fetch('https://cms.dart.ingomc.de/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer FdgpDcOQtW_oWEujaDErhgO4NaDXIGJ8'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'fields',
        arguments: {
          action: 'update',
          collection: 'settings',
          data: fieldsData
        }
      }
    })
  });

  const json = await res.json();
  if (json.error) {
    throw new Error(`MCP tools failed: ${JSON.stringify(json.error)}`);
  }

  console.log("Fields updated successfully in Directus CMS!");
  console.log(JSON.stringify(json.result, null, 2));
}

run().catch(console.error);
