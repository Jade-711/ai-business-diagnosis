import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {merchantFastResult} from '../worker/merchant-fast-path.js';
import {repairLiveRevenueCatalog} from '../shared/live-revenue-config.js';
const catalog=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
const asset=JSON.parse((await readFile(new URL('../web/curated-catalog.js',import.meta.url),'utf8')).split('const AIDD_CURATED_CATALOG = ')[1].trim().replace(/;$/,''));
const question='帮我分析近7天直播的成交金额变化的原因和改善建议';
const request=q=>({question:q,sellerId:'DEMO_10001',pageContext:{fieldKey:'live',period:'week'}});
const run=(changes={},q=question)=>{const copy=structuredClone(catalog);for(const [id,change] of Object.entries(changes))Object.assign(copy['live:week'].data.metrics.find(m=>m.id===id),change);return merchantFastResult(request(q),copy);};
test('成交下降20%独立触发，即使千次产出上升仍能读到原因指标并给出行动',()=>{
 const response=run({'research-metric-live-18':{value:2000,previousValue:1000}}),r=response.result;
 assert.equal(r.execution.frameworkName,'直播整体诊断框架');assert.equal(r.diagnosis.length,1);
 const d=r.diagnosis[0];assert.equal(d.strategyId,'research-strategy-07-4');assert.equal(d.name,'直播成交金额回落');
 assert.deepEqual(new Set(d.evidence.map(m=>m.metricId)),new Set(['research-metric-live-02','research-metric-live-10','research-metric-live-01','research-metric-live-17']));
 const a=d.analysis,c=a.calculations[0];assert.equal(a.kind,'live_revenue');assert.match(a.conclusion,/观看规模收缩/);
 assert.equal(c.current,80000/12000);assert.equal(c.previous,100000/16000);assert.ok(Math.abs(c.volumeEffect+25833.333333333332)<1e-8);assert.ok(Math.abs(c.outputEffect-5833.333333333332)<1e-8);assert.ok(Math.abs(c.volumeEffect+c.outputEffect+20000)<1e-8);
 assert.match(a.checks,/取消或缩短/);assert.match(a.checks,/自然\/付费来源/);assert.match(a.checks,/补排/);assert.match(a.limitation,/不是因果证明/);
 assert.deepEqual(new Set(r.actions.map(a=>a.name)),new Set(['创建直播计划','选品&话术准备']));
 assert.equal(response.updates.find(x=>x.kind==='evidence').metrics.length,r.evidence.length);
 assert.ok(run({},'直播成交金额下降了20%，为什么下降，有什么改善建议？'));
});
test('观看未降、零值、缺失和成交恢复分别判断，不把下降恒等式写成确定根因',()=>{
 const stable=run({'research-metric-live-10':{value:16000,previousValue:16000}}).result.diagnosis[0].analysis;
 assert.match(stable.conclusion,/观看规模未降/);assert.equal(stable.calculations[0].volumeEffect,0);assert.equal(stable.calculations[0].outputEffect,-20000);
 for(const value of [0,null]){const a=run({'research-metric-live-10':{value}}).result.diagnosis[0].analysis;assert.equal(a.complete,false);assert.equal(a.calculations.length,0);assert.match(a.checks,/补齐/);assert.doesNotMatch(a.reason,/NaN|Infinity/);}
 for(const value of [100000,120000])assert.ok(run({'research-metric-live-02':{value}}).result.diagnosis.every(d=>d.strategyId!=='research-strategy-07-4'));
 const viewer=run({},'分析近7天直播观看人数变化').result;assert.deepEqual(viewer.diagnosis.map(d=>d.strategyId),['research-strategy-07-2']);
 const broad=run({},'分析近7天直播整体经营').result;assert.deepEqual(broad.diagnosis.map(d=>d.strategyId),['research-strategy-07-4']);
});
test('框架策略双周期同步修订且幂等，保留旧版本和未关联资产',()=>{
 const s=asset.strategies.find(s=>s.id==='research-strategy-07-4'),f=asset.frameworks.find(f=>f.id==='research-framework-07');
 assert.equal(s.version,3);assert.equal(f.version,3);assert.equal(s.rule.children.length,1);assert.equal(s.rule.children[0].metricId,'research-metric-live-02');assert.match(f.prompt,/下降即诊断|下降，独立/);
 assert.ok(s.history.some(v=>v.name==='成交与千次观看产出同时回落'));assert.ok(f.history.length);
 for(const p of ['week','day']){const snapshot=asset.published['research-scene-007'].periods[p];assert.equal(snapshot.frameworkVersion,3);assert.ok(snapshot.strategies.every(s=>s.frameworkVersion===3));assert.equal(snapshot.strategies.find(candidate=>candidate.id===s.id).version,3);}
 assert.deepEqual(repairLiveRevenueCatalog(asset),asset);
 const other=asset.strategies.find(s=>s.sceneId==='research-scene-008');assert.equal(other.version,2);
});
