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
    "                      &&&&o&&&&&&&&&&@&",
    "                    &&&&&&&::::::@&&&&&&&",
    "                  &&&&:::::::@:o:::::::&&&&",
    "                &&&&::o::@&:::::::&&::::@&&&&",
    "              o&&&&&&@&&&&&&:::::&&@&&&&&&&&&&o",
    "                   &&&&:::&&&&@&&&&:::&&&&",
    "                 &&&&::::@:&&&&&&&:::o::&&o&",
    "               &&&::@:::::::&o&&&::::::::@:&&&",
    "             &&@::::::o:&&:::::::::&@::::o:::&&&",
    "           o&&&&&&&&&&&&&&&::::@::&&&&&&&&&&&&&&&o",
    "               &&&&&&&:::&@&:::o:&&&:::&&&&&&&",
    "             &&&&&:::@::::&&&:::&&&::::::::@&&&&",
    "         &&&&&&&@::o::::::::&&&&&:::o:@:::::::&&&&&&",
    "     o&&&&&@::::::::&&&:::o::::::@:::::&&&::::::::&&&&&",
    "        &&&:o:::::&&&&&:::::@:::::::::&&&&&:::o:::&&&o",
    "           &&&&&&&&&&::@::::&&&&&::o::::&&&&&&&&&&",
    "           &&&::::@&&:::::&&&&&&&&&:::::&&:::::@&&",
    "         &o&&@::::&&:::&&o&:::::::&&&&:::&@:::::&&&&",
    "      &&@&:::::::&&&&&&&:::::::::::::@&&o&&&::::::o&&&&",
    "    &&&&::::::&&o&&:::::::::::o:@:::::::::&&&&&::::::&&@&",
    " &&&&&&:::::&&&::&&&:::::&:@:::::::&:::::&&&::&&&:@:::&&&&&&",
    " o &&&&&&o&&&&&&&&::::@::&:::::::::&:::::::&&@&&&&&&&&&&&& o",
    "              &&&@::o::&&&::::::o::&&&::@:::&&&",
    "           &@&&::::::&&&&&&&:::::&&@&&&&::::::&&&&",
    "         o&&&&&&&&&&&&& #&&&&:@:&&&&# &&o&&&&&&&&&&o",
    "                        ####&o&&&####",
    "                        #####&&&#####",
    "                        #############",
    "                        #############",
    "                        #############",
    "                        #############",
];

