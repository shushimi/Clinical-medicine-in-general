// アプリの状態管理
let currentQuiz = [];
let currentIndex = 0;
let score = 0;

// 起動時の処理
window.onload = () => {
    updateReviewCount();
};

/**
 * 演習開始ボタン：選択された範囲のファイルを計算して読み込む
 */
async function loadAndStart() {
    const group = document.getElementById('select-round-group').value;
    const startVal = parseInt(document.getElementById('input-start').value);
    const endVal = parseInt(document.getElementById('input-end').value);
    const rangeType = document.querySelector('input[name="range-type"]:checked').value;

    if (isNaN(startVal) || parseInt(endVal) < startVal) {
        alert("有効な範囲を入力してください。");
        return;
    }

    // 読み込み中表示（任意）
    const startBtn = document.getElementById('btn-start-quiz');
    startBtn.innerText = "読み込み中...";
    startBtn.disabled = true;

    let allLoadedData = [];

    // 5ページ刻みのファイル構成に合わせて必要なファイルを特定しFetch
    // ページ指定(page)でも番号指定(id)でも、一旦そのグループの可能性があるファイルを走査
    // 安全のため1〜60ページ（12ファイル分）をループ
    for (let i = 1; i <= 60; i += 5) {
        const pStart = i;
        const pEnd = i + 4;
        const fileName = `p${pStart}_${pEnd}.json`;

        // ページ指定の場合、範囲が被っているファイルだけを読み込む
        let shouldFetch = true;
        if (rangeType === 'page') {
            if (startVal > pEnd || endVal < pStart) {
                shouldFetch = false;
            }
        }

        if (shouldFetch) {
            try {
                const response = await fetch(`data/${group}/${fileName}`);
                if (response.ok) {
                    const data = await response.json();
                    allLoadedData = allLoadedData.concat(data);
                }
            } catch (error) {
                console.log(`${fileName} は存在しないか読み込めませんでした。`);
            }
        }
    }

    // ユーザーが指定した開始〜終了で厳密にフィルタリング
    const filteredData = allLoadedData.filter(q => {
    // parseIntを使うことで "1 (p.238)" という文字列から 先頭の "1" だけを取り出して数値化します
    const targetVal = (rangeType === 'page') ? parseInt(q.page) : parseInt(q.id);
    return targetVal >= startVal && targetVal <= endVal;
});

    if (filteredData.length === 0) {
        alert("指定された範囲に問題が見つかりませんでした。\nファイル名やデータ内のpage/id設定を確認してください。");
        startBtn.innerText = "演習を開始する";
        startBtn.disabled = false;
        return;
    }

    // クイズのセットアップ
    currentQuiz = filteredData.sort(() => 0.5 - Math.random()); // シャッフル
    currentIndex = 0;
    score = 0;

    startBtn.innerText = "演習を開始する";
    startBtn.disabled = false;

    initQuizUI();
}

/**
 * クイズ画面への切り替え
 */
function initQuizUI() {
    document.getElementById('screen-setup').classList.add('hidden');
    document.getElementById('screen-result').classList.add('hidden');
    document.getElementById('screen-quiz').classList.remove('hidden');
    showQuestion();
}

/**
 * 問題を表示
 */
function showQuestion() {
    const q = currentQuiz[currentIndex];

    // UIリセット
    document.getElementById('feedback-area').classList.add('hidden');
    document.getElementById('display-table-area').innerHTML = "";
    document.getElementById('display-image-area').innerHTML = "";

    // メタ情報・問題文
    document.getElementById('quiz-progress-text').innerText = `進捗: ${currentIndex + 1} / ${currentQuiz.length}`;
    document.getElementById('display-round-name').innerText = q.round_name || "過去問";
    document.getElementById('display-page-num').innerText = `p.${q.page}`;
    document.getElementById('display-question-id').innerText = `第 ${q.id} 問`;
    document.getElementById('display-question-text').innerText = q.question;

    // 表がある場合
    if (q.table) {
        renderTable(q.table);
    }
    // 図がある場合
    if (q.image) {
        document.getElementById('display-image-area').innerHTML = `<img src="assets/${q.image}" alt="問題図">`;
    }

    // 選択肢ボタンの生成
    const optionsList = document.getElementById('options-list');
    optionsList.innerHTML = "";
    q.options.forEach((text, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = text;
        btn.onclick = () => checkAnswer(index + 1, q);
        optionsList.appendChild(btn);
    });
}

