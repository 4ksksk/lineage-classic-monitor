require('dotenv').config();
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { crawlOfficial } = require('../crawler/official');
const { crawlDCInside } = require('../crawler/dcinside');
const { crawlInven } = require('../crawler/inven');
const { analyzePosts } = require('../gemini/analyzer');
const { crawlAion2Official } = require('../crawler/aion2-official');
const { crawlAion2DCInside } = require('../crawler/aion2-dcinside');
const { crawlAion2Inven } = require('../crawler/aion2-inven');
const { analyzePosts: analyzeAion2Posts } = require('../gemini/analyzer-aion2');

const DATA_PATH       = path.join(__dirname, '../data/results.json');
const HISTORY_DIR     = path.join(__dirname, '../data/history');
const DATA_PATH_AION2 = path.join(__dirname, '../data/aion2-results.json');
const HISTORY_DIR_AION2 = path.join(__dirname, '../data/aion2-history');

async function runCrawlAndAnalyze() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 크롤링 시작`);

  const [officialResult, dcResult, invenResult] = await Promise.allSettled([
    crawlOfficial(),
    crawlDCInside(),
    crawlInven(),
  ]);

  const officialPosts = officialResult.status === 'fulfilled' ? officialResult.value : [];
  const dcPosts       = dcResult.status === 'fulfilled'       ? dcResult.value       : [];
  const invenPosts    = invenResult.status === 'fulfilled'    ? invenResult.value    : [];

  const total = officialPosts.length + dcPosts.length + invenPosts.length;
  console.log(`[스케줄러] 수집 완료 — 공식 ${officialPosts.length} / DC ${dcPosts.length} / 인벤 ${invenPosts.length} (합계 ${total})`);

  let analysis = null;
  const hasKey = !!process.env.OPENAI_API_KEY;

  if (!hasKey) {
    console.warn('[스케줄러] OPENAI_API_KEY 없음 — OpenAI 분석 건너뜀 (GitHub Secret 설정 필요)');
  } else if (total === 0) {
    console.warn('[스케줄러] 수집된 게시글 없음 — OpenAI 분석 건너뜀');
  } else {
    try {
      console.log('[스케줄러] OpenAI 분석 시작 (API 1회 호출)...');
      analysis = await analyzePosts(officialPosts, dcPosts, invenPosts);
      console.log('[스케줄러] OpenAI 분석 완료');
    } catch (err) {
      console.error('[OpenAI 분석 오류]', err.message);
      console.error('[OpenAI 분석 오류 스택]', err.stack);
    }
  }

  // 분석 실패 시 이전 results.json의 analysis 보존
  if (!analysis && fs.existsSync(DATA_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
      if (prev.analysis) {
        analysis = prev.analysis;
        console.log('[스케줄러] 이전 분석 결과 보존 (API 미설정 또는 오류)');
      }
    } catch (_) {}
  }

  const result = {
    lastUpdated: new Date().toISOString(),
    officialPosts,
    dcPosts,
    invenPosts,
    analysis,
  };

  fs.writeFileSync(DATA_PATH, JSON.stringify(result, null, 2), 'utf-8');
  console.log('[스케줄러] 저장 완료 →', DATA_PATH);

  // history 저장: data/history/YYYY-MM-DD-HH.json (KST 기준)
  try {
    if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
    const kst = new Date(new Date(result.lastUpdated).getTime() + 9 * 60 * 60 * 1000);
    const y  = kst.getUTCFullYear();
    const mo = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d  = String(kst.getUTCDate()).padStart(2, '0');
    const h  = String(kst.getUTCHours()).padStart(2, '0');
    const historyFilename = `${y}-${mo}-${d}-${h}.json`;
    fs.writeFileSync(
      path.join(HISTORY_DIR, historyFilename),
      JSON.stringify(result, null, 2),
      'utf-8'
    );
    console.log('[스케줄러] 히스토리 저장 →', historyFilename);
  } catch (err) {
    console.error('[히스토리 저장 오류]', err.message);
  }

  return result;
}

async function runAion2CrawlAndAnalyze() {
  console.log(`[${new Date().toLocaleString('ko-KR')}] 아이온2 크롤링 시작`);

  const [officialResult, dcResult, invenResult] = await Promise.allSettled([
    crawlAion2Official(),
    crawlAion2DCInside(),
    crawlAion2Inven(),
  ]);

  const officialPosts = officialResult.status === 'fulfilled' ? officialResult.value : [];
  const dcPosts       = dcResult.status === 'fulfilled'       ? dcResult.value       : [];
  const invenPosts    = invenResult.status === 'fulfilled'    ? invenResult.value    : [];

  const total = officialPosts.length + dcPosts.length + invenPosts.length;
  console.log(`[아이온2 스케줄러] 수집 완료 — 공식 ${officialPosts.length} / DC ${dcPosts.length} / 인벤 ${invenPosts.length} (합계 ${total})`);

  let analysis = null;
  const hasKey = !!process.env.OPENAI_API_KEY;

  if (!hasKey) {
    console.warn('[아이온2 스케줄러] OPENAI_API_KEY 없음 — OpenAI 분석 건너뜀');
  } else if (total === 0) {
    console.warn('[아이온2 스케줄러] 수집된 게시글 없음 — OpenAI 분석 건너뜀');
  } else {
    try {
      console.log('[아이온2 스케줄러] OpenAI 분석 시작...');
      analysis = await analyzeAion2Posts(officialPosts, dcPosts, invenPosts);
      console.log('[아이온2 스케줄러] OpenAI 분석 완료');
    } catch (err) {
      console.error('[아이온2 OpenAI 분석 오류]', err.message);
      console.error('[아이온2 OpenAI 분석 오류 스택]', err.stack);
    }
  }

  if (!analysis && fs.existsSync(DATA_PATH_AION2)) {
    try {
      const prev = JSON.parse(fs.readFileSync(DATA_PATH_AION2, 'utf-8'));
      if (prev.analysis) {
        analysis = prev.analysis;
        console.log('[아이온2 스케줄러] 이전 분석 결과 보존');
      }
    } catch (_) {}
  }

  const result = {
    lastUpdated: new Date().toISOString(),
    officialPosts,
    dcPosts,
    invenPosts,
    analysis,
  };

  if (!fs.existsSync(path.dirname(DATA_PATH_AION2))) {
    fs.mkdirSync(path.dirname(DATA_PATH_AION2), { recursive: true });
  }
  fs.writeFileSync(DATA_PATH_AION2, JSON.stringify(result, null, 2), 'utf-8');
  console.log('[아이온2 스케줄러] 저장 완료 →', DATA_PATH_AION2);

  try {
    if (!fs.existsSync(HISTORY_DIR_AION2)) fs.mkdirSync(HISTORY_DIR_AION2, { recursive: true });
    const kst = new Date(new Date(result.lastUpdated).getTime() + 9 * 60 * 60 * 1000);
    const y  = kst.getUTCFullYear();
    const mo = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d  = String(kst.getUTCDate()).padStart(2, '0');
    const h  = String(kst.getUTCHours()).padStart(2, '0');
    const historyFilename = `${y}-${mo}-${d}-${h}.json`;
    fs.writeFileSync(
      path.join(HISTORY_DIR_AION2, historyFilename),
      JSON.stringify(result, null, 2),
      'utf-8'
    );
    console.log('[아이온2 스케줄러] 히스토리 저장 →', historyFilename);
  } catch (err) {
    console.error('[아이온2 히스토리 저장 오류]', err.message);
  }

  return result;
}

function startScheduler() {
  cron.schedule('0 9  * * *', () => { runCrawlAndAnalyze(); runAion2CrawlAndAnalyze(); }, { timezone: 'Asia/Seoul' });
  cron.schedule('0 13 * * *', () => { runCrawlAndAnalyze(); runAion2CrawlAndAnalyze(); }, { timezone: 'Asia/Seoul' });
  cron.schedule('0 16 * * *', () => { runCrawlAndAnalyze(); runAion2CrawlAndAnalyze(); }, { timezone: 'Asia/Seoul' });
  cron.schedule('0 20 * * *', () => { runCrawlAndAnalyze(); runAion2CrawlAndAnalyze(); }, { timezone: 'Asia/Seoul' });
  console.log('[스케줄러] 등록 완료 — 9/13/16/20시 리니지클래식+아이온2 크롤링+분석 (KST)');
}

module.exports = { runCrawlAndAnalyze, runAion2CrawlAndAnalyze, startScheduler };
