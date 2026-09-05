-- V9：新增「留学申请」分类（真实资料上线：留学库 120 篇按国家，独立成类比混入升学备考更清晰）
ALTER TYPE "Category" ADD VALUE IF NOT EXISTS 'ABROAD';
