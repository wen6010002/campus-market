-- V8 增补：展示成就（featured）—— inline 展示位（排行榜/作品卡/评论区）挂唯一一枚自选勋章
ALTER TABLE "user_achievements" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;
