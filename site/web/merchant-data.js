'use strict';

// All figures are fictional. Monetary attribution is exclusive across the four fields.
function distributeTotal(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const values = weights.map(weight => Math.round(total * weight / sum));
  values[values.length - 1] += total - values.reduce((a, b) => a + b, 0);
  return values;
}
function totalMetric(label, unit, type, current, previous) {
  const value = current.reduce((a, b) => a + b, 0);
  const previousValue = previous.reduce((a, b) => a + b, 0);
  return {label, unit, type,
    week: {value, previousValue, current, previous},
    day: {value: current[6], previousValue: current[5],
      current: distributeTotal(current[6], [18, 20, 16, 15, 12, 10, 9]),
      previous: distributeTotal(current[5], [17, 19, 16, 16, 13, 10, 9])}
  };
}
function rateMetric(label, value, previousValue, current, previous) {
  return {label, unit:'%', type:'rate',
    week: {value, previousValue, current, previous},
    day: {value:current[6], previousValue:current[5],
      current:[.94, 1.02, 1.04, 1, .98, 1.02, 1].map(x=>+(x*current[6]).toFixed(2)),
      previous:[.95, 1.01, 1.03, 1, .99, 1.02, 1].map(x=>+(x*current[5]).toFixed(2))}
  };
}
const MERCHANT_FIELDS = {
  overview: {name:'全店', icon:'grid', goal:{week:215000,day:30500},
    intro:'汇总经营现状、目标差距与优先行动，先对全店生意做一个判断。', metrics:{},
    hints:{gmv:'结合目标差距与各场域贡献，确定优先改善的经营环节。',exposure:'结合各场域流量变化，区分曝光规模与转化效率的影响。',clickRate:'继续对照不同场域的点击表现，缩小需要核查的范围。',payRate:'结合商品、场域及库存信息，进一步核查支付环节。'}},
  live: {name:'直播',icon:'play',goal:{week:100000,day:15000},
    intro:'关注直播商品曝光、点击与支付，找到影响直播成交的关键环节。',
    metrics:{
      gmv:totalMetric('支付金额','元','money',[7800,8200,7100,6900,6400,6160,6000],[8000,8400,8200,8800,9100,8656,8500]),
      exposure:totalMetric('商品曝光人数','人','count',[12600,13300,12000,12100,11300,11100,11800],[12400,13100,12700,12900,13100,12800,12765]),
      clickRate:rateMetric('商品点击率',2.8,4.1,[3.2,3,2.9,2.8,2.7,2.5,2.4],[4.1,4,4.2,4.15,4.05,4.1,4.1]),
      payRate:rateMetric('点击支付转化率',12.5,12.2,[12.1,12.3,12.5,12.4,12.7,12.8,12.9],[12.1,12.2,12.1,12.3,12.2,12.2,12.3])},
    hints:{gmv:'结合开播安排、商品曝光与点击表现，拆解直播成交变化。',exposure:'优先核对开播场次、有效开播时长与流量来源。',clickRate:'结合具体商品，核查直播展示、讲解与商品链接是否一致。',payRate:'核对商品库存、到手价及详情信息，再判断支付环节的影响。'},
    issues:[
      {metric:'clickRate',title:'商品点击效率下降',steady:'商品点击效率需持续观察',threshold:-15,action:'检查商品展示与讲解',advice:'先按商品对比曝光与点击，再核查直播画面和讲解内容。'},
      {metric:'payRate',title:'点击支付效率下降',steady:'点击支付转化相对稳定',threshold:-15,action:'检查库存、价格与商品详情',advice:'保持有效的成交承接，持续核对库存和商品信息。'}]},
  video: {name:'短视频',icon:'video',goal:{week:40000,day:6000},
    intro:'关注带货内容供给、视频播放与商品点击，找到内容成交的改善方向。',
    metrics:{
      gmv:totalMetric('支付金额','元','money',[3600,3500,3200,3600,2500,2800,2400],[3800,4000,3900,3900,3700,3900,3800]),
      plays:totalMetric('视频播放量','次','count',[30000,29000,28000,26000,25000,22000,20000],[35000,36000,34000,35000,34000,33000,33000]),
      clickRate:rateMetric('商品点击率',3.6,3.5,[3.5,3.6,3.7,3.6,3.5,3.6,3.7],[3.4,3.5,3.6,3.4,3.5,3.6,3.5]),
      videos:totalMetric('发布带货视频数','条','count',[1,1,1,1,1,1,1],[2,1,2,1,2,1,1])},
    hints:{gmv:'对照播放规模与商品点击，区分内容流量和点击效率的变化。',plays:'结合发布数量与单条视频表现，检查流量下降发生在哪一环。',clickRate:'核对视频卖点、商品露出与挂载链接的一致性。',videos:'对照内容排期与单条视频表现，检查带货内容供给是否充足。'},
    issues:[
      {metric:'plays',title:'视频播放规模下降',steady:'视频播放变化需持续观察',threshold:-15,action:'检查内容发布与单条表现',advice:'先区分内容数量减少与单条播放下滑，再安排内容调整。'},
      {metric:'clickRate',title:'视频商品点击效率下降',steady:'视频商品点击效率相对稳定',threshold:-15,action:'保留有效的商品呈现方式',advice:'复盘点击表现较好的内容，为后续选题提供参考。'}]},
  shelf: {name:'货架',icon:'bag',goal:{week:75000,day:9500},
    intro:'关注搜索与商城商品的曝光、点击和支付，检查货架成交承接。',
    metrics:{
      gmv:totalMetric('支付金额','元','money',[4200,4400,4600,4900,5000,4500,4800],[4000,4100,4200,4300,4400,4400,4600]),
      exposure:totalMetric('商品曝光人数','人','count',[10500,11000,11500,12000,12500,12000,11000],[9500,10000,9800,10500,10000,10500,10200]),
      clickRate:rateMetric('商品点击率',4.8,4.6,[4.6,4.7,4.8,4.9,4.8,4.9,4.9],[4.5,4.6,4.7,4.6,4.5,4.7,4.6]),
      payRate:rateMetric('商品支付转化率',5.4,6.3,[5.8,5.6,5.5,5.4,5.3,5.3,5.1],[6.2,6.3,6.4,6.3,6.2,6.4,6.3])},
    hints:{gmv:'对照商品曝光与支付转化，查看货架增长由哪个环节带动。',exposure:'继续按搜索、商城推荐等来源对照曝光变化。',clickRate:'检查商品主图、标题与用户搜索需求的匹配程度。',payRate:'优先核查有点击但支付较弱的商品，再检查库存、价格和详情。'},
    issues:[
      {metric:'payRate',title:'货架商品支付转化下降',steady:'货架支付转化需持续观察',threshold:-10,action:'核查重点商品成交承接',advice:'先看有点击但支付较弱的商品，再检查到手价、库存和详情。'},
      {metric:'exposure',title:'货架曝光规模下降',steady:'货架曝光变化需持续观察',threshold:-15,action:'复盘新增曝光来源',advice:'保留表现较好的流量来源，关注新增曝光能否转为成交。'}]},
  creator: {name:'达人合作',icon:'users',goal:{week:20000,day:3000},
    intro:'关注合作覆盖、带货达人活跃度和订单，找到达人合作的提升空间。',
    metrics:{
      gmv:totalMetric('达人带货支付金额','元','money',[2500,2500,2400,2300,2200,2100,2000],[2600,2700,2600,2500,2600,2500,2500]),
      creators:{label:'有成交达人数',unit:'位',type:'count',week:{value:8,previousValue:12,current:[5,6,5,4,4,4,3],previous:[7,7,8,6,7,6,7]},day:{value:3,previousValue:4,current:[1,2,2,2,3,3,3],previous:[1,2,2,3,3,4,4]}},
      orders:totalMetric('达人带货订单数','单','count',[65,63,60,56,54,52,50],[65,68,66,63,65,62,61]),
      activeRate:rateMetric('合作达人成交率',40,60,[50,55,50,45,40,40,30],[60,65,60,65,60,55,55])},
    hints:{gmv:'结合有成交达人数和带货订单，区分合作覆盖与单达人产出。',creators:'周期内达人数按去重统计；日趋势不加总为周期总数。',orders:'按达人和商品对比订单，定位产出变化集中的合作关系。',activeRate:'对照合作达人中的实际成交覆盖，检查排期与商品匹配情况。'},
    issues:[
      {metric:'creators',title:'有成交达人覆盖减少',steady:'有成交达人覆盖相对稳定',threshold:-15,action:'核对达人排期与合作进展',advice:'先确认未成交达人的合作进展，再检查商品适配与带货排期。'},
      {metric:'orders',title:'达人带货订单下降',steady:'达人订单需持续观察',threshold:-15,action:'复盘重点达人与商品',advice:'对比单达人订单表现，区分覆盖减少和单达人产出变化。'}]}
};
const FIELD_KEYS = ['live','video','shelf','creator'];
const sumFieldSeries = (period,series) => Array.from({length:7},(_,i)=>FIELD_KEYS.reduce((sum,key)=>sum+MERCHANT_FIELDS[key].metrics.gmv[period][series][i],0));
MERCHANT_FIELDS.overview.metrics = {
  gmv:totalMetric('支付金额','元','money',sumFieldSeries('week','current'),sumFieldSeries('week','previous')),
  exposure:totalMetric('商品曝光人数','人','count',[31000,32000,30000,29000,28000,27600,27000],[32000,33000,32500,31500,32000,31000,31000]),
  clickRate:rateMetric('商品点击率',3.4,3.9,[3.7,3.6,3.5,3.4,3.3,3.2,3.1],[3.9,3.8,4,3.9,3.8,4,3.9]),
  payRate:rateMetric('点击支付转化率',11.7,11.9,[11.5,11.6,11.8,11.7,11.9,11.8,11.6],[11.8,11.9,12,11.9,11.8,12,11.9])
};

