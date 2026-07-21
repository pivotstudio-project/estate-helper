<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{
  selectOptions: any;
  activeTab: string;
  realtorRanking: { name: string; count: number }[];
}>();

const mainFilters = defineModel<any>('mainFilters', { required: true });
const priceFilters = defineModel<any>('priceFilters', { required: true });
const proFilters = defineModel<any>('proFilters', { required: true });

const emit = defineEmits(['reset']);

const cleanRealtorName = (name: string) => {
  if (!name) return '';
  return name.replace(/(부동산)?공인중개사(사무소)?|부동산중개|부동산/g, '').trim();
};

const selectedRankItem = computed(() => {
  if (mainFilters.value.realtor === 'all') return null;
  const idx = props.realtorRanking.findIndex(r => r.name === mainFilters.value.realtor);
  if (idx === -1) return null;
  const item = props.realtorRanking[idx];
  return { rank: idx + 1, shortName: cleanRealtorName(item.name), count: item.count };
});

// 멀티셀렉트 팝오버 열림 상태
const openPopovers = ref({
  trade: false,
  building: false,
  area: false,
  areaType: false,
});

// 멀티셀렉트 토글 헬퍼
const toggleMulti = (field: 'trade' | 'building' | 'area' | 'areaType', value: string) => {
  const arr: string[] = mainFilters.value[field];
  const idx = arr.indexOf(value);
  if (idx === -1) {
    mainFilters.value[field] = [...arr, value];
  } else {
    mainFilters.value[field] = arr.filter((v: string) => v !== value);
  }
};

const isSelected = (field: 'trade' | 'building' | 'area' | 'areaType', value: string) => {
  return mainFilters.value[field].includes(value);
};

// 트리거 라벨 생성
const multiLabel = (field: 'trade' | 'building' | 'area' | 'areaType', placeholder: string) => {
  const arr: string[] = mainFilters.value[field];
  if (!arr.length) return placeholder;
  if (arr.length === 1) return arr[0];
  return `${arr[0]} 외 ${arr.length - 1}`;
};
</script>

