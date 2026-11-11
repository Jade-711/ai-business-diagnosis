import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const read=name=>readFile(new URL('../web/'+name+'.js',import.meta.url),'utf8');
async function dashboard(){
 const c=vm.createContext({localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener(){}},window:{addEventListener(){}},money:value=>value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})});
 const app=await read('app');vm.runInContext(app.slice(0,app.indexOf('const NODES =')),c);
 for(const name of ['merchant-data','merchant-ui','merchant-report','demo-coverage','production-rules','aidd-data','production-usage','aidd-ui','framework-prompt','framework-ui','strategy-ui','ai-strategy-ui','coze-client'])vm.runInContext(await read(name),c);
 vm.runInContext('initAidd()',c);return c;
}
function assertOverview(html){
 assert.match(html,/成交<strong>下降12\.0%/);
 assert.match(html,/订单量下降20\.8%/);
 assert.doesNotMatch(html,/资料不足|补齐诊断资料|暂无可用经营数据|经营正常|NaN|Infinity|undefined/);
 assert.equal((html.match(/<p>/g)||[]).length,1);
}
test('没有全店发布配置时，小结仍使用看板指标并给出可用的数据入口',async()=>{
 const c=await dashboard();
 const result=vm.runInContext(`(()=>{
  delete aiddData.published['scene-overview'];
  const result=merchantDemoResult(merchantQuestion(),{fieldKey:'overview',period:'week'},aiddRequestConfig({fieldKey:'overview',period:'week'}));
  return {diagnosticStatus:result.status,values:result.metricAnalysis.length,html:merchantBusinessSummary(),published:!!aiddData.published['scene-overview']};
 })()`,c);
 assert.equal(result.diagnosticStatus,'missing_data');assert.ok(result.values>0);
 assertOverview(result.html);assert.match(result.html,/href="#merchant\/dashboard\/overview\/week\/orders"/);
 assert.equal(result.published,false);
});
test('场景或框架主动下线后，基础小结正常且不会重新启用配置',async()=>{
 for(const kind of ['scene','framework']){
  const c=await dashboard();
  const result=vm.runInContext(`(()=>{
   const scene=aiddData.scenes.find(s=>s.fieldKey==='overview'),frame=aiddData.frameworks.find(f=>f.sceneId===scene.id);
   const item=${kind==='scene'?'scene':'frame'};item.status='${kind==='scene'?'已下线':'已失效'}';
   const before=JSON.stringify(aiddData),html=merchantBusinessSummary();
   return {html,unchanged:JSON.stringify(aiddData)===before,active:aiddRuntimeConfig('overview','week').active};
  })()`,c);
  assertOverview(result.html);assert.equal(result.active,false);assert.equal(result.unchanged,true);
  assert.doesNotMatch(result.html,/data-action-suggestion/);
 }
});
test('AIDD 指标资产未配置时，不把看板已有的经营数据隐藏掉',async()=>{
 const c=await dashboard();
 const html=vm.runInContext(`aiddData.metrics=[];merchantBusinessSummary()`,c);
 assertOverview(html);
});
test('五个场域、两个周期均可生成小结，保留原有紧凑卡片和已生效建议',async()=>{
 const c=await dashboard();
 const results=vm.runInContext(`Object.keys(MERCHANT_FIELDS).flatMap(fieldKey=>['week','day'].map(period=>{state.fieldKey=fieldKey;state.period=period;return {fieldKey,period,html:merchantBusinessSummary()};}))`,c);
 assert.equal(results.length,10);
 for(const {html} of results){assert.match(html,/merchant-summary-actions/);assert.doesNotMatch(html,/资料不足|NaN|Infinity|undefined/);assert.equal((html.match(/<p>/g)||[]).length,1);}
 const overview=results.find(r=>r.fieldKey==='overview'&&r.period==='week').html;
 assertOverview(overview);assert.match(overview,/建议检查重点商品。/);
});
test('真正没有本周期数值时，提示经营数据缺失；零成交仍按有效数值处理',async()=>{
 const c=await dashboard();
 const empty=vm.runInContext(`for(const m of Object.values(fieldMetrics()))m.week.value=null;merchantBusinessSummary()`,c);
 assert.match(empty,/当前周期暂无可用经营数据/);assert.doesNotMatch(empty,/资料不足|成交.*下降|订单量下降/);
 const zero=vm.runInContext(`for(const m of Object.values(fieldMetrics()))m.week.value=0;merchantBusinessSummary()`,c);
 assert.match(zero,/成交<strong>下降100\.0%/);assert.doesNotMatch(zero,/暂无可用经营数据|NaN|Infinity/);
});
test('缺少有效对比期时，只展示当前值，不误报环比持平或经营正常',async()=>{
 const c=await dashboard();
 for(const value of ['null','0','NaN']){
  const html=vm.runInContext(`for(const m of Object.values(fieldMetrics()))m.week.previousValue=${value};merchantBusinessSummary()`,c);
  assert.match(html,/118,560\.00/);assert.match(html,/暂无同口径对比数据/);
  assert.doesNotMatch(html,/环比持平|经营正常|NaN|Infinity|下降12/);
 }
});
