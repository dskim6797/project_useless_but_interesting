const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// --- Django CSRF 토큰 가져오기 헬퍼 ---
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// --- 설정 변수 ---
// 사용자가 제공한 트리 아스키 아트
const TREE_ASCII = [
    "                              $",
    "                             $$$",
    "                            $$$$$",
    "                     $$$$$$$$$$$$$$$$$$$",
    "                        $$$$$$$$$$$$$",
    "                          $$$$$$$$$",
    "                         $$$$$$$$$$$",
    "                        $$$$&&&&&$$$$",
    "                       $$&&&&&&&&&&&$$",
    "                      &&&&&&&&&&&&&&&@&",
    "                    &&&&&&&::::::@&&&&&&&",
    "                  &&&&:::::::@:::::::::&&&&",
    "                &&&&:::::@&:::::::&&::::@&&&&",
    "               &&&&&&@&&&&&&:::::&&@&&&&&&&&&&",
    "                   &&&&:::&&&&@&&&&:::&&&&",
    "                 &&&&::::@:&&&&&&&::::::&&&&",
    "               &&&::@:::::::&&&&&::::::::@:&&&",
    "             &&@::::::::&&:::::::::&@::::::::&&&",
    "            &&&&&&&&&&&&&&&::::@::&&&&&&&&&&&&&&&",
    "               &&&&&&&:::&@&:::::&&&:::&&&&&&&",
    "             &&&&&:::@::::&&&:::&&&::::::::@&&&&",
    "         &&&&&&&@:::::::::::&&&&&:::::@:::::::&&&&&&",
    "      &&&&&@::::::::&&&::::::::::@:::::&&&::::::::&&&&&",
    "        &&&:::::::&&&&&:::::@:::::::::&&&&&:::::::&&&",
    "           &&&&&&&&&&::@::::&&&&&:::::::&&&&&&&&&&",
    "           &&&::::@&&:::::&&&&&&&&&:::::&&:::::@&&",
    "         &&&&@::::&&:::&&&&:::::::&&&&:::&@:::::&&&&",
    "      &&@&:::::::&&&&&&&:::::::::::::@&&&&&&:::::::&&&&",
    "    &&&&::::::&&&&&:::::::::::::@:::::::::&&&&&::::::&&@&",
    " &&&&&&:::::&&&::&&&:::::&:@:::::::&:::::&&&::&&&:@:::&&&&&&",
    "   &&&&&&&&&&&&&&&::::@::&:::::::::&:::::::&&@&&&&&&&&&&&&",
    "              &&&@:::::&&&:::::::::&&&::@:::&&&",
    "           &@&&::::::&&&&&&&:::::&&@&&&&::::::&&&&",
    "         &&&&&&&&&&&&&& #&&&&:@:&&&&# &&&&&&&&&&&&&&",
    "                        ####&&&&&####",
    "                        #####&&&#####",
    "                        #############",
    "                        #############",
    "                        #############",
    "                        #############",
];

const FLAKE_CHARS = ['*', '.', '❄', '•'];
const COLORS = {
    WHITE: '#FFFFFF',
    RED: '#FF0000',
    YELLOW: '#FFFF00',
    GREEN: '#00FF00',
    DARK_GREEN: '#006400',
    CYAN: '#00FFFF',
    GOLD: '#FFD700',
    ORANGE: '#FFA500',
    PURPLE: '#800080',
    BROWN: '#8B4513',
    BLUE: '#0000FF'
};
// 꼬마전구 색상 순서 (빨주노초파보)
const LIGHT_COLORS = [
    '#fb6060', // 빨강
    '#fdc04f', // 주황
    '#fdfd68', // 노랑
    '#a5fda5', // 초록
    '#588dff', // 파랑
    '#fd4cfd'  // 보라
];

const FONT_SIZE = 12; // 트리가 커져서 폰트 크기를 약간 줄임
const FONT_FAMILY = `bold ${FONT_SIZE}px monospace`;

let width, height;
let flakes = [];
let wind = 0.0;
let targetWind = 0.0;
let lastTime = 0;

