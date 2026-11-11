// Reviewed defaults are migrated once. Exact matching preserves owner edits.
const REVIEWED_ACTION_MAPPING_REPAIRS = [
  {
    "id": "research-strategy-01-3",
    "scene": "research-scene-001",
    "ids": [
      "research-action-28",
      "research-action-34"
    ],
    "subtitles": {
      "research-action-28": "先人工取得同支付批次及观察窗口的退款明细；若证实商品说明与实际交付不一致，再通过商品列表更正说明。",
      "research-action-34": "若退款集中在某活动承诺或优惠条件，核实后修正对应活动说明。"
    },
    "next": [
      [
        "research-action-31",
        "先对齐支付批次和退款观察窗口，通过售后工作台核查退款订单与原因；确认问题后处理，再复看同口径退款率。"
      ]
    ]
  },
  {
    "id": "research-strategy-07-4",
    "scene": "research-scene-007",
    "ids": [
      "research-action-02",
      "research-action-01",
      "research-action-07"
    ],
    "subtitles": {
      "research-action-02": "先对照前后期开播与观看来源，确认缺播后补排有效时段。",
      "research-action-01": "仅在缺播原因与经营准备核实后补播，并按场次核验变化。",
      "research-action-07": "先核对来源变化；承接、预算及增量效果可验证后才小范围测试。"
    },
    "next": [
      [
        "research-action-02",
        "先核对开播与观看来源，确认缺播后用创建直播计划补排有效时段，再复看观看与成交。"
      ],
      [
        "research-action-03",
        "若成交承接下降，先核实货盘和讲解问题，再用选品&话术准备调整，逐场复看成交。"
      ]
    ]
  },
  {
    "id": "research-strategy-09-2",
    "scene": "research-scene-009",
    "ids": [
      "research-action-22"
    ],
    "subtitles": {
      "research-action-22": "仅在商品符合活动资格、价格及毛利可承受时评估活动，不由点击下降直接报名。"
    },
    "next": [
      [
        "research-action-28",
        "按商品和搜索、推荐来源定位点击减少的位置，通过商品列表核对主图、标题、价格和在售状态，确认问题后修改。"
      ]
    ]
  },
  {
    "id": "research-strategy-09-3",
    "scene": "research-scene-009",
    "ids": [
      "research-action-22"
    ],
    "subtitles": {
      "research-action-22": "确认到手价和权益是障碍后，在活动资格及收益可核验条件下测试。"
    },
    "next": [
      [
        "research-action-28",
        "定位点击后流失集中的商品，通过商品列表核对信息、库存和到手价，确认问题后修正。"
      ],
      [
        "research-action-12",
        "仅在确认优惠门槛影响成交后，通过店铺券核对适用人群与叠加条件，小范围验证。"
      ]
    ]
  },
  {
    "id": "research-strategy-10-3",
    "scene": "research-scene-010",
    "ids": [
      "research-action-25",
      "research-action-27"
    ],
    "subtitles": {
      "research-action-25": "定位退款集中合作对象，核验承诺和货品后调整合作条件。",
      "research-action-27": "围绕已确认的合作履约问题学习对应规范，不能替代逐单处理。"
    },
    "next": [
      [
        "research-action-31",
        "先对齐订单归因和观察窗口，通过售后工作台核对退款订单与原因，确认问题后处理。"
      ],
      [
        "research-action-25",
        "若退款涉及合作承诺，通过快分销核验并跟进对应合作，复看同批次退款表现。"
      ]
    ]
  }
];
function repairPublishedActionMappings(input){
 if(input?.dashboardActionMappingVersion===1)return input;
 const data=JSON.parse(JSON.stringify(input)),assets=new Map(data.actions.map(a=>[a.id,a]));
 const updateText=(text,name,mappings)=>{let selected=false;return String(text||'').split('\n').map(line=>{if(/^\d+\. 策略名：/.test(line))selected=line.slice(line.indexOf('策略名：')+4)===name;if(selected&&line.startsWith('行动建议映射：'))return '行动建议映射：'+mappings.map(([id,text])=>(assets.get(id)?.name||id)+' → '+text+' 验证：调整后复核同对象、同周期与同归因指标。').join('；');return line;}).join('\n');};
 for(const repair of REVIEWED_ACTION_MAPPING_REPAIRS){
  const matches=s=>s&&JSON.stringify(s.actionIds)===JSON.stringify(repair.ids)&&repair.ids.every(id=>s.actionSubtitles?.[id]===repair.subtitles[id]);
  const patch=s=>{
   if(!matches(s))return false;
   s.actionIds=repair.next.map(([id])=>id);s.actionSubtitles=Object.fromEntries(repair.next);
   s.actionMappings=repair.next.map(([id,instruction])=>({id,instruction,verification:'调整后复核同对象、同周期与同归因指标。'}));
   if(s.protocol)s.protocol.actions=repair.next.map(([id,subtitle])=>({id,subtitle}));
   return true;
  };
  const draft=data.strategies.find(s=>s.id===repair.id);
  if(patch(draft))draft.updatedAt='2026/11/04';
  const publication=data.published[repair.scene];let changed=false;
  for(const snapshot of Object.values(publication?.periods||{})){
   const s=snapshot.strategies.find(s=>s.id===repair.id);if(!patch(s))continue;changed=true;
   const ids=repair.next.map(([id])=>id);
   snapshot.actions=[...new Map([...snapshot.actions,...ids.map(id=>assets.get(id)).filter(Boolean)].map(a=>[a.id,a])).values()];
   snapshot.framework=updateText(snapshot.framework,s.name,repair.next);
   if(snapshot.frameworkDefinition){
    snapshot.frameworkDefinition.text=updateText(snapshot.frameworkDefinition.text,s.name,repair.next);
    snapshot.frameworkDefinition.actionIds=[...new Set([...snapshot.frameworkDefinition.actionIds,...ids])];
    for(const b of snapshot.frameworkDefinition.branches||[])if(b.problemIds?.includes(s.problemId)||b.name===s.direction)b.actionIds=[...new Set([...b.actionIds,...ids])];
   }
  }
  if(changed){
   const ids=repair.next.map(([id])=>id),scene=data.scenes.find(s=>s.id===repair.scene);
   scene.actionIds=[...new Set([...scene.actionIds,...ids])];
   for(const frame of data.frameworks.filter(f=>f.sceneId===repair.scene)){
    for(const key of ['prompt','draftText','text'])if(frame[key])frame[key]=updateText(frame[key],draft?.name,repair.next);
    frame.actionIds=[...new Set([...frame.actionIds,...ids])];
    for(const b of frame.branches||[])if(b.problemIds?.includes(draft?.problemId)||b.name===draft?.direction)b.actionIds=[...new Set([...b.actionIds,...ids])];
   }
  }
 }
 data.dashboardActionMappingVersion=1;return data;
}
function actionMappingPublication(snapshot){
 const ids=new Set((snapshot.strategies||[]).flatMap(s=>s.actionIds||[]));
 return {schemaVersion:1,sceneId:snapshot.sceneId,fieldKey:snapshot.fieldKey,active:snapshot.active!==false,
  strategies:(snapshot.strategies||[]).map(s=>({id:s.id,actionIds:[...new Set(s.actionIds||[])],actionSubtitles:Object.fromEntries((s.actionIds||[]).map(id=>[id,s.actionSubtitles?.[id]||'']))})),
  actions:(snapshot.actions||[]).filter(a=>ids.has(a.id)).map(a=>Object.fromEntries(['id','name','description','conditions','category','fieldKey'].filter(k=>a[k]!==undefined).map(k=>[k,a[k]])))};
}
function applyActionMappingPublications(config,publications={}){
 if(!config)return config;
 const copy=JSON.parse(JSON.stringify(config)),used=[];
 copy.strategies=(copy.strategies||[]).map(s=>{
  const publication=publications[s.sceneId||copy.sceneId],mapping=publication?.strategies?.find(m=>m.id===s.id);
  if(!publication)return s;
  if(!mapping||publication.active===false)return {...s,actionIds:[],actionSubtitles:{},actionMappings:[]};
  used.push(publication);
  const actionIds=[...mapping.actionIds],actionSubtitles={...mapping.actionSubtitles};
  return {...s,actionIds,actionSubtitles,actionMappings:actionIds.map(id=>({id,instruction:actionSubtitles[id]||''})),...(s.protocol?{protocol:{...s.protocol,actions:actionIds.map(id=>({id,subtitle:actionSubtitles[id]||''}))}}:{})};
 });
 copy.actions=[...new Map([...(copy.actions||[]),...used.sort((a,b)=>(a.revision||0)-(b.revision||0)).flatMap(p=>p.actions||[])].map(a=>[a.id,a])).values()];
 const updateText=text=>{let strategy;return String(text||'').split('\n').map(line=>{if(/^\d+\. 策略名：/.test(line))strategy=copy.strategies.find(s=>s.name===line.slice(line.indexOf('策略名：')+4));if(strategy&&publications[strategy.sceneId]&&line.startsWith('行动建议映射：'))return '行动建议映射：'+(strategy.actionIds||[]).map(id=>(copy.actions.find(a=>a.id===id)?.name||id)+' → '+(strategy.actionSubtitles?.[id]||'')).join('；');return line;}).join('\n');};
 const frames=[copy.frameworkDefinition,...(copy.frameworkCandidates||[])].filter(Boolean);
 for(const frame of frames){const p=publications[frame.sceneId];if(!p)continue;frame.actionIds=[...new Set([...(frame.actionIds||[]),...(p.actions||[]).map(a=>a.id)])];if(frame.text)frame.text=updateText(frame.text);}
 if(copy.framework)copy.framework=updateText(copy.framework);
 return copy;
}
function applyActionMappingCatalog(catalog,publications){
 return Object.fromEntries(Object.entries(catalog).map(([key,item])=>[key,{...item,config:applyActionMappingPublications(item.config,publications),...(item.dashboardConfig?{dashboardConfig:applyActionMappingPublications(item.dashboardConfig,publications)}:{})}]));
}
