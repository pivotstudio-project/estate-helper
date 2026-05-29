<script setup lang="ts">
import { ref, watch, computed } from 'vue';

interface Complex {
  complexNo: string;
  complexName: string;
  address?: string;
}

const props = defineProps<{
  complexList: Complex[];
  isLoading: boolean;
}>();

const query = defineModel<string>('query', { default: '' });
const selectedComplexNo = defineModel<string>('selectedComplexNo', { default: '' });

const emit = defineEmits(['search', 'scrape']);

const isComplexDialogOpen = ref(false);

watch(() => props.complexList.length, (val) => {
  if (val > 0) {
    isComplexDialogOpen.value = true;
  }
});

const handleSearch = (event?: KeyboardEvent) => {
  if (event && event.isComposing) return;
  emit('search');
};

const handleSelectComplex = (complexNo: string) => {
  selectedComplexNo.value = complexNo;
};

const handleScrape = () => {
  isComplexDialogOpen.value = false;
  emit('scrape');
};

const selectedComplexName = computed(() => {
  const found = props.complexList.find(c => c.complexNo === selectedComplexNo.value);
  return found ? found.complexName : '';
});
</script>

<template>
  <div class="flex gap-2">
    <UiInput
      v-model="query"
      placeholder="단지명 입력 후 엔터 (예: 래미안부천어반비스타)"
      class="flex-1 h-14 !text-lg rounded-md border-slate-200 bg-white"
      @keydown.enter="handleSearch"
    />
    <UiButton
      :disabled="isLoading"
      class="w-40 h-14 px-5 font-bold text-base bg-blue-600 text-white rounded-md hover:bg-blue-700"
      @click="handleSearch"
    >
      {{ isLoading ? '검색 중...' : '단지 검색' }}
    </UiButton>
  </div>

  <UiDialog v-model:open="isComplexDialogOpen">
    <UiDialogContent class="max-w-lg w-full p-0 rounded-md shadow-xl border border-slate-200 max-h-[70vh] flex flex-col overflow-hidden">

      <div class="px-5 py-4 border-b border-slate-100">
        <UiDialogTitle class="text-base font-bold text-slate-900">단지 선택</UiDialogTitle>
        <p class="text-sm text-slate-400 mt-0.5">총 {{ complexList.length }}개 결과 · 분석할 단지를 지정하세요</p>
      </div>

      <div class="flex-1 overflow-y-auto py-2">
        <button
          v-for="c in complexList"
          :key="c.complexNo"
          class="w-full text-left px-5 py-2.5 hover:bg-blue-50 transition-colors group flex items-center justify-between gap-3"
          :class="selectedComplexNo === c.complexNo ? 'bg-blue-50' : ''"
          @click="handleSelectComplex(c.complexNo)"
        >
          <div class="min-w-0">
            <div
              class="text-sm font-bold text-slate-800 group-hover:text-blue-700 truncate"
              :class="{ 'text-blue-700': selectedComplexNo === c.complexNo }"
            >
              {{ c.complexName }}
            </div>
            <div v-if="c.address" class="text-sm text-slate-400 truncate">{{ c.address }}</div>
          </div>
          <span
            v-if="selectedComplexNo === c.complexNo"
            class="text-sm font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md flex-none"
          >선택됨</span>
        </button>
      </div>

      <div class="px-4 py-3 border-t border-slate-100">
        <p v-if="!selectedComplexNo" class="text-sm text-slate-400 text-center mb-2">위 목록에서 단지를 선택해 주세요</p>
        <UiButton
          :disabled="!selectedComplexNo"
          class="w-full h-10 font-bold text-sm rounded-md transition-all"
          :class="selectedComplexNo
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-slate-100 text-slate-300 cursor-not-allowed'"
          @click="handleScrape"
        >
          {{ selectedComplexNo ? `${selectedComplexName} · 매물 전수조사 가동` : '매물 전수조사 가동' }}
        </UiButton>
      </div>

    </UiDialogContent>
  </UiDialog>
</template>
