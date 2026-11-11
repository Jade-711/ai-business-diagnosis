// Public, reproducible calculations. These describe observed changes and
// arithmetic relationships; they never turn an aggregate correlation into a
// confirmed operational cause, or read demonstration values from the UI.
export function merchantEvidenceAnalysis(finding,result,definitions=[]){
 const finite=n=>typeof n==='number'&&Number.isFinite(n),number=(n,d=2)=>n.toLocaleString('zh-CN',{maximumFractionDigits:d});
 const rows=new Map();
 for(const m of [...(result.evidence||[]),...(result.metricAnalysis||[])])rows.set(m.metricId||m.id,m);
 const metrics=(finding.evidence||[]).map(e=>{
  const id=e.metricId||e.id,returned=rows.get(id)||{},definition=definitions.find(m=>m.id===id)||{};
  return {...returned,...e,id,label:definition.originalName||e.label||returned.label||definition.name||'经营指标',previousValue:finite(e.previousValue)?e.previousValue:returned.previousValue};
 });
 const facts=metrics.map(m=>{
  if(!finite(m.value))return `${m.label}当前值缺失，无法判断变化。`;
  if(!finite(m.previousValue))return `${m.label}当前为${number(m.value)}${m.unit||''}；前期值缺失，无法判断变化。`;
  const delta=m.value-m.previousValue,word=Math.abs(delta)<1e-9?'持平':delta>0?'上升':'下降',relative=m.previousValue>0?100*delta/m.previousValue:null;
  if(word==='持平')return `${m.label}为${number(m.value)}${m.unit||''}，与前期持平。`;
  const difference=m.unit==='%'?`${number(Math.abs(delta))}个百分点`:`${number(Math.abs(delta))}${m.unit||''}`;
  return `${m.label}由${number(m.previousValue)}${m.unit||''}变为${number(m.value)}${m.unit||''}，${word}${difference}${finite(relative)&&m.unit!=='分'?`（相对${word}${Math.abs(relative).toFixed(1)}%）`:''}。`;
 });
 const name=metrics.map(m=>m.label).join(' '),title=String(finding.name||finding.title||''),calculations=[];
 let conclusion='现有指标确认了上述变化；汇总值还不能确定变化集中在哪些商品、渠道或经营对象。';
 let checks='按同一场域、周期和统计口径，拆到商品、渠道或经营对象，对比前后期，优先核查变化最大的对象。';
 let limitation='缺少商品、来源及经营记录，不能把价格、选品、内容或服务变化认定为已确认原因。';
 const amount=metrics.find(m=>/^(成交金额|商品卡成交金额)$/.test(m.label)),orders=metrics.find(m=>/^(成交订单数|商品卡成交订单数)$/.test(m.label));
 if(finding.diagnosticKind==='live_revenue'&&amount){
  const viewers=metrics.find(m=>m.id==='research-metric-live-10'),sessions=metrics.find(m=>m.id==='research-metric-live-01');
  const valid=[amount.value,amount.previousValue,viewers?.value,viewers?.previousValue].every(finite)&&amount.value>=0&&amount.previousValue>=0&&viewers.value>0&&viewers.previousValue>0;
  let basis=facts[0],judgment='已确认直播成交回落；观看人数缺失、为零或不可比，暂不能区分观看规模与成交产出的影响。';
  let pending='补齐同口径观看人数及场次、来源明细，再核查开播供给或成交承接。';
  let actions=[{label:'定位',text:'补齐与成交金额同周期、同归因的观看人数及开播记录。'},{label:'核查与调整',text:'先核对缺播、断流和重点商品异常记录；证据不足时不直接加大投流。'},{label:'验证',text:'补数后复算成交差额及观看规模影响，再安排经营调整。'}];
  if(valid){
   const current=amount.value/viewers.value,previous=amount.previousValue/viewers.previousValue,total=amount.value-amount.previousValue;
   const volumeEffect=(viewers.value-viewers.previousValue)*(current+previous)/2,outputEffect=(current-previous)*(viewers.value+viewers.previousValue)/2,sign=n=>(n>=0?'+':'−')+number(Math.abs(n));
   calculations.push({kind:'live_revenue',formula:'成交金额 = 观看人数 × 每位观看者成交产出',current,previous,volumeEffect,outputEffect,total});
   facts.push(`每位观看者成交产出（成交金额÷观看人数）由${number(previous)}元变为${number(current)}元；这是计算值，不是千次观看成交金额。`);
   facts.push(`对称分解：观看人数变化对应${sign(volumeEffect)}元，人均产出变化对应${sign(outputEffect)}元，合计${sign(total)}元。`);
   const shrinking=viewers.value<viewers.previousValue;
   judgment=shrinking&&outputEffect>=0?'成交回落主要体现为观看规模收缩，人均成交产出提升形成部分抵消。':shrinking?'观看规模和每位观看者成交产出同时回落，需同时核查流量来源与成交承接。':'观看规模未降，成交回落体现在每位观看者成交产出下降，优先核查成交承接与商品结构。';
   basis=`观看人数 ${number(viewers.previousValue)}→${number(viewers.value)}；人均产出 ${number(previous)}→${number(current)}元；规模影响${sign(volumeEffect)}元、产出影响${sign(outputEffect)}元，合计${sign(total)}元。`;
   pending=finite(sessions?.value)&&finite(sessions?.previousValue)&&sessions.value<sessions.previousValue?`直播场次同时由${number(sessions.previousValue)}场减至${number(sessions.value)}场，先核对缺播与来源明细；不能仅凭同步下降断言因果。`:'按场次、自然/付费来源及商品明细验证，不能由汇总值认定某个渠道、价格或内容导致下降。';
   actions=shrinking?[{label:'定位',text:'对照开播计划，找出取消或缩短的场次；按场次及自然/付费来源定位观看减少最多的对象。'},{label:'核查与调整',text:'确认缺播原因、货盘和主播准备后补排有效时段；仅在来源与增量效果可验证时小范围测试投流。'},{label:'验证',text:'按同口径复看观看人数、成交金额及每位观看者产出；用场次明细验证调整效果。'}]:[{label:'定位',text:'按商品及流量来源比较观看、点击和成交，定位成交承接下降最多的对象。'},{label:'核查与调整',text:'核对重点商品的到手价、优惠适用、库存及讲品安排，确认问题后小范围调整；不因成交下降直接加投流。'},{label:'验证',text:'保持可比来源及商品范围，复看成交金额、成交承接和每位观看者产出。'}];
  }
  const limitation='分解是算术关系，不是因果证明；场次与去重观看人数不能相除当作单场效果，观看人数也不能与观看次数口径的千次产出混用。具体渠道及商品根因需明细核实。';
  return {version:2,kind:'live_revenue',basis:'returned_evidence',facts,conclusion:judgment,checks:actions.map(a=>a.text).join('；'),limitation,calculations,complete:valid,reason:[...facts,judgment].join(''),reasonItems:[{label:'判断',text:judgment},{label:'依据',text:basis},{label:'待验证',text:pending}],actionItems:actions};
 }
 // Both operands must be evidence of this finding and from the same source.
 // Do not call amount/orders 客单价, or divide deduplicated exposure by the
 // number of newly published videos (their populations can be different).
 const sameSource=amount&&orders&&amount.id.replace(/-\d+$/,'')===orders.id.replace(/-\d+$/,'');
 if(sameSource&&[amount.value,amount.previousValue,orders.value,orders.previousValue].every(finite)&&orders.value>0&&orders.previousValue>0){
  const current=amount.value/orders.value,previous=amount.previousValue/orders.previousValue;
  const orderEffect=(orders.value-orders.previousValue)*(current+previous)/2,valueEffect=(current-previous)*(orders.value+orders.previousValue)/2;
  const total=amount.value-amount.previousValue,sign=n=>(n>=0?'+':'−')+number(Math.abs(n));
  calculations.push({formula:'成交金额 = 成交订单数 × 每单成交金额',current,previous,orderEffect,valueEffect,total});
  const change=Math.abs(current-previous)<1e-9?'，与前期持平':previous>0?`，${current>previous?'上升':'下降'}${Math.abs(100*(current/previous-1)).toFixed(1)}%`:'';
  facts.push(`每单成交金额（成交金额÷成交订单数）由${number(previous)}元变为${number(current)}元${change}。`);
  facts.push(`按对称分解，订单数变化对应${sign(orderEffect)}元，每单金额变化对应${sign(valueEffect)}元，合计${sign(total)}元，与成交金额变化一致。`);
  conclusion=total<0&&orderEffect<0&&Math.abs(valueEffect)<1e-9?'成交回落的算术表现是订单量减少，每单成交金额持平。':total<0&&orderEffect<0&&valueEffect>0?'本次成交回落主要体现为订单量收缩，每单金额上升形成部分抵消。':total<0&&orderEffect<0&&valueEffect<0?'订单量和每单金额共同拉低了本次成交金额。':total>=0&&orderEffect<0?'每单金额提升抵消了订单量减少，不能把订单减少直接等同于成交金额下降。':'以上分解用于区分订单量与每单金额的数值影响，不等同于具体经营根因。';
  checks='先按同口径商品或内容明细排序成交订单减少量，定位贡献最大的对象；再核对其触达、点击、下单、支付变化及库存、价格和活动记录。';
  limitation='分解是算术关系，不是因果证明；尚缺商品及来源明细，不能确认订单减少由价格、库存、流量或内容中的哪一项导致。';
 }else if(/退款率|退单率|纠纷介入率/.test(name)){
  conclusion='现有证据只确认该比率变化，尚不能区分分子金额或订单数增加、分母基数变化，以及归因窗口差异的影响。';
  checks=/退款率|退单率/.test(name)?`先核对${/支付日/.test(name)?'相同支付日及退款观察窗口':'对应成交归因及相同退款观察窗口'}下的退款金额、成交金额和退款订单，再按商品与退款原因拆解新增退款贡献；核实后再决定商品或活动调整。`:'按介入订单和对应订单基数核对比率，再按商品、问题类型和处理时长定位新增纠纷。';
  limitation='缺少同口径分子、分母、订单明细和原因分类，无法确认品质、物流、承诺或活动是否导致本次变化；不能把退款率上升直接等同于退款金额增加。';
 }else if(/退款金额/.test(name)){
  conclusion='退款金额与成交金额的变化只有在归因订单和观察窗口一致时才可比较；不能直接把两项相减当作净成交。';
  checks='先把退款订单匹配到对应成交批次，再按商品和退款原因排序新增退款金额，核对集中发生变化的订单；对齐前不计算净成交或退款率。';
  limitation='缺少退款订单与成交订单的归因关系及观察窗口，尚不能判断品质、活动或履约原因，也不能计算可比净成交。';
 }else if(/佣金/.test(name)){
  conclusion='成交归因与结算日佣金覆盖的订单批次可能不同；两者的背离只能作为核对线索。';
  checks='按结算批次匹配对应成交订单，再按达人、商品、费率和结算状态比较支出；对齐前不根据该比值调整佣金或推广预算。';
  limitation='缺少结算批次与成交订单的对应关系，不能用这两项汇总值计算有效佣金率、利润或ROI。';
 }else if(/观看-成交率|点击成交率|点击.*成交.*率|点击.*转换率/.test(name)){
  conclusion='变化发生在观看或点击到成交的比例上，需区分进入该环节的人群变化与商品成交承接变化。';
  checks='先按商品和流量来源比较同口径观看或点击人数、成交人数或订单数，定位转化下降对象；再核对到手价、库存、权益及咨询记录。';
 }else if(/观看人数|曝光人数|曝光次数|内容触达/.test(name)){
  conclusion=/点击/.test(name)&&metrics.length>1?'曝光与点击的变化不同步，应优先核查曝光到点击的衔接；仅有汇总量不能确认商品展示或流量质量问题。':'变化首先体现在触达规模；现有汇总量无法区分供给数量、自然分发、付费流量或去重人群结构的影响。';
  checks='按场次或内容拆分自然与付费来源，比较同口径曝光、观看和点击；区分新发与历史内容及去重口径，定位减少最集中的来源，再决定发布或推广调整。';
 }else if(/直播场次|新发布短视频数/.test(name)){
  conclusion='本次已确认内容或开播供给数量变化；尚不能仅凭数量判断每场、每条内容效果或成交损失。';
  checks='对照开播或发布计划，定位缺少的场次与内容，再分别核对其实际触达和成交；不能把全周期去重观看或曝光人数直接除以新发布数量当作单条效果。';
 }else if(/在架商品|动销/.test(name)){
  conclusion='变化体现在可售货盘或成交商品覆盖，尚需区分商品上下架、缺货与在架商品未成交。';
  checks='在商品列表中对比前后期在架、动销、缺货及下架商品清单，定位减少或未动销的商品；调整后同时复看在架商品数、动销商品数及动销率。';
 }else if(/3分钟回复率|发货及时率|店铺体验分/.test(name)){
  conclusion='服务指标发生变化，不能据此直接归因某个场域、客服或物流环节。';
  checks='核对回复或履约分子、分母及异常订单；按咨询时段、客服班次或发货批次定位变化，再复核服务指标与订单处理记录。';
 }else if(/粉丝占比|首购|复购|成交用户|成交人数/.test(name)){
  conclusion=/占比/.test(name)?'这是用户结构变化，占比下降不等同于用户人数或经营表现恶化。':'用户规模变化已经发生，尚需区分首购、复购及流量来源的贡献。';
  checks='同时核对去重总人数、首购、复购和粉丝人数，按人群及来源比较人数和成交贡献；先确认规模变化还是结构变化，再调整用户运营。';
 }else if(/客单价/.test(name)){
  conclusion='客单价变化可能反映人群或商品成交结构，需要同时观察成交金额和去重成交人数，不能单独判定经营好坏。';
  checks='按商品和人群核对成交金额与去重成交人数，区分价格、购买件数和成交结构；使用相同口径复核客单价后再调整商品或活动。';
 }else if(/下单|成交订单|商品点击/.test(name)){
  conclusion='汇总变化可定位到点击、下单或成交环节，尚不能把漏斗环节的相关变化认定为具体经营原因。';
  checks='对齐商品、来源及订单归因，逐步核对点击、下单和支付数量；优先处理流失增加最大的对象，再检查库存、优惠及咨询记录。';
 }
 if(metrics.some(m=>/新发布短视频数/.test(m.label))&&metrics.some(m=>/曝光人数/.test(m.label))){
  checks+=' 不能把全周期去重曝光人数除以新发布数量当作单条效果；先核对新发与历史作品集合。';
  limitation+=' 新发作品与全部曝光的作品集合可能不同，未经归因不得计算单条平均触达。';
 }
 if(/^research-strategy-20-/.test(finding.strategyId||'')){
  const pv=metrics.find(m=>m.id==='research-metric-video-06'),uv=metrics.find(m=>m.id==='research-metric-video-07');
  if([pv?.value,pv?.previousValue,uv?.value,uv?.previousValue].every(finite)&&uv.value>0&&uv.previousValue>0&&pv.value>=uv.value&&pv.previousValue>=uv.previousValue){
   const current=pv.value/uv.value,previous=pv.previousValue/uv.previousValue;
   calculations.push({kind:'exposure_frequency',formula:'曝光次数 = 曝光人数 × 人均曝光次数',current,previous});
   facts.push(`人均曝光次数（曝光次数÷曝光人数，同范围口径）由${number(previous)}次/人变为${number(current)}次/人。`);
   conclusion=finding.strategyId.endsWith('-1')?'覆盖人群减少而曝光次数未减，人均重复触达增加；人群是否精准仍需画像、点击和成交证据。':finding.strategyId.endsWith('-2')?'总覆盖与付费覆盖同步收缩；这是并行变化，不能认定总曝光下降全部由停投或预算减少造成。':finding.strategyId.endsWith('-3')?'付费覆盖未降而总覆盖收缩；非付费来源及作品供给仍待核，不能认定自然流量枯竭。':'覆盖人数未减而重复曝光减少；是否影响经营需点击及成交证据，不能仅为次数减少要求增发。';
  }
  limitation+=' 总曝光人数与付费曝光用户不能直接相减推算自然曝光人数；尚缺来源去重、投放计划、作品明细及人群成交证据。';
 }
 const missing=metrics.filter(m=>!finite(m.value)||!finite(m.previousValue)).map(m=>m.label+'当前值或前期值缺失');
 if(missing.length)limitation=missing.join('；')+'。'+limitation;
 return {version:1,basis:'returned_evidence',facts,conclusion,checks,limitation,calculations,complete:metrics.length>0&&!missing.length,reason:[...facts,conclusion].join('')};
}

export function merchantWholeStoreQuestion(question,fieldKey){
 return fieldKey==='overview'&&/经营表现|经营情况|整体经营|全店诊断/.test(String(question))&&!/整体交易|整体流量|整体转化|商品供给|服务体验|用户经营|目标|达标|缺口/.test(String(question));
}
