import './build-adapter.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {parseModelUsageRecords,summarizeModelUsage} from '../shared/model-usage.js';
import {assistantMetricObservations,assistantAnswerContext,assistantGoalFactText,applyAssistantAnswerContract} from '../shared/assistant-answer-contract.js';
import {assistantConfirmedRequest} from '../shared/conversation-task.js';
import {groundAssistantModel,validateAssistantModelSafety} from '../shared/assistant-model-guard.js';
import {parseBusinessSummary,validateBusinessSummary} from '../shared/business-summary.js';
import {PROJECT_KNOWLEDGE_CARDS,projectKnowledgeQuestion} from '../shared/project-knowledge.js';
const root=fileURLToPath(new URL('./',import.meta.url));
const baseline=JSON.parse(readFileSync(root+'v13-baseline.workflow.json'));
const graph=structuredClone(baseline);
const adapter=JSON.parse(readFileSync(root+'adapter.workflow.json'));
const template=JSON.parse(readFileSync(root+'subworkflow-node-template.json'));
const stages={'110004':'understanding','310002':'explanation','410021':'repair','110009':'knowledge'};
const sha=x=>createHash('sha256').update(JSON.stringify(x??null)).digest('hex');
const changes=[];
for(const [id,stage] of Object.entries(stages)){
 const index=graph.nodes.findIndex(n=>n.id===id),old=graph.nodes[index];
 const n=structuredClone(template);n.id=old.id;n.meta=structuredClone(old.meta);
 n.data.nodeMeta={...old.data.nodeMeta,icon:template.data.nodeMeta.icon,subTitle:'工作流'};
 const parameters=structuredClone(old.data.inputs.inputParameters);
 // The four native subworkflow calls share the original typed inputs.
 for(const p of parameters) if(p.name==='history') p.input.schema=structuredClone(adapter.nodes[0].data.outputs.find(o=>o.name==='history').schema);
 n.data.inputs={workflowId:'7703982450461147170',spaceId:'7699761599875858474',workflowVersion:'v0.0.7',type:0,inputDefs:structuredClone(adapter.nodes[0].data.outputs),inputParameters:[{name:'stage',input:{type:'string',value:{type:'literal',content:stage,rawMeta:{type:1}}}},...parameters],settingOnError:structuredClone(old.data.inputs.settingOnError)};
 if(old.data.inputs.batch)n.data.inputs.batch=structuredClone(old.data.inputs.batch);
 n.data.outputs=structuredClone(old.data.outputs);
 n._temp=structuredClone(old._temp||template._temp);
 n._temp.externalData={...n._temp.externalData,...n.data.nodeMeta};
 graph.nodes[index]=n;
 changes.push({id,stage,fromType:old.type,toType:n.type,title:n.data.nodeMeta.title,inputsPreserved:parameters.map(p=>p.name),outputsPreserved:sha(n.data.outputs)===sha(old.data.outputs),batchPreserved:sha(n.data.inputs.batch)===sha(old.data.inputs.batch)});
}
assert.equal(graph.nodes.length,21);assert.equal(graph.edges.length,25);assert.deepEqual(graph.edges,baseline.edges);
const unchanged=baseline.nodes.filter(n=>!stages[n.id]);for(const n of unchanged)assert.deepEqual(graph.nodes.find(a=>a.id===n.id),n);
assert.ok(graph.nodes.every(n=>n.type!=='3'));