const FLAKE_CHARS = ['❄️','❄','*','•','.'];
const COLORS = {
    WHITE: '#FFFFFF',
    RED: '#FF0000',
    YELLOW: '#FFFF00',
    GREEN: '#00FF00',
    DARK_GREEN: '#006400',
    CYAN: '#00FFFF',
    ORANGE: '#FFA500',
    PURPLE: '#800080',
    BROWN: '#8B4513',
    BLUE: '#0000FF',
    SNOW: 'rgba(217,245,251,0.96)',

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

const ONMT_COLORS = [
    '#ff0000FF', // RED
    '#c52222', // RED
    '#FFD700FF', // GOLD1
    '#D4AF37FF', // GOLD2
    "#C0C0C0FF", // SLIVER1
    "#E0E0E0FF", // SILVER2
]

const FONT_SIZE = 8; // 트리가 커져서 폰트 크기를 약간 줄임
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
        this.vy = text ? 40.0 : (Math.random() * 30 + 30);
        this.phase = Math.random() * Math.PI * 2;
        this.text = text;
        this.isMessage = !!text;

        if (this.isMessage) {
            this.fontSize = FONT_SIZE + 4; // 메시지는 고정 크기 (혹은 약간 크게)
        } else {
            this.fontSize = FONT_SIZE * (0.8 + Math.random() * 0.8);
        }

        if (this.text) {
            this.char = this.text;
        } else {
            // ['❄️','❄','*','•','.']
            // . (40%), • (30%), * (15%), ❄ (10%), ❄️ (5%)
            const r = Math.random();
            if (r < 0.4) this.char = '.';
            else if (r < 0.8) this.char = '•';
            else if (r < 0.9) this.char = '*';
            else if (r < 0.985) this.char = '❄';
            else this.char = '❄️';
        }

        if (this.text) {
            this.vy = 30.0;
        } else if (this.char === '.' || this.char === '•') {
            this.vy = Math.random() * 60 + 60;
        } else if (this.char === '*' || this.char === '❄') {
            this.vy = Math.random() * 45 + 45;
        } else if (this.char === '❄️') {
            this.vy = Math.random() * 30 + 30;
        } else {
            this.vy = Math.random() * 30 + 30;
        }

        if (this.isMessage) {
            let hash = 0;
            for (let i = 0; i < this.text.length; i++) {
                hash = this.text.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = Math.abs(hash % 360); // 0~360 사이의 고정된 색상 값 추출
            this.color = `hsl(${hue}, 100%, 70%)`; // 채도 100%, 명도 70% (밝은 색)
        } else {
            this.color = COLORS.SNOW;
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
            ctx.shadowColor = this.color;
        } else {
            // ctx.font = FONT_FAMILY;
            ctx.font = `bold ${this.fontSize}px monospace`;
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

    for(let i=0; i<150; i++) {
        flakes.push(new Flake(Math.random() * width));
        flakes[flakes.length-1].y = Math.random() * height;
    }

    try {
        const response = await fetch('/get_messages/');
        const data = await response.json();
        if (data.messages) {
            data.messages.forEach(msg => {
                let f = new Flake(Math.random() * width, msg);
                f.y = Math.random() * height;
                flakes.push(f);
            });
        }
    } catch (e) {
        console.error("메시지 로딩 실패:", e);
    }

    // 관리자 여부 체크 (HTML 템플릿에서 IS_ADMIN 변수를 true로 넘겨주어야 함)
    const isAdmin = (typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true);

    if (typeof USER_HAS_POSTED !== 'undefined' && USER_HAS_POSTED) {
        // 관리자가 아닐 때만 이미 작성했다면 입력 제한
        if (!isAdmin) {
            alert(isAdmin)
            disableInput("이미 메시지를 등록하셨습니다.");
        }
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
        const response = await fetch('/add_message/', {
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

            // 관리자 확인
            const isAdmin = (typeof IS_ADMIN !== 'undefined' && IS_ADMIN === true);

            if (!isAdmin) {
                // 일반 유저: 작성 후 비활성화
                disableInput("메시지가 등록되었습니다!");
            } else {
                // 관리자: 입력창 비우고 계속 작성 가능
                input.value = "";
                input.focus();
                const status = document.getElementById('statusMsg');
                if(status) {
                    status.innerText = "메시지 등록됨 (관리자 모드)";
                    status.style.color = '#0f0';
                }
            }


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

    // 꼬마전구/오너먼트 색상 순서를 위한 카운터
    let lightCounter = 0;
    let onmtCounter = 0;

    TREE_ASCII.forEach((line, i) => {
        for (let j = 0; j < line.length; j++) {
            ctx.font = `bold ${FONT_SIZE}px monospace`;
            const char = line[j];
            if (char === " ") continue;
            const x = startX + (j * charWidth);
            const y = startY + (i * FONT_SIZE);
            ctx.shadowBlur = 0;

            if (char === "$") { // 별
                const brightness = (Math.sin(now * 3) + 1) / 2; // 0~1
                const lightness = 40 + (brightness * 45); // 50% ~ 90% (어두운 노랑 -> 밝은 노랑)
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

            } else if (char === "o") { // 장식구
                const ONMT_FONT_SIZE = 15;
                const msgCharWidth = ONMT_FONT_SIZE * 0.9;
                ctx.font = `bold ${ONMT_FONT_SIZE}px monospace`;

                // const color = ONMT_COLORS[onmtCounter % ONMT_COLORS.length];
                // onmtCounter++; // 다음 전구는 다음 색상으로
                // ctx.shadowBlur = 4;
                // ctx.fillStyle = color;

                const hash = (Math.floor(x) * 13 + Math.floor(y) * 27) % 1000;
                const color = ONMT_COLORS[hash % ONMT_COLORS.length];

                // 금속성 반짝임 (빛의 반사 표현)
                const phase = now * 3 + (hash * 0.01);
                // 0~1 사이로 밝기가 천천히 변함
                const brightness = Math.sin(phase)*2 -1 // -1 ~ +1;

                // 기본 색상 설정
                ctx.fillStyle = color;

                // 금속 느낌의 핵심:
                // 밝을 때는 광택(shadowBlur)을 강하게 주고, 그림자 색상을 밝게 설정
                ctx.shadowColor = color;
                ctx.shadowBlur = 10 + (brightness * 10);


                ctx.fillText('●', x, y);



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

    const msg = "석이네";
    const MSG_FONT_SIZE = 18;
    const msgCharWidth = MSG_FONT_SIZE * 0.9;
    ctx.font = `bold ${MSG_FONT_SIZE}px monospace`;

    const msgX = (width / 2) - ((msg.length * msgCharWidth) / 2);
    const msgY = height - 325;

    for (let i = 0; i < msg.length; i++) {
        const hue = (now * 50 + i * 20) % 360;
        ctx.fillStyle = `hsl(${hue}, 85%, 65%)`;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 0;
        ctx.fillText(msg[i], msgX + (i * msgCharWidth), msgY);
    }
}

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    targetWind = Math.sin(timestamp / 5000) * 3.0;
    wind += (targetWind - wind) * 0.1;

    if (Math.random() < 0.70) {
        flakes.push(new Flake(Math.random() * width));
    }

    let nextFlakes = [];
    for (let f of flakes) {
        f.update(dt);
        f.draw(ctx);
        if (f.y < height + 25) {
            nextFlakes.push(f);
        } else if (f.isMessage) {
            // 수정: 메시지 눈송이는 바닥에 닿으면 다시 위로 올림 (무한 반복)
            f.y = -50;
            f.x = Math.random() * width; // X 위치는 랜덤 재설정
            nextFlakes.push(f);
        }
    }
    flakes = nextFlakes;

    if (height > 300) drawTree(timestamp / 1000);

    requestAnimationFrame(loop);
}

init();