/**
 * 表の描画
 */
function renderTable(tableData) {
    const area = document.getElementById('display-table-area');
    let html = '<table>';
    tableData.forEach(row => {
        html += '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
    });
    html += '</table>';
    area.innerHTML = html;
}

/**
 * 解答チェック
 */
function checkAnswer(selectedIdx, q) {
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => b.disabled = true); // 連続タップ防止

    const isCorrect = (selectedIdx === q.answer);
    
    if (isCorrect) {
        btns[selectedIdx - 1].classList.add('correct');
        document.getElementById('result-mark').innerText = "⭕ 正解！";
        document.getElementById('result-mark').style.color = "var(--correct-color)";
        score++;
        removeReview(q.unique_id || q.id); // 正解したら復習リストから削除
    } else {
        btns[selectedIdx - 1].classList.add('wrong');
        btns[q.answer - 1].classList.add('correct');
        document.getElementById('result-mark').innerText = "❌ 不正解";
        document.getElementById('result-mark').style.color = "var(--wrong-color)";
        saveReview(q); // 間違えたら復習リストに保存
    }

    // 解説表示
    document.getElementById('display-explanation-text').innerText = q.explanation;
    document.getElementById('feedback-area').classList.remove('hidden');
    
    // 解説エリアの先頭へスクロール
    document.getElementById('explanation-container').scrollTop = 0;
}

/**
 * 次の問題へ
 */
function nextQuestion() {
    currentIndex++;
    if (currentIndex < currentQuiz.length) {
        showQuestion();
    } else {
        showResult();
    }
}

/**
 * 結果画面
 */
function showResult() {
    document.getElementById('screen-quiz').classList.add('hidden');
    document.getElementById('screen-result').classList.remove('hidden');
    document.getElementById('final-score').innerText = score;
    document.getElementById('total-questions').innerText = currentQuiz.length;
}

/**
 * 中断して戻る
 */
function quitQuiz() {
    if (confirm("演習を中断してトップに戻りますか？")) {
        location.reload();
    }
}

// --- 復習機能 (LocalStorage) ---

function saveReview(question) {
    let reviews = JSON.parse(localStorage.getItem('juso_reviews') || '[]');
    // 重複チェック（idだけでなくround等も組み合わせた方が安全）
    const qKey = question.round_name + "_" + question.id;
    if (!reviews.find(r => (r.round_name + "_" + r.id) === qKey)) {
        reviews.push(question);
        localStorage.setItem('juso_reviews', JSON.stringify(reviews));
    }
    updateReviewCount();
}

function removeReview(id) {
    let reviews = JSON.parse(localStorage.getItem('juso_reviews') || '[]');
    // ここでは簡易的にidでマッチング
    reviews = reviews.filter(r => r.id !== id);
    localStorage.setItem('juso_reviews', JSON.stringify(reviews));
    updateReviewCount();
}

function updateReviewCount() {
    const reviews = JSON.parse(localStorage.getItem('juso_reviews') || '[]');
    const countEl = document.getElementById('review-count');
    if (countEl) countEl.innerText = reviews.length;
}

function startReviewQuiz() {
    const reviews = JSON.parse(localStorage.getItem('juso_reviews') || '[]');
    if (reviews.length === 0) {
        alert("復習する問題がありません。");
        return;
    }
    currentQuiz = reviews.sort(() => 0.5 - Math.random());
    currentIndex = 0;
    score = 0;
    initQuizUI();
}