// Carry provider receipts through the existing branch merges. Business code
// remains the v13 function, followed by a separate metadata return value.
const usageField={name:'usageJson',type:'string',required:false};
const node=id=>graph.nodes.find(n=>n.id===id);
// Materialize verified observations and explicit goal availability before the
// model call. Compile the same response contract into initial and repair checks.
const answerContractCode=[assistantMetricObservations,assistantAnswerContext,assistantGoalFactText,applyAssistantAnswerContract,groundAssistantModel,validateAssistantModelSafety].map(fn=>fn.toString()).join('\n');
const preparationNeedle='const common={...m,summaryRequired,';
assert.ok(node('310005').data.inputs.code.includes(preparationNeedle));
node('310005').data.inputs.code=answerContractCode+'\n'+node('310005').data.inputs.code.replace(preparationNeedle,'const common={...m,answerContext:goalMode||!c.result.diagnosis.length?assistantAnswerContext(c):undefined,summaryRequired,');
for(const id of ['310004','410022']){
 const original=node(id).data.inputs.code;const end=original.indexOf('// Preparation runs only');assert.ok(end>0);node(id).data.inputs.code=parseBusinessSummary.toString()+'\n'+validateBusinessSummary.toString()+'\n'+original.slice(end);
 const needle='const result=finalizeWorkflowDiagnosis(JSON.parse(params.calculationJson),model);';
 assert.ok(node(id).data.inputs.code.includes(needle));
 node(id).data.inputs.code=answerContractCode+'\n'+node(id).data.inputs.code.replace(needle,'const calculation=JSON.parse(params.calculationJson);const verifiedModel=groundAssistantModel(calculation,model);let result=applyAssistantAnswerContract(calculation,verifiedModel,finalizeWorkflowDiagnosis(calculation,verifiedModel));const safetyErrors=validateAssistantModelSafety(calculation,verifiedModel);if(safetyErrors.length){const errors=[...new Set([...(result.quality?.errors||[]),...safetyErrors])];result={...result,status:"partial",missing:[...new Set([...(result.missing||[]),...errors])],quality:{validated:false,errors},workflow:{...result.workflow,validated:false}};}');
 const planRequirement='!clean(g.uncertainty)||!goalPlans.length';
 assert.ok(node(id).data.inputs.code.includes(planRequirement));
 node(id).data.inputs.code=node(id).data.inputs.code.replace(planRequirement,'!clean(g.uncertainty)||(!goalPlans.length&&goal.actual<goal.target)');
}
node('310005').data.inputs.code=node('310005').data.inputs.code.replace('issues:[issue],goalActions:[]','issues:[issue],grounding:common.grounding?{...common.grounding,issues:common.grounding.issues.filter(g=>g.strategyId===issue.strategyId)}:undefined,goalActions:[]');
const goalOutputSelection='outputs.find(o=>o.goalDiagnosis?.plans?.length)?.goalDiagnosis';
assert.ok(node('310004').data.inputs.code.includes(goalOutputSelection));
node('310004').data.inputs.code=node('310004').data.inputs.code.replace(goalOutputSelection,'outputs.find(o=>o.goalDiagnosis?.judgment||o.goalDiagnosis?.basis||o.goalDiagnosis?.plans?.length)?.goalDiagnosis');
// A failed first validation still returns a nonempty result. Prefer the repair
// result when that branch ran, including an honest partial result if it failed.
const resultMerge=node('110012').data.inputs.mergeGroups.find(group=>group.name==='result');
const repairIndex=resultMerge.variables.findIndex(value=>value.value.content.blockID==='410022');
assert.ok(repairIndex>=0,'The result merge must include the repair recheck');
resultMerge.variables.unshift(...resultMerge.variables.splice(repairIndex,1));
const usageRef=(blockID,name='usageJson')=>({type:'string',value:{type:'ref',content:{source:'block-output',blockID,name},rawMeta:{type:1}}});
const addUsageInput=(id,name,source)=>node(id).data.inputs.inputParameters.push({name,input:usageRef(source)});
function addUsageOutput(id,expression){
 const n=node(id);
 n.data.inputs.code=n.data.inputs.code.replace('async function main(','async function businessMain(')
  +'\n'+parseModelUsageRecords.toString()+`\nasync function main({params}: Args): Promise<Output> {
 const result=await businessMain({params});
 return {...result,usageJson:JSON.stringify(parseModelUsageRecords(${expression}))};
}`;
 n.data.outputs.push(structuredClone(usageField));
}
for(const id of Object.keys(stages)){
 const outputs=node(id).data.outputs;
 const fields=id==='310002'?outputs[0].schema.schema:outputs;
 fields.push(structuredClone(usageField));
}
addUsageOutput('410001','[]');
// Supply published project definitions to knowledge generation while retaining
// the original question for scope confirmation, routing and business analysis.
const workflowKnowledgeCards=[]; // Keep the native scope node small; scenario-specific knowledge remains a declared coverage limitation.
node('410001').data.inputs.code='const PROJECT_KNOWLEDGE_CARDS='+JSON.stringify(workflowKnowledgeCards)+';\n'+projectKnowledgeQuestion.toString()+'\n'+node('410001').data.inputs.code.replace('return {...result,usageJson:',"return {...result,knowledgeQuestion:projectKnowledgeQuestion(params.question||''),usageJson:");
node('410001').data.outputs.push({name:'knowledgeQuestion',type:'string',required:false});
node('110009').data.inputs.inputParameters.find(p=>p.name==='question').input.value.content={source:'block-output',blockID:'410001',name:'knowledgeQuestion'};
node('110001').data.inputs.code=assistantConfirmedRequest.toString()+'\n'+node('110001').data.inputs.code.replace('return confirmRequest(params)','return confirmRequest(assistantConfirmedRequest(params))');
addUsageInput('110001','usageJson','110004');
addUsageOutput('110001',"params.usageJson || {stage:'understanding',available:false}");
node('310004').data.inputs.inputParameters.find(input=>input.name==='outputs').input.schema.schema.push(structuredClone(usageField));
addUsageOutput('310004',"(params.outputs||[]).map(output=>output.usageJson || {stage:'explanation',available:false})");
addUsageInput('410022','usageJson','410021');
addUsageInput('410022','previousUsageJson','310004');
addUsageOutput('410022',"[params.previousUsageJson,params.usageJson || {stage:'repair',available:false}]");
for(const [id,sources] of [['410003',['110001','410001']],['110012',['410022','310004','110009','410001']]]){
 node(id).data.inputs.mergeGroups.push({name:'usageJson',variables:sources.map(source=>usageRef(source))});
 node(id).data.outputs.push(structuredClone(usageField));
}
addUsageInput('110013','usageJson','110012');
addUsageInput('110013','scopeUsageJson','410003');
node('110013').data.inputs.code=parseModelUsageRecords.toString()+'\n'+summarizeModelUsage.toString()+`
async function main({params}: Args): Promise<Output> {
 const usage=summarizeModelUsage([params.scopeUsageJson,params.usageJson]);
 return {result:{...params.result,modelUsageJson:JSON.stringify(usage)}};
}`;
node('110013').data.outputs[0].schema.push({name:'modelUsageJson',type:'string'});
node('900001').data.inputs.inputParameters[0].input.schema=structuredClone(node('110013').data.outputs[0].schema);
const usageNodes=['410001','110001','310004','410022','410003','110012','110013','900001'];
const answerContractNodes=['310005','310004','410022'];
const xs=graph.nodes.map(n=>n.meta.position.x),ys=graph.nodes.map(n=>n.meta.position.y);
const clip={type:'coze-workflow-clipboard-data',source:{workflowId:'7699762508375294003',flowMode:0,spaceId:'7699761599875858474',isDouyin:false,host:'www.coze.cn'},json:graph,bounds:{x:Math.min(...xs)-180,y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs)+360,height:Math.max(...ys)-Math.min(...ys)+450}};
const audit={baseline:'Coze v0.0.13 / git 7ee2294',mainNodes:21,mainEdges:25,unchangedNodes:unchanged.filter(n=>!usageNodes.includes(n.id)&&!answerContractNodes.includes(n.id)).map(n=>({id:n.id,title:n.data.nodeMeta.title,sha256:sha(n)})),usageMetadataNodes:usageNodes,answerContractNodes,answerContractRevision:'diagnosis-v6-grounded-facts-and-action-gate',changes,edgesSha256:sha(graph.edges),hostedModelNodeCount:0,adapterWorkflowId:'7703982450461147170',adapterVersion:'v0.0.7',adapterStageVersions:{understanding:'v0.0.6',explanation:'v0.0.6',repair:'v0.0.6',knowledge:'v0.0.6'},runtimeModelBlockingCodeAdded:false};
writeFileSync(root+'main.workflow.json',JSON.stringify(graph,null,2)+'\n');
writeFileSync(root+'main.clipboard.json',JSON.stringify(clip));
writeFileSync(root+'model-safety-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({nodes:21,edges:25,unchangedNodes:audit.unchangedNodes.length,usageMetadataNodes:usageNodes,changes,clipboardBytes:JSON.stringify(clip).length}));
