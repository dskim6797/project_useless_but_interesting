const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// --- Django CSRF 토큰 가져오기 헬퍼 ---
// POST 요청 시 보안 토큰(CSRF)을 함께 보내기 위해 쿠키에서 값을 가져오는 함수입니다.
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
const COLORS = { WHITE: '#FFFFFF', RED: '#FF0000', YELLOW: '#FFFF00', GREEN: '#00FF00', CYAN: '#00FFFF' };
const FONT_SIZE = 14;
const FONT_FAMILY = `bold ${FONT_SIZE}px monospace`;

let width, height;
let flakes = [];
let wind = 0.0;
let targetWind = 0.0;
let lastTime = 0;

class Flake {
    constructor(x, text = null) {
        this.x = x;
        this.y = 0;
        this.vy = text ? 40.0 : (Math.random() * 20 + 30);
        this.phase = Math.random() * Math.PI * 2;
        this.text = text;
        this.char = text ? text : FLAKE_CHARS[Math.floor(Math.random() * FLAKE_CHARS.length)];
        this.isMessage = !!text;
        this.color = this.isMessage ? COLORS.CYAN : COLORS.WHITE;
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
            ctx.shadowColor = COLORS.CYAN;
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

    // 1. 기본 눈송이 생성
    for(let i=0; i<50; i++) {
        flakes.push(new Flake(Math.random() * width));
        flakes[flakes.length-1].y = Math.random() * height;
    }

    // 2. Django API에서 메시지 불러오기
    try {
        const response = await fetch('/api/messages/');
        const data = await response.json();
        if (data.messages) {
            data.messages.forEach(msg => {
                // 이미 있는 메시지들은 화면 중간 랜덤 위치에 배치
                let f = new Flake(Math.random() * width, msg);
                f.y = Math.random() * height;
                flakes.push(f);
            });
        }
    } catch (e) {
        console.error("메시지 로딩 실패:", e);
    }

    // 3. UI 상태 설정 (Django 템플릿 변수 활용)
    if (typeof USER_HAS_POSTED !== 'undefined' && USER_HAS_POSTED) {
        disableInput("이미 메시지를 등록하셨습니다.");
    }

    const addBtn = document.getElementById('addBtn');
    if (addBtn) {
        addBtn.addEventListener('click', addSnowball);
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

async function addSnowball() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();

    if (!text) return alert("메시지를 입력해주세요.");
    if (text.length > 20) return alert("15자 이내로 입력해주세요.");

    const csrftoken = getCookie('csrftoken');

    try {
        const response = await fetch('/api/add/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({ content: text })
        });

        const result = await response.json();

        if (response.ok) {
            flakes.push(new Flake(Math.random() * width, text));
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

function drawTree(now) {
    const charWidth = FONT_SIZE * 0.6;
    const treeWidthPx = TREE_ASCII[TREE_ASCII.length-1].length * charWidth;
    const startX = (width / 2) - (treeWidthPx / 2);
    const startY = height - (TREE_ASCII.length * FONT_SIZE);

    ctx.font = FONT_FAMILY;

    // 맨 위 별 색상 (천천히 색상 순환)
    // const starHue = (now * 30) % 360;
    // const starColor = `hsl(${starHue}, 100%, 60%)`;
    const star_brightness = (Math.sin(now * 6) + 1) / 2; // 0~1
    const star_lightness = 35 + (star_brightness * 65); // 50% ~ 90% (어두운 노랑 -> 밝은 노랑)
    const star_color = `hsl(50, 100%, ${star_lightness}%)`;

    const fairylight_brightness = (Math.sin(now * 2) + 1) / 2; // 0~1
    const fairylight_lightness = 35 + (fairylight_brightness * 65); // 50% ~ 90% (어두운 노랑 -> 밝은 노랑)
    const fairylight_color = `hsl(50, 100%, ${fairylight_lightness}%)`;

    TREE_ASCII.forEach((line, i) => {
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === " ") continue;
            const x = startX + (j * charWidth);
            const y = startY + (i * FONT_SIZE);
            ctx.shadowBlur = 0;

            if (char === "$") {
                // 꼭대기 별: 부드러운 그라데이션 + 숨쉬는 듯한 글로우 효과
                ctx.fillStyle = star_color;
                ctx.shadowColor = star_color;
                ctx.shadowBlur = 10 + Math.sin(now * 2) * 5;
                ctx.fillText("★", x, y);
            }
            else if (char === "@") {
                // 꼭대기 별: 부드러운 그라데이션 + 숨쉬는 듯한 글로우 효과
                ctx.fillStyle = fairylight_color;
                ctx.shadowColor = fairylight_color;
                ctx.shadowBlur = 10 + Math.sin(now * 2) * 5;
                ctx.fillText("•", x, y);
            }
            else if (char === "&") {
                // 오너먼트(장식) 위치 결정 (좌표 기반 해시)
                const hash = (Math.floor(x) * 13 + Math.floor(y) * 27) % 1000;

                // 약 10% 확률로 장식이 달림
                if (hash < 100) {
                    // 깜빡임 속도 조절 (now * 1.5로 천천히)
                    // 위치마다 위상(phase)을 다르게 주어 제각각 깜빡이게 함
                    const phase = now * 1.5 + (hash * 0.01);
                    const brightness = Math.sin(phase);

                    if (brightness > 1) { // 켜짐 상태
                        // 색상 그라데이션 순환
                        const ornHue = (now * 50 + hash) % 360;
                        ctx.fillStyle = `hsl(${ornHue}, 100%, 60%)`;
                        ctx.shadowColor = ctx.fillStyle;
                        ctx.shadowBlur = 5;
                        ctx.fillText("$", x, y);
                    } else {
                        // 꺼짐 상태 (트리 잎으로 돌아감 + 그라데이션)
                        const lightness = 60 - (i / TREE_ASCII.length * 30);
                        ctx.fillStyle = `hsl(120, 100%, ${lightness}%)`;
                        ctx.shadowBlur = 0;
                        ctx.fillText(char, x, y);
                    }
                } else {
                    // 일반 나뭇잎: 세로 그라데이션 적용 (위는 밝게, 아래는 어둡게)
                    const lightness = 60 - (i / TREE_ASCII.length * 30);
                    ctx.fillStyle = `hsl(120, 100%, ${lightness}%)`;
                    ctx.fillText(char, x, y);
                }
            }
            else if (char === "#") {
                ctx.fillStyle = "#8B4513";
                ctx.fillText(char, x, y);
            }
            else {
                ctx.fillStyle = COLORS.GREEN;
                ctx.fillText(char, x, y);
            }
        }
    });

    // "Merry Christmas" 텍스트 (물결치듯 색상 변화)
    // const msg = "Merry Christmas";
    // const msgX = (width / 2) - ((msg.length * charWidth) / 2);
    // const msgY = height - 20;
    // for (let i = 0; i < msg.length; i++) {
    //     const hue = (now * 50 + i * 20) % 360;
    //     ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
    //     ctx.shadowColor = ctx.fillStyle;
    //     ctx.shadowBlur = 3;
    //     ctx.fillText(msg[i], msgX + (i * charWidth), msgY);
    // }
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
        if (f.y < height + 50) nextFlakes.push(f);
    }
    flakes = nextFlakes;

    if (height > 300) drawTree(timestamp / 1000);

    requestAnimationFrame(loop);
}

// 시작
init();