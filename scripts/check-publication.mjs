import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'..');
const graph=JSON.parse(fs.readFileSync(path.join(root,'coze/main-agent-current.workflow.json'),'utf8'));
const clipboard=JSON.parse(fs.readFileSync(path.join(root,'coze/main-agent-current.clipboard.json'),'utf8'));
assert.deepEqual(clipboard.json,graph,'The readable graph and clipboard export must agree');
assert.equal(graph.nodes.length,21);
assert.equal(graph.edges.length,25);
assert.equal(new Set(graph.nodes.map(n=>n.id)).size,graph.nodes.length);
const ids=new Set(graph.nodes.map(n=>n.id));
for(const edge of graph.edges)assert.ok(ids.has(edge.sourceNodeID)&&ids.has(edge.targetNodeID),'Dangling graph edge');
assert.equal(graph.nodes.filter(n=>n.type==='9').length,4);
assert.equal(graph.nodes.filter(n=>n.type==='3').length,0,'No built-in paid model nodes in the exported main graph');
for(const node of graph.nodes.filter(n=>n.type==='9'))assert.equal(node.data.inputs.workflowVersion,'v0.0.6');
const adapter=JSON.parse(fs.readFileSync(path.join(root,'coze/deepseek-adapter-v0.0.6.workflow.json'),'utf8'));
assert.equal(adapter.nodes.length,5);
const http=adapter.nodes.find(n=>n.type==='45');
assert.equal(http.data.inputs.apiInfo.url,'https://api.deepseek.com/responses');
assert.equal(http.data.inputs.auth.authData.bearerTokenData[0].input.value.content,'','Online API key must not be included');
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'site/.openai/hosting.json'))).project_id,'REPLACE_WITH_YOUR_SITES_PROJECT_ID');

const excluded=new Set(['.git','dist','node_modules','coverage']);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>excluded.has(e.name)?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const secretPatterns=[/\bsk-[A-Za-z0-9_-]{16,}/g,/\b(?:pat_|gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}/g,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,/[?&](?:x-signature|X-Amz-Signature|access_token|token|sig)=[^\s"'<>\\]+/g];
const failures=[];
const files=walk(root);
for(const file of files){
 const relative=path.relative(root,file);
 if(/(?:^|\/)\.env(?:$|\.(?!example$))|(?:^|\/)\.dev\.vars|\.(?:sqlite3?|db|log)$/.test(relative))failures.push(relative+': private runtime file');
 const content=fs.readFileSync(file,'utf8');
 for(const pattern of secretPatterns){pattern.lastIndex=0;if(pattern.test(content))failures.push(relative+': possible credential / signed URL');}
 if(/https:\/\/(?:ai-coze|j7phcn)\.hatchable\.site/.test(content))failures.push(relative+': original runtime resource host');
 if(relative.endsWith('.json')&&content.includes('"_temp"'))failures.push(relative+': editor metadata');
}
assert.equal(failures.length,0,failures.join('\n'));
console.log(`Publication checks passed: ${files.length} files, 21 main nodes, 25 edges, 5 adapter nodes.`);
