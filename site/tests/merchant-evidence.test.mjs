import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {merchantEvidenceAnalysis} from '../shared/merchant-evidence.js';
import {merchantFastResult} from '../worker/merchant-fast-path.js';
const catalog=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
const request=question=>({question,sellerId:'DEMO_10001',pageContext:{fieldKey:'overview',period:'week'}});

test('复现全店问题：覆盖六个已发布P0方向，不再仅检查整体交易',()=>{
 const r=merchantFastResult(request('帮我分析近7天全店的经营表现'),catalog).result;
 assert.equal(r.coverage.frameworks.length,6);assert.equal(r.coverage.selectedStrategyCount,21);assert.equal(r.coverage.evaluatedStrategyCount,21);assert.equal(new Set(r.execution.selectedStrategyIds).size,21);
 assert.equal(r.diagnosis.length,10);assert.equal(r.explanationSource,'evidence_analysis');
 for(const name of ['成交金额与订单量同时回落','支付日口径退款率上升','商品点击未减但内容触达用户减少','在架与动销商品数同时减少','发货及时率下降','首购和复购用户同时减少'])assert.ok(r.diagnosis.some(d=>d.name===name),name);
 const focused=merchantFastResult(request('分析近7天全店整体交易'),catalog).result;
 assert.equal(focused.coverage.frameworks.length,1);assert.equal(focused.diagnosis.length,2);
 const disabled=structuredClone(catalog);disabled['overview:week'].config.frameworkCandidates.find(f=>f.name.includes('服务体验')).active=false;
 const filtered=merchantFastResult(request('分析近7天全店经营表现'),disabled).result;
 assert.equal(filtered.coverage.frameworks.length,5);assert.ok(filtered.diagnosis.every(d=>!d.strategyId.startsWith('research-strategy-05-')));
});

test('成交变化从实际数值分解，订单与每单金额贡献之和严格等于成交差额',()=>{
 const r=merchantFastResult(request('分析近7天全店整体交易'),catalog).result,d=r.diagnosis.find(d=>d.name==='成交金额与订单量同时回落'),a=d.analysis,c=a.calculations[0];
 assert.match(a.reason,/25,000元/);assert.match(a.reason,/订单量收缩/);assert.match(a.reason,/每单.*71\.67.*73\.08.*上升2\.0%/);assert.match(a.reason,/28,948\.72/);assert.match(a.reason,/3,948\.72/);
 assert.ok(Math.abs(c.orderEffect+c.valueEffect-c.total)<1e-8);assert.equal(c.total,-25000);assert.match(a.limitation,/不是因果证明/);
 const changed=structuredClone(r);const amount=changed.diagnosis[0].evidence.find(m=>m.metricId==='research-metric-trade-01');amount.value=240000;
 const recalculated=merchantEvidenceAnalysis(changed.diagnosis[0],changed,catalog['overview:week'].config.metrics);
 assert.equal(recalculated.calculations[0].total,25000);assert.doesNotMatch(recalculated.conclusion,/本次成交回落/);
 const missing=structuredClone(d);missing.evidence.find(m=>m.metricId==='research-metric-trade-05').previousValue=0;
 const safe=merchantEvidenceAnalysis(missing,{...r,metricAnalysis:[],evidence:[]},[]);assert.equal(safe.calculations.length,0);assert.doesNotMatch(safe.reason,/Infinity|NaN/);
});

test('退款率分别给百分点与相对变化，缺少分子分母时不编造退款金额或经营根因',()=>{
 const r=merchantFastResult(request('分析近7天全店整体交易'),catalog).result,a=r.diagnosis.find(d=>d.name.includes('退款率')).analysis;
 assert.match(a.reason,/4\.8%.*6\.2%.*上升1\.4个百分点.*29\.2%/);assert.match(a.conclusion,/分母基数|归因窗口/);assert.match(a.limitation,/缺少.*分子.*分母/);assert.match(a.checks,/退款金额、成交金额和退款订单/);assert.doesNotMatch(a.reason,/品质.*导致|退款金额增加了|1\.4%/);
});

test('39条P0策略跨双周期保留动态数值分析、缺失说明和对应核查动作',()=>{
 const checked=new Set();
 for(const [key,preset] of Object.entries(catalog))for(const strategy of preset.config.strategies.filter(s=>preset.config.frameworkCandidates.some(f=>f.sceneId===s.sceneId&&f.priority==='P0'))){
  checked.add(strategy.id);
  const evidence=strategy.metricIds.map(id=>preset.data.metrics.find(m=>m.id===id)).filter(Boolean).map(m=>({...m,metricId:m.id}));
  const r={metricAnalysis:preset.data.metrics,evidence},a=merchantEvidenceAnalysis({name:strategy.name,evidence},r,preset.config.metrics);
  assert.equal(a.complete,true,key+' '+strategy.name);assert.equal(a.facts.length>=evidence.length,true);assert.ok(a.checks.length>35);assert.ok(a.limitation.length>25);assert.notEqual(a.reason,strategy.businessMeaning);
  const changed=structuredClone(evidence);changed[0].value+=preset.config.metrics.find(m=>m.id===changed[0].id).unit==='%'?.5:10;
  assert.notEqual(merchantEvidenceAnalysis({name:strategy.name,evidence:changed},r,preset.config.metrics).reason,a.reason);
  const absent=changed.map(m=>({...m,value:null,previousValue:undefined}));const missing=merchantEvidenceAnalysis({name:strategy.name,evidence:absent},{},preset.config.metrics);
  assert.equal(missing.complete,false);assert.match(missing.reason,/缺失/);assert.doesNotMatch(missing.reason,/Infinity|NaN/);
 }
 assert.equal(checked.size,39);
});

test('不对去重曝光与新发数量、结算日佣金、退款日金额编造算术归因',()=>{
 const run=(key,name)=>{const preset=catalog[key],s=preset.config.strategies.find(s=>s.name===name),evidence=s.metricIds.map(id=>({...preset.data.metrics.find(m=>m.id===id),metricId:id}));return merchantEvidenceAnalysis({name,evidence},{metricAnalysis:preset.data.metrics},preset.config.metrics);};
 assert.match(run('video:week','发布减少并伴随曝光回落').checks,/不能.*去重.*除以新发布/);
 const commission=run('creator:week','成交未增但结算日佣金增加');assert.equal(commission.calculations.length,0);assert.match(commission.limitation,/不能.*佣金率.*ROI/);
 const refund=run('shelf:week','成交未增而商品卡退款金额增加');assert.equal(refund.calculations.length,0);assert.match(refund.limitation,/不能计算.*净成交/);
});
