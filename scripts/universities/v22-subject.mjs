/**
 * V22 — the subject rules shared by the Commons harvest and the media fetch.
 *
 * Commons' own categorisation and an institution's own infobox tie a file to the institution; a full-text
 * search hit whose only tie is that the **title names** the institution is weaker, and the sweep found what
 * that weakness lets in: US Army outreach photographs "with students from X University", a campus post
 * office, "the town around X University". So a title-only tie must also carry campus vocabulary, and the
 * people/event/off-campus vocabulary below refuses a file whatever its tie.
 */

/** A filename or description that says the file is not a photograph of the institution's campus. */
export const NOT_A_PHOTO = /\b(map|karte|diagram|chart|graph|logo|emblem|seal|symbol|wordmark|ci[-_ ]|signature|stamp|coat.of.arms|flag|plaque|poster|leaflet|brochure|scan|document|certificate|portrait|headshot|people|group.photo|ceremony|graduation|commencement|hospital|medical.cent(er|re)|clinic|station|subway|metro|high.school|middle.school|elementary|kindergarten|affiliated|alumni|professor|president|chancellor|rector|team|match|game|festival|concert|protest|rally|lecture|class|screenshot|menu|food|meal|bus|shuttle|car|award|medal|trophy|banner|sign|text|page|cover|book|ticket|receipt|letter|envelope|card|army|military|brigade|air.force|navy|soldiers?|sgt|dpla|partnership|mentorship|visits?|visiting|sings?|carol|post.office|postal|town|village|around|near|students?|athletes?|players?|cheer|parade|exhibition|exhibit|conference|workshop|seminar|forum|summit|meeting|signing|agreement|mou|delegation|minister|ambassador|general|colonel|officer|troops|veterans?|volunteers?|donation|charity|wedding|dance|performance|play|drama|band|orchestra|choir|robot|drone|aircraft|helicopter|boat|ship|horse|dog|cat|bird|flower|close-?up|macro|specimen|artifact|relic|painting|sculpture|statue|interior|room|office|lab|laboratory|classroom|lounge|cafeteria|canteen|dormitory room|classmates?|friends?|family|families|colleagues?|selfie|me|myself|faculty|congress|comgress|with (students|people|staff|members|his|her|their|the (president|rector|dean|chancellor|minister))|machine|equipment|presentaci[oó]n|presentation|signboard|nameplate|plate|crowd|audience|speaker|guest|guests|dignitar\w+|visit\w*)\b|지도|로고|엠블럼|상징|심벌|심볼|교표|교장|서명|병원|의료원|치과|(?:입구|지하철|전철)역|역(?=[\s._()-]|$)|지하철|부설|부속|고등학교|중학교|초등학교|유치원|동문|교수|총장|학장|졸업|입학식|학위수여|축제|공연|시위|집회|강의|수업|식단|음식|버스|셔틀|포스터|현수막|간판|표지|초상|인물|단체사진|기념사진|시상|메달|상장|증서|문서|스캔|증명서|방문|학생들|선수|군인|육군|해군|공군|미군|우체국|마을|주변|근처|회의|세미나|협약|체결|장관|대사|무대|합창|밴드|로봇|드론|강아지|고양이|실내|사무실|강의실|실험실|과방|동아리방|식당|인터뷰|머신|기구|장비|명판|관객|청중|members?|interview|speech|reuni[óo]n|visita|encuentro|firma/i;

/** Campus vocabulary — required for a title-only tie, and used to rank heroes. */
export const CAMPUS_WORDS = /campus|building|gate|main|library|hall|tower|aerial|view|panorama|entrance|quad|lawn|avenue|college|university|대학|캠퍼스|정문|본관|도서관|전경|건물|강당|기념관|대학교|대학원|타워|광장|교정|chapel|museum|stadium|gymnasium|dormitor|architecture|night/i;

