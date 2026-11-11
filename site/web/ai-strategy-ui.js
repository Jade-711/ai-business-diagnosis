'use strict';

const AIDD_AI_ROLE='你是快手电商经营诊断策略设计专家。你可以理解业务目标与指标口径，组合可执行的诊断规则，匹配行动建议，并说明阈值和触发条件的依据。请根据以下业务目标、指标资产和评估依据，生成可复用的经营诊断策略。';
const AIDD_AI_OUTPUT='策略名称＋业务含义、适用范围、指标阈值、触发条件＋依据、关联行动点、异常处理、审核状态。';
const AIDD_AI_METHODS=[
 '选择相关指标和候选阈值，说明选择依据。',
 '将适用门槛与异常条件组合成明确的逻辑表达式，使用四则运算、比较符号和 AND / OR。',
 '从行动点库中选择匹配项，说明推荐理由和启用条件。',
 '结论限定在指标支持的异常环节；具体原因需额外证据。',
 '先检查数据和样本，再进行除法计算。缺数据或不可比时返回“无法判断”，样本不足时返回“样本不足”。',
 '输出保持“待审核”，缺少依据的内容列为待补项。'
];
function aiddAIInputs(){
 const form=$('#aidd-ai-form');if(!form)return clone(aiddUI.aiInputs||{sceneIds:[],goal:'',scope:'',metricIds:[],actionIds:[]});
 const data=new FormData(form);return {sceneIds:data.getAll('aiSceneIds'),goal:String(data.get('goal')||'').trim(),scope:String(data.get('scope')||'').trim(),metricIds:data.getAll('aiMetricIds'),actionIds:data.getAll('aiActionIds'),strategyMode:String(data.get('strategyMode')||'ai'),prompt:String(data.get('prompt')||'').trim()};
}
function aiddAIAssets(inputs){
 const scenes=aiddData.scenes.filter(scene=>inputs.sceneIds.includes(scene.id)),metrics=new Set(scenes.flatMap(scene=>scene.metricIds)),actions=new Set(scenes.flatMap(scene=>scene.actionIds));
 return {scenes,metrics:aiddData.metrics.filter(metric=>metrics.has(metric.id)),actions:aiddData.actions.filter(action=>actions.has(action.id))};
}
function aiddAITemplates(inputs){
 const scenes=aiddAIAssets(inputs).scenes,names=scenes.map(scene=>fieldData(scene.fieldKey).name).join('、')||'当前场景',live=scenes.length===1&&scenes[0].fieldKey==='live';
 return {goal:live?'识别直播商品曝光规模基本稳定，但商品点击效率明显下降的商家，关联适合的行动建议。':`识别${names}经营中的关键异常环节，依据所选指标定位主要问题，并关联适合的行动建议。`,scope:`适用人群：${[...new Set(scenes.map(scene=>scene.merchantScope).filter(Boolean))].join('、')||'请填写适用商家范围'}。规则在不同统计周期共用，执行时按本次选择的当前与前周期取数。`};
}
function aiddAIPicker(name,label,items,selected,kind){
 const description=item=>kind==='scene'?item.merchantScope||'已配置场景':kind==='metric'?`${item.description||item.name} · 单位：${item.unit}`:item.subtitle||item.description||'已配置行动建议';
 return `<fieldset class="ai-input-picker" data-ai-picker="${name}"><legend>${label}${kind==='action'?'（可选）':' *'}<span>可多选 · 已选 <b>${selected.length}</b> 项</span></legend>${kind==='scene'?'':`<input type="search" class="input ai-option-search" data-ai-pick-search aria-label="搜索${label}" placeholder="搜索名称或说明">`}<div class="ai-option-list ${kind==='scene'?'ai-scene-options':''}">${items.map(item=>`<label class="ai-option"><input type="checkbox" name="${name}" value="${esc(item.id)}" ${selected.includes(item.id)?'checked':''}><span><strong>${esc(item.name)}</strong><small>${esc(description(item))}</small></span></label>`).join('')||'<p class="ai-options-empty">请先选择场景，再选择可用资产。</p>'}</div><p class="ai-no-options" hidden>没有匹配的选项</p></fieldset>`;
}
function aiddStrategyTemplate(inputs=aiddAIInputs()){
 const asset=aiddAIAssets(inputs),metrics=asset.metrics.filter(metric=>inputs.metricIds.includes(metric.id)),actions=asset.actions.filter(action=>inputs.actionIds.includes(action.id));
 return `【角色和能力边界】\n${AIDD_AI_ROLE}\n\n【输入】\n【场景】\n${asset.scenes.map(scene=>scene.name).join('、')||'待选择'}\n【目标】\n${inputs.goal||'待填写'}\n【适用范围】\n${inputs.scope||'待填写'}\n【可用指标】\n${metrics.map(metric=>`${metric.name}：${metric.description||'以已配置口径为准'}；单位 ${metric.unit} [${metric.id}]`).join('\n')||'待选择'}\n只允许使用以上指标及其已配置的衍生能力进行计算，不补造未选择的取数来源。\n【可用建议】\n${actions.map(action=>`${action.code||action.id}：${action.executionName||action.name}；${action.subtitle||action.description||''}；启用条件：${action.conditions||'需进一步确认适用条件'}`).join('\n')||'本次不关联行动点'}\n\n【输出】\n${AIDD_AI_OUTPUT}\n\n【方法限制】\n${AIDD_AI_METHODS.map((text,index)=>`${index+1}. ${text}`).join('\n')}`;
}
function aiddOpenAIGenerator(){
 const scene=aiddScene(),inputs={sceneIds:[scene.id],goal:'',scope:'',metricIds:[],actionIds:[]};aiddUI.aiInputs=inputs;aiddUI.aiCandidates=[];aiddUI.candidate=null;
 const assets=aiddAIAssets(inputs),templates=aiddAITemplates(inputs);
 modal('AI生产策略','选择诊断资产，生成可复用的策略候选。',`<div class="ai-strategy-production"><section class="ai-role-block"><h3>${icon('spark')}角色和能力边界</h3><p>${AIDD_AI_ROLE}</p></section><form id="aidd-ai-form">${aiddField('生产方式',aiddSelect('strategyMode',[['ai','AI指标策略'],['content','内容合格标准']],'ai'))}<h3 class="ai-section-heading">输入</h3>${aiddAIPicker('aiSceneIds','场景',aiddData.scenes,inputs.sceneIds,'scene')}<p class="form-help ai-scene-help">多选场景时，将按场景分别生成策略候选。</p><div class="ai-text-input-columns">${aiddField('目标 *',aiddTextarea('goal','',2,'id="ai-strategy-goal" required maxlength="1000" placeholder="请输入本次策略希望识别的经营问题"')+`<div class="frame-template"><span>模板参考：<span id="ai-goal-template">${esc(templates.goal)}</span></span><button type="button" class="text-btn" data-ai-input-template="goal">使用目标模板</button></div>`)}${aiddField('适用范围 *',aiddTextarea('scope','',3,'id="ai-strategy-scope" required maxlength="1000" placeholder="请填写适用商家人群、统计周期与比较范围"')+`<div class="frame-template"><span>模板参考：<span id="ai-scope-template">${esc(templates.scope)}</span></span><button type="button" class="text-btn" data-ai-input-template="scope">使用范围模板</button></div>`)}</div><div class="ai-asset-columns"><div id="ai-metric-options">${aiddAIPicker('aiMetricIds','可用指标',assets.metrics,[],'metric')}</div><div id="ai-action-options">${aiddAIPicker('aiActionIds','行动建议',assets.actions,[],'action')}</div></div>${aiddField('本次生产 Prompt / 内容判断标准 *',aiddTextarea('prompt','根据所选场景、目标和资产生产可解释的诊断策略，明确阈值依据与适用条件。',4,'required maxlength="3000"'))}<p class="form-help">先选择生产方式，再填写本次目标、范围和Prompt；行动建议可选。内容标准需选择对应标题或图片资产。</p><p class="aidd-form-error" id="aidd-ai-input-error" role="alert"></p></form><section class="ai-output-contract"><h3>输出</h3><p id="ai-production-output">${AIDD_AI_OUTPUT}</p></section><section class="ai-method-contract"><h3>方法限制</h3><ol id="ai-production-methods">${AIDD_AI_METHODS.map(text=>`<li>${text}</li>`).join('')}</ol></section><details class="ai-prompt-preview"><summary>查看完整 Prompt 模板</summary><pre id="ai-strategy-prompt">${esc(aiddStrategyTemplate(inputs))}</pre></details><p class="ai-demo-note">${aiddIsOnline()?'本次通过 AIDD 后台生成策略候选，仍需人工审核与试跑。':'当前为生成示例，所选内容不发送至实际模型。'}</p><div id="aidd-candidate-output"></div></div>`,`${cancelModalBtn()}<button class="btn ai-gradient" data-aidd-ai-generate>${icon('spark')}生成策略候选</button>`,true);
 $('.modal').classList.add('ai-production-modal');
}
function aiddResetAIOutput(){
 if(!aiddUI.aiCandidates?.length)return;aiddUI.aiCandidates=[];aiddUI.candidate=null;$('#aidd-candidate-output').innerHTML='';$('.modal-footer').innerHTML=`${cancelModalBtn()}<button class="btn ai-gradient" data-aidd-ai-generate>${icon('spark')}生成策略候选</button>`;
}
function aiddRefreshAIInputs(sceneChanged=false){
 let inputs=aiddAIInputs();
 if(sceneChanged){
  const assets=aiddAIAssets(inputs);inputs.metricIds=inputs.metricIds.filter(id=>assets.metrics.some(metric=>metric.id===id));inputs.actionIds=inputs.actionIds.filter(id=>assets.actions.some(action=>action.id===id));
  $('#ai-metric-options').innerHTML=aiddAIPicker('aiMetricIds','可用指标',assets.metrics,inputs.metricIds,'metric');$('#ai-action-options').innerHTML=aiddAIPicker('aiActionIds','行动建议',assets.actions,inputs.actionIds,'action');
  const templates=aiddAITemplates(inputs);$('#ai-goal-template').textContent=templates.goal;$('#ai-scope-template').textContent=templates.scope;
 }
 aiddUI.aiInputs=inputs;
 $$('[data-ai-picker]').forEach(group=>{const count=$('legend b',group);if(count)count.textContent=$$('input[type="checkbox"]:checked',group).length;});
 $('#ai-strategy-prompt').textContent=aiddStrategyTemplate(inputs);$('#aidd-ai-input-error').textContent='';aiddResetAIOutput();
}
function aiddValidateAIInputs(inputs){
 if(!inputs.sceneIds.length)return '请至少选择一个场景。';if(!inputs.goal.trim()||!inputs.scope.trim())return '请填写目标和适用范围，也可以使用模板后修改。';
 if(!inputs.metricIds.length)return '请至少选择一个可用指标或内容资产。';
 const assets=aiddAIAssets(inputs);
 if(inputs.strategyMode==='content'&&!assets.metrics.some(m=>inputs.metricIds.includes(m.id)&&['String','Image'].includes(m.dataType)))return '内容标准生产需要选择商品名称或商品主图资产。';
 if(inputs.metricIds.some(id=>!assets.metrics.some(metric=>metric.id===id))||inputs.actionIds.some(id=>!assets.actions.some(action=>action.id===id)))return '部分指标或行动建议已不可用，请重新选择。';
 for(const id of inputs.sceneIds){const scene=aiddData.scenes.find(item=>item.id===id);if(!scene)return '部分场景已不存在，请重新选择。';if(!scene.metricIds.some(metricId=>inputs.metricIds.includes(metricId)))return `请为“${scene.name}”至少选择一个可用指标。`;}
 return '';
}
function aiddBuildSceneCandidate(scene,inputs){
 const metrics=aiddData.metrics.filter(metric=>inputs.metricIds.includes(metric.id)&&scene.metricIds.includes(metric.id)),actions=aiddData.actions.filter(action=>inputs.actionIds.includes(action.id)&&scene.actionIds.includes(action.id));
 const contentMetrics=metrics.filter(metric=>['String','Image'].includes(metric.dataType)),numeric=metrics.filter(metric=>!['String','Image'].includes(metric.dataType)),content=inputs.strategyMode==='content'||contentMetrics.length>0&&(!numeric.length||/主图|标题|内容理解/.test(inputs.goal));
 const wanted=/点击/.test(inputs.goal)?'clickRate':/支付转化|成交转化/.test(inputs.goal)?'payRate':/播放/.test(inputs.goal)?'plays':/曝光|流量/.test(inputs.goal)?'exposure':/成交|销售|GMV/i.test(inputs.goal)?'gmv':null;
 const primary=numeric.find(metric=>metric.metricKey===wanted&&metric.derived==='change')||numeric.find(metric=>metric.metricKey===wanted)||numeric.find(metric=>metric.derived==='change'&&actions.some(action=>action.metricIds.some(id=>aiddFind('metrics',id)?.metricKey===metric.metricKey)))||numeric.find(metric=>metric.derived==='change')||numeric[0];
 const pendingItems=[content?'内容判断标准与评估依据需结合实际证据补充并审核。':'候选阈值与评估依据需结合实际业务数据补充并审核。'],children=[];let threshold=-15;
 if(!content&&primary){
  if(wanted&&primary.metricKey!==wanted)pendingItems.push('目标涉及的指标未完整选择；当前仅能围绕已选指标生成候选，需补选指标或调整目标。');
  if(primary.derived!=='change')threshold=primary.unit==='%'?5:1000;
  const exposure=numeric.find(metric=>metric.metricKey==='exposure'&&metric.derived==='value');
  if(exposure&&exposure.id!==primary.id)children.push({metricId:exposure.id,op:'>=',rightType:'number',value:1000,factor:1});
  else pendingItems.push('未配置独立的样本量门槛，需确认样本充分性。');
  if(/曝光.*稳定|稳定.*曝光/.test(inputs.goal)){
   const exposureChange=numeric.find(metric=>metric.metricKey==='exposure'&&metric.derived==='change');
   if(exposureChange&&exposureChange.id!==primary.id)children.push({metricId:exposureChange.id,op:'>=',rightType:'number',value:-10,factor:1},{metricId:exposureChange.id,op:'<=',rightType:'number',value:10,factor:1});
   else pendingItems.push('目标涉及曝光稳定性，需补选曝光环比指标或调整目标。');
  }
  children.push({metricId:primary.id,op:'<=',rightType:'number',value:threshold,factor:1});
  if(primary.derived!=='change'&&/下降|回落/.test(inputs.goal))pendingItems.push('当前规则仅使用本期值，不能据此确认下降；需补充比较指标。');
 }
 if(content)pendingItems.push('内容服务与模型尚未接入，需要真实内容证据完成验证。');
 const matched=actions.filter(action=>content?/主图|标题|内容/.test(action.name):action.metricIds.some(id=>aiddFind('metrics',id)?.metricKey===primary.metricKey));
 if(actions.length&&!matched.length)pendingItems.push('已选建议与当前诊断指标的适配关系需人工确认。');
 const associated=matched.length?matched:[];
 const basicName=content?`${fieldData(scene.fieldKey).name}商品内容核查`:`${primary.name.replace('环比变化','')}${primary.derived==='change'?'回落':'偏低'}诊断`;
 let name=basicName,suffix=2;while(aiddData.strategies.some(strategy=>strategy.sceneId===scene.id&&strategy.name===name)){name=`${basicName}（候选${suffix++}）`;}
 const group=aiddEnsureStrategyGroup(scene.id),strategy={id:aiddId('strategy_ai'),sceneId:scene.id,name,groupId:group.id,group:group.name,description:inputs.goal,businessMeaning:content?'依据所选商品内容资产核查表达与一致性；证据不足时不判断具体原因。':`依据已选指标识别${primary.name.replace('环比变化','')}的${primary.derived==='change'?'回落环节':'当前值异常候选'}，不直接断言价格、选品或讲解原因。`,merchantScope:inputs.scope,priority:aiddSceneStrategies(scene.id).length+1,production:'AI辅助生成',execution:content?'模型理解':'指标规则',status:'待生效',reviewStatus:'待审核',enabled:!content,version:1,actionIds:associated.map(action=>action.id),actionSubtitles:Object.fromEntries(associated.map(action=>[action.id,`${action.subtitle||action.description||action.name} 启用条件：${action.conditions||'结合经营证据确认适用性。'}`])),actionTrigger:'match',rule:{join:'AND',children},contentObjects:contentMetrics.map(metric=>metric.name),contentJudgment:'不符合',contentPrompt:content?`${inputs.goal}\n仅检查已选内容：${contentMetrics.map(metric=>metric.name).join('、')}。缺少内容或证据时返回无法判断。`:'',threshold,minExposure:children.some(rule=>rule.value===1000)?1000:0,metric:'click_drop',operator:'<=',action:associated[0]?.name||'',thresholdBasis:content?'当前仅生成内容判断标准，实际内容与模型未接入，需补充执行证据后审核。':'当前为演示候选值，不代表已完成实际阈值评估，需补充评估依据。',exceptionHandling:'先校验数据完整性、可比性与样本量，再进行除法；缺数据或不可比时返回“无法判断”，样本不足时返回“样本不足”。',pendingItems,inputSnapshot:clone(inputs)};
 strategy.aiOriginal=clone({...strategy,aiOriginal:undefined});return strategy;
}
async function aiddBuildCandidate(){
 if(aiddUI.aiGenerating)return;
 const form=$('#aidd-ai-form');if(!form?.reportValidity())return;
 const inputs=aiddAIInputs(),error=aiddValidateAIInputs(inputs);if(error){aiddShowFormError('#aidd-ai-input-error',error);return;}
 const previousError=$('#aidd-ai-input-error');if(previousError)previousError.textContent='';
 const host=$('#aidd-candidate-output'),snapshot=JSON.stringify(inputs),startedAt=Date.now();let timer,candidates;aiddUI.aiGenerating=true;
 try{if(aiddIsOnline()){host.innerHTML='<p class="form-help" role="status">正在调用 DeepSeek 生成策略候选 · 已用时 <span id="strategy-generation-elapsed">0.0 秒</span>；完成后显示实际 Token 用量。</p>';timer=setInterval(()=>{const label=$('#strategy-generation-elapsed');if(label)label.textContent=aiddProductionDuration(Date.now()-startedAt);},1000);candidates=await cozeGenerateStrategies(inputs);if($('#aidd-candidate-output')!==host||JSON.stringify(aiddAIInputs())!==snapshot)return;}else candidates=inputs.sceneIds.map(id=>aiddBuildSceneCandidate(aiddData.scenes.find(scene=>scene.id===id),inputs));}catch(error){if($('#aidd-candidate-output')===host){host.innerHTML=error.productionUsage?aiddProductionUsageHTML({productionUsage:{generate:error.productionUsage}}):'';aiddShowFormError('#aidd-ai-input-error',error.message);}return;}finally{clearInterval(timer);aiddUI.aiGenerating=false;}
 aiddUI.aiInputs=clone(inputs);aiddUI.aiCandidates=candidates;aiddUI.candidate=candidates[0];aiddRenderCandidate();
}
function aiddCandidateText(strategy){
 return `策略名称：${strategy.name}\n业务含义：${strategy.businessMeaning}\n\n适用范围：\n${strategy.merchantScope}\n\n指标阈值与触发条件：\n${strategy.execution==='模型理解'?'无数值阈值。内容判断标准：'+strategy.contentPrompt:aiddRuleText(strategy.rule)}\n\n触发依据：\n${strategy.thresholdBasis}\n\n关联行动点：\n${strategy.actionIds.map(id=>`${aiddFind('actions',id)?.name}：${strategy.actionSubtitles[id]}`).join('\n')||'尚未关联行动建议，请补充后重新生成。'}\n\n异常处理：\n${strategy.exceptionHandling}\n\n审核状态：待审核\n待补项：\n${strategy.pendingItems.map((text,index)=>`${index+1}. ${text}`).join('\n')}`;
}
function aiddRenderCandidate(){
 const candidates=aiddUI.aiCandidates||[];
 $('#aidd-candidate-output').innerHTML=`<section class="ai-candidates"><div class="ai-candidates-heading"><h3>策略候选 · ${candidates.length} 条</h3>${pill('待审核','purple')}</div>${candidates.map(strategy=>`<article class="ai-generated-card"><div class="row"><h4>${esc(aiddScene(strategy.sceneId).name)}</h4>${pill(strategy.execution,'outline')}</div>${aiddProductionUsageHTML(strategy)}<label class="form-help" for="strategy-review-${esc(strategy.id)}">审核并修改策略正文</label><textarea class="input production-review-text" rows="12" id="strategy-review-${esc(strategy.id)}" data-strategy-review="${esc(strategy.id)}">${esc(strategy.productionDraftText||aiddCandidateText(strategy))}</textarea>${aiddProductionDelivery(strategy)}</article>`).join('')}<p class="form-help">确认后解析为待生效策略，不会自动发布。可调整上方五项输入后重新生成。</p><p class="aidd-form-error" id="aidd-candidate-error" role="alert"></p></section>`;
 $('.modal-footer').innerHTML=`<button class="btn" data-aidd-ai-generate>${icon('refresh')}重新生成</button><button class="btn" data-aidd-candidate-test>临时解析并试跑</button><button class="btn ai-gradient" data-aidd-candidate-confirm>确认并解析入库 ${icon('arrow')}</button>`;
 $('#aidd-candidate-output').scrollIntoView({block:'start',behavior:'smooth'});
}
function aiddReadCandidate(){return clone(aiddUI.aiCandidates?.[0]||aiddUI.candidate);}
function aiddStrategyTrialReportHTML(report){
 if(!report?.executed)return `<p class="form-help">${esc(report?.limitations?.join('；')||'尚未执行策略规则试跑。')}</p>`;
 if(report.analysisMode!=='strategy_rule_trial')return '<p class="form-help">请重新试跑以取得本次策略的规则与适用条件结果。</p>';
 const value=(number,unit)=>Number.isFinite(number)?number.toLocaleString('zh-CN',{maximumFractionDigits:2})+esc(unit||''):'未提供';
 return `<div class="frame-trial-result"><h3>策略规则试跑</h3>${(report.cases||[]).map(item=>`<section class="trial-case"><h4>${esc(item.label)}</h4>${(item.ruleResults||[]).map(rule=>`<section><strong>${esc(rule.name)}</strong><p>适用范围：${rule.applies?'符合':'未满足'} · 规则结果：${rule.matched===null?'无法判断':rule.matched?'满足':'不满足'} · 行动触发条件：${rule.triggered?'满足':'未满足'}</p><p>${esc(rule.reason)}</p></section>`).join('')||'<p>规则暂无法判断。</p>'}${item.missing?.length?`<p class="form-help">待补充：${esc(item.missing.join('；'))}</p>`:''}<div class="table-wrap"><table><thead><tr><th>关联指标</th><th>本期</th><th>前周期</th></tr></thead><tbody>${(item.evidence||[]).map(row=>`<tr><td>${esc(row.label)}</td><td>${value(row.value,row.unit)}</td><td>${value(row.previousValue,row.unit)}</td></tr>`).join('')}</tbody></table></div></section>`).join('')}<p class="form-help">${esc(report.limitations?.join('；')||'报告用于核验规则及适用条件，经营原因与行动仍需人工审核。')}</p></div>`;
}
async function aiddTestCandidate(){
 if(aiddUI.testingCandidate||!aiddIsOnline())return;
 const previousError=$('#aidd-candidate-error');if(previousError)previousError.textContent='';
 aiddUI.testingCandidate=true;
 try{
  const reports=[];
  for(const strategy of aiddUI.aiCandidates||[]){const text=$(`[data-strategy-review="${strategy.id}"]`)?.value.trim()||strategy.productionDraftText||aiddCandidateText(strategy);const checked=await cozeReviewStrategy(strategy,text,'test');reports.push(`<h4>${esc(strategy.name)}</h4>${aiddProductionUsageHTML(checked)}${aiddStrategyTrialReportHTML(checked.productionTrial)}`);}
  let panel=$('#aidd-production-test-report');if(!panel){panel=document.createElement('section');panel.id='aidd-production-test-report';$('#aidd-candidate-output').append(panel);}panel.innerHTML=reports.join('')+'<p class="form-help">请核验这份报告；尚未确认、入库或发布。</p>';
 }catch(error){aiddShowFormError('#aidd-candidate-error',error.message);}finally{aiddUI.testingCandidate=false;}
}
async function aiddConfirmCandidate(){
 let candidates=(aiddUI.aiCandidates||[]).map(clone);if(!candidates.length||aiddUI.confirmingCandidate)return;
 const previousError=$('#aidd-candidate-error');if(previousError)previousError.textContent='';
 aiddUI.confirmingCandidate=true;
 try{
  if(aiddIsOnline()){
   const checked=[];
   for(const strategy of candidates){const text=$(`[data-strategy-review="${strategy.id}"]`)?.value.trim()||strategy.productionDraftText||aiddCandidateText(strategy);checked.push(await cozeReviewStrategy(strategy,text));}
   candidates=checked;
  }
 }catch(error){aiddShowFormError('#aidd-candidate-error',error.message);return;}finally{aiddUI.confirmingCandidate=false;}
 for(const strategy of candidates){
  const error=aiddValidateAIInputs(strategy.inputSnapshot)||aiddValidateStrategy(strategy),allowed=new Set(strategy.inputSnapshot.metricIds),unselected=aiddStrategyMetricIds(strategy).some(id=>!allowed.has(id))||strategy.actionIds.some(id=>!strategy.inputSnapshot.actionIds.includes(id));
  if(error||unselected){aiddShowFormError('#aidd-candidate-error',`“${strategy.name}”未完成解析：${error||'引用了未选择的指标或行动建议'}。请调整五项输入后重新生成。`);return;}
 }
 candidates.forEach(strategy=>{strategy.createdAt=aiddNow();strategy.updatedAt=strategy.createdAt;strategy.protocol=aiddProtocol(strategy);strategy.humanModified=!!strategy.productionDraftText;aiddData.strategies.push(strategy);});
 aiddSyncLegacyDraft();saveAidd();closeModal();render();toast(`已解析 ${candidates.length} 条策略，保留待审核、待生效状态`);
}
document.addEventListener('click',event=>{
 if(event.target.closest('[data-aidd-candidate-test]')){aiddTestCandidate();return;}
 const button=event.target.closest('[data-ai-input-template]');if(!button)return;
 const type=button.dataset.aiInputTemplate,templates=aiddAITemplates(aiddAIInputs());$(type==='goal'?'#ai-strategy-goal':'#ai-strategy-scope').value=templates[type];aiddRefreshAIInputs();
});
document.addEventListener('change',event=>{if(['aiSceneIds','aiMetricIds','aiActionIds'].includes(event.target.name))aiddRefreshAIInputs(event.target.name==='aiSceneIds');if(event.target.name==='strategyMode'){const input=$('#aidd-ai-form [name=prompt]'),old=aiddUI.aiInputs?.strategyMode||'ai',mode=event.target.value;aiddUI.aiModePrompts=aiddUI.aiModePrompts||{};aiddUI.aiModePrompts[old]=input.value;input.value=aiddUI.aiModePrompts[mode]||(mode==='content'?'为所选商品标题或主图定义可复用的合格标准，区分通过、不通过和资料不足，列出判断依据；不声称已检查真实商品。':'根据所选场景、目标和资产生产可解释的诊断策略，明确阈值依据与适用条件。');$('#ai-production-output').textContent=mode==='content'?'内容标准名称、适用范围、判断对象、通过 / 不通过 / 无法判断标准、可选行动点、待审核状态。':AIDD_AI_OUTPUT;$('#ai-production-methods').innerHTML=(mode==='content'?['仅定义标准，不假装检查了真实商品。','使用所选内容资产与业务资料，明确合格、不合格及证据不足的边界。','产运审核后确认入库；真实商品内容判断执行器尚未接入。']:AIDD_AI_METHODS).map(text=>'<li>'+esc(text)+'</li>').join('');aiddRefreshAIInputs();}});
document.addEventListener('input',event=>{
 const input=event.target;
 if(['ai-strategy-goal','ai-strategy-scope'].includes(input.id))aiddRefreshAIInputs();
 if(input.hasAttribute('data-ai-pick-search')){const group=input.closest('.ai-input-picker'),query=input.value.trim().toLowerCase();let visible=0;$$('.ai-option',group).forEach(option=>{option.hidden=!option.textContent.toLowerCase().includes(query);if(!option.hidden)visible++;});$('.ai-no-options',group).hidden=visible>0;}
});
document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.hasAttribute('data-ai-pick-search'))event.preventDefault();});
