-- 内容分区/打标梳理（2026-09-06，首页展示优化）
-- 幂等：可重复执行；事务包裹。改动：①修 8 组 CAMPUS 打标 ②删"校园卡/食堂测评" ③8 份旗舰打 SELECTED。
-- 配套代码改动：首页两流 excludeCat=ABROAD、排序精选优先、新生横幅取 CAMPUS 精选、PRESET_TAGS.CAMPUS 池调整。
BEGIN;

-- ① 重新打标（先清该作品全部标签再按需重建）
DO $$
DECLARE
  w RECORD;
  new_tags text[];
  t text;
  wid text;
  tid text;
BEGIN
  FOR w IN
    SELECT id, title FROM works WHERE "deletedAt" IS NULL
  LOOP
    new_tags := NULL;
    IF w.title LIKE '%大一新生开学准备清单%' THEN new_tags := ARRAY['报到流程','宿舍生活'];
    ELSIF w.title LIKE '%高含金量竞赛攻略%' THEN new_tags := ARRAY['竞赛'];
    ELSIF w.title LIKE '%实用考证攻略%' THEN new_tags := ARRAY['考证'];
    ELSIF w.title LIKE '%如何参加大创%' THEN new_tags := ARRAY['大创'];
    ELSIF w.title LIKE '%生源地助学贷款%' THEN new_tags := ARRAY['助学贷款'];
    ELSIF w.title LIKE '%奖学金助学金评定制度%' THEN new_tags := ARRAY['奖学金'];
    ELSIF w.title LIKE '资料0-计算机第零课%' THEN new_tags := ARRAY['计算机'];
    ELSIF w.title LIKE '资料1-计算机第一课%' THEN new_tags := ARRAY['计算机'];
    END IF;
    IF new_tags IS NOT NULL THEN
      DELETE FROM work_tags WHERE "workId" = w.id;
      FOREACH t IN ARRAY new_tags LOOP
        INSERT INTO tags(id, name) VALUES ('cur_' || t, t) ON CONFLICT (name) DO NOTHING;
        SELECT id INTO tid FROM tags WHERE name = t;
        INSERT INTO work_tags(id, "workId", "tagId")
        SELECT 'wt_' || w.id || '_' || tid, w.id, tid WHERE tid IS NOT NULL;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ② 清理"校园卡"残留链接与孤儿标签（食堂测评同）
DELETE FROM work_tags WHERE "tagId" IN (SELECT id FROM tags WHERE name IN ('校园卡','食堂测评'));
DELETE FROM tags WHERE name IN ('校园卡','食堂测评') AND NOT EXISTS (SELECT 1 FROM work_tags WHERE "tagId" = tags.id);

-- ③ 8 份旗舰 → SELECTED（🏅平台精选）
UPDATE works SET quality='SELECTED'
WHERE "deletedAt" IS NULL AND status='PUBLISHED' AND (
  title LIKE '资料0-计算机第零课%' OR title LIKE '资料1-计算机第一课%'
  OR title LIKE '%奖学金助学金评定制度%' OR title LIKE '12-四六级自救指南%'
  OR title LIKE '10-保研全流程%' OR title LIKE '面经大全%'
  OR title LIKE '03-大学路线选择%' OR title LIKE '资料2-计算机方向全景图%'
);

-- 前后对照输出
SELECT '=== 打标后 CAMPUS 各标签作品数 ===' AS info;
SELECT t.name, count(wt."workId") FROM tags t LEFT JOIN work_tags wt ON wt."tagId"=t.id
WHERE t.name IN ('报到流程','宿舍生活','竞赛','考证','大创','助学贷款','奖学金','计算机','选课攻略','校园卡')
GROUP BY t.name ORDER BY t.name;
SELECT '=== 精选 SELECTED ===' AS info;
SELECT title, category FROM works WHERE quality='SELECTED' AND "deletedAt" IS NULL ORDER BY category;
COMMIT;
