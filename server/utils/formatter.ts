import { FIELD_MAP } from './store';

export function translateKey(key: string): string {
  return FIELD_MAP[key] || key;
}

export function fmtDate(raw: any): string {
  const s = String(raw || '').trim();
  if (s.length === 8 && /^\d+$/.test(s)) {
    return `${s.substring(2, 4)}.${s.substring(4, 6)}.${s.substring(6, 8)}`;
  }
  return s;
}

// [추가된 헬퍼] 문자열 금액을 비교/정렬용 숫자로 정밀 변환
function parseKP(str: string): number {
  if (!str) return 0;
  let s = String(str).replace(/,/g, "").trim();
  if (s.includes("~")) s = s.split("~")[1].trim();
  if (s.includes("/")) s = s.split("/")[0].trim();
  if (s.includes("억")) {
    const p = s.split("억");
    return parseFloat(p[0] || '0') * 10000 + (parseFloat(p[1]) || 0);
  }
  return parseFloat(s) || 0;
}

function parseRent(str: string): number {
  if (!str) return 0;
  const s = String(str);
  if (!s.includes("/")) return 0;
  return parseFloat(s.split("/")[1].replace(/[^0-9.]/g, "")) || 0;
}

export function flattenArticle(article: any, idx: number = 0) {
  const raw: any = {};

  for (const [k, v] of Object.entries(article)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as object)) raw[translateKey(k2)] = v2;
    } else if (Array.isArray(v)) {
      raw[translateKey(k)] = v.join(', ');
    } else {
      raw[translateKey(k)] = v;
    }
  }

  const out: any = { 순번: idx, 단지명: raw.단지명 || "", 동: raw.동 || "", 거래유형: raw.거래유형 || "" };

  const min_p = raw._동일최저가 || "";
  const max_p = raw._동일최고가 || "";
  const trade = raw.거래유형 || "";

  if (min_p && max_p && min_p !== max_p) {
    out.가격 = `${min_p} ~ ${max_p}`;
  } else {
    const price = raw.가격 || "";
    const warrant = raw._보증금 || "";
    const rent = raw._월세 || "";
    out.가격 = (trade === "월세" && warrant && rent) ? `${warrant}/${rent}` : price;
  }

  // ====== [안정적인 원천 데이터 숫자형 필드 변환 및 중복/오버라이드 제거] ======
  if (trade === "월세") {
    out._rawPrice = parseKP(raw._보증금 || out.가격);
    out._rawRent = parseFloat(String(raw._월세 || '0').replace(/[^0-9.-]/g, '')) || parseRent(out.가격);
  } else {
    out._rawPrice = parseKP(out.가격);
    out._rawRent = 0;
  }

  // 날짜 비교용 밀리초 타임스탬프 고유 가공
  const confirmRaw = String(raw._확인일자원문 || '').trim();
  if (confirmRaw.length === 8 && /^\d+$/.test(confirmRaw)) {
    const y = parseInt(confirmRaw.substring(0, 4));
    const m = parseInt(confirmRaw.substring(4, 6)) - 1;
    const d = parseInt(confirmRaw.substring(6, 8));
    out._confirmTimestamp = new Date(y, m, d).getTime();
  } else {
    out._confirmTimestamp = 0;
  }
  // ===================================================================

  const is_direct = raw._직거래여부 || false;
  const verif = String(raw._인증유형 || "");
  out.구분 = is_direct ? "직거래" : (verif === "OWNER" ? "집주인 직거래" : "중개");

  const stripArea = (v: any) => {
    if (v == null || v === "") return null;
    const num = parseFloat(String(v).replace(/㎡/g, "").replace(/,/g, "").trim());
    return isNaN(num) ? null : num;
  };

  const supply_num = stripArea(raw.공급면적);
  const exclusive_num = stripArea(raw.전용면적);

  out.공급면적 = supply_num !== null ? `${supply_num}㎡` : "";
  out.면적구분 = String(raw.면적구분 || raw._면적명 || raw.areaName || "");
  out.전용면적 = exclusive_num !== null ? `${exclusive_num}㎡` : "";
  out._전용면적수치 = exclusive_num !== null ? exclusive_num : 0;

  const floor_raw = String(raw._층정보원문 || "");
  if (floor_raw.includes("/")) {
    const parts = floor_raw.split("/");
    out["층"] = parts[0] ? parts[0].trim() : "";
    out["총층수"] = parts[1] ? parts[1].trim() : "";
  } else {
    out.층 = floor_raw;
    out.총층수 = "";
  }

  out.방향 = raw.방향 || "";
  out.확인일 = fmtDate(raw._확인일자원문);
  out.공인중개사무소 = raw.공인중개사무소 || "";
  out.원문 = raw.원문 || "";

  const tag_raw = String(raw._태그 || raw.tags || raw.tagList || "");
  const tags = tag_raw.split(",").map(t => t.trim()).filter(Boolean);

  const roomMap: any = { 방한개: "1개", 방두개: "2개", 방세개: "3개", 방네개: "4개", 방다섯개이상: "5개이상" };
  out.방수 = tags.find(t => roomMap[t]) ? roomMap[tags.find(t => roomMap[t]) as string] : "";

  const bathMap: any = { 화장실한개: "1개", 화장실두개: "2개", 화장실세개이상: "3개이상" };
  out.욕실수 = tags.find(t => bathMap[t]) ? bathMap[tags.find(t => bathMap[t]) as string] : "";

  out.층구분 = tags.find(t => ["저층", "중층", "고층"].includes(t)) || "";

  const ageMap: any = { "1년이내": "1년이내", "3년이내": "3년이내", "5년이내": "5년이내", "10년이내": "10년이내", "15년이내": "15년이내", "20년이내": "20년이내", "20년초과": "20년초과" };
  out.연식 = tags.find(t => ageMap[t]) ? ageMap[tags.find(t => ageMap[t]) as string] : "";

  const features = ["복층","올수리","급매","세안고","주차가능","단기임대","반려동물"].filter(k => tags.includes(k));
  const feat_desc = String(raw._매물특징 || raw.매물특징 || "");

  for (const kw of ["급매", "올수리", "복층", "세안고"]) {
    if (feat_desc.includes(kw) && !features.includes(kw)) features.push(kw);
  }

  out.특징 = features.join(", ");
  out.태그원문 = tag_raw;
  out.가격변동여부 = Boolean(raw._가격변동 || raw._가격변경 || raw._가격변경2 || raw.isPriceModification);
  out.입주유형 = String(raw._입주유형 || raw.moveInTypeName || "");

  return out;
}
