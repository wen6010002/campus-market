// 评分重算（纯函数，单测重点）。
export interface RatingDist {
  '5': number;
  '4': number;
  '3': number;
  '2': number;
  '1': number;
}

/**
 * 重算均值（保留 1 位）与分布。newRating = (oldRating*oldCount + stars) / (oldCount+1)。
 */
export function recalcRating(
  oldRating: number,
  oldCount: number,
  stars: number,
  dist: RatingDist,
): { rating: number; ratingCount: number; dist: RatingDist } {
  const ratingCount = oldCount + 1;
  const rating = Math.round(((oldRating * oldCount + stars) / ratingCount) * 10) / 10;
  const next = {
    ...dist,
    [String(stars)]: (dist[String(stars) as keyof RatingDist] ?? 0) + 1,
  } as RatingDist;
  return { rating, ratingCount, dist: next };
}
