# app.py (익스텐션 연동 전용 - 순수 대시보드 및 필터링 서버)
from flask import Flask, request, jsonify, render_template_string
import traceback

app = Flask(__name__)
TARGET_REALTOR = "국민공인중개사사무소"

# 익스텐션이 수집 완료하기 전까지 대시보드가 참조할 전역 데이터 공간
_SHARED_DATA = {
    "status": "READY",
    "complex_name": "조회된 단지 없음",
    "rank_results": [],
    "article_results": []
}

# 네이버 영문 키값 ➔ 한글 번역 매핑 딕셔너리
FIELD_MAP = {
    "articleNo": "_매물번호", "articleName": "원문", "articleStatus": "_매물상태", "realEstateTypeName": "_부동산유형",
    "articleRealEstateTypeName": "_매물유형", "tradeTypeCode": "_거래유형코드", "tradeTypeName": "거래유형",
    "complexNo": "_단지번호", "complexName": "단지명", "buildingName": "동", "areaNo": "_면적번호", "areaName": "면적구분",
    "area1": "공급면적", "area2": "전용면적", "supplyArea": "공급면적", "exclusiveArea": "전용면적", "exclusiveRate": "_전용률",
    "floorInfo": "_층정보원문", "direction": "방향", "buildingUseCode": "_건물용도", "dealOrWarrantPrc": "가격",
    "warrantPrc": "_보증금", "rentPrc": "_월세", "dealPrc": "_매매가", "sameAddrMaxPrc": "_동일최고가",
    "sameAddrMinPrc": "_동일최저가", "sameAddrCnt": "_동일주소수", "sameAddrDirectCnt": "_직거래수", "realtorName": "공인중개사무소",
    "realtorId": "_중개사ID", "cpName": "_정보망", "cpId": "_정보망ID", "cpid": "_정보망ID2", "cpPcArticleUrl": "_정보망URL",
    "cpMobileArticleUrl": "_정보망URL모바일", "cpPcArticleBridgeUrl": "_브릿지URL", "cpPcArticleLinkUseAtArticleTitleYn": "_PC링크제목",
    "cpPcArticleLinkUseAtCpNameYn": "_PC링크CP", "cpMobileArticleLinkUseAtArticleTitleYn": "_모바일링크제목",
    "cpMobileArticleLinkUseAtCpNameYn":   "_모바일링크CP", "articleConfirmYmd": "_확인일자원문", "lastModifyYmd": "_최종수정일",
    "moveInTypeName": "_입주유형", "moveInDiscussionPossibleYN": "_입주협의", "tagList": "_태그", "태그": "_태그",
    "articleFeatureDesc": "_매물특징", "매물특징": "_매물특징", "isDirectTrade": "_직거래여부", "verificationTypeCode": "_인증유형",
    "detailAddress": "_상세주소", "detailAddressYn": "_상세주소공개", "isComplex": "_단지여부", "isLocationShow": "_위치공개",
    "isPriceModification": "_가격변경", "isSafeLessorOfHug": "_HUG안심", "isVrExposed": "_VR노출", "representativeImgUrl": "_대표이미지",
    "representativeImgThumb": "_썸네일규격", "representativeImgTypeCode": "_이미지유형", "thumbnailImgUrl": "_썸네일",
    "siteImageCount": "_현장사진수", "tradeCheckedByOwner": "_집주인확인", "latitude": "_위도", "longitude": "_경도",
    "cortarNo": "_법정동코드", "roomCnt": "_방수", "bathroomCnt": "_욕실수", "parkingCnt": "_주차", "heatMethodTypeCode": "_난방방식",
    "heatFuelTypeCode": "_난방연료", "buildingHighFloor": "_최고층", "buildingLowFloor": "_최저층", "isInterest": "_관심",
    "isAdded": "_추가", "isRecommend": "_추천", "priceChangeState": "_가격변동", "isPriceModify": "_가격변경2",
}

def translate_key(key): return FIELD_MAP.get(key, key)

def fmt_date(raw):
    s = str(raw).strip()
    if len(s) == 8 and s.isdigit():
        return s[2:4] + "." + s[4:6] + "." + s[6:8]
    return s

