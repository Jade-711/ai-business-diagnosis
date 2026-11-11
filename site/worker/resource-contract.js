import {sharedStrategy} from '../shared/strategy-scope.js';
import {selectDiagnosticScenes,sceneEvidenceErrors,publishedFrameworkMethod} from '../shared/scene-routing.js';
// Compile the research catalog for the existing Coze interface. Metric IDs,
// names, units and values stay unchanged; metricKey is only a routing alias.
export function researchRoutingAlias(name=''){
 name=String(name).split('｜').at(-1);
 if(/^(成交金额|商品卡成交金额)$/.test(name))return 'gmv';
 if(/^(成交订单数|商品卡成交订单数|下单订单数)$/.test(name))return 'orders';
 if(/^(成交人数|成交用户数|复购用户数)$/.test(name))return 'buyers';
 if(/首购用户数|粉丝占比/.test(name))return 'newBuyerRate';
 if(/新发布短视频数|直播场次/.test(name))return 'videos';
 if(/观看-成交率|点击.*成交.*率|商品点击支付转换率/.test(name))return 'payRate';
 if(/曝光.*点击.*率|曝光点击率|商品点击人数/.test(name))return 'clickRate';
 if(/曝光|观看人数|内容触达/.test(name))return 'exposure';
 return '';
}
function legacyQuestionAlias(question=''){
 const patterns=[[/支付人数|支付用户|买家人数/,'buyers'],[/新客/,'newBuyerRate'],[/有成交达人|达人数/,'creators'],[/订单/,'orders'],[/发布.*视频|视频.*数量|视频数/,'videos'],[/播放/,'plays'],[/合作达人成交率/,'activeRate'],[/支付转化|支付率|转化率/,'payRate'],[/点击率/,'clickRate'],[/曝光/,'exposure'],[/金额|GMV|成交额/i,'gmv']];
 const matches=[...new Set(patterns.filter(([re])=>re.test(question)).map(([,key])=>key))];return matches.length===1?matches[0]:'';
}
function researchFocus(metrics,request={}){
 const q=String(request.question||'');
 const matches=metrics.filter(m=>{const name=m.originalName||m.label||m.name?.split('｜').at(-1)||'';return name&&q.includes(name);}).sort((a,b)=>(b.originalName||b.label||b.name||'').length-(a.originalName||a.label||a.name||'').length);
 if(matches.length)return matches[0].id;
 if(/这里|这儿|当前页面|当前看板|这张看板|这个指标|这项指标|该指标|当前指标/.test(q)&&metrics.some(m=>m.id===request.pageContext?.metricKey))return request.pageContext.metricKey;
 const alias=legacyQuestionAlias(q);return alias?metrics.find(m=>researchRoutingAlias(m.originalName||m.label||m.name)===alias)?.id||'':'';
}
function researchKeys(metrics,request={}){
 const focus=researchFocus(metrics,request),requested=legacyQuestionAlias(request.question);
 return metrics.map(m=>({...m,metricKey:m.id===focus&&requested?requested:focus&&requested?'research_unfocused_'+m.id:researchRoutingAlias(m.originalName||m.label||m.name)||m.id}));
}
export function compileResearchConfig(config,fieldKey,request={}){
 if(!config?.catalogRevision)return config;
 const allCandidates=(config.frameworkCandidates?.length?config.frameworkCandidates:config.frameworkDefinition?[config.frameworkDefinition]:[]).map(publishedFrameworkMethod);
 const selection=selectDiagnosticScenes(allCandidates,request.question||'',fieldKey,config.strategies||[],config.metrics||[]),candidates=selection.scenes;
 const focus=researchFocus(config.metrics||[],request),q=String(request.question||'');
 let selected=candidates.filter(f=>f.active&&focus&&f.metricIds.includes(focus));
 if(selected.length!==1&&fieldKey==='overview'){
  const type=/客服|回复|发货|物流|品质|纠纷|服务|体验/.test(q)?'服务体验':/首购|复购|新客|用户|粉丝/.test(q)?'用户经营':/在架|动销|件单价|供给|货盘/.test(q)?'商品供给':/转化|下单|点击/.test(q)?'整体转化':/曝光|流量|触达/.test(q)?'整体流量':'整体交易';
  selected=candidates.filter(f=>f.active&&f.name.includes(type));
 }
 const chosen=request.wholeStore?candidates.filter(f=>f.active):selected.length===1?selected:candidates;
 const strategies=(config.strategies||[]).filter(s=>chosen.some(f=>f.id===s.frameworkId)).map(s=>{
  // These requirements describe data quality, not merchant segmentation tags.
  // Numeric availability is checked by the executor; no natural-language text
  // is silently treated as a merchant-profile label.
  const dataScope=s.dataRequirements?.sameSeller&&s.dataRequirements?.sameAttribution&&s.dataRequirements?.completePeriods&&s.dataRequirements?.requirePrevious;
  return dataScope?{...s,merchantScope:'',merchantScopeDescription:s.merchantScope,scopeMode:'data_requirements'}:{...s};
 });
 const evidenceErrors=chosen.flatMap(f=>sceneEvidenceErrors(f,request));
 const pool=chosen.every(f=>f.priority==='P0'||!f.level)?allCandidates.filter(f=>f.priority==='P0'||!f.level):chosen;
 const allowed=new Set(pool.flatMap(f=>f.metricIds||[]));
 const scopedMetrics=allowed.size?(config.metrics||[]).filter(m=>allowed.has(m.id)):(selection.ambiguous?[]:config.metrics||[]);
 return {...config,frameworkCandidates:chosen,metrics:researchKeys(scopedMetrics,request),strategies:strategies.map(sharedStrategy),sceneInputErrors:[...(config.scopeClarification||[]),...selection.missing,...evidenceErrors]};
}
export function configurationPayload(config,fieldKey,source,request={}){
 config=compileResearchConfig(config,fieldKey,request);
 if(!config)return {framework:{text:'',active:false,version:0,fieldKey},frameworkCandidates:[],metricDefinitions:[],strategies:[],actionAssets:[],source,errors:['当前场景没有已发布配置']};
 const metrics=config.metrics||[],actions=config.actions||[],strategies=config.strategies||[],numeric=metrics.filter(m=>!['String','Image'].includes(m.dataType));
 const fallback={id:config.frameworkId||'framework-'+config.sceneId,sceneId:config.sceneId,name:config.sceneName||'已发布经营诊断框架',fieldKey,goal:config.goal||'按框架分析经营变化',scope:config.scope||'当前场景适用商家',text:config.framework||'',active:!!config.active,version:config.frameworkVersion||config.version||1,sourceWorkflow:config.frameworkSource||'演示预置或人工配置',metricIds:numeric.map(m=>m.id),actionIds:actions.map(a=>a.id),branches:[...new Set(numeric.map(m=>m.metricKey))].map((key,index)=>({id:'published-'+config.sceneId+'-'+key,name:(numeric.find(m=>m.metricKey===key&&m.derived==='value')?.name||key)+'分析',meaning:'对照同口径指标定位变化环节；业务原因需要进一步证据。',metricIds:numeric.filter(m=>m.metricKey===key).map(m=>m.id),actionIds:actions.filter(a=>a.metricIds?.some(id=>numeric.some(m=>m.id===id&&m.metricKey===key))).map(a=>a.id),priority:index+1}))};
 const candidates=(Array.isArray(config.frameworkCandidates)&&(config.catalogRevision||config.frameworkCandidates.length)?config.frameworkCandidates:[config.frameworkDefinition||fallback]).map(f=>({...f,active:f.active===true&&config.active!==false}));
 const primary=candidates.find(f=>f.active)||candidates[0]||fallback;
 return {framework:primary,frameworkCandidates:candidates,metricDefinitions:metrics,strategies:strategies.map(s=>{const frame=candidates.find(f=>f.sceneId===(s.sceneId||config.sceneId))||primary;return {...sharedStrategy(s),sceneId:s.sceneId||frame.sceneId,frameworkId:s.frameworkId||frame.id,frameworkVersion:s.frameworkVersion||frame.version};}),actionAssets:actions,source,errors:[...(config.sceneInputErrors||[]),...(candidates.some(f=>f.active)?[]:[config.inactiveReason||'当前场景配置或框架未生效'])],assetConsumer:'AIDD_Execution',assetPublication:'已发布快照；AIDD_Production候选需人工审核发布后进入此接口'};
}
export function metricsPayload(data,metricIds,request={}){
 const requested=typeof metricIds==='string'?metricIds.split(',').map(x=>x.trim()).filter(Boolean):Array.isArray(metricIds)?metricIds:[];
 const all=data?.metrics||[],known=new Set(all.map(m=>m.id)),errors=requested.filter(id=>!known.has(id)).map(id=>'本次请求的指标尚未接入：'+id);
 const selected=requested.length?all.filter(m=>requested.includes(m.id)):all;
 const scope=request.context||request.pageContext||request;
 if(data?.period&&scope.period&&data.period!==scope.period)errors.push('数据周期与本轮请求不一致，暂不执行诊断');
 if(data?.fieldKey&&scope.fieldKey&&data.fieldKey!==scope.fieldKey)errors.push('数据场域与本轮请求不一致，暂不执行诊断');
 if(data?.sellerId&&request.sellerId&&data.sellerId!==request.sellerId)errors.push('数据商家与本轮请求不一致，暂不执行诊断');
 if(data?.completePeriods===false||data?.sameAttribution===false)errors.push('周期不完整或归因不可比，暂不执行诊断');
 errors.push(...videoExposureConsistencyErrors(selected),...businessMetricConsistencyErrors(selected));
 return {metricValues:data?.synthetic?researchKeys(selected,request):selected,goal:data?.goal||{},fieldBreakdown:data?.fieldBreakdown||[],source:'看板同口径演示经营数据',errors};
}

