import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {budgetDb} from './budget-db.mjs';
const built=await readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(built).toString('base64'))).default;
const metric={id:'m-click-change',name:'点击率环比',unit:'%',derived:'change',fieldKey:'live'};
const action={id:'a-click',name:'检查商品展示与讲解'};
const frame={id:'qa-frame',name:'打包验收框架',sceneId:'scene-live',version:1,draftText:'点击率环比小于零时，核查展示与讲解。',branches:[{id:'click',name:'点击效率',meaning:'按所选点击环比判断方向，具体原因待核查。',priority:1,metricIds:[metric.id],actionIds:[action.id]}]};
const input={frameworkName:frame.name,scenes:[{id:'scene-live',fieldKey:'live',metricIds:[metric.id],actionIds:[action.id]}],metrics:[metric],actions:[action],goal:'按点击环比核查',scope:'演示商家',candidateFramework:frame,review:{reviewedText:frame.draftText},trialCases:[{id:'qa-week',merchantId:'qa',fieldKey:'live',period:'week',metricValues:[{id:metric.id,value:-20}]}]};
async function bundledRequest(phase){
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;assert.equal(url,'https://api.deepseek.com/responses');const request=JSON.parse(options.body);assert.equal(request.text.format.type,'json_schema');
  const output={productionDraft:{operation:'generate_framework',strategyMode:'',draftText:frame.draftText,candidateFramework:frame,candidateStrategies:[],missing:[],pipelineErrors:[]}};
  if(phase==='test')output.caseResults=[{caseId:'qa-week',summary:'点击效率回落，需要核查',branches:[{branchId:'click',assessment:'problem',title:'点击效率下降',finding:'点击率环比回落',method:'按当前框架比较点击率环比',cause:'具体原因需核查展示与讲解',causeStatus:'needs_verification',evidenceMetricIds:[metric.id],actions:[{actionId:action.id,recommendation:'对比商品点击，核查展示与讲解。'}],missing:[]}]}];
  return new Response(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(output)}]}]}));
 };
 try{
  const origin='https://qa.chatgpt.site',request=new Request(origin+'/api/aidd/generate',{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-email':'owner@example.com'},body:JSON.stringify({operation:'generate_framework',question:'部署包验收',productionInput:{...input,phase}})});
  const response=await worker.fetch(request,{COZE_ALLOWED_EMAIL:'owner@example.com',DEEPSEEK_API_KEY:'fake-only',DB:budgetDb()});const stream=await response.text();
  assert.doesNotMatch(stream,/event: error/);assert.equal(calls,1);return JSON.parse(stream.match(/event: result\ndata: ([^\n]+)/)[1]);
 }finally{globalThis.fetch=original;}
}
test('实际部署包可调用模型生成框架，不遗漏生产服务依赖',async()=>{
 const result=await bundledRequest('generate');assert.equal(result.status,'needs_review');assert.equal(result.candidate.id,frame.id);assert.equal(result.trialReport.executed,false);
});
test('实际部署包可完成框架试跑、诊断解释与行动装配，不仅源码测试通过',async()=>{
 const result=await bundledRequest('test');assert.equal(result.trialReport.schemaVersion,2);const issue=result.trialReport.cases[0].problems[0];assert.equal(issue.evidence[0].value,-20);assert.equal(issue.actions[0].id,action.id);assert.equal(result.handoff.consumerWorkflow,'Main_agent');
});
