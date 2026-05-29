export const getEstateStorage = () => useStorage('estate');

export const FIELD_MAP: Record<string, string> = {
  articleNo: "_매물번호", articleName: "원문", articleStatus: "_매물상태", realEstateTypeName: "_부동산유형",
  articleRealEstateTypeName: "_매물유형", tradeTypeCode: "_거래유형코드", tradeTypeName: "거래유형",
  complexNo: "_단지번호", complexName: "단지명", buildingName: "동", areaNo: "_면적번호", areaName: "면적구분",
  area1: "공급면적", area2: "전용면적", supplyArea: "공급면적", exclusiveArea: "전용면적", exclusiveRate: "_전용률",
  floorInfo: "_층정보원문", direction: "방향", buildingUseCode: "_건물용도", dealOrWarrantPrc: "가격",
  warrantPrc: "_보증금", rentPrc: "_월세", dealPrc: "_매매가", sameAddrMaxPrc: "_동일최고가",
  sameAddrMinPrc: "_동일최저가", sameAddrCnt: "_동일주소수", sameAddrDirectCnt: "_직거래수", realtorName: "공인중개사무소",
  realtorId: "_중개사ID", cpName: "_정보망", cpId: "_정보망ID", cpid: "_정보망ID2", cpPcArticleUrl: "_정보망URL",
  cpMobileArticleUrl: "_정보망URL모바일", cpPcArticleBridgeUrl: "_브릿지URL", cpPcArticleLinkUseAtArticleTitleYn: "_PC링크제목",
  cpPcArticleLinkUseAtCpNameYn: "_PC링크CP", cpMobileArticleLinkUseAtArticleTitleYn: "_모바일링크제목",
  cpMobileArticleLinkUseAtCpNameYn:   "_모바일링크CP", articleConfirmYmd: "_확인일자원문", lastModifyYmd: "_최종수정일",
  moveInTypeName: "_입주유형", moveInDiscussionPossibleYN: "_입주협의", tagList: "_태그", 태그: "_태그",
  articleFeatureDesc: "_매물특징", 매물특징: "_매물특징", isDirectTrade: "_직거래여부", verificationTypeCode: "_인증유형",
  detailAddress: "_상세주소", detailAddressYn: "_상세주소공개", isComplex: "_단지여부", isLocationShow: "_위치공개",
  isPriceModification: "_가격변경", isSafeLessorOfHug: "_HUG안심", isVrExposed: "_VR노출", representativeImgUrl: "_대표이미지",
  representativeImgThumb: "_썸네일규격", representativeImgTypeCode: "_이미지유형", thumbnailImgUrl: "_썸네일",
  siteImageCount: "_현장사진수", tradeCheckedByOwner: "_집주인확인", latitude: "_위도", longitude: "_경도",
  cortarNo: "_법정동코드", roomCnt: "_방수", bathroomCnt: "_욕실수", parkingCnt: "_주차", heatMethodTypeCode: "_난방방식",
  heatFuelTypeCode: "_난방연료", buildingHighFloor: "_최고층", buildingLowFloor: "_최저층", isInterest: "_관심",
  isAdded: "_추가", isRecommend: "_추천", priceChangeState: "_가격변동", isPriceModify: "_가격변경2",
};
