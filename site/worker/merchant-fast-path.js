import {configurationPayload,metricsPayload} from './resource-contract.js';
import {confirmMerchantRequest,executeMerchantRules,deliverMerchantRules} from './merchant-kernel.js';
import {merchantEvidenceAnalysis,merchantWholeStoreQuestion} from '../shared/merchant-evidence.js';
import {selectDiagnosticScenes} from '../shared/scene-routing.js';

// Only questions fully described by the existing catalog and supported scope
// take this route. Extra dimensions, content judgement, research, predictions,
// ambiguous wording and general knowledge keep the original Coze workflow.
function merchantStrategyNames(strategy){
 const name=String(strategy.name||'').replace(/（近7天）|（昨日）/g,'');
 const prefix=['达人合作','短视频','全店','直播','货架'].find(prefix=>name.startsWith(prefix));
 return [name,...(prefix?[name.slice(prefix.length)]:[])].filter(Boolean);
}
export function merchantSimpleIntent(question,definitions,strategyNames=[]){
 const q=String(question||'').trim();
 if(!q||/什么是|是什么意思|定义|统计口径|指标口径|如何设置|怎么设置|如何制定|怎么制定|预测|预计|如果|假如|政策|最新|行业|同行|竞品|具体原因|根本原因|搜索|检索|标题|主图|素材|脚本|北京|上海|地区|地域|分省|分市|分商品|各商品|各渠道|分渠道|SKU|货号|\bID\b/i.test(q))return null;
 const fields=[/直播|live/i,/短视频|video/i,/货架|shelf/i,/达人|creator/i].filter(re=>re.test(q));
 if(fields.length>1||/各场域|跨场域|对比.*场域/.test(q))return null;
 if(['整体交易','整体流量','整体转化','商品供给','服务体验','用户经营'].filter(name=>q.includes(name)).length>1)return null;
 const intent=/目标|达标|达成|补差|缺口/.test(q)?'goal':/分析|诊断|为什么|原因|建议|表现|改善|变化|趋势|回落|下降|上升|异常|问题/.test(q)?'diagnosis':/多少|是多少|查询|查数|查看|看看|数据/.test(q)?'data':null;
 if(!intent)return null;
 const matched=definitions.filter(m=>{const name=m.originalName||m.name?.split('｜').at(-1)||'';return name&&q.includes(name);});
 const matchedNames=[...new Set(matched.map(m=>m.originalName||m.name))];
 const names=matchedNames.filter(name=>!matchedNames.some(other=>other!==name&&other.includes(name)));
 if(names.length>1)return null;
 let remainder=q;
 remainder=remainder.replace(/\d+(?:\.\d+)?\s*[%％]/g,'').replace(/有什么|给我/g,'');
 for(const name of strategyNames.sort((a,b)=>b.length-a.length))remainder=remainder.split(name).join('');
 for(const name of [...new Set(definitions.map(m=>m.originalName||m.name?.split('｜').at(-1)).filter(Boolean))].sort((a,b)=>b.length-a.length))remainder=remainder.split(name).join('');
 remainder=remainder.replace(/近\s*[7七]\s*天|最近\s*[7七]\s*天|过去\s*[7七]\s*天|近一周|最近一周|昨日|昨天/g,'');
 // Unsupported dates are handled by the unchanged scope validator; they are
 // never silently converted to the page's currently selected period.
 remainder=remainder.replace(/今天|今日|前天|本周|上周|本月|上月|今年|去年|季度|自定义|\d{4}[-/年][\d月日/-]*|(近|最近|过去)\s*[\d一二三四五六八九十两]+\s*天/g,'');
 remainder=remainder.replace(/查一下|查下|以及下一步应该怎么做|下一步应该怎么做|下一步|应该|怎么做/g,'');
 const words=['帮我','请帮忙','请问','能不能','可以','一下','近七天','全店总览','全店','整店','整体店铺','店铺','直播','短视频','货架','达人合作','达人','整体交易','整体流量','整体转化','商品供给','服务体验','用户经营','经营情况','经营数据','整体经营','经营表现','目标差距','目标差额','目标完成率','目标达成率','目标','达标','达成','补差','缺口','完成率','完成','分析','诊断','为什么','怎么','如何','改善','原因','建议','行动点','经营工具','关联','变化','趋势','回落','下降','下滑','减少','上升','增长','异常','问题','表现','情况','整体','总体','流量','转化','成交额','支付金额','GMV','支付订单数','支付人数','查询','查数','查看','看看','数据','是多少','有多少','多少','这里','这儿','当前页面','当前看板','这张看板','这个指标','这项指标','该指标','当前指标','当前','继续','那','再','了','的','和','与','及','请','我','吗','呢','吧','下','看'];
 for(const word of words.sort((a,b)=>b.length-a.length))remainder=remainder.split(word).join('');
 if(remainder.replace(/[\s，。！？、；：,.!?;:()（）“”"'·-]/g,''))return null;
 return intent;
}

export function merchantFastResult(body,catalog){
 const all=Object.values(catalog).flatMap(x=>x.config?.metrics||[]);
 const strategyNames=[...new Set(Object.values(catalog).flatMap(x=>(x.config?.strategies||[]).flatMap(merchantStrategyNames)))];
 const intent=merchantSimpleIntent(body.question,all,strategyNames);
 if(!intent)return null;
 return intent?merchantPublishedResult(body,catalog,{intent}):null;
}

// Used as a deterministic tool INSIDE the Workflow; it never replaces a Workflow request.
export function merchantPublishedResult(body,catalog,{intent='diagnosis',resolvedContext,allowContent=false}={}){
 const seller=body.sellerId||body.context?.sellerId||'DEMO_10001';
 if(seller!=='DEMO_10001')return null;
 const all=Object.values(catalog).flatMap(x=>x.config?.metrics||[]);
 const strategyNames=[...new Set(Object.values(catalog).flatMap(x=>(x.config?.strategies||[]).flatMap(merchantStrategyNames)))];
 const sceneScope=selectDiagnosticScenes(Object.values(catalog).flatMap(c=>c.config?.frameworkCandidates||[]).filter((f,i,all)=>all.findIndex(x=>x.id===f.id)===i),body.question,'',[],all);
 const catalogSceneFieldKey=sceneScope.explicit&&!sceneScope.ambiguous&&sceneScope.scenes.length===1?sceneScope.scenes[0].fieldKey:'';
 const routed=resolvedContext?{analysisContext:{...resolvedContext},needClarification:false,scopeResolution:{metricSource:'workflow'}}:confirmMerchantRequest({...body,catalogSceneFieldKey,intent:intent==='data'?'data':'diagnosis'});
 const context=routed.analysisContext;
 if(routed.needClarification){
  return {result:{schemaVersion:1,status:'clarification',branch:'clarification',answer:routed.clarification,context,dataMode:'demo',evidence:[],diagnosis:[],actions:[],missing:routed.scopeErrors},updates:[{kind:'context',branch:'clarification',context:{}}],route:'scope_validation'};
 }
 const key=context.fieldKey+':'+context.period,preset=catalog[key];
 // No real-data request is substituted with the demonstration catalog.
 if(!preset?.data?.synthetic||preset.data.mode!=='demo')return null;
 const raw=Object.hasOwn(body.runtimeConfigurations||{},key)?body.runtimeConfigurations[key]:preset.config;
 if(!raw?.catalogRevision||raw.catalogRevision!==preset.config?.catalogRevision)return null;
 const wholeStore=intent==='diagnosis'&&merchantWholeStoreQuestion(body.question,context.fieldKey)&&!(raw.metrics||[]).some(m=>m.originalName&&body.question.includes(m.originalName));
 const request={question:body.question,pageContext:body.pageContext||{},context,sellerId:seller,wholeStore,businessEvidence:body.businessEvidence};
 const assets=configurationPayload(raw,context.fieldKey,'本次请求的已发布配置',request);
 const data=metricsPayload(preset.data,assets.metricDefinitions.map(m=>m.id),request);
 const matches=assets.metricDefinitions.filter(m=>{const name=m.originalName||m.name?.split('｜').at(-1);return name&&body.question.includes(name);}).sort((a,b)=>(b.originalName||b.name).length-(a.originalName||a.name).length);
 const namedStrategies=assets.strategies.filter(s=>merchantStrategyNames(s).some(name=>body.question.includes(name)));
 if(!matches.length&&!namedStrategies.length&&strategyNames.some(name=>body.question.includes(name)))return null;
 if(intent==='goal')context.metricKey='';
 else if(intent==='diagnosis'&&assets.frameworkCandidates.some(f=>['环节','要素'].includes(f.level))&&selectDiagnosticScenes(assets.frameworkCandidates,body.question,context.fieldKey,assets.strategies,assets.metricDefinitions).explicit)context.metricKey='';
 else if(matches.length)context.metricKey=matches[0].metricKey;
 else if(namedStrategies.length===1)context.metricKey=assets.metricDefinitions.find(m=>m.id===namedStrategies[0].metricIds?.[0])?.metricKey||'';
 else if(selectDiagnosticScenes(assets.frameworkCandidates,body.question,context.fieldKey,assets.strategies,assets.metricDefinitions).explicit)context.metricKey='';
 else if(/这个指标|这项指标|该指标|当前指标/.test(body.question)&&assets.metricDefinitions.some(m=>m.id===body.pageContext?.metricKey))context.metricKey=assets.metricDefinitions.find(m=>m.id===body.pageContext.metricKey).metricKey;
 else if(routed.scopeResolution.metricSource!=='question'&&/经营|整体|总体|流量|转化|商品供给|服务体验|用户经营/.test(body.question))context.metricKey='';
 if(!context.metricKey&&intent!=='goal'&&!selectDiagnosticScenes(assets.frameworkCandidates,body.question,context.fieldKey,assets.strategies,assets.metricDefinitions).explicit&&!/经营|整体|总体|流量|转化|商品供给|服务体验|用户经营/.test(body.question)){
  const previous=[...(body.history||[])].reverse().find(h=>h.role==='assistant'&&h.context?.fieldKey===context.fieldKey&&h.context?.period===context.period);
  context.metricKey=assets.metricDefinitions.find(m=>m.id===previous?.context?.metricKey)?.metricKey||'';
 }
 const updates=[{kind:'context',branch:intent==='data'?'data':'diagnosis',context:{fieldKey:context.fieldKey,period:context.period}}];
 if(intent==='data'){
  const evidence=data.metricValues.filter(m=>m.derived==='value'&&(!context.metricKey||m.metricKey===context.metricKey)).map(m=>({metricId:m.id,label:m.label,value:m.value,unit:m.unit,previousValue:m.previousValue}));
  const errors=[...data.errors,...(!evidence.length?['本次所问指标没有可用数据']:[]),...evidence.filter(m=>!Number.isFinite(m.value)).map(m=>m.label+'当前值缺失，暂无法判断')];
  updates.push({kind:'evidence',metrics:evidence,source:data.source,errors});
  return {route:'published_data',updates,result:{schemaVersion:1,status:errors.length?'missing_data':'success',branch:'data',context,dataMode:'demo',synthetic:true,evidence,metricAnalysis:evidence,diagnosis:[],actions:[],missing:errors,answer:errors.length?errors.join('；'):evidence.map(m=>`${m.label}：${Number.isFinite(m.value)?m.value.toLocaleString('zh-CN',{maximumFractionDigits:2})+m.unit:'待补充'}${Number.isFinite(m.previousValue)?`；前期 ${m.previousValue.toLocaleString('zh-CN',{maximumFractionDigits:2})}${m.unit}`:''}`).join('；')}};
 }
 const input={question:body.question,context,metricValues:data.metricValues,goal:data.goal,fieldBreakdown:data.fieldBreakdown,merchantProfile:{tags:context.tags},dataErrors:data.errors,frameworkCandidates:assets.frameworkCandidates,metricDefinitions:assets.metricDefinitions,strategyCandidates:assets.strategies,actionAssets:assets.actionAssets,configurationErrors:assets.errors};
 const executions=wholeStore?assets.frameworkCandidates.filter(f=>f.active).sort((a,b)=>a.id.localeCompare(b.id)).map(f=>executeMerchantRules({...input,frameworkCandidates:[f],strategyCandidates:assets.strategies.filter(s=>s.frameworkId===f.id)})):[executeMerchantRules(input)];
 const execution=executions[0]||executeMerchantRules(input);
 if(wholeStore&&executions.length>1){
  for(const key of ['selectedStrategies','ruleResults'])execution[key]=[...new Map(executions.flatMap(e=>e[key]||[]).map(v=>[v.id||v.strategyId,v])).values()];
  for(const key of ['validationErrors','selectedStrategyIds','requiredMetricIds'])execution[key]=[...new Set(executions.flatMap(e=>e[key]||[]))];
  execution.diagnosisPlan={...execution.diagnosisPlan,steps:executions.flatMap(e=>e.diagnosisPlan.steps),requiredMetricIds:execution.requiredMetricIds};
 }
 // Content/model strategies still require the original model route. This path
 // doesn't pretend numerical comparisons can perform content recognition.
 if(!allowContent&&execution.selectedStrategies.some(s=>s.execution==='模型理解'))return null;
 const explanations=execution.selectedStrategies.map(s=>({strategyId:s.id,explanation:s.businessMeaning||s.description||''}));
 const result=deliverMerchantRules({...input,...execution,explanations}).result;
 const fullMetrics=new Map(data.metricValues.map(m=>[m.id,m]));
 const withPrevious=e=>({...e,...(Number.isFinite(fullMetrics.get(e.metricId)?.previousValue)?{previousValue:fullMetrics.get(e.metricId).previousValue}:{})});
 result.evidence=result.evidence.map(withPrevious);
 result.diagnosis=result.diagnosis.map(d=>({...d,evidence:d.evidence.map(withPrevious)}));
 result.diagnosis.sort((a,b)=>execution.selectedStrategyIds.indexOf(a.strategyId)-execution.selectedStrategyIds.indexOf(b.strategyId));
 result.diagnosis=result.diagnosis.map(d=>{
  const s=assets.strategies.find(s=>s.id===d.strategyId),allowed=new Set(assets.metricDefinitions.map(m=>m.id));
  const evidence=[...new Map([...(d.evidence||[]),...(s?.diagnosticMetricIds||[]).filter(id=>allowed.has(id)).map(id=>{const m=fullMetrics.get(id),def=assets.metricDefinitions.find(m=>m.id===id);return {metricId:id,label:def.originalName||def.name,value:m?.value??null,previousValue:m?.previousValue,unit:def.unit};})].map(m=>[m.metricId,m])).values()];
  const finding={...d,diagnosticKind:s?.diagnosticKind,displayMetricIds:s?.displayMetricIds,evidence};
  const analysis=merchantEvidenceAnalysis(finding,result,assets.metricDefinitions);return {...finding,explanation:analysis.reason,analysis};
 });
 const suppressed=new Set(result.diagnosis.flatMap(d=>assets.strategies.find(s=>s.id===d.strategyId)?.suppressesStrategyIds||[]));
 result.diagnosis=result.diagnosis.filter(d=>!suppressed.has(d.strategyId));
 result.evidence=[...new Map([...result.evidence,...result.diagnosis.flatMap(d=>d.evidence)].map(m=>[m.metricId,m])).values()];
 result.explanationSource='evidence_analysis';
 result.coverage={frameworks:executions.filter(e=>e.selectedFramework.active).map(e=>({id:e.selectedFramework.id,name:e.selectedFramework.name,version:e.selectedFramework.version})),selectedStrategyCount:execution.selectedStrategies.length,evaluatedStrategyCount:execution.ruleResults.length};
 if(wholeStore){result.execution.frameworks=result.coverage.frameworks;result.execution.frameworkName=`全店综合诊断（${result.coverage.frameworks.length}个已发布框架）`;}
 updates.push({kind:'plan',frameworkName:execution.selectedFramework.name,frameworkVersion:execution.selectedFramework.version,steps:execution.diagnosisPlan.steps.map(s=>s.branchName),strategyCount:execution.selectedStrategies.length,errors:execution.validationErrors});
 updates.push({kind:'evidence',metrics:[...new Map([...result.evidence,...result.metricAnalysis].map(m=>[m.metricId,m])).values()],source:data.source,errors:data.errors});
 updates.push({kind:'findings',findings:result.diagnosis.map(d=>({name:d.name,evidence:d.evidence})),errors:[...execution.validationErrors,...execution.ruleResults.filter(r=>r.applies&&r.matched===null).map(r=>r.name+'：'+r.reason)]});
 return {result,updates,route:intent==='goal'?'goal_calculation':'published_rules'};
}
