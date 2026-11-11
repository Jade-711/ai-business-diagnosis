import {normalizeProductionRule,productionRuleMetricIds,validateProductionRule} from '../shared/production-rules.js';

const aiddContractObject=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const aiddContractText={type:'string'};
const aiddContractTexts={type:'array',items:aiddContractText};
const aiddContractIds=values=>({type:'array',items:{type:'string',...(values.length?{enum:values}:{})},...(!values.length?{maxItems:0}:{})});
const aiddPick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
function aiddModelMetric(metric){
 // Strip provenance metadata, keeping definitions and every business constraint.
 const {provenance,updatedAt,source,sourceField,table,conditionId,sourceKey,...value}=metric;
 if(value.description)value.description=value.description.replace(/https?:\/\/[^\s）)]+/g,'');
 const evidence=provenance?.evidence||provenance?.basis;if(evidence)value.definitionEvidence=evidence;
 return value;
}
export function aiddModelMaterials(materials){
 const metricIds=new Set(materials.metrics.map(item=>item.id)),actionIds=new Set(materials.actions.map(item=>item.id));
 const action=value=>{
  const next=aiddPick(value,['id','name','executionName','purpose','description','subtitle','conditions','exclusions','metricIds']);
  if(next.executionName===next.name)delete next.executionName;
  if(next.subtitle===next.description)delete next.subtitle;
  if(next.metricIds)next.metricIds=next.metricIds.filter(id=>metricIds.has(id));return next;
 };
 const source=materials.sourceFramework||{};
 const framework=aiddPick(source,['id','name','sceneId','version','active','goal','scope','text','draftText','decomposition','drilldown','businessBoundary','requiredEvidence','missingMetricOrEvidence']);
 if(framework.text&&framework.text===framework.draftText)delete framework.draftText;
 framework.branches=(source.branches||[]).map(branch=>({...aiddPick(branch,['id','name','meaning','priority','minimumProblems','requiredEvidence','missingMetricOrEvidence']),metricIds:(branch.metricIds||[]).filter(id=>metricIds.has(id)),actionIds:(branch.actionIds||[]).filter(id=>actionIds.has(id))})).filter(branch=>branch.metricIds.length);
 return {...materials,metrics:materials.metrics.map(aiddModelMetric),actions:materials.actions.map(action),sourceFramework:framework,
  scenes:materials.scenes.map(scene=>({...aiddPick(scene,['id','name','fieldKey','goal','merchantScope','level','parentId','priority','requiredEvidence']),metricIds:(scene.metricIds||[]).filter(id=>metricIds.has(id)),actionIds:(scene.actionIds||[]).filter(id=>actionIds.has(id))})),
  candidateFramework:aiddPick(materials.candidateFramework,['id','name','sceneId','version']),
  candidateStrategies:materials.candidateStrategies.map(candidate=>aiddPick(candidate,['id','name','sceneId','frameworkId','frameworkVersion']))};
}
function aiddProductionRuleSchema(metricIds,depth=0){
 const common={metricId:{type:'string',enum:metricIds},op:{type:'string',enum:['<','<=','>','>=','==','!=']}};
 const optional={leftTransform:{type:'string',enum:['value','previous','mean','peerMean','sameLevelMean','median']},leftCalc:{type:'string',enum:['none','+','-','*','/']},leftNumber:{type:'number'}};
 const literal={type:'object',properties:{...common,rightType:{type:'string',enum:['value']},value:{type:'number'},...optional},required:['metricId','op','rightType','value'],additionalProperties:false};
 const comparison={type:'object',properties:{...common,rightType:{type:'string',enum:['metric']},rightMetricId:{type:'string',enum:metricIds},factor:{type:'number'},rightTransform:optional.leftTransform,rightCalc:optional.leftCalc,...optional},required:['metricId','op','rightType','rightMetricId','factor'],additionalProperties:false};
 const types=[literal,comparison];
 if(depth<2)types.push(aiddContractObject({join:{type:'string',enum:['AND','OR']},children:{type:'array',minItems:1,items:aiddProductionRuleSchema(metricIds,depth+1)}}));
 return {anyOf:types};
}
export function aiddGenerationSchema(materials,caseSchema){
 const metricIds=materials.metrics.map(item=>item.id),actionIds=materials.actions.map(item=>item.id);
 let draft;
 if(materials.operation==='generate_framework'){
  const branches={type:'array',maxItems:10,items:aiddContractObject({id:aiddContractText,name:aiddContractText,meaning:aiddContractText,metricIds:aiddContractIds(metricIds),actionIds:aiddContractIds(actionIds),priority:{type:'integer',enum:[0,1,2]}})};
  draft=aiddContractObject({...(materials.phase==='generate'?{draftText:aiddContractText}:{}),...(caseSchema&&materials.parsed?{}:{candidateFramework:aiddContractObject({branches})}),missing:aiddContractTexts,pipelineErrors:aiddContractTexts});
 }else{
  const branchIds=(materials.sourceFramework.branches||[]).filter(branch=>(branch.metricIds||[]).some(id=>metricIds.includes(id))).map(branch=>branch.id);
  const content=materials.strategyMode==='content';
  const fields={name:aiddContractText,branchIds:aiddContractIds(branchIds),priority:{type:'integer',minimum:1,maximum:999},actionIds:aiddContractIds(actionIds),actionTrigger:{type:'string',enum:['match','mismatch']},businessMeaning:aiddContractText,thresholdBasis:aiddContractText,exceptionHandling:aiddContractText,pendingItems:aiddContractTexts,
   ...(content?{contentObjects:aiddContractIds(materials.metrics.filter(item=>['String','Image'].includes(item.dataType)).map(item=>item.name)),contentPrompt:aiddContractText}:{rule:aiddProductionRuleSchema(metricIds)})};
  draft=aiddContractObject({candidateStrategies:{type:'array',maxItems:3,items:aiddContractObject(fields)},missing:aiddContractTexts,pipelineErrors:aiddContractTexts});
 }
 return aiddContractObject({productionDraft:draft,...(caseSchema?{caseResults:caseSchema}:{})});
}
function aiddContractError(message){const error=new Error(message);error.code='AIDD_MODEL_INVALID_PROTOCOL';throw error;}
function aiddStrategyRuleText(rule,metrics){
 if(rule.children?.length)return '('+rule.children.map(item=>aiddStrategyRuleText(item,metrics)).join(rule.join==='OR'?' 或 ':' 且 ')+')';
 const operand=(id,transform,calc,number)=>{
  let label=metrics.find(metric=>metric.id===id)?.name||id;
  const suffix={previous:'前周期值',mean:'本周期均值',peerMean:'同行均值',sameLevelMean:'同行同等级均值',median:'P50分位值'}[transform];if(suffix)label+='［'+suffix+'］';
  return calc&&calc!=='none'?'('+label+' '+calc+' '+number+')':label;
 };
 return operand(rule.metricId,rule.leftTransform,rule.leftCalc,rule.leftNumber)+' '+rule.op+' '+(rule.rightType==='metric'?operand(rule.rightMetricId,rule.rightTransform,rule.rightCalc||'*',rule.factor):rule.value);
}
export function aiddStrategyDraftText(strategies,materials){
 return strategies.map(strategy=>`策略名称：${strategy.name}\n优先级：${strategy.priority}\n关联诊断方向：${strategy.branchIds.map(id=>{const branch=materials.sourceFramework.branches?.find(item=>item.id===id);return (branch?.name||id)+'（'+id+'）';}).join('、')||'未关联，需人工确认'}\n业务含义：${strategy.businessMeaning||''}\n适用范围：${strategy.merchantScope}\n${strategy.execution==='模型理解'?'内容对象：'+strategy.contentObjects.join('、')+'\n内容判断标准：'+strategy.contentPrompt:'指标规则：'+aiddStrategyRuleText(strategy.rule,materials.metrics)}\n触发依据：${strategy.thresholdBasis||''}\n输出行动点条件：${strategy.actionTrigger==='mismatch'?'规则不满足时':'规则满足时'}\n关联行动：${strategy.actionIds.map(id=>{const action=materials.actions.find(item=>item.id===id);return (action?.name||id)+'（'+id+'）';}).join('、')||'未关联，需人工确认'}\n异常处理：${strategy.exceptionHandling||''}\n待补项：${strategy.pendingItems.join('；')||'无'}\n审核状态：待审核`).join('\n\n');
}
export function adaptAiddProductionDraft(parsed,materials,trialInput){
 const raw=parsed?.productionDraft;
 if(!raw||!Array.isArray(raw.missing)||!Array.isArray(raw.pipelineErrors))aiddContractError('DeepSeek 候选不符合原生产协议，缺少完整草稿与待补项。');
 if(raw.pipelineErrors.length)return {...parsed,productionDraft:{operation:materials.operation,strategyMode:materials.strategyMode,draftText:materials.review.reviewedText||raw.draftText||'',candidateFramework:{},candidateStrategies:[],missing:raw.missing,pipelineErrors:raw.pipelineErrors}};
 const metricIds=materials.metrics.map(item=>item.id),actionIds=materials.actions.map(item=>item.id),scene=materials.scenes[0];
 const reference=(id,assets)=>typeof id!=='string'||!id?id:assets.some(item=>item.id===id)?id:assets.filter(item=>typeof item.code==='string'&&item.code===id).length===1?assets.find(item=>item.code===id).id:id;
 if(materials.operation==='generate_framework'){
  const frame=trialInput&&materials.parsed?materials.candidateFramework:raw.candidateFramework,identity=trialInput?.frameworkIdentity||(materials.phase==='generate'?materials.sourceFramework:materials.candidateFramework);
  const text=materials.phase==='generate'?(raw.draftText||frame?.draftText):trialInput?.reviewedText||materials.review.reviewedText;
  if(!frame||!Array.isArray(frame.branches)||!frame.branches.length||frame.branches.length>10||!String(text||'').trim())aiddContractError('DeepSeek 候选不符合原生产协议，框架正文或诊断方向不完整。');
  const branches=frame.branches.map(branch=>({...branch,metricIds:(branch.metricIds||[]).map(id=>reference(id,materials.metrics)),actionIds:(branch.actionIds||[]).map(id=>reference(id,materials.actions))}));
  if(branches.some(branch=>!String(branch.id||'').trim()||!String(branch.name||'').trim()||!String(branch.meaning||'').trim()||!branch.metricIds.length||branch.metricIds.some(id=>!metricIds.includes(id))||branch.actionIds.some(id=>!actionIds.includes(id))))aiddContractError('框架引用了未选择的指标或行动，或诊断方向信息不完整。');
  if(new Set(branches.map(branch=>branch.id)).size!==branches.length)aiddContractError('框架诊断方向编号必须唯一。');
  const caseResults=trialInput&&Array.isArray(parsed.caseResults)?parsed.caseResults.map(c=>({...c,branches:Array.isArray(c.branches)?c.branches.map(b=>({...b,evidenceMetricIds:Array.isArray(b.evidenceMetricIds)?b.evidenceMetricIds.map(id=>reference(id,materials.metrics)):b.evidenceMetricIds,actions:Array.isArray(b.actions)?b.actions.map(a=>({...a,actionId:reference(a.actionId,materials.actions)})):b.actions})):c.branches})):parsed.caseResults;
  return {...parsed,...(trialInput?{caseResults}:{}),productionDraft:{operation:materials.operation,strategyMode:'',draftText:text,candidateFramework:{...identity,id:identity.id||frame.id||'framework-'+crypto.randomUUID(),name:materials.frameworkName||identity.name,sceneId:scene.id,version:identity.version||1,draftText:text,branches},candidateStrategies:[],missing:raw.missing,pipelineErrors:raw.pipelineErrors}};
 }
 if(!Array.isArray(raw.candidateStrategies)||!raw.candidateStrategies.length||raw.candidateStrategies.length>3)aiddContractError('DeepSeek 候选不符合原生产协议，需返回一至三条完整策略。');
 if(materials.phase!=='generate'&&materials.candidateStrategies.length&&raw.candidateStrategies.length!==materials.candidateStrategies.length)aiddContractError('请只解析本次审核的策略，不能新增或遗漏策略。');
 const branches=materials.sourceFramework.branches||[],content=materials.strategyMode==='content';
 const strategies=raw.candidateStrategies.map((item,index)=>{
  const actionRefs=(item.actionIds||[]).map(id=>reference(id,materials.actions));
  if(actionRefs.some(id=>!actionIds.includes(id)))aiddContractError('候选引用了未选择的行动点。');
  const rule=content?null:normalizeProductionRule(item.rule);
  if(!content){const error=validateProductionRule(rule,materials.metrics,metricIds);if(error)aiddContractError(error);}
  const selectedMetricIds=content?materials.metrics.filter(metric=>(item.contentObjects||[]).includes(metric.name)).map(metric=>metric.id):productionRuleMetricIds(rule);
  if(!selectedMetricIds.length||selectedMetricIds.some(id=>!metricIds.includes(id)))aiddContractError('候选引用了未选择的指标。');
  if(content&&(!String(item.contentPrompt||'').trim()||(item.contentObjects||[]).some(name=>!materials.metrics.some(metric=>metric.name===name&&['String','Image'].includes(metric.dataType)))))aiddContractError('内容判断标准或所选内容对象不完整。');
  const branchRefs=item.branchIds?.length?item.branchIds:branches.filter(branch=>(branch.metricIds||[]).some(id=>selectedMetricIds.includes(id))).map(branch=>branch.id);
  if(branchRefs.some(id=>!branches.some(branch=>branch.id===id)))aiddContractError('候选引用了未提供的框架分支。');
  if(!String(item.name||'').trim()||!String(item.businessMeaning||'').trim()||!String(item.thresholdBasis||'').trim()||!String(item.exceptionHandling||'').trim()||!Array.isArray(item.pendingItems))aiddContractError('策略缺少名称、业务含义、阈值依据、异常处理或待补项。');
  if(item.actionTrigger&&!['match','mismatch'].includes(item.actionTrigger))aiddContractError('行动触发条件只支持规则满足或不满足。');
  const previous=materials.phase!=='generate'?materials.candidateStrategies[index]:null;
  return {...item,id:previous?.id||item.id||'strategy-'+crypto.randomUUID(),sceneId:scene.id,frameworkId:materials.sourceFramework.id,frameworkVersion:materials.sourceFramework.version,branchIds:branchRefs,merchantScope:materials.scope,metricIds:selectedMetricIds,actionIds:actionRefs,rule,status:'待生效',enabled:false,sourceWorkflow:'AIDD_Production',execution:content?'模型理解':'指标规则',actionTrigger:item.actionTrigger||previous?.actionTrigger||'match',priority:item.priority||index+1};
 });
 const text=materials.phase!=='generate'?materials.review.reviewedText:raw.draftText||aiddStrategyDraftText(strategies,materials);
 return {...parsed,productionDraft:{operation:materials.operation,strategyMode:materials.strategyMode,draftText:text,candidateFramework:{},candidateStrategies:strategies,missing:raw.missing,pipelineErrors:raw.pipelineErrors}};
}
