import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {selectDiagnosticScenes,sceneEvidenceErrors} from '../shared/scene-routing.js';
import {configurationPayload} from '../worker/resource-contract.js';
import {executeMerchantRules,deliverMerchantRules} from '../worker/merchant-kernel.js';
import {buildAllSceneDeployment} from '../shared/scene-deployment.js';
const text=await readFile(new URL('../web/curated-catalog.js',import.meta.url),'utf8');
const catalog=JSON.parse(text.split('const AIDD_CURATED_CATALOG = ')[1].trim().replace(/;$/,''));
const runtime=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
test('四层91场景各有唯一生效框架，228策略按场景唯一归属且跨周期共用',()=>{
 assert.equal(catalog.scenes.length,91);assert.equal(catalog.frameworks.length,91);assert.equal(catalog.strategies.length,228);
 assert.equal(new Set(catalog.scenes.map(s=>s.name)).size,91);assert.equal(new Set(catalog.frameworks.map(f=>f.sceneId)).size,91);
 const counts={};for(const scene of catalog.scenes){counts[scene.level]=(counts[scene.level]||0)+1;const frames=catalog.frameworks.filter(f=>f.sceneId===scene.id&&f.status==='生效中');assert.equal(frames.length,1,scene.name);const strategies=catalog.strategies.filter(s=>s.sceneId===scene.id);assert.ok(strategies.length);for(const s of strategies){assert.equal(s.status,'生效中');assert.ok(s.metricIds.every(id=>scene.metricIds.includes(id)));assert.ok(s.actionIds.length&&s.actionIds.every(id=>scene.actionIds.includes(id)));assert.equal(Object.hasOwn(s,'period'),false);assert.equal(Object.hasOwn(s.protocol,'period'),false);}assert.deepEqual(catalog.published[scene.id].periods.week.strategies,catalog.published[scene.id].periods.day.strategies);}
 assert.deepEqual(counts,{'全店':6,'场域':4,'环节':26,'要素':55});
 assert.equal(buildAllSceneDeployment(catalog).strategies.length,228);
});
test('明确场景只选最细一层，不同时执行父子；宽泛问题仅执行P0',()=>{
 for(const scene of catalog.scenes){const selected=selectDiagnosticScenes(catalog.scenes,'分析'+scene.name,scene.fieldKey,catalog.strategies,catalog.metrics);assert.equal(selected.scenes.length,1,scene.name);assert.equal(selected.scenes[0].id,scene.id,scene.name);}
 const all=selectDiagnosticScenes(catalog.scenes,'分析全店经营表现','overview',catalog.strategies,catalog.metrics);assert.equal(all.scenes.length,6);assert.ok(all.scenes.every(s=>s.priority==='P0'));
 const mixed=selectDiagnosticScenes(catalog.scenes,'分析直播标题和主图','live',catalog.strategies,catalog.metrics);assert.equal(mixed.scenes.length,0);assert.equal(mixed.ambiguous,true);
 const alias=selectDiagnosticScenes(catalog.scenes,'分析直播转化','live',catalog.strategies,catalog.metrics);assert.equal(alias.scenes[0].id,'research-scene-016');
});
test('55个要素均设独立证据门槛，缺素材只返回缺口而非数值归因',()=>{
 for(const scene of catalog.scenes.filter(s=>s.priority==='P2')){
  const config=runtime[scene.fieldKey+':week'].config,payload=configurationPayload(config,scene.fieldKey,'test',{question:'分析'+scene.name});
  assert.equal(payload.frameworkCandidates.length,1,scene.name);assert.equal(payload.frameworkCandidates[0].sceneId,scene.id);assert.ok(payload.errors.some(x=>x.includes('需补充')),scene.name);
  assert.equal(payload.strategies.length,2);assert.ok(payload.strategies.every(s=>s.sceneId===scene.id));
 }
 const f=runtime['live:week'].config.frameworkCandidates.find(f=>f.sceneId==='research-scene-038');assert.ok(sceneEvidenceErrors(f,{}).length>=2);
 const supplied={sellerId:'DEMO_10001',pageContext:{fieldKey:'live',period:'week'},businessEvidence:{sceneId:f.sceneId,context:{sellerId:'DEMO_10001',fieldKey:'live',period:'week'},records:Object.fromEntries(f.requiredEvidence.map(key=>[key,'同对象证据记录']))}};
 assert.deepEqual(sceneEvidenceErrors(f,supplied),[]);
 assert.equal(sceneEvidenceErrors(f,{...supplied,sellerId:'OTHER_SELLER'}).length,f.requiredEvidence.length);
 assert.equal(sceneEvidenceErrors(f,{...supplied,pageContext:{fieldKey:'live',period:'day'}}).length,f.requiredEvidence.length);
});
test('指标名称里的场景前缀不误触发下钻，明确环节及环节专属指标仍可定位',()=>{
 for(const question of ['帮我分析近7天直播的成交金额变化的原因和改善建议','分析直播的观看-成交率(人数)变化']){
  const selected=selectDiagnosticScenes(catalog.scenes,question,'live',catalog.strategies,catalog.metrics);
  assert.deepEqual(selected.scenes.map(s=>s.id),['research-scene-007'],question);
 }
 for(const question of ['分析直播-成交场景的成交金额','分析直播转化','分析直播-成交'])assert.deepEqual(selectDiagnosticScenes(catalog.scenes,question,'live',catalog.strategies,catalog.metrics).scenes.map(s=>s.id),['research-scene-016']);
 assert.deepEqual(selectDiagnosticScenes(catalog.scenes,'分析直播商品点击人数','live',catalog.strategies,catalog.metrics).scenes.map(s=>s.name),['直播-商品点击']);
});
test('直播成交三种条件互斥，点击稳定且转化率下降时只命中承接策略',()=>{
 const config=runtime['live:week'].config,assets=configurationPayload(config,'live','case',{question:'分析直播转化'}),base=runtime['live:week'].data.metrics;
 assert.equal(assets.frameworkCandidates[0].sceneId,'research-scene-016');assert.equal(assets.strategies.length,3);
 for(const rate of [0,20,25,30])for(const clicks of [0,2000,4000,5000]){
  const metrics=base.map(m=>m.id==='research-metric-live-16'?{...m,value:rate,previousValue:25}:m.id==='research-metric-live-12'?{...m,value:clicks,previousValue:4000}:m);
  const execution=executeMerchantRules({question:'分析直播转化',context:{sellerId:'DEMO_10001',fieldKey:'live',period:'week',tags:[]},metricValues:metrics,frameworkCandidates:assets.frameworkCandidates,metricDefinitions:assets.metricDefinitions,strategyCandidates:assets.strategies,actionAssets:assets.actionAssets,configurationErrors:assets.errors});
  assert.ok(execution.ruleResults.filter(r=>r.triggered).length<=1,rate+' '+clicks);
  if(rate===20&&clicks===4000)assert.deepEqual(execution.ruleResults.filter(r=>r.triggered).map(r=>r.strategyId),['research-strategy-16-1']);
 }
});
test('全场景配置压缩无损，原JSON兼容，旧资产和备份均可在浏览器限额内保存',async()=>{
 const c=vm.createContext({});for(const file of ['vendor/lz-string-1.5.0.min.js','catalog-storage.js'])vm.runInContext(await readFile(new URL('../web/'+file,import.meta.url),'utf8'),c);
 const encoded=c.aiddStorageEncode(catalog);assert.ok(encoded.startsWith('AIDD_LZ1:'));assert.ok(encoded.length*2<1024*1024);assert.deepEqual(JSON.parse(JSON.stringify(c.aiddStorageDecode(encoded))),catalog);assert.deepEqual(JSON.parse(JSON.stringify(c.aiddStorageDecode('{"a":1}'))),{a:1});
 const backup=c.aiddStorageEncode([{data:catalog,reason:'发布前备份'}]);assert.ok(backup.length*2<1024*1024);assert.equal(c.aiddStorageDecode(backup)[0].data.frameworks.length,91);
 assert.throws(()=>c.aiddStorageDecode('AIDD_LZ1:broken'));assert.throws(()=>c.aiddStorageEncode(catalog));
});
