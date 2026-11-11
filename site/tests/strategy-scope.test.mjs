import test from 'node:test';
import assert from 'node:assert/strict';
import {shareCatalogStrategies,sharedStrategy} from '../shared/strategy-scope.js';
import {AIDD_PRODUCTION_MODELS} from '../worker/aidd-production-models.js';

test('合并只去掉周期副本，人工修改的不同规则保留且各周期使用相同的定义',()=>{
 const strategy={id:'research-strategy-01-week-1',sceneId:'s',name:'规模回落（近7天）',groupId:'research-group-1-week',group:'交易（近7天）',period:'week',rule:{metricId:'m',op:'<',value:10},actionIds:['a'],protocol:{strategyCode:'research-strategy-01-week-1',period:'week'}};
 const day={...structuredClone(strategy),id:'research-strategy-01-day-1',name:'规模回落（昨日）',group:'交易（昨日）',groupId:'research-group-1-day',period:'day'};day.rule.value=20;
 const data={groups:['week','day'].map(period=>({id:'research-group-1-'+period,sceneId:'s',period,name:'交易（'+(period==='week'?'近7天':'昨日')+'）'})),strategies:[strategy,day],published:{s:{periods:{week:{sceneId:'s',strategies:[strategy]},day:{sceneId:'s',strategies:[day]}}}}};
 shareCatalogStrategies(data);assert.equal(data.groups.length,1);assert.equal(data.strategies.length,2);assert.deepEqual(data.strategies.map(s=>s.rule.value),[10,20]);assert.equal(new Set(data.strategies.map(s=>s.id)).size,2);
 assert.deepEqual(data.published.s.periods.week.strategies,data.published.s.periods.day.strategies);assert.ok(data.strategies.every(s=>!Object.hasOwn(s,'period')));
 const snapshot=JSON.stringify(data);shareCatalogStrategies(data);assert.equal(JSON.stringify(data),snapshot);
});

test('生产模型契约不再包含策略周期，旧候选也去掉周期限制',()=>{
 for(const key of ['ai','content','parse']){const model=AIDD_PRODUCTION_MODELS[key];assert.ok(model,key);assert.match(model.systemPrompt,/跨统计周期共用/);assert.doesNotMatch(JSON.stringify(model.outputs),/"name":"period"/);}
 const original={period:'day',rule:{metricId:'m',op:'<',value:5},protocol:{period:'day',actions:[]}},result=sharedStrategy(original);
 assert.equal(Object.hasOwn(result,'period'),false);assert.equal(Object.hasOwn(result.protocol,'period'),false);assert.equal(original.period,'day');assert.deepEqual(result.rule,original.rule);
});