<template>
  <aside class="flex-none w-[400px] h-full bg-white border-r border-slate-200 shadow-sm flex flex-col z-30">
    <div class="flex-none px-4 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
      <span class="text-base font-bold text-slate-800">필터</span>
      <UiButton
        variant="outline"
        class="h-8 px-3 text-xs font-bold border-slate-200 text-slate-500 rounded-md hover:bg-slate-100"
        @click="emit('reset')"
      >
        필터 초기화
      </UiButton>
    </div>

    <div class="flex-1 flex flex-col min-h-0 bg-white">
      <div class="flex-1 overflow-y-auto p-5 space-y-6">

        <!-- 빠른 매칭 (listing 탭만) -->
        <div v-if="activeTab === 'listing'" class="space-y-3">
          <span class="text-sm font-black text-blue-800 tracking-wide block uppercase">빠른 매칭</span>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="(label, key) in { exclusiveOther: '타사독점', recent: '3일 내 신규' }"
              :key="key"
              :class="proFilters[key] ? 'bg-blue-600 text-white shadow-sm border-blue-600' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'"
              class="w-full text-center text-sm font-bold px-3 py-2.5 rounded-md transition-all cursor-pointer select-none border truncate"
              @click="proFilters[key] = !proFilters[key]"
            >
              {{ label }}
            </button>
          </div>
        </div>

        <div v-if="activeTab === 'listing'" class="h-px bg-slate-100" />

        <!-- 주요 필터 -->
        <div class="space-y-3">
          <div class="text-sm font-bold text-slate-400 uppercase tracking-widest">주요 필터</div>
          <div class="grid grid-cols-2 gap-3">

            <!-- 거래유형 멀티셀렉트 -->
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">거래유형</UiLabel>
              <UiPopover v-model:open="openPopovers.trade">
                <UiPopoverTrigger as-child>
                  <button
                    class="h-10 w-full bg-slate-50 border border-slate-200 rounded-md px-3 text-sm text-left flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors"
                    :class="mainFilters.trade.length ? 'text-slate-900 font-semibold' : 'text-slate-400'"
                  >
                    <span class="truncate">{{ multiLabel('trade', '전체') }}</span>
                    <svg class="w-4 h-4 text-slate-400 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                </UiPopoverTrigger>
                <UiPopoverContent class="w-48 p-2" align="start">
                  <label
                    v-for="opt in selectOptions.trade"
                    :key="opt"
                    class="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer select-none"
                  >
                    <UiCheckbox
                      :model-value="isSelected('trade', opt)"
                      @update:modelValue="toggleMulti('trade', opt)"
                    />
                    <span class="text-sm text-slate-700">{{ opt }}</span>
                  </label>
                </UiPopoverContent>
              </UiPopover>
            </div>

            <!-- 동 멀티셀렉트 -->
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">동</UiLabel>
              <UiPopover v-model:open="openPopovers.building">
                <UiPopoverTrigger as-child>
                  <button
                    class="h-10 w-full bg-slate-50 border border-slate-200 rounded-md px-3 text-sm text-left flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors"
                    :class="mainFilters.building.length ? 'text-slate-900 font-semibold' : 'text-slate-400'"
                  >
                    <span class="truncate">{{ multiLabel('building', '전체') }}</span>
                    <svg class="w-4 h-4 text-slate-400 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                </UiPopoverTrigger>
                <UiPopoverContent class="w-48 p-2 max-h-64 overflow-y-auto" align="start">
                  <label
                    v-for="opt in selectOptions.building"
                    :key="opt"
                    class="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer select-none"
                  >
                    <UiCheckbox
                      :model-value="isSelected('building', opt)"
                      @update:modelValue="toggleMulti('building', opt)"
                    />
                    <span class="text-sm text-slate-700">{{ opt }}</span>
                  </label>
                </UiPopoverContent>
              </UiPopover>
            </div>

            <!-- 전용면적 멀티셀렉트 -->
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">전용면적</UiLabel>
              <UiPopover v-model:open="openPopovers.area">
                <UiPopoverTrigger as-child>
                  <button
                    class="h-10 w-full bg-slate-50 border border-slate-200 rounded-md px-3 text-sm text-left flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors"
                    :class="mainFilters.area.length ? 'text-slate-900 font-semibold' : 'text-slate-400'"
                  >
                    <span class="truncate">{{ multiLabel('area', '전체') }}</span>
                    <svg class="w-4 h-4 text-slate-400 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                </UiPopoverTrigger>
                <UiPopoverContent class="w-48 p-2 max-h-64 overflow-y-auto" align="start">
                  <div class="space-y-1">
                    <label
                      v-for="opt in selectOptions.area"
                      :key="opt"
                      class="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer select-none"
                    >
                      <UiCheckbox
                        :model-value="isSelected('area', opt)"
                        @update:modelValue="toggleMulti('area', opt)"
                      />
                      <span class="text-sm text-slate-700">{{ opt }}</span>
                    </label>
                  </div>
                </UiPopoverContent>
              </UiPopover>
            </div>

            <!-- 면적구분 멀티셀렉트 -->
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">면적구분</UiLabel>
              <UiPopover v-model:open="openPopovers.areaType">
                <UiPopoverTrigger as-child>
                  <button
                    class="h-10 w-full bg-slate-50 border border-slate-200 rounded-md px-3 text-sm text-left flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors"
                    :class="mainFilters.areaType.length ? 'text-slate-900 font-semibold' : 'text-slate-400'"
                  >
                    <span class="truncate">{{ multiLabel('areaType', '전체') }}</span>
                    <svg class="w-4 h-4 text-slate-400 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                </UiPopoverTrigger>
                <UiPopoverContent class="w-48 p-2 max-h-64 overflow-y-auto" align="start">
                  <div class="space-y-1">
                    <label
                      v-for="opt in selectOptions.areaType"
                      :key="opt"
                      class="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer select-none"
                    >
                      <UiCheckbox
                        :model-value="isSelected('areaType', opt)"
                        @update:modelValue="toggleMulti('areaType', opt)"
                      />
                      <span class="text-sm text-slate-700">{{ opt }}</span>
                    </label>
                  </div>
                </UiPopoverContent>
              </UiPopover>
            </div>

            <!-- 공인중개사무소 (기존 UiSelect 유지) -->
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">공인중개사무소</UiLabel>
              <UiSelect v-model="mainFilters.realtor">
                <UiSelectTrigger class="h-10 w-full bg-slate-50 border-slate-200 rounded-md px-3 text-sm text-left">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectGroup>
                    <UiSelectItem value="all">전체</UiSelectItem>
                    <UiSelectItem v-for="o in selectOptions.realtor" :key="o" :value="o">{{ o }}</UiSelectItem>
                  </UiSelectGroup>
                </UiSelectContent>
              </UiSelect>
            </div>

            <!-- 보유랭킹 (listing 탭만, 기존 유지) -->
            <div v-if="activeTab === 'listing'" class="flex flex-col gap-1.5 col-span-2">
              <UiLabel class="text-sm font-bold text-slate-700">
                보유랭킹
                <span class="text-xs font-normal text-slate-400 ml-1">(현재 조건 기준)</span>
              </UiLabel>
              <UiSelect
                :model-value="mainFilters.realtor"
                @update:model-value="(val: string) => mainFilters.realtor = val"
              >
                <UiSelectTrigger class="h-10 w-full bg-slate-50 border-slate-200 rounded-md px-3 text-sm text-left">
                  <span v-if="selectedRankItem" class="inline-flex items-center gap-1.5 text-sm">
                    <span class="text-slate-400 font-bold">{{ selectedRankItem.rank }}위</span>
                    <span class="text-slate-700 font-bold">{{ selectedRankItem.shortName }}</span>
                    <span class="text-blue-600 font-bold">{{ selectedRankItem.count }}건</span>
                  </span>
                  <span v-else class="text-slate-400 text-sm">순위 선택</span>
                </UiSelectTrigger>
                <UiSelectContent class="w-[360px]">
                  <UiSelectGroup>
                    <UiSelectItem value="all">전체 (필터 해제)</UiSelectItem>
                    <UiSelectItem
                      v-for="(item, idx) in realtorRanking"
                      :key="item.name"
                      :value="item.name"
                    >
                      <span class="inline-flex items-center gap-2 w-full">
                        <span class="text-slate-400 font-bold w-4 text-right flex-none">{{ idx + 1 }}</span>
                        <span class="flex-1">{{ item.name }}</span>
                        <span class="text-blue-600 font-bold flex-none">{{ item.count }}건</span>
                      </span>
                    </UiSelectItem>
                  </UiSelectGroup>
                </UiSelectContent>
              </UiSelect>
            </div>

          </div>
        </div>

        <div class="h-px bg-slate-100" />

        <!-- 금액 및 세안고 제외 (기존 유지) -->
        <div class="space-y-3">
          <div class="text-sm font-bold text-slate-400 uppercase tracking-widest">금액 및 세안고</div>
          <div class="space-y-3">
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">매물 가격 (만원)</UiLabel>
              <div class="flex items-center gap-2">
                <UiInput v-model.number="priceFilters.priceMin" type="number" placeholder="이상" class="h-10 bg-slate-50 rounded-md text-sm border-slate-200 flex-1" />
                <span class="text-slate-300 text-sm font-bold">~</span>
                <UiInput v-model.number="priceFilters.priceMax" type="number" placeholder="이하" class="h-10 bg-slate-50 rounded-md text-sm border-slate-200 flex-1" />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">월세 (만원)</UiLabel>
              <div class="flex items-center gap-2">
                <UiInput v-model.number="priceFilters.rentMin" type="number" placeholder="최소" class="h-10 bg-slate-50 rounded-md text-sm border-slate-200 flex-1" />
                <span class="text-slate-300 text-sm font-bold">~</span>
                <UiInput v-model.number="priceFilters.rentMax" type="number" placeholder="최대" class="h-10 bg-slate-50 rounded-md text-sm border-slate-200 flex-1" />
              </div>
            </div>
            <div class="flex items-center gap-4 pt-1">
              <div class="flex items-center gap-2">
                <UiCheckbox id="exc-seango" v-model="priceFilters.excludeSeango" class="w-4 h-4 border-slate-300 rounded text-blue-600" />
                <UiLabel for="exc-seango" class="text-sm font-bold text-slate-700 cursor-pointer select-none">세안고 제외</UiLabel>
              </div>
              <div class="flex items-center gap-2">
                <UiCheckbox id="only-seango" v-model="priceFilters.onlySeango" class="w-4 h-4 border-slate-300 rounded text-blue-600" />
                <UiLabel for="only-seango" class="text-sm font-bold text-slate-700 cursor-pointer select-none">세안고만</UiLabel>
              </div>
            </div>
          </div>
        </div>

        <div class="h-px bg-slate-100" />

        <!-- 상세 필터 (기존 유지) -->
        <div class="space-y-3">
          <div class="text-sm font-bold text-slate-400 uppercase tracking-widest">상세 필터</div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">방향</UiLabel>
              <UiSelect v-model="mainFilters.direction">
                <UiSelectTrigger class="h-10 w-full bg-slate-50 border-slate-200 rounded-md px-3 text-sm text-left">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectGroup>
                    <UiSelectItem value="all">전체</UiSelectItem>
                    <UiSelectItem v-for="o in selectOptions.direction" :key="o" :value="o">{{ o }}</UiSelectItem>
                  </UiSelectGroup>
                </UiSelectContent>
              </UiSelect>
            </div>
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">방수</UiLabel>
              <UiSelect v-model="mainFilters.room">
                <UiSelectTrigger class="h-10 w-full bg-slate-50 border-slate-200 rounded-md px-3 text-sm text-left">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectGroup>
                    <UiSelectItem value="all">전체</UiSelectItem>
                    <UiSelectItem v-for="o in selectOptions.room" :key="o" :value="o">{{ o }}</UiSelectItem>
                  </UiSelectGroup>
                </UiSelectContent>
              </UiSelect>
            </div>
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">욕실수</UiLabel>
              <UiSelect v-model="mainFilters.bath">
                <UiSelectTrigger class="h-10 w-full bg-slate-50 border-slate-200 rounded-md px-3 text-sm text-left">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectGroup>
                    <UiSelectItem value="all">전체</UiSelectItem>
                    <UiSelectItem v-for="o in selectOptions.bath" :key="o" :value="o">{{ o }}</UiSelectItem>
                  </UiSelectGroup>
                </UiSelectContent>
              </UiSelect>
            </div>
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">매물특징</UiLabel>
              <UiSelect v-model="mainFilters.feature">
                <UiSelectTrigger class="h-10 w-full bg-slate-50 border-slate-200 rounded-md px-3 text-sm text-left">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectGroup>
                    <UiSelectItem value="all">전체</UiSelectItem>
                    <UiSelectItem v-for="o in selectOptions.feature" :key="o" :value="o">{{ o }}</UiSelectItem>
                  </UiSelectGroup>
                </UiSelectContent>
              </UiSelect>
            </div>
          </div>
        </div>

      </div>
    </div>
  </aside>
</template>
