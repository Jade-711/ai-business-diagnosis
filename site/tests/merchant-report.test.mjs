import {legacyDemoCatalog} from './legacy-catalog.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../web/merchant-report.js',import.meta.url),'utf8');
const catalog=legacyDemoCatalog;
const context=vm.createContext({URL,esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),icon:()=>'<svg></svg>'});
vm.runInContext(source,context);
function result(field='overview',period='week',focus=''){
 const data=structuredClone(catalog[field+':'+period].data);
 const metrics=data.metrics.filter(m=>m.derived==='value').map(m=>({...m,metricId:m.id}));
 return {status:'success',branch:'diagnosis',dataMode:'demo',context:{fieldKey:field,period,metricKey:focus},metricAnalysis:metrics,evidence:metrics,goal:data.goal,fieldBreakdown:data.fieldBreakdown,diagnosis:[{triggered:true,name:'内部规则名称不应直接成为商家回答',evidence:metrics}],missing:[]};
}
test('全店回答围绕问题、关键指标、可验证原因及优先行动组织',()=>{
 const brief=context.buildMerchantBrief(result(),'帮我分析近7天全店经营表现');
 assert.match(brief.verdict,/成交回落12\.0%/);assert.match(brief.goalText,/82\.9%.*24,440/);
 assert.equal(brief.metrics.length,3);assert.match(brief.reason,/订单减少20\.8%/);assert.match(brief.reason,/每单金额上升11\.2%/);
 assert.match(brief.problems[1].detail,/46\.8%/);assert.equal(brief.actions[0].title,'先分析直播');
 assert.match(brief.uncertainty,/明细验证/);assert.doesNotMatch(brief.text,/内部规则名称|变化需核查|规则命中/);
 assert.equal(brief.followUp.label,'继续分析直播');
});
test('回答由本次证据计算，数据变动会改变归因结果',()=>{
 const r=result();const orders=r.metricAnalysis.find(m=>m.metricKey==='orders');orders.value=orders.previousValue*.9;
 const brief=context.buildMerchantBrief(r);
 assert.match(brief.reason,/订单减少10\.0%/);assert.doesNotMatch(brief.reason,/订单减少20\.8%/);
});
test('单指标诊断优先解释所问环节，保留具体原因待验证',()=>{
 const r=result('live','week','clickRate');r.diagnosis[0].explanation='价格过高导致点击下降';
 const brief=context.buildMerchantBrief(r,'分析商品点击率变化');
 assert.match(brief.reason,/4\.1%降至2\.8%/);assert.equal(brief.metrics[0].key,'clickRate');
 assert.ok(brief.metrics.length<=3);assert.doesNotMatch(brief.text,/价格过高导致/);assert.match(brief.uncertainty,/验证/);
 assert.match(brief.actions[0].detail,/按商品对比曝光与点击/);
});
test('未命中且指标改善时，不把改善描述为下降或经营异常',()=>{
 const r=result('live','week','clickRate');r.diagnosis=[];
 const click=r.metricAnalysis.find(m=>m.metricKey==='clickRate');click.value=5;click.previousValue=4;
 const brief=context.buildMerchantBrief(r,'点击率表现如何');
 assert.match(brief.verdict,/暂未发现/);assert.match(brief.reason,/4%升至5%/);assert.doesNotMatch(brief.reason,/降至|比例降低/);
});
test('缺少配置或数据时，不能输出经营正常的判断',()=>{
 const r=result();r.status='missing_data';r.missing=['该场景没有已生效配置'];
 const brief=context.buildMerchantBrief(r);assert.match(brief.verdict,/暂不能/);assert.match(brief.actions[0].title,/补齐/);assert.doesNotMatch(brief.verdict,/未发现.*异常/);
});
test('缺少上期值或除数为零时，不虚构比较值或算出Infinity',()=>{
 const r=result();r.metricAnalysis.forEach(m=>{m.previousValue=0;});r.evidence=r.metricAnalysis;
 const brief=context.buildMerchantBrief(r);assert.doesNotMatch(brief.text,/Infinity|NaN|每单金额上升/);
 assert.ok(brief.metrics.every(m=>m.comparison==='暂无可比数据'));
});
test('全景追问会清除上一轮单指标的展示范围',()=>{
 const brief=context.buildMerchantBrief(result('overview','week','clickRate'),'帮我分析近7天全店经营表现');
 assert.equal(brief.metrics[0].key,'gmv');assert.match(brief.problems[0].title,/下单规模/);
});
test('每个问题内分别展示指标、原因及行动按钮，完整证据折叠',()=>{
 const r=result();r.missing=['<img src=x onerror=alert(1)>'];
 const html=context.merchantBriefHTML(r,'全店经营表现');
 const issues=[...html.matchAll(/<section class="merchant-issue"[\s\S]*?<\/section>/g)].map(m=>m[0]);
 assert.equal(issues.length,2);
 for(const issue of issues){assert.match(issue,/关联指标/);assert.match(issue,/原因判断/);assert.match(issue,/行动建议/);assert.match(issue,/<button/);}
 assert.match(issues[0],/订单减少20\.8%/);assert.doesNotMatch(issues[0],/分析直播问题/);
 assert.match(issues[1],/占全店缺口46\.8%/);assert.doesNotMatch(issues[1],/订单减少20\.8%/);
 assert.match(html,/<details class="merchant-brief-details"><summary>/);assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
 assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|营销工具/);
 assert.match(html,/data-chat-question=.*近7天直播/);
});
test('直播缺口拥有自身指标和行动，历史文本也按问题完整分组',()=>{
 const brief=context.buildMerchantBrief(result());
 assert.equal(brief.issues.length,2);
 assert.equal(brief.issues[1].metrics[0].value,'48,560元');assert.equal(brief.issues[1].metrics[2].value,'11,440元');
 assert.equal(brief.issues[0].actions[0].href,'#merchant/dashboard/overview/week/orders');
 assert.equal(brief.issues[1].actions[0].kind,'diagnose');assert.equal(brief.issues[1].actions[1].href,'#merchant/dashboard/live/week/gmv');
 const [first,second]=brief.text.split('问题2：');assert.match(first,/问题1：[\s\S]*关联指标：[\s\S]*原因判断：[\s\S]*行动建议：/);assert.match(second,/直播目标缺口最大[\s\S]*48,560元[\s\S]*分析直播问题/);
});
test('行动工具链接只绑定到对应指标，拒绝脚本链接',()=>{
 const r=result();r.actions=[{id:'click',name:'无关直播行动',metricIds:['live-clickRate-value'],pcLink:'https://tools.example/live'},{id:'orders',name:'处理订单问题',metricIds:['overview-orders-value'],pcLink:'https://tools.example/orders'}];
 const brief=context.buildMerchantBrief(r);assert.equal(brief.issues[0].actions[1].pcLink,'https://tools.example/orders');
 let html=context.merchantBriefHTML(r);assert.match(html,/href="https:\/\/tools.example\/orders"/);assert.doesNotMatch(html,/tools.example\/live/);
 r.actions[1].pcLink='javascript:alert(1)';html=context.merchantBriefHTML(r);assert.doesNotMatch(html,/href="javascript:/);assert.match(html,/data-action-suggestion=/);
});
test('单指标与周期由问题内的数据按钮带入，原因和行动保留在同一卡内',()=>{
 const brief=context.buildMerchantBrief(result('live','day','clickRate'),'分析点击率表现');
 assert.equal(brief.issues.length,1);assert.equal(brief.issues[0].actions[0].href,'#merchant/dashboard/live/day/clickRate');
 assert.equal(brief.issues[0].actions[1].label,'检查商品展示与讲解');assert.match(brief.issues[0].actions[1].detail,/按商品对比曝光与点击/);
});

test('模糊近期问题明确沿用实际昨日口径，不自行改成近7天',()=>{
 const r=result('overview','day'),q='帮我分析下我近期全店经营情况',scope=context.merchantScopeInfo(r,q),html=context.merchantBriefHTML(r,q,true);
 assert.match(scope.text,/全店 · 昨日（2026年10月20日）/);assert.match(scope.text,/对比前一日（10月19日）/);assert.match(scope.inherited,/未指定具体时间/);assert.doesNotMatch(scope.text,/近7天/);
 assert.match(html,/本次分析：全店/);assert.match(html,/2026年10月20日/);assert.match(context.buildMerchantBrief(r,q).text,/^本次分析：全店 · 昨日/);
});
test('明确提问及跨场景追问使用本次返回范围，查数标明查询口径',()=>{
 const r=result('live','week'),scope=context.merchantScopeInfo(r,'帮我分析近7天直播经营表现');
 assert.equal(scope.inherited,'');assert.match(scope.text,/直播 · 近7天（2026年10月14日—10月20日）/);assert.match(scope.text,/前7天（10月7日—10月13日）/);
 const inherited=context.merchantScopeInfo({...r,branch:'data'},'支付金额是多少');assert.match(inherited.text,/^本次查询：直播/);assert.match(inherited.inherited,/未指定场域和具体时间/);
});
