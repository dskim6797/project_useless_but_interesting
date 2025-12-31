/**
 * 2026 제야의 종 - 클라이언트 사이드 로직 (채팅 동기화 및 타종 통합 버전)
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

console.log("script.js 로드 완료 및 포맷터 설정됨");

// 타겟 시간 설정 (서울 기준 2026년 1월 1일 00:00:00)
const TARGET_TIME = new Date("2026-01-01T00:00:00+09:00").getTime();
let serverOffset = 0;
let hasStruck = false;
let lastMessageId = 0; // 메시지 추적용 ID
let audioUnlocked = false; // 사운드 잠금 해제 상태

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
    const csrf = document.querySelector('[name=csrfmiddlewaretoken]');
    const logoutBtn = document.querySelector('form[action*="logout"]');
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

// --- 메인 루프 (시계 및 카운트다운 업데이트) ---
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

    // 카운트다운 로직
    if (diff > 0 && diff <= 1000 * 60) {
        if (countdownDisplay) {
            countdownDisplay.classList.remove('hidden');
            countdownDisplay.innerText = "2025년이 \n " + (diff / 1000).toFixed(2) + "초 남았습니다.";
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

        // 정각 애니메이션 (5초간 유지)
        if (diff > -5000 && bellImg && !bellImg.classList.contains('bell-ringing')) {
            bellImg.classList.add('bell-ringing');
            if (bellSound) bellSound.play().catch(() => {});
        }
    }
    requestAnimationFrame(updateLoop);
}

// --- 타종 API ---
async function strikeBell() {
    unlockAudio(); // 클릭 시 오디오 권한 확보
    if (hasStruck) return;

    const csrfToken = checkAuth();
    if (!csrfToken) return alert("로그인 후 이용 가능합니다.");

    try {
        const res = await fetch('/api/strike/', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken }
        });

        const data = await res.json();
        if (res.ok) {
            // 관리자 계정은 무제한 모드
            if (data.username === 'admin' || data.username === 'super') {
                strikeBtn.innerText = "울려라 종! (무제한 모드)";
                if (bellImg) {
                    bellImg.classList.remove('bell-ringing');
                    void bellImg.offsetWidth;
                    bellImg.classList.add('bell-ringing');
                }
                if (bellSound) {
                    bellSound.currentTime = 0;
                    bellSound.play().catch(() => {});
                }
            } else {
                hasStruck = true;
                strikeBtn.disabled = true;
                strikeBtn.innerText = "참여 완료";
            }
        } else {
            alert(data.error || "실패했습니다.");
        }
    } catch (e) { alert("오류 발생"); }
}

// --- 랭킹 데이터 가져오기 ---
window.fetchRanking = async function() {
    if (!rankingList) return;
    try {
        const res = await fetch('/api/ranking/', {
            headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();
        const records = data.records || [];

        if (records.length === 0) {
            rankingList.innerHTML = '<li class="text-gray-500 text-center py-12 italic">아직 타종 기록이 없습니다.</li>';
            return;
        }

        rankingList.innerHTML = '';
        records.forEach((record, index) => {
            const li = document.createElement('li');
            li.className = "flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/20 transition-all";

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
    } catch (e) { console.error("랭킹 로드 오류:", e); }
};

// --- 채팅 관련 함수 ---
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function appendToChat(msg) {
    if (!chatMessages) return;
    // 초기 안내 문구 삭제
    if (chatMessages.querySelector('p.italic')) chatMessages.innerHTML = '';

    const msgDiv = document.createElement('div');
    msgDiv.className = "flex flex-col items-start w-full space-y-1";
    msgDiv.innerHTML = `
        <div class="flex justify-between items-center w-full px-1">
            <span class="text-[10px] text-yellow-500/80 font-bold">${msg.username}</span>
            <span class="text-[8px] text-gray-500">${msg.created_at}</span>
        </div>
        <div class="bg-white/10 border border-white/10 px-4 py-2 rounded-2xl rounded-tl-none max-w-[90%] break-all text-white text-sm">
            ${escapeHtml(msg.content)}
        </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 메시지 가져오기 (초기 50개 로드 및 지속 동기화)
async function fetchMessages() {
    try {
        const res = await fetch(`/api/messages/?last_id=${lastMessageId}`);
        const data = await res.json();

        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(msg => {
                appendToChat(msg);
                lastMessageId = Math.max(lastMessageId, msg.id);
            });
        }
    } catch (e) { console.error("채팅 로드 오류:", e); }
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
    fetchMessages(); // 최초 로드 (최근 50개)

    // 사운드 권한 해제
    document.body.addEventListener('click', unlockAudio, { once: true });

    // 폴링 설정
    if (activeUsersDisplay) setInterval(heartbeat, 5000);
    if (chatMessages) setInterval(fetchMessages, 3000); // 3초마다 새 메시지 체크

    if (strikeBtn) strikeBtn.addEventListener('click', strikeBell);
    if (openChatBtn) openChatBtn.addEventListener('click', () => {
        chatWindow.classList.remove('hidden');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
    if (closeChatBtn) closeChatBtn.addEventListener('click', () => chatWindow.classList.add('hidden'));

    // 메시지 전송 로직
    const sendMessage = async () => {
        const content = msgInput.value.trim();
        if (!content) return;

        const csrfToken = checkAuth();
        if (!csrfToken) return alert("로그인 후 이용 가능합니다.");

        const formData = new FormData();
        formData.append('content', content);

        try {
            const res = await fetch('/api/messages/send/', {
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken },
                body: formData
            });
            if (res.ok) {
                msgInput.value = '';
                fetchMessages(); // 전송 직후 즉시 동기화
            }
        } catch (e) { console.error("전송 오류:", e); }
    };

    if (sendMsgBtn) sendMsgBtn.addEventListener('click', sendMessage);
    if (msgInput) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});