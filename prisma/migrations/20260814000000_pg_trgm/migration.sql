-- 搜索加速：pg_trgm 扩展 + GIN 三元组索引（V2-2）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS works_title_trgm_idx ON works USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS works_description_trgm_idx ON works USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS works_course_trgm_idx ON works USING gin (course gin_trgm_ops);