export function businessMetricConsistencyErrors(metrics=[]){
 const byId=new Map(metrics.map(m=>[m.id||m.metricId,m])),errors=[];
 const pairs=[['live',9,10],['live',10,11],['live',11,12],['live',12,4],['video',7,5],['video',5,8],['video',8,9],['video',9,10],['goods',1,2]];
 for(const source of ['trade','live','creator','goods'])pairs.push([source,source==='trade'?5:source==='goods'?12:source==='creator'?2:3,source==='trade'?6:source==='goods'?13:source==='creator'?3:4]);
 const id=(source,n)=>'research-metric-'+source+'-'+String(n).padStart(2,'0');
 for(const key of ['value','previousValue']){
  const period=key==='value'?'本期':'前期';
  for(const m of metrics){
   if(!Number.isFinite(m[key])||m.derived==='change')continue;
   if(m[key]<0||m.unit==='%'&&m[key]>100)errors.push(period+(m.label||m.originalName||m.id)+'超出原始非负指标或比例范围，须核对口径后再诊断。');
  }
  for(const [source,a,b] of pairs){const large=byId.get(id(source,a)),small=byId.get(id(source,b));if([large?.[key],small?.[key]].every(Number.isFinite)&&small[key]>large[key])errors.push(period+(small.label||small.originalName||small.id)+'大于同口径'+(large.label||large.originalName||large.id)+'，须核对范围、归因与去重后再诊断。');}
 }
 return [...new Set(errors)];
}

