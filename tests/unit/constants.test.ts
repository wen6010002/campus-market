import { describe, it, expect } from 'vitest';
import { QualityBadge, WorkStatus, PayStatus, MAX_FILE_SIZE } from '@/lib/constants';

describe('共享常量字典', () => {
  it('枚举值大写英文且与契约一致', () => {
    expect(WorkStatus.PUBLISHED).toBe('PUBLISHED');
    expect(PayStatus.PAID).toBe('PAID');
  });

  it('质量徽标映射', () => {
    expect(QualityBadge.NORMAL).toBeNull();
    expect(QualityBadge.HIGH).toBe('⭐');
    expect(QualityBadge.SELECTED).toBe('🏅');
  });

  it('文件大小上限 200MB', () => {
    expect(MAX_FILE_SIZE).toBe(209715200);
  });
});
