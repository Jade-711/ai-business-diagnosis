import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {configurationPayload,metricsPayload} from '../worker/resource-contract.js';
const catalog=JSON.parse(await readFile(new URL('../worker/demo-catalog.json',import.meta.url),'utf8'));
test('新资源契约对五场域双周期保留指标编号、名称、单位和数值',()=>{
 for(const [key,preset] of Object.entries(catalog)){
  const field=key.split(':')[0],config=configurationPayload(preset.config,field,'test'),data=metricsPayload(preset.data);
  assert.equal(config.frameworkCandidates.length,1,key);
  assert.deepEqual(data.metricValues.map(({id,label,unit,value,previousValue})=>({id,label,unit,value,previousValue})),preset.data.metrics.map(({id,label,unit,value,previousValue})=>({id,label,unit,value,previousValue})));
  assert.ok(config.strategies.length>0,key);
  for(const strategy of config.strategies){assert.equal(strategy.merchantScope,'');assert.equal(strategy.scopeMode,'data_requirements');assert.ok(strategy.merchantScopeDescription);assert.equal(strategy.dataRequirements.requirePrevious,true);}
 }
});
test('全店六个P0问题选择对应生效框架，不把自然语言数据要求当商家标签',()=>{
 const preset=catalog['overview:week'];
 for(const [question,name] of [['全店整体交易','整体交易'],['全店整体流量','整体流量'],['全店整体转化','整体转化'],['全店商品供给','商品供给'],['全店服务体验','服务体验'],['全店用户经营','用户经营']]){
  const config=configurationPayload(preset.config,'overview','test',{question});
  assert.equal(config.frameworkCandidates.length,1);assert.ok(config.framework.name.includes(name),question);assert.ok(config.strategies.every(s=>s.frameworkId===config.framework.id));
 }
});
test('兼容旧意图路由时只给本次明确指标分配别名，成交退款率不会串到成交金额',()=>{
 const preset=catalog['creator:week'],request={question:'分析近7天达人合作成交退款率(金额)'};
 const config=configurationPayload(preset.config,'creator','test',request),data=metricsPayload(preset.data,undefined,request),target=config.metricDefinitions.find(m=>m.originalName==='成交退款率(金额)');
 assert.deepEqual(config.metricDefinitions.filter(m=>m.metricKey==='gmv').map(m=>m.id),[target.id]);
 assert.deepEqual(data.metricValues.filter(m=>m.metricKey==='gmv').map(m=>m.id),[target.id]);
 assert.equal(data.metricValues.find(m=>m.id===target.id).unit,'%');
});
test('旧配置仍遵循原契约，未知指标不补成其他指标或演示旧值',()=>{
 const legacy={active:true,sceneId:'old',fieldKey:'live',metrics:[{id:'old-m',metricKey:'gmv',derived:'value'}],actions:[],strategies:[]};
 assert.equal(configurationPayload(legacy,'live','legacy').metricDefinitions[0].metricKey,'gmv');
 assert.deepEqual(metricsPayload(catalog['live:week'].data,'old-m').metricValues,[]);
 assert.equal(metricsPayload(catalog['live:week'].data,'old-m').errors.length,1);
});
