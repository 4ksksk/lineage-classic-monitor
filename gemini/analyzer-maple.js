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

  const prompt = `당신은 메이플스토리 게임 커뮤니티 전문 분석가입니다. 아래 데이터를 분석하여 JSON만 반환하세요.

## 공식 업데이트 (메이플스토리 공식사이트)
${officialSection}

## DC인사이드 메이플스토리 뉴갤러리 게시글 본문
아래는 디시인사이드 메이플스토리 뉴갤러리의 게시글 본문들입니다. 본문 기반으로 아래 추출 대상에 해당하는 키워드만 추출하세요.

추출 대상: 게임 내 아이템명 / 서버명 / 캐릭터·직업명 / 유튜버·스트리머명 / 게임 시스템·콘텐츠명 / 시세·거래 관련 용어 / 게임 내 이슈·사건
제외 대상: 대명사(게임과 무관한 것) / 감정·감탄 표현 / 일반 동사·형용사 / 게임과 무관한 일상 단어
비속어·단순 자랑글·이벤트 참여글은 분석에서 제외하세요.

${dcSection}

## 인벤 메이플스토리 자유게시판 게시글 본문
아래는 인벤 메이플스토리 자유게시판의 게시글 본문들입니다. 본문 기반으로 아래 추출 대상에 해당하는 키워드만 추출하세요.

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
  "youtubeAd": { "youtubers": [] },
  "crm": [
    {"title": "(광고) 제목 (35자 이내)", "body": "(광고) 본문 (35자 이내)"},
    {"title": "(광고) 제목 (35자 이내)", "body": "(광고) 본문 (35자 이내)"}
  ]
}

seoSns 작성 규칙:
- 수집된 게시글에서 SEO 검색광고 또는 SNS 포스팅에 바로 활용 가능한 문구 3~5개를 materials 배열로 추출
- 각 항목은 단답형 1줄, "어떤 콘텐츠/아이템/캐릭터가 어떤 상황인지"가 구체적으로 담긴 문구로 작성
- 게임명(메이플스토리) 단독 사용 금지
- "업데이트", "시세", "이벤트" 등 대명사 단독 사용 절대 금지 — 반드시 무엇이 어떤 상황인지 구체적으로 포함
- 수집 데이터에 실제로 존재하는 내용만 사용

youtubeAd: 메이플스토리는 유튜버 광고 계약 없으므로 항상 빈 배열 반환 ({ "youtubers": [] })

[시스템 명령]
당신은 게임 아이템 중개 플랫폼의 CRM 마케터입니다. 아래 규칙을 어기면 결과물은 폐기됩니다.

[절대 금지]
1. 수집된 데이터에 없는 내용으로 문구 생성 금지. 반드시 실제 수집 데이터에 존재하는 아이템명, 콘텐츠명만 사용할 것.
2. '이벤트', '혜택', '참여' 단어 사용 금지. 이 단어들은 게임사가 할 말이지 아이템 중개 플랫폼이 할 말이 아님.
3. 제목에 쓴 단어를 내용에서 반복 금지. 제목과 내용은 완전히 다른 표현을 써야 함.
4. 아이템 중개 플랫폼이 이벤트를 주최하거나 혜택을 제공하는 것처럼 표현 금지.
5. 플레이 가이드, 사냥터 추천, 성장법 언급 금지.
6. '거래', '매매' 단어 사용 금지. 대체어: 시세, 매물, 득템, 정리.

[필수]
1. 수집된 커뮤니티 데이터에서 실제로 언급된 아이템명 또는 콘텐츠명을 반드시 구체적으로 명시할 것.
2. 제목과 내용 모두 이모지 1~2개 반드시 포함. 없으면 오답.
3. 제목과 내용 모두 (광고)로 시작, 35자 이내.
4. 게임 풀네임(리니지클래식 / 아이온2 / 메이플스토리) 1회 이상 포함.
5. 2가지 버전 작성.
6. JSON만 출력, 다른 텍스트 없음.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  });

  console.log('[DEBUG maple] response.choices:', JSON.stringify(response.choices, null, 2));

  const text = response.choices?.[0]?.message?.content ?? '';
  console.log('[DEBUG maple] message.content:\n', text);

  const parsed = extractJson(text.trim());
  if (!parsed) {
    console.error('[메이플스토리 OpenAI 파싱 실패] 응답 앞부분:', text.slice(0, 300));
    return EMPTY_ANALYSIS;
  }

  return parsed;
}

module.exports = { analyzePosts };
