import { getEstateStorage } from '../utils/store';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const complexNo = String(query.complexNo || 'default');
  const storage = getEstateStorage();

  // 해당 단지 번호 공간에만 로딩 상태 세팅 (비동기 처리)
  await storage.setItem(complexNo, {
    status: "LOADING",
    complex_name: "수집 중...",
    rank_results: [],
    article_results: []
  });

  return { ok: true };
});
