async function run() {
  const res = await fetch('https://cms.dart.ingomc.de/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer FdgpDcOQtW_oWEujaDErhgO4NaDXIGJ8'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    })
  });
  const json = await res.json();
  const fieldsTool = json.result.tools.find(t => t.name === 'fields');
  console.log(JSON.stringify(fieldsTool, null, 2));
}
run().catch(console.error);
