/**
 * 2026 제야의 종 - 클라이언트 사이드 로직 (통합 및 동기화 보완 버전)
 */

// 1. 포맷터 설정을 최상단에 배치하여 즉시 초기화
window.TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
});

console.log("script.js 로드 완료 및 포맷터 설정됨"); // 디버깅용 로그

// 타겟 시간 설정 (서울 기준 2026년 1월 1일 00:00:00)
const TARGET_TIME = new Date("2026-01-01T00:00:00+09:00").getTime();
let serverOffset = 0;
let hasStruck = false;
let lastMessageId = 0;

// UI 요소 참조
const bellImg = document.getElementById('bell-img');
const bellSound = document.getElementById('bellSound');
const countdownDisplay = document.getElementById('countdownDisplay');
const strikeBtn = document.getElementById('strikeBtn');
const seoulDateDisplay = document.getElementById('seoulDate');
const seoulTimeDisplay = document.getElementById('seoulTime');
const activeUsersDisplay = document.getElementById('activeUsers');
const chatWindow = document.getElementById('chatWindow');
const openChatBtn = document.getElementById('openChatBtn');
const closeChatBtn = document.getElementById('closeChatBtn');
const chatMessages = document.getElementById('chatMessages');
const msgInput = document.getElementById('msgInput');
const sendMsgBtn = document.getElementById('sendMsgBtn');
const rankingList = document.getElementById('rankingList');

// --- 시간 동기화 ---
async function syncTime() {
    try {
        const res = await fetch('/api/time/');
        if (!res.ok) throw new Error("서버 시간 응답 없음");
        const data = await res.json();
        serverOffset = data.server_time - Date.now();
    } catch (e) {
        console.warn("서버 시간 동기화 실패, 로컬 시간 사용:", e);
        serverOffset = 0;
    }
}

function getNow() { return Date.now() + serverOffset; }

// --- 로그인 상태 확인 함수 ---
function checkAuth() {
    // 1. CSRF 토큰 확인
    const csrf = document.querySelector('[name=csrfmiddlewaretoken]');
    // 2. 로그아웃 폼/버튼 존재 여부 확인 (Django 템플릿 context 기반)
    // index.html에서 로그아웃 버튼이 포함된 form을 찾습니다.
    const logoutBtn = document.querySelector('form[action*="logout"]');

    // 토큰이 없거나 로그아웃 버튼이 없다면 로그아웃 상태로 간주
    if (!csrf || !logoutBtn) return false;
    return csrf.value;
}

// 사운드 잠금 해제 함수
function unlockAudio() {
    if (audioUnlocked) return;
    if (bellSound) {
        bellSound.play().then(() => {
            bellSound.pause();
            bellSound.currentTime = 0;
            audioUnlocked = true;
            console.log("Audio unlocked successfully");
        }).catch(e => console.log("Audio interaction required"));
    }
}

