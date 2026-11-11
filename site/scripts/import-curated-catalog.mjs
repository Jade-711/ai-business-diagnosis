import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {shareCatalogStrategies} from '../shared/strategy-scope.js';

const [scenePath,evidencePath,auditDir]=process.argv.slice(2);
if(!scenePath||!evidencePath||!auditDir)throw new Error('Provide scene JSON, evidence JSON, and audit directory.');
const source=JSON.parse(await readFile(scenePath,'utf8'));
const evidence=JSON.parse(await readFile(evidencePath,'utf8'));
const stamp=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
const revision='syt-research-20261102-v3';
const clone=x=>JSON.parse(JSON.stringify(x));
const keys=['home','trade','live','liveChannel','video','shelf','creator','creatorVideo','goods','buyer','after','service','logistics','quality'];
const labels=['全店概览','全店交易','直播','直播渠道','短视频','商品卡','达人合作','合作短视频','商品','买家','售后','客服','物流','品质'];
const fieldFor={home:'overview',trade:'overview',live:'live',liveChannel:'live',video:'video',shelf:'shelf',creator:'creator',creatorVideo:'creator',goods:'overview',buyer:'overview',after:'overview',service:'overview',logistics:'overview',quality:'overview'};
const fields={'全店':'overview','直播':'live','短视频':'video','货架':'shelf','达人合作':'creator'};
assert.equal(evidence.metricSources.length,keys.length);
const metrics=[],conditions=[],metricRefs=new Map();
function unit(name){
 if(/率|占比/.test(name))return '%';
 if(/金额|客单价|件单价|笔单价|佣金/.test(name))return '元';
 if(/\(秒\)|（秒）/.test(name))return '秒';
 if(/时长/.test(name))return '待核验';
 if(/体验分/.test(name))return '分';
 if(/人数|用户数|用户量|用户|人均成交件数/.test(name))return /人均成交件数/.test(name)?'件/人':'人';
 if(/次数/.test(name))return '次';
 if(/场次/.test(name))return '场';
 if(/短视频数/.test(name))return '条';
 if(/订单|单量|退单量/.test(name))return '单';
 if(/商品数/.test(name))return '个';
 if(/件数/.test(name))return '件';
 return '待核验';
}
evidence.metricSources.forEach((s,index)=>{
 const key=keys[index],conditionId='research-condition-'+key;
 conditions.push({id:conditionId,code:'SYT_CONDITION_'+key.toUpperCase(),name:s.page+'取数条件（待接入）',source:'线上资料',table:'',period:'近7天',startOffset:-7,endOffset:-1,contextField:'sellerId',sourcePage:s.url,connectionStatus:'not_connected',updatedAt:stamp});
 s.metrics.forEach((name,i)=>{
  const id=`research-metric-${key}-${String(i+1).padStart(2,'0')}`;
  metricRefs.set(key+'\0'+name,id);
  metrics.push({id,code:`SYT_${key}_${String(i+1).padStart(2,'0')}`.toUpperCase(),name:labels[index]+'｜'+name,originalName:name,fieldKey:fieldFor[key],metricKey:id,derived:'value',unit:unit(name),unitBasis:unit(name)==='待核验'?'页面未核验单位':'根据指标名称识别，正式接入时复核',dataType:'Double',source:'线上资料',table:'',sourceField:'',conditionId,description:`线上原名：${name}。范围：${s.field}。来源：${s.page}（${s.url}），${evidence.checkedAt}核验。仅核验定义，真实取数服务未接入。${s.evidence}`,derivations:['环比'],sourceKey:key,provenance:{checkedAt:evidence.checkedAt,page:s.page,url:s.url,evidence:s.evidence},connectionStatus:'not_connected',updatedAt:stamp});
 });
});
const tools=evidence.toolSources.flatMap(s=>s.tools.map(t=>({...t,tab:s.tab})));
const actions=tools.map((t,i)=>({id:'research-action-'+String(i+1).padStart(2,'0'),code:'SYT_TOOL_'+String(i+1).padStart(2,'0'),name:t.name,executionName:t.name,type:/学习中心/.test(t.name)?'展示型':'营销工具型',category:t.tab,priority:i+1,description:t.purpose,subtitle:t.purpose,fieldKey:t.tab.startsWith('直播')?'live':t.tab.startsWith('短视频')?'video':t.tab.startsWith('商城')?'shelf':t.tab==='达人带货'?'creator':'overview',metricIds:[],pcLink:'',mobileLink:'',conditions:t.name==='快分销'?'需要快分销权限；当前账号未开通，具体子工具未核验':'具备对应工作台权限，使用时核对商品、渠道及活动适用条件',exclusions:'当前不适用、无权限或已完成的操作不推荐执行',provenance:{checkedAt:evidence.checkedAt,tab:t.tab,basis:t.basis},updatedAt:stamp}));
const actionByName=new Map(actions.map(a=>[a.name,a]));
const scenes=source.rows.map((r,i)=>({id:'research-scene-'+String(i+1).padStart(3,'0'),code:'SYT_SCENE_'+String(i+1).padStart(3,'0'),name:r.name,priority:r.priority,fieldKey:fields[r.field],level:r.level,parentId:'',description:`${r.priority} ${r.level}场景；按2026-11-02资料重整稿入库。${r.note||''}`,goal:`识别${r.name}的经营变化，依据已关联指标定位需核查的环节，并匹配可用经营工具。`,owner:'资料整理',merchantScope:'有同口径完整周期数据且具备对应经营权限的商家',status:'生效中',metricIds:[...new Set(r.metrics.flatMap(m=>m.names.map(name=>{const id=metricRefs.get(m.key+'\0'+name);assert.ok(id,`Missing metric ${m.key} ${name}`);return id;})))],metricScopes:r.metrics.map(m=>({sourceKey:m.key,scope:m.scope,metricIds:m.names.map(n=>metricRefs.get(m.key+'\0'+n))})),actionIds:r.actionNames.map(name=>{assert.ok(actionByName.has(name));return actionByName.get(name).id;}),createdAt:stamp,updatedAt:stamp,version:1,catalogRevision:revision}));
const sceneByName=new Map(scenes.map(s=>[s.name,s]));
for(const s of scenes){
 if(s.level==='场域')s.parentId=sceneByName.get('全店-整体交易').id;
 if(s.level==='环节')s.parentId=sceneByName.get(s.name.split('-')[0]+'整体').id;
 if(s.level==='要素')s.parentId=sceneByName.get(s.name.split('-').slice(0,2).join('-')).id;
}
for(const a of actions)a.metricIds=[...new Set(scenes.filter(s=>s.actionIds.includes(a.id)).flatMap(s=>s.metricIds))];
const metricById=new Map(metrics.map(m=>[m.id,m]));
const ref=(scene,key,name)=>{const id=metricRefs.get(key+'\0'+name);assert.ok(scene.metricIds.includes(id),`${scene.name}: unbound ${key} ${name}`);return id;};
const previous=(id,op)=>({metricId:id,op,rightType:'metric',rightMetricId:id,leftTransform:'value',leftCalc:'none',leftNumber:1,rightTransform:'previous',rightCalc:'*',factor:1});
const and=(...children)=>({join:'AND',children});
const or=(...children)=>({join:'OR',children});
const ruleIds=r=>r.children?r.children.flatMap(ruleIds):[r.metricId,...(r.rightType==='metric'?[r.rightMetricId]:[])];
const templates=[];
function spec(sceneName,label,build,meaning,actionNames,kind='需要核查'){
 const scene=sceneByName.get(sceneName),get=(key,name)=>ref(scene,key,name),rule=build(get);
 const ids=actionNames.map(n=>actionByName.get(n)?.id);assert.ok(ids.every(id=>scene.actionIds.includes(id)));
 templates.push({scene,label,rule,meaning,actionIds:ids,kind});
}
const down=(g,k,n)=>previous(g(k,n),'<'),up=(g,k,n)=>previous(g(k,n),'>'),stable=(g,k,n)=>previous(g(k,n),'>=');
spec('全店-整体交易','成交规模回落',g=>and(down(g,'trade','成交金额'),or(down(g,'trade','成交订单数'),down(g,'trade','成交人数'))),'金额回落同时伴随订单或买家减少，先按场域和商品核查规模变化。',['商品列表','磁力金牛']);
spec('全店-整体交易','客单价回落需核查结构',g=>and(down(g,'trade','客单价')),'客单价变化可能源于商品或人群结构，不单独认定经营恶化。',['商品列表','营销中心']);
spec('全店-整体交易','支付日口径退款率上升',g=>and(up(g,'trade','金额退款率（支付日）')),'仅比较相同支付日归因及退款观察窗口，不混用退款日口径。',['商品列表','营销中心']);
spec('全店-整体流量','商品曝光缩量',g=>and(down(g,'home','商品曝光次数')),'曝光规模减少，需按场域和渠道核查流量供给。',['磁力金牛','发布短视频','发直播预告']);
spec('全店-整体流量','曝光稳定但商品点击减少',g=>and(stable(g,'home','商品曝光次数'),down(g,'home','商品点击次数')),'曝光未减少而点击减少，优先核查商品呈现及流量匹配。',['发布短视频','发直播预告']);
spec('全店-整体流量','内容触达用户减少',g=>and(down(g,'buyer','内容触达用户量')),'内容触达减少，先区分内容供给与分发变化。',['发布短视频','发直播预告']);
spec('全店-整体转化','点击稳定但成交订单减少',g=>and(stable(g,'trade','商品点击次数'),down(g,'trade','成交订单数')),'优先核对点击后的下单、支付承接和订单口径。',['商品列表','店铺券','客服']);
spec('全店-整体转化','点击稳定但下单订单减少',g=>and(stable(g,'trade','商品点击次数'),down(g,'trade','下单订单数')),'有点击但下单减少时，核查商品信息、价格、库存和咨询承接。',['商品列表','客服']);
spec('全店-整体转化','点击成交转化率回落',g=>and(down(g,'trade','点击成交转化率(订单)')),'订单口径转化率回落需要结合流量结构与商品变化验证。',['商品列表','店铺券']);
spec('全店-商品供给','在架商品规模减少',g=>and(down(g,'goods','在架商品数')),'核查缺货、下架和有效货盘供给，商品总览口径不冒充货架专属数据。',['新增商品','货源市场']);
spec('全店-商品供给','商品动销效率回落',g=>and(down(g,'goods','商品动销率')),'动销率回落提示在架供给与成交覆盖需要进一步核查。',['商机品推荐','货源市场']);
spec('全店-商品供给','在架未减但动销商品减少',g=>and(stable(g,'goods','在架商品数'),down(g,'goods','动销商品数')),'供给规模稳定但有效成交覆盖减少，优先优化货盘结构。',['商机品推荐','新增商品']);
for(const [label,key,name,dir,action] of [
 ['店铺体验分回落','home','店铺体验分','<','售后工作台'],
 ['售后纠纷介入率上升','after','纠纷介入率','>','售后工作台'],
 ['客服3分钟回复率回落','service','3分钟回复率','<','客服'],
 ['发货及时率回落','logistics','发货及时率','<','打单发货'],
 ['商品品质退单率上升','quality','商品品质退单率','>','售后工作台'],
])spec('全店-服务体验',label,g=>and(previous(g(key,name),dir)),'先定位相应售后、客服、物流或品质环节，再核查具体订单；全店服务指标不直接归因于某个场域。',[action]);
for(const [label,name] of [['成交用户规模减少','成交用户数'],['首购用户规模减少','首购用户数'],['复购用户规模减少','复购用户数']])spec('全店-用户经营',label,g=>and(down(g,'buyer',name)),'在相同人群去重、周期及渠道口径下观察用户规模，并区分触达、转化和复购结构。',['优惠券到期提醒','直播爆款返场提醒','店铺券']);
spec('全店-用户经营','粉丝占比变化待核查',g=>and(previous(g('buyer','粉丝占比'),'!=')),'粉丝占比描述用户结构，变化本身不等同经营好坏，需结合成交用户与新老客规模。',['店铺券'],'结构观察');
spec('直播整体','直播场次减少',g=>and(down(g,'live','直播场次')),'核查开播计划、开播稳定性及每场表现。',['创建直播计划','立即开播']);
spec('直播整体','直播观看人数减少',g=>and(down(g,'live','观看人数')),'核查直播供给、自然流和付费渠道，具体原因需渠道证据。',['直播投流','创建直播计划']);
spec('直播整体','观看成交率回落',g=>and(down(g,'live','观看-成交率(人数)')),'观看后的成交承接回落，继续检查讲品、货盘和优惠。',['创建直播计划','立即开播']);
spec('直播整体','成交与千次观看产出同时回落',g=>and(down(g,'live','成交金额'),down(g,'live','千次观看成交金额')),'成交规模和观看产出同时下降，需要兼顾流量质量与成交承接。',['创建直播计划','直播投流']);
spec('短视频整体','带货内容供给减少',g=>and(down(g,'video','新发布短视频数')),'先核查内容发布计划，再与曝光和成交联动判断。',['发布短视频','上传素材，一键生成短视频']);
spec('短视频整体','短视频曝光人数减少',g=>and(down(g,'video','曝光人数')),'区分发布数量、单条分发及付费流量变化，不直接归因标题或封面。',['发布短视频','磁力金牛']);
spec('短视频整体','短视频商品点击人数减少',g=>and(down(g,'video','商品点击人数')),'结合曝光和商品匹配核查商品点击流失。',['发布短视频','上传素材，一键生成短视频']);
spec('短视频整体','短视频成交规模回落',g=>and(down(g,'video','成交金额'),down(g,'video','成交订单数')),'成交金额和订单数同向回落，需继续定位内容触达和成交承接。',['发布短视频','磁力金牛']);
spec('货架整体','商品卡曝光缩量',g=>and(down(g,'shelf','商品卡曝光次数')),'先核查商品卡商品供给、渠道及商城活动适用性。',['去发品','立即推广','【快手商城】低价特卖']);
spec('货架整体','商品卡曝光稳定但点击减少',g=>and(stable(g,'shelf','商品卡曝光次数'),down(g,'shelf','商品卡点击次数')),'优先核查商品展示及价格竞争力，需要商品级明细验证。',['去发品','【快手商城】低价特卖']);
spec('货架整体','商品卡点击成交率回落',g=>and(down(g,'shelf','点击成交率')),'点击后成交承接回落，进一步核对到手价、库存、详情和服务权益。',['【快手商城】低价特卖','去发品']);
spec('货架整体','成交未增但退款金额增加',g=>and(previous(g('shelf','商品卡成交金额'),'<='),up(g,'shelf','商品卡退款金额')),'退款金额与成交规模背离只作为线索；先对齐支付日、退款日及归因窗口再判断。',['去发品']);
spec('达人合作整体','达人合作成交规模回落',g=>and(down(g,'creator','成交金额'),down(g,'creator','成交订单数')),'按达人、货品和合作载体定位成交减少；当前账号快分销未开通。',['快分销','学习中心']);
spec('达人合作整体','佣金支出与成交背离',g=>and(previous(g('creator','成交金额'),'<='),up(g,'creator','佣金支出金额(结算日)')),'结算日佣金与成交归因不同，只提示核对结算批次和合作结构，不计算未经核验的佣金率或ROI。',['快分销','学习中心']);
spec('达人合作整体','达人合作退款率上升',g=>and(up(g,'creator','成交退款率(金额)')),'按达人和商品核查退款结构；具体售后原因须订单证据。',['快分销','学习中心']);
spec('达人合作整体','合作短视频曝光减少',g=>and(down(g,'creatorVideo','短视频曝光次数')),'该曝光口径仅覆盖合作短视频，不代表全部达人直播或商品卡流量。',['快分销','学习中心']);

