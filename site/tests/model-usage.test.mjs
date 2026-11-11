import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {summarizeModelUsage} from '../shared/model-usage.js';
import {prepareWorkflowDiagnosis} from '../shared/workflow-diagnosis.js';
const graph=JSON.parse(readFileSync(new URL('../workflow/main.workflow.json',import.meta.url)));
const receipt=(stage,id,input=100,output=40,reasoning=10)=>({stage,responseId:id,model:'deepseek-flash',reasoningEffort:stage==='understanding'?'low':'none',inputTokens:input,outputTokens:output,totalTokens:input+output,cachedInputTokens:20,reasoningTokens:reasoning});
async function execute(id,params){const code=graph.nodes.find(n=>n.id===id).data.inputs.code.replace(/: Args/g,'').replace(/: Promise<Output>/g,'');const c=vm.createContext({URL});vm.runInContext(code,c);return JSON.parse(JSON.stringify(await c.main({params})));}
test('逐调用回执去重，缓存与推理分别包含在输入与输出中',()=>{
 const a=receipt('understanding','scope'),b=receipt('explanation','issue-1',200,80,0);
 const result=summarizeModelUsage([JSON.stringify([a,b]),a]);
 assert.equal(result.callCount,2);assert.equal(result.inputTokens,300);assert.equal(result.outputTokens,120);assert.equal(result.totalTokens,420);assert.equal(result.cachedInputTokens,40);assert.equal(result.reasoningTokens,10);
 assert.deepEqual(result.calls.map(c=>c.nodeId),['110004','310002']);
});
test('未返回或矛盾的用量明确不完整，不能显示成零消耗',()=>{
 for(const missing of [{stage:'repair',available:false},{...receipt('repair','bad'),totalTokens:999},{...receipt('repair','bad'),reasoningTokens:41}]){
  const result=summarizeModelUsage([receipt('explanation','ok'),missing]);assert.equal(result.complete,false);assert.equal(result.totalTokens,undefined);assert.equal(result.calls[1].available,false);
 }
 assert.deepEqual(summarizeModelUsage([]).calls,[]);assert.equal(summarizeModelUsage([]).totalTokens,0);
});
test('三路解释、一次补全与范围识别通过原有汇合节点交付五次真实用量',async()=>{
 const catalog=JSON.parse(readFileSync(new URL('../worker/demo-catalog.json',import.meta.url)));
 const p=catalog['video:week'],question='分析近7天短视频-曝光',context={sellerId:'DEMO_10001',fieldKey:'video',period:'week',requestId:'demo'};
 const calculated=prepareWorkflowDiagnosis({question,context,configuration:p.config,data:p.data});
 const outputs=[1,2,3].map(i=>({summary:'用于用量交付核查的回答',explanations:[],goalDiagnosis:{},usageJson:JSON.stringify(receipt('explanation','issue-'+i))}));
 const first=await execute('310004',{calculationJson:JSON.stringify(calculated),outputs});
 assert.equal(JSON.parse(first.usageJson).length,3);
 const repaired=await execute('410022',{calculationJson:JSON.stringify(calculated),summary:'用量复核',explanations:[],goalDiagnosis:{},previousUsageJson:first.usageJson,usageJson:JSON.stringify(receipt('repair','repair'))});
 const final=await execute('110013',{result:repaired.result,scopeUsageJson:JSON.stringify(receipt('understanding','scope')),usageJson:repaired.usageJson});
 const usage=JSON.parse(final.result.modelUsageJson);assert.equal(usage.callCount,5);assert.equal(usage.totalTokens,700);assert.equal(usage.calls[4].stage,'repair');assert.equal(usage.calls[4].callIndex,1);
 const quick=await execute('110013',{result:{branch:'data',answer:'10'},scopeUsageJson:'[]',usageJson:'[]'});assert.equal(JSON.parse(quick.result.modelUsageJson).totalTokens,0);assert.equal(quick.result.answer,'10');
});
