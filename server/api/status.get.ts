import { getEstateStorage } from '../utils/store';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const complexNo = String(query.complexNo || 'default');
  const storage = getEstateStorage();

  // 스토리지에서 해당 단지 데이터 조회
  const data = await storage.getItem(complexNo);

  return data || {
    status: "READY",
    complex_name: "조회된 단지 없음",
    rank_results: [],
    article_results: []
  };
});