// --- 메인 루프 (시계 업데이트) ---
function updateLoop() {
    const now = getNow();
    const diff = TARGET_TIME - now;
    const d = new Date(now);

    // 날짜 및 시간 표시
    if (window.TIME_FORMATTER && seoulDateDisplay && seoulTimeDisplay) {
        try {
            const parts = window.TIME_FORMATTER.formatToParts(d);
            const getPart = (type) => parts.find(p => p.type === type).value;

            seoulDateDisplay.innerText = `${getPart('year')}년 ${getPart('month')} ${getPart('day')}`;
            seoulTimeDisplay.innerText = `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
        } catch (e) {
            seoulTimeDisplay.innerText = d.toLocaleTimeString('ko-KR', { hour12: false });
        }
    }

    // 카운트다운 및 타종 로직
    // console
    if (diff > 0 && diff <= 1000*60) {
        if (countdownDisplay) {
            countdownDisplay.classList.remove('hidden');
            countdownDisplay.innerText = "2025년이 " + '\n' + (diff / 1000).toFixed(2) + "초 남았습니다.";
        }
        if (strikeBtn) {
            strikeBtn.disabled = false;
            strikeBtn.innerText = "2026.01.01\n00:00:00에 클릭";
        }
    } else if (diff <= 0) {
        if (countdownDisplay) countdownDisplay.classList.add('hidden');
        if (strikeBtn && !hasStruck) {
            strikeBtn.disabled = false;
            strikeBtn.innerText = "울려라 종!";
        }

        if (diff > -5000 && bellImg && !bellImg.classList.contains('bell-ringing')) {
            bellImg.classList.add('bell-ringing');
            if (bellSound) bellSound.play().catch(() => {});
        }
    }
    requestAnimationFrame(updateLoop);
}

// --- 타종 API ---
async function strikeBell() {
    if (hasStruck) return;
    const csrfToken = checkAuth();
    if (!csrfToken) return alert("로그인 후 이용 가능합니다.");
    const csrf = document.querySelector('[name=csrfmiddlewaretoken]');

    try {
        const res = await fetch('/api/strike/', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken }
        });

        const data = await res.json();
        if (res.ok) {
            // super 계정인 경우 로직
            if (data.username === 'admin') {
                strikeBtn.innerText = "울려라 종! (무제한 모드)";
                // 애니메이션 및 사운드 즉시 재실행
                if (bellImg) {
                    bellImg.classList.remove('bell-ringing');
                    void bellImg.offsetWidth; // 리플로우 강제 발생으로 애니메이션 초기화
                    bellImg.classList.add('bell-ringing');
                }
                if (bellSound) {
                    bellSound.currentTime = 0;
                    bellSound.play().catch(() => {});
                }
            } else {
                // 일반 계정은 1회로 제한
                hasStruck = true;
                strikeBtn.disabled = true;
                strikeBtn.innerText = "참여 완료";
            }
        } else {
            alert(data.error || "실패했습니다.");
        }
    } catch (e) { alert("오류 발생"); }
}

// --- 랭킹 데이터 가져오기 (ranking.html에서 호출됨) ---
window.fetchRanking = async function() {
    if (!rankingList) return;

    try {
        const res = await fetch('/api/ranking/', {
            headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();

        // 데이터가 "records" 키 안에 담겨있음 (views.py 확인)
        const records = data.records || [];

        if (records.length === 0) {
            rankingList.innerHTML = '<li class="text-gray-500 text-center py-12 italic">아직 타종 기록이 없습니다.</li>';
            return;
        }

        rankingList.innerHTML = '';
        records.forEach((record, index) => {
            const li = document.createElement('li');
            li.className = "flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/20 transition-all";

            // 메달 아이콘 결정
            let medal = `<span class="text-gray-500 w-8 font-mono">${index + 1}</span>`;
            if (index === 0) medal = `<span class="text-2xl w-8">🥇</span>`;
            if (index === 1) medal = `<span class="text-2xl w-8">🥈</span>`;
            if (index === 2) medal = `<span class="text-2xl w-8">🥉</span>`;

            li.innerHTML = `
                <div class="flex items-center gap-4">
                    ${medal}
                    <span class="font-bold text-lg">${record.username}</span>
                </div>
                <div class="text-right">
                    <div class="text-xs text-gray-500">${record.press_time_kst.split('T')[1].split('+')[0]}</div>
                    <div class="text-sm font-mono ${record.diff_seconds < 0 ? 'text-blue-400' : 'text-red-400'}">
                        ${record.diff_display}
                    </div>
                </div>
            `;
            rankingList.appendChild(li);
        });
    } catch (e) {
        console.error("랭킹 로드 오류:", e);
    }
};

// --- 채팅 관련 함수 ---
function appendToChat(username, content) {
    if (!chatMessages) return;
    if (chatMessages.querySelector('p.italic')) chatMessages.innerHTML = '';

    const msgDiv = document.createElement('div');
    msgDiv.className = "flex flex-col items-start w-full space-y-1";
    msgDiv.innerHTML = `
        <span class="text-[10px] text-gray-500 ml-1">${username}</span>
        <div class="bg-white/10 border border-white/10 px-4 py-2 rounded-2xl rounded-tl-none max-w-[85%] break-all text-white">
            ${escapeHtml(content)}
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function fetchMessages() {
    try {
        const res = await fetch('/api/messages/');
        const data = await res.json();
        if (data.length > 0) {
            const latest = data[0];
            if (latest.id !== lastMessageId) {
                lastMessageId = latest.id;
                appendToChat(latest.username, latest.content);
            }
        }
    } catch (e) {}
}

async function heartbeat() {
    try {
        const res = await fetch('/api/heartbeat/');
        const data = await res.json();
        if (activeUsersDisplay) activeUsersDisplay.innerText = `${data.active_users}명`;
    } catch (e) {}
}

// --- 초기 실행 및 이벤트 바인딩 ---
document.addEventListener('DOMContentLoaded', () => {
    syncTime();
    updateLoop();

    // 사용자가 페이지 어디든 클릭하면 사운드 권한 잠금 해제
    document.body.addEventListener('click', unlockAudio, { once: true });

    // 메인 화면 요소가 있을 때만 실행
    if (activeUsersDisplay) setInterval(heartbeat, 5000);
    if (chatMessages) setInterval(fetchMessages, 2000);

    if (strikeBtn) strikeBtn.addEventListener('click', strikeBell);
    if (openChatBtn) openChatBtn.addEventListener('click', () => chatWindow.classList.remove('hidden'));
    if (closeChatBtn) closeChatBtn.addEventListener('click', () => chatWindow.classList.add('hidden'));

    const sendMessage = async () => {
        const content = msgInput.value.trim();
        if (!content) return;

        const csrf = document.querySelector('[name=csrfmiddlewaretoken]');
        const csrfToken = checkAuth();
        if (!csrfToken) return alert("로그인 후 이용 가능합니다.");

        try {
            const res = await fetch('/api/messages/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf.value },
                body: JSON.stringify({ content })
            });
            if (res.ok) {
                msgInput.value = '';
            }
        } catch (e) { console.error(e); }
    };

    if (sendMsgBtn) sendMsgBtn.addEventListener('click', sendMessage);
    if (msgInput) msgInput.addEventListener('keypress', (e) => e.key === 'Enter' && sendMessage());
});