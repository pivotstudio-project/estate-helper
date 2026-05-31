import { ref, computed, onMounted, onUnmounted } from 'vue';

export function useEstate() {
  const query = ref('');
  const complexList = ref<any[]>([]);
  const selectedComplexNo = ref('');
  const isLoading = ref(false);
  const statusBannerMessage = ref('');
  const showStatusBanner = ref(false);
  const activeTab = ref('rank');
  const isSidebarOpen = ref(true);

  // 백엔드 응답 상태
  const complexName = ref('조회된 단지 없음');
  const rankResults = ref<any[]>([]);
  const articleResults = ref<any[]>([]);
  const isPyung = ref(false);

  let pollInterval: any = null;
  let extensionTimeout: any = null;

  // 공인중개사 모달 팝업 상태
  const isModalOpen = ref(false);
  const modalRealtors = ref<any[]>([]);

  // 필터 및 정렬 상태
  const proFilters = ref({
    priceDrop: false,
    immediate: false,
    exclusiveOther: false,
    owner: false,
    recent: false
  });

  const mainFilters = ref({
    trade: 'all',
    building: 'all',
    area: 'all',
    realtor: 'all',
    direction: 'all',
    room: 'all',
    bath: 'all',
    feature: 'all'
  });

  const priceFilters = ref({
    priceMin: null as number | null,
    priceMax: null as number | null,
    rentMin: null as number | null,
    rentMax: null as number | null,
    excludeSeango: false
  });

  // 전역 정렬 상태값
  const sortCol = ref('');
  const sortAsc = ref(false);

  // Todo: 부동산 입력 필요
  const realtorOptions = ref([
    "국민공인중개사사무소"
  ]);
  const MY_REALTOR = ref(realtorOptions.value[0]);

  // ✅ 사용자가 요청한 매물확인 컬럼 순서로 변경
  const COLS = ["거래유형", "동", "층", "총층수", "전용면적", "면적구분", "가격", "방향", "방수", "확인일", "중개사수"];

  // ✅ 선택된 부동산이 사용하는 CP 목록을 동적으로 수집 (가나다 순)
  const dynamicCPs = computed(() => {
    const cps = new Set<string>();
    articleResults.value.forEach(a => {
      if (a.중개사목록) {
        a.중개사목록.forEach((r: any) => {
          if (r.name.includes(MY_REALTOR.value) && r.cp) {
            cps.add(r.cp);
          }
        });
      }
    });
    return Array.from(cps).sort();
  });

  // ✅ 특정 매물의 '선택한 부동산' 순위를 동적으로 계산하는 헬퍼 함수
  const getMyRanks = (article: any) => {
    const my_ranks: any[] = [];
    const myCpStatus: Record<string, any> = {};

    if (article.중개사목록) {
      article.중개사목록.forEach((r: any, idx: number) => {
        if (r.name.includes(MY_REALTOR.value)) {
          const rankInfo = {
            rank: idx + 1,
            cp: r.cp,
            is_owner: r.is_owner,
            is_site: r.is_site,
            date: r.date,
            cpUrl: r.cpUrl
          };
          my_ranks.push(rankInfo);
          if (r.cp) {
            myCpStatus[r.cp] = rankInfo;
          }
        }
      });
    }
    return { my_ranks, myCpStatus };
  };

  const doSearch = () => {
    if (!query.value.trim()) return;
    isLoading.value = true;
    complexList.value = [];
    selectedComplexNo.value = '';
    statusBannerMessage.value = "🔍 네이버 부동산에서 단지 식별 데이터를 가져오는 중...";
    showStatusBanner.value = true;

    window.postMessage({ type: "SEARCH_KEYWORD", keyword: query.value.trim() }, "*");

    if (extensionTimeout) clearTimeout(extensionTimeout);
    extensionTimeout = setTimeout(() => {
      if (isLoading.value) {
        isLoading.value = false;
        if (pollInterval) clearInterval(pollInterval);

        statusBannerMessage.value = "❌ 익스텐션 응답 시간 초과: 확장 프로그램 동작 상태를 확인하세요.";
        setTimeout(() => { showStatusBanner.value = false; }, 4000);
      }
    }, 30000);
  };

  const doScrape = () => {
    if (!selectedComplexNo.value) return;
    startExtensionShuttle(selectedComplexNo.value);
  };

  const startExtensionShuttle = async (complexNo: string) => {
    complexList.value = [];
    statusBannerMessage.value = "데이터를 수집 중입니다. 잠시만 기다려 주세요...";
    showStatusBanner.value = true;

    await $fetch('/api/set-loading', { params: { complexNo } });
    window.postMessage({ type: "START_SCRAPING", complexNo: complexNo }, "*");

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => checkServerStatus(complexNo), 1500);

    if (extensionTimeout) clearTimeout(extensionTimeout);
    extensionTimeout = setTimeout(() => {
      if (pollInterval) {
        clearInterval(pollInterval);
        statusBannerMessage.value = "❌ 수집 시간 초과: 데이터가 너무 많거나 문제가 발생했습니다.";
        setTimeout(() => { showStatusBanner.value = false; }, 4000);
      }
    }, 60000);
  };

  const checkServerStatus = async (complexNo: string) => {
    const data: any = await $fetch('/api/status', { params: { complexNo } });
    if (data && data.status === "DONE") {
      clearInterval(pollInterval);
      if (extensionTimeout) clearTimeout(extensionTimeout);
      showStatusBanner.value = false;
      complexName.value = data.complex_name;
      articleResults.value = data.article_results;
    }
  };

  const handleExtensionMessage = (event: MessageEvent) => {
    if (event.data?.type !== "SEARCH_RESULT") return;
    if (extensionTimeout) clearTimeout(extensionTimeout);
    const data = event.data.data;
    isLoading.value = false;

    if (data.error) { statusBannerMessage.value = "❌ 검색 오류: " + data.error; return; }
    if (!data || !data.length) { statusBannerMessage.value = "❌ 조건에 맞는 단지가 없습니다."; return; }

    if (data.length === 1) {
      statusBannerMessage.value = "🚀 단일 타겟 단지 감지. 자동 파싱 엔진을 구동합니다...";
      startExtensionShuttle(data[0].complexNo);
    } else {
      showStatusBanner.value = false;
      complexList.value = data;
    }
  };

  const selectOptions = computed(() => {
    const getUnique = (key: string) => [...new Set(articleResults.value.map(a => a[key]).filter(Boolean))].sort();
    const realtors = new Set<string>();
    articleResults.value.forEach(a => {
      (a._중개사명목록 || '').split('|').forEach((n: string) => { if (n.trim()) realtors.add(n.trim()); });
    });
    const features = new Set<string>();
    articleResults.value.forEach(a => {
      (a.특징 || '').split(',').forEach((f: string) => { if (f.trim()) features.add(f.trim()); });
    });

    return {
      trade: getUnique('거래유형'), building: getUnique('동'), area: getUnique('전용면적'),
      direction: getUnique('방향'), room: getUnique('방수'), bath: getUnique('욕실수'),
      feature: [...features].sort(), realtor: [...realtors].sort()
    };
  });

  const summaryStats = computed(() => {
    const total = articleResults.value.length;
    const byTrade: Record<string, number> = {};
    articleResults.value.forEach(a => {
      const t = a['거래유형'] || '기타';
      byTrade[t] = (byTrade[t] || 0) + 1;
    });
    return { total, byTrade };
  });

  // ✅ 동적 랭크 기반 통계 (끌올 기준: 2위 밖)
  const rankStats = computed(() => {
    const ourArticles = articleResults.value.filter(r => getMyRanks(r).my_ranks.length > 0);
    const warnCnt = ourArticles.filter(r => getMyRanks(r).my_ranks.some((rk: any) => rk.rank > 2)).length;
    const okCnt = ourArticles.filter(r => getMyRanks(r).my_ranks.every((rk: any) => rk.rank <= 2)).length;
    return { total: articleResults.value.length, warnCnt, okCnt };
  });

  const filteredArticles = computed(() => {
    let rows = articleResults.value;

    if (mainFilters.value.trade && mainFilters.value.trade !== 'all') rows = rows.filter(r => r['거래유형'] === mainFilters.value.trade);
    if (mainFilters.value.building && mainFilters.value.building !== 'all') rows = rows.filter(r => r['동'] === mainFilters.value.building);
    if (mainFilters.value.area && mainFilters.value.area !== 'all') rows = rows.filter(r => r['전용면적'] === mainFilters.value.area);
    if (mainFilters.value.direction && mainFilters.value.direction !== 'all') rows = rows.filter(r => r['방향'] === mainFilters.value.direction);
    if (mainFilters.value.room && mainFilters.value.room !== 'all') rows = rows.filter(r => r['방수'] === mainFilters.value.room);
    if (mainFilters.value.bath && mainFilters.value.bath !== 'all') rows = rows.filter(r => r['욕실수'] === mainFilters.value.bath);
    if (mainFilters.value.feature && mainFilters.value.feature !== 'all') {
      rows = rows.filter(r => (r['특징'] || '').split(',').map((s: string) => s.trim()).includes(mainFilters.value.feature));
    }
    if (mainFilters.value.realtor && mainFilters.value.realtor !== 'all') {
      rows = rows.filter(r => (r['_중개사명목록'] || '').split('|').map((s: string) => s.trim()).includes(mainFilters.value.realtor));
    }

    if (priceFilters.value.priceMin !== null) rows = rows.filter(r => (r._rawPriceMax ?? r._rawPrice) >= priceFilters.value.priceMin!);
    if (priceFilters.value.priceMax !== null) rows = rows.filter(r => (r._rawPriceMin ?? r._rawPrice) <= priceFilters.value.priceMax!);
    if (priceFilters.value.rentMin !== null) rows = rows.filter(r => (r._rawRentMax ?? r._rawRent) >= priceFilters.value.rentMin!);
    if (priceFilters.value.rentMax !== null) rows = rows.filter(r => (r._rawRentMin ?? r._rawRent) <= priceFilters.value.rentMax!);
    if (priceFilters.value.excludeSeango) {
      const seangoRegex = /세\s*안고|세\s*끼고|전세\s*안고/i;
      rows = rows.filter(r => {
        const text = (r['특징'] || '') + (r['태그원문'] || '');
        return !seangoRegex.test(text);
      });
    }

    if (proFilters.value.priceDrop) rows = rows.filter(r => r['가격변동여부'] === true || (r['특징'] || '').includes('급매'));
    if (proFilters.value.immediate) rows = rows.filter(r => (r['입주유형'] || '').includes('즉시') || (r['입주유형'] || '').includes('공실') || (r['태그원문'] || '').includes('즉시입주'));

    // ✅ 동적 MY_REALTOR 필터 적용
    if (proFilters.value.exclusiveOther) rows = rows.filter(r => r['중개사수'] === 1 && !(r['_중개사명목록'] || '').includes(MY_REALTOR.value));

    if (proFilters.value.owner) rows = rows.filter(r => r['구분'] === '집주인 직거래');

    if (proFilters.value.recent) {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const threeDaysAgo = now.getTime() - (3 * 864e5);
      rows = rows.filter(r => r._confirmTimestamp && r._confirmTimestamp >= threeDaysAgo);
    }

    if (sortCol.value && !dynamicCPs.value.includes(sortCol.value)) {
      rows = [...rows].sort((a, b) => {
        const targetCol = sortCol.value;
        if (targetCol === '가격') return sortAsc.value ? a._rawPrice - b._rawPrice : b._rawPrice - a._rawPrice;
        if (targetCol === '확인일') return sortAsc.value ? (a._confirmTimestamp - b._confirmTimestamp) : (b._confirmTimestamp - a._confirmTimestamp);
        if (targetCol === '중개사수' || targetCol === '경쟁사') {
          const ca = a['중개사수'] ?? a.total ?? 0;
          const cb = b['중개사수'] ?? b.total ?? 0;
          return sortAsc.value ? ca - cb : cb - ca;
        }

        const va = a[targetCol] ?? ''; const vb = b[targetCol] ?? '';
        const na = parseFloat(String(va).replace(/[^0-9.-]/g, '')); const nb = parseFloat(String(vb).replace(/[^0-9.-]/g, ''));
        const c = (!isNaN(na) && !isNaN(nb)) ? na - nb : String(va).localeCompare(String(vb), 'ko');
        return sortAsc.value ? c : -c;
      });
    } else {
      rows = [...rows].sort((a, b) => (a['순번'] ?? 0) - (b['순번'] ?? 0));
    }

    return rows;
  });

  // ✅ 동적 랭크 기반 정렬 로직 (객체에 _dynamicRanks, _dynamicCpStatus 주입)
  const sortedRankResults = computed(() => {
    let rows = filteredArticles.value.map(r => {
      const { my_ranks, myCpStatus } = getMyRanks(r);
      return { ...r, _dynamicRanks: my_ranks, _dynamicCpStatus: myCpStatus };
    });

    if (sortCol.value && !dynamicCPs.value.includes(sortCol.value)) {
      rows.sort((a, b) => {
        const targetCol = sortCol.value;
        if (targetCol === '가격') return sortAsc.value ? a._rawPrice - b._rawPrice : b._rawPrice - a._rawPrice;
        if (targetCol === '확인일') return sortAsc.value ? (a._confirmTimestamp - b._confirmTimestamp) : (b._confirmTimestamp - a._confirmTimestamp);
        if (targetCol === '경쟁사' || targetCol === '중개사수') {
          const ca = a['중개사수'] ?? a.total ?? 0;
          const cb = b['중개사수'] ?? b.total ?? 0;
          return sortAsc.value ? ca - cb : cb - ca;
        }

        const va = a[targetCol] ?? ''; const vb = b[targetCol] ?? '';
        const na = parseFloat(String(va).replace(/[^0-9.-]/g, '')); const nb = parseFloat(String(vb).replace(/[^0-9.-]/g, ''));
        const c = (!isNaN(na) && !isNaN(nb)) ? na - nb : String(va).localeCompare(String(vb), 'ko');
        return sortAsc.value ? c : -c;
      });
    } else {
      rows.sort((a, b) => {
        const aHasOur = a._dynamicRanks.length > 0;
        const bHasOur = b._dynamicRanks.length > 0;
        // ✅ 끌올 기준 2위 밖
        const aNeedPull = aHasOur && a._dynamicRanks.some((rk: any) => rk.rank > 2);
        const bNeedPull = bHasOur && b._dynamicRanks.some((rk: any) => rk.rank > 2);

        const aScore = aNeedPull ? 3 : aHasOur ? 2 : 1;
        const bScore = bNeedPull ? 3 : bHasOur ? 2 : 1;

        if (aScore !== bScore) return bScore - aScore;
        return String(a['동'] || '').localeCompare(String(b['동'] || ''), 'ko');
      });
    }

    return rows;
  });

  const formatArea = (val: string) => {
    if (!val) return '-';
    if (isPyung.value && val.includes('㎡')) {
      const n = parseFloat(val.replace('㎡', '')); return !isNaN(n) ? Math.round(n * 0.3025) + '평' : val;
    }
    return val;
  };

  const toggleSort = (col: string) => {
    // ✅ 동적 CP 컬럼은 정렬에서 제외
    if (dynamicCPs.value.includes(col)) return;

    let target = col;
    if (col === '경쟁사') target = '중개사수';

    if (sortCol.value === target) { sortAsc.value = !sortAsc.value; }
    else { sortCol.value = target; sortAsc.value = true; }
  };

  const resetSort = () => { sortCol.value = ''; sortAsc.value = false; };

  const resetFilters = () => {
    Object.keys(mainFilters.value).forEach(k => (mainFilters.value as any)[k] = 'all');
    Object.keys(proFilters.value).forEach(k => (proFilters.value as any)[k] = false);
    priceFilters.value.priceMin = null; priceFilters.value.priceMax = null; priceFilters.value.rentMin = null; priceFilters.value.rentMax = null; priceFilters.value.excludeSeango = false;
  };

  const openRealtorModal = (list: any[]) => { modalRealtors.value = list || []; isModalOpen.value = true; };

  onMounted(() => { window.addEventListener("message", handleExtensionMessage); });
  onUnmounted(() => { window.removeEventListener("message", handleExtensionMessage); if (pollInterval) clearInterval(pollInterval); if (extensionTimeout) clearTimeout(extensionTimeout); });

  return {
    query, complexList, selectedComplexNo, isLoading, statusBannerMessage, showStatusBanner, activeTab, isSidebarOpen,
    complexName, rankResults, articleResults, isPyung, isModalOpen, modalRealtors,
    proFilters, mainFilters, priceFilters, sortCol, sortAsc, COLS,
    MY_REALTOR, realtorOptions, dynamicCPs,
    doSearch, doScrape, selectOptions, summaryStats, rankStats, sortedRankResults, filteredArticles, formatArea, toggleSort, resetSort, resetFilters, openRealtorModal
  };
}