// Period users are deduplicated; daily users are not added to obtain period users.
function buyerMetric(value,previousValue,current,previous){return {label:'支付人数',unit:'人',type:'count',week:{value,previousValue,current,previous},day:{value:current[6],previousValue:current[5],current:[1,2,3,4,5,6,7].map(n=>Math.round(current[6]*n/7)),previous:[1,2,3,4,5,6,7].map(n=>Math.round(current[5]*n/7))}};}
const MERCHANT_AUDIENCE={
 overview:[814,980,[150,155,138,130,118,105,97],[170,175,166,160,158,155,151]],
 live:[295,440,[55,58,48,44,40,38,36],[75,78,73,72,70,67,64]],
 video:[300,360,[65,64,60,58,50,46,42],[70,72,69,67,65,62,60]],
 shelf:[209,195,[32,33,34,35,36,32,28],[29,30,31,30,30,29,29]],
 creator:[140,175,[27,26,25,24,22,21,20],[31,32,31,30,31,30,29]]
};
const MERCHANT_NEW_BUYERS={overview:[61.2,64.8],live:[58.4,61.5],video:[72.1,70.5],shelf:[55.6,57.8],creator:[67.2,69.4]};
for(const [key,field] of Object.entries(MERCHANT_FIELDS)){
 field.metrics.buyers=buyerMetric(...MERCHANT_AUDIENCE[key]);
 const [current,previous]=MERCHANT_NEW_BUYERS[key];
 field.metrics.newBuyerRate=rateMetric('新客支付占比',current,previous,[1.04,1.03,1.01,1,.99,.98,.97].map(n=>+(current*n).toFixed(2)),[1.02,1.01,1,1,.99,1.01,1].map(n=>+(previous*n).toFixed(2)));
 Object.assign(field.hints,{buyers:'支付人数按当前场域与统计周期去重；结合新客和老客结构查看用户变化。',newBuyerRate:'新客支付占比用于观察用户结构，应与支付人数和成交表现一起判断。'});
}
MERCHANT_FIELDS.creator.metrics.exposure=totalMetric('达人商品曝光人数','人','count',[6200,6100,5900,5700,5400,5100,4800],[6800,7000,6900,6600,6800,6500,6400]);
MERCHANT_FIELDS.creator.hints.exposure='先对照合作达人的有效带货覆盖，再查看各达人商品曝光与内容排期。';
MERCHANT_FIELDS.video.metrics.payRate=rateMetric('点击支付转化率',8.2,8.8,[8.7,8.5,8.3,8.2,8,7.9,7.8],[8.8,8.9,8.8,8.7,8.8,8.9,8.8]);
MERCHANT_FIELDS.creator.metrics.payRate=rateMetric('点击支付转化率',7.6,8.1,[8.1,8,7.8,7.6,7.4,7.3,7.1],[8.2,8.1,8.2,8.1,8,8.1,8]);
MERCHANT_FIELDS.video.hints.payRate='对照挂载商品的点击与支付表现，再核对商品信息、价格与库存。';
MERCHANT_FIELDS.creator.hints.payRate='按达人与商品对照点击支付表现，区分合作覆盖变化和成交承接变化。';
MERCHANT_FIELDS.live.metrics.orders=totalMetric('支付订单数','单','count',[60,64,52,48,43,40,36],[83,84,82,81,80,77,75]);
MERCHANT_FIELDS.video.metrics.orders=totalMetric('支付订单数','单','count',[72,71,67,64,55,51,47],[85,87,84,82,80,78,76]);
MERCHANT_FIELDS.shelf.metrics.orders=totalMetric('支付订单数','单','count',[40,42,44,46,48,44,39],[36,38,39,40,41,40,42]);
MERCHANT_FIELDS.overview.metrics.orders=totalMetric('支付订单数','单','count',Array.from({length:7},(_,i)=>FIELD_KEYS.reduce((sum,key)=>sum+MERCHANT_FIELDS[key].metrics.orders.week.current[i],0)),Array.from({length:7},(_,i)=>FIELD_KEYS.reduce((sum,key)=>sum+MERCHANT_FIELDS[key].metrics.orders.week.previous[i],0)));
for(const field of Object.values(MERCHANT_FIELDS))field.hints.orders='结合支付人数与支付金额观察订单规模，进一步按商品或场域查看订单变化。';
