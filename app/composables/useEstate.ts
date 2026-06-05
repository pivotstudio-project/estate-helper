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

  const complexName = ref('조회된 단지 없음');
  const rankResults = ref<any[]>([]);
  const articleResults = ref<any[]>([]);

  let pollInterval: any = null;
  let extensionTimeout: any = null;

  const isModalOpen = ref(false);
  const modalRealtors = ref<any[]>([]);

  const selectedArticleIds = ref<number[]>([]);
  const isPrintModalOpen = ref(false);

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
    trade: 'all',
    building: 'all',
    area: 'all',
    areaType: 'all',
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

    if (mainFilters.value.trade !== 'all') rows = rows.filter(r => r['거래유형'] === mainFilters.value.trade);
    if (mainFilters.value.building !== 'all') rows = rows.filter(r => r['동'] === mainFilters.value.building);
    if (mainFilters.value.area !== 'all') rows = rows.filter(r => r['전용면적'] === mainFilters.value.area);
    if (mainFilters.value.areaType !== 'all') rows = rows.filter(r => r['면적구분'] === mainFilters.value.areaType);
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
    if (priceFilters.value.excludeSeango) {
      const seangoRegex = /세\s*안고|세\s*끼고|전세\s*안고/i;
      rows = rows.filter(r => {
        const text = (r['특징'] || '') + (r['특징태그'] || '') + (r['태그원문'] || '');
        return !seangoRegex.test(text);
      });
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

  const toggleArticleSelection = (id: number) => {
    const numId = Number(id);
    if (selectedArticleIds.value.includes(numId)) {
      selectedArticleIds.value = selectedArticleIds.value.filter(i => i !== numId);
    } else {
      selectedArticleIds.value = [...selectedArticleIds.value, numId];
    }
  };

  const isSelectedArticle = (id: number) => selectedArticleIds.value.includes(Number(id));
  const clearSelectedArticles = () => { selectedArticleIds.value = []; };

  const toggleAllSelection = (checked: boolean) => {
    if (checked) {
      const newIds = new Set(selectedArticleIds.value);
      filteredArticles.value.forEach(a => newIds.add(Number(a.순번)));
      selectedArticleIds.value = Array.from(newIds);
    } else {
      const currentFilteredIds = filteredArticles.value.map(a => Number(a.순번));
      selectedArticleIds.value = selectedArticleIds.value.filter(id => !currentFilteredIds.includes(id));
    }
  };

  const selectedArticlesList = computed(() => {
    return articleResults.value.filter(a => selectedArticleIds.value.includes(Number(a.순번)));
  });

  const isAllSelected = computed(() => {
    return filteredArticles.value.length > 0
      && filteredArticles.value.every(a => selectedArticleIds.value.includes(Number(a.순번)));
  });

  const isIndeterminate = computed(() => {
    const selectedInFiltered = filteredArticles.value.filter(a => selectedArticleIds.value.includes(Number(a.순번)));
    return selectedInFiltered.length > 0 && selectedInFiltered.length < filteredArticles.value.length;
  });

  const copyToast = ref(false);

  const copySelection = async () => {
    const lines = selectedArticlesList.value.map((item) => {
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
    });

    const text = ['매물 추천리스트', '', lines.join('\n\n'), '', '※ 가격 및 매물 현황은 변동될 수 있습니다.'].join('\n');

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

    const rows = selectedArticlesList.value.map((item, i) => {
      const pyung = supplyAreaToPyung(item['공급면적']);
      const areaCell = [item['면적구분'] || '', pyung].filter(Boolean).join(' / ');
      const floor = `${item['층'] || '-'}${item['총층수'] ? `/${item['총층수']}층` : ''}`;
      const bathRaw = String(item['방수'] || '');
      const bathNum = bathRaw.replace(/[^0-9]/g, '');
      const bath = bathNum ? `${bathNum}개` : '-';
      const 특징 = item['특징'] || '-';
      const tradeColor = item['거래유형'] === '매매' ? 'color:#1d4ed8;background:#dbeafe' : item['거래유형'] === '전세' ? 'color:#7e22ce;background:#f3e8ff' : 'color:#047857;background:#d1fae5';
      return `<tr><td style="text-align:center;color:#94a3b8;font-size:11px">${i + 1}</td><td><span style="display:inline-block;padding:2px 7px;border-radius:4px;font-weight:800;font-size:11px;${tradeColor}">${item['거래유형']}</span></td><td style="font-weight:700">${item['동'] || '-'} <span style="color:#94a3b8;font-weight:400">${floor}</span></td><td>${areaCell}</td><td style="font-weight:900;font-size:14px">${item['가격'] || '-'}</td><td>${item['방향'] || '-'}</td><td>${bath}</td><td style="color:#475569;font-size:11px">${특징}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>매물 추천리스트</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;font-size:12px;color:#1e293b;background:#fff;padding:28px 32px}.doc-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #0f172a}.doc-header h1{font-size:18px;font-weight:900;color:#0f172a}.doc-header .meta{font-size:11px;color:#64748b;text-align:right;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:12px}thead tr{background:#f1f5f9;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1}thead th{padding:7px 8px;font-weight:700;font-size:11px;color:#475569;text-align:left;white-space:nowrap}tbody tr{border-bottom:1px solid #e2e8f0}tbody tr:nth-child(even){background:#f8fafc}tbody td{padding:8px;vertical-align:middle;line-height:1.4}.doc-footer{margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}.print-btn{position:fixed;top:20px;right:20px;padding:9px 18px;background:#4f46e5;color:white;border:none;border-radius:6px;font-weight:bold;font-size:13px;cursor:pointer}@media print{.print-btn{display:none}body{padding:16px 20px}thead tr{background:#f1f5f9!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}tbody tr:nth-child(even){background:#f8fafc!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><button class="print-btn" onclick="window.print()">🖨️ 인쇄</button><div class="doc-header"><h1>매물 추천리스트</h1><div class="meta">총 ${selectedArticlesList.value.length}건<br>출력일: ${today}</div></div><table><thead><tr><th style="width:40px;text-align:center">No.</th><th style="width:60px">거래</th><th style="width:120px">동 / 층</th><th style="width:80px">면적</th><th style="width:250px">가격</th><th style="width:60px">방향</th><th style="width:50px">방수</th><th>특징</th></tr></thead><tbody>${rows}</tbody></table><div class="doc-footer">※ 가격 및 매물 현황은 변동될 수 있습니다.</div></body></html>`;

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
    Object.keys(mainFilters.value).forEach(k => (mainFilters.value as any)[k] = 'all');
    Object.keys(proFilters.value).forEach(k => (proFilters.value as any)[k] = false);
    priceFilters.value.priceMin = null; priceFilters.value.priceMax = null;
    priceFilters.value.rentMin = null; priceFilters.value.rentMax = null;
    priceFilters.value.excludeSeango = false;
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
    selectedArticleIds, isPrintModalOpen,
    toggleArticleSelection, isSelectedArticle, toggleAllSelection, clearSelectedArticles,
    selectedArticlesList, isAllSelected, isIndeterminate, printSelection, copySelection, copyToast,
    doSearch, doScrape, selectOptions, summaryStats, rankStats,
    sortedRankResults, filteredArticles, formatArea, formatDate, toggleSort, resetSort, resetFilters,
    openRealtorModal, supplyAreaToPyung,
    activeQuickFilter, NEGLECT_DAYS,
    realtorRanking, // ✅
  };
}