const frameworks=[],strategies=[],groups=[],published={};
const p0=scenes.filter(s=>s.priority==='P0');
for(const [index,scene] of p0.entries()){
 const id='research-framework-'+String(index+1).padStart(2,'0'),selected=templates.filter(t=>t.scene.id===scene.id);
 const bySource=[...new Set(scene.metricIds.map(id=>metricById.get(id).sourceKey))];
 const branches=bySource.map((key,i)=>({id:id+'-branch-'+(i+1),name:labels[keys.indexOf(key)]+'核查',meaning:'统一商家、周期、归因及渠道后比较当前与前期；结论只到现有指标支持的粒度。',metricIds:scene.metricIds.filter(id=>metricById.get(id).sourceKey===key),actionIds:scene.actionIds,priority:i+1}));
 const body=[`### ${scene.name}诊断框架`,`#### 1. 指标逻辑拓扑和拆解关系`,...branches.map(b=>`- ${b.name}：${b.metricIds.map(id=>`${metricById.get(id).originalName}（${id}）`).join('、')}。`),'- 先核对数据可比性，再观察规模、效率或服务的变化；不执行口径尚未核验的乘除拆解公式。',`#### 2. 异常模式`,...selected.map((t,i)=>`${i+1}. ${t.label}：${t.meaning}`),`#### 3. 规则方向与关联行动`,...selected.map(t=>`- ${t.label} → ${t.actionIds.map(id=>{const a=actions.find(a=>a.id===id);return `${a.name}（${a.id}）：${a.description}`;}).join('；')}。`),`#### 4. 数据边界与输出要求`,'- 仅引用本场景关联指标与行动点；昨日对比前一日，近7天对比前一个完整7天。商家、渠道、归因、时区和去重口径必须一致。','- 规则采用当前值与同口径前周期值直接比较，不使用未经业务核验的行业阈值。结构变化仅提示观察，不宣称经营恶化。','- 名称及页面来源已核验，真实取数接口尚未接入；缺失、非数值、不完整周期、不可比归因时返回无法判断，不使用旧演示值填补。','- 标题、主图、话术、货品与人群只是后续核查方向，没有内容与明细证据时不得断言因果。','- 工具仅作为建议，不自动开播、发布、投放或修改经营设置。快分销须先具备权限。','- 此次为资料重整后配置发布，已完成引用、规则与合成数据校验；未执行真实商家案例，不将合成检查写成真实案例试跑。'].join('\n');
 const frame={id,assetId:id,sceneId:scene.id,name:scene.name+'诊断框架',goal:scene.goal,scope:scene.merchantScope,metricIds:clone(scene.metricIds),actionIds:clone(scene.actionIds),knowledge:scene.description+'\n真实取数未接入；跨场域服务仅作辅助。',logic:branches.map(b=>b.name).join(' → '),priority:'先数据可用性，再规模与效率，最后结合明细核查原因。',maxDepth:4,prompt:body,draftText:body,branches,version:1,generation:1,workflowSchema:1,production:'资料整理配置',status:'生效中',stage:'active',reviewPassed:true,reviewStatus:'资料与规则审核完成',protocolConfirmed:true,protocolValidation:{mode:'catalog_import',status:'passed',checks:['资产引用','四层场景关系','规则结构与单位','合成命中/不命中/缺失值'],checkedAt:stamp},trial:null,releaseScope:'配置已发布；真实取数待接入',catalogRevision:revision,publishedAt:stamp,updatedAt:stamp};
 frameworks.push(frame);
 const periods={};
 for(const period of ['week','day']){
  const group={id:'research-group-'+(index+1)+'-'+period,sceneId:scene.id,name:scene.name+'（'+(period==='week'?'近7天':'昨日')+'）',mode:'策略优先级执行',period,tags:'同口径完整周期',prompt:'先验证数据，按经营变化定位核查环节，不把关联视为因果。',priority:index+1};groups.push(group);
  const items=selected.map((t,i)=>{
   const id=`research-strategy-${String(index+1).padStart(2,'0')}-${period}-${i+1}`;
   const item={id,sceneId:scene.id,groupId:group.id,group:group.name,name:t.label+'（'+(period==='week'?'近7天':'昨日')+'）',description:t.meaning,businessMeaning:t.meaning,merchantScope:scene.merchantScope,period,priority:i+1,status:'生效中',enabled:true,version:1,production:'资料整理配置',execution:'指标规则',metricIds:[...new Set(ruleIds(t.rule))],actionIds:clone(t.actionIds),actionSubtitles:Object.fromEntries(t.actionIds.map(id=>[id,actions.find(a=>a.id===id).description+'；先核验证据与权限，调整后复看同口径指标。'])),actionTrigger:'match',rule:clone(t.rule),frameworkId:frame.id,frameworkVersion:1,reviewStatus:'已审核',thresholdBasis:'当前值与同口径前周期值直接比较；变化线索不等同异常定性，不采用未经核验的固定行业阈值。',exceptionHandling:'缺失、非数值、周期不完整或归因不可比时返回无法判断。名称已核验，真实取数未接入，不回填旧演示值。',pendingItems:['接入真实指标值与前周期值','对齐归因、渠道及去重口径','真实商家案例验证'],signalType:t.kind,dataRequirements:{sameSeller:true,sameAttribution:true,completePeriods:true,sameTimezone:true,requirePrevious:true},catalogRevision:revision,createdAt:stamp,updatedAt:stamp};
   item.protocol={sceneId:scene.id,strategyCode:id,groupId:group.id,merchantScope:item.merchantScope,period,execution:item.execution,businessMeaning:item.businessMeaning,rule:clone(item.rule),actionTrigger:item.actionTrigger,actions:item.actionIds.map(id=>({id,subtitle:item.actionSubtitles[id]})),reviewStatus:item.reviewStatus,thresholdBasis:item.thresholdBasis,exceptionHandling:item.exceptionHandling,pendingItems:clone(item.pendingItems)};
   strategies.push(item);return clone(item);
  });
  const definition={id:frame.id,sceneId:scene.id,name:frame.name,fieldKey:scene.fieldKey,goal:frame.goal,scope:frame.scope,text:frame.prompt,active:true,version:1,sourceWorkflow:frame.production,metricIds:clone(scene.metricIds),actionIds:clone(scene.actionIds),branches:clone(branches)};
  periods[period]={groups:[clone(group)],sceneId:scene.id,sceneName:scene.name,fieldKey:scene.fieldKey,period,version:1,framework:frame.prompt,frameworkVersion:1,frameworkDefinition:definition,strategies:items,metrics:metrics.filter(m=>scene.metricIds.includes(m.id)).map(clone),actions:actions.filter(a=>scene.actionIds.includes(a.id)).map(clone),active:true,catalogRevision:revision,source:'线上资料重整发布',dataAvailability:{status:'not_connected',message:'指标定义已核验，真实取数服务尚未接入。'}};
 }
 published[scene.id]={periods,publishedAt:Date.now()};
}
// New, explicit synthetic fixtures exercise the imported definitions. They are
// never described as shop data and do not reuse the old demo metric mappings.
const examples={
 home:{'成交金额':[190000,215000],'商品曝光次数':[1000000,1100000],'商品点击次数':[40000,40000],'店铺体验分':[4.55,4.7]},
 trade:{'成交金额':[190000,215000],'成交订单数':[2600,3000],'成交人数':[2000,2400],'客单价':[95,89.58],'金额退款率（支付日）':[6.2,4.8],'下单订单数':[3600,3800],'商品点击次数':[40000,40000],'点击成交转化率(订单)':[6.5,7.5]},
 live:{'直播场次':[6,8],'成交金额':[80000,100000],'观看人数':[12000,16000],'观看-成交率(人数)':[5,6],'千次观看成交金额':[6666.67,6250]},
 video:{'新发布短视频数':[10,14],'成交金额':[32000,45000],'成交订单数':[600,800],'曝光人数':[150000,210000],'曝光次数':[300000,420000],'付费渠道曝光用户数':[30000,60000],'商品点击人数':[1800,2500]},
 shelf:{'商品卡成交金额':[78000,70000],'商品卡曝光次数':[300000,280000],'商品卡点击次数':[15000,16000],'点击成交率':[4,4.5],'商品卡退款金额':[3500,2000]},
 creator:{'成交金额':[20000,20000],'成交订单数':[400,430],'佣金支出金额(结算日)':[4400,3800],'成交退款率(金额)':[9,6]},
 creatorVideo:{'短视频曝光次数':[100000,130000]},
 goods:{'在架商品数':[160,170],'动销商品数':[64,85],'商品动销率':[40,50],'件单价':[45.5,42]},
 buyer:{'成交用户数':[2000,2400],'首购用户数':[1200,1500],'复购用户数':[800,900],'粉丝占比':[42,45],'内容触达用户量':[60000,68000]},
 after:{'纠纷介入率':[2.1,1.3]},service:{'3分钟回复率':[92,97]},logistics:{'发货及时率':[94,98]},quality:{'商品品质退单率':[3.4,2.1]}
};
const demoData={mode:'synthetic',label:'合成演示数据，非快手店铺实绩',ranges:{week:'2026年10月26日—11月1日',day:'2026年11月1日'},comparisons:{week:'2026年10月19日—10月25日',day:'2026年10月31日'},metrics:{}};
for(const [i,m] of metrics.entries()){
 const pair=examples[m.sourceKey]?.[m.originalName]||[m.unit==='%'?12+i%25:m.unit==='元'?1000+i*100:30+i*3,m.unit==='%'?15+i%25:m.unit==='元'?1200+i*100:40+i*3];
 const rate=m.unit==='%'||m.unit==='分'||/客单价|件单价|笔单价|时长/.test(m.originalName),sumMeasure=!rate&&/金额|佣金|订单|单量|退单量|成交件数|成交件数|成交人数$|曝光次数|点击次数|观看次数|访问次数|直播场次|新发布短视频数/.test(m.originalName)&&!/人数/.test(m.originalName);
 const integral=['人','次','场','单','个','件','条'].includes(m.unit),round=v=>m.unit==='%'?Math.min(100,Math.max(0,+v.toFixed(2))):m.unit==='分'?Math.min(5,Math.max(0,+v.toFixed(2))):integral?Math.round(v):+v.toFixed(2);
 const sumScale=sumMeasure?1/7:rate||/在架商品数/.test(m.originalName)?1:1/3;
 const weights=pair[0]<pair[1]?[1.12,1.08,1.04,1,.96,.92,.88]:[.88,.92,.96,1,1.04,1.08,1.12];
 const distribute=(value,weights)=>{const total=weights.reduce((a,b)=>a+b,0),scale=integral?1:100,raw=weights.map(w=>value*w/total*scale),out=raw.map(Math.floor),remaining=Math.round(value*scale)-out.reduce((a,b)=>a+b,0),rank=raw.map((v,i)=>({i,fraction:v-out[i]})).sort((a,b)=>b.fraction-a.fraction);for(let j=0;j<remaining;j++)out[rank[j%rank.length].i]++;return out.map(v=>v/scale);};
 const current=sumMeasure?distribute(pair[0],weights):weights.map(w=>round(pair[0]*sumScale*w)),previous=sumMeasure?distribute(pair[1],weights.slice().reverse()):weights.slice().reverse().map(w=>round(pair[1]*sumScale*w));
 const intraday=(value,base)=>{const weights=Array.from({length:7},(_,j)=>base+j*(1-base)/3);return sumMeasure?distribute(value,weights):weights.map(w=>round(value*(rate?1:1/2)*w));};
 demoData.metrics[m.id]={week:{value:pair[0],previousValue:pair[1],current,previous},day:{value:current[6],previousValue:current[5],current:intraday(current[6],.85),previous:intraday(current[5],.9)}};
}
for(const p of Object.values(published))for(const c of Object.values(p.periods))c.dataAvailability={status:'demo_only',message:'仅有本批指标定义的合成演示数据，真实取数尚未接入。'};
const catalog={schema:2,catalogRevision:revision,catalog:{revision,name:'2026-11-02生意通资料重整稿',checkedAt:evidence.checkedAt,importedAt:stamp,originalCatalogRecovered:false,sourceSceneCount:source.rows.length,metricRecordDefinition:'按来源×指标保留164条定义；同名不同范围以名称前缀区分。',dataStatus:'demo_only',frameworkCount:frameworks.length,strategyCount:strategies.length,p0SceneIds:p0.map(s=>s.id)},scenes,metrics,conditions,actions,groups,frameworks,strategies,published,demoData,demoCoverageVersion:2};
shareCatalogStrategies(catalog);
assert.equal(scenes.length,91);assert.equal(metrics.length,164);assert.equal(actions.length,39);assert.equal(frameworks.length,10);
for(const type of ['scenes','metrics','actions','frameworks','strategies'])assert.equal(new Set(catalog[type].map(x=>x.id)).size,catalog[type].length);
for(const type of ['scenes','metrics','actions'])assert.equal(new Set(catalog[type].map(x=>x.name)).size,catalog[type].length);
for(const scene of scenes){assert.ok(scene.metricIds.every(id=>metricById.has(id)));assert.ok(scene.actionIds.every(id=>actions.some(a=>a.id===id)));}
for(const strategy of strategies){const scene=scenes.find(s=>s.id===strategy.sceneId);assert.ok(strategy.metricIds.every(id=>scene.metricIds.includes(id)));assert.ok(strategy.actionIds.every(id=>scene.actionIds.includes(id)));}
await writeFile(new URL('../web/curated-catalog.js',import.meta.url),`'use strict';\n// Generated from the reviewed scene workbook and observed online definitions.\nconst AIDD_CURATED_CATALOG = ${JSON.stringify(catalog)};\n`);
await mkdir(resolve(auditDir),{recursive:true});
await writeFile(resolve(auditDir,'import-catalog.json'),JSON.stringify(catalog,null,2));
const summary={revision,scenes:scenes.length,metrics:metrics.length,actions:actions.length,p0:frameworks.length,frameworks:frameworks.length,strategies:catalog.strategies.length,executionPeriods:['day','week'],p0Scenes:p0.map(s=>({name:s.name,frameworkId:frameworks.find(f=>f.sceneId===s.id).id,strategies:catalog.strategies.filter(t=>t.sceneId===s.id).length})),realDataConnected:false,realMerchantTrialExecuted:false};
await writeFile(resolve(auditDir,'import-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
