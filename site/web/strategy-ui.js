'use strict';

function aiddStrategyHeaderActions(){return `<button class="btn ai-gradient" data-aidd-strategy-ai>${icon('spark')}AI生产策略</button><button class="btn primary" data-aidd-strategy-new>${icon('plus')}人工规则策略</button>`;}
function aiddEnsureStrategyGroup(sceneId){
 let group=aiddData.groups.find(item=>item.sceneId===sceneId);
 if(!group){const scene=aiddScene(sceneId);group={id:aiddId('group'),sceneId,name:'默认策略组',mode:'策略优先级执行',priority:1,tags:scene.merchantScope||'',prompt:''};aiddData.groups.push(group);saveAidd();}
 return group;
}
function aiddStrategyMetricIds(strategy){
 const ids=new Set();
 const collect=rule=>{if(!rule)return;if(rule.children){rule.children.forEach(collect);return;}if(rule.metricId)ids.add(rule.metricId);if(rule.rightType==='metric'&&rule.rightMetricId)ids.add(rule.rightMetricId);};
 if(strategy.execution==='模型理解')aiddSceneMetrics(aiddScene(strategy.sceneId)).filter(metric=>(strategy.contentObjects||[]).includes(metric.name)).forEach(metric=>ids.add(metric.id));
 collect(strategy.rule);
 for(const id of strategy.diagnosticMetricIds||[])ids.add(id);return [...ids];
}
function aiddStrategiesPanel(){
 const all=aiddData.strategies,query=aiddUI.query.toLowerCase(),rank={'生效中':0,'待生效':1,'已失效':2};
 const rows=all.filter(strategy=>(aiddUI.status==='all'||strategy.status===aiddUI.status)&&`${strategy.name} ${strategy.id} ${strategy.businessMeaning||''} ${aiddScene(strategy.sceneId)?.name||''}`.toLowerCase().includes(query)).sort((a,b)=>(rank[a.status]??3)-(rank[b.status]??3));
 return `<div class="card aidd-table-card frame-list strategy-list"><div class="aidd-card-intro"><div class="row"><h2>诊断策略列表</h2>${aiddProductionStatusCounts(all)}</div></div>${aiddSearchBar('搜索策略名称或关联场景',aiddSelect('status',[['all','全部状态'],['生效中','生效中'],['待生效','待生效'],['已失效','已失效']],aiddUI.status,'aria-label="策略状态"'))}<div class="table-wrap"><table><thead><tr><th>策略名称</th><th>关联场景</th><th>关联资产</th><th>状态</th><th>版本 / 更新时间</th><th>操作</th></tr></thead><tbody>${aiddPage(rows).map(strategy=>`<tr><td><strong class="strategy-name">${esc(strategy.name)}</strong><small class="aidd-cell-note">${esc(strategy.production)} · ${esc(strategy.execution)}${strategy.reviewStatus?` · ${esc(strategy.reviewStatus)}`:''}</small></td><td>${esc(aiddScene(strategy.sceneId)?.name||'原关联场景已移除')}</td><td>${aiddStrategyMetricIds(strategy).length} 个指标 · ${strategy.actionIds.length} 个行动建议</td><td>${aiddBadge(strategy.status)}${strategy.executionReadiness?`<small class="aidd-cell-note">${esc(strategy.executionReadiness)}</small>`:''}</td><td>v${strategy.version||1}<small class="aidd-cell-note">${esc(strategy.updatedAt||strategy.createdAt||'—')}</small>${aiddProductionUsageHTML(strategy,true)}</td><td><div class="aidd-row-actions">${strategy.status==='待生效'?`<button class="table-action" data-aidd-strategy-edit="${esc(strategy.id)}">配置</button>`:`<button class="table-action" data-strategy-detail="${esc(strategy.id)}">查看详情</button>`}${strategy.status==='生效中'?`<button class="table-action muted-action" data-aidd-strategy-state="${esc(strategy.id)}">下线</button>`:''}${strategy.status==='已失效'?`<button class="table-action danger" data-aidd-delete="strategies|${esc(strategy.id)}">删除</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="6" class="empty-search">没有匹配的诊断策略</td></tr>'}</tbody></table></div>${aiddPager(rows.length)}</div>`;
}
function aiddViewStrategy(id){
 const strategy=aiddFind('strategies',id);if(!strategy)return;aiddUI.sceneId=strategy.sceneId;
 const metrics=aiddStrategyMetricIds(strategy).map(metricId=>aiddFind('metrics',metricId)).filter(Boolean),actions=strategy.actionIds.map(actionId=>aiddFind('actions',actionId)).filter(Boolean);
 modal('诊断策略详情',`${esc(strategy.name)} · v${strategy.version||1}`,`<div class="strategy-readonly"><div class="strategy-detail-status">${aiddBadge(strategy.status)}<span>${esc(strategy.updatedAt||strategy.createdAt||'')}</span></div>${aiddProductionUsageHTML(strategy)}<dl class="frame-filled"><div><dt>策略名称</dt><dd>${esc(strategy.name)}</dd></div><div><dt>关联场景</dt><dd>${esc(aiddScene(strategy.sceneId).name)}</dd></div><div><dt>生产方式 / 判断方式</dt><dd>${esc(strategy.production)} · ${esc(strategy.execution)}</dd></div><div><dt>优先级</dt><dd>${strategy.priority}</dd></div>${strategy.reviewStatus?`<div><dt>审核状态</dt><dd>${esc(strategy.reviewStatus)}</dd></div>`:''}${strategy.thresholdBasis?`<div class="full"><dt>触发依据</dt><dd>${esc(strategy.thresholdBasis)}</dd></div>`:''}${strategy.exceptionHandling?`<div class="full"><dt>异常处理</dt><dd>${esc(strategy.exceptionHandling)}</dd></div>`:''}${strategy.pendingItems?.length?`<div class="full"><dt>生成时待补项</dt><dd>${strategy.pendingItems.map(esc).join('<br>')}</dd></div>`:''}${strategy.businessFrameworkVersion===2?aiddBusinessStrategyFields(strategy):''}${strategy.description?`<div class="full"><dt>目标</dt><dd>${esc(strategy.description)}</dd></div>`:''}${strategy.merchantScope?`<div class="full"><dt>适用范围</dt><dd>${esc(strategy.merchantScope)}</dd></div>`:''}${strategy.businessMeaning?`<div class="full"><dt>业务含义</dt><dd>${esc(strategy.businessMeaning)}</dd></div>`:''}${metrics.length?`<div class="full"><dt>关联指标</dt><dd class="frame-tags">${metrics.map(metric=>pill(metric.name,'outline')).join('')}</dd></div>`:''}<div class="full"><dt>${strategy.execution==='模型理解'?'内容判断标准':'指标规则'}</dt><dd class="strategy-rule-result">${esc(strategy.execution==='模型理解'?strategy.contentPrompt:aiddRuleText(strategy.rule))}</dd></div>${actions.length?`<div class="full"><dt>关联行动建议</dt><dd>${actions.map(action=>`<div class="strategy-detail-action"><strong>${esc(action.executionName||action.name)}</strong><p>${esc(strategy.actionSubtitles[action.id]||action.subtitle||action.description||'')}</p></div>`).join('')}</dd></div>`:''}</dl><details class="strategy-more-actions"><summary>更多操作</summary><div class="row aidd-wrap"><button class="btn" data-aidd-strategy-copy="${esc(id)}">复制策略</button><button class="btn" data-aidd-strategy-history="${esc(id)}">版本记录</button>${strategy.status==='已失效'?`<button class="btn" data-aidd-delete="strategies|${esc(id)}">删除已失效策略</button>`:''}</div></details></div>`,`<button class="btn" data-action="close-modal">关闭</button><button class="btn primary" data-aidd-strategy-edit="${esc(id)}">更改配置</button>`,true);
}
function aiddHandleStrategyClick(data){
 if(data.strategyDetail)aiddViewStrategy(data.strategyDetail);
 else if('strategySavePublish'in data)aiddSaveStrategy(true);
 else return false;
 return true;
}
document.addEventListener('change',event=>{
 const input=event.target;
 if(input.id==='aidd-strategy-scene'){
  const draft=aiddReadStrategy();aiddUI.sceneId=input.value;const scene=aiddScene(),group=aiddEnsureStrategyGroup(scene.id);
  Object.assign(draft,{sceneId:scene.id,groupId:group.id,group:group.name,merchantScope:scene.merchantScope,priority:aiddSceneStrategies(scene.id).length+1,rule:{join:'AND',children:[aiddNewRule()]},actionIds:[],actionSubtitles:{}});
  closeModal();aiddEditStrategy(null,draft);
 }
});

function aiddBusinessStrategyFields(strategy){
 return `<div class="full"><dt>业务状态</dt><dd>定义已发布；${esc(strategy.executionReadiness)}。证据不足时返回无法判断。</dd></div><div class="full"><dt>指标核查入口</dt><dd>${esc(strategy.metricRuleText)}</dd></div><div class="full"><dt>问题确认条件</dt><dd>${esc(strategy.confirmationRule)}</dd></div><div class="full"><dt>去重及归属</dt><dd>${esc(strategy.exclusionPolicy)}</dd></div><div class="full"><dt>缺少指标或证据</dt><dd>${esc(strategy.missingMetricOrEvidence.join('；')||'真实取数与经营明细待接入')}</dd></div>`;
}
