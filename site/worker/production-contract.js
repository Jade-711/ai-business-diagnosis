// Stage-specific production materials. Only the selected method's inputs are
// copied from the authenticated, ten-minute request snapshot.
export function productionMaterials(job={},selection={}){
 const operation=selection.operation||job.operation||'',phase=selection.phase||job.phase||'generate',strategyMode=selection.strategyMode||job.strategyMode||'ai';
 const errors=[];
 if(!['generate_framework','generate_strategies'].includes(operation))errors.push('请选择框架或策略生产。');
 if(!['generate','confirm','test'].includes(phase))errors.push('请选择生成、确认或试跑阶段。');
 if(!['ai','manual','content'].includes(strategyMode))errors.push('请选择AI指标、人工规则或内容标准。');
 for(const key of ['operation','phase','strategyMode'])if(selection[key]&&job[key]&&selection[key]!==job[key])errors.push('本次选择与资料请求不一致。');
 const result={operation,phase,strategyMode,frameworkName:String(job.frameworkName||job.name||job.sourceFramework?.name||''),scenes:job.scenes||[],metrics:job.metrics||[],actions:job.actions||[],goal:job.goal||'',scope:job.scope||'',knowledge:[],prompt:'',sourceFramework:job.sourceFramework||{},trialCases:[],review:{},candidateFramework:{},candidateStrategies:[],manualStrategies:[],parsed:job.parsed===true,route:'invalid',inputErrors:errors};
 if(operation==='generate_framework'){
  const metricIds=new Set(result.metrics.map(m=>m.id)),actionIds=new Set(result.actions.map(a=>a.id));
  result.scenes=result.scenes.map(scene=>({...scene,metricIds:(scene.metricIds||[]).filter(id=>metricIds.has(id)),actionIds:(scene.actionIds||[]).filter(id=>actionIds.has(id))}));
 }
 if(!result.scenes.length)errors.push('请选择本次生产的场景。');
 if(!result.metrics.length)errors.push('请选择当前生产方式使用的指标或内容资产。');
 if(phase==='generate'&&!(operation==='generate_strategies'&&strategyMode==='manual')){
  result.prompt=operation==='generate_framework'?'':String(job.prompt||'').trim();result.knowledge=Array.isArray(job.knowledge)?job.knowledge:[];
  if(!result.goal.trim()||!result.scope.trim())errors.push('请填写本次生产的目标和适用范围。');
  if(operation!=='generate_framework'&&!result.prompt)errors.push('请填写当前生产方式的Prompt或内容判断标准。');
  result.route=operation==='generate_framework'?'framework':strategyMode;
 }else{
  result.review=job.review||{};result.candidateFramework=job.candidateFramework||{};result.candidateStrategies=job.candidateStrategies||[];
  result.manualStrategies=strategyMode==='manual'?(job.manualStrategies||job.candidateStrategies||[]):[];
  result.goal=result.goal||result.manualStrategies[0]?.businessMeaning||result.manualStrategies[0]?.name||'审核诊断资产';
  result.scope=result.scope||result.manualStrategies[0]?.merchantScope||'当前场景适用商家';
  if(phase==='confirm'&&(!result.review.confirmed||!String(result.review.reviewer||'').trim()))errors.push('请由产运确认审核结果并提供审核者。');
  if(phase==='test'){
   result.trialCases=Array.isArray(job.trialCases)?job.trialCases:[];
   if(!result.trialCases.length)errors.push('请选择本次需要试跑的案例。');
  }
  const structured=strategyMode==='manual'||result.parsed;
  if(!structured&&!String(result.review.reviewedText||'').trim())errors.push('请提交本次审核或临时试跑的正文。');
  result.route=structured?'configured':'parse';
  if(phase==='generate'&&strategyMode==='manual')result.route='configured';
 }
 if(operation==='generate_strategies'&&(!result.sourceFramework.id||result.sourceFramework.active!==true))errors.push('请先选择当前场景已发布的诊断框架。');
 if(operation==='generate_strategies'&&result.sourceFramework.sceneId&&!result.scenes.some(s=>s.id===result.sourceFramework.sceneId))errors.push('已发布框架与所选场景不匹配。');
 if(operation==='generate_framework'&&result.route==='parse'){
  const current=result.candidateFramework.id?result.candidateFramework:result.sourceFramework;
  const identity={id:current.id||'',name:current.name||result.frameworkName,sceneId:current.sceneId||result.scenes[0]?.id||'',version:current.version||1};
  // The current review text is authoritative; old previews are not comparison inputs.
  result.candidateFramework=identity;result.sourceFramework={...identity,active:false};
 }
 if(errors.length)result.route='invalid';
 return result;
}
