# 用户指定的 Main_agent

本目录是 2026-11-11 核对用户指定扣子链接后整理的查阅入口。主图 21 节点、25 连线；四个模型调用位置通过 `stage` 选择同一 DeepSeek 适配层的不同提示词。

| 调用位置 | stage | 推理档位 |
|---|---|---|
| 理解复杂问法 | understanding | low |
| Think 与 Action | explanation | none |
| 一次补全 | repair | none |
| 知识问答 | knowledge | none |

当前画布引用适配层 v0.0.6；图中没有豆包模型节点。适配层的 Bearer 密钥字段留空。

[节点与变量](../docs/workflow.md) · [提示词原文](../docs/prompts.md) · [来源和发布状态](../docs/provenance.md) · [自行接入](../docs/setup.md)
