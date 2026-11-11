# 网站 v135 源码

本目录来自线上 v135 对应提交。`web/` 是看板、智能助手和 AIDD 前端，`worker/` 是网站接口，`shared/` 是共享规则与协议，`drizzle/` 是数据库迁移。当前演示数据是合成数据。

实时商家问答通过 `POST /api/diagnose` 进入 Coze。AIDD 框架与策略生产通过 `POST /api/aidd/generate` 在网站后端直接调用 DeepSeek。看板快照读取与管理员批量生成使用 `/api/dashboard/snapshot`。

请从仓库根目录执行 `npm run build`、`npm test`、`npm run dev`。根目录构建只打包已保存的网站资产；本目录历史 `scripts/build.sh` 还会生成资产、修复演示数据并重新生成维护稿工作流，故不作为快照预览的默认入口。

本目录 `workflow/` 是网站源码随附的维护 / 评测修订稿，不能当作当前扣子图的逐字导出。用户指定主图的实际导出在 [../coze](../coze/)。详见 [版本边界](../docs/provenance.md)。
