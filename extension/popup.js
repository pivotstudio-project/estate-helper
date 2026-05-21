document.getElementById('start-btn').addEventListener('click', async () => {
  const btn = document.getElementById('start-btn');
  const statusEl = document.getElementById('status');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url.includes("new.land.naver.com")) {
    statusEl.textContent = "❌ 네이버 부동산 단지 페이지가 아닙니다.";
    return;
  }

  btn.disabled = true;
  statusEl.textContent = "⏳ 수집 및 토큰 캡처 중...";

  // 웹페이지의 MAIN 콘텍스트에서 크롤링 로직 실행 (토큰 및 fetch 권한 획득 목적)
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: async function() {
      console.log("🚀 수집 셔틀 기동!");

      // 1. 단지 번호 추출
      const match = window.location.href.match(/complexes\/(\d+)/);
      if (!match) {
        alert("단지 번호(complexNo)를 찾을 수 없습니다. 단지 상세 페이지인지 확인하세요.");
        return;
      }
      const complexNo = match[1];

      // 2. Fetch 인터셉터를 심어 Authorization 토큰 탈취하기
      let capturedToken = null;
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const options = args[1];
        if (options?.headers?.authorization && !capturedToken) {
          capturedToken = options.headers.authorization;
          console.log("✅ 토큰 확보 완료!");
        }
        return originalFetch.apply(this, args);
      };

      // 3. 스크롤 굴려서 대표 매물 확보 및 토큰 강제 발생 유도
      let representativeArticles = {};
      let isMoreData = true;

      const scrollContainer = () => {
        let els = Array.from(document.querySelectorAll('*')).filter(el =>
          el.scrollHeight > el.clientHeight && window.getComputedStyle(el).overflowY.includes('auto')
        );
        if (els.length > 0) {
          els.sort((a, b) => b.scrollHeight - a.scrollHeight)[0].scrollTop = 999999;
        }
      };

      // 최대 15초간 스크롤하며 대기
      for (let i = 0; i < 10; i++) {
        scrollContainer();
        await new Promise(r => setTimeout(r, 1000));
        if (capturedToken) break;
      }

      if (!capturedToken) {
        alert("인증 토큰 캡처 실패. 목록을 손으로 조금 스크롤한 뒤 다시 시도해 보세요.");
        window.fetch = originalFetch;
        return;
      }

      // API를 직접 호출하여 대표 매물 목록 먼저 확보 (네이버 응답 가로채기 대용)
      let pageNum = 1;
      while (isMoreData && pageNum <= 30) { // 최대 30페이지 제한
        try {
          const res = await originalFetch(`https://new.land.naver.com/api/articles/complex/${complexNo}?type=APT:ABYG:JGC&ptype=APT:ABYG:JGC&tradeType=&rentPrice=&sameAddressGroup=false&minWarrantPrice=&maxWarrantPrice=&minDealPrice=&maxDealPrice=&minRentPrice=&maxRentPrice=&minArea=&maxArea=&delayMin=&delayMax=&floorGroup=&realtorId=&direction=&tag=&selectedComplexNo=${complexNo}&priceType=RETAIL&markerId=&markerType=&complexName=&regionCode=&mapX=&mapY=&mapLevel=&page=${pageNum}&articleState=`, {
            headers: { "authorization": capturedToken, "referer": window.location.href }
          });
          const data = await res.json();
          if (data.articleList && data.articleList.length > 0) {
            data.articleList.forEach(item => {
              representativeArticles[item.articleNo] = item;
            });
          }
          isMoreData = data.isMoreData;
          pageNum++;
          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          break;
        }
      }

      const articleNos = Object.keys(representativeArticles);
      console.log(`✅ 대표 매물 수집 완료: ${articleNos.length}개`);

      // 4. 상세 데이터 5개씩 배치 Fetch 호출 (Python에서 하던 것과 완벽히 동일)
      const allGroups = {};
      const BATCH_SIZE = 5;
      const baseUrl = "https://new.land.naver.com/api/articles?index=0&representativeArticleNo=";

      for (let i = 0; i < articleNos.length; i += BATCH_SIZE) {
        const batch = articleNos.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch.map(async (no) => {
          try {
            const r = await originalFetch(baseUrl + no, {
              headers: { "authorization": capturedToken, "referer": window.location.href }
            });
            if (r.ok) {
              allGroups[no] = await r.json();
            }
          } catch (e) {}
        }));
        await new Promise(r => setTimeout(r, 300));
      }

      // 5. 원래대로 fetch 복구
      window.fetch = originalFetch;

      // 6. 결과물을 로컬 Flask 서버로 전송 (보관하지 않고 메모리에만 올림)
      console.log("📤 Flask 서버로 데이터 토스 중...");
      try {
        const response = await originalFetch("http://localhost:5000/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            complexNo: complexNo,
            representativeArticles: representativeArticles,
            allGroups: allGroups
          })
        });
        const resData = await response.json();
        if (resData.ok) {
          // 성공 시 로컬 뷰어 페이지 자동 열기
          window.open("http://localhost:5000/", "_blank");
        } else {
          alert("Flask 전송 실패: " + resData.error);
        }
      } catch (err) {
        alert("로컬 Flask 서버가 꺼져있거나 통신할 수 없습니다. (http://localhost:5000)");
      }
    }
  });

  window.close(); // 팝업 닫기
});
