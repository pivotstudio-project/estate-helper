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
