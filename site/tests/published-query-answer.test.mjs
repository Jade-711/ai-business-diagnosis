import test from 'node:test';
import assert from 'node:assert/strict';
import {requestedMetricIds,publishedQueryAnswer} from '../shared/published-query-answer.js';
import {researchRoutingAlias} from '../worker/resource-contract.js';
const definitions=[{id:'live-amount',originalName:'成交金额',metricKey:'gmv',unit:'元'},{id:'live-orders',originalName:'成交订单数',metricKey:'orders',unit:'单'}];
const context={fieldKey:'live',period:'week',metricKey:'gmv'};
test('纯指代查数承接已确认指标，明确的新指标优先，未知指标不偷换为旧指标',()=>{
 for(const q of ['那这一块呢？','继续看这一项','那昨天呢？','这个指标是多少？'])assert.deepEqual(requestedMetricIds(definitions,q,context),['live-amount'],q);
 assert.deepEqual(requestedMetricIds(definitions,'那成交订单数呢？',context),['live-orders']);
 assert.deepEqual(requestedMetricIds(definitions,'那退货次数呢？',context),[]);
 assert.deepEqual(requestedMetricIds(definitions,'那这一块呢？',{...context,metricKey:''}),[]);
 const ids=requestedMetricIds(definitions,'那这一块呢？',context);
 const result=publishedQueryAnswer(definitions,[{id:'live-amount',derived:'value',value:123456,previousValue:140000}],ids,context);
 assert.equal(result.status,'success');assert.match(result.answer,/直播近7天：成交金额：123456元/);
 assert.equal(result.evidence[0].value,123456);
});
test('资源端原始发布指标用原ID存储，仍可解析已确认的路由别名',()=>{
 const raw=definitions.map(m=>({...m,metricKey:m.id}));
 assert.deepEqual(requestedMetricIds(raw,'那这一块呢？',context,researchRoutingAlias),['live-amount']);
 assert.deepEqual(requestedMetricIds(raw,'那成交订单数呢？',context,researchRoutingAlias),['live-orders']);
 assert.deepEqual(requestedMetricIds(raw,'那退货次数呢？',context,researchRoutingAlias),[]);
 assert.deepEqual(requestedMetricIds(raw,'那这一块呢？',{...context,metricKey:''},researchRoutingAlias),[]);
});
