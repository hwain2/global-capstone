# 항공기 구조 개념설계 계산기

공개판: <https://hwain2.github.io/global-capstone/dashboard/>  
내부판: 경북대 5600G 서버에서 같은 `dashboard` 폴더를 FastAPI로 제공

기존 중량 경험식, 하중, 스파 자동 탐색, 강성·처짐, 3D, Trade Study 및 최종 경험식 판정은 브라우저 JavaScript에서 계산합니다. Baseline 원본은 `data/baselines/*.json`이며 `manifest.json`은 공개판 목록입니다. 계산 가능한 AR·날개폭·시위·동압 등은 로드 시 다시 계산합니다. Baseline 선택 시 작업 입력을 처음부터 다시 만들므로 이전 Concept 값이 남지 않습니다.

## 공개판과 내부판

| 기능 | GitHub Pages | 5600G 내부 서버 |
| --- | --- | --- |
| Baseline 선택·계산·Trade Study | 가능 | 가능 |
| Baseline 저장·복제·비활성화·이력 | API 없음 | 가능 |
| Local Git commit·GitHub Sync | API 없음 | 가능 |
| Local LLM | 없음 | 현재 비활성, 인터페이스만 준비 |

공개판은 `data/baselines/manifest.json`에 있는 활성 Baseline JSON을 읽습니다. `file://`로 직접 열면 JSON fetch가 막힐 수 있으므로 HTTP 서버 또는 GitHub Pages에서 사용합니다. GitHub Pages에는 Python API 실행 환경이 없으며 편집 버튼도 표시하지 않습니다. 내부판은 `/api/config`에서 `EDITOR_MODE`를 확인하고 서버 API를 사용합니다. 입력값 잠금 해제는 **현재 계산용 복사본**만 바꾸며 JSON 원본을 수정하지 않습니다.

## 데이터와 배터리

각 JSON에는 `id`, `school`, `concept_name`, `configuration`, `revision`, 기체·주익·동체·비행·추진·배터리·중량 예산·구조 입력, 출처, 메모, 편집자, 시각이 들어갑니다. 각 수치에는 `value`, `unit`, `source_type`, `source_note`를 둡니다. 복제된 값에는 `inherited_from`과 확인 필요 메모를 남기고 출처를 `ASSUMED`로 바꿉니다.

`INHA 2-Prop` 배터리는 **12S 3.3 Ah**입니다. 배터리 질량이 제공되지 않아 `battery_mass_kg.value = null`, `source_type = TBD`로 저장합니다. 전체 중량 예산은 배터리 용량이 아닌 확인된 질량만 사용합니다. 기존 코드에는 12S 6.5 Ah 기본값이 없었습니다. 별도 근거가 생기면 새 Alternative Baseline으로 추가할 수 있습니다.

## 5600G Ubuntu 설치

아래 경로와 사용자명은 실제 서버 값으로 바꾸세요. 저장소는 `dashboard`만 Git 저장소로 분리하지 않고 `global-capstone` 저장소 안에 둡니다.

```bash
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip nodejs nginx apache2-utils
git clone git@github.com:hwain2/global-capstone.git /srv/global-capstone
cd /srv/global-capstone/dashboard
bash scripts/setup_server.sh
```

`setup_server.sh`는 `.venv`에 FastAPI/Uvicorn을 설치하고 `.runtime/history.sqlite`를 초기화합니다. 두 경로는 `.gitignore`에 포함됩니다. 서버가 오프라인이면 필요한 Python 패키지를 내부 패키지 저장소로 미리 제공해야 합니다. 원본 JSON과 SQLite는 정기 백업하세요.

GitHub 동기화에는 서비스 사용자의 SSH 키에 해당 저장소 쓰기 권한이 필요합니다. 서버에서 `git remote -v`, `git config user.name`, `git config user.email`, `ssh -T git@github.com`으로 연결을 확인합니다. SSH 키나 비밀번호를 `dashboard` 파일에 넣지 마세요.

먼저 로컬에서 확인:

