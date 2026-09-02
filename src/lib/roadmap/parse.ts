// 路线图 md 解析器 —— 前后端共享纯函数（零依赖）。
// 约定（上传页有格式说明与实时预览）：
//   ## 标题            → 阶段（phase）
//   阶段下普通段落      → 阶段说明（desc，多段拼接）
//   - [ ] 步骤文本     → 步骤（step）
//   步骤下一行缩进文本  → 步骤备注（note）
// 步骤 id = p{阶段序}-s{步骤序}（从 0 起），入库后不可变（V1 无编辑），
// RoadmapCheck.stepId 引用它，因此发布后 content 结构必须保持稳定。

export interface RoadmapStep {
  id: string;
  text: string;
  note?: string;
}

export interface RoadmapPhase {
  title: string;
  desc: string;
  steps: RoadmapStep[];
}

export interface RoadmapContent {
  phases: RoadmapPhase[];
}

export type RoadmapParseResult =
  | { ok: true; content: RoadmapContent; stepsCount: number }
  | { ok: false; error: string };

/** 解析 md 为结构化路线图；不抛异常，错误以 result 返回。 */
export function parseRoadmapMd(src: string): RoadmapParseResult {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const phases: RoadmapPhase[] = [];

  let phase: RoadmapPhase | null = null;
  let lastStep: RoadmapStep | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, ''); // 去行尾空白（保留行首缩进用于判定 note）

    // 空行：结束当前 note 归属
    if (!line.trim()) {
      lastStep = null;
      continue;
    }

    // ## 阶段标题
    const heading = raw.match(/^##\s+(.*)$/);
    if (heading) {
      const title = heading[1].trim().slice(0, 120);
      if (!title) continue;
      phase = { title, desc: '', steps: [] };
      phases.push(phase);
      lastStep = null;
      continue;
    }

    // - [ ] 步骤（宽松兼容 `- [x]`：一律视为待勾选步骤）
    const step = raw.match(/^\s*-\s+\[[ xX]?\]\s*(.*)$/);
    if (step && phase) {
      const text = step[1].trim().slice(0, 200);
      if (!text) continue;
      const id = `p${phases.length - 1}-s${phase.steps.length}`;
      lastStep = { id, text };
      phase.steps.push(lastStep);
      continue;
    }

    // 步骤备注：缩进行（≥2 空格且非列表项）跟随上一条步骤
    if (lastStep && /^\s{2,}\S/.test(raw) && !/^\s*-\s/.test(raw)) {
      const note = raw.trim().slice(0, 200);
      lastStep.note = lastStep.note ? `${lastStep.note}${note}` : note;
      continue;
    }

    // 阶段说明文本（## 之前的顶层文本忽略）
    if (phase) {
      phase.desc = phase.desc ? `${phase.desc}${line.trim()}` : line.trim();
    }
  }

  return { ok: true, content: { phases }, stepsCount: phases.reduce((n, p) => n + p.steps.length, 0) };
}

/** 校验解析结果是否达到上架门槛；不通过时返回用户可读错误。 */
export function validateRoadmap(parsed: RoadmapParseResult): string | null {
  if (!parsed.ok) return parsed.error;
  if (parsed.content.phases.length < 1) {
    return '路线图至少需要 1 个阶段：请用「## 阶段标题」定义阶段';
  }
  if (parsed.stepsCount < 3) {
    return '路线图至少需要 3 个步骤：请在阶段下用「- [ ] 步骤内容」列出步骤';
  }
  const emptyPhase = parsed.content.phases.find((p) => p.steps.length === 0);
  if (emptyPhase) {
    return `阶段「${emptyPhase.title}」下没有步骤，请补充或删除该阶段`;
  }
  return null;
}