/** Korean cities and provinces, in both scripts: a title made of one of these and nothing campus-like is a place photograph, not a campus one. */
export const PLACE_WORDS = /seoul|busan|pusan|daegu|taegu|incheon|gwangju|kwangju|daejeon|taejon|ulsan|sejong|gyeonggi|gangwon|kangwon|chungcheong|chungbuk|chungnam|jeolla|jeonbuk|jeonnam|gyeongsang|gyeongbuk|gyeongnam|jeju|cheju|suwon|yongin|cheonan|cheongju|jeonju|chonju|changwon|pohang|gyeongju|andong|chuncheon|wonju|gangneung|asan|gumi|gimhae|yangsan|mokpo|yeosu|suncheon|jinju|iksan|gunsan|anyang|ansan|bucheon|seongnam|goyang|pyeongtaek|hwaseong|namyangju|uijeongbu|paju|gimpo|siheung|gwangmyeong|gunpo|hanam|osan|icheon|yeoju|anseong|chungju|jecheon|nonsan|gongju|boryeong|seosan|dangjin|hongseong|gyeryong|naju|gwangyang|sangju|gimcheon|yeongju|mungyeong|gyeongsan|yeongcheon|miryang|tongyeong|sacheon|geoje|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주|수원|용인|천안|청주|전주|창원|포항|경주|안동|춘천|원주|강릉|아산|구미|김해|양산|목포|여수|순천|진주|익산|군산|안양|안산|부천|성남|고양|평택|화성|의정부|파주|김포|시흥|광명|군포|하남|오산|이천|여주|안성|충주|제천|논산|공주|보령|서산|당진|홍성|나주|광양|상주|김천|영주|문경|경산|영천|밀양|통영|사천|거제|한강|남산|해운대|광안리/i;

/** A category title that is a disambiguation or an overseas campus: "Calvin University (Michigan)", "Inha University in Tashkent". */
const KOREA = /korea|seoul|busan|pusan|daegu|incheon|gwangju|daejeon|ulsan|sejong|gyeonggi|gangwon|chungcheong|jeolla|gyeongsang|jeju|yongin|suwon|cheonan|cheongju|jeonju|changwon|pohang|gyeongju|andong|chuncheon|wonju|gangneung|asan|gumi|gimhae|yangsan|mokpo|yeosu|suncheon|jinju|iksan|gunsan|anyang|ansan|bucheon|seongnam|goyang|pyeongtaek|hwaseong|miryang|erica|anseong|global|international/i;
export function foreignOrAmbiguous(name) {
  const n = name.replace(/^Category:/, '');
  const paren = /\(([^)]*)\)/.exec(n);
  if (paren && !KOREA.test(paren[1])) return true;
  const m = /\b(?:in|at)\s+([A-Z][\w-]+)/.exec(n);
  if (m && !KOREA.test(m[1])) return true;
  return false;
}

/** For a *file's* categories the test is narrower: a named overseas place, not any parenthetical ("Yonsei University (Sinchon campus)" is fine). */
const FOREIGN = /\b(michigan|tashkent|uzbekistan|united states|usa?|california|texas|new york|illinois|ohio|minnesota|iowa|indiana|wisconsin|pennsylvania|massachusetts|virginia|florida|grand rapids|japan|tokyo|osaka|china|beijing|shanghai|vietnam|hanoi|ho chi minh|philippines|manila|mongolia|ulaanbaatar|india|thailand|bangkok|malaysia|indonesia|jakarta|canada|australia|germany|france|paris|england|london|russia|moscow|kazakhstan|kyrgyzstan|nepal|myanmar|cambodia|laos|taiwan|hong kong|singapore|dubai|egypt|kenya|brazil|mexico)\b/i;
export const foreignCategory = (name) => FOREIGN.test(name.replace(/^Category:/, ''));

/** True when the file's only tie to the institution is that a title names it (no category, infobox or P18). */
export const titleOnlyTie = (via) => !via.some((v) => /^category:|infobox|wikidata:P18|:category$/.test(v));

/** The one subject verdict both scripts apply to a photograph candidate. */
export function subjectOk(p) {
  const name = p.title.replace(/^File:/, '');
  const text = `${name} ${p.description ?? ''}`;
  if (NOT_A_PHOTO.test(text)) return { ok: false, why: 'name/description says it is not a campus photograph' };
  if (titleOnlyTie(p.via ?? []) && !CAMPUS_WORDS.test(name)) return { ok: false, why: 'title-only tie without campus vocabulary' };
  // `PanoDaejeon.jpg` in Category:KAIST is a view of the city, not of the institute.
  if (PLACE_WORDS.test(name) && !CAMPUS_WORDS.test(name) && !p.names_institution) return { ok: false, why: 'place name without campus vocabulary or the institution\u2019s name' };
  // Commons' own categorisation says it is somewhere else: "Calvin University (Michigan)".
  if ((p.categories ?? []).some(foreignCategory)) return { ok: false, why: 'categorised under an overseas entity' };
  return { ok: true };
}