class Flake {
    // 수정: 생성자에서 IP 주소를 선택적으로 받을 수 있도록 변경
    constructor(x, text = null, ip = null) {
        this.x = x;
        this.y = 0;
        this.vy = text ? 40.0 : (Math.random() * 20 + 30);
        this.phase = Math.random() * Math.PI * 2;
        this.text = text;
        this.ip = ip; // IP 저장
        this.char = text ? text : FLAKE_CHARS[Math.floor(Math.random() * FLAKE_CHARS.length)];
        this.isMessage = !!text;

        // 수정: IP가 있으면 IP를, 없으면 텍스트를 기반으로 해시 생성
        if (this.isMessage) {
            // IP가 있으면 IP를 우선 사용 (IP마다 고유 색상)
            // IP가 없으면 기존처럼 텍스트 사용 (내용마다 고유 색상)
            const seed = this.ip || this.text;
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                hash = seed.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = Math.abs(hash % 360); // 0~360 사이의 고정된 색상 값 추출
            this.color = `hsl(${hue}, 100%, 70%)`; // 채도 100%, 명도 70% (밝은 색)
        } else {
            this.color = COLORS.WHITE;
        }
    }

    update(dt) {
        this.phase += dt * (Math.random() * 1.5 + 2.5);
        const wobble = Math.sin(this.phase) * 1.5;
        this.y += this.vy * dt * 3;
        this.x += (wind * 50 * dt) + wobble;
        if (this.x < 0) this.x += width;
        if (this.x > width) this.x -= width;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        if (this.isMessage) {
            ctx.font = `bold ${FONT_SIZE + 4}px monospace`;
            ctx.shadowBlur = 5;
            ctx.shadowColor = this.color; // 그림자도 자신의 색으로
        } else {
            ctx.font = FONT_FAMILY;
            ctx.shadowBlur = 0;
        }
        ctx.fillText(this.char, this.x, this.y);
    }
}

// --- 메인 로직 ---
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

async function init() {
    window.addEventListener('resize', resize);
    resize();

    for(let i=0; i<50; i++) {
        flakes.push(new Flake(Math.random() * width));
        flakes[flakes.length-1].y = Math.random() * height;
    }

    try {
        const response = await fetch('/messages/');
        const data = await response.json();
        if (data.messages) {
            data.messages.forEach(item => {
                // 수정: 서버에서 {content: "...", ip: "..."} 형태의 객체로 올 경우와
                // 기존 문자열 리스트로 올 경우를 모두 처리
                const msgContent = typeof item === 'object' ? item.content : item;
                const msgIp = typeof item === 'object' ? item.ip : null;

                let f = new Flake(Math.random() * width, msgContent, msgIp);
                f.y = Math.random() * height;
                flakes.push(f);
            });
        }
    } catch (e) {
        console.error("메시지 로딩 실패:", e);
    }

    if (typeof USER_HAS_POSTED !== 'undefined' && USER_HAS_POSTED) {
        disableInput("이미 메시지를 등록하셨습니다.");
    }

    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        addBtn.addEventListener('click', addMessageSnowball);
    }

    requestAnimationFrame(loop);
}

function disableInput(msg) {
    const btn = document.getElementById('addBtn');
    const input = document.getElementById('msgInput');
    const status = document.getElementById('statusMsg');

    if(btn) btn.disabled = true;
    if(input) {
        input.disabled = true;
        input.value = "전송 완료";
    }
    if(status) status.innerText = msg;
}

async function addMessageSnowball() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();

    if (!text) return alert("메시지를 입력해주세요.");
    if (text.length > 20) return alert("15자 이내로 입력해주세요.");

    const csrftoken = getCookie('csrftoken');

    try {
        const response = await fetch('/add/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({ content: text })
        });

        const result = await response.json();

        if (response.ok) {
            // 성공 시, 서버 응답에 IP가 있다면 그것을 사용 (result.ip)
            const newIp = result.ip || null;
            flakes.push(new Flake(Math.random() * width, text, newIp));

            disableInput("메시지가 등록되었습니다!");
            const status = document.getElementById('statusMsg');
            if(status) status.style.color = '#0f0';
        } else {
            alert(result.error || "오류가 발생했습니다.");
        }
    } catch (e) {
        console.error(e);
        alert("서버 통신 오류가 발생했습니다.");
    }
}

// 주변의 트리 구조물에 빛을 반사시키는 함수
function twinkleLight(centerX, centerY, radius, lightColor, brightness, now, charWidth) {
    const treeMaxY = TREE_ASCII.length;
    const treeMaxX = Math.max(...TREE_ASCII.map(line => line.length));

    const treeWidthPx = treeMaxX * charWidth;
    const startX = (width / 2) - (treeWidthPx / 2);
    const startY = height - (TREE_ASCII.length * FONT_SIZE);

    for (let y = centerY - radius; y <= centerY + radius; y += FONT_SIZE) {
        for (let x = centerX - radius; x <= centerX + radius; x += charWidth) {
            const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

            if (dist < radius && Math.random() < brightness * 0.5) {
                const lineIndex = Math.round((y - startY) / FONT_SIZE);
                const charIndex = Math.round((x - startX) / charWidth);

                if (lineIndex >= 0 && lineIndex < treeMaxY && charIndex >= 0) {
                    const line = TREE_ASCII[lineIndex];
                    if (charIndex < line.length) {
                        const char = line[charIndex];
                        // 반사광이 맺힐 문자들 목록
                        if (['&', ':', '#'].includes(char)) {
                            ctx.fillStyle = lightColor;
                            ctx.shadowColor = lightColor;
                            ctx.shadowBlur = 5 * brightness;
                            ctx.fillText(char, x, y);
                            ctx.shadowBlur = 0;
                        }
                    }
                }
            }
        }
    }
}

