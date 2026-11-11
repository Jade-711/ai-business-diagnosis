import {legacyDemoCatalog} from './legacy-catalog.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({URL,esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),icon:()=>''});
for(const file of ['merchant-report.js','goal-report.js'])vm.runInContext(await readFile(new URL('../web/'+file,import.meta.url),'utf8'),context);
const catalog=legacyDemoCatalog;
function result(field='live',period='day'){
 const data=structuredClone(catalog[field+':'+period].data),metrics=data.metrics.filter(m=>m.derived==='value').map(m=>({...m,metricId:m.id}));
 return {schemaVersion:1,status:'success',branch:'diagnosis',dataMode:'demo',context:{fieldKey:field,period},metricAnalysis:metrics,evidence:metrics,goal:data.goal,fieldBreakdown:data.fieldBreakdown,diagnosis:[{name:'商品点击效率下降',triggered:true}],missing:[]};
}
test('目标提问进入独立反馈，昨日直播准确给出75%完成、2000元缺口及33.3%补差量级',()=>{
 const r=result(),before=JSON.stringify(r),b=context.buildMerchantBrief(r,'帮我分析昨日直播的目标差距');
 assert.equal(b.type,'goal');assert.equal(b.rate,75);assert.equal(b.gap,2000);assert.ok(Math.abs(b.uplift-33.333333333)<1e-6);
 assert.equal(b.plans.length,2);assert.match(b.plans[0].detail,/2.4%提高到约3.2%/);assert.match(b.plans[1].detail,/达到8,000元参考目标/);assert.match(b.plans[1].metrics[0].value,/12,980/);
 const html=context.merchantBriefHTML(r,'帮我分析昨日直播的目标差距');assert.match(html,/目标诊断/);assert.match(html,/情景测算/);assert.match(html,/data-action-suggestion/);assert.doesNotMatch(html,/问题1|点击意愿下降/);assert.match(b.verification,/昨日已结束/);assert.equal(JSON.stringify(r),before);
});
test('全店目标按各场域差额分布确定补差顺序，不用经营异常代替目标归因',()=>{
 const b=context.buildMerchantGoalBrief(result('overview','week'),'近7天全店目标差距');assert.equal(b.gap,24440);assert.equal(b.fields[0].fieldKey,'live');assert.equal(b.fields[0].gap,11440);assert.equal(b.fields[1].fieldKey,'video');assert.ok(Math.abs(b.fields.reduce((s,f)=>s+f.share,0)-100)<1e-6);assert.match(b.plans[0].title,/优先补直播/);assert.equal(b.plans[0].actions[0].kind,'diagnose');assert.match(b.text,/10月14日—10月20日/);
});
test('场域超额抵消其他缺口时，使用未达标场域缺口占比，避免超过100%的伪分摊',()=>{
 const r=result('overview');r.fieldBreakdown=[{fieldKey:'live',target:100,actual:50},{fieldKey:'video',target:100,actual:120}];r.goal={actual:170,target:200};
 const b=context.buildMerchantGoalBrief(r);assert.equal(b.gap,30);assert.equal(b.shareLabel,'未达标场域缺口占比');assert.equal(b.fields[0].share,100);
});
test('已经达标、零成交与缺少目标分别处理，不输出假缺口或无穷倍提升',()=>{
 const r=result();r.goal={actual:9000,target:8000};const achieved=context.buildMerchantGoalBrief(r);assert.equal(achieved.achieved,true);assert.equal(achieved.gap,0);assert.doesNotMatch(achieved.text,/情景测算/);
 r.goal={actual:0,target:8000};const zero=context.buildMerchantGoalBrief(r);assert.equal(zero.uplift,null);assert.doesNotMatch(zero.text,/Infinity|NaN/);assert.match(zero.text,/先恢复/);
 r.goal={actual:6000};const missing=context.buildMerchantGoalBrief(r);assert.equal(missing.valid,false);assert.equal(missing.plans.length,0);assert.match(missing.verdict,/资料不足/);
});
test('情景参考值不会要求点击率超过100%，一般经营知识不误入目标报告',()=>{
 const r=result();r.goal={actual:100,target:10000};const b=context.buildMerchantGoalBrief(r);assert.ok(b.plans.every(p=>!p.metrics.some(m=>m.value==='240%')));assert.equal(context.isGoalQuestion('什么是目标诊断'),false);assert.equal(context.isGoalQuestion('昨天直播为什么没有达标'),true);
});
