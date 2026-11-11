import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
const url='https://example.test/api/evaluation/run';
const env={COZE_API_TOKEN:'existing-coze-secret',COZE_PUBLIC_DEMO:'1',EVAL_RUN_KEY:'task-only-key-abcdefghijklmnopqrstuvwxyz',EVAL_RUN_UNTIL:'9999999999999',EVAL_WORKFLOW_VERSION:'v0.0.1'};
const parameters={sellerId:'DEMO_10001',question:'查询近7天全店成交金额',requestId:'00000000-0000-4000-8000-000000000001',chatId:'eval-gateway-check',pageContext:{fieldKey:'overview',period:'week'},history:[]};
const request=(body,key)=>new Request(url,{method:'POST',headers:{'content-type':'application/json',...(key?{'x-evaluation-key':key}:{})},body:JSON.stringify(body)});
test('evaluation requires a dedicated key or authenticated owner, even when public trial is on',async()=>{
 for(const key of [undefined,'wrong'])assert.equal((await worker.fetch(request(parameters,key),env)).status,403);
 assert.equal((await worker.fetch(request(parameters,env.EVAL_RUN_KEY),{...env,EVAL_RUN_KEY:undefined})).status,403);
});
test('evaluation rejects arbitrary workflow, data, configuration and merchant replacement',async()=>{
 for(const extra of [{workflowId:'other'},{runtimeConfigurations:{}},{gold:'answer'},{sellerId:'OTHER'}]){
  assert.equal((await worker.fetch(request({...parameters,...extra},env.EVAL_RUN_KEY),env)).status,400);
 }
});
test('evaluation reuses server credential and frozen workflow, preserving result and debug identity',async()=>{
 const original=globalThis.fetch;let received;
 globalThis.fetch=async(url,options)=>{
  received={url,options,payload:JSON.parse(options.body)};
  const actual={schemaVersion:1,status:'success',branch:'data',answer:'本期成交金额10元',context:{requestId:parameters.requestId}};
  return new Response('id: 0\nevent: Message\ndata: '+JSON.stringify({node_id:'900001',node_title:'结束',node_is_finish:true,content:JSON.stringify({result:actual})})+'\n\nid: 1\nevent: Done\ndata: '+JSON.stringify({debug_url:'https://www.coze.cn/work_flow?workflow_id=7704887885451542582&execute_id=run1'})+'\n\n',{headers:{'content-type':'text/event-stream'}});
 };
 try{
  const response=await worker.fetch(request(parameters,env.EVAL_RUN_KEY),env);const text=await response.text();
  assert.equal(response.status,200);assert.match(text,/本期成交金额10元/);assert.match(text,/executeId":"run1/);
  assert.equal(received.payload.workflow_id,'7704887885451542582');assert.equal(received.payload.workflow_version,'v0.0.1');
  assert.deepEqual(received.payload.parameters,parameters);assert.equal(received.options.headers.authorization,'Bearer '+env.COZE_API_TOKEN);
  assert.doesNotMatch(text,/existing-coze-secret|task-only-key/);
 }finally{globalThis.fetch=original;}
});
