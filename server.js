require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { runCrawlAndAnalyze, runAion2CrawlAndAnalyze, startScheduler } = require('./scheduler/index');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH         = path.join(__dirname, 'data', 'results.json');
const HISTORY_DIR       = path.join(__dirname, 'data', 'history');
const DATA_PATH_AION2   = path.join(__dirname, 'data', 'aion2-results.json');
const HISTORY_DIR_AION2 = path.join(__dirname, 'data', 'aion2-history');

const EMPTY = { lastUpdated: null, officialPosts: [], dcPosts: [], invenPosts: [], analysis: null };

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/results', (req, res) => {
  if (!fs.existsSync(DATA_PATH)) return res.json(EMPTY);
  try {
    res.json(JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')));
  } catch {
    res.status(500).json({ error: '데이터 파일을 읽을 수 없습니다.' });
  }
});

app.get('/api/history', (req, res) => {
  if (!fs.existsSync(HISTORY_DIR)) return res.json([]);
  try {
    const files = fs.readdirSync(HISTORY_DIR)
      .filter(f => /^\d{4}-\d{2}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .reverse();
    res.json(files);
  } catch {
    res.status(500).json({ error: '히스토리를 읽을 수 없습니다.' });
  }
});

app.get('/api/history/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!/^\d{4}-\d{2}-\d{2}-\d{2}\.json$/.test(filename))
    return res.status(400).json({ error: '잘못된 파일명' });
  const filepath = path.join(HISTORY_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: '파일 없음' });
  try {
    res.json(JSON.parse(fs.readFileSync(filepath, 'utf-8')));
  } catch {
    res.status(500).json({ error: '파일을 읽을 수 없습니다.' });
  }
});

app.get('/api/aion2-history', (req, res) => {
  if (!fs.existsSync(HISTORY_DIR_AION2)) return res.json([]);
  try {
    const files = fs.readdirSync(HISTORY_DIR_AION2)
      .filter(f => /^\d{4}-\d{2}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .reverse();
    res.json(files);
  } catch {
    res.status(500).json({ error: '히스토리를 읽을 수 없습니다.' });
  }
});

app.get('/api/aion2-history/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!/^\d{4}-\d{2}-\d{2}-\d{2}\.json$/.test(filename))
    return res.status(400).json({ error: '잘못된 파일명' });
  const filepath = path.join(HISTORY_DIR_AION2, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: '파일 없음' });
  try {
    res.json(JSON.parse(fs.readFileSync(filepath, 'utf-8')));
  } catch {
    res.status(500).json({ error: '파일을 읽을 수 없습니다.' });
  }
});

app.get('/api/aion2-results', (req, res) => {
  if (!fs.existsSync(DATA_PATH_AION2)) return res.json(EMPTY);
  try {
    res.json(JSON.parse(fs.readFileSync(DATA_PATH_AION2, 'utf-8')));
  } catch {
    res.status(500).json({ error: '데이터 파일을 읽을 수 없습니다.' });
  }
});

app.post('/api/crawl', async (req, res) => {
  try {
    const result = await runCrawlAndAnalyze();
    const total = result.officialPosts.length + result.dcPosts.length + result.invenPosts.length;
    res.json({ success: true, message: '크롤링 완료', count: total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`리니지클래식 모니터 서버 실행 중: http://localhost:${PORT}`);
  startScheduler();
});
