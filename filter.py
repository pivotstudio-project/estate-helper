# app.py (익스텐션 연동 전용 - 순수 대시보드 및 필터링 서버)
from flask import Flask, request, jsonify, render_template_string
import traceback

app = Flask(__name__)
TARGET_REALTOR = "국민공인중개사사무소"

_SHARED_DATA = {
    "status": "READY",
    "complex_name": "조회된 단지 없음",
    "rank_results": [],
    "article_results": []
}

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

    def strip_area(v):
        """숫자 또는 '59.8㎡' 형태 모두 수치로 변환"""
        if not v and v != 0: return None
        try: return float(str(v).replace("㎡","").replace(",","").strip())
        except: return None

    supply_raw   = raw.get("공급면적", "")
    exclusive_raw = raw.get("전용면적", "")
    supply_num   = strip_area(supply_raw)
    exclusive_num = strip_area(exclusive_raw)

    out["공급면적"] = (f"{supply_num:g}㎡"   if supply_num   is not None else "")
    out["면적구분"] = str(raw.get("면적구분") or raw.get("_면적명") or raw.get("areaName") or "")
    out["전용면적"] = (f"{exclusive_num:g}㎡" if exclusive_num is not None else "")
    out["_전용면적수치"] = exclusive_num if exclusive_num is not None else 0

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

    out["가격변동여부"] = bool(raw.get("_가격변동") or raw.get("_가격변경") or raw.get("_가격변경2") or raw.get("isPriceModification"))
    out["입주유형"] = str(raw.get("_입주유형") or raw.get("moveInTypeName") or "")

    return out

