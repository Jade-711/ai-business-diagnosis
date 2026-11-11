import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditSceneExecution} from '../scripts/audit-scene-execution.mjs';
const read=name=>JSON.parse(readFileSync(new URL('../workflow/'+name,import.meta.url),'utf8'));
test('91场景确定性业务核查覆盖双周期、负例、缺证、去重、原因与行动边界（不代表91次真实模型验收）',()=>{const r=auditSceneExecution();assert.equal(r.scenes.length,91);assert.equal(r.checks.routing,1092);assert.equal(r.checks.modelClaimGuards,1140);});
test('v13拓扑及未修改业务节点保留，已声明修复与用量适配可审计',()=>{
 const graph=read('main.workflow.json'),base=read('v13-baseline.workflow.json');
 const fixes=['410001','310005','310004','410022'];
 const ids=['110004','310002','410021','110009'],metadata=['410001','110001','310004','410022','410003','110012','110013','900001'];
 assert.equal(graph.nodes.length,21);assert.deepEqual(graph.edges,base.edges);
 for(const n of base.nodes){const actual=graph.nodes.find(a=>a.id===n.id);if(!ids.includes(n.id)){if(!metadata.includes(n.id)&&!fixes.includes(n.id))assert.deepEqual(actual,n);if(n.id==='110001')assert.match(actual.data.inputs.code,/confirmRequest\(assistantConfirmedRequest\(params\)\)/);if(['310004','410022'].includes(n.id))assert.match(actual.data.inputs.code,/applyAssistantAnswerContract\(calculation,verifiedModel,finalizeWorkflowDiagnosis\(calculation,verifiedModel\)\)/);if(n.id==='410001')assert.match(actual.data.inputs.code,/knowledgeQuestion:projectKnowledgeQuestion/);continue;}
  assert.equal(actual.type,'9');assert.equal(actual.data.inputs.workflowId,'7703982450461147170');assert.equal(actual.data.inputs.workflowVersion,'v0.0.7');
  const outputs=structuredClone(actual.data.outputs);if(n.id==='310002')outputs[0].schema.schema=outputs[0].schema.schema.filter(o=>o.name!=='usageJson');else outputs.splice(outputs.findIndex(o=>o.name==='usageJson'),1);assert.deepEqual(outputs,n.data.outputs);assert.deepEqual(actual.data.inputs.batch,n.data.inputs.batch);
  for(const p of n.data.inputs.inputParameters){const value=actual.data.inputs.inputParameters.find(a=>a.name===p.name);if(n.id==='110009'&&p.name==='question')assert.deepEqual(value.input.value.content,{source:'block-output',blockID:'410001',name:'knowledgeQuestion'});else assert.deepEqual(value.input.value,p.input.value);}
 }
 assert.equal(graph.nodes.filter(n=>n.type==='9').length,4);assert.ok(graph.nodes.every(n=>n.type!=='3'&&!n.data.inputs?.llmParam));
});
test('共享适配层只有原生HTTP转换所需五个节点，无代理、自动重试或源码密钥',()=>{
 const graph=read('adapter.workflow.json');assert.deepEqual(graph.nodes.map(n=>n.type),['1','5','45','5','2']);assert.equal(graph.edges.length,4);
 const http=graph.nodes.find(n=>n.type==='45');assert.equal(http.data.inputs.apiInfo.url,'https://api.deepseek.com/responses');assert.equal(http.data.inputs.apiInfo.method,'POST');assert.equal(http.data.inputs.setting.retryTimes,0);assert.equal(http.data.inputs.auth.authData.bearerTokenData[0].input.value.content,'');
 assert.doesNotMatch(JSON.stringify(graph),/sk-[a-z0-9]{10}/);assert.doesNotMatch(JSON.stringify(read('main.workflow.json')),/api\/workflow\/model/);
});
