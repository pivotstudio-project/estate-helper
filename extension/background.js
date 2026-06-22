// background.js (중앙 통제실 - 하이브리드 엔진 V2)

const waitForTabComplete = (tabId, timeoutMs = 60000) => new Promise((resolve, reject) => {
  let done = false;
  const finish = (fn, arg) => {
    if (done) return;
    done = true;
    chrome.tabs.onUpdated.removeListener(listener);
    clearTimeout(timer);
    fn(arg);
  };
  const listener = (id, info) => {
    if (id === tabId && info.status === "complete") finish(resolve);
  };
  chrome.tabs.onUpdated.addListener(listener);

  // 경합 방지: 리스너를 붙이기 전에 이미 로딩이 끝났을 수 있으므로 현재 상태를 즉시 확인
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return; // 탭이 사라졌으면 아래 타임아웃이 처리
    if (tab && tab.status === "complete") finish(resolve);
  });

  // 무한 대기 방지: 로딩이 끝내 안 잡히면 거부
  const timer = setTimeout(() => finish(reject, new Error("탭 로딩 시간 초과")), timeoutMs);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── [A] 검색 모드 (조용히 API만 찔러서 단지 목록 확보) ──
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

  // ── [B] 수집 모드: 큐에 등록만 하고 즉시 반환 (동시성 제한은 큐가 담당) ──
  if (message.action === "START_SCRAPING") {
    enqueueScrape(message.complexNo, sender.tab?.url || "", sender.tab?.id);
    return;
  }
});

// ── 수집 큐 (동시 실행 제한). Infinity = 무제한 (들어오는 즉시 모두 실행) ──
const scrapeQueue = [];
let activeScrapes = 0;
const MAX_CONCURRENT = Infinity;

function enqueueScrape(complexNo, originTabUrl, originTabId) {
  scrapeQueue.push({ complexNo, originTabUrl, originTabId });
  console.log(`🎟️ [통제실] 큐 등록 [${complexNo}] (대기 ${scrapeQueue.length}건, 진행 ${activeScrapes}건)`);
  processScrapeQueue();
}

function processScrapeQueue() {
  if (activeScrapes >= MAX_CONCURRENT) return;
  const job = scrapeQueue.shift();
  if (!job) return;
  activeScrapes++;
  startKeepAlive();
  runScrape(job.complexNo, job.originTabUrl, job.originTabId).finally(() => {
    activeScrapes--;
    if (activeScrapes <= 0) stopKeepAlive();
    processScrapeQueue();
  });
}

// ── 서비스워커 keepalive ──
// MV3 서비스워커는 ~30초 유휴 시 종료됨. 1600개 같은 대단지는 수집이 수 분 걸려
// 그 사이 SW가 죽으면 수집이 통째로 증발(=무반응)함. 20초마다 chrome API를 찔러 종료 타이머를 리셋.
let keepAliveTimer = null;
function startKeepAlive() {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000);
}
function stopKeepAlive() {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
}

// 대시보드 탭으로 수집 완료/실패 신호를 직접 전송 (폴링 타임아웃 대신 이벤트 기반)
function notifyDashboard(tabId, payload) {
  if (tabId == null) return;
  try {
    chrome.tabs.sendMessage(tabId, payload).catch(() => {});
  } catch (e) {}
}

