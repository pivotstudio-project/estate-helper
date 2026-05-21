// content-naver.js (MAIN 월드 네트워크 전수 도청 센서)
(() => {
  window.capturedArticles = window.capturedArticles || {};
  window.capturedOrder = window.capturedOrder || []; // ★ 랭킹 순서 보존용 대기표 추가
  window.capturedToken = window.capturedToken || null;
  window.isMoreData = true;

  const processArticleList = (list) => {
    if (!list) return;
    list.forEach(item => {
      if (item.articleNo) {
        // 처음 보는 매물이면 순서 대기표에 추가
        if (!window.capturedArticles[item.articleNo]) {
          window.capturedOrder.push(item.articleNo);
        }
        window.capturedArticles[item.articleNo] = item;
      }
    });
  };

  // 1번 선로 감시: Fetch 인터셉터
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = args[0] || "";
    const options = args[1] || {};

    if (options.headers?.authorization) window.capturedToken = options.headers.authorization;
    if (options.headers?.Authorization) window.capturedToken = options.headers.Authorization;

    const response = await origFetch.apply(this, args);

    if (typeof url === 'string' && url.includes('api/articles/complex/')) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        processArticleList(data.articleList);
        if (data.isMoreData === false) window.isMoreData = false;
      } catch (e) {}
    }
    return response;
  };

  // 2번 선로 감시: XMLHttpRequest 인터셉터
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (header.toLowerCase() === 'authorization') {
      window.capturedToken = value;
    }
    return origSetRequestHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      const url = this._url;
      if (typeof url === 'string' && url.includes('api/articles/complex/')) {
        try {
          const data = JSON.parse(this.responseText);
          processArticleList(data.articleList);
          if (data.isMoreData === false) window.isMoreData = false;
        } catch (e) {}
      }
    });
    return origSend.apply(this, arguments);
  };

  console.log("🎯 [엔진] 랭킹 순서 보존 기능이 포함된 도청 덫 설치 완료.");
})();
