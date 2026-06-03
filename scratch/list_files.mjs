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
      method: 'tools/call',
      params: {
        name: 'files',
        arguments: {
          action: 'read'
        }
      }
    })
  });
  const json = await res.json();
  if (json.error) {
    console.error("Error:", json.error);
    process.exit(1);
  }
  const filesText = json.result.content[0].text;
  const files = JSON.parse(filesText).raw || JSON.parse(filesText);
  console.log(JSON.stringify(files.map(f => ({ id: f.id, filename: f.filename_download, title: f.title })), null, 2));
}
run().catch(console.error);
