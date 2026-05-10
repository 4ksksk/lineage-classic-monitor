const Anthropic = require('@anthropic-ai/sdk');

let anthropic;

function getClient() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

function buildPostBlock(posts) {
  if (!posts.length) return '(수집된 게시글 없음)';
  return posts.map((p, i) =>
    `[게시글 ${i + 1}]\n제목: ${p.title}\n본문: ${p.content || '(본문 없음)'}`
  ).join('\n\n');
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
아래는 디시인사이드 리니지클래식 갤러리의 게시글 본문들입니다. 본문을 읽고 게임과 관련하여 반복적으로 언급되는 주요 키워드(인물명, 아이템명, 서버명, 이슈, 사건 등)를 스스로 파악해서 추출해주세요. 예시 없이 본문 기반으로만 판단하세요.
비속어·단순 자랑글·이벤트 참여글은 분석에서 제외하세요.

${dcSection}

## 인벤 리니지클래식 자유게시판 게시글 본문
아래는 인벤 리니지클래식 자유게시판의 게시글 본문들입니다. 본문을 읽고 게임과 관련하여 반복적으로 언급되는 주요 키워드(인물명, 아이템명, 서버명, 이슈, 사건 등)를 스스로 파악해서 추출해주세요. 예시 없이 본문 기반으로만 판단하세요.
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
  "seo": ["SEO 소재 문장 5개 (15자 이내, 검색 유입형)"],
  "youtube": ["유튜브 영상 기획 소재 4개 (25자 이내, 클릭 유도형)"],
  "push": [
    {"title": "광고 제목 (35자 이내, 없으면 null)", "content": "광고 본문 (35자 이내, 필수)"},
    {"title": null, "content": "광고 본문 (35자 이내, 필수)"},
    {"title": "광고 제목 (35자 이내, 없으면 null)", "content": "광고 본문 (35자 이내, 필수)"}
  ]
}`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  if (!message.content || message.content.length === 0) {
    throw new Error(`Claude 응답 content가 비어 있습니다. stop_reason: ${message.stop_reason}`);
  }

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock) {
    throw new Error(`텍스트 블록 없음. content types: ${message.content.map(b => b.type).join(', ')}`);
  }

  const text = textBlock.text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`JSON 추출 실패. 응답 앞부분: ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`JSON 파싱 실패: ${e.message} / 추출 앞부분: ${jsonMatch[0].slice(0, 300)}`);
  }
}

module.exports = { analyzePosts };
