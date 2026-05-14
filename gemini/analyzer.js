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
  // 1. ```json 코드블록 안에서 추출
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch (_) {}
  }

  // 2. { 부터 마지막 } 까지 추출
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch (_) {}
  }

  // 3. 텍스트 전체를 JSON.parse 시도
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

  const prompt = `당신은 리니지클래식 게임 커뮤니티 전문 분석가입니다. 아래 데이터를 분석하여 JSON만 반환하세요.

## 공식 업데이트 (리니지클래식 공식사이트)
${officialSection}

## DC인사이드 리니지 갤러리 게시글 본문
아래는 디시인사이드 리니지클래식 갤러리의 게시글 본문들입니다. 본문 기반으로 아래 추출 대상에 해당하는 키워드만 추출하세요.

추출 대상: 게임 내 아이템명 / 서버명 / 캐릭터·직업명 / 유튜버·스트리머명 / 게임 시스템·콘텐츠명 / 시세·거래 관련 용어 / 게임 내 이슈·사건
제외 대상: 대명사(게임과 무관한 것) / 감정·감탄 표현 / 일반 동사·형용사 / 게임과 무관한 일상 단어
비속어·단순 자랑글·이벤트 참여글은 분석에서 제외하세요.

${dcSection}

## 인벤 리니지클래식 자유게시판 게시글 본문
아래는 인벤 리니지클래식 자유게시판의 게시글 본문들입니다. 본문 기반으로 아래 추출 대상에 해당하는 키워드만 추출하세요.

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
- 게임명(리니지클래식) 단독 사용 금지
- "업데이트", "시세", "이벤트" 등 대명사 단독 사용 절대 금지 — 반드시 무엇이 어떤 상황인지 구체적으로 포함
- 수집 데이터에 실제로 존재하는 내용만 사용

리니지클래식 유튜버 고정 리스트:
불도그, 이문주, 만만, 인범, 원재, 꽃태자, 사또, 여포왕, 나의바램, 알트, 수삼, 수영, 도건, 케이, 정개철, 랑쯔, 난닝구, 센터로드, 박반장, 리나양, 무작전, 렌, 지제이팍, 임왕덕, 빅보스, 빡구, 기사대장, 훈두니, 린베, 카라

youtubeAd 작성 규칙:
- 수집된 디시인사이드/인벤 게시글에서 위 고정 리스트에 있는 이름이 언급됐는지 확인
- 커뮤니티에서는 채널명을 줄여서 부르는 경우가 많으므로 줄임말/별칭도 매칭할 것
- 반환할 수 있는 채널명은 오직 위 고정 리스트에 있는 이름만 가능
- 수집 데이터에서 언급된 인물이 리스트에 없으면 절대 포함하지 말 것
- 커뮤니티 게시글에서 언급된 인물이 유튜버인지 아닌지 판단하지 말고, 오직 리스트와 일치하는지만 판단할 것
- 리스트에 없는 이름은 설령 유튜버처럼 보여도 무조건 제외
- 확실하지 않으면 빈 배열 반환
- 각 유튜버별로: 채널명(리스트 기준 정확한 이름) / 커뮤니티 언급 이유 또는 이슈 한 줄 요약 / 아이템매니아와 연계 가능한 광고 아이디어 1~2개

crm 작성 규칙:
- 제목과 내용에 동일 단어, 유사한 표현 반복 절대 금지, 내용은 제목을 보완하는 문구로 작성.
- 공식사이트에서 가져오는 내용과 아이템매니아는 직접적으로는 무관함.
- 공식사이트 내용을 아이템매니아에서 진행하는 것처럼 적으면 절대 안됨.
- 게임을 하는데 있어 도움이 되는 아이템/계정 거래 또는 시세 확인 위주로 접근해서 작성해야 됨.
- 게임을 플레이하는데 도움이 되는 가이드 언급 금지
- 공식 이벤트 진행 내용을 아이템매니아에서 진행하는 것처럼 작성하면 안됨
- 제목: "(광고) ~" 형태, 35자 이내, 없으면 null
- 내용: "(광고) ~" 형태, 35자 이내, 필수
- 2가지 버전 작성

반드시 JSON만 출력하고 다른 텍스트는 절대 포함하지 말 것.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  });

  console.log('[DEBUG] response 전체:', JSON.stringify(response, null, 2));
  console.log('[DEBUG] response.choices 전체:', JSON.stringify(response.choices, null, 2));

  const text = response.choices?.[0]?.message?.content ?? '';
  console.log('[DEBUG] message.content 전체:\n', text);

  const parsed = extractJson(text.trim());
  if (!parsed) {
    console.error('[OpenAI 파싱 실패] 응답 앞부분:', text.slice(0, 300));
    return EMPTY_ANALYSIS;
  }

  return parsed;
}

module.exports = { analyzePosts };