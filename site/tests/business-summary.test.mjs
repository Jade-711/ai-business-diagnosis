import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBusinessSummary,validateBusinessSummary} from '../shared/business-summary.js';
const summary='结论：目标已达成，但成交、流量和转化都在回落。\n依据：成交19万元，较前期下降11.6%；目标完成132.9%。\n原因：订单变少拉低了成交，每笔订单金额提高弥补了一部分下降，具体原因仍需核查。\n建议：先核对订单减少集中在哪些商品，确认商品信息有问题后通过商品列表调整。';
const overview={goal:{actual:190000,target:143000}};
test('完整四段按结论先行解析，保留模型语言与证据边界',()=>{
 assert.deepEqual(parseBusinessSummary(summary).map(p=>p.label),['结论','依据','原因','建议']);
 assert.deepEqual(validateBusinessSummary(summary,overview),[]);
 assert.equal(parseBusinessSummary(summary.replace('原因：','建议：')),null);
 assert.equal(parseBusinessSummary(summary.split('\n').slice(1).join('\n')),null);
});
test('拦截术语堆砌、目标矛盾、完成率错写和过长小结，供原有单次补全处理',()=>{
 for(const text of [summary.replace('订单变少拉低了成交','成交订单数减少为主要负向因素'),summary.replace('目标已达成','目标尚未达成'),summary.replace('132.9%','90%'),summary.replace('但成交、流量和转化都在回落','字'.repeat(110))])assert.ok(validateBusinessSummary(text,overview).length);
 assert.ok(validateBusinessSummary(summary,{goal:{actual:100,target:200}}).length);
 const full={...overview,metrics:[{label:'商品曝光次数',unit:'次',value:100,previousValue:110},{label:'点击成交转化率(订单)',unit:'%',value:6.5,previousValue:7.5}]};
 assert.deepEqual(validateBusinessSummary(summary,full),[]);
 assert.ok(validateBusinessSummary(summary.replace('、流量',''),full).length);
 assert.ok(validateBusinessSummary(summary.replace('和转化',''),full).length);
 assert.ok(validateBusinessSummary(summary.replace('先核对订单减少集中在哪些商品，确认商品信息有问题后通过商品列表调整','核查原因后针对性调整'),full).length);
});
