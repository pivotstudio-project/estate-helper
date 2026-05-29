import { getEstateStorage, TARGET_REALTOR } from '../utils/store';
import { flattenArticle, fmtDate } from '../utils/formatter';

function cleanNum(val: any): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  let s = String(val).replace(/,/g, "").trim();
  if (s.includes("~")) s = s.split("~")[0].trim();
  if (s.includes("/")) s = s.split("/")[0].trim();
  if (s.includes("억")) {
    const p = s.split("억");
    return parseFloat(p[0] || '0') * 10000 + (parseFloat(p[1]) || 0);
  }
  return parseFloat(s) || 0;
}

export default defineEventHandler(async (event) => {
  try {
    const payload = await readBody(event);
    const rep_articles = payload.representativeArticles || {};
    const article_order = payload.articleOrder || [];
    const all_groups = payload.allGroups || {};
    const complex_name = payload.complexName || '단지명';

    const complexNo = String(payload.complexNo || 'default');
    const article_results = [];
    let idx = 0;

    const keys_to_process = article_order.length ? article_order : Object.keys(rep_articles);

    for (const article_no of keys_to_process) {
      const rep = rep_articles[String(article_no)];
      if (!rep) continue;

      const group = all_groups[String(article_no)] || [];
      if (!group.length) continue;

      const tradeType = rep.tradeTypeName || '';
      const warrantsMap = new Map<number, string>();
      const rentsMap = new Map<number, string>();
      const pricesMap = new Map<number, string>();

      for (const item of group) {
        const wStr = item.warrantPrc || item.dealOrWarrantPrc || '';
        const rStr = String(item.rentPrc || '');
        const pStr = item.dealPrc || item.dealOrWarrantPrc || '';

        if (wStr) warrantsMap.set(cleanNum(wStr), wStr);
        if (rStr && rStr !== '0' && rStr !== 'null') rentsMap.set(cleanNum(rStr), rStr);
        if (pStr) pricesMap.set(cleanNum(pStr), pStr);
      }

      const sortedWarrantsNum = [...warrantsMap.keys()].sort((a, b) => a - b);
      const sortedRentsNum = [...rentsMap.keys()].sort((a, b) => a - b);
      const sortedPricesNum = [...pricesMap.keys()].sort((a, b) => a - b);

      let price_display = '';
      let groupMinPrice = sortedPricesNum[0] || 0;
      let groupMaxPrice = sortedPricesNum[sortedPricesNum.length - 1] || groupMinPrice;
      let groupMinRent = sortedRentsNum[0] || 0;
      let groupMaxRent = sortedRentsNum[sortedRentsNum.length - 1] || groupMinRent;

      if (tradeType === '월세') {
        let w_disp = '';
        if (sortedWarrantsNum.length > 1) {
          w_disp = `${warrantsMap.get(sortedWarrantsNum[0])} ~ ${warrantsMap.get(sortedWarrantsNum[sortedWarrantsNum.length - 1])}`;
        } else if (sortedWarrantsNum.length === 1) {
          w_disp = warrantsMap.get(sortedWarrantsNum[0]) || '';
        } else {
          w_disp = rep.dealOrWarrantPrc || '0';
        }

        let r_disp = '';
        if (sortedRentsNum.length > 1) {
          r_disp = `${rentsMap.get(sortedRentsNum[0])} ~ ${rentsMap.get(sortedRentsNum[sortedRentsNum.length - 1])}`;
        } else if (sortedRentsNum.length === 1) {
          r_disp = rentsMap.get(sortedRentsNum[0]) || '';
        } else {
          r_disp = '0';
        }

        price_display = r_disp !== '0' ? `${w_disp}/${r_disp}` : w_disp;
        groupMinPrice = sortedWarrantsNum[0] || 0;
        groupMaxPrice = sortedWarrantsNum[sortedWarrantsNum.length - 1] || groupMinPrice;
      } else {
        if (sortedPricesNum.length > 1) {
          price_display = `${pricesMap.get(sortedPricesNum[0])} ~ ${pricesMap.get(sortedPricesNum[sortedPricesNum.length - 1])}`;
        } else if (sortedPricesNum.length === 1) {
          price_display = pricesMap.get(sortedPricesNum[0]) || '';
        } else {
          price_display = rep.dealOrWarrantPrc || '';
        }
        groupMinRent = 0;
        groupMaxRent = 0;
      }

      const my_ranks = [];
      const realtors_all = [];

      const myCpStatus: Record<string, any> = { 아실: null, 이실장: null };

      for (let i = 0; i < group.length; i++) {
        const item = group[i];
        const verif = String(item.verificationTypeCode || '');
        const is_owner = (verif === 'OWNER') || Boolean(item.tradeCheckedByOwner);
        const is_site = (verif === 'SITE') || Boolean(item.siteImageCount);
        const c_date = fmtDate(item.articleConfirmYmd || '');

        // ★ [핵심] 네이버가 숨겨서 내려주는 아실/이실장 외부 원본 브릿지 링크 주소 가로채기
        const externalCpUrl = item.cpPcArticleUrl || item.cpPcArticleBridgeUrl || '';

        let cpClean = (item.cpName || '기타').replace('부동산', '').trim();
        if (cpClean.includes('이실장')) cpClean = '이실장';
        if (cpClean.includes('아실')) cpClean = '아실';

        if (item.realtorName && item.realtorName.includes(TARGET_REALTOR)) {
          const rankInfo = {
            rank: i + 1,
            cp: cpClean,
            is_owner,
            is_site,
            date: c_date,
            cpUrl: externalCpUrl // 내 매물 랭킹 스코어에 외부 주소 바인딩
          };
          my_ranks.push(rankInfo);

          if (cpClean === '아실') myCpStatus.아실 = rankInfo;
          if (cpClean === '이실장') myCpStatus.이실장 = rankInfo;
        }

        if (item.realtorName) {
          realtors_all.push({
            name: item.realtorName,
            cp: cpClean, // 매칭용 간소화 레이블 적용
            is_owner,
            is_site,
            date: c_date,
            articleNo: item.articleNo || '',
            cpUrl: externalCpUrl
          });
        }
      }

      const merged = { ...rep, ...group[0] };
      const row = flattenArticle(merged, idx);
      idx++;

      row['가격'] = price_display;
      row['tradeType'] = tradeType;
      row['_rawPrice'] = groupMinPrice;
      row['_rawRent'] = groupMinRent;
      row['_rawPriceMin'] = groupMinPrice;
      row['_rawPriceMax'] = groupMaxPrice;
      row['_rawRentMin'] = groupMinRent;
      row['_rawRentMax'] = groupMaxRent;

      row['ranks'] = my_ranks;
      row['_myCpStatus'] = myCpStatus;
      row['중개사수'] = realtors_all.length;
      row['중개사목록'] = realtors_all;
      row['_중개사명목록'] = realtors_all.map(r => r.name).join('|');
      row['단지번호'] = complexNo;

      article_results.push(row);
    }

    const storage = getEstateStorage();
    await storage.setItem(complexNo, {
      status: "DONE",
      complex_name: complex_name,
      rank_results: [],
      article_results: article_results
    });

    return { ok: true };

  } catch (e: any) {
    console.error(e);
    return { ok: false, error: e.message };
  }
});
