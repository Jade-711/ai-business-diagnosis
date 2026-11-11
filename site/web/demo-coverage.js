'use strict';

// Explicit demonstration rules, editable in AIDD. These are not industry benchmarks.
function aiddCompleteDemoCoverage(data){
 if(data.demoCoverageVersion===2)return;
 for(const scene of data.scenes.filter(s=>s.code===`DEMO_SCENE_${s.fieldKey}`.toUpperCase())){
  const field=MERCHANT_FIELDS[scene.fieldKey];if(!field)continue;
  const frames=data.frameworks.filter(f=>f.sceneId===scene.id),frame=frames[0];
  const untouched=scene.status==='待生效'&&(scene.version||1)===1&&frames.every(f=>!f.generation&&!f.reviewPassed);
  // Never reactivate a scene deliberately taken offline, or overwrite a user's draft.
  if(scene.status!=='生效中'&&!untouched)continue;
  if(untouched){scene.status='生效中';if(frame){frame.status='生效中';frame.stage='active';frame.production='演示预置';}}
  // Older saved demos only defined four metrics. Add the assets referenced by
  // the new demo rules before rebuilding their published snapshots.
  for(const [metricKey,metric] of Object.entries(field.metrics))for(const derived of ['value','change']){
   const id=`${scene.fieldKey}-${metricKey}-${derived}`;
   if(!data.metrics.some(m=>m.id===id))data.metrics.push({id,code:`DEMO_${scene.fieldKey}_${metricKey}_${derived}`.toUpperCase(),name:`${field.name}${metric.label}${derived==='change'?'环比变化':''}`,fieldKey:scene.fieldKey,metricKey,derived,unit:derived==='change'?'%':metric.unit,dataType:'Double',source:'AiDS',table:`demo_${scene.fieldKey}_business`,sourceField:metricKey,conditionId:`condition-${scene.fieldKey}`,description:'演示看板的同口径指标，用于验证流程；真实数据服务未接入。',derivations:['环比','均值'],updatedAt:'2026/10/27 18:00'});
   if(!scene.metricIds.includes(id))scene.metricIds.push(id);
  }
  const previous=data.published[scene.id];
  const periods=previous?.periods?clone(previous.periods):previous?.period?{[previous.period]:clone(previous)}:{};
  for(const period of ['week','day']){
   const strategies=(periods[period]?.strategies||[]).map(x=>clone(x));
   let group=data.groups.find(g=>g.sceneId===scene.id&&g.period===period);
   if(!group){group={id:`demo-group-${scene.fieldKey}-${period}`,sceneId:scene.id,name:`${field.name}指标变化（${period==='week'?'近7天':'昨日'}）`,mode:'策略优先级执行',period,tags:'跃迁期',prompt:'按同口径指标变化定位核查环节，演示阈值不代表业务验收标准。',priority:1};data.groups.push(group);}
   for(const [index,[key,metric]] of Object.entries(field.metrics).entries()){
    const changeId=`${scene.fieldKey}-${key}-change`,valueId=`${scene.fieldKey}-${key}-value`;
    const covered=strategies.some(s=>{const walk=r=>r?.children?r.children.some(walk):r?.metricId===changeId;return walk(s.rule);});
    if(covered)continue;
    const issue=field.issues?.find(i=>i.metric===key),id=`demo-${scene.fieldKey}-${period}-${key}`;
    let action=data.actions.find(a=>a.id===`demo-action-${scene.fieldKey}-${key}`)||data.actions.find(a=>scene.actionIds.includes(a.id)&&a.metricIds?.includes(valueId));
    if(!action){action={id:`demo-action-${scene.fieldKey}-${key}`,code:`DEMO_REVIEW_${scene.fieldKey}_${key}`.toUpperCase(),name:`核查${metric.label}变化`,executionName:`核查${metric.label}变化`,type:'展示型',category:'经营检查',priority:index+1,description:field.hints[key]||'对照同口径数据和实际经营记录核查变化。',subtitle:field.hints[key]||'对照经营记录进一步核查。',fieldKey:scene.fieldKey,metricIds:[valueId],pcLink:'',mobileLink:'',conditions:'具备对应经营数据',exclusions:'已完成或不适用的事项',updatedAt:'2026/10/27 16:00'};data.actions.push(action);scene.actionIds.push(action.id);}
    const strategy={id,sceneId:scene.id,groupId:group.id,name:issue?.title||`${metric.label}变化需核查`,description:'对比同口径周期变化，定位需要进一步核查的经营环节。',businessMeaning:key==='newBuyerRate'?'用户结构变化不直接等同于经营变差。':`${metric.label}的变化提示需要进一步核查。`,merchantScope:'跃迁期',period,priority:index+1,status:'生效中',enabled:true,version:1,production:'演示预置',execution:'指标规则',metricIds:[valueId,changeId],actionIds:[action.id],actionSubtitles:{[action.id]:action.subtitle},actionTrigger:'match',rule:{join:'AND',children:[{metricId:changeId,op:'<=',rightType:'number',value:issue?.threshold??-15}]},thresholdBasis:'演示预置阈值，用于验证流程；实际经营阈值需业务校验。',createdAt:'2026/10/27 16:00',updatedAt:'2026/10/27 16:00'};
    strategies.push(strategy);if(!data.strategies.some(s=>s.id===id))data.strategies.push(clone(strategy));
   }
   const sceneMetrics=data.metrics.filter(m=>scene.metricIds.includes(m.id));
   periods[period]={...(periods[period]||{}),sceneId:scene.id,fieldKey:scene.fieldKey,period,version:scene.version||1,framework:frame?.prompt||frame?.logic||field.intro,strategies,metrics:clone(sceneMetrics),actions:clone(data.actions.filter(a=>scene.actionIds.includes(a.id))),active:true,demo:true,source:'演示预置配置'};
  }
  data.published[scene.id]={periods,publishedAt:previous?.publishedAt||0};
 }
 data.demoCoverageVersion=2;
}
