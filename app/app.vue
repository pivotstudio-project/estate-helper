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
  formatDate,
  toggleSort,
  resetSort,
  resetFilters,
  openRealtorModal,
  cleanRealtorName,
  getUniqueRealtors,
  selectedArticleIds,
  isPrintModalOpen,
  showRealtorInPrint,
  toggleArticleSelection,
  isSelectedArticle,
  toggleAllSelection,
  clearSelectedArticles,
  selectedArticlesList,
  sortedSelectedArticlesList,
  recommendSortCol,
  recommendSortAsc,
  toggleRecommendSort,
  isAllSelected,
  isIndeterminate,
  printSelection,
  copySelection,
  copyToast,
  activeQuickFilter,
  NEGLECT_DAYS,
  supplyAreaToPyung,
  realtorRanking
} = useEstate();

const displayCols = computed(() => {
  const arr = Array.isArray(COLS) ? COLS : (COLS.value || []);
  return arr.filter((c: string) => c !== '층구분' && c !== '공급면적' && c !== '특징');
});

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
      :realtor-ranking="realtorRanking"
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

          <!-- 순위 확인 탭 -->
          <UiTabsContent value="rank" class="h-full m-0 outline-none">
            <div class="h-full flex flex-col gap-4 p-6 pt-0 overflow-hidden">

              <!-- 퀵 필터 박스 3개 -->
              <div class="grid grid-cols-3 gap-4 flex-none">

                <!-- 즉시 확인 -->
                <button
                  :class="[
                    'p-4 rounded-md border text-left transition-all',
                    activeQuickFilter === 'urgent'
                      ? 'bg-red-500 border-red-500 text-white shadow-md'
                      : 'bg-white border-slate-100 shadow-sm hover:border-red-300 hover:bg-red-50'
                  ]"
                  @click="activeQuickFilter = activeQuickFilter === 'urgent' ? null : 'urgent'"
                >
                  <div :class="['text-sm font-bold', activeQuickFilter === 'urgent' ? 'text-red-100' : 'text-slate-600']">
                    🚨 즉시 확인 필요
                  </div>
                  <div :class="['text-2xl font-extrabold mt-1', activeQuickFilter === 'urgent' ? 'text-white' : 'text-red-600']">
                    {{ rankStats.urgentCnt }}건
                  </div>
                  <div :class="['text-xs mt-1', activeQuickFilter === 'urgent' ? 'text-red-100' : 'text-slate-400']">
                    우리 매물 중 5위 이하
                  </div>
                </button>

                <!-- 장기 방치 -->
                <button
                  :class="[
                    'p-4 rounded-md border text-left transition-all',
                    activeQuickFilter === 'neglected'
                      ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                      : 'bg-white border-slate-100 shadow-sm hover:border-amber-300 hover:bg-amber-50'
                  ]"
                  @click="activeQuickFilter = activeQuickFilter === 'neglected' ? null : 'neglected'"
                >
                  <div :class="['text-sm font-bold', activeQuickFilter === 'neglected' ? 'text-amber-100' : 'text-slate-600']">
                    📅 장기 방치 매물
                  </div>
                  <div :class="['text-2xl font-extrabold mt-1', activeQuickFilter === 'neglected' ? 'text-white' : 'text-amber-600']">
                    {{ rankStats.neglectedCnt }}건
                  </div>
                  <div :class="['text-xs mt-1', activeQuickFilter === 'neglected' ? 'text-amber-100' : 'text-slate-400']">
                    우리 매물 중 {{ NEGLECT_DAYS }}일 이상 미확인
                  </div>
                </button>

                <!-- 안정권 -->
                <button
                  :class="[
                    'p-4 rounded-md border text-left transition-all',
                    activeQuickFilter === 'safe'
                      ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                      : 'bg-white border-slate-100 shadow-sm hover:border-blue-300 hover:bg-blue-50'
                  ]"
                  @click="activeQuickFilter = activeQuickFilter === 'safe' ? null : 'safe'"
                >
                  <div :class="['text-sm font-bold', activeQuickFilter === 'safe' ? 'text-blue-100' : 'text-slate-600']">
                    ✅ 안정권
                  </div>
                  <div :class="['text-2xl font-extrabold mt-1', activeQuickFilter === 'safe' ? 'text-white' : 'text-blue-600']">
                    {{ rankStats.safeCnt }}건
                  </div>
                  <div :class="['text-xs mt-1', activeQuickFilter === 'safe' ? 'text-blue-100' : 'text-slate-400']">
                    우리 매물 중 2위 이내
                  </div>
                </button>

              </div>

              <p class="text-sm text-slate-500">* 박스를 클릭하시면 필터링이 됩니다.</p>

              <div class="flex items-center justify-between gap-4 flex-none">
                <span class="text-sm font-bold text-slate-600">
                  <strong class="text-blue-600 font-extrabold">{{ sortedRankResults.length }}건</strong> / {{ articleResults.length }}건
                  <span v-if="activeQuickFilter" class="ml-2 text-xs text-slate-400">(필터 적용 중 — 박스 재클릭 시 해제)</span>
                </span>
                <div class="flex items-center gap-2 flex-none">
                  <UiButton
                    v-if="activeQuickFilter"
                    size="sm"
                    variant="outline"
                    class="h-8 border-slate-200 rounded-md font-bold text-sm text-slate-600 hover:bg-slate-100"
                    @click="activeQuickFilter = null"
                  >
                    필터 해제
                  </UiButton>
                  <UiButton
                    :disabled="!sortCol"
                    size="sm"
                    variant="outline"
                    class="h-8 border-slate-200 rounded-md font-bold text-sm"
                    :class="sortCol ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-300' : 'text-slate-300 bg-slate-50 cursor-not-allowed'"
                    @click="resetSort"
                  >
                    정렬 초기화
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
                        !r._dynamicRanks || r._dynamicRanks.length === 0
                          ? 'bg-slate-50/50 opacity-60'
                          : r._dynamicRanks.some((rk: any) => rk.rank >= 5)
                            ? 'bg-red-500/15 hover:bg-red-500/25 font-semibold'
                            : r._dynamicRanks.some((rk: any) => rk.rank >= 3)
                              ? 'bg-amber-400/15 hover:bg-amber-400/25 font-semibold'
                              : 'bg-blue-500/10 hover:bg-blue-500/20',
                        'border-b border-slate-100 transition-colors'
                      ]"
                  >
                    <td class="p-3 font-medium text-base text-slate-900">{{ r['동'] || '-' }}</td>
                    <td class="p-3 text-base text-slate-600">{{ r['층'] || '-' }}{{ r['총층수'] ? `/${r['총층수']}` : '' }}</td>
                    <td class="p-3 text-base text-slate-600">{{ r['총층수'] ? `${r['총층수']}층` : '-' }}</td>
                    <td class="p-3 text-base font-semibold text-slate-800">{{ formatArea(r['전용면적']) }}</td>
                    <td class="p-3 text-base text-slate-600">{{ r['면적구분'] || '-' }}</td>
                    <td class="p-3">
                      <UiBadge
                        :class="{
                            'bg-blue-100 text-blue-700': r['거래유형'] === '매매',
                            'bg-purple-100 text-purple-700': r['거래유형'] === '전세',
                            'bg-emerald-100 text-emerald-700': r['거래유형'] === '월세'
                          }"
                        class="font-bold text-base px-2.5 py-0.5 rounded-md"
                      >
                        {{ r['거래유형'] || '-' }}
                      </UiBadge>
                    </td>
                    <!-- 가격 + 특징 원문 -->
                    <td class="p-3">
                      <div class="font-bold text-base text-slate-900 leading-none">{{ r['가격'] || '-' }}</div>
                      <div v-if="r['특징']" class="text-xs text-slate-400 mt-1 font-normal whitespace-normal max-w-[200px]">
                        {{ r['특징'] }}
                      </div>
                    </td>
                    <td class="p-3">
                      <UiButton
                        size="sm"
                        class="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 font-bold text-base px-2.5 py-1 rounded-md"
                        @click="openRealtorModal(r['중개사목록'])"
                      >
                        총 {{ r['중개사수'] || 0 }}곳
                      </UiButton>
                    </td>

                    <td v-for="cp in dynamicCPs" :key="cp" class="p-3 align-middle border-l border-slate-100">
                      <div v-if="r._dynamicCpStatus?.[cp]" class="flex flex-col gap-0.5">
                        <div class="flex items-center gap-1.5">
                            <span :class="r._dynamicCpStatus[cp].rank >= 5 ? 'text-red-600 font-black text-base' : r._dynamicCpStatus[cp].rank >= 3 ? 'text-amber-500 font-black text-base' : 'text-blue-600 font-black text-base'">
                              {{ r._dynamicCpStatus[cp].rank }}위
                            </span>
                          <UiBadge v-if="r._dynamicCpStatus[cp].is_owner" class="bg-red-100 text-red-700 font-bold text-[10px] px-1 rounded">집주인</UiBadge>
                          <UiBadge v-if="r._dynamicCpStatus[cp].is_site" class="bg-emerald-100 text-emerald-700 font-bold text-[10px] px-1 rounded">현장</UiBadge>
                        </div>
                        <div class="text-[12px] text-slate-400 font-medium">확인: {{ formatDate(r._dynamicCpStatus[cp].date) }}</div>
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

          <!-- 매물 확인 탭 -->
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
                  <template v-if="selectedArticleIds.length > 0">
                    <UiButton
                      size="sm"
                      variant="outline"
                      class="h-8 border-slate-200 rounded-md font-bold text-sm text-slate-600 hover:bg-slate-100"
                      @click="clearSelectedArticles"
                    >
                      선택 해제
                    </UiButton>
                    <UiButton
                      size="sm"
                      class="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-md px-3 border border-transparent shadow-xs transition-colors"
                      @click="isPrintModalOpen = true"
                    >
                      선택 매물 보기 ({{ selectedArticleIds.length }}건)
                    </UiButton>
                  </template>
                  <UiButton
                    :disabled="!sortCol"
                    size="sm"
                    variant="outline"
                    class="h-8 border-slate-200 rounded-md font-bold text-sm"
                    :class="sortCol ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-300' : 'text-slate-300 bg-slate-50 cursor-not-allowed'"
                    @click="resetSort"
                  >
                    정렬 초기화
                  </UiButton>
                </div>
              </div>

              <div class="flex-1 min-h-0 border border-slate-200 rounded-md bg-white shadow-sm overflow-auto">
                <table class="w-full text-left border-collapse whitespace-nowrap">
                  <thead class="bg-slate-100 sticky top-0 z-10 border-b border-slate-200 select-none">
                  <tr>
                    <th class="p-3 text-center w-12 border-r border-slate-200">
                      <UiCheckbox
                        :model-value="isAllSelected"
                        :indeterminate="isIndeterminate"
                        @update:modelValue="toggleAllSelection"
                      />
                    </th>
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
                        isSelectedArticle(row.순번)
                          ? 'bg-indigo-500/10 hover:bg-indigo-500/15 outline outline-1 outline-indigo-300'
                          : (row._중개사명목록 || '').includes(MY_REALTOR)
                            ? 'bg-blue-500/10 hover:bg-blue-500/20 font-medium text-blue-900'
                            : 'hover:bg-slate-50/80',
                        'border-b border-slate-100 transition-colors'
                      ]"
                  >
                    <td class="p-3 text-center align-middle border-r border-slate-100">
                      <UiCheckbox
                        :model-value="isSelectedArticle(row.순번)"
                        @update:modelValue="() => toggleArticleSelection(row.순번)"
                      />
                    </td>
                    <td v-for="c in displayCols" :key="c" class="p-3 text-base align-middle">
                      <template v-if="c === '중개사수'">
                        <UiButton
                          size="sm"
                          class="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 font-bold text-base px-2.5 py-1 rounded-md"
                          @click="openRealtorModal(row.중개사목록)"
                        >
                          {{ row[c] || 0 }}곳
                        </UiButton>
                      </template>
                      <template v-else-if="c === '거래유형'">
                        <UiBadge
                          :class="{
                              'bg-blue-100 text-blue-700': row[c] === '매매',
                              'bg-purple-100 text-purple-700': row[c] === '전세',
                              'bg-emerald-100 text-emerald-700': row[c] === '월세'
                            }"
                          class="font-bold text-base px-2.5 py-0.5 rounded-md"
                        >
                          {{ row[c] }}
                        </UiBadge>
                      </template>
                      <template v-else-if="c === '전용면적'">
                        {{ formatArea(row[c]) }}
                      </template>
                      <template v-else-if="c === '층'">
                        <span>{{ row['층'] || '-' }}{{ row['총층수'] ? `/${row['총층수']}` : '' }}</span>
                      </template>
                      <template v-else-if="c === '총층수'">
                        <span>{{ row['총층수'] ? `${row['총층수']}층` : '-' }}</span>
                      </template>
                      <!-- 가격 셀 - 특징 원문 -->
                      <template v-else-if="c === '가격'">
                        <div class="flex flex-col gap-1">
                          <div class="flex flex-row items-center gap-1.5 flex-wrap">
                            <span class="font-bold text-slate-900 text-base leading-none">{{ row[c] ?? '' }}</span>
                            <template v-if="row['특징태그']">
                              <span
                                v-for="feat in row['특징태그'].split(',')"
                                :key="feat"
                                class="text-sm font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200/50 shadow-2xs"
                              >
                                {{ feat.trim() }}
                              </span>
                            </template>
                          </div>
                          <div v-if="row['특징']" class="text-sm text-slate-500 font-normal whitespace-normal max-w-[280px]">
                            {{ row['특징'] }}
                          </div>
                        </div>
                      </template>
                      <template v-else-if="c === '중개사목록'">
                        <div class="flex items-center gap-1.5 flex-wrap max-w-[280px] whitespace-normal">
                            <span
                              v-for="(r, idx) in getUniqueRealtors(row['중개사목록'])"
                              :key="idx"
                              :class="r.name.includes(MY_REALTOR) ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-600 border-slate-200'"
                              class="text-xs font-bold px-1.5 py-0.5 rounded border shadow-xs"
                            >
                              {{ cleanRealtorName(r.name) }}
                            </span>
                        </div>
                      </template>
                      <template v-else-if="c === '확인일'">
                        <span class="whitespace-nowrap">{{ row[c] ?? '' }}</span>
                      </template>
                      <template v-else>
                        <span>{{ row[c] ?? '' }}</span>
                      </template>
                    </td>
                  </tr>
                  <tr v-if="!filteredArticles.length">
                    <td :colspan="displayCols.length + 1" class="p-10 text-center text-base text-slate-400">
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

    <!-- 중개사 목록 모달 -->
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
                    <span
                      :class="r.name.includes(MY_REALTOR) ? 'text-blue-600 font-bold' : 'text-slate-800 font-medium'"
                      class="text-base truncate max-w-[300px]"
                    >
                      {{ r.name }}
                    </span>
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

    <!-- ✅ 선택 매물 모아보기 모달 — 너비 확대 + 중개사 컬럼 추가 -->
    <UiDialog v-model:open="isPrintModalOpen">
      <UiDialogContent class="!max-w-[70vw] w-full bg-white p-0 rounded-md shadow-xl border border-slate-100 max-h-[88vh] flex flex-col overflow-hidden">

        <div class="flex justify-between items-center border-b border-slate-100 px-6 py-4 flex-none">
          <div>
            <UiDialogTitle class="text-base font-bold text-slate-900">
              매물 추천리스트
            </UiDialogTitle>
            <p class="text-xs text-slate-400 mt-0.5 font-medium">총 {{ selectedArticleIds.length }}건 선택됨</p>
          </div>
          <div class="flex items-center gap-2 mr-4">
            <label class="flex items-center gap-1.5 mr-1 cursor-pointer select-none">
              <UiCheckbox v-model="showRealtorInPrint" class="w-4 h-4 border-slate-300 rounded text-indigo-600" />
              <span class="text-sm font-bold text-slate-700">인쇄 시 중개사 노출</span>
            </label>
            <UiButton
              variant="outline"
              size="sm"
              class="h-8 text-sm font-bold border-slate-200"
              @click="clearSelectedArticles(); isPrintModalOpen = false;"
            >
              선택 초기화
            </UiButton>
            <UiButton
              variant="outline"
              size="sm"
              class="h-8 text-sm font-bold border-slate-200 text-slate-700"
              @click="copySelection"
            >
              📋 문자용 복사
            </UiButton>
            <UiButton
              size="sm"
              class="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              @click="printSelection"
            >
              🖨️ 인쇄하기
            </UiButton>
          </div>
        </div>

        <div id="print-area" class="flex-1 overflow-auto">
          <table class="w-full text-left border-collapse">
            <thead class="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
            <tr>
              <th class="px-4 py-2.5 text-xs font-bold text-slate-500 w-10 text-center">No.</th>
              <th class="px-4 py-2.5 text-xs font-bold text-slate-500 w-20">거래</th>
              <th class="px-4 py-2.5 text-xs font-bold text-slate-500 w-36">동 / 층</th>
              <th
                class="px-4 py-2.5 text-xs font-bold text-slate-500 w-32 cursor-pointer select-none hover:text-slate-700"
                @click="toggleRecommendSort('면적')"
              >
                면적<span v-if="recommendSortCol === '면적'" class="ml-0.5 text-indigo-600">{{ recommendSortAsc ? '▲' : '▼' }}</span>
              </th>
              <th
                class="px-4 py-2.5 text-xs font-bold text-slate-500 w-56 cursor-pointer select-none hover:text-slate-700"
                @click="toggleRecommendSort('가격')"
              >
                가격<span v-if="recommendSortCol === '가격'" class="ml-0.5 text-indigo-600">{{ recommendSortAsc ? '▲' : '▼' }}</span>
              </th>
              <th class="px-4 py-2.5 text-xs font-bold text-slate-500 w-20">방향</th>
              <th class="px-4 py-2.5 text-xs font-bold text-slate-500 w-16">방수</th>
              <th class="px-4 py-2.5 text-xs font-bold text-slate-500">특징</th>
              <!-- ✅ 중개사 컬럼 추가 -->
              <th class="px-4 py-2.5 text-xs font-bold text-slate-500">중개사</th>
            </tr>
            </thead>
            <tbody>
            <tr
              v-for="(item, i) in sortedSelectedArticlesList"
              :key="i"
              class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
            >
              <td class="px-4 py-3 text-xs text-slate-400 font-bold text-center">{{ i + 1 }}</td>
              <td class="px-4 py-3">
                  <span
                    class="inline-block text-xs font-black px-2 py-0.5 rounded whitespace-nowrap"
                    :class="{
                      'bg-blue-100 text-blue-700': item['거래유형'] === '매매',
                      'bg-purple-100 text-purple-700': item['거래유형'] === '전세',
                      'bg-emerald-100 text-emerald-700': item['거래유형'] === '월세'
                    }"
                  >{{ item['거래유형'] }}</span>
              </td>
              <td class="px-4 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap">
                {{ item['동'] }}
                <span class="text-slate-400 font-normal ml-0.5">{{ item['층'] }}{{ item['총층수'] ? `/${item['총층수']}층` : '' }}</span>
              </td>
              <!-- ✅ 면적: 면적구분 + 공급면적 기준 평수 -->
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="text-sm font-bold text-slate-800">{{ item['면적구분'] || '' }}</span>
                <span class="text-xs text-slate-400 ml-1">{{ supplyAreaToPyung(item['공급면적']) }}</span>
              </td>
              <td class="px-4 py-3 text-sm font-black text-slate-900 whitespace-nowrap">{{ item['가격'] }}</td>
              <td class="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{{ item['방향'] || '-' }}</td>
              <td class="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{{ item['방수'] ? `${String(item['방수']).replace(/[^0-9]/g, '')}개` : '-' }}</td>
              <!-- 특징 원문 -->
              <td class="px-4 py-3">
                <div class="text-xs text-slate-600 whitespace-normal max-w-[200px]">
                  {{ item['특징'] || '-' }}
                </div>
              </td>
              <!-- ✅ 중개사 목록 셀 (복사 제외 / 인쇄는 '중개사 노출' 체크 시 포함) -->
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1 max-w-[200px]">
                  <span
                    v-for="(r, ri) in getUniqueRealtors(item['중개사목록'])"
                    :key="ri"
                    :class="r.name.includes(MY_REALTOR) ? 'bg-blue-100 text-blue-700 border-blue-200 font-bold' : 'bg-slate-100 text-slate-600 border-slate-200'"
                    class="w-auto text-xs px-1.5 py-0.5 rounded border whitespace-nowrap"
                  >
                    {{ cleanRealtorName(r.name) }}
                  </span>
                </div>
              </td>
            </tr>
            <tr v-if="!selectedArticlesList.length">
              <td colspan="9" class="px-4 py-12 text-center text-sm text-slate-400">
                선택된 매물이 없습니다.
              </td>
            </tr>
            </tbody>
          </table>
        </div>

      </UiDialogContent>
    </UiDialog>

    <!-- 복사 완료 토스트 -->
    <Transition name="toast">
      <div
        v-if="copyToast"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-xl pointer-events-none"
      >
        📋 클립보드에 복사되었습니다
      </div>
    </Transition>

  </UiTabs>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}
</style>
