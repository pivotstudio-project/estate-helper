// content.js
window.addEventListener("message", (event) => {
  // 1. 단지 검색 명령 수신
  if (event.data?.type === "SEARCH_KEYWORD") {
    chrome.runtime.sendMessage({ action: "SEARCH_KEYWORD", keyword: event.data.keyword }, (response) => {
      // background.js에서 검색 결과를 받으면 다시 웹페이지(Flask)로 토스
      window.postMessage({ type: "SEARCH_RESULT", data: response }, "*");
    });
  }
  // 2. 특정 단지 수집 명령 수신
  else if (event.data?.type === "START_SCRAPING") {
    chrome.runtime.sendMessage({ action: "START_SCRAPING", complexNo: event.data.complexNo });
  }
});

// 3. background.js의 수집 완료/실패 신호를 웹페이지로 중계 (시간 제한 대신 이벤트 기반)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "SCRAPE_DONE") {
    window.postMessage(msg, "*");
  }
});
