<script setup lang="ts">
import { computed } from 'vue';
import { ChevronUp, ChevronDown, ChevronsUpDown } from '@lucide/vue';
import { useEstate } from '@/composables/useEstate';

const {
  query,
  complexList,
  selectedComplexNo,
  isLoading,
  statusBannerMessage,
  showStatusBanner,
  activeTab,
  complexName,
  articleResults,
  isPyung,
  isModalOpen,
  modalRealtors,
  proFilters,
  mainFilters,
  priceFilters,
  sortCol,
  sortAsc,
  MY_REALTOR,
  realtorOptions,
  dynamicCPs,
  COLS,
  doSearch,
  doScrape,
  selectOptions,
  summaryStats,
  rankStats,
  sortedRankResults,
  filteredArticles,
  formatArea,
  toggleSort,
  resetSort,
  resetFilters,
  openRealtorModal
} = useEstate();

const displayCols = computed(() => {
  const arr = Array.isArray(COLS) ? COLS : (COLS.value || []);
  return arr.filter((c: string) => c !== '층구분' && c !== '공급면적' && c !== '특징');
});

// ✅ RANK_COLS를 동적으로 생성하도록 변경
const RANK_COLS = computed(() => {
  return ['동', '층', '총층수', '전용면적', '면적구분', '거래유형', '가격', '경쟁사', ...dynamicCPs.value];
});
</script>