// These IDs describe the same short-video exposure population. A rule may not
// diagnose physically inconsistent totals, even when every comparison is true.
export function videoExposureConsistencyErrors(metrics=[]){
 const byId=new Map(metrics.map(m=>[m.id||m.metricId,m])),pv=byId.get('research-metric-video-06'),uv=byId.get('research-metric-video-07'),paid=byId.get('research-metric-video-21'),errors=[];
 for(const [key,label] of [['value','本期'],['previousValue','前期']]){
  if([pv?.[key],uv?.[key]].every(Number.isFinite)&&pv[key]<uv[key])errors.push(`短视频曝光口径不一致：${label}曝光次数小于曝光人数，须核对范围、单位和去重口径，暂不执行诊断。`);
  if([paid?.[key],uv?.[key]].every(Number.isFinite)&&paid[key]>uv[key])errors.push(`短视频曝光口径不一致：${label}付费渠道曝光用户数大于总曝光人数，须核对归因及统计范围，暂不执行诊断。`);
 }
 return errors;
}

// Transport only fields consumed by the Workflow. Rules, evidence, units and
// business meaning are retained; editor snapshots and duplicate drafts are not.
export function workflowInputPayload(config,data,fieldKey,request={}){
 const wholeStore=fieldKey==='overview'&&/经营表现|经营情况|整体经营|全店诊断/.test(request.question||'')&&!/整体交易|整体流量|整体转化|商品供给|服务体验|用户经营|目标|达标|缺口/.test(request.question||'');
 const compiled=compileResearchConfig(config,fieldKey,{...request,wholeStore});
 const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>v[k]!==undefined).map(k=>[k,v[k]]));
 const configuration={...pick(compiled,['sceneId','sceneName','fieldKey','version','frameworkVersion','active','catalogRevision','sceneInputErrors','scopeClarification']),frameworkCandidates:(compiled.frameworkCandidates||[]).map(f=>pick(f,['id','sceneId','sceneName','name','fieldKey','goal','scope','active','version','sourceWorkflow','metricIds','actionIds','branches','priority','level','requiredEvidence','decomposition','drilldown','businessBoundary','missingMetricOrEvidence'])),strategies:(compiled.strategies||[]).map(s=>pick(s,['id','name','sceneId','frameworkId','frameworkVersion','branchIds','enabled','status','execution','priority','merchantScope','actionTrigger','rule','metricIds','actionIds','diagnosticMetricIds','displayMetricIds','diagnosticKind','suppressesStrategyIds','dataRequirements','businessMeaning','description','thresholdBasis','exceptionHandling','contentPrompt','contentObjects','actionSubtitles','actionMappings','decisionLevel','requiredEvidence','businessFrameworkVersion','exclusiveGroup','exclusionPolicy','missingMetricOrEvidence','confirmationRule'])),metrics:(compiled.metrics||[]).map(m=>pick(m,['id','name','originalName','unit','dataType','fieldKey','metricKey','derived','sourceKey'])),actions:(compiled.actions||[]).map(a=>pick(a,['id','name','description','subtitle','pcLink','mobileLink','requiredTags','metricIds']))};
 const ids=new Set(configuration.metrics.map(m=>m.id));
 // Auxiliary observations are restricted to this seller/field/period's published
 // numeric definitions. They do not expand the rule set or query allowlist.
 configuration.observationMetricDefinitions=(config.metrics||[]).filter(m=>!['String','Image'].includes(m.dataType)&&m.unit&&m.unit!=='待核验').map(m=>pick(m,['id','originalName','name','unit','dataType','derived','fieldKey']));
 const observationIds=new Set(configuration.observationMetricDefinitions.map(m=>m.id));
 return {configuration,data:{...data,metrics:(data.metrics||[]).filter(m=>ids.has(m.id)),observationMetrics:(data.metrics||[]).filter(m=>observationIds.has(m.id))}};
}