function drawTree(now) {
    const charWidth = FONT_SIZE * 0.6;
    const maxLineLength = Math.max(...TREE_ASCII.map(line => line.length));
    const treeWidthPx = maxLineLength * charWidth;

    const startX = (width / 2) - (treeWidthPx / 2);
    const startY = height - (TREE_ASCII.length * FONT_SIZE);

    ctx.font = FONT_FAMILY;

    // 꼬마전구 색상 순서를 위한 카운터
    let lightCounter = 0;

    TREE_ASCII.forEach((line, i) => {
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === " ") continue;
            const x = startX + (j * charWidth);
            const y = startY + (i * FONT_SIZE);
            ctx.shadowBlur = 0;

            if (char === "$") { // 별
                const brightness = (Math.sin(now * 3) + 1) / 2; // 0~1
                const lightness = 40 + (brightness * 55); // 50% ~ 90% (어두운 노랑 -> 밝은 노랑)
                const starColor = `hsl(50, 100%, ${lightness}%)`;

                ctx.fillStyle = starColor;
                ctx.shadowColor = COLORS.GOLD;
                ctx.shadowBlur = 15 + brightness * 15;
                ctx.fillText("★", x, y);

            } else if (char === "@") { // 꼬마전구 (순서대로 색상 부여)
                const color = LIGHT_COLORS[lightCounter % LIGHT_COLORS.length];
                lightCounter++; // 다음 전구는 다음 색상으로

                // 깜빡임 효과 (위상차를 줘서 제각각 깜빡이게 함)
                const hash = (Math.floor(x) * 13 + Math.floor(y) * 27) % 1000;
                const phase = now * 2 + (hash * 0.01);
                const brightness = (Math.sin(phase) + 1) / 2;

                // 켜졌을 때는 지정된 색, 꺼졌을 때는 어두운 녹색
                ctx.fillStyle = brightness > 0.3 ? color : COLORS.DARK_GREEN;

                if (brightness > 0.3) {
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 8 * brightness;
                    twinkleLight(x, y, 10, color, brightness, now, charWidth);
                }
                ctx.fillText("•", x, y);

            } else if (char === "&") { // 잎
                ctx.fillStyle = COLORS.GREEN;
                ctx.fillText(char, x, y);
            } else if (char === ":") { // 내부 장식/텍스처
                ctx.fillStyle = COLORS.DARK_GREEN;
                ctx.fillText(char, x, y);
            } else if (char === "#") { // 기둥
                ctx.fillStyle = COLORS.BROWN;
                ctx.fillText(char, x, y);
            } else {
                ctx.fillStyle = COLORS.WHITE;
                ctx.fillText(char, x, y);
            }
        }
    });

    const msg = "Merry Christmas";
    const msgX = (width / 2) - ((msg.length * charWidth) / 2);
    const msgY = height - 500;
    for (let i = 0; i < msg.length; i++) {
        const hue = (now * 50 + i * 20) % 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 3;
        ctx.fillText(msg[i], msgX + (i * charWidth), msgY);
    }
}

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    targetWind = Math.sin(timestamp / 2000) * 2.0;
    wind += (targetWind - wind) * 0.1;

    if (Math.random() < 0.1) {
        flakes.push(new Flake(Math.random() * width));
    }

    let nextFlakes = [];
    for (let f of flakes) {
        f.update(dt);
        f.draw(ctx);

        // 화면 아래로 사라지지 않았으면 유지
        if (f.y < height + 50) {
            nextFlakes.push(f);
        } else if (f.isMessage) {
            // 메시지 눈송이는 바닥에 닿으면 다시 위로 올림 (무한 반복)
            f.y = -30;
            f.x = Math.random() * width; // X 위치는 랜덤 재설정
            nextFlakes.push(f);
        }
    }
    flakes = nextFlakes;

    if (height > 300) drawTree(timestamp / 1000);

    requestAnimationFrame(loop);
}

init();