HTML = '''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>부동산 통합 모니터링 시스템</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "Apple SD Gothic Neo", sans-serif; font-size: 16px; background: #f0f2f5; min-height: 100vh; color: #212529; }

  .wrap { max-width: 1300px; margin: 0 auto; padding: 24px 24px 0; }

  .top-bar { display: flex; align-items: baseline; gap: 12px; margin-bottom: 18px; }
  .top-bar h1 { font-size: 22px; font-weight: 700; }
  .top-bar .sub { font-size: 14px; color: #868e96; }

  .search-row { display: flex; gap: 8px; margin-bottom: 18px; }
  .search-row input { flex: 1; padding: 12px 16px; border: 1px solid #dee2e6; border-radius: 10px; font-size: 16px; outline: none; background: #fff; }
  .search-row input:focus { border-color: #339af0; }
  .search-row button { padding: 12px 22px; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; background: #339af0; color: #fff; }
  .search-row button:hover { background: #228be6; }

  .status-banner { padding: 16px; background: #e7f5ff; color: #1971c2; border-radius: 10px; font-size: 15px; font-weight: 600; margin-bottom: 18px; display: none; text-align: center; }

  .nav { display: flex; border-bottom: 2px solid #e9ecef; margin-bottom: 20px; }
  .tab-btn { padding: 14px 24px; font-size: 15px; font-weight: 600; cursor: pointer; border: none; background: none; border-bottom: 3px solid transparent; color: #868e96; margin-bottom: -2px; transition: color .15s, border-color .15s; }
  .tab-btn.active { color: #339af0; border-bottom-color: #339af0; }
  .tab-btn:hover:not(.active) { color: #495057; }

  .page { display: none; }
  .page.active { display: block; }

  .summary { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
  .scard { background: #fff; border: 1px solid #e9ecef; border-radius: 10px; padding: 16px 22px; flex: 1; min-width: 100px; }
  .scard .sl { font-size: 13px; color: #868e96; margin-bottom: 4px; }
  .scard .sv { font-size: 28px; font-weight: 700; }
  .scard .sv.blue { color: #1971c2; }

  .pro-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 16px 20px; background: #fff; border: 1px solid #e9ecef; border-radius: 10px; margin-bottom: 12px; }
  .pro-label { font-size: 14px; font-weight: 700; color: #495057; margin-right: 4px; white-space: nowrap; }
  .pro-chip { padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid #dee2e6; background: #f8f9fa; color: #495057; transition: all .15s; }
  .pro-chip:hover { background: #e9ecef; }
  .pro-chip.active { background: #1971c2; color: #fff; border-color: #1971c2; }

  .filter-panel { background: #fff; border: 1px solid #e9ecef; border-radius: 10px; padding: 20px 24px; margin-bottom: 12px; }
  .filter-section-label { font-size: 12px; font-weight: 700; color: #868e96; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }
  .filter-divider { height: 1px; background: #f1f3f5; margin: 16px 0; }
  .filter-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
  .fg { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 130px; }
  .fg label { font-size: 13px; font-weight: 600; color: #495057; }
  .fg select { padding: 10px 12px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 15px; outline: none; background: #f8f9fa; color: #212529; }
  .fg select:focus { border-color: #339af0; background: #fff; }
  .range-pair { display: flex; align-items: center; gap: 6px; }
  .range-pair input[type=number] { flex: 1; padding: 10px 10px; border: 1px solid #dee2e6; border-radius: 8px; font-size: 15px; outline: none; background: #f8f9fa; color: #212529; width: 100%; }
  .range-pair input[type=number]:focus { border-color: #339af0; background: #fff; }
  .range-pair .sep { font-size: 14px; color: #adb5bd; white-space: nowrap; }
  .exclude-wrap { display: flex; align-items: center; gap: 8px; padding: 10px 0 2px; }
  .exclude-wrap input[type=checkbox] { width: 18px; height: 18px; accent-color: #1971c2; cursor: pointer; flex-shrink: 0; }
  .exclude-wrap label { font-size: 15px; font-weight: 600; color: #212529; cursor: pointer; }

  .result-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .result-hdr .cnt { font-size: 15px; color: #495057; font-weight: 600; }
  .result-hdr .actions { display: flex; gap: 8px; }
  .btn-sm { padding: 7px 14px; font-size: 14px; border: 1px solid #dee2e6; border-radius: 8px; cursor: pointer; background: #fff; color: #495057; font-weight: 500; }
  .btn-sm:hover { background: #f1f3f5; }

  .tbl-wrap { overflow: auto; border: 1px solid #e9ecef; border-radius: 10px; background: #fff; max-height: 60vh; margin-bottom: 40px; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; white-space: nowrap; font-size: 14px; }
  thead th { position: sticky; top: 0; z-index: 10; background: #f1f3f5; padding: 13px 16px; text-align: left; font-size: 13px; color: #495057; font-weight: 700; border-bottom: 1px solid #dee2e6; cursor: pointer; user-select: none; }
  thead th:hover { background: #e9ecef; }
  thead th.sorted { color: #339af0; }
  tbody td { padding: 15px 16px; font-size: 15px; border-bottom: 1px solid #f1f3f5; vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: #f8f9fa; }
  tbody tr.my-row td { background: #e7f5ff; }
  tbody tr.my-row:hover td { background: #d0ebff; }

  .trade-badge { display: inline-block; padding: 3px 9px; border-radius: 12px; font-size: 13px; font-weight: 700; }
  .trade-buy { background: #e7f5ff; color: #1971c2; }
  .trade-jn  { background: #f3f0ff; color: #5f3dc4; }
  .trade-rent{ background: #e6fcf5; color: #087f5b; }

  .realtor-btn { padding: 6px 12px; font-size: 13px; border: 1px solid #dee2e6; border-radius: 7px; cursor: pointer; background: #f8f9fa; color: #495057; font-weight: 600; white-space: nowrap; }
  .my-row .realtor-btn { background: #1971c2; color: #fff; border-color: #1971c2; }
  .realtor-btn:hover { background: #e9ecef; }
  .my-row .realtor-btn:hover { background: #1864ab; }

  .rank-summary { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
  .rank-card { background: #fff; border: 1px solid #e9ecef; border-radius: 10px; padding: 16px 22px; flex: 1; min-width: 100px; }
  .rank-card .rl { font-size: 13px; color: #868e96; margin-bottom: 4px; }
  .rank-card .rv { font-size: 28px; font-weight: 700; }
  .rank-card.warn .rv { color: #e03131; }
  .rank-card.ok .rv { color: #2f9e44; }
  .rank-wrap { overflow: auto; border: 1px solid #e9ecef; border-radius: 10px; background: #fff; max-height: 60vh; margin-bottom: 40px; }
  .rank-wrap table thead th { cursor: default; }
  .rank-ok { color: #2f9e44; font-weight: 700; }
  .rank-warn { color: #e03131; font-weight: 700; }
  .warn-row td { background: #fff5f5; }

  select, input { font-family: inherit; }
  input[type=number]::-webkit-inner-spin-button { opacity: 1; }
</style>
</head>
<body>
<div class="wrap">
  <div class="top-bar">
    <h1 id="title-banner">🏠 부동산 통합 모니터링</h1>
    <span class="sub">{{ target_realtor }}</span>
  </div>

  <div class="status-banner" id="status-banner"></div>

  <div class="search-row">
    <input type="text" id="main-query" placeholder="단지명 입력 (예: 래미안부천어반비스타)" onkeydown="if(event.key==='Enter'&&!event.isComposing) doSearch()">
    <button id="search-btn" onclick="doSearch()">단지 검색</button>
  </div>

  <select id="main-sel" onchange="onSelChange()" style="display:none; width:100%; padding:12px 16px; border:1px solid #dee2e6; border-radius:10px; margin-bottom:12px; outline:none; background:#fff; font-size:16px;"></select>
  <button id="action-btn" onclick="doScrape()" style="display:none; width:100%; background:#2f9e44; color:#fff; border:none; border-radius:10px; padding:13px 20px; font-size:16px; font-weight:700; cursor:pointer; margin-bottom:20px;">선택한 단지 매물 전수조사 가동</button>

  <div class="nav">
    <button class="tab-btn active" onclick="switchTab('rank', this)">📊 순위 확인</button>
    <button class="tab-btn"        onclick="switchTab('listing', this)">🏠 매물 확인</button>
  </div>

  <!-- 순위 탭 -->
  <div class="page active" id="page-rank">
    <div class="rank-summary" id="r-summary"></div>
    <div class="result-hdr">
      <span class="cnt" id="r-count"></span>
      <div class="actions"><button class="btn-sm" id="area-btn-rank" onclick="toggleAreaUnit()">단위: ㎡</button></div>
    </div>
    <div class="rank-wrap">
      <table>
        <thead><tr><th>동</th><th>층</th><th>전용면적</th><th>가격</th><th>경쟁사</th><th>내 순위 / 인증</th></tr></thead>
        <tbody id="r-tbody"><tr><td colspan="6" style="text-align:center;color:#868e96;padding:32px;font-size:15px;">단지를 검색하면 실시간 데이터가 표시됩니다.</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- 매물 확인 탭 -->
  <div class="page" id="page-listing">

    <div class="summary" id="l-summary" style="display:none;"></div>

    <div class="pro-bar">
      <span class="pro-label">🔥 실무 타겟팅</span>
      <button class="pro-chip" onclick="togglePro('priceDrop', this)">📉 가격조정/급매</button>
      <button class="pro-chip" onclick="togglePro('immediate', this)">🔑 즉시입주/공실</button>
      <button class="pro-chip" onclick="togglePro('exclusiveOther', this)">🕵️ 타사 독점매물</button>
      <button class="pro-chip" onclick="togglePro('owner', this)">✅ 집주인 인증</button>
      <button class="pro-chip" onclick="togglePro('recent', this)">🕒 3일내 신규/갱신</button>
    </div>

    <div class="filter-panel">
      <div class="filter-section-label">주요 필터</div>
      <div class="filter-row">
        <div class="fg"><label>거래유형</label><select id="f-trade" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="fg"><label>동</label><select id="f-building" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="fg"><label>공인중개사무소</label><select id="f-realtor" onchange="lRender()"><option value="">전체</option></select></div>
      </div>

      <div class="filter-divider"></div>
      <div class="filter-section-label">금액 필터</div>
      <div class="filter-row">
        <div class="fg" style="flex:2;min-width:220px;">
          <label>매물 가격 (단위: 만원)</label>
          <div class="range-pair">
            <input type="number" id="f-price-min" placeholder="이상" oninput="lRender()" />
            <span class="sep">~</span>
            <input type="number" id="f-price-max" placeholder="이하" oninput="lRender()" />
          </div>
        </div>
        <div class="fg" style="flex:2;min-width:220px;">
          <label>월세 (단위: 만원)</label>
          <div class="range-pair">
            <input type="number" id="f-rent-min" placeholder="최소" oninput="lRender()" />
            <span class="sep">~</span>
            <input type="number" id="f-rent-max" placeholder="최대" oninput="lRender()" />
          </div>
        </div>
        <div class="fg" style="min-width:130px;">
          <label style="opacity:0;user-select:none;">제외</label>
          <div class="exclude-wrap">
            <input type="checkbox" id="f-exc-seango" onchange="lRender()" />
            <label for="f-exc-seango">세안고 제외</label>
          </div>
        </div>
      </div>

      <div class="filter-divider"></div>
      <div class="filter-section-label">상세 필터</div>
      <div class="filter-row">
        <div class="fg"><label>방향</label><select id="f-direction" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="fg"><label>방수</label><select id="f-room" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="fg"><label>욕실수</label><select id="f-bath" onchange="lRender()"><option value="">전체</option></select></div>
        <div class="fg"><label>특징</label><select id="f-feature" onchange="lRender()"><option value="">전체</option></select></div>
      </div>
    </div>

    <div class="result-hdr">
      <span class="cnt" id="l-count">0건</span>
      <div class="actions">
        <button class="btn-sm" id="area-btn-list" onclick="toggleAreaUnit()">단위: ㎡</button>
        <button class="btn-sm" onclick="lResetFilters()">필터 초기화</button>
      </div>
    </div>

    <div class="tbl-wrap">
      <table>
        <thead id="l-thead"></thead>
        <tbody id="l-tbody"><tr><td colspan="15" style="text-align:center;color:#868e96;padding:32px;font-size:15px;">단지를 검색하면 매물 목록이 표시됩니다.</td></tr></tbody>
      </table>
    </div>
  </div>
</div>

<script>
const MY_REALTOR = "{{ target_realtor }}";
const COLS = ["동","층","총층수","공급면적","전용면적","면적구분","거래유형","가격","중개사수","확인일","층구분","방향","방수","욕실수","특징"];

let _lRows = [], _rankResults = [], _currentRows = [];
let _lSortCol = null, _lSortAsc = true, _isPyung = false;
let _proFilters = {priceDrop:false,immediate:false,exclusiveOther:false,owner:false,recent:false};
let pollInterval = null;

function switchTab(name, btn) {
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("page-"+name).classList.add("active");
}

function doSearch() {
  const q = document.getElementById("main-query").value.trim();
  if (!q) return;
  const sbtn = document.getElementById("search-btn");
  sbtn.disabled = true; sbtn.textContent = "검색 중...";
  document.getElementById("main-sel").style.display = "none";
  document.getElementById("action-btn").style.display = "none";
  showBanner("🔍 네이버 부동산에서 단지 식별 데이터를 가져오는 중...");
  window.postMessage({type:"SEARCH_KEYWORD",keyword:q},"*");
}

window.addEventListener("message", (event) => {
  if (event.data?.type !== "SEARCH_RESULT") return;
  const data = event.data.data;
  const sbtn = document.getElementById("search-btn");
  sbtn.disabled = false; sbtn.textContent = "단지 검색";
  if (data.error) { showBanner("❌ 검색 오류: "+data.error); return; }
  if (!data || !data.length) { showBanner("❌ 조건에 맞는 단지가 없습니다."); return; }
  if (data.length === 1) {
    showBanner("🚀 단일 타겟 단지 감지. 자동 파싱 엔진을 구동합니다...");
    startExtensionShuttle(data[0].complexNo);
  } else {
    hideBanner();
    const sel = document.getElementById("main-sel");
    sel.innerHTML = "<option value=''>정확한 분석 타겟 단지를 선택해 주세요</option>";
    data.forEach(c => {
      const o = document.createElement("option");
      o.value = c.complexNo;
      o.textContent = c.complexName + (c.address?" ("+c.address+")":"");
      sel.appendChild(o);
    });
    sel.style.display = "block";
  }
});

function onSelChange() {
  document.getElementById("action-btn").style.display = document.getElementById("main-sel").value ? "block":"none";
}
function doScrape() {
  const v = document.getElementById("main-sel").value;
  if (v) startExtensionShuttle(v);
}
function startExtensionShuttle(complexNo) {
  document.getElementById("main-sel").style.display = "none";
  document.getElementById("action-btn").style.display = "none";
  showBanner("🤖 크롬 익스텐션 수집기가 백그라운드에서 데이터를 파싱 중입니다. 잠시만 기다려 주세요...");
  fetch("/api/set-loading");
  window.postMessage({type:"START_SCRAPING",complexNo},"*");
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(checkServerStatus, 1500);
}
async function checkServerStatus() {
  const res = await fetch("/api/status");
  const data = await res.json();
  if (data.status === "DONE") {
    clearInterval(pollInterval);
    hideBanner();
    document.getElementById("title-banner").textContent = "📊 조회 단지: " + data.complex_name;
    _lRows = data.article_results;
    _rankResults = data.rank_results;
    renderRankTab();
    initFiltersAndRender();
  }
}
function showBanner(msg) { const b=document.getElementById("status-banner"); b.textContent=msg; b.style.display="block"; }
function hideBanner() { document.getElementById("status-banner").style.display="none"; }

function toggleAreaUnit() {
  _isPyung = !_isPyung;
  const label = _isPyung ? "단위: 평" : "단위: ㎡";
  ["area-btn-rank","area-btn-list"].forEach(id => {
    const el=document.getElementById(id); if(el) el.textContent=label;
  });
  renderRankTab();
  lRender();
}

function togglePro(key, btn) {
  _proFilters[key] = !_proFilters[key];
  btn.classList.toggle("active", _proFilters[key]);
  lRender();
}

function renderRankTab() {
  const warnCnt = _rankResults.filter(r=>r.ranks.some(rk=>rk.rank>3)).length;
  const okCnt   = _rankResults.filter(r=>r.ranks.every(rk=>rk.rank<=3)).length;
  document.getElementById("r-summary").innerHTML =
    mkRC("참여 매물", _rankResults.length+"개", "") +
    mkRC("끌올 필요", warnCnt+"건", warnCnt>0?"warn":"ok") +
    mkRC("3위 이내",  okCnt+"건", "ok");
  document.getElementById("r-count").textContent = "총 "+_rankResults.length+"건";

  const sorted = [..._rankResults].sort((a,b)=>{
    const aw=a.ranks.some(r=>r.rank>3), bw=b.ranks.some(r=>r.rank>3);
    return aw===bw?0:aw?-1:1;
  });

  const rows = sorted.map((r,rIdx)=>{
    const hasWarn = r.ranks.some(rk=>rk.rank>3);
    const rankHtml = r.ranks.map((rk,i)=>{
      const w=rk.rank>3;
      let badges="";
      if(rk.is_owner) badges+="<span style='background:#ffe3e3;color:#e03131;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;margin-left:4px;'>집주인</span>";
      if(rk.is_site)  badges+="<span style='background:#d3f9d8;color:#2b8a3e;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;margin-left:4px;'>현장</span>";
      const border = i<r.ranks.length-1?"border-bottom:1px dashed #e9ecef;margin-bottom:8px;padding-bottom:8px;":"";
      return "<div style='"+border+"display:flex;flex-direction:column;gap:4px;'>"
        +"<div style='display:flex;align-items:center;gap:6px;'>"
        +"<span class='"+(w?"rank-warn":"rank-ok")+"' style='font-size:15px;'>"+rk.rank+"위</span>"
        +"<span style='font-size:12px;color:#868e96;'>("+rk.cp+")</span>"+badges+"</div>"
        +(rk.date?"<div style='font-size:13px;color:#adb5bd;'>확인: "+rk.date+"</div>":"")
        +"</div>";
    }).join("");

    let aDisp = String(r.exclusiveArea||r.area||"");
    const aN = parseFloat(aDisp.replace(/[^0-9.]/g,""));
    if (!isNaN(aN)) aDisp = _isPyung ? Math.round(aN*0.3025)+"평" : aN+"㎡";

    return "<tr"+(hasWarn?" class='warn-row'":"")+">"
      +"<td style='font-size:15px;'>"+(r.building||"-")+"</td>"
      +"<td style='font-size:15px;'>"+(r.floor||"-")+"</td>"
      +"<td style='font-size:15px;'>"+aDisp+(r.ranks.length>1?"<div style='color:#868e96;font-size:12px;'>(동일 "+r.ranks.length+"건)</div>":"")+"</td>"
      +"<td style='font-weight:700;font-size:15px;'>"+r.price+"</td>"
      +"<td><button class='realtor-btn' data-ridx='"+rIdx+"'>경쟁 "+r.total+"곳</button></td>"
      +"<td>"+rankHtml+"</td></tr>";
  });

  const tb = document.getElementById("r-tbody");
  tb.innerHTML = rows.length ? rows.join("") : "<tr><td colspan='6' style='text-align:center;color:#868e96;padding:32px;font-size:15px;'>우리 중개사무소의 매물이 확인되지 않습니다.</td></tr>";
  tb.querySelectorAll(".realtor-btn[data-ridx]").forEach(btn=>{
    btn.addEventListener("click", function(e){
      e.stopPropagation();
      showRealtorPopup(sorted[parseInt(this.dataset.ridx)].realtors||[]);
    });
  });
}
function mkRC(label,value,cls) {
  return "<div class='rank-card"+(cls?" "+cls:"")+"'><div class='rl'>"+label+"</div><div class='rv'>"+value+"</div></div>";
}

function initFiltersAndRender() {
  const total = _lRows.length;
  if (total > 0) {
    const bt = {};
    _lRows.forEach(a=>{ const t=a["거래유형"]||"기타"; bt[t]=(bt[t]||0)+1; });
    let html = "<div class='scard'><div class='sl'>총 매물수</div><div class='sv blue'>"+total+"</div></div>";
    ["매매","전세","월세"].forEach(t=>{ if(bt[t]!=null) html+="<div class='scard'><div class='sl'>"+t+"</div><div class='sv'>"+bt[t]+"</div></div>"; });
    document.getElementById("l-summary").innerHTML = html;
    document.getElementById("l-summary").style.display = "flex";
  } else {
    document.getElementById("l-summary").style.display = "none";
  }
  fillSel("f-trade","거래유형"); fillSel("f-building","동");
  fillSel("f-direction","방향"); fillSel("f-room","방수"); fillSel("f-bath","욕실수");

  const rs = new Set();
  _lRows.forEach(a=>(a["_중개사명목록"]||"").split("|").forEach(n=>{ if(n.trim()) rs.add(n.trim()); }));
  const rSel=document.getElementById("f-realtor");
  rSel.innerHTML="<option value=''>전체</option>";
  [...rs].sort().forEach(v=>{ const o=document.createElement("option"); o.value=v; o.textContent=v; rSel.appendChild(o); });

  const fs=new Set();
  _lRows.forEach(a=>(a["특징"]||"").split(",").forEach(f=>{ const t=f.trim(); if(t) fs.add(t); }));
  const fSel=document.getElementById("f-feature");
  fSel.innerHTML="<option value=''>전체</option>";
  [...fs].sort().forEach(v=>{ const o=document.createElement("option"); o.value=v; o.textContent=v; fSel.appendChild(o); });

  _lSortCol=null; lRender();
}

function fillSel(id,key) {
  const vals=[...new Set(_lRows.map(a=>a[key]||"").filter(Boolean))].sort();
  const el=document.getElementById(id);
  el.innerHTML="<option value=''>전체</option>";
  vals.forEach(v=>{ const o=document.createElement("option"); o.value=v; o.textContent=v; el.appendChild(o); });
}

function parseKP(str) {
  if (!str) return 0;
  let s=String(str).replace(/,/g,"").trim();
  if (s.includes("~")) s=s.split("~")[1].trim();
  if (s.includes("/")) s=s.split("/")[0].trim();
  if (s.includes("억")) { const p=s.split("억"); return parseFloat(p[0]||0)*10000+(parseFloat(p[1])||0); }
  return parseFloat(s)||0;
}
function parseRent(str) {
  if (!str) return 0;
  const s=String(str);
  if (!s.includes("/")) return 0;
  return parseFloat(s.split("/")[1].replace(/[^0-9.]/g,""))||0;
}

function lRender() {
  const trade   =document.getElementById("f-trade").value;
  const building=document.getElementById("f-building").value;
  const realtor =document.getElementById("f-realtor").value;
  const dir     =document.getElementById("f-direction").value;
  const room    =document.getElementById("f-room").value;
  const bath    =document.getElementById("f-bath").value;
  const feat    =document.getElementById("f-feature").value;

  const pMin    =parseFloat(document.getElementById("f-price-min").value)||null;
  const pMax    =parseFloat(document.getElementById("f-price-max").value)||null;

  const rMin    =parseFloat(document.getElementById("f-rent-min").value)||null;
  const rMax    =parseFloat(document.getElementById("f-rent-max").value)||null;

  const excS    =document.getElementById("f-exc-seango").checked;

  let rows=_lRows;

  if(trade)
    rows=rows.filter(r=>(r["거래유형"]||"")===trade);

  if(building)
    rows=rows.filter(r=>(r["동"]||"")===building);

  if(realtor)
    rows=rows.filter(r=>(r["_중개사명목록"]||"")
      .split("|")
      .map(s=>s.trim())
      .includes(realtor));

  if(dir)
    rows=rows.filter(r=>(r["방향"]||"")===dir);

  if(room)
    rows=rows.filter(r=>(r["방수"]||"")===room);

  if(bath)
    rows=rows.filter(r=>(r["욕실수"]||"")===bath);

  if(feat)
    rows=rows.filter(r=>(r["특징"]||"")
      .split(",")
      .map(s=>s.trim())
      .includes(feat));

  if(pMin!==null)
    rows=rows.filter(r=>parseKP(r["가격"])>=pMin);

  if(pMax!==null)
    rows=rows.filter(r=>parseKP(r["가격"])<=pMax);

  if(rMin!==null)
    rows=rows.filter(r=>parseRent(r["가격"])>=rMin);

  if(rMax!==null)
    rows=rows.filter(r=>parseRent(r["가격"])<=rMax);

  if(excS)
    rows=rows.filter(r=>!(r["특징"]||"").includes("세안고"));

  if(_proFilters.priceDrop)
    rows=rows.filter(r=>
      r["가격변동여부"]===true ||
      (r["특징"]||"").includes("급매")
    );

  if(_proFilters.immediate)
    rows=rows.filter(r=>
      (r["입주유형"]||"").includes("즉시") ||
      (r["입주유형"]||"").includes("공실") ||
      (r["태그원문"]||"").includes("즉시입주")
    );

  if(_proFilters.exclusiveOther)
    rows=rows.filter(r=>
      r["중개사수"]===1 &&
      !(r["_중개사명목록"]||"").includes(MY_REALTOR)
    );

  if(_proFilters.owner)
    rows=rows.filter(r=>
      (r["구분"]||"")==="집주인 직거래"
    );

  if(_proFilters.recent){
    const now=new Date();

    rows=rows.filter(r=>{
      if(!r["확인일"]) return false;

      const p=r["확인일"].split(".");
      if(p.length!==3) return false;

      const d=new Date(
        2000+parseInt(p[0]),
        parseInt(p[1])-1,
        parseInt(p[2])
      );

      return (now-d)/864e5>=0 &&
             (now-d)/864e5<=4;
    });
  }

  if(_lSortCol){
    rows=[...rows].sort((a,b)=>{
      let va=a[_lSortCol]??"";
      let vb=b[_lSortCol]??"";

      if(_lSortCol==="가격"){
        const d=parseKP(va)-parseKP(vb);
        return _lSortAsc ? d : -d;
      }

      const na=parseFloat(String(va).replace(/[^0-9.-]/g,""));
      const nb=parseFloat(String(vb).replace(/[^0-9.-]/g,""));

      const c=
        (!isNaN(na)&&!isNaN(nb))
          ? na-nb
          : String(va).localeCompare(String(vb),"ko");

      return _lSortAsc ? c : -c;
    });
  }

  const thead=document.getElementById("l-thead");

  thead.innerHTML=
    "<tr>"+
    COLS.map(c=>{
      const s=_lSortCol===c;
      const icon=s?(_lSortAsc?"▲":"▼"):"⇅";

      return "<th class='"+(s?"sorted":"")+"' data-col='"+c+"'>"+
        c+
        " <span style='font-size:11px;color:#adb5bd;'>"+
        icon+
        "</span></th>";
    }).join("")+
    "</tr>";

  thead.querySelectorAll("th[data-col]")
    .forEach(th=>
      th.addEventListener("click",()=>lSort(th.dataset.col))
    );

  const tbody=document.getElementById("l-tbody");

  if(!rows.length){
    tbody.innerHTML=
      "<tr><td colspan='"+COLS.length+"' style='text-align:center;color:#868e96;padding:32px;font-size:15px;'>조건에 맞는 매물이 없습니다.</td></tr>";

    document.getElementById("l-count").textContent="0건";
    _currentRows=[];
    return;
  }

  const TRADE_CLS = {
    "매매":"trade-buy",
    "전세":"trade-jn",
    "월세":"trade-rent"
  };

  tbody.innerHTML=rows.map((row,ri)=>{
    const isMine=(row["_중개사명목록"]||"")
      .includes(MY_REALTOR);

    return "<tr"+(isMine?" class='my-row'":"")+">"
      +COLS.map(c=>{

        if(c==="중개사수"){
          return "<td><button class='realtor-btn' data-row='"+ri+"'>"+
            (row["중개사수"]||0)+"곳</button></td>";
        }

        if(c==="거래유형"){
          const t=row[c]||"";

          return "<td><span class='trade-badge "+
            (TRADE_CLS[t]||"")+"'>"+
            t+
            "</span></td>";
        }

        let val=String(row[c]??"");

        if(
          (c==="공급면적"||c==="전용면적") &&
          _isPyung &&
          val.includes("㎡")
        ){
          const n=parseFloat(val.replace("㎡",""));

          if(!isNaN(n))
            val=Math.round(n*0.3025)+"평";
        }

        return "<td"+
          (c==="가격"?" style='font-weight:700;'":"")+
          " title='"+val.replace(/'/g,"&#39;")+"'>"+
          val+
          "</td>";

      }).join("")+
      "</tr>";
  }).join("");

  _currentRows=rows;

  tbody.querySelectorAll(".realtor-btn[data-row]")
    .forEach(btn=>{
      btn.addEventListener("click",function(e){
        e.stopPropagation();

        showRealtorPopup(
          _currentRows[parseInt(this.dataset.row)]["중개사목록"]||[]
        );
      });
    });

  document.getElementById("l-count").textContent=
    "필터링 결과: "+rows.length+
    "건 / 전체 "+_lRows.length+"건";
}

function lSort(col){
  if(_lSortCol===col) _lSortAsc=!_lSortAsc; else{_lSortCol=col;_lSortAsc=true;}
  lRender();
}

function lResetFilters(){

  [
    "f-trade",
    "f-building",
    "f-direction",
    "f-room",
    "f-bath",
    "f-feature",
    "f-realtor"
  ].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value="";
  });

  [
    "f-price-min",
    "f-price-max",
    "f-rent-min",
    "f-rent-max"
  ].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value="";
  });

  document.getElementById("f-exc-seango").checked=false;

  for(let k in _proFilters)
    _proFilters[k]=false;

  document.querySelectorAll(".pro-chip")
    .forEach(b=>b.classList.remove("active"));

  lRender();
}

function showRealtorPopup(realtors){
  closeRealtorPopup();
  const dim=document.createElement("div");
  dim.id="rdim";
  dim.style.cssText="position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.45);";
  dim.onclick=closeRealtorPopup;
  const pop=document.createElement("div");
  pop.id="rpop";
  pop.style.cssText="position:fixed;z-index:9999;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,.2);padding:24px 28px;width:440px;max-width:92vw;max-height:75vh;overflow-y:auto;";

  let html="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;'>"
    +"<span style='font-size:17px;font-weight:700;'>공인중개사무소 목록</span>"
    +"<button id='rclose' style='background:none;border:none;cursor:pointer;font-size:22px;color:#adb5bd;line-height:1;'>&#x2715;</button>"
    +"</div>"
    +"<div style='font-size:13px;color:#868e96;margin-bottom:12px;'>동일 매물 등록 중개사 총 "+realtors.length+"곳</div>";

  realtors.forEach((r,i)=>{
    const isMine=r.name.includes(MY_REALTOR);
    const bg=isMine?"background:#e7f5ff;border-radius:9px;":"";
    const nc=isMine?"color:#1971c2;font-weight:700;":"color:#212529;";
    const badge=isMine?"<span style='margin-left:6px;font-size:11px;background:#1971c2;color:#fff;padding:2px 8px;border-radius:8px;'>우리</span>":"";
    let xb="";
    if(r.is_owner) xb+="<span style='margin-left:5px;font-size:11px;background:#ffe3e3;color:#e03131;padding:2px 7px;border-radius:5px;font-weight:700;'>집주인</span>";
    if(r.is_site)  xb+="<span style='margin-left:5px;font-size:11px;background:#d3f9d8;color:#2b8a3e;padding:2px 7px;border-radius:5px;font-weight:700;'>현장</span>";
    const cp=r.cp?"<span style='font-size:12px;color:#adb5bd;margin-left:6px;'>("+r.cp+")</span>":"";
    const date=r.date?"<div style='font-size:13px;color:#adb5bd;margin-top:5px;'>확인매물: "+r.date+"</div>":"";
    const border=i<realtors.length-1?"border-bottom:1px solid #f1f3f5;":"";
    html+="<div style='padding:12px;"+border+bg+"'>"
      +"<div style='display:flex;align-items:flex-start;'>"
      +"<div style='font-size:14px;color:#adb5bd;width:26px;font-weight:700;margin-top:2px;'>"+(i+1)+"</div>"
      +"<div style='flex:1;'><div style='display:flex;align-items:center;flex-wrap:wrap;'><span style='font-size:15px;"+nc+"'>"+r.name+"</span>"+badge+xb+cp+"</div>"+date+"</div>"
      +"</div></div>";
  });

  pop.innerHTML=html;
  document.body.appendChild(dim);
  document.body.appendChild(pop);
  pop.querySelector("#rclose").onclick=closeRealtorPopup;
}
function closeRealtorPopup(){
  ["rdim","rpop"].forEach(id=>{const el=document.getElementById(id);if(el)el.remove();});
}
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeRealtorPopup();});
</script>
</body>
</html>'''

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

        print(f"[DEBUG] rep={len(rep_articles)} / order={len(article_order)} / groups={len(all_groups)}")

        complex_name = payload.get('complexName', '단지명')

        rank_results = []
        article_results = []
        idx = 0

        keys_to_process = article_order if article_order else list(rep_articles.keys())

        for article_no in keys_to_process:
            rep = rep_articles.get(str(article_no))
            if not rep: continue
            group = all_groups.get(str(article_no), [])
            if not group: continue

            my_ranks = []
            for item_idx, item in enumerate(group):
                verif = str(item.get('verificationTypeCode', ''))
                is_owner = (verif == 'OWNER') or bool(item.get('tradeCheckedByOwner'))
                is_site  = (verif == 'SITE')  or bool(item.get('siteImageCount'))
                c_date   = fmt_date(item.get('articleConfirmYmd', ''))
                if TARGET_REALTOR in item.get('realtorName', ''):
                    my_ranks.append({
                        'rank': item_idx + 1,
                        'cp': item.get('cpName', '기타').replace('부동산',''),
                        'is_owner': is_owner,
                        'is_site': is_site,
                        'date': c_date
                    })

            realtors_all = []
            for item in group:
                if item.get('realtorName', ''):
                    verif = str(item.get('verificationTypeCode', ''))
                    realtors_all.append({
                        'name': item.get('realtorName', ''),
                        'cp': item.get('cpName', ''),
                        'is_owner': (verif == 'OWNER') or bool(item.get('tradeCheckedByOwner')),
                        'is_site':  (verif == 'SITE')  or bool(item.get('siteImageCount')),
                        'date': fmt_date(item.get('articleConfirmYmd', ''))
                    })

            min_p = rep.get('sameAddrMinPrc', '')
            max_p = rep.get('sameAddrMaxPrc', '')
            price_display = f"{min_p} ~ {max_p}" if min_p and max_p and min_p != max_p else rep.get('dealOrWarrantPrc', '')

            if my_ranks:
                rank_results.append({
                    'building': rep.get('buildingName', ''),
                    'floor': rep.get('floorInfo', ''),
                    'area': rep.get('areaName', ''),
                    'exclusiveArea': rep.get('exclusiveArea', ''),
                    'price': price_display,
                    'total': len(group),
                    'ranks': my_ranks,
                    'realtors': realtors_all
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
        return jsonify({'ok': True})

    except Exception as e:
        traceback.print_exc()
        return jsonify({'ok': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=False, port=5000, threaded=True)
