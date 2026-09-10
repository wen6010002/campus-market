# 敏感词字典源文件

本目录是**构建输入**，不在运行时读取（Next standalone 不会打包 txt）。
运行时用的是 `../words.data.ts`（由 `pnpm build:words` 从这里编译生成）。

## 来源与许可

| 文件              | 类别                          | 处置          | 来源                                                                      |
| ----------------- | ----------------------------- | ------------- | ------------------------------------------------------------------------- |
| porn.txt          | 色情低俗                      | REJECT 硬拒   | fwwdn/sensitive-stop-words（Apache-2.0），见 LICENSE.sensitive-stop-words |
| politics.txt      | 涉政                          | REJECT 硬拒   | 同上                                                                      |
| illegal.txt       | 涉枪涉爆违法                  | REJECT 硬拒   | 同上                                                                      |
| ads.txt           | 广告推广                      | REVIEW 转待审 | 同上（构建时剔除校园语境常见词，见 build-words.ts EXCLUDE）               |
| campus-reject.txt | 校园违规（代考代写/卖答案等） | REJECT 硬拒   | 自建（V12）                                                               |
| campus-review.txt | 刷单/兼职诈骗信号             | REVIEW 转待审 | 自建（V12）                                                               |

- 上游仓库：https://github.com/fwwdn/sensitive-stop-words（Apache License 2.0，保留原许可声明）
- 补充候选源（未启用）：konsheng/Sensitive-lexicon（MIT）
- 词表内置哨兵词「课搭测试违禁词」供冒烟脚本验证拦截链路

## 增删词

直接改对应 txt → 跑 `pnpm build:words` → 提交（words.data.ts 一并入库）。
