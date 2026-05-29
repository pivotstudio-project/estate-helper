<script setup lang="ts">
defineProps<{
  selectOptions: any;
  activeTab: string;
}>();

const mainFilters = defineModel<any>('mainFilters', { required: true });
const priceFilters = defineModel<any>('priceFilters', { required: true });
const proFilters = defineModel<any>('proFilters', { required: true });

const emit = defineEmits(['reset']);
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

        <div v-if="activeTab === 'listing'" class="space-y-3">
          <span class="text-sm font-black text-blue-800 tracking-wide block uppercase">빠른 매칭</span>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="(label, key) in { priceDrop: '급매', immediate: '즉시입주', exclusiveOther: '타사독점', owner: '집주인', recent: '3일내신규' }"
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

        <div class="space-y-3">
          <div class="text-sm font-bold text-slate-400 uppercase tracking-widest">주요 필터</div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">거래유형</UiLabel>
              <UiSelect v-model="mainFilters.trade">
                <UiSelectTrigger class="h-10 w-full bg-slate-50 border-slate-200 rounded-md px-3 text-sm text-left">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectGroup>
                    <UiSelectItem value="all">전체</UiSelectItem>
                    <UiSelectItem v-for="o in selectOptions.trade" :key="o" :value="o">{{ o }}</UiSelectItem>
                  </UiSelectGroup>
                </UiSelectContent>
              </UiSelect>
            </div>
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">동</UiLabel>
              <UiSelect v-model="mainFilters.building">
                <UiSelectTrigger class="h-10 w-full bg-slate-50 border-slate-200 rounded-md px-3 text-sm text-left">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectGroup>
                    <UiSelectItem value="all">전체</UiSelectItem>
                    <UiSelectItem v-for="o in selectOptions.building" :key="o" :value="o">{{ o }}</UiSelectItem>
                  </UiSelectGroup>
                </UiSelectContent>
              </UiSelect>
            </div>
            <div class="flex flex-col gap-1.5">
              <UiLabel class="text-sm font-bold text-slate-700">전용면적</UiLabel>
              <UiSelect v-model="mainFilters.area">
                <UiSelectTrigger class="h-10 w-full bg-slate-50 border-slate-200 rounded-md px-3 text-sm text-left">
                  <UiSelectValue />
                </UiSelectTrigger>
                <UiSelectContent>
                  <UiSelectGroup>
                    <UiSelectItem value="all">전체</UiSelectItem>
                    <UiSelectItem v-for="o in selectOptions.area" :key="o" :value="o">{{ o }}</UiSelectItem>
                  </UiSelectGroup>
                </UiSelectContent>
              </UiSelect>
            </div>
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
          </div>
        </div>

        <div class="h-px bg-slate-100" />

        <div class="space-y-3">
          <div class="text-sm font-bold text-slate-400 uppercase tracking-widest">금액 및 세안고 제외</div>
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
            <div class="flex items-center gap-2 pt-1">
              <UiCheckbox id="exc-seango" v-model="priceFilters.excludeSeango" class="w-4 h-4 border-slate-300 rounded text-blue-600" />
              <UiLabel for="exc-seango" class="text-sm font-bold text-slate-700 cursor-pointer select-none">세안고 제외</UiLabel>
            </div>
          </div>
        </div>

        <div class="h-px bg-slate-100" />

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