// ── 단일 단지 수집 (하이브리드: 탭 오픈 -> 즉시 토큰 확보 -> API 전수조사) ──
async function runScrape(complexNo, originTabUrl, originTabId) {
  console.log(`🎬 [통제실] 단지 번호 [${complexNo}] 전수조사 가동.`);

  let tab = null;
  let settled = false;
  let watchdog = null;

  // 결과를 단 한 번만 통지(+탭 정리 +워치독 해제)하는 게이트.
  // 정상완료 / 예외 / 워치독 중 먼저 도달한 것만 처리되어 중복 통지를 막음.
  const settle = (payload) => {
    if (settled) return;
    settled = true;
    if (watchdog) clearTimeout(watchdog);
    notifyDashboard(originTabId, payload);
    if (tab && tab.id != null) { try { chrome.tabs.remove(tab.id); } catch (_) {} }
  };

  // 워치독: 10분 안에 안 끝나면 멈춘 것으로 보고 강제 정리 (대단지는 안 건드리는 넉넉한 값)
  watchdog = setTimeout(() => {
    console.error(`⏱️ [통제실] 워치독 발동 [${complexNo}]: 10분 초과 → 강제 종료`);
    settle({ type: "SCRAPE_DONE", complexNo, ok: false, error: "수집 시간 초과(10분) — 멈춘 작업을 정리했습니다." });
  }, 10 * 60 * 1000);

  try {
      const naverParams = "ms=2AIt9I,3z8DSq,17&a=APT:ABYG:JGC&e=RETAIL&ad=true";

      // active:false → 포커스를 뺏지 않아 탭을 여러 개 동시에 띄워도 간섭/스로틀 최소화
      tab = await chrome.tabs.create({ url: `https://new.land.naver.com/complexes/${complexNo}?${naverParams}`, active: false });
      await waitForTabComplete(tab.id);

      // 브라우저 렌더링 및 content-naver.js 작동 대기 (1.5초)
      await new Promise(r => setTimeout(r, 1500));

      const collectionResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: async (cNo) => {
          console.log("🚀 [엔진] 하이브리드 수집 셔틀 기동!");

          const simulateHumanScrolling = async () => {
            const getScrollElement = () => {
              let els = Array.from(document.querySelectorAll('*')).filter(el => el.scrollHeight > el.clientHeight && window.getComputedStyle(el).overflowY.includes('auto'));
              return els.length > 0 ? els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] : null;
            };

            for(let i = 0; i < 20; i++) {
              const target = getScrollElement();
              if (target) {
                // 한 번에 300px ~ 800px 사이로 랜덤하게 휠을 굴림
                const scrollAmount = Math.floor(Math.random() * 500) + 300;
                target.scrollTop += scrollAmount;
              }
              // 사람이 스크롤을 읽는 시간 (0.8초 ~ 1.8초 랜덤 대기)
              await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1000) + 800));
            }
          };

          // 위장 스크롤을 await 없이 실행하여, API 수집과 동시에 화면에서는 스크롤이 내려가도록 만듦
          simulateHumanScrolling();

          // 1. 스크롤 쌩쇼 제거! content-naver.js가 탭 로딩과 동시에 가로챈 토큰을 바로 꺼내 씁니다.
          let capturedToken = window.capturedToken;

          // 페이지 로딩 지연 등으로 아직 토큰이 없다면 잠시 대기
          if (!capturedToken) {
            for (let i = 0; i < 10; i++) {
              await new Promise(r => setTimeout(r, 500));
              if (window.capturedToken) {
                capturedToken = window.capturedToken;
                break;
              }
            }
          }

          if (!capturedToken) {
            return { error: "인증 토큰 캡처 실패 (페이지 로딩 지연)" };
          }

          console.log("✅ [엔진] 인증 토큰 즉시 확보 완료!");

          const originalFetch = window.fetch;

          // 2. API를 직접 호출하여 1~30페이지 대표 매물 완벽하게 쓸어 담기 (강제 전체 검색)
          let representativeArticles = {};
          let articleOrder = [];
          let isMoreData = true;
          let pageNum = 1;

          while (isMoreData && pageNum <= 200) {
            try {
              const res = await originalFetch(`https://new.land.naver.com/api/articles/complex/${cNo}?type=APT:ABYG:JGC&ptype=APT:ABYG:JGC&tradeType=&rentPrice=&sameAddressGroup=true&minWarrantPrice=&maxWarrantPrice=&minDealPrice=&maxDealPrice=&minRentPrice=&maxRentPrice=&minArea=&maxArea=&delayMin=&delayMax=&floorGroup=&realtorId=&direction=&tag=&selectedComplexNo=${cNo}&priceType=RETAIL&markerId=&markerType=&complexName=&regionCode=&mapX=&mapY=&mapLevel=&page=${pageNum}&articleState=`, {
                headers: { "authorization": capturedToken, "referer": window.location.href },
                cache: "no-store"
              });
              const data = await res.json();

              if (data.articleList && data.articleList.length > 0) {
                data.articleList.forEach(item => {
                  if (!representativeArticles[item.articleNo]) {
                    articleOrder.push(item.articleNo);
                    representativeArticles[item.articleNo] = item;
                  }
                });
              }
              isMoreData = data.isMoreData;
              pageNum++;
              const randomPageDelay = Math.floor(Math.random() * 300) + 200;
              await new Promise(r => setTimeout(r, randomPageDelay));
            } catch (e) {
              break;
            }
          }

          const articleNos = Object.keys(representativeArticles);
          console.log(`✅ [엔진] 대표 매물 API 수집 완료: ${articleNos.length}개`);

          if (articleNos.length === 0) {
            return { error: "조건에 맞는 매물이 없습니다." };
          }

          // 3. 상세 데이터 5개씩 묶어서(Batch) Fetch 호출
          const allGroups = {};
          const BATCH_SIZE = 10;
          const baseUrl = "https://new.land.naver.com/api/articles?index=0&representativeArticleNo=";

          for (let i = 0; i < articleNos.length; i += BATCH_SIZE) {
            const batch = articleNos.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(batch.map(async (no) => {
              try {
                const r = await originalFetch(baseUrl + no, {
                  headers: { "authorization": capturedToken, "referer": window.location.href },
                  cache: "no-store"
                });
                if (r.ok) {
                  allGroups[no] = await r.json();
                }
              } catch (e) {}
            }));
            const randomBatchDelay = Math.floor(Math.random() * 250) + 150;
            await new Promise(r => setTimeout(r, randomBatchDelay));
          }

          return {
            complexName: representativeArticles[articleNos[0]]?.complexName || "단지명",
            representativeArticles: representativeArticles,
            articleOrder: articleOrder,
            allGroups: allGroups
          };
        },
        args: [complexNo]
      });

      const finalResult = collectionResult[0]?.result;

      // 최종 데이터 서버 이송
      if (finalResult && !finalResult.error) {
        try {
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
          settle({ type: "SCRAPE_DONE", complexNo, ok: true });
        } catch(e) {
          console.error("❌ [통제실] 서버 전송 중 에러 발생:", e);
          settle({ type: "SCRAPE_DONE", complexNo, ok: false, error: "서버 전송 실패: " + e.message });
        }
      } else {
        console.error("❌ [통제실] 수집 과정 중 에러 발생:", finalResult?.error);
        settle({ type: "SCRAPE_DONE", complexNo, ok: false, error: finalResult?.error || "수집에 실패했습니다." });
      }
  } catch (e) {
    // executeScript 실패, 서비스워커 재시작, 결과 직렬화 실패, 탭 로딩 시간 초과 등
    console.error("❌ [통제실] 수집 도중 예외 발생:", e);
    settle({ type: "SCRAPE_DONE", complexNo, ok: false, error: "수집 중 예외: " + (e?.message || String(e)) });
  } finally {
    // settle이 통지/탭정리/워치독 해제를 모두 담당. 혹시 한 번도 안 불렸으면 정리.
    if (!settled) settle({ type: "SCRAPE_DONE", complexNo, ok: false, error: "수집이 비정상 종료되었습니다." });
  }
}
