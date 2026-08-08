import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

export function useEstate() {
  const query = ref('');
  const complexList = ref<any[]>([]);
  const selectedComplexNo = ref('');
  const isLoading = ref(false);
  const statusBannerMessage = ref('');
  const showStatusBanner = ref(false);
  const activeTab = ref('rank');
  const isSidebarOpen = ref(true);

  const complexName = ref('조회된 단지 없음');
  const rankResults = ref<any[]>([]);
  const articleResults = ref<any[]>([]);

  let pollInterval: any = null;
  let extensionTimeout: any = null;

  const isModalOpen = ref(false);
  const modalRealtors = ref<any[]>([]);

  // 선택 매물: 단지가 바뀌어도 누적 유지되도록 "행 데이터 자체"를 보관 (고유키 = 단지번호:순번)
  const selectedArticles = ref<any[]>([]);
  const keyOf = (row: any) => `${row?.단지번호 ?? ''}:${row?.순번 ?? ''}`;
  const isPrintModalOpen = ref(false);
  const showRealtorInPrint = ref(false);

  const activeQuickFilter = ref<'urgent' | 'neglected' | 'safe' | null>(null);
  const NEGLECT_DAYS = 7;

  const proFilters = ref({
    priceDrop: false,
    immediate: false,
    exclusiveOther: false,
    owner: false,
    recent: false
  });

  const mainFilters = ref({
    trade: [] as string[],
    building: [] as string[],
    area: [] as string[],
    areaType: [] as string[],
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
    excludeSeango: false,
    onlySeango: false
  });

  // 세안고 "제외"와 "만 보기"는 동시에 켜면 결과가 0건이 되므로 상호 배타 처리
  watch(() => priceFilters.value.excludeSeango, (v) => { if (v) priceFilters.value.onlySeango = false; });
  watch(() => priceFilters.value.onlySeango, (v) => { if (v) priceFilters.value.excludeSeango = false; });

  const sortCol = ref('');
  const sortAsc = ref(false);

  const realtorOptions = ref([
    "국민공인중개사사무소",
    "선사아이파크공인중개사사무소"
  ]);
  const MY_REALTOR = ref(realtorOptions.value[0]);

  const COLS = ["거래유형", "동", "층", "총층수", "전용면적", "면적구분", "가격", "방향", "방수", "확인일", "중개사수", "중개사목록"];

  const cleanRealtorName = (name: string) => {
    if (!name) return '';
    return name.replace(/(부동산)?공인중개사(사무소)?|부동산중개|부동산/g, '').trim();
  };

  const getUniqueRealtors = (list: any[]) => {
    if (!Array.isArray(list)) return [];
    const seen = new Set<string>();
    return list.filter(r => {
      const cleanName = cleanRealtorName(r.name);
      if (seen.has(cleanName)) return false;
      seen.add(cleanName);
      return true;
    });
  };

  const supplyAreaToPyung = (supplyArea: string): string => {
    if (!supplyArea) return '';
    const m2str = String(supplyArea).replace('㎡', '').trim();
    const n = parseFloat(m2str);
    if (isNaN(n)) return '';
    return `${Math.round(n * 0.3025)}평`;
  };

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

    // 완료는 확장의 SCRAPE_DONE 신호로 감지(=시간 제한 없음).
    // 폴링은 신호가 유실될 때를 대비한 백업으로만 유지(상태가 DONE/ERROR면 알아서 멈춤).
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => checkServerStatus(complexNo), 2000);
  };

  // 확장이 수집을 끝내면(성공/실패) 직접 신호를 보냄 → 그때 서버 데이터를 한 번만 가져옴
  const handleScrapeDone = async (msg: any) => {
    const complexNo = String(msg.complexNo || 'default');
    if (msg.ok) {
      await checkServerStatus(complexNo); // 상태가 DONE이면 데이터 로드 + 폴링 정리
    } else {
      if (pollInterval) clearInterval(pollInterval);
      showStatusBanner.value = true;
      statusBannerMessage.value = "❌ 수집 실패: " + (msg.error || "알 수 없는 오류가 발생했습니다.");
      setTimeout(() => { showStatusBanner.value = false; }, 4000);
    }
  };

  const checkServerStatus = async (complexNo: string) => {
    const data: any = await $fetch('/api/status', { params: { complexNo } });
    if (data && data.status === "DONE") {
      clearInterval(pollInterval);
      if (extensionTimeout) clearTimeout(extensionTimeout);
      showStatusBanner.value = false;
      complexName.value = data.complex_name;
      articleResults.value = data.article_results;
      // 선택은 단지가 바뀌어도 누적 유지 (단지번호:순번 고유키라 서로 안 섞임) → 초기화하지 않음
    } else if (data && data.status === "ERROR") {
      // 서버 저장 실패 등 확정 실패 → 타임아웃까지 기다리지 않고 즉시 표시
      clearInterval(pollInterval);
      if (extensionTimeout) clearTimeout(extensionTimeout);
      statusBannerMessage.value = "❌ 저장 실패: " + (data.error || "데이터 저장 중 문제가 발생했습니다.");
      setTimeout(() => { showStatusBanner.value = false; }, 4000);
    }
  };

  const handleExtensionMessage = (event: MessageEvent) => {
    if (event.data?.type === "SCRAPE_DONE") { handleScrapeDone(event.data); return; }
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
      (a.특징태그 || '').split(',').forEach((f: string) => { if (f.trim()) features.add(f.trim()); });
    });

    return {
      trade: getUnique('거래유형'),
      building: getUnique('동'),
      area: getUnique('전용면적'),
      areaType: getUnique('면적구분'),
      direction: getUnique('방향'),
      room: getUnique('방수'),
      bath: getUnique('욕실수'),
      feature: [...features].sort(),
      realtor: [...realtors].sort()
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

  const rankStats = computed(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const neglectThreshold = now.getTime() - (NEGLECT_DAYS * 864e5);
    const ourArticles = articleResults.value.filter(r => getMyRanks(r).my_ranks.length > 0);

    const urgentCnt = ourArticles.filter(r =>
      getMyRanks(r).my_ranks.some((rk: any) => rk.rank > 4)
    ).length;

    const neglectedCnt = ourArticles.filter(r =>
      getMyRanks(r).my_ranks.some((rk: any) => {
        if (!rk.date) return false;
        const parts = rk.date.replace(/[\/\-]/g, '.').split('.');
        if (parts.length < 3) return false;
        const year = parts[0].length === 2 ? `20${parts[0]}` : parts[0];
        const d = new Date(parseInt(year), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.getTime() <= neglectThreshold;
      })
    ).length;

    const safeCnt = ourArticles.filter(r =>
      getMyRanks(r).my_ranks.every((rk: any) => rk.rank <= 2)
    ).length;

    return { total: articleResults.value.length, urgentCnt, neglectedCnt, safeCnt };
  });

  // ✅ 공인중개사무소 필터를 제외한 나머지 조건만 적용한 중간 computed
  // realtorRanking 집계 기준 + filteredArticles의 base로 사용 (순환참조 방지)
  const filteredArticlesWithoutRealtor = computed(() => {
    let rows = articleResults.value;

    if (mainFilters.value.trade.length)
      rows = rows.filter(r => mainFilters.value.trade.includes(r['거래유형']));
    if (mainFilters.value.building.length)
      rows = rows.filter(r => mainFilters.value.building.includes(r['동']));
    if (mainFilters.value.area.length)
      rows = rows.filter(r => mainFilters.value.area.includes(r['전용면적']));
    if (mainFilters.value.areaType.length)
      rows = rows.filter(r => mainFilters.value.areaType.includes(r['면적구분']));
    if (mainFilters.value.direction !== 'all') rows = rows.filter(r => r['방향'] === mainFilters.value.direction);
    if (mainFilters.value.room !== 'all') rows = rows.filter(r => r['방수'] === mainFilters.value.room);
    if (mainFilters.value.bath !== 'all') rows = rows.filter(r => r['욕실수'] === mainFilters.value.bath);
    if (mainFilters.value.feature !== 'all') {
      rows = rows.filter(r => (r['특징태그'] || '').split(',').map((s: string) => s.trim()).includes(mainFilters.value.feature));
    }

    if (priceFilters.value.priceMin !== null) rows = rows.filter(r => (r._rawPriceMax ?? r._rawPrice) >= priceFilters.value.priceMin!);
    if (priceFilters.value.priceMax !== null) rows = rows.filter(r => (r._rawPriceMin ?? r._rawPrice) <= priceFilters.value.priceMax!);
    if (priceFilters.value.rentMin !== null) rows = rows.filter(r => (r._rawRentMax ?? r._rawRent) >= priceFilters.value.rentMin!);
    if (priceFilters.value.rentMax !== null) rows = rows.filter(r => (r._rawRentMin ?? r._rawRent) <= priceFilters.value.rentMax!);
    if (priceFilters.value.excludeSeango || priceFilters.value.onlySeango) {
      const seangoRegex = /세\s*안고|세\s*끼고|전세\s*안고/i;
      const isSeango = (r: any) => seangoRegex.test(
        (r['특징'] || '') + (r['특징태그'] || '') + (r['태그원문'] || '')
      );
      rows = priceFilters.value.onlySeango
        ? rows.filter(isSeango)
        : rows.filter(r => !isSeango(r));
    }

    if (proFilters.value.priceDrop) rows = rows.filter(r => r['가격변동여부'] === true || (r['특징태그'] || '').includes('급매'));
    if (proFilters.value.immediate) rows = rows.filter(r => (r['입주유형'] || '').includes('즉시') || (r['입주유형'] || '').includes('공실') || (r['태그원문'] || '').includes('즉시입주'));
    if (proFilters.value.exclusiveOther) rows = rows.filter(r => r['중개사수'] === 1 && !(r['_중개사명목록'] || '').includes(MY_REALTOR.value));
    if (proFilters.value.owner) rows = rows.filter(r => r['구분'] === '집주인 직거래');
    if (proFilters.value.recent) {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const threeDaysAgo = now.getTime() - (3 * 864e5);
      rows = rows.filter(r => r._confirmTimestamp && r._confirmTimestamp >= threeDaysAgo);
    }

    return rows;
  });

  // ✅ 보유랭킹: 공인중개사무소 필터 제외 기준으로 중개사별 매물 수 집계, 내림차순
  const realtorRanking = computed(() => {
    const countMap = new Map<string, number>();
    filteredArticlesWithoutRealtor.value.forEach(a => {
      const names = new Set(
        (a._중개사명목록 || '').split('|').map((n: string) => n.trim()).filter(Boolean)
      );
      names.forEach(name => {
        countMap.set(name, (countMap.get(name) || 0) + 1);
      });
    });
    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  });

  const filteredArticles = computed(() => {
    let rows = filteredArticlesWithoutRealtor.value;

    // 공인중개사무소 필터만 여기서 추가 적용
    if (mainFilters.value.realtor !== 'all') {
      rows = rows.filter(r => (r['_중개사명목록'] || '').split('|').map((s: string) => s.trim()).includes(mainFilters.value.realtor));
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

  const sortedRankResults = computed(() => {
    let rows = filteredArticles.value.map(r => {
      const { my_ranks, myCpStatus } = getMyRanks(r);
      return { ...r, _dynamicRanks: my_ranks, _dynamicCpStatus: myCpStatus };
    });

    if (activeQuickFilter.value === 'urgent') {
      rows = rows.filter(r => r._dynamicRanks.some((rk: any) => rk.rank > 4));
    } else if (activeQuickFilter.value === 'neglected') {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const neglectThreshold = now.getTime() - (NEGLECT_DAYS * 864e5);
      rows = rows.filter(r =>
        r._dynamicRanks.some((rk: any) => {
          if (!rk.date) return false;
          const parts = rk.date.replace(/[\/\-]/g, '.').split('.');
          if (parts.length < 3) return false;
          const year = parts[0].length === 2 ? `20${parts[0]}` : parts[0];
          const d = new Date(parseInt(year), parseInt(parts[1]) - 1, parseInt(parts[2]));
          return d.getTime() <= neglectThreshold;
        })
      );
    } else if (activeQuickFilter.value === 'safe') {
      rows = rows.filter(r => r._dynamicRanks.length > 0 && r._dynamicRanks.every((rk: any) => rk.rank <= 2));
    }

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

  // 선택 시 현재 단지명을 각인 (row.단지명이 비어있는 경우 대비 → 그룹 라벨로 사용)
  const currentComplexLabel = () => {
    const n = complexName.value;
    if (n && n !== '단지명' && n !== '조회된 단지 없음' && n !== '수집 중...') return n;
    return '';
  };
  // 실제 단지명은 대개 '원문'(articleName)에 들어있음 (complex_name/단지명 필드는 비어있는 경우가 많음)
  const stampComplex = (row: any) => ({ ...row, __complexName: row.원문 || currentComplexLabel() || row.단지명 || row.단지번호 || '' });

  const toggleArticleSelection = (row: any) => {
    const k = keyOf(row);
    if (selectedArticles.value.some(a => keyOf(a) === k)) {
      selectedArticles.value = selectedArticles.value.filter(a => keyOf(a) !== k);
    } else {
      selectedArticles.value = [...selectedArticles.value, stampComplex(row)];
    }
  };

  const isSelectedArticle = (row: any) => {
    const k = keyOf(row);
    return selectedArticles.value.some(a => keyOf(a) === k);
  };
  const clearSelectedArticles = () => { selectedArticles.value = []; };

  const toggleAllSelection = (checked: boolean) => {
    if (checked) {
      const existing = new Set(selectedArticles.value.map(keyOf));
      const additions = filteredArticles.value.filter(a => !existing.has(keyOf(a))).map(stampComplex);
      selectedArticles.value = [...selectedArticles.value, ...additions];
    } else {
      const currentKeys = new Set(filteredArticles.value.map(keyOf));
      selectedArticles.value = selectedArticles.value.filter(a => !currentKeys.has(keyOf(a)));
    }
  };

  // 선택 매물 목록 = 누적 보관된 행 그대로 (체크한 순서 유지, 단지 넘나들며 누적)
  const selectedArticlesList = computed(() => selectedArticles.value);

  // 추천리스트 모달 정렬 (면적 / 가격)
  const recommendSortCol = ref<'' | '면적' | '가격'>('');
  const recommendSortAsc = ref(true);
  const toggleRecommendSort = (col: '면적' | '가격') => {
    if (recommendSortCol.value === col) recommendSortAsc.value = !recommendSortAsc.value;
    else { recommendSortCol.value = col; recommendSortAsc.value = true; }
  };
  const sortedSelectedArticlesList = computed(() => {
    const list = selectedArticlesList.value;
    if (!recommendSortCol.value) return list;
    const col = recommendSortCol.value;
    const getVal = (a: any) => col === '가격' ? (a._rawPrice ?? 0) : (a._전용면적수치 ?? 0);
    return [...list].sort((x, y) => {
      const d = getVal(x) - getVal(y);
      return recommendSortAsc.value ? d : -d;
    });
  });

  // 추천리스트를 단지별로 묶어 표시 (단지 넘나든 선택을 헷갈리지 않게 구분)
  const groupedSelectedArticles = computed(() => {
    const groups: { key: string; name: string; items: any[]; startIndex: number }[] = [];
    const map = new Map<string, any>();
    for (const a of sortedSelectedArticlesList.value) {
      const key = String(a.단지번호 ?? a.__complexName ?? '');
      let g = map.get(key);
      if (!g) { g = { key, name: a.__complexName || a.원문 || a.단지명 || a.단지번호 || '단지', items: [], startIndex: 0 }; map.set(key, g); groups.push(g); }
      g.items.push(a);
    }
    let acc = 0;
    for (const g of groups) { g.startIndex = acc; acc += g.items.length; }
    return groups;
  });

  const isAllSelected = computed(() => {
    const keys = new Set(selectedArticles.value.map(keyOf));
    return filteredArticles.value.length > 0
      && filteredArticles.value.every(a => keys.has(keyOf(a)));
  });

  const isIndeterminate = computed(() => {
    const keys = new Set(selectedArticles.value.map(keyOf));
    const inSel = filteredArticles.value.filter(a => keys.has(keyOf(a))).length;
    return inSel > 0 && inSel < filteredArticles.value.length;
  });

  const copyToast = ref(false);

  const copySelection = async () => {
    const itemLine = (item: any) => {
      const pyung = supplyAreaToPyung(item['공급면적']);
      const dong = item['동'] || '';
      const floor = item['층'] ? `${item['층']}층` : '';
      const totalFloor = item['총층수'] ? `/${item['총층수']}층` : '';
      const location = `${dong}, ${floor}${totalFloor}`;
      const areaType = item['면적구분'] || '';
      const direction = item['방향'] || '';
      const price = item['가격'] || '';
      const mainParts = [location, areaType, pyung, direction, price].filter(Boolean).join(', ');
      const 특징 = item['특징'] ? item['특징'].trim() : '';
      return 특징 ? `${mainParts}\n${특징}` : mainParts;
    };
    // 단지별로 묶어서 복사 (여러 단지면 단지명 헤더 표시)
    const groups = groupedSelectedArticles.value;
    const multi = groups.length > 1;
    const blocks = groups.map(g => {
      const body = g.items.map(itemLine).join('\n\n');
      return multi ? `[${g.name}]\n${body}` : body;
    });

    const text = ['매물 추천리스트', '', blocks.join('\n\n'), '', '※ 가격 및 매물 현황은 변동될 수 있습니다.'].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      copyToast.value = true;
      setTimeout(() => { copyToast.value = false; }, 2500);
    } catch {
      alert('복사에 실패했습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  const printSelection = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) { alert("팝업 차단이 설정되어 있습니다. 브라우저 설정에서 팝업을 허용해주세요."); return; }

    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

    const withRealtor = showRealtorInPrint.value;

    const itemRow = (item: any, no: number) => {
      const pyung = supplyAreaToPyung(item['공급면적']);
      const areaCell = [item['면적구분'] || '', pyung].filter(Boolean).join(' / ');
      const floor = `${item['층'] || '-'}${item['총층수'] ? `/${item['총층수']}층` : ''}`;
      const bathRaw = String(item['방수'] || '');
      const bathNum = bathRaw.replace(/[^0-9]/g, '');
      const bath = bathNum ? `${bathNum}개` : '-';
      const 특징 = item['특징'] || '-';
      const tradeColor = item['거래유형'] === '매매' ? 'color:#1d4ed8;background:#dbeafe' : item['거래유형'] === '전세' ? 'color:#7e22ce;background:#f3e8ff' : 'color:#047857;background:#d1fae5';
      const realtorCell = withRealtor
        ? `<td style="color:#475569;font-size:11px">${getUniqueRealtors(item['중개사목록']).map(r => cleanRealtorName(r.name)).filter(Boolean).join(', ') || '-'}</td>`
        : '';
      return `<tr><td style="text-align:center;color:#94a3b8;font-size:11px">${no}</td><td><span style="display:inline-block;padding:2px 7px;border-radius:4px;font-weight:800;font-size:11px;${tradeColor}">${item['거래유형']}</span></td><td style="font-weight:700">${item['동'] || '-'} <span style="color:#94a3b8;font-weight:400">${floor}</span></td><td>${areaCell}</td><td style="font-weight:900;font-size:14px">${item['가격'] || '-'}</td><td>${item['방향'] || '-'}</td><td>${bath}</td><td style="color:#475569;font-size:11px">${특징}</td>${realtorCell}</tr>`;
    };
    // 단지별 그룹: 여러 단지면 단지명 헤더 행 삽입
    const groups = groupedSelectedArticles.value;
    const multi = groups.length > 1;
    const colCount = withRealtor ? 9 : 8;
    const rows = groups.map(g => {
      const header = multi
        ? `<tr><td colspan="${colCount}" style="background:#eef2ff;color:#3730a3;font-weight:800;font-size:12px;padding:7px 8px">${g.name} <span style="color:#6366f1;font-weight:600">(${g.items.length}건)</span></td></tr>`
        : '';
      const body = g.items.map((item, i) => itemRow(item, g.startIndex + i + 1)).join('');
      return header + body;
    }).join('');

    const realtorHead = withRealtor ? '<th style="width:160px">중개사</th>' : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>매물 추천리스트</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;font-size:12px;color:#1e293b;background:#fff;padding:28px 32px}.doc-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #0f172a}.doc-header h1{font-size:18px;font-weight:900;color:#0f172a}.doc-header .meta{font-size:11px;color:#64748b;text-align:right;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:12px}thead tr{background:#f1f5f9;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1}thead th{padding:7px 8px;font-weight:700;font-size:11px;color:#475569;text-align:left;white-space:nowrap}tbody tr{border-bottom:1px solid #e2e8f0}tbody tr:nth-child(even){background:#f8fafc}tbody td{padding:8px;vertical-align:middle;line-height:1.4}.doc-footer{margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}.print-btn{position:fixed;top:20px;right:20px;padding:9px 18px;background:#4f46e5;color:white;border:none;border-radius:6px;font-weight:bold;font-size:13px;cursor:pointer}@media print{.print-btn{display:none}body{padding:16px 20px}thead tr{background:#f1f5f9!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}tbody tr:nth-child(even){background:#f8fafc!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><button class="print-btn" onclick="window.print()">🖨️ 인쇄</button><div class="doc-header"><h1>매물 추천리스트</h1><div class="meta">총 ${sortedSelectedArticlesList.value.length}건<br>출력일: ${today}</div></div><table><thead><tr><th style="width:40px;text-align:center">No.</th><th style="width:60px">거래</th><th style="width:120px">동 / 층</th><th style="width:80px">면적</th><th style="width:250px">가격</th><th style="width:60px">방향</th><th style="width:50px">방수</th><th>특징</th>${realtorHead}</tr></thead><tbody>${rows}</tbody></table><div class="doc-footer">※ 가격 및 매물 현황은 변동될 수 있습니다.</div></body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  const formatDate = (val: string) => {
    if (!val) return '-';
    const parts = val.replace(/[\/\-]/g, '.').split('.');
    if (parts.length < 3) return val;
    const year = parts[0].length === 2 ? `20${parts[0]}` : parts[0];
    const date = new Date(parseInt(year), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (isNaN(date.getTime())) return val;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - date.getTime()) / 86400000);
    if (diffDays < 0) return val;
    if (diffDays === 0) return `${val} (오늘)`;
    return `${val} (${diffDays}일 전)`;
  };

  const formatArea = (val: string) => {
    if (!val) return '-';
    if (val.includes('㎡')) {
      const n = parseFloat(val.replace('㎡', ''));
      if (!isNaN(n)) return `${val} / ${Math.round(n * 0.3025)}평`;
    }
    return val;
  };

  const toggleSort = (col: string) => {
    if (dynamicCPs.value.includes(col)) return;
    const target = col === '경쟁사' ? '중개사수' : col;
    if (sortCol.value === target) { sortAsc.value = !sortAsc.value; }
    else { sortCol.value = target; sortAsc.value = true; }
  };

  const resetSort = () => { sortCol.value = ''; sortAsc.value = false; };

  const resetFilters = () => {
    // 멀티셀렉트 4개는 빈 배열로
    mainFilters.value.trade = [];
    mainFilters.value.building = [];
    mainFilters.value.area = [];
    mainFilters.value.areaType = [];
    // 나머지는 기존 방식 유지
    mainFilters.value.realtor = 'all';
    mainFilters.value.direction = 'all';
    mainFilters.value.room = 'all';
    mainFilters.value.bath = 'all';
    mainFilters.value.feature = 'all';

    Object.keys(proFilters.value).forEach(k => (proFilters.value as any)[k] = false);
    priceFilters.value.priceMin = null; priceFilters.value.priceMax = null;
    priceFilters.value.rentMin = null; priceFilters.value.rentMax = null;
    priceFilters.value.excludeSeango = false;
    priceFilters.value.onlySeango = false;
    activeQuickFilter.value = null;
  };

  const openRealtorModal = (list: any[]) => { modalRealtors.value = list || []; isModalOpen.value = true; };

  onMounted(() => { window.addEventListener("message", handleExtensionMessage); });
  onUnmounted(() => {
    window.removeEventListener("message", handleExtensionMessage);
    if (pollInterval) clearInterval(pollInterval);
    if (extensionTimeout) clearTimeout(extensionTimeout);
  });

  return {
    query, complexList, selectedComplexNo, isLoading, statusBannerMessage, showStatusBanner,
    activeTab, isSidebarOpen, complexName, rankResults, articleResults, isModalOpen, modalRealtors,
    proFilters, mainFilters, priceFilters, sortCol, sortAsc, COLS,
    MY_REALTOR, realtorOptions, dynamicCPs, cleanRealtorName, getUniqueRealtors,
    selectedArticles, isPrintModalOpen, showRealtorInPrint,
    toggleArticleSelection, isSelectedArticle, toggleAllSelection, clearSelectedArticles,
    selectedArticlesList, sortedSelectedArticlesList, groupedSelectedArticles, recommendSortCol, recommendSortAsc, toggleRecommendSort,
    isAllSelected, isIndeterminate, printSelection, copySelection, copyToast,
    doSearch, doScrape, selectOptions, summaryStats, rankStats,
    sortedRankResults, filteredArticles, formatArea, formatDate, toggleSort, resetSort, resetFilters,
    openRealtorModal, supplyAreaToPyung,
    activeQuickFilter, NEGLECT_DAYS,
    realtorRanking, // ✅
  };
}