<template>
  <UiTabs v-model="activeTab" class="h-screen flex flex-row bg-slate-50 text-slate-900 overflow-hidden">

    <FilterSection
      v-model:mainFilters="mainFilters"
      v-model:priceFilters="priceFilters"
      v-model:proFilters="proFilters"
      :active-tab="activeTab"
      :select-options="selectOptions"
      @reset="resetFilters"
    />

    <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div class="max-w-[1600px] mx-auto w-full h-full flex flex-col overflow-hidden relative">

        <header class="flex-none px-6 py-4 space-y-3">
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <h1 class="text-lg font-black tracking-tight">부동산 통합 모니터링</h1>
              <UiSelect v-model="MY_REALTOR">
                <UiSelectTrigger class="h-8 bg-white border-slate-200 text-sm font-semibold w-48">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectGroup>
                    <UiSelectItem v-for="opt in realtorOptions" :key="opt" :value="opt">
                      {{ opt }}
                    </UiSelectItem>
                  </UiSelectGroup>
                </UiSelectContent>
              </UiSelect>
            </div>
            <UiTabsList class="grid grid-cols-2 w-[260px] bg-slate-100 p-1 rounded-md h-10">
              <UiTabsTrigger value="rank" class="font-bold text-sm rounded-md data-[state=active]:bg-white data-[state=active]:text-blue-600">
                순위 확인
              </UiTabsTrigger>
              <UiTabsTrigger value="listing" class="font-bold text-sm rounded-md data-[state=active]:bg-white data-[state=active]:text-blue-600">
                매물 확인
              </UiTabsTrigger>
            </UiTabsList>
          </div>

          <SearchSection
            v-model:query="query"
            v-model:selectedComplexNo="selectedComplexNo"
            :complex-list="complexList"
            :is-loading="isLoading"
            @search="doSearch"
            @scrape="doScrape"
          />

          <div class="min-h-[36px]">
            <div v-if="showStatusBanner" class="p-2.5 text-center text-sm font-bold bg-blue-50 text-blue-700 border border-blue-100 rounded-md animate-pulse">
              {{ statusBannerMessage }}
            </div>
          </div>
        </header>

        <div class="flex-1 overflow-hidden relative">

          <UiTabsContent value="rank" class="h-full m-0 outline-none">
            <div class="h-full flex flex-col gap-4 p-6 pt-0 overflow-hidden">
              <div class="grid grid-cols-3 gap-4 flex-none">
                <UiCard class="p-4 bg-white shadow-sm border-slate-100 rounded-md">
                  <div class="text-sm font-bold text-slate-600">총 전수 조사 매물</div>
                  <div class="text-2xl font-extrabold mt-1">{{ rankStats.total }}개</div>
                </UiCard>
                <UiCard class="p-4 bg-white shadow-sm border-slate-100 rounded-md">
                  <div class="text-sm font-bold text-slate-600">매물 중 끌올 필요 (2위 밖)</div>
                  <div class="text-2xl font-extrabold text-red-600 mt-1">{{ rankStats.warnCnt }}건</div>
                </UiCard>
                <UiCard class="p-4 bg-white shadow-sm border-slate-100 rounded-md">
                  <div class="text-sm font-bold text-slate-600">매물 중 안정권 (2위 이내)</div>
                  <div class="text-2xl font-extrabold text-blue-600 mt-1">{{ rankStats.okCnt }}건</div>
                </UiCard>
              </div>

              <div class="flex items-center justify-between gap-4 flex-none">
                <span class="text-sm font-bold text-slate-600">
                  <strong class="text-blue-600 font-extrabold">{{ sortedRankResults.length }}건</strong> / {{ articleResults.length }}건
                </span>
                <div class="flex items-center gap-2 flex-none">
                  <UiButton :disabled="!sortCol" size="sm" variant="outline" class="h-8 border-slate-200 rounded-md font-bold text-sm" :class="sortCol ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-300' : 'text-slate-300 bg-slate-50 cursor-not-allowed'" @click="resetSort">
                    정렬 초기화
                  </UiButton>
                  <UiButton size="sm" variant="secondary" class="bg-slate-800 hover:bg-slate-900 text-white rounded-md px-3 py-1.5 font-bold text-sm" @click="isPyung = !isPyung">
                    단위: {{ isPyung ? '평' : '㎡' }}
                  </UiButton>
                </div>
              </div>

              <div class="flex-1 min-h-0 border border-slate-200 rounded-md bg-white shadow-sm overflow-auto">
                <table class="w-full text-left border-collapse whitespace-nowrap">
                  <thead class="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 select-none">
                  <tr>
                    <th
                      v-for="c in RANK_COLS"
                      :key="c"
                      :class="dynamicCPs.includes(c)
                          ? 'p-3 text-lg font-bold text-slate-700'
                          : 'p-3 text-lg font-bold text-slate-700 cursor-pointer hover:bg-slate-200'"
                      @click="toggleSort(c)"
                    >
                        <span class="inline-flex items-center gap-1">
                          {{ c }}
                          <template v-if="!dynamicCPs.includes(c)">
                            <ChevronUp
                              v-if="(sortCol === c || (c === '경쟁사' && sortCol === '중개사수')) && sortAsc"
                              class="w-3.5 h-3.5 text-blue-500"
                            />
                            <ChevronDown
                              v-else-if="(sortCol === c || (c === '경쟁사' && sortCol === '중개사수')) && !sortAsc"
                              class="w-3.5 h-3.5 text-blue-500"
                            />
                            <ChevronsUpDown
                              v-else
                              class="w-3.5 h-3.5 text-slate-400"
                            />
                          </template>
                        </span>
                    </th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr
                    v-for="(r, idx) in sortedRankResults"
                    :key="idx"
                    :class="[
                        !r._dynamicRanks || r._dynamicRanks.length === 0 ? 'bg-slate-50/50 opacity-75' :
                        r._dynamicRanks.some((rk: any) => rk.rank > 2) ? 'bg-red-400/10 hover:bg-red-400/20 font-semibold' : 'bg-blue-500/10 hover:bg-blue-500/20',
                        'border-b border-slate-100 transition-colors'
                      ]"
                  >
                    <td class="p-3 font-medium text-base text-slate-900">{{ r['동'] || '-' }}</td>
                    <td class="p-3 text-base text-slate-600">{{ r['층'] || '-' }}</td>
                    <td class="p-3 text-base text-slate-600">{{ r['총층수'] || '-' }}</td>
                    <td class="p-3 text-base font-semibold text-slate-800">{{ formatArea(r['전용면적']) }}</td>
                    <td class="p-3 text-base text-slate-600">{{ r['면적구분'] || '-' }}</td>
                    <td class="p-3">
                      <UiBadge :class="{'bg-blue-100 text-blue-700': r['거래유형'] === '매매', 'bg-purple-100 text-purple-700': r['거래유형'] === '전세', 'bg-emerald-100 text-emerald-700': r['거래유형'] === '월세'}" class="font-bold text-base px-2.5 py-0.5 rounded-md">
                        {{ r['거래유형'] || '-' }}
                      </UiBadge>
                    </td>
                    <td class="p-3 font-bold text-base text-slate-900">{{ r['가격'] || '-' }}</td>
                    <td class="p-3">
                      <UiButton size="sm" class="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 font-bold text-base px-2.5 py-1 rounded-md" @click="openRealtorModal(r['중개사목록'])">
                        총 {{ r['중개사수'] || 0 }}곳
                      </UiButton>
                    </td>

                    <td v-for="cp in dynamicCPs" :key="cp" class="p-3 align-middle border-l border-slate-100">
                      <div v-if="r._dynamicCpStatus?.[cp]" class="flex flex-col gap-0.5">
                        <div class="flex items-center gap-1.5">
                          <span :class="r._dynamicCpStatus[cp].rank > 2 ? 'text-red-600 font-black text-base' : 'text-blue-600 font-black text-base'">{{ r._dynamicCpStatus[cp].rank }}위</span>
                          <UiBadge v-if="r._dynamicCpStatus[cp].is_owner" class="bg-red-100 text-red-700 font-bold text-[10px] px-1 rounded">집주인</UiBadge>
                          <UiBadge v-if="r._dynamicCpStatus[cp].is_site" class="bg-emerald-100 text-emerald-700 font-bold text-[10px] px-1 rounded">현장</UiBadge>
                        </div>
                        <div class="text-[12px] text-slate-400 font-medium">확인: {{ r._dynamicCpStatus[cp].date || '-' }}</div>
                      </div>
                      <span v-else class="text-sm text-slate-400 font-semibold">미등록</span>
                    </td>
                  </tr>
                  <tr v-if="!sortedRankResults.length">
                    <td :colspan="RANK_COLS.length" class="p-10 text-center text-base text-slate-400">
                      조건 필터에 부합하는 매물이 발견되지 않았습니다.
                    </td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </UiTabsContent>

          <UiTabsContent value="listing" class="h-full m-0 outline-none">
            <div class="h-full flex flex-col gap-4 p-6 pt-0 overflow-hidden">
              <div class="grid grid-cols-4 gap-4 flex-none">
                <UiCard class="p-4 bg-white shadow-sm border-slate-100 rounded-md">
                  <div class="text-sm font-bold text-slate-600">총 단지 매물 수</div>
                  <div class="text-2xl font-extrabold mt-1 text-slate-800">{{ summaryStats.total }}개</div>
                </UiCard>
                <UiCard class="p-4 bg-white shadow-sm border-slate-100 rounded-md">
                  <div class="text-sm font-bold text-slate-600">매매 매물</div>
                  <div class="text-2xl font-extrabold text-blue-600 mt-1">{{ summaryStats.byTrade['매매'] || 0 }}건</div>
                </UiCard>
                <UiCard class="p-4 bg-white shadow-sm border-slate-100 rounded-md">
                  <div class="text-sm font-bold text-slate-600">전세 매물</div>
                  <div class="text-2xl font-extrabold text-purple-600 mt-1">{{ summaryStats.byTrade['전세'] || 0 }}건</div>
                </UiCard>
                <UiCard class="p-4 bg-white shadow-sm border-slate-100 rounded-md">
                  <div class="text-sm font-bold text-slate-600">월세 매물</div>
                  <div class="text-2xl font-extrabold text-emerald-600 mt-1">{{ summaryStats.byTrade['월세'] || 0 }}건</div>
                </UiCard>
              </div>

              <div class="flex items-center justify-between gap-4 flex-none">
                <span class="text-sm font-bold text-slate-600">
                  <strong class="text-blue-600 font-extrabold">{{ filteredArticles.length }}건</strong> / {{ articleResults.length }}건
                </span>
                <div class="flex items-center gap-2 flex-none">
                  <UiButton :disabled="!sortCol" size="sm" variant="outline" class="h-8 border-slate-200 rounded-md font-bold text-sm" :class="sortCol ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-300' : 'text-slate-300 bg-slate-50 cursor-not-allowed'" @click="resetSort">
                    정렬 초기화
                  </UiButton>
                  <UiButton size="sm" variant="secondary" class="bg-slate-800 hover:bg-slate-900 text-white rounded-md px-3 py-1.5 font-bold text-sm" @click="isPyung = !isPyung">
                    단위: {{ isPyung ? '평' : '㎡' }}
                  </UiButton>
                </div>
              </div>

              <div class="flex-1 min-h-0 border border-slate-200 rounded-md bg-white shadow-sm overflow-auto">
                <table class="w-full text-left border-collapse whitespace-nowrap">
                  <thead class="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 select-none">
                  <tr>
                    <th
                      v-for="c in displayCols"
                      :key="c"
                      class="p-3 text-lg font-bold text-slate-700 cursor-pointer hover:bg-slate-200"
                      @click="toggleSort(c)"
                    >
                        <span class="inline-flex items-center gap-1">
                          {{ c }}
                          <ChevronUp v-if="sortCol === c && sortAsc" class="w-3.5 h-3.5 text-blue-500" />
                          <ChevronDown v-else-if="sortCol === c && !sortAsc" class="w-3.5 h-3.5 text-blue-500" />
                          <ChevronsUpDown v-else class="w-3.5 h-3.5 text-slate-400" />
                        </span>
                    </th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr
                    v-for="(row, ri) in filteredArticles"
                    :key="ri"
                    :class="[
                        (row._중개사명목록 || '').includes(MY_REALTOR) ? 'bg-blue-500/10 hover:bg-blue-500/20 font-medium text-blue-900' : 'hover:bg-slate-50/80',
                        'border-b border-slate-100 transition-colors'
                      ]"
                  >
                    <td v-for="c in displayCols" :key="c" class="p-3 text-base align-middle">
                      <template v-if="c === '중개사수'">
                        <UiButton size="sm" class="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 font-bold text-base px-2.5 py-1 rounded-md" @click="openRealtorModal(row.중개사목록)">
                          {{ row[c] || 0 }}곳
                        </UiButton>
                      </template>
                      <template v-else-if="c === '거래유형'">
                        <UiBadge :class="{'bg-blue-100 text-blue-700': row[c] === '매매', 'bg-purple-100 text-purple-700': row[c] === '전세', 'bg-emerald-100 text-emerald-700': row[c] === '월세'}" class="font-bold text-base px-2.5 py-0.5 rounded-md">
                          {{ row[c] }}
                        </UiBadge>
                      </template>
                      <template v-else-if="c === '전용면적'">
                        {{ formatArea(row[c]) }}
                      </template>
                      <template v-else-if="c === '가격'">
                        <div class="flex items-center gap-1.5">
                          <span class="font-bold text-slate-900 text-base leading-none">{{ row[c] ?? '' }}</span>
                          <div v-if="row.특징" class="flex flex-row items-center gap-1.5 flex-wrap">
                              <span v-for="feat in row.특징.split(',')" :key="feat" class="text-base font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200/50 shadow-2xs">
                                {{ feat.trim() }}
                              </span>
                          </div>
                        </div>
                      </template>
                      <template v-else>
                        <span>{{ row[c] ?? '' }}</span>
                      </template>
                    </td>
                  </tr>
                  <tr v-if="!filteredArticles.length">
                    <td :colspan="displayCols.length" class="p-10 text-center text-base text-slate-400">
                      조건 필터에 부합하는 매물이 발견되지 않았습니다.
                    </td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </UiTabsContent>

        </div>
      </div>
    </main>

    <UiDialog v-model:open="isModalOpen">
      <UiDialogContent class="!max-w-3xl w-full bg-white p-0 rounded-md shadow-xl border border-slate-100 max-h-[75vh] flex flex-col overflow-hidden">
        <div class="flex justify-between items-center border-b border-slate-100 p-5">
          <UiDialogTitle class="text-base font-bold text-slate-900">공인중개사무소 등록 현황</UiDialogTitle>
        </div>
        <div class="flex-1 overflow-y-auto p-5">
          <div class="space-y-2">
            <div
              v-for="(r, idx) in modalRealtors"
              :key="idx"
              :class="{ 'bg-blue-50 border border-blue-100 rounded-md': r.name.includes(MY_REALTOR) }"
              class="p-3 border-b border-slate-50 flex gap-3 items-center justify-between"
            >
              <div class="flex gap-3 items-start min-w-0">
                <span class="text-base font-bold text-slate-300 w-6 pt-0.5">{{ idx + 1 }}</span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span :class="r.name.includes(MY_REALTOR) ? 'text-blue-600 font-bold' : 'text-slate-800 font-medium'" class="text-base truncate max-w-[300px]">{{ r.name }}</span>
                    <span v-if="r.name.includes(MY_REALTOR)" class="bg-blue-600 text-white font-bold text-base px-2 py-0.5 rounded-md">우리</span>
                    <UiBadge v-if="r.is_owner" class="bg-red-100 text-red-700 font-bold text-base px-2 rounded-md">집주인</UiBadge>
                    <UiBadge v-if="r.is_site" class="bg-emerald-100 text-emerald-700 font-bold text-base px-2 rounded-md">현장</UiBadge>
                  </div>
                  <div v-if="r.date" class="text-base text-slate-400 mt-0.5">확인일자: {{ r.date }} / {{ r.cp }}</div>
                </div>
              </div>
              <div class="flex gap-2 flex-none ml-4">
                <a
                  v-if="r.articleNo"
                  :href="`https://new.land.naver.com/article/${r.articleNo}`"
                  target="_blank"
                  class="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-md text-base font-bold transition-colors shadow-2xs"
                >
                  N 상세
                </a>
                <a
                  v-if="r.cpUrl"
                  :href="r.cpUrl"
                  target="_blank"
                  class="text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-md text-base font-bold transition-colors shadow-2xs"
                >
                  {{ r.cp }} 상세
                </a>
              </div>
            </div>
          </div>
        </div>
      </UiDialogContent>
    </UiDialog>

  </UiTabs>
</template>
