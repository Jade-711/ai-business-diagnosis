import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {merchantFastResult} from '../worker/merchant-fast-path.js';
import {merchantRankIssues,merchantIssueQueue,merchantAdvanceIssueQueue,merchantIssueWriting} from '../shared/merchant-priority.js';
const catalog=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
const result=()=>merchantFastResult({question:'帮我分析近7天全店的经营表现',sellerId:'DEMO_10001',pageContext:{fieldKey:'overview',period:'week'}},catalog).result;
const rank=r=>merchantRankIssues(r.diagnosis,r,catalog['overview:week'].config.metrics);
test('排序兼顾目标关联与异常幅度，首批最多3项，全部10项证据保留',()=>{
 const r=result(),before=JSON.stringify(r),ranked=rank(r),q=merchantIssueQueue(ranked);
 assert.equal(q.total,10);assert.equal(q.active.length,3);assert.equal(q.remaining,7);assert.equal(q.canNext,false);assert.equal(q.active[0].finding.name,'成交金额与订单量同时回落');assert.ok(q.active.some(x=>x.finding.name==='支付日口径退款率上升'));
 assert.equal(JSON.stringify(r),before);assert.ok(ranked.every((x,i)=>i===0||ranked[i-1].score>=x.score));
 const changed=structuredClone(r),goods=changed.diagnosis.find(d=>d.name==='在架与动销商品数同时减少');
 goods.evidence[0].value=5;assert.equal(rank(changed)[0].finding.name,'在架与动销商品数同时减少');
 const specific={...r,goal:{metricId:'research-metric-service-02',name:'客服回复目标'}};
 assert.equal(rank(specific)[0].finding.name,'客服3分钟回复率下降');assert.match(rank(specific)[0].reason,/直接关联客服回复目标/);
});
test('必须处理完当前批次才可继续，不重复、不跳过，最后一批正确收尾',()=>{
 const ranked=rank(result());let progress={};
 assert.equal(merchantAdvanceIssueQueue(ranked,progress,'next').batchIndex,0);
 const seen=[];
 for(let batch=0;batch<4;batch++){
  let q=merchantIssueQueue(ranked,progress);assert.equal(q.batchIndex,batch);assert.equal(q.active.length,Math.min(3,10-batch*3));
  for(const item of q.active){assert.ok(!seen.includes(item.id));seen.push(item.id);progress=merchantAdvanceIssueQueue(ranked,progress,'toggle',item.id);}
  q=merchantIssueQueue(ranked,progress);assert.equal(q.ready,true);assert.equal(q.canNext,batch<3);
  if(batch<3)progress=merchantAdvanceIssueQueue(ranked,progress,'next');
 }
 const final=merchantIssueQueue(ranked,progress);assert.equal(final.complete,true);assert.equal(final.remaining,0);assert.equal(final.handledIds.length,10);assert.equal(new Set(seen).size,10);
});
test('撤销处理会重新关闭下一批入口，刷新状态与会话之间隔离，损坏状态不能跳过未处理问题',()=>{
 const ranked=rank(result()),initial=merchantIssueQueue(ranked);let p={};
 for(const item of initial.active)p=merchantAdvanceIssueQueue(ranked,p,'toggle',item.id);
 assert.equal(merchantIssueQueue(ranked,p).canNext,true);
 p=merchantAdvanceIssueQueue(ranked,p,'toggle',initial.active[0].id);assert.equal(merchantIssueQueue(ranked,p).canNext,false);
 assert.deepEqual(merchantIssueQueue(ranked,JSON.parse(JSON.stringify(p))),merchantIssueQueue(ranked,p));
 assert.equal(merchantIssueQueue(ranked,{}).handledIds.length,0);assert.equal(merchantIssueQueue(ranked,{batchIndex:4,handledIds:['forged']}).batchIndex,0);
 const valid=merchantIssueQueue(ranked,{order:['unknown',initial.active[0].id,initial.active[0].id],handledIds:['unknown'],batchIndex:100});assert.equal(new Set(valid.order).size,10);assert.equal(valid.handledIds.length,0);assert.equal(valid.batchIndex,0);
});
test('原因分为123条，行动分为abc条，计算与待验证限制完整留存',()=>{
 const r=result();for(const finding of r.diagnosis){const writing=merchantIssueWriting(finding.analysis,finding.evidence);
  assert.deepEqual(writing.reasonItems.map(x=>x.label),['判断','依据','待验证']);assert.deepEqual(writing.actionItems.map(x=>x.label),['定位','核查与调整','验证']);assert.ok(writing.reasonItems.every(x=>x.text.length<160));assert.ok(writing.actionItems.every(x=>x.text.length<120));
 }
 const trade=merchantIssueWriting(r.diagnosis.find(d=>d.name==='成交金额与订单量同时回落').analysis);assert.match(trade.reasonItems[1].text,/28,948\.72/);assert.match(trade.reasonItems[2].text,/算术关系/);
 const refund=merchantIssueWriting(r.diagnosis.find(d=>d.name.includes('支付日')).analysis,[{label:'金额退款率（支付日）'}]);assert.match(refund.reasonItems[1].text,/1\.4个百分点/);assert.match(refund.reasonItems[2].text,/不等于退款金额增加/);
});