def flatten_article(article, idx=0):
    raw = {}
    for k, v in article.items():
        if isinstance(v, dict):
            for k2, v2 in v.items(): raw[translate_key(k2)] = v2
        elif isinstance(v, list): raw[translate_key(k)] = ", ".join(str(i) for i in v) if v else ""
        else: raw[translate_key(k)] = v

    out = {"순번": idx, "단지명": raw.get("단지명", ""), "동": raw.get("동", ""), "거래유형": raw.get("거래유형", "")}

    min_p = raw.get("_동일최저가", "")
    max_p = raw.get("_동일최고가", "")
    trade = raw.get("거래유형", "")

    if min_p and max_p and min_p != max_p:
        out["가격"] = f"{min_p} ~ {max_p}"
    else:
        price = raw.get("가격", "")
        warrant, rent = raw.get("_보증금", ""), raw.get("_월세", "")
        out["가격"] = f"{warrant}/{rent}" if trade == "월세" and warrant and rent else price

    is_direct, verif = raw.get("_직거래여부", False), str(raw.get("_인증유형", ""))
    out["구분"] = "직거래" if is_direct else ("집주인 직거래" if verif == "OWNER" else "중개")

    supply, exclusive = raw.get("공급면적", ""), raw.get("전용면적", "")
    out["공급면적"] = f"{supply}㎡" if supply else ""
    out["면적구분"] = str(raw.get("면적구분") or raw.get("_면적명") or raw.get("areaName") or "")
    out["전용면적"] = f"{exclusive}㎡" if exclusive else ""

    floor_raw = str(raw.get("_층정보원문", ""))
    out["층"], out["총층수"] = (floor_raw.split("/")[0].strip(), floor_raw.split("/")[1].strip()) if "/" in floor_raw else (floor_raw, "")
    out["방향"] = raw.get("방향", "")
    out["확인일"] = fmt_date(raw.get("_확인일자원문", ""))
    out["공인중개사무소"] = raw.get("공인중개사무소", "")
    out["원문"] = raw.get("원문", "")

    tag_raw = str(raw.get("_태그") or raw.get("태그") or "")
    tags = [t.strip() for t in tag_raw.split(",") if t.strip()]

    room_map = {"방한개": "1개", "방두개": "2개", "방세개": "3개", "방네개": "4개", "방다섯개이상": "5개이상"}
    out["방수"] = next((room_map[t] for t in tags if t in room_map), "")
    bath_map = {"화장실한개": "1개", "화장실두개": "2개", "화장실세개이상": "3개이상"}
    out["욕실수"] = next((bath_map[t] for t in tags if t in bath_map), "")
    out["층구분"] = next((t for t in ["저층", "중층", "고층"] if t in tags), "")
    age_map = {"1년이내": "1년이내", "3년이내": "3년이내", "5년이내": "5년이내", "10년이내": "10년이내", "15년이내": "15년이내", "20년이내": "20년이내", "20년초과": "20년초과"}
    out["연식"] = next((age_map[t] for t in tags if t in age_map), "")

    features = [k for k in ["복층","올수리","급매","세안고","주차가능","단기임대","반려동물"] if k in tags]
    feat_desc = str(raw.get("_매물특징") or raw.get("매물특징") or "")
    for kw in ["급매", "올수리", "복층", "세안고"]:
        if kw in feat_desc and kw not in features: features.append(kw)
    out["특징"] = ", ".join(features) if features else ""
    out["태그원문"] = tag_raw

    # [🔥 실무 필터용 백엔드 원시 데이터 탑재]
    out["가격변동여부"] = bool(raw.get("_가격변동") or raw.get("_가격변경") or raw.get("_가격변경2") or raw.get("isPriceModification"))
    out["입주유형"] = str(raw.get("_입주유형") or raw.get("moveInTypeName") or "")

    return out

