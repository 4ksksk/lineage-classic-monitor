const OpenAI = require('openai');

let openai;

function getClient() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

function buildPostBlock(posts) {
  if (!posts.length) return '(수집된 게시글 없음)';
  return posts.map((p, i) =>
    `[게시글 ${i + 1}]\n제목: ${p.title}\n본문: ${p.content || '(본문 없음)'}`
  ).join('\n\n');
}

const EMPTY_ANALYSIS = {
  todayIssue: null,
  official: { summary: null, date: null, keywords: [], marketingTips: [], priceImpact: null },
  dcinside: { keywords: [], summary: null, marketingTips: [], priceImpact: null },
  inven:    { keywords: [], summary: null, marketingTips: [], priceImpact: null },
  seoSns: { materials: [] },
  youtubeAd: { youtubers: [] },
  crm: [],
};

function extractJson(text) {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch (_) {}
  }

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch (_) {}
  }

  try { return JSON.parse(text); } catch (_) {}

  return null;
}

async function analyzePosts(officialPosts, dcPosts, invenPosts) {
  const client = getClient();

  const officialSection = officialPosts.length > 0
    ? officialPosts.map(p =>
        `제목: ${p.title}\n날짜: ${p.date}\n본문:\n${p.content || '(본문 없음)'}`
      ).join('\n\n')
    : '(수집된 업데이트 없음)';

  const dcSection    = buildPostBlock(dcPosts);
  const invenSection = buildPostBlock(invenPosts);

  const prompt = `당신은 아이온2 게임 커뮤니티 전문 분석가입니다. 아래 데이터를 분석하여 JSON만 반환하세요.

## 공식 업데이트 (아이온2 공식사이트)
${officialSection}

## DC인사이드 아이온2 갤러리 게시글 본문
아래는 디시인사이드 아이온2 갤러리의 게시글 본문들입니다. 본문 기반으로 아래 추출 대상에 해당하는 키워드만 추출하세요.

추출 대상: 게임 내 아이템명 / 서버명 / 캐릭터·직업명 / 유튜버·스트리머명 / 게임 시스템·콘텐츠명 / 시세·거래 관련 용어 / 게임 내 이슈·사건
제외 대상: 대명사(게임과 무관한 것) / 감정·감탄 표현 / 일반 동사·형용사 / 게임과 무관한 일상 단어
비속어·단순 자랑글·이벤트 참여글은 분석에서 제외하세요.

${dcSection}

## 인벤 아이온2 자유게시판 게시글 본문
아래는 인벤 아이온2 자유게시판의 게시글 본문들입니다. 본문 기반으로 아래 추출 대상에 해당하는 키워드만 추출하세요.

추출 대상: 게임 내 아이템명 / 서버명 / 캐릭터·직업명 / 유튜버·스트리머명 / 게임 시스템·콘텐츠명 / 시세·거래 관련 용어 / 게임 내 이슈·사건
제외 대상: 대명사(게임과 무관한 것) / 감정·감탄 표현 / 일반 동사·형용사 / 게임과 무관한 일상 단어
비속어·단순 자랑글·이벤트 참여글은 분석에서 제외하세요.

${invenSection}

---

분석 결과를 아래 JSON 형식만 반환하세요 (다른 텍스트 절대 없이):
{
  "todayIssue": "공식+커뮤니티 통합 관점의 오늘 최대 이슈 1-2문장",
  "official": {
    "summary": "업데이트 핵심 내용 불릿포인트 (• 항목1\\n• 항목2 형식)",
    "date": "업데이트 날짜",
    "keywords": ["공식 업데이트에서 추출한 주요 키워드 최대 5개"],
    "marketingTips": ["공식 업데이트 기반 마케팅 제안 2-3개"],
    "priceImpact": "이번 업데이트가 게임 내 아이템/시세에 미치는 영향 설명"
  },
  "dcinside": {
    "keywords": [{"word": "본문에서 추출한 키워드", "count": 언급횟수}],
    "summary": "디시 게시글 전체 분위기·주요 이슈 요약 2-3줄",
    "marketingTips": ["디시 이슈 기반 마케팅 제안 2개"],
    "priceImpact": "디시에서 언급된 시세·아이템 관련 동향"
  },
  "inven": {
    "keywords": [{"word": "본문에서 추출한 키워드", "count": 언급횟수}],
    "summary": "인벤 게시글 전체 분위기·주요 이슈 요약 2-3줄",
    "marketingTips": ["인벤 이슈 기반 마케팅 제안 2개"],
    "priceImpact": "인벤에서 언급된 시세·아이템 관련 동향"
  },
  "seoSns": {
    "materials": ["SEO 검색광고 또는 SNS에 활용할 구체적 문구 3~5개"]
  },
  "youtubeAd": {
    "youtubers": [
      {"name": "유튜버 채널명 또는 닉네임", "issue": "현재 이슈 한 줄 요약", "adIdea": "광고 아이디어 1~2개"}
    ]
  },
  "crm": [
    {"title": "(광고) 제목 (35자 이내, 없으면 null)", "content": "(광고) 본문 (35자 이내, 필수)"},
    {"title": "(광고) 제목 (35자 이내, 없으면 null)", "content": "(광고) 본문 (35자 이내, 필수)"}
  ]
}

seoSns 작성 규칙:
- 수집된 게시글에서 SEO 검색광고 또는 SNS 포스팅에 바로 활용 가능한 문구 3~5개를 materials 배열로 추출
- 각 항목은 단답형 1줄, "어떤 콘텐츠/아이템/캐릭터가 어떤 상황인지"가 구체적으로 담긴 문구로 작성
- 게임명(아이온2) 단독 사용 금지
- "업데이트", "시세", "이벤트" 등 대명사 단독 사용 절대 금지 — 반드시 무엇이 어떤 상황인지 구체적으로 포함
- 수집 데이터에 실제로 존재하는 내용만 사용

아이온2 유튜버 고정 리스트:
난닝구, 팡이요, 만만, 박다솜, 학살, 러너, 꽃빈, 짬타수아, 개구멍, 풍월량, 한동숙, 따효니, 테스터훈, 로이조, 저라뎃, 서윤, 이상호, 임선비, 용봉탕, BJ지터, BJ횟집누나, 정개철, 아빠킹, 괴물쥐, 우정잉, 랄로, 앰비션, 침착맨, 지수, 카즈야

youtubeAd 작성 규칙:
- 수집된 디시인사이드/인벤 게시글에서 위 고정 리스트에 있는 이름이 언급됐는지 확인
- 커뮤니티에서는 채널명을 줄여서 부르는 경우가 많으므로 줄임말/별칭도 매칭할 것
- 반환할 수 있는 채널명은 오직 위 고정 리스트에 있는 이름만 가능
- 수집 데이터에서 언급된 인물이 리스트에 없으면 절대 포함하지 말 것
- 커뮤니티 게시글에서 언급된 인물이 유튜버인지 아닌지 판단하지 말고, 오직 리스트와 일치하는지만 판단할 것
- 리스트에 없는 이름은 설령 유튜버처럼 보여도 무조건 제외
- 확실하지 않으면 빈 배열 반환
- 각 유튜버별로: 채널명(리스트 기준 정확한 이름) / 커뮤니티 언급 이유 또는 이슈 한 줄 요약 / 아이템매니아와 연계 가능한 광고 아이디어 1~2개

[시스템 명령: 페르소나 및 절대 준수 사항]
당신은 게임 아이템 중개 플랫폼 '아이템매니아'의 베테랑 CRM 마케터입니다. 당신의 목적은 게임 소식을 전하는 것이 아니라, 해당 소식으로 발생하는 '아이템 이동 수요'를 자극하는 것입니다. 아래 규칙을 단 하나라도 어길 시 결과물은 즉시 폐기됩니다.

[절대 금지 규칙]
1. 주체 혼동 금지: 업데이트나 이벤트의 주체는 오직 '게임사'입니다. 아이템매니아가 이벤트를 열거나 아이템을 주는 것처럼 표현하지 마십시오.
2. 금지 단어 사용 금지: '거래', '매매'라는 단어는 제목과 내용 어디에도 절대 쓰지 마십시오. 대체어: 시세, 매물, 정리, 득템, 확인 등
3. 가이드 금지: 사냥터 추천 등 플레이 가이드를 언급하지 마십시오. 오직 아이템의 가치와 흐름에만 집중하십시오.
4. 반복 금지: 제목에 사용한 핵심 단어를 내용에서 그대로 반복하지 마십시오.

[필수 반영 규칙]
1. 풀네임 명시: 제목 또는 내용에 반드시 해당 게임의 풀네임(리니지클래식 / 아이온2 / 메이플스토리)을 1회 이상 포함하십시오.
2. 이모지 강제 사용: 모든 버전의 제목과 내용에는 반드시 1~2개의 이모지를 포함하십시오. 이모지가 없으면 시스템 에러로 간주합니다.
3. 형식 준수: 제목과 내용은 반드시 (광고)로 시작하며, 공백 포함 35자 이내로 작성하십시오.
4. 출력 형태: 오직 JSON 데이터만 출력하고 앞뒤 설명이나 인사는 절대 하지 마십시오.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  });

  console.log('[DEBUG aion2] response.choices:', JSON.stringify(response.choices, null, 2));

  const text = response.choices?.[0]?.message?.content ?? '';
  console.log('[DEBUG aion2] message.content:\n', text);

  const parsed = extractJson(text.trim());
  if (!parsed) {
    console.error('[아이온2 OpenAI 파싱 실패] 응답 앞부분:', text.slice(0, 300));
    return EMPTY_ANALYSIS;
  }

  return parsed;
}

module.exports = { analyzePosts };
