import {productionMaterials} from './production-contract.js';
import {configuredProductionDraft,productionStageResult} from './aidd-production-runtime.js';
import {AIDD_PRODUCTION_MODELS} from './aidd-production-models.js';
import {requestAiddModel} from './aidd-model.js';
import {sharedStrategy} from '../shared/strategy-scope.js';
import {aiddModelMaterials,aiddGenerationSchema,adaptAiddProductionDraft} from './aidd-generation-contract.js';
import {FRAMEWORK_TRIAL_SYSTEM_PROMPT,frameworkTrialSchema,frameworkTrialMaterials,buildFrameworkTrialReport} from './framework-trial.js';

const MAIN_WORKFLOW_ID='7699762508375294003';
export function aiddModelConfigured(env){return typeof env.DEEPSEEK_API_KEY==='string'&&!!env.DEEPSEEK_API_KEY.trim();}
export async function produceAiddAsset(body,env,{signal,onProgress=()=>{},fetchModel=fetch}={}){
 const startedAt=Date.now(),id=crypto.randomUUID();let modelUsage;
 const receipt=(status)=>({schemaVersion:1,id,operation:body.operation,phase:body.productionInput?.phase||'generate',status,startedAt:new Date(startedAt).toISOString(),completedAt:new Date().toISOString(),durationMs:Date.now()-startedAt,cozeTokens:0,modelUsage:modelUsage||{provider:'DeepSeek',available:true,callCount:0,tokens:0,inputTokens:0,outputTokens:0,calls:[]}});
 try{
  const result=await produceAiddAssetResult(body,env,{signal,onProgress,fetchModel,onModelUsage:usage=>{modelUsage=usage;}});
  return {...result,productionUsage:{...receipt('completed'),assetCount:Array.isArray(result.candidate)?result.candidate.length:1}};
 }catch(error){modelUsage=error.modelUsage||modelUsage;error.productionUsage=receipt('failed');throw error;}
}
async function produceAiddAssetResult(body,env,{signal,onProgress,fetchModel,onModelUsage}){
 const materials=productionMaterials({...body.productionInput,operation:body.operation});
 materials.candidateStrategies=materials.candidateStrategies.map(sharedStrategy);materials.manualStrategies=materials.manualStrategies.map(sharedStrategy);
 let productionDraft;
 let modelUsage,caseResults;
 const isFrameworkTrial=materials.operation==='generate_framework'&&materials.phase==='test'&&!materials.inputErrors.length;
 const trialInput=isFrameworkTrial?frameworkTrialMaterials(materials):null;
 if(isFrameworkTrial&&!trialInput.reviewedText)throw new Error('请先提供当前诊断框架正文。');
 const model=isFrameworkTrial?{systemPrompt:FRAMEWORK_TRIAL_SYSTEM_PROMPT,maxTokens:8192}:AIDD_PRODUCTION_MODELS[materials.operation==='generate_framework'&&materials.route==='parse'?'frameworkParse':materials.route];
 if(model){
  if(!aiddModelConfigured(env))throw new Error('AIDD 的 DeepSeek 模型通道尚未配置，请由管理员配置服务端 API Key。');
  onProgress(isFrameworkTrial?'正在按当前框架分析所选商家与周期':materials.route==='parse'?'正在解析本次审核稿':'正在调用 AI 模型生成本次候选');
  const modelMaterials=aiddModelMaterials(materials);
  const prompt=isFrameworkTrial?JSON.stringify({...trialInput,scenes:modelMaterials.scenes,metrics:modelMaterials.metrics,actions:modelMaterials.actions,
   ...(materials.parsed?{parsedFramework:{branches:materials.candidateFramework.branches}}:{}),
   cases:trialInput.cases.map(c=>({...c,metricValues:c.metricValues.map(m=>({id:m.id,value:m.value,...(Number.isFinite(m.previousValue)?{previousValue:m.previousValue}:{}),...(Number.isFinite(m.comparisonChange)?{comparisonChange:m.comparisonChange}:{}),...(m.currentValues.length?{currentValues:m.currentValues}:{})}))}))
  }):model.prompt.replace(/\{\{(\w+)\}\}/g,(_,name)=>typeof modelMaterials[name]==='string'?modelMaterials[name]:JSON.stringify(modelMaterials[name]??null));
  const protocol=aiddGenerationSchema(materials,isFrameworkTrial?frameworkTrialSchema(materials):undefined);
  const format={type:'json_schema',name:isFrameworkTrial?'aidd_framework_trial':materials.operation==='generate_framework'?'aidd_framework':'aidd_strategy',schema:protocol};
  const outputInstructions=materials.operation==='generate_framework'
   ?'仅按本次Schema返回productionDraft。框架正文只在draftText输出一次，审核解析与试跑不返回正文；candidateFramework仅返回branches。编号、名称、版本、operation与空列表由服务端补齐。'
   :'仅按本次Schema返回productionDraft。candidateStrategies只生成业务字段；不要生成draftText，服务端从同一份结构生成可编辑正文。指标比较使用rightType=metric、已选rightMetricId及明确factor；不使用rightNumber。数值阈值使用rightType=value及value。条件组只输出join和children。身份、状态、适用范围、执行方式由服务端补齐。';
  const input=prompt+'\n\n'+(isFrameworkTrial?'按响应 Schema 输出 productionDraft 和 caseResults；已解析框架只返回逐方向诊断，保留审核原文的规则、缺口和行动边界。':outputInstructions)+'\n只返回完整JSON，不要Markdown、注释、尾逗号或额外说明。'+(isFrameworkTrial?'':'字段与类型严格按以下JSON Schema：\n'+JSON.stringify(protocol));
  const response=await requestAiddModel({env,systemPrompt:model.systemPrompt,input,format,...(isFrameworkTrial?{retrySchema:protocol}:{}),maxTokens:model.maxTokens+2048,reasoningEffort:isFrameworkTrial?'none':'low',operation:materials.operation,phase:materials.phase,route:isFrameworkTrial?'framework_trial':materials.route,signal,fetchModel,
   validateResult:parsed=>adaptAiddProductionDraft(parsed,materials,trialInput),onRetry:()=>onProgress('正在按原始输入修复响应协议，草稿与所选案例已保留')});
  modelUsage=response.modelUsage;onModelUsage(modelUsage);caseResults=response.parsed.caseResults;productionDraft=response.parsed.productionDraft;
 }else productionDraft=configuredProductionDraft(materials).productionDraft;
 productionDraft.candidateStrategies=productionDraft.candidateStrategies.map(sharedStrategy);
 onProgress(isFrameworkTrial?'正在整理问题、原因和行动建议':materials.phase==='test'?'正在按原规则执行所选案例':'正在按原规则组织本阶段产物');
 const result=productionStageResult({...materials,productionDraft}).productionResult;
 if(isFrameworkTrial&&result.trialReport.executed){result.trialReport=buildFrameworkTrialReport(materials,result,caseResults);result.answer='已按当前诊断框架完成所选商家周期的诊断，请人工审核问题、指标、原因和行动建议。';}
 // Only the producer/consumer addresses change when the workflows are retired.
 const handoff={...result.handoff,producerWorkflow:'AIDD后台',consumerWorkflow:'Main_agent',consumerWorkflowId:MAIN_WORKFLOW_ID};
 return {...result,schemaVersion:1,handoff,releasePlan:{...result.releasePlan,consumerWorkflow:'Main_agent'},...(modelUsage?{modelUsage}:{}),candidate:result.operation==='generate_framework'?result.candidateFramework:result.candidateStrategies};
}
export function runAiddProduction(request,env,body){
 const encoder=new TextEncoder(),abort=new AbortController();let closed=false;
 request.signal.addEventListener('abort',()=>abort.abort(),{once:true});
 const stream=new ReadableStream({async start(controller){
  const send=(event,data)=>{if(!closed)controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));};
  const timer=setTimeout(()=>abort.abort(),180000);
  try{
   send('progress',{stage:'正在处理 AIDD 后台生产请求',step:'connecting'});
   const result=await produceAiddAsset(body,env,{signal:abort.signal,onProgress:stage=>send('progress',{stage,step:'processing'})});
   send('result',result);
  }catch(error){
   const unexpected=error instanceof ReferenceError||error instanceof TypeError;
   if(unexpected)console.error('AIDD后台处理异常',{type:error.name,operation:body.operation});
   if(!closed)send('error',{error:abort.signal.aborted?'AIDD 生产请求已中止或超时，原有资产未修改。':unexpected?'本次处理未完成，草稿已保留，请稍后重试。':error.message,code:'AIDD_PRODUCTION_FAILED',...(error.productionUsage?{productionUsage:error.productionUsage}:{})});
  }
  finally{clearTimeout(timer);if(!closed){closed=true;controller.close();}}
 },cancel(){closed=true;abort.abort();}});
 return new Response(stream,{headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-store, no-transform','x-content-type-options':'nosniff','x-accel-buffering':'no'}});
}
