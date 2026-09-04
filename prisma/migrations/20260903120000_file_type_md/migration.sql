-- 作品支持 Markdown 类型（.md 上传 + 在线预览渲染）：
-- FileType 枚举新增 MD。手写迁移（未用 migrate dev 生成，避免对 v4_trgm_search_idx
-- 的手写 GIN 索引误生成 DROP INDEX，见 v5_pwd_version 迁移注释）。
-- PG 的 ADD VALUE 只扩值域不动存量行，旧代码不受影响，线上 migrate deploy 可安全执行。
ALTER TYPE "FileType" ADD VALUE 'MD';
