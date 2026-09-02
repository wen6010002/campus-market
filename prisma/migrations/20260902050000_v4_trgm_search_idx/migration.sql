-- 搜索加速补全（V4.1 性能优化）：ILIKE '%kw%' 查询目前只有 works 三列有 trgm GIN 索引，
-- 创作者搜索（users.username / creator_profiles.direction）与标签匹配（tags.name）走顺序扫描。
CREATE INDEX IF NOT EXISTS users_username_trgm_idx ON users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS creator_profiles_direction_trgm_idx ON creator_profiles USING gin (direction gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tags_name_trgm_idx ON tags USING gin (name gin_trgm_ops);
