'use strict';
const aiddFrameJobs=new Map();

function aiddUpgradeFrameworks(){
 let changed=false;
 aiddData.frameworks.forEach((frame,index)=>{
  if(frame.status==='待生效'&&frame.trial&&frame.trial.report?.analysisMode!=='draft_framework_diagnosis'){
   frame.reviewPassed=false;frame.protocolConfirmed=false;frame.protocolDraftFingerprint='';changed=true;
  }
  if(frame.workflowSchema===1)return;
  const scene=aiddData.scenes.find(item=>item.id===frame.sceneId);
  frame.id=frame.id||`framework-${frame.sceneId}-${index}`;
  frame.metricIds=frame.metricIds||clone(scene?.metricIds||[]);
  frame.actionIds=frame.actionIds||clone(scene?.actionIds||[]);
  frame.status=['已配置','生效中'].includes(frame.status)?'生效中':'待生效';
  frame.stage=frame.status==='生效中'?'active':'config';
  frame.draftText=frame.draftText||frame.prompt||'';
  frame.generation=frame.generation||0;
  frame.workflowSchema=1;
  changed=true;
 });
 if(changed)saveAidd();
}

function aiddSelectedFrame(){return aiddData.frameworks.find(frame=>frame.id===aiddUI.frameId);}
function aiddFrameScene(frame){return aiddData.scenes.find(scene=>scene.id===frame.sceneId);}
function aiddFrameworkHeaderActions(){return aiddUI.frameView==='list'?`<button class="btn primary" data-frame-new>${icon('plus')}新建诊断框架</button>`:'';}
function aiddFrameBack(){return `<a class="text-btn frame-back" href="#aidd" data-frame-back>${icon('chev')}返回框架列表</a>`;}
function aiddFrameSteps(step){return `<div class="frame-steps" aria-label="框架生产流程"><span class="${step===1?'current':'done'}"><i>${step===1?'1':icon('check')}</i>配置内容</span><b>${icon('chev')}</b><span class="${step===2?'current':''}"><i>2</i>审核与发布</span></div>`;}
function aiddProductionStatusCounts(items){return `<span class="frame-count">${['生效中','待生效','已失效'].map(status=>`${status} ${items.filter(item=>item.status===status).length}`).join('<i></i>')}</span>`;}
function aiddFrameList(){
 const all=aiddData.frameworks.filter(frame=>['生效中','待生效','已失效'].includes(frame.status)),rank={'生效中':0,'待生效':1,'已失效':2};
 const rows=all.filter(frame=>(aiddUI.status==='all'||frame.status===aiddUI.status)&&aiddMatchesField(frame,'framework')&&`${frame.name} ${aiddFrameScene(frame)?.name||''}`.toLowerCase().includes(aiddUI.query.toLowerCase())).sort((a,b)=>rank[a.status]-rank[b.status]);
 return `<div class="card aidd-table-card frame-list"><div class="aidd-card-intro"><div class="row"><h2>诊断框架列表</h2>${aiddProductionStatusCounts(all)}</div></div>${aiddSearchBar('搜索框架名称或关联场景',aiddSelect('status',[['all','全部状态'],['生效中','生效中'],['待生效','待生效'],['已失效','已失效']],aiddUI.status,'aria-label="框架状态"')+aiddFieldFilter())}<div class="table-wrap"><table><thead><tr><th>框架名称</th><th>场域</th><th>关联场景</th><th>关联资产</th><th>状态</th><th>版本 / 更新时间</th><th>操作</th></tr></thead><tbody>${aiddPage(rows).map(frame=>`<tr><td><strong class="strategy-name">${esc(frame.name)}</strong>${frame.baseId?'<small class="aidd-cell-note">配置变更版本</small>':''}</td><td>${esc(aiddFieldName(aiddAssetField(frame,'framework')))}</td><td>${esc(aiddFrameScene(frame)?.name||'原关联场景已移除')}</td><td>${frame.metricIds.length} 个指标 · ${frame.actionIds.length} 个行动建议</td><td>${aiddBadge(frame.status)}${frame.status==='待生效'?`<small class="aidd-cell-note">${frame.stage==='config'?'待配置':frame.trial?'待人工验收':frame.protocolConfirmed?'待灰度发布':'待审核确认'}</small>`:''}</td><td>v${frame.version||1}<small class="aidd-cell-note">${esc(frame.updatedAt||'—')}</small>${aiddProductionUsageHTML(frame,true)}</td><td><div class="aidd-row-actions"><button class="table-action" data-frame-open="${esc(frame.id)}">${frame.status!=='待生效'?'查看详情':frame.stage==='config'?'配置':'继续生产'}</button>${frame.status==='生效中'?`<button class="table-action muted-action" data-frame-offline="${esc(frame.id)}">下线</button>`:''}${frame.status==='已失效'?`<button class="table-action danger" data-aidd-delete="frameworks|${esc(frame.id)}">删除</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="7" class="empty-search">没有匹配的诊断框架</td></tr>'}</tbody></table></div>${aiddPager(rows.length)}</div>`;
}
function aiddFrameAssetPicker(name,items,ids,label){const scene=aiddFrameScene(aiddUI.frameEditing),score=item=>Number(ids.includes(item.id))*2+Number(item.fieldKey===scene?.fieldKey),ordered=items.slice().sort((a,b)=>score(b)-score(a));return `<fieldset class="frame-asset-group"><legend>${label} <span>${name==='frameActionIds'?'可选':'*'} 可多选 · 已选 <b class="frame-selected-count">${ids.length}</b> 项</span></legend><input class="input frame-asset-search" type="search" data-frame-filter="${name}" aria-label="搜索${label}" placeholder="搜索名称或编码">${aiddCheckAssets(name,ordered,ids)}<p class="frame-no-assets" hidden>没有匹配的已配置资产</p></fieldset>`;}
function aiddFrameForm(){
 const frame=aiddUI.frameEditing,scene=aiddFrameScene(frame),nameTemplate=`${scene?.name||'场景名称'}分析框架`,goalTemplate=`识别${scene?fieldData(scene.fieldKey).name:'当前场景'}经营的关键异常环节，定位主要问题并关联可执行的行动建议`;
 return `${aiddFrameBack()}${aiddFrameSteps(1)}<section class="card frame-config-card"><div class="card-head"><div><h2>配置内容</h2><p>填写本次输入，系统会套用统一的框架生产模板。</p></div>${aiddBadge('待生效')}</div><form id="aidd-framework-form"><div class="aidd-form-body">${aiddField('框架名称 *',aiddInput('name',frame.name,'id="aidd-frame-name" required maxlength="60" placeholder="请输入框架名称"')+`<div class="frame-template"><span>模板参考：<span id="frame-name-template">${esc(nameTemplate)}</span></span><button type="button" class="text-btn" data-frame-template="name">使用名称模板</button></div>`)}${aiddField('关联场景 *',aiddSelect('sceneId',aiddData.scenes.map(item=>[item.id,item.name]),frame.sceneId,'id="aidd-frame-scene" required'))}${aiddField('适用商家 *',aiddInput('scope',frame.scope||scene?.merchantScope||'当前场景适用商家','id="aidd-frame-scope" required maxlength="500" placeholder="例如：跃迁期商家，近7天经营表现"'))}${aiddField('核心目标 / 拆解公式 *',aiddTextarea('goal',frame.goal,3,'id="aidd-frame-goal" required maxlength="1000" placeholder="填写核心目标；如有已确认的指标拆解公式，可一并填写"')+`<div class="frame-template"><span>模板参考：<span id="frame-goal-template">${esc(goalTemplate)}</span></span><button type="button" class="text-btn" data-frame-template="goal">使用目标模板</button></div>`)}<div class="frame-pickers">${aiddFrameAssetPicker('frameMetricIds',aiddData.metrics,frame.metricIds,'关联指标')}${aiddFrameAssetPicker('frameActionIds',aiddData.actions,frame.actionIds,'关联行动建议')}</div><details id="frame-prompt-preview" class="frame-prompt-preview"><summary>查看完整生产 Prompt（固定模板＋本次输入）</summary><pre id="frame-complete-prompt">${esc(aiddFramePromptText(frame))}</pre></details><p class="aidd-form-error" id="aidd-framework-error" role="alert"></p></div><div class="aidd-form-footer"><button class="btn primary" type="submit">提交并生成草稿 ${icon('arrow')}</button></div></form></section>`;
}
function aiddFramePromptText(frame){
 return AIDD_FRAMEWORK_SYSTEM_PROMPT+'\n\n本次输入\n'+frameworkProductionInputText(aiddFrameProductionInput(frame));
}
function aiddUpdateFramePromptPreview(){
 const form=$('#aidd-framework-form'),preview=$('#frame-prompt-preview');
 if(form&&preview?.open&&aiddUI.frameEditing)$('#frame-complete-prompt').textContent=aiddFramePromptText(aiddReadFrameForm(form));
}
function aiddProductionDelivery(asset){
 if(!asset.productionHandoff)return '';
 const detail=asset.productionTrial?.executed?'已取得本次案例报告':Array.isArray(asset.branches)?'草稿待人工审核与案例试跑':'案例试跑可按需发起';
 return `<p class="form-help frame-delivery-note">${esc(detail)}；灰度发布后供智能助手主流程使用。</p>`;
}
function aiddFrameFilled(frame){
 const scene=aiddFrameScene(frame),assets=(type,ids)=>(ids||[]).map(id=>aiddFind(type,id)).filter(Boolean);
 return `<div class="frame-input-heading"><h3>本次生产输入</h3></div><dl class="frame-filled"><div><dt>框架名称</dt><dd>${esc(frame.name)}</dd></div><div><dt>关联场景</dt><dd>${esc(scene?.name||'原关联场景已移除')}</dd></div><div class="full"><dt>适用商家</dt><dd>${esc(frame.scope||scene?.merchantScope||'当前场景适用商家')}</dd></div><div class="full"><dt>核心目标 / 拆解公式</dt><dd>${esc(frame.goal||'未填写')}</dd></div><div class="full"><dt>关联指标</dt><dd class="frame-tags">${assets('metrics',frame.metricIds).map(item=>pill(item.name,'outline')).join('')||'未选择'}</dd></div><div class="full"><dt>关联行动建议</dt><dd class="frame-tags">${assets('actions',frame.actionIds).map(item=>pill(item.name,'outline')).join('')||'未选择'}</dd></div></dl>`;
}
function aiddFrameDetail(frame){
 const active=frame.status!=='待生效',job=aiddFrameJobs.get(frame.id),hasDraft=!!String(frame.draftText||frame.prompt||'').trim();
 const content=job?`<div class="frame-generation" role="status" aria-live="polite" aria-busy="true"><span class="frame-spinner" aria-hidden="true"></span><div><h3>正在生成诊断框架</h3><p id="frame-generation-message">${esc(job.message)}</p><small>已用时 <span id="frame-generation-elapsed">${esc(aiddProductionDuration(Date.now()-job.startedAt))}</span> · Token 用量在模型返回后显示。输入已保存，无需重复提交。</small></div></div>`:hasDraft?active?frame.businessFrameworkVersion===2?aiddBusinessFrameHTML(frame):`<pre class="frame-draft-content">${esc(frame.draftText||frame.prompt)}</pre>`:`<label for="frame-reviewed-text" class="form-help">审核下方草稿，可直接编辑；需要重做时点击下方“重新生成”。</label><textarea id="frame-reviewed-text" class="input frame-draft-content" rows="14">${esc(frame.draftText||frame.prompt)}</textarea>`:`<p class="form-help">尚未取得完整草稿，请点击下方“重新生成”。</p>`;
 const sourceBadge=hasDraft?`第 ${frame.generation||0} 次生成 · ${frame.production==='DeepSeek生成'?'DeepSeek':'本地示例'}`:frame.generationError?'生成未完成':'尚未生成';
 return `${aiddFrameBack()}${active?'':aiddFrameSteps(2)}<section class="card frame-result-card"><div class="card-head"><div><div class="row"><h2>${esc(frame.name)}</h2>${aiddBadge(frame.status)}</div><p>v${frame.version||1} · ${esc(frame.updatedAt||'')}</p></div><button class="btn" data-frame-edit="${esc(frame.id)}" ${job||frame.testing?'disabled':''}>更改配置</button></div>${aiddFrameFilled(frame)}${aiddProductionDelivery(frame)}${job?'':aiddProductionUsageHTML(frame)}<div class="frame-draft-block"><div class="frame-block-heading"><h3>${active?'诊断框架':'诊断框架草稿'}</h3>${job?pill('生成中','purple'):active?'':pill(sourceBadge,'outline')}</div>${frame.generationError?`<p class="aidd-form-error" role="alert">${esc(frame.generationError)}</p>`:''}${content}</div></section>${active?'':aiddFrameTrialPanel(frame)}`;
}
function aiddBusinessFrameHTML(frame){
 const rows=aiddSceneStrategies(frame.sceneId).filter(s=>s.status==='生效中');
 return `<div class="business-framework"><section><h3>一、指标拆解</h3><h4>1. 基础拆解</h4><ol>${(frame.decomposition||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ol><h4>2. 下钻顺序（漏斗）</h4><p class="business-drill">${esc(frame.drilldown)}</p><p class="form-help">先核验有效经营、完整周期、统计口径和样本。指标变化只定位环节；零基数、样本不足或证据不可比时保留“无法判断”。</p></section><section><h3>二、诊断方向</h3><div class="business-directions">${frame.branches.map(b=>`<article><h4>${esc(b.name)}</h4><strong>最小颗粒度问题</strong><ul>${(b.minimumProblems||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p>${esc(b.meaning)}</p><small>关联指标：${b.metricIds.map(id=>esc(aiddFind('metrics',id)?.originalName||id)).join('、')}</small></article>`).join('')}</div></section><section><h3>三、典型问题总结 + 行动建议映射 → 策略</h3>${rows.map((s,i)=>`<article class="business-strategy"><div class="row"><h4>${i+1}. ${esc(s.name)}</h4>${pill(s.decisionLevel==='evidence_required'?'定义已发布 · 待证据判断':'指标变化信号','outline')}</div><dl><dt>指标规则</dt><dd>${esc(s.metricRuleText)}</dd><dt>确认条件</dt><dd>${esc(s.confirmationRule)}</dd><dt>业务含义</dt><dd>${esc(s.businessMeaning)}</dd><dt>行动建议映射</dt><dd>${s.actionMappings.map(a=>`<p><strong>${esc(aiddFind('actions',a.id)?.name)}</strong>：${esc(a.instruction)}<br><small>验证：${esc(a.verification)}</small></p>`).join('')}</dd><dt>缺少指标或证据</dt><dd>${esc(s.missingMetricOrEvidence.join('；')||'真实取数、对象明细、最小有效样本及业务阈值待核定')}</dd><dt>去重边界</dt><dd>${esc(s.exclusionPolicy)}${s.handoffSceneId?' 转交'+esc(aiddScene(s.handoffSceneId).name)+'继续定位。':''}</dd></dl><button class="text-btn" data-strategy-detail="${esc(s.id)}">查看完整策略及待补项</button></article>`).join('')}<p class="form-help">${esc(frame.businessBoundary||'父子场景不并行重复输出，同一对象及损失合并。')} 框架与策略定义已发布；真实取数、经营明细及效果仍需验证。</p></section></div>`;
}
function aiddTrialMetricHTML(row){
 const comparison=Number.isFinite(row.comparisonChange)?`<small>较对比期${row.comparisonChange>0?'增长':row.comparisonChange<0?'下降':'持平'} ${Math.abs(row.comparisonChange).toFixed(1)}%</small>`:'';
 return `<div><span>${esc(row.label)}</span><strong>${Number(row.value).toLocaleString('zh-CN',{maximumFractionDigits:2})}${esc(row.unit||'')}</strong>${comparison}</div>`;
}
function aiddTrialActionHTML(action,caseIndex,problemIndex,actionIndex){
 const href=actionUrl(action.pcLink||action.mobileLink);
 const label=`${esc(action.name)} ${icon('arrow')}`;
 return `<div class="trial-action">${href?`<a class="btn" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`:`<button type="button" class="btn" data-frame-trial-action="${caseIndex}|${problemIndex}|${actionIndex}">${label}</button>`}<p>${esc(action.recommendation)}</p></div>`;
}
function aiddTrialProblemHTML(problem,caseIndex,problemIndex){
 return `<article class="trial-problem"><div class="trial-problem-heading"><span>问题 ${problemIndex+1}</span><h4>${esc(problem.title)}</h4>${pill('P'+problem.priority,'outline')}</div><p class="trial-finding">${esc(problem.finding)}</p><h5>关联指标</h5><div class="trial-metrics">${problem.evidence.map(aiddTrialMetricHTML).join('')}</div><div class="trial-method"><strong>判断方法</strong><p>${esc(problem.method)}</p></div><div class="trial-cause"><h5>原因分析 ${problem.causeStatus==='needs_verification'?'<small>待核查</small>':'<small>指标证据支持</small>'}</h5><p>${esc(problem.cause)}</p></div><h5>行动建议</h5><div class="trial-actions">${problem.actions.map((action,i)=>aiddTrialActionHTML(action,caseIndex,problemIndex,i)).join('')||'<p class="form-help">该诊断方向尚未关联行动建议，请补充框架配置。</p>'}</div>${problem.missing.length?`<p class="trial-missing">需补充：${esc(problem.missing.join('；'))}</p>`:''}</article>`;
}
function aiddTrialReportHTML(report){
 if(!report?.executed)return `<p class="form-help">${esc(report?.limitations?.join('；')||'尚未试跑；案例测试按需发起。')}</p>`;
 if(report.analysisMode!=='draft_framework_diagnosis')return '<p class="trial-legacy-note">这份旧报告只检查了指标是否齐备，请重新点击“案例试跑”，取得当前框架的商家诊断。</p>';
 return `<div class="frame-trial-result"><div class="frame-block-heading"><h3>商家诊断预览</h3>${pill(report.status==='completed'?'诊断完成':'尚未完成',report.status==='completed'?'green':'orange')}</div>${report.cases.map((item,caseIndex)=>`<section class="trial-case"><div class="trial-case-heading"><h4>${esc(item.label)}</h4>${pill('演示数据','outline')}</div><p class="trial-case-scope">${esc(item.frameworkName)} · ${esc(item.periodRange||item.periodLabel)} · 商家 ${esc(item.merchantId)}</p><p class="form-help">${esc(item.dataNote||'固定合成案例，非真实商家取数。')}</p><p class="trial-summary">${esc(item.summary)}</p>${item.problems.map((problem,i)=>aiddTrialProblemHTML(problem,caseIndex,i)).join('')}${item.unresolved.length?`<div class="trial-unresolved"><h4>待补充后判断</h4>${item.unresolved.map(problem=>`<section><strong>${esc(problem.title)}</strong><p>${esc(problem.finding)}</p><small>判断方法：${esc(problem.method)}</small>${problem.cause?`<p>原因待核查：${esc(problem.cause)}</p>`:''}<p>待补充：${esc(problem.missing.join('；'))}</p></section>`).join('')}</div>`:''}${item.clear.length?`<details class="trial-clear" ${!item.problems.length?'open':''}><summary>当前框架下未发现问题的方向（${item.clear.length}）</summary>${item.clear.map(problem=>`<section><strong>${esc(problem.title)}</strong><p>${esc(problem.finding)}</p><small>判断方法：${esc(problem.method)}</small></section>`).join('')}</details>`:''}<details class="trial-data-details"><summary>查看诊断过程与指标明细</summary><p>本次只执行当前审核框架，覆盖 ${item.frameworkBranches.length} 个方向。</p>${item.frameworkBranches.map(branch=>`<p>${esc(branch.branchName)}：${branch.covered?'所需指标齐备':'缺少 '+branch.missing.map(esc).join('、')}</p>`).join('')}<div class="table-wrap"><table><thead><tr><th>关联指标</th><th>本期</th><th>前周期</th></tr></thead><tbody>${item.evidence.map(row=>`<tr><td>${esc(row.label)}</td><td>${Number(row.value).toLocaleString('zh-CN',{maximumFractionDigits:2})}${esc(row.unit)}</td><td>${Number.isFinite(row.previousValue)?Number(row.previousValue).toLocaleString('zh-CN',{maximumFractionDigits:2})+esc(row.unit):'未提供'}</td></tr>`).join('')}</tbody></table></div></details></section>`).join('')}<p class="form-help">${esc(report.limitations?.join('；')||'按当前审核框架执行的演示案例诊断。')}</p></div>`;
}
function aiddOpenTrialAction(path){
 const [caseIndex,problemIndex,actionIndex]=path.split('|').map(Number),frame=aiddSelectedFrame(),item=frame?.trial?.report?.cases?.[caseIndex],problem=item?.problems?.[problemIndex],action=problem?.actions?.[actionIndex];
 if(!action)return;
 modal(esc(action.name),'行动建议 · 演示入口',`<div class="trial-action-detail"><p>${esc(action.recommendation)}</p><dl><dt>关联问题</dt><dd>${esc(problem.title)}</dd><dt>商家与周期</dt><dd>${esc(item.label)}</dd><dt>后续观察</dt><dd>${problem.evidence.map(m=>esc(m.label)).join('、')}</dd></dl><p class="form-help">当前为行动建议演示按钮，尚未绑定实际业务工具。</p></div>`,`<button class="btn primary" data-action="close-modal">知道了</button>`);
}

function aiddFrameDraftFingerprint(frame){
 return JSON.stringify([frame.generation||0,frame.name||'',frame.sceneId||'',frame.scope||'',frame.goal||'',frame.metricIds||[],frame.actionIds||[],String(frame.draftText||frame.prompt||'').trim()]);
}
function aiddFrameTrialCurrent(frame){
 const trial=frame.trial,report=trial?.report,period=frame.casePeriod||'week';
 return !!trial&&trial.generation===frame.generation&&trial.caseId===frame.caseId&&trial.draftFingerprint===aiddFrameDraftFingerprint(frame)&&(trial.casePeriod||'week')===period&&report?.executed===true&&report.status==='completed'&&report.schemaVersion===2&&report.analysisMode==='draft_framework_diagnosis'&&Array.isArray(report.cases)&&report.cases.some(item=>item.merchantId===frame.caseId&&item.period===period&&item.frameworkId===(frame.assetId||frame.id));
}
function aiddFrameCanPublish(frame){
 return !aiddFrameJobs.has(frame.id)&&!frame.testing&&!!frame.protocolConfirmed&&frame.protocolDraftFingerprint===aiddFrameDraftFingerprint(frame)&&aiddFrameTrialCurrent(frame)&&!!frame.reviewPassed;
}
function aiddFrameCanConfirm(frame){return !aiddFrameJobs.has(frame.id)&&!frame.testing&&aiddFrameTrialCurrent(frame)&&!!frame.reviewPassed;}
function aiddSetFrameworkTrialReviewed(checked){
 const frame=aiddSelectedFrame();if(!frame)return false;
 frame.reviewPassed=!!(checked&&aiddFrameTrialCurrent(frame));
 if(!frame.reviewPassed){frame.protocolConfirmed=false;frame.protocolDraftFingerprint='';}
 aiddRefreshFrameActions(frame);saveAidd();return frame.reviewPassed;
}
function aiddRefreshFrameActions(frame){
 const busy=aiddFrameJobs.has(frame.id)||frame.testing,hasDraft=!!String(frame.draftText||frame.prompt||'').trim();
 const trial=$('[data-frame-trial-submit]'),regen=$('[data-frame-regenerate]'),confirm=$('[data-frame-confirm-protocol]'),publish=$('[data-frame-publish]');
 if(trial)trial.disabled=busy||!hasDraft;if(regen)regen.disabled=busy;
 if(confirm){confirm.disabled=!aiddFrameCanConfirm(frame)||!!frame.protocolConfirmed;confirm.textContent=frame.protocolConfirmed?'演示校验已通过':'确认框架并解析校验';}
 if(publish)publish.disabled=!aiddFrameCanPublish(frame);
 const hint=$('#frame-stage-hint');if(hint)hint.textContent=busy?'正在处理，请稍候。':!aiddFrameTrialCurrent(frame)?'选择案例试跑，再人工审核本次报告。':!frame.reviewPassed?'请先勾选人工审核本次试跑结果。':!frame.protocolConfirmed?'已完成人工审核，可确认框架并进行演示校验。':'演示校验通过，可以灰度发布。';
}
function aiddFrameTrialPanel(frame){
 const busy=aiddFrameJobs.has(frame.id)||frame.testing,hasDraft=!!String(frame.draftText||frame.prompt||'').trim(),current=aiddFrameTrialCurrent(frame);
 return `<section class="card frame-trial-card"><div class="card-head"><div><h2>案例试跑与人工审核</h2><p>先选择案例试跑，审核报告后再确认框架和灰度发布。</p></div>${frame.testing?pill('试跑中','purple'):frame.trial?pill('已取得本次报告','green'):pill('尚未试跑','outline')}</div><div class="frame-trial-body"><form id="aidd-framework-trial-form"><label for="frame-case-id">演示商家ID</label><div class="frame-case-controls">${aiddInput('merchantId',frame.caseId||'','id="frame-case-id" required autocomplete="off" placeholder="选择需要试跑的案例" '+(busy?'disabled':''))}<button class="btn" type="button" data-frame-case-library ${busy?'disabled':''}>${icon('search')}选择案例</button></div><div class="frame-trial-period"><label for="frame-case-period">分析周期</label><select class="input" id="frame-case-period" name="period" aria-label="案例统计周期" ${busy?'disabled':''}><option value="week" ${(frame.casePeriod||'week')==='week'?'selected':''}>近7天</option><option value="day" ${frame.casePeriod==='day'?'selected':''} ${frame.caseId&&!aiddFrameCases(frame,'day').some(sample=>sample.id===frame.caseId)?'disabled':''}>昨日</option></select><span id="frame-case-range">${periodRange(frame.casePeriod||'week')}</span></div><p class="form-help">用当前审核框架分析固定合成案例。真实取数尚未接入；缺少来源、素材或口径证据时，报告会明确待补项。</p><p class="aidd-form-error" id="frame-trial-error" role="alert">${esc(frame.trialError||'')}</p></form>${!frame.testing&&frame.productionUsage?.test?aiddProductionUsageHTML({productionUsage:{test:frame.productionUsage.test}}):''}<div id="frame-trial-feedback">${frame.testing?`<div class="frame-generation" role="status" aria-live="polite"><span class="frame-spinner" aria-hidden="true"></span><div><h3>正在试跑所选案例</h3><p id="frame-trial-progress">正在准备所选商家和周期的经营数据，请稍候。</p><small>已用时 <span id="frame-trial-elapsed">${esc(aiddProductionDuration(Date.now()-frame.trialStartedAt))}</span> · Token 用量将在接口返回后显示。</small></div></div>`:frame.trial?aiddTrialReportHTML(frame.trial.report):''}${frame.trial?`<div class="frame-review"><label class="checklist-item"><input type="checkbox" id="frame-review-passed" ${frame.reviewPassed?'checked':''} ${!current||busy?'disabled':''}><span>我已人工审核本次试跑结果，确认无误</span></label></div>`:''}</div><p id="frame-stage-hint" class="form-help" role="status">${frame.protocolConfirmed?'演示校验通过，可以灰度发布。':current&&frame.reviewPassed?'已完成人工审核，可确认框架并进行演示校验。':'选择案例试跑，再人工审核本次报告。'}</p></div><div class="aidd-form-footer frame-review-actions"><button class="btn" type="submit" form="aidd-framework-trial-form" data-frame-trial-submit ${busy||!hasDraft?'disabled':''}>${icon('play')}${frame.testing?'正在试跑':'案例试跑'}</button><button class="btn" data-frame-regenerate ${busy?'disabled':''}>${icon('refresh')}重新生成</button><button class="btn" data-frame-confirm-protocol ${!aiddFrameCanConfirm(frame)||frame.protocolConfirmed?'disabled':''}>${frame.protocolConfirmed?'演示校验已通过':'确认框架并解析校验'}</button><button class="btn primary" data-frame-publish ${aiddFrameCanPublish(frame)?'':'disabled'}>灰度发布到演示商家 ${icon('check')}</button></div></section>`;
}
function aiddFrameTrialResult(trial){return aiddTrialReportHTML(trial.report);}
function aiddFrameworkPanel(){
 if(aiddUI.frameView==='config'&&aiddUI.frameEditing)return aiddFrameForm();
 const frame=aiddSelectedFrame();
 if(aiddUI.frameView==='detail'&&frame)return aiddFrameDetail(frame);
 aiddUI.frameView='list';
 return aiddFrameList();
}
function aiddOpenFrame(id){
 const frame=aiddData.frameworks.find(item=>item.id===id);if(!frame)return;
 aiddUI.frameId=id;aiddUI.sceneId=frame.sceneId;
 aiddUI.frameEditing=frame.stage==='config'?clone(frame):null;
 aiddUI.frameView=frame.stage==='config'?'config':'detail';render();
}
function aiddNewFrame(){
 const scene=aiddScene();
 aiddUI.frameId=null;aiddUI.frameView='config';aiddUI.frameEditing={id:aiddId('framework'),sceneId:scene.id,name:'',goal:'',scope:scene.merchantScope||'当前场景适用商家',metricIds:[],actionIds:[],status:'待生效',stage:'config',version:1,generation:0,workflowSchema:1};render();
}
function aiddEditFrame(id){
 const original=aiddData.frameworks.find(item=>item.id===id);if(!original)return;
 let frame=original;
 if(original.status!=='待生效'){
  frame=aiddData.frameworks.find(item=>item.baseId===id&&item.status==='待生效');
  if(!frame){frame={...clone(original),id:aiddId('framework'),baseId:id,status:'待生效',stage:'config',version:(original.version||1)+1,trial:null,reviewPassed:false,caseId:'',generation:0,updatedAt:aiddNow()};aiddData.frameworks.push(frame);saveAidd();}
 }
 aiddUI.frameId=frame.id;aiddUI.frameEditing=clone(frame);aiddUI.frameView='config';render();
}
function aiddReadFrameForm(form){
 const data=new FormData(form),frame={...clone(aiddUI.frameEditing),name:String(data.get('name')||'').trim(),goal:String(data.get('goal')||'').trim(),scope:String(data.get('scope')||'').trim(),sceneId:String(data.get('sceneId')||''),metricIds:data.getAll('frameMetricIds'),actionIds:data.getAll('frameActionIds')};
 delete frame.productionPrompt;return frame;
}
function aiddValidateFrame(frame){
 if(!frame.name||!frame.goal)return '请填写框架名称和核心目标。';
 if(!aiddFrameScene(frame))return '请选择已配置的关联场景。';
 if(!frame.metricIds.length)return '请至少选择一个关联指标。';
 if(frame.metricIds.some(id=>!aiddFind('metrics',id)))return '部分关联指标已不存在，请重新选择。';
 if(frame.actionIds.some(id=>!aiddFind('actions',id)))return '部分行动建议已不存在，请重新选择。';
 return '';
}
function aiddBuildFrameDraft(frame){
 frame.generation=(frame.generation||0)+1;
 const categories={trade:{name:'成交规模',keys:['gmv','orders']},traffic:{name:'流量与内容供给',keys:['exposure','plays','videos']},conversion:{name:'转化效率',keys:['clickRate','payRate','activeRate']},users:{name:'用户与达人合作',keys:['buyers','newBuyerRate','creators']},content:{name:'商品内容核查',keys:['content']}};
 const order=frame.generation%2?['trade','traffic','conversion','users','content']:['traffic','conversion','trade','users','content'];
 const metrics=frame.metricIds.map(id=>aiddFind('metrics',id)),actions=frame.actionIds.map(id=>aiddFind('actions',id));
 frame.branches=order.map(key=>{const selected=metrics.filter(metric=>categories[key].keys.includes(metric.metricKey));return {name:categories[key].name,meaning:'统一周期、商家范围与归因口径，依据已选指标定位经营环节，结合证据核查原因。',metricIds:selected.map(x=>x.id),actionIds:actions.filter(action=>action.metricIds.some(id=>selected.some(metric=>metric.id===id))).map(x=>x.id)};}).filter(branch=>branch.metricIds.length);
 const assigned=new Set(frame.branches.flatMap(branch=>branch.metricIds)),rest=metrics.filter(metric=>!assigned.has(metric.id));
 if(rest.length)frame.branches.push({name:'其他关联指标',meaning:'仅根据已选指标和可用案例数据分析。',metricIds:rest.map(x=>x.id),actionIds:[]});
 frame.draftText=`框架名称：${frame.name}\n关联场景：${aiddFrameScene(frame).name}\n核心目标：${frame.goal}\n\n一、数据校验\n核对商家ID、统计周期和指标口径；缺失数据标记为无法判断，不补造结论。\n\n二、诊断顺序\n${frame.branches.map((branch,index)=>`${index+1}. ${branch.name}\n   指标：${branch.metricIds.map(id=>aiddFind('metrics',id).name).join('、')}\n   ${branch.meaning}${branch.actionIds.length?`\n   关联建议：${branch.actionIds.map(id=>aiddFind('actions',id).name).join('、')}`:''}`).join('\n')}\n\n三、行动建议\n${actions.map((action,index)=>`${index+1}. ${action.executionName||action.name}：${action.subtitle||action.description||'结合诊断结果选择适用的经营工具。'}`).join('\n')}\n\n四、结果表达\n呈现关键变化、诊断依据与对应行动建议；具体原因证据不足时说明待核查项。`;
 frame.prompt=frame.draftText;frame.stage='draft';frame.status='待生效';frame.production='配置生成';frame.trial=null;frame.reviewPassed=false;frame.updatedAt=aiddNow();frame.workflowSchema=1;
 return frame;
}
async function aiddSubmitFrameworkConfig(form){
 if(aiddUI.frameView!=='config'||!aiddUI.frameEditing||!form.reportValidity())return;
 const next=aiddReadFrameForm(form),error=aiddValidateFrame(next);
 if(error){$('#aidd-framework-error').textContent=error;return;}
 let frame=aiddData.frameworks.find(item=>item.id===next.id);
 if(frame)Object.assign(frame,next);else{frame=next;aiddData.frameworks.push(frame);}
 aiddUI.frameEditing=null;aiddUI.frameId=frame.id;aiddUI.frameView='detail';aiddUI.sceneId=frame.sceneId;
 await aiddGenerateFramework(frame);
}
async function aiddGenerateFramework(frame){
 if(aiddFrameJobs.has(frame.id))return;
 const next=clone(frame),job={startedAt:Date.now(),message:'已提交，正在准备本次场景与关联资产。'};
 aiddFrameJobs.set(frame.id,job);frame.stage='draft';frame.protocolConfirmed=false;frame.protocolDraftFingerprint='';frame.trial=null;frame.productionTrial=null;frame.reviewPassed=false;frame.generationError='';
 saveAidd();render();
 const timer=setInterval(()=>{const target=$('#frame-generation-elapsed');if(target&&aiddUI.frameId===frame.id)target.textContent=aiddProductionDuration(Date.now()-job.startedAt);},1000);
 try{
  await cozeBuildFrameDraft(next,{onProgress:message=>{if(aiddFrameJobs.get(frame.id)!==job)return;job.message=message;if(aiddUI.frameId===frame.id){const target=$('#frame-generation-message');if(target)target.textContent=message;}}});
  if(aiddFrameJobs.get(frame.id)!==job||!aiddData.frameworks.includes(frame))return;
  Object.assign(frame,next,{generationError:'',protocolConfirmed:false,protocolDraftFingerprint:'',parsedDraftFingerprint:'',draftEdited:false,trial:null,productionTrial:null,reviewPassed:false});
  toast('已生成诊断框架草稿，请人工审核后选择案例试跑');
 }catch(error){frame.generationError=error.message;aiddSaveProductionUsage(frame,error);toast('生成未完成，输入已保留，可重新生成。');}
 finally{clearInterval(timer);aiddFrameJobs.delete(frame.id);saveAidd();if(aiddUI.section==='framework')render();}
}
function aiddFrameCaseOptions(frame,period=frame.casePeriod||'week'){
 const scene=aiddFrameScene(frame),metrics=frame.metricIds.map(id=>aiddFind('metrics',id)).filter(Boolean);
 return Object.values(SAMPLE).map(sample=>({sample,...aiddTrialCaseData(scene,metrics,sample,period)}));
}
function aiddFrameCases(frame,period=frame.casePeriod||'week'){
 return aiddFrameCaseOptions(frame,period).filter(option=>option.available).map(option=>option.sample);
}
function aiddOpenFrameCaseLibrary(){
 const frame=aiddSelectedFrame();if(!frame)return;
 modal('选择案例','案例库 · 固定合成商家数据',`<div class="frame-case-library"><p>按当前框架所选指标和${frame.casePeriod==='day'?'昨日':'近7天'}数据检查可用性。可试跑代表能提交分析；具体原因仍须按框架核查证据。</p><div class="table-wrap"><table><thead><tr><th>商家 / ID</th><th>案例说明与可用性</th><th>操作</th></tr></thead><tbody>${aiddFrameCaseOptions(frame).map(option=>{const {sample}=option;return `<tr><td><strong>${esc(sample.name)}</strong><small class="aidd-cell-note mono">${esc(sample.id)}</small></td><td>${sample.id==='DEMO_10001'?'多场域经营样例':sample.id==='DEMO_10002'?'直播曝光改善样例':'直播低曝光样例'}<small class="aidd-cell-note">${option.available?'所选数值指标已覆盖，可试跑':esc(option.reasons.join('；'))}</small></td><td><button class="table-action" data-frame-case-select="${esc(sample.id)}" ${option.available?'':'disabled'}>${option.available?'选择此案例':'当前不可试跑'}</button></td></tr>`;}).join('')}</tbody></table></div></div>`,`<button class="btn" data-action="close-modal">关闭</button>`,true);
}
async function aiddRunFrameworkTrial(form){
 const frame=aiddSelectedFrame();if(!frame||frame.status!=='待生效'||frame.testing||aiddFrameJobs.has(frame.id))return;
 aiddCaptureFrameDraft(frame);
 const values=new FormData(form),id=String(values.get('merchantId')||'').trim(),period=String(values.get('period')||frame.casePeriod||'week'),option=aiddFrameCaseOptions(frame,period).find(item=>item.sample.id===id),sample=option?.sample;
 if(!option?.available){$('#frame-trial-error').textContent=option?'该案例当前不可试跑：'+option.reasons.join('；'):'请选择案例库中适用于当前框架的商家ID。';return;}
 if(!String(frame.draftText||'').trim()){$('#frame-trial-error').textContent='请先取得完整框架草稿。';return;}
 const fingerprint=aiddFrameDraftFingerprint(frame);
 frame.caseId=id;frame.casePeriod=period;frame.testing=true;frame.trialStartedAt=Date.now();frame.protocolConfirmed=false;frame.protocolDraftFingerprint='';frame.reviewPassed=false;frame.trial=null;frame.productionTrial=null;frame.trialError='';
 if(frame.productionUsage)delete frame.productionUsage.test;
 render();
 const timer=setInterval(()=>{const target=$('#frame-trial-elapsed');if(target&&aiddUI.frameId===frame.id)target.textContent=aiddProductionDuration(Date.now()-frame.trialStartedAt);},1000);
 try{
  if(!aiddIsOnline())await cozeRefreshConnection();
  if(!aiddIsOnline())throw new Error('请先登录并启用在线 AI，案例试跑需要按当前框架实际执行诊断。');
  const result=await cozeTrialFramework(frame,sample,{period,onProgress:message=>{const target=$('#frame-trial-progress');if(target)target.textContent=message;}});
  if(aiddFrameDraftFingerprint(frame)!==fingerprint||frame.caseId!==id||frame.casePeriod!==period)throw new Error('草稿或案例已变化，请按当前内容重新试跑。');
  if(!result.trialReport?.executed||result.trialReport.schemaVersion!==2||result.trialReport.analysisMode!=='draft_framework_diagnosis')throw new Error(result.answer||'未取得本次商家诊断报告。');
  if(result.candidate?.branches){frame.branches=result.candidate.branches;frame.parsedDraftFingerprint=fingerprint;}
  frame.productionTrial=result.trialReport;frame.trial={caseId:id,casePeriod:period,generation:frame.generation,draftFingerprint:fingerprint,report:result.trialReport};frame.stage='trial';frame.updatedAt=aiddNow();saveAidd();
  toast('已取得本次试跑报告，请人工审核');
 }catch(error){frame.trialError=error.message;aiddSaveProductionUsage(frame,error);toast(error.message);}finally{clearInterval(timer);delete frame.testing;delete frame.trialStartedAt;saveAidd();render();}
}

function aiddInvalidateFrameTrial(id,period){
 const frame=aiddSelectedFrame();if(!frame||frame.status!=='待生效')return;
 frame.caseId=id.trim();frame.casePeriod=period||frame.casePeriod||'week';frame.reviewPassed=false;frame.protocolConfirmed=false;frame.protocolDraftFingerprint='';
 const range=$('#frame-case-range');if(range)range.textContent=periodRange(frame.casePeriod);
 const dayOption=$('#frame-case-period')?.querySelector('option[value="day"]');if(dayOption)dayOption.disabled=!!frame.caseId&&!aiddFrameCases(frame,'day').some(sample=>sample.id===frame.caseId);
 if(frame.trial?.caseId!==frame.caseId||(frame.trial?.casePeriod||'week')!==frame.casePeriod){frame.trial=null;frame.productionTrial=null;const feedback=$('#frame-trial-feedback');if(feedback)feedback.innerHTML='<p class="form-help">案例或周期已变更，请重新试跑。</p>';}
 const checkbox=$('#frame-review-passed');if(checkbox){checkbox.checked=false;checkbox.disabled=!aiddFrameTrialCurrent(frame);}
 aiddRefreshFrameActions(frame);saveAidd();
}
async function aiddRegenerateFrame(){
 const frame=aiddSelectedFrame();if(!frame||frame.status!=='待生效'||frame.testing||aiddFrameJobs.has(frame.id))return;
 aiddCaptureFrameDraft(frame);
 const error=aiddValidateFrame(frame);if(error){toast(error);aiddEditFrame(frame.id);return;}
 await aiddGenerateFramework(frame);
}
function aiddConfirmFrameworkProtocol(){
 const frame=aiddSelectedFrame();if(!frame)return;aiddCaptureFrameDraft(frame);
 if(!aiddFrameCanConfirm(frame)){toast('请先试跑当前草稿，并人工审核本次报告。');return;}
 frame.protocolConfirmed=true;frame.protocolDraftFingerprint=aiddFrameDraftFingerprint(frame);
 frame.protocolValidation={mode:'demo',status:'passed',checkedAt:aiddNow()};
 saveAidd();render();toast('演示解析校验通过，可灰度发布到演示商家。');
}
function aiddCaptureFrameDraft(frame){
 const editor=$('#frame-reviewed-text');if(editor&&typeof editor.value==='string'&&editor.value!==frame.draftText)aiddInvalidateFrameDraft(frame,editor.value);
}
function aiddInvalidateFrameDraft(frame,text){
 Object.assign(frame,{draftText:text,prompt:text,draftEdited:true,protocolConfirmed:false,protocolDraftFingerprint:'',parsedDraftFingerprint:'',trial:null,productionTrial:null,reviewPassed:false});
 const feedback=$('#frame-trial-feedback');if(feedback)feedback.innerHTML='<p class="form-help">草稿已修改，请重新试跑并审核。</p>';
 aiddRefreshFrameActions(frame);saveAidd();
}
function aiddPublishFramework(){
 const frame=aiddSelectedFrame();if(!frame||frame.status!=='待生效')return;
 const error=aiddValidateFrame(frame);if(error){toast(error);return;}
 aiddCaptureFrameDraft(frame);
 if(!aiddFrameCanPublish(frame)){toast('请先试跑、人工审核报告，并确认演示解析校验。');return;}
 aiddData.frameworks.filter(item=>item.sceneId===frame.sceneId&&item.id!==frame.id&&item.status==='生效中').forEach(item=>item.status='已归档');
 frame.releaseSellerAllowlist=['DEMO_10001'];frame.status='生效中';frame.stage='active';frame.publishedAt=aiddNow();frame.updatedAt=frame.publishedAt;
 const published=aiddData.published[frame.sceneId],configs=published?.periods?Object.values(published.periods):published?[published]:[];
 configs.forEach(config=>{config.framework=frame.prompt;config.frameworkVersion=frame.version;config.frameworkDefinition=aiddPublishedFramework(frame,aiddFrameScene(frame),config);});
 if(aiddFrameScene(frame)?.fieldKey==='live'){state.draft.framework=frame.prompt;state.published.framework=frame.prompt;persist();}
 saveAidd();render();toast('诊断框架已在当前演示配置中生效，仅供演示商家使用');
}
function aiddOfflineFramework(id){
 const frame=aiddData.frameworks.find(item=>item.id===id);if(!frame||frame.status!=='生效中')return;
 frame.status='已失效';frame.stage='inactive';frame.updatedAt=aiddNow();saveAidd();render();toast('诊断框架已下线，状态已更新为已失效');
}
function aiddHandleFrameworkClick(data){
 if('frameNew'in data)aiddNewFrame();
 else if(data.frameOpen)aiddOpenFrame(data.frameOpen);
 else if(data.frameEdit)aiddEditFrame(data.frameEdit);
 else if(data.frameOffline)aiddOfflineFramework(data.frameOffline);
 else if(data.frameTemplate){const name=data.frameTemplate==='name';$(name?'#aidd-frame-name':'#aidd-frame-goal').value=$(name?'#frame-name-template':'#frame-goal-template').textContent;aiddUpdateFramePromptPreview();}
 else if('frameCaseLibrary'in data)aiddOpenFrameCaseLibrary();
 else if(data.frameCaseSelect){const frame=aiddSelectedFrame();if(!aiddFrameCases(frame).some(sample=>sample.id===data.frameCaseSelect))return true;closeModal();aiddInvalidateFrameTrial(data.frameCaseSelect,frame.casePeriod||'week');render();}
 else if(data.frameTrialAction)aiddOpenTrialAction(data.frameTrialAction);
 else if('frameConfirmProtocol'in data)aiddConfirmFrameworkProtocol();
 else if('frameRegenerate'in data)aiddRegenerateFrame();
 else if('framePublish'in data)aiddPublishFramework();
 else return false;
 return true;
}
document.addEventListener('click',event=>{
 const back=event.target.closest('[data-frame-back]');if(!back)return;event.preventDefault();aiddUI.frameView='list';aiddUI.frameEditing=null;aiddUI.frameId=null;render();
});

document.addEventListener('input',event=>{
 if(event.target.id==='frame-reviewed-text'){
  const frame=aiddSelectedFrame();if(frame)aiddInvalidateFrameDraft(frame,event.target.value);
 }
 if(event.target.id==='frame-case-id')aiddInvalidateFrameTrial(event.target.value);
 if(event.target.dataset.frameFilter){const group=event.target.closest('.frame-asset-group'),query=event.target.value.trim().toLowerCase();let count=0;group.querySelectorAll('.checklist-item').forEach(label=>{label.hidden=!label.textContent.toLowerCase().includes(query);if(!label.hidden)count++;});group.querySelector('.frame-no-assets').hidden=count>0;}
 if(event.target.closest?.('#aidd-framework-form'))aiddUpdateFramePromptPreview();
});
document.addEventListener('change',event=>{
 const input=event.target;
 if(['frameMetricIds','frameActionIds'].includes(input.name)){const group=input.closest('.frame-asset-group');group.querySelector('.frame-selected-count').textContent=group.querySelectorAll('input[type="checkbox"]:checked').length;}
 if(input.id==='aidd-frame-scene'){
  const scene=aiddData.scenes.find(item=>item.id===input.value);if(!scene)return;
  $('#frame-name-template').textContent=`${scene.name}分析框架`;
  $('#frame-goal-template').textContent=`识别${fieldData(scene.fieldKey).name}经营的关键异常环节，定位主要问题并关联可执行的行动建议`;
  $('#aidd-frame-scope').value=scene.merchantScope||'当前场景适用商家';
 }
 if(input.id==='frame-case-period')aiddInvalidateFrameTrial($('#frame-case-id').value,input.value);
 if(input.id==='frame-review-passed'){
  input.checked=aiddSetFrameworkTrialReviewed(input.checked);
 }
 if(input.closest?.('#aidd-framework-form'))aiddUpdateFramePromptPreview();
});
document.addEventListener('toggle',event=>{if(event.target.id==='frame-prompt-preview'&&event.target.open)aiddUpdateFramePromptPreview();},true);
