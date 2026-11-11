'use strict';

const AIDD_STORAGE='workflow-lab-aidd-builder-v2';
let aiddData;
const aiddUI={section:'framework',sceneId:'scene-live',assetTab:'metrics',query:'',status:'all',candidate:null,editing:null,frameView:'list',frameId:null,frameEditing:null};
const AIDD_SECTIONS={scenes:['场景管理','定义业务问题与场景边界，关联可用指标和行动点','flow'],metrics:['指标管理','维护取数条件组、指标口径与衍生指标','data'],actions:['行动点管理','维护商家可承接的动作、跳转信息与改善指标','target'],framework:['诊断框架生产','填写场景输入，审核草稿与案例报告，再确认校验和灰度发布','layers'],strategies:['诊断策略生产','统一管理各场景策略，配置诊断规则、内容标准与行动建议','spark']};
const aiddId=prefix=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const aiddNow=()=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
function seedAidd(){
 const metrics=[],actions=[],scenes=[];
 const groupIds={};
 for(const [key,field] of Object.entries(MERCHANT_FIELDS)){
  groupIds[key]=`condition-${key}`;
  const metricIds=[];
  for(const [metricKey,metric] of Object.entries(field.metrics)){
   for(const derived of ['value','change']){
    const id=`${key}-${metricKey}-${derived}`;metricIds.push(id);
    metrics.push({id,code:`DEMO_${key}_${metricKey}_${derived}`.toUpperCase(),name:`${field.name}${metric.label}${derived==='change'?'环比变化':''}`,fieldKey:key,metricKey,derived,unit:derived==='change'?'%':metric.unit,dataType:'Double',source:'AiDS',table:`demo_${key}_business`,sourceField:metricKey,conditionId:groupIds[key],description:`${field.name}同周期、同归因范围的${metric.label}${derived==='change'?'环比变化':''}。`,derivations:['环比','均值'],updatedAt:'2026/10/21 16:00'});
   }
  }
  const actionIds=[];
  for(const [index,issue] of (field.issues||[{metric:'gmv',action:'对照各场域成交与目标差距',advice:'优先核查目标差距较大的场域，再安排经营资源。'},{metric:'payRate',action:'核查全店商品成交承接',advice:'按场域和商品对比支付表现，再核对库存与商品信息。'}]).entries()){
   const id=`action-${key}-${index}`;actionIds.push(id);
   actions.push({id,code:`DEMO_ACTION_${key}_${index}`.toUpperCase(),name:issue.action,executionName:issue.action,type:'展示型',category:'经营检查',priority:index+1,description:issue.advice,subtitle:issue.advice,fieldKey:key,metricIds:[`${key}-${issue.metric}-value`],pcLink:'',mobileLink:'',conditions:'需要取得对应经营数据和操作权限',exclusions:'已完成或当前不适用的动作应排除',updatedAt:'2026/10/21 16:00'});
  }
  if(key==='live'){
   for(const [id,name,dataType,sourceField] of [['live-image','商品主图','Image','itemImageUrl'],['live-title','商品名称','String','itemTitle']]){metricIds.push(id);metrics.push({id,name,code:'DEMO_'+id.replaceAll('-','_').toUpperCase(),fieldKey:'live',metricKey:'content',derived:'value',unit:'内容',dataType,source:'RPC',table:'demo_item_info_service',sourceField,conditionId:groupIds.live,description:'仅维护内容取数配置，实际内容服务未接入。',derivations:[],updatedAt:'2026/10/21 16:00'});}
   for(const [name,metricKey] of [['检查流量渠道与开播安排','exposure'],['完善商品主图与标题','clickRate']]){
    const id=aiddId('action');actionIds.push(id);actions.push({id,code:name.startsWith('完善')?'DEMO_CONTENT_CHECK':'DEMO_TRAFFIC_CHECK',name,executionName:name,type:'展示型',category:'经营检查',priority:3,description:'结合商品和经营记录进一步核查。',subtitle:'结合具体证据确认后再调整。',fieldKey:key,metricIds:[`${key}-${metricKey}-value`],pcLink:'',mobileLink:'',conditions:'具备对应商品和经营数据',exclusions:'已完成的动作',updatedAt:'2026/10/21 16:00'});
   }
  }
  scenes.push({id:`scene-${key}`,name:`${field.name}经营诊断`,code:`DEMO_SCENE_${key}`.toUpperCase(),fieldKey:key,level:key==='overview'?'全店':'场域',parentId:key==='overview'?'':'scene-overview',description:field.intro,goal:`识别${field.name}经营的关键异常环节并关联行动建议`,owner:'产品运营',merchantScope:'跃迁期商家',status:key==='live'?'生效中':'待生效',metricIds,actionIds,createdAt:'2026/10/21 16:00',updatedAt:'2026/10/21 16:00',version:1});
 }
 const live=scenes.find(x=>x.fieldKey==='live');live.name='直播成交诊断';
 const conditions=Object.entries(MERCHANT_FIELDS).map(([key,field])=>({id:groupIds[key],code:`DEMO_CONDITION_${key}`.toUpperCase(),name:`${field.name}经营取数条件`,source:'AiDS',table:`demo_${key}_business`,period:'近7天',startOffset:-7,endOffset:-1,contextField:'sellerId',updatedAt:'2026/10/21 16:00'}));
 const groups=[...new Set(state.draft.strategies.map(s=>s.group))].map((name,i)=>({id:`group-live-${i}`,sceneId:live.id,name,mode:'策略优先级执行',period:'week',tags:'跃迁期,直播型',prompt:'根据当前场景指标和业务目标组织诊断，优先保留证据充分、可行动的问题。',priority:i+1}));
 const strategyFromLegacy=(s,index)=>{
  const map={click_drop:'clickRate',exposure_drop:'exposure',payment_drop:'payRate'},metricKey=map[s.metric]||'clickRate';
  const action=actions.find(a=>a.name===s.action&&a.fieldKey==='live');
  return {...s,sceneId:live.id,groupId:groups.find(g=>g.name===s.group)?.id||groups[0].id,description:s.note||'同口径对比经营指标，定位异常环节；具体原因需要进一步证据。',businessMeaning:s.name,merchantScope:'跃迁期,直播型',period:'week',priority:index+1,status:s.enabled?'生效中':'待生效',version:1,actionIds:action?[action.id]:[],actionSubtitles:action?{[action.id]:action.subtitle}:{},actionTrigger:'match',rule:{join:'AND',children:[{metricId:'live-exposure-value',op:'>=',rightType:'number',value:Number(s.minExposure),factor:1},{metricId:`live-${metricKey}-change`,op:s.operator,rightType:'number',value:Number(s.threshold),factor:1}]},contentObjects:['商品主图','商品名称'],contentJudgment:'不符合',contentPrompt:'检查图片清晰度、商品表达和标题信息是否一致；证据不足时返回无法判断。',createdAt:'2026/10/21 16:00',updatedAt:'2026/10/21 16:00'};
 };
 const strategies=state.draft.strategies.map(strategyFromLegacy);
 const frameworks=scenes.map(scene=>({sceneId:scene.id,name:`${scene.name}分析框架`,goal:scene.goal,knowledge:'统一周期、人群及归因口径。指标用于定位经营环节，具体原因需补充商品、内容及经营证据。',logic:scene.fieldKey==='live'?'先判断商品曝光规模，再检查点击效率与支付效率；结合商品信息进一步核查原因。':'先查看成交变化，再按场域核心指标定位环节；不使用未配置指标。',priority:'证据充分优先；同等证据下按影响与可行动性排序。',maxDepth:4,prompt:scene.fieldKey==='live'?state.draft.framework:'只使用场景关联的指标和行动点，先明确指标关系，再形成异常模式与下钻路径。',branches:metrics.filter(metric=>scene.metricIds.includes(metric.id)&&metric.derived==='value'&&metric.metricKey!=='gmv'&&!['String','Image'].includes(metric.dataType)).slice(0,4).map((metric,index)=>({name:metric.name+'分析',meaning:'对照同口径变化，定位需要核查的经营环节。',metricIds:[metric.id],actionIds:scene.actionIds.filter(id=>actions.find(action=>action.id===id)?.metricIds.includes(metric.id)),priority:index+1})),version:1,production:'人工配置',status:scene.fieldKey==='live'?'已配置':'待生产',updatedAt:'2026/10/21 16:00'}));
 const published={};
 const publishedStrategies=state.published.strategies.map(strategyFromLegacy);
 published[live.id]={sceneId:live.id,fieldKey:'live',period:'week',version:state.published.version,framework:state.published.framework,strategies:publishedStrategies,metrics:clone(metrics),actions:clone(actions),active:true};
 return {schema:2,scenes,metrics,conditions,actions,groups,frameworks,strategies,published};
}
function initAidd(){
 try{const saved=typeof aiddStorageDecode==='function'?aiddStorageDecode(localStorage.getItem(AIDD_STORAGE)):JSON.parse(localStorage.getItem(AIDD_STORAGE)||'null');if(saved?.schema===2&&['scenes','metrics','conditions','actions','groups','frameworks','strategies'].every(k=>Array.isArray(saved[k]))&&saved.published)aiddData=saved;}catch{}
 if(typeof aiddPrepareCuratedCatalog==='function')aiddData=aiddPrepareCuratedCatalog(aiddData);
 if(!aiddData)aiddData=seedAidd();
 aiddUpgradeFrameworks();
 aiddCompleteDemoCoverage(aiddData);
 saveAidd();
 if(!aiddData.scenes.some(x=>x.id===aiddUI.sceneId))aiddUI.sceneId=aiddData.scenes[0]?.id;
}
function saveAidd(){try{localStorage.setItem(AIDD_STORAGE,typeof aiddStorageEncode==='function'?aiddStorageEncode(aiddData):JSON.stringify(aiddData));}catch{toast('本浏览器未允许保存，本次页面内仍可操作');}}
function aiddScene(id=aiddUI.sceneId){return aiddData.scenes.find(x=>x.id===id)||aiddData.scenes[0];}
function aiddFramework(id=aiddUI.sceneId){return aiddData.frameworks.find(x=>x.sceneId===id&&x.status==='生效中')||aiddData.frameworks.find(x=>x.sceneId===id&&x.status==='待生效');}
function aiddSceneMetrics(scene=aiddScene()){return aiddData.metrics.filter(x=>scene.metricIds.includes(x.id));}
function aiddSceneActions(scene=aiddScene()){return aiddData.actions.filter(x=>scene.actionIds.includes(x.id));}
function aiddSceneStrategies(id=aiddUI.sceneId){return aiddData.strategies.filter(x=>x.sceneId===id).sort((a,b)=>a.priority-b.priority);}
// Explicit synthetic case data keyed by current asset ID. These are independent
// fixtures, never aliases for legacy exposure counts or product click-through.
const AIDD_LIVE_EXPOSURE_CASES={
 DEMO_10002:{week:{'09':[1200,1000],'10':[240,200],'14':[20,20]},day:{'09':[180,150],'10':[36,30],'14':[20,20]}},
 DEMO_10003:{week:{'09':[260,1000],'10':[52,200],'14':[20,20]},day:{'09':[40,160],'10':[8,32],'14':[20,20]}}
};
function aiddAlternateTrialSample(metric,period,sample){
 const values=AIDD_LIVE_EXPOSURE_CASES[sample?.id]?.[period]?.[metric?.id?.replace('research-metric-live-','')];
 return metric?.fieldKey==='live'&&metric.id.startsWith('research-metric-live-')&&values?{value:values[0],previousValue:values[1]}:null;
}
function aiddTrialMetricSample(metric,period,sample){
 if(Array.isArray(sample?.metricValues))return sample.metricValues.find(row=>row.id===metric.id)||null;
 const alternate=aiddAlternateTrialSample(metric,period,sample);if(alternate)return alternate;
 if(!sample||sample.id==='DEMO_10001')return (typeof aiddCuratedSample==='function'&&aiddCuratedSample(metric,period))||MERCHANT_FIELDS[metric.fieldKey]?.metrics[metric.metricKey]?.[period]||null;
 const value=aiddMetricValue(metric,period,sample);return Number.isFinite(value)?{value}:null;
}
function aiddTrialCaseData(scene,metrics,sample,period){
 // Scene bindings, including explicitly selected cross-field assets, define
 // scope. A video-to-live scene legitimately uses live-channel metrics.
 const selected=metrics,numeric=selected.filter(m=>!['String','Image'].includes(m.dataType));
 const metricValues=numeric.map(m=>{
  const raw=aiddTrialMetricSample(m,period,sample),value=aiddMetricValue(m,period,sample);
  return {id:m.id,label:m.name,unit:m.unit,metricKey:m.metricKey,derived:m.derived,value,...(m.derived!=='change'&&Number.isFinite(raw?.previousValue)?{previousValue:raw.previousValue}:{}),currentValues:m.derived!=='change'&&Array.isArray(raw?.current)?raw.current:[]};
 }).filter(m=>Number.isFinite(m.value));
 const missing=numeric.filter(m=>!metricValues.some(row=>row.id===m.id)),reasons=[];
 if(!['week','day'].includes(period))reasons.push('没有该统计周期的数据');
 if(!numeric.length)reasons.push('案例尚未提供可执行诊断的数值指标');
 if(selected.some(m=>['String','Image'].includes(m.dataType)))reasons.push('案例尚未提供所选内容素材');
 if(missing.length)reasons.push('缺少：'+missing.map(m=>m.name).join('、'));
 return {available:!reasons.length,reasons,metricValues,dataNote:sample?.id==='DEMO_10001'?'固定合成案例；真实商家取数尚未接入。':'直播曝光固定合成案例 v1；三个指标按当前资产 ID 独立提供本期与前期数值，不据此确认比率公式；来源明细、素材记录与去重口径尚未提供。'};
}
function aiddMetricValue(metric,period,sample){
 if(!metric||metric.dataType==='String'||metric.dataType==='Image')return null;
 if(Array.isArray(sample?.metricValues)){const row=sample.metricValues.find(m=>m.id===metric.id);return Number.isFinite(row?.value)?row.value:null;}
 const alternate=aiddAlternateTrialSample(metric,period,sample);if(alternate)return alternate.value;
 if(typeof aiddCuratedSample==='function'&&aiddCuratedSample(metric,period)){const fixture=aiddCuratedSample(metric,period);return !sample||sample.id==='DEMO_10001'?fixture.value:null;}
 if(metric.connectionStatus==='not_connected')return null;
 const map={gmv:'gmv',exposure:'exposure',clickRate:'clickRate',payRate:'payRate'},changes={clickRate:'click_drop',exposure:'exposure_drop',payRate:'payment_drop'};
 if(sample&&metric.fieldKey==='live'&&period==='week'){
  const value=metric.derived==='change'?sample[changes[metric.metricKey]]:sample[map[metric.metricKey]];
  if(Number.isFinite(value))return value;if(sample.id!=='DEMO_10001')return null;
 }
 if(sample&&sample.id!=='DEMO_10001')return null;
 const m=MERCHANT_FIELDS[metric.fieldKey]?.metrics[metric.metricKey];if(!m)return null;
 return metric.derived==='change'?metricChange(m,period):m[period].value;
}
function aiddCompare(a,op,b){return op==='>'?a>b:op==='>='?a>=b:op==='<'?a<b:op==='<='?a<=b:op==='=='?a===b:a!==b;}
function aiddOperand(metric,period,sample,transform='value',calc='none',operand=1){
 let value=aiddMetricValue(metric,period,sample);
 if(transform!=='value'){
  const fixture=typeof aiddCuratedSample==='function'?aiddCuratedSample(metric,period):null;
  if(fixture&&(!sample||sample.id==='DEMO_10001')){value=transform==='previous'?fixture.previousValue:null;if(!Number.isFinite(value))return null;}
  else if(Array.isArray(sample?.metricValues)){
   const row=sample.metricValues.find(m=>m.id===metric?.id);
   value=transform==='previous'&&Number.isFinite(row?.previousValue)?row.previousValue:null;
   if(value===null)return null;
  }else if(aiddAlternateTrialSample(metric,period,sample)){
   const row=aiddAlternateTrialSample(metric,period,sample);value=transform==='previous'?row.previousValue:null;if(!Number.isFinite(value))return null;
  }else{
  if(metric?.connectionStatus==='not_connected')return null;
  const data=MERCHANT_FIELDS[metric?.fieldKey]?.metrics[metric?.metricKey]?.[period];
  if(!data||metric.derived!=='value'||(sample&&sample.id!=='DEMO_10001'))return null;
  if(transform==='mean')value=data.current.reduce((a,b)=>a+b,0)/data.current.length;
  else if(transform==='previous')value=data.previousValue;
  else if(transform==='median'){const sorted=data.current.slice().sort((a,b)=>a-b);value=sorted[Math.floor(sorted.length/2)];}
  else return null;
  }
 }
 if(value===null||!Number.isFinite(value))return null;const number=Number(operand);
 if(calc==='none')return value;if(!Number.isFinite(number)||calc==='/'&&number===0)return null;
 return calc==='*'?value*number:calc==='/'?value/number:calc==='+'?value+number:value-number;
}
function aiddEvaluateRule(rule,metrics,period,sample){
 if(rule.children){const results=rule.children.map(child=>aiddEvaluateRule(child,metrics,period,sample));if(rule.join==='OR'&&results.includes(true))return true;if(rule.join!=='OR'&&results.includes(false))return false;if(results.some(x=>x===null))return null;return rule.join==='OR'?results.some(Boolean):results.every(Boolean);}
 const left=aiddOperand(metrics.find(x=>x.id===rule.metricId),period,sample,rule.leftTransform||'value',rule.leftCalc||'none',rule.leftNumber??1);
 const right=rule.rightType==='metric'?aiddOperand(metrics.find(x=>x.id===rule.rightMetricId),period,sample,rule.rightTransform||'value',rule.rightCalc||'*',rule.factor??1):Number(rule.value);
 if(left===null||right===null||!Number.isFinite(right))return null;return aiddCompare(left,rule.op,right);
}
function aiddValidateRule(rule,scene,depth=0){
 return validateProductionRule(normalizeProductionRule(rule),aiddData.metrics,scene.metricIds,depth);
}
function aiddValidateStrategy(strategy){
 const scene=aiddData.scenes.find(item=>item.id===strategy.sceneId);if(!scene)return '请选择已配置的关联场景';
 if(!strategy.description?.trim())return '请填写目标';
 if(!strategy.merchantScope?.trim())return '请填写适用范围';
 const metricIds=aiddStrategyMetricIds(strategy);if(!metricIds.length)return '请至少选择一个关联指标';
 if(metricIds.some(id=>!scene.metricIds.includes(id)||!aiddData.metrics.some(metric=>metric.id===id)))return '请选择当前场景已关联的有效指标';
 if(strategy.actionIds.some(id=>!scene.actionIds.includes(id)||!aiddData.actions.some(action=>action.id===id)))return '请选择当前场景已关联的有效行动建议';
 if(!strategy.name?.trim())return '请填写策略名称';if(aiddData.strategies.some(s=>s.id!==strategy.id&&s.sceneId===strategy.sceneId&&s.groupId===strategy.groupId&&s.name===strategy.name))return '当前策略组内名称重复，请修改';
 if(!aiddData.groups.some(g=>g.id===strategy.groupId&&g.sceneId===strategy.sceneId))return '请先选择有效策略组';
 if(strategy.businessFrameworkVersion===2&&strategy.decisionLevel==='evidence_required'){
  if(!strategy.requiredEvidence?.length||!strategy.confirmationRule?.trim()||!strategy.missingMetricOrEvidence?.length)return '请列明证据来源、问题确认条件与未接入项';
  if(strategy.execution!=='模型理解')return '证据判断未接入前，不能转为数值规则直接发布原因';
  return aiddValidateRule(strategy.rule,scene);
 }
 if(strategy.execution==='模型理解'){if(!strategy.contentObjects.length||!strategy.contentPrompt.trim())return '请完善内容对象与判断标准';for(const object of strategy.contentObjects){if(!aiddSceneMetrics(scene).some(metric=>metric.name===object&&['String','Image'].includes(metric.dataType)))return `请先为场景关联${object}指标`;}return null;}
 return aiddValidateRule(strategy.rule,scene);
}
function aiddApplySchedules(){if(!aiddData)return;let changed=false;for(const scene of aiddData.scenes){if(scene.scheduledOffline&&scene.scheduledOffline<=Date.now()){aiddOfflineScene(scene);changed=true;}}if(changed)saveAidd();}
function aiddPublishedFramework(frame,scene,config){
 const metrics=(config.metrics||[]).filter(m=>!['String','Image'].includes(m.dataType)),actions=config.actions||[],id=frame?.assetId||frame?.id||'framework-'+scene.id;
 const branches=(frame?.branches?.length?frame.branches:[]).map((b,index)=>({...clone(b),id:b.id||id+'-branch-'+(index+1),priority:b.priority||index+1}));
 const covered=new Set(branches.flatMap(b=>b.metricIds));
 const remaining=metrics.filter(m=>!covered.has(m.id));
 if(remaining.length)branches.push({id:id+'-published-metrics',name:'经营结果与其他已发布指标',meaning:'核对框架对应发布快照中的经营结果和相关指标；不引入新判断阈值。',metricIds:remaining.map(m=>m.id),actionIds:actions.filter(a=>a.metricIds?.some(metricId=>remaining.some(m=>m.id===metricId))).map(a=>a.id),priority:branches.length+1});
 return {id,sceneId:scene.id,name:frame?.name||scene.name+'分析框架',fieldKey:scene.fieldKey,goal:frame?.goal||scene.goal||'',scope:scene.merchantScope||'',text:config.framework||frame?.prompt||'',active:config.active!==false&&scene.status==='生效中',version:config.frameworkVersion||frame?.version||config.version||1,sourceWorkflow:frame?.production==='Coze生成'?'AIDD_Production':frame?.production||'已发布配置结构化映射',metricIds:metrics.map(m=>m.id),actionIds:actions.map(a=>a.id),branches};
}
function aiddRuntimeConfig(fieldKey,period,options={}){
 aiddApplySchedules();
 const selection=typeof selectDiagnosticScenes==='function'?selectDiagnosticScenes(aiddData.scenes,options.question||'',fieldKey,aiddData.strategies,aiddData.metrics):null;
 const selected=options.allScenes?null:selection?.scenes.map(s=>s.id);
 const available=(aiddData?.scenes||[]).filter(scene=>scene.fieldKey===fieldKey&&(!selected||selected.includes(scene.id))).map(scene=>({scene,published:aiddData.published[scene.id]})).filter(item=>item.published?.periods?.[period]||item.published?.period===period).sort((a,b)=>(Number(b.scene.status==='生效中')-Number(a.scene.status==='生效中'))||(b.published.publishedAt||0)-(a.published.publishedAt||0));
 if(!available.length)return selection?.ambiguous?{active:false,inactiveReason:selection.missing.join('；'),scopeClarification:selection.missing,catalogRevision:aiddData.catalogRevision,metrics:[],actions:[],strategies:[],frameworkCandidates:[]}:null;
 const bundles=available.map(({scene,published})=>{
  const config=typeof aiddActionMappingConfig==='function'?aiddActionMappingConfig(published.periods?.[period]||published):clone(published.periods?.[period]||published),frame=aiddData.frameworks.find(f=>f.sceneId===scene.id&&f.status==='生效中'&&(f.prompt===config.framework||f.draftText===config.framework)),active=scene.status==='生效中'&&aiddData.frameworks.some(f=>f.sceneId===scene.id&&f.status==='生效中');
  const definition=config.frameworkDefinition?{...clone(config.frameworkDefinition),active:active&&config.frameworkDefinition.active!==false}:aiddPublishedFramework(frame,scene,config);
  Object.assign(definition,{sceneName:scene.name,priority:scene.priority,level:scene.level,parentId:scene.parentId,requiredEvidence:[...new Set([...(scene.requiredEvidence||[]),...(frame?.requiredEvidence||definition.requiredEvidence||[])])]});
  definition.active=active&&definition.active;
  return {...config,frameworkDefinition:definition,active,inactiveReason:scene.status!=='生效中'?'当前场景诊断已下线':'当前场景诊断框架已下线'};
 });
 bundles.sort((a,b)=>Number(b.active)-Number(a.active));
 const config=bundles[0],unique=(rows)=>[...new Map(rows.map(row=>[row.id,row])).values()];
 return {...config,groups:unique(bundles.flatMap(c=>c.groups||[])),frameworkCandidates:bundles.map(c=>c.frameworkDefinition),metrics:unique(bundles.flatMap(c=>c.metrics||[])),actions:typeof aiddPublishedActionAssets==='function'?aiddPublishedActionAssets(unique(bundles.flatMap(c=>c.actions||[]))):unique(bundles.flatMap(c=>c.actions||[])),strategies:bundles.filter(c=>c.active).flatMap(c=>(c.strategies||[]).map(s=>({...s,frameworkId:s.frameworkId||c.frameworkDefinition.id,frameworkVersion:s.frameworkVersion||c.frameworkDefinition.version})))};
}
function aiddRequestConfig(context){return {...clone(state.published),fieldConfigs:Object.fromEntries(Object.keys(MERCHANT_FIELDS).map(key=>[key,aiddRuntimeConfig(key,context?.period||state.period)]))};}
function aiddRuleText(rule,metrics=aiddData.metrics){
 if(rule.children)return `(${rule.children.map(child=>aiddRuleText(child,metrics)).join(rule.join==='OR'?' 或 ':' 且 ')})`;
 const render=(id,transform,calc,value)=>{let name=metrics.find(x=>x.id===id)?.name||'未选择指标';const labels={mean:'当前周期均值',previous:'前周期值',peerMean:'同行均值',sameLevelMean:'同行同等级均值',median:'P50分位值'};if(labels[transform])name+=`［${labels[transform]}］`;if(calc&&calc!=='none')name=`(${name} ${calc} ${value})`;return name;};
 return `${render(rule.metricId,rule.leftTransform,rule.leftCalc,rule.leftNumber)} ${rule.op} ${rule.rightType==='metric'?render(rule.rightMetricId,rule.rightTransform,rule.rightCalc||'*',rule.factor??1):rule.value}`;
}
function aiddMerchantRows(fieldKey,period,config){
 if(config.catalogRevision&&typeof curatedDiagnosticRows==='function')return curatedDiagnosticRows(fieldKey,period,config);
 if(config.catalogRevision&&config.dataAvailability?.status==='not_connected')return [{id:'research-data-unavailable-'+fieldKey,metric:'gmv',fieldKey,warning:false,title:'诊断配置已发布，真实取数待接入',evidence:'新指标仅核验了名称与来源，目前没有对应的当前值及前周期值。',action:'查看诊断配置',advice:'接入同口径完整周期数据后才能判断经营变化。',hasAction:false}];
 const field=MERCHANT_FIELDS[fieldKey],base=field.issues||[],rows=[];
 if(config.active)for(const strategy of config.strategies){
  if(strategy.status!=='生效中'||strategy.execution==='模型理解')continue;
  const hit=aiddEvaluateRule(strategy.rule,config.metrics,period),trigger=strategy.actionTrigger==='mismatch'?!hit:hit;if(hit===null){rows.push({id:strategy.id,metric:'gmv',fieldKey,warning:false,title:'对标数据待补充',evidence:'该策略需要的对标数据在当前样例中不可用',action:'查看诊断依据',advice:'请先补齐指标取数与对标数据，当前不能据此判断是否存在异常。',hasAction:false});continue;}if(!trigger)continue;
  const firstMetric=(()=>{const find=r=>r.children?r.children.map(find).find(x=>x?.derived==='change')||r.children.map(find).find(Boolean):config.metrics.find(x=>x.id===r.metricId);return find(strategy.rule);})();
  const metricKey=firstMetric?.metricKey||'gmv',actions=strategy.actionIds.map(id=>config.actions.find(action=>action.id===id)).filter(Boolean).map(action=>({...clone(action),recommendation:strategy.actionSubtitles?.[action.id]||action.subtitle||action.description})),action=actions[0];
  rows.push({id:strategy.id,metric:metricKey,fieldKey,warning:strategy.actionTrigger!=='mismatch',title:strategy.actionTrigger==='mismatch'?`未满足“${strategy.name}”条件`:strategy.name,evidence:comparisonText(field.metrics[metricKey]||field.metrics.gmv,period),action:action?.name||'查看指标变化依据',advice:action?actions.map(item=>item.recommendation).join('；'):'当前策略仅提供诊断，尚未关联行动点。',actions,hasAction:!!action});
 }
 for(const issue of base){if(rows.length>=2)break;if(!rows.some(x=>x.metric===issue.metric))rows.push({...issue,fieldKey,warning:false,title:config.active?issue.steady:config.inactiveReason||'当前场景诊断已下线',evidence:comparisonText(field.metrics[issue.metric],period)});}
 if(!rows.length)rows.push({metric:'gmv',fieldKey,warning:false,title:config.active?'当前条件未命中优先关注项':config.inactiveReason||'当前场景诊断已下线',evidence:comparisonText(field.metrics.gmv,period),action:'查看经营数据',advice:'结合场域数据持续观察，并依据实际证据核查。'});
 return rows;
}
