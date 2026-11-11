import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {dashboardSnapshotSignature,readDashboardSnapshots,saveDashboardSnapshot,dashboardSnapshotQuestion} from '../worker/dashboard-snapshots.js';
import {prepareWorkflowDiagnosis} from '../shared/workflow-diagnosis.js';
const read=name=>readFile(new URL('../web/'+name+'.js',import.meta.url),'utf8');
async function runtime(){
 const store=new Map(),events=[],requests=[];
 const c=vm.createContext({console,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},document:{addEventListener:(name,fn)=>events.push({name,fn})},window:{addEventListener(){}},fetch:async(path,options)=>{requests.push({path,body:JSON.parse(options.body)});return {json:async()=>({snapshots:{}})};}});
 const app=await read('app');vm.runInContext(app.slice(0,app.indexOf('const NODES =')),c);
 vm.runInContext('function persist(){};function toast(){};function render(){};function closeModal(){};function cancelModalBtn(){return "";};function pill(text){return text;};function navItem(label){return label;};function money(n){return n.toLocaleString("zh-CN",{maximumFractionDigits:2});}',c);
 for(const name of ['vendor/lz-string-1.5.0.min','catalog-storage','scene-routing','scene-business-specs','scene-deployment','live-revenue-config','merchant-data','merchant-ui','merchant-evidence','merchant-priority','merchant-report','goal-report','demo-coverage','strategy-scope','curated-catalog','published-actions','published-action-mappings','curated-control','production-rules','aidd-data','production-usage','aidd-ui','framework-prompt','framework-ui','strategy-ui','ai-strategy-ui','coze-client','curated-merchant','workflow-view','dashboard-snapshots'])vm.runInContext(await read(name),c);
 vm.runInContext('initAidd();Object.assign(COZE_CONNECTION,{checked:true,configured:true,authorized:true,enabled:true});',c);
 c.cozeRequest=()=>{throw Error('看板不应运行工作流');};return {c,requests,events};
}
test('五场域两周期按最新精简格式展示，看板只读取快照，从不发起诊断或生成请求',async()=>{
 const {c,requests}=await runtime();
 const views=vm.runInContext(`Object.keys(MERCHANT_FIELDS).flatMap(field=>['week','day'].map(period=>{state.view='merchant';state.fieldKey=field;state.period=period;dashboardSnapshotSchedule();return {summary:merchantBusinessSummary(),metrics:merchantMetricCards(),diagnosis:merchantDiagnosis()};}))`,c);
 await new Promise(setImmediate);
 assert.equal(views.length,10);assert.equal(requests.length,1);assert.equal(requests[0].path,'/api/dashboard/snapshot');assert.equal(requests[0].body.operation,'read');
 for(const view of views){
  for(const html of Object.values(view))assert.doesNotMatch(html,/工作流正在诊断|完整核验|NaN|Infinity|undefined|负向因素|正向因素|抵消/);
  for(const label of ['结论','证据','原因','建议'])assert.ok(view.summary.includes(label+'：</strong>'));
  assert.doesNotMatch(view.metrics,/查看诊断|metric-bound-diagnosis|data-insight-question|结论：|原因：|建议：/);
  assert.equal((view.metrics.match(/data-metric-key=/g)||[]).length,3);
  const goal=view.diagnosis.split('<section class="goal-panel"')[1].split('</section>')[0];
  assert.doesNotMatch(goal,/证据：|原因：|建议：/);assert.match(goal,/分场域目标达成/);assert.equal((goal.match(/class="goal-field-row /g)||[]).length,4);
  const issues=view.diagnosis.split('<div class="diagnosis-findings">')[1];assert.doesNotMatch(issues,/结论：/);for(const label of ['证据','原因','建议'])assert.ok(issues.includes(label+'：</strong>'));
  assert.match(view.summary,/data-action="open-assistant"/);assert.match(view.diagnosis,/data-ask-goal=/);
 }
 assert.match(views[0].summary,/19万元|成交金额19万元/);assert.match(views[0].summary,/订单变少/);assert.match(views[0].summary,/11\.6%/);assert.match(views[0].summary,/1个百分点/);
});
test('三项指标均为当前场域已发布资产，全店和两个场域未达成且目标独立计算',async()=>{
 const {c}=await runtime();
 const rows=vm.runInContext(`Object.keys(MERCHANT_FIELDS).flatMap(field=>['week','day'].map(period=>{state.fieldKey=field;state.period=period;const ids=merchantCoreMetricKeys(),available=curatedDashboardMetrics(field,period);return {field,period,ids,core:curatedCoreMetricIds(),allAvailable:ids.every(id=>available.some(m=>m.id===id)),goal:merchantGoalFields(),expected:FIELD_KEYS.map(k=>({field:k,...curatedGoalData(k,period)}))};}))`,c);
 for(const row of rows){
  assert.equal(row.ids.length,3);assert.equal(new Set(row.ids).size,3);assert.deepEqual(row.ids.slice(0,3),row.core);assert.equal(row.allAvailable,true);
  for(const g of row.expected){assert.match(row.goal,new RegExp('data-field="'+g.field+'"'));assert.ok(row.goal.includes(g.rate.toFixed(1)+'%'));}
 }
 const week=rows.find(row=>row.field==='overview'&&row.period==='week');assert.equal(week.expected.filter(g=>g.gap>0).length,2);assert.match(week.goal,/80\.0%/);assert.match(week.goal,/104\.0%/);assert.match(week.goal,/100\.0%/);assert.match(vm.runInContext("state.fieldKey='overview';state.period='week';dashboardRuleGoal(dashboardRuleBundle())",c),/88\.4|还差2.5万元/);
 const missing=vm.runInContext(`(()=>{const id=curatedGoalMetricId('live','week','gmv');aiddData.demoData.metrics[id].week.value=null;return merchantGoalFields('week');})()`,c);assert.match(missing,/待补充/);assert.doesNotMatch(missing,/NaN|Infinity/);
});
test('零值与缺失前期不误报经营正常，配置下线后不借旧快照判断',async()=>{
 const {c}=await runtime();
 const missing=vm.runInContext(`(()=>{const id=curatedCoreMetricIds()[0];aiddData.demoData.metrics[id].week.previousValue=null;return dashboardSummaryCopy(dashboardRuleBundle());})()`,c);
 assert.match(missing.conclusion,/暂无可比前期/);assert.match(missing.evidence,/前期值待补充/);
 const zero=vm.runInContext(`(()=>{const id=curatedCoreMetricIds()[0];aiddData.demoData.metrics[id].week.value=0;aiddData.demoData.metrics[id].week.previousValue=100;return dashboardSummaryCopy(dashboardRuleBundle());})()`,c);
 assert.match(zero.conclusion,/目标尚未达成/);assert.match(zero.evidence,/100\.0%/);
});
test('完整通过核验的真实模型结果才可保存，读取按账号、配置和数据隔离且不调用模型',async()=>{
 const rows=new Map(),db={prepare(sql){return {bind(...values){this.values=values;return this;},async run(){if(sql.startsWith('INSERT'))rows.set(this.values[0],{generated_at:this.values[5],result:this.values[6]});return {};},async first(){return rows.get(this.values[0])||null;}};}};
 const config={active:true,metrics:[{id:'m1'}]},catalog={'live:week':{data:{metrics:[{id:'m1',value:200,previousValue:250}]}}},body={pageContext:{fieldKey:'live',period:'week'},runtimeConfigurations:{'live:week':config}},result={schemaVersion:1,workflowContract:1,workflow:{modelOutputReceived:true},quality:{validated:true},context:{fieldKey:'live',period:'week'},answer:'本次真实模型结果'};
 const saved=await saveDashboardSnapshot(db,'owner',body,result,catalog);assert.equal(saved.origin,'workflow_snapshot');
 assert.equal((await readDashboardSnapshots(db,'owner',body.runtimeConfigurations,catalog)).snapshots['live:week'].result.answer,result.answer);
 assert.equal(Object.keys((await readDashboardSnapshots(db,'other',body.runtimeConfigurations,catalog)).snapshots).length,0);
 assert.equal(Object.keys((await readDashboardSnapshots(db,'owner',{'live:week':{...config,active:false}},catalog)).snapshots).length,0);
 assert.equal(Object.keys((await readDashboardSnapshots(db,'owner',body.runtimeConfigurations,{'live:week':{data:{metrics:[]}}})).snapshots).length,0);
 for(const change of [{quality:{validated:false}},{workflow:{modelOutputReceived:false}},{context:{fieldKey:'video',period:'week'}}])await assert.rejects(saveDashboardSnapshot(db,'owner',body,{...result,...change},catalog),/未完整通过核验/);
 assert.equal(await dashboardSnapshotSignature({b:2,a:1},{n:3}),await dashboardSnapshotSignature({a:1,b:2},{n:3}));
 assert.notEqual(await dashboardSnapshotSignature(config,{n:3}),await dashboardSnapshotSignature(config,{n:4}));
});
test('固定点位快照读取失败不会转成自动生成或自动诊断',async()=>{
 const {c,requests}=await runtime();c.fetch=async()=>{throw Error('offline');};vm.runInContext("state.view='merchant';dashboardSnapshotSchedule();",c);await new Promise(setImmediate);
 assert.equal(requests.length,0);assert.match(c.dashboardRuleSummary(),/结论/);assert.doesNotMatch(c.dashboardRuleSummary(),/正在诊断/);
 const app=await read('app');assert.doesNotMatch(app,/workflowDashboardSchedule/);const open=app.slice(app.indexOf('function openChat('),app.indexOf('function assistantMessage('));assert.doesNotMatch(open,/sendQuestion\(/);assert.match(open,/chat\.draft=question/);
});
test('离线任务保留五场域双周期相同的指标和发布策略，不重复索取固定点位未使用的模型小结',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8')),names={overview:'全店',live:'直播',video:'短视频',shelf:'货架',creator:'达人合作'};
 for(const [key,{config,data}] of Object.entries(catalog)){
  const [fieldKey,period]=key.split(':'),context={sellerId:'DEMO_10001',fieldKey,period},ordinary=`帮我分析${period==='day'?'昨日':'近7天'}${names[fieldKey]}的经营表现`,offline=dashboardSnapshotQuestion(fieldKey,period),prepare=question=>prepareWorkflowDiagnosis({question,context,configuration:config,data}).result;
  assert.doesNotMatch(offline,/经营表现|经营情况|经营小结|整体经营|总体经营/);
  const a=prepare(ordinary),b=prepare(offline);assert.deepEqual(b.metricAnalysis,a.metricAnalysis);assert.deepEqual(b.diagnosis.map(f=>f.strategyId),a.diagnosis.map(f=>f.strategyId));assert.equal(b.goal.actual,a.goal.actual);assert.equal(b.coverage.selectedStrategyCount,a.coverage.selectedStrategyCount);
 }
});

test('看板建议及按钮直接使用命中策略的发布映射，后台草稿不会越过发布生效',async()=>{
 const {c}=await runtime();
 const before=vm.runInContext(`(()=>{state.fieldKey='overview';state.period='week';const b=dashboardRuleBundle(),f=b.findings.find(f=>f.strategyId==='research-strategy-01-3');return dashboardIssueCopy(f,b);})()`,c);
 assert.deepEqual(Array.from(before.actions,a=>a.id),['research-action-31']);
 const draft=vm.runInContext(`(()=>{const s=aiddData.strategies.find(s=>s.id==='research-strategy-01-3');s.actionIds=['research-action-34'];s.actionSubtitles={'research-action-34':'草稿：核对营销活动'};const b=dashboardRuleBundle();return dashboardIssueCopy(b.findings.find(f=>f.strategyId===s.id),b);})()`,c);
 assert.deepEqual(Array.from(draft.actions,a=>a.id),['research-action-31']);assert.doesNotMatch(draft.action,/草稿/);
 const published=vm.runInContext(`(()=>{for(const period of ['week','day']){const p=aiddData.published['research-scene-001'].periods[period],s=p.strategies.find(s=>s.id==='research-strategy-01-3');s.actionIds=['research-action-34'];s.actionSubtitles={'research-action-34':'核查活动承诺与退款原因，确认问题后修改对应活动'};const d=aiddData.demoData.metrics[s.metricIds[0]][period];d.value=d.previousValue+1;}return ['week','day'].map(period=>{state.period=period;const b=dashboardRuleBundle();return dashboardIssueCopy(b.findings.find(f=>f.strategyId==='research-strategy-01-3'),b);});})()`,c);
 for(const copy of published){assert.deepEqual(Array.from(copy.actions,a=>a.id),['research-action-34']);assert.equal(copy.action,'核查活动承诺与退款原因，确认问题后修改对应活动');assert.equal(copy.actions[0].recommendation,copy.action);}
 const removed=vm.runInContext(`(()=>{state.period='week';aiddData.published['research-scene-001'].periods.week.strategies.find(s=>s.id==='research-strategy-01-3').actionIds=[];const b=dashboardRuleBundle();return dashboardIssueCopy(b.findings.find(f=>f.strategyId==='research-strategy-01-3'),b);})()`,c);
 assert.equal(removed.actions.length,0);assert.match(removed.action,/尚未配置/);
});
test('服务端发布映射覆盖旧快照映射，改名、说明、顺序和工具详情同步且保留策略规则',async()=>{
 const {c}=await runtime();
 const result=vm.runInContext(`(()=>{state.fieldKey='overview';state.period='week';const p=aiddData.published['research-scene-001'].periods.week,rule=JSON.stringify(p.strategies[0].rule);const publication=actionMappingPublication(p),s=publication.strategies.find(s=>s.id==='research-strategy-01-3');s.actionIds=['research-action-34','research-action-31'];s.actionSubtitles={'research-action-34':'先核对活动承诺','research-action-31':'再处理已确认的退款问题'};publication.actions.push({...p.actions.find(a=>a.id==='research-action-34'),name:'活动管理新名称'});publication.actions=[...new Map(publication.actions.map(a=>[a.id,a])).values()];aiddApplyActionPublications({schemaVersion:1,revision:123,scenes:{[p.sceneId]:publication}});const b=dashboardRuleBundle(),copy=dashboardIssueCopy(b.findings.find(f=>f.strategyId==='research-strategy-01-3'),b);return {copy,detail:aiddPublishedToolAsset('活动管理新名称'),unchanged:JSON.stringify(p.strategies[0].rule)===rule};})()`,c);
 assert.deepEqual(Array.from(result.copy.actions,a=>a.name),['活动管理新名称','售后工作台']);assert.equal(result.copy.action,'先核对活动承诺；再处理已确认的退款问题');assert.equal(result.detail.id,'research-action-34');assert.equal(result.unchanged,true);
});

test('后台发布入口成功后同步两周期；服务端拒绝时保留上次已发布映射和草稿',async()=>{
 const {c}=await runtime(),sent=[];
 vm.runInContext(`(()=>{const s=aiddData.strategies.find(s=>s.id==='research-strategy-01-3');s.status='待生效';s.actionIds=['research-action-34'];s.actionSubtitles={'research-action-34':'发布验证：核对活动承诺'};})()`,c);
 c.fetch=async(path,options)=>{const publication=JSON.parse(options.body);sent.push({path,publication});return {ok:true,json:async()=>({publication:{...publication,revision:456}})};};
 assert.equal(await c.aiddPublishScene('research-scene-001','research-strategy-01-3'),true);
 assert.equal(sent[0].path,'/api/dashboard/action-mappings');assert.equal(sent[0].publication.sceneId,'research-scene-001');
 const published=vm.runInContext(`['week','day'].map(period=>aiddRuntimeConfig('overview',period,{question:merchantQuestion('overview',period)}).strategies.find(s=>s.id==='research-strategy-01-3').actionSubtitles['research-action-34'])`,c);
 assert.deepEqual(Array.from(published),['发布验证：核对活动承诺','发布验证：核对活动承诺']);
 vm.runInContext(`aiddData.strategies.find(s=>s.id==='research-strategy-01-3').actionIds=[]`,c);
 c.fetch=async()=>({ok:false,json:async()=>({error:'模拟服务端写入失败'})});
 assert.equal(await c.aiddPublishScene('research-scene-001','research-strategy-01-3'),false);
 assert.deepEqual(Array.from(vm.runInContext(`aiddRuntimeConfig('overview','week',{question:merchantQuestion('overview','week')}).strategies.find(s=>s.id==='research-strategy-01-3').actionIds`,c)),['research-action-34']);
 assert.equal(vm.runInContext(`aiddData.strategies.find(s=>s.id==='research-strategy-01-3').actionIds.length`,c),0);
});
