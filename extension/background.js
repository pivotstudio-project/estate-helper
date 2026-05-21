// background.js (중앙 통제실 - 자동 환경 감지 엔진 탑재)

const waitForTabComplete = (tabId) => new Promise(resolve => {
  const listener = (id, info) => {
    if (id === tabId && info.status === "complete") {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── [A] 검색 모드 (탭 열지 않고 API만 조용히 조회) ──
  if (message.action === "SEARCH_KEYWORD") {
    const keyword = message.keyword;
    console.log(`🔍 [통제실] 검색 요청 수신: ${keyword}`);

    fetch(`https://new.land.naver.com/api/search?keyword=${encodeURIComponent(keyword)}&page=1`)
      .then(r => r.json())
      .then(data => {
        let results = [];
        if (data.deepLink && (!data.complexes || data.complexes.length === 0)) {
          const match = data.deepLink.match(/complexes\/(\d+)/);
          if (match) results.push({ complexNo: match[1], complexName: data.keyword || keyword, address: '' });
        }
        else if (data.complexes && data.complexes.length > 0) {
          results = data.complexes.slice(0, 20).map(c => ({
            complexNo: String(c.complexNo),
            complexName: c.complexName,
            address: c.cortarAddress || ''
          }));
        }
        sendResponse(results);
      })
      .catch(e => {
        console.error("❌ 검색 에러:", e);
        sendResponse({ error: e.message });
      });

    return true;
  }

  // ── [B] 수집 모드 (지정된 단지 번호로 다이렉트 진입 후 전수조사) ──
  if (message.action === "START_SCRAPING") {
    const complexNo = message.complexNo;
    console.log(`🎬 [통제실] 단지 번호 [${complexNo}] 전수조사 가동.`);

    (async () => {
      // 🌟 명령을 내린 대시보드 탭의 오리지널 URL을 미리 확보 (로컬/Vercel 판별용)
      const originTabUrl = sender.tab?.url || "";

      const naverParams = "ms=2AIt9I,3z8DSq,17&a=APT:ABYG:JGC&e=RETAIL&ad=true";
      const tab = await chrome.tabs.create({ url: `https://new.land.naver.com/complexes/${complexNo}?${naverParams}`, active: true });
      await waitForTabComplete(tab.id);

      // 브라우저 안착 대기
      await new Promise(r => setTimeout(r, 3000));

      // 무한 스크롤 및 5배치 동기화 구동
      const collectionResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: async (cNo) => {
          const origFetch = window.fetch;
          const getScrollElement = () => {
            let els = Array.from(document.querySelectorAll('*')).filter(el => el.scrollHeight > el.clientHeight && window.getComputedStyle(el).overflowY.includes('auto'));
            return els.length > 0 ? els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] : null;
          };

          const deadline = Date.now() + 90000;
          let noChange = 0;

          while (window.isMoreData && Date.now() < deadline) {
            let prev = Object.keys(window.capturedArticles || {}).length;
            const target = getScrollElement();
            if (target) target.scrollTop = 999999;
            await new Promise(r => setTimeout(r, 1500));
            let curr = Object.keys(window.capturedArticles || {}).length;

            if (curr === prev) {
              noChange += 1;
              if (noChange >= 3) break;
            } else { noChange = 0; }
          }

          const token = window.capturedToken;
          const articleNos = Object.keys(window.capturedArticles || {});
          const allGroups = {};

          if (articleNos.length > 0 && token) {
            const baseUrl = "https://new.land.naver.com/api/articles?index=0&representativeArticleNo=";
            const referer = `https://new.land.naver.com/complexes/${cNo}`;

            for (let i = 0; i < articleNos.length; i += 5) {
              const batch = articleNos.slice(i, i + 5);
              await Promise.allSettled(batch.map(async (no) => {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 10000);
                try {
                  const r = await origFetch(baseUrl + no, { credentials: 'include', headers: { 'accept': '*/*', 'authorization': token, 'referer': referer }, signal: ctrl.signal });
                  if (r.ok) allGroups[no] = await r.json();
                } catch (e) {} finally { clearTimeout(timer); }
              }));
              await new Promise(r => setTimeout(r, 300));
            }
          }
          const complexName = window.capturedArticles[articleNos[0]]?.complexName || "단지명";

          return {
            complexName,
            representativeArticles: window.capturedArticles,
            articleOrder: window.capturedOrder,
            allGroups
          };
        },
        args: [complexNo]
      });

      const finalResult = collectionResult[0]?.result;

      // 최종 완제품 데이터 서버 이송 파트
      if (finalResult && Object.keys(finalResult.representativeArticles || {}).length > 0) {
        try {
          // 🌟 [스마트 트래픽 라우팅]
          // 명령을 내렸던 원본 탭의 URL에 localhost나 127.0.0.1이 포함되어 있다면 로컬로 쏘고,
          // 그 외의 경우(Vercel 도메인 등)에는 자동으로 프로덕션 Vercel 엔드포인트로 쏩니다.
          const targetUrl = (originTabUrl.includes("localhost") || originTabUrl.includes("127.0.0.1"))
            ? "http://127.0.0.1:5000/api/upload"
            : "https://estate-helper.vercel.app/api/upload";

          console.log(`🚀 [통제실] 최종 목적지 감지 완료 -> 배달 주소: ${targetUrl}`);

          await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              complexNo: complexNo,
              complexName: finalResult.complexName,
              representativeArticles: finalResult.representativeArticles,
              articleOrder: finalResult.articleOrder,
              allGroups: finalResult.allGroups
            })
          });
          console.log("✅ [통제실] 서버 전송 성공.");
        } catch(e) {
          console.error("❌ [통제실] 서버 전송 중 에러 발생:", e);
        }
      }
      chrome.tabs.remove(tab.id); // 작업 완료 후 제어용 네이버 탭 자동 소멸
    })();
  }
});