HTML = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>부동산 통합 모니터링 시스템</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif; background: #f8f9fa; min-height: 100vh; color: #212529; }
  
  .container { max-width: 1200px; margin: 0 auto; padding: 24px 24px 0; }
  
  .nav { background: #f8f9fa; border-bottom: 1px solid #e9ecef; display: flex; padding: 0; margin-bottom: 24px; }
  .tab-btn { padding: 14px 22px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; background: none; border-bottom: 2px solid transparent; color: #868e96; border-radius: 0 !important; transition: color .15s, border-color .15s; }
  .tab-btn.active { color: #339af0; border-bottom-color: #339af0; }
  .tab-btn:hover:not(.active) { color: #495057; }
  
  .page { display: none; padding: 0; }
  .page.active { display: block; }
  
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .sub { font-size: 13px; color: #868e96; margin-bottom: 28px; }
  .search-row { display: flex; gap: 8px; margin-bottom: 24px; }
  input[type=text] { flex: 1; padding: 11px 14px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 15px; outline: none; }
  input[type=text]:focus { border-color: #339af0; }
  button { padding: 11px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  .btn-blue  { background: #339af0; color: #fff; }
  .btn-blue:hover  { background: #228be6; }
  .status-banner { padding: 15px; background: #e7f5ff; color: #1971c2; border-radius: 8px; font-weight: bold; margin-bottom: 20px; display: none; text-align:center; }
  
  .summary { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .card { background: #fff; border-radius: 10px; padding: 16px 20px; flex: 1; min-width: 110px; border: 1px solid #e9ecef; }
  .card .label { font-size: 12px; color: #868e96; margin-bottom: 4px; }
  .card .value { font-size: 24px; font-weight: 700; }
  .card.warn .value { color: #e03131; }
  .card.ok   .value { color: #2f9e44; }
  
  .rank-warn { color: #e03131; font-weight: 700; }
  .rank-ok   { color: #2f9e44; font-weight: 700; }
  .badge { margin-left: 8px; font-size: 11px; background: #e03131; color: #fff; padding: 2px 7px; border-radius: 10px; }
  
  .rank-wrap, .listing-wrap { max-height: 65vh; overflow: auto; border-radius: 10px; border: 1px solid #e9ecef; background: #fff; margin-bottom: 40px; }
  .rank-wrap table, .listing-wrap table { width: 100%; border-collapse: separate; border-spacing: 0; white-space: nowrap; }
  .rank-wrap thead th, .listing-wrap thead th { position: sticky; top: 0; z-index: 10; background: #f1f3f5; padding: 12px 16px; text-align: left; font-size: 13px; color: #495057; font-weight: 600; border-bottom: 1px solid #dee2e6; }
  .rank-wrap td, .listing-wrap td { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid #f1f3f5; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
  .listing-wrap th { cursor: pointer; user-select: none; }
  .listing-wrap th:hover { background: #e9ecef; }
  .listing-wrap th.sorted { color: #339af0; }
  .listing-wrap tr:hover td { background: #f8f9fa; }
  .warn-row td { background: #fff5f5; }
  
  .listing-summary { display: flex; gap: 24px; margin-bottom: 24px; padding: 20px 24px; background: #fff; border-radius: 12px; border: 1px solid #e9ecef; flex-wrap: wrap; }
  .listing-summary .ls-item { display: flex; flex-direction: column; gap: 4px; }
  .listing-summary .ls-label { font-size: 13px; color: #868e96; }
  .listing-summary .ls-value { font-size: 28px; font-weight: 700; color: #212529; }
  .listing-summary .ls-value.total { color: #1971c2; }
  
  /* 🔥 실무 핵심 필터 영역 스타일 */
  .filter-pro { background: #e7f5ff; border: 1px solid #a5d8ff; border-radius: 12px; padding: 16px 24px; margin-bottom: 16px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .filter-pro-title { font-size: 14px; font-weight: 800; color: #1864ab; margin-right: 12px; }
  .pro-btn { background: #fff; border: 1px solid #74c0fc; color: #1971c2; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; }
  .pro-btn:hover { background: #d0ebff; }
  .pro-btn.active { background: #1971c2; color: #fff; border-color: #1971c2; box-shadow: 0 2px 6px rgba(25,113,194,0.3); }

  .filter-main { background: #fff; border: 1px solid #e9ecef; border-radius: 12px; padding: 20px 24px; margin-bottom: 12px; }
  .filter-main .filter-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; }
  .filter-group { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 140px; }
  .filter-group label { font-size: 12px; font-weight: 600; color: #495057; }
  .filter-group select { padding: 10px 12px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 14px; outline: none; background: #f8f9fa; }
  .filter-group select:focus { border-color: #339af0; background: #fff; }
  
  .filter-sub { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 12px; padding: 0; margin-bottom: 16px; overflow: hidden; }
  .filter-sub-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; cursor: pointer; user-select: none; }
  .filter-sub-header span { font-size: 13px; font-weight: 600; color: #495057; }
  .filter-sub-header .toggle-icon { font-size: 12px; color: #adb5bd; transition: transform .2s; }
  .filter-sub-header.open .toggle-icon { transform: rotate(180deg); }
  .filter-sub-body { display: none; padding: 16px 20px; border-top: 1px solid #e9ecef; background: #fff; }
  .filter-sub-body.open { display: flex; gap: 16px; flex-wrap: wrap; }
  .filter-sub-body .filter-group { min-width: 120px; flex: 1; }
  
  .result-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .listing-count { font-size: 14px; color: #495057; font-weight: 600; }
  .header-actions { display: flex; gap: 8px; }
  
  /* 📐 면적 변환 토글 스타일 */
  .area-toggle-btn { background: #343a40; border: none; border-radius: 6px; font-size: 12px; color: #fff; padding: 5px 12px; cursor: pointer; font-weight: 600; transition: background .2s; }
  .area-toggle-btn:hover { background: #212529; }
  .btn-reset { background: none; border: 1px solid #dee2e6; border-radius: 6px; font-size: 12px; color: #868e96; padding: 5px 12px; cursor: pointer; }
  .btn-reset:hover { background: #f1f3f5; border-color: #adb5bd; }
  
  .realtor-btn { background:#e7f5ff;color:#1971c2;border:1px solid #a5d8ff;border-radius:6px; padding:3px 10px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap; }
  .realtor-btn:hover { background:#d0ebff; }
</style>
</head>
<body>

<div class="container">
  <h1 id="title-banner">🏠 부동산 통합 모니터링 시스템</h1>
  <p class="sub">중개사 권역: {{ target_realtor }}</p>

  <div class="status-banner" id="status-banner">🤖 크롬 익스텐션 수집기가 백그라운드에서 데이터를 파싱 중입니다. 잠시만 기다려 주세요...</div>

  <div class="search-row">
    <input type="text" id="main-query" placeholder="단지명 입력 (예: 래미안부천어반비스타)" onkeydown="if(event.key==='Enter'&&!event.isComposing) doSearch()">
    <button class="btn-blue" id="search-btn" onclick="doSearch()">단지 검색</button>
  </div>
  
  <select class="complex-sel" id="main-sel" onchange="onSelChange()" style="display:none; width:100%; padding:11px 14px; border:1px solid #dee2e6; border-radius:8px; margin-bottom:12px; outline:none; background:#fff;"></select>
  <button class="btn-green" id="action-btn" onclick="doScrape()" style="display:none; width:100%; background:#2f9e44; color:#fff; border:none; border-radius:8px; padding:11px 20px; font-weight:bold; cursor:pointer; margin-bottom:24px;">선택한 단지 매물 전수조사 가동</button>

  <div class="nav">
    <button class="tab-btn active" onclick="switchTab('rank')">📊 순위 확인</button>
    <button class="tab-btn"        onclick="switchTab('listing')">🏠 매물 확인</button>
  </div>

  <div class="page active" id="page-rank">
    <div class="summary" id="r-summary"></div>
    <div class="rank-wrap">
      <table>
        <thead><tr><th>동</th><th>층</th><th>면적구분</th><th>가격</th><th>경쟁사</th><th>내 순위</th></tr></thead>
        <tbody id="r-tbody"><tr><td colspan="6" style="text-align:center;color:#868e96;padding:24px">단지를 검색하면 실시간 익스텐션 바인딩이 시작됩니다.</td></tr></tbody>
      </table>
    </div>
  </div>

  <div class="page" id="page-listing">
    <div class="listing-summary" id="l-summary"></div>
    
    <div class="filter-pro">
      <span class="filter-pro-title">🔥 실무 타겟팅</span>
      <button class="pro-btn" onclick="toggleProFilter('priceDrop', this)">📉 가격조정/급매</button>
      <button class="pro-btn" onclick="toggleProFilter('immediate', this)">🔑 즉시입주/공실</button>
      <button class="pro-btn" onclick="toggleProFilter('exclusiveOther', this)">🕵️ 타사 독점매물</button>
      <button class="pro-btn" onclick="toggleProFilter('owner', this)">✅ 집주인 인증</button>
      <button class="pro-btn" onclick="toggleProFilter('recent', this)">🕒 3일내 신규/갱신</button>
    </div>

    <div class="filter-main">
      <div class="filter-row">
        <div class="filter-group"><label>거래유형</label><select id="l-tradeFilter" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="filter-group"><label>동</label><select id="l-buildingFilter" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="filter-group"><label>방향</label><select id="l-directionFilter" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="filter-group"><label>구분</label><select id="l-gubnFilter" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="filter-group"><label>공인중개사무소</label><select id="l-realtorFilter" onchange="lRender()"><option value="">전체</option></select></div>
      </div>
    </div>

    <div class="filter-sub">
      <div class="filter-sub-header" onclick="toggleSubFilter()"><span>🔧 상세 필터</span><span class="toggle-icon">▼</span></div>
      <div class="filter-sub-body" id="l-sub-body">
        <div class="filter-group"><label>층구분</label><select id="l-floorFilter" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="filter-group"><label>방수</label><select id="l-roomFilter" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="filter-group"><label>욕실수</label><select id="l-bathFilter" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="filter-group"><label>연식</label><select id="l-ageFilter" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="filter-group"><label>특징</label><select id="l-featureFilter" onchange="lRender()"><option value="">전체</option></select></div>
      </div>
    </div>

    <div class="result-header">
      <span class="listing-count" id="l-count">0건</span>
      <div class="header-actions">
        <button class="area-toggle-btn" id="area-toggle-btn" onclick="toggleAreaUnit()">단위: ㎡</button>
        <button class="btn-reset" onclick="lResetFilters()">필터 초기화</button>
      </div>
    </div>

    <div class="listing-wrap">
      <table>
        <thead id="l-thead"></thead>
        <tbody id="l-tbody"></tbody>
      </table>
    </div>
  </div>
</div>

<script>
const MY_REALTOR = "{{ target_realtor }}";
let _lRows = [];
let _lCols = ["순번","동","거래유형","가격","구분","공급면적","면적구분","전용면적","층","층구분","총층수","방향","방수","욕실수","연식","특징","확인일","중개사수"];
let _rankResults = [];
let _currentRows = [];
let _lSortCol = null;
let _lSortAsc = true;
let pollInterval = null;

// 단위 변환 상태값
let _isPyung = false;

// 실무 핵심 필터 상태 객체
let _activeProFilters = {
  priceDrop: false,
  immediate: false,
  exclusiveOther: false,
  owner: false,
  recent: false
};

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById('page-' + name).classList.add('active');
}

function doSearch() {
  const q = document.getElementById('main-query').value.trim();
  if(!q) return;

  document.getElementById('search-btn').disabled = true;
  document.getElementById('search-btn').textContent = "검색 중...";
  document.getElementById('main-sel').style.display = 'none';
  document.getElementById('action-btn').style.display = 'none';
  
  document.getElementById('status-banner').style.display = 'block';
  document.getElementById('status-banner').textContent = "🔍 네이버 부동산에서 단지 식별 데이터를 가져오는 중...";

  window.postMessage({ type: "SEARCH_KEYWORD", keyword: q }, "*");
}

window.addEventListener("message", (event) => {
  if (event.data?.type === "SEARCH_RESULT") {
    const data = event.data.data;
    document.getElementById('search-btn').disabled = false;
    document.getElementById('search-btn').textContent = "단지 검색";

    if (data.error) {
      document.getElementById('status-banner').textContent = "❌ 검색 오류 발생: " + data.error;
      return;
    }
    if (!data || data.length === 0) {
      document.getElementById('status-banner').textContent = "❌ 검색 결과 조건에 일치하는 단지가 없습니다.";
      return;
    }

    if (data.length === 1) {
      document.getElementById('status-banner').textContent = "🚀 단일 타겟 단지 감지 완료. 자동 파싱 엔진을 구동합니다...";
      startExtensionShuttle(data[0].complexNo);
    } else {
      document.getElementById('status-banner').style.display = 'none';
      const sel = document.getElementById('main-sel');
      sel.innerHTML = '<option value="">정확한 분석 타겟 단지를 선택해 주세요</option>';
      data.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.complexNo;
        opt.textContent = c.complexName + (c.address ? ' (' + c.address + ')' : '');
        sel.appendChild(opt);
      });
      sel.style.display = 'block';
    }
  }
});

function onSelChange() {
  const v = document.getElementById('main-sel').value;
  document.getElementById('action-btn').style.display = v ? 'block' : 'none';
}

function doScrape() {
  const v = document.getElementById('main-sel').value;
  if (v) startExtensionShuttle(v);
}

function startExtensionShuttle(complexNo) {
  document.getElementById('main-sel').style.display = 'none';
  document.getElementById('action-btn').style.display = 'none';
  
  document.getElementById('status-banner').style.display = 'block';
  document.getElementById('status-banner').textContent = "🤖 크롬 익스텐션 수집기가 백그라운드에서 데이터를 파싱 중입니다. 잠시만 기다려 주세요...";

  fetch('/api/set-loading');
  window.postMessage({ type: "START_SCRAPING", complexNo: complexNo }, "*");
  
  if(pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(checkServerStatus, 1500);
}

async function checkServerStatus() {
  const res = await fetch('/api/status');
  const data = await res.json();
  if (data.status === "DONE") {
    clearInterval(pollInterval);
    document.getElementById('status-banner').style.display = 'none';
    document.getElementById('title-banner').textContent = "📊 조회 단지: " + data.complex_name;
    
    _lRows = data.article_results;
    _rankResults = data.rank_results;
    
    renderRankTab();
    initFiltersAndRenderListing();
  }
}

function card(label, value, cls) {
  return '<div class="card' + (cls ? ' ' + cls : '') + '"><div class="label">' + label + '</div><div class="value">' + value + '</div></div>';
}

function renderRankTab() {
  const warnCnt = _rankResults.filter(r => r.ranks.some(rk => rk.rank > 3)).length;
  const okCnt   = _rankResults.filter(r => r.ranks.every(rk => rk.rank <= 3)).length;

  document.getElementById('r-summary').innerHTML =
    card('참여 매물', _rankResults.length + '개', '') +
    card('끌올 필요', warnCnt + '건', warnCnt > 0 ? 'warn' : 'ok') +
    card('3위 이내', okCnt + '건', 'ok');

  // 🔥 [변경포인트 1] 끌올 필요(빨간색, rank > 3)가 있는 항목이 무조건 최상단으로 오도록 우선 정렬
  const sortedRankResults = [..._rankResults].sort((a, b) => {
    const aHasWarn = a.ranks.some(rk => rk.rank > 3);
    const bHasWarn = b.ranks.some(rk => rk.rank > 3);
    if (aHasWarn && !bHasWarn) return -1;
    if (!aHasWarn && bHasWarn) return 1;
    return 0;
  });

  let rows = [];
  sortedRankResults.forEach((r, rIdx) => {
    const hasWarn = r.ranks.some(rk => rk.rank > 3);
    const rankHtml = r.ranks.map(rk => {
      const w = rk.rank > 3;
      return '<span class="' + (w ? 'rank-warn' : 'rank-ok') + '">' + rk.rank + '위'
           + ' <span style="font-size:11px;font-weight:normal;color:#868e96">(' + rk.cp + ')</span></span>';
    }).join(' · ');

    // 🔥 [변경포인트 2] 동, 층, 면적구분을 각각 독립된 TD 컬럼으로 나누어 가독성 증대
    rows.push('<tr' + (hasWarn ? ' class="warn-row"' : '') + '>'
      + '<td>' + (r.building || '-') + '</td>'
      + '<td>' + (r.floor || '-') + '</td>'
      + '<td>' + r.area + (r.ranks.length > 1 ? ' <span style="color:#868e96;font-size:12px">(' + r.ranks.length + '건)</span>' : '') + '</td>'
      + '<td>' + r.price + '</td>'
      + '<td><button class="realtor-btn" data-ridx="' + rIdx + '">' + r.total + '곳</button></td>'
      + '<td>' + rankHtml + ' / ' + r.total + '곳' + (hasWarn ? '<span class="badge">끌올</span>' : '') + '</td></tr>');
  });

  const rTbody = document.getElementById('r-tbody');
  rTbody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="6" style="text-align:center;color:#868e96;padding:24px">우리 중개사무소의 매물이 확인되지 않습니다.</td></tr>';

  rTbody.querySelectorAll('.realtor-btn[data-ridx]').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      // 정렬된 배열(sortedRankResults)의 인덱스를 안전하게 매핑하여 바인딩
      const r = sortedRankResults[parseInt(this.dataset.ridx)];
      showRealtorPopup(this, r.realtors || []);
    });
  });
}

function initFiltersAndRenderListing() {
  const total = _lRows.length;
  const byTrade = {};
  _lRows.forEach(a => {
    const t = a['거래유형'] || '기타';
    byTrade[t] = (byTrade[t] || 0) + 1;
  });
  
  let summaryHtml = '<div class="ls-item"><div class="ls-label">총 매물수</div><div class="ls-value total">' + total + '</div></div>';
  ['매매','전세','월세'].forEach(t => {
    if (byTrade[t] != null) summaryHtml += '<div class="ls-item"><div class="ls-label">' + t + '</div><div class="ls-value">' + byTrade[t] + '</div></div>';
  });
  document.getElementById('l-summary').innerHTML = summaryHtml;

  function fillSel(id, key) {
    const vals = [...new Set(_lRows.map(a => a[key] || '').filter(Boolean))].sort();
    const el = document.getElementById(id);
    el.innerHTML = '<option value="">전체</option>';
    vals.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o); });
  }
  fillSel('l-tradeFilter',     '거래유형');
  fillSel('l-buildingFilter',  '동');
  fillSel('l-directionFilter', '방향');
  fillSel('l-floorFilter',     '층구분');
  fillSel('l-roomFilter',      '방수');
  fillSel('l-bathFilter',      '욕실수');
  fillSel('l-ageFilter',       '연식');
  fillSel('l-gubnFilter',      '구분');

  const realtorSet = new Set();
  _lRows.forEach(a => { (a['_중개사명목록'] || '').split('|').forEach(n => { if(n.trim()) realtorSet.add(n.trim()); }); });
  const rSel = document.getElementById('l-realtorFilter');
  rSel.innerHTML = '<option value="">전체</option>';
  [...realtorSet].sort().forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; rSel.appendChild(o); });

  const featureSet = new Set();
  _lRows.forEach(a => (a['특징'] || '').split(',').forEach(f => { const t = f.trim(); if(t) featureSet.add(t); }));
  const fSel = document.getElementById('l-featureFilter');
  fSel.innerHTML = '<option value="">전체</option>';
  [...featureSet].sort().forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; fSel.appendChild(o); });

  _lSortCol = null;
  lRender();
}

// 🔥 실무 핵심 필터 토글 함수
function toggleProFilter(key, btn) {
  _activeProFilters[key] = !_activeProFilters[key];
  btn.classList.toggle('active', _activeProFilters[key]);
  lRender();
}

// 📐 면적 단위 변환 함수
function toggleAreaUnit() {
  _isPyung = !_isPyung;
  document.getElementById('area-toggle-btn').textContent = _isPyung ? '단위: 평' : '단위: ㎡';
  lRender();
}

function lRender() {
  const trade = document.getElementById('l-tradeFilter').value;
  const building   = document.getElementById('l-buildingFilter').value;
  const direction  = document.getElementById('l-directionFilter').value;
  const floorGrade = document.getElementById('l-floorFilter').value;
  const room       = document.getElementById('l-roomFilter').value;
  const bath       = document.getElementById('l-bathFilter').value;
  const age        = document.getElementById('l-ageFilter').value;
  const gubn       = document.getElementById('l-gubnFilter').value;
  const feature    = document.getElementById('l-featureFilter').value;
  const realtor    = document.getElementById('l-realtorFilter').value;

  let rows = _lRows;
  
  // 1차: 일반 드롭다운 필터 적용
  if (trade)      rows = rows.filter(r => (r['거래유형'] || '') === trade);
  if (building)   rows = rows.filter(r => (r['동'] || '') === building);
  if (direction)  rows = rows.filter(r => (r['방향'] || '') === direction);
  if (floorGrade) rows = rows.filter(r => (r['층구분'] || '') === floorGrade);
  if (room)       rows = rows.filter(r => (r['방수'] || '') === room);
  if (bath)       rows = rows.filter(r => (r['욕실수'] || '') === bath);
  if (age)        rows = rows.filter(r => (r['연식'] || '') === age);
  if (gubn)       rows = rows.filter(r => (r['구분'] || '') === gubn);
  if (feature)    rows = rows.filter(r => (r['특징'] || '').split(',').map(s=>s.trim()).includes(feature));
  if (realtor)    rows = rows.filter(r => (r['_중개사명목록'] || '').split('|').map(s=>s.trim()).includes(realtor));

  // 2차: 🔥 실무 핵심 필터(다중교집합) 적용
  if (_activeProFilters.priceDrop) {
    rows = rows.filter(r => r['가격변동여부'] === true || (r['특징']||'').includes('급매'));
  }
  if (_activeProFilters.immediate) {
    rows = rows.filter(r => (r['입주유형']||'').includes('즉시') || (r['입주유형']||'').includes('공실') || (r['태그원문']||'').includes('즉시입주'));
  }
  if (_activeProFilters.exclusiveOther) {
    rows = rows.filter(r => r['중개사수'] === 1 && !(r['_중개사명목록']||'').includes(MY_REALTOR));
  }
  if (_activeProFilters.owner) {
    rows = rows.filter(r => (r['구분'] || '') === '집주인 직거래');
  }
  if (_activeProFilters.recent) {
    const now = new Date();
    rows = rows.filter(r => {
      if (!r['확인일']) return false;
      const parts = r['확인일'].split('.');
      if (parts.length !== 3) return false;
      const d = new Date(2000 + parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const diffDays = (now - d) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 4; // 최근 3일(+시간오차 여유)내
    });
  }

  // 3차: 정렬 로직
  if (_lSortCol) {
    rows = [...rows].sort((a, b) => {
      let va = a[_lSortCol] ?? '';
      let vb = b[_lSortCol] ?? '';

      if (_lSortCol === '가격') {
        const parsePrice = (str) => {
          if (!str) return 0;
          let target = String(str);
          if (target.includes('~')) {
            const parts = target.split('~');
            target = parts[1] ? parts[1].trim() : parts[0].trim();
          }
          if (target.includes('/')) {
            const [deposit, rent] = target.split('/');
            return parseKoreanAmount(deposit) + (parseKoreanAmount(rent) * 100);
          }
          return parseKoreanAmount(target);
        };

        const parseKoreanAmount = (priceStr) => {
          let s = priceStr.replace(/,/g, '').trim();
          if (s.includes('억')) {
            const parts = s.split('억');
            const eok = parseFloat(parts[0]) || 0;
            const man = parseFloat(parts[1]) || 0;
            return (eok * 10000) + man;
          }
          return parseFloat(s) || 0;
        };

        const na = parsePrice(va);
        const nb = parsePrice(vb);
        return _lSortAsc ? na - nb : nb - na;
      }

      const na = parseFloat(String(va).replace(/[^0-9.-]/g, ''));
      const nb = parseFloat(String(vb).replace(/[^0-9.-]/g, ''));
      const cmp = (!isNaN(na) && !isNaN(nb)) ? na - nb : String(va).localeCompare(String(vb), 'ko');
      return _lSortAsc ? cmp : -cmp;
    });
  }

  const lThead = document.getElementById('l-thead');
  lThead.innerHTML = '<tr>' + _lCols.map(c => {
    const sorted = _lSortCol === c;
    const icon   = sorted ? (_lSortAsc ? ' \u25b2' : ' \u25bc') : ' \u21c5';
    const esc    = c.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
    return '<th class="' + (sorted ? 'sorted' : '') + '" data-col="' + esc + '">' + c + '<span style="color:#adb5bd;font-size:10px">' + icon + '</span></th>';
  }).join('') + '</tr>';
  
  lThead.querySelectorAll('th[data-col]').forEach(th => { th.addEventListener('click', () => lSort(th.dataset.col)); });

  const tbody = document.getElementById('l-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="' + _lCols.length + '" style="text-align:center;color:#868e96;padding:24px">조건에 맞는 매물이 없습니다.</td></tr>';
    document.getElementById('l-count').textContent = '0건';
    return;
  }
  
  tbody.innerHTML = rows.map((row, rowIdx) => {
    return '<tr>' + _lCols.map(c => {
      if (c === '중개사수') {
        return '<td><button class="realtor-btn" data-row="' + rowIdx + '">' + (row['중개사수'] || 0) + '곳</button></td>';
      }
      
      let displayVal = String(row[c] ?? '');
      
      // 📐 렌더링 시점에 면적 단위(평형) 실시간 변환 로직 적용
      if ((c === '공급면적' || c === '전용면적') && _isPyung && displayVal.includes('㎡')) {
        const num = parseFloat(displayVal.replace('㎡', ''));
        if (!isNaN(num)) {
          displayVal = (num * 0.3025).toFixed(1) + '평';
        }
      }
      
      return '<td title="' + displayVal.replace(/"/g, '&quot;') + '">' + displayVal + '</td>';
    }).join('') + '</tr>';
  }).join('');

  _currentRows = rows;
  tbody.querySelectorAll('.realtor-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const row = _currentRows[parseInt(this.dataset.row)];
      showRealtorPopup(this, row['중개사목록'] || []);
    });
  });

  document.getElementById('l-count').textContent = '필터링 결과: ' + rows.length + '건 / 전체 ' + _lRows.length + '건';
}

function lSort(col) {
  if (_lSortCol === col) _lSortAsc = !_lSortAsc;
  else { _lSortCol = col; _lSortAsc = true; }
  lRender();
}

function toggleSubFilter() {
  document.querySelector('.filter-sub-header').classList.toggle('open');
  document.getElementById('l-sub-body').classList.toggle('open');
}

function lResetFilters() {
  // 일반 드롭다운 필터 초기화
  ['l-tradeFilter','l-buildingFilter','l-directionFilter','l-gubnFilter','l-realtorFilter','l-floorFilter','l-roomFilter','l-bathFilter','l-ageFilter','l-featureFilter'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  
  // 실무 프로 필터 초기화
  for (let key in _activeProFilters) {
    _activeProFilters[key] = false;
  }
  document.querySelectorAll('.pro-btn').forEach(btn => btn.classList.remove('active'));
  
  lRender();
}

function showRealtorPopup(btn, realtors) {
  closeRealtorPopup();

  const dim = document.createElement('div');
  dim.id = 'realtor-dim';
  dim.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.45);';
  dim.addEventListener('click', closeRealtorPopup);

  const modal = document.createElement('div');
  modal.id = 'realtor-popup';
  modal.style.cssText = 'position:fixed;z-index:9999;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.2);padding:24px 28px;width:360px;max-width:90vw;max-height:70vh;overflow-y:auto;';

  let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
           + '<span style="font-size:15px;font-weight:700;color:#212529;">공인중개사무소 목록</span>'
           + '<button id="popup-close-btn" style="background:none;border:none;cursor:pointer;font-size:20px;color:#adb5bd;line-height:1;padding:0;">&#x2715;</button>'
           + '</div>'
           + '<div style="font-size:12px;color:#868e96;margin-bottom:12px;">총 ' + realtors.length + '곳</div>';

  realtors.forEach((r, i) => {
    const isMine = r.name.includes(MY_REALTOR);
    const rowBg  = isMine ? 'background:#e7f5ff;border-radius:8px;padding:8px 10px;' : 'padding:8px 10px;';
    const nameStyle = isMine ? 'font-weight:700;color:#1971c2;' : 'color:#212529;';
    const badge = isMine ? '<span style="margin-left:6px;font-size:10px;background:#1971c2;color:#fff;padding:2px 7px;border-radius:8px;vertical-align:middle;">우리</span>' : '';
    const cp = r.cp ? '<div style="font-size:11px;color:#adb5bd;margin-top:2px;">' + r.cp + '</div>' : '';
    html += '<div style="border-top:' + (i === 0 ? 'none' : '1px solid #f1f3f5') + ';' + rowBg + '">'
          + '<div style="display:flex;align-items:center;">'
          + '<span style="font-size:12px;color:#adb5bd;margin-right:10px;min-width:20px;text-align:right;">' + (i + 1) + '</span>'
          + '<div><span style="font-size:13px;' + nameStyle + '">' + r.name + badge + '</span>' + cp + '</div>'
          + '</div></div>';
  });

  modal.innerHTML = html;
  document.body.appendChild(dim);
  document.body.appendChild(modal);
  modal.querySelector('#popup-close-btn').addEventListener('click', closeRealtorPopup);
}

function closeRealtorPopup() {
  const dim = document.getElementById('realtor-dim'); const pop = document.getElementById('realtor-popup');
  if (dim) dim.remove(); if (pop) pop.remove();
}
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeRealtorPopup(); });
</script>
</body>
</html>"""

@app.route('/')
def index():
    return render_template_string(HTML, target_realtor=TARGET_REALTOR)

@app.route('/api/status')
def api_status():
    return jsonify(_SHARED_DATA)

@app.route('/api/set-loading')
def api_set_loading():
    global _SHARED_DATA
    _SHARED_DATA = {"status": "LOADING", "complex_name": "수집 중...", "rank_results": [], "article_results": []}
    return jsonify({'ok': True})

@app.route('/api/upload', methods=['POST'])
def api_upload():
    global _SHARED_DATA
    try:
        payload = request.json
        rep_articles = payload.get('representativeArticles', {})
        article_order = payload.get('articleOrder', [])
        all_groups = payload.get('allGroups', {})
        complex_name = payload.get('complexName', '단지명')

        print("\n" + "="*60)
        print(f"📥 [Flask] 익스텐션에서 가공 완료된 {len(rep_articles)}개 데이터 패키지 최종 접수!")
        print("="*60)

        rank_results = []
        article_results = []
        idx = 0

        keys_to_process = article_order if article_order else list(rep_articles.keys())

        for article_no in keys_to_process:
            rep = rep_articles.get(str(article_no))
            if not rep:
                continue

            group = all_groups.get(str(article_no), [])
            if not group:
                continue

            my_ranks = []
            for item_idx, item in enumerate(group):
                if TARGET_REALTOR in item.get('realtorName', ''):
                    my_ranks.append({
                        'rank': item_idx + 1,
                        'cp': item.get('cpName', '기타').replace('부동산','')
                    })

            realtors_all = [
                {'name': item.get('realtorName',''), 'cp': item.get('cpName','')}
                for item in group if item.get('realtorName','')
            ]

            min_p = rep.get('sameAddrMinPrc', '')
            max_p = rep.get('sameAddrMaxPrc', '')
            if min_p and max_p and min_p != max_p:
                price_display = f"{min_p} ~ {max_p}"
            else:
                price_display = rep.get('dealOrWarrantPrc', '')

            if my_ranks:
                # 🔥 [변경포인트 3] rank_results 추출 시 원본 층수 정보('floorInfo') 필드 추가 탑재
                rank_results.append({
                    'building': rep.get('buildingName', ''),
                    'floor': rep.get('floorInfo', ''),
                    'area': rep.get('areaName', ''),
                    'price': price_display, 'total': len(group),
                    'ranks': my_ranks, 'realtors': realtors_all
                })

            merged = {**rep, **group[0]}
            row = flatten_article(merged, idx)
            idx += 1
            row['중개사수'] = len(realtors_all)
            row['중개사목록'] = realtors_all
            row['_중개사명목록'] = '|'.join(r['name'] for r in realtors_all)
            article_results.append(row)

        _SHARED_DATA = {
            "status": "DONE",
            "complex_name": complex_name,
            "rank_results": rank_results,
            "article_results": article_results
        }
        print("✅ [Flask] 대시보드 리스트 동기화 및 랭킹정렬 바인딩 완료!\n")
        return jsonify({'ok': True})

    except Exception as e:
        print("❌ [Flask] 접수 가공 중 예외 에러:")
        traceback.print_exc()
        return jsonify({'ok': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=False, port=5000, threaded=True)
