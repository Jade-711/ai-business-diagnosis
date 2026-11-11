import {AIDD_FRAMEWORK_SYSTEM_PROMPT} from '../shared/framework-prompt.js';
// Strategy definitions are shared across execution periods.
export const AIDD_PRODUCTION_MODELS = {
  "framework": {
    "sourceNodeId": "410001",
    "systemPrompt": "角色与能力边界\n角色：快手电商的店铺运营、数据分析专家。\n能力：运用快手电商流量、内容、商品、成交、用户留存的运营方法，从指标波动定位经营问题。\n约束：只能依据本次系统提供的指标、行动资产、场景口径和知识资料，不自行引入外部事实、基准或假设；不得声称执行了未提供的RAG检索或API取数。资料不足时明确列出缺口。\n\n输入层\n框架名称、适用商家、关联场景、核心目标／拆解公式、关联指标、关联行动建议、系统提供的业务知识。每次场景变化只替换输入层，不重写生成方法。\n\n分析方法\n原则：杜邦拆解，将顶层结果拆成可量化、可执行的过程指标；MECE，分类完整且不重叠；奥卡姆剃刀，减少冗余变量。\n步骤：指标拆解 → 优先级下钻 → 诊断方向 → 典型问题总结 → 行动建议映射。\n先识别北极星指标，拆解一级、二级驱动因子，识别加法、乘法、漏斗、互斥关系，形成树状公式。只有资料中的指标定义和统计口径支持时才写等式；口径不明则标记待核对，不将相关性当作因果关系。\n基础优先级：P0=无有效数据、基础动作未完成或必要前置条件缺失；P1=直接影响核心目标的主要问题；P2=局部效率和内容细节问题。\n同级排序依据：目标贡献度 × 问题严重度 × 诊断置信度 × 可行动性。没有对应数值时只说明排序依据和待确认项，不捏造评分。\n指标只能使用系统已提供的指标ID；下钻不超过4层。比较优先使用同环比、同行同类等相对比较；未提供同环比或同行数据就列为缺口，不虚构行业标准，尽量减少无依据的绝对阈值。\n\n输出\n按场景输出自然语言分析框架和结构化预览：1.目标拆解；2.异常模式＋指标规则→问题定义与优先级；3.策略组与行动点及优先级。\n每个场景的诊断方向不超过10个，按场景关键性降序排列，排序须有明确业务含义。行动点必须关联具体指标和已提供的行动ID，不能只给“优化内容质量”等泛化建议；未提供可关联行动时列出缺口。\n自然语言草稿应便于产品和运营阅读、修改。用简洁标题和短句，约600—1000字，避免逐字重复整份指标字典；指标及行动ID在结构化预览中保留，正文优先用易读名称。\n只产出待审核草稿，不做商家实际诊断，不自动审核、试跑或发布。结构化预览不是已发布的正式执行配置。\n\n返回productionDraft对象：operation=generate_framework、strategyMode为空字符串、draftText、candidateFramework、candidateStrategies=[]、missing=[]、pipelineErrors=[]。\ncandidateFramework包含id、name、sceneId、version、draftText、branches。id和version沿用sourceFramework提供的编号；sceneId来自已选场景。branches最多10个，每项包含id、name、meaning、metricIds、actionIds、priority；分支编号应唯一。metricIds和actionIds只填写本次关联指标、关联行动建议各记录的id字段，不能填写code、metricKey、中文名称或场景中未选择的其他资产；输出协议中的enum是本次可引用ID的完整清单。priority使用0、1、2对应P0、P1、P2。框架名称沿用frameworkName。",
    "prompt": "frameworkName: {{frameworkName}}\n适用商家: {{scope}}\n关联场景: {{scenes}}\n核心目标／拆解公式: {{goal}}\n关联指标: {{metrics}}\n关联行动建议: {{actions}}\n系统提供的知识资料: {{knowledge}}\n框架编号与版本: {{sourceFramework}}",
    "maxTokens": 4096,
    "modelDisplay": "豆包·2.0·pro",
    "outputs": [
      {
        "name": "productionDraft",
        "type": "object",
        "schema": [
          {
            "name": "operation",
            "type": "string"
          },
          {
            "name": "strategyMode",
            "type": "string"
          },
          {
            "name": "draftText",
            "type": "string"
          },
          {
            "name": "candidateFramework",
            "type": "object",
            "schema": [
              {
                "name": "id",
                "type": "string"
              },
              {
                "name": "name",
                "type": "string"
              },
              {
                "name": "sceneId",
                "type": "string"
              },
              {
                "name": "version",
                "type": "integer"
              },
              {
                "name": "draftText",
                "type": "string"
              },
              {
                "name": "branches",
                "type": "list",
                "schema": {
                  "type": "object",
                  "schema": [
                    {
                      "name": "id",
                      "type": "string"
                    },
                    {
                      "name": "name",
                      "type": "string"
                    },
                    {
                      "name": "meaning",
                      "type": "string"
                    },
                    {
                      "name": "metricIds",
                      "type": "list",
                      "schema": {
                        "type": "string"
                      }
                    },
                    {
                      "name": "actionIds",
                      "type": "list",
                      "schema": {
                        "type": "string"
                      }
                    },
                    {
                      "name": "priority",
                      "type": "integer"
                    }
                  ]
                }
              }
            ]
          },
          {
            "name": "candidateStrategies",
            "type": "list",
            "schema": {
              "type": "object",
              "schema": []
            }
          },
          {
            "name": "missing",
            "type": "list",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "pipelineErrors",
            "type": "list",
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    ]
  },
  "ai": {
    "sourceNodeId": "410017",
    "systemPrompt": "这是资产建设，产物必须人工审核后才可用于商家。诊断资产仅限scenes、metrics、actions、sourceFramework；knowledge是用户提供资料，没有资料时只使用模型通用知识，不能伪称已完成RAG或API检索。引用的指标ID、行动ID和框架分支ID必须来自输入。阈值没有依据就标明待人工确认。提供可展开的候选预览，预览不是审核后的正式执行协议。仅按本次Schema返回productionDraft：candidateStrategies、missing、pipelineErrors。候选只输出业务字段；可编辑正文由服务端从同一份结构生成，编号、范围及待审核状态由服务端补齐。策略跨统计周期共用，不输出period字段，也不按昨日或近7天重复生产；执行时使用请求所选周期的当前值与前周期值。\noperation为generate_strategies，strategyMode为ai。先检查sourceFramework是否已发布且与场景匹配；缺少有效框架则candidateStrategies=[]并写pipelineErrors。按框架分支产出最多3条策略，每条清楚说明业务含义、指标阈值及逻辑表达式、行动建议、依据与例外。candidateStrategies包含branchIds、name、priority、actionTrigger、actionIds、rule、businessMeaning、thresholdBasis、exceptionHandling、pendingItems。数值条件使用metricId、op、rightType=value、value；指标比较使用rightType=metric、rightMetricId、factor，变换或运算须明确；不使用rightNumber。组合条件只输出AND/OR的join与children。缺少必要资产或不能形成有业务依据的规则时，不编造规则，返回空候选并写明pipelineErrors。",
    "prompt": "operation: {{operation}}\nscenes: {{scenes}}\ngoal: {{goal}}\nscope: {{scope}}\nmetrics: {{metrics}}\nactions: {{actions}}\nknowledge: {{knowledge}}\nprompt: {{prompt}}\nsourceFramework: {{sourceFramework}}\ninputErrors: {{inputErrors}}",
    "maxTokens": 4096,
    "modelDisplay": "豆包·2.0·pro",
    "outputs": [
      {
        "name": "productionDraft",
        "type": "object",
        "schema": [
          {
            "name": "operation",
            "type": "string"
          },
          {
            "name": "strategyMode",
            "type": "string"
          },
          {
            "name": "draftText",
            "type": "string"
          },
          {
            "name": "candidateFramework",
            "type": "object",
            "schema": [
              {
                "name": "id",
                "type": "string"
              },
              {
                "name": "sceneId",
                "type": "string"
              },
              {
                "name": "version",
                "type": "integer"
              },
              {
                "name": "sourceWorkflow",
                "type": "string"
              },
              {
                "name": "draftText",
                "type": "string"
              },
              {
                "name": "branches",
                "type": "list",
                "schema": {
                  "type": "object",
                  "schema": [
                    {
                      "name": "id",
                      "type": "string"
                    },
                    {
                      "name": "name",
                      "type": "string"
                    },
                    {
                      "name": "meaning",
                      "type": "string"
                    },
                    {
                      "name": "metricIds",
                      "type": "list",
                      "schema": {
                        "type": "string"
                      }
                    },
                    {
                      "name": "actionIds",
                      "type": "list",
                      "schema": {
                        "type": "string"
                      }
                    },
                    {
                      "name": "priority",
                      "type": "integer"
                    }
                  ]
                }
              }
            ]
          },
          {
            "name": "candidateStrategies",
            "type": "list",
            "schema": {
              "type": "object",
              "schema": [
                {
                  "name": "id",
                  "type": "string"
                },
                {
                  "name": "sourceAssetId",
                  "type": "string"
                },
                {
                  "name": "sourceWorkflow",
                  "type": "string"
                },
                {
                  "name": "sceneId",
                  "type": "string"
                },
                {
                  "name": "frameworkId",
                  "type": "string"
                },
                {
                  "name": "frameworkVersion",
                  "type": "integer"
                },
                {
                  "name": "branchIds",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "name",
                  "type": "string"
                },
                {
                  "name": "status",
                  "type": "string"
                },
                {
                  "name": "enabled",
                  "type": "boolean"
                },
                {
                  "name": "execution",
                  "type": "string"
                },
                {
                  "name": "priority",
                  "type": "integer"
                },
                {
                  "name": "merchantScope",
                  "type": "string"
                },
                {
                  "name": "actionTrigger",
                  "type": "string"
                },
                {
                  "name": "metricIds",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "actionIds",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "rule",
                  "type": "object",
                  "schema": [
                    {
                      "name": "metricId",
                      "type": "string"
                    },
                    {
                      "name": "op",
                      "type": "string"
                    },
                    {
                      "name": "rightType",
                      "type": "string"
                    },
                    {
                      "name": "rightMetricId",
                      "type": "string"
                    },
                    {
                      "name": "value",
                      "type": "float"
                    },
                    {
                      "name": "leftTransform",
                      "type": "string"
                    },
                    {
                      "name": "rightTransform",
                      "type": "string"
                    },
                    {
                      "name": "leftCalc",
                      "type": "string"
                    },
                    {
                      "name": "rightCalc",
                      "type": "string"
                    },
                    {
                      "name": "leftNumber",
                      "type": "float"
                    },
                    {
                      "name": "rightNumber",
                      "type": "float"
                    },
                    {
                      "name": "factor",
                      "type": "float"
                    },
                    {
                      "name": "join",
                      "type": "string"
                    },
                    {
                      "name": "children",
                      "type": "list",
                      "schema": {
                        "type": "object",
                        "schema": [
                          {
                            "name": "metricId",
                            "type": "string"
                          },
                          {
                            "name": "op",
                            "type": "string"
                          },
                          {
                            "name": "rightType",
                            "type": "string"
                          },
                          {
                            "name": "rightMetricId",
                            "type": "string"
                          },
                          {
                            "name": "value",
                            "type": "float"
                          },
                          {
                            "name": "leftTransform",
                            "type": "string"
                          },
                          {
                            "name": "rightTransform",
                            "type": "string"
                          },
                          {
                            "name": "leftCalc",
                            "type": "string"
                          },
                          {
                            "name": "rightCalc",
                            "type": "string"
                          },
                          {
                            "name": "leftNumber",
                            "type": "float"
                          },
                          {
                            "name": "rightNumber",
                            "type": "float"
                          },
                          {
                            "name": "factor",
                            "type": "float"
                          },
                          {
                            "name": "join",
                            "type": "string"
                          },
                          {
                            "name": "children",
                            "type": "list",
                            "schema": {
                              "type": "object",
                              "schema": [
                                {
                                  "name": "metricId",
                                  "type": "string"
                                },
                                {
                                  "name": "op",
                                  "type": "string"
                                },
                                {
                                  "name": "rightType",
                                  "type": "string"
                                },
                                {
                                  "name": "rightMetricId",
                                  "type": "string"
                                },
                                {
                                  "name": "value",
                                  "type": "float"
                                },
                                {
                                  "name": "leftTransform",
                                  "type": "string"
                                },
                                {
                                  "name": "rightTransform",
                                  "type": "string"
                                },
                                {
                                  "name": "leftCalc",
                                  "type": "string"
                                },
                                {
                                  "name": "rightCalc",
                                  "type": "string"
                                },
                                {
                                  "name": "leftNumber",
                                  "type": "float"
                                },
                                {
                                  "name": "rightNumber",
                                  "type": "float"
                                },
                                {
                                  "name": "factor",
                                  "type": "float"
                                }
                              ]
                            }
                          }
                        ]
                      }
                    }
                  ]
                },
                {
                  "name": "businessMeaning",
                  "type": "string"
                },
                {
                  "name": "thresholdBasis",
                  "type": "string"
                },
                {
                  "name": "exceptionHandling",
                  "type": "string"
                },
                {
                  "name": "pendingItems",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "contentObjects",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "contentPrompt",
                  "type": "string"
                }
              ]
            }
          },
          {
            "name": "missing",
            "type": "list",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "pipelineErrors",
            "type": "list",
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    ]
  },
  "content": {
    "sourceNodeId": "410018",
    "systemPrompt": "这是资产建设，产物必须人工审核后才可用于商家。诊断资产仅限scenes、metrics、actions、sourceFramework；knowledge是用户提供资料，没有资料时只使用模型通用知识，不能伪称已完成RAG或API检索。引用的指标ID、行动ID和框架分支ID必须来自输入。阈值没有依据就标明待人工确认。提供可展开的候选预览，预览不是审核后的正式执行协议。仅按本次Schema返回productionDraft：candidateStrategies、missing、pipelineErrors。候选只输出业务字段；可编辑正文由服务端从同一份结构生成，编号、范围及待审核状态由服务端补齐。策略跨统计周期共用，不输出period字段，也不按昨日或近7天重复生产；执行时使用请求所选周期的当前值与前周期值。\noperation为generate_strategies，strategyMode为content。这里生产可复用的内容合格标准，不对尚未提供的真实商品做判断。明确判断对象（如商品标题）、通过/不通过/无法判断的标准和可用行动。candidateStrategies使用contentPrompt记录完整标准、contentObjects记录已选内容对象；关联已发布sourceFramework的分支及已选行动；缺少框架或内容资产就返回空候选和pipelineErrors。不输出数值规则，不编造商品检查结果。业务含义、依据、例外和待补项均需清楚。",
    "prompt": "operation: {{operation}}\nscenes: {{scenes}}\ngoal: {{goal}}\nscope: {{scope}}\nmetrics: {{metrics}}\nactions: {{actions}}\nknowledge: {{knowledge}}\nprompt: {{prompt}}\nsourceFramework: {{sourceFramework}}\ninputErrors: {{inputErrors}}",
    "maxTokens": 4096,
    "modelDisplay": "豆包·2.0·pro",
    "outputs": [
      {
        "name": "productionDraft",
        "type": "object",
        "schema": [
          {
            "name": "operation",
            "type": "string"
          },
          {
            "name": "strategyMode",
            "type": "string"
          },
          {
            "name": "draftText",
            "type": "string"
          },
          {
            "name": "candidateFramework",
            "type": "object",
            "schema": [
              {
                "name": "id",
                "type": "string"
              },
              {
                "name": "sceneId",
                "type": "string"
              },
              {
                "name": "version",
                "type": "integer"
              },
              {
                "name": "sourceWorkflow",
                "type": "string"
              },
              {
                "name": "draftText",
                "type": "string"
              },
              {
                "name": "branches",
                "type": "list",
                "schema": {
                  "type": "object",
                  "schema": [
                    {
                      "name": "id",
                      "type": "string"
                    },
                    {
                      "name": "name",
                      "type": "string"
                    },
                    {
                      "name": "meaning",
                      "type": "string"
                    },
                    {
                      "name": "metricIds",
                      "type": "list",
                      "schema": {
                        "type": "string"
                      }
                    },
                    {
                      "name": "actionIds",
                      "type": "list",
                      "schema": {
                        "type": "string"
                      }
                    },
                    {
                      "name": "priority",
                      "type": "integer"
                    }
                  ]
                }
              }
            ]
          },
          {
            "name": "candidateStrategies",
            "type": "list",
            "schema": {
              "type": "object",
              "schema": [
                {
                  "name": "id",
                  "type": "string"
                },
                {
                  "name": "sourceAssetId",
                  "type": "string"
                },
                {
                  "name": "sourceWorkflow",
                  "type": "string"
                },
                {
                  "name": "sceneId",
                  "type": "string"
                },
                {
                  "name": "frameworkId",
                  "type": "string"
                },
                {
                  "name": "frameworkVersion",
                  "type": "integer"
                },
                {
                  "name": "branchIds",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "name",
                  "type": "string"
                },
                {
                  "name": "status",
                  "type": "string"
                },
                {
                  "name": "enabled",
                  "type": "boolean"
                },
                {
                  "name": "execution",
                  "type": "string"
                },
                {
                  "name": "priority",
                  "type": "integer"
                },
                {
                  "name": "merchantScope",
                  "type": "string"
                },
                {
                  "name": "actionTrigger",
                  "type": "string"
                },
                {
                  "name": "metricIds",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "actionIds",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "rule",
                  "type": "object",
                  "schema": [
                    {
                      "name": "metricId",
                      "type": "string"
                    },
                    {
                      "name": "op",
                      "type": "string"
                    },
                    {
                      "name": "rightType",
                      "type": "string"
                    },
                    {
                      "name": "rightMetricId",
                      "type": "string"
                    },
                    {
                      "name": "value",
                      "type": "float"
                    },
                    {
                      "name": "leftTransform",
                      "type": "string"
                    },
                    {
                      "name": "rightTransform",
                      "type": "string"
                    },
                    {
                      "name": "leftCalc",
                      "type": "string"
                    },
                    {
                      "name": "rightCalc",
                      "type": "string"
                    },
                    {
                      "name": "leftNumber",
                      "type": "float"
                    },
                    {
                      "name": "rightNumber",
                      "type": "float"
                    },
                    {
                      "name": "factor",
                      "type": "float"
                    },
                    {
                      "name": "join",
                      "type": "string"
                    },
                    {
                      "name": "children",
                      "type": "list",
                      "schema": {
                        "type": "object",
                        "schema": [
                          {
                            "name": "metricId",
                            "type": "string"
                          },
                          {
                            "name": "op",
                            "type": "string"
                          },
                          {
                            "name": "rightType",
                            "type": "string"
                          },
                          {
                            "name": "rightMetricId",
                            "type": "string"
                          },
                          {
                            "name": "value",
                            "type": "float"
                          },
                          {
                            "name": "leftTransform",
                            "type": "string"
                          },
                          {
                            "name": "rightTransform",
                            "type": "string"
                          },
                          {
                            "name": "leftCalc",
                            "type": "string"
                          },
                          {
                            "name": "rightCalc",
                            "type": "string"
                          },
                          {
                            "name": "leftNumber",
                            "type": "float"
                          },
                          {
                            "name": "rightNumber",
                            "type": "float"
                          },
                          {
                            "name": "factor",
                            "type": "float"
                          },
                          {
                            "name": "join",
                            "type": "string"
                          },
                          {
                            "name": "children",
                            "type": "list",
                            "schema": {
                              "type": "object",
                              "schema": [
                                {
                                  "name": "metricId",
                                  "type": "string"
                                },
                                {
                                  "name": "op",
                                  "type": "string"
                                },
                                {
                                  "name": "rightType",
                                  "type": "string"
                                },
                                {
                                  "name": "rightMetricId",
                                  "type": "string"
                                },
                                {
                                  "name": "value",
                                  "type": "float"
                                },
                                {
                                  "name": "leftTransform",
                                  "type": "string"
                                },
                                {
                                  "name": "rightTransform",
                                  "type": "string"
                                },
                                {
                                  "name": "leftCalc",
                                  "type": "string"
                                },
                                {
                                  "name": "rightCalc",
                                  "type": "string"
                                },
                                {
                                  "name": "leftNumber",
                                  "type": "float"
                                },
                                {
                                  "name": "rightNumber",
                                  "type": "float"
                                },
                                {
                                  "name": "factor",
                                  "type": "float"
                                }
                              ]
                            }
                          }
                        ]
                      }
                    }
                  ]
                },
                {
                  "name": "businessMeaning",
                  "type": "string"
                },
                {
                  "name": "thresholdBasis",
                  "type": "string"
                },
                {
                  "name": "exceptionHandling",
                  "type": "string"
                },
                {
                  "name": "pendingItems",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "contentObjects",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "contentPrompt",
                  "type": "string"
                }
              ]
            }
          },
          {
            "name": "missing",
            "type": "list",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "pipelineErrors",
            "type": "list",
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    ]
  },
  "parse": {
    "sourceNodeId": "410024",
    "systemPrompt": "这是资产建设，产物必须人工审核后才可用于商家。诊断资产仅限scenes、metrics、actions、sourceFramework；knowledge是用户提供资料，没有资料时只使用模型通用知识，不能伪称已完成RAG或API检索。引用的指标ID、行动ID和框架分支ID必须来自输入。阈值没有依据就标明待人工确认。提供可展开的候选预览，预览不是审核后的正式执行协议。仅按本次Schema返回productionDraft：candidateStrategies、missing、pipelineErrors。候选只输出业务字段；可编辑正文由服务端从同一份结构生成，编号、范围及待审核状态由服务端补齐。策略跨统计周期共用，不输出period字段，也不按昨日或近7天重复生产；执行时使用请求所选周期的当前值与前周期值。\n现在只把review.reviewedText解析为结构化候选。phase=test时为确认前的临时试跑，不代表人工已审核；phase=confirm时为人工确认稿的正式解析。禁止再创作、补充或更改规则。输入candidateFramework和candidateStrategies只用于保留已有资产编号与版本，正文以review.reviewedText为准。人工稿引用未知资产、规则含糊、阈值缺失或正文与逻辑无法对应时，写pipelineErrors，不默默补齐。策略解析为candidateStrategies的业务字段及rule或contentPrompt，不重复返回正文。没有明确数值阈值不能借用旧预览阈值。正式结果仍为待生效、enabled=false，后续需要系统校验，案例测试由产运按需发起。",
    "prompt": "operation: {{operation}}\nphase: {{phase}}\nstrategyMode: {{strategyMode}}\nscenes: {{scenes}}\nmetrics: {{metrics}}\nactions: {{actions}}\nsourceFramework: {{sourceFramework}}\ninputErrors: {{inputErrors}}\nreview: {{review}}\ncandidateFramework: {{candidateFramework}}\ncandidateStrategies: {{candidateStrategies}}",
    "maxTokens": 4096,
    "modelDisplay": "豆包·2.0·pro",
    "outputs": [
      {
        "name": "productionDraft",
        "type": "object",
        "schema": [
          {
            "name": "operation",
            "type": "string"
          },
          {
            "name": "strategyMode",
            "type": "string"
          },
          {
            "name": "draftText",
            "type": "string"
          },
          {
            "name": "candidateFramework",
            "type": "object",
            "schema": [
              {
                "name": "id",
                "type": "string"
              },
              {
                "name": "sceneId",
                "type": "string"
              },
              {
                "name": "version",
                "type": "integer"
              },
              {
                "name": "sourceWorkflow",
                "type": "string"
              },
              {
                "name": "draftText",
                "type": "string"
              },
              {
                "name": "branches",
                "type": "list",
                "schema": {
                  "type": "object",
                  "schema": [
                    {
                      "name": "id",
                      "type": "string"
                    },
                    {
                      "name": "name",
                      "type": "string"
                    },
                    {
                      "name": "meaning",
                      "type": "string"
                    },
                    {
                      "name": "metricIds",
                      "type": "list",
                      "schema": {
                        "type": "string"
                      }
                    },
                    {
                      "name": "actionIds",
                      "type": "list",
                      "schema": {
                        "type": "string"
                      }
                    },
                    {
                      "name": "priority",
                      "type": "integer"
                    }
                  ]
                }
              }
            ]
          },
          {
            "name": "candidateStrategies",
            "type": "list",
            "schema": {
              "type": "object",
              "schema": [
                {
                  "name": "id",
                  "type": "string"
                },
                {
                  "name": "sourceAssetId",
                  "type": "string"
                },
                {
                  "name": "sourceWorkflow",
                  "type": "string"
                },
                {
                  "name": "sceneId",
                  "type": "string"
                },
                {
                  "name": "frameworkId",
                  "type": "string"
                },
                {
                  "name": "frameworkVersion",
                  "type": "integer"
                },
                {
                  "name": "branchIds",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "name",
                  "type": "string"
                },
                {
                  "name": "status",
                  "type": "string"
                },
                {
                  "name": "enabled",
                  "type": "boolean"
                },
                {
                  "name": "execution",
                  "type": "string"
                },
                {
                  "name": "priority",
                  "type": "integer"
                },
                {
                  "name": "merchantScope",
                  "type": "string"
                },
                {
                  "name": "actionTrigger",
                  "type": "string"
                },
                {
                  "name": "metricIds",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "actionIds",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "rule",
                  "type": "object",
                  "schema": [
                    {
                      "name": "metricId",
                      "type": "string"
                    },
                    {
                      "name": "op",
                      "type": "string"
                    },
                    {
                      "name": "rightType",
                      "type": "string"
                    },
                    {
                      "name": "rightMetricId",
                      "type": "string"
                    },
                    {
                      "name": "value",
                      "type": "float"
                    },
                    {
                      "name": "leftTransform",
                      "type": "string"
                    },
                    {
                      "name": "rightTransform",
                      "type": "string"
                    },
                    {
                      "name": "leftCalc",
                      "type": "string"
                    },
                    {
                      "name": "rightCalc",
                      "type": "string"
                    },
                    {
                      "name": "leftNumber",
                      "type": "float"
                    },
                    {
                      "name": "rightNumber",
                      "type": "float"
                    },
                    {
                      "name": "factor",
                      "type": "float"
                    },
                    {
                      "name": "join",
                      "type": "string"
                    },
                    {
                      "name": "children",
                      "type": "list",
                      "schema": {
                        "type": "object",
                        "schema": [
                          {
                            "name": "metricId",
                            "type": "string"
                          },
                          {
                            "name": "op",
                            "type": "string"
                          },
                          {
                            "name": "rightType",
                            "type": "string"
                          },
                          {
                            "name": "rightMetricId",
                            "type": "string"
                          },
                          {
                            "name": "value",
                            "type": "float"
                          },
                          {
                            "name": "leftTransform",
                            "type": "string"
                          },
                          {
                            "name": "rightTransform",
                            "type": "string"
                          },
                          {
                            "name": "leftCalc",
                            "type": "string"
                          },
                          {
                            "name": "rightCalc",
                            "type": "string"
                          },
                          {
                            "name": "leftNumber",
                            "type": "float"
                          },
                          {
                            "name": "rightNumber",
                            "type": "float"
                          },
                          {
                            "name": "factor",
                            "type": "float"
                          },
                          {
                            "name": "join",
                            "type": "string"
                          },
                          {
                            "name": "children",
                            "type": "list",
                            "schema": {
                              "type": "object",
                              "schema": [
                                {
                                  "name": "metricId",
                                  "type": "string"
                                },
                                {
                                  "name": "op",
                                  "type": "string"
                                },
                                {
                                  "name": "rightType",
                                  "type": "string"
                                },
                                {
                                  "name": "rightMetricId",
                                  "type": "string"
                                },
                                {
                                  "name": "value",
                                  "type": "float"
                                },
                                {
                                  "name": "leftTransform",
                                  "type": "string"
                                },
                                {
                                  "name": "rightTransform",
                                  "type": "string"
                                },
                                {
                                  "name": "leftCalc",
                                  "type": "string"
                                },
                                {
                                  "name": "rightCalc",
                                  "type": "string"
                                },
                                {
                                  "name": "leftNumber",
                                  "type": "float"
                                },
                                {
                                  "name": "rightNumber",
                                  "type": "float"
                                },
                                {
                                  "name": "factor",
                                  "type": "float"
                                }
                              ]
                            }
                          }
                        ]
                      }
                    }
                  ]
                },
                {
                  "name": "businessMeaning",
                  "type": "string"
                },
                {
                  "name": "thresholdBasis",
                  "type": "string"
                },
                {
                  "name": "exceptionHandling",
                  "type": "string"
                },
                {
                  "name": "pendingItems",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "contentObjects",
                  "type": "list",
                  "schema": {
                    "type": "string"
                  }
                },
                {
                  "name": "contentPrompt",
                  "type": "string"
                }
              ]
            }
          },
          {
            "name": "missing",
            "type": "list",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "pipelineErrors",
            "type": "list",
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    ]
  },
  "frameworkParse": {
    "systemPrompt": "你是诊断框架的协议解析器，只解析当前审核正文，不生产新的诊断策略。\n唯一正文来源是review.reviewedText。candidateFramework和sourceFramework只有当前框架的编号、名称、场景和版本，用于保留身份，不是旧正文或旧规则。人工改名、改方向、改条件和改优先级是正常审核修改，不构成与旧预览不一致的错误。\n只使用本次metrics和actions中的资产。metricIds和actionIds填写记录的id字段，不能填写code、metricKey或中文名称；遵守输出协议enum列出的可用ID。未知或有歧义的资产引用才写pipelineErrors，不猜测匹配。\n把当前正文中的诊断方向整理成最多10个branches，每项给出id、name、meaning、metricIds、actionIds、priority。分支ID可按当前框架编号加-review-1、-review-2等顺序生成，不需要沿用旧分支ID。meaning保留当前稿明确写出的比较方向、条件、原因边界和行动含义，不增补或更改。P0、P1、P2分别编码为0、1、2。每个分支至少关联一个已选指标；数据完整性方向可以关联本次全部关键指标。没有对应已选行动时actionIds=[]并在missing说明。\n框架是诊断方向，不是可执行的策略规则：不要求每个方向都有数值阈值、布尔表达式或rule对象。正文有明确比较条件就照实保留；没有写出的绝对阈值、同行基准和量化评分不得补充。缺少真实经营明细、结果指标或同行数据属于能力边界，列入missing，不因此阻断框架结构解析。\n仅当当前正文无法对应已选场景、引用未知/歧义资产、方向含义自相矛盾或无法识别关联指标时写pipelineErrors；正常修改、解析说明、待后续核查项不能写入pipelineErrors。\n返回productionDraft：candidateFramework={branches}、missing、pipelineErrors。不重复抄写正文或身份字段；服务端原样附回当前审核原文，保留输入编号、名称、场景和版本。解析器只输出结构化分支；无法解析时返回空分支并说明pipelineErrors。不得自动人工确认或发布。",
    "prompt": "operation: {{operation}}\nphase: {{phase}}\nframeworkName: {{frameworkName}}\nscenes: {{scenes}}\nmetrics: {{metrics}}\nactions: {{actions}}\nreview: {{review}}\nframeworkIdentity: {{candidateFramework}}",
    "maxTokens": 4096,
    "outputs": [
      {
        "name": "productionDraft",
        "type": "object",
        "schema": [
          {
            "name": "operation",
            "type": "string"
          },
          {
            "name": "strategyMode",
            "type": "string"
          },
          {
            "name": "draftText",
            "type": "string"
          },
          {
            "name": "candidateFramework",
            "type": "object",
            "schema": [
              {
                "name": "id",
                "type": "string"
              },
              {
                "name": "name",
                "type": "string"
              },
              {
                "name": "sceneId",
                "type": "string"
              },
              {
                "name": "version",
                "type": "integer"
              },
              {
                "name": "draftText",
                "type": "string"
              },
              {
                "name": "branches",
                "type": "list",
                "schema": {
                  "type": "object",
                  "schema": [
                    {
                      "name": "id",
                      "type": "string"
                    },
                    {
                      "name": "name",
                      "type": "string"
                    },
                    {
                      "name": "meaning",
                      "type": "string"
                    },
                    {
                      "name": "metricIds",
                      "type": "list",
                      "schema": {
                        "type": "string"
                      }
                    },
                    {
                      "name": "actionIds",
                      "type": "list",
                      "schema": {
                        "type": "string"
                      }
                    },
                    {
                      "name": "priority",
                      "type": "integer"
                    }
                  ]
                }
              }
            ]
          },
          {
            "name": "candidateStrategies",
            "type": "list",
            "schema": {
              "type": "object",
              "schema": []
            }
          },
          {
            "name": "missing",
            "type": "list",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "pipelineErrors",
            "type": "list",
            "schema": {
              "type": "string"
            }
          }
        ]
      }
    ]
  }
};
AIDD_PRODUCTION_MODELS.framework.systemPrompt=AIDD_FRAMEWORK_SYSTEM_PROMPT;
