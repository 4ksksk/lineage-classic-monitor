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
  seoSns: { keywords: [], snsMaterials: [] },
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
    "keywords": ["검색 광고에 활용할 핵심 키워드 3~5개 (짧고 명확하게)"],
    "snsMaterials": ["SNS 콘텐츠 소재 한 줄 문장 2~3개"]
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
- 수집된 게시글에서 검색 광고(키워드 광고)에 활용할 핵심 키워드 3~5개와 SNS 콘텐츠 소재 2~3개를 함께 추출
- 키워드는 짧고 명확하게, SNS 소재는 한 줄 문장으로
- 실제 수집 데이터에 존재하는 내용만 사용

youtubeAd 작성 규칙:
- 수집된 디시인사이드/인벤 게시글에서 언급된 유튜버 채널명 또는 유튜버 닉네임을 추출
- 해당 유튜버의 현재 이슈(인기, 논란, 파급력 등)를 한 줄로 요약
- 아이템매니아와 연계하거나 해당 유튜버와 배너 광고 외에 진행할 수 있는 광고 아이디어를 1~2개 제안 (예: 쿠폰코드 제공, 영상 내 자연스러운 언급, 이벤트 연계 등)
- 유튜버가 언급되지 않은 경우 빈 배열 반환 (억지로 생성하지 말 것)

crm 작성 규칙:
- 아이템매니아는 리니지클래식 유저들이 게임 내 아이템을 사고팔 수 있는 중개 거래 플랫폼이다. 아이템을 직접 제조·판매·유통하지 않으며, 판매자와 구매자를 연결해주는 역할만 한다. 이 푸시는 아이템매니아가 리니지클래식 유저에게 발송하는 광고 알림이다.
- 푸시의 목적은 리니지클래식 유저가 지금 아이템매니아에 접속해서 시세를 확인하거나 아이템 거래를 하도록 유도하는 것이다.
- 반드시 이번에 수집된 데이터에 실제로 존재하는 이슈·업데이트·아이템명·시세 내용을 기반으로 작성할 것
- 수집된 데이터에 없는 내용을 있는 것처럼 표현하는 것은 절대 금지
- 불법·부정 이슈는 광고 소재로 절대 사용 금지
- 수집된 이슈가 아이템 시세나 거래에 미치는 영향을 중심으로, 리니지클래식을 하는 유저라면 지나치기 어려운 문구를 작성할 것
- 매번 비슷한 구조나 뻔한 표현이 반복되지 않도록, 이슈의 성격에 따라 문구의 방향과 구조를 다르게 가져갈 것
- 게임사 공지나 인게임 플레이를 유도하는 문체는 절대 금지
- 아이템매니아가 게임 내 콘텐츠를 제공하거나 이벤트를 주최하는 것처럼 작성하지 말 것
- 말투는 정보를 먼저 알게 된 유저가 다른 유저에게 귀띔해주는 것처럼 가볍고 자연스럽게 작성할 것
- 모호한 행동 유도 문구나 근거 없는 마케팅 관용 문구는 일체 사용 금지
- 이모지는 제목과 내용 중 반드시 1개 이상 포함할 것. 단 전체 합쳐서 2개를 초과하면 안됨
- 제목 또는 내용에 반드시 '리니지클래식' 텍스트를 포함할 것
- 제목과 내용에 동일하거나 유사한 단어·표현 반복 금지, 내용은 제목을 보완하는 문구로 작성
- '아이템매니아' 텍스트는 절대 사용 금지
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