```bash
cd /srv/global-capstone/dashboard
AST_MODE=EDITOR_MODE bash scripts/start_server.sh
curl http://127.0.0.1:8765/api/config
```

`scripts/knu-aircraft.service.example`의 `KNU_USER`, `DASHBOARD_PATH`를 바꿔 `/etc/systemd/system/knu-aircraft.service`에 설치합니다. 해당 사용자는 저장소와 `.runtime`에 쓸 수 있어야 하며 Git commit 작성자 이름·이메일 및 GitHub SSH 인증을 설정해야 합니다. GitHub push 권한은 이 서비스 사용자에게만 부여하세요.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now knu-aircraft
sudo systemctl restart knu-aircraft
sudo systemctl status knu-aircraft
sudo journalctl -u knu-aircraft -f
```

`scripts/nginx-knu-aircraft.conf.example`의 `KNU_INTERNAL_HOST`, `KNU_ALLOWED_CIDR`을 실제 내부 DNS와 VPN/LAN 대역으로 바꾸고 Nginx Basic Auth 파일을 만듭니다. 이 서버는 **내부망/VPN과 TLS가 있는 경로로만** 제공하세요. FastAPI는 기본적으로 127.0.0.1:8765에만 바인딩됩니다. `Editor Name`은 변경 이력 표기용이며 인증 수단이 아닙니다.

```bash
sudo htpasswd -c /etc/nginx/.htpasswd-knu-aircraft knu-editor
sudo cp scripts/nginx-knu-aircraft.conf.example /etc/nginx/sites-available/knu-aircraft
# 복사한 파일에서 KNU_INTERNAL_HOST와 KNU_ALLOWED_CIDR을 바꾼 뒤:
sudo ln -s /etc/nginx/sites-available/knu-aircraft /etc/nginx/sites-enabled/knu-aircraft
sudo nginx -t
sudo systemctl reload nginx
```

실제 서버 인증서와 HTTPS 종단은 학교망 운영 방식에 맞춰 Nginx 또는 앞단 프록시에서 구성합니다. `/backend`, `.runtime`, Git 설정 파일은 FastAPI 정적 라우트로 제공되지 않습니다. `PUBLIC_MODE`로 FastAPI를 실행하더라도 쓰기 라우트는 등록되지 않습니다.

## 편집·동기화 흐름

1. 내부판에서 Baseline을 선택하고 `수정`, `복제`, `+ 새 Baseline` 중 하나를 엽니다.
2. `Editor Name`과 출처 메모를 입력합니다. 질량·면적 등 오류는 저장하지 않고, AR/시위/면적 불일치는 경고로 표시합니다.
3. 저장하면 JSON을 원자적으로 교체하고, SQLite에 필드별 이전값·새값·편집자·시각·revision을 기록한 뒤 변경된 Baseline JSON과 manifest만 로컬 Git commit합니다.
4. 다른 사람이 먼저 저장해 revision이 달라졌다면 HTTP 409와 최신값을 보여주고 덮어쓰지 않습니다. 겹친 항목마다 최신값 또는 내 수정을 선택해 최신 revision 기준으로 폼을 병합한 뒤 다시 저장합니다.
5. `GitHub Sync`를 별도로 누르면 `origin/main`을 확인한 후 push합니다. 원격이 앞서 있거나 네트워크가 끊기면 동기화가 실패하며 로컬 JSON·SQLite·commit은 유지됩니다. 원격이 앞섰다면 서버 관리자가 충돌을 검토하고 Git에서 병합해야 합니다.
6. GitHub Pages 배포가 완료되면 공개판이 새 manifest/JSON을 읽습니다.

비활성화는 JSON을 지우지 않고 `active:false`로 저장합니다. 공개 manifest에서는 빠지며 내부판에서 다시 활성화할 수 있습니다. GitHub 저장소 자체에 다른 미커밋 변경이 있다면 내부판 저장은 Baseline 파일만 commit합니다. 동기화 전 Baseline JSON에 미커밋 변경이 있으면 push를 중단합니다.

## 검증

```bash
cd /srv/global-capstone/dashboard
node tests/optimization.test.js
node tests/baselines.test.js
node tests/baseline-editor.test.js
.venv/bin/python -m pip install -r backend/requirements-dev.txt
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
```

내부 API 확인에는 `.venv/bin/python` 또는 `.venv/bin/uvicorn`을 사용합니다. 현재 데이터·서비스 테스트는 오프라인 환경에서도 실행됩니다. 본 계산기의 PASS/FAIL은 개념설계 경험식 및 간이 구조모델 판정입니다. 실제 익형, 적층, 좌굴, 접합부, 제작 공차, FEA는 후속 검증 대상입니다.

## 향후 AI 연결

`backend/ai_service.py`에 선택적 `BaselineAI` 인터페이스와 비활성 구현이 있습니다. `GET /api/ai/status`는 현재 비활성을 알리고, parse/review/compare 요청은 503을 반환합니다. 별도 RTX 3060 Ti PC의 모델을 연결할 때도 AI 출력은 입력 후보로만 취급하고 사람 확인 후에만 Baseline을 저장하도록 유지합니다. AI 서버가 꺼져 있어도 편집·계산·이력·Git 기능은 독립적으로 동작합니다.

## 요구사항 점검 및 보완 (2026-10-06)

여러 학교의 Baseline JSON, 내부 편집·복제·비활성화, 이력·revision, 공개판 쓰기 차단, 선택적 AI 인터페이스와 기존 계산 엔진은 이미 구현되어 있습니다. 이번 점검에서는 아래 항목을 보완했습니다.

- 프로펠러 수 1을 유효한 입력으로 허용하고, 잘못된 revision·필드 출처·수치·요청 JSON을 저장 전에 차단합니다. 새 Baseline 생성 요청은 기존 ID를 덮어쓰지 않으며 수정 요청은 없는 ID를 생성하지 않습니다.
- 충돌 시 최신 revision과 내 수정의 변경점을 비교합니다. 서로 다른 항목의 수정은 보존하고, 같은 항목은 최신값/내 수정 중 하나를 선택한 후 편집을 계속합니다. 변경 사유도 유지되며 병합만으로 저장하지 않습니다. 저장 직전에 다른 사람이 또 수정하면 다시 충돌 검사를 합니다.
- 저장 성공 응답으로 계산을 즉시 갱신합니다. 이후 목록 조회가 실패해도 저장된 값과 계산 결과는 유지하고 목록 갱신 실패만 알립니다.
- 작업용 입력값 JSON에 배터리 직렬 수·용량·프로펠러 수·원본 Baseline 정보·출처 메모를 함께 저장합니다. 배터리 질량은 작업용 `weightBudget.battery` 한 곳에 두며, 화면·중량 예산·CSV·요약이 같은 값을 읽습니다. 예전 형식의 입력값 파일도 불러올 수 있습니다.
- 3D에는 JSON에 입력된 프로펠러 수와 스파 위치를 반영합니다. 모터 위치는 실제 좌표가 없는 상태의 대칭 개념 배치이며 실제 기체의 추진 배치 검증은 별도입니다.
- AR와 날개폭을 함께 제공하면 날개폭을 계산 기준으로 삼고, 원본 보고 AR의 불일치를 경고합니다. 익근·익단 시위를 함께 제공하면 taper를 계산하고 원본 보고값과 비교합니다. 원본 JSON은 자동으로 덮어쓰지 않습니다.
- 기존 스파 단면, 실제 위치 두께·캡 폭, 재료 경험식 계수와 비교용 하중도 편집기에서 설정할 수 있습니다. 바꾸지 않은 필드의 단위·출처·상속 메모는 그대로 보존합니다. 자동 스파 sizing의 지배 기동·돌풍하중 및 제한하중 처짐 계산은 유지합니다.
- Local Git commit 메시지에 편집자·변경 사유·필드별 이전값/새값을 기록합니다. commit 실패 시에도 JSON과 이력을 보존하며 UI에 실패를 표시합니다. sync 시간 초과도 데이터 손실 없이 실패로 처리합니다.

### GitHub Pages 자동 갱신

저장소 루트의 `.github/workflows/pages.yml`은 `main` 변경 시 계산·편집기·서비스 테스트를 실행한 후 정적 공개판을 배포합니다. PR에서는 검증만 수행합니다. 공개 아티팩트에는 HTML·CSS·JS·활성 Baseline JSON만 포함되며 Python backend, SQLite, 실행환경, Git 저장소는 포함되지 않습니다. 기존 `/global-capstone/dashboard/` 주소를 유지합니다.

[GitHub 공식 배포 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)에 따라 저장소 관리자가 GitHub의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 한 번 설정해야 합니다. 이후 내부 서버의 `GitHub Sync`로 `main`에 push하면 테스트와 Pages 배포가 실행됩니다. 배포가 실패하면 GitHub Actions 로그를 확인하세요. 로컬 저장·commit은 그대로 남습니다. 기존 branch 방식의 Pages를 계속 사용하는 경우 해당 방식으로도 JSON은 갱신되지만, 이 workflow의 정적 아티팩트 배포에는 Actions 설정이 필요합니다.

공개판 아티팩트를 로컬에서 확인하려면 비어 있는 새 출력 폴더를 사용합니다.

```bash
cd /srv/global-capstone/dashboard
python3 scripts/build_public.py /tmp/knu-public-preview
python3 -m http.server 8080 --bind 127.0.0.1 --directory /tmp/knu-public-preview
# http://127.0.0.1:8080/dashboard/
```

### 내부 서버 Git 작성자와 remote

서비스 사용자 계정으로 다음을 설정합니다. `YOUR_SERVICE_EMAIL`은 실제 사용할 이메일로 바꾸세요. Editor Name은 각 변경의 이력과 commit 본문에 기록하고, Git 작성자는 서버 서비스 계정으로 구분합니다.

```bash
cd /srv/global-capstone
git config user.name "KNU Baseline Server"
git config user.email "YOUR_SERVICE_EMAIL"
git remote -v
# 기존 clone이 HTTPS이고 SSH 인증을 사용할 경우:
git remote set-url origin git@github.com:hwain2/global-capstone.git
```

Git 쓰기 인증과 서버 설정의 실제 사용자·DNS·허용 대역은 운영 환경에서 설정해야 합니다. 코드와 배포 예시만으로 학교 서버가 자동으로 설정되는 것은 아닙니다.

### 필수 테스트 대응

| 요구사항 테스트 | 검증 위치 |
| --- | --- |
| 1–3: 12S 3.3 Ah, 기존 계산, JSON 로딩 | `tests/baselines.test.js` |
| 4–6: 복제, 재시작/새로고침, 다른 클라이언트의 동일 데이터 | `tests/test_baseline_service.py`, `tests/test_baseline_api.py` |
| 7–8: Baseline 전환 시 전체 재계산, 이전 값 제거 | `tests/baseline-editor.test.js`, `tests/baselines.test.js` |
| 9–10: 편집자·필드 이력, 오래된 revision 차단·병합 | 서비스/API 테스트, `tests/baseline-editor.test.js` |
| 11–13: 오프라인 저장, 로컬 commit, sync 실패·시간 초과·push 거절 시 데이터 보존 | 서비스/API 테스트 |
| 14–16: 공개판 편집 UI 없음, 쓰기 라우트 없음, 내부 CRUD | 편집기/API 테스트, `tests/test_public_build.py` |
| 17–19: 동일 입력 계산 결과, 강도·강성·처짐·동일 엔진 | `tests/baselines.test.js`, `tests/optimization.test.js` |

위 검증 명령으로 JavaScript 테스트 3종과 Python 테스트를 함께 실행합니다. 테스트는 임시 Baseline과 임시 Git 저장소를 사용합니다. 실제 학교망 접속, GitHub 쓰기 인증, Pages의 실 배포 성공은 배포 환경에서 확인해야 합니다. 그래프·3D용 Plotly는 CDN에서 불러오므로 인터넷 연결이 필요합니다.
