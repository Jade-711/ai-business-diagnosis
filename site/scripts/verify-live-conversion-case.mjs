import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {merchantFastResult} from '../worker/merchant-fast-path.js';
const catalog=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
const definition=JSON.parse((await readFile(new URL('../web/curated-catalog.js',import.meta.url),'utf8')).split('const AIDD_CURATED_CATALOG = ')[1].trim().replace(/;$/,''));
const scene=definition.scenes.find(s=>s.id==='research-scene-016'),frame=definition.frameworks.find(f=>f.sceneId===scene.id);
const beforeValues={'research-metric-live-02':80000,'research-metric-live-03':800,'research-metric-live-04':800,'research-metric-live-08':100,'research-metric-live-12':4000,'research-metric-live-16':20,'research-metric-live-17':4};
const previousValues={'research-metric-live-02':100000,'research-metric-live-03':1000,'research-metric-live-04':1000,'research-metric-live-08':100,'research-metric-live-12':4000,'research-metric-live-16':25,'research-metric-live-17':5};
const run=values=>{
 const copy=structuredClone(catalog),data=copy['live:week'].data;
 data.metrics=data.metrics.map(m=>Object.hasOwn(values,m.id)?{...m,value:values[m.id],previousValue:previousValues[m.id]}:m);
 data.goal={name:'直播成交目标',metricId:'research-metric-live-02',actual:values['research-metric-live-02'],target:100000,rate:values['research-metric-live-02']/1000,gap:Math.max(0,100000-values['research-metric-live-02'])};
 return merchantFastResult({question:'帮我分析近7天直播转化',sellerId:'DEMO_10001',pageContext:{fieldKey:'live',period:'week'}},copy)?.result;
};
const before=run(beforeValues),after=run(previousValues);
assert.equal(before.execution.frameworkId,frame.id);assert.equal(before.diagnosis.length,1);assert.equal(before.diagnosis[0].strategyId,'research-strategy-16-1');assert.equal(before.goal.gap,20000);assert.equal(after.diagnosis.length,0);assert.equal(after.goal.rate,100);
const report={caseType:'合成验收案例，非真实商家实绩',scene:{id:scene.id,name:scene.name,level:scene.level,parent:'直播整体'},framework:{id:frame.id,name:frame.name},metrics:scene.metricIds.map(id=>({id,name:definition.metrics.find(m=>m.id===id).originalName,unit:definition.metrics.find(m=>m.id===id).unit,previousValue:previousValues[id],beforeValue:beforeValues[id],acceptanceValue:previousValues[id]})),actions:scene.actionIds.map(id=>{const a=definition.actions.find(a=>a.id===id);return {id,name:a.name,purpose:a.description};}),strategies:definition.strategies.filter(s=>s.sceneId===scene.id).map(s=>({id:s.id,name:s.name,rule:s.rule})),matchedStrategyId:before.diagnosis[0].strategyId,beforeGoal:before.goal,acceptanceGoal:after.goal,interpretation:'商品点击人数4000不变，点击后成交率25%降至20%，定位成交承接环节；尚不能仅凭汇总值确定经营根因。',merchantVerificationExample:'人工核对重点商品的店铺券适用人群、有效期和商品范围；若确认优惠资格配置错误，仅修正该配置，并以同对象对照复核。',acceptance:'验收样例保持点击4000、客单价100元，转化率恢复25%时，成交人数1000、成交金额100000元，目标完成100%；此为合成验收，不承诺真实提升。',beforeResult:before,acceptanceResult:after};
const dir=new URL('../../../output/all-scenes-deployment-20261103/',import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('live-conversion-case.json',dir),JSON.stringify(report,null,2));console.log(JSON.stringify({scene:scene.name,framework:frame.id,matched:report.matchedStrategyId,beforeGap:before.goal.gap,acceptanceRate:after.goal.rate}));
